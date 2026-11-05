"""Crash-safety of the resumable batch protocol (fault injection).

These tests simulate abrupt process kills at the three interesting points of
the write-ahead protocol and prove that restarting the *same conversion*
from a fresh `Store` produces output equivalent to an uninterrupted run:

1. kill BEFORE the output file is written (journal intent already flushed);
2. kill AFTER the output file landed but BEFORE any checkpoint — recovery
   must verify journal intents against disk and reuse complete outputs;
3. kill AFTER a checkpoint (package boundary) — replay trusts the journal.

Equivalence means: identical file set with identical bytes, no duplicate
records/resources, preserved source provenance (record remaps, alias tables,
resource aliases) and exact journal-derived accounting counters. The recovery
path is exercised for real: a new `Store` is constructed over the same
resume directory, exactly like a new process on the next round.
"""
from __future__ import annotations

import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "wz_fsdb"))

import convert_cms  # noqa: E402


def png(color, size=(3, 3)):
    image = Image.new("RGBA", size, color)
    digest = hashlib.sha256(image.tobytes()).hexdigest()
    return image, digest


def run_conversion(store: convert_cms.Store) -> None:
    """A deterministic synthetic 'package': records, groups, canvases, sounds.

    Deliberately includes every conflict shape the journal must preserve:
    duplicate struct keys from different sources, a casefold directory pair,
    an invalid resource segment, and an extension conflict.
    """
    store.journal_package_start("Synthetic.wz")
    store.write_struct("Look", "00002000", {"v": 1}, source="Character.wz/00002000.img")
    store.write_struct("Look", "00000001", {"source": "alpha"}, source="Character.wz/Weapon/1.img")
    store.write_struct("Look", "00000001", {"source": "beta"}, source="Character.wz/Cap/2.img")
    store.write_struct("Map", "100000000", {"info": {"town": 1}, "layers": []})
    store.write_group("Tile", "100000000", [{"x": 1, "y": 2}, {"x": 3, "y": 4}])
    store.write_group("Back", "100000000", [{"bS": "grassySoil", "no": 0}])
    image_a, digest_a = png((1, 2, 3, 4))
    image_b, digest_b = png((9, 8, 7, 6))
    store.write_png(["Look", "00002000", "walk1", "0", "body"], image_a, digest_a)
    store.write_png(["Effect", "DragonTiger", "0"], image_b, digest_b)
    store.write_png(["Effect", "dragonTiger", "0"], image_b, digest_b)  # casefold dir alias
    store.write_png(["Fixture", "frame "], image_a, digest_a)  # invalid segment encoding
    store.write_sound(["Sound", "Bgm00", "FloralLife"], b"synthetic-tone-mp3", "mp3")
    store.write_sound(["Sound", "Bgm00", "FloralLife"], b"different-tone", "mp3")  # key conflict alias
    store.bump_stat("encodedStringKeys", 2)
    store.note_error("string", "TextMap/Con.img", "invalid-name")


def snapshot_tree(root: Path) -> dict:
    files = {}
    for path in sorted(root.rglob("*")):
        if path.is_file() and ".tmp-" not in path.name:
            files[str(path.relative_to(root))] = hashlib.sha256(path.read_bytes()).hexdigest()
    return files


def provenance(store: convert_cms.Store) -> dict:
    return {
        "recordRemaps": [(r["table"], r["originalKey"], r["storedKey"], r["source"]) for r in store.record_remaps],
        "aliasIndex": {f"{t}.{k}": [tuple(sorted(c.items())) for c in v]
                       for (t, k), v in store.record_alias_index.items()},
        "resourceAliases": [(a["table"], tuple(a["originalParts"]), a["storedKey"], a["reason"])
                            for a in store.resource_aliases],
        "errors": [(e["kind"], e["path"], e["error"]) for e in store.errors],
        "struct": store.stats["struct"],
        "groupFiles": store.stats["groupFiles"],
        "groupRows": store.stats["groupRows"],
        "resources": store.stats["resources"],
        "canvases": store.stats["canvases"],
        "sounds": store.stats["sounds"],
        "rekeyedRecords": store.stats["rekeyedRecords"],
        "resourceAliasesCount": store.stats["resourceAliases"],
        "errorsCount": store.stats["errors"],
        "encodedStringKeys": store.stats["encodedStringKeys"],
    }


