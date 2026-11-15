#!/usr/bin/env python3
"""T089 WP3d - finish 0x43EC69 (delay/a0/a1 consumer) + its tail call chain."""
import hashlib
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
OUT = REPO / "research/result/stage-readiness/forensics/T089-G39-FRAME-CONVERTER.txt"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000


def main() -> int:
    import capstone
    h = hashlib.sha256(EXE.read_bytes()).hexdigest()
    assert h == SHA, h
    data = EXE.read_bytes()
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    lines = ["# T089 frame converter 0x43EC69 full body", f"# source sha256={h}", ""]
    off = 0x43EC69 - BASE
    for ins in md.disasm(data[off:off + 0x400], 0x43EC69):
        lines.append(f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}")
    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
