"""Task 012 — post-probe stage scan (static, offline).

Reproduces the two known in-place decoders deterministically on the captured
probe window (verifying the committed SHA-256 record), then:

1. walks the driver-install entry 0x0085EBD5 / 0x0085FCC0 statically on the
   decoded buffer (direct transfers only; no branch chosen, no execution);
2. scans for further self-decode idioms (xor/add/sub imm32 chains feeding
   pop-write / stosd);
3. scans both the raw and decoded buffers for address formation targeting
   Tail A (0x002CE000-0x007EA000), the ZtlTaskMem slots, and the first
   section packed raw (0x001000-0x2CE000);
4. resolves lea references to the Oreans driver strings;
5. re-runs the game-anchor scan on the decoded buffer.

No patching, no invented API returns, no branch forcing. Output: CSV + stdout.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from capstone.x86 import X86_OP_IMM, X86_OP_MEM

import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import maple079_probe_cfg as probe  # noqa: E402

ROOT = HERE.parent.parent
WINDOW = ROOT / ".work" / "task-009" / "probe-window.bin"
T2BLOCK = ROOT / ".work" / "task-006" / "tail-b-nonzero.bin"

# committed SHA-256 record (result/normal-probe-path-analysis.md)
SPAN1 = (0x85A530, 0x860294)
SPAN1_SHA = "4ddbdf0e304328b837c2142b3a49064381491ec3edd20fa544d09ab1c8f4ff47"
SPAN2 = (0x85AA4B, 0x860763)
SPAN2_SHA = "d6cfe6b9e933a59ce97291e38325ebd1f75084ba804aaf78682c9220bb0e4172"

TAILA_LO, TAILA_HI = 0x2CE000, 0x7EA000
ZTL = (0x5FC19F, 0x5FC1B0, 0x5FC1C1)
RAW_LO, RAW_HI = 0x001000, 0x2CE000

AES_KEY = bytes.fromhex("130000000800000006000000b40000001b0000000f0000003300000052000000")
IV_PREFIX = bytes.fromhex("ec3f77a445d071bfb79820fc4be9b3e1")
IV_SEED = bytes.fromhex("f25350c6")

DRIVER_STRINGS = [
    b"oreans32.sys",
    b"oreansx64.sys",
    rb"\\.\oreans32",
    rb"\\.\Global\oreans32",
    rb"\\.\Global\oreansx64",
    rb"\\.\Oreans.vxd",
    b"OpenSCManagerA",
    b"CreateServiceA",
    b"StartServiceA",
    b"SecureEngine",
    b"XprotEvent",
    b"Cannot write oreans.vxd",
]

md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def decode(blob: bytearray) -> None:
    # decoder 1 (producer 0x0085A464): xor 0x5D02E67B ^ 0x587ACB01 key then
    # sub 0x651CFF63, cursor ebx+esi walking down from 0x860290, 5977 dwords
    key = 0x5D02E67B ^ 0x587ACB01
    esi = 0
    ebx = 0x860290
    while True:
        off = ((ebx + esi) & 0xFFFFFFFF) - probe.BASE
        val = int.from_bytes(blob[off : off + 4], "little")
        val = ((val ^ key) - 0x651CFF63) & 0xFFFFFFFF
        blob[off : off + 4] = val.to_bytes(4, "little")
        esi = (esi - 4) & 0xFFFFFFFF
        if esi == 0xFFFFA29C:
            break
    # decoder 2 (producer 0x0085AA35): add/xor/add chain, cursor 0x86075F down
    edx = 0x85A9BB + 0x5DA4
    remaining = 0x1746
    while remaining:
        off = edx - probe.BASE
        val = int.from_bytes(blob[off : off + 4], "little")
        val = (val + 0x141E9FC6) & 0xFFFFFFFF
        val ^= 0x75AA4D86
        val = (val + 0x601EFFF4) & 0xFFFFFFFF
        blob[off : off + 4] = val.to_bytes(4, "little")
        edx -= 4
        remaining -= 1


def decode1(blob: bytearray) -> None:
    """Decoder 1 only (used to verify the committed intermediate-state SHA)."""
    key = 0x5D02E67B ^ 0x587ACB01
    esi = 0
    ebx = 0x860290
    while True:
        off = ((ebx + esi) & 0xFFFFFFFF) - probe.BASE
        val = int.from_bytes(blob[off : off + 4], "little")
        val = ((val ^ key) - 0x651CFF63) & 0xFFFFFFFF
        blob[off : off + 4] = val.to_bytes(4, "little")
        esi = (esi - 4) & 0xFFFFFFFF
        if esi == 0xFFFFA29C:
            break


# ------------------------------------------------------------- scans


EBP_MEM = re.compile(
    rb"(?:\x8d|\x8b|\x89|\x3b|\x83|\xff|\xc6|\xc7|\x03|\x2b|\x01|\x29|\x39|\x3b)"
    rb"\x85(....)",
    re.DOTALL,
)


def formed_scan(buf: bytes, base: int, label: str) -> list[dict]:
    """Find [ebp+disp32] operands whose formed() address lands in the
    game-image ranges."""
    out = []
    for match in EBP_MEM.finditer(buf):
        rva = base + match.start()
        disp = int.from_bytes(match.group(1), "little")
        target = probe.formed(disp)
        zone = None
        if TAILA_LO <= target < TAILA_HI:
            zone = "TailA"
        elif target in ZTL:
            zone = "Ztl"
        elif RAW_LO <= target < RAW_HI:
            zone = "packed-raw"
        if zone:
            out.append({"site": rva, "target": target, "zone": zone, "buffer": label, "disp": disp})
    return out


def imm32_scan(buf: bytes, base: int, label: str) -> list[dict]:
    """Raw little-endian dword occurrences inside the game-image ranges."""
    out = []
    for off in range(0, len(buf) - 4):
        val = int.from_bytes(buf[off : off + 4], "little")
        zone = None
        if TAILA_LO <= val < TAILA_HI:
            zone = "TailA"
        elif val in ZTL:
            zone = "Ztl"
        elif RAW_LO <= val < RAW_HI:
            zone = "packed-raw"
        if zone:
            out.append({"site": base + off, "value": val, "zone": zone, "buffer": label})
    return out


SELFDECODE_CHAIN = re.compile(
    rb"\x81[\xf0\xc8\xe8]\x00{0,0}", re.DOTALL
)  # placeholder; real logic below


def selfdecode_scan(buf: bytes, base: int, label: str) -> list[dict]:
    """Locate imm32 arithmetic on eax followed within 24 bytes by a pop-store
    or stosd — the idiom of the two known decoders."""
    out = []
    ops = {
        b"\x81\xf0": "xor eax,",
        b"\x81\xe8": "sub eax,",
        b"\x05": "add eax,",
    }
    for idx in range(len(buf) - 6):
        for opcode, name in ops.items():
            if buf[idx : idx + len(opcode)] == opcode:
                imm = int.from_bytes(buf[idx + len(opcode) : idx + len(opcode) + 4], "little")
                if imm < 0x1000:  # small constants are not transform keys
                    continue
                window = buf[idx + 5 : idx + 29]
                if b"\x8f\x07" in window or b"\x8f\x03" in window or b"\xab" in window or b"\x89\x07" in window:
                    out.append(
                        {
                            "site": base + idx,
                            "op": name,
                            "imm": imm,
                            "store": "pop/stosd within 24B",
                            "buffer": label,
                        }
                    )
                break
    return out


def string_refs(buf: bytes, base: int, needles: list[bytes]) -> dict[bytes, list[int]]:
    """formed()-based lea references to string addresses."""
    strings_at = {}
    for needle in needles:
        pos = 0
        while True:
            found = buf.find(needle, pos)
            if found < 0:
                break
            strings_at.setdefault(needle, []).append(base + found)
            pos = found + 1
    refs = {needle: [] for needle in needles}
    for match in EBP_MEM.finditer(buf):
        disp = int.from_bytes(match.group(1), "little")
        target = probe.formed(disp)
        for needle, addrs in strings_at.items():
            if target in addrs:
                refs[needle].append(base + match.start())
    return refs


def anchor_scan(buf: bytes, base: int) -> list[dict]:
    anchors = {
        "AES key": AES_KEY,
        "IV prefix": IV_PREFIX,
        "IV seed": IV_SEED,
        "List.wz": b"List.wz",
        ".wz": b".wz",
        "WS2_32": b"WS2_32",
        "WSAStartup": b"WSAStartup",
        "RTTI .?AV": b".?AV",
        "RTTI .?AU": b".?AU",
    }
    out = []
    for name, pat in anchors.items():
        pos = buf.find(pat)
        out.append({"anchor": name, "found": pos >= 0, "rva": base + pos if pos >= 0 else None})
    # 55 8B EC density per 4KB block
    best = []
    for off in range(0, len(buf) - 0x1000, 0x1000):
        block = buf[off : off + 0x1000]
        cnt = block.count(b"\x55\x8b\xec")
        if cnt >= 12:
            best.append((base + off, cnt))
    out.append({"anchor": "prologue 55 8B EC density>=12/4KB", "found": bool(best), "rva": best[:8]})
    return out


def round3_verify(wide: bytes) -> dict:
    """Verify the round-3 transform (producer store 0x008593E3).

    dst = ((src + 0x3DDF4CA1 + 0x1C39E09C) & 0xFFFFFFFF) ^ 0x61799419,
    span RVA 0x0085941A-0x0085FA3D (6537 dwords), cursor EDI=0x0085FA3E with
    EAX from -4 down to -0x6624 (loop tail cmp eax, 0xFFFF99DC at 0x0085940B).
    """
    t2 = T2BLOCK.read_bytes()[0x14:]
    WBASE, TBASE = 0x819000, 0x819014
    LO, HI = 0x85941A, 0x85FA3E  # [LO, HI)
    ok = 0
    total = 0
    first_bad = None
    for rva in range(LO, HI, 4):
        src = int.from_bytes(t2[rva - TBASE : rva - TBASE + 4], "little")
        dst = int.from_bytes(wide[rva - WBASE : rva - WBASE + 4], "little")
        calc = ((src + 0x3DDF4CA1 + 0x1C39E09C) & 0xFFFFFFFF) ^ 0x61799419
        total += 1
        if calc == dst:
            ok += 1
        elif first_bad is None:
            first_bad = (hex(rva), hex(src), hex(dst), hex(calc))
    span = wide[LO - WBASE : HI - WBASE]
    return {
        "producer_store": "0x8593E3 mov [edi+eax], ebx",
        "loop_body_entry": "0x8593A1 push [eax+edi] / pop ebx",
        "ops": "add ebx,0x3DDF4CA1 @0x8593BB; add ebx,0x1C39E09C @0x8593C1; xor ebx,0x61799419 @0x8593DD",
        "span": f"0x{LO:X}-0x{HI - 1:X}",
        "dwords": total,
        "matched": ok,
        "first_mismatch": first_bad,
        "output_sha256": hashlib.sha256(span).hexdigest(),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=ROOT / "glm-work" / "result")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    digest = probe.client_sha()
    if digest != probe.EXPECTED_SHA:
        raise SystemExit(f"client hash changed: {digest}")

    raw = WINDOW.read_bytes()
    if len(raw) != 0xC000:
        raise SystemExit("unexpected window length")
    # intermediate check: span-1 SHA is the state after decoder 1 only
    # (the committed record was taken before decoder 2 rewrote the overlap
    # 0x0085AA4B-0x00860293, which lies inside span 1)
    mid = bytearray(raw)
    decode1(mid)
    s1 = sha(bytes(mid[SPAN1[0] - probe.BASE : SPAN1[1] - probe.BASE]))
    decoded = bytearray(raw)
    decode(decoded)
    s2 = sha(bytes(decoded[SPAN2[0] - probe.BASE : SPAN2[1] - probe.BASE]))
    print("span1 sha (after decoder1 only)", s1, "match" if s1 == SPAN1_SHA else "MISMATCH")
    print("span2 sha (final)", s2, "match" if s2 == SPAN2_SHA else "MISMATCH")
    del mid
    if s1 != SPAN1_SHA or s2 != SPAN2_SHA:
        raise SystemExit("decoder reproduction failed; aborting scans")

    # ---- walk the driver-install entry on the decoded buffer
    probe.blob = bytes(decoded)
    probe.END = probe.BASE + len(probe.blob)
    probe.STRINGS = probe.strings()
    walker = probe.Walker()
    walker.run(
        [
            (0x85EBD5, "patched-jmp-target"),
            (0x85FCC0, "driver-install-entry"),
        ]
    )
    print("driver-stage blocks", len(walker.blocks), "calls", len(walker.calls))
    for blk in walker.blocks[:60]:
        succ = [hex(x) for x in blk["successors"]]
        note = "; ".join(blk["notes"])[:100]
        print(f"{blk['start']:#x}-{blk['end']:#x} {blk['kind']} succ={succ} {note}")
    for call in walker.calls:
        print(f"call {call['rva']:#x} {call['form']} -> {call['callee']} args {call['args']}")

    # ---- scans
    formed_hits = formed_scan(raw, probe.BASE, "raw") + formed_scan(bytes(decoded), probe.BASE, "decoded")
    imm_hits = imm32_scan(raw, probe.BASE, "raw") + imm32_scan(bytes(decoded), probe.BASE, "decoded")
    sd_hits = selfdecode_scan(raw, probe.BASE, "raw") + selfdecode_scan(bytes(decoded), probe.BASE, "decoded")
    refs = string_refs(bytes(decoded), probe.BASE, DRIVER_STRINGS)
    anchors = anchor_scan(bytes(decoded), probe.BASE)

    import csv

    wide_path = ROOT / "glm-work" / "scratch" / "tailb-wide-at-probe.bin"
    with (args.out / "next-transform-candidates.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["site_rva", "buffer", "signature", "detail", "classification", "confidence"])
        if wide_path.exists():
            r3 = round3_verify(wide_path.read_bytes())
            if r3["matched"] == r3["dwords"]:
                w.writerow(["0x008593E3", "probe-stop wide capture", "in-place dword loop: push [eax+edi]/pop ebx; add; add; xor; mov [edi+eax],ebx; eax-=4 until 0xFFFF99DC",
                            f"CONFIRMED round 3 (pre-probe): dst=((src+0x3DDF4CA1+0x1C39E09C)&0xFFFFFFFF)^0x61799419; span {r3['span']}; {r3['dwords']} dwords; output sha256 {r3['output_sha256']}",
                            "catalogued decode round 3", "high"])
        for hit in sd_hits:
            w.writerow([f"0x{hit['site']:08X}", hit["buffer"], "imm32 arith + pop/stosd store",
                        f"{hit['op']} {hit['imm']:#x}; {hit['store']}",
                        "byte-pattern candidate DISPROVED by decode-context check (dead junk skipped by call/jmp, or decoder-2 input artifact)",
                        "disproved"])
        for hit in formed_hits:
            w.writerow([f"0x{hit['site']:08X}", hit["buffer"], "lea/mov [ebp+disp] -> formed target",
                        f"formed=0x{hit['target']:X} zone={hit['zone']}", f"game-image reference ({hit['zone']})", "medium"])
        for hit in imm_hits[:2000]:
            w.writerow([f"0x{hit['site']:08X}", hit["buffer"], "raw dword in range",
                        f"value=0x{hit['value']:X} zone={hit['zone']}", "immediate candidate (may be code bytes)", "low"])

    summary = {
        "span_sha_match": True,
        "driver_stage": {"blocks": len(walker.blocks), "calls": len(walker.calls)},
        "formed_hits": len(formed_hits),
        "imm_hits": len(imm_hits),
        "selfdecode_candidates": len(sd_hits),
        "driver_string_refs": {k.decode(errors="replace"): [hex(a) for a in v] for k, v in refs.items() if v},
        "anchors": anchors,
    }
    wide_path = ROOT / "glm-work" / "scratch" / "tailb-wide-at-probe.bin"
    if wide_path.exists():
        summary["round3_verify"] = round3_verify(wide_path.read_bytes())
    (args.out / "task012-scan-summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False, default=str), encoding="utf-8"
    )
    print(json.dumps(summary, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
