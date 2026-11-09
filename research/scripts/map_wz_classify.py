"""Split .work/map-reverse/extracted.jsonl into per-category map instance files.

Run after research/scripts/map_wz_extract.py. The full extract is about
1.5 GiB; this pass keeps the fields a map consumer actually looks up.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / ".work" / "map-reverse" / "extracted.jsonl"
OUT = ROOT / ".work" / "map-reverse" / "maps"
BAG_CATEGORIES = (
    "info",
    "back",
    "tile",
    "obj",
    "portal",
    "foothold",
    "ladder",
    "layer-info",
    "minimap",
)


def category(path: str):
    parts = path.split("/") if path else []
    if not parts:
        return None
    if parts[0] == "info" and len(parts) == 1:
        return "info"
    if parts[0] == "back":
        return "back"
    if parts[0] == "miniMap":
        return "minimap"
    if parts[0] == "portal":
        return "portal"
    if parts[0] == "foothold":
        return "foothold"
    if parts[0] == "ladderRope":
        return "ladder"
    if len(parts) >= 2 and parts[0].isdigit() and parts[1] in ("tile", "obj", "info"):
        return "layer-info" if parts[1] == "info" else parts[1]
    return None


def main() -> int:
    if not SRC.is_file():
        print(f"MISSING {SRC}")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)
    handles = {
        name: (OUT / f"{name}.jsonl").open("w", encoding="utf-8", newline="\n")
        for name in BAG_CATEGORIES
    }
    stats = Counter()
    info_keys = Counter()
    back_types = Counter()
    portal_pt = Counter()
    tile_first = {}
    obj_zm = Counter()
    try:
        with SRC.open(encoding="utf-8") as handle:
            for line in handle:
                record = json.loads(line)
                if record["recordType"] not in ("bag", "group"):
                    continue
                kind = category(record["nodePath"])
                if kind is None:
                    continue
                stats[kind] += 1
                map_id = record["image"].rsplit("/", 1)[-1].replace(".img", "")
                slim = {
                    "image": record["image"],
                    "mapId": map_id,
                    "nodePath": record["nodePath"],
                    "recordType": record["recordType"],
                    "imageSha256": record["provenance"]["imageSha256"],
                }
                if record["recordType"] == "group":
                    slim["childOrder"] = [child["name"] for child in record["childOrder"]]
                else:
                    slim["raw"] = record["raw"]
                    if kind in handles:
                        handles[kind].write(json.dumps(slim, ensure_ascii=False, separators=(",", ":")) + "\n")
                if kind == "info" and record["recordType"] == "bag":
                    for item in record["raw"]:
                        info_keys[item["name"]] += 1
                if kind == "back" and record["recordType"] == "bag":
                    values = {item["name"]: item.get("value") for item in record["raw"]}
                    back_types[values.get("type")] += 1
                if kind == "portal" and record["recordType"] == "bag" and record["nodePath"].count("/") == 1:
                    values = {item["name"]: item.get("value") for item in record["raw"]}
                    portal_pt[values.get("pt")] += 1
                if (
                    kind == "tile"
                    and record["recordType"] == "group"
                    and record["nodePath"] == "0/tile"
                    and map_id == "100000000"
                ):
                    tile_first["100000000/0/tile"] = [child["name"] for child in record["childOrder"][:8]]
                if kind == "obj" and record["recordType"] == "bag":
                    names = {item["name"] for item in record["raw"]}
                    obj_zm["present" if "zM" in names else "absent"] += 1
    finally:
        for handle in handles.values():
            handle.close()
    summary = {
        "categories": stats,
        "infoKeys": info_keys.most_common(),
        "backTypes": back_types.most_common(),
        "portalPt": portal_pt.most_common(),
        "tileFirst": tile_first,
        "objZm": obj_zm,
    }
    (OUT / "classify-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"categories": stats, "objZm": obj_zm}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
