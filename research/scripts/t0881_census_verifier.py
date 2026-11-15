#!/usr/bin/env python3
"""T088.1 — independent row-level verifier for the 0x31D resolve census CSV.

Re-derives every census row from the SHA-pinned EXE bytes WITHOUT reusing the
generator's code paths (fresh capstone decode per row), and byte-verifies:

  * resolve_va bytes match the declared form (68 1D 03 00 00 / B8+r 1D 03 00 00);
  * every non-empty create_call_va is inside the image code band
    [0x401000, 0xBEA000) (t088.1: the T088 column was +0x400000 on all 76
    non-empty rows, e.g. 0x00DEC4EE for the true call site 0x009EC4EE);
  * the byte at create_call_va is E8 and the rel32 target is 0x447891
    (PcCreateObject wrapper) for every row;
  * the recorded call equals the FIRST `call 0x447891` in the 0x90-byte
    decode window after the resolve site;
  * function_start is the census containing function (t046 census re-derived
    here) and does not exceed resolve_va;
  * empty create_call_va rows genuinely contain no 0x447891 call in-window.

Output: research/result/stage-readiness/forensics/T0881-VA-CALLSITE-VERIFICATION.csv
Exit non-zero on any row mismatch (fail-closed).

Binary identity: EXE .work/task-036/game-image-unpacked.bin
  sha256 d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718
"""
import bisect
import csv
import hashlib
import io
import os
import struct
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXE = os.path.join(REPO, ".work", "task-036", "game-image-unpacked.bin")
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000
CODE_START, CODE_END = 0x1000, 0x7EA000
CENSUS = os.path.join(REPO, "research", "result", "stage-readiness", "forensics",
                      "T088-VECTOR2D-ID31D-RESOLVE-CENSUS.csv")
OUT = os.path.join(REPO, "research", "result", "stage-readiness", "forensics",
                   "T0881-VA-CALLSITE-VERIFICATION.csv")
CREATE = 0x447891
md = Cs(CS_ARCH_X86, CS_MODE_32)


def census_functions(img):
    functions = set()
    for i in range(CODE_START, CODE_END):
        if img[i:i + 3] == b"\x55\x8b\xec":
            functions.add(i)
        elif img[i:i + 5] == b"\x8b\xff\x55\x8b\xec":
            functions.add(i)
    for i in range(CODE_START, CODE_END - 5):
        if img[i] == 0xE8:
            rel = struct.unpack("<i", img[i + 1:i + 5])[0]
            tgt = i + 5 + rel
            if CODE_START <= tgt < CODE_END:
                functions.add(tgt)
    funcs = sorted(functions)
    return funcs


def main():
    img = open(EXE, "rb").read()
    if hashlib.sha256(img).hexdigest() != EXE_SHA:
        raise SystemExit("sha mismatch")
    funcs = census_functions(img)

    def containing(off):
        i = bisect.bisect_right(funcs, off) - 1
        return funcs[i] if i >= 0 else None

    rows = list(csv.DictReader(open(CENSUS, encoding="utf-8", newline="")))
    out = []
    bad = 0
    for r in rows:
        va = int(r["resolve_va"], 16)
        off = va - BASE
        # 1. form bytes
        if r["form"] == "push imm32":
            form_ok = img[off:off + 5] == b"\x68\x1d\x03\x00\x00"
        else:
            form_ok = (0xB8 <= img[off] <= 0xBF
                       and img[off + 1:off + 5] == b"\x1d\x03\x00\x00")
        # 2/3/4. independent first-create-call derivation
        insns = list(md.disasm(img[off:off + 0x90], va))
        first_call = next((i.address for i in insns
                           if i.mnemonic == "call" and i.op_str == hex(CREATE)), None)
        rec = r["create_call_va"].strip()
        if rec:
            rec_va = int(rec, 16)
            in_range = BASE + CODE_START <= rec_va < BASE + CODE_END
            o = rec_va - BASE
            e8 = img[o] == 0xE8
            tgt = rec_va + 5 + struct.unpack("<i", img[o + 1:o + 5])[0] if e8 else None
            first = (first_call == rec_va)
            ok = form_ok and in_range and e8 and tgt == CREATE and first
            reason = ""
            if not in_range:
                reason = "create_call_va outside image code band"
            elif not e8:
                reason = "no E8 opcode at create_call_va"
            elif tgt != CREATE:
                reason = f"E8 target {tgt:#x} != 0x447891"
            elif not first:
                reason = f"not the first 0x447891 call in window (first={first_call and hex(first_call)})"
            elif not form_ok:
                reason = "resolve bytes do not match declared form"
            out.append({
                "resolve_va": r["resolve_va"], "form": r["form"],
                "form_bytes_ok": str(form_ok),
                "recorded_create_call_va": rec,
                "independent_first_call_va": f"{first_call:#010x}" if first_call else "",
                "e8_target": f"{tgt:#010x}" if e8 else "",
                "va_in_code_band": str(in_range),
                "verdict": "PASS" if ok else f"FAIL: {reason}",
            })
        else:
            no_call = first_call is None
            ok = form_ok and no_call
            out.append({
                "resolve_va": r["resolve_va"], "form": r["form"],
                "form_bytes_ok": str(form_ok),
                "recorded_create_call_va": "",
                "independent_first_call_va": "",
                "e8_target": "",
                "va_in_code_band": "n/a",
                "verdict": "PASS (no 0x447891 call in 0x90 window; "
                           "imm32-operand site, reason recorded in census)"
                           if ok else "FAIL: independent decode found a create call",
            })
        if not out[-1]["verdict"].startswith("PASS"):
            bad += 1
        # 5. function_start containment (advisory column)
        f = containing(off)
        fs = int(r["function_start"], 16) - BASE if r["function_start"] else None
        if fs is not None and f is not None and fs != f:
            out[-1]["verdict"] += f" [fn mismatch: csv {r['function_start']} vs census {f + BASE:#010x}]"
            bad += 1

    with open(OUT, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(out[0].keys()), lineterminator="\n")
        w.writeheader()
        w.writerows(out)
    n_pass = sum(1 for o in out if o["verdict"].startswith("PASS"))
    print(f"verified {len(out)} rows: {n_pass} PASS, {bad} FAIL -> {OUT}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
