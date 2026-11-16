"""T090 self-check: the slot15 consume edge — 0x48AEC3 and 0x404B07/0x404B2E
bodies (do they really call [vt+0x20]/[vt+0x28] on the [fieldctx+0xD4] object?)."""
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

for start, n, name in [(0x404B07, 0x28, "0x404B07 (GetX wrapper)"),
                       (0x404B2E, 0x28, "0x404B2E (GetY wrapper)"),
                       (0x48AEC3, 0x60, "0x48AEC3 (slot15 camera read)")]:
    print(f"=== {name} ===")
    for ins in md.disasm(exe[start - BASE:start - BASE + n], start):
        print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")
    print()
