"""T090 pre-push cleanup: strip trailing whitespace from the new disasm .txt
forensics (capstone pads 'leave '/'ret '), refresh the EV-106 companion sha,
regenerate the gates log + cleanroom, then amend the local commit."""
import hashlib
import re
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
FORENSICS = REPO / "research/result/stage-readiness/forensics"

# 1. strip trailing whitespace on the new T090 txt forensics
changed = []
for p in sorted(FORENSICS.glob("T090-*.txt")):
    raw = p.read_bytes()
    lines = raw.split(b"\n")
    stripped = [ln.rstrip(b" \t\r") for ln in lines]
    out = b"\n".join(stripped)
    # drop trailing blank lines at EOF
    out = out.rstrip(b"\n") + b"\n"
    if out != raw:
        p.write_bytes(out)
        changed.append(p.name)
print("stripped:", len(changed), "files")

# 2. refresh EV-106 companion sha (slot9c) + filter-consumers sha
def cano(p):
    return hashlib.sha256(Path(p).read_bytes().replace(b"\r\n", b"\n")).hexdigest()

s9c = cano(FORENSICS / "T090-G36-SLOT9C-DISASM.txt")
fcm = cano(FORENSICS / "T090-G10-FILTER-CONSUMERS.md")
ev_p = REPO / "research/source-of-truth/evidence.csv"
rows = list(csv.DictReader(open(ev_p, encoding="utf-8")))
ev106 = next(r for r in rows if r["evidence_id"] == "EV-106")
ev106["interpretation"] = re.sub(
    r"filter-consumers [0-9a-f]{16}",
    f"filter-consumers {fcm[:16]}", ev106["interpretation"])
ev106["interpretation"] = re.sub(
    r"slot9c [0-9a-f]{16}",
    f"slot9c {s9c[:16]}", ev106["interpretation"])
with open(ev_p, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
print("EV-106 shas refreshed:", s9c[:16], fcm[:16])
