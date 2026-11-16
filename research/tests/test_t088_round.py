"""T088 round guards: EV-92 routing regression, census counts/rows, Shape2D Set
semantics anchors, focus-writer chain anchors, matrix readiness/wording,
ledger counts."""
import csv
import os
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPTS = REPO / "research" / "scripts"
sys.path.insert(0, str(SCRIPTS))

EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
S2D = REPO / ".work/task-001/extracted/冒险岛online/Shape2D.dll"
S2D_SHA = "9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b"


def _read(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


class Ev92RoutingRegression(unittest.TestCase):
    """F1: the old 0x98 routing must never re-enter Evidence metadata."""

    @classmethod
    def setUpClass(cls):
        cls.evidence = _read(REPO / "research/source-of-truth/evidence.csv")

    def test_ev92_has_corrected_routing(self):
        ev = next(e for e in self.evidence if e["evidence_id"] == "EV-92")
        text = ev["instruction_or_data"]
        self.assertIn("states 2|5 -> 0x564E52", text)
        self.assertIn("states 0|1|6 -> 0x564FBE", text)
        self.assertIn("states 3|4 -> 0x56512A", text)
        self.assertIn("only state<0 or state>6 is a no-op", text)

    def test_stale_routing_strings_absent_from_active_evidence(self):
        # the pre-correction routing (2|5 -> 0x56512A; "states 0|3 no-op")
        # must not appear as an ACTIVE conclusion anywhere in evidence.csv
        for ev in self.evidence:
            blob = ev["instruction_or_data"] + ev["interpretation"]
            self.assertNotIn("state 2|5 -> 0x56512A", blob,
                             f"stale routing in {ev['evidence_id']}")
            self.assertNotIn("states 0|3 no-op", blob,
                             f"stale no-op routing in {ev['evidence_id']}")

    def test_ev92_consistent_with_c105_and_g17(self):
        claims = _read(REPO / "research/source-of-truth/claims.csv")
        gaps = _read(REPO / "research/source-of-truth/gaps.csv")
        c105 = next(c for c in claims if c["claim_id"] == "C-105")["claim"]
        g17 = next(g for g in gaps if g["gap_id"] == "G17")["verified_scope"]
        ev92 = next(e for e in self.evidence if e["evidence_id"] == "EV-92")["instruction_or_data"]
        for doc in (c105, g17):
            # both must carry the corrected {0,1,6}/{2,5}/{3,4} partition
            self.assertIn("0x564FBE", doc)
            self.assertIn("0x564E52", doc)
        self.assertIn("0x564FBE", ev92)


class CensusArtifacts(unittest.TestCase):
    """WP1: census CSV shape and classification counts."""

    @classmethod
    def setUpClass(cls):
        cls.census = _read(REPO / "research/result/stage-readiness/forensics/"
                            "T088-VECTOR2D-ID31D-RESOLVE-CENSUS.csv")
        cls.classes = _read(REPO / "research/result/stage-readiness/forensics/"
                            "T088-DIRECT-SLOT90-WRITER-CLASSIFICATION.csv")

    def test_census_totals(self):
        # 63 push + 17 mov = 80 resolve sites (band 0x401000-0x7EA000)
        self.assertEqual(len(self.census), 80)

    def test_classification_totals(self):
        self.assertEqual(len(self.classes), 39)
        counts = {}
        for r in self.classes:
            counts[r["classification"]] = counts.get(r["classification"], 0) + 1
        self.assertEqual(counts.get("CONFIRMED-CAMERA-WRITER"), 2)
        self.assertEqual(counts.get("CONFIRMED-SHARED-WRITE-CONTEXT-UI"), 12)
        self.assertEqual(counts.get("RECEIVER-OTHER", 0), 0)   # class eliminated (C1)
        self.assertEqual(counts.get("INCONCLUSIVE"), 25)

    def test_known_anchor_rows(self):
        by_va = {r["slot90_va"]: r for r in self.classes}
        self.assertEqual(by_va["0x009ec62a"]["classification"], "CONFIRMED-CAMERA-WRITER")
        self.assertEqual(by_va["0x0093cc9b"]["classification"], "CONFIRMED-CAMERA-WRITER")
        self.assertIn("Set(0xfffffe70, 0xfffffed4)", by_va["0x009ec62a"]["args"])
        self.assertIn("0x190", by_va["0x006be6f4"]["args"])

    def test_camera_writers_use_immediate_class_variants(self):
        by_va = {r["slot90_va"]: r for r in self.classes}
        # t088-reviewer C4: all 39 sites are uniform default(VT_ERROR,missing)
        # (the ctor V3 slot is cleared at 0x9EC57B then re-templated from
        # 0xBE7330 at 0x9EC5C3-0x9EC5D2)
        self.assertEqual(by_va["0x0093cc9b"]["variant3_4"], "default(VT_ERROR,missing)")
        self.assertEqual(by_va["0x009ec62a"]["variant3_4"], "default(VT_ERROR,missing)")
        defaults = sum(1 for r in self.classes
                       if r["variant3_4"] == "default(VT_ERROR,missing)")
        self.assertEqual(defaults, 39)


class Shape2DSetSemantics(unittest.TestCase):
    """WP1-C/WP3: Set body anchors read from the pinned Shape2D.dll bytes."""

    def test_binary_identity(self):
        import hashlib
        self.assertEqual(
            hashlib.sha256(open(S2D, "rb").read()).hexdigest(), S2D_SHA)

    def test_set_immediate_semantics_constants(self):
        # VT_EMPTY(0)/VT_ERROR(0xA) gate; immediate stores at +0x1C/+0x20;
        # ret 0x2C; interp duration via global tick 0x51411C34; flag mask
        data = open(S2D, "rb").read()
        def off(va):
            return 0x1000 + (va - 0x51401000)
        self.assertEqual(data[off(0x5140828F)], 0x55)                    # push ebp (fn start)
        # cmp word ptr [ebp+0x14], 0  /  cmp word ptr [ebp+0x14], 0xA
        self.assertEqual(data[off(0x51408296):off(0x51408296)+2], b"\x66\x39")
        self.assertEqual(data[off(0x5140829D):off(0x5140829D)+5], bytes([0x66, 0x83, 0x7d, 0x14, 0x0a]))  # cmp w [ebp+0x14], 0xA (VT_ERROR)
        # ret 0x2C at 0x51408338
        self.assertEqual(data[off(0x51408338):off(0x51408338)+3], b"\xc2\x2c\x00")
        # immediate store: [eax+0x1C] <- ecx  at 0x5140831B (89 48 1c)
        self.assertEqual(data[off(0x5140831B):off(0x5140831B)+3], b"\x89\x48\x1c")
        self.assertEqual(data[off(0x51408321):off(0x51408321)+3], b"\x89\x48\x20")

    def test_vtable_slots(self):
        import struct
        data = open(S2D, "rb").read()
        def off(va):
            return 0x1000 + (va - 0x51401000)
        vt = 0x5140C2F0 - 0x51401000 + 0x1000
        # .rdata: raw=0xC000 va=0x5140C000
        vt = 0xC000 + (0x5140C2F0 - 0x5140C000)
        get_x = struct.unpack("<I", data[vt + 0x20:vt + 0x24])[0]
        get_y = struct.unpack("<I", data[vt + 0x28:vt + 0x2C])[0]
        set_ = struct.unpack("<I", data[vt + 0x90:vt + 0x94])[0]
        self.assertEqual(get_x, 0x5140724A)
        self.assertEqual(get_y, 0x514074C8)
        self.assertEqual(set_, 0x5140828F)


class FieldWriterChainAnchors(unittest.TestCase):
    """WP2: trigger-chain byte anchors in the EXE."""

    def test_exe_identity(self):
        import hashlib
        self.assertEqual(
            hashlib.sha256(open(EXE, "rb").read()).hexdigest(), EXE_SHA)

    def test_writer7_mouse_band_unpack(self):
        data = open(EXE, "rb").read()
        off = 0x9F1AD5 - 0x400000
        self.assertEqual(data[off], 0x8B)              # mov eax, [edi]
        self.assertEqual(data[0x9F1AD7 - 0x400000], 0xC1)   # shr eax, 0x10
        self.assertEqual(data[0x9F1ADB - 0x400000], 0x0F)   # movzx eax, word [edi]
        # the funnel call at 0x9F1ADF
        self.assertEqual(data[0x9F1ADF - 0x400000], 0xE8)

    def test_writer6_cursor_seeding(self):
        data = open(EXE, "rb").read()
        # 0x9E6C30: mov ecx, [0xBDD838]; 0x9E6C3A: call 0x5CABE1 (base read)
        off = 0x9E6C30 - 0x400000
        self.assertEqual(data[off:off+2], b"\x8b\x0d")
        self.assertEqual(int.from_bytes(data[off+2:off+6], "little"), 0xBDD838)
        off2 = 0x9E6C3A - 0x400000
        rel = int.from_bytes(data[off2+1:off2+5], "little", signed=True)
        self.assertEqual(off2 + 5 + rel + 0x400000, 0x5CABE1)

    def test_focus_writer_shared_create_and_callers(self):
        data = open(EXE, "rb").read()
        # 0x93CBBE: push 0x31D (direct shared-object create inside 0x93CB27)
        self.assertEqual(data[0x93CBBE - 0x400000], 0x68)
        self.assertEqual(int.from_bytes(data[0x93CBBF - 0x400000:0x93CBC3 - 0x400000], "little"), 0x31D)
        # 10 E8 callers
        callers = 0
        tgt = 0x93CB27 - 0x400000
        for i in range(0x1000, 0x7EA000 - 5):
            if data[i] == 0xE8:
                rel = int.from_bytes(data[i+1:i+5], "little", signed=True)
                if i + 5 + rel == tgt:
                    callers += 1
        self.assertEqual(callers, 10)


class MatrixAndLedgerT088(unittest.TestCase):
    """WP0: readiness enum + writer-set wording + counts."""

    @classmethod
    def setUpClass(cls):
        cls.matrix = _read(REPO / "research/result/stage-readiness/"
                           "P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv")
        cls.claims = _read(REPO / "research/source-of-truth/claims.csv")
        cls.evidence = _read(REPO / "research/source-of-truth/evidence.csv")
        cls.gaps = _read(REPO / "research/source-of-truth/gaps.csv")

    def test_p201_readiness_is_product_ready(self):
        r = next(x for x in self.matrix if x["requirement_id"] == "P2-01")
        self.assertEqual(r["readiness"], "PRODUCT-READY")
        self.assertIn("ORIGINAL-STATIC-PROVEN", r["evidence_grade_and_type"])
        self.assertEqual(r["blocks_acceptance"], "否")

    def test_legal_readiness_enums_only(self):
        legal = {"RE-GAP-STATIC", "RE-GAP-RUNTIME", "RE-READY", "PRODUCT-READY",
                 "DESIGN-DECISION", "EXTERNAL-BLOCKED"}
        for x in self.matrix:
            self.assertIn(x["readiness"], legal,
                          f"illegal readiness {x['readiness']} on {x['requirement_id']}")

    def test_p407_no_stale_tasks(self):
        r = next(x for x in self.matrix if x["requirement_id"] == "P4-07")
        blob = (r["unproven"] + r["minimum_next_work"] +
                r["can_static_continue_or_runtime"] + r["evidence_grade_and_type"])
        self.assertNotIn("+0xD4", r["minimum_next_work"])     # identity task done in t087
        self.assertNotIn("构造点", r["minimum_next_work"])
        self.assertNotIn("运行时捕获", blob)
        self.assertIn("[[arg3]+0x14]", r["minimum_next_work"])   # the real residual

    def test_writer_set_wording(self):
        r = next(x for x in self.matrix if x["requirement_id"] == "P2-05")
        self.assertIn("漏斗调用点", r["unproven"])
        self.assertIn("直接", r["unproven"])

    def test_counts(self):
        # t089 migration: +C-110..C-115, +EV-98..EV-103 (reviewed T089 round)
        # t090 migration: +C-116..C-119, +EV-104..EV-107 (reviewed T090 round)
        # t091 migration: +C-120, +EV-108 (reviewed T091 round)
        self.assertEqual(len(self.claims), 120)
        self.assertEqual(len(self.evidence), 108)
        self.assertEqual(len(self.gaps), 41)

    def test_new_claims_and_evidence(self):
        cids = {c["claim_id"] for c in self.claims}
        self.assertLessEqual({"C-106", "C-107", "C-108", "C-109"}, cids)
        eids = {e["evidence_id"] for e in self.evidence}
        self.assertLessEqual({"EV-93", "EV-94", "EV-95", "EV-96", "EV-97"}, eids)

    def test_g10_still_partial_with_bounded_residuals(self):
        g = next(x for x in self.gaps if x["gap_id"] == "G10")
        self.assertEqual(g["status"], "PARTIAL-STATIC")
        # t089 wording refinement (C-115): corrected arg3 form, historical
        # [user+0xF28] framing retained alongside it
        self.assertIn("[[arg3]+0x14]", g["unresolved_scope"])
        self.assertIn("[[user+0xF28]", g["unresolved_scope"])
        self.assertIn("INCONCLUSIVE", g["unresolved_scope"])
        for c in ("C-106", "C-107", "C-108", "C-109"):
            self.assertIn(c, g["claim_refs"])

    def test_new_evidence_hashes_canonical(self):
        from evidence_canonical import canonical_sha256
        for eid in ("EV-93", "EV-94", "EV-95", "EV-96", "EV-97"):
            ev = next(e for e in self.evidence if e["evidence_id"] == eid)
            p = REPO / ev["source_file"]
            self.assertEqual(ev["source_sha256"], canonical_sha256(p),
                             f"{eid} hash mismatch")


if __name__ == "__main__":
    unittest.main()
