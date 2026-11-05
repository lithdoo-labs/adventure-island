"""Convert a CMS 079 WZ tree into an FSDB directory.

Importing this module does not read a WZ file or write an FSDB. Pass
``--wz-root``, ``--out``, and ``--wzpy`` when running it. Those paths are
never stored in the repository.

Stdout is counts and relative paths. It does not print string payloads,
pixels, or audio.

Scopes:

- ``phase1`` — the historical minimal sample (three maps + one body + Bgm00).
- ``all`` — the complete 16 data packages. With ``--batch-state`` the run is
  resumable per package: every table/group/resource write is deduplicated
  across processes through persisted manifests, so an interrupted package
  can be re-run without overwriting or duplicating output, and completed
  packages are skipped. ``--finalize`` closes an ``all`` run (record alias
  table, metadata, aggregate summary).
- ``avatar`` — the minimal real paper-doll subset: the five Look records
  (body/head/face/hair/weapon), ``struct.ZMap/order`` and only the Canvas
  PNGs actually referenced by the tested actions. The Look records keep the
  full converted subtree; canvases outside the tested actions are counted
  (``canvasesOutOfScope``) instead of written.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import time
import unicodedata
from collections import Counter
from pathlib import Path

REGION = "EMS"
CANVAS_RESOURCE_TABLE = "图"
SOUND_RESOURCE_TABLE = "音"
DESIGN_SOUND_RESOURCE_TABLE = "音"
DATA_PACKAGES = (
    "Base.wz", "Character.wz", "Effect.wz", "Etc.wz", "Item.wz", "Map.wz",
    "Mob.wz", "Morph.wz", "Npc.wz", "Quest.wz", "Reactor.wz", "Skill.wz",
    "Sound.wz", "String.wz", "TamingMob.wz", "UI.wz",
)
Image = None
WzCanvasProperty = WzConvexProperty = WzFile = None
WzNullProperty = WzSoundProperty = WzStringProperty = None
WzSubProperty = WzUolProperty = WzVectorProperty = None
decode_canvas = None


def load_dependencies(wzpy_root: Path) -> None:
    """Import Pillow and a local wzpy checkout. wzpy is not vendored here."""
    global Image, WzCanvasProperty, WzConvexProperty, WzFile
    global WzNullProperty, WzSoundProperty, WzStringProperty
    global WzSubProperty, WzUolProperty, WzVectorProperty, decode_canvas
    root = str(wzpy_root)
    if root not in sys.path:
        sys.path.insert(0, root)
    from PIL import Image as pillow_image
    from wzpy import (
        WzCanvasProperty as canvas_property,
        WzConvexProperty as convex_property,
        WzFile as wz_file,
        WzNullProperty as null_property,
        WzSoundProperty as sound_property,
        WzStringProperty as string_property,
        WzSubProperty as sub_property,
        WzUolProperty as uol_property,
        WzVectorProperty as vector_property,
    )
    from wzpy.canvas import decode_canvas as decode_canvas_fn
    Image = pillow_image
    WzCanvasProperty = canvas_property
    WzConvexProperty = convex_property
    WzFile = wz_file
    WzNullProperty = null_property
    WzSoundProperty = sound_property
    WzStringProperty = string_property
    WzSubProperty = sub_property
    WzUolProperty = uol_property
    WzVectorProperty = vector_property
    decode_canvas = decode_canvas_fn


def is_uol(node) -> bool:
    return type(node).__name__ == "WzUolProperty" or getattr(node, "synthetic_uol", False) is True


def resolve_uol(node):
    """Follow the converter's UOL rule: the link is relative to ``node.parent``.

    An already repeated UOL is a cycle; depth exhaustion is not a cycle.
    A missing parent is dangling.
    """
    seen = set()
    cur = node
    for _ in range(16):
        if not is_uol(cur):
            return cur, "ok"
        if id(cur) in seen or cur.parent is None:
            return None, "cycle" if id(cur) in seen else "dangling"
        seen.add(id(cur))
        cur = cur.parent.get(str(cur.value))
        if cur is None:
            return None, "dangling"
    return (cur, "ok") if not is_uol(cur) else (None, "depth_limit")


def uol_failure_record(status: str, value: str | None = None) -> dict:
    """Record stored when a UOL does not resolve.

    Keep the original link text in the unresolved record.
    """
    return {"uol": True, "resolved": False, "status": status, "value": value}


def segment_issue(value: str) -> str | None:
    """First NameSegment rule that rejects ``value``, or None when it is legal.

    The order matches :func:`valid_segment`. This does not invent a replacement key.
    """
    if unicodedata.normalize("NFC", value) != value:
        return "not_nfc"
    size = len(value.encode("utf-8"))
    if size < 1:
        return "empty"
    if size > 200:
        return "too_long"
    if value.startswith("."):
        return "leading_dot"
    if value.startswith("$"):
        return "leading_dollar"
    if value.endswith("."):
        return "trailing_dot"
    if value[0].isspace():
        return "leading_whitespace"
    if value[-1].isspace():
        return "trailing_whitespace"
    for char in value:
        if char in '\\/<>:"|?*\0':
            return "illegal_character"
        if unicodedata.category(char) in {"Cc", "Cs"}:
            return "control_character"
    if DEVICE.fullmatch(value.split(".", 1)[0]) is not None:
        return "reserved_device_name"
    return None
DEVICE = re.compile(r"(?i:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])$")
MAP_GROUPS = {
    "back", "life", "portal", "reactor", "foothold", "ladderRope", "seat",
    "area", "swimArea", "weather", "ToolTip", "user",
}
LAYER_NAMES = {str(i) for i in range(8)}
PHASE1_MAPS = {"100000000", "105090321", "105090320"}

AVATAR_LOOK_IDS = ("00002000", "00012000", "00020000", "00030000", "01302000")
AVATAR_ACTIONS = ("stand1", "walk1", "jump", "brandish1")
AVATAR_EXPRESSION = "default"


def dumps(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def valid_segment(value: str) -> bool:
    if unicodedata.normalize("NFC", value) != value:
        return False
    size = len(value.encode("utf-8"))
    if size < 1 or size > 200 or value.startswith(".") or value.startswith("$") or value.endswith("."):
        return False
    if value[0].isspace() or value[-1].isspace():
        return False
    for char in value:
        if char in '\\/<>:"|?*\0' or unicodedata.category(char) in {"Cc", "Cs"}:
            return False
    return DEVICE.fullmatch(value.split(".", 1)[0]) is None


def name_value(name: str):
    if name.isdigit() and str(int(name)) == name:
        return int(name)
    return name


def rel_parts(node) -> list[str]:
    parts = []
    cur = node
    while cur is not None and cur.parent is not None:
        parts.append(cur.name)
        cur = cur.parent
    parts.reverse()
    return parts


def fsdb_resource_segment(source: str) -> str:
    """Encode invalid WZ path segments without trimming or losing provenance."""
    if valid_segment(source) and not source.startswith("wz~"):
        return source
    encoded = "wz~" + base64.urlsafe_b64encode(source.encode("utf-8")).decode("ascii").rstrip("=")
    return encoded if valid_segment(encoded) else "wz~sha256~" + hashlib.sha256(source.encode("utf-8")).hexdigest()


def unique_name(original: str, identity: str) -> str:
    """A portable, deterministic key disambiguator; original is in the report."""
    suffix = "~" + hashlib.sha256(identity.encode("utf-8")).hexdigest()[:16]
    candidate = original + suffix
    if valid_segment(candidate):
        return candidate
    return "wz~sha256~" + hashlib.sha256((original + "\0" + identity).encode("utf-8")).hexdigest()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def converter_commit() -> str:
    """Commit of the repository that owns this script, or ``unknown``."""
    repo = git_repo(Path(__file__).resolve())
    if repo is None:
        return "unknown"
    try:
        return subprocess.run(
            ["git", "-C", str(repo), "rev-parse", "HEAD"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
    except Exception:
        return "unknown"


class Store:
    """FSDB writer.

    ``resume_dir`` (batch mode) persists the conflict tables (record keys,
    group keys, resource identities, directory-name folds, aliases) so a new
    process continues an ``all`` run without relying on in-memory state.

    ``resource_filter`` (avatar mode) restricts which canvases are written;
    skipped canvases are counted, never silently dropped from the records.

    ``dry_run`` computes resource keys without touching disk or decoders.
    """

    def __init__(self, root: Path, roundtrip: bool, keep_pixels: bool = False,
                 resume_dir: Path | None = None, resource_filter: set[str] | None = None,
                 dry_run: bool = False):
        self.root = root
        self.roundtrip = roundtrip
        self.keep_pixels = keep_pixels
        self.resume_dir = resume_dir
        self.resource_filter = resource_filter
        self.dry_run = dry_run
        self.stats = Counter()
        self.errors = []
        self.collisions = []
        self.resources = {}
        self.pixel_rows = []
        self.unsafe_ints = 0
        self.tables = set()
        self.record_remaps = []
        self.resource_aliases = []
        self._struct_keys = {}
        self._resource_directory_names = {}
        self._resource_path_cache = {}
        self._resource_variant_keys = {}
        self.record_alias_index = {}
        self._record_source_by_key = {}
        self._resume_records = {}
        self._resume_groups = set()
        self._resume_pending = {"records": [], "groups": [], "resources": []}
        self.converted_packages = []
        if resume_dir is not None and not dry_run:
            self._load_resume_state()

    # ---- persisted batch state ------------------------------------------

    def _manifest_path(self) -> Path:
        return self.resume_dir / "manifest"

    def _load_resume_state(self) -> None:
        manifest = self._manifest_path()
        manifest.mkdir(parents=True, exist_ok=True)
        records = manifest / "records.jsonl"
        if records.exists():
            for line in records.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                row = json.loads(line)
                self._resume_records[(row["table"], row["key"], row.get("source"))] = row["storedKey"]
        groups = manifest / "groups.jsonl"
        if groups.exists():
            for line in groups.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                row = json.loads(line)
                self._resume_groups.add((row["table"], row["key"]))
        resources = manifest / "resources.jsonl"
        if resources.exists():
            for line in resources.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                row = json.loads(line)
                self.resources[(row["table"], row["key"].casefold())] = (row["key"], row["ext"], row["digest"])
                variant = (row["table"], row["sourceKey"], row["ext"], row["digest"])
                self._resource_variant_keys[variant] = row["key"]
        state = manifest / "converter-state.json"
        if state.exists():
            payload = json.loads(state.read_text(encoding="utf-8"))
            self.record_remaps = payload.get("recordRemaps", [])
            self.resource_aliases = payload.get("resourceAliases", [])
            for row in payload.get("recordAliasIndex", []):
                self.record_alias_index[(row["table"], row["foldedKey"])] = row["candidates"]
            for token, mapping in payload.get("resourceDirectoryNames", {}).items():
                table, _, parent = token.partition("\0")
                self._resource_directory_names[(table, tuple(parent.split("/") if parent else ()))] = dict(mapping)
            saved = payload.get("stats", {})
            for key, value in saved.items():
                self.stats[key] = self.stats[key] + value if key in self.stats else value

    def flush_resume_state(self) -> None:
        """Persist conflict tables and append this run's writes."""
        if self.resume_dir is None or self.dry_run:
            return
        manifest = self._manifest_path()
        manifest.mkdir(parents=True, exist_ok=True)
        for name, rows in (("records", self._resume_pending["records"]),
                           ("groups", self._resume_pending["groups"]),
                           ("resources", self._resume_pending["resources"])):
            if rows:
                with (manifest / f"{name}.jsonl").open("a", encoding="utf-8", newline="\n") as handle:
                    for row in rows:
                        handle.write(dumps(row) + "\n")
        self._resume_pending = {"records": [], "groups": [], "resources": []}
        alias_index = [
            {"table": table, "foldedKey": folded_key, "candidates": candidates}
            for (table, folded_key), candidates in self.record_alias_index.items()
        ]
        directories = {
            f"{table}\0{'/'.join(parent)}": mapping
            for (table, parent), mapping in self._resource_directory_names.items()
        }
        payload = {
            "recordRemaps": self.record_remaps,
            "resourceAliases": self.resource_aliases,
            "recordAliasIndex": alias_index,
            "resourceDirectoryNames": directories,
            "stats": dict(self.stats),
        }
        tmp = manifest / "converter-state.json.tmp"
        tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        tmp.replace(manifest / "converter-state.json")

    # ---- tables ---------------------------------------------------------

    def note_error(self, kind: str, path: str, error: str) -> None:
        self.stats["errors"] += 1
        if len(self.errors) < 80:
            self.errors.append({"kind": kind, "path": path, "error": error})

    def table(self, kind: str, name: str) -> Path:
        if not valid_segment(name):
            raise ValueError(f"bad table {name!r}")
        path = self.root / f"[{kind}]{name}"
        path.mkdir(parents=True, exist_ok=True)
        self.tables.add((kind, name))
        return path

    def write_struct(self, table: str, key: str, value: dict, source: str | None = None) -> bool:
        if not valid_segment(key):
            self.note_error("key", f"{table}/{key}", "invalid-name")
            return False
        if self.resume_dir is not None:
            resumed = self._resume_records.get((table, key, source))
            if resumed is not None:
                self.stats["recordsResumed"] += 1
                return True
        folder = self.table("struct", table)
        if table not in self._struct_keys:
            previous = {}
            for item in folder.glob("*.json"):
                folded = item.stem.casefold()
                if folded in previous and previous[folded] != item.stem:
                    raise ValueError("existing-casefold-collision")
                previous[folded] = item.stem
            self._struct_keys[table] = previous
        used = self._struct_keys[table]
        actual = key
        if key.casefold() in used or (folder / f"{key}.json").exists():
            basis = source if source is not None else dumps(value)
            actual = unique_name(key, table + "/" + key + "/" + basis)
            attempt = 0
            while actual.casefold() in used or (folder / f"{actual}.json").exists():
                attempt += 1
                actual = unique_name(key, table + "/" + key + "/" + basis + "/" + str(attempt))
            self.record_remaps.append({
                "table": table, "originalKey": key, "storedKey": actual,
                "source": source, "reason": "duplicate-or-casefold-key"
            })
            self.stats["rekeyedRecords"] += 1
        path = folder / f"{actual}.json"
        with path.open("x", encoding="utf-8", newline="\n") as handle:
            handle.write(dumps(value) + "\n")
        used[actual.casefold()] = actual
        self._record_source_by_key[(table, actual)] = source
        if actual != key:
            alias_id = (table, key.casefold())
            candidates = self.record_alias_index.setdefault(alias_id, [])
            if not candidates:
                primary_key = used.get(key.casefold())
                if primary_key is not None:
                    candidates.append({
                        "key": primary_key,
                        "source": self._record_source_by_key.get((table, primary_key)),
                    })
            candidates.append({"key": actual, "source": source})
        if self.resume_dir is not None:
            self._resume_pending["records"].append({"table": table, "key": key, "source": source, "storedKey": actual})
        self.stats["struct"] += 1
        return True

    def write_group(self, table: str, key: str, rows: list[dict]) -> None:
        if not valid_segment(key):
            self.note_error("key", f"{table}/{key}", "invalid-name")
            return
        if (table, key) in self._resume_groups:
            self.stats["groupsResumed"] += 1
            return
        path = self.table("group", table) / f"{key}.jsonl"
        if path.exists():
            self.collisions.append({"table": table, "key": key})
            self.stats["keyCollisions"] += 1
            return
        text = "".join(dumps(row) + "\n" for row in rows)
        with path.open("x", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
        if self.resume_dir is not None:
            self._resume_pending["groups"].append({"table": table, "key": key, "rows": len(rows)})
        self.stats["groupFiles"] += 1
        self.stats["groupRows"] += len(rows)

    def _safe_parts(self, table: str, source: list[str]) -> list[str]:
        token = (table, tuple(source))
        cached = self._resource_path_cache.get(token)
        if cached is not None:
            return list(cached)
        output = []
        for raw in source[:-1]:
            parent = (table, tuple(output))
            entries = self._resource_directory_names.setdefault(parent, {})
            if raw in entries:
                piece = entries[raw]
            else:
                piece = fsdb_resource_segment(raw)
                used = {name.casefold() for name in entries.values()}
                if piece.casefold() in used:
                    base = piece
                    piece = unique_name(base, raw)
                    attempt = 0
                    while piece.casefold() in used:
                        attempt += 1
                        piece = unique_name(base, raw + "/" + str(attempt))
                entries[raw] = piece
            output.append(piece)
        output.append(fsdb_resource_segment(source[-1]))
        if output != source:
            self._resource_path_cache[token] = tuple(output)
            self.resource_aliases.append({
                "table": table, "originalParts": list(source), "storedKey": "/".join(output),
                "reason": "invalid-or-casefold-segment",
            })
            self.stats["resourceAliases"] += 1
        return output

    def _choose_resource(self, table: str, parts: list[str], digest: str, ext: str):
        """Pick the stored key for a payload.

        Returns ``(stored_parts, reused, source_key)`` or ``None`` on an
        invalid path/extension. ``source_key`` is the un-aliased logical key
        the manifest needs to rebuild the variant table across batches.
        """
        if not parts or any(not isinstance(p, str) for p in parts):
            self.note_error("resource", repr(parts), "invalid-path")
            return None
        if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,31}", ext):
            self.note_error("resource", "/".join(parts), "invalid-extension")
            return None
        output = self._safe_parts(table, parts)
        key = "/".join(output)
        variant = (table, key, ext, digest)
        previous_variant = self._resource_variant_keys.get(variant)
        if previous_variant is not None:
            # Same payload already assigned (possibly an alias from a previous
            # batch): deterministically reuse that exact stored key.
            self.stats["resourceReuse"] += 1
            return previous_variant.split("/"), True, key
        prior = self.resources.get((table, key.casefold()))
        if prior is None:
            self._resource_variant_keys[variant] = key
            return output, False, key
        old_key, old_ext, old_digest = prior
        if old_ext == ext and old_digest == digest:
            # Same payload (possibly under an alias decided in an earlier
            # batch): reuse the stored key exactly, never the raw one.
            self.stats["resourceReuse"] += 1
            self._resource_variant_keys[variant] = old_key
            return old_key.split("/"), True, key
        reason = "extension-conflict" if old_key == key and old_ext != ext else "resource-key-conflict"
        self.note_error("resource", "/".join(parts), reason)
        source_leaf = output[-1]
        new_leaf = unique_name(source_leaf, table + "/" + key + "/" + ext + "/" + digest)
        output[-1] = new_leaf
        attempt = 0
        while (table, "/".join(output).casefold()) in self.resources:
            attempt += 1
            output[-1] = unique_name(source_leaf, table + "/" + key + "/" + ext + "/" + digest + "/" + str(attempt))
        self._resource_variant_keys[variant] = "/".join(output)
        self.resource_aliases.append({
            "table": table, "originalParts": list(parts), "storedKey": "/".join(output),
            "reason": reason
        })
        self.stats["resourceAliases"] += 1
        return output, False, key

    def write_png(self, parts: list[str], image, digest: str) -> str | None:
        if self.dry_run:
            return "/".join(self._safe_parts(CANVAS_RESOURCE_TABLE, parts))
        selected = self._choose_resource(CANVAS_RESOURCE_TABLE, parts, digest, "png")
        if selected is None:
            return None
        actual, reused, source_key = selected
        key = "/".join(actual)
        if reused:
            return key
        if self.resource_filter is not None and key not in self.resource_filter:
            self.stats["canvasesOutOfScope"] += 1
            return key
        path = self.table("resource", CANVAS_RESOURCE_TABLE)
        for part in actual[:-1]:
            path = path / part
        path.mkdir(parents=True, exist_ok=True)
        file = path / f"{actual[-1]}.png"
        if file.exists():
            raise ValueError("resource-overwrite-refused")
        image.save(file, format="PNG", compress_level=1)
        if self.roundtrip:
            opened = Image.open(file).convert("RGBA")
            if opened.size != image.size or hashlib.sha256(opened.tobytes()).hexdigest() != digest:
                self.note_error("png", key, "roundtrip")
                self.stats["pngRoundtripFail"] += 1
            else:
                self.stats["pngRoundtripOk"] += 1
        self.resources[(CANVAS_RESOURCE_TABLE, key.casefold())] = (key, "png", digest)
        if self.resume_dir is not None:
            self._resume_pending["resources"].append(
                {"table": CANVAS_RESOURCE_TABLE, "key": key, "sourceKey": source_key,
                 "ext": "png", "digest": digest})
        if self.keep_pixels:
            self.pixel_rows.append({"key": key, "w": image.width, "h": image.height, "sha256": digest})
        self.stats["resources"] += 1
        self.stats["canvases"] += 1
        return key

    def write_sound(self, parts: list[str], payload: bytes, ext: str) -> str | None:
        digest = hashlib.sha256(payload).hexdigest()
        if self.dry_run:
            return "/".join(self._safe_parts(SOUND_RESOURCE_TABLE, parts))
        selected = self._choose_resource(SOUND_RESOURCE_TABLE, parts, digest, ext)
        if selected is None:
            return None
        actual, reused, source_key = selected
        key = "/".join(actual)
        if reused:
            return key
        path = self.table("resource", SOUND_RESOURCE_TABLE)
        for part in actual[:-1]:
            path = path / part
        path.mkdir(parents=True, exist_ok=True)
        file = path / f"{actual[-1]}.{ext}"
        with file.open("xb") as handle:
            handle.write(payload)
        if hashlib.sha256(file.read_bytes()).hexdigest() != digest:
            self.note_error("sound", key, "reread")
        self.resources[(SOUND_RESOURCE_TABLE, key.casefold())] = (key, ext, digest)
        if self.resume_dir is not None:
            self._resume_pending["resources"].append(
                {"table": SOUND_RESOURCE_TABLE, "key": key, "sourceKey": source_key,
                 "ext": ext, "digest": digest})
        self.stats["resources"] += 1
        self.stats["sounds"] += 1
        self.stats["soundBytes"] += len(payload)
        return key

    def table_output_summary(self) -> dict:
        """Cheap per-table output summary of the current root.

        struct/group entry counts come from a directory listing. Resource
        trees can hold millions of files, so resource tables report the
        converter's cumulative ``resources`` counter instead of a walk.
        """
        summary = {}
        if not self.root.exists():
            return summary
        for item in sorted(self.root.iterdir()):
            name = item.name
            matched = re.fullmatch(r"\[(struct|extend|group|resource)\](.*)", name)
            if not matched or not item.is_dir():
                continue
            kind, table = matched.group(1), matched.group(2)
            if kind == "resource":
                summary[f"{kind}.{table}"] = self.stats["resources"]
            else:
                suffix = ".jsonl" if kind == "group" else ".json"
                count = sum(1 for entry in item.iterdir() if entry.name.endswith(suffix))
                summary[f"{kind}.{table}"] = count
        return summary


