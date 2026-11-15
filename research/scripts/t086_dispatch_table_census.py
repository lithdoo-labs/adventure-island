#!/usr/bin/env python3
"""T086 static census — locate opcode->handler dispatch tables in the EXE image.

Scans the whole image for dword runs whose values point into the known client
handler band (0x628000..0x660000, per task044 handler map), then reports table
extents. This is the instruction-side counterpart of the G17 provenance audit:
it establishes which dispatch tables statically exist in the client image.

Model: linear fileOffset = VA - 0x400000, sha-pinned.
"""
import hashlib
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000
LO, HI = 0x628000, 0x660000  # client handler band (task044 observed bodies)


def main() -> int:
    data = EXE.read_bytes()
    assert hashlib.sha256(data).hexdigest() == SHA, "sha mismatch"
    n = len(data) // 4
    words = [int.from_bytes(data[i * 4:i * 4 + 4], "little") for i in range(n)]
    in_band = [LO <= w < HI for w in words]
    runs = []
    i = 0
    while i < n:
        if in_band[i]:
            j = i
            while j < n and in_band[j]:
                j += 1
            if j - i >= 8:
                runs.append((BASE + i * 4, j - i))
            i = j
        else:
            i += 1
    print(f"band {LO:#x}-{HI:#x}: {len(runs)} runs (>=8 consecutive in-band dwords)")
    for va, cnt in runs:
        print(f"  table@{va:#x}  slots={cnt}  "
              f"first={words[(va-BASE)//4]:#x} last={words[(va-BASE)//4+cnt-1]:#x}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
