#!/usr/bin/env python3
"""T086 WP1 — Gr2D slot25 product-object identity chain (static).

Traces, purely statically from Gr2D_DX8.dll (sha-pinned):
  1. wrapper ctor 0x50405846 and helper 0x50409922 inside slot25 0x5040418C;
  2. the construction of the node object that becomes the OUT pointer
     (the [eax+0xB4] slot45 receiver of the tile path);
  3. every vtable installed on that object family;
  4. slot45 (+0xB4) of the recovered vtable(s) — the keyed-insert candidate;
  5. the [this+0x128] collection family (slots 26/27/28) and any draw/sort
     traversal over it;
  6. Gr2D DllMain / PcInitModule registration surface (whether the PCOM
     registry data is statically enumerable).

Emits forensics/T086-G24-GR2D-PRODUCT-OBJECT.txt.
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
OUT = REPO / "research/result/stage-readiness/forensics/T086-G24-GR2D-PRODUCT-OBJECT.txt"

pe = pefile.PE(str(DLL), fast_load=True)
data = DLL.read_bytes()
assert hashlib.sha256(data).hexdigest() == SHA, "sha mismatch"
md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = False

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


def dwords(va: int, n: int, title: str):
    lines.append(f"\n===== {title} ({va:#x}, {n} dwords) =====")
    for k in range(n):
        w = int.from_bytes(data[off(va) + k * 4:off(va) + k * 4 + 4], "little")
        lines.append(f"{va + k * 4:08X}  [{k:3d}] {w:08X}")


# --- 1. wrapper ctor + helper (from EV-74 annotations) ---
dis(0x50405846, 0x60, "wrapper ctor 0x50405846")
dis(0x50409922, 0x100, "helper 0x50409922 (node fill)")

# --- 2. wrapper-class vtable installed by 0x50405846 (read from the disasm
#        manually below; we scan the ctor body for imm32 vtable stores) ---
def vtable_stores(va, size):
    out = []
    for i in md.disasm(data[off(va):off(va) + size], va):
        if i.mnemonic == "mov" and i.op_str.count(",") == 1:
            dst, src = i.op_str.split(",", 1)
            src = src.strip()
            if src.startswith("0x50") and (dst.startswith("dword ptr [") or dst.startswith("[")):
                val = int(src, 16)
                if 0x50420000 <= val < 0x50440000:
                    out.append((i.address, dst.strip(), val))
    return out


lines.append("\n===== vtable stores found =====")
for va, size, name in [(0x50405846, 0x60, "wrapper ctor"), (0x50409922, 0x100, "helper")]:
    for a, dst, val in vtable_stores(va, size):
        lines.append(f"{a:#x} in {name}: {dst} <- {val:#x}")

# --- 3. slot26/27/28 collection family ---
for va, nm in [(0x50404ECA, "slot26 contains"), (0x50404EE9, "slot27 add"), (0x50404F05, "slot28 count")]:
    dis(va, 0x40, nm)

# --- 4. DllMain and Pc registration surface ---
ep = pe.OPTIONAL_HEADER.AddressOfEntryPoint + IMG
dis(ep, 0x80, "DllMain (entry point)")
# imports: list Pc* / reg-related imports
lines.append("\n===== imports (PCOM-facing candidates) =====")
if hasattr(pe, "DIRECTORY_ENTRY_IMPORT"):
    for entry in pe.DIRECTORY_ENTRY_IMPORT:
        lines.append(f"dll: {entry.dll.decode()}")
        names = [imp.name.decode() for imp in entry.imports if imp.name]
        lines.append("  " + ", ".join(names[:60]))

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("wrote", OUT)
