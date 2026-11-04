"""Scratch disassembler for probe-window.bin conflict resolution.

Read-only: dumps selected ranges / entry points of the captured window.
No execution, no patching, no invented API returns.
"""
from __future__ import annotations

import sys
from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from capstone.x86 import X86_OP_MEM, X86_OP_IMM, X86_OP_REG

ROOT = Path(__file__).resolve().parents[2]
WIN = ROOT / ".work" / "task-009" / "probe-window.bin"
BASE = 0x856000
POP = 0x81C6CF
SUB = 0x74436BB

blob = WIN.read_bytes()
END = BASE + len(blob)
md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True


def formed(disp: int) -> int:
    return (POP + disp - SUB) & 0xFFFFFFFF


def disasm(start: int, length: int) -> None:
    code = blob[start - BASE : start - BASE + length]
    for insn in md.disasm(code, start):
        extra = ""
        for op in insn.operands:
            if op.type == X86_OP_MEM and insn.reg_name(op.mem.base) == "ebp" and op.mem.disp:
                extra = f"   ; slot/formed {formed(op.mem.disp):#x}"
        print(f"{insn.address:#010x}  {insn.bytes.hex():18} {insn.mnemonic:<8} {insn.op_str}{extra}")


def hexdump(start: int, length: int) -> None:
    data = blob[start - BASE : start - BASE + length]
    for off in range(0, len(data), 16):
        chunk = data[off : off + 16]
        addr = start + off
        text = " ".join(f"{b:02x}" for b in chunk)
        print(f"{addr:#010x}  {text}")


targets = {
    "ntice-call-and-gadget": (0x8599F0, 0x30),
    "sice-miss-979f": (0x859780, 0x50),
    "siwvid-test": (0x8598B3, 0x20),
    "flag-dispatch-9b8c": (0x859B8C, 0x90),
    "registry-head-9ced": (0x859CE9, 0x40),
    "registry-entry-9ebe": (0x859EBE, 0x40),
    "registry-entry-a307": (0x85A307, 0x40),
    "post-cluster-a36e": (0x85A36E, 0xA0),
}

if __name__ == "__main__":
    for name in sys.argv[1:] or list(targets):
        if name not in targets:
            print(f"unknown target {name}", file=sys.stderr)
            continue
        start, length = targets[name]
        print(f"===== {name} @ {start:#x} (+{length:#x}) =====")
        if name == "ntice-call-and-gadget":
            hexdump(start, length)
        disasm(start, length)
        print()
