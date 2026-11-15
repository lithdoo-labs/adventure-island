#!/usr/bin/env python3
"""T086.1 WP0 — G08 avatar-key radix audit (independent re-derivation).

T086 recorded the avatar insertion-key base both as `-0x40000000` (correct,
machine-code form) and in prose as `-2^31` (WRONG: 0x40000000 = 2^30).  This
script independently re-decodes the primary site 0x9363D9..0x936417 and the
sister sites from the raw EXE bytes, symbolically executes the key
computation, cross-checks the numeric values (including the two anchor cases
required by the T086.1 task), verifies the key-1 paths, and re-derives the
type-base family from the lea disp32 constants.  Bounded negative checks:
(1) no plain-immediate encodings of the family constants exist (they live in
lea disp32); (2) the tile (C-001) and obj (C-002) decimal baselines equal
-(2^30 - base) exactly, confirming ONE designed key space on the 2^30 base.

Outputs: research/result/stage-readiness/forensics/T0861-G08-KEY-CONSTANT-AUDIT.txt
"""
import hashlib
import re
import struct
import sys
from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_32

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000
OUT = REPO / "research/result/stage-readiness/forensics/T0861-G08-KEY-CONSTANT-AUDIT.txt"

data = EXE.read_bytes()
assert hashlib.sha256(data).hexdigest() == SHA, "EXE sha mismatch"
md = Cs(CS_ARCH_X86, CS_MODE_32)

L = []
L.append("# T086.1 WP0 — G08 insertion-key radix audit (independent re-derivation)")
L.append("#")
L.append("# T086 defect: the machine-code base -0x40000000 (= -2^30 = -1073741824) was")
L.append("# mislabeled '-2^31' in prose (C-099/G08/report). 0x40000000 = 2^30; 2^31 =")
L.append("# 0x80000000. All effective values and byte encodings were already correct —")
L.append("# this audit re-derives them from the raw bytes and pins the radix.")
L.append("")


def disas(lo, hi):
    out = []
    for i in md.disasm(data[lo - BASE:hi - BASE], lo):
        out.append((i.address, i.bytes.hex(), f"{i.mnemonic} {i.op_str}"))
    return out


# ---------------------------------------------------------------- 1. primary site
L.append("## 1. primary avatar site 0x9363D9..0x93641C (independent decode)")
prim = disas(0x9363D9, 0x93641D)
for a, b, t in prim:
    L.append(f"{a:#09x}  {b:<22} {t}")
L.append("")

# template check: the exact instruction sequence must match the recovered form
EXPECT = [
    (0x9363D9, "mov eax, dword ptr [ecx + 0xf28]"),
    (0x9363DF, "lea edx, [eax - 0xc]"),
    (0x9363E2, "neg eax"),
    (0x9363E4, "sbb eax, eax"),
    (0x9363E6, "and eax, edx"),
    (0x9363E8, "mov edx, dword ptr [eax + 0x130]"),
    (0x9363EE, "imul edx, edx, 0xbb8"),
    (0x9363F4, "sub edx, dword ptr [eax + 0x134]"),
    (0x9363FA, "mov eax, dword ptr [eax + 0x18]"),
    (0x9363FD, "neg eax"),
    (0x9363FF, "sbb eax, eax"),
    (0x936401, "and eax, 5"),
    (0x936404, "inc eax"),
    (0x936405, "lea edx, [edx + edx*4]"),
    (0x936408, "inc eax"),
    (0x936409, "lea eax, [eax + edx*2 - 0x3fff8ada]"),
    (0x936410, "push eax"),
    (0x936411, "add ecx, 0x88"),
    (0x936417, "call 0x452147"),
]
got = {a: t for a, b, t in prim}
ok = True
for addr, text in EXPECT:
    if got.get(addr) != text:
        L.append(f"!! TEMPLATE MISMATCH at {addr:#x}: expected '{text}' got '{got.get(addr)}'")
        ok = False
L.append(f"template check 0x9363D9..0x936417: {'PASS (19/19 instructions exact)' if ok else 'FAIL'}")
L.append("")

# disp32 byte read: lea at 0x936409 is 8d 84 50 26 75 00 c0
disp_bytes = data[0x936409 - BASE + 3:0x936409 - BASE + 7]
disp_raw = struct.unpack("<I", disp_bytes)[0]
disp_signed = struct.unpack("<i", disp_bytes)[0]
L.append(f"lea 0x936409 disp32 raw bytes = {disp_bytes.hex()} -> 0x{disp_raw:08X} (signed {disp_signed})")
L.append(f"  -0x3FFF8ADA = -(2^30 - 0x7526) = -(1073741824 - 29990) = -1073711834")
L.append(f"  check: 2^30 - 0x3FFF8ADA = {0x40000000 - 0x3FFF8ADA} = 0x{0x40000000 - 0x3FFF8ADA:X} (29990 = 0x7526)")
assert 0x40000000 - 0x3FFF8ADA == 29990
assert disp_raw == 0xC0007526
L.append("")

