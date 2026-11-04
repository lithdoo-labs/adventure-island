"""List.wz parser — Q11 closure.

Format (fully recovered, 2026-10-10):
    The file is a flat stream of records, no separate file header
    (the leading 05 00 00 00 is the first record's length dword):
        [0-2 byte type prefix (0xAC 0x52 for most; first record has none)]
        [dword  name length in characters]
        [length x 2 bytes: UTF-16LE path, encrypted with the WZ AES
         keystream (private-server IV B9 7D 63 E9) applied CONTINUOUSLY
         per string: plain[i] = enc[i] ^ ks[i], keystream index restarting
         at 0 for every record]
    Content: the client's external-image mount table (paths like
    "character/00002001.img") that NameSpace/PCOM attach into the
    resource namespace at boot.

Emits glm-work/result/listwz-entries.csv.
"""
from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / ".work" / "tools" / "wz-python"))

from wzpy.crypto import WzKey  # noqa: E402

SAFE = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/._- ")


def try_record(buf: bytes, ks: bytes, p: int) -> tuple[bytes, str, int] | None:
    for prefix_len in (0, 1, 2):
        q = p + prefix_len
        if q + 4 > len(buf):
            continue
        n = int.from_bytes(buf[q : q + 4], "little")
        if not (1 <= n <= 128) or q + 4 + 2 * n > len(buf):
            continue
        chars = []
        for i in range(n):
            lo = buf[q + 4 + 2 * i] ^ ks[2 * i]
            hi = buf[q + 4 + 2 * i + 1] ^ ks[2 * i + 1]
            u = lo | (hi << 8)
            if chr(u) not in SAFE:
                chars = None
                break
            chars.append(chr(u))
        if chars:
            return buf[p : q], "".join(chars), prefix_len + 4 + 2 * n
    return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=ROOT / "glm-work" / "result" / "listwz-entries.csv")
    args = parser.parse_args()

    wzdir = next((ROOT / ".work" / "task-001" / "extracted").rglob("List.wz")).parent
    buf = (wzdir / "List.wz").read_bytes()
    key = WzKey.for_region("EMS")
    key.ensure(0x400)
    ks = key.slice(0x400)

    rows = []
    p = 0
    while p < len(buf) - 8:
        rec = try_record(buf, ks, p)
        if rec:
            prefix, name, consumed = rec
            rows.append({
                "offset": f"0x{p:X}",
                "prefix_hex": prefix.hex(),
                "name_len": (len(name)),
                "path": name,
                "end": f"0x{p + consumed:X}",
            })
            p += consumed
        else:
            p += 1

    covered = int(rows[-1]["end"], 16) if rows else 0
    tops = Counter(r["path"].split("/")[0] for r in rows if "/" in r["path"])
    print(f"records: {len(rows)}  coverage: {covered:#x}/{len(buf):#x}")
    print("top-level distribution:", dict(tops.most_common()))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["offset", "prefix_hex", "name_len", "path", "end"])
        w.writeheader()
        w.writerows(rows)
    print("wrote", args.out)


if __name__ == "__main__":
    main()
