"""T090 WP2-A part 2: +0x9C fast path (default-VARIANT) + EXE call-site windows."""
import hashlib
from pathlib import Path

import capstone

REPO = Path(__file__).resolve().parents[2]
SHAPE = REPO / ".work/task-063/client-stage/Shape2D.dll"
SHAPE_SHA = "9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b"
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
SBASE = 0x51400000
BASE = 0x400000

shape = SHAPE.read_bytes()
assert hashlib.sha256(shape).hexdigest() == SHAPE_SHA
exe = EXE.read_bytes()
assert hashlib.sha256(exe).hexdigest() == EXE_SHA
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)

print("=== Shape2D 0x5140878F.. (fast path / tail of 0x514086B3) ===")
for ins in md.disasm(shape[0x5140878F - SBASE:0x5140878F - SBASE + 0xC0], 0x5140878F):
    print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")

for site in (0x66B1A6, 0x66C0EF, 0x4379D4, 0x4B3B0B):
    print(f"\n=== EXE window before {site:#x} ===")
    # anchored back-decode
    anchor = None
    for s in range(site - 0x50, site):
        ins_list = list(md.disasm(exe[s - BASE:site - BASE + 6], s))
        if ins_list and ins_list[-1].address == site:
            anchor = s
            break
    if anchor is None:
        s0 = site - 0x40
        ins_list = list(md.disasm(exe[s0 - BASE:site - BASE + 6], s0))
    else:
        ins_list = list(md.disasm(exe[anchor - BASE:site - BASE + 6], anchor))
    for ins in ins_list:
        print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")
