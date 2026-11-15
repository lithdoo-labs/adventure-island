#!/usr/bin/env python3
"""T086 WP1c — string constants used by the Gr2D engine-side registration
surface ([engine+0x128] object init at 0x50407B80 and the namespace call in
helper 0x50409922 at 0x504099E4). ASCII strings at the referenced VAs name
the late-bound API — this identifies the collection/namespace semantics
statically.
"""
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


def off(va: int) -> int:
    rva = va - IMG
    for s in pe.sections:
        if s.VirtualAddress <= rva < s.VirtualAddress + max(s.Misc_VirtualSize, s.SizeOfRawData):
            return s.PointerToRawData + (rva - s.VirtualAddress)
    raise ValueError(va)


def cstr(va: int, maxlen=96):
    o = off(va)
    raw = data[o:o + maxlen]
    s = raw.split(b"\x00")[0]
    return s.decode("cp1252", "replace")


for va in [0x504365C0, 0x50436610, 0x50436600, 0x504365F4, 0x504365E4, 0x504365D4,
           0x5043636C, 0x50436390, 0x50431D08]:
    try:
        print(f"{va:#x}: {cstr(va)!r}")
    except Exception as e:
        print(f"{va:#x}: <{e}>")

# also wide strings?
def wstr(va, maxlen=64):
    o = off(va)
    raw = data[o:o + maxlen * 2]
    s = raw.split(b"\x00\x00")[0]
    return s.decode("utf-16le", "replace")


print("--- same VAs as wide ---")
for va in [0x504365C0, 0x50436610, 0x5043636C]:
    try:
        print(f"{va:#x}: {wstr(va)!r}")
    except Exception as e:
        print(f"{va:#x}: <{e}>")
