"""UOL resolution against hand-built nodes."""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "wz_fsdb"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import convert_cms  # noqa: E402
from synthetic_fixtures import Node, chain, link  # noqa: E402


class UolResolutionTest(unittest.TestCase):
    def test_relative_sibling_and_multilevel_paths(self):
        root = Node("root")
        walk = root.add(Node("walk"))
        frame0 = walk.add(Node("0"))
        frame0.add(Node("body"))
        frame1 = walk.add(Node("1"))
        sibling = link(frame1, "body", "../0/body")
        target, status = convert_cms.resolve_uol(sibling)
        self.assertEqual(status, "ok")
        self.assertIs(target, frame0.child("body"))

        stand = root.add(Node("stand"))
        stand_frame = stand.add(Node("2"))
        upward = link(stand_frame, "body", "../../walk/0/body")
        target, status = convert_cms.resolve_uol(upward)
        self.assertEqual(status, "ok")
        self.assertIs(target, frame0.child("body"))

    def test_dangling_reference(self):
        root = Node("root")
        frame = root.add(Node("0"))
        missing = link(frame, "body", "../missing/body")
        target, status = convert_cms.resolve_uol(missing)
        self.assertIsNone(target)
        self.assertEqual(status, "dangling")

    def test_cycle(self):
        root = Node("root")
        frame0 = root.add(Node("0"))
        frame1 = root.add(Node("1"))
        first = link(frame0, "body", "../1/body")
        link(frame1, "body", "../0/body")
        target, status = convert_cms.resolve_uol(first)
        self.assertIsNone(target)
        self.assertEqual(status, "cycle")

    def test_fifteen_hops_still_resolve(self):
        target, status = convert_cms.resolve_uol(chain(15))
        self.assertEqual(status, "ok")
        self.assertIsNotNone(target)
        self.assertFalse(convert_cms.is_uol(target))

    def test_repair_sixteenth_hop_is_not_labeled_cycle(self):
        target, status = convert_cms.resolve_uol(chain(16))
        self.assertEqual(status, "ok")
        self.assertIsNotNone(target)
        self.assertFalse(convert_cms.is_uol(target))

    def test_repair_unresolved_uol_keeps_the_link_text(self):
        record = convert_cms.uol_failure_record("dangling", "../missing/body")
        self.assertEqual(record["value"], "../missing/body")
        self.assertFalse(record["resolved"])

    def test_logged_uol_diagnostics_separate_unknown_from_missing(self):
        payload = json.loads((ROOT / "result" / "64-wz-fsdb-uol-diagnostics.json").read_text(encoding="utf-8"))
        unique = payload["unique_nodes"]
        self.assertEqual(unique["cycle"], 1)
        self.assertGreater(unique["dangling"], 0)
        classes = payload["classification"]
        self.assertIn("target_missing", classes)
        self.assertIn("path_resolution", classes)
        self.assertIn("cycle", classes)
        self.assertIn("unknown", classes)
        self.assertGreaterEqual(len(payload["samples"]), 30)
        self.assertLessEqual(len(payload["samples"]), 50)
        self.assertEqual(payload["converter_log"]["uol_dangling"], 1948)
        self.assertEqual(payload["converter_log"]["uol_cycle"], 1)
        text = json.dumps(payload)
        self.assertNotIn("Users\\", text)
        self.assertNotIn(":\\", text)


if __name__ == "__main__":
    unittest.main()
