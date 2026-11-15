#!/usr/bin/env python3
"""T089 WP1d - G35: key consumption sites + 0x44484B body + variant helper."""
import hashlib
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
OUT = REPO / "research/result/stage-readiness/forensics/T089-G35-KEY-CONSUMPTION2.txt"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000


def main() -> int:
    import capstone
    h = hashlib.sha256(EXE.read_bytes()).hexdigest()
    assert h == SHA, h
    data = EXE.read_bytes()
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    lines = ["# T089 WP1d G35 key consumption sites detail", f"# source sha256={h}", ""]

    def dump(title, va, size):
        lines.append(f"## {title} ({va:08X} +{size:#x})")
        off = va - BASE
        for ins in md.disasm(data[off:off + size], va):
            lines.append(f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}")
        lines.append("")

    dump("consumption site 1 context 0x669B60..0x669C40", 0x669B60, 0xE0)
    dump("consumption site 2 full 0x669FD8..0x66A0D0", 0x669FD8, 0x100)
    dump("0x43286e variant ctor", 0x43286E, 0x50)
    dump("0x44484b body", 0x44484B, 0x180)
    dump("0x411fe1 attach wrapper", 0x411FE1, 0x60)
    dump("0x6713df dtor-ish", 0x6713DF, 0x40)

    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
