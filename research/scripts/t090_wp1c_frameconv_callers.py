"""T090 WP1-C part 9: E8 caller census of the frame converter 0x43EC69 and the
tiler per-child read 0x66ABC5-containing function; check whether the portal
loaders (0x71B8xx/0x71BBxx) reach them."""
import hashlib
from pathlib import Path

import capstone

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000
CODE_LO, CODE_HI = 0x401000, 0xBEA000

exe = EXE.read_bytes()
assert hashlib.sha256(exe).hexdigest() == EXE_SHA
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)


def e8_callers(target):
    out = []
    for off in range(CODE_LO - BASE, CODE_HI - BASE - 5):
        if exe[off] == 0xE8:
            rel = int.from_bytes(exe[off + 1:off + 5], "little", signed=True)
            if BASE + off + 5 + rel == target:
                out.append(BASE + off)
    return out


for t in (0x43EC69, 0x427DE0, 0x43E3A6):
    cs = e8_callers(t)
    print(f"E8 callers of 0x{t:X}: {len(cs)}")
    for c in cs:
        print(f"   {c:08X}")

# Does the portal loader function call 0x43EC69 anywhere in 0x71A203..0x71C000?
print()
print("call 0x43EC69 / 0x427DE0 sites inside 0x71A000-0x71C000 (portal band):")
for t in (0x43EC69, 0x427DE0):
    for c in e8_callers(t):
        if 0x71A000 <= c <= 0x71C000:
            print(f"   0x{t:X} <- {c:08X}")
