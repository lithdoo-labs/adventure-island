#!/usr/bin/env python3
"""T086 WP1b — Gr2D [this+0x128] collection method family (static, full bodies).

The engine-side receiver of the tile/obj registration path stores created
nodes into the collection at [this+0x128] via slot27 0x50404EE9 ->
0x50407BEC. This script dumps the full bodies of the collection method
family (0x50407ADE contains / 0x50407BEC add / 0x50407F23 / 0x50407F34 /
0x50407F3F and their internal callees) to decide statically whether the
container is an ORDERED (comparator-inserted) structure — the G01/G07
comparator question — and to recover the sort key comparison if present.
"""
import hashlib
import sys
from pathlib import Path

import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

REPO = Path(__file__).resolve().parents[2]
DLL = REPO / ".work/task-001/extracted/冒险岛online/Gr2D_DX8.dll"
SHA = "ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1"
IMG = 0x50400000
OUT = REPO / "research/result/stage-readiness/forensics/T086-G24-COLLECTION-FAMILY.txt"

pe = pefile.PE(str(DLL), fast_load=True)
data = DLL.read_bytes()
assert hashlib.sha256(data).hexdigest() == SHA, "sha mismatch"
md = Cs(CS_ARCH_X86, CS_MODE_32)

lines = []


def off(va: int) -> int:
    rva = va - IMG
    for s in pe.sections:
        if s.VirtualAddress <= rva < s.VirtualAddress + max(s.Misc_VirtualSize, s.SizeOfRawData):
            return s.PointerToRawData + (rva - s.VirtualAddress)
    raise ValueError(f"va {va:#x} unmapped")


def dis(va: int, size: int, title: str):
    lines.append(f"\n===== {title} ({va:#x}, {size:#x} bytes) =====")
    for i in md.disasm(data[off(va):off(va) + size], va):
        lines.append(f"{i.address:08X}  {i.bytes.hex():<22} {i.mnemonic} {i.op_str}")


def find_ret_end(va: int, max_ins: int = 400) -> int:
    """Return VA just past the first ret/ret-imm at this address."""
    count = 0
    for i in md.disasm(data[off(va):off(va) + 0x2000], va):
        count += 1
        if count > max_ins:
            break
        if i.mnemonic in ("ret", "retf") or i.mnemonic == "ret":
            return i.address + i.size
    return va + 0x200


# full bodies of the collection family
for va, nm in [
    (0x50407ADE, "collection.contains? (slot26 callee)"),
    (0x50407BEC, "collection.add? (slot27 callee) — ORDER-INSERT CANDIDATE"),
    (0x50407F23, "collection method 0x50407F23 (slot28 callee)"),
    (0x50407F34, "collection method 0x50407F34"),
    (0x50407F3F, "collection method 0x50407F3F"),
]:
    dis(va, 0x180, nm)

# follow internal callees of the add path
dis(0x50405087, 0xC0, "callee 0x50405087 (from helper 0x50409922)")
dis(0x5040C2B9, 0x80, "callee 0x5040C2B9 (string-ish)")
dis(0x50409C16, 0xC0, "callee 0x50409C16 (node ctor candidate)")
dis(0x50404F6E, 0x60, "in-place sub-object ctor 0x50404F6E")
dis(0x50401C70, 0x80, "global-fn initializer 0x50401C70 (namespace surface)")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("wrote", OUT)
