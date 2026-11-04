"""Analyze the wide Tail B capture at the probe stop.

1. verify the 0x856000-0x862000 span equals the known probe window
2. string inventory + entropy + prologue density for 0x862000-0x912000
3. region-level diff vs the T2 block (initial Tail B content) across the
   whole Tail B: which regions were rewritten between T2 and the probe
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE / "scripts"))
import maple079_probe_cfg as probe  # noqa: E402

ROOT = HERE.parent
WIDE = ROOT / "glm-work" / "scratch" / "tailb-wide-at-probe.bin"
T2BLOCK = ROOT / ".work" / "task-006" / "tail-b-nonzero.bin"
WINDOW = ROOT / ".work" / "task-009" / "probe-window.bin"

BASE = 0x819000
IMAGE = 0x400000

wide = WIDE.read_bytes()
print("wide len", hex(len(wide)))
assert wide[0x856000 - BASE : 0x862000 - BASE] == WINDOW.read_bytes(), "overlap mismatch"
print("overlap with probe-window: identical")


def strings(buf: bytes, base: int, lo: int, hi: int, minlen: int = 5):
    out = []
    start = None
    for i in range(lo - base, hi - base):
        b = buf[i]
        if 32 <= b < 127:
            if start is None:
                start = i
        else:
            if start is not None and i - start >= minlen:
                out.append((base + start, buf[start:i].decode("ascii")))
            start = None
    return out


def entropy(buf: bytes) -> float:
    if not buf:
        return 0.0
    counts = [0] * 256
    for b in buf:
        counts[b] += 1
    total = len(buf)
    val = 0.0
    for c in counts:
        if c:
            p = c / total
            val -= p * math.log2(p)
    return val


print("\n== per-4KB entropy + prologue density, 0x860000-0x912000 ==")
rows = []
for off in range(0x860000 - BASE, len(wide) - 0x1000, 0x1000):
    block = wide[off : off + 0x1000]
    e = entropy(block)
    pro = block.count(b"\x55\x8b\xec")
    nz = sum(1 for b in block if b)
    rows.append((BASE + off, e, pro, nz))
interesting = [(a, e, p, n) for a, e, p, n in rows if e < 5.0 and n > 0x100]
for a, e, p, n in interesting:
    print(f"  {a:#x}: entropy {e:.2f} prologue {p} nonzero {n:#x}")

print("\n== strings in 0x862000-0x912000 (>=6 chars, low-entropy zones only) ==")
zone_strings = []
for a, e, p, n in interesting:
    zone_strings += strings(wide, BASE, a, a + 0x1000, 6)
for rva, s in zone_strings[:60]:
    print(f"  {rva:#x}: {s!r}")

print("\n== raw check at 0x85FC98 (Wine key) in probe-stop state ==")
off = 0x85FC98 - BASE
print("  ", wide[off : off + 20])

print("\n== region diff vs T2 block (initial Tail B content after T2) ==")
t2 = T2BLOCK.read_bytes()[0x14:]  # strip 0x14-byte header
t2_base = 0x819014
n = min(len(wide), len(t2))
diff = bytearray()
for i in range(n):
    a = BASE + i
    j = a - t2_base
    diff.append(1 if 0 <= j < len(t2) and wide[i] != t2[j] else 0)
# region summary
regions = []
in_reg = False
for i, d in enumerate(diff):
    if d and not in_reg:
        start = i
        in_reg = True
    elif not d and in_reg:
        regions.append((BASE + start, BASE + i))
        in_reg = False
if in_reg:
    regions.append((BASE + start, BASE + len(diff)))
# merge regions separated by < 32 bytes
merged = []
for s, e in regions:
    if merged and s - merged[-1][1] < 32:
        merged[-1] = (merged[-1][0], e)
    else:
        merged.append((s, e))
big = [(s, e) for s, e in merged if e - s >= 256]
print(f"  diff bytes total: {sum(diff)} / {len(diff)}")
print(f"  rewritten regions >=256B (merged, gap<32): {len(big)}")
for s, e in big:
    print(f"   0x{s:X}-0x{e:X}  ({e-s} bytes)")
