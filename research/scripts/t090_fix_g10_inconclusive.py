"""T090: keep the historical 'INCONCLUSIVE' token in G10 unresolved (the t088
census term now parenthesized as reclassified history)."""
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GP = REPO / "research/source-of-truth/gaps.csv"

rows = list(csv.DictReader(open(GP, encoding="utf-8")))
g10 = next(r for r in rows if r["gap_id"] == "G10")
u = g10["unresolved_scope"]
old = "receiver linkage for the 18 POSSIBLE sites (pointer-deref receivers, exact object untraced)"
new = ("receiver linkage for the 18 SHARED-WRITE-CONTEXT-POSSIBLE sites (the t088 "
       "INCONCLUSIVE census set, reclassified t090; pointer-deref receivers, exact "
       "object untraced)")
if old in u:
    g10["unresolved_scope"] = u.replace(old, new, 1)
    with open(GP, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    print("token retained")
else:
    print("pattern miss or already applied")
