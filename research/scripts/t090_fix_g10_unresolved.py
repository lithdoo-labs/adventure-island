"""T090: replace the SHORT slot15 mention in G10 unresolved_scope with the
FULL t088.1 bounded-negative clause (restores BASE-table/0x952ECE/zero-imm32
details the t0881 regression tests pin)."""
import csv
import io
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GP = REPO / "research/source-of-truth/gaps.csv"

orig = subprocess.run(
    ["git", "show", "HEAD:research/source-of-truth/gaps.csv"],
    capture_output=True, cwd=str(REPO)).stdout.decode("utf-8")
rows0 = list(csv.DictReader(io.StringIO(orig)))
unres0 = next(r for r in rows0 if r["gap_id"] == "G10")["unresolved_scope"]
full_clause = unres0[unres0.find("slot15-family"):]

rows = list(csv.DictReader(open(GP, encoding="utf-8")))
g10 = next(r for r in rows if r["gap_id"] == "G10")
short = "slot15-family derived-table install chain (t088.1 bounded negative stands)"
if short in g10["unresolved_scope"]:
    g10["unresolved_scope"] = g10["unresolved_scope"].replace(short, full_clause)
    with open(GP, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    print("full t088.1 clause restored into G10 unresolved_scope")
elif "BASE table 0xB01278" in g10["unresolved_scope"]:
    print("already full")
else:
    raise SystemExit("unexpected G10 unresolved shape")
