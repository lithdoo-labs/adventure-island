#!/usr/bin/env python3
"""T086 static census — indexed jump-table dispatch heads in the EXE image.

Finds `jmp dword ptr [reg*4 + imm32]` sites whose 32 preceding bytes contain a
bounds pattern (sub reg, imm / cmp reg, imm / mov reg, [..] + add), and reports
the recovered (base, count, table_va). Gives the static upper bound on
"switch-style opcode dispatchers" present as machine instructions.
"""
import hashlib
import re
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000
CODE_LO, CODE_HI = 0x401000, 0xA80000

# jmp dword ptr [reg*4 + disp32]: FF 24 85 disp / FF 24 8D / FF 24 95 / FF 24 9D / FF 24 A5 / FF 24 AD
# NOTE: byte 0x24 ('$') must sit inside a character class or re treats it as an anchor.
PAT = re.compile(b"\xff[\x24][" + bytes([0x85, 0x8D, 0x95, 0x9D, 0xA5, 0xAD]) + b"](....)", re.S)


def main() -> int:
    data = EXE.read_bytes()
    assert hashlib.sha256(data).hexdigest() == SHA, "sha mismatch"
    hits = []
    for m in PAT.finditer(data):
        va = BASE + m.start()
        if not (CODE_LO <= va < CODE_HI):
            continue
        disp = struct.unpack("<I", m.group(1))[0]
        if not (BASE <= disp < BASE + len(data)):
            continue
        hits.append((va, disp))
    print(f"indexed jmp heads in code band: {len(hits)}")
    for va, disp in hits:
        # look back up to 24 bytes for sub/cmp imm pattern
        ctx = data[va - BASE - 24:va - BASE]
        info = ""
        for i in range(len(ctx) - 5):
            op = ctx[i]
            if op in (0x2D, 0x3D):  # sub/cmp eax, imm32
                imm = struct.unpack("<I", ctx[i + 1:i + 5])[0]
                info = f"{'sub' if op==0x2D else 'cmp'} eax,{imm:#x}"
                break
            if op == 0x81 and ctx[i+1] in (0xE8, 0xF8):  # sub/cmp eax, imm32 alt
                imm = struct.unpack("<I", ctx[i + 2:i + 6])[0]
                info = f"{'sub' if ctx[i+1]==0xE8 else 'cmp'} eax,{imm:#x}"
                break
        # count table entries until non-code pointer
        n = 0
        t = disp
        while True:
            w = int.from_bytes(data[t - BASE + n * 4:t - BASE + n * 4 + 4], "little")
            if not (CODE_LO <= w < CODE_HI):
                break
            n += 1
            if n > 512:
                break
        print(f"  jmp@{va:#x} -> table@{disp:#x} entries={n}  {info}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
