#!/usr/bin/env python3
"""T086 WP1m — census of the PCOM namespace surface users in Gr2D:
calls through globals [0x5043A0D0..0x5043A0E0] (PcCreateObject .. PcRootNameSpace)
and the module-object registration path that would bind E576EA33 to a class.
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
pe = pefile.PE(str(DLL))
data = DLL.read_bytes()
assert hashlib.sha256(data).hexdigest() == SHA
md = Cs(CS_ARCH_X86, CS_MODE_32)

GLOBALS = {0x5043A0D0: "PcCreateObject", 0x5043A0D4: "PcFreeUnusedLibraries",
           0x5043A0D8: "PcSerializeObject", 0x5043A0DC: "PcSerializeString",
           0x5043A0E0: "PcRootNameSpace", 0x5043A198: "module-object"}


def off(va):
    rva = va - IMG
    for s in pe.sections:
        if s.VirtualAddress <= rva < s.VirtualAddress + max(s.Misc_VirtualSize, s.SizeOfRawData):
            return s.PointerToRawData + (rva - s.VirtualAddress)
    raise ValueError(hex(va))


# find all `call dword ptr [imm32]` (FF 15) and `call [reg]` near loads of our globals,
# plus direct data references (push imm32 / mov reg, imm32)
text = next(s for s in pe.sections if s.Name.startswith(b".text"))
start = IMG + text.VirtualAddress
code = data[text.PointerToRawData:text.PointerToRawData + text.SizeOfRawData]

print("== call [0x5043A0Dx] sites ==")
for i in range(len(code) - 6):
    if code[i] == 0xFF and code[i + 1] == 0x15:
        tgt = struct.unpack("<I", code[i + 2:i + 6])[0]
        if tgt in GLOBALS:
            print(f"  {start + i:#x}: call [{GLOBALS[tgt]}]")

print("\n== imm32 refs to namespace/module globals ==")
for g, nm in GLOBALS.items():
    needle = struct.pack("<I", g)
    pos = 0
    hits = []
    while True:
        j = data.find(needle, pos)
        if j < 0:
            break
        # map to VA
        for s in pe.sections:
            if s.PointerToRawData <= j < s.PointerToRawData + s.SizeOfRawData:
                va = IMG + s.VirtualAddress + (j - s.PointerToRawData)
                hits.append(va)
        pos = j + 1
    print(f"  {nm} ({g:#x}): {[hex(h) for h in hits]}")
