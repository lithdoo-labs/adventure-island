"""T090 WP1-C part 13: raw decode windows (0x50 bytes) before key +0x5C sites."""
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

for site in (0x4371C3, 0x70476C, 0x704A7A, 0x7071FD, 0x669B84, 0x66AD72):
    print(f"\n--- window before {site:#x} ---")
    for ins in md.disasm(exe[site - 0x50 - BASE:site - BASE + 6], site - 0x50):
        print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")
