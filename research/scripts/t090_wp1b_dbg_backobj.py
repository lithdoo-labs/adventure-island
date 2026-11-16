"""T090 debug: enumerate Back/ and Obj/ structure."""
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


back = parse_if(root.get("Back"))
print("Back type:", type(back).__name__)
ch = list(kids(back))
print("Back children:", len(ch))
for c in ch[:6]:
    print(" -", c.name, type(c).__name__)
    if c.name in ("folkvillige", "aquaRoad") or c.name.endswith(".img"):
        cc = parse_if(c)
        print("    kids:", [x.name for x in list(kids(cc))[:12]])
obj = parse_if(root.get("Obj"))
cho = list(kids(obj))
print("Obj children:", len(cho), [c.name for c in cho[:8]])
