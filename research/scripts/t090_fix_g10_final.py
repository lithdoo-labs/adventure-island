"""T090: final G10 unresolved_scope patch — add the historical F28 framing
token and mark the 'filtered feeds slot15' clause RESOLVED by C-116."""
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GP = REPO / "research/source-of-truth/gaps.csv"

rows = list(csv.DictReader(open(GP, encoding="utf-8")))
g10 = next(r for r in rows if r["gap_id"] == "G10")
u = g10["unresolved_scope"]

old1 = "the geometric point identity)"
if old1 in u:
    u = u.replace(old1, "the geometric point identity; the historical t088 framing "
                        "[[user+0xF28]+0x14] retained as superseded history)", 1)
old2 = "whether/where the filtered coordinate feeds the slot15 consume side"
if old2 in u:
    u = u.replace(old2, "t090 RESOLVED by C-116: the filtered coordinate DOES feed the "
                        "getter/slot15 consume side whenever the animation wrapper is "
                        "armed — the residual is wrapper persistence and pump phase "
                        "(E2/E3), not the consumer linkage", 1)
g10["unresolved_scope"] = u
with open(GP, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
for tok in ("[[user+0xF28]", "[[arg3]+0x14]", "BASE table 0xB01278", "0x952ECE",
            "RESOLVED by C-116"):
    print(tok, "->", tok in u)
