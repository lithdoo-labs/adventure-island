#!/usr/bin/env python3
"""T089 WP3i - G39 portal animation id census (pv / portalStart/Continue/Exit)."""
import hashlib
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
OUT = REPO / "research/result/stage-readiness/forensics/T089-G39-PORTAL-IDS.txt"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000


def main() -> int:
    import capstone
    h = hashlib.sha256(EXE.read_bytes()).hexdigest()
    assert h == SHA, h
    data = EXE.read_bytes()
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    lines = ["# T089 G39 portal animation id census", f"# sha256={h}", ""]

    for sid, name in ((0x601, "pv"), (0x602, "Map/MapHelper.img"), (0x603, "game"),
                      (0xF7D, "portalStart"), (0xF7E, "portalContinue"), (0xF7F, "portalExit")):
        pat = struct.pack("<I", sid)
        sites = []
        k = data.find(pat, 0x1000)
        while k != -1:
            if data[k - 1] == 0x68 and 0x401000 <= BASE + k - 1 <= 0xA80000:
                sites.append(BASE + k - 1)
            k = data.find(pat, k + 1)
        lines.append(f"## push 0x{sid:X} ({name}): {[hex(s) for s in sites]}")
        for s in sites:
            off = s - 0x30
            lines.append(f"### {s:#x}")
            for ins in md.disasm(data[off:off + 0x70], s - 0x30):
                lines.append(f"{ins.address:08X}  {ins.bytes.hex():<20} {ins.mnemonic} {ins.op_str}")
            lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
