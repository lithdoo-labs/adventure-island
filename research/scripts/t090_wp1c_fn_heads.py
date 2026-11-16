"""T090 WP1-C part 2: locate the containing functions' heads.
- EXE portal family reader: head before 0x71A5A0 (find prologue + ebx init)
- Gr2D accumulator: head of the function containing 0x5040B9E7/0x5040BC30
  and the origin of [ebp-0x1C] (the animationScale).
"""
import hashlib
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


def find_prologue(data, base, va, back=0x400):
    """Scan backward for SEH prologue (mov eax, imm32; call) or push ebp; mov ebp, esp."""
    best = None
    for s in range(va - back, va):
        chunk = data[s - base:s - base + 8]
        # SEH: B8 xx xx xx xx E8
        if chunk[0] == 0xB8 and chunk[5] == 0xE8:
            ok = True
            for ins in md.disasm(data[s - base:va - base], s):
                pass
            # decode must reach va exactly
            addr = s
            reached = False
            for ins in md.disasm(data[s - base:va - base + 1], s):
                if ins.address == va:
                    reached = True
                if ins.address > va:
                    break
            if reached:
                best = s
                break
        if chunk[0] == 0x55 and chunk[1] == 0x8B and chunk[2] == 0xEC:
            addr = s
            reached = False
            for ins in md.disasm(data[s - base:va - base + 1], s):
                if ins.address == va:
                    reached = True
                if ins.address > va:
                    break
            if reached:
                best = s
                break
    return best


def disas(data, base, start, n):
    for ins in md.disasm(data[start - base:start - base + n], start):
        print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")


head = find_prologue(exe, BASE, 0x71A5A0, 0x800)
print(f"portal-family reader head: {head:#x}" if head else "not found")
if head:
    disas(exe, BASE, head, 0x120)

print()
g2head = find_prologue(gr2d, G2BASE, 0x5040BC30, 0x1000)
print(f"gr2d accumulator head: {g2head:#x}" if g2head else "not found")
if g2head:
    disas(gr2d, G2BASE, g2head, 0x160)
