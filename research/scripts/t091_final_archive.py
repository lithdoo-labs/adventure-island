"""T091 archive step: fold in reviewer Phase-4 observations O1/O2/O3, append the
Phase-4 report to the archived reviewer file."""
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

# ---- O1: EV-108 stale call shape ----
p = REPO / "research/source-of-truth/evidence.csv"
with open(p, encoding="utf-8", newline="") as f:
    rdr = csv.reader(f)
    fields = next(rdr)
    rows = list(csv.DictReader(f, fieldnames=fields))
for r in rows:
    if r["evidence_id"] == "EV-108":
        if "0,0,P)" in r["instruction_or_data"]:
            r["instruction_or_data"] = r["instruction_or_data"].replace(
                "[edx+4]=0x9BC622(P,1,X+-1,Y-0x14,0,0,P)",
                "[edx+4]=0x9BC622(P,1,X+-1,Y-0x14,0,0,flags=3,owner=0xA4F6F1-result)",
            )
            print("O1: EV-108 call shape fixed")
with open(p, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(rows)

# ---- O2: arg-index labels ----
p = REPO / "research/result/stage-readiness/forensics/T091-FOCUS-OBJECT-PROVENANCE.md"
t = p.read_text(encoding="utf-8")
t = t.replace(
    "NOT P; arg7 is a flags value (3) tested with\n  0xFFFFFFFE at 0x9BC737",
    "NOT P; the 6th stack arg is a flags value (3) tested with\n  0xFFFFFFFE at 0x9BC737 and the 7th is the owner",
)
p.write_text(t, encoding="utf-8")
print("O2a: provenance MD labels fixed")

p = REPO / "research/result/stage-readiness/forensics/T091-ARG3-MEMBER14-WRITERS.csv"
t = p.read_text(encoding="utf-8")
t = t.replace(
    '"arg6 = the 0xA4F6F1([0xBDD498],X,Y,0,0x7FFFFFFF,1) map-space query result ',
    '"7th stack arg (owner) = the 0xA4F6F1([0xBDD498],X,Y,0,0x7FFFFFFF,1) map-space query result ',
)
p.write_text(t, encoding="utf-8")
print("O2b: writers CSV label fixed")

# ---- O3: test comment ----
p = REPO / "research/tests/test_t091_round.py"
t = p.read_text(encoding="utf-8")
t = t.replace(
    "ret-4 thunk of the direct focus method",
    "ret-4 stub at W vtable slot+8 (the direct focus method is a plain member)",
)
p.write_text(t, encoding="utf-8")
print("O3: test comment fixed")
