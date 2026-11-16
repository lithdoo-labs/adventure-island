"""T090 WP4-B: camera-filter consumer path.
1. EXE census of `call [reg+0xA4]` (filter QUERY slot +0xA4) — who reads the
   filtered coordinate and what do they do with it?
2. Shape2D: the pending-list walker that applies records committed via
   0x5140833B (Set-interp / parallax / filter records) — where does output go?
"""
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


print("=== EXE call [reg+0xA4] (filter QUERY) sites ===")
q = call_sites(exe, BASE, CODE_LO, CODE_HI, 0xA4)
print(len(q), [hex(s) for s in q])

print("\n=== EXE call [reg+0xA8] (filter COMMIT) sites (re-verify 3) ===")
c = call_sites(exe, BASE, CODE_LO, CODE_HI, 0xA8)
print(len(c), [hex(s) for s in c])

print("\n=== Shape2D: slot +0xA4 body 0x51408BED (query) ===")
for ins in md.disasm(shape[0x51408BED - SBASE:0x51408BED - SBASE + 0xB0], 0x51408BED):
    print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")
    if ins.mnemonic == "ret":
        break
