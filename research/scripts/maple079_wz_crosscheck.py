"""Canonicalize Task 023 third-party WZ exports into result tables.

This script does not parse WZ files. It reads machine-readable exports from
.work/task-023/output and writes the permanent comparison tables under result/.
"""
from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / ".work" / "task-023" / "output"
RESULT = ROOT / "result"
PARSERS = ("wzpy", "maple", "wcr2")
PARSER_LABEL = {"wzpy": "wz-python", "maple": "MapleLib", "wcr2": "WzComparerR2"}
ARCHIVES = [
    "Base.wz", "Character.wz", "Effect.wz", "Etc.wz", "Item.wz", "Map.wz",
    "Mob.wz", "Morph.wz", "Npc.wz", "Quest.wz", "Reactor.wz", "Skill.wz",
    "Sound.wz", "String.wz", "TamingMob.wz", "UI.wz",
]
OTHER_WZ = [name[:-3] if name.endswith(".wz") else name for name in ARCHIVES if name != "Base.wz"]


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def digest_lines(lines: list[str]) -> str:
    payload = "\n".join(lines).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def read_paths(path: Path) -> list[str]:
    if not path.exists():
        return []
    text = path.read_text(encoding="utf-8")
    if not text:
        return []
    return text.split("\n")[:-1] if text.endswith("\n") else text.split("\n")


def capability_rows() -> list[dict]:
    rows = []
    for key in PARSERS:
        for record in load_jsonl(OUT / key / "capability.jsonl"):
            rows.append({
                "parser": record.get("parser") or PARSER_LABEL[key],
                "parser_commit": record.get("parser_commit", ""),
                "archive": record.get("archive", ""),
                "success": record.get("success", ""),
                "reported_version": record.get("reported_version", ""),
                "region_enum_or_key_name": record.get("region_enum_or_key_name", ""),
                "actual_iv_bytes": record.get("actual_iv_bytes", ""),
                "root_directory_count": record.get("root_directory_count", ""),
                "root_image_count": record.get("root_image_count", ""),
                "recursive_image_count": record.get("recursive_image_count", ""),
                "printable_name_ratio": record.get("printable_name_ratio", ""),
                "warnings": record.get("warnings", ""),
                "error": record.get("error", ""),
                "elapsed_ms": record.get("elapsed_ms", ""),
            })
    return rows


def tree_tables() -> tuple[list[dict], list[dict], dict]:
    digests = []
    sets = {}
    for key in PARSERS:
        sets[key] = {}
        for archive in ARCHIVES:
            paths = read_paths(OUT / key / "paths" / f"{archive}.txt")
            sets[key][archive] = paths
            ordered = sorted(paths)
            folded = sorted(path.casefold() for path in paths)
            digests.append({
                "parser": PARSER_LABEL[key],
                "archive": archive,
                "image_count": len(paths),
                "sorted_path_sha256": digest_lines(ordered) if paths or (OUT / key / "paths" / f"{archive}.txt").exists() else "",
                "casefold_sorted_path_sha256": digest_lines(folded) if paths or (OUT / key / "paths" / f"{archive}.txt").exists() else "",
                "iv_bytes": "B9 7D 63 E9",
            })
    cross = []
    summary = {}
    pairs = (("wzpy", "maple"), ("wzpy", "wcr2"), ("maple", "wcr2"))
    for left, right in pairs:
        for archive in ARCHIVES:
            left_set = set(sets[left][archive])
            right_set = set(sets[right][archive])
            only_left = sorted(left_set - right_set)
            only_right = sorted(right_set - left_set)
            folded_left = {path.casefold() for path in left_set}
            folded_right = {path.casefold() for path in right_set}
            if not only_left and not only_right:
                kind = "match"
            elif folded_left == folded_right:
                kind = "unicode/case normalization difference"
            else:
                kind = classify_path_diff(only_left, only_right)
            cross.append({
                "archive": archive,
                "left_parser": PARSER_LABEL[left],
                "right_parser": PARSER_LABEL[right],
                "left_count": len(left_set),
                "right_count": len(right_set),
                "only_left_count": len(only_left),
                "only_right_count": len(only_right),
                "classification": kind,
                "only_left_sample": ";".join(only_left[:8]),
                "only_right_sample": ";".join(only_right[:8]),
            })
            summary[f"{left}-vs-{right}:{archive}"] = {
                "only_left": len(only_left),
                "only_right": len(only_right),
                "classification": kind,
            }
    base = base_projection()
    cross.extend(base["rows"])
    summary["base"] = base["summary"]
    return digests, cross, summary