class Codec:
    def __init__(self, store: Store, prefix: list[str], aliases: dict | None = None):
        self.store = store
        self.prefix = prefix
        self.aliases = aliases or {}

    def resolve_uol(self, node):
        return resolve_uol(node)

    def scalar(self, node):
        if isinstance(node, WzNullProperty):
            return None
        if isinstance(node, WzVectorProperty):
            return [node.x, node.y]
        if isinstance(node, WzConvexProperty):
            return [[point.x, point.y] for point in node.points]
        value = node.value
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError("nonfinite")
        if isinstance(value, int) and abs(value) > 2**53 - 1:
            self.store.unsafe_ints += 1
        return value

    def sound_bytes(self, node) -> bytes:
        image = node._wz_image
        wz = image.wz_file
        with wz.reader_lock:
            reader = wz.reader
            keep = reader.position
            reader.seek(node._data_offset)
            data = reader.read(node._data_length)
            reader.seek(keep)
        return data

    def sound_ext(self, payload: bytes) -> str:
        if payload.startswith(b"RIFF") and payload[8:12] == b"WAVE":
            return "wav"
        if payload.startswith(b"ID3") or (len(payload) > 1 and payload[0] == 0xFF and payload[1] & 0xE0 == 0xE0):
            return "mp3"
        if payload.startswith(b"OggS"):
            return "ogg"
        return "bin"

    def serialize(self, node):
        if not self.store.dry_run:
            self.store.stats["nodes"] += 1
        if isinstance(node, WzUolProperty):
            self.store.stats["uol"] += 1
            target, status = self.resolve_uol(node)
            self.store.stats[f"uol_{status}"] += 1
            if target is None:
                return uol_failure_record(status, str(node.value))
            return self.serialize(target)
        if isinstance(node, WzCanvasProperty):
            record = {child.name: self.serialize(child) for child in node.children()}
            record["width"] = node.width
            record["height"] = node.height
            record["format"] = node.format + node.format2
            if node.has_pixels():
                parts = self.aliases.get(id(node)) or (self.prefix + rel_parts(node))
                if self.store.dry_run:
                    key = self.store.write_png(parts, None, "")
                    if key is not None:
                        record["resource"] = key
                    return record
                try:
                    image = decode_canvas(node, region=REGION)
                    digest = hashlib.sha256(image.tobytes()).hexdigest()
                    key = self.store.write_png(parts, image, digest)
                    if key is not None:
                        record["resource"] = key
                except Exception as exc:
                    self.store.note_error("canvas", "/".join(parts), type(exc).__name__)
                    record["decodeError"] = type(exc).__name__
            return record
        if isinstance(node, WzSoundProperty):
            parts = self.prefix + rel_parts(node)
            try:
                payload = self.sound_bytes(node)
            except Exception as exc:
                self.store.note_error("sound", "/".join(parts), type(exc).__name__)
                return {"decodeError": type(exc).__name__, "dataLength": node._data_length}
            ext = self.sound_ext(payload)
            key = self.store.write_sound(parts, payload, ext)
            magic = payload[:4].hex()
            return {
                "resource": key,
                "dataLength": len(payload),
                "durationMs": node.length_ms,
                "headerLength": len(node.header),
                "magic": magic,
                "extension": ext,
            }
        if isinstance(node, WzSubProperty):
            return {child.name: self.serialize(child) for child in node.children()}
        return self.scalar(node)


