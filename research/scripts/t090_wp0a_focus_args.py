"""T090 WP0-A: independent re-verification of the focus-writer parameter layout.

Questions:
  1. 0x769B51 ret imm (how many stack args?) -> caller idiom arity
  2. 0x93CB27..0x93CD74: gates, known/unknown tag paths, Set source object
  3. 0x93CD77 getter body (+0x14 + AddRef)
  4. all 10 E8 callers of 0x93CB27: effective (record, N, arg3)
sha-pinned inputs; capstone linear decode from anchor starts.
"""
import hashlib
import re
import sys
from pathlib import Path

import capstone

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000
CODE_LO, CODE_HI = 0x401000, 0xBEA000

data = EXE.read_bytes()
h = hashlib.sha256(data).hexdigest()
assert h == EXE_SHA, f"sha mismatch {h}"
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
md.detail = False


def va2off(va):
    return va - BASE


def disas(va, n=32, count=200):
    """Decode n bytes at va."""
    out = []
    for ins in md.disasm(data[va2off(va):va2off(va) + n], va):
        out.append(f"{ins.address:08X}  {ins.mnemonic} {ins.op_str}")
    return out


def show(title, va, n=96):
    print(f"--- {title} @ {va:08X} ---")
    for line in disas(va, n):
        print(line)


# 1. 0x769B51 body
show("0x769B51 (string-id -> record resolver?)", 0x769B51, 48)

# 2. 0x93CD77 getter
show("0x93CD77 (+0x14 AddRef getter)", 0x93CD77, 48)

# 3. 0x4B1C27 (F28 getter, for contrast)
show("0x4B1C27 ([this+0xF28] getter)", 0x4B1C27, 48)

# 4. focus writer known-tag path + Set site
show("0x93CB27 head/gates", 0x93CB27, 0x70)
show("0x93CC00-0x93CCA5 (fetch/Set)", 0x93CC00, 0xA6)

# 5. E8 caller census of 0x93CB27
target = 0x93CB27
pat = re.compile(b"\xe8", re.S)
callers = []
for off in range(va2off(CODE_LO), va2off(CODE_HI) - 5):
    if data[off] == 0xE8:
        rel = int.from_bytes(data[off + 1:off + 5], "little", signed=True)
        if (CODE_LO + (off - va2off(CODE_LO))) + 5 + rel == target:
            callers.append(BASE + off)
print(f"--- E8 callers of 0x{target:X}: {len(callers)} ---")
for c in callers:
    print(f"  {c:08X}")
