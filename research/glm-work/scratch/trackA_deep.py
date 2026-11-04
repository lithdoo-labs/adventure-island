import sys
from pathlib import Path

import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

ROOT = Path(__file__).resolve().parents[2]
CLIENT = ROOT / ".work" / "task-001" / "extracted"

md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True


def load(name):
    path = next(CLIENT.rglob(name))
    data = path.read_bytes()
    pe = pefile.PE(str(path), fast_load=True)
    pe.parse_data_directories(directories=[
        pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_IMPORT"],
        pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_EXPORT"],
        pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_DELAY_IMPORT"],
        pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_BASERELOC"],
    ])
    return path, data, pe


print("== delay imports ==")
for name in ("ResMan.dll", "Canvas.dll", "PCOM.dll", "NameSpace.dll", "Shape2D.dll",
             "Gr2D_DX8.dll", "Sound_DX8.dll", "ZLZ.dll", "WzMss.dll"):
    _p, data, pe = load(name)
    if hasattr(pe, "DIRECTORY_ENTRY_DELAY_IMPORT"):
        for e in pe.DIRECTORY_ENTRY_DELAY_IMPORT:
            fns = [i.name.decode() if i.name else f"ord{i.ordinal}" for i in e.imports]
            print(f"  {name:<14} delay {e.dll.decode():<12} {fns[:10]}")
    else:
        print(f"  {name:<14} no delay imports")

print("\n== Canvas.dll around List.wz ref 0x20bc4 ==")
_p, data, pe = load("Canvas.dll")
off = pe.get_offset_from_rva(0x20bc4 - 0x20) if False else None
# rva->file offset via sections
def to_off(pe, rva):
    for s in pe.sections:
        if s.VirtualAddress <= rva < s.VirtualAddress + max(s.SizeOfRawData, s.Misc_VirtualSize):
            return s.PointerToRawData + (rva - s.VirtualAddress)
    return None

start = to_off(pe, 0x20B60)
for insn in md.disasm(data[start : start + 0x90], 0x50000000 + 0x20B60):
    if insn.address > 0x50000000 + 0x20C00:
        break
    print(f"  {insn.address:#010x} {insn.mnemonic:<8} {insn.op_str}")

print("\n== PCOM.dll around List.wz ref 0x6cc7 ==")
_p, data, pe = load("PCOM.dll")
start = to_off(pe, 0x6C70)
for insn in md.disasm(data[start : start + 0x90], 0x50C00000 + 0x6C70):
    if insn.address > 0x50C00000 + 0x6D10:
        break
    print(f"  {insn.address:#010x} {insn.mnemonic:<8} {insn.op_str}")

print("\n== NameSpace.dll PKG strings context ==")
_p, data, pe = load("NameSpace.dll")
for rva_needle, label in ((0x18C87, "PPKG1"), (0x1E61E, "PKG%04x.tmp")):
    off = to_off(pe, rva_needle - 0x10)
    print(f"  {label} @ {rva_needle:#x}: {data[off:off+0x30].hex()}")
