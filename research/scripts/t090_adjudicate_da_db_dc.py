"""T090 adjudication of blind-reviewer disagreements D-A/D-B/D-C.

D-A: are there really 3 push-180 (0xB4) delay-default sites?
D-B: how many of the 18 push-120 sites use the imm8 form (6A 78) vs imm32?
D-C: 0x959493's arg3 = [ebp+0x20] of its containing function — zero or object?
"""
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

# D-A: bytes before the three 180 sites
print("=== D-A: seeds before the claimed 180 sites ===")
for va in (0x40EE4B, 0x40F595, 0x410832):
    off = va - BASE
    print(f"{va:#x}: {exe[off-16:off+5].hex(' ')}")

# D-B: form census of the 18 push-120 sites
print("\n=== D-B: push-120 encoding forms ===")
S120 = [0x40BD68, 0x40CC44, 0x40DB86, 0x40E29A, 0x4110EC, 0x41457A, 0x43EC81,
        0x48A2F5, 0x48D0CB, 0x4CBD08, 0x4CBDF9, 0x651365, 0x66ABCD, 0x875013,
        0x89F581, 0x987581, 0x988B20, 0x9892D9]
imm8 = imm32 = 0
for va in S120:
    off = va - BASE
    window = exe[off - 8:off]
    if b"\x6a\x78" in window:
        imm8 += 1
    elif b"\x68\x78\x00\x00\x00" in window:
        imm32 += 1
    else:
        print(f"  {va:#x}: NEITHER form in 8-byte window: {window.hex(' ')}")
print(f"imm8 (6A 78): {imm8} | imm32 (68 78 00 00 00): {imm32}")

# D-C: containing function of 0x959493 and [ebp+0x20] provenance
print("\n=== D-C: containing function of 0x959493 ===")


def find_head(va, back=0x6000):
    cands = []
    for s in range(va - back, va):
        b = exe[s - BASE:s - BASE + 6]
        if len(b) >= 6 and b[0] == 0xB8 and b[5] == 0xE8:
            rel = struct.unpack("<i", exe[s - BASE + 6:s - BASE + 10])[0]
            if s + 10 + rel == 0xA6FC7C:
                cands.append(s)
    return cands[-1] if cands else None


head = find_head(0x959493)
print(f"head = {head and hex(head)}")
if head:
    fn = list(md.disasm(exe[head - BASE:0x959493 - BASE], head))
    # where does [ebp+0x20] come from? it's an incoming stack arg; find push
    # count at the head to determine arg index, then look for E8 callers of head
    n = 0
    for ins in fn[:0x60]:
        if ins.mnemonic == "push" and ins.op_str in ("ebx", "esi", "edi", "ebp"):
            n += 1
    print(f"(function prologue pushes: {n})")
    # E8 callers of head
    callers = []
    for off in range(0x401000 - BASE, 0xBEA000 - BASE - 5):
        if exe[off] == 0xE8:
            rel = int.from_bytes(exe[off + 1:off + 5], "little", signed=True)
            if BASE + off + 5 + rel == head:
                callers.append(BASE + off)
    print("E8 callers of " + hex(head) + ": " + str(len(callers)) + ": " + str([hex(c) for c in callers[:8]]))
    for c in callers[:3]:
        ins_list = list(md.disasm(exe[c - 0x30 - BASE:c + 5 - BASE], c - 0x30))
        print(f"--- caller {c:#x} window ---")
        for ins in ins_list[-14:]:
            print(f"  {ins.address:08X}  {ins.mnemonic} {ins.op_str}")