def classify_path_diff(only_left: list[str], only_right: list[str]) -> str:
    sample = only_left + only_right
    if sample and all(path.split("/")[-1] in OTHER_WZ or path.endswith(".wz") for path in sample):
        return "directory-vs-link representation difference"
    if not sample:
        return "match"
    return "real missing/extra image"


def base_projection() -> dict:
    rows = []
    summary = {}
    expected = set(OTHER_WZ)
    for key in PARSERS:
        path = OUT / key / "base.json"
        if not path.exists():
            rows.append({
                "archive": "Base.wz",
                "left_parser": PARSER_LABEL[key],
                "right_parser": "filesystem",
                "left_count": "",
                "right_count": len(expected),
                "only_left_count": "",
                "only_right_count": "",
                "classification": "missing base export",
                "only_left_sample": "",
                "only_right_sample": "",
            })
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        names = []
        representations = set()
        for link in payload.get("links", []):
            name = str(link.get("name", ""))
            if name.lower().endswith(".wz"):
                name = name[:-3]
            names.append(name)
            representations.add(link.get("representation", ""))
        found = set(names)
        links_not_files = sorted(found - expected)
        files_not_links = sorted(expected - found)
        rows.append({
            "archive": "Base.wz",
            "left_parser": PARSER_LABEL[key],
            "right_parser": "other-15-wz-filenames",
            "left_count": len(found),
            "right_count": len(expected),
            "only_left_count": len(links_not_files),
            "only_right_count": len(files_not_links),
            "classification": "match" if not links_not_files and not files_not_links else "real missing/extra image",
            "only_left_sample": "links-not-files=" + ",".join(links_not_files),
            "only_right_sample": "files-not-links=" + ",".join(files_not_links) + "; representation=" + ",".join(sorted(representations)),
        })
        summary[key] = {
            "links_not_files": links_not_files,
            "files_not_links": files_not_links,
            "representation": sorted(representations),
            "names": names,
        }
    return {"rows": rows, "summary": summary}


