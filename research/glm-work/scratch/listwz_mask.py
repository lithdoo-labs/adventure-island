"""Old-WZ rotating 16-byte keystream mask decode: plain[i] = enc[i] ^ ks[i & 0xF]."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / ".work" / "tools" / "wz-python"))

from wzpy.crypto import WzKey  # noqa: E402

wzdir = next((ROOT / ".work" / "task-001" / "extracted").rglob("List.wz")).parent
buf = (wzdir / "List.wz").read_bytes()

key = WzKey.for_region("EMS")
key.ensure(0x100)
ks = key.slice(0x100)
mask = ks[:16]

dec = bytes(b ^ mask[i & 0xF] for i, b in enumerate(buf))

print("== first 0x60 bytes, mask-rotated decode ==")
for off in range(0, 0x60, 16):
    chunk = dec[off : off + 16]
    hx = " ".join(f"{b:02x}" for b in chunk)
    asc = "".join(chr(b) if 32 <= b < 127 else "." for b in chunk)
    print(f"  {off:04x}  {hx:<48} {asc}")

count = 0
i = 0
lines = []
while i < len(dec) - 4 and count < 60:
    if 32 <= dec[i] < 127 and dec[i + 1] == 0:
        j = i
        chars = 0
        while j + 1 < len(dec) and 32 <= dec[j] < 127 and dec[j + 1] == 0:
            chars += 1
            j += 2
        if chars >= 3:
            lines.append(f"  {i:#06x}: {dec[i:j].decode('utf-16-le')!r}")
            count += 1
            i = j
            continue
    i += 2
print("\n== wide strings (first 60) ==")
print("\n".join(lines))
