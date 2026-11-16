"""T090 WP1-C part 4: full head disassembly of the two functions."""
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


def disas(data, base, start, n, title):
    print(f"=== {title} {start:#x} ===")
    for ins in md.disasm(data[start - base:start - base + n], start):
        print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")


# EXE portal reader head: find ebx init between 0x71A203 and 0x71A5B0
disas(exe, BASE, 0x71A203, 0xB0, "EXE 0x71A203 head (portal family reader)")
print()
# Gr2D accumulator head
disas(gr2d, G2BASE, 0x5040B9DE, 0x140, "Gr2D 0x5040B9DE head (accumulator)")
print()
# and the region right after: where [ebp-0x1c] gets written
disas(gr2d, G2BASE, 0x5040BB1E, 0xE0, "Gr2D 0x5040BB1E (pre-loop)")
