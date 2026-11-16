"""T090 WP4-B part 2: decode the pending-list walker (tick advance) in Shape2D —
slots +0x78 (0x51407CB2 family), +0x80 (0x51407CE1), +0x84 (0x51407DA7),
+0x88 (0x51407E64) — to find where the filter/interp record OUTPUT lands
([this+0x1C]/[this+0x20]? or an out-param?)."""
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
    (0x51407DA7, 0x1D0, "slot +0x84 (tick advance candidate)"),
    (0x51407E64, 0xC0, "slot +0x88"),
]:
    print(f"=== {name} 0x{start:X} ===")
    for ins in md.disasm(shape[start - SBASE:start - SBASE + n], start):
        print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")
    print()
