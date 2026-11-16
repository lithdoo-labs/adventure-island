"""T091: restore the T088/T088.1-pinned tokens in G10 unresolved_scope
([[arg3]+0x14], the slot15 BASE-table clause) while keeping the t091 refresh,
then the caller regenerates clean-room + migrates count pins (T090 precedent).
"""
import csv
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "source-of-truth/gaps.csv"
with open(p, encoding="utf-8", newline="") as f:
    rdr = csv.reader(f)
    fields = next(rdr)
    rows = list(csv.DictReader(f, fieldnames=fields))
for r in rows:
    if r["gap_id"] == "G10":
        us = r["unresolved_scope"]
        if "[[arg3]+0x14]" not in us:
            us = ("[[arg3]+0x14] ongoing Set driver (t091 C-120 closed the identity/writer chain: "
                  "vtable slot+0x90->+0x40 = 0x9C1113, zero direct E8 callers, dispatch site not byte-located); "
                  "[P+0x238] arm dispatch (gate of 0x5C0349); " + us)
        if "BASE table 0xB01278" not in us:
            us += ("; slot15-family scene +0x1CC installer retained in full: the BASE table 0xB01278 imm32 install chain "
                   "= 0x52F1BC/0x52F1CF/0xA0B39E/0xA0BB2A + shared init 0x52F37F + register-mediated 0x52EEF1/0x8DC052; "
                   "the 32 DERIVED tables have zero imm32 occurrence in the code band")
        r["unresolved_scope"] = us
with open(p, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(rows)
print("G10 tokens restored")
