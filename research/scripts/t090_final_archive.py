"""T090 final archive pass:
R1a: timeline L35 '35 distinct' -> 44 (the one pattern the prose sweep missed).
R1b: EV-104 timeline-doc companion sha refresh.
Then: append the reviewer's Phase-2 + Phase-3/4 reports to the archived
T090-REVIEWER-INDEPENDENT.md (final-SHA disposition per the T089 precedent)."""
import csv
import hashlib
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
FORENSICS = REPO / "research/result/stage-readiness/forensics"
REVDIR = Path(r"C:\Users\lithd\AppData\Local\Temp\opencode\t090-reviewer")


def cano(p):
    return hashlib.sha256(Path(p).read_bytes().replace(b"\r\n", b"\n")).hexdigest()


# ---- R1a
tl_p = FORENSICS / "T090-G39-ANIMATION-TIMELINE.md"
t = tl_p.read_text(encoding="utf-8")
n_fix = 0
if "35 distinct" in t:
    t = t.replace(
        "**35 distinct** explicit delay values",
        "**44 distinct** explicit delay values [t090 phase-4 R1a]", 1)
    if "35 distinct" in t:  # any remaining variant
        t = re.sub(r"\b35 distinct\b",
                   "44 distinct [t090 phase-4 R1a]", t)
    tl_p.write_text(t, encoding="utf-8", newline="")
    n_fix += 1
    print("R1a fixed")

# ---- R1b
new_tl_sha = cano(tl_p)
ev_p = REPO / "research/source-of-truth/evidence.csv"
rows = list(csv.DictReader(open(ev_p, encoding="utf-8")))
ev104 = next(r for r in rows if r["evidence_id"] == "EV-104")
m = re.search(r"timeline doc sha ([0-9a-f]{16})", ev104["interpretation"])
if m and m.group(1) != new_tl_sha[:16]:
    ev104["interpretation"] = ev104["interpretation"].replace(
        m.group(0), f"timeline doc sha {new_tl_sha[:16]} [refreshed phase-4 R1b]", 1)
    with open(ev_p, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    print("R1b fixed ->", new_tl_sha[:16])
else:
    print("R1b: already current or pattern absent ->", new_tl_sha[:16])

# ---- append reviewer phases 2 + 3/4 to the archive
arch = FORENSICS / "T090-REVIEWER-INDEPENDENT.md"
a = arch.read_text(encoding="utf-8")
parts = [a.rstrip(), ""]
for name, title in [
    ("T090-REVIEWER-PHASE2.md",
     "# T090 — INDEPENDENT REVIEWER PHASE 2 REPORT (Adversarial Review)"),
    ("T090-REVIEWER-PHASE3-4.md",
     "# T090 — INDEPENDENT REVIEWER PHASE 3 + 4 REPORT (Correction Verification, "
     "Post-Push Remote Verification & Final Verdict)"),
]:
    p = REVDIR / name
    if p.exists():
        body = p.read_text(encoding="utf-8").rstrip()
        # strip a duplicate leading title if the file already carries one
        marker = f"# T090 — INDEPENDENT REVIEWER"
        if body.startswith(marker):
            body = body.split("\n", 0)[0]
        parts.append("\n\n---\n\n" + title + "\n\n(archived verbatim from the "
                     "reviewer's private report)\n\n" + body)
        print("appended", name)
    else:
        print("MISSING", p)
arch.write_text("\n".join(parts) + "\n", encoding="utf-8", newline="")
print("archive updated")
