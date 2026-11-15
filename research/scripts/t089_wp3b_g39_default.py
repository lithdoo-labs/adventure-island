#!/usr/bin/env python3
"""T089 WP3b - G39: locate delay default + frame-chain function bounds.

For every push-0x155D site, search +-0x40 bytes for `6a 78` (push 0x78) or
other small immediates feeding the conversion helper, and disassemble the
tiler's per-child delay read (0x66ABCD inside 0x66A8D5, known-good start).
Then disassemble the frame-chain function containing 0x43EC81 from its true
prologue (backwards search for 55 8b ec / b8....e8 SEH prolog).
"""
import hashlib
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
OUT = REPO / "research/result/stage-readiness/forensics/T089-G39-DELAY-DEFAULT.txt"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000


def main() -> int:
    import capstone
    h = hashlib.sha256(EXE.read_bytes()).hexdigest()
    assert h == SHA, h
    data = EXE.read_bytes()
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    lines = ["# T089 WP3b G39 delay default + frame chain", f"# source sha256={h}", ""]

    # push 0x155D sites (recompute)
    pat = struct.pack("<I", 0x155D)
    sites = []
    k = data.find(pat, 0x1000, len(data))
    while k != -1:
        if data[k - 1] == 0x68 and 0x401000 <= BASE + k <= 0xA80000:
            sites.append(BASE + k - 1)
        k = data.find(pat, k + 1)

    lines.append("## push 0x78 (6a 78) proximity scan around delay sites")
    for s in sites:
        lo, hi = s - BASE - 0x40, s - BASE + 0x40
        hits = []
        j = data.find(b"\x6a\x78", lo, hi)
        while j != -1:
            hits.append(BASE + j)
            j = data.find(b"\x6a\x78", j + 1, hi)
        if hits:
            lines.append(f"  delay-site {s:08X}: push 0x78 at {[hex(x) for x in hits]}")
    lines.append("")

    def dump(title, va, size):
        lines.append(f"## {title} ({va:08X} +{size:#x})")
        off = va - BASE
        for ins in md.disasm(data[off:off + size], va):
            lines.append(f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}")
        lines.append("")

    # tiler delay read (function 0x66A8D5 known start)
    dump("tiler per-child delay read 0x66AB80..0x66AC10", 0x66AB80, 0x90)

    # frame-chain containing 0x43EC81: find prologue backwards
    def find_prologue(va):
        off = va - BASE
        for back in range(0x400, 0, -1):
            s = off - back
            if data[s:s + 3] == b"\x55\x8b\xec":
                return BASE + s
            # SEH prolog: b8 imm32 e8
            if data[s] == 0xB8 and data[s + 5] == 0xE8:
                return BASE + s
        return None

    for target in (0x43EC81, 0x43ED02, 0x43ED7C):
        p = find_prologue(target)
        lines.append(f"## containing-function candidate for {target:#x}: {hex(p) if p else 'none'}")

    p = find_prologue(0x43EC81)
    if p:
        dump(f"frame chain fn {p:#x}", p, 0x43EDF0 - p)

    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
