"""T090 WP4-B part 9: filter commit 0x51408C9A (+0xA8) — does it operate on the
wrapper at [this+0x24]? Full body."""
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

print("=== Shape2D 0x51408C9A (filter COMMIT slot +0xA8) ===")
for ins in md.disasm(shape[0x51408C9A - SBASE:0x51408C9A - SBASE + 0xF8], 0x51408C9A):
    print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")
