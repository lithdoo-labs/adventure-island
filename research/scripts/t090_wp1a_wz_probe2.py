"""T090 WP1-A part 2: walk MapHelper.img portal frames + locate the 13 target maps."""
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


def resolve(node, path):
    cur = node
    for part in path.split("/"):
        nxt = None
        for c in kids(cur):
            if c.name == part:
                nxt = c
                break
        if nxt is None:
            return None
        cur = nxt
    return cur


# --- MapHelper.img / portal tree
helper = resolve(root, "MapHelper.img")
print("MapHelper.img found:", helper is not None)
if helper:
    portal = resolve(helper, "portal")
    if portal:
        for c in kids(portal):
            print("portal/", c.name)
            for d in kids(c):
                print("   ", d.name, "->", [e.name for e in kids(d)][:12])
    else:
        print("MapHelper children:", [c.name for c in kids(helper)])

# --- locate the 13 maps under Map/
mapdir = resolve(root, "Map")
print("\nMap/ subdirs:", [c.name for c in kids(mapdir)])
found = {}
for sub in kids(mapdir):
    for img in kids(sub):
        if img.name.replace(".img", "") in MAPS:
            found[img.name.replace(".img", "")] = f"Map/{sub.name}/{img.name}"
for m in MAPS:
    print(m, "->", found.get(m, "NOT FOUND"))
