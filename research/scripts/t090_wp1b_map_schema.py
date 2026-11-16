"""T090 WP1-B: map back/obj record dump for the 13 target maps (one sample first)
to learn the schema, then the full census."""
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


m = parse_if(root.get("Map/Map2/230000000.img"))
print("map children:", [c.name for c in kids(m)])
for section in ("back", "obj"):
    sec = None
    for c in kids(m):
        if c.name == section:
            sec = parse_if(c)
            break
    if sec is None:
        print(f"({section}: missing)")
        continue
    print(f"\n=== {section} ({len(list(kids(sec)))} entries) ===")
    for ent in list(kids(sec))[:4]:
        props = {p.name: val(p) for p in kids(parse_if(ent))}
        print(f" {ent.name}: {props}")
