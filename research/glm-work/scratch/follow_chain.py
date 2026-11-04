"""Follow the gadget chain from 0x859B8C exactly as executed (static replay of
direct transfers only).  Junk bytes between gadgets are skipped by the jumps.
"""
from __future__ import annotations

from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from capstone.x86 import X86_OP_IMM, X86_OP_MEM, X86_OP_REG

ROOT = Path(__file__).resolve().parents[2]
blob = (ROOT / ".work" / "task-009" / "probe-window.bin").read_bytes()
BASE = 0x856000
END = BASE + len(blob)
POP = 0x81C6CF
SUB = 0x74436BB
md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True


def one(rva: int):
    if not (BASE <= rva < END):
        return None
    out = list(md.disasm(blob[rva - BASE : rva - BASE + 16], rva, count=1))
    return out[0] if out else None


def formed(disp: int) -> int:
    return (POP + disp - SUB) & 0xFFFFFFFF


def follow(start: int, limit: int = 60) -> None:
    eip = start
    for step in range(limit):
        insn = one(eip)
        if insn is None:
            print(f"{eip:#x} <outside window>")
            return
        extra = ""
        if insn.mnemonic == "call" and insn.operands[0].type == X86_OP_MEM:
            mem = insn.operands[0].mem
            if insn.reg_name(mem.base) == "ebp":
                extra = f"   ; slot {formed(mem.disp):#x}"
        if "ebp" in insn.op_str and insn.mnemonic in ("mov", "cmp", "push") :
            for op in insn.operands:
                if op.type == X86_OP_MEM and insn.reg_name(op.mem.base) == "ebp" and op.mem.disp:
                    extra = f"   ; slot {formed(op.mem.disp):#x}"
                    break
        print(f"{insn.address:#010x}  {insn.bytes.hex():18} {insn.mnemonic:<8} {insn.op_str}{extra}")
        mnem, nxt = insn.mnemonic, insn.address + insn.size
        op = insn.operands[0] if insn.operands else None
        if mnem in ("jmp",) and op.type == X86_OP_IMM:
            eip = op.imm
            continue
        if mnem == "call" and op.type == X86_OP_IMM:
            eip = op.imm  # descend into local gadget helpers
            continue
        if mnem.startswith("j") and op.type == X86_OP_IMM:
            print(f"    -> conditional split: fall {nxt:#x}  take {op.imm:#x}")
            return
        if mnem in ("call",):
            print(f"    -> api/indirect call {insn.op_str}, continues {nxt:#x}")
            eip = nxt
            continue
        if mnem in ("ret", "retf"):
            print("    -> ret (stack value not tracked here)")
            return
        eip = nxt


if __name__ == "__main__":
    print("=== chain from NTICE miss edge 0x859A0B ===")
    follow(0x859A0B)
    print()
    print("=== chain from 0x859B8C ===")
    follow(0x859B8C, 40)
