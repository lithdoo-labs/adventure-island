"""Task 012b parts 2+3:
(2) blind-test the known transform constants against the still-encoded
    T2 region 0x862000-0x912000, looking for emergent structure;
(3) search readable buffers for writers of flag slots 0x81BAB5 / 0x8191F1.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE / "scripts"))
import maple079_probe_cfg as probe  # noqa: E402

ROOT = HERE.parent
t2 = (ROOT / ".work" / "task-006" / "tail-b-nonzero.bin").read_bytes()[0x14:]
TBASE = 0x819014
r1 = (ROOT / ".work" / "task-009" / "round-1-post.bin").read_bytes()
r2 = (ROOT / ".work" / "task-009" / "round-2-post.bin").read_bytes()
win = probe.WINDOW.read_bytes()


def entropy(b: bytes) -> float:
    if not b:
        return 0.0
    cnt = [0] * 256
    for x in b:
        cnt[x] += 1
    e = 0.0
    for c in cnt:
        if c:
            p = c / len(b)
            e -= p * math.log2(p)
    return e


def score(buf: bytes) -> dict:
    strings = 0
    run = 0
    for b in buf:
        if 32 <= b < 127:
            run += 1
            if run >= 5:
                strings += 1
                run = 0
        else:
            run = 0
    return {"entropy": entropy(buf), "ascii5": strings, "prologue": buf.count(b"\x55\x8b\xec")}


LO, HI = 0x862000, 0x911B25
region = t2[LO - TBASE : HI - TBASE]
base = score(region)
print("baseline (raw T2 0x862000-0x911B25):", {k: round(v, 3) if isinstance(v, float) else v for k, v in base.items()})

CONSTS = {
    "r1 xor 0x458541F1": ("xor", 0x458541F1),
    "r1 add 0x2E061E72": ("add", 0x2E061E72),
    "r1 xor 0x27D0B2FD": ("xor", 0x27D0B2FD),
    "r3 add 0x3DDF4CA1": ("add", 0x3DDF4CA1),
    "r3 add 0x1C39E09C": ("add", 0x1C39E09C),
    "r3 xor 0x61799419": ("xor", 0x61799419),
    "decA key xor": ("xor", 0x5D02E67B ^ 0x587ACB01),
    "decA sub 0x651CFF63": ("sub", 0x651CFF63),
    "decB add 0x141E9FC6": ("add", 0x141E9FC6),
    "decB xor 0x75AA4D86": ("xor", 0x75AA4D86),
    "decB add 0x601EFFF4": ("add", 0x601EFFF4),
}
print("\n-- single-op blind tests (full region) --")
best = []
for name, (op, k) in CONSTS.items():
    out = bytearray()
    for i in range(0, len(region) - 4, 4):
        v = int.from_bytes(region[i : i + 4], "little")
        if op == "xor":
            v ^= k
        elif op == "add":
            v = (v + k) & 0xFFFFFFFF
        else:
            v = (v - k) & 0xFFFFFFFF
        out += v.to_bytes(4, "little")
    s = score(bytes(out))
    marker = ""
    if s["ascii5"] > base["ascii5"] * 3 or s["prologue"] > 20:
        marker = "  <== STRUCTURE?"
    print(f"  {name:>22}: {s}{marker}")
    best.append((s["ascii5"] + s["prologue"], name))

print("\n-- flag-slot writer search --")
# formed(disp) = 0x81C6CF + disp - 0x74436BB  =>  disp = slot - 0x81C6CF + 0x74436BB
SLOTS = {0x81BAB5: "flag1", 0x8191F1: "flag2"}
DISPS = {}
for slot, name in SLOTS.items():
    DISPS[(slot - 0x81C6CF + 0x74436BB) & 0xFFFFFFFF] = (slot, name)

MODRM = {0x85: "eax", 0x8D: "ecx", 0x95: "edx", 0x9D: "ebx", 0xA5: "esp", 0xAD: "ebp", 0xB5: "esi", 0xBD: "edi"}
BUFS = {
    "probe-window(T2native+round3)": (win, probe.BASE),
    "round1-post(walker region)": (r1, 0x81CEB5),
    "round2-post": (r2, 0x81D633),
}
for bname, (buf, bbase) in BUFS.items():
    hits = []
    for i in range(len(buf) - 8):
        if buf[i] in (0x89, 0xC7) and buf[i + 1] in MODRM:
            disp = int.from_bytes(buf[i + 2 : i + 6], "little")
            if disp in DISPS:
                slot, sname = DISPS[disp]
                tail = buf[i + 6 : i + 8].hex() if buf[i] == 0x89 else buf[i + 6 : i + 10].hex()
                hits.append((bbase + i, sname, MODRM[buf[i + 1]], tail))
    print(f"  {bname}: {len(hits)} write-form hits")
    for h in hits:
        print(f"    {h[0]:#x}: mov [slot {SLOTS and ''}{h[1]}], {h[2]} (tail {h[3]})")
