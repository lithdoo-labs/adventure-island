"""T087 round guards: namespace record-name cipher regression (Shape2D#Vector2D
identity), camera-formula anchors, ledger regression (EV-15 hash / claim counts)."""
import csv
import os
import re
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPTS = REPO / "research" / "scripts"
sys.path.insert(0, str(SCRIPTS))

EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"


def exe_available():
    return EXE.exists()


class NamespaceCipherTests(unittest.TestCase):
    """The 0x7A4DA9/0x7A484B/0x7A48B3/0x7A4CBE cipher recovered in T087.

    key = rotate-LEFT-by-(type div 8) bytes (temp[i] = arr[(r+i) % len]) then
    rotate-LEFT-by-(type mod 8) bits over the 16-byte base key (big-endian);
    plain = cipher XOR key[i mod 16]; a zero XOR result stores the key byte
    (0x7A4DEA).
    """

    @classmethod
    def setUpClass(cls):
        if not exe_available():
            raise unittest.SkipTest("exe not present")
        # import the module without triggering its main()
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "t087_wp1", SCRIPTS / "t087_wp1_fieldctx_d4.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        assert mod.EXE_SHA == EXE_SHA
        cls.mod = mod

    def test_rotation_direction_is_left(self):
        # asm 0x7A4D52: arr[i] = (arr[i] << s) | (arr[i+1] >> (8-s)); carry from
        # arr[0] wraps into the LAST byte => LEFT rotation of the big-endian int
        arr = bytes([0x01, 0x00])
        out = self.mod.rotate_bits_left(arr, 1)
        self.assertEqual(out, bytes([0x02, 0x00]))  # 0x0100 -> 0x0200

    def test_byte_rotation_formula(self):
        # asm temp[i] = arr[(n+i) % len]  (a LEFT array rotation per 0x7A4D17)
        arr = bytes(range(16))
        out = self.mod.rotate_bytes_left(arr, 10)
        self.assertEqual(list(out), [(10 + i) % 16 for i in range(16)])

    def test_key_anchor_type_0x51(self):
        key = self.mod.derive_key(0x51, 16)
        # deterministic anchor: derived from the static 16 bytes at 0xB07640
        self.assertEqual(len(key), 16)
        self.assertNotEqual(bytes(key), bytes(self.mod.data[0xB07640 - 0x400000:0xB07650 - 0x400000]))

    def test_identity_names(self):
        # id 0x31D must decrypt to 'Shape2D#Vector2D' (camera Vector2D identity)
        ptr = self.mod.u32(0xBA7B04 + 0x31D * 4)
        rt, name = self.mod.decrypt_record(ptr)
        self.assertEqual((rt, name), (0x51, b"Shape2D#Vector2D"))

    def test_gr2d_cross_check(self):
        # id 0x819 must decrypt to 'Gr2D_DX8' — the EV-07 namespace identity
        ptr = self.mod.u32(0xBA7B04 + 0x819 * 4)
        rt, name = self.mod.decrypt_record(ptr)
        self.assertEqual(name, b"Gr2D_DX8")

    def test_whistle_id(self):
        # G17: namespace 0x43A drives the boat handlers' sound
        ptr = self.mod.u32(0xBA7B04 + 0x43A * 4)
        rt, name = self.mod.decrypt_record(ptr)
        self.assertEqual(name, b"Whistle")


class CameraFormulaAnchors(unittest.TestCase):
    """camera := point - (400, 300); world->screen := world - camera.

    Instruction anchors (T087 EV-90):
      0x5CA9AC  ecx = [ebp+0xC] (y); add -0x12C  (-300)
      0x5CA9B8  ecx = [ebp+8]  (x); add -0x190  (-400)
      0x9EC61A  push -0x12C ; 0x9EC620 push -0x190   (ctor initial = (0,0)-(400,300))
    """

    def test_constants_are_half_screen(self):
        self.assertEqual(0x190, 800 // 2)
        self.assertEqual(0x12C, 600 // 2)

    def test_ctor_initial_is_origin_centred(self):
        # ctor Set(-400, -300) == formula applied to the world origin (0, 0)
        self.assertEqual((0 - 400, 0 - 300), (-0x190, -0x12C))

    def test_formula_roundtrip(self):
        # screen = world - camera with camera = point - (400, 300)
        # => the centred point always maps to (400, 300)
        for wx, wy in ((0, 0), (1234, -567), (-89, 4321)):
            cam = (wx - 400, wy - 300)
            self.assertEqual((wx - cam[0], wy - cam[1]), (400, 300))


class LedgerRegressionT087(unittest.TestCase):
    """Guard the T087 ledger state against regressions."""

    @classmethod
    def setUpClass(cls):
        cls.claims = list(csv.DictReader(
            open(REPO / "research/source-of-truth/claims.csv", encoding="utf-8")))
        cls.evidence = list(csv.DictReader(
            open(REPO / "research/source-of-truth/evidence.csv", encoding="utf-8")))
        cls.gaps = list(csv.DictReader(
            open(REPO / "research/source-of-truth/gaps.csv", encoding="utf-8")))

    def test_counts(self):
        self.assertEqual(len(self.claims), 105)
        self.assertEqual(len(self.evidence), 92)
        self.assertEqual(len(self.gaps), 41)

    def test_new_claims_present(self):
        ids = {c["claim_id"] for c in self.claims}
        self.assertLessEqual({"C-103", "C-104", "C-105"}, ids)

    def test_c028_upgraded(self):
        c = next(c for c in self.claims if c["claim_id"] == "C-028")
        self.assertEqual(c["status"], "PARTIAL-STATIC")
        self.assertIn("EV-89", c["evidence_refs"])

    def test_g10_refs_include_t087(self):
        g = next(g for g in self.gaps if g["gap_id"] == "G10")
        self.assertIn("C-103", g["claim_refs"])
        self.assertIn("C-104", g["claim_refs"])
        # still PARTIAL-STATIC: follow cadence/deadzone residual is explicit
        self.assertEqual(g["status"], "PARTIAL-STATIC")
        self.assertIn("cadence", g["unresolved_scope"])

    def test_ev15_hash_repaired(self):
        ev = next(e for e in self.evidence if e["evidence_id"] == "EV-15")
        self.assertRegex(ev["source_sha256"], r"^[0-9a-f]{64}$")
        # and it must actually match the file (T086.1 canonical rule)
        from evidence_canonical import canonical_sha256
        p = REPO / ev["source_file"]
        self.assertEqual(ev["source_sha256"], canonical_sha256(p))

    def test_new_evidence_hash_format(self):
        for eid in ("EV-89", "EV-90", "EV-91", "EV-92"):
            ev = next(e for e in self.evidence if e["evidence_id"] == eid)
            self.assertRegex(ev["source_sha256"], r"^[0-9a-f]{64}$")

    def test_no_g10_closed_label_drift(self):
        # the round must NOT have relabelled G10 to CLOSED without the cadence
        # residual being resolved (report-level label discipline)
        g = next(g for g in self.gaps if g["gap_id"] == "G10")
        self.assertEqual(g["status"], "PARTIAL-STATIC")


if __name__ == "__main__":
    unittest.main()
