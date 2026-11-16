"""T090 WP1-C part 7: confirm the 0x504027BB default path; find the vtable slot
of the accumulator 0x5040B9DE in Gr2D and census its EXE call sites."""
import hashlib
import re
import struct
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


def disas(data, base, start, n, title):
    print(f"=== {title} {start:#x} ===")
    for ins in md.disasm(data[start - base:start - base + n], start):
        print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")


disas(gr2d, G2BASE, 0x5040283D, 0x18, "0x504027BB default path (fast)")
print()

# vtable slot of 0x5040B9DE: find dwords in Gr2D equal to 0x5040B9DE
needle = struct.pack("<I", 0x5040B9DE)
hits = [i for i in range(0, len(gr2d) - 4) if gr2d[i:i + 4] == needle]
print(f"dword 0x5040B9DE occurrences in Gr2D: {[hex(G2BASE + h) for h in hits]}")
for h in hits:
    va = G2BASE + h
    # find table start: walk back while dwords point into .text (0x50401000..0x50402D10C)
    start = h
    while start > 0:
        prev = struct.unpack("<I", gr2d[start - 4:start])[0]
        if 0x50401000 <= prev <= 0x50402E000:
            start -= 4
        else:
            break
    end = h
    while end < len(gr2d) - 4:
        nxt = struct.unpack("<I", gr2d[end + 4:end + 8])[0]
        if 0x50401000 <= nxt <= 0x50402E000:
            end += 4
        else:
            break
    slot = (h - start) // 4
    print(f"  table {G2BASE + start:#x} .. {G2BASE + end:#x}: slot +{slot * 4:#x} (index {slot})")

# EXE call [reg+disp] census for each candidate slot offset
SLOTS = sorted({(h,) for h in hits})  # recompute inside
slot_disps = []
for h in hits:
    va = G2BASE + h
    start = h
    while start > 0:
        prev = struct.unpack("<I", gr2d[start - 4:start])[0]
        if 0x50401000 <= prev <= 0x50402E000:
            start -= 4
        else:
            break
    slot_disps.append((h - start))

for disp in set(slot_disps):
    print(f"\n--- EXE census: call [reg+{disp:#x}] (FF 90..97 /r + disp8/32) ---")
    count = 0
    sites = []
    for off in range(0x401000 - BASE, 0xBEA000 - BASE - 6):
        if exe[off] != 0xFF:
            continue
        modrm = exe[off + 1]
        if (modrm >> 3) & 7 != 2:  # /2 = call
            continue
        mod = modrm >> 6
        reg = (modrm >> 0) & 7
        if mod == 1 and reg != 4:  # disp8, no SIB
            d8 = struct.unpack("<b", exe[off + 2:off + 3])[0]
            if d8 == disp:
                sites.append((BASE + off, f"call [reg{reg}+{d8:#x}]"))
        elif mod == 2 and reg != 4:
            d32 = struct.unpack("<i", exe[off + 2:off + 6])[0]
            if d32 == disp:
                sites.append((BASE + off, f"call [reg{reg}+{d32:#x}]"))
    print(f"sites: {len(sites)}")
    for va, txt in sites[:20]:
        print(f"  {va:08X} {txt}")
