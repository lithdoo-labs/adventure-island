#!/usr/bin/env python3
"""T086 WP1e — created-object QI chain: 0x50406233 / 0x504062AA bodies."""
import hashlib
from pathlib import Path

import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

REPO = Path(__file__).resolve().parents[2]
DLL = REPO / ".work/task-001/extracted/冒险岛online/Gr2D_DX8.dll"
SHA = "ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1"
IMG = 0x50400000
pe = pefile.PE(str(DLL), fast_load=True)
data = DLL.read_bytes()
assert hashlib.sha256(data).hexdigest() == SHA
md = Cs(CS_ARCH_X86, CS_MODE_32)


def off(va):
    rva = va - IMG
    for s in pe.sections:
        if s.VirtualAddress <= rva < s.VirtualAddress + max(s.Misc_VirtualSize, s.SizeOfRawData):
            return s.PointerToRawData + (rva - s.VirtualAddress)
    raise ValueError(hex(va))


def dis(va, size, nm):
    print(f"===== {nm}")
    for i in md.disasm(data[off(va):off(va) + size], va):
        print(f"{i.address:08X}  {i.bytes.hex():<20} {i.mnemonic} {i.op_str}")


dis(0x50406233, 0x60, "0x50406233 (punk source)")
dis(0x504062AA, 0x90, "0x504062AA (QI wrapper)")
dis(0x50406432, 0x60, "0x50406432 (punk extractor)")
