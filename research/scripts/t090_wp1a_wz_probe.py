"""T090 WP1-A: CMS079 Map.wz static-resource availability probe.

Records the original WZ identity, walks the top-level structure, and checks:
  - Map/MapHelper.img (portal game/pv/ph frames)
  - the 13 target maps' .img nodes (back/obj animation references)
Read-only. Region 'EMS' per repo convention (wzpy).
"""
import hashlib
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / ".work/tools/wz-python"))
from wzpy import WzFile  # noqa: E402

MAP_WZ = REPO / ".work/task-001/extracted"
MAP_WZ = next(p for p in MAP_WZ.iterdir() if p.is_dir()) / "Map.wz"
MAP_WZ_SHA = "9e0d2a0fcecac2c99ee3cb15b03c41b5617d7d0637b55fb132f0eeed27155f69"

h = hashlib.sha256(MAP_WZ.read_bytes()).hexdigest()
print(f"Map.wz = {MAP_WZ}")
print(f"sha256 = {h}")
assert h == MAP_WZ_SHA, "Map.wz sha mismatch"

wz = WzFile.open(str(MAP_WZ), region="EMS")
root = wz.root
print("root.name =", root.name)
print("root.subdirs =", list(root.subdirs)[:10])
print("root.images =", list(root.images)[:10])


def walk(node, depth=0, max_depth=2):
    kids = node.children() if callable(getattr(node, "children", None)) else []
    for c in kids:
        print("  " * depth + f"- {c.name} ({type(c).__name__})")
        if depth < max_depth:
            walk(c, depth + 1, max_depth)


print("\n--- root children ---")
walk(root, 0, 1)
