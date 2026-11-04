"""Task 012b scratch: disassemble the resolver wrapper (0x821750) and the
walker name-checksum mix loop (0x81D13F-0x81D186) from the decoded round-1/2
images, plus dump the known wrapper call sites in the probe window.
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE / "scripts"))
import maple079_probe_cfg as probe  # noqa: E402

ROOT = HERE.parent
R1 = ROOT / ".work" / "task-009" / "round-1-post.bin"  # 0x81CEB5-0x824081 (round-1 output; walker lives below 0x81D633)
R2 = ROOT / ".work" / "task-009" / "round-2-post.bin"  # 0x81D633-0x824093 (final for 0x821750)
R1_BASE, R2_BASE = 0x81CEB5, 0x81D633

r1 = R1.read_bytes()
r2 = R2.read_bytes()
win = probe.WINDOW.read_bytes()
probe.blob = win
probe.END = probe.BASE + len(win)
probe.STRINGS = probe.strings()

md = probe.md


def dis(buf, base, start, end):
    eip = start
    while eip < end:
        out = list(md.disasm(buf[eip - base : eip - base + 16], eip, count=1))
        if not out:
            print(f"{eip:#x} <undecodable> {buf[eip-base:eip-base+8].hex()}")
            eip += 1
            continue
        insn = out[0]
        note = ""
        for op in insn.operands:
            if op.type == 1 and insn.reg_name(op.mem.base) == "ebp" if hasattr(op, "mem") else False:
                pass
        print(f"{insn.address:#010x}  {insn.bytes.hex():18} {insn.mnemonic:<10} {insn.op_str}")
        eip = insn.address + insn.size


print("== checksum mix loop 0x81D126-0x81D1A0 (round-1 image) ==")
dis(r1, R1_BASE, 0x81D126, 0x81D1A0)
print()
print("== wrapper 0x821750-0x8217D0 (round-2 image, final state) ==")
dis(r2, R2_BASE, 0x821750, 0x8217D0)
print()
print("== known wrapper call sites in probe window: 0x857E40-0x857EB0 ==")
dis(win, probe.BASE, 0x857E40, 0x857EB0)
