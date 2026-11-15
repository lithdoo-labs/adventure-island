#!/usr/bin/env python3
"""T086.1 post-review corrections (ACCEPT-WITH-CORRECTIONS closure).

Reviewer finding #1 (BLOCKING, lead-verified): +0x938/+0x93C have a SECOND
direct writer 0x5CB573 (input-driven, speed field +0x970, +5, /10, same
800x600 clamp) reached via dispatcher 0x5CAB38 case 1 from 0x9FEE24 — the
"single-funnel / written ONLY via 0x5CB0E0" wording in G10/C-102/C-101 was
wrong. Reviewer finding #2 (NON-BLOCKING): dispatch-name alignment phrasing
unified to the precise trichotomy (62 named cases: 61 recvops-aligned, 1
(0x6A quest_KJ) in neither space, 0 sendops-aligned).
Also re-hashes EV-88 after the forensics-file correction (canonical rule).
"""
import csv
import hashlib
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SOT = REPO / "research/source-of-truth"
sys.stdout.reconfigure(encoding="utf-8")


def patch(path, key_col, key, updates, expect_frag=None):
    rows = list(csv.reader(path.open(newline="", encoding="utf-8")))
    header, body = rows[0], rows[1:]
    hit = False
    pending = False
    for r in body:
        if r[header.index(key_col)] == key:
            for col, val in updates.items():
                old = r[header.index(col)]
                if old == val:
                    continue
                if expect_frag and col in expect_frag:
                    assert expect_frag[col] in old, f"{key}.{col}: '{expect_frag[col]}' not in '{old[:120]}'"
                r[header.index(col)] = val
                pending = True
            hit = True
    assert hit, (path.name, key)
    if pending:
        with path.open("w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerows([header] + body)
        print("patched", key, "in", path.name)
    else:
        print("skip (already applied)", key, "in", path.name)


# ---- EV-88 re-hash (canonical rule) after the forensics correction ----
EV88_FILE = REPO / "research/result/stage-readiness/forensics/T0861-G10-CAMERA-STATIC-SLICES.txt"
new_hash = hashlib.sha256(EV88_FILE.read_bytes().replace(b"\r\n", b"\n")).hexdigest()
rows = list(csv.reader((SOT / "evidence.csv").open(newline="", encoding="utf-8")))
header = rows[0]
ei = header.index("evidence_id")
cur = None
for r in rows[1:]:
    if r[ei] == "EV-88":
        cur = r[header.index("source_sha256")]
        break
assert cur is not None
if cur != new_hash:
    assert cur.startswith("b65a7db7") or cur.startswith("c4a20e37"), f"unexpected EV-88 hash {cur}"
patch(SOT / "evidence.csv", "evidence_id", "EV-88",
      {"source_sha256": new_hash,
       "address": "0x53471A full body; 0x5348C5; 0x9EC924/0x9EC989; 0x5CABE1/0x5CB0E0; "
                  "0x5CB573 second direct field writer (reviewer); 0x5CAB38 dispatcher; "
                  "0x48AEC3/0x404B07/0x404B2E; producers 0x4BEDAA/0x5F1C3D; caller 0x9EDA1D",
       "instruction_or_data":
       "interprocedural windows: slot15 arg flow -> user methods 0x953B3D/0x9535F1 (persistent user "
       "fields +0x2ED4/+0x2ED8); [0xBDD838] read/write/offset architecture with 800x600 clamp; two "
       "UI-grid producer templates; PLUS the t086.1-reviewer second direct writer 0x5CB573 "
       "(input-axis-driven per-tick updater: [this+0x970]+5 speed, /10 scale, same clamp, direct "
       "stores at 0x5CB713/0x5CB71F, notify 0x5CA91A, cmd 0x200 via 0x5CC30A(this+0x9BC))"})

# ---- G10 scope correction ----
G10_SCOPE = (
    "VR fold A (C-026); scene-manager skeleton (C-084); t086 (C-101/EV-87): slot15 caller "
    "census encoding-complete (28 disp8 + 0 others), slot12 direct caller 0x5658CA, 0x953AF4 "
    "dispatcher; t086.1 (C-102/EV-88 + reviewer counter-evidence merged): INTERPROCEDURAL STATIC "
    "CHAIN RECOVERED — slot15 args forward to user methods 0x953B3D/0x9535F1 (persistent user "
    "fields +0x2ED4/+0x2ED8); the fieldctx camera wrappers 0x9EC924 (get: base + "
    "[fieldctx+0xD4] slot4/5 offset) / 0x9EC989 (set: offset-subtracted) over the [0xBDD838] "
    "singleton; persistent position +0x938/+0x93C (gated by +0xC) with the wrapper writer "
    "0x5CB0E0 (hard [0,800]x[0,600] clamp — C-027 correlation now instruction-level) AND a "
    "SECOND direct field writer 0x5CB573 (reviewer-found, lead-verified: input-axis-driven "
    "per-tick updater, speed=[this+0x970]+5, /10 scale, same clamp, direct stores "
    "0x5CB713/0x5CB71F, notify 0x5CA91A; reached via dispatcher 0x5CAB38 case 1 from "
    "0x9FEE24) — the 0x9EC989 set-path has exactly TWO direct producers (0x4BEDE7, 0x5F1C7D, "
    "both UI-grid placement templates) but the singleton is NOT single-writer; role of "
    "[0xBDD838] undetermined (UI-grid placements AND input-driven updates both target it); "
    "alt cull entry 0x5348C5 has exactly one direct caller 0x9EDA8B"
)
G10_UNRES = (
    "concrete class/role of [0xBDD838] (two UI-grid producers vs the input-driven updater "
    "0x5CB573 — which surface it scrolls is class-identity-bound) and of the offset object "
    "[fieldctx+0xD4] (world-camera/scroll candidate read directly by slot15); the writer of "
    "[fieldctx+0xD4]; whether 0x5CB573's axis inputs derive from the user avatar position "
    "(C-028 candidate: its speed field +0x970, +5 bias and /10 scale are concrete static "
    "parameters of an update mechanism whose target surface is unconfirmed); non-E8 "
    "(function-pointer-store) writers of +0x938/+0x93C not exhaustively enumerated; "
    "follow/deadzone/world-to-screen PARAMETERS (C-028) still not fully recovered"
)
patch(SOT / "gaps.csv", "gap_id", "G10",
      {"verified_scope": G10_SCOPE, "unresolved_scope": G10_UNRES},
      expect_frag={"verified_scope": "written ONLY via 0x5CB0E0"})

# ---- C-102 correction ----
C102 = (
    "G10 structural advance (t086.1, EV-88; reviewer counter-evidence merged): (1) slot15 "
    "0x53471A full decode — cull window built from persistent [fieldctx+0xD4] slot4/5 values "
    "(X0/Y0 via 0x404B07/0x404B2E + 0x48AEC3) and scene+0x1D0/+0x1D4 bounds, args forwarded to "
    "0x953B3D(user,x,y) which itself camera-gets via 0x9EC924(flag=1) and container-adds at "
    "+0x14 margins; alt family entry 0x5348C5 -> 0x9535F1(user,x,y) stores persistent user "
    "fields +0x2ED4/+0x2ED8 and has exactly ONE direct E8 caller 0x9EDA8B; (2) the [0xBDD838] "
    "screen-position singleton — base read 0x5CABE1 (returns [+0x938]/[+0x93C] when [+0xC]!=0, "
    "dynamic fallback pair [0xBE1764]/[0xBE1768] otherwise), wrapper write 0x5CB0E0 (clamp x "
    "to [0,800], y to [0,600]; store +0x938/+0x93C; fallback pair [0xBE1750]/[0xBE1754]); "
    "SECOND DIRECT field writer 0x5CB573 (t086.1 reviewer, lead-verified): input-axis-driven "
    "per-tick updater — speed = [this+0x970]+5, pos += speed*axis/10, same 800x600 clamp, "
    "direct stores at 0x5CB713/0x5CB71F with change detection, notify 0x5CA91A, command 0x200 "
    "via 0x5CC30A(this+0x9BC); reached from 0x9FEE24 via dispatcher 0x5CAB38 (cases "
    "0x5CB9EC/0x5CB573/0x5CBE2A); fieldctx wrappers 0x9EC924 (get adds [fieldctx+0xD4] "
    "slot4/5) / 0x9EC989 (set subtracts them); 0x5CB0E0 has exactly one E8 caller (inside "
    "0x9EC989); 0x9EC924 has 24 consumers; 0x9EC989 has exactly TWO producers (0x4BEDE7, "
    "0x5F1C7D) both following the UI-grid placement template (helpers 0x4BEE19: %10-based "
    "206/81/200/80 grid; 0x5F1C88: /16-based grid with base (2,502)) with +0x22 margins and "
    "flag=0; (3) BOUNDED HONESTY: the singleton's role is UNDETERMINED (two UI-grid producers "
    "AND one input-driven updater both target it; it is a concrete static candidate for the "
    "C-028 update-mechanism family); the world-camera candidate remains the [fieldctx+0xD4] "
    "offset object read directly by slot15 — its class and writers are the concrete next "
    "static targets. C-101's 'persistent fields only VR fold' wording corrected; C-028's "
    "follow/deadzone formulas remain unrecovered"
)
patch(SOT / "claims.csv", "claim_id", "C-102", {"claim": C102},
      expect_frag={"claim": "G10 structural advance"})

# ---- C-101 annotation wording (single-funnel phrase fix) ----
rows = list(csv.reader((SOT / "claims.csv").open(newline="", encoding="utf-8")))
header = rows[0]
ci = header.index("claim_id")
for r in rows[1:]:
    if r[ci] == "C-101":
        t = r[header.index("claim")]
        old = "(+0x938/+0x93C, single-funnel clamped writer 0x5CB0E0) exists behind the fieldctx "
        new = ("(+0x938/+0x93C; wrapper writer 0x5CB0E0 clamps [0,800]x[0,600] and — per the "
               "t086.1 reviewer — a SECOND direct input-driven writer 0x5CB573 exists) sits "
               "behind the fieldctx ")
        assert old in t, "C-101 single-funnel phrase not found"
        r[header.index("claim")] = t.replace(old, new)
        break
else:
    raise SystemExit("C-101 not found")
with (SOT / "claims.csv").open("w", newline="", encoding="utf-8") as f:
    csv.writer(f).writerows(rows)
print("patched C-101 annotation wording")

# ---- C-095 / G17 alignment-count phrasing (61/62 -> precise trichotomy) ----
patch(SOT / "claims.csv", "claim_id", "C-095", {
    "falsification":
    "any corpus row whose value is not reproducible from the jar properties + default rule; "
    "t086.1 WITHDRAWN: the T086 reviewer annotation called the jar line "
    "'DOJO_WARP_UP = SHOW_ITEM_GAIN_INCHAT 1' corrupt — the shipped ExternalCodeTableGetter "
    "bytecode DOES support the two-field relative form (base = enum current value, def(-2) "
    "triggers recursive properties resolve), SHOW_ITEM_GAIN_INCHAT (send decl index 38) "
    "precedes DOJO_WARP_UP (39) and carries 0xD0, so DOJO_WARP_UP = 0x00D1 is "
    "properties-derivable and row 0x00D1 is NOT observed-tier "
    "(forensics/T0861-G17-PROPERTY-RESOLUTION.txt); t086.1 caveat on the client tier: of the "
    "62 task44-named 0xA10CE3 cases, 61 names match recvops entries exactly, 1 (0x6A "
    "quest_KJ) exists in neither properties space, 0 match sendops, and 35 handled ids have "
    "no sendops meaning at all — using the switch to adjudicate SEND-side conflict names is "
    "unsupported (5 adjudications retracted, see G17)",
}, expect_frag={"falsification": "WITHDRAWN"})

patch(SOT / "gaps.csv", "gap_id", "G17", {
    "verified_scope":
    "opcode semantics corpus A (C-046); t086 (C-095/EV-83/EV-84) + t086.1 re-verification: all "
    "442 values fully attributed — 355 jar-properties direct (DOJO_WARP_UP=0x00D1 included via "
    "the bytecode-proven relative form) + 11 explicit 0xFF + 76 default 0xFFFE, ZERO "
    "corpus-vs-jar conflicts (re-derived with bytecode-faithful getValue emulation); jar "
    "properties identical to public ms079 (366/366) and conflict with Afauria on 15 names; "
    "client-instruction tier REVISED t086.1: switch 0xA10CE3 binds 97 ids 0x20..0x80 to "
    "handler bodies but its task44 name space is recvops-aligned (of 62 named cases: 61 match "
    "recvops, 1 matches neither space, 0 match sendops; 35 handled ids have no sendops "
    "meaning at all) — the T086 '92 S2C opcodes bound' reading and the numeric-range "
    "client-adjudication of 5 send-side conflict names are retracted; prior wire observations "
    "(task048: 17/18 values incl. WARP_TO_MAP=0x81) unchanged",
}, expect_frag={"verified_scope": "switch 0xA10CE3 binds 97 ids"})

print("\nreview corrections applied")