def children_object(codec: Codec, node) -> dict:
    return {child.name: codec.serialize(child) for child in node.children()}


def placement_row(codec: Codec, node, extra: dict) -> dict:
    row = dict(extra)
    for child in node.children():
        row[child.name] = codec.serialize(child)
    return row


def convert_map(store: Store, img, map_id: str) -> dict:
    root = img.parse()
    info = root.child("info")
    record = {"info": children_object(Codec(store, ["Map", map_id]), info) if info is not None else {}}
    minimap = root.child("miniMap")
    if minimap is not None:
        canvases = [child for child in minimap.children() if isinstance(child, WzCanvasProperty)]
        aliases = {}
        if len(canvases) == 1:
            aliases[id(canvases[0])] = ["MiniMap", map_id]
        codec = Codec(store, ["MiniMap", map_id], aliases)
        mini = {}
        for child in minimap.children():
            encoded = codec.serialize(child)
            if isinstance(child, WzCanvasProperty) and isinstance(encoded, dict) and "resource" in encoded:
                mini[child.name] = encoded["resource"]
            else:
                mini[child.name] = encoded
        record["miniMap"] = mini
    codec = Codec(store, ["Map", map_id])
    layers = []
    refs = {"tile": set(), "back": set(), "obj": set()}
    tile_rows = []
    obj_rows = []
    saw_tile = False
    saw_obj = False
    for layer_name in [str(i) for i in range(8)]:
        layer = root.child(layer_name)
        if layer is None:
            continue
        info_node = layer.child("info")
        layer_record = {"layer": layer_name}
        if info_node is not None:
            for child in info_node.children():
                value = codec.serialize(child)
                if child.name == "tS":
                    layer_record["tileSet"] = value
                    if isinstance(value, str):
                        refs["tile"].add(value)
                else:
                    layer_record[child.name] = value
        layers.append(layer_record)
        tiles = layer.child("tile")
        objs = layer.child("obj")
        if tiles is not None:
            saw_tile = True
            tile_rows.extend(placement_row(codec, item, {"layer": layer_name}) for item in tiles.children())
        if objs is not None:
            saw_obj = True
            obj_rows.extend(placement_row(codec, item, {"layer": layer_name}) for item in objs.children())
    for row in obj_rows:
        if isinstance(row.get("oS"), str):
            refs["obj"].add(row["oS"])
    if saw_tile:
        store.write_group("Tile", map_id, tile_rows)
    if saw_obj:
        store.write_group("Obj", map_id, obj_rows)
    if layers:
        record["layers"] = layers
    back = root.child("back")
    if back is not None:
        rows = [placement_row(codec, item, {}) for item in back.children()]
        for row in rows:
            if isinstance(row.get("bS"), str):
                refs["back"].add(row["bS"])
        store.write_group("Back", map_id, rows)
    simple = {
        "portal": "Portal",
        "life": "Life",
        "reactor": "Reactor",
        "area": "Area",
        "swimArea": "SwimArea",
        "weather": "Weather",
    }
    for source, table in simple.items():
        node = root.child(source)
        if node is None:
            continue
        store.write_group(table, map_id, [placement_row(codec, item, {}) for item in node.children()])
    ladder = root.child("ladderRope")
    if ladder is not None:
        rows = []
        for item in ladder.children():
            if isinstance(item, WzSubProperty):
                rows.append(placement_row(codec, item, {"id": name_value(item.name)}))
            elif isinstance(item, WzVectorProperty):
                rows.append({"id": name_value(item.name), "x": item.x, "y": item.y})
            else:
                rows.append({"id": name_value(item.name), "value": codec.serialize(item)})
        store.write_group("Rope", map_id, rows)
    foothold = root.child("foothold")
    if foothold is not None:
        rows = []
        for layer in foothold.children():
            for platform in layer.children():
                for item in platform.children():
                    rows.append(placement_row(codec, item, {
                        "layer": name_value(layer.name),
                        "platform": name_value(platform.name),
                        "id": name_value(item.name),
                    }))
        store.write_group("Foothold", map_id, rows)
    seat = root.child("seat")
    if seat is not None:
        rows = []
        for item in seat.children():
            if isinstance(item, WzVectorProperty):
                rows.append({"index": name_value(item.name), "x": item.x, "y": item.y})
            else:
                rows.append(placement_row(codec, item, {"index": name_value(item.name)}))
        store.write_group("Seat", map_id, rows)
    for source, table in (("ToolTip", "ToolTip"), ("user", "MapUser")):
        node = root.child(source)
        if node is None:
            continue
        rows = []
        for item in node.children():
            if isinstance(item, WzSubProperty):
                rows.append(placement_row(codec, item, {"name": item.name}))
            elif isinstance(item, WzVectorProperty):
                rows.append({"name": item.name, "x": item.x, "y": item.y})
            else:
                rows.append({"name": item.name, "value": codec.serialize(item)})
        store.write_group(table, map_id, rows)
    for child in root.children():
        if child.name in MAP_GROUPS or child.name in LAYER_NAMES or child.name in {"info", "miniMap"}:
            continue
        record[child.name] = codec.serialize(child)
    store.write_struct("Map", map_id, record, source=f"Map.wz/Map/{map_id}.img")
    return refs


