"""Back export order is the WZ child name, not the property list."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "wz_fsdb"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import convert_cms  # noqa: E402
from synthetic_fixtures import Node  # noqa: E402


def back_named(*names: str) -> Node:
    node = Node("back")
    for name in names:
        node.add(Node(name))
    return node


class BackOrderTest(unittest.TestCase):
    def test_name_order_wins_over_property_list_order(self):
        ordered = convert_cms.client_back_children(back_named("0", "1", "3", "4", "2"), "222020100")
        self.assertEqual([child.name for child in ordered], ["0", "1", "2", "3", "4"])

    def test_empty_back_stays_empty(self):
        self.assertEqual(convert_cms.client_back_children(Node("back")), [])

    def test_gaps_do_not_fall_back_to_property_list_order(self):
        with self.assertRaisesRegex(ValueError, "property-list order is not the depth index"):
            convert_cms.client_back_children(back_named("0", "2"), "222020100")

    def test_padding_and_non_numeric_names_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "canonical decimal"):
            convert_cms.client_back_children(back_named("0", "01"))
        with self.assertRaisesRegex(ValueError, "canonical decimal"):
            convert_cms.client_back_children(back_named("0", "cloud"))

    def test_convert_map_writes_the_name_order(self):
        names = (
            "WzUolProperty", "WzCanvasProperty", "WzSoundProperty", "WzSubProperty",
            "WzNullProperty", "WzVectorProperty", "WzConvexProperty",
        )
        saved = {name: getattr(convert_cms, name) for name in names}
        for name in names:
            setattr(convert_cms, name, type(name, (), {}))
        try:
            root = Node("222020100.img")
            back = root.add(Node("back"))
            for name, number in (("0", 0), ("1", 1), ("3", 8), ("2", 6)):
                item = back.add(Node(name))
                item.add(Node("bS", value="toyCastle"))
                item.add(Node("no", value=number))
                item.add(Node("front", value=0))
            image = type("Img", (), {"parse": lambda self: root})()
            with tempfile.TemporaryDirectory() as tmp:
                store = convert_cms.Store(Path(tmp), roundtrip=False)
                convert_cms.convert_map(store, image, "222020100")
                text = (Path(tmp) / "[group]Back" / "222020100.jsonl").read_text(encoding="utf-8")
        finally:
            for name, value in saved.items():
                setattr(convert_cms, name, value)
        self.assertEqual([json.loads(line)["no"] for line in text.splitlines()], [0, 1, 6, 8])


if __name__ == "__main__":
    unittest.main()
