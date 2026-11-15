#!/usr/bin/env python3
"""T086: fix stale implementation_impact / claim_refs on updated gap rows."""
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GAPS = REPO / "research/source-of-truth/gaps.csv"

FIX = {
    "G07": {"implementation_impact": "comparator semantics implementable from C-097 (keyed ordered-tree insert with secondary-key tie-break)",
            "claim_refs": "C-012;C-019;C-085;C-097"},
    "G08": {"implementation_impact": "avatar-vs-obj exact ordering implementable now (C-099 formula + C-097 insert)",
            "claim_refs": "C-025;C-099"},
    "G09": {"implementation_impact": "occlusion within avatar AND cross-object ordering implementable (C-043 + C-097/C-099/C-100); rendered corroboration optional",
            "claim_refs": "C-043;C-045;C-097;C-099;C-100"},
    "G01": {"claim_refs": "C-001;C-002;C-012;C-017;C-019;C-074;C-075;C-097;C-099"},
    "G10": {"claim_refs": "C-026;C-028;C-084;C-101"},
    "G17": {"claim_refs": "C-047;C-095"},
    "G22": {"claim_refs": "C-020;C-098"},
    "G24": {"claim_refs": "C-013;C-014;C-053;C-077;C-082;C-086;C-087;C-096;C-097"},
    "G33": {"claim_refs": "C-018;C-019;C-097"},
}

rows = list(csv.reader(GAPS.open(newline="", encoding="utf-8")))
header, body = rows[0], rows[1:]
idx = {r[0]: i for i, r in enumerate(body)}
for gid, upd in FIX.items():
    row = body[idx[gid]]
    for k, v in upd.items():
        row[header.index(k)] = v
with GAPS.open("w", newline="", encoding="utf-8") as f:
    csv.writer(f).writerows([header] + body)
print("gap refs/impact fixed")
