"""Known-plaintext attack on List.wz's light byte transform.

Hypotheses tested per (offset, known-name) pair:
  xor-const, add-const, sub-const, xor-linear(k0 + i*step for small step set),
  nibble-swap + xor-const, and byte-swap pairs.
A hit prints the offset and key.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
wzdir = next((ROOT / ".work" / "task-001" / "extracted").rglob("List.wz")).parent
buf = (wzdir / "List.wz").read_bytes()

NAMES = [
    b"Base.wz", b"Character.wz", b"Effect.wz", b"Etc.wz", b"Item.wz",
    b"List.wz", b"Map.wz", b"Mob.wz", b"Morph.wz", b"Npc.wz", b"Quest.wz",
    b"Reactor.wz", b"Skill.wz", b"Sound.wz", b"String.wz", b"TamingMob.wz",
    b"UI.wz", b"Base", b"Character", b"Sound", b"String",
]


def try_all() -> None:
    hits = 0
    for name in NAMES:
        n = len(name)
        for off in range(0, len(buf) - n):
            window = buf[off : off + n]
            # xor-const
            keys = {w ^ c for w, c in zip(window, name)}
            if len(keys) == 1:
                print(f"XOR-CONST {name!r} @ {off:#x} key {keys.pop():#04x}")
                hits += 1
            # add-const
            keys = {(w - c) & 0xFF for w, c in zip(window, name)}
            if len(keys) == 1:
                print(f"ADD-CONST {name!r} @ {off:#x} key {keys.pop():#04x}")
                hits += 1
            # xor with position-progressive key (key[i] = k ^ i, k + i, k - i)
            for mode in ("xori", "addi", "subi"):
                base = None
                ok = True
                for i, (w, c) in enumerate(zip(window, name)):
                    if mode == "xori":
                        k = w ^ c ^ i
                    elif mode == "addi":
                        k = (w - c - i) & 0xFF
                    else:
                        k = (w - c + i) & 0xFF
                    if base is None:
                        base = k
                    elif k != base:
                        ok = False
                        break
                if ok and base is not None:
                    print(f"POS-{mode} {name!r} @ {off:#x} base {base:#04x}")
                    hits += 1
            # nibble-swapped xor-const
            sw = [((w >> 4) | (w << 4)) & 0xFF for w in window]
            keys = {s ^ c for s, c in zip(sw, name)}
            if len(keys) == 1:
                print(f"NIBSWAP-XOR {name!r} @ {off:#x} key {keys.pop():#04x}")
                hits += 1
    print("total hypothesis hits:", hits)


try_all()

# Structure peek: how regular are the record blocks?
print("\nrecord-block periodicity check (first 0x200 bytes after +0x44):")
base = 0x44
for delta in range(0x10, 0x40, 4):
    same = sum(
        1 for i in range(0x100)
        if base + i + delta < len(buf) and buf[base + i] == buf[base + i + delta]
    )
    print(f"  period {delta:#x}: {same}/256 bytes equal")
