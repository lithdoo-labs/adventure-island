import sys
from pathlib import Path

import pefile

ROOT = Path(__file__).resolve().parents[2]
CLIENT = ROOT / ".work" / "task-001" / "extracted"
path = next(CLIENT.rglob("NameSpace.dll"))
data = path.read_bytes()
pe = pefile.PE(str(path), fast_load=True)
pe.parse_data_directories(directories=[pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_IMPORT"]])
BASE = pe.OPTIONAL_HEADER.ImageBase


def to_off(rva):
    for s in pe.sections:
        if s.VirtualAddress <= rva < s.VirtualAddress + max(s.SizeOfRawData, s.Misc_VirtualSize):
            return s.PointerToRawData + (rva - s.VirtualAddress)
    return None


def cstr(rva):
    off = to_off(rva)
    out = bytearray()
    while off < len(data) and data[off] and len(out) < 80:
        out.append(data[off])
        off += 1
    return out.decode("latin1")


print("string @0x1AE30:", repr(cstr(0x1AE30)))
print("string @0x18C88:", repr(cstr(0x18C88)))
print("string @0x18C98:", repr(cstr(0x18C98)))
print("string @0x1E620:", repr(cstr(0x1E620)))
for slot in (0x1E7FC, 0x170AC):
    va = BASE + slot
    for e in pe.DIRECTORY_ENTRY_IMPORT:
        for imp in e.imports:
            if BASE + imp.address == va:
                print(f"import [{va:#x}] = {e.dll.decode()}!{imp.name.decode() if imp.name else imp.ordinal}")
