"""T090 round guards: WP0 canonical errata regressions (C-109/C-115 focus-source
conflict, OpenMS matrix statistics reconciliation, gap-closure audit reviewer
statuses), plus (added as the round progresses) G39 WZ frame-delay forensics,
G36 +0x9C decode, G10 arg3 receiver classification, and gap-closure integrity."""
import csv
import hashlib
import os
import struct
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SOT = REPO / "research/source-of-truth"
SR = REPO / "research/result/stage-readiness"
FORENSICS = SR / "forensics"

EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
SHAPE = REPO / ".work/task-063/client-stage/Shape2D.dll"
SHAPE_SHA = "9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b"
GR2D = REPO / ".work/task-063/client-stage/Gr2D_DX8.dll"
GR2D_SHA = "ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1"
BASE = 0x400000
CODE_LO, CODE_HI = 0x401000, 0xBEA000

WZ_DIR = REPO / ".work/task-001/extracted"
MAP_WZ_SHA = "9e0d2a0fcecac2c99ee3cb15b03c41b5617d7d0637b55fb132f0eeed27155f69"


def _sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _read_csv(path):
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _u32(data, va):
    return struct.unpack("<I", data[va - BASE:va - BASE + 4])[0]


def _require(*paths):
    missing = [str(p) for p in paths if not p.exists()]
    if missing:
        raise unittest.SkipTest(f"sample not present: {missing}")


class WP0AFocusSourceConflict(unittest.TestCase):
    """The t088 `src = [[this+0xF28]+0x14]` reading must stay demoted to
    historical inference; the current-effective C-109 text must carry the
    byte-proven `[[arg3]+0x14]` Set path with the (this, record, N, arg3) ABI."""

    @classmethod
    def setUpClass(cls):
        cls.claims = {r["claim_id"]: r for r in _read_csv(SOT / "claims.csv")}
        cls.c109 = cls.claims["C-109"]["claim"]
        cls.c115 = cls.claims["C-115"]["claim"]

    def test_c109_current_effective_source_is_arg3(self):
        self.assertIn("src = [[arg3]+0x14]", self.c109)
        self.assertIn("0x93CB27(this, record, N, arg3)", self.c109)
        self.assertIn("ret 0xC", self.c109)
        self.assertIn("0x769B51 is ret 4", self.c109)

    def test_c109_old_source_marked_historical(self):
        # the old expression may only appear inside the HISTORICAL marker
        self.assertIn("HISTORICAL t088 INFERENCE, SUPERSEDED", self.c109)
        i = self.c109.find("[[this+0xF28]+0x14]")
        self.assertNotEqual(i, -1, "historical record must be preserved")
        window = self.c109[max(0, i - 260):i + 200]
        self.assertIn("HISTORICAL t088 INFERENCE", window)
        self.assertIn("SKIPS the Set", window)

    def test_c109_preserved_facts(self):
        # 10 E8 callers, Set address, branch gates survive the correction
        for site in ("0x5C0342", "0x93E00B", "0x959493", "0x959527", "0x964E16",
                     "0x9651CC", "0x965567", "0x98DC43", "0x990E21", "0x990E91"):
            self.assertIn(site, self.c109)
        self.assertIn("0x93CC9B", self.c109)
        self.assertIn("0x4F5C6A", self.c109)
        self.assertIn("0xD7511E", self.c109)
        self.assertIn("[this+0x3B8]==0", self.c109)

    def test_c115_qualifies_c109_without_reversal(self):
        self.assertIn("refines C-109", self.claims["C-115"]["supersedes"])
        self.assertIn("[[arg3]+0x14]", self.c115)

    def test_two_dataflows_not_conflated(self):
        # WP0-A guard: arg3 and [user+0xF28] must stay two dataflows pending proof
        self.assertIn("whether any caller's arg3 aliases [this+0xF28]", self.c109)

    def test_ev94_annotation(self):
        ev = {r["evidence_id"]: r for r in _read_csv(SOT / "evidence.csv")}
        self.assertIn("t090 WP0-A", ev["EV-94"]["interpretation"])
        self.assertIn("[[arg3]+0x14]", ev["EV-94"]["interpretation"])

    def test_matrix_residuals_use_arg3(self):
        mx = (SR / "P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv").read_text(encoding="utf-8")
        self.assertNotIn("[[user+0xF28]+0x14]", mx)
        self.assertIn("[[arg3]+0x14]", mx)

    def test_t088_historical_docs_carry_erratum(self):
        for rel, marker in [
            ("T088-CAMERA-CADENCE-WRITER-CLOSURE-REPORT.md", "t090 WP0-A 勘误"),
            ("forensics/T088-CAMERA-CADENCE-DEADZONE.md", "t090 WP0-A erratum"),
        ]:
            t = (SR / rel).read_text(encoding="utf-8")
            self.assertIn(marker, t, rel)

    def test_ev96_hash_canonical(self):
        ev = {r["evidence_id"]: r for r in _read_csv(SOT / "evidence.csv")}
        p = REPO / ev["EV-96"]["source_file"]
        data = p.read_bytes().replace(b"\r\n", b"\n")
        self.assertEqual(ev["EV-96"]["source_sha256"],
                         hashlib.sha256(data).hexdigest())


