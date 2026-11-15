#!/usr/bin/env python3
"""T086 WP1k — the REAL class: ctor 0x504067D7 installs vtable stack
{+0: 0x5042E3F0, +4: 0x5042E3EC, +8: 0x5042E3E8, +0xC: 0x5042E3D0}.
Dumps the primary table 0x5042E3F0 fully (to its terminator), then the
bodies of slot45 (+0xB4) and slot56 (+0xE0) — the exact two virtual calls
of the EXE tile path (0x666F7D / 0x666FD4).
"""
import hashlib
from pathlib import Path

import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

REPO = Path(__file__).resolve().parents[2]
DLL = REPO / ".work/task-001/extracted/冒险岛online/Gr2D_DX8.dll"
SHA = "ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1"
IMG = 0x50400000
VT = 0x5042E3F0
OUT = REPO / "research/result/stage-readiness/forensics/T086-G24-PRIMARY-VT-E3F0.txt"

pe = pefile.PE(str(DLL), fast_load=True)
data = DLL.read_bytes()
assert hashlib.sha256(data).hexdigest() == SHA
md = Cs(CS_ARCH_X86, CS_MODE_32)


def off(va):
    rva = va - IMG
    for s in pe.sections:
        if s.VirtualAddress <= rva < s.VirtualAddress + max(s.Misc_VirtualSize, s.SizeOfRawData):
            return s.PointerToRawData + (rva - s.VirtualAddress)
    raise ValueError(hex(va))


def code_ptr(w):
    return 0x50401005 <= w < 0x5042C000


lines = []
words = []
va = VT
while True:
    w = int.from_bytes(data[off(va):off(va) + 4], "little")
    words.append((va, w))
    if not code_ptr(w):
        break
    va += 4
    if va > VT + 0x1000:
        break

lines.append(f"# primary vtable {VT:#x}: {len(words) - 1} code slots (terminator/other at {words[-1][0]:#x} = {words[-1][1]:#x})")
for k, (a, w) in enumerate(words):
    role = ""
    if k == 45:
        role = " <-- slot45 (EXE 0x666F7D [eax+0xB4])"
    if k == 56:
        role = " <-- slot56 (EXE 0x666FD4 [eax+0xE0])"
    lines.append(f"  [{k:3d}] +{k * 4:#06x} {a:#x}: {w:#010x}{role}")

for slot in (45, 56, 0, 3):
    if slot < len(words) - 1:
        body = words[slot][1]
        lines.append(f"\n===== slot{slot} body {body:#x} =====")
        try:
            for i in md.disasm(data[off(body):off(body) + 0xC0], body):
                lines.append(f"{i.address:08X}  {i.bytes.hex():<22} {i.mnemonic} {i.op_str}")
                if i.mnemonic == "ret":
                    break
        except ValueError as e:
            lines.append(f"<unmapped {e}>")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines[:20]))
print("...")
print("slot45:", hex(words[45][1]) if len(words) > 45 else "?", " slot56:", hex(words[56][1]) if len(words) > 56 else "?")
print("wrote", OUT)