def convert_tree(store: Store, img, table: str, key: str, prefix: list[str], source: str | None = None) -> None:
    root = img.parse()
    store.write_struct(table, key, children_object(Codec(store, prefix), root), source=source)


def convert_string(store: Store, img, stem: str) -> None:
    root = img.parse()
    table = string_table(stem)
    codec = Codec(store, ["String", stem])
    leaves = []

    def walk(node, trail):
        subs = [child for child in node.children() if isinstance(child, WzSubProperty)]
        rest = [child for child in node.children() if not isinstance(child, WzSubProperty)]
        if rest and trail:
            leaves.append((trail, {child.name: codec.serialize(child) for child in rest}))
        if subs:
            for child in subs:
                walk(child, trail + (child.name,))
        elif trail and not rest:
            leaves.append((trail, {}))

    walk(root, ())
    if not leaves:
        store.write_struct(table, stem, children_object(codec, root))
        return
    seen = set()
    for trail, value in leaves:
        key, reason = string_record_key(trail, seen)
        if reason == "encoded-path":
            store.stats["encodedStringKeys"] += 1
        elif reason == "duplicate-trail-disambiguated":
            store.stats["rekeyedStringTrails"] += 1
        elif reason == "invalid-name":
            store.note_error("string", f"{table}/{'.'.join(trail)}", "invalid-name")
            continue
        elif reason == "duplicate-trail":
            store.note_error("string", f"{table}/{'.'.join(trail)}", "duplicate-trail")
            continue
        seen.add(key)
        store.write_struct(table, key, value, source="String.wz/" + stem + ".img/" + "/".join(trail))


