"""T090 WP4-B part 4: wrapper ctor 0x514072CF (does it alias Vector2D X/Y?) +
EXE census of call [reg+0x84] (the tick-advance slot) and +0x80."""
import hashlib
import struct
from pathlib import Path

import capstone

REPO = Path(__file__).resolve().parents[2]
SHAPE = REPO / ".work/task-063/client-stage/Shape2D.dll"
SHAPE_SHA = "9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b"
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
SBASE = 0x51400000
BASE = 0x400000
CODE_LO, CODE_HI = 0x401000, 0xBEA000

shape = SHAPE.read_bytes()
assert hashlib.sha256(shape).hexdigest() == SHAPE_SHA
exe = EXE.read_bytes()
assert hashlib.sha256(exe).hexdigest() == EXE_SHA
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)

print("=== Shape2D 0x514072CF (position wrapper ctor) ===")
for ins in md.disasm(shape[0x514072CF - SBASE:0x514072CF - SBASE + 0x90], 0x514072CF):
    print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")


def call_sites(data, base, lo, hi, disp):
    sites = []
    for off in range(lo - base, hi - base - 8):
        if data[off] != 0xFF:
            continue
        modrm = data[off + 1]
        if (modrm >> 3) & 7 != 2:
            continue
        mod = modrm >> 6
        rm = modrm & 7
        d = None
        try:
            if rm == 4:
                if mod == 1:
                    d = struct.unpack("<b", data[off + 3:off + 4])[0]
                elif mod == 2:
                    d = struct.unpack("<i", data[off + 2:off + 6])[0]
            elif mod == 1:
                d = struct.unpack("<b", data[off + 2:off + 3])[0]
            elif mod == 2:
                d = struct.unpack("<i", data[off + 2:off + 6])[0]
        except struct.error:
            continue
        if d == disp:
            sites.append(base + off)
    return sites


for disp, name in ((0x84, "tick-advance +0x84"), (0x80, "slot +0x80"), (0x88, "slot +0x88")):
    s = call_sites(exe, BASE, CODE_LO, CODE_HI, disp)
    print(f"\nEXE call [reg+{name:#x}] sites: {len(s)}: {[hex(x) for x in s][:24]}")
