"""T090 WP1-C part 5: decode the property-get-with-default idiom precisely.
Compare the frame converter 0x43EC69 (known default 120) against the portal
reader 0x71A203-family site at 0x71A72A to determine each default value."""
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


def disas(start, n, title):
    print(f"=== {title} {start:#x} ===")
    for ins in md.disasm(exe[start - BASE:start - BASE + n], start):
        print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")


disas(0x43EC69, 0xC0, "frame converter 0x43EC69 head")
print()
disas(0x71A75B, 0xA0, "portal reader after the 0x155D push (the get chain)")
print()
# where does ebx get re-loaded between 0x71A21C and 0x71A723? scan for ebx writes
import re
found = []
for s in range(0x71A21C, 0x71A730):
    # mov ebx, imm (BB imm32) / push 0x78 style
    chunk = exe[s - BASE:s - BASE + 5]
    if chunk[0] == 0xBB:
        found.append((s, f"mov ebx, {int.from_bytes(chunk[1:5], 'little'):#x}"))
print("ebx writes between head and the delay site:", found)
