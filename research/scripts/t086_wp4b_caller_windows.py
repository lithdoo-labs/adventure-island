#!/usr/bin/env python3
"""T086 WP4b — classify each call [reg+0x3C] site: disassemble a +-0x24
window and report the receiver-provenance signature (which global / field
feeds the object register), so the scene-family slot15 caller can be
identified or the absence proven (bounded).
"""
import hashlib
from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_32

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000
OUT = REPO / "research/result/stage-readiness/forensics/T086-G10-SLOT15-CALLER-WINDOWS.txt"

SITES = [0x4951A2, 0x495769, 0x4D6763, 0x4D6F49, 0x4E0C85, 0x4E146A, 0x522B5F,
         0x52A600, 0x548048, 0x68D5B1, 0x8A26B5, 0x8A26CF, 0x8A26DB, 0x8A27DD,
         0x8A27ED, 0x8A371F, 0x8A3D7D, 0x8A3D90, 0x923DE2, 0x924564, 0x9245AA,
         0x92460B, 0x9DDC18, 0x9DE0E1, 0x9DE108, 0x9E2670, 0x9E4032, 0x9F20A4]

data = EXE.read_bytes()
assert hashlib.sha256(data).hexdigest() == SHA
md = Cs(CS_ARCH_X86, CS_MODE_32)

lines = ["# T086 WP4b — call [reg+0x3C] site windows", ""]
for va in SITES:
    lines.append(f"\n===== {va:#x} =====")
    for i in md.disasm(data[va - BASE - 0x28:va - BASE + 0x10], va - 0x28):
        mark = " <== CALL" if i.address == va else ""
        lines.append(f"{i.address:08X}  {i.bytes.hex():<20} {i.mnemonic} {i.op_str}{mark}")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("wrote", OUT)
