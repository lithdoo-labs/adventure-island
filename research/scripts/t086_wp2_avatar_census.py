#!/usr/bin/env python3
"""T086 WP2 — G08 avatar insertion-key static census (CMS079 EXE).

OpenMS v83 hypothesis (H08, to be verified against CMS079 machine code):
  depth = -0x40000000 + 29992 + (activeController?5:0) + (layer*3000-group)*10
  mob 29991 / npc 29995 / drop 29999 bases (v83).

CMS079 static checks:
  A. immediate census: 0x7537(29991) 0x7538(29992) 0x753B(29995) 0x753F(29999)
     0xBB8(3000) 0x7530(30000) in the code band;
  B. lea/mov/add disp32 census in [-0x40000000-1 .. -0x40000000+0x10000]
     (i.e., 0xBFFFxxxx disp windows encoding a -2^31-base key);
  C. formula-shape census: imul 0xBB8 followed by sub + lea reg,[..+reg*2..]
     outside the proven tile site 0x666F5D (C-001);
  D. the avatar registration path: xrefs of any hit.
"""
import hashlib
import struct
from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_32

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000
CODE_LO, CODE_HI = 0x401000, 0xA80000
OUT = REPO / "research/result/stage-readiness/forensics/T086-G08-AVATAR-KEY-CENSUS.txt"

data = EXE.read_bytes()
assert hashlib.sha256(data).hexdigest() == SHA
md = Cs(CS_ARCH_X86, CS_MODE_32)

lines = ["# T086 WP2 — avatar key formula static census (CMS079 EXE)", ""]

# --- A. immediate census ---
lines.append("## A. immediate census")
IMMS = {0x7537: "29991", 0x7538: "29992", 0x753B: "29995", 0x753F: "29999",
        0xBB8: "3000", 0x7530: "30000", 0x2EE0: "12000"}
for val, dec in IMMS.items():
    hits = []
    for enc in (struct.pack("<I", val), struct.pack("<B", val & 0xFF) if val < 0x100 else b""):
        if not enc:
            continue
        pos = 0
        while True:
            i = data.find(enc, pos)
            if i < 0:
                break
            va = BASE + i
            if CODE_LO <= va < CODE_HI:
                hits.append(va)
            pos = i + 1
    # dedupe & keep
    hits = sorted(set(hits))
    lines.append(f"imm {dec} ({val:#x}): {len(hits)} occurrences in code band")
    for h in hits[:40]:
        ins = next(md.disasm(data[h - BASE - 8:h - BASE + 12], h - 8), None)
        lines.append(f"  {h:#x}")

# --- B. disp32 census near -2^31 base ---
lines.append("")
lines.append("## B. lea/add/sub disp32 in [-0x40000000 .. -0x40000000+0x10000]")
count = 0
# linear disassembly is unreliable; scan for 8D /r with disp32 (lea) and 81 /0 /1.. with imm32
for i in range(len(data) - 6):
    va = BASE + i
    if not (CODE_LO <= va < CODE_HI):
        continue
    op = data[i]
    if op == 0x8D:  # lea
        modrm = data[i + 1]
        mod = modrm >> 6
        if mod in (0, 2):
            # disp32 present?
            has_sib = (modrm & 7) == 4
            idx = i + 2 + (1 if has_sib else 0)
            if mod == 0 and (modrm & 7) == 5:
                dpos = i + 2
            elif mod == 2:
                dpos = idx + (1 if mod == 1 else 0) + (4 if mod == 1 else 0)
                dpos = idx + (1 if mod == 1 else 4 if mod == 2 else 0)
                # simpler: mod==2 -> disp32 at idx+disp8? no: mod2 -> disp32 directly at idx
                dpos = idx
            else:
                dpos = idx
            if dpos + 4 <= len(data):
                disp = struct.unpack("<i", data[dpos:dpos + 4])[0]
                if -0x40000100 <= disp <= -0x3FFF0000:
                    lines.append(f"  lea @ {va:#x}: disp {disp:#x} ({disp})")
                    count += 1
lines.append(f"total lea-with-neg2^31-disp candidates: {count}")

# --- C. imul 0xBB8 sites outside the tile site ---
lines.append("")
lines.append("## C. imul ..,0xBB8 sites (3000)")
needle = b"\x69\xc9\xb8\x0b\x00\x00"  # imul ecx,ecx,0xBB8 (tile form)
pos = 0
while True:
    i = data.find(needle, pos)
    if i < 0:
        break
    lines.append(f"  imul ecx,ecx,0xBB8 @ {BASE + i:#x}")
    pos = i + 1
for pat, nm in [(b"\xb8\xb8\x0b\x00\x00", "mov eax,0xBB8"), (b"\xb9\xb8\x0b\x00\x00", "mov ecx,0xBB8"),
                (b"\xba\xb8\x0b\x00\x00", "mov edx,0xBB8"), (b"\xbf\xb8\x0b\x00\x00", "mov edi,0xBB8"),
                (b"\xbe\xb8\x0b\x00\x00", "mov esi,0xBB8")]:
    pos = 0
    while True:
        i = data.find(pat, pos)
        if i < 0:
            break
        va = BASE + i
        if CODE_LO <= va < CODE_HI:
            lines.append(f"  {nm} @ {va:#x}")
        pos = i + 1

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"wrote {OUT} ({len(lines)} lines)")
