"""Minimal synthetic FSDB metadata. No client resources."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "wz_fsdb"))

import convert_cms  # noqa: E402


class FsdbLayoutTest(unittest.TestCase):
    def test_struct_group_and_resource_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            store = convert_cms.Store(root, roundtrip=False)
            self.assertTrue(store.write_struct("Map", "100000000", {"info": {}, "layers": []}))
            store.write_group("Back", "100000000", [{"bS": "grassySoil", "no": 0, "x": 1, "y": 2}])
            store.table("resource", convert_cms.CANVAS_RESOURCE_TABLE)
            store.table("resource", convert_cms.SOUND_RESOURCE_TABLE)
            convert_cms.emit_metadata(store)

            struct_file = root / "[struct]Map" / "100000000.json"
            struct_text = struct_file.read_bytes()
            self.assertFalse(struct_text.startswith(b"\xef\xbb\xbf"))
            self.assertEqual(json.loads(struct_text.decode("utf-8"))["layers"], [])
            schema = json.loads((root / "[struct]Map" / ".info.meta").read_text(encoding="utf-8"))
            self.assertEqual(schema["type"], "object")
            self.assertTrue((root / "[struct]Map" / ".desc.meta").read_text(encoding="utf-8").strip())

            group_text = (root / "[group]Back" / "100000000.jsonl").read_text(encoding="utf-8")
            rows = [json.loads(line) for line in group_text.splitlines()]
            self.assertEqual(rows, [{"bS": "grassySoil", "no": 0, "x": 1, "y": 2}])
            # Empty bS is valid source data, not an unconditional foreign key.
            self.assertFalse((root / "[group]Back" / ".extend.meta").exists())
            self.assertTrue((root / "[group]Back" / ".info.meta").is_file())
            self.assertTrue((root / "[group]Back" / ".desc.meta").is_file())
            self.assertTrue((root / f"[resource]{convert_cms.CANVAS_RESOURCE_TABLE}" / ".desc.meta").is_file())

    def test_import_does_not_load_wz_reader(self):
        self.assertIsNone(convert_cms.WzFile)
        self.assertIsNone(convert_cms.decode_canvas)

    def test_audio_and_image_table_are_distinct(self):
        self.assertNotEqual(convert_cms.SOUND_RESOURCE_TABLE, convert_cms.CANVAS_RESOURCE_TABLE)

    def test_repair_sound_table_follows_design(self):
        self.assertEqual(convert_cms.SOUND_RESOURCE_TABLE, convert_cms.DESIGN_SOUND_RESOURCE_TABLE)


if __name__ == "__main__":
    unittest.main()
