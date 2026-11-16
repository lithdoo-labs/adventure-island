"""T090 WP0-A part 3: 0x93CB27 tail ret imm + anchored caller windows.

For each caller, find the earliest backward decode (1..0x100) that lands exactly
on the call byte, then decode the preceding 0x30 bytes from that anchor.
"""
import hashlib
from pathlib import Path

import capstone

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000

data = EXE.read_bytes()
assert hashlib.sha256(data).hexdigest() == EXE_SHA
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)


def anchored_window(va, back=0x40):
    """Earliest start s in [va-back, va) such that linear decode lands exactly on va."""
    best = None
    for s in range(va - back, va):
        addr = s
        ok = False
        for ins in md.disasm(data[s - BASE:va + 5 - BASE], s):
            if ins.address == va:
                ok = True
                break
            if ins.address > va:
                break
        if ok:
            best = s
            break
    return best


# 1. ret of 0x93CB27: scan body for C2/C3 (first occurrences after 0x93CB27)
va = 0x93CB27
rets = []
for off in range(va - BASE, va - BASE + 0x260):
    if data[off] == 0xC2:
        rets.append((BASE + off, f"ret 0x{int.from_bytes(data[off+1:off+3], 'little'):x}"))
    elif data[off] == 0xC3:
        rets.append((BASE + off, "ret"))
print("0x93CB27 region ret opcodes (first 8):", rets[:8])

# 2. caller windows (anchored)
CALLERS = [0x93E00B, 0x959493, 0x959527, 0x964E16, 0x9651CC,
           0x965567, 0x98DC43, 0x990E21, 0x990E91]
for c in CALLERS:
    anchor = anchored_window(c, 0x60)
    print(f"\n=== caller 0x{c:08X} (anchor 0x{anchor:08X}) ===")
    if anchor is None:
        print("  no clean anchor found in 0x60 window")
        continue
    for ins in md.disasm(data[anchor - BASE:c + 5 - BASE], anchor):
        print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")
