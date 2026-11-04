"""Test the hash-index hypothesis for List.wz.

PCOM hash (from 0x50C07575 read path):
    h = 0; for wchar c in wide(name): h = (h*32 + c + 1) & 0xFFFFFFFF
Search List.wz for the little-endian dwords of these hashes over candidate
names (wide-char). Also test byte-char variant and the +0 variant.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
wzdir = next((ROOT / ".work" / "task-001" / "extracted").rglob("List.wz")).parent
buf = (wzdir / "List.wz").read_bytes()


def h32(s: str, wide: bool) -> int:
    h = 0
    for ch in (s.encode("utf-16-le") if wide else s.encode("latin1", "ignore")):
        pass
    data = s.encode("utf-16-le") if wide else s.encode("latin1", "ignore")
    if wide:
        units = [int.from_bytes(data[i : i + 2], "little") for i in range(0, len(data), 2)]
    else:
        units = list(data)
    for c in units:
        h = (h * 32 + c + 1) & 0xFFFFFFFF
    return h


NAMES = [
    "Base.wz", "Character.wz", "Effect.wz", "Etc.wz", "Item.wz", "Map.wz",
    "Mob.wz", "Morph.wz", "Npc.wz", "Quest.wz", "Reactor.wz", "Skill.wz",
    "Sound.wz", "String.wz", "TamingMob.wz", "UI.wz", "List.wz",
    "0001.img", "0002.img", "100000000.img", "info", "name",
]

hits = 0
for name in NAMES:
    for wide in (True, False):
        h = h32(name, wide)
        needle = h.to_bytes(4, "little")
        pos = []
        p = buf.find(needle)
        while p >= 0:
            pos.append(p)
            p = buf.find(needle, p + 1)
        if pos:
            hits += 1
            print(f"HIT {name!r} wide={wide} h={h:#010x} at {[hex(x) for x in pos[:6]]}")
print("hits:", hits)

# distribution sanity: how many List.wz dwords look like valid hashes at all?
# (just informational)
