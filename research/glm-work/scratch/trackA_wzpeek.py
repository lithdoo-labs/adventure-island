"""Direct structural look at List.wz and the PKG1 archives (first 0x60 bytes,
plus quick stats). Read-only."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CLIENT = ROOT / ".work" / "task-001" / "extracted"


def hexdump(data: bytes, base: int = 0, limit: int = 0x60) -> None:
    for off in range(0, min(len(data), limit), 16):
        chunk = data[off : off + 16]
        hx = " ".join(f"{b:02x}" for b in chunk)
        asc = "".join(chr(b) if 32 <= b < 127 else "." for b in chunk)
        print(f"  {base + off:08x}  {hx:<48} {asc}")


wzdir = None
for p in CLIENT.rglob("List.wz"):
    wzdir = p.parent
    break
print("wz dir:", wzdir)

for name in ("List.wz", "Base.wz", "TamingMob.wz"):
    data = (wzdir / name).read_bytes()[: 0x60 + 0x40]
    print(f"\n== {name} ({(wzdir / name).stat().st_size} bytes) ==")
    hexdump(data[:0x60])
    # extra offset dump for List.wz (small enough to peek further)
    if name == "List.wz":
        print("  -- offset 0x1000 --")
        hexdump((wzdir / name).read_bytes()[0x1000:0x1040], 0x1000)
        print("  -- offset 0x8000 --")
        hexdump((wzdir / name).read_bytes()[0x8000:0x8040], 0x8000)
