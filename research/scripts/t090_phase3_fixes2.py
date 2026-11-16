"""T090 Phase-3 fixes round 2 (D2/D3/D4) — the first attempt crashed at D1
before reaching these. Write discipline: all writes INSIDE the with-block."""
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SOT = REPO / "research/source-of-truth"
FORENSICS = REPO / "research/result/stage-readiness/forensics"

# ---- D2: timeline missing-resource attribution
tl_p = FORENSICS / "T090-G39-ANIMATION-TIMELINE.md"
t = tl_p.read_text(encoding="utf-8")
if "referenced by 222000000" in t:
    t = t.replace(
        "referenced by 222000000 but absent from this WZ build —\nrecorded, not fabricated)",
        "referenced by **222000001** but absent from this WZ build — recorded, not\n"
        "fabricated [t090 phase-3 D2: attribution corrected from the census CSV; the\n"
        "original prose said 222000000])",
        1,
    )
    tl_p.write_text(t, encoding="utf-8", newline="")
    print("D2: timeline fixed")
else:
    print("D2: pattern absent (check manually)")

# ---- D3: wrapper size wording (claim + doc)
cl_p = SOT / "claims.csv"
crows = list(csv.DictReader(open(cl_p, encoding="utf-8")))
c116 = next(r for r in crows if r["claim_id"] == "C-116")
if "0x60-byte ANIMATION-STATE object" in c116["claim"]:
    c116["claim"] = c116["claim"].replace(
        "builds a 0x60-byte ANIMATION-STATE object:",
        "builds an ANIMATION-STATE object (proven fields through at least +0x88, i.e. "
        ">=0x90 bytes — [t090 phase-3 D3: the earlier '0x60-byte' size understated "
        "the extent]):",
        1,
    )

# ---- D4: C-119 coverage note
c119 = next(r for r in crows if r["claim_id"] == "C-119")
if "COVERAGE: 0x9573A6 has 14" not in c119["claim"]:
    c119["claim"] = c119["claim"].rstrip() + (
        "; COVERAGE: 0x9573A6 has 14 E8 callers of which 3 are decoded "
        "(0x5C031A/0x95282D/0x955126) — the arg3 object-capability of 0x959493 is "
        "proven for the decoded trio only [t090 phase-3 D4]")

with open(cl_p, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(crows[0].keys()), lineterminator="\n")
    w.writeheader()
    w.writerows(crows)
print("D3/D4: claims updated")

fc_p = FORENSICS / "T090-G10-FILTER-CONSUMERS.md"
t = fc_p.read_text(encoding="utf-8")
t2 = t.replace("builds a 0x60-byte\n  ANIMATION-STATE object:",
               "builds an ANIMATION-STATE object\n  (fields through at least +0x88 — >=0x90 bytes):", 1)
t2 = t2.replace("a 0x60-byte", "an (>=0x90-byte)")
if t2 != t:
    fc_p.write_text(t2, encoding="utf-8", newline="")
    print("D3: filter-consumers doc fixed")
else:
    print("D3: doc pattern absent (may already be fixed)")
