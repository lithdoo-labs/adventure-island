#!/usr/bin/env python3
"""T089 WP5c - EXE census of call [reg+0xA4] / call [reg+0xA8] (filter slots)."""
import hashlib
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
OUT = REPO / "research/result/stage-readiness/forensics/T089-G10-FILTER-CALLSITES.txt"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000

# call [r + disp32] = FF /2 with modrm mod=10: modrm = 0x90|reg for regs without SIB
MODRM = {0: 0x90, 1: 0x91, 2: 0x92, 3: 0x93, 6: 0x96, 7: 0x97}  # eax,ecx,edx,ebx,esi,edi
# also [ebp+d32] = modrm 0x95


def main() -> int:
    import capstone
    h = hashlib.sha256(EXE.read_bytes()).hexdigest()
    assert h == SHA, h
    data = EXE.read_bytes()
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    lines = ["# T089 G10 filter-slot call-site census (EXE)", f"# source sha256={h}", ""]

    def census(disp):
        hits = []
        for reg, modrm in MODRM.items():
            pat = bytes([0xFF, modrm]) + struct.pack("<i", disp)
            k = data.find(pat, 0x1000)
            while k != -1:
                hits.append(BASE + k)
                k = data.find(pat, k + 1)
        return sorted(hits)

    for disp in (0xA4, 0xA8):
        hits = census(disp)
        lines.append(f"## call [reg+{disp:#x}] sites: {len(hits)}")
        for va in hits:
            # containing context: disasm backwards blindly from va-0x40
            off = va - BASE
            ctx = list(md.disasm(data[off - 0x40:off + 0x10], va - 0x40))
            lines.append(f"### {va:#x}")
            for ins in ctx:
                lines.append(f"{ins.address:08X}  {ins.bytes.hex():<20} {ins.mnemonic} {ins.op_str}")
            lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
