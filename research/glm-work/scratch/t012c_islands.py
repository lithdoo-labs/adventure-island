"""Task 012c follow-up 2: inspect bytes around the encoded-region disp hits
and around the encoded-region entry targets."""
from __future__ import annotations

import sys
from pathlib import Path

from capstone import CS_ARCH_X86, CS_MODE_32, Cs

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))
import maple079_probe_cfg as probe  # noqa: E402

ROOT = HERE.parents[1]
WIDE = ROOT / "glm-work" / "scratch" / "tailb-wide-at-probe.bin"
WBASE = 0x819000

md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = False
wide = WIDE.read_bytes()


def hexdump(rva: int, before: int = 48, after: int = 48) -> None:
    lo = rva - WBASE - before
    data = wide[lo : lo + before + after]
    print(f"--- around 0x{rva:X}")
    for i in range(0, len(data), 16):
        chunk = data[i : i + 16]
        addr = rva - before + i
        print(f"  0x{addr:08X}: {chunk.hex(' ')}  {''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)}")


def disasm_at(rva: int, count: int = 8) -> None:
    print(f"--- disasm at 0x{rva:X}:")
    off = rva - WBASE
    for ins in md.disasm(wide[off : off + 96], rva):
        print(f"  0x{ins.address:X}: {ins.mnemonic} {ins.op_str}")
        count -= 1
        if count <= 0:
            break


for rva in (0x86230F, 0x8624E2, 0x862909, 0x863BCF, 0x8775B7, 0x8776DE, 0x87779B, 0x8785CE, 0x87860D):
    hexdump(rva)
    disasm_at(rva - 2, 6)  # assume opcode+modrm before disp

print("===== entry targets in encoded region")
for rva in (0x862D7D, 0x862D80, 0x8620C6, 0x86B299, 0x86379B, 0x8637A5, 0x8637AF):
    hexdump(rva, 16, 64)
    disasm_at(rva, 8)

print("===== driver gate writers")
for rva in (0x86118E, 0x8609D1):
    disasm_at(rva - 0x20, 16)
