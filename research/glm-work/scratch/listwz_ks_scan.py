"""Keystream-phase scan: XOR List.wz bytes with the WZ AES keystream
(EMS IV via wzpy) at phase offsets 0..0x2000 and score printability of the
variable record payloads + look for known PKG1-magic structure.
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
key.ensure(0x8000)
ks = key.slice(0x8000)

# score a window of the variable payload area (say bytes 0x40..0x400)
window = buf[0x40:0x400]


def score(data: bytes) -> int:
    return sum(1 for b in data if 32 <= b < 127 or b == 0)


base = score(window)
best = []
for phase in range(0, 0x2000):
    dec = bytes(window[i] ^ ks[(i + phase) % len(ks)] for i in range(len(window)))
    s = score(dec)
    best.append((s, phase))
best.sort(reverse=True)
print(f"baseline printable score: {base}/{len(window)}")
print("top phases:")
for s, phase in best[:8]:
    dec = bytes(window[i] ^ ks[(i + phase) % len(ks)] for i in range(len(window)))
    print(f"  phase {phase:#06x}: {s}/{len(window)}  sample={dec[:32]!r}")

# also: does any phase turn the 16-byte constant into something structured?
const = bytes.fromhex("c865210506cd250af97be40a9865628b")
seen = set()
for phase in range(0, 0x8000):
    dec = bytes(const[i] ^ ks[(i + phase) & 0x7FFF] for i in range(16))
    if all(32 <= b < 127 or b == 0 for b in dec):
        if dec not in seen:
            seen.add(dec)
            print(f"const -> printable at phase {phase:#06x}: {dec!r}")
