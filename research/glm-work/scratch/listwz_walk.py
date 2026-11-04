"""List.wz greedy record walker: [optional 0-2 byte type prefix][dword name
length][UTF-16LE name encrypted with continuous WZ keystream from index 0].
Accept a candidate only if every decoded char is a path-safe char.
"""
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

SAFE = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/._- ")


def try_record(p: int) -> tuple[int, str, int] | None:
    """Return (prefix_len, name, total_consumed) if a record starts at p."""
    for prefix in (0, 1, 2):
        q = p + prefix
        if q + 4 > len(buf):
            continue
        n = int.from_bytes(buf[q : q + 4], "little")
        if not (1 <= n <= 128) or q + 4 + 2 * n > len(buf):
            continue
        chars = []
        for i in range(n):
            lo = buf[q + 4 + 2 * i] ^ ks[2 * i]
            hi = buf[q + 4 + 2 * i + 1] ^ ks[2 * i + 1]
            u = lo | (hi << 8)
            if chr(u) not in SAFE:
                chars = None
                break
            chars.append(chr(u))
        if chars:
            return prefix, "".join(chars), prefix + 4 + 2 * n
    return None


records: list[tuple[int, int, str]] = []  # (offset, prefix, name)
p = 0
gaps: list[tuple[int, int]] = []
last_end = 0
while p < len(buf) - 8:
    rec = try_record(p)
    if rec:
        prefix, name, consumed = rec
        if last_end and p > last_end:
            gaps.append((last_end, p))
        records.append((p, prefix, name))
        last_end = p + consumed
        p = last_end
    else:
        p += 1

print(f"records decoded: {len(records)}; bytes covered to {hex(last_end)} of {hex(len(buf))}")
tops = Counter(r[2].split("/")[0] for r in records if "/" in r[2])
print("top-level distribution:", dict(tops.most_common()))
print("prefix distribution:", Counter(r[1] for r in records))
print("gap count:", len(gaps), "first gaps:", [(hex(a), hex(b), b - a) for a, b in gaps[:6]])
for off, pre, name in records[:8]:
    print(f"  {off:#07x} p{pre}: {name}")
print("  ...")
for off, pre, name in records[-6:]:
    print(f"  {off:#07x} p{pre}: {name}")
