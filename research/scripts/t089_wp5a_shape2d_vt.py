#!/usr/bin/env python3
"""T089 WP5a - read Shape2D filter constants + locate owning vtables.

Reads the doubles at 0x5140D8C8/0x5140D8D0/0x5140D8D8/0x5140D978 (deadband,
-clamp, +clamp, epsilon candidates) and censuses the whole Shape2D .rdata for
vtables containing 0x5140847D (parallax attach), 0x5140828F (numeric Set),
0x51408D23 (filter commit), 0x51408E33 (filter residual), reporting the slot
offset of each hit so the owning class's slot layout is established.
"""
import hashlib
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SHAPE = REPO / ".work/task-063/client-stage/Shape2D.dll"
OUT = REPO / "research/result/stage-readiness/forensics/T089-SHAPE2D-CONST-VTABLES.txt"
SHAPE_SHA = "9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b"


def main() -> int:
    import pefile
    h = hashlib.sha256(SHAPE.read_bytes()).hexdigest()
    assert h == SHAPE_SHA, h
    pe = pefile.PE(str(SHAPE), fast_load=True)
    data = SHAPE.read_bytes()
    base = pe.OPTIONAL_HEADER.ImageBase

    def va_off(va):
        rva = va - base
        for s in pe.sections:
            if s.VirtualAddress <= rva < s.VirtualAddress + max(s.Misc_VirtualSize, s.SizeOfRawData):
                return s.PointerToRawData + (rva - s.VirtualAddress)
        raise ValueError(hex(va))

    lines = ["# T089 Shape2D filter constants + vtable ownership", f"# sha256={h}", ""]

    lines.append("## constants")
    for va in (0x5140D8C8, 0x5140D8D0, 0x5140D8D8, 0x5140D978, 0x5140D8C0, 0x5140D970, 0x5140D980):
        off = va_off(va)
        d = struct.unpack("<d", data[off:off + 8])[0]
        lines.append(f"  {va:#x}: double {d!r}")
    lines.append("")

    # vtable census: scan data sections for the four function pointers
    targets = {
        0x5140847D: "parallax-attach",
        0x514085B3: "parallax-evaluator",
        0x5140828F: "numeric-Set",
        0x51408D23: "filter-commit",
        0x51408E33: "filter-residual",
    }
    lines.append("## pointer occurrences in Shape2D (all sections)")
    for tgt, name in targets.items():
        pat = struct.pack("<I", tgt)
        hits = []
        k = data.find(pat)
        while k != -1:
            hits.append(k)
            k = data.find(pat, k + 1)
        lines.append(f"  {name} {tgt:#x}: file-offsets {[hex(x) for x in hits]}")
        # translate to VA and check vtable alignment: for each hit, see if it
        # sits inside a run of code pointers (crude vtable detection)
        for off in hits:
            va = None
            rva = None
            for s in pe.sections:
                if s.PointerToRawData <= off < s.PointerToRawData + s.SizeOfRawData:
                    rva = s.VirtualAddress + (off - s.PointerToRawData)
                    va = base + rva
                    break
            if va is None:
                continue
            # scan backwards for run start
            start = off
            while True:
                prev = None
                for delta in (4,):
                    p = start - delta
                    if p < 0:
                        break
                    v = struct.unpack("<I", data[p:p + 4])[0]
                    if base <= v < base + len(data) + 0x10000 and (0x51401000 <= v < 0x51410000):
                        prev = p
                        break
                if prev is None:
                    break
                start = prev
            slot = (off - start) // 4
            tbl_va = base + 0  # recompute
            for s in pe.sections:
                if s.PointerToRawData <= start < s.PointerToRawData + s.SizeOfRawData:
                    tbl_va = base + s.VirtualAddress + (start - s.PointerToRawData)
            lines.append(f"    hit va={va:#x} -> table-start={tbl_va:#x} slot=+{slot*4:#x} (slot {slot})")
    lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
