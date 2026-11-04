"""Task 012c — decoder-C / next-stage-entry static hunt (Q15, Q4).

Scans the FULL readable Tail B surface at the natural probe stop
(0x00819000-0x00861FFF; wide capture from maple079_wide_capture.py plus the
two confirmed post-probe decoders re-applied offline) for:

1. every reference into the still-encoded region 0x00862000-0x00911B25 and
   into the other non-readable zones (tpuaozxc packed source, Tail A,
   packed raw, ZtlTaskMem slots): direct call/jmp/jcc rel32, push imm32,
   ebp+disp32 formed() references, dword-aligned data pointers — the
   "next stage entry map" Task 012 never compiled (it only scanned
   game-image zones, and only inside the 0xC000 probe window);
2. transform-op clusters (add/sub/xor reg32,imm32, imm>=0x1000) inside
   backward-branch loops — the producer template of rounds 1/3/A/B. The
   matcher must re-find the four known loop bodies (ground truth) before
   any new candidate is trusted;
3. classification of the small uncatalogued write producers left by the
   Task 012 write-logger run (0x834871, 0x82e5e8, 0x821790, 0x82412c,
   0x829b4e, plus the 5-write walker internals);
4. entropy / readability profile of the whole Tail B to re-confirm the
   0x00862000 static boundary.

Reproduction gates enforced before any scanning: client SHA-256; span-1
SHA-256 after decoder A only; span-2 SHA-256 after decoders A+B; round-3
full-span verification against the T2 block.

Method notes: two disassembly layers. (a) A maximal-chain linear sweep that
decodes from every not-yet-covered offset (superset; junk decodes included).
(b) A recursive descent from all catalogued roots following direct transfers
(validated subset). Every hit reports whether its site is validated.

No patching, no execution, no invented API returns. CSV/JSON output only.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from collections import deque
from pathlib import Path

from capstone import CS_ARCH_X86, CS_MODE_32, Cs
from capstone.x86 import X86_OP_IMM, X86_OP_MEM, X86_OP_REG

import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import maple079_probe_cfg as probe  # noqa: E402

ROOT = HERE.parents[1]

WIDE = ROOT / "glm-work" / "scratch" / "tailb-wide-at-probe.bin"

# wide capture maps VA 0x00819000..0x00912000
WBASE = 0x819000
READ_LO = 0x819000
READ_HI = 0x862000  # first byte of the still-encoded region at the stop

# committed SHA-256 records (result/normal-probe-path-analysis.md, timing
# corrected by glm-work Task 012 §1/§5)
SPAN1 = (0x85A530, 0x860294)
SPAN1_SHA = "4ddbdf0e304328b837c2142b3a49064381491ec3edd20fa544d09ab1c8f4ff47"
SPAN2 = (0x85AA4B, 0x860763)
SPAN2_SHA = "d6cfe6b9e933a59ce97291e38325ebd1f75084ba804aaf78682c9220bb0e4172"

ZONES = [
    ("tailb-encoded", 0x862000, 0x912000),
    ("tpuaozxc", 0x912000, 0x9D8000),
    ("tailA", 0x2CE000, 0x7EA000),
    ("packed-raw", 0x001000, 0x2CE000),
]
ZTL = (0x5FC19F, 0x5FC1B0, 0x5FC1C1)


def zone_of(target: int) -> str | None:
    if target in ZTL:
        return "ztl"
    for name, lo, hi in ZONES:
        if lo <= target < hi:
            return name
    return None


# ground-truth producer loop bodies (op sets) for matcher validation
KNOWN_ROUNDS = {
    "round1": {"ops": {(("xor", 0x458541F1)), ("add", 0x2E061E72), ("xor", 0x27D0B2FD)}, "near": 0x81CE47},
    "round3": {"ops": {("add", 0x3DDF4CA1), ("add", 0x1C39E09C), ("xor", 0x61799419)}, "near": 0x8593A1},
    "decA": {"ops": {("xor", 0x5D02E67B), ("xor", 0x587ACB01), ("sub", 0x651CFF63)}, "near": 0x85A464},
    "decB": {"ops": {("add", 0x141E9FC6), ("xor", 0x75AA4D86), ("add", 0x601EFFF4)}, "near": 0x85AA35},
}

ROOTS = [
    (0x81C6C5, "stage2-entry"),
    (0x81CBB3, "host-walk"),
    (0x81CC01, "iat-read"),
    (0x81CC60, "64k-scan"),
    (0x81CCC6, "found-path"),
    (0x81CB10, "t3"),
    (0x81CE47, "round1-producer"),
    (0x81D5D8, "round2-producer"),
    (0x81CEC7, "resolver-helper"),
    (0x81CF01, "export-walker"),
    (0x821750, "shared-wrapper"),
    (0x8593A1, "round3-body"),
    (0x859780, "normal-root"),
    (0x859A61, "detect-root"),
    (0x85A36E, "resolver-fills"),
    (0x85A464, "decA-producer"),
    (0x85AA35, "decB-producer"),
    (0x85EBD5, "patched-jmp-target"),
    (0x85FCC0, "driver-install-entry"),
]

SMALL_PRODUCERS = [0x834871, 0x82E5E8, 0x821790, 0x82412C, 0x829B4E]

md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def apply_decoders(buf: bytearray) -> tuple[bytes, bytes]:
    """Decoder A then B on the wide buffer (base 0x00819000).

    Returns (state_after_A, state_after_A_and_B). Constants identical to
    glm-work/scripts/maple079_post_probe_scan.py (validated there against the
    committed span SHAs); only the buffer base differs.
    """
    mid = bytearray(buf)
    key = 0x5D02E67B ^ 0x587ACB01
    esi = 0
    ebx = 0x860290
    while True:
        off = ((ebx + esi) & 0xFFFFFFFF) - WBASE
        val = int.from_bytes(mid[off : off + 4], "little")
        val = ((val ^ key) - 0x651CFF63) & 0xFFFFFFFF
        mid[off : off + 4] = val.to_bytes(4, "little")
        esi = (esi - 4) & 0xFFFFFFFF
        if esi == 0xFFFFA29C:
            break
    final = bytearray(mid)
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
    return bytes(mid), bytes(final)


# ---------------------------------------------------------------- chains


class ChainCollector:
    """Maximal-chain linear sweep: decode from every uncovered offset.

    Stores lightweight per-instruction records; chains stop at ret /
    indirect transfers / outside-buffer direct jmp; direct jmp inside the
    buffer is followed (cycle-safe via coverage marks).
    """

    def __init__(self, buf: bytes, lo: int):
        self.buf = buf
        self.lo = lo
        self.n = len(buf)
        self.covered: dict[int, int] = {}  # offset -> chain id
        self.records: list[dict] = []

    def run(self) -> None:
        off = 0
        while off < self.n:
            if off in self.covered:
                off += 1
                continue
            # walk one chain starting at off
            chain: list[dict] = []
            p = off
            while p < self.n:
                if p in self.covered and p != off:
                    break
                ins = self._decode(p)
                if ins is None:
                    self.covered[p] = -1
                    p += 1
                    continue
                rec = self._record(ins)
                self.covered[p] = 0  # temporary; fixed when chain stored
                chain.append(rec)
                m = ins.mnemonic
                if m in ("ret", "retf", "leave", "iret", "iretd", "hlt"):
                    break
                if m == "jmp":
                    ops = ins.operands
                    if ops and ops[0].type == X86_OP_IMM:
                        tgt = ops[0].imm
                        if self.lo <= tgt < self.lo + self.n:
                            p = tgt - self.lo
                            if p in self.covered:
                                break
                            continue
                    break
                if m.startswith("j") and m != "jmp":
                    ops = ins.operands
                    if not ops or ops[0].type != X86_OP_IMM:
                        break
                p += ins.size
            # store chain
            base_index = len(self.records)
            for rec in chain:
                rec["chain"] = base_index
                self.records.append(rec)
            for rec in chain:
                self.covered[rec["addr"] - self.lo] = base_index
            off += 1

    def _decode(self, off: int):
        code = self.buf[off : off + 16]
        try:
            ins = next(md.disasm(code, self.lo + off, count=1))
        except StopIteration:
            return None
        return ins

    def _record(self, ins) -> dict:
        rec = {
            "addr": ins.address,
            "size": ins.size,
            "mnem": ins.mnemonic,
            "ops_str": ins.op_str,
            "target": None,   # direct control transfer target
            "kind": "",       # call_rel/jmp_rel/jcc_rel/push_imm
            "formed": None,   # ebp+disp32 formed() target
            "imm_arith": None,  # (mnem, imm) for add/sub/xor reg,imm32
        }
        m = ins.mnemonic
        ops = ins.operands
        if m in ("call", "jmp") or (m.startswith("j") and m != "jmp"):
            if ops and ops[0].type == X86_OP_IMM:
                rec["target"] = ops[0].imm & 0xFFFFFFFF
                rec["kind"] = ("call_rel" if m == "call" else "jmp_rel" if m == "jmp" else "jcc_rel")
        elif m == "push" and ops and ops[0].type == X86_OP_IMM:
            rec["target"] = ops[0].imm & 0xFFFFFFFF
            rec["kind"] = "push_imm"
        elif m in ("add", "sub", "xor") and len(ops) == 2:
            if ops[0].type == X86_OP_REG and ops[1].type == X86_OP_IMM:
                imm = ops[1].imm & 0xFFFFFFFF
                if imm >= 0x1000:
                    rec["imm_arith"] = (m, imm)
        for op in ops:
            if op.type == X86_OP_MEM and ins.reg_name(op.mem.base) == "ebp" and op.mem.disp:
                rec["formed"] = probe.formed(op.mem.disp)
                break
        return rec


def recursive_validated(final: bytes) -> set[int]:
    """Recursive descent from catalogued roots (direct transfers only,
    junk-skip rule included). Returns the set of validated instruction
    addresses."""
    buf = final
    lo, hi = READ_LO, READ_HI
    seen: set[int] = set()
    work: deque[tuple[int, str]] = deque((rva, name) for rva, name in ROOTS)
    budget = 400_000
    while work and budget > 0:
        eip, origin = work.popleft()
        while budget > 0:
            if not (lo <= eip < hi) or eip in seen:
                break
            ins = next(md.disasm(buf[eip - lo : eip - lo + 16], eip, count=1), None)
            if ins is None:
                break
            seen.add(eip)
            budget -= 1
            m = ins.mnemonic
            nxt = eip + ins.size
            ops = ins.operands
            if m == "jmp":
                if ops and ops[0].type == X86_OP_IMM:
                    eip = ops[0].imm & 0xFFFFFFFF
                    continue
                break
            if m in ("ret", "retf", "leave", "iret", "iretd", "hlt"):
                break
            if m == "call":
                if ops and ops[0].type == X86_OP_IMM:
                    work.append((ops[0].imm & 0xFFFFFFFF, origin))
                eip = nxt
                continue
            if m.startswith("j") and m != "jmp":
                if ops and ops[0].type == X86_OP_IMM:
                    tgt = ops[0].imm & 0xFFFFFFFF
                    if tgt == nxt + 1:  # junk-byte skip, not a split
                        eip = tgt
                        continue
                    work.append((tgt, origin))
                eip = nxt
                continue
            eip = nxt
    return seen


# ---------------------------------------------------------------- scans


def entropy(block: bytes) -> float:
    if not block:
        return 0.0
    counts = [0] * 256
    for b in block:
        counts[b] += 1
    n = len(block)
    ent = 0.0
    for c in counts:
        if c:
            p = c / n
            ent -= p * math.log2(p)
    return ent


def profile(final: bytes, wide: bytes) -> list[dict]:
    out = []
    for off in range(0, len(wide), 0x1000):
        block = wide[off : off + 0x1000]
        rva = WBASE + off
        rec = {
            "rva": f"0x{rva:X}",
            "entropy_stop": round(entropy(block), 3),
            "entropy_final": round(entropy(final[off : off + 0x1000]), 3) if off < len(final) else None,
            "prologues": block.count(b"\x55\x8b\xec"),
            "printable_ratio": round(sum(1 for b in block if 32 <= b < 127) / max(1, len(block)), 3),
        }
        out.append(rec)
    return out


def context_disasm(buf: bytes, site: int, before: int = 3, after: int = 3) -> str:
    """Re-decode a small window ending at the instruction at `site`."""
    lo = READ_LO
    # walk back up to 48 bytes collecting decodes that chain into site
    starts = []
    for back in range(1, 49):
        s = site - back
        if s < lo:
            break
        e = s
        chain = []
        ok = False
        for _ in range(24):
            ins = next(md.disasm(buf[e - lo : e - lo + 16], e, count=1), None)
            if ins is None:
                break
            chain.append(ins)
            if ins.address + ins.size == site:
                ok = True
                break
            e = ins.address + ins.size
            if ins.address >= site:
                break
        if ok:
            starts.append(chain)
    chain = starts[0] if starts else []
    lines = [f"{i.address:#x}: {i.mnemonic} {i.op_str}" for i in chain[-before:]]
    ins = next(md.disasm(buf[site - lo : site - lo + 16], site, count=1), None)
    if ins is not None:
        lines.append(f"{ins.address:#x}: {ins.mnemonic} {ins.op_str}")
    e = site + (ins.size if ins else 1)
    for _ in range(after):
        ins = next(md.disasm(buf[e - lo : e - lo + 16], e, count=1), None)
        if ins is None:
            break
        lines.append(f"{ins.address:#x}: {ins.mnemonic} {ins.op_str}")
        e += ins.size
    return " | ".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=ROOT / "glm-work" / "result")
    parser.add_argument("--scratch", type=Path, default=ROOT / "glm-work" / "scratch")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    args.scratch.mkdir(parents=True, exist_ok=True)

    digest = probe.client_sha()
    if digest != probe.EXPECTED_SHA:
        raise SystemExit(f"client hash changed: {digest}")
    if not WIDE.exists():
        raise SystemExit("wide capture missing; run maple079_wide_capture.py first")
    wide = WIDE.read_bytes()
    if len(wide) != 0xF9000:
        raise SystemExit(f"unexpected wide length {len(wide):#x}")

    # gates: decoder reproduction on the wide buffer
    mid, final = apply_decoders(bytearray(wide))
    s1 = sha(mid[SPAN1[0] - WBASE : SPAN1[1] - WBASE])
    s2 = sha(final[SPAN2[0] - WBASE : SPAN2[1] - WBASE])
    print("span1 sha (after decoder A only):", s1, "match" if s1 == SPAN1_SHA else "MISMATCH")
    print("span2 sha (after A+B):          ", s2, "match" if s2 == SPAN2_SHA else "MISMATCH")
    if s1 != SPAN1_SHA or s2 != SPAN2_SHA:
        raise SystemExit("decoder reproduction failed on wide buffer; aborting")

    import maple079_post_probe_scan as pps

    r3 = pps.round3_verify(wide)
    print("round3 verify:", r3["matched"], "/", r3["dwords"])
    if r3["matched"] != r3["dwords"]:
        raise SystemExit("round-3 verification failed on wide buffer")

    readable = final  # VA 0x819000.., first 0x49000 bytes = readable surface

    # ---- layer 1: maximal chains over the readable surface
    cc = ChainCollector(readable[: READ_HI - READ_LO], READ_LO)
    cc.run()
    records = cc.records
    print("chain instructions:", len(records))

    # ---- layer 2: recursive validation from roots
    validated = recursive_validated(readable)
    print("validated instruction addresses:", len(validated))

    # ---- boundary references
    ref_rows = []
    for rec in records:
        site = rec["addr"]
        val = site in validated
        for target, kind in ((rec["target"], rec["kind"]), (rec["formed"], "formed")):
            if target is None:
                continue
            z = zone_of(target)
            if z:
                ref_rows.append(
                    {
                        "site": site,
                        "kind": kind,
                        "zone": z,
                        "target": target,
                        "validated": val,
                        "mnem": rec["mnem"],
                        "ops_str": rec["ops_str"],
                    }
                )
    # dword-aligned data pointers
    ptr_rows = []
    for off in range(0, len(readable) - 4, 4):
        val = int.from_bytes(readable[off : off + 4], "little")
        z = zone_of(val)
        if z:
            ptr_rows.append({"site": READ_LO + off, "zone": z, "value": val, "validated": (READ_LO + off) in validated})
    # dedupe ref_rows
    uniq = {}
    for row in ref_rows:
        uniq[(row["site"], row["kind"], row["target"])] = row
    ref_rows = list(uniq.values())
    print("boundary refs (chains):", len(ref_rows), " data pointers (aligned):", len(ptr_rows))

    # ---- transform-op clusters
    imm_ops = [r for r in records if r["imm_arith"]]
    clusters = []
    used = set()
    for i, r in enumerate(imm_ops):
        if i in used:
            continue
        group = [r]
        used.add(i)
        for j in range(i + 1, len(imm_ops)):
            if j in used:
                continue
            r2 = imm_ops[j]
            if r2["addr"] - group[-1]["addr"] <= 0x40 and r2["chain"] == group[0]["chain"]:
                group.append(r2)
                used.add(j)
            elif r2["addr"] - group[0]["addr"] > 0x40:
                break
        if len(group) >= 2:
            clusters.append(group)
    # loop detection: backward jcc in the same chain covering the cluster
    by_chain: dict[int, list[dict]] = {}
    for r in records:
        by_chain.setdefault(r["chain"], []).append(r)
    cluster_rows = []
    for group in clusters:
        lo_addr = group[0]["addr"]
        hi_addr = group[-1]["addr"]
        loop = None
        for r in by_chain.get(group[0]["chain"], []):
            if r["kind"] == "jcc_rel":
                if r["target"] is not None and r["target"] <= lo_addr and lo_addr <= r["addr"] <= r["target"] + 0x400:
                    if hi_addr <= r["addr"]:
                        loop = (r["addr"], r["target"])
                        break
        ops = [f"{m} {imm:#x}" for m, imm in (g["imm_arith"] for g in group)]
        opset = {(m, imm) for m, imm in (g["imm_arith"] for g in group)}
        known = None
        for name, info in KNOWN_ROUNDS.items():
            kops = {tuple(o) for o in info["ops"]}
            if opset & kops and abs(group[0]["addr"] - info["near"]) <= 0x100:
                known = name
        cluster_rows.append(
            {
                "first": group[0]["addr"],
                "last": group[-1]["addr"],
                "ops": "; ".join(ops),
                "loop_backedge": None if not loop else f"0x{loop[0]:X}->0x{loop[1]:X}",
                "validated": group[0]["addr"] in validated,
                "known_round": known or "",
                "context": context_disasm(readable, group[0]["addr"]),
            }
        )
    # ground-truth check
    found_known = {c["known_round"] for c in cluster_rows if c["known_round"]}
    print("ground-truth rounds re-found:", sorted(found_known))

    # ---- small producer classification context
    producer_ctx = {}
    for rva in SMALL_PRODUCERS:
        producer_ctx[f"0x{rva:X}"] = context_disasm(readable, rva, before=6, after=10)

    # ---- driver tail dump (last readable code before the wall)
    tail_lines = []
    for rec in records:
        if 0x861800 <= rec["addr"] < READ_HI:
            tail_lines.append(
                f"{rec['addr']:#x}: {rec['mnem']} {rec['ops_str']}"
                + (f"  ; -> 0x{rec['target']:X}" if rec["target"] is not None else "")
                + ("  [V]" if rec["addr"] in validated else "")
            )
    (args.scratch / "task012c-driver-tail.txt").write_text("\n".join(tail_lines), encoding="utf-8")

    # ---- outputs
    with (args.out / "task012c-cross-boundary-refs.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["site_rva", "kind", "zone", "target_rva", "reachable_from_roots", "mnemonic", "operands", "context"])
        for row in sorted(ref_rows, key=lambda r: (r["site"], r["kind"])):
            w.writerow(
                [
                    f"0x{row['site']:08X}",
                    row["kind"],
                    row["zone"],
                    f"0x{row['target']:08X}",
                    row["validated"],
                    row["mnem"],
                    row["ops_str"],
                    context_disasm(readable, row["site"]),
                ]
            )
        for row in ptr_rows:
            w.writerow(
                [
                    f"0x{row['site']:08X}",
                    "data-ptr-aligned",
                    row["zone"],
                    f"0x{row['value']:08X}",
                    row["validated"],
                    "-",
                    "-",
                    "dword-aligned pointer candidate (may be data/stray bytes)",
                ]
            )
    with (args.out / "task012c-transform-clusters.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["first_rva", "last_rva", "ops", "loop_backedge", "reachable_from_roots", "known_round", "context"])
        for c in sorted(cluster_rows, key=lambda c: c["first"]):
            w.writerow(
                [
                    f"0x{c['first']:08X}",
                    f"0x{c['last']:08X}",
                    c["ops"],
                    c["loop_backedge"] or "",
                    c["validated"],
                    c["known_round"],
                    c["context"],
                ]
            )

    enc_refs = [r for r in ref_rows if r["zone"] == "tailb-encoded"]
    summary = {
        "gates": {
            "client_sha": digest,
            "span1_sha_match": s1 == SPAN1_SHA,
            "span2_sha_match": s2 == SPAN2_SHA,
            "round3": f"{r3['matched']}/{r3['dwords']}",
        },
        "chain_instructions": len(records),
        "validated_addresses": len(validated),
        "boundary_refs": {
            "total": len(ref_rows),
            "per_zone": {},
            "tailb_encoded_validated": [
                f"0x{r['site']:X}->{r['kind']}->0x{r['target']:X}" for r in enc_refs if r["validated"]
            ],
            "tailb_encoded_unvalidated": len([r for r in enc_refs if not r["validated"]]),
        },
        "data_pointer_candidates": len(ptr_rows),
        "transform_clusters": {
            "total": len(cluster_rows),
            "with_loop": len([c for c in cluster_rows if c["loop_backedge"]]),
            "ground_truth_refound": sorted(found_known),
            "new_loop_clusters": [
                f"0x{c['first']:X} ops={c['ops']} loop={c['loop_backedge']}"
                for c in cluster_rows
                if c["loop_backedge"] and not c["known_round"]
            ],
        },
        "small_producers": producer_ctx,
    }
    for r in ref_rows:
        summary["boundary_refs"]["per_zone"][r["zone"]] = summary["boundary_refs"]["per_zone"].get(r["zone"], 0) + 1
    prof = profile(final, wide)
    summary["readability_profile_nontrivial"] = [
        p for p in prof if p["entropy_stop"] < 6.5 or p["prologues"] >= 8
    ][:80]
    (args.out / "task012c-summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(json.dumps({k: v for k, v in summary.items() if k != "readability_profile_nontrivial"}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
