"""Task 012c follow-up: targeted verification of candidate regions.

1. Re-align disassembly of the five candidate loop regions (find the
   instruction chain that actually contains the reported ops and reaches
   the reported backedge target).
2. Find all writers/readers of driver-tail gate slots 0x81C1A5 / 0x81B96D
   via their ebp+disp32 encodings (disp 0x7443191 / 0x7442959).
3. Count raw occurrences of the walker-region encoded-target disps
   (0x7492285, 0x748a787, 0x748a791, 0x748a79b) anywhere in the readable
   surface (byte-level, any context).
"""
from __future__ import annotations

import sys
from pathlib import Path

from capstone import CS_ARCH_X86, CS_MODE_32, Cs

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))
import maple079_probe_cfg as probe  # noqa: E402

ROOT = HERE.parents[1]
WIDE = ROOT / "glm-work" / "scratch" / "tailb-wide-at-probe.bin"
WBASE = 0x819000

md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True

final = bytearray(WIDE.read_bytes())
# re-apply decoders A+B (gates were enforced by maple079_decoder_hunt.py)
key = 0x5D02E67B ^ 0x587ACB01
esi = 0
ebx = 0x860290
while True:
    off = ((ebx + esi) & 0xFFFFFFFF) - WBASE
    val = int.from_bytes(final[off : off + 4], "little")
    val = ((val ^ key) - 0x651CFF63) & 0xFFFFFFFF
    final[off : off + 4] = val.to_bytes(4, "little")
    esi = (esi - 4) & 0xFFFFFFFF
    if esi == 0xFFFFA29C:
        break
edx = 0x85A9BB + 0x5DA4
remaining = 0x1746
while remaining:
    off = edx - WBASE
    val = int.from_bytes(final[off : off + 4], "little")
    val = (val + 0x141E9FC6) & 0xFFFFFFFF
    val ^= 0x75AA4D86
    val = (val + 0x601EFFF4) & 0xFFFFFFFF
    final[off : off + 4] = val.to_bytes(4, "little")
    edx -= 4
    remaining -= 1
buf = bytes(final)


REGIONS = [
    ("cluster-85AB66", 0x85AB30, 0x85ABA8, 0x85AB66, [0x55CF4A65, 0xC3CA32F5, 0x5433C197]),
    ("cluster-8589CF", 0x8589A0, 0x858A40, 0x8589CF, [0x7E32FEF9, 0xEC22EC9D]),
    ("cluster-8581B7", 0x858180, 0x858250, 0x8581B7, [0xD41AEB63, 0xFFFFFF8C]),
    ("cluster-8578E5", 0x8578B0, 0x857950, 0x8578E5, [0xC581F501, 0x04ED815E]),
    ("cluster-81EAD6", 0x81EAA0, 0x81EB70, 0x81EAD6, [0xE9146A99, 0xA3000000]),
    ("cluster-820381", 0x820340, 0x820400, 0x820381, [0x66000000, 0xF2F8]),
]


def try_chain(start: int, end: int, want_ops: list[int], backedge_target: int):
    """Decode linearly from start; return (score, lines) preferring chains
    that contain the candidate op immediates."""
    lines = []
    e = start
    score = 0
    while e < end:
        ins = next(md.disasm(buf[e - WBASE : e - WBASE + 16], e, count=1), None)
        if ins is None:
            return score, lines, False
        lines.append(f"{ins.address:#x}: {ins.mnemonic} {ins.op_str}")
        for op in ins.operands:
            if op.type == 4 + 1:  # X86_OP_IMM == 2? capstone uses ints
                pass
        if hasattr(ins, "operands"):
            for op in ins.operands:
                if getattr(op, "type", None) == 2 and op.imm & 0xFFFFFFFF in want_ops:
                    score += 10
        if ins.mnemonic.startswith("j") and ins.operands and ins.operands[0].type == 2:
            tgt = ins.operands[0].imm & 0xFFFFFFFF
            if tgt == backedge_target:
                score += 5
            if ins.mnemonic == "jmp":
                if tgt == backedge_target:
                    return score, lines, True
                if not (start <= tgt < end):
                    return score, lines, True
        e = ins.address + ins.size
    return score, lines, True


def region_report(name: str, lo: int, hi: int, backedge: int, want: list[int]) -> None:
    print(f"===== {name} [0x{lo:X}-0x{hi:X}] backedge_target=0x{backedge:X}")
    best = None
    for s in range(lo, min(lo + 0x30, hi)):
        score, lines, clean = try_chain(s, hi, want, backedge)
        if clean and (best is None or score > best[0]):
            best = (score, s, lines)
    if best:
        print(f"best chain from 0x{best[1]:X} (score {best[0]}):")
        for line in best[2]:
            print("  ", line)
    else:
        print("  no clean chain")
    print()


# capstone operand type constants
import capstone.x86 as x86_const  # noqa: E402

X86_OP_IMM = x86_const.X86_OP_IMM

# --- slot writer/reader search
SLOTS = {"0x81C1A5": 0x7443191, "0x81B96D": 0x7442959, "0x81A1BD": 0x74411A9}


def slot_refs() -> None:
    for name, disp in SLOTS.items():
        needle = disp.to_bytes(4, "little")
        pos = 0
        sites = []
        while True:
            found = buf.find(needle, pos)
            if found < 0:
                break
            rva = WBASE + found
            # decode the instruction around it: opcode byte before modrm 0x85
            pre = buf[found - 2 : found]
            sites.append((rva, pre.hex()))
            pos = found + 1
        print(f"slot {name} (disp 0x{disp:X}): {len(sites)} byte-occurrences")
        for rva, pre in sites[:40]:
            # disasm assuming opcode at found-2 (1-byte op + modrm 0x85 + disp32)
            for opoff in (2, 1):
                e = rva - opoff
                ins = next(md.disasm(buf[e - WBASE : e - WBASE + 12], e, count=1), None)
                if ins is not None and ins.address + ins.size >= rva + 4 and "[ebp" in ins.op_str:
                    print(f"   0x{rva:X}: {ins.mnemonic} {ins.op_str}")
                    break
            else:
                print(f"   0x{rva:X}: <no ebp decode> prev bytes {pre}")


def disp_counts() -> None:
    for disp in (0x7492285, 0x748A787, 0x748A791, 0x748A79B):
        needle = disp.to_bytes(4, "little")
        pos = 0
        sites = []
        while True:
            found = buf.find(needle, pos)
            if found < 0:
                break
            sites.append(WBASE + found)
            pos = found + 1
        print(f"disp 0x{disp:X} (-> 0x{probe.formed(disp):X}): {len(sites)} occurrences: {[hex(s) for s in sites]}")


if __name__ == "__main__":
    for name, lo, hi, backedge, want in REGIONS:
        region_report(name, lo, hi, backedge, want)
    slot_refs()
    disp_counts()
