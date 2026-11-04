"""Locate and disassemble the PKG1 header-validation code in NameSpace.dll."""
from __future__ import annotations

import sys
from pathlib import Path

import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

ROOT = Path(__file__).resolve().parents[2]
CLIENT = ROOT / ".work" / "task-001" / "extracted"
md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True

path = next(CLIENT.rglob("NameSpace.dll"))
data = path.read_bytes()
pe = pefile.PE(str(path), fast_load=True)
pe.parse_data_directories(directories=[
    pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_IMPORT"],
    pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_EXPORT"],
])
BASE = pe.OPTIONAL_HEADER.ImageBase


def to_off(rva):
    for s in pe.sections:
        if s.VirtualAddress <= rva < s.VirtualAddress + max(s.SizeOfRawData, s.Misc_VirtualSize):
            return s.PointerToRawData + (rva - s.VirtualAddress)
    return None


def to_rva(off):
    for s in pe.sections:
        if s.PointerToRawData <= off < s.PointerToRawData + s.SizeOfRawData:
            return s.VirtualAddress + (off - s.PointerToRawData)
    return None


# locate strings
targets = {}
for needle in (b"Package file v1", b"PKG1", b"PKG%04x.tmp"):
    pos = 0
    while True:
        i = data.find(needle, pos)
        if i < 0:
            break
        pos = i + 1
        rva = to_rva(i)
        if rva:
            targets.setdefault(needle, []).append(rva)
print("string RVAs:", {k.decode(): [hex(x) for x in v] for k, v in targets.items()})

# find VA references (push imm32 / mov mem,imm32 / cmp forms)
refs = []
for needle, rvas in targets.items():
    for rva in rvas:
        va = BASE + rva
        for form, opcode_len in (("push imm32", 1), ("mov [mem],imm32 cmp", 2)):
            pattern = va.to_bytes(4, "little")
            pos = 0
            while True:
                i = data.find(pattern, pos)
                if i < 0:
                    break
                pos = i + 1
                r = to_rva(i)
                if r is None:
                    continue
                refs.append((needle, rva, r, i - opcode_len))
print("refs:", [(n.decode(), hex(sr), hex(r)) for n, sr, r, _ in refs])

# PKG1 magic 'PKG1' = 0x31474b50 might also be compared as dword constant
magic = 0x31474B50
pat = None
cnt = 0
for i in range(len(data) - 6):
    if data[i] == 0x3D and int.from_bytes(data[i + 1 : i + 5], "little") == magic:  # cmp eax, imm32
        r = to_rva(i)
        print(f"  cmp eax, 'PKG1' @ rva {r:#x}" if r else "  cmp in headers")
        cnt += 1
    if data[i] == 0x81 and data[i + 1] in (0x38, 0x3D, 0x35) and int.from_bytes(data[i + 2 : i + 6], "little") == magic:
        r = to_rva(i)
        print(f"  cmp/xor 'PKG1' @ rva {r:#x}" if r else "  cmp in headers")
        cnt += 1
    if data[i] == 0x68 and int.from_bytes(data[i + 1 : i + 5], "little") == magic:
        r = to_rva(i)
        print(f"  push 'PKG1' @ rva {r:#x}" if r else "")
        cnt += 1
print(f"PKG1-magic compare forms: {cnt}")

# disassemble around the first ref
if refs:
    needle, sref, rva, back = refs[0]
    start = to_off(rva) - 0x60
    print(f"\n== context around {needle.decode()} ref @rva {rva:#x} ==")
    for insn in md.disasm(data[start : start + 0xC0], BASE + rva - 0x60):
        mark = "  <-- ref" if BASE + rva - 0x60 <= insn.address <= BASE + rva + 6 and needle else ""
        print(f"  {insn.address:#010x} {insn.mnemonic:<8} {insn.op_str}")
        if insn.address > BASE + rva + 0x40:
            break