def property_table() -> dict:
    present = {}
    for key in PARSERS:
        rows = load_jsonl(OUT / key / "properties.jsonl")
        table = {}
        for row in rows:
            ident = (row.get("archive", ""), row.get("image_path", ""), row.get("property_path", ""))
            table[ident] = (row.get("canonical_type", ""), row.get("canonical_value", ""))
        present[key] = table
    keys = set()
    images = {}
    for key, table in present.items():
        keys.update(table)
        images[key] = {(item[0], item[1]) for item in table}
    mismatches = []
    compared = 0
    matched = 0
    missing_by_parser = Counter()
    for ident in sorted(keys):
        values = {key: present[key].get(ident) for key in PARSERS if present[key]}
        if len(values) < 2:
            continue
        compared += 1
        unique = {value for value in values.values() if value is not None}
        image_key = (ident[0], ident[1])
        absent = []
        for key, table in present.items():
            if not table:
                continue
            if image_key in images[key] and ident not in table:
                absent.append(key)
        if absent or len(unique) > 1:
            record = {
                "archive": ident[0],
                "image_path": ident[1],
                "property_path": ident[2],
                "canonical_type": "",
                "canonical_value": "",
                "status": "mismatch",
            }
            for key in PARSERS:
                pair = present[key].get(ident) if present[key] else None
                record[f"{key}_type"] = "" if pair is None else pair[0]
                record[f"{key}_value"] = "" if pair is None else pair[1]
            record["canonical_type"] = record["wzpy_type"] or record["maple_type"] or record["wcr2_type"]
            record["canonical_value"] = record["wzpy_value"]
            if (
                record["wzpy_type"] == "subproperty" and record["wzpy_value"] == ""
                and record["maple_type"] == "subproperty" and record["maple_value"] == ""
                and record["wcr2_type"] == "unknown" and record["wcr2_value"] == ""
            ):
                record["status"] = "wcr2-empty-property-as-null"
            mismatches.append(record)
            for key in absent:
                missing_by_parser[key] += 1
        else:
            matched += 1
    if compared == 0:
        mismatches.append({
            "archive": "",
            "image_path": "",
            "property_path": "__summary__",
            "canonical_type": "",
            "canonical_value": "no overlapping property exports",
            "status": "blocked",
            "wzpy_type": "", "wzpy_value": "",
            "maple_type": "", "maple_value": "",
            "wcr2_type": "", "wcr2_value": "",
        })
    return {
        "rows": mismatches,
        "compared": compared,
        "matched": matched,
        "mismatch": compared - matched,
        "agreement": (matched / compared) if compared else 0,
        "missing_by_parser": dict(missing_by_parser),
        "exported_counts": {key: len(table) for key, table in present.items()},
    }


def canvas_table() -> dict:
    tables = {}
    for key in PARSERS:
        tables[key] = {}
        for row in load_jsonl(OUT / key / "canvas.jsonl"):
            ident = (row.get("archive", ""), row.get("image_path", ""), row.get("property_path", ""))
            tables[key][ident] = row
    idents = set()
    for table in tables.values():
        idents.update(table)
    rows = []
    exact = 0
    mismatch = 0
    for ident in sorted(idents):
        hashes = {}
        sizes = {}
        errors = {}
        for key in PARSERS:
            row = tables[key].get(ident)
            if row is None:
                continue
            hashes[key] = row.get("rgba_sha256") or ""
            sizes[key] = (str(row.get("width", "")), str(row.get("height", "")))
            errors[key] = row.get("error") or ""
        supported = {key: value for key, value in hashes.items() if value}
        same = len(set(supported.values())) <= 1 and len(supported) >= 2 and len(set(sizes[key] for key in supported)) <= 1
        status = "match" if same else ("mismatch" if len(supported) >= 1 else "error")
        if same:
            exact += 1
        elif len(supported) >= 2 or any(errors.values()):
            mismatch += 1
        rows.append({
            "archive": ident[0],
            "image_path": ident[1],
            "property_path": ident[2],
            "width": sizes.get("wzpy", ("", ""))[0],
            "height": sizes.get("wzpy", ("", ""))[1],
            "wzpy_rgba_sha256": hashes.get("wzpy", ""),
            "maple_rgba_sha256": hashes.get("maple", ""),
            "wcr2_rgba_sha256": hashes.get("wcr2", ""),
            "wzpy_error": errors.get("wzpy", ""),
            "maple_error": errors.get("maple", ""),
            "wcr2_error": errors.get("wcr2", ""),
            "status": status,
        })
    return {"rows": rows, "exact": exact, "mismatch": mismatch, "sample": len(rows)}