def emit_metadata(store: Store, tables: set[tuple[str, str]] | None = None) -> None:
    tree_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "additionalProperties": {"$ref": "#/$defs/value"},
        "$defs": {
            "value": {
                "anyOf": [
                    {"type": "null"},
                    {"type": "boolean"},
                    {"type": "number"},
                    {"type": "string"},
                    {"type": "array", "items": {"$ref": "#/$defs/value"}},
                    {"type": "object", "additionalProperties": {"$ref": "#/$defs/value"}},
                ]
            }
        },
    }
    group_schemas = {
        "Tile": {"layer": "string", "x": "integer", "y": "integer", "u": "string", "no": "integer", "zM": "integer"},
        "Back": {"bS": "string", "no": "integer", "ani": "integer", "x": "integer", "y": "integer", "rx": "integer", "ry": "integer", "type": "integer", "cx": "integer", "cy": "integer", "f": "integer", "a": "integer", "front": "integer"},
        "Obj": {"layer": "string", "oS": "string", "l0": "string", "l1": "string", "l2": "string", "x": "integer", "y": "integer", "z": "integer", "f": "integer", "zM": "integer"},
        "Portal": {"pn": "string", "pt": "integer", "x": "integer", "y": "integer", "tm": "integer", "tn": "string", "script": "string"},
        "Life": {"type": "string", "id": "string", "x": "integer", "y": "integer", "cy": "integer", "fh": "integer", "f": "integer", "rx0": "integer", "rx1": "integer", "hide": "integer"},
        "Foothold": {"id": "integer", "layer": "integer", "platform": "integer", "x1": "integer", "y1": "integer", "x2": "integer", "y2": "integer", "prev": "integer", "next": "integer", "force": "integer", "forbidFallDown": "integer"},
        "Rope": {"id": "integer", "x": "integer", "y1": "integer", "y2": "integer", "l": "integer", "uf": "integer", "page": "integer"},
        "Reactor": {"id": "string", "x": "integer", "y": "integer", "reactorTime": "integer", "f": "integer", "name": "string"},
        "Seat": {"index": "integer", "x": "integer", "y": "integer"},
    }
    descriptions = {
        "Back": "地图背景放置。非空 bS 指向 struct.Back；空字符串为源数据有效值，不作无条件外键。",
        "Tile": "地图瓦片放置。z 在图集画布上，这里是 zM。",
        "Obj": "地图物件放置。oS 指向 struct.Obj。",
        "Portal": "地图出口。tm 为 999999999 时没有目标地图。",
        "Life": "地图上的 NPC 和怪物。",
        "Reactor": "地图反应堆放置。",
        "Seat": "可坐下的坐标。",
        "Foothold": "立足线。",
        "Rope": "绳和梯。",
        "Area": "矩形区域。",
        "SwimArea": "游泳区域。",
        "Weather": "天气条目。",
        "ToolTip": "地图提示。",
        "MapUser": "地图 user 节点。",
    }
    extends = {
        "Obj": [("oS", "Obj", "物件定义")],
    }
    known = tables if tables is not None else store.tables
    if not known and store.root.exists():
        known = set()
        for item in store.root.iterdir():
            matched = re.fullmatch(r"\[(struct|extend|group|resource)\](.+)", item.name)
            if matched and item.is_dir():
                known.add((matched.group(1), matched.group(2)))
    for kind, name in sorted(known):
        folder = store.root / f"[{kind}]{name}"
        if kind == "struct":
            schema = tree_schema
            if name == "Map":
                schema = {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "type": "object",
                    "properties": {
                        "info": {"type": "object"},
                        "miniMap": {"type": "object"},
                        "layers": {"type": "array", "items": {"type": "object"}},
                    },
                    "required": ["info"],
                    "additionalProperties": True,
                }
            elif name == "Physics":
                schema = {
                    "$schema": "https://json-schema.org/draft/2020-12/schema",
                    "type": "object",
                    "properties": {field: {"type": "number"} for field in (
                        "walkForce", "walkSpeed", "walkDrag", "slipForce", "slipSpeed",
                        "floatDrag1", "floatDrag2", "floatCoefficient", "swimForce", "swimSpeed",
                        "flyForce", "flySpeed", "gravityAcc", "fallSpeed", "jumpSpeed",
                        "maxFriction", "minFriction", "swimSpeedDec", "flyJumpDec",
                    )},
                    "additionalProperties": True,
                }
            (folder / ".info.meta").write_text(dumps(schema) + "\n", encoding="utf-8", newline="\n")
            (folder / ".desc.meta").write_text(f"{name} 记录。键是 WZ 节点名，缺字段不补默认值。\n", encoding="utf-8", newline="\n")
        elif kind == "group":
            props = {field: {"type": kind_name} for field, kind_name in group_schemas.get(name, {}).items()}
            schema = {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "type": "object",
                "properties": props,
                "additionalProperties": True,
            }
            (folder / ".info.meta").write_text(dumps(schema) + "\n", encoding="utf-8", newline="\n")
            (folder / ".desc.meta").write_text(descriptions.get(name, f"{name} 分组，一行一个 WZ 子节点。") + "\n", encoding="utf-8", newline="\n")
            if name in extends:
                lines = [dumps({"field": field, "struct": target, "desc": desc}) for field, target, desc in extends[name]]
                (folder / ".extend.meta").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
        elif kind == "resource":
            description = ("画布为 PNG；扩展名不属于 ResourceKey。\n" if name == CANVAS_RESOURCE_TABLE else "音频按实际载荷使用 wav、mp3、ogg 或 bin；扩展名不属于 ResourceKey。\n")
            (folder / ".desc.meta").write_text(description, encoding="utf-8", newline="\n")


def write_record_alias_table(store: Store) -> None:
    """Expose every source competing for the same original key."""
    for (table_name, folded_key), candidates in sorted(store.record_alias_index.items()):
        if len(candidates) < 2:
            raise ValueError("incomplete-record-alias-index")
        original_key = candidates[0]["key"]
        store.write_struct("WzRecordAlias", table_name + "." + original_key, {
            "table": table_name,
            "originalKey": original_key,
            "candidates": candidates,
        })


def open_package(client: Path, name: str):
    wz = WzFile.open(str(client / name), region=REGION)
    if wz.version != 79:
        raise SystemExit(f"{name} version {wz.version}")
    return wz


def stem_of(path: str) -> str:
    return path.rsplit("/", 1)[-1][:-4]


def selected(path: str, scope: str, assets: dict[str, set] | None) -> bool:
    if scope == "all":
        return True
    stem = stem_of(path)
    if path.endswith("Physics.img") or path.endswith("00002000.img") or path.endswith("Bgm00.img"):
        return True
    if stem in PHASE1_MAPS and path.startswith("Map/"):
        return True
    if assets is None:
        return False
    if path.startswith("Tile/") and stem in assets["tile"]:
        return True
    if path.startswith("Back/") and stem in assets["back"]:
        return True
    if path.startswith("Obj/") and stem in assets["obj"]:
        return True
    return False


def convert_map_package(store: Store, wz, scope: str) -> None:
    images = list(wz.root.walk_images())
    assets = {"tile": set(), "back": set(), "obj": set()}
    if scope == "phase1":
        for path, img in images:
            if path.startswith("Map/") and stem_of(path) in PHASE1_MAPS:
                refs = convert_map(store, img, stem_of(path))
                for kind in assets:
                    assets[kind] |= refs[kind]
                print(f"map {stem_of(path)} tileSets={len(refs['tile'])} backs={len(refs['back'])} objs={len(refs['obj'])}", flush=True)
    for path, img in images:
        if scope == "phase1" and not selected(path, scope, assets):
            continue
        stem = stem_of(path)
        try:
            if path.startswith("Map/") and len(stem) == 9 and stem.isdigit():
                if scope == "all":
                    convert_map(store, img, stem)
            elif path == "Physics.img":
                convert_tree(store, img, "Physics", "default", ["Physics"])
            elif path.startswith("Tile/"):
                convert_tree(store, img, "Tileset", stem, ["Tile", stem])
            elif path.startswith("Back/"):
                convert_tree(store, img, "Back", stem, ["Back", stem])
            elif path.startswith("Obj/"):
                convert_tree(store, img, "Obj", stem, ["Obj", stem])
            elif path.startswith("WorldMap/"):
                convert_tree(store, img, "WorldMap", stem, ["WorldMap", stem])
            elif path == "MapHelper.img":
                convert_tree(store, img, "MapHelper", "MapHelper", ["MapHelper"])
            elif path == "Effect.img":
                root = img.parse()
                for child in root.children():
                    if isinstance(child, WzSubProperty):
                        store.write_struct("MapEffect", child.name, children_object(Codec(store, ["MapEffect", child.name]), child), source=f"Map.wz/Effect.img/{child.name}")
            elif path == "Map/AreaCode.img":
                convert_tree(store, img, "AreaCode", "AreaCode", ["AreaCode"])
            elif scope == "all":
                store.note_error("unmapped", path, "map-package")
        except Exception as exc:
            store.note_error("image", path, type(exc).__name__)
            print(f"ERR {path} {type(exc).__name__}", flush=True)
        else:
            store.stats["images"] += 1
    if scope == "all":
        print(f"Map.wz images-written {store.stats['images']}", flush=True)


