#!/usr/bin/env python3
"""T089 WP1g - G35 13-map FSDB background census + signed key test vectors.

Reads every content/[FSDB]adventure/[group]map.Back/map.*.jsonl record and
computes, per map: record count (index upper bound), front=1 count, and the
CMS079 depth keys for representative indices using the byte-proven formulas:
    back  (front==0): key = -0x40000000 - 128000 + index*1000
    front (front!=0): key = -0x40000000 + 272000 - 800 + index*1000
                       (0x3FFBDCA0 = B + 271200 exactly; the -800 delta vs
                        the GMS083 OpenMS candidate B+272000 is highlighted)
Then prints signed-integer test vectors incl. negative and boundary indices.
"""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BACK_DIR = REPO / "content/[FSDB]adventure/[group]map.Back"
OUT = REPO / "research/result/stage-readiness/forensics/T089-G35-FSDB-CENSUS.txt"

B = -(0x40000000)
BACK_CONST = B - 128000          # = -1073869824 = -(0x4001F400)
FRONT_CONST = B + 271200         # = -1073470624 = -(0x3FFBDCA0)
GMS_FRONT = B + 272000           # OpenMS GMS083 candidate (for contrast only)

assert BACK_CONST == -(0x4001F400)
assert FRONT_CONST == -(0x3FFBDCA0)

lines = ["# T089 G35 FSDB 13-map background census + key test vectors", ""]
total = fronts = 0
per_map = []
for f in sorted(BACK_DIR.glob("map.*.jsonl")):
    recs = [json.loads(ln) for ln in f.read_text(encoding="utf-8").splitlines() if ln.strip()]
    fr = sum(1 for r in recs if r.get("front"))
    total += len(recs)
    fronts += fr
    per_map.append((f.stem, len(recs), fr))

lines.append("## per-map Back record census (records = index domain 0..n-1)")
for name, n, fr in per_map:
    lines.append(f"  {name}: {n} records, front=1 x{fr}")
lines.append(f"  TOTAL: {total} records, front=1 x{fronts}")
lines.append("")

lines.append("## signed 32-bit key test vectors (CMS079 byte-proven formulas)")
cases = [
    ("back  index 0", 0, False),
    ("back  index 1", 1, False),
    ("back  index 17", 17, False),
    ("front index 0", 0, True),
    ("front index 1", 1, True),
    ("front index 17", 17, True),
    ("back  negative index -1 (unsigned-enum-impossible; signed-arithmetic check)", -1, False),
    ("front negative index -1 (signed-arithmetic check)", -1, True),
]
for label, idx, front in cases:
    key = (FRONT_CONST if front else BACK_CONST) + idx * 1000
    u = key & 0xFFFFFFFF
    lines.append(f"  {label:62s} key = {key:+d} (0x{u:08X})")
lines.append("")
lines.append("## cross-version contrast (OpenMS GMS083 candidate, NOT CMS079):")
lines.append(f"  GMS083 front const = B + 272000 = {GMS_FRONT}")
lines.append(f"  CMS079 front const = B + 271200 = {FRONT_CONST}  (delta = 800)")
lines.append(f"  back constants IDENTICAL: B - 128000 = {BACK_CONST}")
lines.append("")
lines.append("## ordering check: back(index N) < tile(B+19990) < obj(B+2000) < front(index 0)?")
lines.append(f"  back0  = {BACK_CONST}")
lines.append(f"  tile base = {B + 19990}  obj base = {B + 2000}")
lines.append(f"  front0 = {FRONT_CONST}")
lines.append("  => back layers sort strictly below every tile/obj; front layers strictly above"
             " (index*1000 spacing never crosses the gap in either direction for 0<=index<128)")

OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
print(f"wrote {OUT}")
print("\n".join(lines[:40]))
