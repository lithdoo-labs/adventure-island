#!/usr/bin/env python3
"""T086 post-review corrections — apply the independent reviewer's four
corrections (ACCEPT-WITH-CORRECTIONS closure) to claims/gaps:
  1. C-099/G08: effective avatar key values {29992, 29997} are VALUE-IDENTICAL
     to the v83 hypothesis (CMS079 decomposition 29990 + (2 + 5*flag));
     add the +3 sibling band at 0x70DDD7 ({29993, 29998}), flat-base sites,
     the full cross-checked type-base set, and the 0xC0041F14 sentinel.
  2. C-095/G17: annotate the corrupt jar property line
     'DOJO_WARP_UP = SHOW_ITEM_GAIN_INCHAT 1' (corpus row 0x00D1 not
     properties-derivable via the standard rule).
  3. C-101/G10: reviewer precision — wrapper 0x5658BF is itself vtable slot12
     of the 33-family (dword @0xB01338).
  4. C-096/G24: record the reviewer's independent candidate-exhaustion scan
     (0x5040418C occurs exactly twice: 0x5042D1B8 / 0x5042D288).
"""
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def patch(path, key_col, key, updates):
    rows = list(csv.reader(path.open(newline="", encoding="utf-8")))
    header, body = rows[0], rows[1:]
    hit = False
    for r in body:
        if r[header.index(key_col)] == key:
            for col, val in updates.items():
                r[header.index(col)] = val
            hit = True
    assert hit, (path, key)
    with path.open("w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows([header] + body)
    print("patched", key, "in", path.name)


SOT = REPO / "research/source-of-truth"

patch(SOT / "claims.csv", "claim_id", "C-099", {
    "claim":
    "CMS079 avatar insertion key formula (t086, machine-code recovered; closes G08; t086-reviewer "
    "value-cross-check merged): key = 10*(layer*3000 - zM) - 0x40000000 + 29990 + (2 + (flag!=0 ? 5 : 0)) "
    "= -2^31 + {29992, 29997} + 10*(3000L - g) — the EFFECTIVE avatar values {29992, 29997} are "
    "value-identical to the v83 OpenMS hypothesis (independently derived from CMS079 bytes, not copied); "
    "object = [user+0xF28] (M-holder), layer/zM at field+0x130/+0x134 (same layout as tile key C-001), "
    "flag = field+0x18 dword; two avatar consumption sites: 0x9363D9 -> 0x452147 (body: push key; push "
    "[[this+0x88]+0xE44]; call [eax+0xB4]) and 0x93E7F2 (imul 0xBB8 @0x93E80D) which applies key-1 (dec "
    "edi) before the 0x427EB3-family PUT wrapper 0x439AAD; reviewer-extended family: +3 sibling band at "
    "0x70DDD7 ({29993, 29998}), flat-base sites (29991/29992 without the flag pair), sentinel 0xC0041F14, "
    "full cross-checked type-base set {-2^31 + 0, 2000, 19990, 29983, 29985..29992, 29995, 29996, 29999} "
    "plus the 59970/59980 family — note 19990 and 2000 are exactly the tile (C-001) and obj (C-002) bases, "
    "completing the single designed key space",
})

patch(SOT / "gaps.csv", "gap_id", "G08", {
    "verified_scope":
    "t086 C-099/EV-85 + reviewer cross-check: CMS079 formula machine-code recovered - key = 10*(layer*3000 "
    "- zM) - 2^31 + 29990 + (2 + 5*(flag!=0)) = -2^31 + {29992, 29997} + 10*(3000L-g) — effective values "
    "VALUE-IDENTICAL to the v83 hypothesis, independently derived; layer/zM at [user+0xF28]-0xC field "
    "+0x130/+0x134; consumption: 0x9363D9 -> 0x452147 -> direct keyed [eax+0xB4] call on [[this+0x88]+0xE44]; "
    "0x93E7F2 applies key-1 then feeds the 0x427EB3-family PUT wrapper 0x439AAD; reviewer-extended family: "
    "+3 band 0x70DDD7 ({29993,29998}), flat bases 29991/29992, sentinel 0xC0041F14, full type-base set "
    "{0, 2000, 19990, 29983, 29985..29992, 29995, 29996, 29999, 59970, 59980} (19990/2000 = the tile/obj "
    "bases — one designed key space); all feed the C-097 keyed insert",
})

patch(SOT / "claims.csv", "claim_id", "C-095", {
    "falsification":
    "any corpus row whose value is not reproducible from the jar properties + default rule; reviewer "
    "annotation: the jar property line 'DOJO_WARP_UP = SHOW_ITEM_GAIN_INCHAT 1' is corrupt under the "
    "ExternalCodeTableGetter rule (relative-form base not resolvable) — corpus row 0x00D1/DOJO_WARP_UP is "
    "the one row not properties-derivable by the standard rule and stays observed-tier",
})

patch(SOT / "claims.csv", "claim_id", "C-101", {
    "claim":
    "G10 static advance (t086; reviewer precision merged): slot15 (0x53471A) call-site census COMPLETE — "
    "28 call [reg+0x3C] disp8 sites, 0 disp32-form, 0 SIB-form, 0 direct E8 callers (33 vtable slots only); "
    "receiver provenance of all 28 belongs to life/UI/COM/string-layer families, none provably the scene "
    "family (T084 bounded negative now enumeration-complete); NEW: slot12 0x53465B has exactly one direct "
    "E8 caller 0x5658CA inside wrapper 0x5658BF — which is itself vtable slot12 of the 33-handler family "
    "(dword @0xB01338) with a 40-tick ([esi+0x7AC]>=0x28) periodic action — first static frame-loop entry "
    "point; 0x953AF4 (per-draw) is a draw-phase switch {0x201..0x205} -> 0x9563E7/0x956411/0x9564EE/0x956AC3 "
    "with ZERO access to scene+0xF0..0xFC in it or its callees — not a camera producer; STRUCTURAL: slot15 "
    "consumes the camera rect as caller-supplied ARGS vs persistent scene+0x1D0/+0x1D4 world bounds, and "
    "the only persistent camera fields are the load-time VR fold bounds (C-026) — the per-frame camera "
    "value is caller-transient by construction; producer identity remains runtime-bound",
})

patch(SOT / "claims.csv", "claim_id", "C-096", {
    "reasoning":
    "full chain disassembled this round (sha-pinned scripts t086_wp1*); IID single-occurrence in Gr2D "
    ".data; reviewer independently confirmed the whole chain AND ran the candidate-exhaustion scan: dword "
    "0x5040418C occurs exactly twice in the DLL (0x5042D1B8 = T154 slot25, 0x5042D288 = T224 slot25) with "
    "no thunk aliases — the production slot25 candidate set {0x5042D154, 0x5042D224} is exhausted and both "
    "install the same node-creating body",
})

print("all review corrections applied")
