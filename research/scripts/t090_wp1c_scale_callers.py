"""T090 WP1-C part 6:
1. Decode Gr2D 0x504027BB (the scale coercion) and find who calls the
   accumulator 0x5040B9DE (what VARIANT arrives as [ebp+0x10]).
2. Resolve namespace ids seen in the portal reader: 0x5FF 0x600 0xD86 0xF50.
"""
import hashlib
import struct
from pathlib import Path

import capstone

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
GR2D = REPO / ".work/task-063/client-stage/Gr2D_DX8.dll"
GR2D_SHA = "ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1"
BASE = 0x400000
G2BASE = 0x50400000

exe = EXE.read_bytes()
assert hashlib.sha256(exe).hexdigest() == EXE_SHA
gr2d = GR2D.read_bytes()
assert hashlib.sha256(gr2d).hexdigest() == GR2D_SHA
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)


def disas(data, base, start, n, title):
    print(f"=== {title} {start:#x} ===")
    for ins in md.disasm(data[start - base:start - base + n], start):
        print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")


disas(gr2d, G2BASE, 0x504027BB, 0x80, "Gr2D 0x504027BB (scale coercion)")
print()
# E8 callers of 0x5040B9DE in Gr2D
target = 0x5040B9DE
callers = []
for off in range(0x1000, 0x2C10C):
    if gr2d[off] == 0xE8:
        rel = int.from_bytes(gr2d[off + 1:off + 5], "little", signed=True)
        if G2BASE + off + 5 + rel == target:
            callers.append(G2BASE + off)
print(f"E8 callers of 0x5040B9DE in Gr2D .text: {[hex(c) for c in callers]}")
for c in callers:
    disas(gr2d, G2BASE, c - 0x40, 0x45, f"caller window of {c:#x}")

# namespace ids
def _decrypt_id(data, sid):
    def u32(va):
        return struct.unpack("<I", data[va - BASE:va - BASE + 4])[0]

    def rot_bytes(arr, n):
        ln = len(arr)
        n %= ln
        return arr[n:] + arr[:n]

    def rot_bits(arr, shift):
        ln = len(arr)
        if ln == 0 or shift % 8 == 0:
            return arr[:]
        val = int.from_bytes(arr, "big")
        val = ((val << shift) | (val >> (ln * 8 - shift))) & ((1 << (ln * 8)) - 1)
        return val.to_bytes(ln, "big")

    keyva = 0xB07640
    rec = u32(0xBA7B04 + sid * 4)
    off = rec - BASE
    if off < 0 or off + 130 > len(data):
        return b"<no-record>"
    rtype = data[off]
    cipher = data[off + 1:off + 128].split(b"\0")[0]
    key_len = u32(keyva + 0x10)
    key = bytearray(data[keyva - BASE:keyva - BASE + key_len])
    if rtype:
        if rtype >= 8:
            key = bytearray(rot_bytes(bytes(key), (rtype // 8) % key_len))
        shift = rtype & 7
        if shift:
            key = bytearray(rot_bits(bytes(key), shift))
    out = bytearray()
    for i, c in enumerate(cipher):
        p = c ^ key[i % len(key)]
        if p == 0:
            p = key[i % len(key)]
        out.append(p)
    return bytes(out)


print("\n=== namespace id names ===")
for sid in (0x5FF, 0x600, 0x601, 0x602, 0x603, 0x656, 0xD86, 0xF50, 0x155D, 0x8D4):
    print(f"0x{sid:X} = {_decrypt_id(exe, sid)}")
