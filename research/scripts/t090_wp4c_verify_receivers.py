"""T090 WP4-C part 2: receiver-level verification for the 18 candidate sites.

For each +0x90 call: identify the receiver base register (call modrm), find its
producing instruction in the pre-call window, and classify:
  - receiver loaded from a stack/局部 slot that is the OUT of a 0x31D resolve
    chain (0x7A48D0/0x40634C/0x447891) -> SHARED
  - receiver is [reg+disp] member or the result of 0x427EB3/0x427DE0/slot25
    creation -> OTHER (per-object)
  - else UNKNOWN with the concrete reason
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
SRC = REPO / "research/result/stage-readiness/forensics/T090-G10-RESIDUAL-SLOT90-CLASSIFICATION.csv"

exe = EXE.read_bytes()
assert hashlib.sha256(exe).hexdigest() == EXE_SHA
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)

REGS = {0: "eax", 1: "ecx", 2: "edx", 3: "ebx", 4: "esp", 5: "ebp", 6: "esi", 7: "edi"}

rows = list(csv.DictReader(open(SRC, encoding="utf-8")))
cands = [r for r in rows if r["t090_classification"] == "CONFIRMED-SHARED-VECTOR2D-WRITE"]

out_rows = []
for r in rows:
    site = int(r["slot90_va"], 16)
    off = site - BASE
    # decode the call to get the receiver register
    modrm = exe[off + 1]
    if (modrm >> 3) & 7 != 2:
        out_rows.append(dict(r, receiver_reg="", receiver_def="", verified="non-disp32 form"))
        continue
    mod = modrm >> 6
    rm = modrm & 7
    disp_len = {0: 0, 1: 1, 2: 4}[mod]
    call_len = 2 + (1 if rm == 4 else 0) + disp_len
    reg = REGS[rm] if rm != 4 else "SIB"

    fstart = int(r["function_start"], 16)
    # decode the whole containing function (to site) once
    fn = list(md.disasm(exe[fstart - BASE:site - BASE + call_len], fstart))

    # find where the 0x31D resolve chain stores its out (lea ecx/edx, [ebp-X]
    # feeding 0x447891 or [ebp-X] capture of resolve result) and all writes to
    # the receiver register
    resolve_slots = set()
    defs = []
    for i, ins in enumerate(fn):
        if ins.mnemonic == "lea" and re.match(
                r"(ecx|edx|eax), \[ebp [+-] 0x[0-9a-f]+\]", f"{ins.mnemonic} {ins.op_str}"):
            # look ahead: is it pushed before 0x7a48d0 or 0x447891?
            for j in range(i + 1, min(i + 8, len(fn))):
                if fn[j].mnemonic == "call" and fn[j].op_str in ("0x7a48d0", "0x447891", "0x40634c"):
                    resolve_slots.add(ins.op_str.split(", ")[1])
                    break
        if ins.mnemonic == "mov" and ins.op_str.startswith(f"{reg}, "):
            defs.append((ins.address, ins.op_str))
        if ins.mnemonic == "lea" and ins.op_str.startswith(f"{reg}, "):
            defs.append((ins.address, ins.op_str))

    last_def = defs[-1] if defs else None
    verified = "UNKNOWN"
    note = ""
    if last_def:
        src = last_def[1]
        m = re.match(rf"{reg}, (dword ptr )?\[(\w+)( [+-] 0x[0-9a-f]+)?\]", src)
        if m and f"[{m.group(2)}{m.group(3) or ''}]" in {s for s in resolve_slots} | resolve_slots:
            verified = "SHARED-RESOLVE-OUT"
            note = f"receiver {reg} <- {src} (a 0x31D resolve out-slot)"
        elif m and m.group(3):
            verified = "MEMBER-OR-OTHER"
            note = f"receiver {reg} <- {src} (member/other-object deref)"
        else:
            verified = "UNKNOWN"
            note = f"receiver {reg} <- {src}"
    else:
        note = f"no in-window def of {reg}"

    out_rows.append(dict(r, receiver_reg=reg, receiver_def=str(last_def), verified=verified,
                         receiver_note=note))

# rewrite CSV with added columns
fieldnames = list(out_rows[0].keys())
with open(SRC, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
    w.writeheader()
    w.writerows(out_rows)

from collections import Counter  # noqa: E402
for r in out_rows:
    print(r["slot90_va"], r["verified"], "|", r.get("receiver_note", "")[:90])
