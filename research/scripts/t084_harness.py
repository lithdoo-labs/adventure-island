#!/usr/bin/env python3
"""T084 static-forensics harness: capstone-based window disasm + xref scanning
for the CMS079 unpacked EXE image (linear model: fileOffset = VA - 0x400000).

Every exported function verifies the source SHA-256 before reading.

Usage (library):
    from t084_harness import H
    H.dis(0x9BCA6F, 0x60)          # print window
    H.xrefs_to(0x9BC622)           # direct E8 rel32 callers
    H.dword(0xB0CB70)              # read dword
    H.find_call_base()             # opcode dispatch base scan helpers etc.

Usage (CLI):
    python t084_harness.py dis <va> <size>
    python t084_harness.py xrefs <va>
    python t084_harness.py dword <va> [count]
    python t084_harness.py imm32 <value>       # find push imm32 / cmp imm32 sites
    python t084_harness.py bytes <va> <size>   # hex dump
"""
import hashlib
import os
import struct
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
EXE = os.path.join(_REPO_ROOT, ".work", "task-036", "game-image-unpacked.bin")
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000

_data = None
_md = Cs(CS_ARCH_X86, CS_MODE_32)


def data() -> bytes:
    global _data
    if _data is None:
        h = hashlib.sha256()
        with open(EXE, "rb") as f:
            blob = f.read()
        h.update(blob)
        digest = h.hexdigest()
        if digest != SHA:
            raise RuntimeError(f"sha256 mismatch {digest}")
        _data = blob
    return _data


def off(va: int) -> int:
    o = va - BASE
    if o < 0 or o >= len(data()):
        raise ValueError(f"VA {va:#x} out of range")
    return o


def dis(va: int, size: int, stop_ret: bool = False) -> list:
    """Disassemble [va, va+size). If stop_ret, stop at first ret/ret imm after
    at least one instruction (useful for small leaf functions)."""
    blob = data()[off(va):off(va) + size]
    out = []
    for ins in _md.disasm(blob, va):
        out.append(ins)
        if stop_ret and ins.mnemonic in ("ret", "retn") or (stop_ret and ins.mnemonic.startswith("ret")):
            break
    return out


def print_dis(va: int, size: int, stop_ret: bool = False):
    for ins in dis(va, size, stop_ret):
        print(f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}")


def dword(va: int) -> int:
    return struct.unpack_from("<I", data(), off(va))[0]


def words(va: int, count: int):
    return [dword(va + 4 * i) for i in range(count)]


def hexdump(va: int, size: int):
    blob = data()[off(va):off(va) + size]
    for i in range(0, len(blob), 16):
        print(f"{va + i:08X}  {blob[i:i + 16].hex(' ')}")


def xrefs_to(target: int, scan_start: int = 0x401000, scan_end: int = None) -> list:
    """All direct E8 rel32 call sites whose destination == target.
    Default scan end = end of the image's code payload (full linear dump)."""
    if scan_end is None:
        scan_end = BASE + len(data()) - 8
    d = data()
    res = []
    tgt_bytes_rel = None
    for i in range(off(scan_start), min(off(scan_end), len(d) - 5)):
        if d[i] == 0xE8:
            rel = struct.unpack_from("<i", d, i + 1)[0]
            dest = BASE + i + 5 + rel
            if dest == target:
                res.append(BASE + i)
    return res


def imm32_sites(value: int, scan_start: int = 0x401000, scan_end: int = None) -> list:
    """Locations where the 4-byte little-endian `value` appears in code range,
    with two bytes of preceding context (opcode + modrm/other)."""
    d = data()
    if scan_end is None:
        scan_end = BASE + len(data()) - 8
    needle = struct.pack("<I", value)
    res = []
    start = off(scan_start)
    end = min(off(scan_end), len(d) - 4)
    i = start
    while True:
        j = d.find(needle, i, end)
        if j < 0:
            break
        res.append((BASE + j, d[j - 1], d[j - 2] if j >= 2 else -1))
        i = j + 1
    return res


def rel_jmp_table(va: int, count: int, base: int = None):
    """Read a jump table of rel32 offsets at `va` (jmp [eax*4+va] style:
    entries are absolute targets)."""
    return words(va, count)


def scan_pattern(pattern: bytes, scan_start: int = 0x401000, scan_end: int = None) -> list:
    d = data()
    if scan_end is None:
        scan_end = BASE + len(data()) - 8
    res = []
    i = off(scan_start)
    end = min(off(scan_end), len(d) - len(pattern))
    while True:
        j = d.find(pattern, i, end)
        if j < 0:
            break
        res.append(BASE + j)
        i = j + 1
    return res


def function_start(va: int, max_back: int = 0x2000) -> int:
    """Heuristic: scan backwards for a standard prologue preceded by padding
    (CC/int3) or a ret. Returns candidate start VA."""
    d = data()
    o = off(va)
    for back in range(0, max_back):
        s = o - back
        if s < 1:
            break
        # prologues: 55 8B EC (push ebp; mov ebp,esp) / 53 / 56 / 57 + 8B FC etc.
        if d[s] == 0x55 and d[s + 1] == 0x8B and d[s + 2] == 0xEC:
            prev = d[s - 1]
            if prev in (0xC3, 0xCC, 0x90, 0xC2) or d[s - 2:s] == b"\xc2" or d[s-3:s] and d[s-3] == 0xC2:
                return BASE + s
    return None


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "dis":
        print_dis(int(sys.argv[2], 0), int(sys.argv[3], 0))
    elif cmd == "xrefs":
        for a in xrefs_to(int(sys.argv[2], 0)):
            print(f"{a:08X}")
    elif cmd == "dword":
        va = int(sys.argv[2], 0)
        n = int(sys.argv[3], 0) if len(sys.argv) > 3 else 1
        for i, w in enumerate(words(va, n)):
            print(f"[{va + 4 * i:08X}] = {w:08X}")
    elif cmd == "imm32":
        for a, prev, op in imm32_sites(int(sys.argv[2], 0)):
            print(f"{a:08X}  prev={prev:02X} op={op:02X}")
    elif cmd == "bytes":
        hexdump(int(sys.argv[2], 0), int(sys.argv[3], 0))
