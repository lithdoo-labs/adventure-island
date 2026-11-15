#!/usr/bin/env python3
"""T089 WP5g - proper containing functions for the 0x437717 callers."""
import hashlib
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
OUT = REPO / "research/result/stage-readiness/forensics/T089-G10-FILTER-CALLERS2.txt"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000


def main() -> int:
    import capstone
    h = hashlib.sha256(EXE.read_bytes()).hexdigest()
    assert h == SHA, h
    data = EXE.read_bytes()
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    lines = ["# T089 G10 0x437717 caller containing functions", f"# sha256={h}", ""]

    def find_prologue(va):
        off = va - BASE
        for back in range(0x1500, 0, -1):
            s = off - back
            if s < 0:
                return None
            if data[s] == 0xB8 and data[s + 5] == 0xE8:
                return BASE + s
            if data[s:s + 3] == b"\x55\x8b\xec":
                return BASE + s
        return None

    for site in (0x66F143, 0x670C60, 0x950993):
        p = find_prologue(site)
        lines.append(f"## caller {site:#x} in function {hex(p) if p else '?'}")
        if p:
            off = p - BASE
            size = min(0x900, (site - p) + 0x200)
            for ins in md.disasm(data[off:off + size], p):
                mark = ""
                if ins.address == site:
                    mark = "   <== call 0x437717 (filter-arm)"
                if "0xf28" in ins.op_str:
                    mark += "  <== +0xF28"
                lines.append(f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}{mark}")
        lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
