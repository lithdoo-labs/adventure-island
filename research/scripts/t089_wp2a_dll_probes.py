#!/usr/bin/env python3
"""T089 WP2a/WP3c - cross-version DLL probes at OpenMS-cited GMS083 addresses.

OpenMS (docs.openms.dev, read 2026-11-16) cites these GMS083 addresses:
  Gr2D 0x5040ABEF : frame-record writer - delay@+0x0C, a0@+0x10, a1@+0x14
  Gr2D 0x5040B9E7 : timeline accumulator - frameDelay*animationScale/1000
  Gr2D 0x5040A949 : repeat/nonrepeat playback selection
  Gr2D 0x5040DA7C : event consumer at current time
  Shape2D 0x5140847D : parallax attach (slot +0x98 of vector vtable 0x5140C0FC)
  Shape2D 0x514085B3 : parallax evaluator (trunc((src_now-src_attach)*r/100))
  Shape2D 0x5140828F : numeric Set -> 0x51407FE1 -> 0x5140806D -> 0x5140809F
  Shape2D 0x51408D23 / 0x51408E33 : camera filter (0x1E0000, coef 100,
                      28-px deadband, residual 100000*D/(dt*D+100000))
CMS079 DLLs are DIFFERENT builds (hashes differ); nothing is assumed. This
script dumps CMS079 bytes at the same VAs and disassembles them, plus the
Vector2D vtable 0x5140C2F0 slot map, so structure can be compared.
"""
import hashlib
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GR2D = REPO / ".work/task-063/client-stage/Gr2D_DX8.dll"
SHAPE = REPO / ".work/task-063/client-stage/Shape2D.dll"
OUT = REPO / "research/result/stage-readiness/forensics/T089-DLL-CROSSVERSION-PROBES.txt"
GR2D_SHA = "ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1"
SHAPE_SHA = "9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b"


def load_pe(path, sha):
    import pefile
    h = hashlib.sha256(path.read_bytes()).hexdigest()
    assert h == sha, (path, h)
    pe = pefile.PE(str(path), fast_load=True)
    data = path.read_bytes()
    base = pe.OPTIONAL_HEADER.ImageBase

    def va_off(va):
        rva = va - base
        for s in pe.sections:
            if s.VirtualAddress <= rva < s.VirtualAddress + max(s.Misc_VirtualSize, s.SizeOfRawData):
                return s.PointerToRawData + (rva - s.VirtualAddress)
        raise ValueError(hex(va))

    return data, base, va_off


def main() -> int:
    import capstone
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    lines = ["# T089 cross-version DLL probes (CMS079 vs OpenMS GMS083 citations)",
             f"# gr2d sha256={GR2D_SHA}", f"# shape2d sha256={SHAPE_SHA}", ""]

    gdata, gbase, gva = load_pe(GR2D, GR2D_SHA)
    sdata, sbase, sva = load_pe(SHAPE, SHAPE_SHA)
    lines.append(f"# gr2d ImageBase={gbase:#x} shape2d ImageBase={sbase:#x}")

    def dump(title, data, va_off, va, size):
        lines.append(f"## {title} ({va:#x} +{size:#x})")
        try:
            off = va_off(va)
        except ValueError as e:
            lines.append(f"  <outside sections: {e}>")
            return
        for ins in md.disasm(data[off:off + size], va):
            lines.append(f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}")
        lines.append("")

    # --- Gr2D probes ---
    dump("Gr2D frame-record writer candidate (GMS083 0x5040ABEF)", gdata, gva, 0x5040ABEF, 0x120)
    dump("Gr2D timeline accumulator candidate (GMS083 0x5040B9E7)", gdata, gva, 0x5040B9E7, 0x140)
    dump("Gr2D repeat-selection candidate (GMS083 0x5040A949)", gdata, gva, 0x5040A949, 0x120)
    dump("Gr2D event consumer candidate (GMS083 0x5040DA7C)", gdata, gva, 0x5040DA7C, 0x120)

    # --- Shape2D probes ---
    dump("Shape2D parallax attach candidate (GMS083 0x5140847D)", sdata, sva, 0x5140847D, 0x140)
    dump("Shape2D parallax evaluator candidate (GMS083 0x514085B3)", sdata, sva, 0x514085B3, 0x140)
    dump("Shape2D numeric Set chain 0x5140828F", sdata, sva, 0x5140828F, 0xC0)
    dump("Shape2D 0x51407FE1", sdata, sva, 0x51407FE1, 0x90)
    dump("Shape2D 0x5140806D", sdata, sva, 0x5140806D, 0x60)
    dump("Shape2D 0x5140809F evaluator", sdata, sva, 0x5140809F, 0xC0)
    dump("Shape2D camera filter candidate (GMS083 0x51408D23)", sdata, sva, 0x51408D23, 0x140)
    dump("Shape2D camera filter residual (GMS083 0x51408E33)", sdata, sva, 0x51408E33, 0x140)

    # --- Vector2D vtable 0x5140C2F0 slot map + GMS083's 0x5140C0FC ---
    for tbl in (0x5140C2F0, 0x5140C0FC):
        lines.append(f"## vtable region {tbl:#x} slots +0x00..+0xC0")
        try:
            off = sva(tbl)
        except ValueError as e:
            lines.append(f"  <outside sections: {e}>")
            continue
        for slot in range(0, 0xC4, 4):
            val = struct.unpack("<I", sdata[off + slot:off + slot + 4])[0]
            lines.append(f"  +{slot:#05x}  {val:#010x}")
        lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
