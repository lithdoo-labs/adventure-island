"""debug default_of_site on known site 0x43EC81."""
import hashlib
from pathlib import Path

import capstone

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
BASE = 0x400000
exe = EXE.read_bytes()
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
md.detail = True

site = 0x43EC81
for s in range(site - 0x30, site):
    ins_list = list(md.disasm(exe[s - BASE:site - BASE], s))
    if ins_list and ins_list[-1].address + ins_list[-1].size == site:
        print(f"anchor {s:#x}:")
        for ins in ins_list:
            print(f"  {ins.address:08X} {ins.mnemonic} {ins.op_str}")
        break
else:
    print("no anchor found in 0x30 window")
    # show raw attempts
    for s in (site - 8, site - 2, site - 1):
        ins_list = list(md.disasm(exe[s - BASE:site - BASE], s))
        print(f"--- try {s:#x}: {[(i.mnemonic, i.op_str) for i in ins_list][-3:]}")
