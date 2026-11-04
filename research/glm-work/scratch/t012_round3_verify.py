"""Verify the round-3 transform hypothesis: probe_stop == f(T2) over
0x0085941A-0x0085FA3E. Candidates: single xor 0x61799419, or xor chains.
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE / "scripts"))
import maple079_probe_cfg as probe  # noqa: E402

ROOT = HERE.parent
wide = (ROOT / "glm-work" / "scratch" / "tailb-wide-at-probe.bin").read_bytes()
t2 = (ROOT / ".work" / "task-006" / "tail-b-nonzero.bin").read_bytes()[0x14:]
WBASE, TBASE = 0x819000, 0x819014

LO, HI = 0x85941A, 0x85FA3E


def word_at(buf, base, rva):
    return int.from_bytes(buf[rva - base : rva - base + 4], "little")


def check(name, f):
    ok = 0
    bad = None
    for rva in range(LO, HI, 4):
        src = word_at(t2, TBASE, rva)
        dst = word_at(wide, WBASE, rva)
        if f(src) == dst:
            ok += 1
        else:
            bad = (rva, hex(src), hex(dst), hex(f(src)))
            break
    total = (HI - LO) // 4
    print(f"{name}: {ok}/{total} dwords match", "" if bad is None else f"first mismatch {bad}")
    return ok == total


check("xor 0x61799419", lambda s: (s ^ 0x61799419) & 0xFFFFFFFF)
check("xor 0x2fdeec7e", lambda s: (s ^ 0x2FDEEC7E) & 0xFFFFFFFF)
check("xor both", lambda s: (s ^ 0x61799419 ^ 0x2FDEEC7E) & 0xFFFFFFFF)
check("xor then sub", lambda s: ((s ^ 0x61799419) - 0xEB0CF6) & 0xFFFFFFFF)
check("add 0x61799419", lambda s: (s + 0x61799419) & 0xFFFFFFFF)
