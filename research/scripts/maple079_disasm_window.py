#!/usr/bin/env python3
"""Parameterized disassembly-window CLI for CMS079 static forensics (t082).

Reproducible single-purpose tool: verifies the source hash, maps VA to file
offset under the correct image model, and disassembles a byte window with
capstone. Optionally dumps raw bytes instead of instructions.

Image models:
  exe  - .work/task-036/game-image-unpacked.bin is a LINEAR MEMORY DUMP:
         fileOffset = VA - 0x400000 (anchor-verified; do NOT use PE sections).
  dll  - Gr2D_DX8.dll is a regular PE file: RVA -> file offset via section
         table; ImageBase 0x50400000.

Examples:
  python maple079_disasm_window.py --binary <exe> --sha256 <hash> \
      --image exe --va 0x53E95D --size 0x180
  python maple079_disasm_window.py --binary <dll> --sha256 <hash> \
      --image dll --va 0x5042D204 --size 0xBC --raw
"""
import argparse
import hashlib
import sys

DEFAULT_BASE = {"exe": 0x400000, "dll": 0x50400000}


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def va_to_offset_exe(data: bytes, va: int, base: int) -> int:
    off = va - base
    if off < 0 or off >= len(data):
        raise ValueError(f"VA {va:#x} outside linear image (base {base:#x}, size {len(data):#x})")
    return off


def va_to_offset_dll(data: bytes, va: int, base: int) -> int:
    try:
        import pefile
        pe = pefile.PE(data=data, fast_load=True)
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("pefile required for --image dll") from exc
    rva = va - base
    for s in pe.sections:
        start = s.VirtualAddress
        if start <= rva < start + max(s.Misc_VirtualSize, s.SizeOfRawData):
            d = rva - start
            if d >= s.SizeOfRawData:
                raise ValueError(f"VA {va:#x} falls in uninitialized part of {s.Name.rstrip(bytes(8)).decode(errors='replace')}")
            return s.PointerToRawData + d
    raise ValueError(f"RVA {rva:#x} not covered by any section")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--binary", required=True, help="path to raw image file")
    ap.add_argument("--sha256", required=True, help="expected SHA-256 (full, 64 hex chars)")
    ap.add_argument("--image", choices=["exe", "dll"], required=True)
    ap.add_argument("--base", type=lambda s: int(s, 0), default=None,
                    help="override image base (defaults: exe 0x400000, dll 0x50400000)")
    ap.add_argument("--va", type=lambda s: int(s, 0), required=True, help="window start VA")
    ap.add_argument("--size", type=lambda s: int(s, 0), default=0x100, help="window byte size")
    ap.add_argument("--raw", action="store_true", help="dump raw bytes (hex) instead of disassembly")
    ap.add_argument("--out", default=None, help="optional output path (default stdout)")
    args = ap.parse_args()

    digest = sha256_file(args.binary)
    if digest != args.sha256.lower():
        print(f"ERROR: sha256 mismatch: got {digest}, expected {args.sha256}", file=sys.stderr)
        return 2

    data = open(args.binary, "rb").read()
    base = args.base if args.base is not None else DEFAULT_BASE[args.image]
    try:
        off = (va_to_offset_exe if args.image == "exe" else va_to_offset_dll)(data, args.va, base)
    except ValueError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2

    blob = data[off:off + args.size]
    lines = [
        f"# binary={args.binary}",
        f"# sha256={digest}",
        f"# image={args.image} base={base:#x} va={args.va:#x} size={args.size:#x} fileOffset={off:#x}",
    ]
    if args.raw:
        for i in range(0, len(blob), 16):
            lines.append(f"{args.va + i:08X}  {blob[i:i + 16].hex(' ')}")
    else:
        from capstone import Cs, CS_ARCH_X86, CS_MODE_32
        md = Cs(CS_ARCH_X86, CS_MODE_32)
        for ins in md.disasm(blob, args.va):
            lines.append(f"{ins.address:08X}  {ins.bytes.hex():<24} {ins.mnemonic} {ins.op_str}")
    text = "\n".join(lines) + "\n"
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
