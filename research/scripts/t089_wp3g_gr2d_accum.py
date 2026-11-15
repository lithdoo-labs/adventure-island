#!/usr/bin/env python3
"""T089 WP3g - Gr2D timeline accumulator around 0x5040B9E7 (GMS083 cite)."""
import hashlib
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GR2D = REPO / ".work/task-063/client-stage/Gr2D_DX8.dll"
OUT = REPO / "research/result/stage-readiness/forensics/T089-GR2D-ACCUM.txt"
GR2D_SHA = "ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1"


def main() -> int:
    import capstone
    import pefile
    h = hashlib.sha256(GR2D.read_bytes()).hexdigest()
    assert h == GR2D_SHA, h
    pe = pefile.PE(str(GR2D), fast_load=True)
    data = GR2D.read_bytes()
    base = pe.OPTIONAL_HEADER.ImageBase
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)

    def off_of(va):
        rva = va - base
        for s in pe.sections:
            if s.VirtualAddress <= rva < s.VirtualAddress + max(s.Misc_VirtualSize, s.SizeOfRawData):
                return s.PointerToRawData + (rva - s.VirtualAddress)
        raise ValueError(hex(va))

    lines = ["# T089 Gr2D accumulator region", f"# sha256={h}", ""]

    # find function start backwards from 0x5040B9E7: SEH prolog pattern
    # mov eax, imm32 (5 bytes) + call rel32, or push ebp; mov ebp,esp
    start = None
    off = off_of(0x5040B9E7)
    for back in range(0x500, 0, -1):
        s = off - back
        if data[s] == 0xB8 and data[s + 5] == 0xE8:
            start = 0x5040B9E7 - back
            break
        if data[s:s + 3] == b"\x55\x8b\xec":
            start = 0x5040B9E7 - back
            break
    lines.append(f"## candidate fn start: {hex(start) if start else 'none'}")
    if start:
        o = off_of(start)
        for ins in md.disasm(data[o:o + (0x5040B9E7 - start) + 0x260], start):
            lines.append(f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}")

    # census: mov reg, 0x3E8 (b8/ba/be/bf/b9/bd/bb e8 03 00 00) in Gr2D code
    lines.append("")
    lines.append("## mov r32, 0x3E8 sites (idiv-1000 candidates)")
    for s in pe.sections:
        if not (s.Characteristics & 0x60000000):
            continue
        blob = data[s.PointerToRawData:s.PointerToRawData + s.SizeOfRawData]
        for m in (0xB8, 0xB9, 0xBA, 0xBB, 0xBD, 0xBE, 0xBF):
            pat = bytes([m, 0xE8, 0x03, 0x00, 0x00])
            k = blob.find(pat)
            while k != -1:
                va = base + s.VirtualAddress + k
                lines.append(f"  {va:#x}")
                k = blob.find(pat, k + 1)

    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
