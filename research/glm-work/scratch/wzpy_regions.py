from __future__ import annotations

import sys
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

for region in ("BMS", "GMS", "EMS"):
    try:
        with WzFile.open(str(wzdir / "TamingMob.wz"), region=region) as wz:
            imgs = list(wz.root.images.keys())
            esc = [n.encode("unicode_escape").decode("ascii")[:28] for n in imgs[:8]]
            printable = sum(1 for n in imgs if n.isascii() and n.replace(".", "").replace("_", "").isalnum())
            print(f"{region}: v{wz.version} imgs={len(imgs)} ascii-clean={printable}")
            for e in esc:
                print(f"    {e}")
    except Exception as exc:
        print(f"{region}: FAIL {exc.__class__.__name__}: {str(exc)[:90]}")
