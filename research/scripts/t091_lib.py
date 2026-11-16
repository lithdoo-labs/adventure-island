"""T091 shared forensics helpers: sha-pinned EXE/Shape2D/Gr2D/PCOM loaders,
anchored linear disassembly, E8/XRef census, function-head finding.

All T091 round scripts import from this module. STATIC-ONLY.
"""
import hashlib
import struct
from pathlib import Path

import capstone

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
S2D = REPO / ".work/task-063/client-stage/Shape2D.dll"
S2D_SHA = "9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b"
GR2D = REPO / ".work/task-063/client-stage/Gr2D_DX8.dll"
GR2D_SHA = "ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1"
PCOM = REPO / ".work/task-063/client-stage/PCOM.dll"
PCOM_SHA = "cf3807f3107152d3b305bfc84be36d58b62306c94f60133c8e80fd17f9d9e54b"

BASE = 0x400000          # EXE image base (RVA == file offset image)
S2D_BASE = 0x51400000
CODE_LO, CODE_HI = 0x401000, 0xBEA000

_exe = EXE.read_bytes()
assert hashlib.sha256(_exe).hexdigest() == EXE_SHA, "EXE sha mismatch"
EXE_BYTES = _exe

_s2d = S2D.read_bytes()
assert hashlib.sha256(_s2d).hexdigest() == S2D_SHA, "Shape2D sha mismatch"
S2D_BYTES = _s2d

_md32 = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)


def read(va, n, image=None, base=BASE):
    img = image if image is not None else EXE_BYTES
    return img[va - base:va - base + n]


def u32(va, image=None, base=BASE):
    return struct.unpack("<I", read(va, 4, image, base))[0]


def disasm(va, n=0x60, image=None, base=BASE):
    """Linear decode of n bytes at va."""
    img = image if image is not None else EXE_BYTES
    return list(_md32.disasm(img[va - base:va - base + n], va))


def anchored(va, back=0x80, image=None, base=BASE):
    """Earliest start s in [va-back, va) whose linear decode lands exactly on va.
    Returns the decoded instruction list ending at (including) va."""
    img = image if image is not None else EXE_BYTES
    for s in range(va - back, va):
        for stop in range(va + 1, va + 8):
            ins_list = list(_md32.disasm(img[s - base:stop - base], s))
            if ins_list and ins_list[-1].address == va:
                return ins_list
    return []


def anchored_at(va, back=0x60, ahead=6, image=None, base=BASE):
    """Anchored window ending exactly at va, then continue decoding `ahead` bytes."""
    win = anchored(va, back, image, base)
    if not win:
        return []
    s = win[0].address
    img = image if image is not None else EXE_BYTES
    return list(_md32.disasm(img[s - base:va + ahead - base], s))


def e8_callers(target, lo=CODE_LO, hi=CODE_HI, image=None, base=BASE):
    """All E8 rel32 call sites to target inside [lo, hi)."""
    img = image if image is not None else EXE_BYTES
    out = []
    for va in range(lo, hi - 5):
        if img[va - base] == 0xE8:
            rel = struct.unpack("<i", img[va - base + 1:va - base + 5])[0]
            if va + 5 + rel == target:
                out.append(va)
    return out


def e9_jumps(target, lo=CODE_LO, hi=CODE_HI, image=None, base=BASE):
    img = image if image is not None else EXE_BYTES
    out = []
    for va in range(lo, hi - 5):
        if img[va - base] == 0xE9:
            rel = struct.unpack("<i", img[va - base + 1:va - base + 5])[0]
            if va + 5 + rel == target:
                out.append(va)
    return out


def find_func_head(va, back=0x6000):
    """Find the containing function head for va by scanning backwards for the
    MSVC 'mov eax, fs:[0]; ... push eax; call __SEH_prologue' idiom
    (B8 .. .. .. .. E8 -> 0xA6FC7C) or a plain push-ebp prologue that anchors."""
    cands = []
    for s in range(va - back, va):
        b = read(s, 6)
        if len(b) >= 6 and b[0] == 0xB8 and b[5] == 0xE8:
            rel = struct.unpack("<i", read(s + 6, 4))[0]
            tgt = s + 10 + rel
            cands.append((s, tgt))
    seh = [s for s, t in cands if t == 0xA6FC7C]
    if seh:
        return seh[-1]
    return None


def prev_pushes(va, image=None, base=BASE, maxback=0x40):
    """Decoded instruction window ending at va (the call), via anchored decode."""
    return anchored_at(va, maxback, 5, image, base)


def fmt(ins):
    return f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}"


def dump(va, n=0x60, image=None, base=BASE):
    return "\n".join(fmt(i) for i in disasm(va, n, image, base))
