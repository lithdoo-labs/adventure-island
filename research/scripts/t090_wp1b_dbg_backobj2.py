"""T090 debug2: Back/Obj via .images/.subdirs properties."""
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / ".work/tools/wz-python"))
from wzpy import WzFile  # noqa: E402

MAP_WZ = next(p for p in (REPO / ".work/task-001/extracted").iterdir()
              if p.is_dir()) / "Map.wz"
wz = WzFile.open(str(MAP_WZ), region="EMS")
root = wz.root

for name in ("Back", "Obj"):
    d = root.get(name)
    print(f"== {name}: subdirs={getattr(d, 'subdirs', None) and list(d.subdirs)[:8]}")
    print(f"   images={list(d.images)[:8]}")
    fv = d.get("folkvillige.img") if name == "Back" else d.get("guild.img")
    print("   sample get:", fv)
    if fv is not None:
        fv = fv.parse() if hasattr(fv, "parse") else fv
        subs = [c.name for c in fv.children()]
        print("   sample kids:", subs[:12])
        b = fv.get("back")
        if b is not None:
            b = b.parse() if hasattr(b, "parse") else b
            print("   back kids:", [c.name for c in b.children()][:10])
            n0 = b.get("0")
            if n0 is not None:
                n0 = n0.parse() if hasattr(n0, "parse") else n0
                print("   back/0 kids:", [c.name for c in n0.children()])
                for c in n0.children():
                    print("      ", c.name, c.value if hasattr(c, "value") else "")
