"""Task 012c — beyond-the-wall static map (0x00862000-0x00911B25).

Established by this task: the region Task 012b treated as uniformly encoded
is in fact MIXED at the probe stop:

- ~13% plaintext "islands" of protector code/data (readable now),
- the rest still encoded (no global short-period XOR keystream; period
  autocorrelation of the big encoded stretches stays near noise, only a
  weak dword-family bump at periods 12/16/20/24/28/32).

This script re-derives, from the wide probe-stop capture only:

1. the island map (256B-block classification: entropy, call+$+5 gadget
   density, pushal/popal density, ebp+disp32-with-0x07-MSB density,
   printable ratio, fill-page detection);
2. per-island census: strings, local EBP bases (sub/add ebp, imm32),
   MSVC prologue counts, transfer-zone histogram, references into
   game-image zones;
3. wrapper thunk tables: every `push imm32 ; jmp 0x00821750` pair in the
   whole Tail B (input for the future descriptor->checksum decoding task);
   validation gate: the known wrapper training pairs in the readable
   region (0x857E4A-0x857E86 area) must be re-found.

Gates: client SHA-256, wide-capture length. No execution, no patching.
Outputs CSV/JSON only.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
from collections import Counter
from pathlib import Path

from capstone import CS_ARCH_X86, CS_MODE_32, Cs
from capstone.x86 import X86_OP_IMM

import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import maple079_probe_cfg as probe  # noqa: E402

ROOT = HERE.parents[1]
WIDE = ROOT / "glm-work" / "scratch" / "tailb-wide-at-probe.bin"
WBASE = 0x819000
WALL = 0x862000
ZONE_END = 0x912000
WRAPPER = 0x821750
# known wrapper-form training sites (Task 012b session-2 walker log):
# 0x857E4A/0x857E68 -> LoadLibraryA, 0x857E7C -> GetLocalTime
TRAINING_SITES = {0x857E4A, 0x857E68, 0x857E7C}

md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True


def entropy(block: bytes) -> float:
    if not block:
        return 0.0
    c = Counter(block)
    n = len(block)
    return -sum((v / n) * math.log2(v / n) for v in c.values())


def zone_of(target: int) -> str:
    if WALL <= target < ZONE_END:
        return "beyond-wall"
    if 0x819000 <= target < WALL:
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


def island_rows(wide: bytes):
    rows = []
    for rva in range(WALL, ZONE_END, 0x100):
        blk = wide[rva - WBASE : rva - WBASE + 0x100]
        if len(blk) < 0x100:
            break
        ent = entropy(blk)
        call5 = blk.count(bytes.fromhex("e803000000"))
        pushpop = blk.count(b"\x60\x61")
        disp = sum(1 for i in range(len(blk) - 4) if blk[i] == 0x85 and blk[i + 4] == 0x07)
        printable = sum(1 for b in blk if 32 <= b < 127) / len(blk)
        same = blk.count(blk[0:1]) / len(blk)
        fill = same > 0.98
        island = (
            not fill
            and (ent < 5.5 or call5 + pushpop + disp >= 3 or (printable > 0.85 and ent < 6.2))
        )
        rows.append(
            {"rva": rva, "entropy": round(ent, 3), "call5": call5, "pushpop": pushpop,
             "disp07": disp, "printable": round(printable, 3), "fill": fill, "island": island}
        )
    return rows


def merge(rows):
    spans = []
    cur = None
    for r in rows:
        if r["island"]:
            if cur and cur[1] == r["rva"]:
                cur[1] = r["rva"] + 0x100
            else:
                if cur:
                    spans.append(tuple(cur))
                cur = [r["rva"], r["rva"] + 0x100]
        else:
            if cur:
                spans.append(tuple(cur))
                cur = None
    if cur:
        spans.append(tuple(cur))
    return spans


def census(wide: bytes, lo: int, hi: int) -> dict:
    data = wide[lo - WBASE : hi - WBASE]
    rec: dict = {"range": f"0x{lo:X}-0x{hi:X}", "size": hi - lo}
    rec["strings"] = [
        (f"0x{lo + m.start():X}", m.group().decode("ascii"))
        for m in re.finditer(rb"[\x20-\x7e]{6,}", data)
    ][:60]
    rec["prologues"] = data.count(b"\x55\x8b\xec")
    rec["call5_gadget"] = data.count(bytes.fromhex("e803000000"))
    bases = []
    for m in re.finditer(rb"\x81\xed(....)", data):
        bases.append((f"sub ebp 0x{int.from_bytes(m.group(1), 'little'):X}", f"0x{lo + m.start():X}"))
    for m in re.finditer(rb"\x81\xc5(....)", data):
        bases.append((f"add ebp 0x{int.from_bytes(m.group(1), 'little'):X}", f"0x{lo + m.start():X}"))
    rec["ebp_bases"] = bases[:24]

    transfers = []
    push_imms = []
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
            if m == "ret":
                break
            if m == "jmp" and ops and ops[0].type == X86_OP_IMM:
                tgt = ops[0].imm & 0xFFFFFFFF
                if lo <= tgt < hi:
                    p = tgt - lo
                    if p in covered:
                        break
                    continue
                break
            p += ins.size
        off += 1
    tz = Counter(zone_of(t) for _, _, t in transfers)
    rec["transfer_zones"] = dict(tz)
    rec["notable"] = [
        (f"0x{s:X}", m, f"0x{t:X}", zone_of(t))
        for s, m, t in transfers
        if zone_of(t) in ("TailA", "packed-raw", "ztl", "tpuaozxc", "readable")
    ][:40]
    rec["push_imm_image"] = [(f"0x{s:X}", f"0x{v:X}", zone_of(v)) for s, v in push_imms][:40]
    return rec


def thunk_pairs(wide: bytes):
    """All `push imm32 ; jmp rel32->0x821750` pairs in the whole capture."""
    out = []
    data = wide
    n = len(data)
    for i in range(n - 10):
        if data[i] == 0x68 and data[i + 5] == 0xE9:
            rel = int.from_bytes(data[i + 6 : i + 10], "little", signed=True)
            tgt = (WBASE + i + 5 + 5 + rel) & 0xFFFFFFFF
            if tgt == WRAPPER:
                imm = int.from_bytes(data[i + 1 : i + 5], "little")
                out.append((WBASE + i, imm))
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=ROOT / "glm-work" / "result")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    digest = probe.client_sha()
    if digest != probe.EXPECTED_SHA:
        raise SystemExit(f"client hash changed: {digest}")
    wide = WIDE.read_bytes()
    if len(wide) != 0xF9000:
        raise SystemExit(f"unexpected wide length {len(wide):#x}")

    rows = island_rows(wide)
    spans = merge(rows)
    fill_bytes = sum(0x100 for r in rows if r["fill"])
    island_bytes = sum(b - a for a, b in spans)

    with (args.out / "beyond-wall-island-map.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["island_start", "island_end", "size", "kind"])
        for a, b in spans:
            kind = "code/data island"
            w.writerow([f"0x{a:08X}", f"0x{b:08X}", b - a, kind])

    censuses = [census(wide, a, b) for a, b in spans]

    pairs = thunk_pairs(wide)
    known_hits = [p for p in pairs if p[0] in TRAINING_SITES]
    gate = len(known_hits) == len(TRAINING_SITES)
    print("thunk-pair training gate (3 known wrapper sites re-found):", gate)
    beyond = [(s, i) for s, i in pairs if s >= WALL]
    readable = [(s, i) for s, i in pairs if s < WALL]
    with (args.out / "beyond-wall-thunk-tables.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["thunk_site_rva", "descriptor_imm", "region"])
        for s, i in readable:
            w.writerow([f"0x{s:08X}", f"0x{i:08X}", "readable(known training zone)" if s in TRAINING_SITES else "readable"])
        for s, i in beyond:
            w.writerow([f"0x{s:08X}", f"0x{i:08X}", "beyond-wall"])

    summary = {
        "gates": {"client_sha": digest, "wide_len": hex(len(wide)), "thunk_training_gate": gate},
        "zone": f"0x{WALL:X}-0x{ZONE_END:X}",
        "island_bytes": island_bytes,
        "island_ratio": round(island_bytes / (ZONE_END - WALL), 4),
        "island_count": len(spans),
        "fill_block_bytes": fill_bytes,
        "thunk_pairs": {"readable": len(readable), "beyond_wall": len(beyond)},
        "islands": censuses,
    }
    (args.out / "task012c-beyond-wall-summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"islands: {len(spans)} ranges, {island_bytes} bytes ({summary['island_ratio']*100:.1f}%)")
    print(f"thunk pairs: readable={len(readable)} beyond-wall={len(beyond)}")
    for rec in censuses:
        if rec["strings"] or rec["ebp_bases"]:
            print(f"  {rec['range']}: strings={[s for _, s in rec['strings']][:6]} bases={len(rec['ebp_bases'])}")


if __name__ == "__main__":
    main()
