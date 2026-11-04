"""Last gap: run the decoder-producer template matcher over the plaintext
islands beyond the wall (the readable-surface scan stopped at 0x862000)."""
from __future__ import annotations

import sys
from pathlib import Path

from capstone import CS_ARCH_X86, CS_MODE_32, Cs
from capstone.x86 import X86_OP_IMM, X86_OP_REG

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))
import maple079_probe_cfg as probe  # noqa: E402

ROOT = HERE.parents[1]
WIDE = ROOT / "glm-work" / "scratch" / "tailb-wide-at-probe.bin"
WBASE = 0x819000
wide = WIDE.read_bytes()
md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True

ISLANDS = [
    (0x862000, 0x864000), (0x865500, 0x865700), (0x86AF00, 0x86B300), (0x86E900, 0x86EB00),
    (0x875600, 0x875F00), (0x876000, 0x877E00), (0x877F00, 0x878000), (0x878100, 0x878900),
    (0x87F600, 0x880000), (0x880200, 0x881200), (0x881300, 0x882400), (0x882500, 0x885800),
    (0x885900, 0x886000), (0x886100, 0x888A00), (0x888C00, 0x889600), (0x889700, 0x889B00),
    (0x889C00, 0x88AA00), (0x88CA00, 0x88CB00), (0x890600, 0x890800), (0x896600, 0x896700),
    (0x89D400, 0x89D500), (0x8A3200, 0x8A3400), (0x8A5300, 0x8A5500), (0x8BAD00, 0x8BAF00),
    (0x8C0500, 0x8C0600), (0x8C1000, 0x8C1100), (0x8C1900, 0x8C1A00), (0x8C1C00, 0x8C1E00),
    (0x8C2000, 0x8C2100), (0x8C2600, 0x8C2700), (0x8C3200, 0x8C3400), (0x8C6900, 0x8C6B00),
    (0x8E1600, 0x8E1700), (0x8E4D00, 0x8E4E00), (0x8EE300, 0x8EE400), (0x8F1300, 0x8F1400),
    (0x8F4700, 0x8F4B00), (0x906A00, 0x906B00),
]


def scan(lo: int, hi: int):
    """Collect imm32 arith ops + backward jcc loops from linear chains."""
    data = wide[lo - WBASE : hi - WBASE]
    n = len(data)
    covered = set()
    ops: list[tuple[int, str, int]] = []  # (addr, mnem, imm)
    jccs: list[tuple[int, int]] = []
    off = 0
    while off < n:
        if off in covered:
            off += 1
            continue
        p = off
        while p < n and p not in covered:
            ins = next(md.disasm(data[p : p + 16], lo + p, count=1), None)
            if ins is None:
                covered.add(p)
                p += 1
                continue
            covered.add(p)
            m = ins.mnemonic
            o = ins.operands
            if m in ("add", "sub", "xor") and len(o) == 2 and o[0].type == X86_OP_REG and o[1].type == X86_OP_IMM:
                imm = o[1].imm & 0xFFFFFFFF
                if imm >= 0x1000:
                    ops.append((ins.address, m, imm))
            if m.startswith("j") and m != "jmp" and o and o[0].type == X86_OP_IMM:
                t = o[0].imm & 0xFFFFFFFF
                if t < ins.address:
                    jccs.append((ins.address, t))
            if m == "ret":
                break
            if m == "jmp" and o and o[0].type == X86_OP_IMM:
                t = o[0].imm & 0xFFFFFFFF
                if lo <= t < hi:
                    p = t - lo
                    if p in covered:
                        break
                    continue
                break
            p += ins.size
        off += 1
    # cluster ops within 0x40 bytes
    clusters = []
    i = 0
    while i < len(ops):
        grp = [ops[i]]
        j = i + 1
        while j < len(ops) and ops[j][0] - grp[-1][0] <= 0x40:
            grp.append(ops[j])
            j += 1
        if len(grp) >= 2:
            clusters.append(grp)
        i = j
    hits = []
    for grp in clusters:
        lo_a, hi_a = grp[0][0], grp[-1][0]
        loop = any(t <= lo_a and lo_a <= a <= t + 0x400 and hi_a <= a for a, t in jccs)
        if loop:
            hits.append(grp)
    return len(ops), clusters, hits


total_ops = 0
total_clusters = 0
for lo, hi in ISLANDS:
    nops, clusters, hits = scan(lo, hi)
    total_ops += nops
    total_clusters += len(clusters)
    if clusters:
        print(f"island 0x{lo:X}-0x{hi:X}: {nops} imm-ops, {len(clusters)} clusters, {len(hits)} in-loop")
        for grp in clusters:
            print("   ", "; ".join(f"0x{a:X} {m} 0x{i:X}" for a, m, i in grp))
print(f"\ntotal: {total_ops} imm-ops, {total_clusters} clusters across islands")
