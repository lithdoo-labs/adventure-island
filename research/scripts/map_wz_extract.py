"""Extract CMS079 Map.wz metadata without inventing missing fields.

Opens Map.wz with the EMS IV already verified in
research/result/23-wz-library-cross-validation.md (version 79, printable
root names). Canvas pixels are not decoded. Absent properties stay absent:
normalized z/origin/delay are null when the node has no such child, never 0.

Usage:
  python research/scripts/map_wz_extract.py
  python research/scripts/map_wz_extract.py --only Back/grassySoil.img,MapHelper.img
"""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import sys
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, TextIO

REPO = Path(__file__).resolve().parents[2]
WZPY = REPO / ".work" / "task-023" / "tools" / "wz-python"
DEFAULT_WZ = REPO / ".work" / "task-001" / "extracted" / "冒险岛online" / "Map.wz"
DEFAULT_OUT = REPO / ".work" / "map-reverse"
sys.path.insert(0, str(WZPY))

from wzpy import WzFile  # noqa: E402
from wzpy.properties import (  # noqa: E402
    WzCanvasProperty,
    WzConvexProperty,
    WzDoubleProperty,
    WzFloatProperty,
    WzIntProperty,
    WzLongProperty,
    WzNullProperty,
    WzProperty,
    WzShortProperty,
    WzSubProperty,
    WzUolProperty,
    WzVectorProperty,
)

INT_TYPES = (WzIntProperty, WzShortProperty, WzLongProperty)
NAMED_CANVAS_FIELDS = ("z", "origin", "delay", "a", "alpha", "move", "f")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def image_sha256(wz: WzFile, image) -> str:
    blob = wz._mmap[image.offset : image.offset + image.size]
    return hashlib.sha256(blob).hexdigest()


def rel_path(prop: WzProperty) -> str:
    parts: List[str] = []
    cur: Optional[WzProperty] = prop
    while cur is not None and cur.parent is not None:
        parts.append(cur.name)
        cur = cur.parent
    return "/".join(reversed(parts))


def resolve_uol(uol: WzUolProperty) -> Dict[str, Any]:
    chain: List[str] = []
    seen = set()
    cur: Optional[WzProperty] = uol
    resolved_path = None
    resolved_type = None
    status = "unresolved"
    for _ in range(16):
        if cur is None or not isinstance(cur, WzUolProperty):
            break
        if id(cur) in seen:
            status = "loop"
            break
        seen.add(id(cur))
        chain.append(cur.value)
        parent = cur.parent
        nxt = parent.get(str(cur.value)) if parent is not None else None
        if nxt is None:
            status = "unresolved"
            cur = None
            break
        cur = nxt
        if not isinstance(cur, WzUolProperty):
            resolved_path = rel_path(cur)
            resolved_type = cur.type_name
            status = "resolved"
            break
    else:
        status = "depth-limit"
    return {
        "chain": chain,
        "status": status,
        "resolvedPath": resolved_path,
        "resolvedType": resolved_type,
    }


def serialize(prop: WzProperty) -> Dict[str, Any]:
    if isinstance(prop, WzCanvasProperty):
        return {
            "type": "Canvas",
            "width": prop.width,
            "height": prop.height,
            "format": prop.format,
            "format2": prop.format2,
            "children": [
                {"name": child.name, "order": index, **serialize(child)}
                for index, child in enumerate(prop.children())
            ],
        }
    if isinstance(prop, WzUolProperty):
        return {"type": "UOL", "value": prop.value, "resolution": resolve_uol(prop)}
    if isinstance(prop, WzVectorProperty):
        return {"type": "Vector", "x": prop.x, "y": prop.y}
    if isinstance(prop, WzConvexProperty):
        return {
            "type": "Convex",
            "points": [{"x": point.x, "y": point.y} for point in prop.points],
        }
    if isinstance(prop, WzSubProperty):
        return {
            "type": "SubProperty",
            "children": [
                {"name": child.name, "order": index, **serialize(child)}
                for index, child in enumerate(prop.children())
            ],
        }
    if isinstance(prop, WzNullProperty):
        return {"type": "Null", "value": None}
    if isinstance(prop, WzFloatProperty):
        value = float(prop.value)
        return {"type": "Float", "value": value, "leHex": struct.pack("<f", value).hex()}
    if isinstance(prop, WzDoubleProperty):
        value = float(prop.value)
        return {"type": "Double", "value": value, "leHex": struct.pack("<d", value).hex()}
    if isinstance(prop, INT_TYPES):
        return {"type": prop.type_name, "value": int(prop.value)}
    return {"type": prop.type_name, "value": prop.value}


