#!/usr/bin/env python3
"""T086.1 — apply the round's ledger corrections (idempotent, fail-closed).

Corrections applied:
  WP0  C-099 / G08 / G09 / EV-85 note / readiness report: radix fix
       -2^31 -> -2^30 (0x40000000 = 2^30; numeric values unchanged).
  WP1  C-095 / G17 / crosswalk: DOJO_WARP_UP relative property RESOLVES
       (=0x00D1) per the shipped ExternalCodeTableGetter bytecode — reviewer
       annotation withdrawn; 0xA10CE3 switch number-space caveat recorded
       (task44 labels align with recvops 61/62, sendops 0/62); the 5
       send-side "client-adjudicated" conflicts retracted to
       UNRESOLVED-VERSION-AUTHORITY (report-level).
  WP3  C-101 annotated (persistent-state wording overstated; alt entry
       0x5348C5 has direct caller 0x9EDA8B); new C-102 + EV-88; G10
       OPEN-RUNTIME -> PARTIAL-STATIC; matrix P2-05/P2-06/P4-07 notes
       refreshed; gap-register view rows synced.
"""
import csv
import hashlib
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SOT = REPO / "research/source-of-truth"
sys.stdout.reconfigure(encoding="utf-8")

_applied = set()


def patch(path, key_col, key, updates, expect_old=None):
    rows = list(csv.reader(path.open(newline="", encoding="utf-8")))
    header, body = rows[0], rows[1:]
    hit = False
    already = True
    for r in body:
        if r[header.index(key_col)] == key:
            for col, val in updates.items():
                old = r[header.index(col)]
                if old != val:
                    already = False
                    if expect_old is not None and col in expect_old:
                        frag = expect_old[col]
                        assert frag in old, f"{key}.{col}: expected '{frag}' in '{old[:120]}'"
                    r[header.index(col)] = val
            hit = True
    assert hit, (path.name, key)
    if not already:
        with path.open("w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerows([header] + body)
        _applied.add(f"{path.name}:{key}")
        print("patched", key, "in", path.name)
    else:
        print("skip (already applied)", key, "in", path.name)


def upsert(path, key_col, key, row):
    rows = list(csv.reader(path.open(newline="", encoding="utf-8")))
    header = rows[0]
    idx = {c: i for i, c in enumerate(header)}
    if any(r[idx[key_col]] == key for r in rows[1:]):
        print("skip (already present)", key, "in", path.name)
        return
    row = list(row)
    assert len(row) == len(header), (len(row), len(header))
    with path.open("a", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow(row)
    _applied.add(f"{path.name}:+{key}")
    print("appended", key, "to", path.name)


# ------------------------------------------------------------------ WP0
C099 = (
    "CMS079 avatar insertion key formula (t086, machine-code recovered; closes G08; t086-reviewer "
    "value-cross-check merged; t086.1 RADIX CORRECTION — the base is -2^30 = -0x40000000 = "
    "-1073741824, T086 prose said '-2^31' which is wrong; no value changed, see "
    "forensics/T0861-G08-KEY-CONSTANT-AUDIT.txt): key = 10*(layer*3000 - zM) - 0x40000000 + 29990 "
    "+ (2 + (flag!=0 ? 5 : 0)) = -2^30 + {29992, 29997} + 10*(3000L - g) — the EFFECTIVE avatar "
    "values {29992, 29997} are value-identical to the v83 OpenMS hypothesis (independently derived "
    "from CMS079 bytes, not copied); object = [user+0xF28] (M-holder), layer/zM at field+0x130/+0x134 "
    "(same layout as tile key C-001), flag = field+0x18 dword; two avatar consumption sites: 0x9363D9 "
    "-> 0x452147 (body: push key; push [[this+0x88]+0xE44]; call [eax+0xB4]) and 0x93E7F2 (imul 0xBB8 "
    "@0x93E80D) which applies key-1 (dec edi at 0x93E87C/0x93E926/0x93EF2A) before the 0x427EB3-family "
    "PUT wrapper 0x439AAD; reviewer-extended family: +3 sibling band at 0x70DDD7 (base offset 29991 "
    "-> effective {29993, 29998}), flat-base sites (29991/29992 without the flag pair), sentinel "
    "0xC0041F14, full cross-checked type-base set {-2^30 + 0, 2000, 19990, 29983, 29985..29992, 29995, "
    "29996, 29999} plus the 59970/59980 family — note 19990 and 2000 are exactly the tile (C-001) and "
    "obj (C-002) bases (both = -(2^30 - B)), completing the single designed key space"
)
patch(SOT / "claims.csv", "claim_id", "C-099", {"claim": C099},
      expect_old={"claim": "-2^31 + {29992, 29997}"})

G08 = (
    "t086 C-099/EV-85 + reviewer cross-check + t086.1 radix audit: CMS079 formula machine-code "
    "recovered - key = 10*(layer*3000 - zM) - 0x40000000 + 29990 + (2 + 5*(flag!=0)) = -2^30 + "
    "{29992, 29997} + 10*(3000L-g) — effective values VALUE-IDENTICAL to the v83 hypothesis, "
    "independently derived (t086.1 anchor tests: L0/G0/flag0 = -1073711832, flag1 = -1073711827; "
    "T086's '-2^31' prose was a radix labeling error, 0x40000000 = 2^30); layer/zM at "
    "[user+0xF28]-0xC field +0x130/+0x134; consumption: 0x9363D9 -> 0x452147 -> direct keyed "
    "[eax+0xB4] call on [[this+0x88]+0xE44]; 0x93E7F2/0x93E909/0x93EF0D apply key-1 (dec edi) then "
    "feed the 0x427EB3-family PUT wrapper 0x439AAD; reviewer-extended family: +3 band 0x70DDD7 "
    "({29993,29998}), flat bases 29991/29992, sentinel 0xC0041F14, full type-base set {0, 2000, "
    "19990, 29983, 29985..29992, 29995, 29996, 29999, 59970, 59980} (19990/2000 = the tile/obj "
    "bases — one designed key space on the -2^30 base); all feed the C-097 keyed insert"
)
patch(SOT / "gaps.csv", "gap_id", "G08", {"verified_scope": G08},
      expect_old={"verified_scope": "key = 10*(layer*3000 - zM) - 2^31 + 29990"})

G09 = (
    "static model complete (zmap 149 layers, C-043); t086: (a) cross-object ordering mechanism "
    "CLOSED — avatars/mobs/NPCs/drops insert into the SAME ordered container with the SAME "
    "comparator 0x50403A42 and the shared -2^30+299xx key space (C-097/C-099; t086.1 radix "
    "correction: the base is 2^30, T086 said 2^31 in prose); (b) data anchors verified in the "
    "shipped Base.wz — zmap.img 149 == EXE model, zmap_cn order-identical, smap.img 106 "
    "layer->component bindings (C-100/EV-86); internal part order (zmap) and world order (key "
    "space) established separately per task"
)
patch(SOT / "gaps.csv", "gap_id", "G09", {"verified_scope": G09},
      expect_old={"verified_scope": "-2^31+299xx key space"})

patch(SOT / "evidence.csv", "evidence_id", "EV-85", {
    "interpretation":
    "avatar/mob/npc/drop/obj key formula windows; constants as lea disp32 "
    "(-2^30+299xx family; t086.1 radix correction — T086 note said 2^31)",
}, expect_old={"interpretation": "(-2^31+299xx family)"})

# ------------------------------------------------------------------ WP1
C095_FALS = (
    "any corpus row whose value is not reproducible from the jar properties + default rule; "
    "t086.1 WITHDRAWN: the T086 reviewer annotation called the jar line "
    "'DOJO_WARP_UP = SHOW_ITEM_GAIN_INCHAT 1' corrupt — the shipped ExternalCodeTableGetter "
    "bytecode DOES support the two-field relative form (base = enum current value, def(-2) "
    "triggers recursive properties resolve), SHOW_ITEM_GAIN_INCHAT (send decl index 38) precedes "
    "DOJO_WARP_UP (39) and carries 0xD0, so DOJO_WARP_UP = 0x00D1 is properties-derivable and "
    "row 0x00D1 is NOT observed-tier (forensics/T0861-G17-PROPERTY-RESOLUTION.txt); t086.1 "
    "caveat on the client tier: the 0xA10CE3 switch's task44 name alignment is recvops 61/62 "
    "vs sendops 0/62 and 35 handled ids have no sendops meaning — using it to adjudicate "
    "SEND-side conflict names is unsupported (5 adjudications retracted, see G17)"
)
patch(SOT / "claims.csv", "claim_id", "C-095", {"falsification": C095_FALS},
      expect_old={"falsification": "is corrupt under the"})

G17_SCOPE = (
    "opcode semantics corpus A (C-046); t086 (C-095/EV-83/EV-84) + t086.1 re-verification: all "
    "442 values fully attributed — 355 jar-properties direct (DOJO_WARP_UP=0x00D1 included via "
    "the bytecode-proven relative form) + 11 explicit 0xFF + 76 default 0xFFFE, ZERO "
    "corpus-vs-jar conflicts (re-derived with bytecode-faithful getValue emulation); jar "
    "properties identical to public ms079 (366/366) and conflict with Afauria on 15 names; "
    "client-instruction tier REVISED t086.1: switch 0xA10CE3 binds 97 ids 0x20..0x80 to "
    "handler bodies but its task44 name space aligns with recvops (61/62) not sendops (0/62) "
    "and 35 handled ids have no sendops meaning — the T086 '92 S2C opcodes bound' reading and "
    "the numeric-range client-adjudication of 5 send-side conflict names are retracted; prior "
    "wire observations (task048: 17/18 values incl. WARP_TO_MAP=0x81) unchanged"
)
G17_UNRES = (
    "original-production-server authority for the subset never observed on the wire and outside "
    "the verified client dispatch bands; t086.1 triage: 15 Afauria conflicts now ALL "
    "UNRESOLVED-VERSION-AUTHORITY at report level (5 send-side 'client-adjudications' retracted; "
    "recv SKILL_MACRO=0x6D keeps switch-corroboration only; BOAT_EFFECT has client handlers for "
    "both 0x97 (0x565935) and 0x98 (0x56599A) via family router 0x5658FF — payload-shape "
    "adjudication inconclusive; REPORT_PLAYER/SPOUSE_CHAT 0x7FFE-vs-0xFF are placeholder pairs)"
)
patch(SOT / "gaps.csv", "gap_id", "G17",
      {"verified_scope": G17_SCOPE, "unresolved_scope": G17_UNRES},
      expect_old={"verified_scope": "switch 0xA10CE3 statically binds 92 S2C opcodes"})

# crosswalk: textual single-line edit (csv.writer rewrite would churn quoting)
xw = SOT / "issue-crosswalk.csv"
xw_txt = xw.read_text(encoding="utf-8")
XW_OLD = 'G17,R4-07,"ROUND4-REMAINING-GAPS.csv","367 opcodes","server properties off-disk"'
XW_NEW = ('G17,R4-07,"ROUND4-REMAINING-GAPS.csv","367 opcodes",'
          '"t086: values live in server079.jar recvops/sendops.properties (355 direct + 11 FF '
          '+ 76 FFFE, 0 conflicts; t086.1 re-derived with bytecode-faithful getValue incl. '
          'DOJO_WARP_UP=0x00D1 relative form)"')
if XW_NEW in xw_txt:
    print("skip (already applied) G17 in issue-crosswalk.csv")
elif XW_OLD in xw_txt:
    xw.write_text(xw_txt.replace(XW_OLD, XW_NEW), encoding="utf-8", newline="")
    _applied.add("issue-crosswalk.csv:G17")
    print("patched G17 in issue-crosswalk.csv (textual)")
else:
    raise SystemExit("G17 crosswalk row not found verbatim")

# ------------------------------------------------------------------ WP3
C101_ADD = (
    "; t086.1 CORRECTION/EXTENSION (C-102/EV-88): the 'persistent fields are only the VR fold' "
    "wording is OVERSTATED — slot15 reads persistent members [fieldctx+0xD4] (COM slot4/5 "
    "getters 0x404B07/0x404B2E via 0x48AEC3) and the [0xBDD838] screen-position singleton "
    "(+0x938/+0x93C, single-funnel clamped writer 0x5CB0E0) exists behind the fieldctx "
    "camera-get/set wrappers 0x9EC924/0x9EC989; and the family exports an ALT cull entry "
    "0x5348C5 with exactly one direct E8 caller 0x9EDA8B (the '0 direct callers' census "
    "covered only the 0x53471A body)"
)
rows = list(csv.reader((SOT / "claims.csv").open(newline="", encoding="utf-8")))
header = rows[0]
ci = header.index("claim_id")
target = None
for r in rows[1:]:
    if r[ci] == "C-101":
        target = r
        break
assert target is not None, "C-101 not found"
claim_col = header.index("claim")
if "OVERSTATED" in target[claim_col] and C101_ADD.strip() in target[claim_col]:
    print("skip (already applied) C-101 annotation")
else:
    assert "OVERSTATED" not in target[claim_col], "C-101 in unexpected state"
    target[claim_col] = target[claim_col] + C101_ADD
    with (SOT / "claims.csv").open("w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows(rows)
    _applied.add("claims.csv:C-101-annotate")
    print("annotated C-101")

G10_SCOPE = (
    "VR fold A (C-026); scene-manager skeleton (C-084); t086 (C-101/EV-87): slot15 caller "
    "census encoding-complete (28 disp8 + 0 others), slot12 direct caller 0x5658CA, 0x953AF4 "
    "dispatcher; t086.1 (C-102/EV-88): INTERPROCEDURAL STATIC CHAIN RECOVERED — slot15 args "
    "forward to user methods 0x953B3D/0x9535F1 (persistent user fields +0x2ED4/+0x2ED8); the "
    "fieldctx camera wrappers 0x9EC924 (get: base + [fieldctx+0xD4] slot4/5 offset) / 0x9EC989 "
    "(set: offset-subtracted) over the [0xBDD838] singleton; persistent position +0x938/+0x93C "
    "(gated by +0xC) written ONLY via 0x5CB0E0 with a hard [0,800]x[0,600] clamp (C-027 "
    "correlation now instruction-level); exactly TWO direct producers of the set funnel "
    "(0x4BEDE7, 0x5F1C7D) — both UI-grid placement templates (helpers 0x4BEE19/0x5F1C88), and "
    "the alt cull entry 0x5348C5 has exactly one direct caller 0x9EDA8B"
)
G10_UNRES = (
    "concrete class/role of [0xBDD838] (current evidence leans UI/window-placement anchor: both "
    "producers are UI grids, consumers are container-add paths) and of the offset object "
    "[fieldctx+0xD4] (world-camera/scroll candidate read directly by slot15); the writer of "
    "[fieldctx+0xD4]; non-E8 (function-pointer-store) producers of 0x9EC989 were not "
    "exhaustively enumerated; follow/deadzone/world-to-screen PARAMETERS (C-028) still not "
    "recovered — if [0xBDD838] is UI-tier the follow algorithm lives in the +0xD4 object's "
    "update path"
)
patch(SOT / "gaps.csv", "gap_id", "G10",
      {"status": "PARTIAL-STATIC", "verified_scope": G10_SCOPE,
       "unresolved_scope": G10_UNRES, "blocker": "none - static work continues ([fieldctx+0xD4] writer census, [0xBDD838] class identity via creation-site tracing); runtime corroboration optional",
       "next_action": "census writers of fieldctx+0xD4 in the field-create family; trace [0xBDD838] construction/vtable; then either close statically or capture the +0xD4 update loop at runtime"},
      expect_old={"status": "OPEN-RUNTIME"})

# new claim C-102 + evidence EV-88
C102 = [
    "C-102", "Camera",
    "G10 structural advance (t086.1, EV-88): (1) slot15 0x53471A full decode — cull window built "
    "from persistent [fieldctx+0xD4] slot4/5 values (X0/Y0 via 0x404B07/0x404B2E + 0x48AEC3) and "
    "scene+0x1D0/+0x1D4 bounds, args forwarded to 0x953B3D(user,x,y) which itself camera-gets "
    "via 0x9EC924(flag=1) and container-adds at +0x14 margins; alt family entry 0x5348C5 -> "
    "0x9535F1(user,x,y) stores persistent user fields +0x2ED4/+0x2ED8 and has exactly ONE direct "
    "E8 caller 0x9EDA8B; (2) the [0xBDD838] screen-position singleton — base read 0x5CABE1 "
    "(returns [+0x938]/[+0x93C] when [+0xC]!=0, dynamic fallback pair [0xBE1764]/[0xBE1768] "
    "otherwise), base write 0x5CB0E0 (clamp x to [0,800], y to [0,600], store +0x938/+0x93C, "
    "fallback pair [0xBE1750]/[0xBE1754]); fieldctx wrappers 0x9EC924 (get adds "
    "[fieldctx+0xD4] slot4/5) / 0x9EC989 (set subtracts them); 0x5CB0E0 has exactly one E8 "
    "caller (inside 0x9EC989); 0x9EC924 has 24 consumers; 0x9EC989 has exactly TWO producers "
    "(0x4BEDE7, 0x5F1C7D) both following the UI-grid placement template (grid helpers "
    "0x4BEE19: %10-based 206/81/200/80 grid; 0x5F1C88: /16-based grid with base (2,502)) with "
    "+0x22 margins and flag=0; (3) BOUNDED HONESTY: with current evidence [0xBDD838] behaves as "
    "a UI/window placement anchor, NOT yet the world-follow camera; the world-camera candidate "
    "is the [fieldctx+0xD4] offset object read directly by slot15 — its class and writers are "
    "the concrete next static targets. C-101's 'persistent fields only VR fold' wording "
    "corrected; C-028's follow/deadzone formulas remain unrecovered",
    "PARTIAL-STATIC", "B", "EV-88", "unpack079",
    "0x53471A;0x5348C5;0x5348AD;0x953B3D;0x9535F1;0x9EC924;0x9EC989;0x5CABE1;0x5CB0E0;0x48AEC3;0x404B07;0x404B2E;0x4BEDAA;0x5F1C3D;0x9EDA1D",
    "all windows re-disassembled this round from the sha-pinned image; E8/dword censuses per "
    "function (0x5CB0E0=1 caller, 0x9EC924=24, 0x9EC989=2, 0x5348C5=1); template match for the "
    "producer pair",
    "a non-UI producer of 0x9EC989 found via non-E8 encoding, or a scene-family receiver at any "
    "of the 28 [reg+0x3C] sites",
    "(refines C-101/G10 wording and scope; runtime corroboration of the singleton identity "
    "optional)",
    "T086-1-EVIDENCE-INTEGRITY-CAMERA-REPORT.md;forensics/T0861-G10-CAMERA-STATIC-SLICES.txt",
]
upsert(SOT / "claims.csv", "claim_id", "C-102", C102)

EV88 = [
    "EV-88", "research/result/stage-readiness/forensics/T0861-G10-CAMERA-STATIC-SLICES.txt",
    hashlib.sha256((REPO / "research/result/stage-readiness/forensics/T0861-G10-CAMERA-STATIC-SLICES.txt")
                   .read_bytes().replace(b"\r\n", b"\n")).hexdigest(),
    "0x53471A full body; 0x5348C5; 0x9EC924/0x9EC989; 0x5CABE1/0x5CB0E0; 0x48AEC3/0x404B07/0x404B2E; producers 0x4BEDAA/0x5F1C3D; caller 0x9EDA1D",
    "instruction",
    "interprocedural windows: slot15 arg flow -> user methods 0x953B3D/0x9535F1 (persistent user "
    "fields +0x2ED4/+0x2ED8); [0xBDD838] read/write/offset architecture with 800x600 clamp; two "
    "UI-grid producer templates",
    "camera-consumption chain + persistent screen-position singleton recovered; C-101 wording "
    "corrected; G10 structural layer static (source of C-102)",
    "C-102", "research/scripts/t0861_* (this round); manual capstone windows; E8/dword censuses",
]
upsert(SOT / "evidence.csv", "evidence_id", "EV-88", EV88)

print("\napplied:", sorted(_applied))