def convert_character(store: Store, wz, scope: str) -> None:
    count = 0
    for path, img in wz.root.walk_images():
        if scope == "phase1" and not path.endswith("00002000.img"):
            continue
        stem = stem_of(path)
        table = "Afterimage" if path.startswith("Afterimage/") else "Look"
        try:
            convert_tree(store, img, table, stem, [table, stem], source=f"Character.wz/{path}")
            count += 1
        except Exception as exc:
            store.note_error("image", path, type(exc).__name__)
        if count % 200 == 0:
            print(f"character {count} canvases={store.stats['canvases']}", flush=True)
    store.stats["images"] += count
    print(f"Character images {count}", flush=True)


def convert_sound(store: Store, wz, scope: str) -> None:
    count = 0
    for path, img in wz.root.walk_images():
        if scope == "phase1" and not path.endswith("Bgm00.img"):
            continue
        try:
            convert_tree(store, img, "Sound", stem_of(path), ["Sound", stem_of(path)])
            count += 1
        except Exception as exc:
            store.note_error("image", path, type(exc).__name__)
    store.stats["images"] += count
    print(f"Sound images {count} sounds={store.stats['sounds']}", flush=True)


def numeric_record(store: Store, wz, table: str, folder: str | None) -> None:
    count = 0
    for path, img in wz.root.walk_images():
        stem = stem_of(path)
        if folder is not None:
            if not path.startswith(folder + "/"):
                continue
            dest = "QuestCountGroup" if folder == "QuestCountGroup" else table
        else:
            if "/" in path and table == "Mob":
                continue
            dest = table
        try:
            convert_tree(store, img, dest, stem, [dest, stem])
            count += 1
        except Exception as exc:
            store.note_error("image", path, type(exc).__name__)
        if count % 100 == 0:
            print(f"{table} {count} canvases={store.stats['canvases']}", flush=True)
    store.stats["images"] += count
    print(f"{table} images {count}", flush=True)


def convert_flat_package(store: Store, wz, table: str) -> None:
    numeric_record(store, wz, table, None)


def convert_skill(store: Store, wz) -> None:
    """Skill ids live under ``skill/``, except books whose ids are the img root.

    Root children are ``info`` and ``skill``, so a 7-digit test at the root
    misses every book. Empty ``skill`` directories stay inside SkillBook.
    """
    images = 0
    records = 0
    for path, img in wz.root.walk_images():
        root = img.parse()
        stem = stem_of(path)
        skill_dir = root.child("skill")
        if skill_dir is not None:
            # Job books. Ids are 7+ digits. Short indexes belong to the book.
            skills = [child for child in skill_dir.children() if isinstance(child, WzSubProperty) and child.name.isdigit() and len(child.name) >= 7]
        else:
            # ItemSkill uses 5-digit ids. MobSkill, BFSkill and MCSkill use short
            # indexes that repeat across books, so they stay in SkillBook.
            skills = [child for child in root.children() if isinstance(child, WzSubProperty) and child.name.isdigit() and len(child.name) >= 4]
        images += 1
        if not skills:
            convert_tree(store, img, "SkillBook", stem, ["Skill", stem])
            continue
        others = [child for child in root.children() if child is not skill_dir and child not in skills]
        if others:
            codec = Codec(store, ["Skill", stem])
            store.write_struct("SkillBook", stem, {child.name: codec.serialize(child) for child in others})
        for skill in skills:
            if not skill.name.isdigit() or not valid_segment(skill.name):
                store.note_error("skill", f"{stem}/{skill.name}", "invalid-name")
                continue
            # rel_parts includes the skill directory and the id.
            store.write_struct("Skill", skill.name, children_object(Codec(store, ["Skill"]), skill), source=f"Skill.wz/{path}/{skill.name}")
            records += 1
        if images % 200 == 0:
            print(f"skill images {images} records {records}", flush=True)
    store.stats["images"] += images
    print(f"Skill images {images} records {records}", flush=True)


def convert_item(store: Store, wz) -> None:
    count = 0
    for path, img in wz.root.walk_images():
        root = img.parse()
        found = []

        def walk(node):
            for child in node.children():
                if isinstance(child, WzSubProperty) and child.name.isdigit() and len(child.name) >= 7:
                    nested = any(isinstance(grand, WzSubProperty) and grand.name.isdigit() and len(grand.name) >= 7 for grand in child.children())
                    if nested:
                        walk(child)
                    else:
                        found.append(child)
                elif isinstance(child, WzSubProperty):
                    walk(child)

        walk(root)
        if not found:
            convert_tree(store, img, "ItemImg", stem_of(path), ["Item", stem_of(path)])
            count += 1
            continue
        for item in found:
            store.write_struct("Item", item.name, children_object(Codec(store, ["Item"]), item), source="Item.wz/" + path + "/" + "/".join(rel_parts(item)))
            count += 1
        store.stats["images"] += 1
        if count % 500 == 0:
            print(f"Item {count}", flush=True)
    print(f"Item records {count}", flush=True)


def convert_base(store: Store, wz, only_zmap: bool = False) -> None:
    for path, img in wz.root.walk_images():
        stem = stem_of(path)
        if stem == "zmap":
            convert_tree(store, img, "ZMap", "order", ["ZMap"])
        elif only_zmap:
            continue
        elif stem == "zmap_cn":
            convert_tree(store, img, "ZMapCn", "order", ["ZMapCn"])
        elif stem == "smap":
            convert_tree(store, img, "SMap", "smap", ["SMap"])
        elif stem == "StandardPDD":
            root = img.parse()
            for child in root.children():
                if isinstance(child, WzSubProperty):
                    store.write_struct("StandardPDD", child.name, children_object(Codec(store, ["StandardPDD", child.name]), child))
                else:
                    store.write_struct("StandardPDD", child.name, {"value": Codec(store, []).serialize(child)})
        else:
            store.note_error("unmapped", path, "base")
        store.stats["images"] += 1
    subdirs = list(wz.root.subdirs)
    print(f"Base images {store.stats['images']} subdirs {len(subdirs)}", flush=True)


def convert_etc(store: Store, wz) -> None:
    for path, img in wz.root.walk_images():
        stem = stem_of(path)
        convert_tree(store, img, "Etc" + stem, stem, ["Etc", stem])
        store.stats["images"] += 1
    print(f"Etc images {store.stats['images']}", flush=True)


def quest_table(stem: str) -> str:
    """Current destination. DESIGN asks for QuestAct, QuestCheck, and the other four tables."""
    return "Quest" + stem


def quest_key(stem: str) -> str:
    """Current key is the img stem. DESIGN asks for one entity id per record."""
    return stem


def string_table(stem: str) -> str:
    return "Text" + stem


def string_record_key(trail: tuple[str, ...], seen: set[str]) -> tuple[str | None, str]:
    """Use a complete legal String.wz leaf path, never a lossy last number."""
    raw = ".".join(trail)
    key = raw if valid_segment(raw) else fsdb_resource_segment(raw)
    reason = "ok" if key == raw else "encoded-path"
    if key in seen:
        key = unique_name(key, "/".join(trail))
        reason = "duplicate-trail-disambiguated"
        count = 0
        while key in seen:
            count += 1
            key = unique_name(raw if valid_segment(raw) else fsdb_resource_segment(raw),
                              "/".join(trail) + "/" + str(count))
    return key, reason

def convert_quest(store: Store, wz) -> None:
    """Save Quest IMG children as independently addressable records."""
    for path, img in wz.root.walk_images():
        stem = stem_of(path)
        root = img.parse()
        codec = Codec(store, ["Quest", stem])
        children = list(root.children())
        if not children:
            store.write_struct(quest_table(stem), quest_key(stem), {})
        for child in children:
            value = (children_object(codec, child) if isinstance(child, WzSubProperty)
                     else {"value": codec.serialize(child)})
            store.write_struct(quest_table(stem), child.name, value,
                               source=f"Quest.wz/{path}/{child.name}")
        store.stats["images"] += 1
    print("Quest images", store.stats["images"], flush=True)


# ---- avatar scope ---------------------------------------------------------

