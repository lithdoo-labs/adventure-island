"""Cross-batch resume safety for the ``all`` scope.

A real 16-package conversion cannot finish in one Issue-Agent round. These
tests prove the guarantees the batch driver relies on when a new process
continues an interrupted run: at-most-once writes, cross-batch conflict
detection through persisted manifests, alias-table continuation, and refusal
after a converter change.
"""
from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "wz_fsdb"))

import convert_cms  # noqa: E402


def png_bytes(color=(1, 2, 3, 4)):
    image = Image.new("RGBA", (2, 2), color)
    return image, hashlib.sha256(image.tobytes()).hexdigest()


class BatchResumeTest(unittest.TestCase):
    def test_records_are_written_once_across_batches(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "out"
            state = Path(tmp) / "state" / "manifest"
            first = convert_cms.Store(root, roundtrip=False, resume_dir=state)
            first.write_struct("Look", "00002000", {"v": 1}, source="Character.wz/00002000.img")
            first.flush_resume_state()
            second = convert_cms.Store(root, roundtrip=False, resume_dir=state)
            second.write_struct("Look", "00002000", {"v": 1}, source="Character.wz/00002000.img")
            self.assertEqual(second.stats["recordsResumed"], 1)
            self.assertEqual(len(list((root / "[struct]Look").glob("*.json"))), 1)

    def test_same_key_new_source_still_aliases_across_batches(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "out"
            state = Path(tmp) / "state" / "manifest"
            first = convert_cms.Store(root, roundtrip=False, resume_dir=state)
            first.write_struct("Look", "00000001", {"source": "alpha"}, source="Character.wz/Weapon/1.img")
            first.flush_resume_state()
            second = convert_cms.Store(root, roundtrip=False, resume_dir=state)
            second.write_struct("Look", "00000001", {"source": "beta"}, source="Character.wz/Cap/2.img")
            second.flush_resume_state()
            files = list((root / "[struct]Look").glob("*.json"))
            self.assertEqual(len(files), 2)
            bodies = {json.loads(f.read_text(encoding="utf-8"))["source"] for f in files}
            self.assertEqual(bodies, {"alpha", "beta"})
            self.assertEqual(second.stats["keyCollisions"], 0)
            self.assertEqual(len(second.record_alias_index), 1)

    def test_groups_are_skipped_not_duplicated_across_batches(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "out"
            state = Path(tmp) / "state" / "manifest"
            first = convert_cms.Store(root, roundtrip=False, resume_dir=state)
            first.write_group("Tile", "100000000", [{"x": 1}])
            first.flush_resume_state()
            second = convert_cms.Store(root, roundtrip=False, resume_dir=state)
            second.write_group("Tile", "100000000", [{"x": 1}])
            self.assertEqual(second.stats["groupsResumed"], 1)
            self.assertEqual(len(list((root / "[group]Tile").glob("*.jsonl"))), 1)

    def test_resource_reuse_and_conflicts_span_batches(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "out"
            state = Path(tmp) / "state" / "manifest"
            first = convert_cms.Store(root, roundtrip=False, resume_dir=state)
            first.write_sound(["Sound", "Bgm00", "FloralLife"], b"synthetic-tone", "mp3")
            image, digest = png_bytes((9, 8, 7, 6))
            first.write_png(["Look", "00002000", "walk1", "0", "body"], image, digest)
            first.flush_resume_state()

            second = convert_cms.Store(root, roundtrip=False, resume_dir=state)
            reused = second.write_sound(["Sound", "Bgm00", "FloralLife"], b"synthetic-tone", "mp3")
            self.assertEqual(reused, "Sound/Bgm00/FloralLife")
            self.assertEqual(second.stats["resourceReuse"], 1)
            conflict = second.write_sound(["Sound", "Bgm00", "FloralLife"], b"other-tone", "mp3")
            self.assertNotEqual(conflict, "Sound/Bgm00/FloralLife")
            self.assertIn("resource-key-conflict", [row["error"] for row in second.errors])
            self.assertEqual(len(list((root / "[resource]音").rglob("FloralLife*"))), 2)

            image_again, _ = png_bytes((9, 8, 7, 6))
            self.assertEqual(
                second.write_png(["Look", "00002000", "walk1", "0", "body"], image_again, digest),
                "Look/00002000/walk1/0/body",
            )
            self.assertEqual(len(list((root / "[resource]图").rglob("*.png"))), 1)

    def test_aliased_payload_keeps_its_alias_across_batches(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "out"
            state = Path(tmp) / "state" / "manifest"
            first = convert_cms.Store(root, roundtrip=False, resume_dir=state)
            first.write_sound(["Fixture", "mark"], b"synthetic-tone", "wav")
            aliased = first.write_sound(["Fixture", "mark"], b"different-tone", "wav")
            first.flush_resume_state()
            second = convert_cms.Store(root, roundtrip=False, resume_dir=state)
            again = second.write_sound(["Fixture", "mark"], b"different-tone", "wav")
            self.assertEqual(again, aliased)
            self.assertEqual(len(list((root / "[resource]音").rglob("mark*"))), 2)

    def test_resource_directory_folds_survive_batch_boundaries(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "out"
            state = Path(tmp) / "state" / "manifest"
            image, digest = png_bytes((4, 5, 6, 7))
            first = convert_cms.Store(root, roundtrip=False, resume_dir=state)
            first.write_png(["Effect", "DragonTiger", "0"], image, digest)
            first.flush_resume_state()
            second = convert_cms.Store(root, roundtrip=False, resume_dir=state)
            key = second.write_png(["Effect", "dragonTiger", "0"], image, digest)
            self.assertNotIn("DragonTiger", key)
            self.assertEqual(len(list((root / "[resource]图").rglob("*.png"))), 2)

    def test_alias_table_persists_and_finalizes_across_batches(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "out"
            state = Path(tmp) / "state" / "manifest"
            first = convert_cms.Store(root, roundtrip=False, resume_dir=state)
            first.write_struct("Item", "01000000", {"source": "alpha"}, source="Item.wz/Cash/0.img")
            first.write_struct("Item", "01000000", {"source": "beta"}, source="Item.wz/Special/0.img")
            first.flush_resume_state()

            second = convert_cms.Store(root, roundtrip=False, resume_dir=state)
            self.assertEqual(len(second.record_alias_index), 1)
            convert_cms.write_record_alias_table(second)
            second.flush_resume_state()
            aliases = list((root / "[struct]WzRecordAlias").glob("*.json"))
            self.assertEqual(len(aliases), 1)

            third = convert_cms.Store(root, roundtrip=False, resume_dir=state)
            convert_cms.write_record_alias_table(third)
            third.flush_resume_state()
            self.assertEqual(len(list((root / "[struct]WzRecordAlias").glob("*.json"))), 1)

    def test_stats_accumulate_across_batches(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "out"
            state = Path(tmp) / "state" / "manifest"
            first = convert_cms.Store(root, roundtrip=False, resume_dir=state)
            first.bump_stat("canvases", 7)
            first.bump_stat("uol_dangling", 2)
            first.flush_resume_state()
            second = convert_cms.Store(root, roundtrip=False, resume_dir=state)
            self.assertEqual(second.stats["canvases"], 7)
            self.assertEqual(second.stats["uol_dangling"], 2)

    def test_batch_state_round_trip(self):
        with tempfile.TemporaryDirectory() as tmp:
            batch_dir = Path(tmp) / "batch"
            convert_cms.write_batch_state(batch_dir, "Base.wz", {
                "package": "Base.wz", "inputSha256": "a" * 64, "converterCommit": "b" * 40,
                "status": "complete", "outputSummary": {"struct.ZMap": 1},
            })
            states = convert_cms.load_batch_states(batch_dir)
            self.assertIn("Base.wz", states)
            self.assertEqual(states["Base.wz"]["status"], "complete")

    def test_all_plan_covers_exactly_the_sixteen_data_packages(self):
        packages = [name for name, _ in convert_cms.all_plan()]
        self.assertEqual(sorted(packages), sorted(convert_cms.DATA_PACKAGES))
        self.assertEqual(len(packages), 16)


if __name__ == "__main__":
    unittest.main()
