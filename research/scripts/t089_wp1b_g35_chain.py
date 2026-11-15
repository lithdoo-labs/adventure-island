#!/usr/bin/env python3
"""T089 WP1b - G35: full containing function, index source, key consumption.

Windows to dump:
  A. loader 0x669397 head + up to the key site (index arg provenance)
  B. 0x6713AC body (record ctor that receives the key at [ebp-0x34])
  C. 0x671B59 body (layer container lookup/registration consuming the record)
  D. E8 callers of 0x669397 (enumeration loop feeding index)
  E. E8 callers of 0x671B59 (who else registers layers)
Output: research/result/stage-readiness/forensics/T089-G35-FUNCTION-CHAIN.txt
"""
import hashlib
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
OUT = REPO / "research/result/stage-readiness/forensics/T089-G35-FUNCTION-CHAIN.txt"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    import capstone
    got = sha256_file(EXE)
    assert got == SHA, got
    data = EXE.read_bytes()
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    lines = ["# T089 WP1b G35 function chain (CMS079 EXE)", f"# source sha256={got}", ""]

    def dump(title, va, size):
        lines.append(f"## {title} ({va:08X} +{size:#x})")
        off = va - BASE
        for ins in md.disasm(data[off:off + size], va):
            lines.append(f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}")
        lines.append("")

    def callers(target, lo=0x401000, hi=0xC00000):
        out = []
        for i in range(lo - BASE, hi - BASE - 5):
            if data[i] == 0xE8:
                rel = int.from_bytes(data[i + 1:i + 5], "little", signed=True)
                if BASE + i + 5 + rel == target:
                    out.append(BASE + i)
        return out

    dump("A. loader 0x669397 head (index arg + first reads)", 0x669397, 0x2D0)
    dump("A2. 0x669664..0x6696C0 (front-flag read feed)", 0x669660, 0x70)
    dump("A3. key site context 0x6698C0..0x6699C0", 0x6698C0, 0x100)
    dump("B. 0x6713AC record ctor", 0x6713AC, 0xC0)
    dump("C. 0x671B59 layer lookup/registration", 0x671B59, 0x180)

    cl = callers(0x669397)
    lines.append(f"## E8 callers of 0x669397: {[hex(x) for x in cl]}")
    lines.append("")
    for c in cl:
        dump(f"caller window {c:08X}", c - 0x100, 0x180)

    cl2 = callers(0x671B59)
    lines.append(f"## E8 callers of 0x671B59: {[hex(x) for x in cl2]}")
    lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
