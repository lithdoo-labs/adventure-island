"""List.wz decode v2: per-string CONTINUOUS keystream plain[i] = enc[i] ^ ks[i]
(ks = WZ AES keystream, EMS IV, starting at index 0 per string field).
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
key.ensure(0x200)
ks = key.slice(0x200)


def dec_str(off: int, maxchars: int = 40) -> str:
    out = []
    for i in range(maxchars):
        lo = buf[off + 2 * i] ^ ks[2 * i]
        hi = buf[off + 2 * i + 1] ^ ks[2 * i + 1]
        u = lo | (hi << 8)
        if u == 0:
            break
        out.append(chr(u) if 32 <= u < 127 else f"<{u:04x}>")
    return "".join(out)


framing = bytes.fromhex("ac5216000000")
positions = []
p = buf.find(framing)
while p >= 0:
    positions.append(p)
    p = buf.find(framing, p + 1)

for pos in positions[:20]:
    name = dec_str(pos + 6)
    print(f"frame@{pos:#x}: {name!r}")
