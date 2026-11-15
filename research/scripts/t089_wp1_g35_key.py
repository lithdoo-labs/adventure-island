#!/usr/bin/env python3
"""T089 WP1 - G35 background depth key static search (CMS079 EXE).

Cross-version-guided (OpenMS GMS083 0x0063CD4E candidate):
  back  (front==0): key = -0x40000000 - 128000 + index*1000
  front (front!=0): key = -0x40000000 + 272000 + index*1000
This script does NOT assume that formula for CMS079; it censuses the raw
arithmetic structure in the CMS079 EXE so the formula can be proven or
refuted from original bytes:
  1. all `imul r32, r32, 1000` encodings (0x69 /r id, imm32 0x3E8)
  2. all 4-byte LE occurrences of 0x0001F400 (128000), 0x00042640 (272000),
     0xC0000000, 0x3FFFD400 (B-128000 folded), 0x3FFBC9C0-style folded
     front constants (B+272000 = -1073469824 = 0xBFFBD400 as signed), and the
     C-001/C-002 folded constants for positive control.
  3. disassembly windows around every hit in/near the map-loader band and
     around the historical C-024 site 0x423E6B.
Output: research/result/stage-readiness/forensics/T089-G35-KEY-SEARCH.txt
"""
import hashlib
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
OUT = REPO / "research/result/stage-readiness/forensics/T089-G35-KEY-SEARCH.txt"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def disasm(data: bytes, va: int, size: int):
    import capstone
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    md.detail = False
    off = va - BASE
    out = []
    for ins in md.disasm(data[off:off + size], va):
        out.append(f"{ins.address:08X}  {ins.bytes.hex():<24} {ins.mnemonic} {ins.op_str}")
    return out


def main() -> int:
    got = sha256_file(EXE)
    if got != SHA:
        print(f"FATAL hash mismatch {got}")
        return 2
    data = EXE.read_bytes()
    lines = []
    lines.append("# T089 WP1 G35 background-key raw search (CMS079 EXE)")
    lines.append(f"# source sha256={got}")
    lines.append("")

    # --- 1. imul r32, r/m32, 1000 (opcode 0x69, imm32 == 0x3E8) ---
    hits = []
    for i in range(len(data) - 6):
        if data[i] == 0x69 and data[i + 2:i + 6] == b"\xe8\x03\x00\x00":
            hits.append(BASE + i)
    lines.append(f"## imul-1000 (0x69 /r id) sites: {len(hits)}")
    for va in hits:
        lines.append(f"  {va:08X}")
    lines.append("")

    # --- 2. constant census ---
    def census(name: str, val: int):
        pat = struct.pack("<I", val)
        found = []
        start = 0
        while True:
            j = data.find(pat, start)
            if j < 0:
                break
            found.append(BASE + j)
            start = j + 1
        lines.append(f"## {name} (0x{val:08X}): {len(found)} occurrences")
        for va in found[:40]:
            lines.append(f"  {va:08X}")
        if len(found) > 40:
            lines.append(f"  ... {len(found)-40} more")
        lines.append("")
        return found

    B = 0x80000000 - 0x40000000  # not used directly; keep signed math below
    c_128000 = census("128000 (0x1F400)", 128000)
    c_272000 = census("272000 (0x42640)", 272000)
    c_c0000000 = census("0xC0000000", 0xC0000000)
    # folded: B-128000 = -1073869824 -> as unsigned 0xBFFFD400? compute:
    fold_back = (-(0x40000000) - 128000) & 0xFFFFFFFF
    fold_front = (-(0x40000000) + 272000) & 0xFFFFFFFF
    c_foldback = census(f"B-128000 folded (0x{fold_back:08X})", fold_back)
    c_foldfront = census(f"B+272000 folded (0x{fold_front:08X})", fold_front)
    # positive controls: C-001 tile folded -1073721834, C-002 obj folded -1073739824
    c_tile = census("C-001 tile folded -0x3FFFB1EA", (-1073721834) & 0xFFFFFFFF)
    c_obj = census("C-002 obj folded -0x3FFF8300-ish", (-1073739824) & 0xFFFFFFFF)

    # --- 3. windows ---
    def window(title: str, va: int, before: int, size: int):
        lines.append(f"## {title}: window {va-before:08X} +{size:#x}")
        lines.extend(disasm(data, va - before, size))
        lines.append("")

    # historical C-024 site
    window("C-024 historical site 0x423E6B", 0x423E6B, 0x60, 0x120)
    # map-loader band hits
    for va in hits:
        if 0x660000 <= va <= 0x670000:
            window(f"imul-1000 site in loader band {va:08X}", va, 0x80, 0x140)
    for va in c_128000:
        if 0x660000 <= va <= 0x670000:
            window(f"128000 site in loader band {va:08X}", va, 0x80, 0x140)
    for va in c_272000:
        if 0x660000 <= va <= 0x670000:
            window(f"272000 site in loader band {va:08X}", va, 0x80, 0x140)

    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
