"""Aligned disassembly around the NameSpace.dll PKG1 reference sites."""
from __future__ import annotations

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
BASE = pe.OPTIONAL_HEADER.ImageBase


def to_off(rva):
    for s in pe.sections:
        if s.VirtualAddress <= rva < s.VirtualAddress + max(s.SizeOfRawData, s.Misc_VirtualSize):
            return s.PointerToRawData + (rva - s.VirtualAddress)
    return None


def aligned_window(hit_rva: int, back: int = 0x50, fwd: int = 0x60) -> None:
    """Find a start whose disasm lands exactly on hit_rva, then print."""
    hit_off = to_off(hit_rva)
    for start in range(hit_off - back, hit_off):
        ok = False
        e = start
        for _ in range(60):
            insns = list(md.disasm(data[e : e + 12], BASE + (e - to_off(hit_rva)) + hit_rva - (hit_off - start), count=1))
            if not insns:
                break
            addr = insns[0].address
            if addr == BASE + hit_rva - (hit_off - start) + (e - start):
                pass
            e += insns[0].size
            if e == hit_off:
                ok = True
                break
            if e > hit_off:
                break
        if ok:
            s_off = start
            s_rva = hit_rva - (hit_off - s_off)
            print(f"-- aligned from rva {s_rva:#x} --")
            cur = s_off
            while cur < hit_off + fwd:
                insn = list(md.disasm(data[cur : cur + 12], BASE + hit_rva - (hit_off - cur), count=1))
                if not insn:
                    cur += 1
                    continue
                i = insn[0]
                mark = "   <-- ref" if i.address - BASE == hit_rva else ""
                print(f"  {i.address:#010x} {i.mnemonic:<8} {i.op_str}{mark}")
                cur += i.size
            return
    print(f"  (no clean alignment found for {hit_rva:#x}; raw dump)")
    off = to_off(hit_rva) - 0x20
    print("  " + data[off : off + 0x40].hex())


for rva in (0x137BB, 0x130DB, 0x1314A):
    print(f"\n===== ref site rva {rva:#x} =====")
    aligned_window(rva)
