"""Open CMS079 PKG1 archives with wzpy (light submodules only, no numpy).

Directory/metadata only. Tries region keys and reports what parses.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / ".work" / "tools" / "wz-python"))

# numpy stub (canvas decode only; we only walk directories)
import types  # noqa: E402

if "numpy" not in sys.modules:
    try:
        import numpy  # noqa: F401
    except Exception:
        _np = types.ModuleType("numpy")
        _np.__getattr__ = lambda name: None  # type: ignore[method-assign]
        sys.modules["numpy"] = _np

from wzpy.wz_file import WzFile  # noqa: E402

wzdir = next((ROOT / ".work" / "task-001" / "extracted").rglob("TamingMob.wz")).parent

for region in (None, "CMS", "BMS", "GMS", "KMS", "TMS", "JMS", "MSEA"):
    try:
        kwargs = {"region": region} if region else {}
        with WzFile.open(str(wzdir / "TamingMob.wz"), **kwargs) as wz:
            imgs = list(wz.root.children())
            names = [getattr(c, "name", "?") for c in imgs][:10]
            print(f"OK   region={region!r:<6}: version={getattr(wz, 'version', '?')} entries={len(imgs)} {names}")
    except Exception as exc:
        print(f"FAIL region={region!r:<6}: {exc.__class__.__name__}: {str(exc)[:120]}")
