"""T090 WP4-A: identify the arg3 objects at the object-passing focus-writer
callers (0x5C0342 esi; 0x990E21/0x990E91 esi; 0x959493 [ebp+0x20]) —
containing-function heads + register init + the [[arg3]+0x14] writer census
(write [reg+0x14] sites whose object feeds these callers)."""
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


def anchored(va, back=0x50):
    for s in range(va - back, va):
        ins_list = list(md.disasm(exe[s - BASE:va - BASE + 6], s))
        if ins_list and ins_list[-1].address == va:
            return ins_list
    return []


def find_head(va, back=0x5000):
    cands = []
    for s in range(va - back, va):
        b = exe[s - BASE:s - BASE + 6]
        if len(b) >= 6 and b[0] == 0xB8 and b[5] == 0xE8:
            rel = struct.unpack("<i", exe[s - BASE + 6:s - BASE + 10])[0]
            tgt = s + 10 + rel
            cands.append((s, tgt))
    seh = [s for s, t in cands if t == 0xA6FC7C]
    return seh[-1] if seh else None


# 0x990E21/0x990E91: esi init in the containing function
head = find_head(0x990E91)
print(f"containing function of 0x990E21/0x990E91: head = {head and hex(head)}")
if head:
    # find esi initialization and [esi+0x14] / [ebx+0x14] style writes
    for ins in md.disasm(exe[head - BASE:0x990E91 - BASE], head):
        if ins.mnemonic in ("mov", "lea", "xor") and (", esi" in ins.op_str or "esi, " in ins.op_str):
            if ins.mnemonic == "xor" and ins.op_str == "esi, esi":
                print(f"  {ins.address:08X}  {ins.mnemonic} {ins.op_str}")
            elif ins.mnemonic == "mov" and ins.op_str.startswith("esi,"):
                print(f"  {ins.address:08X}  {ins.mnemonic} {ins.op_str}")
        if "+ 0x14]" in ins.op_str and ins.mnemonic == "mov" and ins.op_str.split(",")[0].strip().startswith("[e"):
            # writes into +0x14 fields
            tgt = ins.op_str.split(",")[1].strip()
            if tgt in ("esi", "ebx", "eax", "edi", "ecx", "edx"):
                pass  # too noisy; only print near our heads
    print()

# esi init specifically
print("esi/xor inits in head window:")
if head:
    seen = 0
    for ins in md.disasm(exe[head - BASE:head - BASE + 0x150], head):
        if "esi" in ins.op_str and ins.mnemonic in ("xor", "mov", "lea"):
            print(f"  {ins.address:08X}  {ins.mnemonic} {ins.op_str}")
            seen += 1
        if seen > 10:
            break
