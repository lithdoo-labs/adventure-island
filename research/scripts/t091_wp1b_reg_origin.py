"""T091 WP1-B part 2: register-origin proof for the unproven arg7 registers at
callers 0x976409 (ebx), 0x9767ba (esi), 0x9768db (esi), 0x97a449 (edi),
0x97a559 (edi). For each, locate the containing function head (SEH prologue or
prologue scan) and search the head..call range for writes to the register.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from t091_lib import (CODE_LO, EXE_BYTES, BASE, anchored_at, disasm, e8_callers,
                      find_func_head, fmt, read)  # noqa: E402
import struct  # noqa: E402

CASES = {
    0x976409: ("ebx", 0x976300),
    0x9767ba: ("esi", 0x976600),
    0x9768db: ("esi", 0x976600),
    0x97A449: ("edi", 0x97A300),
    0x97A559: ("edi", 0x97A500),
}


def scan_writes(lo, hi, reg):
    """Find instructions writing reg (mov reg,x / xor / lea / pop) in [lo,hi)."""
    out = []
    img = EXE_BYTES
    for va in range(lo, hi):
        b = img[va - BASE:va - BASE + 3]
        if not b or len(b) < 2:
            continue
        # xor reg,reg = 31/33 + c0+reg*8+reg
        codes = {"eax": 0, "ecx": 1, "edx": 2, "ebx": 3, "esp": 4, "ebp": 5, "esi": 6, "edi": 7}
        r = codes[reg]
        # 31 F8+r*9 pattern: 33 c0+r*9 for xor reg,reg
        if b[0] in (0x31, 0x33) and b[1] == 0xC0 + r * 9:
            out.append((va, f"xor {reg}, {reg}"))
            continue
        # 89 /r with reg field == r and rm != r → mov reg, src (mod=11)
        if b[0] == 0x89 and ((b[1] >> 3) & 7) == r and (b[1] & 0xC0) == 0xC0 and (b[1] & 7) != r:
            out.append((va, "mov reg,r (89)"))
            continue
        # 8B /r with rm == r, mod=11, reg != r → mov reg, src
        if b[0] == 0x8B and (b[1] & 7) == r and (b[1] & 0xC0) == 0xC0 and ((b[1] >> 3) & 7) != r:
            out.append((va, "mov r,rm (8B)"))
            continue
        # B8+r imm32
        if b[0] == 0xB8 + r:
            out.append((va, "mov reg, imm32"))
            continue
        # pop reg = 58+r
        if b[0] == 0x58 + r:
            out.append((va, f"pop {reg}"))
            continue
        # lea r, m = 8D /r reg==r mod!=11
        if b[0] == 0x8D and ((b[1] >> 3) & 7) == r and (b[1] & 0xC0) != 0xC0:
            out.append((va, "lea reg, m"))
            continue
    return out


if __name__ == "__main__":
    for caller, (reg, lo) in CASES.items():
        head = find_func_head(caller, back=0x3000)
        print(f"=== caller {caller:#x} arg7 reg={reg} head={head and hex(head)} ===")
        start = head if head else lo
        writes = scan_writes(start, caller, reg)
        for va, what in writes[-12:]:
            print(f"  {va:08X}  {what}")
        print()
