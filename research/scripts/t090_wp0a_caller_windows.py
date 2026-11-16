"""T090 WP0-A part 2: 0x769B51 tail (ret imm) + 10 caller windows of 0x93CB27."""
import hashlib
import re
from pathlib import Path

import capstone

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000
CODE_LO, CODE_HI = 0x401000, 0xBEA000

data = EXE.read_bytes()
assert hashlib.sha256(data).hexdigest() == EXE_SHA
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)

# --- find the ret imm of 0x769B51 by scanning the function body for `ret` ---
# scan up to 0x200 bytes for the first C2/C3 after prologue
va = 0x769B51
ret_found = []
for off in range(va - BASE, va - BASE + 0x1A0):
    if data[off] == 0xC2:
        ret_found.append((BASE + off, f"ret 0x{int.from_bytes(data[off+1:off+3], 'little'):x}"))
    elif data[off] == 0xC3:
        ret_found.append((BASE + off, "ret"))
print("0x769B51 region ret opcodes (first 6):", ret_found[:6])

# decode tail around the first C2
first_c2 = next(a for a, s in ret_found if s.startswith("ret 0x"))
for ins in md.disasm(data[first_c2 - 0x18 - BASE:first_c2 - BASE + 5], first_c2 - 0x18):
    print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")


CALLERS = [0x5C0342, 0x93E00B, 0x959493, 0x959527, 0x964E16,
           0x9651CC, 0x965567, 0x98DC43, 0x990E21, 0x990E91]

for c in CALLERS:
    print(f"\n=== caller window 0x{c:08X} (0x60 bytes before the call) ===")
    start = c - 0x60
    for ins in md.disasm(data[start - BASE:c + 5 - BASE], start):
        print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")