class WP0BMatrixStatistics(unittest.TestCase):
    """Auto-summary of the T089 match matrix; the report must carry the
    recounted numbers (24 rows / 16 MATCH-class / 2 REFUTED / 2 INCONCLUSIVE /
    1 internal RESOLVED / 3 NOT-RUN; 22 external, 19 executed)."""

    @classmethod
    def setUpClass(cls):
        cls.rows = _read_csv(SR / "T089-OPENMS-CMS079-MATCH-MATRIX.csv")
        cls.report = (SR / "T089-OPENMS-STATIC-GAP-CLOSURE-REPORT.md").read_text(encoding="utf-8")

    def test_row_counts(self):
        self.assertEqual(len(self.rows), 24)
        verdicts = [r["verdict"] for r in self.rows]

        def is_match(v):
            return v.startswith("MATCH")

        self.assertEqual(sum(1 for v in verdicts if is_match(v)), 16)
        self.assertEqual(sum(1 for v in verdicts if v.startswith("REFUTED")), 2)
        self.assertEqual(sum(1 for v in verdicts if v.startswith("INCONCLUSIVE")), 2)
        self.assertEqual(sum(1 for v in verdicts if v == "RESOLVED"), 1)
        self.assertEqual(sum(1 for v in verdicts if v == "NOT-RUN"), 3)

    def test_internal_vs_external_split(self):
        internal = [r for r in self.rows if r["external_version"] == "n/a"]
        self.assertEqual(len(internal), 2)
        external = [r for r in self.rows if r["external_version"] != "n/a"]
        self.assertEqual(len(external), 22)
        executed = [r for r in external if r["verdict"] != "NOT-RUN"]
        self.assertEqual(len(executed), 19)
        self.assertEqual(sum(1 for r in executed if r["verdict"].startswith("MATCH")), 16)
        self.assertEqual(sum(1 for r in executed if r["verdict"].startswith("REFUTED")), 1)
        self.assertEqual(sum(1 for r in executed if r["verdict"].startswith("INCONCLUSIVE")), 2)

    def test_report_carries_recounted_numbers(self):
        self.assertIn("t090 WP0-B 勘误", self.report)
        self.assertIn("24 数据行", self.report)
        self.assertIn("外部 OpenMS 候选 = 22 项：已执行 19，未执行 3", self.report)
        # the wrong T089 numbers must not survive as current statistics
        self.assertNotIn("矩阵 26 行中 22 行为本轮执行，4 行 NOT-RUN", self.report)


class WP0CGapClosureAudit(unittest.TestCase):
    """Reviewer opinions archived from the real Phase-2/3/4 record; G40 start
    status corrected; `n/a` end statuses replaced with authoritative ones; G35
    stays CLOSED-STATIC; no gap migrates."""

    @classmethod
    def setUpClass(cls):
        cls.audit = _read_csv(SR / "T089-GAP-CLOSURE-AUDIT.csv")
        cls.gaps = {r["gap_id"]: r["status"] for r in _read_csv(SOT / "gaps.csv")}

    def test_no_pending_opinions(self):
        pending = [r["gap_id"] for r in self.audit if r["reviewer_opinion"] == "pending"]
        self.assertEqual(pending, [])

    def test_targeted_gap_opinions_cite_phases(self):
        by_id = {r["gap_id"]: r for r in self.audit}
        for gid in ("G35", "G36", "G37", "G39", "G10"):
            self.assertIn("archived-ACCEPT", by_id[gid]["reviewer_opinion"], gid)
            self.assertIn("T089-REVIEWER-INDEPENDENT.md", by_id[gid]["reviewer_opinion"], gid)

    def test_g40_statuses_authoritative(self):
        by_id = {r["gap_id"]: r for r in self.audit}
        self.assertEqual(by_id["G40"]["start_status"], "PARTIAL-STATIC")
        self.assertEqual(by_id["G40"]["end_status"], "PARTIAL-STATIC")
        self.assertEqual(self.gaps["G40"], "PARTIAL-STATIC")

    def test_no_na_end_status_for_real_gaps(self):
        for r in self.audit:
            self.assertNotEqual(r["end_status"], "n/a", f"{r['gap_id']} still n/a")

    def test_end_statuses_match_authoritative_gaps(self):
        for r in self.audit:
            self.assertEqual(r["end_status"], self.gaps[r["gap_id"]], r["gap_id"])

    def test_g35_stays_closed(self):
        self.assertEqual(self.gaps["G35"], "CLOSED-STATIC")
        by_id = {r["gap_id"]: r for r in self.audit}
        self.assertEqual(by_id["G35"]["end_status"], "CLOSED-STATIC")

    def test_matrix_reviewer_rulings_reconciled(self):
        rows = _read_csv(SR / "T089-OPENMS-CMS079-MATCH-MATRIX.csv")
        for r in rows:
            if r["verdict"] == "NOT-RUN":
                self.assertEqual(r["reviewer_ruling"], "n/a")
            else:
                self.assertIn(r["reviewer_ruling"],
                              ("phase2-verified",
                               "phase4-round-accept (row not individually re-derived by reviewer)"))

    def test_reviewer_archive_encoding_clean(self):
        """The archived T089 reviewer record must remain valid UTF-8 without
        mojibake artifacts (the phase-4 archive commit re-saved it; guard it)."""
        raw = (FORENSICS / "T089-REVIEWER-INDEPENDENT.md").read_bytes()
        text = raw.decode("utf-8")  # raises on invalid utf-8
        self.assertEqual(text.count("锛"), 1)  # only inside the phase-4 artifact description
        self.assertNotIn("\ufffd", text)


if __name__ == "__main__":
    unittest.main()
