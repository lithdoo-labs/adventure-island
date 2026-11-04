"""Try opening the CMS079 PKG1 archives with the mature wzpy parser
(.work/tools/wz-python, MIT). Directory/metadata only (no content extraction).
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / ".work" / "tools" / "wz-python"))

from wzpy import WzFile  # noqa: E402

wzdir = next((ROOT / ".work" / "task-001" / "extracted").rglob("TamingMob.wz")).parent

for region in (None, "CMS", "BMS", "GMS", "KMS", "TMS", "MSEA"):
    for name in ("TamingMob.wz", "Base.wz"):
        path = wzdir / name
        try:
            kwargs = {"region": region} if region else {}
            with WzFile.open(str(path), **kwargs) as wz:
                imgs = list(wz.root.children()) if hasattr(wz.root, "children") else []
                names = [getattr(c, "name", "?") for c in imgs][:8]
                print(f"OK   region={region!r:<6} {name}: version={getattr(wz, 'version', '?')} entries={len(imgs)} {names}")
                break
        except Exception as exc:
            print(f"FAIL region={region!r:<6} {name}: {exc.__class__.__name__}: {str(exc)[:110]}")
    else:
        continue
    break
