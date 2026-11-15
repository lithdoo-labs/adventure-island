#!/usr/bin/env python3
"""T089 WP3a - G39: census id-0x155D ('delay') read sites + delay default.

GMS083 candidate (OpenMS): 0x0043F768 reads frame `delay` (id 0x15f8 there)
with default 0x78 (120 ms) via a string-id conversion helper. CMS079's delay
id is 0x155D (proven by namespace decryption this round). This script:
  1. censuses every `push 0x155D` / imm32-0x155D site in the code band;
  2. dumps +-0x80 windows around each;
  3. looks for the default-value push (0x78 or other) feeding the same
     property-read helper sequence (0x7A48D0/0x406368/0x40263B/0x403AC7/
     0x414A49/0x415344 family);
  4. also censuses a0/a1 (0x1550/0x1551) read sites for the alpha path.
"""
import hashlib
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
OUT = REPO / "research/result/stage-readiness/forensics/T089-G39-DELAY-SITES.txt"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000


def main() -> int:
    import capstone
    h = hashlib.sha256(EXE.read_bytes()).hexdigest()
    assert h == SHA, h
    data = EXE.read_bytes()
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    lines = ["# T089 WP3a G39 delay-id read-site census (CMS079 EXE)",
             f"# source sha256={h}", ""]

    def find_imm32(val, lo=0x401000, hi=0xA80000):
        pat = struct.pack("<I", val)
        res = []
        k = data.find(pat, lo - BASE, hi - BASE)
        while k != -1:
            res.append(BASE + k)
            k = data.find(pat, k + 1, hi - BASE)
        return res

    def dump(title, va, before, size):
        lines.append(f"## {title}")
        off = va - before
        for ins in md.disasm(data[off:off + size], va - before):
            lines.append(f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}")
        lines.append("")

    for sid, name in ((0x155D, "delay"), (0x1550, "a0"), (0x1551, "a1")):
        # push imm32 form: 68 id
        sites = []
        for va in find_imm32(sid):
            if data[va - BASE - 1] == 0x68:
                sites.append(va - 1)
        lines.append(f"## push 0x{sid:X} ({name}) sites: {[hex(s) for s in sites]}")
        lines.append("")
        for s in sites:
            dump(f"0x{sid:X} site {s:08X} context", s, 0x50, 0xF0)

    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
