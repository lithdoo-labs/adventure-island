#!/usr/bin/env python3
"""One-time, off-repository CMS079 FSDB backup with complete SHA-256 verification.

The archive contains ONLY the already-converted fsdb-all/ and reports/ directories
from the local work root, not the original client, .wz files or Git metadata.
This script does not call the converter and never writes to the source tree.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import tempfile

DATA_DIRS = ("fsdb-all", "reports")
MANIFEST = "backup-manifest.jsonl"
CHECKSUM = "backup-manifest.sha256"
BLOCK = 4 * 1024 * 1024


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(BLOCK), b""):
            digest.update(chunk)
    return digest.hexdigest()


def iter_source_files(source: Path):
    for top in DATA_DIRS:
        folder = source / top
        if not folder.is_dir() or folder.is_symlink():
            raise ValueError("missing or linked source directory: " + top)
        for base, dirs, files in os.walk(folder, followlinks=False):
            dirs.sort()
            files.sort()
            for name in dirs:
                if (Path(base) / name).is_symlink():
                    raise ValueError("source contains symlinked directory: " + name)
            for name in files:
                file = Path(base) / name
                if not file.is_file() or file.is_symlink():
                    raise ValueError("source contains non-regular file or symlink: " + str(file))
                yield file.relative_to(source).as_posix(), file


def validate_roots(source: Path, destination: Path, allow_same_volume: bool):
    source = source.resolve(strict=True)
    if not source.is_dir():
        raise ValueError("source is not a directory")
    destination = destination.resolve(strict=False)
    if source == destination or source in destination.parents or destination in source.parents:
        raise ValueError("source and destination must not contain one another")
    if not allow_same_volume:
        # Same drive letter is sufficient reason to refuse, but different
        # drive letters do NOT prove independent physical disks.
        if os.name == "nt":
            if source.drive.casefold() == destination.drive.casefold():
                raise ValueError("backup must use a different drive by default")
        else:
            existing = destination
            while not existing.exists():
                existing = existing.parent
            if source.stat().st_dev == existing.stat().st_dev:
                raise ValueError("backup is on the same filesystem; use an independent disk")
    return source, destination


def copy_and_hash(source_file: Path, dest_file: Path) -> tuple[int, str]:
    """Hash the source bytes as they are copied; publish via same-dir rename."""
    dest_file.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=".cms079-copy-", dir=dest_file.parent)
    temp = Path(temp_name)
    digest = hashlib.sha256()
    size = 0
    try:
        with os.fdopen(fd, "wb") as out, source_file.open("rb") as inp:
            for chunk in iter(lambda: inp.read(BLOCK), b""):
                out.write(chunk)
                digest.update(chunk)
                size += len(chunk)
        # We only write into a new backup root. For --resume, existing files
        # are verified and never overwritten. A concurrent writer is unsupported.
        if dest_file.exists():
            raise ValueError("destination appeared during copy: " + str(dest_file))
        os.replace(temp, dest_file)
    finally:
        if temp.exists():
            temp.unlink()
    return size, digest.hexdigest()


def print_progress(kind: str, count: int):
    if count and count % 10000 == 0:
        print(f"{kind}: {count} files", flush=True)


def backup(source: Path, destination: Path, resume: bool, allow_same_volume: bool):
    source, destination = validate_roots(source, destination, allow_same_volume)
    if destination.exists() and any(destination.iterdir()) and not resume:
        raise ValueError("destination is non-empty; use --resume for a previous interrupted backup")
    if (destination / MANIFEST).exists() or (destination / CHECKSUM).exists():
        raise ValueError("destination already has a completed manifest; run verify instead")
    destination.mkdir(parents=True, exist_ok=True)
    manifest_tmp = destination / (MANIFEST + ".partial")
    files = 0
    total_bytes = 0
    with manifest_tmp.open("w", encoding="utf-8", newline="\n") as output:
        output.write(json.dumps({"type": "header", "version": 1, "roots": list(DATA_DIRS)}, ensure_ascii=False) + "\n")
        for relative, source_file in iter_source_files(source):
            target = destination.joinpath(*PurePosixPath(relative).parts)
            src_size = source_file.stat().st_size
            if target.is_symlink():
                raise ValueError("destination symlink refused: " + relative)
            if target.exists():
                if not resume or not target.is_file() or target.stat().st_size != src_size:
                    raise ValueError("existing destination entry differs or resume not allowed: " + relative)
                digest = sha256_file(source_file)
                if sha256_file(target) != digest:
                    raise ValueError("existing destination bytes differ; refusing overwrite: " + relative)
                size = src_size
            else:
                size, digest = copy_and_hash(source_file, target)
                if size != src_size:
                    raise ValueError("source changed during backup: " + relative)
            output.write(json.dumps({"type": "file", "path": relative, "bytes": size, "sha256": digest},
                                    ensure_ascii=False, separators=(",", ":")) + "\n")
            files += 1
            total_bytes += size
            print_progress("backed up", files)
        output.write(json.dumps({"type": "complete", "files": files, "bytes": total_bytes}) + "\n")
        output.flush()
        os.fsync(output.fileno())
    # Only publish an authoritative manifest when every source file was copied.
    os.replace(manifest_tmp, destination / MANIFEST)
    digest = sha256_file(destination / MANIFEST)
    checksum_tmp = destination / (CHECKSUM + ".partial")
    checksum_tmp.write_text(digest + "  " + MANIFEST + "\n", encoding="utf-8")
    os.replace(checksum_tmp, destination / CHECKSUM)
    print(f"BACKUP COPIED: {files} files, {total_bytes} bytes; now verify the destination.")
    return verify(destination, source)


def valid_relative(path: str) -> bool:
    if not isinstance(path, str) or not path or "\\" in path:
        return False
    p = PurePosixPath(path)
    return (not p.is_absolute() and len(p.parts) >= 2 and
            p.parts[0] in DATA_DIRS and all(part not in (".", "..") for part in p.parts) and
            str(p) == path)


def verify(destination: Path, source: Path | None = None):
    destination = destination.resolve(strict=True)
    if not destination.is_dir():
        raise ValueError("destination is not a directory")
    manifest = destination / MANIFEST
    sha_file = destination / CHECKSUM
    expected_digest = sha_file.read_text(encoding="utf-8").split()[0]
    if sha256_file(manifest) != expected_digest:
        raise ValueError("manifest SHA-256 does not match its checksum")
    source = source.resolve(strict=True) if source is not None else None
    file_count = 0
    byte_count = 0
    seen = set()
    complete = False
    with manifest.open("r", encoding="utf-8") as lines:
        header = json.loads(next(lines))
        if header != {"type": "header", "version": 1, "roots": list(DATA_DIRS)}:
            raise ValueError("unrecognized backup manifest version or layout")
        for line in lines:
            row = json.loads(line)
            if row.get("type") == "complete":
                if file_count != row.get("files") or byte_count != row.get("bytes"):
                    raise ValueError("manifest counts do not agree with entries")
                if next(lines, None) is not None:
                    raise ValueError("unexpected data after complete marker")
                complete = True
                break
            relative = row.get("path")
            if row.get("type") != "file" or not valid_relative(relative):
                raise ValueError("invalid manifest entry or relative path")
            if relative in seen:
                raise ValueError("duplicate manifest file path: " + relative)
            seen.add(relative)
            expected_size = row.get("bytes")
            digest = row.get("sha256")
            if type(expected_size) is not int or expected_size < 0:
                raise ValueError("invalid file length in manifest: " + relative)
            if not isinstance(digest, str) or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
                raise ValueError("invalid SHA-256 entry: " + relative)
            target = destination.joinpath(*PurePosixPath(relative).parts)
            if not target.is_file() or target.is_symlink() or target.stat().st_size != expected_size:
                raise ValueError("backup missing, linked, or wrong size: " + relative)
            if sha256_file(target) != digest:
                raise ValueError("backup content SHA-256 mismatch: " + relative)
            if source is not None:
                original = source.joinpath(*PurePosixPath(relative).parts)
                if not original.is_file() or original.is_symlink() or sha256_file(original) != digest:
                    raise ValueError("source differs from backup manifest: " + relative)
            file_count += 1
            byte_count += expected_size
            print_progress("verified", file_count)
    if not complete:
        raise ValueError("backup manifest lacks a complete marker")
    # A correct manifest is not enough if source contained files omitted from
    # that manifest or the backup holds unexpected outputs.
    actual = 0
    for relative, _ in iter_source_files(destination):
        if relative not in seen:
            raise ValueError("unmanifested backup file: " + relative)
        actual += 1
    if actual != file_count:
        raise ValueError("destination file count disagrees with the manifest")
    if source is not None:
        actual_source = sum(1 for _ in iter_source_files(source))
        if actual_source != file_count:
            raise ValueError("source file count differs from backup")
    print(f"VERIFIED: {file_count} files, {byte_count} bytes, complete SHA-256 comparison")
    return {"files": file_count, "bytes": byte_count, "manifestSha256": expected_digest}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="operation", required=True)
    p_backup = sub.add_parser("backup", help="copy existing FSDB+reports to a separate volume")
    p_backup.add_argument("--source", type=Path, required=True, help="the CMS079 work root")
    p_backup.add_argument("--destination", type=Path, required=True, help="new external backup root")
    p_backup.add_argument("--resume", action="store_true", help="resume an interrupted copy; never overwrite mismatched bytes")
    p_backup.add_argument("--allow-same-volume", action="store_true",
                          help="for synthetic tests only; not a disaster-recovery backup")
    p_verify = sub.add_parser("verify", help="read all backed-up bytes against manifest SHA-256")
    p_verify.add_argument("--destination", type=Path, required=True)
    p_verify.add_argument("--source", type=Path, help="also verify every original against the backup")
    args = parser.parse_args()
    if args.operation == "backup":
        backup(args.source, args.destination, args.resume, args.allow_same_volume)
    else:
        verify(args.destination, args.source)


if __name__ == "__main__":
    main()
