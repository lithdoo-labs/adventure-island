"""Resource name rules. Fixtures are constructed strings, not client files."""
from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
import unicodedata
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "wz_fsdb"))

import convert_cms  # noqa: E402


class ResourceNameTest(unittest.TestCase):
    def test_rejects_whitespace_device_names_and_separators(self):
        cases = {
            "backDefault ": "trailing_whitespace",
            " rise": "leading_whitespace",
            "CON": "reserved_device_name",
            "Con.2000000": "reserved_device_name",
            "a:b": "illegal_character",
            ".": "leading_dot",
            ":": "illegal_character",
        }
        for value, reason in cases.items():
            self.assertFalse(convert_cms.valid_segment(value), value)
            self.assertEqual(convert_cms.segment_issue(value), reason)

    def test_nfc_conflict_is_not_silently_renamed(self):
        composed = "caf\u00e9"
        decomposed = "cafe\u0301"
        self.assertEqual(unicodedata.normalize("NFC", decomposed), composed)
        self.assertTrue(convert_cms.valid_segment(composed))
        self.assertEqual(convert_cms.segment_issue(decomposed), "not_nfc")
        with tempfile.TemporaryDirectory() as tmp:
            store = convert_cms.Store(Path(tmp), roundtrip=False)
            self.assertTrue(store.write_struct("Fixture", composed, {"n": 1}))
            self.assertFalse(store.write_struct("Fixture", decomposed, {"n": 2}))
            names = [path.name for path in (Path(tmp) / "[struct]Fixture").iterdir()]
            self.assertEqual(names, [composed + ".json"])

    def test_invalid_resource_is_encoded_without_trim_and_provenance_kept(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = convert_cms.Store(Path(tmp), roundtrip=False)
            image = Image.new("RGBA", (1, 1), (1, 2, 3, 4))
            digest = hashlib.sha256(image.tobytes()).hexdigest()
            key = store.write_png(["Fixture", "frame "], image, digest)
            self.assertIsNotNone(key)
            self.assertNotEqual(key, "Fixture/frame")
            self.assertTrue(all(convert_cms.valid_segment(p) for p in key.split("/")))
            self.assertEqual(len(list(Path(tmp).rglob("*.png"))), 1)
            self.assertEqual(store.resource_aliases[0]["originalParts"], ["Fixture", "frame "])

    def test_image_and_audio_use_separate_namespaces(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = convert_cms.Store(Path(tmp), roundtrip=False)
            image = Image.new("RGBA", (1, 1), (9, 8, 7, 6))
            digest = hashlib.sha256(image.tobytes()).hexdigest()
            self.assertEqual(store.write_png(["Fixture", "mark"], image, digest), "Fixture/mark")
            self.assertEqual(store.write_sound(["Fixture", "mark"], b"synthetic-tone", "wav"), "Fixture/mark")
            self.assertEqual(store.errors, [])
            self.assertEqual({path.suffix for path in Path(tmp).rglob("mark.*")}, {".png", ".wav"})
            self.assertTrue((Path(tmp) / "[resource]图").exists())
            self.assertTrue((Path(tmp) / "[resource]音").exists())

    def test_repair_extension_conflict_has_its_own_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = convert_cms.Store(Path(tmp), roundtrip=False)
            image = Image.new("RGBA", (1, 1), (9, 8, 7, 6))
            digest = hashlib.sha256(image.tobytes()).hexdigest()
            self.assertEqual(store.write_sound(["Fixture", "mark"], b"synthetic-tone", "wav"), "Fixture/mark")
            alternate = store.write_sound(["Fixture", "mark"], b"different-synthetic-tone", "mp3")
            self.assertNotEqual(alternate, "Fixture/mark")
            self.assertIn("extension-conflict", [row["error"] for row in store.errors])
            self.assertEqual(len(list((Path(tmp) / "[resource]音").rglob("mark*"))), 2)

    def test_logged_invalid_paths_are_sixty_five_unresolved_names(self):
        payload = json.loads((ROOT / "result" / "64-wz-fsdb-invalid-paths.json").read_text(encoding="utf-8"))
        rows = payload["paths"]
        self.assertEqual(len(rows), 65)
        self.assertEqual(payload["count"], 65)
        for row in rows:
            self.assertIsNone(row["proposed_key"])
            self.assertEqual(row["status"], "unresolved")
            self.assertTrue(row["bad_segments"])
            self.assertEqual(convert_cms.segment_issue(row["bad_segments"][0]), row["reason"])
            for part in row["source_path"].split("/"):
                if convert_cms.segment_issue(part):
                    break
            else:
                self.fail(row["source_path"])

    def test_invalid_path_manifest_has_lossless_legal_mappings(self):
        payload = json.loads((ROOT / "result" / "64-wz-fsdb-invalid-paths.json").read_text(encoding="utf-8"))
        source_to_key = {}
        for entry in payload["paths"]:
            original = entry["source_path"]
            safe = "/".join(convert_cms.fsdb_resource_segment(p) for p in original.split("/"))
            self.assertTrue(all(convert_cms.valid_segment(p) for p in safe.split("/")))
            self.assertNotEqual(original, safe)
            source_to_key[original] = safe
        self.assertEqual(len(source_to_key), 65)
        self.assertEqual(len(set(source_to_key.values())), 65)

    def test_casefold_directory_collision_gets_distinct_physical_names(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = convert_cms.Store(Path(tmp), roundtrip=False)
            image = Image.new("RGBA", (1, 1), (4, 5, 6, 7))
            digest = hashlib.sha256(image.tobytes()).hexdigest()
            first = store.write_png(["Effect", "DragonTiger", "0"], image, digest)
            second = store.write_png(["Effect", "dragonTiger", "0"], image, digest)
            self.assertNotEqual(first.casefold(), second.casefold())
            self.assertEqual(len(list(Path(tmp).rglob("*.png"))), 2)


if __name__ == "__main__":
    unittest.main()
