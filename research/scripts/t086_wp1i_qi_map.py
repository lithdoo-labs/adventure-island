#!/usr/bin/env python3
"""T086 WP1i — QI walker of intmap 0x5042E520 + dword map of the whole
RawCanvas-family vtable block 0x5042E2C4..0x5042E400 + ctor contexts.
"""
import hashlib
import struct
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


# 1. dword refs to 0x5042E520 (the intmap base used by the QI walker)
needle = struct.pack("<I", 0x5042E520)
pos, refs = 0, []
while True:
    i = data.find(needle, pos)
    if i < 0:
        break
    refs.append(i)
    pos = i + 1
print("dword refs to intmap 0x5042E520:")
for o in refs:
    va = IMG + o if o < len(data) else None
    # map file->va via sections
    for s in pe.sections:
        if s.PointerToRawData <= o < s.PointerToRawData + s.SizeOfRawData:
            va = IMG + s.VirtualAddress + (o - s.PointerToRawData)
    print(f"  file {o:#x} -> VA {va:#x}")

# 2. dword map 0x5042E2C4..0x5042E404
print("\ndword map:")
for va in range(0x5042E2C4, 0x5042E404, 4):
    w = int.from_bytes(data[off(va):off(va) + 4], "little")
    tag = ""
    if 0x50400000 <= w < 0x5042C000:
        tag = "code"
    print(f"  {va:#x} (+{(va-0x5042E2C4):#06x}): {w:#010x} {tag}")

# 3. ctor contexts
for va, size, nm in [(0x50402A30 - 0x30, 0x60, "ctor ctx installing 0x5042E2C4"),
                     (0x50402874 - 0x20, 0x60, "ctor ctx installing 0x5042E2EC/0x5042E2D8"),
                     (0x50402BA4 - 0x20, 0x50, "ctx installing 0x5042E36C")]:
    print(f"\n===== {nm}")
    for i in md.disasm(data[off(va):off(va) + size], va):
        print(f"{i.address:08X}  {i.bytes.hex():<20} {i.mnemonic} {i.op_str}")
