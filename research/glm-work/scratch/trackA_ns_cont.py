"""Continue the NameSpace mount function dump (0x13162..0x13880) and resolve
the import slots used, plus the construction of the stream object whose
virtual +0x18 reads/validates the PKG1 header."""
from __future__ import annotations

import struct
import sys
from pathlib import Path

import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

ROOT = Path(__file__).resolve().parents[2]
CLIENT = ROOT / ".work" / "task-001" / "extracted"
md = Cs(CS_ARCH_X86, CS_MODE_32)

path = next(CLIENT.rglob("NameSpace.dll"))
data = path.read_bytes()
pe = pefile.PE(str(path), fast_load=True)
pe.parse_data_directories(directories=[
    pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_IMPORT"],
])
BASE = pe.OPTIONAL_HEADER.ImageBase


def to_off(rva):
    for s in pe.sections:
        if s.VirtualAddress <= rva < s.VirtualAddress + max(s.SizeOfRawData, s.Misc_VirtualSize):
            return s.PointerToRawData + (rva - s.VirtualAddress)
    return None


imports = {}
for e in pe.DIRECTORY_ENTRY_IMPORT:
    for imp in e.imports:
        imports[BASE + imp.address] = f"{e.dll.decode()}!{imp.name.decode() if imp.name else imp.ordinal}"
for slot in (0x1E7F0, 0x1E7FC, 0x170AC, 0x1E7A4, 0x1E7F4, 0x1E7E8, 0x1E7C4, 0x1E7B8):
    print(f"slot {BASE + slot:#x} = {imports.get(BASE + slot, '<not import>')}")

print("\n== function 0x13070 continued: 0x13162 - 0x13260 ==")
off = to_off(0x13162)
e = off
while e < to_off(0x13260):
    insn = list(md.disasm(data[e : e + 12], BASE + to_rva(e), count=1)) if False else list(md.disasm(data[e : e + 12], BASE + 0x13162 + (e - off), count=1))
    if not insn:
        e += 1
        continue
    i = insn[0]
    note = ""
    if i.mnemonic == "call" and i.op_str.startswith("dword ptr ["):
        try:
            va = int(i.op_str.split("[")[1].rstrip("]"), 0)
            note = f"   ; {imports.get(va, hex(va))}"
        except Exception:
            pass
    print(f"{i.address:#010x} {i.mnemonic:<8} {i.op_str}{note}")
    e += i.size

print("\n== 0x13740 - 0x13810 (PKG1 validation area) ==")
off = to_off(0x13740)
count = 0
e = off
while count < 60:
    insn = list(md.disasm(data[e : e + 12], BASE + 0x13740 + (e - off), count=1))
    if not insn:
        e += 1
        continue
    i = insn[0]
    note = ""
    if i.mnemonic in ("push", "mov", "lea") :
        for op in i.operands:
            try:
                if op.type == 2 and 0x50817000 <= op.imm < 0x50820000:
                    ro = to_off(op.imm - BASE)
                    if ro is not None:
                        s = data[ro : ro + 44].split(b"\x00")[0]
                        if len(s) >= 3 and all(32 <= b < 127 for b in s):
                            note = f'   ; "{s.decode("latin1")[:40]}"'
            except Exception:
                pass
    if i.mnemonic == "call" and i.op_str.startswith("dword ptr ["):
        try:
            va = int(i.op_str.split("[")[1].rstrip("]"), 0)
            note += f"   ; {imports.get(va, hex(va))}"
        except Exception:
            pass
    mark = "   <== PKG1 push" if BASE + 0x137BA <= i.address <= BASE + 0x137C0 else ""
    print(f"{i.address:#010x} {i.mnemonic:<8} {i.op_str}{note}{mark}")
    e += i.size
    count += 1
