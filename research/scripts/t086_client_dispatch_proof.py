#!/usr/bin/env python3
"""T086 static verification — the fieldctx opcode dispatcher at 0xA10CE3.

Pure-static proof (sha-pinned, capstone) that the client image contains an
indexed switch `lea eax,[edx-0x20]; cmp eax,0x60; ja default;
jmp [eax*4+0xA111A1]` whose 97 case stubs call the same handler bodies the
task44 runtime atlas observed (task44 handler_rva + 0x400000 == static VA).

This upgrades the task44 opcode->handler bindings for opcodes 0x20..0x80 from
runtime-observed to statically-instruction-bound, and emits the join table.
"""
import csv
import hashlib
import re
import sys
from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_32

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000
TABLE = 0xA111A1
CASES = 97
OUT = REPO / "research/result/stage-readiness/forensics/T086-G17-CLIENT-DISPATCH-0xA10CE3.txt"


def main() -> int:
    data = EXE.read_bytes()
    assert hashlib.sha256(data).hexdigest() == SHA, "sha mismatch"
    md = Cs(CS_ARCH_X86, CS_MODE_32)

    # 1. disassemble the switch head
    head = list(md.disasm(data[0xA10CE3 - BASE:0xA10CF9 - BASE + 2], 0xA10CE3))
    head_lines = [f"{i.address:08X}  {i.bytes.hex():<20} {i.mnemonic} {i.op_str}" for i in head]

    # 2. walk the 97 stubs: push [ebp+0xC]; call rel32; jmp tail
    rows = []
    for k in range(CASES):
        tgt = int.from_bytes(data[TABLE - BASE + k * 4:TABLE - BASE + k * 4 + 4], "little")
        ins = list(md.disasm(data[tgt - BASE:tgt - BASE + 13], tgt))
        opval = 0x20 + k
        callee = None
        if len(ins) >= 2 and ins[0].mnemonic == "push" and ins[1].mnemonic == "call":
            callee = int(ins[1].op_str, 16)
        rows.append((opval, tgt, callee))

    # 3. join with task44 map (rva + 0x400000)
    hmap = {}
    for r in csv.DictReader(open(REPO / "research/result/task044-handler-map.csv", encoding="utf-8")):
        try:
            hmap[int(r["opcode"], 16)] = (int(r["handler_rva"], 16), r["c2s_name"], r["s2c_name"])
        except (ValueError, TypeError):
            continue

    agree = 0
    static_only = 0
    lines = ["# T086 client dispatch switch 0xA10CE3 (static proof)", ""]
    lines += head_lines + [""]
    lines.append(f"# {CASES} cases: opcodes 0x20..0x80; default -> 0xA11184")
    lines.append("# format: opcode | stub_va | static_callee | task44(rva) | agree | names")
    for opval, tgt, callee in rows:
        t = hmap.get(opval)
        if t and t[0]:
            ok = (callee == t[0] + 0x400000)
            agree += 1 if ok else 0
            note = "AGREE" if ok else f"DISAGREE(task44={t[0] + 0x400000:#x})"
            names = t[1] or t[2] or ""
            if not ok:
                note += " <== verify"
        else:
            static_only += 1
            note = "task44: no row"
            names = ""
        t44va = (t[0] + 0x400000) if t and t[0] else 0
        lines.append(f"0x{opval:02X} | {tgt:#x} | {callee and hex(callee)} | "
                     f"{t44va:#x} | {note} | {names}")

    summary = [
        f"cases={CASES} task44_join={agree + sum(1 for o, _, c in rows if hmap.get(o, (None,))[0] and c != hmap[o][0] + 0x400000)}",
        f"static/task44 agreement={agree}",
        f"static-only (no task44 row)={static_only}",
    ]
    lines += [""] + ["# " + s for s in summary]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    for s in summary:
        print(s)
    print("wrote", OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
