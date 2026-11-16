"""T090 WP4-B part 3: decode Shape2D 0x51406CF7 — the record-advance engine
called by the tick method; determine where filter/interp/parallax outputs land."""
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

print("=== Shape2D 0x51406CF7 (record advance engine) ===")
for ins in md.disasm(shape[0x51406CF7 - SBASE:0x51406CF7 - SBASE + 0x2E0], 0x51406CF7):
    print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")
    if ins.mnemonic == "ret" and ins.address > 0x51406D80:
        break
