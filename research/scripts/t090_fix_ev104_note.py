"""T090: annotate EV-104's interpretation with the client-folder-name note
(host dir carries GBK mojibake; scripts resolve programmatically)."""
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EV = REPO / "research/source-of-truth/evidence.csv"

rows = list(csv.DictReader(open(EV, encoding="utf-8")))
ev = next(r for r in rows if r["evidence_id"] == "EV-104")
note = ("[host-path note: source_file uses the repo-conventional folder name; the "
        "on-disk extracted folder carries GBK-mojibake bytes — all t090 scripts "
        "resolve the directory programmatically (first directory under "
        ".work/task-001/extracted/), so reproduction is name-agnostic]")
if note not in ev["interpretation"]:
    ev["interpretation"] = ev["interpretation"] + " " + note
    with open(EV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    print("EV-104 annotated")
else:
    print("already annotated")
