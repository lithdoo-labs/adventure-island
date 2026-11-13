#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""generate_cleanroom_deliverables.py — generate statistics and clean-room CSV
deliverables FROM research/source-of-truth/*.csv (single authoritative source).

Outputs:
  1. Rewrites the <!--GAP-STATS-AUTO--> block in
     research/result/REVERSE-ENGINEERING-GAP-REGISTER.md from gaps.csv.
  2. Emits research/result/clean-room/{CLAIM-CONSISTENCY-REGISTER.csv,
     GAP-REGISTER.csv, ISSUE-CROSSWALK.csv, EVIDENCE-INDEX.csv,
     RETRACTED-CLAIMS.csv} as generated copies of the source of truth.

The validator verifies generated copies are byte-identical to what the
generator would produce from source-of-truth (fail-closed sync check).
"""
import csv, io, os, sys, collections

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOT = os.path.join(REPO, 'research', 'source-of-truth')
RR = os.path.join(REPO, 'research', 'result')
OUT = os.path.join(RR, 'clean-room')

VALID_STATUS = ['CLOSED-STATIC', 'CLOSED-RUNTIME', 'PARTIAL-STATIC', 'OPEN-STATIC',
                'OPEN-RUNTIME', 'BLOCKED', 'SUPERSEDED']


def read_csv(path):
    with open(path, encoding='utf-8', newline='') as f:
        rows = list(csv.reader(f))
    return rows[0], rows[1:]


def write_csv(path, header, rows):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(header)
    w.writerows(rows)
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(buf.getvalue())


def main():
    gh, grows = read_csv(os.path.join(SOT, 'gaps.csv'))
    ch, crows = read_csv(os.path.join(SOT, 'claims.csv'))
    eh, erows = read_csv(os.path.join(SOT, 'evidence.csv'))
    xh, xrows = read_csv(os.path.join(SOT, 'issue-crosswalk.csv'))

    gaps = [dict(zip(gh, r)) for r in grows]
    claims = [dict(zip(ch, r)) for r in crows]

    # ---- 1. gap stats auto-block ----
    counts = collections.Counter(g['status'] for g in gaps)
    lines = ['| 状态 | 数量 |', '|---|---|']
    for st in VALID_STATUS:
        lines.append(f'| {st} | {counts.get(st, 0)} |')
    lines.append(f'| **总计** | **{len(gaps)}** |')
    block = '\n'.join(lines) + '\n'

    gapmd = os.path.join(RR, 'REVERSE-ENGINEERING-GAP-REGISTER.md')
    text = open(gapmd, encoding='utf-8').read()
    start = text.index('<!--GAP-STATS-AUTO-->') + len('<!--GAP-STATS-AUTO-->')
    end = text.index('<!--/GAP-STATS-AUTO-->')
    text = text[:start] + '\n' + block + text[end:]
    with open(gapmd, 'w', encoding='utf-8', newline='') as f:
        f.write(text)
    print(f'gap stats block regenerated: {dict(counts)} total={len(gaps)}')

    # ---- 2. clean-room CSV deliverables ----
    os.makedirs(OUT, exist_ok=True)
    write_csv(os.path.join(OUT, 'CLAIM-CONSISTENCY-REGISTER.csv'), ch, crows)
    write_csv(os.path.join(OUT, 'GAP-REGISTER.csv'), gh, grows)
    write_csv(os.path.join(OUT, 'ISSUE-CROSSWALK.csv'), xh, xrows)
    write_csv(os.path.join(OUT, 'EVIDENCE-INDEX.csv'), eh, erows)

    # retracted claims = claims.csv rows with status SUPERSEDED, plus the
    # pre-existing audit/RETRACTED-CLAIMS.csv RC-ids carried in the supersedes col
    rh = ['retraction_id', 'claim_id', 'claim', 'former_status', 'current_status',
          'evidence_refs', 'reason']
    rrows = []
    for c in claims:
        if c['status'] == 'SUPERSEDED':
            rrows.append([f'CR-{c["claim_id"][2:]}', c['claim_id'], c['claim'],
                          'VERIFIED/INFERRED (historical)', 'SUPERSEDED',
                          c['evidence_refs'], c['reasoning']])
    write_csv(os.path.join(OUT, 'RETRACTED-CLAIMS.csv'), rh, rrows)
    print(f'clean-room deliverables written to research/result/clean-room/ '
          f'(claims={len(crows)} gaps={len(grows)} evidence={len(erows)} retracted={len(rrows)})')


if __name__ == '__main__':
    main()
