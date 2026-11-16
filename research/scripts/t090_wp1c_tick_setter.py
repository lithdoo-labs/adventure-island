"""T090 WP1-C part 11: census `call [reg+0x5C]` (the global-tick SETTER slot) in
the EXE to determine who advances the Shape2D tick and from what clock."""
import hashlib
import struct
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

sites = []
for off in range(CODE_LO - BASE, CODE_HI - BASE - 6):
    if exe[off] != 0xFF:
        continue
    modrm = exe[off + 1]
    if (modrm >> 3) & 7 != 2 or (modrm & 7) == 4:  # /2 call, skip SIB for now
        continue
    mod = modrm >> 6
    if mod == 1:
        d = struct.unpack("<b", exe[off + 2:off + 3])[0]
        if d == 0x5C:
            sites.append(BASE + off)
    elif mod == 2:
        d = struct.unpack("<i", exe[off + 2:off + 6])[0]
        if d == 0x5C:
            sites.append(BASE + off)
    elif mod == 0 and (modrm & 7) == 5:
        d = struct.unpack("<i", exe[off + 2:off + 6])[0]
        tgt = BASE + off + 6 + d
        if tgt == 0x514076E8:  # absolute call [0x514076E8]-style is not real here
            sites.append(BASE + off)

print(f"call [reg+0x5C] sites: {len(sites)}")
for s in sites:
    # decode a window before the site for context
    anchor = None
    for st in range(s - 0x30, s):
        ok = False
        for ins in md.disasm(exe[st - BASE:s - BASE], st):
            pass
        ins_list = list(md.disasm(exe[st - BASE:s - BASE + 6], st))
        if ins_list and ins_list[-1].address <= s and ins_list[-1].address + ins_list[-1].size >= s:
            # decode through the call
            full = list(md.disasm(exe[st - BASE:s - BASE + 6], st))
            if full and full[-1].address == s:
                anchor = st
                break
    print(f"\n--- {s:#x} (anchor {anchor and hex(anchor)}) ---")
    if anchor:
        for ins in md.disasm(exe[anchor - BASE:s - BASE + 6], anchor):
            print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")
