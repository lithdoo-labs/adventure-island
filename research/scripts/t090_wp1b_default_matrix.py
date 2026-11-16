"""T090 WP1-B: G39 delay-consumer default matrix.

For every `push 0x155D` site in the EXE code band: decode the seeding idiom
(`push DEFAULT; push X; mov eax, esp; ... push 0x155D; push eax; call 0x7A48D0`
or register-seeded variants), extract the DEFAULT value (immediate or register
with its provable in-function initialization), locate the containing function
head, and classify the consumer family. Output:
T090-G39-DEFAULT-CONSUMER-MATRIX.csv
"""
import csv
import hashlib
import re
import struct
from pathlib import Path

import capstone

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000
CODE_LO, CODE_HI = 0x401000, 0xBEA000
OUT = REPO / "research/result/stage-readiness/forensics/T090-G39-DEFAULT-CONSUMER-MATRIX.csv"

exe = EXE.read_bytes()
assert hashlib.sha256(exe).hexdigest() == EXE_SHA
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
md.detail = True

# ---- census push 0x155D sites (5-byte push imm32 form)
sites = []
for off in range(CODE_LO - BASE, CODE_HI - BASE - 5):
    if exe[off] == 0x68 and exe[off + 1:off + 5] == b"\x5d\x15\x00\x00":
        sites.append(BASE + off)
assert len(sites) == 36, f"expected 36 sites, got {len(sites)}"


def decode_back(va, span=0x40):
    """Decode instructions immediately before va by finding an anchor that lands
    exactly on va; return (anchor, instructions)."""
    for s in range(va - span, va):
        ok = False
        for ins in md.disasm(exe[s - BASE:va - BASE], s):
            if ins.address + ins.size == va:
                ok = True
            if ins.address >= va:
                break
        if ok:
            ins_list = list(md.disasm(exe[s - BASE:va - BASE], s))
            if ins_list and ins_list[-1].address + ins_list[-1].size == va:
                return s, ins_list
    return None, []


def find_function_head(va, back=0x2000):
    """Nearest preceding SEH prologue (mov eax, imm32; call) or push ebp;mov ebp,esp
    whose linear decode reaches va."""
    best = None
    for s in range(va - back, va):
        b = exe[s - BASE:s - BASE + 6]
        is_seh = len(b) >= 6 and b[0] == 0xB8 and b[5] == 0xE8
        is_std = len(b) >= 3 and b[0] == 0x55 and b[1] == 0x8B and b[2] == 0xEC
        if not (is_seh or is_std):
            continue
        reached = False
        for ins in md.disasm(exe[s - BASE:va - BASE + 1], s):
            if ins.address == va:
                reached = True
                break
            if ins.address > va:
                break
        if reached:
            best = s
            break
    return best


PUSH_REGS = {0x50: "eax", 0x51: "ecx", 0x52: "edx", 0x53: "ebx",
             0x54: "esp", 0x55: "ebp", 0x56: "esi", 0x57: "edi"}


def default_of_site(site):
    """Extract the seeded default for the property-read at `site`.

    The canonical idiom is:
        push DEFAULT        ; 68 imm32 | 6A imm8 | 5x push reg
        push REG            ; 5x
        mov eax, esp        ; 8B E0 / 89 E0
        [mov [ebp-0x1c], esp]  ; 89 65 xx (optional)
        push 0x155D         ; 68 5D 15 00 00   <- the site
    We scan the raw bytes before the site for the `mov eax, esp` anchor and
    take the two pushes above it."""
    off = site - BASE
    window = exe[off - 24:off]
    # find last 'mov eax, esp' (8B C4 primary; 89 C4 alt) before the site
    idx = max(window.rfind(b"\x8b\xc4"), window.rfind(b"\x89\xc4"))
    if idx == -1:
        return None, "no-mov-eax-esp", ""
    seg = window[:idx]
    # walk pushes immediately before the anchor (max 2)
    pushes = []
    i = len(seg)
    while len(pushes) < 2 and i > 0:
        b = seg[i - 1]
        if b in PUSH_REGS:  # push reg (1 byte)
            pushes.append(("reg", PUSH_REGS[b]))
            i -= 1
        elif i >= 5 and seg[i - 5] == 0x68:  # push imm32
            imm = struct.unpack("<i", seg[i - 4:i])[0]
            pushes.append(("imm", imm))
            i -= 5
        elif i >= 2 and seg[i - 2] == 0x6A:  # push imm8
            pushes.append(("imm", struct.unpack("<b", seg[i - 1:i])[0]))
            i -= 2
        else:
            break
    pushes.reverse()
    if not pushes:
        return None, "no-seed-found", window.hex()
    kind, val = pushes[0]
    how = f"{kind}-seed ({'first of the two stack-seed pushes'})"
    return val, how, " ".join(f"push {k}:{v}" for k, v in pushes)


rows = []
for site in sites:
    head = find_function_head(site)
    val, how, ev = default_of_site(site)
    rows.append({
        "site": f"0x{site:X}",
        "function_head": f"0x{head:X}" if head else "",
        "default_value": val if val is not None else "",
        "seed_method": how,
        "seed_evidence": ev,
    })

with open(OUT, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
    w.writeheader()
    w.writerows(rows)

from collections import Counter  # noqa: E402
print(f"sites: {len(rows)} -> {OUT}")
for k, v in Counter(r["default_value"] for r in rows).most_common():
    print(f"  default {k}: {v} sites")
