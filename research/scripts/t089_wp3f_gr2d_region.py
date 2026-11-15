#!/usr/bin/env python3
"""T089 WP3f - locate the CMS079 Gr2D frame-record writer around 0x5040ABEF
and the timeline accumulator; verify delay/a0/a1 stores (+0x0C/+0x10/+0x14)
and the accumulation arithmetic (scale/1000) from CMS079 Gr2D bytes.

Strategy: scan the Gr2D code band for functions that store to [reg+0x0C]
with the arg pattern of a 7-arg insertion; more robustly, find all code
references (E8/E9 rel32 or absolute) into the region 0x5040AB00-0x5040AD00,
then dump from each candidate function start.
"""
import hashlib
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GR2D = REPO / ".work/task-063/client-stage/Gr2D_DX8.dll"
OUT = REPO / "research/result/stage-readiness/forensics/T089-GR2D-FRAME-REGION.txt"
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

    lines = ["# T089 Gr2D frame-region deep dump", f"# gr2d sha256={h}", ""]

    # 1. all E8/E9 rel32 calls INTO 0x5040AB00..0x5040AD00
    tgt_lo, tgt_hi = 0x5040AB00, 0x5040AD00
    refs = []
    for s in pe.sections:
        if not (s.Characteristics & 0x60000000):  # exec
            continue
        start = s.PointerToRawData
        end = start + s.SizeOfRawData
        for i in range(start, end - 5):
            if data[i] in (0xE8, 0xE9):
                rel = int.from_bytes(data[i + 1:i + 5], "little", signed=True)
                va = base + s.VirtualAddress + (i - start)
                t = va + 5 + rel
                if tgt_lo <= t < tgt_hi:
                    refs.append((va, t))
    lines.append(f"## code refs into {tgt_lo:#x}..{tgt_hi:#x}: {[(hex(a), hex(b)) for a, b in refs]}")
    lines.append("")

    # 2. dump region as linear code from several plausible starts
    for start_va in (0x5040AB9A, 0x5040ABA0, 0x5040ABB0, 0x5040ABC0):
        lines.append(f"## linear sweep from {start_va:#x}")
        off = off_of(start_va)
        for ins in md.disasm(data[off:off + 0x260], start_va):
            lines.append(f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}")
        lines.append("")

    # 3. census: imul-by-scale + div-1000 pattern and stores to +0x0C/+0x10/+0x14
    lines.append("## census: `fild`+`fdiv` by 1000.0 or imul+shr patterns near frame code")
    # double 1000.0 = 0x408F400000000000 ; 0.001 = 0x3F50624DD2F1A9FC
    for name, pat in (("1000.0", struct.pack("<d", 1000.0)), ("0.001", struct.pack("<d", 0.001))):
        hits = []
        k = data.find(pat)
        while k != -1:
            # translate file offset -> va
            for s in pe.sections:
                if s.PointerToRawData <= k < s.PointerToRawData + s.SizeOfRawData:
                    va = base + s.VirtualAddress + (k - s.PointerToRawData)
                    if 0x50400000 <= va < 0x50440000:
                        hits.append(va)
                    break
            k = data.find(pat, k + 1)
        lines.append(f"  {name}: {[hex(x) for x in hits]}")
    lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
