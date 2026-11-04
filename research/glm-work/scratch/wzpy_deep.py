"""Deep-parse validation + client-vs-server String.wz cross-check.

1. Parse a small .img property tree with wzpy (EMS IV) to prove content-level
   access beyond directories.
2. Compare client String.wz image list against the server-side unpacked
   String.wz XML set (.work/task-002/server/079V5/wz/String.wz/*.img.xml)
   — any difference is a private-server edit signal.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / ".work" / "tools" / "wz-python"))

from wzpy.wz_file import WzFile  # noqa: E402
from wzpy.json_export import node_to_dict  # noqa: E402

wzdir = next((ROOT / ".work" / "task-001" / "extracted").rglob("TamingMob.wz")).parent

# ---- 1. deep parse a small img
with WzFile.open(str(wzdir / "TamingMob.wz"), region="EMS") as wz:
    img = wz.root.get("0001.img")
    img.parse()
    tree = node_to_dict(img)
    text = json.dumps(tree, ensure_ascii=False)[:1500]
    print("TamingMob/0001.img property sample (first 1.5KB):")
    print(text.encode("unicode_escape").decode("ascii")[:1400])
    print()

# ---- 2. String.wz client vs server
with WzFile.open(str(wzdir / "String.wz"), region="EMS") as wz:
    client_imgs = sorted(wz.root.images.keys())
print("client String.wz imgs:", client_imgs)

server_dir = ROOT / ".work" / "task-002" / "server" / "079V5" / "wz" / "String.wz"
server_imgs = sorted(p.name[:-8] for p in server_dir.glob("*.img.xml"))
print("server String.wz imgs:", server_imgs)
print("client-only:", sorted(set(client_imgs) - set(server_imgs)))
print("server-only:", sorted(set(server_imgs) - set(client_imgs)))
