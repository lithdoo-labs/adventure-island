"""T090 WP1-C part 8: decode the portal Start/Continue/Exit frame loaders
(0x71B81C / 0x71BAE3 / 0x71BDA9 regions) to find the per-frame delay read."""
import hashlib
from pathlib import Path

import capstone

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000

exe = EXE.read_bytes()
assert hashlib.sha256(exe).hexdigest() == EXE_SHA
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)


def disas(start, n, title):
    print(f"=== {title} {start:#x} ===")
    for ins in md.disasm(exe[start - BASE:start - BASE + n], start):
        print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")


disas(0x71B7C0, 0x120, "around 0x71B81C (portalExit push site)")
print()
disas(0x71BAA0, 0x100, "around 0x71BAE3 (portalStart push site)")
