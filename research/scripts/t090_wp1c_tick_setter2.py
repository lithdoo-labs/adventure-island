"""T090 WP1-C part 12: anchored windows for the key +0x5C tick-setter call sites."""
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


def anchored(va, back=0x60):
    for s in range(va - back, va):
        ins_list = list(md.disasm(exe[s - BASE:va - BASE + 6], s))
        if ins_list and ins_list[-1].address == va:
            return s, ins_list
    return None, []


for site in (0x4371C3, 0x70476C, 0x704A7A, 0x7071FD, 0x669B84):
    anchor, ins_list = anchored(site)
    print(f"\n--- {site:#x} (anchor {anchor and hex(anchor)}) ---")
    if anchor:
        for ins in ins_list:
            print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")
    else:
        print("  (no anchor)")