def link_table() -> dict:
    tables = {}
    for key in PARSERS:
        tables[key] = {}
        for row in load_jsonl(OUT / key / "links.jsonl"):
            ident = (row.get("archive", ""), row.get("image_path", ""), row.get("property_path", ""), row.get("kind", ""))
            tables[key][ident] = row
    idents = set()
    for table in tables.values():
        idents.update(table)
    rows = []
    raw_match = 0
    resolved_match = 0
    unsupported = Counter()
    mismatch = 0
    for ident in sorted(idents):
        raws = {}
        resolved = {}
        statuses = {}
        for key in PARSERS:
            row = tables[key].get(ident)
            if row is None:
                continue
            raws[key] = row.get("raw_link_string", "")
            resolved[key] = (
                row.get("resolved_archive", ""),
                row.get("resolved_image", ""),
                row.get("resolved_property_path", ""),
            )
            statuses[key] = row.get("resolution_status", "")
            if statuses[key] == "unsupported":
                unsupported[key] += 1
        raw_values = {value for value in raws.values()}
        resolved_values = {
            resolved[key] for key, status in statuses.items() if status == "resolved"
        }
        raw_ok = len(raw_values) <= 1 and len(raws) >= 2
        non_unsupported = [statuses[key] for key in statuses if statuses[key] != "unsupported"]
        unanimous_resolved = (
            len(resolved_values) == 1
            and len(non_unsupported) == len(raws)
            and all(item == "resolved" for item in non_unsupported)
        )
        all_unsupported = bool(statuses) and all(item == "unsupported" for item in statuses.values())
        if raw_ok:
            raw_match += 1
        if unanimous_resolved:
            resolved_match += 1
        status = "match" if raw_ok and (unanimous_resolved or all_unsupported) else "mismatch"
        if status != "match":
            mismatch += 1
        base = tables["wzpy"].get(ident) or tables["maple"].get(ident) or tables["wcr2"].get(ident) or {}
        rows.append({
            "archive": ident[0],
            "image_path": ident[1],
            "property_path": ident[2],
            "kind": ident[3],
            "raw_link_string": base.get("raw_link_string", ""),
            "wzpy_status": statuses.get("wzpy", ""),
            "maple_status": statuses.get("maple", ""),
            "wcr2_status": statuses.get("wcr2", ""),
            "wzpy_resolved": "/".join(resolved.get("wzpy", ("", "", ""))),
            "maple_resolved": "/".join(resolved.get("maple", ("", "", ""))),
            "wcr2_resolved": "/".join(resolved.get("wcr2", ("", "", ""))),
            "status": status,
        })
    return {
        "rows": rows,
        "sample": len(rows),
        "raw_match": raw_match,
        "resolved_match": resolved_match,
        "unsupported": dict(unsupported),
        "mismatch": mismatch,
    }


def normalize_list_path(path: str) -> str:
    return path.replace("\\", "/").strip()


