"""Key mapping behavior and record alias preservation.

The historical PR #1 full-run evidence (11 collisions across Look/Item/
MapEffect) lives on that branch only; these tests rebuild the same shapes
synthetically so main keeps the repaired behavior without the report files.
"""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "wz_fsdb"))

import convert_cms  # noqa: E402


def historical_collision_shapes():
    """The 11 recorded collision shapes: 5 Look, 2 Item, 4 MapEffect."""
    shapes = []
    for index in range(5):
        shapes.append(("Look", "0000%04d" % index, [
            "Character.wz/%s/%d.img" % ("Coat" if index % 2 else "Weapon", 1000 + index),
            "Character.wz/%s/%d.img" % ("Cap" if index % 2 else "Cape", 2000 + index),
        ]))
    for index in range(2):
        shapes.append(("Item", "0%d00000" % index, [
            "Item.wz/Cash/%d.img" % index,
            "Item.wz/Special/%d.img" % index,
        ]))
    for index in range(4):
        shapes.append(("MapEffect", "quest%d" % index, [
            "Map.wz/Effect.img/%d" % index,
            "Map.wz/Effect.img/aran%d" % index,
        ]))
    return shapes


class KeyMappingTest(unittest.TestCase):
    def test_duplicate_key_is_disambiguated_and_preserves_both(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = convert_cms.Store(Path(tmp), roundtrip=False)
            self.assertTrue(store.write_struct("Look", "00000001", {"source": "alpha"}))
            self.assertTrue(store.write_struct("Look", "00000001", {"source": "beta"}))
            self.assertEqual(store.collisions, [])
            bodies = [json.loads(p.read_text(encoding="utf-8")) for p in (Path(tmp) / "[struct]Look").glob("*.json")]
            self.assertEqual({v["source"] for v in bodies}, {"alpha", "beta"})
            self.assertEqual(len(store.record_remaps), 1)

    def test_repair_duplicate_key_preserves_both_sources(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = convert_cms.Store(Path(tmp), roundtrip=False)
            store.write_struct("Look", "00000001", {"source": "alpha"})
            store.write_struct("Look", "00000001", {"source": "beta"})
            folder = Path(tmp) / "[struct]Look"
            bodies = [json.loads(path.read_text(encoding="utf-8")) for path in folder.glob("*.json")]
            sources = {body.get("source") for body in bodies}
            self.assertEqual(sources, {"alpha", "beta"})
            self.assertEqual(store.stats["keyCollisions"], 0)

    def test_casefold_duplicate_is_disambiguated(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = convert_cms.Store(Path(tmp), roundtrip=False)
            self.assertTrue(store.write_struct("Fixture", "dragonTiger", {"n": 1}))
            self.assertTrue(store.write_struct("Fixture", "DragonTiger", {"n": 2}))
            files = sorted(path.name for path in (Path(tmp) / "[struct]Fixture").glob("*.json"))
            self.assertEqual(len(files), 2)
            self.assertNotEqual(files[0].casefold(), files[1].casefold())
            self.assertEqual(store.stats["keyCollisions"], 0)

    def test_alias_table_keeps_original_key_and_every_candidate_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = convert_cms.Store(Path(tmp), roundtrip=False)
            store.write_struct("Look", "00000001", {"source": "alpha"}, source="Character.wz/Weapon/1.img")
            store.write_struct("Look", "00000001", {"source": "beta"}, source="Character.wz/Cap/2.img")
            convert_cms.write_record_alias_table(store)
            aliases = list((Path(tmp) / "[struct]WzRecordAlias").glob("*.json"))
            self.assertEqual(len(aliases), 1)
            payload = json.loads(aliases[0].read_text(encoding="utf-8"))
            self.assertEqual(payload["table"], "Look")
            self.assertEqual(payload["originalKey"], "00000001")
            self.assertEqual(
                sorted(candidate["source"] for candidate in payload["candidates"]),
                ["Character.wz/Cap/2.img", "Character.wz/Weapon/1.img"],
            )
            stored_keys = {candidate["key"] for candidate in payload["candidates"]}
            self.assertEqual(len(stored_keys), 2)

    def test_device_name_string_key_preserves_full_path(self):
        key, reason = convert_cms.string_record_key(("Con", "2000000"), set())
        self.assertEqual(reason, "encoded-path")
        self.assertTrue(convert_cms.valid_segment(key))
        self.assertNotEqual(key, "2000000")
        self.assertEqual(convert_cms.fsdb_resource_segment("Con.2000000"), key)

    def test_current_string_key_keeps_a_dotted_trail(self):
        key, reason = convert_cms.string_record_key(("Eqp", "Cap", "1003233"), set())
        self.assertEqual((key, reason), ("Eqp.Cap.1003233", "ok"))

    def test_duplicate_trail_gets_stable_disambiguation(self):
        seen = set()
        first, _ = convert_cms.string_record_key(("Eqp", "Cap", "1003233"), seen)
        seen.add(first)
        second, reason = convert_cms.string_record_key(("Eqp", "Cap", "1003233"), seen)
        self.assertEqual(reason, "duplicate-trail-disambiguated")
        self.assertNotEqual(first, second)
        self.assertTrue(convert_cms.valid_segment(second))

    def test_repair_quest_tables_follow_design(self):
        expected = {
            "Act": "QuestAct",
            "Check": "QuestCheck",
            "QuestInfo": "QuestQuestInfo",
            "Say": "QuestSay",
            "Exclusive": "QuestExclusive",
            "PQuest": "QuestPQuest",
        }
        for stem, table in expected.items():
            self.assertEqual(convert_cms.quest_table(stem), table)

    def test_all_eleven_historical_collision_shapes_preserve_every_source(self):
        shapes = historical_collision_shapes()
        self.assertEqual(len(shapes), 11)
        with tempfile.TemporaryDirectory() as tmp:
            store = convert_cms.Store(Path(tmp), roundtrip=False)
            for table, key, sources in shapes:
                for source in sources:
                    self.assertTrue(store.write_struct(table, key, {"source": source}, source=source))
            expected = sum(len(sources) for _, _, sources in shapes)
            got = sum(1 for table in {"Look", "Item", "MapEffect"} for _ in
                      (Path(tmp) / f"[struct]{table}").glob("*.json"))
            self.assertEqual(got, expected)
            self.assertEqual(store.stats["keyCollisions"], 0)
            self.assertEqual(len(store.record_remaps), expected - len(shapes))
            convert_cms.write_record_alias_table(store)
            self.assertEqual(len(list((Path(tmp) / "[struct]WzRecordAlias").glob("*.json"))), len(shapes))


if __name__ == "__main__":
    unittest.main()
