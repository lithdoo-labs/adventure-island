#!/usr/bin/env python3
"""T089 WP1c - G35: trace [ebp-0x34] key consumption inside loader 0x669397.

Dumps 0x6699C0..0x669A80 (continuation after origin attach), searches the
whole loader body for every access to [ebp-0x34] / [ebp-0x64] / [ebp-0x60],
and disassembles helper 0x40634c (record chain) + the attach call shape.
"""
import hashlib
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
OUT = REPO / "research/result/stage-readiness/forensics/T089-G35-KEY-CONSUMPTION.txt"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000


def main() -> int:
    import capstone
    h = hashlib.sha256(EXE.read_bytes()).hexdigest()
    assert h == SHA, h
    data = EXE.read_bytes()
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    lines = ["# T089 WP1c G35 key consumption trace", f"# source sha256={h}", ""]

    def dump(title, va, size):
        lines.append(f"## {title} ({va:08X} +{size:#x})")
        off = va - BASE
        for ins in md.disasm(data[off:off + size], va):
            mark = ""
            if "0x34]" in ins.op_str and "ebp" in ins.op_str:
                mark = "   <== [ebp-0x34] KEY"
            if "0x64]" in ins.op_str and "ebp" in ins.op_str:
                mark = "   <== [ebp-0x64] out-struct"
            if "0x60]" in ins.op_str and "ebp" in ins.op_str:
                mark = "   <== [ebp-0x60] out+4"
            lines.append(f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}{mark}")
        lines.append("")

    # loader full body from key site to the tiler call sites 0x66A40E / 0x66A80B head
    dump("loader continuation after key: 0x6699B5..0x669B00", 0x6699B5, 0x150)
    dump("loader 0x669B00..0x669C60", 0x669B00, 0x160)
    dump("loader 0x669C60..0x669DC0", 0x669C60, 0x160)
    dump("loader 0x669DC0..0x669F20", 0x669DC0, 0x160)
    dump("loader 0x669F20..0x66A080", 0x669F20, 0x160)
    dump("loader 0x66A080..0x66A1E0 (ani branch / 0x66A136 reg)", 0x66A080, 0x160)
    dump("loader 0x66A1E0..0x66A340", 0x66A1E0, 0x160)
    dump("loader 0x66A340..0x66A4A0 (normal tiler call 0x66A40E)", 0x66A340, 0x160)
    dump("0x40634c helper body", 0x40634C, 0x60)
    dump("0x447891 wrapper head", 0x447891, 0x40)

    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
