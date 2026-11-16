"""T091 member census v2: all EXE instructions in the code band with a memory
operand [reg+disp32] where disp32 == the given offset. Anchored per-site decode.
"""
import struct
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from t091_lib import BASE, CODE_HI, CODE_LO, EXE_BYTES  # noqa: E402
import capstone  # noqa: E402

MD = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)


def census(offset: int):
    pat = offset.to_bytes(4, "little")
    img = EXE_BYTES
    hits = []
    pos = CODE_LO - BASE
    end = CODE_HI - BASE
    while True:
        i = img.find(pat, pos, end)
        if i < 0:
            break
        va = BASE + i
        for back in range(0, 8):
            s = va - back
            if s < CODE_LO:
                break
            ins = None
            for cand in MD.disasm(img[s - BASE:va + 4 - BASE + 2], s):
                if cand.address <= va and cand.address + cand.size >= va + 4:
                    ins = cand
                elif cand.address > va:
                    break
            if ins is not None:
                hits.append(ins)
                break
        pos = i + 1
    return hits


def classify(ins):
    ops = ins.op_str
    first = ops.split(",")[0].strip()
    second = ops.split(",", 1)[1].strip() if "," in ops else ""
    if ins.mnemonic in ("mov",):
        if first.startswith("["):
            return "WRITE"
        return "READ"
    if ins.mnemonic == "cmp":
        return "CMP"
    if ins.mnemonic == "lea":
        return "LEA"
    return ins.mnemonic.upper()


if __name__ == "__main__":
    off = int(sys.argv[1], 16)
    hits = census(off)
    cc = Counter()
    for ins in hits:
        k = classify(ins)
        cc[k] += 1
        print(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}   [{k}]")
    print("counts:", dict(cc))
