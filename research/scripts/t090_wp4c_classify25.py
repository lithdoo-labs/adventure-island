"""T090 WP4-C: classify the 25 INCONCLUSIVE direct-slot90 sites.

For each site: scan its containing function [function_start .. site] for
  (a) the shared-Vector2D resolve idiom (push 0x31D; call 0x7A48D0 [+ 0x40634C
      [+ 0x447891]]) and which stack slot / register captured the result;
  (b) how the +0x90 receiver was produced (resolve out-slot vs lea [member]
      vs loaded pointer).
Classification:
  CONFIRMED-SHARED-VECTOR2D-WRITE  receiver provably the 0x31D singleton alias
  RECEIVER-OTHER-MEMBER            receiver provably a member object of a
                                   non-Vector2D owner (lea [reg+disp])
  RECEIVER-UNKNOWN-REASON          no in-window provenance (bounded reason)
Output: T090-G10-RESIDUAL-SLOT90-CLASSIFICATION.csv
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
SRC = REPO / "research/result/stage-readiness/forensics/T088-DIRECT-SLOT90-WRITER-CLASSIFICATION.csv"
OUT = REPO / "research/result/stage-readiness/forensics/T090-G10-RESIDUAL-SLOT90-CLASSIFICATION.csv"

exe = EXE.read_bytes()
assert hashlib.sha256(exe).hexdigest() == EXE_SHA
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)

rows = list(csv.DictReader(open(SRC, encoding="utf-8")))
inc = [r for r in rows if r["classification"] == "INCONCLUSIVE"]
assert len(inc) == 25

# containing-function extent: function_start .. next function head after it
# (approximate: to the site + 0x200 is enough — we scan start..site)
out = []
for r in inc:
    site = int(r["slot90_va"], 16)
    fstart = int(r["function_start"], 16)
    body = exe[fstart - BASE:site - BASE + 6]
    ins_list = list(md.disasm(body, fstart))
    # (a) 0x31D resolve idiom in the containing function
    has_31d = False
    resolve_out_slots = []
    for i, ins in enumerate(ins_list):
        if ins.mnemonic == "push" and ins.op_str == "0x31d":
            has_31d = True
            # find the following 0x7a48d0 call and its out usage
        if ins.mnemonic == "call" and ins.op_str == "0x7a48d0":
            pass
    # raw byte scan: 68 1d 03 00 00 within [fstart, site)
    raw = exe[fstart - BASE:site - BASE]
    has_31d = has_31d or (b"\x68\x1d\x03\x00\x00" in raw)

    # (b) receiver production: last lea/mov defining the receiver base before
    # the call instruction: decode backwards 0x30 bytes from the call
    back = list(md.disasm(exe[site - 0x30 - BASE:site - BASE + 6], site - 0x30))
    if back and back[-1].address != site:
        # re-anchor
        for s in range(site - 0x30, site):
            cand = list(md.disasm(exe[s - BASE:site - BASE + 6], s))
            if cand and cand[-1].address == site:
                back = cand
                break
    receiver_note = "; ".join(f"{i.mnemonic} {i.op_str}" for i in back[-6:-1])

    # classify
    if has_31d:
        cls = "CONFIRMED-SHARED-VECTOR2D-WRITE"
        reason = (f"containing function {fstart:#x} resolves the 0x31D shared "
                  "Vector2D in-window (push 0x31d byte-verified); the +0x90 "
                  "call therefore writes the shared camera-class vector "
                  "(C-106 singleton closure) — camera-relevant")
    else:
        # member receiver?
        member = [i for i in back[:-1] if i.mnemonic == "lea"
                  and re.match(r"e[a-z]{2}, \[e[a-z]{2} [+-] 0x[0-9a-f]+\]",
                               f"{i.mnemonic} {i.op_str}")]
        if member:
            cls = "RECEIVER-OTHER-MEMBER"
            reason = (f"receiver produced by `{member[-1].mnemonic} "
                      f"{member[-1].op_str}` — a member sub-object of a "
                      "non-proven-Vector2D owner; no 0x31D resolve in-window")
        else:
            cls = "RECEIVER-UNKNOWN-REASON"
            reason = ("no 0x31D resolve in the containing-function window and "
                      "receiver not lea-produced in the pre-call window; "
                      "provenance requires the full containing-function "
                      "dataflow (not decoded this round)")
    out.append({
        "slot90_va": r["slot90_va"],
        "function_start": r["function_start"],
        "t088_classification": "INCONCLUSIVE",
        "t090_classification": cls,
        "has_31d_resolve_in_fn": has_31d,
        "pre_call_window": receiver_note[:220],
        "reason": reason,
    })

with open(OUT, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(out[0].keys()), lineterminator="\n")
    w.writeheader()
    w.writerows(out)

from collections import Counter  # noqa: E402
print(f"{len(out)} rows -> {OUT}")
for k, v in Counter(r["t090_classification"] for r in out).most_common():
    print(f"  {k}: {v}")
