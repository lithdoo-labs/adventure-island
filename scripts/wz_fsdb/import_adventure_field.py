"""Import the first field closure into content/[FSDB]adventure.

Reads the converted CMS library and writes only:

- maps 222000000, 222000001, and 230030200
- back, tile, obj, portal, foothold, and rope rows for those maps
- no seat rows: those three Map.wz images have no seat node
- the canvases those rows reference, one PNG each
- MapHelper portal/game pv, ph, and psh
- Physics/default as physics.default

Editor portal icons are not copied. Missing z and delay stay absent.
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

SOURCE = Path(r"E:\cms079-pr1-work\fsdb-all") / "[FSDB]cms"
DEST = Path(__file__).resolve().parents[2] / "content" / "[FSDB]adventure"
MAPS = ("222000000", "222000001", "230030200")
VR_KEYS = ("VRLeft", "VRTop", "VRRight", "VRBottom")
RESOURCE_HEAD = {
    "Back": "back",
    "Tile": "tile",
    "Obj": "obj",
    "MiniMap": "minimap",
    "MapHelper": "helper",
}
SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": {
        "anyOf": [
            {"type": "null"},
            {"type": "boolean"},
            {"type": "number"},
            {"type": "string"},
            {"type": "array"},
            {"type": "object"},
        ]
    },
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def dump_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = "\n".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) for row in rows)
    path.write_text(body + ("\n" if rows else ""), encoding="utf-8", newline="\n")


def rows(group: str, map_id: str) -> list[dict]:
    path = SOURCE / f"[group]{group}" / f"{map_id}.jsonl"
    if not path.is_file():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def adv_resource(cms_key: str) -> str:
    head, sep, rest = cms_key.partition("/")
    if sep == "" or head not in RESOURCE_HEAD:
        raise SystemExit(f"unexpected resource key: {cms_key}")
    return f"{RESOURCE_HEAD[head]}/{rest}"


def pick(row: dict, order: tuple[str, ...], drop_empty: frozenset[str] = frozenset()) -> dict:
    picked = {}
    seen = set()
    for key in order:
        if key not in row or row[key] is None:
            continue
        if key in drop_empty and row[key] == "":
            continue
        picked[key] = row[key]
        seen.add(key)
    for key, value in row.items():
        if key in seen or value is None:
            continue
        if key in drop_empty and value == "":
            continue
        picked[key] = value
    return picked


class Importer:
    def __init__(self) -> None:
        self.copied: set[str] = set()
        self.back_frames: dict[str, list[dict]] = {}
        self.tile_frames: dict[str, list[dict]] = {}
        self.obj_frames: dict[str, list[dict]] = {}
        self.helper_frames: list[dict] = []
        self._back_seen: set[tuple[str, int, int]] = set()

    def copy_png(self, cms_key: str, adventure_key: str) -> None:
        if adventure_key in self.copied:
            return
        source = SOURCE / "[resource]图" / f"{cms_key}.png"
        if not source.is_file():
            raise SystemExit(f"missing png for {cms_key}")
        target = DEST / "[resource]Map" / f"{adventure_key}.png"
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        self.copied.add(adventure_key)

    def canvas(self, node: dict, label: str) -> dict:
        if node.get("uol") is True and node.get("resolved") is False:
            raise SystemExit(f"unresolved uol at {label}")
        if not isinstance(node.get("resource"), str) or not isinstance(node.get("origin"), list):
            raise SystemExit(f"not a canvas at {label}: {list(node)[:8]}")
        if not isinstance(node.get("width"), int) or not isinstance(node.get("height"), int):
            raise SystemExit(f"canvas size missing at {label}")
        resource = adv_resource(node["resource"])
        self.copy_png(node["resource"], resource)
        frame = {"origin": node["origin"]}
        if "z" in node:
            frame["z"] = node["z"]
        if "delay" in node:
            frame["delay"] = node["delay"]
        frame["width"] = node["width"]
        frame["height"] = node["height"]
        frame["resource"] = resource
        return frame

    def frames_of(self, node, label: str) -> list[tuple[str, dict]]:
        if isinstance(node, dict) and isinstance(node.get("resource"), str):
            return [("0", node)]
        if not isinstance(node, dict):
            raise SystemExit(f"missing frames at {label}")
        found = []
        for key, child in node.items():
            if not isinstance(child, dict):
                continue
            if isinstance(child.get("resource"), str) or child.get("uol") is True:
                found.append((key, child))
        if not found:
            raise SystemExit(f"no canvases at {label}")
        found.sort(key=lambda item: (0, int(item[0])) if item[0].isdigit() else (1, item[0]))
        return found

    def add_back(self, name: str, animated: int, number: int) -> None:
        if not name or name in self.back_frames and (name, animated, number) in self._back_seen:
            self._back_seen.add((name, animated, number))
            return
        definition = load_json(SOURCE / "[struct]Back" / f"{name}.json")
        branch = "ani" if animated else "back"
        node = definition.get(branch, {}).get(str(number))
        if node is None:
            raise SystemExit(f"missing back {name} {branch}/{number}")
        bucket = self.back_frames.setdefault(name, [])
        existing = {(row.get("kind"), row.get("no"), row.get("frame")) for row in bucket}
        for frame_name, canvas_node in self.frames_of(node, f"{name}/{branch}/{number}"):
            identity = ("ani" if animated else "back", number, frame_name if animated else None)
            if identity in existing:
                continue
            frame = self.canvas(canvas_node, f"{name}/{branch}/{number}/{frame_name}")
            row = {"kind": "ani" if animated else "back", "no": number}
            if animated:
                row["frame"] = frame_name
            row.update(frame)
            bucket.append(row)
            existing.add(identity)
        self._back_seen.add((name, animated, number))

    def add_tile(self, name: str, part: str, number: int) -> None:
        definition = load_json(SOURCE / "[struct]Tileset" / f"{name}.json")
        node = definition.get(part, {}).get(str(number)) if isinstance(definition.get(part), dict) else None
        if not isinstance(node, dict):
            raise SystemExit(f"missing tile {name}/{part}/{number}")
        bucket = self.tile_frames.setdefault(name, [])
        if any(row["u"] == part and row["no"] == number for row in bucket):
            return
        frame = self.canvas(node, f"{name}/{part}/{number}")
        bucket.append({"u": part, "no": number, **frame})

    def add_obj(self, name: str, l0: str, l1: str, l2: str) -> None:
        definition = load_json(SOURCE / "[struct]Obj" / f"{name}.json")
        node = definition.get(l0, {})
        node = node.get(l1, {}) if isinstance(node, dict) else None
        node = node.get(l2) if isinstance(node, dict) else None
        if node is None:
            raise SystemExit(f"missing obj {name}/{l0}/{l1}/{l2}")
        bucket = self.obj_frames.setdefault(name, [])
        existing = {(row["l0"], row["l1"], row["l2"], row["frame"]) for row in bucket}
        for frame_name, canvas_node in self.frames_of(node, f"{name}/{l0}/{l1}/{l2}"):
            if (l0, l1, l2, frame_name) in existing:
                continue
            frame = self.canvas(canvas_node, f"{name}/{l0}/{l1}/{l2}/{frame_name}")
            bucket.append({"l0": l0, "l1": l1, "l2": l2, "frame": frame_name, **frame})

    def add_helper(self) -> None:
        helper = load_json(SOURCE / "[struct]MapHelper" / "MapHelper.json")
        game = helper["portal"]["game"]
        for name in ("pv", "ph", "psh"):
            self._walk_helper(game[name], ("portal", "game", name))

    def _walk_helper(self, node, path: tuple[str, ...]) -> None:
        if isinstance(node, dict) and isinstance(node.get("resource"), str):
            frame = self.canvas(node, "/".join(path))
            row = {"branch": path[0], "use": path[1], "name": path[2]}
            if len(path) == 4:
                row["frame"] = path[3]
            elif len(path) == 6:
                row["variant"] = path[3]
                row["clip"] = path[4]
                row["frame"] = path[5]
            else:
                raise SystemExit(f"unexpected helper path {'/'.join(path)}")
            row.update(frame)
            self.helper_frames.append(row)
            return
        if not isinstance(node, dict):
            raise SystemExit(f"bad helper node {'/'.join(path)}")
        for key in sorted(node, key=lambda item: (0, int(item)) if item.isdigit() else (1, item)):
            child = node[key]
            if isinstance(child, dict):
                self._walk_helper(child, path + (key,))


def map_record(map_id: str) -> dict:
    source = load_json(SOURCE / "[struct]Map" / f"{map_id}.json")
    info = dict(source["info"])
    record = {"mapId": map_id, "info": info}
    if all(key in info for key in VR_KEYS):
        record["vr"] = {key: info.pop(key) for key in VR_KEYS}
    mini = source.get("miniMap") or {}
    needed = ("width", "height", "centerX", "centerY", "mag")
    if all(key in mini for key in needed):
        record["miniMap"] = {key: mini[key] for key in needed}
        record["miniMap"]["resource"] = f"minimap/{map_id}"
    layers = {}
    for layer in source["layers"]:
        item = {}
        if layer.get("tileSet"):
            item["tileSet"] = layer["tileSet"]
        if "tSMag" in layer:
            item["tSMag"] = layer["tSMag"]
        layers[str(layer["layer"])] = item
    for index in range(8):
        layers.setdefault(str(index), {})
    record["layers"] = {str(index): layers[str(index)] for index in range(8)}
    return record


def write_metadata() -> None:
    tables = {
        "[struct]map.Map": None,
        "[group]map.Back": "背景放置。一行一条，顺序跟源记录一致。",
        "[group]map.Tile": "瓦片放置。一行一条。",
        "[group]map.Obj": "物件放置。一行一条。",
        "[group]map.Portal": "传送门放置。一行一条。缺 hRange 或 vRange 不补 100。",
        "[group]map.Foothold": "立足线。一行一条。",
        "[group]map.Rope": "绳子。一行一条。",
        "[struct]map.Back": None,
        "[group]map.BackFrame": "背景帧。静态 kind 为 back，动画 kind 为 ani。缺 delay 不补。",
        "[struct]map.Tileset": None,
        "[group]map.TileFrame": "瓦片画布。缺 z 不补 0。",
        "[struct]map.Obj": None,
        "[group]map.ObjFrame": "物件帧。缺 delay 不补。",
        "[struct]map.Helper": None,
        "[group]map.HelperFrame": "MapHelper 的游戏出口画面。编辑器图标不在这里。",
        "[struct]physics.Default": None,
        "[resource]Map": "地图画布。一张画布一个 PNG。扩展名不属于 ResourceKey。",
    }
    for folder, text in tables.items():
        path = DEST / folder
        path.mkdir(parents=True, exist_ok=True)
        if not folder.startswith("[resource]"):
            (path / ".info.meta").write_text(json.dumps(SCHEMA, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
        if text is not None:
            (path / ".desc.meta").write_text(text + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    importer = Importer()
    write_metadata()
    for map_id in MAPS:
        record = map_record(map_id)
        dump_json(DEST / "[struct]map.Map" / f"map.{map_id}.json", record)
        if "miniMap" in record:
            canvas = f"MiniMap/{map_id}"
            importer.copy_png(canvas, adv_resource(canvas))
        layer_set = {name: item.get("tileSet") for name, item in record["layers"].items()}
        back_rows = []
        for row in rows("Back", map_id):
            back_rows.append(pick(row, ("bS", "no", "ani", "x", "y", "rx", "ry", "type", "cx", "cy", "f", "a", "front")))
            if row.get("bS"):
                importer.add_back(row["bS"], int(row.get("ani") or 0), int(row["no"]))
        dump_jsonl(DEST / "[group]map.Back" / f"map.{map_id}.jsonl", back_rows)
        tile_rows = []
        for row in rows("Tile", map_id):
            tile_rows.append(pick(row, ("layer", "x", "y", "u", "no", "zM")))
            tileset = layer_set.get(str(row["layer"]))
            if not tileset:
                raise SystemExit(f"{map_id} tile on layer {row['layer']} has no tileSet")
            importer.add_tile(tileset, row["u"], int(row["no"]))
        if tile_rows:
            dump_jsonl(DEST / "[group]map.Tile" / f"map.{map_id}.jsonl", tile_rows)
        obj_rows = []
        for row in rows("Obj", map_id):
            obj_rows.append(pick(row, ("layer", "oS", "l0", "l1", "l2", "x", "y", "z", "f", "zM")))
            importer.add_obj(row["oS"], row["l0"], row["l1"], str(row["l2"]))
        if obj_rows:
            dump_jsonl(DEST / "[group]map.Obj" / f"map.{map_id}.jsonl", obj_rows)
        portal_rows = [
            pick(row, ("pn", "pt", "x", "y", "tm", "tn"), drop_empty=frozenset({"script"}))
            for row in rows("Portal", map_id)
        ]
        dump_jsonl(DEST / "[group]map.Portal" / f"map.{map_id}.jsonl", portal_rows)
        footholds = [
            pick(row, ("layer", "platform", "id", "x1", "y1", "x2", "y2", "prev", "next", "force", "forbidFallDown"))
            for row in rows("Foothold", map_id)
        ]
        if footholds:
            dump_jsonl(DEST / "[group]map.Foothold" / f"map.{map_id}.jsonl", footholds)
        ropes = [pick(row, ("x", "y1", "y2", "l", "uf", "page", "id")) for row in rows("Rope", map_id)]
        if ropes:
            dump_jsonl(DEST / "[group]map.Rope" / f"map.{map_id}.jsonl", ropes)

    for name, frames in importer.back_frames.items():
        dump_json(DEST / "[struct]map.Back" / f"map.back.{name}.json", {})
        dump_jsonl(DEST / "[group]map.BackFrame" / f"map.back.{name}.jsonl", frames)
    for name, frames in importer.tile_frames.items():
        dump_json(DEST / "[struct]map.Tileset" / f"map.tile.{name}.json", {})
        dump_jsonl(DEST / "[group]map.TileFrame" / f"map.tile.{name}.jsonl", frames)
    for name, frames in importer.obj_frames.items():
        dump_json(DEST / "[struct]map.Obj" / f"map.obj.{name}.json", {})
        dump_jsonl(DEST / "[group]map.ObjFrame" / f"map.obj.{name}.jsonl", frames)

    importer.add_helper()
    dump_json(DEST / "[struct]map.Helper" / "map.helper.json", {"gamePortal": ["pv", "ph", "psh"]})
    dump_jsonl(DEST / "[group]map.HelperFrame" / "map.helper.jsonl", importer.helper_frames)
    physics = load_json(SOURCE / "[struct]Physics" / "default.json")
    dump_json(DEST / "[struct]physics.Default" / "physics.default.json", physics)
    check(physics)
    print(
        f"png {len(importer.copied)} backs {len(importer.back_frames)} "
        f"tilesets {len(importer.tile_frames)} objs {len(importer.obj_frames)} "
        f"helper {len(importer.helper_frames)}"
    )


def check(physics: dict) -> None:
    village = load_json(DEST / "[struct]map.Map" / "map.222000000.json")
    well = load_json(DEST / "[struct]map.Map" / "map.222000001.json")
    sea = load_json(DEST / "[struct]map.Map" / "map.230030200.json")
    if village["info"]["swim"] != 0 or well["info"]["swim"] != 0 or sea["info"]["swim"] != 1:
        raise SystemExit("swim flags drifted")
    if village["vr"]["VRRight"] - village["vr"]["VRLeft"] <= 0:
        raise SystemExit("village vr collapsed")
    if well["vr"]["VRRight"] - well["vr"]["VRLeft"] != 800:
        raise SystemExit("well vr width drifted")
    if "vr" in sea:
        raise SystemExit("underwater map stored a vr it does not have")
    if any(key in village["info"] for key in VR_KEYS):
        raise SystemExit("vr left inside info")
    links = {}
    for map_id in MAPS:
        for line in (DEST / "[group]map.Portal" / f"map.{map_id}.jsonl").read_text(encoding="utf-8").splitlines():
            row = json.loads(line)
            links[(map_id, row["pn"])] = row
            if "hRange" in row or "vRange" in row:
                raise SystemExit(f"{map_id}/{row['pn']} stored a range the source does not have")
    expected = {
        ("222000000", "in00"): (222000001, "st00", 1),
        ("222000001", "out00"): (222000000, "in00", 3),
        ("222000001", "sea00"): (230030200, "east00", 1),
        ("230030200", "east00"): (222000001, "sea00", 1),
    }
    for key, (target, name, portal_type) in expected.items():
        row = links[key]
        if (row["tm"], row["tn"], row["pt"]) != (target, name, portal_type):
            raise SystemExit(f"portal {key} drifted: {row}")
    if links[("222000001", "st00")]["tm"] != 999999999:
        raise SystemExit("well st00 lost its sentinel")
    helper = [
        json.loads(line)
        for line in (DEST / "[group]map.HelperFrame" / "map.helper.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    pv0 = next(row for row in helper if row["name"] == "pv" and row["frame"] == "0")
    if pv0["origin"] != [43, 173] or "z" in pv0 or "delay" in pv0:
        raise SystemExit(f"pv/0 drifted: {pv0}")
    if physics["swimForce"] != 120000 or physics["gravityAcc"] != 2000:
        raise SystemExit("physics values drifted")
    for adventure_key in (pv0["resource"], village["miniMap"]["resource"]):
        path = DEST / "[resource]Map" / f"{adventure_key}.png"
        if path.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
            raise SystemExit(f"not a png: {path}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
