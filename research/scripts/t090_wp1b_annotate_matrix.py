"""T090 WP1-B part 3: annotate the default-consumer matrix with the resolved
register seeds (portal site proven ebx=0 by anchored decode) and family labels."""
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CSV = REPO / "research/result/stage-readiness/forensics/T090-G39-DEFAULT-CONSUMER-MATRIX.csv"

# register-seed resolutions proven this round (anchored capstone decode):
# - 0x71A72A: containing fn 0x71A203 (SEH head verified), xor ebx,ebx at
#   0x71A21C with NO ebx rewrite before the site -> default = 0. The function
#   is the portal-graphics family reader (ids tm/tn/pv/Map/MapHelper.img/game/
#   hideTooltip/onlyOnce/delay -> record fields; delay lands at rec+0x2C).
ANNOTATION = {
    "0x71A72A": {
        "function_head": "0x71A203",
        "resolved_default": "0 (xor ebx,ebx @0x71A21C; no rewrite before site)",
        "family": "portal-graphics reader (tm/tn/pv/MapHelper.img/game/hideTooltip/onlyOnce/delay -> rec+0x2C)",
    },
}
VARIABLE_NOTE = (
    "register-carried variable default (not pinned to a constant this round; "
    "requires per-site dataflow decode)"
)

rows = list(csv.DictReader(open(CSV, encoding="utf-8")))
fieldnames = list(rows[0].keys()) + ["resolved_default", "family"]
for r in rows:
    r.setdefault("resolved_default", "")
    r.setdefault("family", "")
    if r["site"] in ANNOTATION:
        r.update(ANNOTATION[r["site"]])
    elif r["seed_method"].startswith("reg-seed"):
        r["resolved_default"] = VARIABLE_NOTE

with open(CSV, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
print("annotated", len(rows), "rows")
