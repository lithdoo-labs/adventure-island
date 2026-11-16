"""T091 write-census for a member offset: find instructions writing to
[reg+off] (mov forms) in a VA band, with anchored verification."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from t091_lib import BASE, CODE_HI, CODE_LO, EXE_BYTES, anchored_at, fmt  # noqa: E402

# opcode map for /r forms with disp32: op + modrm(mod=10) + sib? + disp32
MOV_OPS = {0x89: "mov", 0xC7: "mov-imm", 0x8B: "mov-read", 0x8D: "lea",
           0x8A: "mov-r8", 0x88: "mov-r8"}


def writes(off: int, lo: int, hi: int):
    pat = off.to_bytes(4, "little")
    img = EXE_BYTES
    out = []
    pos = lo - BASE
    while True:
        i = img.find(pat, pos, hi - BASE)
        if i < 0:
            break
        va = BASE + i
        # candidate instruction starts within 6 bytes before disp
        for back in range(1, 7):
            s = va - back
            if s < CODE_LO:
                continue
            ins = None
            from capstone import Cs, CS_ARCH_X86, CS_MODE_32
            md = Cs(CS_ARCH_X86, CS_MODE_32)
            for cand in md.disasm(img[s - BASE:va + 4 - BASE + 4], s):
                if cand.address <= va - back and cand.address + cand.size >= va + 4:
                    ins = cand
                elif cand.address > va:
                    break
            if ins is not None and (f"+ 0x{off:x}]" in ins.op_str or f"+ 0x{off:X}]" in ins.op_str):
                out.append(ins)
                break
        pos = i + 1
    return out


if __name__ == "__main__":
    off = int(sys.argv[1], 16)
    lo = int(sys.argv[2], 16)
    hi = int(sys.argv[3], 16)
    want = sys.argv[4] if len(sys.argv) > 4 else "mov"
    for ins in writes(off, lo, hi):
        first = ins.op_str.split(",")[0].strip()
        is_write = ins.mnemonic in ("mov",) and ("ptr [" in first or first.startswith("["))
        if want == "all" or (want == "mov" and is_write) or (want == ins.mnemonic):
            print(fmt(ins))
