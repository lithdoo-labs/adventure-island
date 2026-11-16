"""T090 WP1-C part 10: 0x71BFA5 record accessor + readers of the portal record
delay field (+0x2C) and onlyOnce (+0x28)."""
import hashlib
import re
import struct
from pathlib import Path

import capstone

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000
CODE_LO, CODE_HI = 0x401000, 0xBEA000

exe = EXE.read_bytes()
assert hashlib.sha256(exe).hexdigest() == EXE_SHA
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)


def disas(start, n, title):
    print(f"=== {title} {start:#x} ===")
    for ins in md.disasm(exe[start - BASE:start - BASE + n], start):
        print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")


disas(0x71BFA5, 0x60, "0x71BFA5 (record accessor)")
print()

# E8 callers of 0x71BFA5
cs = []
for off in range(CODE_LO - BASE, CODE_HI - BASE - 5):
    if exe[off] == 0xE8:
        rel = int.from_bytes(exe[off + 1:off + 5], "little", signed=True)
        if BASE + off + 5 + rel == 0x71BFA5:
            cs.append(BASE + off)
print(f"E8 callers of 0x71BFA5: {len(cs)}: {[hex(c) for c in cs]}")
