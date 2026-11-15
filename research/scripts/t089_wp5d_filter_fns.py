#!/usr/bin/env python3
"""T089 WP5d - containing functions of the three +0xA8 filter-commit sites."""
import hashlib
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
OUT = REPO / "research/result/stage-readiness/forensics/T089-G10-FILTER-FUNCTIONS.txt"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000


def main() -> int:
    import capstone
    h = hashlib.sha256(EXE.read_bytes()).hexdigest()
    assert h == SHA, h
    data = EXE.read_bytes()
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    lines = ["# T089 G10 filter-commit containing functions", f"# sha256={h}", ""]

    def find_prologue(va):
        off = va - BASE
        for back in range(0xA00, 0, -1):
            s = off - back
            if s < 0:
                return None
            if data[s:s + 3] == b"\x55\x8b\xec":
                return BASE + s
            if data[s] == 0xB8 and data[s + 5] == 0xE8:
                return BASE + s
        return None

    for site in (0x43787D, 0x942DF7, 0x94A796):
        p = find_prologue(site)
        lines.append(f"## site {site:#x} -> function {hex(p) if p else '?'}")
        if p:
            off = p - BASE
            size = min(0x500, (site - p) + 0x300)
            for ins in md.disasm(data[off:off + size], p):
                mark = ""
                if ins.address == site:
                    mark = "   <== FILTER COMMIT +0xA8"
                lines.append(f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}{mark}")
        lines.append("")

    # E8 callers of each containing function
    def callers(target):
        out = []
        for i in range(0x1000, len(data) - 5):
            if data[i] == 0xE8:
                rel = int.from_bytes(data[i + 1:i + 5], "little", signed=True)
                if BASE + i + 5 + rel == target:
                    out.append(BASE + i)
        return out

    for site in (0x43787D, 0x942DF7, 0x94A796):
        p = find_prologue(site)
        if p:
            cl = callers(p)
            lines.append(f"## E8 callers of {p:#x}: {[hex(x) for x in cl]}")
    lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
