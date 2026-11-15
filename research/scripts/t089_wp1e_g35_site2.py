#!/usr/bin/env python3
"""T089 WP1e - finish site-2 trace: 0x66A000..0x66A160 and the 0x427EB3 body."""
import hashlib
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
OUT = REPO / "research/result/stage-readiness/forensics/T089-G35-KEY-CONSUMPTION3.txt"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000


def main() -> int:
    import capstone
    h = hashlib.sha256(EXE.read_bytes()).hexdigest()
    assert h == SHA, h
    data = EXE.read_bytes()
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    lines = ["# T089 WP1e G35 site-2 continuation + 0x427EB3 body", f"# source sha256={h}", ""]

    def dump(title, va, size):
        lines.append(f"## {title} ({va:08X} +{size:#x})")
        off = va - BASE
        for ins in md.disasm(data[off:off + size], va):
            lines.append(f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}")
        lines.append("")

    dump("site2 continuation 0x66A000..0x66A160", 0x66A000, 0x160)
    dump("0x427eb3 body (slot25 invoker)", 0x427EB3, 0x160)
    dump("0x429919 registrar", 0x429919, 0x80)

    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
