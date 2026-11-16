"""T090 WP2-A: full static decode of Shape2D.dll 0x514086B3 (vtable slot +0x9C
of the vector-family tables 0x5140C2F0 / 0x5140C0FC).

Establishes: function boundary, ret imm (ABI), all field writes, the clamps,
the VARIANT gate, collection resolution, and the difference vs +0x90 (Set) and
+0x98 (parallax attach). Then censuses EXE-side call sites.
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

print("=== Shape2D 0x514086B3 full body ===")
for ins in md.disasm(shape[0x514086B3 - SBASE:0x514086B3 - SBASE + 0x1E0], 0x514086B3):
    print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")
    if ins.mnemonic == "ret":
        break

print("\n=== vtable slot check ===")
for tbl in (0x5140C2F0, 0x5140C0FC):
    off = tbl - SBASE
    slots = {}
    for i in range(0x50):
        v = struct.unpack("<I", shape[off + i * 4:off + i * 4 + 4])[0]
        slots[i * 4] = v
    print(f"table {tbl:#x}: +0x90={slots[0x90]:#x} +0x94={slots[0x94]:#x} "
          f"+0x98={slots[0x98]:#x} +0x9C={slots[0x9C]:#x} +0xA0={slots[0xA0]:#x}")

print("\n=== EXE call [reg+0x9C] census (all modrm forms incl. SIB) ===")
sites = []
for off in range(CODE_LO - BASE, CODE_HI - BASE - 8):
    if exe[off] != 0xFF:
        continue
    modrm = exe[off + 1]
    if (modrm >> 3) & 7 != 2:
        continue
    mod = modrm >> 6
    rm = modrm & 7
    d = None
    try:
        if rm == 4:  # SIB
            sib = exe[off + 2]
            if mod == 1:
                d = struct.unpack("<b", exe[off + 3:off + 4])[0]
            elif mod == 2:
                d = struct.unpack("<i", exe[off + 2:off + 6])[0]
        elif mod == 1:
            d = struct.unpack("<b", exe[off + 2:off + 3])[0]
        elif mod == 2:
            d = struct.unpack("<i", exe[off + 2:off + 6])[0]
    except struct.error:
        continue
    if d == 0x9C:
        sites.append(BASE + off)
print(f"sites: {len(sites)}: {[hex(s) for s in sites]}")