def list_table() -> dict:
    local_path = OUT / "local" / "listwz-entries.csv"
    local = []
    if local_path.exists():
        with local_path.open(encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle):
                local.append(row["path"])
    rows = []
    summary = {"local_count": len(local), "local_raw_digest": digest_lines(local), "local_normalized_digest": digest_lines([normalize_list_path(item) for item in local])}
    by_parser = defaultdict(lambda: defaultdict(list))
    for key, filename in (("maple", "maple"), ("wcr2", "wcr2")):
        for record in load_jsonl(OUT / filename / "listwz.jsonl"):
            region = record.get("region_enum_or_key_name", "")
            if record.get("error") and record.get("index") == -1:
                by_parser[key][region] = [{"error": record.get("error"), "raw_path": ""}]
                continue
            by_parser[key][region].append(record)
    for key, regions in by_parser.items():
        for region, records in regions.items():
            if records and records[0].get("error") and records[0].get("index", 0) == -1 and len(records) == 1:
                rows.append({
                    "parser": PARSER_LABEL[key],
                    "region_enum_or_key_name": region,
                    "actual_iv_bytes": "",
                    "index": -1,
                    "raw_path": "",
                    "normalized_path": "",
                    "local_path": "",
                    "status": "blocked-by-library-interface" if "not" in str(records[0].get("error")).lower() else "error",
                    "detail": records[0].get("error", ""),
                })
                summary[f"{key}:{region}"] = {"count": 0, "error": records[0].get("error", "")}
                continue
            ordered = sorted(records, key=lambda item: int(item.get("index", 0)))
            raws = [str(item.get("raw_path", "")) for item in ordered]
            norms = [normalize_list_path(item) for item in raws]
            exact = raws == local
            normalized_exact = norms == [normalize_list_path(item) for item in local]
            iv = ordered[0].get("actual_iv_bytes", "") if ordered else ""
            summary[f"{key}:{region}"] = {
                "count": len(raws),
                "exact_ordered_match": exact,
                "normalized_ordered_match": normalized_exact,
                "raw_digest": digest_lines(raws),
                "normalized_digest": digest_lines(norms),
                "iv": iv,
            }
            limit = len(raws) if not exact else 0
            # Keep every row when the lists differ and the library returned a plausible table.
            # Cap a clearly broken multi-megabyte decode at the first 20 plus a summary.
            emit = ordered if len(ordered) <= 2000 else ordered[:20]
            dropped_leading = bool(local) and raws == local[1:]
            if exact:
                rows.append({
                    "parser": PARSER_LABEL[key],
                    "region_enum_or_key_name": region,
                    "actual_iv_bytes": iv,
                    "index": "",
                    "raw_path": "",
                    "normalized_path": "",
                    "local_path": "",
                    "status": "exact-ordered-match",
                    "detail": f"{len(raws)}/{len(local)} raw_digest={digest_lines(raws)} normalized_digest={digest_lines(norms)}",
                })
            elif dropped_leading:
                rows.append({
                    "parser": PARSER_LABEL[key],
                    "region_enum_or_key_name": region,
                    "actual_iv_bytes": iv,
                    "index": "",
                    "raw_path": "",
                    "normalized_path": "",
                    "local_path": local[0],
                    "status": "dropped-leading-entry",
                    "detail": (
                        f"count {len(raws)}/{len(local)}; omitted local[0]={local[0]!r}; "
                        f"remaining entries match local[1:] in order; "
                        f"raw_digest={digest_lines(raws)}"
                    ),
                })
            else:
                for item, raw, norm in zip(emit, raws, norms):
                    index = int(item.get("index", 0))
                    local_path = local[index] if 0 <= index < len(local) else ""
                    rows.append({
                        "parser": PARSER_LABEL[key],
                        "region_enum_or_key_name": region,
                        "actual_iv_bytes": iv,
                        "index": index,
                        "raw_path": raw,
                        "normalized_path": norm,
                        "local_path": local_path,
                        "status": "match" if raw == local_path else "mismatch",
                        "detail": item.get("note", "") or item.get("error", ""),
                    })
                if len(ordered) > len(emit):
                    rows.append({
                        "parser": PARSER_LABEL[key],
                        "region_enum_or_key_name": region,
                        "actual_iv_bytes": iv,
                        "index": "",
                        "raw_path": "",
                        "normalized_path": "",
                        "local_path": "",
                        "status": "truncated-mismatch-sample",
                        "detail": f"showing {len(emit)} of {len(ordered)}; raw_digest={digest_lines(raws)}",
                    })
    if not rows:
        rows.append({
            "parser": "",
            "region_enum_or_key_name": "",
            "actual_iv_bytes": "",
            "index": "",
            "raw_path": "",
            "normalized_path": "",
            "local_path": "",
            "status": "blocked-by-library-interface",
            "detail": "no third-party List.wz export",
        })
    summary["rows"] = len(rows)
    return {"rows": rows, "summary": summary}


