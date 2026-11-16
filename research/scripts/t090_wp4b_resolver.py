"""T090 WP4-B part 8: decode 0x51406ADC — the wrapper-aware coordinate resolver
used by BOTH the getters (when the wrapper exists) and the Set delta-store."""
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

print("=== Shape2D 0x51406ADC ===")
for ins in md.disasm(shape[0x51406ADC - SBASE:0x51406ADC - SBASE + 0x120], 0x51406ADC):
    print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")
