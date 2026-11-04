from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / ".work" / "tools" / "wz-python"))

from wzpy.crypto import WzKey  # noqa: E402

wzdir = next((ROOT / ".work" / "task-001" / "extracted").rglob("List.wz")).parent
buf = (wzdir / "List.wz").read_bytes()
key = WzKey.for_region("EMS")
key.ensure(0x400)
ks = key.slice(0x400)

positions = []
p = buf.find(b"\xac\x52")
while p >= 0:
    positions.append(p)
    p = buf.find(b"\xac\x52", p + 1)
print("all ac52 positions:", len(positions))

lens = Counter()
bad = 0
for pos in positions:
    if pos + 6 > len(buf):
        continue
    n = int.from_bytes(buf[pos + 2 : pos + 6], "little")
    lens[n] += 1
print("length-dword distribution (top 15):", lens.most_common(15))

# decode each with continuous ks, allow any printable + CJK, stop at first NUL
def dec(pos, n):
    out = []
    for i in range(n):
        if pos + 6 + 2 * i + 1 >= len(buf):
            return None
        lo = buf[pos + 6 + 2 * i] ^ ks[2 * i]
        hi = buf[pos + 6 + 2 * i + 1] ^ ks[2 * i + 1]
        u = lo | (hi << 8)
        if u == 0:
            break
        out.append(u)
    return out


def classify(units):
    if units is None:
        return "range"
    if all(32 <= u < 127 for u in units):
        return "ascii"
    if all(u == 0 or 32 <= u < 127 or 0x4E00 <= u <= 0x9FFF for u in units):
        return "ascii+cjk"
    return "garbage"

kinds = Counter()
samples = {}
for pos in positions:
    n = int.from_bytes(buf[pos + 2 : pos + 6], "little")
    if not (1 <= n <= 128):
        kinds["badlen"] += 1
        continue
    units = dec(pos, n)
    k = classify(units)
    kinds[k] += 1
    if k not in samples and units:
        samples[k] = (hex(pos), n, "".join(chr(u) for u in units))
print("classify:", dict(kinds))
for k, v in samples.items():
    print(f"  sample[{k}]: {v}")
