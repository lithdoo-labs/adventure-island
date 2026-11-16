"""T090 Phase-3 fixes for the reviewer's D1-D5 findings (all ACCEPTED-CORRECTION).

D1: EV-104 interpretation still says '35 distinct' -> 44 (evidence.csv missed
    by the earlier prose sweep).
D2: timeline doc misattributes the missing resource to 222000000 -> 222000001.
D3: C-116 '0x60-byte' wrapper size contradicts the proven +0x88 field extent.
D4: C-119 coverage note — 0x9573A6 has 14 callers, 3 decoded.
D5: EV-106's companion sha for the slot9c disasm is stale (file grew after the
    row was written) -> recompute.
"""
import csv
import hashlib
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SOT = REPO / "research/source-of-truth"
FORENSICS = REPO / "research/result/stage-readiness/forensics"


def cano(p):
    return hashlib.sha256(Path(p).read_bytes().replace(b"\r\n", b"\n")).hexdigest()


# ---- D1: EV-104 35 -> 44
ev_p = SOT / "evidence.csv"
rows = list(csv.DictReader(open(ev_p, encoding="utf-8")))
ev104 = next(r for r in rows if r["evidence_id"] == "EV-104")
if "35 distinct values" in ev104["interpretation"]:
    ev104["interpretation"] = ev104["interpretation"].replace(
        "35 distinct values", "44 distinct values [t090 phase-3 D1: count "
        "recomputed from the committed census — the original prose said 35]", 1)
    with open(ev_p, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
        w.writeheader()
    w.writerows(rows)
    print("D1: EV-104 fixed")
else:
    print("D1: no stale text found (already fixed?)")

# ---- D2: missing-resource map attribution
tl = FORENSICS / "T090-G39-ANIMATION-TIMELINE.md"
t = tl.read_text(encoding="utf-8")
old = "(`Back/…/back/…` referenced by 222000000 but absent from this WZ build —\nrecorded, not fabricated)"
new = ("(`Back/…/back/…` referenced by **222000001** but absent from this WZ build —\n"
       "recorded, not fabricated [t090 phase-3 D2: attribution corrected from the "
       "census CSV; the original prose said 222000000])")
if old in t:
    t = t.replace(old, new, 1)
    tl.write_text(t, encoding="utf-8", newline="")
    print("D2: timeline fixed")
else:
    print("D2: pattern not found — checking alt")
    if "222000000" in t:
        t = t.replace("referenced by 222000000", "referenced by 222000001", 1)
        tl.write_text(t, encoding="utf-8", newline="")
        print("D2: timeline fixed (alt)")
    else:
        print("D2: already fixed")

# ---- D3: wrapper size wording in C-116
cl_p = SOT / "claims.csv"
crows = list(csv.DictReader(open(cl_p, encoding="utf-8")))
c116 = next(r for r in crows if r["claim_id"] == "C-116")
if "0x60-byte ANIMATION-STATE object" in c116["claim"]:
    c116["claim"] = c116["claim"].replace(
        "builds a 0x60-byte ANIMATION-STATE object:",
        "builds an ANIMATION-STATE object (proven fields through at least +0x88, "
        "i.e. ≥0x90 bytes — [t090 phase-3 D3: the earlier '0x60-byte' size "
        "understated the extent]):", 1)
    with open(cl_p, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(crows[0].keys()), lineterminator="\n")
        w.writeheader()
    w.writerows(crows)
    print("D3: C-116 fixed")
else:
    print("D3: pattern not found")

fc = FORENSICS / "T090-G10-FILTER-CONSUMERS.md"
t = fc.read_text(encoding="utf-8")
if "0x60-byte" in t:
    t = t.replace(
        "builds a 0x60-byte\n  ANIMATION-STATE object:",
        "builds an ANIMATION-STATE object\n  (fields through at least +0x88 — ≥0x90 bytes):", 1)
    if "0x60-byte" in t:
        t = t.replace("a 0x60-byte", "an (≥0x90-byte)")
    fc.write_text(t, encoding="utf-8", newline="")
    print("D3: filter-consumers doc fixed")

# ---- D4: C-119 coverage note
c119 = next(r for r in crows if r["claim_id"] == "C-119")
note = ("; COVERAGE: 0x9573A6 has 14 E8 callers of which 3 are decoded "
        "(0x5C031A/0x95282D/0x955126) — the arg3 object-capability of "
        "0x959493 is proven for the decoded trio only [t090 phase-3 D4]")
if "COVERAGE: 0x9573A6 has 14" not in c119["claim"]:
    c119["claim"] = c119["claim"].rstrip() + note
    with open(cl_p, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(crows[0].keys()), lineterminator="\n")
        w.writeheader()
    w.writerows(crows)
    print("D4: C-119 coverage note added")

# ---- D5: EV-106 companion sha refresh (slot9c disasm grew after row written)
s9c = FORENSICS / "T090-G36-SLOT9C-DISASM.txt"
new_sha = cano(s9c)
ev_p2 = SOT / "evidence.csv"
rows2 = list(csv.DictReader(open(ev_p2, encoding="utf-8")))
ev106 = next(r for r in rows2 if r["evidence_id"] == "EV-106")
import re
m = re.search(r"slot9c ([0-9a-f]{16})…", ev106["interpretation"])
if m and m.group(1) != new_sha[:16]:
    ev106["interpretation"] = ev106["interpretation"].replace(
        m.group(0), f"slot9c {new_sha[:16]}… [refreshed phase-3 D5]", 1)
elif "refreshed phase-3 D5" not in ev106["interpretation"]:
    ev106["interpretation"] += f" [companion slot9c sha refreshed phase-3 D5: {new_sha[:16]}…]"
with open(ev_p2, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows2[0].keys()), lineterminator="\n")
    w.writeheader()
    w.writerows(rows2)
print("D5: EV-106 companion sha refreshed ->", new_sha[:16])
