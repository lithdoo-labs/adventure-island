"""T090 WP1-C: portal delay consumer default + animationScale source.

1. The T089 phase-2 D2 note says the portal family's own delay read sits near
   0x71A72A and is NOT among the 18 verified-120 sites. Decode its containing
   function: which property id does it read, what default does it push, and how
   does it feed the portal animation registration?
2. Gr2D accumulator: end-ts += delay*[scale]/1000 at 0x5040BCC7-0x5040BCDD.
   Find where the scale ([ebp-0x1C]) comes from (function arg / member / global
   default).
sha-pinned; capstone.
"""
import hashlib
import re
from pathlib import Path

import capstone

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
GR2D = REPO / ".work/task-063/client-stage/Gr2D_DX8.dll"
GR2D_SHA = "ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1"
BASE = 0x400000
G2BASE = 0x50400000

exe = EXE.read_bytes()
assert hashlib.sha256(exe).hexdigest() == EXE_SHA
gr2d = GR2D.read_bytes()
assert hashlib.sha256(gr2d).hexdigest() == GR2D_SHA
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)


def disas_x(va, start, n, base=BASE, data=None):
    data = data or exe
    out = []
    for ins in md.disasm(data[start - base:start - base + n], start):
        out.append(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")
    return out


def show(title, lines):
    print(f"--- {title} ---")
    for line in lines:
        print(line)


# 1. portal delay read near 0x71A72A
show("EXE 0x71A6C0-0x71A760 (portal delay read region)", disas_x(None, 0x71A6C0, 0xA0))

# wider containing-function context
show("EXE 0x71A5A0-0x71A6C0", disas_x(None, 0x71A5A0, 0x120))

# 2. push 0x155D census with the paired default push (nearby window)
sites = []
for off in range(0x401000 - BASE, 0xBEA000 - BASE - 2):
    if exe[off] == 0x68 and exe[off + 1:off + 5] == b"\x5d\x15\x00\x00":
        sites.append(BASE + off)
print(f"\npush 0x155D sites: {len(sites)}")

# 3. Gr2D accumulator context: find where [ebp-0x1C] (scale) is set
show("Gr2D 0x5040BC30-0x5040BD00 (accumulator)", disas_x(None, 0x5040BC30, 0xD0, base=G2BASE, data=gr2d))
