"""Task 012c follow-up 4: structural census of the plaintext islands beyond
the 0x862000 wall (at-stop readable code/data inside the "encoded" region).

Per island: strings, ebp-disp32 slot census, local EBP-base setups
(sub/add ebp, imm32), control transfers (call/jmp/jcc rel32 and push imm32)
targeting other islands / encoded stretches / the readable region / Tail A /
packed raw, and MSVC-prologue counts.

The island list comes from t012c_islandmap.py classification (256B blocks).
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

from capstone import CS_ARCH_X86, CS_MODE_32, Cs
from capstone.x86 import X86_OP_IMM

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))
import maple079_probe_cfg as probe  # noqa: E402

ROOT = HERE.parents[1]
WIDE = ROOT / "glm-work" / "scratch" / "tailb-wide-at-probe.bin"
WBASE = 0x819000
READ_HI = 0x862000

wide = WIDE.read_bytes()
md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True

OLD_BASE_DISP_HI = 0x07  # old-base disps (0x0744xxxx..0x0749xxxx) have MSB 0x07


def zone_of(target: int) -> str:
    if 0x862000 <= target < 0x912000:
        return "beyond-wall"
    if 0x819000 <= target < 0x862000:
        return "readable"
    if 0x912000 <= target < 0x9D8000:
        return "tpuaozxc"
    if 0x2CE000 <= target < 0x7EA000:
        return "TailA"
    if 0x001000 <= target < 0x2CE000:
        return "packed-raw"
    if target in (0x5FC19F, 0x5FC1B0, 0x5FC1C1):
        return "ztl"
    return "other"


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
    (0x8F4700, 0x8F4B00), (0x906A00, 0x906B00), (0x90CB00, 0x912000),
]


def strings_in(data: bytes, base: int):
    out = []
    for m in re.finditer(rb"[\x20-\x7e]{5,}", data):
        out.append((base + m.start(), m.group().decode("ascii")))
    return out


def census(lo: int, hi: int) -> dict:
    data = wide[lo - WBASE : hi - WBASE]
    rec: dict = {"range": f"0x{lo:X}-0x{hi:X}", "size": hi - lo}
    rec["strings"] = strings_in(data, lo)[:80]
    rec["prologues"] = data.count(b"\x55\x8b\xec")
    rec["call5_gadget"] = data.count(bytes.fromhex("e803000000"))

    # ebp base setups: 81 ed imm32 (sub ebp) / 81 c5 imm32 (add ebp)
    bases = []
    for m in re.finditer(rb"\x81\xed(....)", data):
        bases.append(("sub ebp", int.from_bytes(m.group(1), "little"), lo + m.start()))
    for m in re.finditer(rb"\x81\xc5(....)", data):
        bases.append(("add ebp", int.from_bytes(m.group(1), "little"), lo + m.start()))
    rec["ebp_bases"] = [(op, f"0x{imm:X}", f"0x{at:X}") for op, imm, at in bases][:20]

    # linear chain sweep inside the island
    transfers: list[tuple[int, str, int]] = []
    disps: Counter = Counter()
    push_imms: list[tuple[int, int]] = []
    covered = set()
    off = 0
    n = len(data)
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
            ops = ins.operands
            if m in ("call", "jmp") or (m.startswith("j") and m != "jmp"):
                if ops and ops[0].type == X86_OP_IMM:
                    transfers.append((ins.address, m, ops[0].imm & 0xFFFFFFFF))
            elif m == "push" and ops and ops[0].type == X86_OP_IMM:
                v = ops[0].imm & 0xFFFFFFFF
                if 0x400000 <= v < 0xC00000:
                    push_imms.append((ins.address, v))
            for op in ops:
                if op.type == 5:  # X86_OP_MEM
                    pass
            # ebp disp census via raw pattern is done below; here count any
            # [ebp+disp32] via capstone
            if "[ebp" in ins.op_str:
                mm = re.search(r"\[ebp \+ (0x[0-9a-f]+)\]", ins.op_str)
                if mm:
                    disps[int(mm.group(1), 16)] += 1
            if m == "ret":
                break
            if m == "jmp":
                if ops and ops[0].type == X86_OP_IMM:
                    tgt = ops[0].imm & 0xFFFFFFFF
                    if lo <= tgt < hi:
                        p = tgt - lo
                        if p in covered:
                            break
                        continue
                break
            p += ins.size
        off += 1

    rec["disp_census_top"] = [(f"0x{d:X}", f"0x{probe.formed(d):X}", c) for d, c in disps.most_common(15)]
    tz = Counter()
    for site, m, tgt in transfers:
        tz[zone_of(tgt)] += 1
    rec["transfer_zones"] = dict(tz)
    rec["transfers_notable"] = [
        (f"0x{site:X}", m, f"0x{tgt:X}", zone_of(tgt))
        for site, m, tgt in transfers
        if zone_of(tgt) in ("TailA", "packed-raw", "ztl", "tpuaozxc", "readable")
    ][:40]
    rec["push_imm_image"] = [(f"0x{s:X}", f"0x{v:X}", zone_of(v)) for s, v in push_imms][:40]
    return rec


def main() -> None:
    out = [census(lo, hi) for lo, hi in ISLANDS]
    outpath = ROOT / "glm-work" / "scratch" / "task012c-island-census.json"
    outpath.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    # compact console digest
    for rec in out:
        print(f"== {rec['range']} ({rec['size']}B) prologues={rec['prologues']} call5={rec['call5_gadget']} "
              f"zones={rec['transfer_zones']}")
        if rec["ebp_bases"]:
            print("   bases:", rec["ebp_bases"][:6])
        if rec["strings"]:
            print("   strings:", [s for _, s in rec["strings"]][:12])
        if rec["transfers_notable"]:
            print("   notable xfer:", rec["transfers_notable"][:8])
        if rec["push_imm_image"]:
            print("   push-imm:", rec["push_imm_image"][:8])
    print("\nwritten:", outpath)


if __name__ == "__main__":
    main()
