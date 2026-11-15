#!/usr/bin/env python3
"""T089 WP3e - Gr2D slot+0x104 (frame insertion) from the C-087 long tables.

C-087: QI(E576EA33) on [0xBE2788] yields a long-table object with vtable
0x5042D224 (class-1 inner) or 0x5042D154 (class-2 primary). Slot +0x104 of
the creator 0x427DE0 therefore resolves to one of:
  [0x5042D224+0x104] / [0x5042D154+0x104]
This script dumps both tables' slot maps (+0x00..+0x140), disassembles the
+0x104 targets, and follows the delay/a0/a1 stores.
"""
import hashlib
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GR2D = REPO / ".work/task-063/client-stage/Gr2D_DX8.dll"
OUT = REPO / "research/result/stage-readiness/forensics/T089-GR2D-SLOT104-INSERT.txt"
GR2D_SHA = "ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1"


def main() -> int:
    import capstone
    import pefile
    h = hashlib.sha256(GR2D.read_bytes()).hexdigest()
    assert h == GR2D_SHA, h
    pe = pefile.PE(str(GR2D), fast_load=True)
    data = GR2D.read_bytes()
    base = pe.OPTIONAL_HEADER.ImageBase

    def va_off(va):
        rva = va - base
        for s in pe.sections:
            if s.VirtualAddress <= rva < s.VirtualAddress + max(s.Misc_VirtualSize, s.SizeOfRawData):
                return s.PointerToRawData + (rva - s.VirtualAddress)
        raise ValueError(hex(va))

    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    lines = ["# T089 Gr2D long-table slot maps + slot+0x104 insertion method",
             f"# gr2d sha256={h}", ""]

    def dump(title, va, size):
        lines.append(f"## {title} ({va:#x} +{size:#x})")
        try:
            off = va_off(va)
        except ValueError as e:
            lines.append(f"  <outside: {e}>")
            return
        for ins in md.disasm(data[off:off + size], va):
            lines.append(f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}")
        lines.append("")

    for tbl in (0x5042D224, 0x5042D154):
        lines.append(f"## vtable {tbl:#x} slots +0x00..+0x140")
        off = va_off(tbl)
        for slot in range(0, 0x144, 4):
            val = struct.unpack("<I", data[off + slot:off + slot + 4])[0]
            lines.append(f"  +{slot:#05x}  {val:#010x}")
        lines.append("")

    for tbl in (0x5042D224, 0x5042D154):
        off = va_off(tbl)
        tgt = struct.unpack("<I", data[off + 0x104:off + 0x108])[0]
        lines.append(f"## slot +0x104 of {tbl:#x} -> {tgt:#x}")
        if 0x50401000 <= tgt < 0x50410000:
            dump(f"insertion method from {tbl:#x}+0x104", tgt, 0x200)

    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
