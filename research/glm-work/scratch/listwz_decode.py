"""Full phase-0 keystream decode of List.wz."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / ".work" / "tools" / "wz-python"))

from wzpy.crypto import WzKey  # noqa: E402

wzdir = next((ROOT / ".work" / "task-001" / "extracted").rglob("List.wz")).parent
buf = (wzdir / "List.wz").read_bytes()

key = WzKey.for_region("EMS")
key.ensure(len(buf))
ks = key.slice(len(buf))
dec = bytes(b ^ ks[i] for i, b in enumerate(buf))


def wstr_at(data: bytes, off: int, maxlen: int = 64) -> str:
    out = []
    i = off
    while i + 1 < len(data) and len(out) < maxlen:
        u = int.from_bytes(data[i : i + 2], "little")
        if u == 0:
            break
        out.append(chr(u) if 32 <= u < 127 else f"\\u{u:04x}")
        i += 2
    return "".join(out)


print("== first 0x60 bytes decoded ==")
for off in range(0, 0x60, 16):
    chunk = dec[off : off + 16]
    hx = " ".join(f"{b:02x}" for b in chunk)
    asc = "".join(chr(b) if 32 <= b < 127 else "." for b in chunk)
    print(f"  {off:04x}  {hx:<48} {asc}")

print("\n== wide strings found in decoded file (first 40) ==")
count = 0
i = 0
while i < len(dec) - 4 and count < 40:
    # heuristic: aligned UTF-16LE ascii run >= 3 chars
    if 32 <= dec[i] < 127 and dec[i + 1] == 0:
        j = i
        chars = 0
        while j + 1 < len(dec) and 32 <= dec[j] < 127 and dec[j + 1] == 0:
            chars += 1
            j += 2
        if chars >= 3:
            print(f"  {i:#06x}: {dec[i:j].decode('utf-16-le')!r}")
            count += 1
            i = j
            continue
    i += 2

# record framing re-check on decoded data
pat = "characte".encode("utf-16-le")
positions = []
p = dec.find(pat)
while p >= 0:
    positions.append(p)
    p = dec.find(pat, p + 1)
print(f"\n'characte' (wide) occurrences: {len(positions)} first={[hex(x) for x in positions[:6]]}")
