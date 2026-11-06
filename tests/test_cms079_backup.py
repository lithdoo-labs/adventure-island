"""Small-fixture safety tests for one-time CMS079 backup and verification."""
from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/wz_fsdb/backup_artifacts.py"
SPEC = importlib.util.spec_from_file_location("backup_artifacts", SCRIPT)
backup = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(backup)


class CMS079BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.source = root / "work"
        self.dest = root / "external"
        self.image = self.source / "fsdb-all/[FSDB]cms/[resource]图/Look/body.png"
        self.summary = self.source / "reports/all/accounting.json"
        self.image.parent.mkdir(parents=True)
        self.image.write_bytes(b"\x89PNG\r\n\x1a\nsample-png")
        self.summary.parent.mkdir(parents=True)
        self.summary.write_text('{"png":1}', encoding="utf-8")
        (self.source / "ignored.wz").write_bytes(b"do-not-copy")

    def copy(self):
        return backup.backup(self.source, self.dest, resume=False, allow_same_volume=True)

    def test_full_backup_verifies_source_and_destination(self):
        result = self.copy()
        self.assertEqual(result["files"], 2)
        self.assertEqual(backup.verify(self.dest, self.source), result)
        self.assertFalse((self.dest / "ignored.wz").exists())
        self.assertEqual((self.dest / "fsdb-all/[FSDB]cms/[resource]图/Look/body.png").read_bytes(),
                         self.image.read_bytes())

    def test_refuses_same_volume_without_explicit_test_override(self):
        with self.assertRaisesRegex(ValueError, "same filesystem|different drive"):
            backup.backup(self.source, self.dest, resume=False, allow_same_volume=False)

    def test_fails_closed_on_corrupted_destination(self):
        self.copy()
        (self.dest / "reports/all/accounting.json").write_bytes(b"tampered!!")
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch|wrong size"):
            backup.verify(self.dest)

    def test_fails_closed_on_manifest_tampering(self):
        self.copy()
        with (self.dest / backup.MANIFEST).open("a", encoding="utf-8") as handle:
            handle.write("corruption")
        with self.assertRaisesRegex(ValueError, "manifest SHA-256"):
            backup.verify(self.dest)

    def test_refuses_to_overwrite_completed_backup(self):
        self.copy()
        with self.assertRaisesRegex(ValueError, "completed manifest|non-empty"):
            backup.backup(self.source, self.dest, resume=True, allow_same_volume=True)

    def test_resume_uses_verified_files_without_overwrite(self):
        destination_file = self.dest / "reports/all/accounting.json"
        destination_file.parent.mkdir(parents=True)
        destination_file.write_bytes(self.summary.read_bytes())
        result = backup.backup(self.source, self.dest, resume=True, allow_same_volume=True)
        self.assertEqual(result["files"], 2)
        self.assertEqual(destination_file.read_bytes(), self.summary.read_bytes())

    def test_resume_refuses_stale_or_different_existing_content(self):
        target = self.dest / "reports/all/accounting.json"
        target.parent.mkdir(parents=True)
        target.write_bytes(b"overwritten?")
        with self.assertRaisesRegex(ValueError, "existing destination"):
            backup.backup(self.source, self.dest, resume=True, allow_same_volume=True)
        self.assertEqual(target.read_bytes(), b"overwritten?")

    def test_unmanifested_destination_file_fails_verification(self):
        self.copy()
        extra = self.dest / "fsdb-all/[FSDB]cms/[resource]图/extra.png"
        extra.write_bytes(b"unexpected")
        with self.assertRaisesRegex(ValueError, "unmanifested"):
            backup.verify(self.dest)

    def test_refuses_destination_nested_under_source(self):
        with self.assertRaisesRegex(ValueError, "must not contain"):
            backup.backup(self.source, self.source / "backup", resume=False, allow_same_volume=True)

    def test_symlinks_refused_when_supported(self):
        link = self.source / "reports/all/extra.json"
        try:
            link.symlink_to(self.summary)
        except (OSError, NotImplementedError):
            self.skipTest("symlinks not enabled on this OS")
        with self.assertRaisesRegex(ValueError, "symlink"):
            self.copy()


if __name__ == "__main__":
    unittest.main()
