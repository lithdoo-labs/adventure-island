"""Copy the playable CMS079 slice into content/[FSDB]cms.

The table layout and metadata come from an already converted full FSDB.
Selected records are copied unchanged. Every other table keeps the same
metadata and no data files, so later equipment, maps, skills and items
can be added without a new schema.

This script refuses to write inside a tracked path other than the
explicit content/[FSDB]cms destination.
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

SOURCE = Path(r"E:\cms079-pr1-work\fsdb-all") / "[FSDB]cms"
DEST = Path(__file__).resolve().parents[2] / "content" / "[FSDB]cms"
META = (".info.meta", ".desc.meta", ".extend.meta")
LOOKS = (
    "00002000", "00012000",
    "00020000", "00020002",
    "00030000", "00030001",
    "01000000", "01000001",
    "01040002", "01050002", "01062001",
    "01070000", "01082002", "01092003",
    "01302000", "01422000",
)
MAPS = ("100000000", "100000100")
MAP_GROUPS = ("Foothold", "Portal", "Back", "Tile", "Obj")
WHOLE_STRUCTS = ("ZMap", "ZMapCn", "SMap", "Physics")


def copy_file(source: Path, dest: Path) -> None:
    if source.is_symlink():
        raise SystemExit(f"refusing symlink {source}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, dest)


def copy_metadata(table: Path) -> None:
    dest = DEST / table.name
    dest.mkdir(parents=True, exist_ok=True)
    for name in META:
        source = table / name
        if source.is_file():
            copy_file(source, dest / name)


def copy_named(table: str, key: str, suffix: str) -> None:
    file = SOURCE / table / f"{key}{suffix}"
    if not file.is_file():
        raise SystemExit(f"missing {file}")
    copy_file(file, DEST / table / file.name)


def strings(value, found: set[str]) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key == "resource" and isinstance(child, str):
                found.add(child)
            elif key == "bgm" and isinstance(child, str) and child:
                found.add(child if child.startswith("Sound/") else f"Sound/{child}")
            else:
                strings(child, found)
    elif isinstance(value, list):
        for child in value:
            strings(child, found)
    elif isinstance(value, str) and "/" in value:
        found.add(value)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def json_lines(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def copy_tilesets() -> list[str]:
    names: set[str] = set()
    for map_id in MAPS:
        record = load_json(DEST / "[struct]Map" / f"{map_id}.json")
        for layer in record.get("layers", []):
            name = layer.get("tileSet")
            if isinstance(name, str) and name:
                names.add(name)
    for name in sorted(names):
        copy_named("[struct]Tileset", name, ".json")
    return sorted(names)


def copy_used_objects() -> list[str]:
    """Write each object-set record with only the branches these maps place."""
    used: dict[str, set[tuple[str, str, str]]] = {}
    for map_id in MAPS:
        for row in json_lines(DEST / "[group]Obj" / f"{map_id}.jsonl"):
            used.setdefault(row["oS"], set()).add((str(row["l0"]), str(row["l1"]), str(row["l2"])))
    written = []
    for name in sorted(used):
        source = load_json(SOURCE / "[struct]Obj" / f"{name}.json")
        wanted: dict[str, dict[str, set[str]]] = {}
        for level0, level1, level2 in used[name]:
            wanted.setdefault(level0, {}).setdefault(level1, set()).add(level2)
        pruned: dict = {}
        missing = []
        for level0, branches in source.items():
            if level0 not in wanted or not isinstance(branches, dict):
                continue
            kept_branches = {}
            for level1, objects in branches.items():
                if level1 not in wanted[level0] or not isinstance(objects, dict):
                    continue
                kept = {key: node for key, node in objects.items() if str(key) in wanted[level0][level1]}
                if kept:
                    kept_branches[level1] = kept
            if kept_branches:
                pruned[level0] = kept_branches
        for level0, branches in wanted.items():
            for level1, objects in branches.items():
                have = pruned.get(level0, {}).get(level1, {})
                for level2 in objects:
                    if level2 not in have:
                        missing.append(f"{name}/{level0}/{level1}/{level2}")
        if missing:
            raise SystemExit("object definitions missing:\n" + "\n".join(missing[:20]))
        dest = DEST / "[struct]Obj" / f"{name}.json"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(pruned, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        written.append(name)
    return written


def copy_referenced_resources() -> int:
    keys: set[str] = set()
    for path in DEST.rglob("*"):
        if path.suffix in {".json", ".jsonl"} and not path.name.startswith("."):
            payload = load_json(path) if path.suffix == ".json" else json_lines(path)
            strings(payload, keys)
    copied: set[tuple[str, str]] = set()
    missing = []
    for key in sorted(keys):
        found = copy_resource("[resource]图", key, copied) or copy_resource("[resource]音", key, copied)
        if not found:
            missing.append(key)
    if missing:
        sample = "\n".join(missing[:20])
        raise SystemExit(f"{len(missing)} referenced resources were not found\n{sample}")
    return len(copied)


def copy_resource(table: str, key: str, copied: set[tuple[str, str]]) -> bool:
    token = (table, key)
    if token in copied:
        return True
    directory = SOURCE / table
    parts = key.split("/")
    folder = directory.joinpath(*parts[:-1])
    leaf = parts[-1]
    if not folder.is_dir():
        return False
    matches = []
    for file in folder.iterdir():
        if not file.is_file() or file.is_symlink() or "." not in file.name:
            continue
        stem, _ext = file.name.rsplit(".", 1)
        if stem == leaf:
            matches.append(file)
    if not matches:
        return False
    for file in matches:
        copy_file(file, DEST / table / Path(*parts[:-1]) / file.name)
    copied.add(token)
    return True


def main() -> None:
    if not SOURCE.is_dir():
        raise SystemExit(f"full FSDB not found: {SOURCE}")
    if DEST.exists():
        raise SystemExit(f"destination already exists: {DEST}")
    tables = sorted(path for path in SOURCE.iterdir() if path.is_dir() and path.name.startswith("["))
    for table in tables:
        copy_metadata(table)
    for key in LOOKS:
        copy_named("[struct]Look", key, ".json")
    for name in WHOLE_STRUCTS:
        folder = SOURCE / f"[struct]{name}"
        for file in folder.glob("*.json"):
            copy_file(file, DEST / folder.name / file.name)
    for map_id in MAPS:
        copy_named("[struct]Map", map_id, ".json")
        for group in MAP_GROUPS:
            copy_named(f"[group]{group}", map_id, ".jsonl")
    backs = set()
    for map_id in MAPS:
        for line in (DEST / "[group]Back" / f"{map_id}.jsonl").read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            if isinstance(row.get("bS"), str) and row["bS"]:
                backs.add(row["bS"])
    for key in sorted(backs):
        copy_named("[struct]Back", key, ".json")
    tilesets = copy_tilesets()
    objects = copy_used_objects()
    resources = copy_referenced_resources()
    print(
        f"tables={len(tables)} looks={len(LOOKS)} maps={len(MAPS)} "
        f"backs={len(backs)} tilesets={len(tilesets)} objects={len(objects)} resources={resources}"
    )


if __name__ == "__main__":
    sys.exit(main())
