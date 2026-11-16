"""T090 WP2-C: 13-map background layout table from the ORIGINAL Map.wz back
records + the C-051 proven span formulas (viewport 800x600; [0xBE2788] slot
+0x2C/+0x30 semantics). Per-record: raw WZ values, computed tiling spans and
first-frame relative offsets; the ABSOLUTE first-frame screen position stays
runtime-dependent (attach baseline) and is explicitly NOT asserted.
Output: T090-G36-13MAP-LAYOUT.csv
"""
import csv
import hashlib
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / ".work/tools/wz-python"))
from wzpy import WzFile  # noqa: E402

MAP_WZ = next(p for p in (REPO / ".work/task-001/extracted").iterdir()
              if p.is_dir()) / "Map.wz"
MAP_WZ_SHA = "9e0d2a0fcecac2c99ee3cb15b03c41b5617d7d0637b55fb132f0eeed27155f69"
MAPS = ["222000000", "222000001", "230030200", "230030100", "230030000",
        "230020300", "230020200", "230020100", "230020000", "230000000",
        "230000001", "230000002", "230000003"]
OUT = REPO / "research/result/stage-readiness/forensics/T090-G36-13MAP-LAYOUT.csv"

h = hashlib.sha256(MAP_WZ.read_bytes()).hexdigest()
assert h == MAP_WZ_SHA

VIEW_W, VIEW_H = 800, 600  # slot +0x2C/+0x30 viewport (C-027/C-051)


def span(view, step):
    """C-051: ((view + 2*step - 2) / divisor) * step, divisor = step or 1."""
    div = step if step else 1
    return ((view + 2 * step - 2) // div) * step


wz = WzFile.open(str(MAP_WZ), region="EMS")
root = wz.root


def resolve(path):
    node = root
    for part in path.split("/"):
        nxt = None
        try:
            nxt = node.get(part)
        except Exception:
            ch = getattr(node, "children", None)
            ch = ch() if callable(ch) else (ch or [])
            for c in ch:
                if c.name == part:
                    nxt = c
                    break
        if nxt is None:
            return None
        node = nxt
        if hasattr(node, "parse"):
            try:
                node = node.parse()
            except Exception:
                pass
    return node


def props(node):
    out = {}
    for c in node.children():
        try:
            if not list(c.children()):
                out[c.name] = c.value
        except Exception:
            pass
    return out


rows = []
for m in MAPS:
    img = resolve(f"Map/Map2/{m}.img")
    if img is None:
        rows.append({"map": m, "record": "", "note": "map img missing"})
        continue
    back = None
    for c in img.children():
        if c.name == "back":
            back = c
            break
    if back is None:
        rows.append({"map": m, "record": "", "note": "no back section"})
        continue
    for ent in back.children():
        p = props(ent)
        rx = int(p.get("rx", 0) or 0)
        ry = int(p.get("ry", 0) or 0)
        cx = int(p.get("cx", 0) or 0)
        cy = int(p.get("cy", 0) or 0)
        x = int(p.get("x", 0) or 0)
        y = int(p.get("y", 0) or 0)
        typ = int(p.get("type", 0) or 0)
        # C-049 mode bits: bit0 horizontal, bit1 vertical (bg-normal passes
        # type directly 1/2/3; mode=0 single iteration)
        hspan = span(VIEW_W, cx) if (typ & 1) and cx else 0
        vspan = span(VIEW_H, cy) if (typ & 2) and cy else 0
        rows.append({
            "map": m,
            "record": ent.name,
            "bS": p.get("bS", ""),
            "ani": p.get("ani", 0),
            "no": p.get("no", ""),
            "front": p.get("front", 0),
            "type": typ,
            "x": x, "y": y, "rx": rx, "ry": ry, "cx": cx, "cy": cy,
            "a": p.get("a", 255),
            "hspan_C051": hspan,
            "vspan_C051": vspan,
            "parallax_ratio_x_C111": f"{(rx + 100) / 100:g}" if typ & 1 or rx else "",
            "parallax_ratio_y_C111": f"{(ry + 100) / 100:g}" if typ & 2 or ry else "",
            "note": ("relative layout only: the ABSOLUTE first-frame screen "
                     "offset depends on the attach baseline (runtime camera/"
                     "origin state at load — statically unprovable); spans per "
                     "C-051 with viewport 800x600"),
        })

with open(OUT, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
print(f"{len(rows)} back records -> {OUT}")
