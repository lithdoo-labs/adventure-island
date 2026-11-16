"""T090: fill the T090 gap-closure audit reviewer_opinion cells with the
phase-2 verdicts (all targeted gaps verified independently; corrections D1-D5
landed, none blocking)."""
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
AUD = REPO / "research/result/stage-readiness/T090-GAP-CLOSURE-AUDIT.csv"

VERDICTS = {
    "G10": ("phase2-verified (independent end-to-end re-derivation of the C-116 "
            "chain incl. A4 census and engine deltas; C-119 8+2 confirmed; "
            "ACCEPT-WITH-CORRECTIONS — corrections D1-D5 landed, none blocking)"),
    "G36": ("phase2-verified (ret 0x34 / clamps / rect math 0x514087CF-0x514087E3 / "
            "commit 0x5140833B / 8 sites all reproduced; 387-record layout "
            "independently recounted)"),
    "G37": ("phase2-verified (obj-layer census reproduced on an independent WZ walk)"),
    "G39": ("phase2-verified (census totals 4347/2450/44-distinct/329=99+225+5 "
            "reproduced exactly by an independent WZ walk; scale-default and "
            "36-site matrix spot-checks PASS)"),
    "G35": "phase2-verified (closure untouched, no reopening)",
    "G40": "phase2-verified (untargeted; statuses reconciled)",
    "G20": "phase2-verified (untargeted)",
    "G16": "phase2-verified (untargeted)",
}

rows = list(csv.reader(open(AUD, encoding="utf-8")))
hdr = rows[0]
i_op = hdr.index("reviewer_opinion")
i_gid = hdr.index("gap_id")
for r in rows[1:]:
    if r[i_gid] in VERDICTS:
        r[i_op] = VERDICTS[r[i_gid]]
with open(AUD, "w", encoding="utf-8", newline="") as f:
    csv.writer(f, lineterminator="\n").writerows(rows)
print("audit opinions filled")