def sound_table() -> dict:
    tables = {key: {} for key in PARSERS}
    for key in PARSERS:
        for row in load_jsonl(OUT / key / "sounds.jsonl"):
            ident = (row.get("archive", ""), row.get("image_path", ""), row.get("property_path", ""))
            tables[key][ident] = row
    idents = set()
    for table in tables.values():
        idents.update(table)
    rows = []
    exact = 0
    for ident in sorted(idents):
        hashes = {key: (tables[key].get(ident) or {}).get("payload_sha256", "") for key in PARSERS}
        supported = {key: value for key, value in hashes.items() if value}
        same = len(supported) >= 2 and len(set(supported.values())) == 1
        if same:
            exact += 1
        base = tables["wzpy"].get(ident) or {}
        rows.append({
            "archive": ident[0],
            "image_path": ident[1],
            "property_path": ident[2],
            "duration_ms": base.get("duration_ms", ""),
            "payload_length": base.get("payload_length", ""),
            "wzpy_sha256": hashes.get("wzpy", ""),
            "maple_sha256": hashes.get("maple", ""),
            "wcr2_sha256": hashes.get("wcr2", ""),
            "status": "match" if same else "mismatch",
        })
    return {"rows": rows, "exact": exact, "sample": len(rows)}


def main() -> None:
    RESULT.mkdir(parents=True, exist_ok=True)
    capability = capability_rows()
    write_csv(RESULT / "wz-parser-capability-matrix.csv", capability, [
        "parser", "parser_commit", "archive", "success", "reported_version",
        "region_enum_or_key_name", "actual_iv_bytes", "root_directory_count",
        "root_image_count", "recursive_image_count", "printable_name_ratio",
        "warnings", "error", "elapsed_ms",
    ])
    digests, cross, tree_summary = tree_tables()
    write_csv(RESULT / "wz-tree-digests.csv", digests, [
        "parser", "archive", "image_count", "sorted_path_sha256",
        "casefold_sorted_path_sha256", "iv_bytes",
    ])
    write_csv(RESULT / "wz-tree-crosscheck.csv", cross, [
        "archive", "left_parser", "right_parser", "left_count", "right_count",
        "only_left_count", "only_right_count", "classification",
        "only_left_sample", "only_right_sample",
    ])
    properties = property_table()
    write_csv(RESULT / "wz-property-crosscheck.csv", properties["rows"], [
        "archive", "image_path", "property_path", "canonical_type", "canonical_value",
        "status", "wzpy_type", "wzpy_value", "maple_type", "maple_value",
        "wcr2_type", "wcr2_value",
    ])
    canvas = canvas_table()
    write_csv(RESULT / "wz-canvas-crosscheck.csv", canvas["rows"], [
        "archive", "image_path", "property_path", "width", "height",
        "wzpy_rgba_sha256", "maple_rgba_sha256", "wcr2_rgba_sha256",
        "wzpy_error", "maple_error", "wcr2_error", "status",
    ])
    links = link_table()
    write_csv(RESULT / "wz-link-crosscheck.csv", links["rows"], [
        "archive", "image_path", "property_path", "kind", "raw_link_string",
        "wzpy_status", "maple_status", "wcr2_status",
        "wzpy_resolved", "maple_resolved", "wcr2_resolved", "status",
    ])
    sounds = sound_table()
    if sounds["rows"]:
        write_csv(RESULT / "wz-sound-crosscheck.csv", sounds["rows"], [
            "archive", "image_path", "property_path", "duration_ms", "payload_length",
            "wzpy_sha256", "maple_sha256", "wcr2_sha256", "status",
        ])
    listing = list_table()
    write_csv(RESULT / "listwz-library-crosscheck.csv", listing["rows"], [
        "parser", "region_enum_or_key_name", "actual_iv_bytes", "index",
        "raw_path", "normalized_path", "local_path", "status", "detail",
    ])
    summary = {
        "capability_rows": len(capability),
        "tree": tree_summary,
        "img_counts": {
            row["parser"] + ":" + row["archive"]: row["image_count"] for row in digests
        },
        "properties": {k: properties[k] for k in ("compared", "matched", "mismatch", "agreement", "missing_by_parser", "exported_counts")},
        "canvas": {k: canvas[k] for k in ("sample", "exact", "mismatch")},
        "links": {k: links[k] for k in ("sample", "raw_match", "resolved_match", "unsupported", "mismatch")},
        "sounds": {k: sounds[k] for k in ("sample", "exact")},
        "listwz": listing["summary"],
    }
    (OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
