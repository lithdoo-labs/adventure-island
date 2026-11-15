#!/usr/bin/env python3
"""T089 WP5f - callers of 0x437717 (filter-arm vector helper) + 0x9426B0/0x949DA3."""
import hashlib
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
OUT = REPO / "research/result/stage-readiness/forensics/T089-G10-FILTER-CALLERS.txt"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000


def main() -> int:
    import capstone
    h = hashlib.sha256(EXE.read_bytes()).hexdigest()
    assert h == SHA, h
    data = EXE.read_bytes()
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)

    def callers(target):
        out = []
        for i in range(0x1000, len(data) - 5):
            if data[i] == 0xE8:
                rel = int.from_bytes(data[i + 1:i + 5], "little", signed=True)
                if BASE + i + 5 + rel == target:
                    out.append(BASE + i)
        return out

    lines = ["# T089 G10 filter-helper callers", f"# sha256={h}", ""]
    for fn in (0x437717, 0x9426B0, 0x949DA3):
        cl = callers(fn)
        lines.append(f"## callers of {fn:#x}: {[hex(x) for x in cl]}")
        for c in cl:
            lines.append(f"### caller window {c:#x}")
            off = c - 0x60
            for ins in md.disasm(data[off:off + 0xC0], c - 0x60):
                mark = " <== CALL" if ins.address == c else ""
                lines.append(f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}{mark}")
            lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
