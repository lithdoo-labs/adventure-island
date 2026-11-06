"""Build content/[FSDB]adventure from the converted CMS Look library.

Parts are every body, head, face and hair, plus CommonFaceCN.
Equipment is the two Henesys sets from the playable-content plan.
Images are packed per item. Draw order follows content/adventure_design.md.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from collections import defaultdict
from pathlib import Path

from PIL import Image

SOURCE = Path(r"E:\cms079-pr1-work\fsdb-all") / "[FSDB]cms"
EQUIPMENT = (
    "01000000",
    "01000001",
    "01040002",
    "01050002",
    "01062001",
    "01070000",
    "01082002",
    "01092003",
    "01302000",
    "01422000",
)
SET_PARTS = (
    "00002000",
    "00012000",
    "00020000",
    "00020002",
    "00030000",
    "00030001",
    "CommonFaceCN",
)
KIND = {
    "Bd": ("part", "body"),
    "Hd": ("part", "head"),
    "Fc": ("part", "face"),
    "Hr": ("part", "hair"),
    "Cp": ("equip", "cap"),
    "HrCp": ("equip", "cap"),
    "Ma": ("equip", "coat"),
    "MaPn": ("equip", "longcoat"),
    "Pn": ("equip", "pants"),
    "So": ("equip", "shoes"),
    "Gv": ("equip", "glove"),
    "Sr": ("equip", "cape"),
    "Si": ("equip", "shield"),
    "Wp": ("equip", "weapon"),
    "WpSi": ("equip", "weapon"),
    "Af": ("equip", "faceAcc"),
    "Ay": ("equip", "eyeAcc"),
    "Ae": ("equip", "earAcc"),
}
FIXES = (
    ("wepon", "weapon"),
    ("bleow", "below"),
    ("bdlow", "below"),
    ("acssesary", "accessory"),
    ("ovearm", "overarm"),
)
SQUARES = (256, 512, 1024, 2048, 4096, 8192)
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
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def dump_line(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def pairs(value, label: str) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, str) or len(value) % 2:
        raise SystemExit(f"odd slot string {label}: {value!r}")
    return [value[i : i + 2] for i in range(0, len(value), 2)]


def z_text(value) -> str | None:
    if isinstance(value, str) and value.strip():
        return value
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    return None


def is_canvas(value) -> bool:
    return (
        isinstance(value, dict)
        and isinstance(value.get("resource"), str)
        and z_text(value.get("z")) is not None
        and isinstance(value.get("width"), int)
        and isinstance(value.get("height"), int)
        and isinstance(value.get("origin"), list)
    )


def is_redirect(value) -> bool:
    return (
        isinstance(value, dict)
        and isinstance(value.get("action"), str)
        and isinstance(value.get("frame"), int)
        and not isinstance(value.get("frame"), bool)
        and "resource" not in value
    )


def numeric_keys(node: dict) -> list[str]:
    keys = [key for key in node if key.isdigit()]
    keys.sort(key=int)
    return keys


def point(value, label: str):
    if (
        isinstance(value, list)
        and len(value) == 2
        and all(isinstance(part, (int, float)) and not isinstance(part, bool) for part in value)
    ):
        return [value[0], value[1]]
    raise SystemExit(f"bad point {label}: {value!r}")


def anchors_of(canvas, label: str) -> dict:
    raw = canvas.get("map")
    if not isinstance(raw, dict):
        return {}
    return {name: point(pos, f"{label}.{name}") for name, pos in raw.items() if isinstance(pos, list)}


class DrawOrder:
    def __init__(self, zmap: list[str]):
        self.zmap = zmap
        self.folded = {name.casefold(): name for name in zmap}
        self.before = defaultdict(set)
        self.after = defaultdict(set)
        self.fallback = set()

    def bind(self, raw: str) -> str:
        plain = raw.strip().casefold()
        if plain in self.folded:
            return self.folded[plain]
        fixed = plain
        for src, dst in FIXES:
            fixed = fixed.replace(src, dst)
        if fixed in self.folded:
            return self.folded[fixed]
        stored = raw.strip()
        for marker, side in (("below", "after"), ("under", "after"), ("over", "before")):
            at = fixed.rfind(marker)
            if at < 0:
                continue
            suffix = fixed[at + len(marker) :]
            if fixed.startswith("back") and f"back{suffix}" in self.folded:
                anchor = self.folded[f"back{suffix}"]
            elif suffix in self.folded:
                anchor = self.folded[suffix]
            else:
                continue
            (self.before if side == "before" else self.after)[anchor].add(stored)
            return stored
        self.fallback.add(stored)
        return stored

    def front_to_back(self) -> list[str]:
        order = []
        for name in self.zmap:
            order.extend(sorted(self.before[name]))
            order.append(name)
            if name == "characterEnd":
                order.extend(sorted(self.fallback))
            order.extend(sorted(self.after[name]))
        if len(order) != len(set(order)):
            raise SystemExit("draw order contains a duplicate name")
        return order


def png_path(source_root: Path, resource: str) -> Path:
    relative = Path(resource)
    if relative.suffix.lower() == ".png":
        return source_root / "[resource]图" / relative
    return source_root / "[resource]图" / Path(str(relative) + ".png")


def valid_name(value: str) -> bool:
    if not value or value.startswith((".", "$")) or value.endswith("."):
        return False
    if len(value.encode("utf-8")) > 200:
        return False
    if any(char in value for char in '\\/<>:"|?*') or any(ord(char) < 32 for char in value):
        return False
    return True


class Atlas:
    def __init__(self, side: int):
        self.side = side
        self.x = 1
        self.y = 1
        self.row_h = 0
        self.placed = []

    def try_place(self, sprite) -> bool:
        width, height = sprite["w"], sprite["h"]
        if width + 2 > self.side or height + 2 > self.side:
            return False
        x, y, row_h = self.x, self.y, self.row_h
        if x + width + 1 > self.side:
            y += row_h + 1
            x = 1
            row_h = 0
        if y + height + 1 > self.side:
            return False
        self.x = x + width + 1
        self.y = y
        self.row_h = max(row_h, height)
        self.placed.append((sprite, x, y))
        return True


def pack(sprites: list[dict]) -> list[tuple[int, list]]:
    ordered = sorted(sprites, key=lambda item: (-item["h"], -item["w"], item["name"]))
    for side in SQUARES:
        atlas = Atlas(side)
        if all(atlas.try_place(sprite) for sprite in ordered):
            return [(side, atlas.placed)]
    pages = []
    atlas = Atlas(8192)
    for sprite in ordered:
        if not atlas.try_place(sprite):
            if not atlas.placed:
                raise SystemExit(f"sprite does not fit 8192: {sprite['name']} {sprite['w']}x{sprite['h']}")
            pages.append((8192, atlas.placed))
            atlas = Atlas(8192)
            if not atlas.try_place(sprite):
                raise SystemExit(f"sprite does not fit a fresh page: {sprite['name']}")
    if atlas.placed:
        pages.append((8192, atlas.placed))
    return pages


def dotted(prefix: str, action: str, frame_index, *parts: str) -> str:
    bits = [prefix, action]
    if frame_index is not None:
        bits.append(str(frame_index))
    bits.extend(parts)
    name = ".".join(bits)
    if not valid_name(name):
        raise SystemExit(f"illegal resource name {name}")
    return name


def register(images: dict, taken: set[str], source: str, proposed: str, width: int, height: int) -> str:
    current = images.get(source)
    if current:
        return current["name"]
    name = proposed
    serial = 2
    while name in taken:
        name = f"{proposed}.{serial}"
        serial += 1
        if not valid_name(name):
            raise SystemExit(f"illegal resource name {name}")
    taken.add(name)
    images[source] = {"name": name, "w": width, "h": height}
    return name


def canvas_layer(name, canvas, action, frame_index, prefix, images, taken, order: DrawOrder):
    resource = register(
        images,
        taken,
        canvas["resource"],
        dotted(prefix, action, frame_index, name),
        canvas["width"],
        canvas["height"],
    )
    return {
        "name": name,
        "z": order.bind(z_text(canvas["z"])),
        "resource": resource,
        "origin": point(canvas["origin"], name),
        "anchors": anchors_of(canvas, name),
    }


def shade_layer(name, skins, action, frame_index, prefix, images, taken, order: DrawOrder):
    by_key = {key: canvas for key, canvas in skins}
    default_key = "0" if "0" in by_key else skins[0][0]
    default = canvas_layer(f"{name}.{default_key}", by_key[default_key], action, frame_index, prefix, images, taken, order)
    layer = {
        "name": name,
        "z": default["z"],
        "resource": default["resource"],
        "origin": default["origin"],
        "anchors": default["anchors"],
    }
    variants = {}
    for key, canvas in skins:
        if key == default_key:
            continue
        child = canvas_layer(f"{name}.{key}", canvas, action, frame_index, prefix, images, taken, order)
        variant = {
            "resource": child["resource"],
            "origin": child["origin"],
            "anchors": child["anchors"],
        }
        if child["z"] != layer["z"]:
            variant["z"] = child["z"]
        if variant["resource"] != layer["resource"] or variant["origin"] != layer["origin"] or variant["anchors"] != layer["anchors"] or "z" in variant:
            variants[key] = variant
    if variants:
        layer["variants"] = variants
    return layer


def frame_row(frame, action, frame_index, kind, prefix, images, taken, order: DrawOrder):
    row = {"action": action}
    if frame_index is not None:
        row["frame"] = frame_index
    delay = frame.get("delay")
    if isinstance(delay, (int, float)) and not isinstance(delay, bool):
        row["delay"] = abs(delay) if isinstance(delay, int) else abs(delay)
        row["delaySign"] = -1 if delay < 0 else 1
    if kind == "body" and "face" in frame:
        row["showFace"] = frame["face"] != 0
    move = frame.get("move")
    if isinstance(move, list):
        row["move"] = point(move, f"{action}.move")
    if frame.get("flip") in (1, True):
        row["flip"] = True
    rotate = frame.get("rotate")
    if isinstance(rotate, int) and not isinstance(rotate, bool):
        row["rotate"] = rotate
    layers = []
    for name, value in frame.items():
        if not isinstance(value, dict):
            continue
        if is_canvas(value):
            layers.append(canvas_layer(name, value, action, frame_index, prefix, images, taken, order))
        else:
            skins = [(key, child) for key, child in value.items() if is_canvas(child)]
            if skins:
                layers.append(shade_layer(name, skins, action, frame_index, prefix, images, taken, order))
    if is_redirect(frame):
        row["redirect"] = {"action": frame["action"], "frame": frame["frame"]}
    if layers:
        row["layers"] = layers
    if len(row) == 1 and "layers" not in row:
        return None
    return row


def iter_frames(data):
    for action, node in data.items():
        if action == "info" or action == "skill" or not isinstance(node, dict):
            continue
        keys = numeric_keys(node)
        if keys:
            for key in keys:
                frame = node[key]
                if isinstance(frame, dict):
                    yield action, int(key), frame
        else:
            yield action, None, node


def write_atlas(dest: Path, branch: str, kind: str, item_id: str, images: dict) -> list[dict]:
    if not images:
        return []
    sprites = []
    for source, meta in images.items():
        path = png_path(SOURCE, source)
        if not path.is_file():
            raise SystemExit(f"missing png {path}")
        with Image.open(path) as opened:
            image = opened.convert("RGBA")
            if image is opened:
                image = opened.copy()
        meta = dict(meta)
        meta["w"], meta["h"] = image.size
        meta["im"] = image
        sprites.append(meta)
    rows = []
    folder = dest / "[resource]Avatar" / branch / kind / item_id
    folder.mkdir(parents=True, exist_ok=True)
    for page, (side, placed) in enumerate(pack(sprites)):
        atlas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        for sprite, x, y in placed:
            atlas.paste(sprite["im"], (x, y), sprite["im"])
            rows.append(
                {
                    "name": sprite["name"],
                    "image": f"{branch}/{kind}/{item_id}/{page}",
                    "page": page,
                    "x": x,
                    "y": y,
                    "w": sprite["w"],
                    "h": sprite["h"],
                }
            )
        atlas.save(folder / f"{page}.png", format="PNG", compress_level=1)
        atlas.close()
    for sprite in sprites:
        sprite["im"].close()
    rows.sort(key=lambda row: row["name"])
    return rows


def part_record(kind: str, item_id: str, info: dict) -> dict:
    record = {
        "kind": kind,
        "itemId": item_id,
        "occupies": pairs(info.get("islot"), f"{item_id}.islot") if info.get("islot") else [],
        "covers": pairs(info.get("vslot"), f"{item_id}.vslot"),
    }
    if kind == "weapon":
        stance = {
            name: info[name]
            for name in ("stand", "walk", "attack")
            if isinstance(info.get(name), int) and not isinstance(info.get(name), bool)
        }
        if stance:
            record["stance"] = stance
    if item_id == "CommonFaceCN":
        record["occupies"] = ["Fc"]
    return record


def convert_one(dest: Path, stem: str, data: dict, branch: str, kind: str, order: DrawOrder) -> None:
    info = data.get("info") if isinstance(data.get("info"), dict) else {}
    prefix = f"avatar.{branch}.{kind}.{stem}"
    images = {}
    taken = set()
    rows = []
    for action, frame_index, frame in iter_frames(data):
        row = frame_row(frame, action, frame_index, kind, prefix, images, taken, order)
        if row:
            rows.append(row)
    if not rows:
        return
    key_path = prefix
    dump_json(dest / "[struct]avatar.Part" / f"{key_path}.json", part_record(kind, stem, info))
    frame_path = dest / "[group]avatar.PartFrame" / f"{key_path}.jsonl"
    frame_path.write_text("\n".join(dump_line(row) for row in rows) + "\n", encoding="utf-8", newline="\n")
    resource_rows = write_atlas(dest, branch, kind, stem, images)
    if resource_rows:
        resource_path = dest / "[group]avatar.Resource" / f"{key_path}.jsonl"
        resource_path.write_text("\n".join(dump_line(row) for row in resource_rows) + "\n", encoding="utf-8", newline="\n")


def selected_records(scope: str) -> list[tuple[str, str, str]]:
    look = SOURCE / "[struct]Look"
    chosen = []
    if scope == "all":
        stems = []
        for pattern in ("0000*.json", "0001*.json", "0002*.json", "0003*.json", "0004*.json", "CommonFaceCN.json"):
            stems.extend(path.stem for path in look.glob(pattern))
        for stem in stems:
            if stem in EQUIPMENT:
                continue
            data = load_json(look / f"{stem}.json")
            info = data.get("info") if isinstance(data.get("info"), dict) else {}
            islot = info.get("islot")
            if stem == "CommonFaceCN":
                chosen.append((stem, "part", "face"))
            elif islot in {"Bd", "Hd", "Fc", "Hr"}:
                chosen.append((stem, *KIND[islot]))
    else:
        for stem in SET_PARTS:
            data = load_json(look / f"{stem}.json")
            info = data.get("info") if isinstance(data.get("info"), dict) else {}
            if stem == "CommonFaceCN":
                chosen.append((stem, "part", "face"))
            else:
                chosen.append((stem, *KIND[info["islot"]]))
    for stem in EQUIPMENT:
        data = load_json(look / f"{stem}.json")
        info = data["info"]
        chosen.append((stem, *KIND[info["islot"]]))
    unique = []
    seen = set()
    for item in chosen:
        if item[0] not in seen:
            seen.add(item[0])
            unique.append(item)
    return unique


def write_metadata(dest: Path) -> None:
    tables = {
        "[struct]avatar.Part": "纸娃娃部件。身份、槽位和武器姿势。",
        "[group]avatar.PartFrame": "部件的姿势帧。一行一帧。",
        "[struct]avatar.DrawOrder": "人物绘制顺序。越靠前越盖在上面。",
        "[struct]avatar.LayerSlot": "绘制层对应的遮挡槽。空数组不参与遮挡。",
        "[group]avatar.Resource": "每张小图在大图中的矩形。",
        "[resource]Avatar": "部件和装备的动作图集。PNG。扩展名不属于 ResourceKey。",
    }
    for folder, text in tables.items():
        path = dest / folder
        path.mkdir(parents=True, exist_ok=True)
        if not folder.startswith("[resource]"):
            (path / ".info.meta").write_text(json.dumps(SCHEMA, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
        if folder.startswith("[group]") or folder.startswith("[resource]"):
            (path / ".desc.meta").write_text(text + "\n", encoding="utf-8", newline="\n")


def write_order(dest: Path, order: DrawOrder, smap: dict) -> list[str]:
    front = order.front_to_back()
    dump_json(dest / "[struct]avatar.DrawOrder" / "avatar.json", {"frontToBack": front})
    slots = {}
    for name in front:
        value = smap.get(name)
        slots[name] = pairs(value, f"smap.{name}") if isinstance(value, str) else []
    dump_json(dest / "[struct]avatar.LayerSlot" / "avatar.json", slots)
    return front


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dest", type=Path, required=True)
    parser.add_argument("--scope", choices=("all", "sets"), default="all")
    parser.add_argument("--replace", action="store_true")
    args = parser.parse_args()
    dest = args.dest
    if dest.exists():
        if not args.replace:
            raise SystemExit(f"destination exists: {dest}")
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    write_metadata(dest)
    zmap = list(load_json(SOURCE / "[struct]ZMap" / "order.json"))
    smap = load_json(SOURCE / "[struct]SMap" / "smap.json")
    order = DrawOrder(zmap)
    records = selected_records(args.scope)
    look = SOURCE / "[struct]Look"
    print(f"records {len(records)} scope {args.scope}", flush=True)
    kept = 0
    for index, (stem, branch, kind) in enumerate(records, start=1):
        convert_one(dest, stem, load_json(look / f"{stem}.json"), branch, kind, order)
        part_file = dest / "[struct]avatar.Part" / f"avatar.{branch}.{kind}.{stem}.json"
        if part_file.is_file():
            kept += 1
        if index % 100 == 0 or index == len(records):
            print(f"{index}/{len(records)} {stem}", flush=True)
    front = write_order(dest, order, smap)
    print(f"kept {kept} draw {len(front)} fallback {len(order.fallback)}", flush=True)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
