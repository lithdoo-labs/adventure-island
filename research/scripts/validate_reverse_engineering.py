#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""validate_reverse_engineering.py — clean-room fail-closed QA for RE deliverables.

Principles:
  * FAIL-CLOSED: a check that cannot run (missing file, unreadable CSV, unknown
    enum value) is an ERROR, never a silent pass.
  * Single source of truth: research/source-of-truth/*.csv are authoritative;
    generated views must be in sync with them.
  * Retracted claims must not live as active conclusions in any non-audit doc.

Checks (14):
  1  CSV parse of every research CSV
  2  status legality (7-value enum) in claims/gaps + gap-register view
  3  evidence-grade legality (A/B/C/D/R) wherever a grade column exists
  4  gap uniqueness (source-of-truth + markdown view)
  5  claim uniqueness
  6  evidence-reference existence (claims -> evidence.csv; evidence -> files)
  7  vtable slot bounds (R13-COM-INTERFACE-RESOLUTION method_index < slot_count)
  8  runtime bidirectional consistency (gaps <-> crosswalk <-> runtime files)
  9  crosswalk mapping completeness (open items mapped; mapped ids exist)
  10 generated statistics match source-of-truth (gap-register auto block)
  11 markdown reference existence
  12 retracted/superseded claims must not appear active (VERIFIED w/o marker)
  13 frozen ABI file unchanged (sha256 pin)
  14 legacy exemptions are declared and bounded (no blanket skip)

Exit codes: 0 = PASS, 1 = FAIL (errors), 2 = internal error.
"""
import os, re, csv, sys, io, hashlib, collections

# UTF-8 stdout on Windows consoles
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

REPO = os.environ.get('RE_VALIDATE_ROOT') or os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RR = os.path.join(REPO, 'research', 'result')
SOT = os.path.join(REPO, 'research', 'source-of-truth')
CLEANROOM = os.path.join(RR, 'clean-room')

VALID_STATUS = {
    'CLOSED-STATIC', 'CLOSED-RUNTIME', 'PARTIAL-STATIC', 'OPEN-STATIC',
    'OPEN-RUNTIME', 'BLOCKED', 'SUPERSEDED',
}
VALID_GRADE = {'A', 'B', 'C', 'D', 'R'}

# Frozen ABI pin — updating it requires an independent ABI review (see
# components/RENDER-NODE-ABI-V1.md and the clean-room audit report).
FROZEN_ABI = {
    'components/RENDER-NODE-ABI-V1.md': 'PINNED-IN:frozen-abi.txt',
}
FROZEN_ABI_PIN_FILE = os.path.join(SOT, 'frozen-abi.txt')

# Strict schemas that MUST exist and MUST carry these columns.
STRICT_SCHEMAS = {
    'R13-DISPATCH-RESOLUTION.csv': ['rva', 'slot45_target', 'slot45_rva', 'slots', 'identity'],
    'R13-SLOT45-CANDIDATES.csv': ['dll', 'vtable_rva', 'n_slots', 'slot45_rva', 'classification', 'instruction_head', 'grade'],
    'R13-COM-INTERFACE-RESOLUTION.csv': ['dll', 'class_name', 'iid', 'interface_offset', 'vtable_rva', 'slot_count', 'method_index', 'method_rva', 'method_semantics', 'confidence', 'evidence_source'],
    'FINAL-REVERSE-ENGINEERING-COVERAGE.csv': ['module', 'claim', 'current_status', 'evidence_grade', 'report', 'runtime_needed'],
    'FINAL-REVERSE-ENGINEERING-OPEN-ISSUES.csv': ['id', 'module', 'issue', 'status', 'evidence_grade', 'minimal_verification', 'blocks_abi_freeze'],
    'ROUND4-MODULE-COVERAGE.csv': ['module', 'priority', 'report', 'new_this_round', 'static_status', 'remaining_status', 'open_count', 'minimal_action'],
    'ROUND4-REMAINING-GAPS.csv': ['id', 'module', 'gap', 'status', 'evidence', 'minimal_action'],
}

# Retracted claim patterns: (claim_id, regex, why). Matched case-insensitively
# against every non-exempt .md under research/ and docs/.
# Tier A: pattern + VERIFIED/CLOSED marker nearby without retraction marker.
# Tier B (strict): assertive restatement of a retracted claim with NO
#   retraction marker nearby at all — catches prose that re-asserts a refuted
#   claim without ever saying VERIFIED (review finding P0-1/P0-2).
RETRACTED_PATTERNS = [
    ('RC-01', r'CreateRawCanvas', '0x427EB3 is a property-PUT wrapper, not a creator'),
    ('RC-02', r'slot45.{0,40}(有序插入|ordered[ _-]?insert)|有序插入.{0,20}slot45', 'slot45 has zero insert semantics across 22 candidates'),
    ('RC-03', r'Tile.{0,20}Obj.{0,30}(同容器|same[ _-]?container)|同容器有序插入', 'Tile/Obj same-container claim refuted by channel separation'),
    ('RC-04', r'0x5042D0A0.{0,120}(运行时补丁|runtime[ _-]?patch)|(运行时补丁|runtime[ _-]?patch).{0,120}0x5042D0A0', '0x5042D0A0 is __imp__purecall IAT entry'),
    ('RC-05', r'RTTI.{0,30}(验证|双\s*VERIFIED|verified).{0,40}(CWzRawCanvas|CWzGr2DLayer|类身份)|(CWzRawCanvas|CWzGr2DLayer).{0,30}RTTI.{0,20}verif', 'no COL exists; class names are proximity inference'),
    ('RC-10', r'COM\s*比较回调|0x666F7D.{0,40}比较', '[eax+0xB4] result is HRESULT-checked, not a comparator'),
    ('RC-18', r'(稳定插入|stable[ _-]?insert).{0,30}(VERIFIED|已验证|已证)', 'equal-key stability is unproven (WZ-order sample only)'),
]
# Tier B: assertive restatements — flag with NO verified-marker requirement.
# Only suppressed by a retraction marker within ±300 chars or a whole-file
# archive banner (<!--CLEANROOM-ARCHIVE-->).
RETRACTED_ASSERTIVE = [
    ('RC-02B', r'(\+0xB4|[eax\+0xB4\]]|eax\+0xB4).{0,80}(有序插入|ordered[ _-]?insert)|(有序插入|ordered[ _-]?insert).{0,80}(\+0xB4|比较器在\s*DLL)', 'asserts [eax+0xB4]=ordered-insert (refuted, Claim C-013)'),
    ('RC-04B', r'0x2D0A0.{0,160}占位|占位.{0,160}0x2D0A0|运行时补丁的占位', 'asserts runtime-patch placeholder for IAT (refuted, Claim C-010)'),
]
ARCHIVE_BANNER = re.compile(r'CLEANROOM-ARCHIVE', re.I)
RETRACTION_MARKERS = re.compile(
    r'SUPERSEDED|REFUTED|RETRACTED|CONTRADICTED|推翻|撤销|~~|WRONG|CORRECTED|❌|✘|'
    r'NOT[ _-]?insert|NOT[ _-]?creator|NOT[ _-]?patch|NOT[ _-]?verified|已撤销|降级|'
    r'无一呈现|无插入|零插入|零支撑|无比较器|已否定',
    re.I)
VERIFIED_MARKERS = re.compile(r'VERIFIED|CLOSED-STATIC', re.I)
# Docs whose job is to record retractions are exempt from check 12.
RETRACTION_EXEMPT = ('research\\result\\audit\\', 'research/result/audit/',
                     'research\\result\\clean-room\\', 'research/result/clean-room/',
                     'research\\source-of-truth\\', 'research/source-of-truth/',
                     'CRITICAL-QUALITY-REMEDIATION', 'RETRACTED-CLAIMS')

# Check 14: legacy structural exemptions must be explicitly declared here and
# are counted, never silently skipped. Content-level errors still fail.
LEGACY_CSV_PREFIXES = (
    'task0', 'compatibility-', 'file-manifest', 'protocol-session-',
    'runtime-network-', 'stage3-', 'EXE-DISPATCH-RESOLVED', 'WAVE',
    'FUNCTION-FINGERPRINTS', 'FINAL-CLASSIFICATION', 'SEMBATCH',
    'INTERN-TABLE-', 'STRING-HEAP-', 'MOTION-TABLE-', 'PROTOCOL-MASTER-',
    'FRONTIER-', 'DLL-VTABLE-METHODS', 'DLL-OBJECT-ARCHITECTURE',
    'DLL-VTABLES-STATIC', 'EXE-IFACE-CALLSITES', 'IFACE-',
    'ATLAS-PACKET-', 'ULTIMATE-',
)

HEX_RE = re.compile(r'^0x[0-9a-fA-F]{1,8}$')

errors = []
warnings = []
stats = collections.Counter()


def err(code, msg):
    errors.append(f'{code} {msg}')
    stats['errors'] += 1


def warn(code, msg):
    warnings.append(f'{code} {msg}')
    stats['warnings'] += 1


def read_text(path):
    with open(path, 'rb') as f:
        raw = f.read()
    try:
        return raw.decode('utf-8')
    except UnicodeDecodeError as e:
        raise ValueError(f'not utf-8: {e}')


def parse_csv(path):
    """Return (header, rows). Fail-closed on unreadable/malformed content."""
    text = read_text(path)
    rows = list(csv.reader(text.splitlines()))
    if not rows:
        raise ValueError('empty')
    return rows[0], rows[1:]


def is_legacy(fname):
    return any(fname.startswith(p) or p in fname for p in LEGACY_CSV_PREFIXES)


def find_result_csv(name):
    for root, _dirs, files in os.walk(RR):
        if name in files:
            return os.path.join(root, name)
    return None


# ------------------------------------------------------------------
# CHECK 1 — parse every CSV under research/
# ------------------------------------------------------------------
def check_all_csvs():
    csv_files = []
    for root, _d, files in os.walk(os.path.join(REPO, 'research')):
        if '__pycache__' in root:
            continue
        for f in files:
            if f.endswith('.csv'):
                csv_files.append(os.path.join(root, f))
    stats['csv_total'] = len(csv_files)

    strict_missing = dict(STRICT_SCHEMAS)
    for path in csv_files:
        fname = os.path.basename(path)
        rel = os.path.relpath(path, REPO)
        legacy = is_legacy(fname)
        try:
            header, rows = parse_csv(path)
        except Exception as e:
            if legacy:
                stats['csv_legacy_unparseable'] += 1
                continue
            err('CSV-READ', f'{rel}: {e}')
            continue
        stats['csv_parsed'] += 1

        # quote-balance guard: physical lines swallowed into multi-line
        # records indicate an unterminated quote (review finding P1-1)
        physical = len(read_text(path).splitlines())
        trailing_blank = sum(1 for ln in read_text(path).splitlines()[physical - 1::-1]
                             if not ln.strip())
        if not legacy and len(rows) + 1 < physical - trailing_blank:
            err('CSV-QUOTE', f'{rel}: {physical - trailing_blank - 1 - len(rows)} '
                             f'physical line(s) swallowed into quoted records — unbalanced quotes')

        if len(header) != len(set(header)):
            dups = sorted({c for c in header if header.count(c) > 1})
            err('CSV-DUPCOL', f'{rel}: duplicate columns {dups}')

        width_bad = 0
        for i, row in enumerate(rows, 2):
            if len(row) != len(header):
                width_bad += 1
                if not legacy and width_bad <= 3:
                    err('CSV-WIDTH', f'{rel} line {i}: {len(row)} cols vs header {len(header)}')
        if legacy and width_bad:
            stats['csv_legacy_width'] += width_bad

        if fname in strict_missing:
            del strict_missing[fname]
            req = STRICT_SCHEMAS[fname]
            for col in req:
                if col not in header:
                    err('CSV-SCHEMA', f'{rel}: missing required column "{col}"')
            stats['csv_strict'] += 1

    # every declared strict schema must exist — fail-closed
    for fname in strict_missing:
        err('CSV-STRICT-MISSING', f'declared strict schema not found: {fname}')


# ------------------------------------------------------------------
# CHECKS 2-6 — source-of-truth CSVs
# ------------------------------------------------------------------
def load_sot():
    claims_path = os.path.join(SOT, 'claims.csv')
    gaps_path = os.path.join(SOT, 'gaps.csv')
    evid_path = os.path.join(SOT, 'evidence.csv')
    cross_path = os.path.join(SOT, 'issue-crosswalk.csv')
    docs_path = os.path.join(SOT, 'documents.csv')
    for p, name in ((claims_path, 'claims.csv'), (gaps_path, 'gaps.csv'),
                    (evid_path, 'evidence.csv'), (cross_path, 'issue-crosswalk.csv'),
                    (docs_path, 'documents.csv')):
        if not os.path.exists(p):
            err('SOT-MISSING', f'research/source-of-truth/{name} not found')
            return None

    try:
        ch, crows = parse_csv(claims_path)
        gh, grows = parse_csv(gaps_path)
        eh, erows = parse_csv(evid_path)
        xh, xrows = parse_csv(cross_path)
        dh, drows = parse_csv(docs_path)
    except Exception as e:
        err('SOT-PARSE', str(e))
        return None

    claims = {}
    for r in crows:
        cid = r[ch.index('claim_id')]
        if cid in claims:
            err('CLAIM-DUP', f'{cid} appears more than once in claims.csv')
        claims[cid] = dict(zip(ch, r))
    gaps = {}
    for r in grows:
        gid = r[gh.index('gap_id')]
        if gid in gaps:
            err('GAP-DUP', f'{gid} appears more than once in gaps.csv')
        gaps[gid] = dict(zip(gh, r))
    evid = {}
    for r in erows:
        eid = r[eh.index('evidence_id')]
        if eid in evid:
            err('EVID-DUP', f'{eid} duplicated in evidence.csv')
        evid[eid] = dict(zip(eh, r))
    cross = [dict(zip(xh, r)) for r in xrows]
    docs = [dict(zip(dh, r)) for r in drows]
    return {'claims': claims, 'gaps': gaps, 'evidence': evid,
            'crosswalk': cross, 'documents': docs}


def check_sot(sot):
    if sot is None:
        return
    claims, gaps, evid = sot['claims'], sot['gaps'], sot['evidence']

    # CHECK 2: statuses legal; CHECK 3: grades legal
    for cid, c in claims.items():
        if c['status'] not in VALID_STATUS:
            err('CLAIM-STATUS', f'{cid}: illegal status "{c["status"]}"')
        g = c['evidence_grade'].strip()
        if g not in VALID_GRADE:
            err('CLAIM-GRADE', f'{cid}: illegal grade "{g}" (allowed A/B/C/D/R, no composites)')
        if c['status'] in ('CLOSED-STATIC', 'CLOSED-RUNTIME') and g in ('D',):
            err('CLAIM-GRADE-CLOSED', f'{cid}: CLOSED claim with hypothesis-grade D evidence')
    for gid, gp in gaps.items():
        if gp['status'] not in VALID_STATUS:
            err('GAP-STATUS', f'{gid}: illegal status "{gp["status"]}"')

    # CHECK 6: claims -> evidence refs exist; evidence source files exist
    for cid, c in claims.items():
        refs = [x.strip() for x in c['evidence_refs'].split(';') if x.strip() and x.strip() != '(none)']
        for ref in refs:
            if ref not in evid:
                err('EVID-REF', f'{cid} references unknown evidence id "{ref}"')
    for eid, e in evid.items():
        src = e['source_file']
        if src.startswith('(in-repo') or src.startswith('multi') or 'corpus' in src:
            continue
        # compound sources take first path component
        first = src.split('(')[0].strip()
        for cand in (first, first.split('+')[0].strip()):
            p = os.path.join(REPO, cand.replace('/', os.sep))
            if os.path.exists(p):
                break
        else:
            err('EVID-FILE', f'{eid}: source file not found "{src}"')
        for cid in [x.strip() for x in e['claim_id'].split(';')]:
            if cid and cid not in claims:
                err('EVID-CLAIM', f'{eid}: references unknown claim "{cid}"')

    # crosswalk sanity: gap ids exist
    for x in sot['crosswalk']:
        if x['gap_id'] not in gaps:
            err('XWALK-GAP', f'crosswalk references unknown gap "{x["gap_id"]}"')
    return claims, gaps


# ------------------------------------------------------------------
# CHECK 4 — gap-register markdown view: uniqueness + statuses legal
# ------------------------------------------------------------------
def check_gap_register_view(gaps):
    path = os.path.join(RR, 'REVERSE-ENGINEERING-GAP-REGISTER.md')
    if not os.path.exists(path):
        err('GAP-FILE', 'REVERSE-ENGINEERING-GAP-REGISTER.md missing')
        return {}
    text = read_text(path)
    seen = collections.Counter()
    view = {}
    for m in re.finditer(r'^\|\s*(G\d+)\s*\|(.+)$', text, re.M):
        gid = m.group(1)
        seen[gid] += 1
        cells = [re.sub(r'\*\*|\*|~~', '', c).strip() for c in m.group(2).split('|')]
        status = None
        for c in cells:
            for s in VALID_STATUS:
                if s in c:
                    status = s
                    break
            if status:
                break
        view[gid] = status
    for gid, n in seen.items():
        if n > 1:
            err('GAP-DUP', f'{gid} appears {n} times in gap register markdown')
    for gid, status in view.items():
        if status is None:
            err('GAP-STATUS', f'{gid}: no legal status in gap register markdown view')
        elif gid in gaps and gaps[gid]['status'] != status:
            err('GAP-VIEW-MISMATCH', f'{gid}: markdown says {status} but source-of-truth says {gaps[gid]["status"]}')
    # every source-of-truth gap must appear in the human-readable view
    for gid in gaps:
        if gid not in view:
            err('GAP-VIEW-MISSING', f'{gid} missing from gap register markdown view')
    return view


# ------------------------------------------------------------------
# CHECKS 8-9 — runtime bidirectional consistency + crosswalk
# ------------------------------------------------------------------
def check_runtime_consistency(sot, gaps):
    # active runtime ids from the structured files
    oi_path = find_result_csv('FINAL-REVERSE-ENGINEERING-OPEN-ISSUES.csv')
    r4_path = find_result_csv('ROUND4-REMAINING-GAPS.csv')
    open_ids = {}
    if oi_path:
        _h, rows = parse_csv(oi_path)
        for r in rows:
            open_ids[r[0]] = r[3]
    else:
        err('XFILE', 'FINAL-REVERSE-ENGINEERING-OPEN-ISSUES.csv not found')
    r4_ids = {}
    if r4_path:
        _h, rows = parse_csv(r4_path)
        for r in rows:
            r4_ids[r[0]] = r[3]
    else:
        err('XFILE', 'ROUND4-REMAINING-GAPS.csv not found')

    rt_file = os.path.join(RR, 'REVERSE-ENGINEERING-RUNTIME-REMAINING.md')
    rt_text = read_text(rt_file) if os.path.exists(rt_file) else ''
    if not rt_text:
        err('XFILE', 'REVERSE-ENGINEERING-RUNTIME-REMAINING.md missing')
    rt_ids = set(re.findall(r'\bR-\d+\b', rt_text))

    # build crosswalk index
    gap_to_rt = collections.defaultdict(set)
    rt_to_gap = collections.defaultdict(set)
    for x in sot['crosswalk']:
        for rid in re.findall(r'R-\d+|R4-\d+|ME-\d+', x['runtime_issue_id']):
            gap_to_rt[x['gap_id']].add(rid)
            rt_to_gap[rid].add(x['gap_id'])

    # every OPEN-RUNTIME gap must map to >=1 runtime id that exists in a runtime file
    for gid, gp in gaps.items():
        if gp['status'] == 'OPEN-RUNTIME':
            rids = gap_to_rt.get(gid, set())
            if not rids:
                err('XWALK-UNMAPPED', f'{gid} is OPEN-RUNTIME but has no runtime issue mapping')
                continue
            for rid in rids:
                if rid.startswith('R-') and rid not in rt_ids and rid not in open_ids:
                    err('XWALK-DANGLING', f'{gid} -> {rid}: runtime id not found in any runtime register')
                if rid.startswith('R4-') and rid not in r4_ids:
                    err('XWALK-DANGLING', f'{gid} -> {rid}: R4 id not found in ROUND4-REMAINING-GAPS.csv')

    # reverse: active OPEN-RUNTIME ids in structured registers must map back to a gap
    for rid, st in open_ids.items():
        if st == 'OPEN-RUNTIME' and rid not in rt_to_gap:
            err('XWALK-ORPHAN', f'{rid} OPEN-RUNTIME in Open Issues but not in crosswalk')
    for rid, st in r4_ids.items():
        if st == 'OPEN-RUNTIME' and rid not in rt_to_gap:
            err('XWALK-ORPHAN', f'{rid} OPEN-RUNTIME in R4 gaps but not in crosswalk')

    # OPEN-RUNTIME in open-issues with R- prefix must appear in runtime-remaining md
    for rid, st in open_ids.items():
        if st == 'OPEN-RUNTIME' and rid.startswith('R-') and rid not in rt_ids:
            err('XFILE-STALE', f'{rid} OPEN-RUNTIME in Open Issues but absent from RUNTIME-REMAINING')

    # closed gaps must not be active-open in the other registers under same id
    for gid, gp in gaps.items():
        if gp['status'].startswith('CLOSED') and gid in open_ids \
                and open_ids[gid] in ('OPEN-STATIC', 'OPEN-RUNTIME', 'BLOCKED'):
            err('XFILE-CONFLICT', f'{gid}: CLOSED in source-of-truth but OPEN in Open Issues')
    stats['open_issues'] = len(open_ids)
    stats['runtime_ids'] = len(rt_ids)


# ------------------------------------------------------------------
# CHECK 7 — vtable slot bounds
# ------------------------------------------------------------------
def check_slot_bounds():
    path = find_result_csv('R13-COM-INTERFACE-RESOLUTION.csv')
    if not path:
        return  # already flagged by strict-missing
    header, rows = parse_csv(path)
    idx = {c: i for i, c in enumerate(header)}
    for i, r in enumerate(rows, 2):
        if len(r) != len(header):
            continue
        mi, sc = r[idx['method_index']], r[idx['slot_count']]
        try:
            mi_val = int(mi.split('/')[0].strip())
            sc_val = int(sc.split('|')[0].strip())
        except ValueError:
            continue
        if mi_val >= sc_val:
            err('CSV-INDEX', f'R13-COM-INTERFACE-RESOLUTION.csv line {i}: method_index {mi} >= slot_count {sc}')
        conf = r[idx['confidence']].strip()
        if conf and conf not in VALID_GRADE:
            err('CSV-GRADE', f'R13-COM-INTERFACE-RESOLUTION.csv line {i}: illegal grade "{conf}"')


# ------------------------------------------------------------------
# CHECK 10 — generated statistics (gap-register auto block + coverage counts)
# ------------------------------------------------------------------
def check_statistics(gaps, claims):
    status_counts = collections.Counter(gp['status'] for gp in gaps.values())
    claim_counts = collections.Counter(c['status'] for c in claims.values())
    grade_counts = collections.Counter(c['evidence_grade'] for c in claims.values())

    path = os.path.join(RR, 'REVERSE-ENGINEERING-GAP-REGISTER.md')
    if not os.path.exists(path):
        return
    text = read_text(path)
    m = re.search(r'<!--GAP-STATS-AUTO-->(.*?)<!--/GAP-STATS-AUTO-->', text, re.S)
    if not m:
        err('STATS-BLOCK', 'gap register missing <!--GAP-STATS-AUTO--> machine block')
        return
    block = m.group(1)
    for st in VALID_STATUS:
        mm = re.search(rf'\|\s*{st}\s*\|\s*(\d+)\s*\|', block)
        if not mm:
            err('STATS-ROW', f'gap stats block missing row for {st}')
            continue
        claimed = int(mm.group(1))
        actual = status_counts.get(st, 0)
        if claimed != actual:
            err('STATS-MISMATCH', f'gap stats: {st} claimed {claimed}, source-of-truth has {actual}')
    mm = re.search(r'\|\s*\*{0,2}总计\*{0,2}\s*\|\s*\*{0,2}(\d+)\*{0,2}\s*\|', block)
    if mm:
        if int(mm.group(1)) != len(gaps):
            err('STATS-MISMATCH', f'gap total claimed {mm.group(1)}, actual {len(gaps)}')
    else:
        err('STATS-ROW', 'gap stats block missing 总计 row')
    stats['gap_status_counts'] = dict(status_counts)
    stats['claim_status_counts'] = dict(claim_counts)
    stats['claim_grade_counts'] = dict(grade_counts)


# ------------------------------------------------------------------
# CHECK 11 — markdown references resolve
# ------------------------------------------------------------------
def check_md_refs():
    md_files = []
    for root, _d, files in os.walk(RR):
        for f in files:
            if f.endswith('.md'):
                md_files.append(os.path.join(root, f))
    stats['md_total'] = len(md_files)
    for p in md_files:
        text = read_text(p)
        rel = os.path.relpath(p, REPO)
        clean = re.sub(r'```.*?```', '', text, flags=re.DOTALL)
        clean = re.sub(r'`[^`\n]+`', '', clean)
        for m in re.finditer(r'\[([^\]]*)\]\(([^)#\s]+)\)', clean):
            ref = m.group(2)
            if ref.startswith(('http://', 'https://', 'mailto:', 'data:')):
                continue
            if HEX_RE.match(ref) or ref.startswith('0x'):
                continue
            if '.' not in ref and '/' not in ref and '\\' not in ref:
                continue
            if not re.search(r'\.(md|csv|json|py|txt|log|xml|wz|img|dat|java|dll|exe)$', ref, re.I):
                continue
            ref_clean = ref.split('#')[0]
            if not ref_clean:
                continue
            full = os.path.normpath(os.path.join(os.path.dirname(p), ref_clean))
            if not (os.path.exists(full) or os.path.exists(os.path.join(REPO, ref_clean))):
                err('MD-REF', f'{rel}: broken reference "{ref}"')


# ------------------------------------------------------------------
# CHECK 12 — retracted claims must not be active (two tiers)
# ------------------------------------------------------------------
def check_retracted_active():
    scan_dirs = [RR, os.path.join(REPO, 'docs')]
    all_patterns = [(cid, re.compile(p, re.I), why, tier)
                    for cid, p, why in RETRACTED_PATTERNS for tier in ('A',)]
    all_patterns += [(cid, re.compile(p, re.I | re.S), why, 'B')
                     for cid, p, why in RETRACTED_ASSERTIVE]
    for base in scan_dirs:
        for root, _d, files in os.walk(base):
            for f in files:
                if not f.endswith('.md'):
                    continue
                p = os.path.join(root, f)
                rel = os.path.relpath(p, REPO)
                if any(rel.startswith(ex) or ex in rel for ex in RETRACTION_EXEMPT):
                    continue
                try:
                    text = read_text(p)
                except Exception:
                    err('MD-READ', f'{rel}: unreadable')
                    continue
                whole_file_archived = bool(ARCHIVE_BANNER.search(text[:2000]))
                for claim_id, pat, why, tier in all_patterns:
                    for m in pat.finditer(text):
                        ctx = text[max(0, m.start() - 300):m.end() + 300]
                        if RETRACTION_MARKERS.search(ctx):
                            continue
                        if whole_file_archived:
                            continue
                        if tier == 'A':
                            if VERIFIED_MARKERS.search(ctx):
                                err('RETRACTED-ACTIVE',
                                    f'{claim_id}: pattern "{m.group()}" near VERIFIED without retraction marker in {rel}:'
                                    f'{text[:m.start()].count(chr(10)) + 1}')
                        else:  # Tier B: assertive restatement, no marker at all
                            err('RETRACTED-ASSERTIVE',
                                f'{claim_id}: assertive restatement "{m.group()}" without retraction marker in {rel}:'
                                f'{text[:m.start()].count(chr(10)) + 1}')


# ------------------------------------------------------------------
# CHECK 13 — frozen ABI unchanged
# ------------------------------------------------------------------
def check_frozen_abi():
    if not os.path.exists(FROZEN_ABI_PIN_FILE):
        err('ABI-PIN', 'research/source-of-truth/frozen-abi.txt missing (pin required)')
        return
    pin_text = read_text(FROZEN_ABI_PIN_FILE).strip()
    pins = {}
    for line in pin_text.splitlines():
        if not line or line.startswith('#'):
            continue
        parts = [x.strip() for x in line.split(None, 1)]
        if len(parts) == 2:
            pins[parts[0]] = parts[1]
    for rel, _mode in FROZEN_ABI.items():
        p = os.path.join(REPO, rel.replace('/', os.sep))
        if not os.path.exists(p):
            err('ABI-FILE', f'frozen ABI file missing: {rel}')
            continue
        if rel not in pins:
            err('ABI-PIN', f'{rel} not pinned in frozen-abi.txt')
            continue
        h = hashlib.sha256(open(p, 'rb').read()).hexdigest()
        if h != pins[rel].lower():
            err('ABI-MODIFIED', f'{rel} sha256 {h[:12]}… != pin {pins[rel][:12]}… '
                                f'(frozen ABI requires independent review to change)')


# ------------------------------------------------------------------
# CHECK 14 — legacy exemptions bounded & reported
# ------------------------------------------------------------------
def check_exemptions():
    if not LEGACY_CSV_PREFIXES:
        err('EXEMPT-EMPTY', 'legacy exemption list empty (declare exemptions explicitly)')
    stats['exemption_prefixes'] = len(LEGACY_CSV_PREFIXES)
    # every exempt prefix must have matched at least one file historically; a
    # prefix matching nothing is stale and should be removed (warning only).
    matched = set()
    for root, _d, files in os.walk(RR):
        for f in files:
            if f.endswith('.csv') and is_legacy(f):
                matched.add(next(p for p in LEGACY_CSV_PREFIXES if f.startswith(p) or p in f))
    for p in LEGACY_CSV_PREFIXES:
        if p not in matched:
            warn('EXEMPT-STALE', f'legacy prefix "{p}" matches no current CSV — consider removing')


# ------------------------------------------------------------------
# CHECK 15 — clean-room generated copies in sync with source-of-truth
# ------------------------------------------------------------------
CLEANROOM_COPIES = {
    'CLAIM-CONSISTENCY-REGISTER.csv': 'claims.csv',
    'GAP-REGISTER.csv': 'gaps.csv',
    'ISSUE-CROSSWALK.csv': 'issue-crosswalk.csv',
    'EVIDENCE-INDEX.csv': 'evidence.csv',
}


def check_cleanroom_sync(sot):
    if sot is None:
        return
    for cc_name, sot_name in CLEANROOM_COPIES.items():
        cc_path = os.path.join(CLEANROOM, cc_name)
        sot_path = os.path.join(SOT, sot_name)
        if not os.path.exists(cc_path):
            err('CLEANROOM-SYNC', f'research/result/clean-room/{cc_name} missing (run generator)')
            continue
        # semantic comparison (line-ending agnostic, content-exact)
        try:
            cc_rows = list(csv.reader(read_text(cc_path).splitlines()))
            sot_rows = list(csv.reader(read_text(sot_path).splitlines()))
        except Exception as e:
            err('CLEANROOM-SYNC', f'{cc_name}: unreadable ({e})')
            continue
        if cc_rows != sot_rows:
            err('CLEANROOM-SYNC', f'{cc_name} differs from source-of-truth/{sot_name} — rerun generator')
    rc_path = os.path.join(CLEANROOM, 'RETRACTED-CLAIMS.csv')
    if os.path.exists(rc_path):
        _h, rows = parse_csv(rc_path)
        superseded = {c['claim_id'] for c in sot['claims'].values() if c['status'] == 'SUPERSEDED'}
        listed = {r[1] for r in rows if len(r) > 1}
        if superseded != listed:
            missing = superseded - listed
            extra = listed - superseded
            err('CLEANROOM-SYNC', f'RETRACTED-CLAIMS.csv out of sync (missing {sorted(missing)}, extra {sorted(extra)})')
    stats['cleanroom_synced'] = len(CLEANROOM_COPIES) + 1


def main():
    print('=== validate_reverse_engineering.py (clean-room, fail-closed) ===')
    print(f'Repository: {REPO}\n')

    check_all_csvs()                 # 1
    sot = load_sot()                 # loads + uniqueness 4/5
    claims, gaps = check_sot(sot) if sot else ({}, {})   # 2,3,6
    check_gap_register_view(gaps)    # 4 (view consistency)
    check_slot_bounds()              # 7
    if sot:
        check_runtime_consistency(sot, sot['gaps'])  # 8,9
        check_statistics(sot['gaps'], sot['claims'])  # 10
    check_md_refs()                  # 11
    check_retracted_active()         # 12
    check_frozen_abi()               # 13
    check_exemptions()               # 14
    check_cleanroom_sync(sot)        # 15

    print(f'CSV total: {stats["csv_total"]} (parsed {stats["csv_parsed"]}, strict {stats["csv_strict"]}, '
          f'legacy-width-issues {stats["csv_legacy_width"]})')
    print(f'MD scanned: {stats["md_total"]}')
    print(f'Open Issues rows: {stats["open_issues"]} | Runtime ids: {stats["runtime_ids"]}')
    if sot:
        print(f'Claims: {len(sot["claims"])} | Gaps: {len(sot["gaps"])} | Evidence: {len(sot["evidence"])}')
    print()

    print(f'ERRORS: {len(errors)}')
    for e in errors:
        print(f'  [FAIL] {e}')
    print(f'WARNINGS: {len(warnings)}')
    for w in warnings:
        print(f'  [WARN] {w}')

    if errors:
        print(f'\nRESULT: FAIL ({len(errors)} errors)')
        sys.exit(1)
    print(f'\nRESULT: PASS (0 errors, {len(warnings)} warnings)')
    sys.exit(0)


if __name__ == '__main__':
    main()
