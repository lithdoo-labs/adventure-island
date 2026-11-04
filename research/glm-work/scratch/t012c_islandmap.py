"""Task 012c follow-up 3: map plaintext islands vs encoded zones in
0x00862000-0x00911B25, then attack the encoded zones with short-period
keystream detection (repeating-pattern signature over presumed zero runs).

Findings feeding this: byte dumps showed readable protector code inside the
"encoded" region (slot-gate cmp idiom, call $+5 gadgets, pushal/popal/ret 8
thunks), while e.g. around 0x86B299 a repeating 3-byte pattern with period ~8
appears inside nominally random data - the classic signature of a
short-period XOR keystream over mostly-zero plaintext.
"""
from __future__ import annotations

import math
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))

ROOT = HERE.parents[1]
WIDE = ROOT / "glm-work" / "scratch" / "tailb-wide-at-probe.bin"
WBASE = 0x819000

wide = WIDE.read_bytes()


def entropy(block: bytes) -> float:
    if not block:
        return 0.0
    c = Counter(block)
    n = len(block)
    return -sum((v / n) * math.log2(v / n) for v in c.values())


def classify(start: int, end: int, blocksize: int = 256):
    rows = []
    for off in range(start, end, blocksize):
        blk = wide[off - WBASE : off - WBASE + blocksize]
        if len(blk) < blocksize:
            break
        ent = entropy(blk)
        g_call5 = blk.count(bytes.fromhex("e803000000"))
        g_pushpop = blk.count(b"\x60\x61")
        g_disp = sum(1 for i in range(len(blk) - 4) if blk[i] == 0x85 and blk[i + 4] == 0x07)
        printable = sum(1 for b in blk if 32 <= b < 127) / len(blk)
        same = blk.count(blk[0:1]) / len(blk)  # fill-page signature
        rows.append(
            {
                "rva": off,
                "ent": ent,
                "call5": g_call5,
                "pushpop": g_pushpop,
                "disp": g_disp,
                "printable": printable,
                "same": same,
            }
        )
    return rows


def merge_islands(rows, blocksize: int = 256):
    islands = []
    cur = None
    for r in rows:
        is_island = (
            r["ent"] < 5.5
            or r["call5"] + r["pushpop"] + r["disp"] >= 3
            or (r["printable"] > 0.85 and r["ent"] < 6.2)
        )
        if is_island:
            if cur and cur[1] == r["rva"]:
                cur[1] = r["rva"] + blocksize
            else:
                if cur:
                    islands.append(cur)
                cur = [r["rva"], r["rva"] + blocksize]
        else:
            if cur:
                islands.append(cur)
                cur = None
    if cur:
        islands.append(cur)
    return islands


def period_scan(start: int, end: int, maxp: int = 32):
    """For each period P, fraction of positions with buf[i]==buf[i+P]."""
    data = wide[start - WBASE : end - WBASE]
    n = len(data)
    out = []
    for p in range(1, maxp + 1):
        eq = sum(1 for i in range(n - p) if data[i] == data[i + p])
        out.append((p, eq / (n - p)))
    return out


def extract_key(start: int, end: int, period: int):
    """Majority vote per phase over the zone (works when plaintext is
    dominated by one byte value per phase, e.g. zeros)."""
    data = wide[start - WBASE : end - WBASE]
    key = bytearray()
    conf = []
    for ph in range(period):
        vals = Counter(data[ph::period])
        top, cnt = vals.most_common(1)[0]
        key.append(top)
        conf.append(round(cnt / len(data[ph::period]), 3))
    return bytes(key), conf


def try_decode(start: int, end: int, key: bytes):
    data = bytearray(wide[start - WBASE : end - WBASE])
    for i in range(len(data)):
        data[i] ^= key[i % len(key)]
    return bytes(data)


def score_plaintext(blk: bytes) -> dict:
    return {
        "prologues": blk.count(b"\x55\x8b\xec"),
        "disp07": sum(1 for i in range(len(blk) - 4) if blk[i] == 0x85 and blk[i + 4] == 0x07),
        "call5": blk.count(bytes.fromhex("e803000000")),
        "ascii4": sum(1 for i in range(len(blk) - 4) if all(32 <= b < 127 for b in blk[i : i + 4])),
    }


def main() -> None:
    lo, hi = 0x862000, 0x912000
    rows = classify(lo, hi)
    islands = merge_islands(rows)
    island_bytes = sum(b - a for a, b in islands)
    print(f"zone 0x{lo:X}-0x{hi:X}: {island_bytes} island bytes in {len(islands)} ranges "
          f"({island_bytes / (hi - lo) * 100:.1f}%)")
    for a, b in islands[:60]:
        print(f"  island 0x{a:X}-0x{b:X} ({b - a} bytes)")

    # encoded complement = the biggest non-island stretches
    encoded = []
    cur = lo
    for a, b in islands:
        if a - cur >= 1024:
            encoded.append((cur, a))
        cur = max(cur, b)
    if hi - cur >= 1024:
        encoded.append((cur, hi))
    encoded.sort(key=lambda r: r[1] - r[0], reverse=True)
    print(f"\nlargest encoded stretches:")
    for a, b in encoded[:12]:
        print(f"  0x{a:X}-0x{b:X} ({b - a} bytes)")

    print("\nperiod scans on top encoded stretches:")
    for a, b in encoded[:4]:
        res = period_scan(a, min(b, a + 0x20000))
        top = sorted(res, key=lambda t: t[1], reverse=True)[:5]
        print(f"  0x{a:X}-0x{b:X}: top periods {[(p, round(f, 3)) for p, f in top]}")

    # try key extraction on the top stretch for its best period
    for a, b in encoded[:3]:
        res = period_scan(a, min(b, a + 0x20000))
        best_p, best_f = max(res, key=lambda t: t[1])
        if best_f < 0.05:
            print(f"  0x{a:X}: no strong period (best {best_p} @ {best_f:.3f})")
            continue
        key, conf = extract_key(a, min(b, a + 0x20000), best_p)
        print(f"  0x{a:X}: period {best_p} frac {best_f:.3f} key {key.hex(' ')} conf {conf}")
        dec = try_decode(a, min(b, a + 0x20000), key)
        sc = score_plaintext(dec[:0x4000])
        base_sc = score_plaintext(wide[a - WBASE : a - WBASE + 0x4000])
        print(f"    decoded score {sc} vs raw {base_sc}")


if __name__ == "__main__":
    main()
