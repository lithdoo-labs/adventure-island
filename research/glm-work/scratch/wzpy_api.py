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

with WzFile.open(str(wzdir / "TamingMob.wz"), region="BMS") as wz:
    root = wz.root
    print("root type:", type(root).__name__)
    print("root attrs:", [a for a in dir(root) if not a.startswith("__")])
    print("version:", wz.version)
    for attr in ("entries", "_entries", "images", "directories", "nodes", "items"):
        v = getattr(root, attr, None)
        if v is not None and hasattr(v, "__iter__"):
            print(f"root.{attr}: {type(v).__name__} len={len(v) if hasattr(v, '__len__') else '?'}")
