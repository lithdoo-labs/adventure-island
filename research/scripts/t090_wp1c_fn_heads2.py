"""T090 WP1-C part 3: brute-force function head search with byte anchors.

EXE: the family of readers around 0x71A5xx-0x71Bxxx — scan 0x71A000-0x71A5A0
for `mov eax, imm32; call` SEH prologues and pick the latest one before 0x71A5A0.
Gr2D: scan 0x5040B900-0x5040BC30 similarly.
"""
import hashlib
from pathlib import Path

import capstone

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
GR2D = REPO / ".work/task-063/client-stage/Gr2D_DX8.dll"
GR2D_SHA = "ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1"
BASE = 0x400000
G2BASE = 0x50400000

exe = EXE.read_bytes()
assert hashlib.sha256(exe).hexdigest() == EXE_SHA
gr2d = GR2D.read_bytes()
assert hashlib.sha256(gr2d).hexdigest() == GR2D_SHA
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)


def prologues(data, base, lo, hi):
    out = []
    for s in range(lo, hi):
        b = data[s - base:s - base + 6]
        if len(b) >= 6 and b[0] == 0xB8 and b[5] == 0xE8:
            out.append(s)
        elif len(b) >= 3 and b[0] == 0x55 and b[1] == 0x8B and b[2] == 0xEC:
            out.append(s)
    return out


for label, data, base, lo, hi, target in [
    ("EXE portal family", exe, BASE, 0x71A000, 0x71A5B0, 0x71A5B0),
    ("Gr2D accumulator", gr2d, G2BASE, 0x5040B900, 0x5040BC30, 0x5040BC30),
]:
    print(f"=== {label}: prologue candidates below {target:#x} ===")
    for s in prologues(data, base, lo, hi):
        # decode a few instructions at s for context
        ctx = []
        for ins in md.disasm(data[s - base:s - base + 0x40], s):
            ctx.append(f"{ins.mnemonic} {ins.op_str}")
            if len(ctx) >= 4:
                break
        print(f"  {s:#x}: " + " | ".join(ctx))