def normalized_canvas(prop: WzCanvasProperty) -> Dict[str, Any]:
    by_name = {child.name: child for child in prop.children()}
    origin = by_name.get("origin")
    z_prop = by_name.get("z")
    origin_ok = isinstance(origin, WzVectorProperty)
    z_ok = isinstance(z_prop, INT_TYPES)
    named = {}
    for field in NAMED_CANVAS_FIELDS:
        child = by_name.get(field)
        if child is None or field in ("origin", "z"):
            continue
        named[field] = serialize(child)
    return {
        "z": int(z_prop.value) if z_ok else None,
        "zPresent": z_prop is not None,
        "zType": None if z_prop is None else z_prop.type_name,
        "width": prop.width,
        "height": prop.height,
        "origin": {
            "x": origin.x if origin_ok else None,
            "y": origin.y if origin_ok else None,
        },
        "originPresent": origin is not None,
        "format": prop.format,
        "format2": prop.format2,
        "named": named,
    }


def kind_for(image_path: str) -> str:
    if image_path == "MapHelper.img":
        return "MapHelper"
    if image_path.startswith("Back/"):
        return "Back"
    if image_path.startswith("Tile/"):
        return "Tile"
    if image_path.startswith("Obj/"):
        return "Obj"
    if image_path.startswith("Map/"):
        return "Map"
    return "Other"


def bucket_for(kind: str) -> str:
    return {
        "Back": "back",
        "Tile": "tile",
        "Obj": "obj",
        "MapHelper": "map-helper",
        "Map": "extracted",
    }.get(kind, "extracted")


class Emitter:
    def __init__(self, out_dir: Path):
        self.out_dir = out_dir
        self.handles: Dict[str, TextIO] = {}
        self.counts: Dict[str, int] = {}
        self.canvas_field_counts: Dict[str, Dict[str, int]] = {}
        self.uol_status: Dict[str, int] = {}
        self.parse_failures: List[str] = []
        self.truncated: List[str] = []

    def stream(self, kind: str) -> TextIO:
        name = f"{bucket_for(kind)}.jsonl"
        handle = self.handles.get(name)
        if handle is None:
            path = self.out_dir / name
            path.parent.mkdir(parents=True, exist_ok=True)
            handle = path.open("w", encoding="utf-8", newline="\n")
            self.handles[name] = handle
        return handle

    def emit(self, kind: str, record: Dict[str, Any]) -> None:
        record_type = record["recordType"]
        key = f"{kind}:{record_type}"
        self.counts[key] = self.counts.get(key, 0) + 1
        self.stream(kind).write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
        if record_type == "canvas":
            fields = self.canvas_field_counts.setdefault(kind, {})
            for child in record["raw"]:
                child_name = child["name"]
                fields[child_name] = fields.get(child_name, 0) + 1
        if record_type == "uol":
            status = record["resolution"]["status"]
            self.uol_status[status] = self.uol_status.get(status, 0) + 1
        if record_type in ("bag", "canvas"):
            self._count_uols(record["raw"])

    def _count_uols(self, nodes: Iterable[dict]) -> None:
        for node in nodes:
            if node.get("type") == "UOL":
                status = node["resolution"]["status"]
                self.uol_status[status] = self.uol_status.get(status, 0) + 1
            for child in node.get("children") or []:
                self._count_uols([child])

    def close(self) -> None:
        for handle in self.handles.values():
            handle.close()


def base_record(kind: str, image_path: str, provenance: Dict[str, Any], **extra: Any) -> Dict[str, Any]:
    record = {
        "kind": kind,
        "archive": "Map.wz",
        "image": image_path,
        "provenance": provenance,
    }
    record.update(extra)
    return record


