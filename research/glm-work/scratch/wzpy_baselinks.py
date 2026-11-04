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

with WzFile.open(str(wzdir / "Base.wz"), region="EMS") as wz:
    subs = list(wz.root.subdirs.keys())
print("Base.wz links:", sorted(subs))
others = sorted(p.stem for p in wzdir.glob("*.wz") if p.name not in ("Base.wz", "List.wz"))
print("other files :", others)
print("links-not-files:", sorted(set(subs) - set(others)))
print("files-not-links:", sorted(set(others) - set(subs)))
