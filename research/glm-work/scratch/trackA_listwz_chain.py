"""Chained/delta transform probes on List.wz, looking for printable runs."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
wzdir = next((ROOT / ".work" / "task-001" / "extracted").rglob("List.wz")).parent
buf = (wzdir / "List.wz").read_bytes()


def printable_runs(b: bytes, minlen: int = 5) -> list[tuple[int, bytes]]:
    out = []
    run = bytearray()
    start = 0
    for i, c in enumerate(b):
        if 32 <= c < 127:
            if not run:
                start = i
            run.append(c)
        else:
            if len(run) >= minlen:
                out.append((start, bytes(run)))
            run = bytearray()
    if len(run) >= minlen:
        out.append((start, bytes(run)))
    return out


probes: dict[str, bytes] = {}
probes["xor-prev"] = bytes([buf[0]] + [buf[i] ^ buf[i - 1] for i in range(1, len(buf))])
probes["add-prev"] = bytes([buf[0]] + [(buf[i] + buf[i - 1]) & 0xFF for i in range(1, len(buf))])
probes["sub-prev"] = bytes([buf[0]] + [(buf[i] - buf[i - 1]) & 0xFF for i in range(1, len(buf))])
probes["xor-prev-index"] = bytes([buf[0]] + [buf[i] ^ buf[i - 1] ^ (i & 0xFF) for i in range(1, len(buf))])
probes["xor-index"] = bytes([buf[i] ^ (i & 0xFF) for i in range(len(buf))])
probes["xor-index2"] = bytes([buf[i] ^ ((i * 7) & 0xFF) for i in range(len(buf))])
probes["not"] = bytes([~b & 0xFF for b in buf])
probes["ror3"] = bytes([((b >> 3) | (b << 5)) & 0xFF for b in buf])
probes["rol3"] = bytes([((b << 3) | (b >> 5)) & 0xFF for b in buf])
probes["swap-nibbles"] = bytes([((b >> 4) | (b << 4)) & 0xFF for b in buf])

for name, data in probes.items():
    runs = printable_runs(data)
    wz_like = [r for r in runs if b".wz" in r[1] or r[1].isalpha()]
    tag = "  <== WZ-LIKE" if wz_like else ""
    print(f"{name:>16}: {len(runs)} printable runs{tag}")
    for off, r in (wz_like or runs)[:6]:
        print(f"    {off:#07x}: {r[:40]!r}")

# also check the repeated 16-byte header block across the file
pat = bytes.fromhex("c865210506cd250af97be40a9865628b")
pos = []
i = buf.find(pat)
while i >= 0:
    pos.append(i)
    i = buf.find(pat, i + 1)
print("\nrepeated 16B block occurrences:", [hex(p) for p in pos])
# bytes before each occurrence
for p in pos[:8]:
    print(f"  @ {p:#x} preceded by {buf[max(0,p-6):p].hex()}")
