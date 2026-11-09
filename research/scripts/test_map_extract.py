"""Integrity checks for the Map.wz metadata extract.

The bulk JSONL is produced by research/scripts/map_wz_extract.py into
.work/map-reverse. These checks fail if that output is missing.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / ".work" / "map-reverse"
ARCHIVE_SHA = "9e0d2a0fcecac2c99ee3cb15b03c41b5617d7d0637b55fb132f0eeed27155f69"


def load_matching(path: Path, predicate, limit: int = 1):
    found = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            if predicate(record):
                found.append(record)
                if len(found) >= limit:
                    break
    return found


class MapExtractIntegrityTest(unittest.TestCase):
    def test_summary_matches_known_archive(self):
        summary = json.loads((OUT / "extract-summary.json").read_text(encoding="utf-8"))
        self.assertEqual(summary["archiveSha256"], ARCHIVE_SHA)
        self.assertEqual(summary["version"], 79)
        self.assertEqual(summary["region"], "EMS")
        self.assertEqual(summary["imagesExtracted"], 4614)
        self.assertEqual(summary["parseFailures"], [])
        self.assertEqual(summary["counts"]["Back:canvas"], 4402)
        self.assertEqual(summary["counts"]["Tile:canvas"], 2348)
        self.assertEqual(summary["counts"]["Obj:canvas"], 22293)
        self.assertEqual(summary["counts"]["MapHelper:canvas"], 818)
        self.assertEqual(summary["uolStatus"], {"resolved": 898})

    def test_back_canvas_keeps_origin_and_absent_delay(self):
        record = load_matching(
            OUT / "back.jsonl",
            lambda item: item["image"] == "Back/grassySoil.img"
            and item["recordType"] == "canvas"
            and item["nodePath"] == "back/0",
        )[0]
        self.assertEqual(record["canvas"]["width"], 256)
        self.assertEqual(record["canvas"]["height"], 256)
        self.assertEqual(record["canvas"]["origin"], {"x": 128, "y": 128})
        self.assertTrue(record["canvas"]["originPresent"])
        self.assertEqual(record["canvas"]["z"], 0)
        self.assertTrue(record["canvas"]["zPresent"])
        self.assertEqual([child["name"] for child in record["raw"]], ["origin", "z"])
        self.assertNotIn("delay", record["canvas"]["named"])
        self.assertEqual(record["provenance"]["archiveSha256"], ARCHIVE_SHA)

    def test_animation_frames_stay_separate(self):
        group = load_matching(
            OUT / "back.jsonl",
            lambda item: item["image"] == "Back/grassySoil.img"
            and item["recordType"] == "group"
            and item["nodePath"] == "ani/0",
        )[0]
        self.assertEqual([child["name"] for child in group["childOrder"]], [str(i) for i in range(10)])
        frame = load_matching(
            OUT / "back.jsonl",
            lambda item: item["image"] == "Back/grassySoil.img" and item["nodePath"] == "ani/0/0",
        )[0]
        self.assertEqual(frame["canvas"]["origin"], {"x": 100, "y": 529})
        self.assertNotIn("delay", frame["canvas"]["named"])

    def test_missing_tile_z_is_not_zero(self):
        record = load_matching(
            OUT / "tile.jsonl",
            lambda item: item["image"] == "Tile/greenCrystalCave.img" and item["nodePath"] == "bsc/0",
        )[0]
        self.assertFalse(record["canvas"]["zPresent"])
        self.assertIsNone(record["canvas"]["z"])
        self.assertEqual([child["name"] for child in record["raw"]], ["origin"])

    def test_tile_canvas_z_can_be_negative(self):
        record = load_matching(
            OUT / "tile.jsonl",
            lambda item: item["image"] == "Tile/woodMarble.img" and item["nodePath"] == "enH0/0",
        )[0]
        self.assertEqual(record["canvas"]["z"], -3)
        self.assertEqual(record["canvas"]["origin"], {"x": 0, "y": 33})
        self.assertIn("foothold", [child["name"] for child in record["raw"]])

    def test_maphelper_portal_game_is_separate_from_editor(self):
        record = load_matching(
            OUT / "map-helper.jsonl",
            lambda item: item["recordType"] == "canvas" and item["nodePath"] == "portal/game/pv/0",
        )[0]
        self.assertEqual(record["canvas"]["origin"], {"x": 43, "y": 173})
        self.assertFalse(record["canvas"]["zPresent"])
        self.assertIsNone(record["canvas"]["z"])
        self.assertNotIn("delay", record["canvas"]["named"])

    def test_uol_resolution_is_recorded(self):
        found = None
        with (OUT / "obj.jsonl").open(encoding="utf-8") as handle:
            for line in handle:
                record = json.loads(line)
                if record["recordType"] != "bag":
                    continue
                for child in record["raw"]:
                    if child.get("type") == "UOL" and child["value"] == "2":
                        found = child
                        break
                if found:
                    break
        self.assertIsNotNone(found)
        self.assertEqual(found["resolution"]["status"], "resolved")
        self.assertTrue(found["resolution"]["resolvedPath"])

    def test_henesys_tile_order_is_wz_order(self):
        summary = json.loads((OUT / "maps" / "classify-summary.json").read_text(encoding="utf-8"))
        self.assertEqual(
            summary["tileFirst"]["100000000/0/tile"][:4],
            ["35", "34", "2", "0"],
        )


if __name__ == "__main__":
    unittest.main()
