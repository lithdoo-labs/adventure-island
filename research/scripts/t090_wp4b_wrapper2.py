"""T090 WP4-B part 5: wrapper ctor body 0x51407340 (where do x/y land) + the
tick-slot census (fixed)."""
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

print("=== Shape2D 0x51407340 (wrapper object ctor, vtable 0x5140C8B4) ===")
for ins in md.disasm(shape[0x51407340 - SBASE:0x51407340 - SBASE + 0xC0], 0x51407340):
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


for disp in (0x84, 0x80, 0x88):
    s = call_sites(exe, BASE, CODE_LO, CODE_HI, disp)
    print(f"\nEXE call [reg+0x{disp:X}] sites: {len(s)}:", [hex(x) for x in s][:24])
