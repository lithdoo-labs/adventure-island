"""Directory-level index of the 16 PKG1 WZ archives via the mature wzpy
parser (.work/tools/wz-python @ 79344c9, MIT). Metadata only: version,
image/subdir counts, sample names. No content extraction.

Emits glm-work/result/wz-directory-index.csv (Task 022 deliverable name).
"""
from __future__ import annotations

import csv
import sys
import time
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / ".work" / "tools" / "wz-python"))

if "numpy" not in sys.modules:
    try:
        import numpy  # noqa: F401
    except Exception:
        _np = types.ModuleType("numpy")
        _np.__getattr__ = lambda name: None  # type: ignore[method-assign]
        sys.modules["numpy"] = _np

from wzpy.wz_file import WzFile  # noqa: E402

wzdir = next((ROOT / ".work" / "task-001" / "extracted").rglob("TamingMob.wz")).parent
OUT = ROOT / "glm-work" / "result" / "wz-directory-index.csv"

targets = sorted(p for p in wzdir.glob("*.wz") if p.name != "List.wz")
rows = []
for path in targets:
    t0 = time.time()
    try:
        with WzFile.open(str(path), region="EMS") as wz:
            imgs = list(wz.root.images.keys()) if isinstance(wz.root.images, dict) else []
            subs = list(wz.root.subdirs.keys()) if hasattr(wz.root, "subdirs") and isinstance(wz.root.subdirs, dict) else []
            try:
                total = sum(1 for _p, _i in wz.root.walk_images())
            except Exception:
                total = -1
            sample = ";".join(list(imgs)[:6])[:120]
            rows.append({
                "file": path.name,
                "size_bytes": path.stat().st_size,
                "version": getattr(wz, "version", "?"),
                "image_count_root": len(imgs),
                "image_count_recursive": total,
                "subdir_count": len(subs),
                "subdir_names": ";".join(list(subs)[:10]).encode("unicode_escape").decode("ascii")[:160],
                "sample_images": sample.encode("unicode_escape").decode("ascii")[:160],
                "status": "ok",
            })
            print(f"{path.name:<16} v{wz.version} root={len(imgs):<5} total={total:<6} subs={len(subs):<3} {time.time()-t0:.1f}s")
    except Exception as exc:
        rows.append({"file": path.name, "size_bytes": path.stat().st_size, "version": "",
                     "image_count": "", "subdir_count": "", "sample_images": "",
                     "status": f"{exc.__class__.__name__}: {str(exc)[:100]}"})
        print(f"{path.name:<16} FAIL {exc.__class__.__name__}: {str(exc)[:100]}")

OUT.parent.mkdir(parents=True, exist_ok=True)
with OUT.open("w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
print("\nwrote", OUT)
