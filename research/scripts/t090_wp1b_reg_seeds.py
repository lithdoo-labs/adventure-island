"""T090 WP1-B part 2: resolve the 9 register-seeded delay defaults.
For each site: find the containing function head and the provable register
initialization (imm xor/mov) between head and site."""
import hashlib
import struct
from pathlib import Path

import capstone

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000

exe = EXE.read_bytes()
assert hashlib.sha256(exe).hexdigest() == EXE_SHA
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)

SITES = [
    (0x408D66, "eax"), (0x409C9C, "eax"), (0x45377E, "eax"),
    (0x6913CF, "edi"),
    (0x69834A, "ebx"), (0x6985F7, "ebx"), (0x71A72A, "ebx"), (0x76AF9B, "ebx"),
    (0x989C69, "ecx"),
]

REG_NUM = {"eax": 0, "ecx": 1, "edx": 2, "ebx": 3, "esp": 4, "ebp": 5, "esi": 6, "edi": 7}


def find_head(va, back=0x6000):
    """Latest SEH/plain prologue candidate below va (byte-pattern based)."""
    cands = []
    for s in range(va - back, va):
        b = exe[s - BASE:s - BASE + 6]
        if len(b) >= 6 and b[0] == 0xB8 and b[5] == 0xE8:
            # the SEH call target must be the canonical installer 0xA6FC7C family
            rel = struct.unpack("<i", b[1:b"placeholder" and 5][:0] + b[1:5] if False else b[6 - 5:6 - 5 + 4] if False else exe[s - BASE + 1:s - BASE + 5])[0]
            tgt = s + 5 + rel + 5 - 5  # call is at s+5, len 5
            tgt = (s + 5) + 5 + rel - 5
            cands.append((s, tgt))
        elif len(b) >= 3 and b[0] == 0x55 and b[1] == 0x8B and b[2] == 0xEC:
            cands.append((s, None))
    return cands


SEH_INSTALLERS = {0xA6FC7C, 0xA89CCC, 0xAB18DE}


def best_head(va):
    cands = find_head(va)
    seh = [s for s, t in cands if t in SEH_INSTALLERS]
    if seh:
        return seh[-1]
    plain = [s for s, t in cands if t is None]
    if plain:
        return plain[-1]
    return None


for site, reg in SITES:
    head = best_head(site)
    print(f"\n=== {site:#x} (push {reg}) head={head and hex(head)} ===")
    if head is None:
        print("  head not found")
        continue
    # scan raw bytes for register init patterns between head and site
    lo, hi = head - BASE, site - BASE
    r = REG_NUM[reg]
    inits = []
    i = lo
    while i < hi:
        b = exe[i:i + 5]
        if len(b) >= 2 and b[0] in (0x31, 0x33) and b[1] == (0xC0 | (r << 3) | r):
            inits.append((BASE + i, f"{reg} = 0 (xor {reg},{reg})"))
            i += 2
            continue
        if len(b) >= 5 and b[0] == (0xB8 + r):
            inits.append((BASE + i, f"{reg} = {struct.unpack('<i', b[1:5])[0]} (mov imm)"))
            i += 5
            continue
        i += 1
    for a, what in inits[-6:]:
        print(f"  {a:08X}: {what}")
    if not inits:
        print("  no imm/xor init found (register is a runtime value)")
