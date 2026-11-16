"""T091 one-off: fix the G10 next_action annotation (remove the literal quoted
phrase so the WP0-C regression test is meaningful)."""
import csv
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "source-of-truth/gaps.csv"
with open(p, encoding="utf-8", newline="") as f:
    rdr = csv.reader(f)
    fields = next(rdr)
    rows = list(csv.DictReader(f, fieldnames=fields))
for r in rows:
    if r["gap_id"] == "G10":
        na = r["next_action"]
        i = na.find("[t091 WP0-C:")
        if i >= 0:
            na = na[:i] + "[t091 WP0-C: the t090 filtered-consumer task item (closed by C-116) removed from the list]"
        r["next_action"] = na
with open(p, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(rows)
print("gaps.csv G10 annotation fixed")
