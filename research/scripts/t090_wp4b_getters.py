"""T090 WP4-B part 7: X/Y getters 0x5140724A / 0x514074C8 — raw read or
wrapper-mediated? Plus the Set immediate path re-dump 0x5140830E-0x5140832E."""
import hashlib
from pathlib import Path

import capstone

REPO = Path(__file__).resolve().parents[2]
SHAPE = REPO / ".work/task-063/client-stage/Shape2D.dll"
SHAPE_SHA = "9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b"
SBASE = 0x51400000

shape = SHAPE.read_bytes()
assert hashlib.sha256(shape).hexdigest() == SHAPE_SHA
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)

for start, n, name in [
    (0x5140724A, 0x40, "GetX slot+0x20"),
    (0x514074C8, 0x40, "GetY slot+0x28"),
    (0x5140830E, 0x2C, "Set immediate path tail"),
]:
    print(f"=== {name} 0x{start:X} ===")
    for ins in md.disasm(shape[start - SBASE:start - SBASE + n], start):
        print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")
    print()