def avatar_is_canvas(value) -> bool:
    return (isinstance(value, dict) and isinstance(value.get("resource"), str)
            and isinstance(value.get("width"), int) and isinstance(value.get("height"), int))


def avatar_is_frame_reference(value) -> bool:
    return (isinstance(value, dict) and isinstance(value.get("action"), str)
            and isinstance(value.get("frame"), int) and "resource" not in value)


def avatar_numeric_keys(node: dict) -> list[str]:
    return sorted((key for key in node if key.isdigit()), key=int)


def avatar_canvases_at(record: dict, action: str, frame_index: int, depth: int = 0) -> list[dict]:
    """Same traversal the production AvatarPlan adapter performs."""
    node = record.get(action) if isinstance(record, dict) else None
    if not isinstance(node, dict):
        return []
    frame = node
    frames = avatar_numeric_keys(node)
    if frames:
        frame = node[frames[min(frame_index, len(frames) - 1)]]
    if avatar_is_frame_reference(frame):
        if depth >= 8:
            raise ValueError(f"reference chain too deep at {action}")
        return avatar_canvases_at(record, frame["action"], frame["frame"], depth + 1)
    entries = []
    if not isinstance(frame, dict):
        return entries
    for value in frame.values():
        if avatar_is_canvas(value):
            entries.append(value)
        elif isinstance(value, dict) and avatar_is_canvas(value.get("0")):
            # hairShade-style skin block: the plan uses the skin-0 canvas.
            entries.append(value["0"])
    return entries


def avatar_wanted_resources(looks: dict, actions=AVATAR_ACTIONS, expression: str = AVATAR_EXPRESSION) -> set[str]:
    """Resource keys the bounded AvatarPlan will reference for ``actions``.

    Mirrors systems/adventure-island/cms079-avatar-plan.mjs: body frames may
    be reference frames (brandish1 -> swingOF/stabOF); head/hair/weapon follow
    the same canvas action+frame; face plays the expression at frame 0 unless
    the body frame hides it (face === 0).
    """
    wanted: set[str] = set()
    for action in actions:
        body_node = looks["body"].get(action)
        if not isinstance(body_node, dict):
            raise ValueError(f"body action missing: {action}")
        frame_keys = avatar_numeric_keys(body_node)
        if not frame_keys:
            raise ValueError(f"body action has no numbered frames: {action}")
        for position, key in enumerate(frame_keys):
            body_frame = body_node[key]
            reference = avatar_is_frame_reference(body_frame)
            canvas_action = body_frame["action"] if reference else action
            canvas_index = body_frame["frame"] if reference else position
            for part in ("body", "head", "hair", "weapon"):
                for canvas in avatar_canvases_at(looks[part], canvas_action, canvas_index):
                    if isinstance(canvas.get("resource"), str):
                        wanted.add(canvas["resource"])
            if not (isinstance(body_frame, dict) and body_frame.get("face") == 0):
                for canvas in avatar_canvases_at(looks["face"], expression, 0):
                    if isinstance(canvas.get("resource"), str):
                        wanted.add(canvas["resource"])
    return wanted


def convert_avatar(store: Store, client: Path) -> None:
    """Minimal real paper-doll FSDB: five Looks, ZMap, referenced canvases.

    Pass 1 serializes the five Character imgs and ``Base.wz/zmap.img`` with a
    dry store (keys only, no decode, no writes) and computes the exact set of
    Canvas resource keys the bounded AvatarPlan references. Pass 2 re-runs the
    same deterministic serialization against the real store, which writes only
    the wanted PNGs; every other canvas of the five records is counted as
    ``canvasesOutOfScope`` instead of being written or dropped from the record.
    """
    dry = Store(store.root, roundtrip=False, dry_run=True)
    wanted = None
    if not store.dry_run:
        dry_looks: dict[str, dict] = {}
        wz = open_package(client, "Character.wz")
        try:
            images = dict(wz.root.walk_images())
            for look_id in AVATAR_LOOK_IDS:
                matches = [path for path in images
                           if path == f"{look_id}.img" or path.endswith(f"/{look_id}.img")]
                if len(matches) != 1:
                    raise SystemExit(f"avatar look {look_id} matched {len(matches)} images in Character.wz")
                dry_looks[look_id] = children_object(Codec(dry, ["Look", look_id]), images[matches[0]].parse())
        finally:
            wz.close()
        wanted = avatar_wanted_resources({
            "body": dry_looks["00002000"],
            "head": dry_looks["00012000"],
            "face": dry_looks["00020000"],
            "hair": dry_looks["00030000"],
            "weapon": dry_looks["01302000"],
        })
        store.resource_filter = wanted
        print(f"avatar wanted canvases {len(wanted)}", flush=True)

    wz = open_package(client, "Character.wz")
    try:
        images = dict(wz.root.walk_images())
        for look_id in AVATAR_LOOK_IDS:
            matches = [path for path in images
                       if path == f"{look_id}.img" or path.endswith(f"/{look_id}.img")]
            if len(matches) != 1:
                raise SystemExit(f"avatar look {look_id} matched {len(matches)} images in Character.wz")
            convert_tree(store, images[matches[0]], "Look", look_id, ["Look", look_id],
                         source=f"Character.wz/{matches[0]}")
            store.stats["images"] += 1
    finally:
        wz.close()
    base = open_package(client, "Base.wz")
    try:
        zmap_img = None
        for path, img in base.root.walk_images():
            if stem_of(path) == "zmap":
                zmap_img = img
                break
        if zmap_img is None:
            raise SystemExit("Base.wz/zmap.img not found")
        convert_tree(store, zmap_img, "ZMap", "order", ["ZMap"])
        store.stats["images"] += 1
    finally:
        base.close()
    if wanted is not None:
        store.stats["avatarWantedCanvases"] = len(wanted)
    print(f"avatar written canvases {store.stats['canvases']} filtered {store.stats['canvasesOutOfScope']}", flush=True)


def git_repo(start: Path) -> Path | None:
    current = start.resolve()
    for parent in (current, *current.parents):
        if (parent / ".git").exists():
            return parent
    return None


def assert_untracked_output(path: Path) -> None:
    """Refuse an FSDB or report write that would land in a tracked directory."""
    repo = git_repo(Path(__file__).resolve())
    if repo is None:
        return
    target = path.resolve()
    try:
        target.relative_to(repo)
    except ValueError:
        return
    import subprocess as _sp
    checked = _sp.run(
        ["git", "-C", str(repo), "check-ignore", "-q", "--", str(target)],
        capture_output=True,
    )
    if checked.returncode != 0:
        raise SystemExit("refusing to write inside a tracked directory of the git repository")


def all_plan() -> list[tuple[str, object]]:
    return [
        ("Base.wz", lambda store, wz, scope: convert_base(store, wz)),
        ("Character.wz", convert_character),
        ("Effect.wz", lambda store, wz, scope: convert_flat_package(store, wz, "Effect")),
        ("Etc.wz", lambda store, wz, scope: convert_etc(store, wz)),
        ("Item.wz", lambda store, wz, scope: convert_item(store, wz)),
        ("Map.wz", convert_map_package),
        ("Mob.wz", lambda store, wz, scope: (numeric_record(store, wz, "Mob", "QuestCountGroup"), numeric_record(store, wz, "Mob", None))),
        ("Morph.wz", lambda store, wz, scope: convert_flat_package(store, wz, "Morph")),
        ("Npc.wz", lambda store, wz, scope: convert_flat_package(store, wz, "Npc")),
        ("Quest.wz", lambda store, wz, scope: convert_quest(store, wz)),
        ("Reactor.wz", lambda store, wz, scope: convert_flat_package(store, wz, "Reactor")),
        ("Skill.wz", lambda store, wz, scope: convert_skill(store, wz)),
        ("Sound.wz", convert_sound),
        ("String.wz", lambda store, wz, scope: [convert_string(store, img, stem_of(path)) or store.stats.__setitem__("images", store.stats["images"] + 1) for path, img in wz.root.walk_images()]),
        ("TamingMob.wz", lambda store, wz, scope: convert_flat_package(store, wz, "Taming")),
        ("UI.wz", lambda store, wz, scope: convert_flat_package(store, wz, "Ui")),
    ]


def load_batch_states(batch_dir: Path) -> dict[str, dict]:
    states = {}
    if not batch_dir.exists():
        return states
    for item in sorted(batch_dir.glob("*.json")):
        try:
            states[item.stem] = json.loads(item.read_text(encoding="utf-8"))
        except Exception:
            continue
    return states


