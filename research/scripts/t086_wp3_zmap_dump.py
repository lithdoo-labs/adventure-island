#!/usr/bin/env python3
"""T086 WP3 — read zmap.img / smap.img from the CMS079 Character.wz (pure
data side; anchors the G09 layer model in the actual WZ shipped with the
client) and dump the full z-order name list.

Uses the repo-local wz-python reader (MIT; see .work/tools/wz-python).
"""
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / ".work/task-023/tools/wz-python"))
from wzpy import WzFile  # noqa: E402

WZ = REPO / ".work/task-001/extracted/冒险岛online/Base.wz"
OUT = REPO / "research/result/stage-readiness/forensics/T086-G09-ZMAP-SMAP.txt"


def main() -> int:
    wz = WzFile.open(str(WZ), region="EMS")
    root = wz.root
    lines = ["# T086 WP3 — CMS079 Base.wz zmap/smap/zmap_cn dump", ""]
    for imgname in sorted(root.images):
        if imgname.lower() not in ("zmap.img", "smap.img", "zmap_cn.img", "standardpdd.img"):
            continue
        img = root.get(imgname)
        lines.append(f"## {imgname}")
        if img is None:
            lines.append("  <not resolved>")
            continue
        try:
            img.parse()
        except Exception as e:
            lines.append(f"  <parse error {e}>")
            continue

        def rec(node, prefix=""):
            ch = node.children() if callable(getattr(node, "children", None)) else getattr(node, "children", [])
            for c in ch:
                nm = getattr(c, "name", type(c).__name__)
                val = getattr(c, "value", None)
                if val is not None:
                    lines.append(f"{prefix}{nm} = {val}")
                else:
                    lines.append(f"{prefix}{nm}/")
                    rec(c, prefix + "  ")

        top = img.root if hasattr(img, "root") else img
        rec(top)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("wrote", OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
