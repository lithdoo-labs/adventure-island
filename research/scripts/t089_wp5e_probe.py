#!/usr/bin/env python3
"""T089 WP5e - find the function containing the 0x43781F Set + 0x43787D filter arm."""
import hashlib
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000

h = hashlib.sha256(EXE.read_bytes()).hexdigest()
assert h == SHA, h
d = EXE.read_bytes()
for va in range(0x437200, 0x437800):
    off = va - BASE
    if d[off] == 0xB8 and d[off + 5] == 0xE8:
        imm = struct.unpack("<I", d[off + 1:off + 5])[0]
        print(f"SEH prolog at {va:#x}: mov eax, {imm:#x}")
    if d[off:off + 3] == b"\x55\x8b\xec":
        print(f"ebp prolog at {va:#x}")
