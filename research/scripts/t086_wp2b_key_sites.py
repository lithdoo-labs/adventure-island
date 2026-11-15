#!/usr/bin/env python3
"""T086 WP2b — disassemble every -0x3FFF8Axx lea site (the -2^31+299xx key
family) with context, recovering the exact CMS079 insertion-key formulas and
their containing functions.
"""
import hashlib
from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_32

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000
OUT = REPO / "research/result/stage-readiness/forensics/T086-G08-KEY-SITES-DISASM.txt"

data = EXE.read_bytes()
assert hashlib.sha256(data).hexdigest() == SHA
md = Cs(CS_ARCH_X86, CS_MODE_32)

SITES = [
    0x48CE02, 0x50ED77, 0x5181E6, 0x559F07, 0x559F39, 0x559F6B,
    0x69374E, 0x693812, 0x6938A0, 0x69392E, 0x6939BC, 0x693A4A, 0x693ABD,
    0x693B4B, 0x693C0F, 0x693CD3, 0x693D61, 0x693E7E,
    0x6C3A2C, 0x6C3ABD, 0x6C45A4, 0x70DDD7, 0x741942, 0x7A99D5, 0x7A9A0E,
    0x936409, 0x93E80D, 0x93E82A, 0x93E8E0, 0x93E909, 0x93EEE4, 0x93EF0D,
    0x9882E4, 0x9889A8, 0x989AED,
]

lines = ["# T086 WP2b — CMS079 insertion-key lea sites (-2^31+299xx family) full windows", ""]
for site in SITES:
    lo = site - 0x40
    hi = site + 0x18
    lines.append(f"\n===== window around {site:#x} =====")
    for i in md.disasm(data[lo - BASE:hi - BASE], lo):
        mark = " <== KEY" if i.address == site else ""
        lines.append(f"{i.address:08X}  {i.bytes.hex():<22} {i.mnemonic} {i.op_str}{mark}")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("wrote", OUT)
