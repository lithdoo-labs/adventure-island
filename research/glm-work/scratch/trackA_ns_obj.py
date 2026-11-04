"""Find the construction/vtable assignment of the local stream object at
[ebp-0x6c] inside the NameSpace function containing 0x137BA, and dump the
region 0x13600-0x137BA leading up to the PKG1 validation."""
from __future__ import annotations

import struct
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


# search for stores to [ebp-0x6c] in 0x131BE-0x13800: c7 45 94 imm32
lo, hi = to_off(0x131BE), to_off(0x13800)
print("== stores to [ebp-0x6c] (c7 45 94 imm32 / 89 4x 94) in 0x131BE-0x13800 ==")
for i in range(lo, hi - 6):
    if data[i] == 0xC7 and data[i + 1] == 0x45 and data[i + 2] == 0x94:
        imm = struct.unpack_from("<I", data, i + 3)[0]
        rva = to_rva(i)
        print(f"  {rva if rva else i:#x}: mov [ebp-0x6c], {imm:#x}")
    if data[i] == 0x89 and data[i + 1] in (0x45, 0x4D, 0x55, 0x5D, 0x75, 0x7D) and data[i + 2] == 0x94:
        rva = to_rva(i)
        print(f"  {rva if rva else i:#x}: mov [ebp-0x6c], reg ({data[i+1]:#04x})")
    # lea reg,[ebp-0x6c] = 8d 4d 94
    if data[i] == 0x8D and data[i + 1] == 0x4D and data[i + 2] == 0x94:
        rva = to_rva(i)
        print(f"  {rva if rva else i:#x}: lea ecx, [ebp-0x6c]")

print("\n== disasm 0x136C0 - 0x137F0 ==")
off = to_off(0x136C0)
e = off
addr = BASE + 0x136C0
while addr < BASE + 0x137F0:
    insn = list(md.disasm(data[e : e + 12], addr, count=1))
    if not insn:
        e += 1
        addr += 1
        continue
    i = insn[0]
    note = ""
    for op in i.operands:
        if op.type == 2 and 0x50817000 <= op.imm < 0x50819000:
            ro = to_off(op.imm - BASE)
            if ro is not None:
                s = data[ro : ro + 40].split(b"\x00")[0]
                if len(s) >= 3 and all(32 <= b < 127 for b in s):
                    note = f'   ; "{s.decode("latin1")[:36]}"'
    mark = "   <== PKG1 push" if BASE + 0x137BA <= i.address <= BASE + 0x137C0 else ""
    print(f"{i.address:#010x} {i.mnemonic:<8} {i.op_str}{note}{mark}")
    e += i.size
    addr = i.address + i.size