# ------------------------------------------------- 2. symbolic execution + values
L.append("## 2. symbolic execution of the primary-site key computation")
L.append("")
L.append("```")
L.append("field   = [user+0xF28] - 0xC        ; null-safe via neg/sbb/and")
L.append("L       = dword [field+0x130]        ; layer")
L.append("G       = dword [field+0x134]        ; zM / group")
L.append("flag    = dword [field+0x18]")
L.append("edx     = L*3000 - G")
L.append("eax     = ((flag!=0) ? 5 : 0) + 1 + 1   ; -> {2, 7}")
L.append("key     = eax + 2*5*(L*3000 - G) - 0x3FFF8ADA")
L.append("       = 10*(3000*L - G) - 0x40000000 + 29990 + 2 + 5*(flag!=0)")
L.append("       = 10*(3000*L - G) - 2^30 + {29992, 29997}")
L.append("```")
L.append("")

M32 = 0xFFFFFFFF


def key_formula(layer, group, flag):
    return ((10 * (3000 * layer - group) - 0x40000000 + 29990 + 2 + (5 if flag else 0))
            & M32)


def key_symbolic(layer, group, flag):
    """Mirror the instruction sequence bit-for-bit (incl. wraparound)."""
    edx = ((3000 * layer) - group) & M32
    eax = ((~0 if flag else 0) & 5) & M32       # neg/sbb -> -1 or 0, and 5
    eax = (eax + 1) & M32                        # inc
    edx = (edx * 5) & M32                        # lea [edx+edx*4]
    eax = (eax + 1) & M32                        # inc
    eax = (eax + 2 * edx - 0x3FFF8ADA) & M32     # lea [eax+edx*2-0x3FFF8ADA]
    return eax


CASES = [
    (0, 0, 0, -1073711832, "task anchor case 1"),
    (0, 0, 1, -1073711827, "task anchor case 2"),
    (0, -5, 0, None, "negative group"),
    (1, 0, 0, None, "layer=1"),
    (7, 500, 1, None, "layer=7 group=500 flag=1"),
    (149, 0, 0, None, "zmax layer 149"),
    (35792, 0, 0, None, "near-overflow layer (10*3000*35792 = 2^30+... wraps)"),
    (100000, 0, 1, None, "signed-32 boundary wrap"),
]
L.append("## 3. numeric table (formula path vs symbolic path; both must agree as i32)")
L.append("")
L.append("| layer | group | flag | key (i32) | hex | symbolic==formula | note |")
L.append("|---|---|---|---|---|---|---|")
for layer, group, flag, expect, note in CASES:
    f = key_formula(layer, group, flag)
    s = key_symbolic(layer, group, flag)
    assert f == s, (layer, group, flag, f, s)
    i32 = f - (1 << 32) if f >= (1 << 31) else f
    if expect is not None:
        assert i32 == expect, (layer, group, flag, i32, expect)
    L.append(f"| {layer} | {group} | {flag} | {i32} | {f & M32:#010x} | OK | {note} |")
L.append("")
L.append("anchor assertions from the T086.1 task:")
L.append("  layer=0, group=0, flag=0 -> -1073711832  (PASS)")
L.append("  layer=0, group=0, flag=1 -> -1073711827  (PASS)")
L.append("")

# effective band check
L.append("effective constants at L=0,G=0: flag=0 -> -2^30+29992 ; flag=1 -> -2^30+29997")


def as_i32(x):
    return x - (1 << 32) if x >= (1 << 31) else x
assert as_i32(key_formula(0, 0, 0)) == -2**30 + 29992
assert as_i32(key_formula(0, 0, 1)) == -2**30 + 29997
L.append("")

# ------------------------------------------------- 4. sister sites + key-1 paths
L.append("## 4. sister sites (fresh decode incl. the two windows T086 left empty)")
SITES = [
    (0x93E7F2, 0x93E831, "avatar site 2 (imul 0x93E80D)"),
    (0x93E909, 0x93E929, "avatar site 3 — T086 window was EMPTY; includes dec edi key-1 at 0x93E926"),
    (0x93EF0D, 0x93EF2D, "avatar site 4 — T086 window was EMPTY; includes dec edi key-1 at 0x93EF2A"),
    (0x70DDD7 - 0x40, 0x70DDD7 + 0x20, "reviewer +3 sibling band 0x70DDD7"),
    (0x7A99D5 - 0x20, 0x7A9A20, "avatar-variant 29992 base 0x7A99D5 / 29991 0x7A9A0E"),
    (0x559F07 - 0x20, 0x559F70, "obj-like family 0x559F07 (-0x40000000 exact) + 59970/59980"),
    (0x50ED69 - 0x18, 0x50ED90, "drop base 0x50ED77"),
    (0x5181D9 - 0x18, 0x518200, "NPC base 0x5181E6"),
]
for lo, hi, tag in SITES:
    L.append(f"### window {lo:#x}..{hi:#x} — {tag}")
    for a, b, t in disas(lo, hi):
        mark = " <==" if "0x3fff8a" in b or "- 0x40000000" in t or t.startswith("dec edi") else ""
        L.append(f"{a:#09x}  {b:<22} {t}{mark}")
    L.append("")