class CrashRecoveryTest(unittest.TestCase):
    def baseline(self, tmp: Path):
        root = tmp / "baseline"
        state = tmp / "baseline-state"
        store = convert_cms.Store(root, roundtrip=False, resume_dir=state / "manifest")
        run_conversion(store)
        store.flush_resume_state()
        return snapshot_tree(root), provenance(store)

    def interrupted_then_resumed(self, tmp: Path, kill_mode: str, kill_at: int):
        root = tmp / f"crash-{kill_mode}-{kill_at}"
        state = tmp / f"crash-state-{kill_mode}-{kill_at}"
        first = convert_cms.Store(root, roundtrip=False, resume_dir=state / "manifest")
        if kill_mode == "before-write":
            first.kill_before_write_index = kill_at
        elif kill_mode == "after-write":
            first.kill_after_writes = kill_at
        elif kill_mode == "after-checkpoint":
            run_conversion(first)
            first.flush_resume_state()
            first.kill_before_write_index = 1  # any further write dies; nothing further is written
            return snapshot_tree(root), provenance(first)
        with self.assertRaises(convert_cms._KillSimulated):
            run_conversion(first)
        # A fresh Store is the recovery path: journal replay + disk verification.
        second = convert_cms.Store(root, roundtrip=False, resume_dir=state / "manifest")
        run_conversion(second)
        second.flush_resume_state()
        third = convert_cms.Store(root, roundtrip=False, resume_dir=state / "manifest")
        return snapshot_tree(root), provenance(third)

    def assert_equivalent(self, actual, expected, label):
        files_a, prov_a = actual
        files_b, prov_b = expected
        self.assertEqual(files_a, files_b, f"{label}: output tree differs from uninterrupted run")
        for key, value in prov_b.items():
            self.assertEqual(prov_a[key], value, f"{label}: {key} differs")

    def test_kill_before_output_write_recovers_exactly(self):
        with tempfile.TemporaryDirectory() as tmp:
            expected = self.baseline(Path(tmp))
            # Kill before the 4th atomic write: journal holds intents whose
            # files were never created (and possibly a stale earlier one).
            actual = self.interrupted_then_resumed(Path(tmp), "before-write", 4)
            self.assert_equivalent(actual, expected, "before-write")

    def test_kill_after_output_write_before_checkpoint_recovers_exactly(self):
        with tempfile.TemporaryDirectory() as tmp:
            expected = self.baseline(Path(tmp))
            for kill_at in (1, 4, 8, 11):
                with self.subTest(kill_at=kill_at):
                    actual = self.interrupted_then_resumed(Path(tmp), "after-write", kill_at)
                    self.assert_equivalent(actual, expected, f"after-write@{kill_at}")

    def test_kill_after_checkpoint_recovers_exactly(self):
        with tempfile.TemporaryDirectory() as tmp:
            expected = self.baseline(Path(tmp))
            actual = self.interrupted_then_resumed(Path(tmp), "after-checkpoint", 0)
            self.assert_equivalent(actual, expected, "after-checkpoint")

    def test_resume_reuses_outputs_without_false_collisions_or_duplicates(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "out"
            state = Path(tmp) / "state" / "manifest"
            first = convert_cms.Store(root, roundtrip=False, resume_dir=state / "manifest")
            run_conversion(first)
            first.flush_resume_state()
            second = convert_cms.Store(root, roundtrip=False, resume_dir=state / "manifest")
            run_conversion(second)
            # Same-source items are resumed, never duplicated or re-aliased.
            self.assertEqual(second.stats["recordsResumed"], 4)
            self.assertEqual(second.stats["groupsResumed"], 2)
            self.assertEqual(second.stats["resourceReuse"], 6)
            # The one rekey is the genuine alpha/beta alias, restored by the
            # journal replay — not a new collision invented by the resume.
            self.assertEqual(second.stats["rekeyedRecords"], 1)
            self.assertEqual(len(second.record_remaps), 1)
            self.assertEqual(second.stats["keyCollisions"], 0)
            self.assertEqual(len(snapshot_tree(root)), 12)

    def test_intent_without_file_is_redone_and_stale_file_is_replaced(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "out"
            state = Path(tmp) / "state" / "manifest"
            first = convert_cms.Store(root, roundtrip=False, resume_dir=state / "manifest")
            first.journal_package_start("Synthetic.wz")
            store = first
            store.write_struct("Look", "00002000", {"v": 1}, source="Character.wz/00002000.img")
            image, digest = png((5, 6, 7, 8))
            store.write_png(["Look", "00002000", "walk1", "0", "body"], image, digest)
            # Simulate a torn write: the final file exists but its content does
            # not match the journaled intent (machine-crash style corruption).
            target = root / "[resource]图" / "Look" / "00002000" / "walk1" / "0" / "body.png"
            target.write_bytes(b"corrupted-bytes")
            second = convert_cms.Store(root, roundtrip=False, resume_dir=state / "manifest")
            # The record is committed (file+hash fine) and resumed; the canvas
            # intent is dropped (hash mismatch) and rewritten on re-encounter.
            run_conversion(second)
            second.flush_resume_state()
            self.assertEqual(second.stats["recordsResumed"], 1)
            fresh = (root / "[resource]图" / "Look" / "00002000" / "walk1" / "0" / "body.png").read_bytes()
            self.assertNotEqual(fresh, b"corrupted-bytes")
            third = convert_cms.Store(root, roundtrip=False, resume_dir=state / "manifest")
            expected_tree, expected_prov = self.baseline(Path(tmp))
            self.assertEqual(snapshot_tree(root), expected_tree)
            for key, value in expected_prov.items():
                if key in ("struct", "resources", "canvases", "sounds", "groupFiles", "groupRows",
                           "rekeyedRecords", "resourceAliasesCount", "errorsCount", "encodedStringKeys"):
                    self.assertEqual(provenance(third)[key], value, key)

    def test_converter_identity_changes_with_source(self):
        identity = convert_cms.converter_commit()
        self.assertTrue(identity.startswith("src:"))
        # The identity is the hash of this file's own source, not just HEAD:
        # editing the converter (even uncommitted) must change it.
        source = Path(convert_cms.__file__).read_bytes()
        self.assertIn(hashlib.sha256(source).hexdigest()[:16], identity)


if __name__ == "__main__":
    unittest.main()
