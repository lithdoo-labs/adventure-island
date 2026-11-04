"""Function-level analyzer for NameSpace.dll: prologue-bounded functions,
string/vtable xrefs, and full dump of the PKG1-mount function (contains the
`push 0x50818C88` at RVA 0x137BA) plus identification of the stream object's
vtable and its +0x18 (Read) method.
"""
from __future__ import annotations

import struct
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
text = next(s for s in pe.sections if s.Name.startswith(b".text"))
rdata = next(s for s in pe.sections if s.Name.startswith(b".rdata"))
TEXT_LO, TEXT_HI = text.VirtualAddress, text.VirtualAddress + text.Misc_VirtualSize
RDATA_LO, RDATA_HI = rdata.VirtualAddress, rdata.VirtualAddress + rdata.Misc_VirtualSize


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


def func_starts() -> list[int]:
    starts = []
    raw = data[to_off(TEXT_LO) : to_off(TEXT_LO) + text.SizeOfRawData]
    pos = 0
    while True:
        i = raw.find(b"\x55\x8b\xec", pos)
        if i < 0:
            break
        pos = i + 1
        rva = to_rva(to_off(TEXT_LO) + i)
        if rva is not None:
            starts.append(rva)
    return sorted(set(starts))


STARTS = func_starts()


def func_of(rva):
    lo = [s for s in STARTS if s <= rva]
    return lo[-1] if lo else None


def disasm_func(start: int, max_bytes: int = 0x500) -> list:
    off = to_off(start)
    out = []
    e = off
    end = off + max_bytes
    while e < end:
        insn = list(md.disasm(data[e : e + 12], BASE + to_rva(e), count=1))
        if not insn:
            e += 1
            continue
        i = insn[0]
        out.append(i)
        if i.mnemonic in ("ret",) or (i.mnemonic == "jmp" and i.op_str.startswith("0x")):
            # stop at ret; stop at tail jmp out of function
            tgt = int(i.op_str, 0) if i.mnemonic == "jmp" else 0
            if i.mnemonic == "ret" or not (start <= tgt < start + max_bytes):
                break
        e += i.size
        rva_here = to_rva(e)
        if rva_here in STARTS and rva_here != start:
            break
    return out


def annotate(insn) -> str:
    note = ""
    if insn.mnemonic in ("push", "mov", "cmp") and insn.operands:
        for op in insn.operands:
            if op.type == 2 and 0 <= op.imm - BASE < 0x2000000:  # IMM
                rva = op.imm - BASE
                if RDATA_LO <= rva < RDATA_HI:
                    off = to_off(rva)
                    s = data[off : off + 40].split(b"\x00")[0]
                    if s and all(32 <= b < 127 for b in s[:8]) and len(s) >= 4:
                        note = f'   ; "{s.decode("latin1")[:36]}"'
                    else:
                        note = f"   ; rdata {rva:#x}"
                elif TEXT_LO <= rva < TEXT_HI:
                    note = f"   ; -> sub_{rva:x}"
    return note


target = func_of(0x137BA)
print(f"function containing 0x137BA starts at RVA {target:#x}")
insns = disasm_func(target, 0x400)
for i in insns:
    mark = "   <== PKG1 push" if BASE + 0x137BA <= i.address <= BASE + 0x137C0 else ""
    print(f"{i.address:#010x} {i.mnemonic:<8} {i.op_str}{annotate(i)}{mark}")

# vtable candidates in .rdata: consecutive text pointers
print("\n== vtable candidates (>=4 consecutive .text pointers) ==")
off = to_off(RDATA_LO)
raw = data[off : off + rdata.SizeOfRawData]
i = 0
vtables = []
while i < len(raw) - 4 * 6:
    run = 0
    while i + run * 4 + 4 <= len(raw):
        v = struct.unpack_from("<I", raw, i + run * 4)[0]
        if TEXT_LO <= v - BASE < TEXT_HI:
            run += 1
        else:
            break
    if run >= 4:
        rva = RDATA_LO + i
        vtables.append((rva, run))
        i += run * 4
    else:
        i += 4
print(f"{len(vtables)} vtables")
for rva, n in vtables:
    entries = [struct.unpack_from("<I", raw, rva - RDATA_LO + 4 * k)[0] - BASE for k in range(min(n, 6))]
    print(f"  vt@{rva:#x} x{n}: " + " ".join(f"{e:#x}" for e in entries))
