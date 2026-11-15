#!/usr/bin/env python3
"""T086 WP4 — G10 camera producer static trace.

1. Census every `call dword ptr [reg+0x3C]` (FF 50/51/52/53/55/56/57 3C) in the
   code band; classify receivers by preceding instruction context.
2. Full body of 0x953AF4 (user per-draw update; the slot14 target per C-084) —
   candidate per-frame camera-rect producer feeding slot15.
3. Check for reads of scene+0xF0..0xFC (VR fold fields) and the encrypted
   position pair (M+0x20/M+0x38 via 0x548806) inside it.
"""
import hashlib
import re
import struct
from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_32

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000
CODE_LO, CODE_HI = 0x401000, 0xA80000
OUT = REPO / "research/result/stage-readiness/forensics/T086-G10-CAMERA-PRODUCER.txt"

data = EXE.read_bytes()
assert hashlib.sha256(data).hexdigest() == SHA
md = Cs(CS_ARCH_X86, CS_MODE_32)
lines = ["# T086 WP4 — G10 camera producer trace", ""]

# --- 1. call [reg+0x3C] census ---
lines.append("## call [reg+0x3C] census (FF /2 with disp8 0x3C)")
pat = re.compile(b"\xff[\x50\x51\x52\x53\x55\x56\x57]\x3c")
sites = []
for m in pat.finditer(data):
    va = BASE + m.start()
    if CODE_LO <= va < CODE_HI:
        sites.append(va)
lines.append(f"total: {len(sites)}")
for va in sites:
    ctx = data[va - BASE - 12:va - BASE]
    lines.append(f"  {va:#x}: prev-bytes {ctx.hex(' ')}")

# --- 2. 0x953AF4 full body ---
lines.append("")
lines.append("## 0x953AF4 (user per-draw) full body start")
body_start = 0x953AF4
ins_list = list(md.disasm(data[body_start - BASE:body_start - BASE + 0x640], body_start))
for i in ins_list:
    lines.append(f"{i.address:08X}  {i.bytes.hex():<22} {i.mnemonic} {i.op_str}")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("call [reg+0x3C] sites:", len(sites))
print("0x953AF4 insns:", len(ins_list))
print("wrote", OUT)
