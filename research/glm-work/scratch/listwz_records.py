"""Per-record decoder for List.wz: framing `ac 52 | 16 00 00 00` + fields,
each string field encrypted with the WZ AES keystream rotating mask
plain[i] = enc[i] ^ ks[i & 0xF] (per-string reset).
"""
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
mask = key.slice(0x100)[:0x100]


def dec_from(off: int, n: int) -> bytes:
    return bytes(buf[off + i] ^ mask[i & 0xF] for i in range(n))


# find framing: ac 52 16 00 00 00
framing = bytes.fromhex("ac5216000000")
positions = []
p = buf.find(framing)
while p >= 0:
    positions.append(p)
    p = buf.find(framing, p + 1)
print(f"framing occurrences: {len(positions)}")

for pos in positions[:12]:
    name_off = pos + 6
    raw = buf[name_off : name_off + 48]
    dec = dec_from(name_off, 48)
    # wide string from decoded
    s = []
    for i in range(0, 48, 2):
        u = int.from_bytes(dec[i : i + 2], "little")
        if u == 0:
            break
        s.append(chr(u) if 32 <= u < 127 else f"<{u:04x}>")
    print(f"  frame@{pos:#x}: name={''.join(s)!r} raw16={raw[:16].hex()}")
