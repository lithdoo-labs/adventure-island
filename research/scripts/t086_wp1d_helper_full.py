#!/usr/bin/env python3
"""T086 WP1d — full body of Gr2D helper 0x50409922 (the slot25 product-object
constructor path) plus its callees 0x50409AFB/0x50409B7E/0x50409BDA and the
0x504045C1-0x504045CB out-write window of slot25 0x5040418C.

Goal: recover the concrete vtable of the object written to *arg15 (the
[eax+0xB4] slot45 receiver), and every store into it.
"""
import hashlib
from pathlib import Path

import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

REPO = Path(__file__).resolve().parents[2]
DLL = REPO / ".work/task-001/extracted/冒险岛online/Gr2D_DX8.dll"
SHA = "ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1"
IMG = 0x50400000
OUT = REPO / "research/result/stage-readiness/forensics/T086-G24-HELPER-9922-FULL.txt"

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


lines = []


def dis(va, size, title):
    lines.append(f"\n===== {title} ({va:#x} +{size:#x}) =====")
    for i in md.disasm(data[off(va):off(va) + size], va):
        lines.append(f"{i.address:08X}  {i.bytes.hex():<24} {i.mnemonic} {i.op_str}")


dis(0x50409922, 0x2A0, "helper 0x50409922 FULL (node fill)")
dis(0x50409AFB, 0x40, "0x50409AFB slot36(+0x90) virtual call site ctx")
dis(0x50409B7E, 0x60, "0x50409B7E slot25(+0x64) recursive call ctx")
dis(0x50409BDA, 0x40, "0x50409BDA slot56(+0xE0) call ctx")
dis(0x50404580, 0x90, "slot25 0x5040418C out-write window 0x50404580-0x50404610")
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("wrote", OUT)
