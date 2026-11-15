#!/usr/bin/env python3
"""T089 WP3h - G39: census push-0x8D4 ('repeat') sites with aligned windows."""
import hashlib
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
OUT = REPO / "research/result/stage-readiness/forensics/T089-G39-REPEAT-SITES.txt"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000


def main() -> int:
    import capstone
    h = hashlib.sha256(EXE.read_bytes()).hexdigest()
    assert h == SHA, h
    data = EXE.read_bytes()
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    lines = ["# T089 repeat (0x8D4) read-site census", f"# source sha256={h}", ""]

    pat = struct.pack("<I", 0x8D4)
    sites = []
    k = data.find(pat, 0x1000)
    while k != -1:
        if data[k - 1] == 0x68 and 0x401000 <= BASE + k - 1 <= 0xA80000:
            sites.append(BASE + k - 1)
        k = data.find(pat, k + 1)
    lines.append(f"## sites: {[hex(s) for s in sites]}")
    lines.append("")

    def find_prologue(va):
        off = va - BASE
        for back in range(0x600, 0, -1):
            s = off - back
            if s < 0:
                return None
            if data[s:s + 3] == b"\x55\x8b\xec":
                return BASE + s
            if data[s] == 0xB8 and data[s + 5] == 0xE8:
                return BASE + s
        return None

    seen = set()
    for s in sites:
        p = find_prologue(s)
        key = p or s
        if key in seen:
            continue
        seen.add(key)
        lines.append(f"## site {s:#x} in function {hex(p) if p else '?'}")
        if p:
            off = p - BASE
            for ins in md.disasm(data[off:off + 0x340], p):
                mark = " <== repeat" if ins.address == s else ""
                lines.append(f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}{mark}")
        lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
