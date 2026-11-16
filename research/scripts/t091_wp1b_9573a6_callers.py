"""T091 WP1-B: classify arg7 of all 14 E8 callers of 0x9573A6.

arg7 = [ebp+0x20] in the callee = the 7th stack arg = the FIRST value pushed
before `call 0x9573A6`. For each caller this script dumps the anchored window
and extracts the push sequence, tracking simple register init (xor r,r / mov r,x
/ push imm) in the preceding straight-line window.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from t091_lib import anchored_at, e8_callers, fmt, read  # noqa: E402

TARGET = 0x9573A6
CALLERS = e8_callers(TARGET)


def push_seq(caller, maxback=0x50):
    win = anchored_at(caller, maxback, 5)
    seq = []
    for ins in win:
        if ins.address == caller:
            break
        if ins.mnemonic == "push":
            seq.append((ins.address, ins.op_str))
    return seq, win


if __name__ == "__main__":
    for c in CALLERS:
        seq, win = push_seq(c)
        print(f"=== caller {c:#x} ===")
        for ins in win:
            if ins.address == c:
                break
            print("  " + fmt(ins))
        print(f"  pushes before call: {[o for _, o in seq]}")
        print()