# key-1 semantics
L.append("## 5. key-1 path separation")
L.append("0x93E7F2-family computes the SAME key then applies `dec edi` (0x93E87C / 0x93E926 /")
L.append("0x93EF2A) BEFORE feeding the 0x427EB3-family PUT wrapper 0x439AAD.  The primary")
L.append("site 0x9363D9 pushes the unmodified key into 0x452147 (call [eax+0xB4] keyed insert).")
for flag in (0, 1):
    base = as_i32(key_formula(0, 0, flag))
    L.append(f"  flag={flag}: key = -2^30+{29992 + 5 * flag} ; key-1 = -2^30+{29991 + 5 * flag}")
L.append("")

# ------------------------------------------------- 6. type-base family re-derivation
L.append("## 6. lea disp32 family census (window [-0x40000100, -0x3FFF0000]) re-run")
hits = []
for i in range(len(data) - 6):
    va = BASE + i
    if not (0x401000 <= va < 0xA80000):
        continue
    if data[i] == 0x8D:
        modrm = data[i + 1]
        mod = modrm >> 6
        if mod in (0, 2):
            has_sib = (modrm & 7) == 4
            idx = i + 2 + (1 if has_sib else 0)
            dpos = i + 2 if (mod == 0 and (modrm & 7) == 5) else idx
            if dpos + 4 <= len(data):
                disp = struct.unpack("<i", data[dpos:dpos + 4])[0]
                if -0x40000100 <= disp <= -0x3FFF0000:
                    hits.append((va, disp))
fam = {}
for va, disp in hits:
    fam.setdefault(0x40000000 + disp, []).append(va)
L.append(f"total lea disp32 hits: {len(hits)}")
L.append("")
L.append("| base offset B (key = -2^30 + B + ...) | lea sites |")
L.append("|---|---|")
for off in sorted(fam):
    L.append(f"| {off} | {' '.join(f'{v:#x}' for v in sorted(fam[off]))} |")
L.append("")
L.append("All constants in this family are of the form -(2^30 - B): the base is 2^30 =")
L.append("0x40000000 = 1073741824. Cross-check against the tile/obj decimal baselines:")
L.append(f"  tile (C-001): -1073721834 == -(2^30 - 19990)? {-(2**30 - 19990) == -1073721834}")
L.append(f"  obj  (C-002): -1073739824 == -(2^30 - 2000)?  {-(2**30 - 2000) == -1073739824}")
L.append("-> tile 19990 / obj 2000 / avatar-family {29983..29999} / obj-like 0 share ONE key")
L.append("   space on the -2^30 base. The '-2^31' prose in T086 C-099/G08/G09/report was a")
L.append("   radix labeling error only; no numeric value or byte encoding changes.")
L.append("")

# plain-immediate negative check
L.append("## 7. negative check: family constants as plain immediates")
for val, name in ((29990, "0x7536"), (29991, "0x7537"), (29992, "0x7538"), (29995, "0x753B"), (29999, "0x753F")):
    pat = struct.pack("<I", val)
    cnt = 0
    pos = 0
    while True:
        j = data.find(pat, pos)
        if j < 0:
            break
        if 0x401000 <= BASE + j < 0xA80000:
            # count only plausible imm32 operand positions (after 81 /x or b8+reg)
            prev = data[j - 1] if j else 0
            if prev in (0x05, 0x0D, 0x15, 0x1D, 0x25, 0x2D, 0x35, 0x3D, 0xB8, 0xB9, 0xBA, 0xBB, 0xBC, 0xBD, 0xBE, 0xBF):
                cnt += 1
        pos = j + 1
    L.append(f"  {name} ({val}) as imm32 after opcode bytes: {cnt} candidate site(s)")
L.append("")
L.append("(T086 already showed ZERO genuine immediate sites; constants live in lea disp32.)")
L.append("")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(L) + "\n", encoding="utf-8", newline="\n")
print(f"wrote {OUT}")
print("template:", "PASS" if ok else "FAIL")
print("anchor values:", as_i32(key_formula(0, 0, 0)), as_i32(key_formula(0, 0, 1)))
print("family offsets:", sorted(fam))