def walk_container(
    node: WzSubProperty,
    emitter: Emitter,
    kind: str,
    image_path: str,
    provenance: Dict[str, Any],
    node_path: str,
) -> None:
    children = list(node.children())
    if not children:
        emitter.emit(
            kind,
            base_record(
                kind,
                image_path,
                provenance,
                recordType="group",
                nodePath=node_path,
                childOrder=[],
            ),
        )
        return
    containers = [
        child
        for child in children
        if isinstance(child, WzSubProperty) and not isinstance(child, WzCanvasProperty)
    ]
    canvases = [child for child in children if isinstance(child, WzCanvasProperty)]
    uols = [child for child in children if isinstance(child, WzUolProperty)]
    scalars = [
        child
        for child in children
        if not isinstance(child, WzSubProperty) and not isinstance(child, WzUolProperty)
    ]
    loose = [
        (index, child)
        for index, child in enumerate(children)
        if not isinstance(child, WzCanvasProperty)
        and (not isinstance(child, WzSubProperty) or isinstance(child, WzUolProperty))
    ]

    if children and not containers and not canvases:
        emitter.emit(
            kind,
            base_record(
                kind,
                image_path,
                provenance,
                recordType="bag",
                nodePath=node_path,
                sourceKey=node.name if node.parent is not None else "",
                childOrder=[
                    {"order": index, "name": child.name, "type": child.type_name}
                    for index, child in enumerate(children)
                ],
                raw=[
                    {"name": child.name, "order": index, **serialize(child)}
                    for index, child in enumerate(children)
                ],
            ),
        )
        return

    emitter.emit(
        kind,
        base_record(
            kind,
            image_path,
            provenance,
            recordType="group",
            nodePath=node_path,
            childOrder=[
                {"order": index, "name": child.name, "type": child.type_name}
                for index, child in enumerate(children)
            ],
        ),
    )
    if loose:
        emitter.emit(
            kind,
            base_record(
                kind,
                image_path,
                provenance,
                recordType="bag",
                nodePath=node_path,
                sourceKey=node.name if node.parent is not None else "",
                childOrder=[
                    {"order": index, "name": child.name, "type": child.type_name}
                    for index, child in loose
                ],
                raw=[
                    {"name": child.name, "order": index, **serialize(child)}
                    for index, child in loose
                ],
            ),
        )
    for index, child in enumerate(children):
        child_path = f"{node_path}/{child.name}" if node_path else child.name
        if isinstance(child, WzCanvasProperty):
            emitter.emit(
                kind,
                base_record(
                    kind,
                    image_path,
                    provenance,
                    recordType="canvas",
                    nodePath=child_path,
                    sourceKey=child.name,
                    sourceOrder=index,
                    canvas=normalized_canvas(child),
                    raw=[
                        {"name": grand.name, "order": grand_index, **serialize(grand)}
                        for grand_index, grand in enumerate(child.children())
                    ],
                ),
            )
        elif isinstance(child, WzSubProperty):
            walk_container(child, emitter, kind, image_path, provenance, child_path)


def extract_image(wz: WzFile, image, archive_path: Path, archive_sha: str, emitter: Emitter) -> None:
    image_path = image.path
    kind = kind_for(image_path)
    if kind == "Other":
        return
    provenance = {
        "sourceFile": str(archive_path),
        "archiveSha256": archive_sha,
        "imagePath": image_path,
        "imageOffset": image.offset,
        "imageSize": image.size,
        "imageSha256": image_sha256(wz, image),
        "region": "EMS",
        "version": wz.version,
        "extractionMethod": "wzpy.WzFile property walk; canvas pixels not decoded; missing children omitted",
    }
    try:
        root = image.parse()
    except Exception as exc:  # noqa: BLE001 - record and continue
        emitter.parse_failures.append(f"{image_path}: {type(exc).__name__}: {exc}")
        return
    if image.truncated or image.parse_warnings:
        emitter.truncated.append(
            f"{image_path}: truncated={image.truncated} warnings={len(image.parse_warnings)}"
        )
    walk_container(root, emitter, kind, image_path, provenance, "")
    image._root = None
    image._parsed = False


def selected(paths: Optional[List[str]], image_path: str) -> bool:
    if not paths:
        return True
    return image_path in paths


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wz", type=Path, default=DEFAULT_WZ)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--only", default="", help="Comma-separated image paths")
    args = parser.parse_args()
    if not args.wz.is_file():
        print(f"MISSING {args.wz}", file=sys.stderr)
        return 2
    only = [part.strip() for part in args.only.split(",") if part.strip()] or None
    started = time.perf_counter()
    print("hashing archive", flush=True)
    archive_sha = sha256_file(args.wz)
    print("archive", archive_sha, args.wz.stat().st_size, flush=True)
    wz = WzFile.open(str(args.wz), region="EMS")
    args.out.mkdir(parents=True, exist_ok=True)
    emitter = Emitter(args.out)
    ordered = [image for _, image in wz.root.walk_images()]
    done = 0
    for image in ordered:
        if not selected(only, image.path):
            continue
        extract_image(wz, image, args.wz, archive_sha, emitter)
        done += 1
        if done % 250 == 0:
            print(f"parsed {done}", flush=True)
    emitter.close()
    summary = {
        "archive": str(args.wz),
        "archiveBytes": args.wz.stat().st_size,
        "archiveSha256": archive_sha,
        "version": wz.version,
        "region": "EMS",
        "imagesExtracted": done,
        "counts": emitter.counts,
        "canvasChildNames": emitter.canvas_field_counts,
        "uolStatus": emitter.uol_status,
        "parseFailures": emitter.parse_failures,
        "truncatedOrWarnings": emitter.truncated,
        "elapsedSeconds": round(time.perf_counter() - started, 3),
        "outputs": sorted(path.name for path in args.out.glob("*.jsonl")),
    }
    (args.out / "extract-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"images": done, "counts": emitter.counts, "seconds": summary["elapsedSeconds"]}, ensure_ascii=False))
    return 1 if emitter.parse_failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
