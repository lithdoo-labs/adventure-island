"""Seed-evidence scanner for materialized CMS079 game regions.

Bridges the repo reference seeds (reference/maplestory-symbols/derived/) to
the current boundary: when any new stable region appears (Tail A write, a new
decoded span, a VM memory capture), point this scanner at it and it reports
which seed evidence families are present:

- Task 002 crypto constants (AES key / IV table prefix / IV seed)
- packet/WZ/winsock text anchors
- MSVC RTTI type names for the CClientSocket/CWvs*/CLogin/CUI* families
- 55 8B EC prologue density (MSVC function-cluster signal)
- Wizet 'ztl' family token (new this session: official library root name)

Usage:
    python maple079_seed_scan.py <buffer-file> <base-rva> [--name label]

Read-only; prints a table and writes nothing unless --out is given.
"""
from __future__ import annotations

import argparse
import csv
import math
from pathlib import Path

AES_KEY = bytes.fromhex("130000000800000006000000B40000001B0000000F0000003300000052000000")
IV_PREFIX = bytes.fromhex("EC3F77A445D071BFB79820FC4BE9B3E1")
IV_SEED = bytes.fromhex("F25350C6")

TEXT_ANCHORS = (
    b"List.wz", b"WS2_32", b"WSAStartup", b"connect", b"CClientSocket",
    b".wz", b"MapleStory", b"Wizet", b"ztl", b"Ztl",
)

RTTI_NAMES = (
    b".?AVCClientSocket@@", b".?AVCWvsContext@@", b".?AVCWvsApp@@",
    b".?AVCLogin@@", b".?AVCStage@@", b".?AVCField@@", b".?AVCUser@@",
    b".?AVCUserLocal@@", b".?AVCQuestMan@@", b".?AVCUIWorldSelect@@",
    b".?AVCUIChannelSelect@@", b".?AVCUICharSelect@@", b".?AVCUICharDetail@@",
    b".?AVCUIAvatar@@", b".?AVCInPacket@@", b".?AVCOutPacket@@",
    b".?AVCWzCanvas@@", b".?AVCWzRawCanvas@@",
)


def scan(buf: bytes, base: int, label: str) -> list[dict]:
    rows: list[dict] = []

    def add(family: str, evidence: str, rva: int | None, status: str):
        rows.append({"buffer": label, "family": family, "evidence": evidence,
                     "rva": hex(rva) if rva is not None else "", "status": status})

    for name, pat in (("AES key", AES_KEY), ("IV table prefix", IV_PREFIX), ("IV seed", IV_SEED)):
        pos = buf.find(pat)
        add("Task002 crypto", name, base + pos if pos >= 0 else None,
            "HIT" if pos >= 0 else "absent")
    for tok in TEXT_ANCHORS:
        pos = buf.find(tok)
        add("text anchor", tok.decode("latin1"), base + pos if pos >= 0 else None,
            "HIT" if pos >= 0 else "absent")
    for tok in RTTI_NAMES:
        pos = buf.find(tok)
        add("RTTI", tok.decode("latin1"), base + pos if pos >= 0 else None,
            "HIT" if pos >= 0 else "absent")
    best = []
    for off in range(0, max(0, len(buf) - 0x1000), 0x1000):
        c = buf[off : off + 0x1000].count(b"\x55\x8b\xec")
        if c >= 12:
            best.append((hex(base + off), c))
    add("prologue density", "55 8B EC >=12 per 4KB", None, f"{len(best)} blocks: {best[:8]}" if best else "none")
    ent = 0.0
    if buf:
        counts = [0] * 256
        for b in buf:
            counts[b] += 1
        n = len(buf)
        ent = -sum((c / n) * math.log2(c / n) for c in counts if c)
    add("shape", f"entropy {ent:.3f}, {len(buf)} bytes", None, "info")
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("buffer", type=Path)
    parser.add_argument("base_rva", type=lambda x: int(x, 0))
    parser.add_argument("--name", default="buffer")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    rows = scan(args.buffer.read_bytes(), args.base_rva, args.name)
    hits = [r for r in rows if r["status"] == "HIT"]
    print(f"{args.name}: {len(hits)} seed hits / {len(rows)} checked")
    for r in rows:
        if r["status"] in ("HIT",) or r["family"] in ("shape", "prologue density"):
            print(f"  {r['family']:<18} {r['evidence']:<40} {r['rva']:<12} {r['status']}")
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        with args.out.open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)


if __name__ == "__main__":
    main()
