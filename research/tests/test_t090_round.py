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


class G39WZForensics(unittest.TestCase):
    """T090 WP1: original-WZ frame census + engine default facts."""

    CENSUS = FORENSICS / "T090-G39-WZ-FRAME-CENSUS.csv"
    MATRIX = FORENSICS / "T090-G39-DEFAULT-CONSUMER-MATRIX.csv"
    DURATIONS = FORENSICS / "T090-G39-PORTAL-DURATIONS.csv"

    @classmethod
    def setUpClass(cls):
        _require(cls.CENSUS, cls.MATRIX, cls.DURATIONS)
        cls.rows = _read_csv(cls.CENSUS)
        cls.matrix = _read_csv(cls.MATRIX)
        cls.durations = _read_csv(cls.DURATIONS)

    def test_census_totals(self):
        self.assertEqual(len(self.rows), 4347)
        expl = [r for r in self.rows if r["delay_explicit"] == "True"]
        self.assertEqual(len(expl), 2450)
        vals = {int(r["delay"]) for r in expl}
        self.assertEqual(len(vals), 44)
        self.assertIn(120, vals)      # 120 is ONE of 35 — not universal
        self.assertIn(4000, vals)
        self.assertIn(100, vals)

    def test_default_dependent_resources_exist(self):
        # 225 multi-frame resources with no explicit delay -> consumer default
        # path genuinely exercised (do NOT normalize to 120)
        from collections import defaultdict
        per_res = defaultdict(lambda: [0, 0])
        for r in self.rows:
            if not r["resource_path"]:
                continue
            per_res[r["resource_path"]][1] += 1
            if r["delay_explicit"] == "True":
                per_res[r["resource_path"]][0] += 1
        multi = [v for v in per_res.values() if v[1] > 1]
        all_default = [v for v in multi if v[0] == 0]
        self.assertEqual(len(all_default), 225)

    def test_portal_frames_delayless(self):
        from collections import defaultdict
        pv = [r for r in self.rows
              if r["resource_path"] == "portal/game/pv"]
        self.assertEqual(len(pv), 8)
        self.assertTrue(all(r["delay"] == "" for r in pv))
        for sub, n in (("default/portalStart/", 4), ("default/portalContinue/", 7),
                       ("default/portalExit/", 3)):
            fr = [r for r in self.rows
                  if r["resource_path"] == "portal/game/ph" and r["frame"].startswith(sub)]
            self.assertEqual(len(fr), n, sub)
            self.assertTrue(all(r["delay"] == "" for r in fr), sub)
        # the only explicit portal timing: psh/1
        expl = [r for r in self.rows if r["consumer"] == "portal/game"
                and r["delay_explicit"] == "True"]
        self.assertEqual(sorted(r["delay"] for r in expl), ["1500", "1500"])

    def test_default_matrix_distribution(self):
        from collections import Counter
        dist = Counter(r["default_value"] for r in self.matrix)
        self.assertEqual(dist["120"], 18)
        self.assertEqual(dist["150"], 2)
        self.assertEqual(dist["60"], 2)
        self.assertEqual(dist["180"], 3)
        self.assertEqual(dist["1000"], 2)
        # register seeds (ebx/eax/edi/ecx) = 9
        self.assertEqual(sum(v for k, v in dist.items()
                             if k in ("ebx", "eax", "edi", "ecx")), 9)

    def test_portal_flat_default_zero(self):
        r = next(r for r in self.matrix if r["site"] == "0x71A72A")
        self.assertEqual(r["resolved_default"].split(" ")[0], "0")
        self.assertIn("0x71A203", r["function_head"])
        self.assertIn("portal-graphics", r["family"])

    def test_durations_default120_column(self):
        by = {r["family"]: r for r in self.durations}
        self.assertEqual(by["pv"]["duration_if_default_120"], "960")
        self.assertEqual(by["portalStart (ph/default)"]["duration_if_default_120"], "480")
        self.assertEqual(by["portalContinue (ph/default)"]["duration_if_default_120"], "840")
        self.assertEqual(by["portalExit (ph/default)"]["duration_if_default_120"], "360")
        self.assertEqual(by["pv"]["duration_if_default_0"], "0")

    def test_timeline_model_semantics(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "t090_model", REPO / "research/scripts/t090_wp1d_timeline_model.py")
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        # explicit delays accumulate in tick units at default scale
        tl = m.timeline([120, 130, 250], scale=1000)
        self.assertEqual(tl["end_timestamps"], [120, 250, 500])
        # unsigned per-frame div vs signed total idiv: end += delay*scale/1000
        q, rem = m.frame_advance(1999, 1000)
        self.assertEqual((q, rem), (1999, 0))
        q, rem = m.frame_advance(1, 500)      # truncation: 500/1000 = 0
        self.assertEqual((q, rem), (0, 500))
        # repeat triage
        self.assertEqual(m.timeline([10], repeat=5)["mode"], 0x20)
        self.assertEqual(m.timeline([10], repeat=-1)["mode"], 0)
        self.assertEqual(m.timeline([10], repeat=-2)["mode"], 0x10)
        # 32-bit wrap: imul truncates to 32 bits, then unsigned div
        self.assertEqual(m.frame_advance(0xFFFFFFFF, 1000)[0],
                         ((0xFFFFFFFF * 1000) % (1 << 32)) // 1000)
        # non-multiple scale
        self.assertEqual(m.frame_advance(1000, 1500)[0], 1500)

    def test_animation_scale_default_claim(self):
        # C-117: accumulator slot +0x110 of the primary table; default 1000
        import struct
        data = open(GR2D, "rb").read() if GR2D.exists() else b""
        if not data:
            self.skipTest("gr2d not present")
        _require(GR2D)
        off = 0x5042E500 - 0x50400000
        self.assertEqual(struct.unpack("<I", data[off:off + 4])[0], 0x5040B9DE)
        # the coercion fast path stores arg3 (0x3E8) — bytes at 0x5040283D
        off2 = 0x5040283D - 0x50400000
        seq = data[off2:off2 + 0x11]
        self.assertEqual(seq[0], 0x8B)  # mov eax,[ebp+0x10]
        # caller pushes 0x3E8 before the call at 0x5040B9F5
        off3 = 0x5040B9F5 - 0x50400000
        self.assertEqual(data[off3:off3 + 5], b"\x68\xe8\x03\x00\x00")


class G36Slot9CAndLayout(unittest.TestCase):
    """T090 WP2: +0x9C decode + 13-map layout."""

    @classmethod
    def setUpClass(cls):
        cls.disasm = FORENSICS / "T090-G36-SLOT9C-DISASM.txt"
        cls.layout = FORENSICS / "T090-G36-13MAP-LAYOUT.csv"
        _require(cls.disasm, cls.layout)

    def test_slot9c_body_facts(self):
        t = self.disasm.read_text(encoding="utf-8")
        self.assertIn("514086B3", t)
        self.assertIn("ret 0x34", t)
        self.assertIn("0xffffff", t)
        self.assertIn("0x80070057", t)   # E_INVALIDARG
        # both vector-family tables carry +0x9C = 0x514086b3
        self.assertIn("+0x9C=0x514086b3", t)
        # EXE census = 8 sites
        self.assertIn("sites: 8", t)

    def test_slot9c_vtable_dwords(self):
        import struct
        _require(SHAPE)
        data = SHAPE.read_bytes()
        for tbl in (0x5140C2F0, 0x5140C0FC):
            off = tbl - 0x51400000
            self.assertEqual(struct.unpack("<I", data[off + 0x9C:off + 0xA0])[0],
                             0x514086B3, hex(tbl))

    def test_layout_record_count(self):
        rows = _read_csv(self.layout)
        self.assertEqual(len(rows), 387)
        fronts = [r for r in rows if r.get("front") == "1"]
        self.assertEqual(len(fronts), 26)
        maps = {r["map"] for r in rows}
        self.assertEqual(len(maps), 13)


class G10FilterChainAndSites(unittest.TestCase):
    """T090 WP4: filter consumer chain + arg3 refinement + residual sites."""

    DOC = FORENSICS / "T090-G10-FILTER-CONSUMERS.md"
    ARG3 = FORENSICS / "T090-G10-ARG3-POSITION-WRITERS.csv"
    SITES = FORENSICS / "T090-G10-RESIDUAL-SLOT90-CLASSIFICATION.csv"

    @classmethod
    def setUpClass(cls):
        _require(cls.DOC, cls.ARG3, cls.SITES)

    def test_wrapper_chain_claim(self):
        t = self.DOC.read_text(encoding="utf-8")
        for fact in ("0x51407340", "0x51408C9A", "0x51406ADC", "0x51406CF7",
                     "0x51407A34", "0 sites"):
            self.assertIn(fact, t)

    def test_getter_routing_bytes(self):
        # X/Y getters branch on [this+0x24]: NULL -> raw field; else resolver
        _require(SHAPE)
        data = SHAPE.read_bytes()
        # GetX 0x5140724A: 8B 44 24 0C ... 8B 4A 24 (mov ecx,[edx+0x24]) ...
        off = 0x5140724A - 0x51400000
        body = data[off:off + 0x35]
        self.assertIn(b"\x8b\x4a\x24", body)          # mov ecx,[edx+0x24]
        self.assertIn(b"\x8b\x42\x1c", body)          # mov eax,[edx+0x1c]
        self.assertIn(b"\xe8", body[0x20:])           # call resolver
        off2 = 0x514074C8 - 0x51400000
        body2 = data[off2:off2 + 0x35]
        self.assertIn(b"\x8b\x4a\x24", body2)
        self.assertIn(b"\x8b\x42\x20", body2)         # mov eax,[edx+0x20]

    def test_commit_creates_wrapper_bytes(self):
        _require(SHAPE)
        data = SHAPE.read_bytes()
        off = 0x51408C9A - 0x51400000
        body = data[off:off + 0x18]
        self.assertIn(b"\x8b\x44\x24\x04", body)      # mov eax,[esp+4]
        self.assertIn(b"\xe8", body)                  # call 0x514072cf

    def test_arg3_table(self):
        rows = _read_csv(self.ARG3)
        self.assertEqual(len(rows), 10)
        zeros = [r for r in rows if r["arg3_class"] == "zero"]
        objs = [r for r in rows if r["arg3_class"] == "object"]
        self.assertEqual(len(zeros), 8)
        self.assertEqual(len(objs), 2)
        by = {r["caller"]: r for r in rows}
        # the 0x990E21/0x990E91 correction
        self.assertIn("esi = 0", by["0x990E21"]["arg3_provenance"])
        self.assertIn("CORRECTS", by["0x990E21"]["notes"])
        self.assertIn("esi = 0", by["0x990E91"]["arg3_provenance"])
        # 0x959493 caller-dependent note
        self.assertIn("[ebp+0x20]", by["0x959493"]["arg3_provenance"])

    def test_residual_site_classification(self):
        rows = _read_csv(self.SITES)
        self.assertEqual(len(rows), 25)
        from collections import Counter
        dist = Counter(r["t090_classification"] for r in rows)
        self.assertEqual(dist["SHARED-WRITE-CONTEXT-POSSIBLE"], 18)
        self.assertEqual(dist["RECEIVER-OTHER-POSSIBLE"], 7)
        for r in rows:
            self.assertTrue(r["reason"].strip(), f"{r['slot90_va']} lacks reason")
            self.assertIn("INCONCLUSIVE", r["t088_classification"])

    def test_a4_query_census_zero(self):
        # EXE call [reg+0xA4] census = 0 (all modrm forms) — re-derived here
        import struct
        _require(EXE)
        data = EXE.read_bytes()
        sites = 0
        for off in range(0x401000 - 0x400000, 0xBEA000 - 0x400000 - 8):
            if data[off] != 0xFF:
                continue
            modrm = data[off + 1]
            if (modrm >> 3) & 7 != 2:
                continue
            mod = modrm >> 6
            rm = modrm & 7
            d = None
            if rm == 4:
                if mod == 1:
                    d = struct.unpack("<b", data[off + 3:off + 4])[0]
                elif mod == 2:
                    d = struct.unpack("<i", data[off + 2:off + 6])[0]
            elif mod == 1:
                d = struct.unpack("<b", data[off + 2:off + 3])[0]
            elif mod == 2:
                d = struct.unpack("<i", data[off + 2:off + 6])[0]
            if d == 0xA4:
                sites += 1
        self.assertEqual(sites, 0)


class GapClosureIntegrityT090(unittest.TestCase):
    """T090: no gap migrated without full conditions; statuses honest."""

    def test_no_status_migration_this_round(self):
        gaps = {r["gap_id"]: r["status"] for r in _read_csv(SOT / "gaps.csv")}
        # T090 narrowed but did not close any gap (portal default / arg3
        # writers / pump phase residuals retained)
        for gid in ("G10", "G36", "G37", "G39"):
            self.assertEqual(gaps[gid], "PARTIAL-STATIC", gid)
        self.assertEqual(gaps["G35"], "CLOSED-STATIC")  # not reopened

    def test_new_claims_registered(self):
        claims = {r["claim_id"]: r for r in _read_csv(SOT / "claims.csv")}
        for cid in ("C-116", "C-117", "C-118", "C-119"):
            self.assertIn(cid, claims)
            self.assertEqual(claims[cid]["status"], "CLOSED-STATIC")
            self.assertEqual(claims[cid]["evidence_grade"], "A")
        ev = {r["evidence_id"] for r in _read_csv(SOT / "evidence.csv")}
        for eid in ("EV-104", "EV-105", "EV-106", "EV-107"):
            self.assertIn(eid, ev)

    def test_ledger_counts(self):
        claims = _read_csv(SOT / "claims.csv")
        gaps = _read_csv(SOT / "gaps.csv")
        ev = _read_csv(SOT / "evidence.csv")
        # t091 migration: 119->120 claims (C-120), 107->108 evidence (EV-108)
        self.assertEqual(len(claims), 120)
        self.assertEqual(len(ev), 108)
        self.assertEqual(len(gaps), 41)

    def test_mapwz_identity_recorded(self):
        ev = {r["evidence_id"]: r for r in _read_csv(SOT / "evidence.csv")}
        self.assertEqual(ev["EV-104"]["source_sha256"],
                         "9e0d2a0fcecac2c99ee3cb15b03c41b5617d7d0637b55fb132f0eeed27155f69")


if __name__ == "__main__":
    unittest.main()
