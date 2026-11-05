"""Count an FSDB tree and compare it with a converter summary.

The walk stats files. It does not read PNG or audio bytes.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fsdb", required=True)
    parser.add_argument("--summary", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    root = Path(args.fsdb)
    summary = json.loads(Path(args.summary).read_text(encoding="utf-8"))
    tables = {}
    png = 0
    audio = {"mp3": 0, "wav": 0, "ogg": 0, "bin": 0, "other": 0}
    struct_files = 0
    group_files = 0
    for table in root.iterdir():
        if not table.is_dir() or not table.name.startswith("["):
            continue
        kind, name = table.name[1:].split("]", 1)
        files = 0
        for path in table.rglob("*"):
            if not path.is_file() or path.name.startswith("."):
                continue
            files += 1
            if kind == "resource" and name == "图" and path.suffix == ".png":
                png += 1
            elif kind == "resource" and name == "音":
                audio[path.suffix[1:] if path.suffix[1:] in audio else "other"] += 1
            elif kind == "struct":
                struct_files += 1
            elif kind == "group":
                group_files += 1
        tables[f"{kind}.{name}"] = files
    stats = summary.get("stats", {})
    report = {
        "tables": tables,
        "structFiles": struct_files,
        "groupFiles": group_files,
        "png": png,
        "audio": audio,
        "summaryStats": stats,
        "pngMatchesCanvases": png == stats.get("canvases"),
        "structMatchesSummary": struct_files == stats.get("struct"),
        "groupFilesMatchSummary": group_files == stats.get("groupFiles"),
        "audioFiles": sum(audio.values()),
        "soundsMatch": sum(audio.values()) == stats.get("sounds"),
        "errorCount": stats.get("errors", 0),
        "recordedErrors": len(summary.get("errors", [])),
        "recordRemaps": len(summary.get("recordRemaps", [])),
        "resourceAliases": len(summary.get("resourceAliases", [])),
        "uol": {key: stats.get(key, 0) for key in ("uol", "uol_ok", "uol_dangling", "uol_cycle", "uol_depth_limit")},
    }
    Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("png", "structFiles", "groupFiles", "audio", "pngMatchesCanvases", "structMatchesSummary", "soundsMatch", "uol")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
