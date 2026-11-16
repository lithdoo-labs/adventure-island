"""T090 WP1-A part 4: portal frame property census (pv/ph/psh) + map img lookup
via direct subdir paths."""
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


def val(node):
    try:
        return node.value
    except Exception:
        return getattr(node, "raw", None)


def dump_frames(img, name):
    print(f"\n=== {name} ===")
    for c in kids(img):
        props = {}
        for p in kids(c):
            props[p.name] = val(p)
        print(f"  frame {c.name}: {props}")


helper = root.get("MapHelper.img").parse()
game = helper.get("portal/game")
for frame_set in ("pv", "ph", "psh"):
    node = game.get(frame_set)
    if node is None:
        print(f"{frame_set}: MISSING")
        continue
    N = node.parse() if hasattr(node, "parse") else node
    dump_frames(N, f"portal/game/{frame_set}")

# map lookup via direct paths
print("\n=== map image lookup ===")
for m in MAPS:
    hit = None
    for sub in ("Map1", "Map2", "Map3", "Map4", "Map0", "Map5", "Map6", "Map7", "Map8", "Map9"):
        try:
            node = root.get(f"Map/{sub}/{m}.img")
        except Exception:
            node = None
        if node is not None:
            hit = f"Map/{sub}/{m}.img"
            break
    print(m, "->", hit)
