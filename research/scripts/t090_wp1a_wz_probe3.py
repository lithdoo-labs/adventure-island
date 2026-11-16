"""T090 WP1-A part 3: navigate Map.wz via root.get(); dump MapHelper portal tree
and locate the 13 target maps."""
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / ".work/tools/wz-python"))
from wzpy import WzFile  # noqa: E402

MAP_WZ = next(p for p in (REPO / ".work/task-001/extracted").iterdir()
              if p.is_dir()) / "Map.wz"
wz = WzFile.open(str(MAP_WZ), region="EMS")
root = wz.root

MAPS = ["222000000", "222000001", "230030200", "230030100", "230030000",
        "230020300", "230020200", "230020100", "230020000", "230000000",
        "230000001", "230000002", "230000003"]


def kids(node):
    ch = getattr(node, "children", None)
    return ch() if callable(ch) else (ch or [])


helper = root.get("MapHelper.img")
print("MapHelper.img:", type(helper).__name__)
H = helper.parse() if hasattr(helper, "parse") else helper
for c in kids(H):
    print(" -", c.name)
    if c.name in ("portal", "game"):
        for d in kids(c):
            print("    ", d.name, "->", [e.name for e in kids(d)][:16])

# walk Map/
mapdir = root.get("Map")
print("\nMap:", type(mapdir).__name__)
M = mapdir.parse() if hasattr(mapdir, "parse") else mapdir
subs = [c.name for c in kids(M)]
print("Map/ children:", subs[:10])
found = {}
for sub in kids(M):
    for img in kids(sub):
        n = img.name.replace(".img", "")
        if n in MAPS:
            found[n] = f"Map/{sub.name}/{img.name}"
for m in MAPS:
    print(m, "->", found.get(m, "NOT FOUND"))
