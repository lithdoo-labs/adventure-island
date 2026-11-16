"""T090 WP1-A part 5: full portal subtree dump (ph/psh -> portalStart/Continue/Exit
frame property census) + pv frame full property check (ensure no hidden props)."""
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / ".work/tools/wz-python"))
from wzpy import WzFile  # noqa: E402

MAP_WZ = next(p for p in (REPO / ".work/task-001/extracted").iterdir()
              if p.is_dir()) / "Map.wz"
wz = WzFile.open(str(MAP_WZ), region="EMS")
root = wz.root


def kids(node):
    ch = getattr(node, "children", None)
    return ch() if callable(ch) else (ch or [])


def parse_if(node):
    return node.parse() if hasattr(node, "parse") else node


def val(node):
    try:
        return node.value
    except Exception:
        return f"<{type(node).__name__}>"


def census(node, label, depth=0):
    node = parse_if(node)
    print("  " * depth + label)
    for c in kids(node):
        cn = parse_if(c)
        ck = kids(cn)
        if not ck:
            print("  " * (depth + 1) + f"{c.name} = {val(c)}")
        else:
            census(c, f"{c.name} [{len(ck)} children]", depth + 1)


helper = parse_if(root.get("MapHelper.img"))
game = parse_if(helper.get("portal/game"))
for fs in ("pv", "ph", "psh"):
    node = parse_if(game.get(fs))
    print(f"\n######## portal/game/{fs} ########")
    census(node, fs, 0)
