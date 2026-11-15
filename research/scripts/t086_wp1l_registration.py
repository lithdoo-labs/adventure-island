#!/usr/bin/env python3
"""T086 WP1l — Gr2D registration surface: parse imports fully, locate
PcRegister* calls in DllMain worker 0x50401005 / static initializers, and
check whether the E576EA33 class binding (class-1 vs class-2) is statically
enumerable or runtime-only (PCOM namespace data).
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
print("== exports ==")
for e in (pe.DIRECTORY_ENTRY_EXPORT.symbols if hasattr(pe, "DIRECTORY_ENTRY_EXPORT") else []):
    print(f"  {e.name.decode() if e.name else '<ord>'} @ rva {e.address:#x}")
print("== imports ==")
iat = {}
for entry in getattr(pe, "DIRECTORY_ENTRY_IMPORT", []):
    print(f"  dll: {entry.dll.decode()}")
    for imp in entry.imports:
        nm = imp.name.decode() if imp.name else f"ord{imp.ordinal}"
        iat[imp.address] = nm
        print(f"    {nm} @ iat {imp.address:#x}")


def off(va):
    rva = va - IMG
    for s in pe.sections:
        if s.VirtualAddress <= rva < s.VirtualAddress + max(s.Misc_VirtualSize, s.SizeOfRawData):
            return s.PointerToRawData + (rva - s.VirtualAddress)
    raise ValueError(hex(va))


# scan .text for `call dword ptr [iat]` (FF 15 xx) hitting Pc*/DllRegister-ish imports
text = next(s for s in pe.sections if s.Name.startswith(b".text"))
start = IMG + text.VirtualAddress
code = data[text.PointerToRawData:text.PointerToRawData + text.SizeOfRawData]
print("\n== call [iat] sites (named imports) ==")
found = 0
for i in range(len(code) - 6):
    if code[i] == 0xFF and code[i + 1] == 0x15:
        tgt = struct.unpack("<I", code[i + 2:i + 6])[0]
        if tgt in iat:
            va = start + i
            if found < 40:
                print(f"  {va:#x}: call [{iat[tgt]}]")
            found += 1
print(f"total call [iat] sites: {found}")
