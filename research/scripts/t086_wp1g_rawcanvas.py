#!/usr/bin/env python3
"""T086 WP1g — who references IID 6DC8C7CE (piid pointers) and which vtable
families adjoin the referencing intmap; dump candidate vtable slot45 bodies.
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


def va_of(o):
    for s in pe.sections:
        if s.PointerToRawData <= o < s.PointerToRawData + s.SizeOfRawData:
            return IMG + s.VirtualAddress + (o - s.PointerToRawData)
    return None


# 1. dword references to 0x50436540 (piid in intmap entries or push imm)
needle = struct.pack("<I", 0x50436540)
pos, refs = 0, []
while True:
    i = data.find(needle, pos)
    if i < 0:
        break
    refs.append(i)
    pos = i + 1
print("dword refs to 0x50436540:")
for o in refs:
    va = va_of(o)
    print(f"  file {o:#x} -> VA {va:#x}" if va else f"  file {o:#x} (unmapped)")

# 2. dump intmap region 0x2E500-0x2E560 (known intmap @0x2E520)
print("\nintmap region 0x5042E500..0x5042E580:")
for va in range(0x5042E500, 0x5042E580, 12):
    a = int.from_bytes(data[off(va):off(va) + 4], "little")
    b = int.from_bytes(data[off(va) + 4:off(va) + 8], "little")
    c = int.from_bytes(data[off(va) + 8:off(va) + 12], "little")
    print(f"  {va:#x}: {{piid={a:#x}, dw={b:#x}, cnt={c:#x}}}")

# 3. dump the RawCanvas-family vtable starts and their slot45 (+0xB4)
for vt_start, slots, name in [(0x5042E2C4, 45, "family A 0x2E2C4"), (0x5042E2CC, 45, "family B 0x2E2CC")]:
    s45 = int.from_bytes(data[off(vt_start) + 0xB4:off(vt_start) + 0xB8], "little")
    print(f"\n{name}: slot45(+0xB4) = {s45:#x}")
    # disassemble the slot45 body
    try:
        for i in md.disasm(data[off(s45):off(s45) + 0x40], s45):
            print(f"  {i.address:08X}  {i.bytes.hex():<20} {i.mnemonic} {i.op_str}")
    except ValueError as e:
        print("  <unmapped>", e)