def write_batch_state(batch_dir: Path, package: str, payload: dict) -> None:
    batch_dir.mkdir(parents=True, exist_ok=True)
    tmp = batch_dir / f"{package}.json.tmp"
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(batch_dir / f"{package}.json")


def run_batches(args, store: Store, client: Path) -> list[str]:
    """Run the ``all`` plan with resumable, at-most-once package batches."""
    batch_dir = Path(args.batch_state)
    commit = converter_commit()
    previous = load_batch_states(batch_dir)
    for package, state in previous.items():
        if state.get("status") == "complete" and state.get("converterCommit") not in (None, commit, "unknown"):
            raise SystemExit(
                f"batch-state for {package} was produced by converter {state.get('converterCommit')} "
                f"but this run is {commit}; regenerate the output or pass the matching checkout")
    only = {part for part in args.only.split(",") if part}
    pending = []
    for package, func in all_plan():
        state = previous.get(package)
        if state is not None and state.get("status") == "complete":
            if only and package not in only:
                continue
            print(f"SKIP {package} (already complete)", flush=True)
            store.stats["packagesResumed"] += 1
            store.converted_packages.append(package)
            continue
        if only and package not in only:
            continue
        pending.append((package, func))
    for package, func in pending:
        started = time.time()
        input_sha = file_sha256(client / package)
        print(f"OPEN {package} sha256={input_sha} commit={commit}", flush=True)
        wz = open_package(client, package)
        try:
            func(store, wz, "all")
        finally:
            wz.close()
        store.flush_resume_state()
        write_batch_state(batch_dir, package, {
            "package": package,
            "inputSha256": input_sha,
            "converterCommit": commit,
            "status": "complete",
            "elapsedSeconds": round(time.time() - started, 1),
            "structRecords": store.stats["struct"],
            "groupFiles": store.stats["groupFiles"],
            "resources": store.stats["resources"],
            "errors": store.stats["errors"],
            "outputSummary": store.table_output_summary(),
        })
        store.converted_packages.append(package)
        print(f"DONE-BATCH {package} elapsed={time.time() - started:.0f}s", flush=True)
    return [package for package, _ in all_plan()]


def finalize_all(args, store: Store) -> None:
    batch_dir = Path(args.batch_state)
    states = load_batch_states(batch_dir)
    missing = [package for package in DATA_PACKAGES
               if states.get(package, {}).get("status") != "complete"]
    if missing:
        raise SystemExit(f"cannot finalize; incomplete packages: {', '.join(missing)}")
    write_record_alias_table(store)
    emit_metadata(store)
    store.flush_resume_state()
    summary = build_summary(store, "all", states)
    write_report(args, summary, "all-final")
    print(f"FINALIZED packages={len(states)} struct={store.stats['struct']} "
          f"groupRows={store.stats['groupRows']} resources={store.stats['resources']} "
          f"errors={store.stats['errors']}", flush=True)


def build_summary(store: Store, scope: str, batch_states: dict[str, dict] | None = None) -> dict:
    summary = {
        "scope": scope,
        "stats": dict(store.stats),
        "unsafeInts": store.unsafe_ints,
        "collisions": store.collisions[:40],
        "recordRemaps": store.record_remaps,
        "recordAliasCount": len(store.record_alias_index),
        "resourceAliases": store.resource_aliases,
        "errors": store.errors,
        "tables": sorted(f"{kind}.{name}" for kind, name in store.tables),
        "resourceCount": len(store.resources),
        "outputSummary": store.table_output_summary(),
    }
    if batch_states:
        summary["batchStates"] = batch_states
    return summary


def write_report(args, summary: dict, label: str) -> None:
    report_dir = Path(args.report_dir) if getattr(args, "report_dir", "") else None
    if report_dir is None:
        return
    report_dir.mkdir(parents=True, exist_ok=True)
    (report_dir / f"convert-{label}.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scope", choices=("phase1", "all", "avatar"), required=True)
    parser.add_argument("--out", required=True, help="FSDB output directory (the [FSDB]<name> root). Must be outside tracked source.")
    parser.add_argument("--wz-root", default=os.environ.get("WZ_ROOT", ""), help="Directory containing Base.wz and the other packages.")
    parser.add_argument("--wzpy", default=os.environ.get("WZPY_ROOT", ""), help="Directory that contains the wzpy package.")
    parser.add_argument("--report-dir", default=os.environ.get("WZ_FSDB_REPORT_DIR", ""), help="Optional directory for the JSON summary.")
    parser.add_argument("--pixel-log", default="", help="Optional JSONL path for canvas width, height, and hash.")
    parser.add_argument("--only", default="")
    parser.add_argument("--batch-state", default="", help="Directory for resumable per-package batch state (scope all).")
    parser.add_argument("--finalize", action="store_true", help="Finalize a resumable all run: alias table, metadata, summary.")
    args = parser.parse_args()
    if not args.wz_root or not args.wzpy:
        raise SystemExit("pass --wz-root and --wzpy, or set WZ_ROOT and WZPY_ROOT")
    if args.finalize and not args.batch_state:
        raise SystemExit("--finalize requires --batch-state")
    out = Path(args.out)
    assert_untracked_output(out)
    report_dir = Path(args.report_dir) if args.report_dir else None
    pixel_path = Path(args.pixel_log) if args.pixel_log else None
    if report_dir is not None:
        assert_untracked_output(report_dir)
    if pixel_path is not None:
        assert_untracked_output(pixel_path)
    batch_dir = Path(args.batch_state) if args.batch_state else None
    if batch_dir is not None:
        assert_untracked_output(batch_dir)
    load_dependencies(Path(args.wzpy))
    out.mkdir(parents=True, exist_ok=True)
    client = Path(args.wz_root)

    if args.scope == "avatar":
        store = Store(out, roundtrip=True)
        convert_avatar(store, client)
        emit_metadata(store)
        write_report(args, build_summary(store, "avatar"), "avatar")
        print(f"DONE struct={store.stats['struct']} resources={store.stats['resources']} "
              f"canvases={store.stats['canvases']} filtered={store.stats['canvasesOutOfScope']} "
              f"errors={store.stats['errors']}", flush=True)
        return

    if args.scope == "all" and args.finalize:
        store = Store(out, roundtrip=False, resume_dir=(batch_dir / "manifest") if batch_dir else None)
        finalize_all(args, store)
        return

    store = Store(out, roundtrip=args.scope == "phase1", keep_pixels=pixel_path is not None,
                  resume_dir=(batch_dir / "manifest") if (args.scope == "all" and batch_dir) else None)
    only = {part for part in args.only.split(",") if part}
    if args.scope == "all":
        packages = run_batches(args, store, client)
        states = load_batch_states(batch_dir) if batch_dir else {}
        complete = all(states.get(package, {}).get("status") == "complete" for package in packages)
        if complete and not only:
            write_record_alias_table(store)
            emit_metadata(store)
            store.flush_resume_state()
            write_report(args, build_summary(store, "all", states), "all-final")
            print(f"FINALIZED struct={store.stats['struct']} groupRows={store.stats['groupRows']} "
                  f"resources={store.stats['resources']} errors={store.stats['errors']}", flush=True)
        else:
            store.flush_resume_state()
            done = sum(1 for package in packages if states.get(package, {}).get("status") == "complete")
            print(f"PARTIAL packages {done}/{len(packages)}; re-run remaining packages, then --finalize", flush=True)
        return

    plan = [
        ("Map.wz", convert_map_package),
        ("Character.wz", convert_character),
        ("Sound.wz", convert_sound),
    ]
    for name, func in plan:
        if only and name not in only:
            continue
        print(f"OPEN {name}", flush=True)
        wz = open_package(client, name)
        try:
            func(store, wz, args.scope)
        finally:
            wz.close()
    # A small FSDB lookup table allows runtime consumers to see every
    # source competing for the same original ID without guessing suffixes.
    write_record_alias_table(store)
    emit_metadata(store)
    write_report(args, build_summary(store, "phase1"), "phase1")
    if pixel_path is not None:
        pixel_path.parent.mkdir(parents=True, exist_ok=True)
        with pixel_path.open("w", encoding="utf-8", newline="\n") as handle:
            for row in store.pixel_rows:
                handle.write(dumps(row) + "\n")
    print(
        f"DONE struct={store.stats['struct']} groupRows={store.stats['groupRows']} resources={store.stats['resources']} errors={store.stats['errors']} collisions={store.stats['keyCollisions']}",
        flush=True,
    )


if __name__ == "__main__":
    main()
