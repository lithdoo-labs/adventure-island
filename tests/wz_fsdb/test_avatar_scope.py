"""Avatar scope: the wanted-canvas filter mirrors the production adapter.

These tests build serialized record dicts (the shape struct.Look takes after
conversion, including resolved UOL targets and reference frames) and assert
exactly which Canvas resource keys the minimal Avatar FSDB must contain.
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


def canvas(key, z="body", **extra):
    value = {"resource": key, "width": 20, "height": 30, "z": z}
    value.update(extra)
    return value


def sample_looks():
    body = {
        "info": {"islot": "Bd"},
        "stand1": {
            "0": {"delay": 500, "face": 1, "body": canvas("Look/00002000/stand1/0/body"),
                  "arm": canvas("Look/00002000/stand1/0/arm", z="backArm")},
            "1": {"delay": 500, "face": 1, "body": canvas("Look/00002000/stand1/1/body")},
            "2": {"delay": 500, "face": 0, "body": canvas("Look/00002000/stand1/2/body")},
        },
        "walk1": {
            "0": {"delay": 180, "face": 1, "body": canvas("Look/00002000/walk1/0/body")},
            "1": {"delay": 180, "face": 1, "body": canvas("Look/00002000/walk1/1/body")},
            "2": {"delay": 180, "face": 1, "body": canvas("Look/00002000/walk1/2/body")},
            "3": {"delay": 180, "face": 1, "body": canvas("Look/00002000/walk1/3/body")},
        },
        "jump": {"0": {"delay": 200, "face": 1, "body": canvas("Look/00002000/jump/0/body")}},
        "prone": {"0": {"delay": 0, "face": 1, "body": canvas("Look/00002000/prone/0/body")}},
        "brandish1": {
            "0": {"action": "swingOF", "frame": 0, "delay": 120},
            "1": {"action": "swingOF", "frame": 1, "delay": 120},
            "2": {"action": "swingOF", "frame": 2, "delay": 120},
            "3": {"action": "swingOF", "frame": 3, "delay": 120},
            "4": {"action": "stabOF", "frame": 0, "delay": 120},
            "5": {"action": "stabOF", "frame": 1, "delay": 120},
            "6": {"action": "stabOF", "frame": 2, "delay": 120},
        },
        "swingOF": {
            "0": {"body": canvas("Look/00002000/swingOF/0/body"), "arm": canvas("Look/00002000/swingOF/0/arm")},
            "1": {"body": canvas("Look/00002000/swingOF/1/body")},
            "2": {"body": canvas("Look/00002000/swingOF/2/body")},
            "3": {"body": canvas("Look/00002000/swingOF/3/body")},
        },
        "stabOF": {
            "0": {"body": canvas("Look/00002000/stabOF/0/body")},
            "1": {"body": canvas("Look/00002000/stabOF/1/body")},
            "2": {"body": canvas("Look/00002000/stabOF/2/body")},
        },
    }
    head = {
        # UOLs were resolved inline by the converter: the canvas resource
        # points at the real target under `front`.
        "front": {"head": canvas("Look/00012000/front/head", z="head", map={"neck": [-4, -10]})},
        "walk1": {
            "0": {"head": canvas("Look/00012000/front/head", z="head")},
            "1": {"head": canvas("Look/00012000/front/head", z="head")},
            "2": {"head": canvas("Look/00012000/front/head", z="head")},
            "3": {"head": canvas("Look/00012000/front/head", z="head")},
        },
        "swingOF": {"0": {"head": canvas("Look/00012000/swingOF/0/head", z="head")}},
    }
    hair = {
        "default": {"hairOverHead": canvas("Look/00030000/default/hairOverHead", z="hairOverHead")},
        "hairShade": {"0": {"hairShade": {
            "0": canvas("Look/00030000/hairShade/0/0", z="hairBelowBody"),
            "1": canvas("Look/00030000/hairShade/0/1", z="hairBelowBody"),
        }}},
    }
    face = {"default": {"face": canvas("Look/00020000/default/face", z="face")}}
    weapon = {
        "info": {"walk": 1, "stand": 1},
        "walk1": {"0": {"weapon": canvas("Look/01302000/walk1/0/weapon", z="weaponOverGlove")}},
        "stand1": {"0": {"weapon": canvas("Look/01302000/stand1/0/weapon", z="weaponOverGlove")}},
        "jump": {"0": {"weapon": canvas("Look/01302000/jump/0/weapon", z="weaponOverGlove")}},
        "swingOF": {"0": {"weapon": canvas("Look/01302000/swingOF/0/weapon", z="weaponOverGlove")}},
        "stabOF": {"0": {"weapon": canvas("Look/01302000/stabOF/0/weapon", z="weaponOverGlove")}},
    }
    return {"body": body, "head": head, "hair": hair, "face": face, "weapon": weapon}


class AvatarScopeTest(unittest.TestCase):
    def test_wanted_resources_follow_reference_frames(self):
        wanted = convert_cms.avatar_wanted_resources(sample_looks())
        self.assertIn("Look/00002000/swingOF/0/body", wanted)
        self.assertIn("Look/00002000/stabOF/2/body", wanted)
        self.assertIn("Look/00012000/swingOF/0/head", wanted)
        self.assertIn("Look/01302000/stabOF/0/weapon", wanted)
        # prone is not a tested action.
        self.assertNotIn("Look/00002000/prone/0/body", wanted)

    def test_wanted_resources_cover_all_walk_frames_and_parts(self):
        wanted = convert_cms.avatar_wanted_resources(sample_looks())
        for frame in range(4):
            self.assertIn(f"Look/00002000/walk1/{frame}/body", wanted)
        self.assertIn("Look/00012000/front/head", wanted)
        self.assertIn("Look/01302000/walk1/0/weapon", wanted)

    def test_hair_uses_skin_zero_canvas_of_shade_blocks(self):
        wanted = convert_cms.avatar_wanted_resources(sample_looks())
        # hair lacks stand1/walk1/... so only the shade block under a tested
        # canvas action contributes; with no matching action nothing is added.
        self.assertNotIn("Look/00030000/hairShade/0/0", wanted)

    def test_hair_shade_collected_when_action_matches(self):
        looks = sample_looks()
        looks["hair"]["walk1"] = {"0": {"hairShade": {
            "0": canvas("Look/00030000/hairShade/0/0"),
            "1": canvas("Look/00030000/hairShade/0/1"),
        }}}
        wanted = convert_cms.avatar_wanted_resources(looks)
        self.assertIn("Look/00030000/hairShade/0/0", wanted)
        self.assertNotIn("Look/00030000/hairShade/0/1", wanted)

    def test_face_hidden_frames_do_not_add_the_expression(self):
        looks = sample_looks()
        wanted = convert_cms.avatar_wanted_resources(looks)
        self.assertIn("Look/00020000/default/face", wanted)
        # Hide the face on every frame of every tested action.
        for action in convert_cms.AVATAR_ACTIONS:
            for frame in looks["body"][action].values():
                frame["face"] = 0
        wanted = convert_cms.avatar_wanted_resources(looks)
        self.assertNotIn("Look/00020000/default/face", wanted)

    def test_missing_body_action_is_an_error(self):
        looks = sample_looks()
        del looks["body"]["jump"]
        with self.assertRaises(ValueError):
            convert_cms.avatar_wanted_resources(looks)
        looks["body"]["jump"] = {"no-numbered-frames": {}}
        with self.assertRaises(ValueError):
            convert_cms.avatar_wanted_resources(looks)

    def test_resource_filter_writes_only_wanted_canvases_and_counts_the_rest(self):
        wanted = convert_cms.avatar_wanted_resources(sample_looks())
        with tempfile.TemporaryDirectory() as tmp:
            store = convert_cms.Store(Path(tmp), roundtrip=False, resource_filter=set(wanted))
            keep = Image.new("RGBA", (2, 2), (1, 2, 3, 4))
            drop = Image.new("RGBA", (2, 2), (5, 6, 7, 8))
            keep_digest = hashlib.sha256(keep.tobytes()).hexdigest()
            drop_digest = hashlib.sha256(drop.tobytes()).hexdigest()
            key = store.write_png(["Look", "00002000", "walk1", "0", "body"], keep, keep_digest)
            self.assertEqual(key, "Look/00002000/walk1/0/body")
            self.assertEqual(store.stats["canvases"], 1)
            skipped = store.write_png(["Look", "00002000", "prone", "0", "body"], drop, drop_digest)
            self.assertEqual(skipped, "Look/00002000/prone/0/body", "record still references the key")
            self.assertEqual(store.stats["canvases"], 1)
            self.assertEqual(store.stats["canvasesOutOfScope"], 1)
            self.assertEqual(len(list(Path(tmp).rglob("*.png"))), 1)


if __name__ == "__main__":
    unittest.main()
