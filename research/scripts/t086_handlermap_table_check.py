#!/usr/bin/env python3
"""T086 static check — task044 handler map vs the 0xb9f004 pointer table.

Verifies (pure static, sha-pinned) that the runtime-observed task44 handler
bindings exist as slots of the in-image function-pointer table at 0xb9f004,
and derives the opcode->slot mapping relation.
"""
import csv
import hashlib
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000


def main():
    data = EXE.read_bytes()
    assert hashlib.sha256(data).hexdigest() == SHA, "sha mismatch"
    start, end = 0xB9F004, 0xBA027C
    words = [int.from_bytes(data[start - BASE + i * 4:start - BASE + i * 4 + 4], "little")
             for i in range((end - start) // 4)]
    idx = {}
    for i, w in enumerate(words):
        idx.setdefault(w, []).append(i)
    hmap = list(csv.DictReader(open(REPO / "research/result/task044-handler-map.csv", encoding="utf-8")))
    rels = {}
    hits = 0
    misses = []
    for r in hmap:
        try:
            op = int(r["opcode"], 16)
            h = int(r["handler_rva"], 16)
        except (ValueError, TypeError):
            continue
        if h == 0:
            continue
        if h in idx:
            hits += 1
            for i in idx[h]:
                rels.setdefault(op - i, 0)
                rels[op - i] += 1
        else:
            misses.append((hex(op), hex(h), r["c2s_name"], r["s2c_name"]))
    print("handler-map rows with body in table:", hits, " absent:", len(misses))
    print("opcode-minus-index relation histogram:", sorted(rels.items(), key=lambda kv: -kv[1])[:8])
    print("absent examples:", misses[:10])


if __name__ == "__main__":
    main()
