#!/usr/bin/env python3
"""T086 WP1f — IID of the created object + all IID occurrences in Gr2D."""
import hashlib
from pathlib import Path

import pefile

REPO = Path(__file__).resolve().parents[2]
DLL = REPO / ".work/task-001/extracted/冒险岛online/Gr2D_DX8.dll"
SHA = "ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1"
IMG = 0x50400000
pe = pefile.PE(str(DLL), fast_load=True)
data = DLL.read_bytes()
assert hashlib.sha256(data).hexdigest() == SHA


def off(va):
    rva = va - IMG
    for s in pe.sections:
        if s.VirtualAddress <= rva < s.VirtualAddress + max(s.Misc_VirtualSize, s.SizeOfRawData):
            return s.PointerToRawData + (rva - s.VirtualAddress)
    raise ValueError(hex(va))


def va_of(o):
    for s in pe.sections:
        if s.PointerToRawData <= o < s.PointerToRawData + s.SizeOfRawData:
            return IMG + s.VirtualAddress + (o - s.PointerToRawData), s.Name.rstrip(bytes(8)).decode()
    return None, None


iid = data[off(0x50436540):off(0x50436540) + 16]
print("IID@0x50436540:", iid.hex(" "))
iid2 = data[off(0x50436460):off(0x50436460) + 16]
print("IID@0x50436460:", iid2.hex(" "))
for label, blob in [("0x50436540", iid), ("0x50436460", iid2)]:
    pos, occ = 0, []
    while True:
        i = data.find(blob, pos)
        if i < 0:
            break
        occ.append(i)
        pos = i + 1
    print(f"IID {label}: {len(occ)} occurrence(s):")
    for o in occ:
        va, sec = va_of(o)
        print("   file", hex(o), "-> VA", hex(va) if va else None, "section", sec)
