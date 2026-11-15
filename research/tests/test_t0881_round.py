"""T088.1 round guards: census VA integrity (double-BASE regression), scanner
positive control, classification/VARIANT semantic layering, stale-conclusion
regressions (2-10-2-25, 35/39, 33-tables-no-imm32, world-space #6/#7),
evidence hash chain, clean-room sync."""
import csv
import os
import struct
import subprocess
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPTS = REPO / "research" / "scripts"
sys.path.insert(0, str(SCRIPTS))

EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
BASE = 0x400000
CODE_START, CODE_END = 0x1000, 0x7EA000
CREATE = 0x447891

FORENSICS = REPO / "research/result/stage-readiness/forensics"
CENSUS = FORENSICS / "T088-VECTOR2D-ID31D-RESOLVE-CENSUS.csv"
CLASSES = FORENSICS / "T088-DIRECT-SLOT90-WRITER-CLASSIFICATION.csv"
BOUNDS = FORENSICS / "T088-CAMERA-BOUNDS-SCENE-PORTAL.md"
VERIFY_CSV = FORENSICS / "T0881-VA-CALLSITE-VERIFICATION.csv"


def _read(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


class CensusVaIntegrity(unittest.TestCase):
    """WP1: the create_call_va double-BASE defect must never return."""

    @classmethod
    def setUpClass(cls):
        cls.img = EXE.read_bytes()
        import hashlib
        assert hashlib.sha256(cls.img).hexdigest() == EXE_SHA, "EXE sha mismatch"
        cls.rows = _read(CENSUS)

    def test_totals_and_forms(self):
        self.assertEqual(len(self.rows), 80)
        self.assertEqual(sum(1 for r in self.rows if r["form"] == "push imm32"), 63)
        self.assertEqual(sum(1 for r in self.rows if r["form"] == "mov r32, imm32"), 17)

    def test_nonempty_calls_in_image_va_band(self):
        # t088 bug symptom: values like 0x00DEC4EE beyond the image; the true
        # band is [0x401000, 0xBEA000)
        vals = [int(r["create_call_va"], 16) for r in self.rows
                if r["create_call_va"]]
        self.assertEqual(len(vals), 76)
        for v in vals:
            self.assertTrue(BASE + CODE_START <= v < BASE + CODE_END,
                            f"{v:#x} outside image code band")

    def test_every_call_byte_verified_e8_to_0x447891(self):
        for r in self.rows:
            if not r["create_call_va"]:
                continue
            va = int(r["create_call_va"], 16)
            off = va - BASE
            self.assertEqual(self.img[off], 0xE8, f"{r['resolve_va']}: no E8 at {va:#x}")
            tgt = va + 5 + struct.unpack("<i", self.img[off + 1:off + 5])[0]
            self.assertEqual(tgt, CREATE, f"{r['resolve_va']}: E8 -> {tgt:#x}")

    def test_no_double_base_residual(self):
        # if the double-BASE bug returned, recorded == true + 0x400000; every
        # recorded call would then be far outside the band — belt & braces:
        for r in self.rows:
            if r["create_call_va"]:
                self.assertNotEqual(int(r["create_call_va"], 16) - 0x400000,
                                    int(r["resolve_va"], 16))

    def test_task_mandated_sample_rows(self):
        by_resolve = {r["resolve_va"]: r for r in self.rows}
        self.assertEqual(by_resolve["0x00437732"]["create_call_va"], "0x00437754")
        self.assertEqual(by_resolve["0x0069213a"]["create_call_va"], "0x0069215f")
        self.assertEqual(by_resolve["0x009ec4d3"]["create_call_va"], "0x009ec4ee")

    def test_empty_rows_carry_precise_reasons(self):
        empties = {r["resolve_va"]: r for r in self.rows
                   if not r["create_call_va"]}
        self.assertEqual(len(empties), 4)
        self.assertEqual(set(empties),
                         {"0x0073e40a", "0x0093a0a1", "0x00a197dd", "0x00a19d57"})
        for r in empties.values():
            self.assertIn("not a namespace resolve", r["attach_target_expr"])
            self.assertEqual(r["alias_kind"], "imm32-operand (not a resolve)")

    def test_69213a_attach_is_out_slot_not_param_register(self):
        r = next(r for r in self.rows if r["resolve_va"] == "0x0069213a")
        self.assertEqual(r["attach_target_expr"], "[ebp - 0x10]")

    def test_independent_verification_artifact_all_pass(self):
        rows = _read(VERIFY_CSV)
        self.assertEqual(len(rows), 80)
        for r in rows:
            self.assertTrue(r["verdict"].startswith("PASS"),
                            f"{r['resolve_va']}: {r['verdict']}")


class ScannerPositiveControl(unittest.TestCase):
    """WP2: the rebuilt slot15-family scanner must detect the known base-table
    installs (the T088 regex scanner structurally could not)."""

    @classmethod
    def setUpClass(cls):
        import hashlib
        cls.img = EXE.read_bytes()
        assert hashlib.sha256(cls.img).hexdigest() == EXE_SHA, "EXE sha mismatch"
        import t088_wp4_scene_portal as wp4
        cls.wp4 = wp4
        cls.fam = wp4.family_tables(cls.img)
        cls.census = wp4.imm32_census(cls.img, cls.fam)

    def test_family_table_count(self):
        self.assertEqual(len(self.fam), 33)
        self.assertEqual(self.fam[0], 0xB01278)
        self.assertEqual(self.fam[-1], 0xB026A0)

    def test_base_table_positive_control(self):
        installs = sorted(va for va, kind, _ in self.census[0xB01278]
                          if kind == "INSTALL")
        self.assertEqual(installs,
                         sorted([0x52F1BC, 0x52F1CF, 0xA0B39E, 0xA0BB2A]))

    def test_old_regex_could_not_match_base_table_encoding(self):
        # documents the T088 defect: the encoding of 0x00B01278 is
        # 78 12 b0 00 — byte2 (0x12) != 0xB0, so rb".\xb0\x00\x00" is
        # structurally blind to it
        import re
        enc = struct.pack("<I", 0xB01278)
        self.assertIsNone(re.search(rb".\xb0\x00\x00", enc))

    def test_derived_tables_have_zero_imm32_code_refs(self):
        with_ref = [v for v in self.fam if self.census[v]]
        self.assertEqual(with_ref, [0xB01278])

    def test_direct_1cc_writer_census_finds_ten_incl_952ece(self):
        refs = self.wp4.ref_1cc_census(self.img)
        writers = sorted(a for a, t in refs.items()
                         if t.startswith("mov dword ptr ["))
        self.assertEqual(writers, sorted([
            0x60088A, 0x67B139, 0x6D429C, 0x703819, 0x71FAA1,
            0x79293F, 0x793570, 0x7C939A, 0x952ECE, 0xA029BA]))
        lea = [a for a, t in refs.items() if t.startswith("lea ")]
        self.assertEqual(len(lea), 21)     # 21 + 10 = 31 (reads excluded)

    def test_generator_self_check_would_abort_without_control(self):
        # the generator's own positive control equals the test's expectation
        self.assertEqual(sorted(self.wp4.BASE_TABLE_INSTALLS),
                         [0x52F1BC, 0x52F1CF, 0xA0B39E, 0xA0BB2A])


class WriterCoverageStatement(unittest.TestCase):
    """WP2: bounded negatives must state their function-boundary provenance."""

    @classmethod
    def setUpClass(cls):
        cls.text = BOUNDS.read_text(encoding="utf-8")

    def test_no_unbounded_fn_none_remains(self):
        self.assertNotIn("fn None", self.text)

    def test_ten_writers_bounded_verdict(self):
        self.assertIn("10/10 writers CENSUS-FN-BOUNDED-NEGATIVE", self.text)
        self.assertIn("0/10 REPRODUCTION-INCOMPLETE", self.text)

    def test_coverage_doc_exists_with_boundary_section(self):
        cov = (FORENSICS / "T0881-SCENE-VTABLE-INSTALL-COVERAGE.md").read_text(encoding="utf-8")
        self.assertIn("does NOT cover", cov)
        self.assertIn("CENSUS-FN-BOUNDED-NEGATIVE", cov)
        self.assertIn("0x952ECE", cov)

    def test_census_taxonomy_reconciled(self):
        self.assertIn("mov/lea excluding reads (T088 taxonomy): 31", self.text)
        self.assertIn("10  (the direct writers)", self.text)


class ClassificationAndVariantSemantics(unittest.TestCase):
    """F1/F2: counts consistent everywhere; 39/39 default strictly layered
    against the 25 INCONCLUSIVE business-semantics residual."""

    @classmethod
    def setUpClass(cls):
        cls.classes = _read(CLASSES)

    def test_classification_counts(self):
        counts = {}
        for r in self.classes:
            counts[r["classification"]] = counts.get(r["classification"], 0) + 1
        self.assertEqual(counts.get("CONFIRMED-CAMERA-WRITER"), 2)
        self.assertEqual(counts.get("CONFIRMED-SHARED-WRITE-CONTEXT-UI"), 12)
        self.assertEqual(counts.get("RECEIVER-OTHER", 0), 0)
        self.assertEqual(counts.get("INCONCLUSIVE"), 25)

    def test_variant_uniformity(self):
        defaults = sum(1 for r in self.classes
                       if r["variant3_4"] == "default(VT_ERROR,missing)")
        self.assertEqual(defaults, 39)

    def test_report_table_matches_csv(self):
        report = (REPO / "research/result/stage-readiness/"
                  "T088-CAMERA-CADENCE-WRITER-CLOSURE-REPORT.md").read_text(encoding="utf-8")
        self.assertIn("| CONFIRMED-SHARED-WRITE-CONTEXT-UI | 12 |", report)
        self.assertIn("| RECEIVER-OTHER | 0 |", report)
        self.assertIn("| CONFIRMED-CAMERA-WRITER | 2 |", report)
        self.assertIn("| INCONCLUSIVE | 25 |", report)
        # the old table row must not survive unmarked
        self.assertNotIn("| RECEIVER-OTHER | 2 |", report)
        self.assertNotIn("CONFIRMED-SHARED-WRITE-CONTEXT-UI | 10 |", report)

    def test_readiness_active_counts_corrected(self):
        rr = (REPO / "research/result/stage-readiness/"
              "P0-P4-READINESS-REPORT.md").read_text(encoding="utf-8")
        self.assertIn("2 CONFIRMED-CAMERA-WRITER / 12 CONFIRMED-SHARED-WRITE-CONTEXT-UI "
                      "/ 0 RECEIVER-OTHER / 25 INCONCLUSIVE", rr)
        self.assertIn("39/39 统一默认 V{VT_ERROR,missing}", rr)
        # stale bucket may only appear inside an explicit correction marker
        markers = ("勘误", "撤销", "残留", "HISTORICAL", "t088.1")
        for stale in ("35/39 立即类", "33 默认构造器 + 2 清空槽"):
            i = rr.find(stale)
            while i != -1:
                window = rr[max(0, i - 400):i + len(stale) + 40]
                self.assertTrue(any(m in window for m in markers),
                                f"stale bucket '{stale}' without correction marker")
                i = rr.find(stale, i + 1)

    def test_ev93_semantic_layering(self):
        ev = {e["evidence_id"]: e for e in _read(REPO / "research/source-of-truth/evidence.csv")}
        text = ev["EV-93"]["interpretation"]
        self.assertIn("39/39 default V{VT_ERROR,missing}", text)
        self.assertNotIn("= 35/39 immediate-class)", text)
        self.assertIn("SEMANTIC LAYERING", text)
        self.assertIn("do NOT auto-upgrade", text)
        # layering companions: immediacy proven callee-side (C-108), receiver
        # shared (C-106), INCONCLUSIVE semantics open
        self.assertIn("C-108", text)
        self.assertIn("C-106", text)
        cls = self.classes
        self.assertEqual(sum(1 for r in cls if r["classification"] == "INCONCLUSIVE"), 25)

    def test_ev93_companion_hash_unchanged(self):
        ev = {e["evidence_id"]: e for e in _read(REPO / "research/source-of-truth/evidence.csv")}
        self.assertIn("2f5c550e303495909336471fbc8d1445a5492ae8fc7b258ea2362cd6706abe4c",
                      ev["EV-93"]["interpretation"])


class HistoricalConclusionRegressions(unittest.TestCase):
    """F3/F4: superseded conclusions must stay marked as history."""

    @classmethod
    def setUpClass(cls):
        cls.claims = {c["claim_id"]: c for c in _read(REPO / "research/source-of-truth/claims.csv")}
        cls.gaps = {g["gap_id"]: g for g in _read(REPO / "research/source-of-truth/gaps.csv")}

    def test_g10_no_stale_33_table_claim(self):
        g = self.gaps["G10"]["unresolved_scope"]
        self.assertNotIn("33 family vtables have no imm32 code ref", g)
        # corrected statements instead
        self.assertIn("BASE table 0xB01278", g)
        self.assertIn("zero imm32 occurrence", g)
        self.assertIn("0x952ECE", g)

    def test_g10_blocker_has_no_completed_identity_tasks(self):
        b = self.gaps["G10"]["blocker"]
        self.assertIn("CLOSED", b)
        self.assertNotIn("[fieldctx+0xD4] writer census,", b)

    def test_g10_next_action_has_t089_entry(self):
        self.assertIn("derived-table", self.gaps["G10"]["next_action"])
        self.assertIn("0x52F37F", self.gaps["G10"]["next_action"])

    def test_g10_status_and_residuals_kept(self):
        self.assertEqual(self.gaps["G10"]["status"], "PARTIAL-STATIC")
        # t089 wording refinement (C-115): the census item now names both the
        # historical [[user+0xF28]] framing and the corrected [[arg3]+0x14] form
        self.assertIn("[[arg3]+0x14]", self.gaps["G10"]["unresolved_scope"])
        self.assertIn("[[user+0xF28]", self.gaps["G10"]["unresolved_scope"])
        self.assertIn("INCONCLUSIVE", self.gaps["G10"]["unresolved_scope"])

    def test_c028_worldspace_reading_marked_historical(self):
        t = self.claims["C-028"]["reasoning"]
        self.assertIn("T087 HISTORICAL READING, superseded by C-107/EV-94", t)
        self.assertIn("PROVEN cursor-mode", t)
        self.assertIn("0x93CB27", t)
        # every 'field-family world-space' mention must sit inside the marker
        i = t.find("field-family world-space writers")
        self.assertNotEqual(i, -1)
        self.assertIn("HISTORICAL READING", t[max(0, i - 260):i])

    def test_c103_field_writers_marked_historical(self):
        t = self.claims["C-103"]["claim"]
        self.assertIn("[T087 historical labels 'FIELD writers'", t)
        self.assertIn("superseded by the t088 revision", t)
        self.assertIn("CURSOR-mode (C-107/EV-94)", t)
        # the proven identity/transform is NOT revoked
        self.assertIn("[fieldctx+0xD4] IS the world camera", t)
        self.assertIn("screen = world - camera", t)

    def test_c103_t088_revision_still_present_in_address(self):
        self.assertIn("t088 REVISION of the writer-set reading",
                      self.claims["C-103"]["address"])

    def test_c106_reasoning_no_duplicated_sentence(self):
        t = self.claims["C-106"]["reasoning"]
        self.assertEqual(t.count("t088-reviewer C1 reinforcement"), 1)

    def test_ev97_ten_writers_and_corrected_installs(self):
        ev = {e["evidence_id"]: e for e in _read(REPO / "research/source-of-truth/evidence.csv")}
        e = ev["EV-97"]
        self.assertIn("10 direct +0x1CC writers", e["address"])
        self.assertIn("0x952ECE", e["address"])
        self.assertIn("FOUR imm32 installs", e["interpretation"])
        self.assertIn("0x52F1BC", e["interpretation"])
        self.assertIn("CENSUS-FN-BOUNDED-NEGATIVE 10/10", e["interpretation"])

    def test_matrix_p2_rows_have_no_stale_writer_counts(self):
        mx = _read(REPO / "research/result/stage-readiness/"
                   "P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv")
        p25 = next(r for r in mx if r["requirement_id"] == "P2-05")
        self.assertIn("12 CONFIRMED-SHARED-WRITE-CONTEXT-UI", p25["evidence_grade_and_type"])
        self.assertIn("0 RECEIVER-OTHER", p25["evidence_grade_and_type"])
        p26 = next(r for r in mx if r["requirement_id"] == "P2-06")
        self.assertEqual(p26["readiness"], "DESIGN-DECISION")


class EvidenceHashChain(unittest.TestCase):
    """WP3: canonical Evidence SHA must match the actual source files."""

    def test_modified_evidence_hashes_canonical(self):
        from evidence_canonical import canonical_sha256
        for eid in ("EV-93", "EV-94", "EV-95", "EV-96", "EV-97"):
            ev = next(e for e in _read(REPO / "research/source-of-truth/evidence.csv")
                      if e["evidence_id"] == eid)
            p = REPO / ev["source_file"]
            self.assertEqual(ev["source_sha256"], canonical_sha256(p),
                             f"{eid} hash mismatch")

    def test_cleanroom_synced_to_source_of_truth(self):
        for cc, sot in (("CLAIM-CONSISTENCY-REGISTER.csv", "claims.csv"),
                        ("GAP-REGISTER.csv", "gaps.csv"),
                        ("EVIDENCE-INDEX.csv", "evidence.csv"),
                        ("ISSUE-CROSSWALK.csv", "issue-crosswalk.csv")):
            a = (REPO / "research/result/clean-room" / cc).read_bytes()
            b = (REPO / "research/source-of-truth" / sot).read_bytes()
            self.assertEqual(a.replace(b"\r\n", b"\n"),
                             b.replace(b"\r\n", b"\n"), f"{cc} out of sync")

    def test_ledger_counts_unchanged(self):
        # t089 migration: 109->115 claims, 97->103 evidence (C-110..C-115/EV-98..EV-103)
        self.assertEqual(len(_read(REPO / "research/source-of-truth/claims.csv")), 115)
        self.assertEqual(len(_read(REPO / "research/source-of-truth/evidence.csv")), 103)
        self.assertEqual(len(_read(REPO / "research/source-of-truth/gaps.csv")), 41)


class GeneratorSourceRegressions(unittest.TestCase):
    """The generator itself must not carry the double-BASE write pattern."""

    def test_wp1_generator_has_no_double_base_write(self):
        src = (SCRIPTS / "t088_wp1_id31d_census.py").read_text(encoding="utf-8")
        self.assertIn('f"{call_va:#010x}" if call_va else ""', src)
        self.assertNotIn('f"{call_off + BASE:#010x}" if call_off else ""', src)
        self.assertIn("verify_create_call", src)

    def test_wp4_generator_has_no_blind_regex(self):
        src = (SCRIPTS / "t088_wp4_scene_portal.py").read_text(encoding="utf-8")
        body = src.split('"""', 2)[2]      # code after the module docstring
        self.assertNotIn('re.finditer(rb".\\xb0\\x00\\x00", blob)', body)
        self.assertIn("BASE_TABLE_INSTALLS", body)


if __name__ == "__main__":
    unittest.main()
