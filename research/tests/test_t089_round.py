"""T089 round guards: G35 background key formula (both branches + census),
namespace name proofs (front/delay/a0/a1/repeat/portal family), G39 delay
default + Gr2D accumulator + repeat triage, G36 parallax evaluator, G10 camera
filter constants + commit sites, FSDB portal frame counts, ledger integrity
(claims 115 / evidence 103 / G35 CLOSED), matrix rows."""
import csv
import json
import os
import struct
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXE = REPO / ".work/task-036/game-image-unpacked.bin"
EXE_SHA = "d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718"
SHAPE = REPO / ".work/task-063/client-stage/Shape2D.dll"
SHAPE_SHA = "9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b"
GR2D = REPO / ".work/task-063/client-stage/Gr2D_DX8.dll"
GR2D_SHA = "ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1"
BASE = 0x400000

SOT = REPO / "research/source-of-truth"
FORENSICS = REPO / "research/result/stage-readiness/forensics"


def _sha(path):
    import hashlib
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _require_binaries():
    return EXE.exists() and SHAPE.exists() and GR2D.exists()


# ---------- namespace decryption (cipher per C-103) ----------

def _decrypt_id(data, sid):
    def u32(va):
        return struct.unpack("<I", data[va - BASE:va - BASE + 4])[0]

    def rot_bytes(arr, n):
        ln = len(arr)
        n %= ln
        return arr[n:] + arr[:n]

    def rot_bits(arr, shift):
        ln = len(arr)
        if ln == 0 or shift % 8 == 0:
            return arr[:]
        val = int.from_bytes(arr, "big")
        val = ((val << shift) | (val >> (ln * 8 - shift))) & ((1 << (ln * 8)) - 1)
        return val.to_bytes(ln, "big")

    keyva = 0xB07640
    rec = u32(0xBA7B04 + sid * 4)
    off = rec - BASE
    rtype = data[off]
    cipher = data[off + 1:off + 128].split(b"\0")[0]
    key_len = u32(keyva + 0x10)
    key = bytearray(data[keyva - BASE:keyva - BASE + key_len])
    if rtype:
        if rtype >= 8:
            key = bytearray(rot_bytes(bytes(key), (rtype // 8) % key_len))
        shift = rtype & 7
        if shift:
            key = bytearray(rot_bits(bytes(key), shift))
    out = bytearray()
    for i, c in enumerate(cipher):
        p = c ^ key[i % len(key)]
        if p == 0:
            p = key[i % len(key)]
        out.append(p)
    return bytes(out)


@unittest.skipUnless(_require_binaries(), "original binaries not present")
class TestG35BackgroundKey(unittest.TestCase):
    """C-110/EV-98: back B-128000+idx*1000 / front B+271200+idx*1000."""

    @classmethod
    def setUpClass(cls):
        import hashlib
        assert _sha(EXE) == EXE_SHA
        cls.data = EXE.read_bytes()

    def test_key_branch_bytes(self):
        d = self.data
        # front branch (fallthrough)
        self.assertEqual(d[0x669923 - BASE:0x669929 - BASE].hex(), "69c0e8030000")
        self.assertEqual(d[0x669929 - BASE:0x66992E - BASE].hex(), "2da0dcfb3f")  # sub 0x3FFBDCA0
        # back branch (jump target)
        self.assertEqual(d[0x669930 - BASE:0x669936 - BASE].hex(), "69c0e8030000")
        self.assertEqual(d[0x669936 - BASE:0x66993B - BASE].hex(), "2d00f40140")  # sub 0x4001F400
        # branch polarity: cmp esi,ebx at 0x66991C; je back-branch at 0x669921
        self.assertEqual(d[0x66991C - BASE:0x66991E - BASE].hex(), "3bf3")
        self.assertEqual(d[0x669921 - BASE:0x669923 - BASE].hex(), "740d")

    def test_formula_values(self):
        B = -(0x40000000)
        self.assertEqual(B - 128000, -(0x4001F400))
        self.assertEqual(B + 271200, -(0x3FFBDCA0))
        # GMS083 candidate must NOT equal the CMS079 front constant
        self.assertNotEqual(B + 271200, B + 272000)

    def test_index_is_enumeration_arg(self):
        # caller loop feeds edi as arg1: push edi at 0x669351, call 0x669397 at 0x669354
        d = self.data
        self.assertEqual(d[0x669351 - BASE], 0x57)          # push edi
        self.assertEqual(d[0x669354 - BASE], 0xE8)
        rel = int.from_bytes(d[0x669355 - BASE:0x669359 - BASE], "little", signed=True)
        self.assertEqual(0x669354 + 5 + rel, 0x669397)

    def test_imul1000_census_size(self):
        # 61 sites image-wide (supersedes EV-20's 'exactly 1')
        d = self.data
        n = 0
        for i in range(len(d) - 6):
            if d[i] == 0x69 and d[i + 2:i + 6] == b"\xe8\x03\x00\x00":
                n += 1
        self.assertEqual(n, 61)

    def test_front_property_name(self):
        self.assertEqual(_decrypt_id(self.data, 0x54B), b"front")

    def test_fsdb_census_file(self):
        txt = (FORENSICS / "T089-G35-FSDB-CENSUS.txt").read_text(encoding="utf-8")
        self.assertIn("TOTAL: 387 records, front=1 x26", txt)


@unittest.skipUnless(_require_binaries(), "original binaries not present")
class TestG39FrameTiming(unittest.TestCase):
    """C-112/C-113: delay default 120, accumulator /1000, repeat triage, portal family."""

    @classmethod
    def setUpClass(cls):
        import hashlib
        assert _sha(EXE) == EXE_SHA
        assert _sha(GR2D) == GR2D_SHA
        cls.exe = EXE.read_bytes()
        cls.gr2d = GR2D.read_bytes()

    def test_delay_default_120_pairing(self):
        d = self.exe
        self.assertEqual(d[0x43EC79 - BASE:0x43EC7B - BASE].hex(), "6a78")   # push 0x78
        self.assertEqual(d[0x43EC81 - BASE:0x43EC86 - BASE].hex(), "685d150000")  # push 0x155D

    def test_delay_site_count(self):
        d = self.exe
        pat = struct.pack("<I", 0x155D)
        sites = 0
        k = d.find(pat, 0x1000)
        while k != -1:
            if d[k - 1] == 0x68 and 0x401000 <= BASE + k - 1 <= 0xA80000:
                sites += 1
            k = d.find(pat, k + 1)
        self.assertEqual(sites, 36)

    def test_timing_property_names(self):
        self.assertEqual(_decrypt_id(self.exe, 0x155D), b"delay")
        self.assertEqual(_decrypt_id(self.exe, 0x1550), b"a0")
        self.assertEqual(_decrypt_id(self.exe, 0x1551), b"a1")
        self.assertEqual(_decrypt_id(self.exe, 0x8D4), b"repeat")

    def test_gr2d_frame_writer_layout(self):
        # 0x5040ACE3: mov [edx+0x0C],eax (delay); 0x5040ACF7: [edx+0x10] (a0); 0x5040AD07: [edx+0x14] (a1)
        g = self.gr2d
        off = 0x5040ACE3 - 0x50401000 + 0x1000  # file offset via linear probe below
        # compute file offset via PE sections
        import pefile
        pe = pefile.PE(data=g, fast_load=True)
        def foff(va):
            rva = va - pe.OPTIONAL_HEADER.ImageBase
            for s in pe.sections:
                if s.VirtualAddress <= rva < s.VirtualAddress + max(s.Misc_VirtualSize, s.SizeOfRawData):
                    return s.PointerToRawData + rva - s.VirtualAddress
            raise ValueError(hex(va))
        self.assertIn(g[foff(0x5040ACE3):foff(0x5040ACE3) + 3].hex(), ("89420c", "89500c"))
        self.assertIn(g[foff(0x5040ACF7):foff(0x5040ACF7) + 3].hex(), ("894210", "895010"))
        self.assertIn(g[foff(0x5040AD07):foff(0x5040AD07) + 3].hex(), ("894214", "895014"))

    def test_gr2d_accumulator_div1000(self):
        import pefile
        g = self.gr2d
        pe = pefile.PE(data=g, fast_load=True)
        def foff(va):
            rva = va - pe.OPTIONAL_HEADER.ImageBase
            for s in pe.sections:
                if s.VirtualAddress <= rva < s.VirtualAddress + max(s.Misc_VirtualSize, s.SizeOfRawData):
                    return s.PointerToRawData + rva - s.VirtualAddress
            raise ValueError(hex(va))
        # mov ecx,0x3E8 at 0x5040BC60 (signed total) and 0x5040BCD0 (unsigned per-frame)
        self.assertEqual(g[foff(0x5040BC60):foff(0x5040BC60) + 5].hex(), "b9e8030000")
        self.assertEqual(g[foff(0x5040BCD0):foff(0x5040BCD0) + 5].hex(), "b9e8030000")

    def test_repeat_triage_bytes(self):
        d = self.exe
        self.assertEqual(d[0x66F937 - BASE:0x66F93A - BASE].hex(), "83f8ff")   # cmp eax,-1
        self.assertEqual(d[0x66F9C4 - BASE:0x66F9C7 - BASE].hex(), "83f8fe")   # cmp eax,-2
        self.assertEqual(d[0x66F8F9 - BASE:0x66F8FB - BASE].hex(), "6a20")     # push 0x20 (loop)
        self.assertEqual(d[0x66FA44 - BASE:0x66FA46 - BASE].hex(), "6a10")     # push 0x10 (one-shot)
        self.assertEqual(d[0x66F986 - BASE:0x66F988 - BASE].hex(), "6a00")     # push 0 (mode 0)

    def test_portal_ids_and_fsdb_counts(self):
        self.assertEqual(_decrypt_id(self.exe, 0x601), b"pv")
        self.assertEqual(_decrypt_id(self.exe, 0xF7D), b"portalStart")
        self.assertEqual(_decrypt_id(self.exe, 0xF7E), b"portalContinue")
        self.assertEqual(_decrypt_id(self.exe, 0xF7F), b"portalExit")
        p = REPO / "content/[FSDB]adventure/[group]map.HelperFrame/map.helper.jsonl"
        rows = [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]
        counts = {}
        for r in rows:
            if r["branch"] == "portal" and r.get("use") == "game":
                key = (r["name"], r["resource"].split("/")[-2] if r["name"] != "pv" else "pv")
                counts[key] = counts.get(key, 0) + 1
        self.assertEqual(counts[("pv", "pv")], 8)
        self.assertEqual(counts[("ph", "portalStart")], 4)
        self.assertEqual(counts[("ph", "portalContinue")], 7)
        self.assertEqual(counts[("ph", "portalExit")], 3)


@unittest.skipUnless(_require_binaries(), "original binaries not present")
class TestG36ParallaxEngine(unittest.TestCase):
    """C-111/EV-99: attach + evaluator in Shape2D; vtable slots."""

    @classmethod
    def setUpClass(cls):
        import hashlib
        assert _sha(SHAPE) == SHAPE_SHA
        cls.s = SHAPE.read_bytes()
        import pefile
        pe = pefile.PE(data=cls.s, fast_load=True)
        cls.base = pe.OPTIONAL_HEADER.ImageBase
        def foff(va):
            rva = va - cls.base
            for sec in pe.sections:
                if sec.VirtualAddress <= rva < sec.VirtualAddress + max(sec.Misc_VirtualSize, sec.SizeOfRawData):
                    return sec.PointerToRawData + rva - sec.VirtualAddress
            raise ValueError(hex(va))
        cls.foff = staticmethod(foff)

    def test_evaluator_idiv_truncation(self):
        # X axis: imul eax,[esi+0x1C]; cdq; idiv [esi+0x14]
        s = self.s
        o = self.foff(0x514085D8)
        self.assertEqual(s[o:o + 4].hex(), "0faf461c")
        self.assertEqual(s[self.foff(0x514085DC):self.foff(0x514085DC) + 1].hex(), "99")
        self.assertEqual(s[self.foff(0x514085DD):self.foff(0x514085DD) + 3].hex(), "f77e14")

    def test_vtable_slots(self):
        s = self.s
        self.assertEqual(struct.unpack("<I", s[self.foff(0x5140C2F0 + 0x90):self.foff(0x5140C2F0 + 0x94)])[0], 0x5140828F)
        self.assertEqual(struct.unpack("<I", s[self.foff(0x5140C2F0 + 0x98):self.foff(0x5140C2F0 + 0x9C)])[0], 0x5140847D)
        self.assertEqual(struct.unpack("<I", s[self.foff(0x5140C0FC + 0x90):self.foff(0x5140C0FC + 0x94)])[0], 0x5140828F)
        self.assertEqual(struct.unpack("<I", s[self.foff(0x5140C0FC + 0x98):self.foff(0x5140C0FC + 0x9C)])[0], 0x5140847D)

    def test_global_tick_slots(self):
        s = self.s
        # slot+0x58 reads [0x51411C34]
        self.assertIn(s[self.foff(0x514076DB):self.foff(0x514076DB) + 6].hex(), ("8b0d341c4151",))
        self.assertEqual(s[self.foff(0x514076E1):self.foff(0x514076E1) + 2].hex(), "8908")

    def test_property_names(self):
        self.assertEqual(_decrypt_id(EXE.read_bytes(), 0x545), b"rx")
        self.assertEqual(_decrypt_id(EXE.read_bytes(), 0x546), b"ry")
        self.assertEqual(_decrypt_id(EXE.read_bytes(), 0x547), b"cx")
        self.assertEqual(_decrypt_id(EXE.read_bytes(), 0x548), b"cy")


@unittest.skipUnless(_require_binaries(), "original binaries not present")
class TestG10CameraFilter(unittest.TestCase):
    """C-114/EV-102: deadband 28.0, coef 100 site, filter id 0x1E0000."""

    @classmethod
    def setUpClass(cls):
        import hashlib
        assert _sha(SHAPE) == SHAPE_SHA
        assert _sha(EXE) == EXE_SHA
        cls.s = SHAPE.read_bytes()
        cls.exe = EXE.read_bytes()
        import pefile
        pe = pefile.PE(data=cls.s, fast_load=True)
        def foff(va):
            rva = va - pe.OPTIONAL_HEADER.ImageBase
            for sec in pe.sections:
                if sec.VirtualAddress <= rva < sec.VirtualAddress + max(sec.Misc_VirtualSize, sec.SizeOfRawData):
                    return sec.PointerToRawData + rva - sec.VirtualAddress
            raise ValueError(hex(va))
        cls.foff = staticmethod(foff)

    def test_deadband_28(self):
        o = self.foff(0x5140D978)
        self.assertEqual(struct.unpack("<d", self.s[o:o + 8])[0], 28.0)

    def test_filter_id_push(self):
        # push 0x1E0000 in slot+0xA8 commit (0x51408CB3) and query (0x51408C16)
        self.assertEqual(self.s[self.foff(0x51408CB3):self.foff(0x51408CB3) + 5].hex(), "6800001e00")
        self.assertEqual(self.s[self.foff(0x51408C16):self.foff(0x51408C16) + 5].hex(), "6800001e00")

    def test_coef100_commit_site(self):
        d = self.exe
        self.assertEqual(d[0x43787A - BASE:0x43787C - BASE].hex(), "6a64")     # push 0x64
        self.assertEqual(d[0x43787D - BASE:0x437883 - BASE].hex(), "ff90a8000000")  # call [eax+0xA8]

    def test_target_helper_set_offset(self):
        d = self.exe
        # Set(0, -0x32): push -0x32; push 0 ... call [eax+0x90]
        self.assertEqual(d[0x437818 - BASE:0x43781A - BASE].hex(), "6ace")
        self.assertEqual(d[0x43781B - BASE:0x43781D - BASE].hex(), "6a00")
        self.assertEqual(d[0x43781F - BASE:0x437825 - BASE].hex(), "ff9090000000")

    def test_user_f28_renewal_calls_helper(self):
        d = self.exe
        # 0x950970: mov eax,[ebx+0xF28]; 0x950993: call 0x437717
        self.assertEqual(d[0x950970 - BASE:0x950976 - BASE].hex(), "8b83280f0000")
        self.assertEqual(d[0x950993 - BASE], 0xE8)
        rel = int.from_bytes(d[0x950994 - BASE:0x950998 - BASE], "little", signed=True)
        self.assertEqual(0x950993 + 5 + rel, 0x437717)

    def test_commit_site_census(self):
        d = self.exe
        # full 8-form census: modrm 0x90/91/92/93/95 (ebp) plus esp/sib forms
        n = 0
        for modrm in (0x90, 0x91, 0x92, 0x93, 0x95, 0x96, 0x97):
            pat = bytes([0xFF, modrm]) + struct.pack("<i", 0xA8)
            k = d.find(pat, 0x1000)
            while k != -1:
                n += 1
                k = d.find(pat, k + 1)
        # esp form: FF A4 24 disp32 (with SIB)
        pat = bytes([0xFF, 0xA4, 0x24]) + struct.pack("<i", 0xA8)
        k = d.find(pat, 0x1000)
        while k != -1:
            n += 1
            k = d.find(pat, k + 1)
        self.assertEqual(n, 3)


class TestLedgerIntegrity(unittest.TestCase):
    def test_counts(self):
        with open(SOT / "claims.csv", encoding="utf-8", newline="") as f:
            claims = list(csv.DictReader(f))
        with open(SOT / "evidence.csv", encoding="utf-8", newline="") as f:
            ev = list(csv.DictReader(f))
        with open(SOT / "gaps.csv", encoding="utf-8", newline="") as f:
            gaps = list(csv.DictReader(f))
        # t090 migration: 115->119 claims, 103->107 evidence (C-116..C-119/EV-104..EV-107)
        self.assertEqual(len(claims), 119)
        self.assertEqual(len(ev), 107)
        self.assertEqual(len(gaps), 41)
        g = {r["gap_id"]: r for r in gaps}
        self.assertEqual(g["G35"]["status"], "CLOSED-STATIC")
        for gid in ("G36", "G37", "G39", "G10"):
            self.assertEqual(g[gid]["status"], "PARTIAL-STATIC", gid)
        c = {r["claim_id"]: r for r in claims}
        self.assertEqual(c["C-024"]["status"], "SUPERSEDED")
        self.assertIn("C-110", c)
        self.assertIn("refines C-109", c["C-115"]["supersedes"])

    def test_match_matrix_rows(self):
        p = REPO / "research/result/stage-readiness/T089-OPENMS-CMS079-MATCH-MATRIX.csv"
        rows = list(csv.DictReader(open(p, encoding="utf-8", newline="")))
        self.assertGreaterEqual(len(rows), 20)
        verdicts = {r["verdict"] for r in rows}
        self.assertIn("MATCH", verdicts)
        self.assertIn("REFUTED-CONSTANT-MATCH-SEMANTICS", verdicts)

    def test_gap_closure_audit(self):
        p = REPO / "research/result/stage-readiness/T089-GAP-CLOSURE-AUDIT.csv"
        rows = list(csv.DictReader(open(p, encoding="utf-8", newline="")))
        g35 = next(r for r in rows if r["gap_id"] == "G35")
        self.assertEqual(g35["end_status"], "CLOSED-STATIC")

    def test_phase3b_archive_exists(self):
        p = FORENSICS / "T0881-PHASE3B-REMOTE-ARCHIVE.md"
        txt = p.read_text(encoding="utf-8")
        self.assertIn("42e2d7fb8b7eb49f4cd3f61b48fc56cc391168ba", txt)
        self.assertIn("563f171b352ec19541ca831db1c3f004cd9b64a0", txt)

    def test_t088_report_wp0b_corrected(self):
        p = REPO / "research/result/stage-readiness/T088-CAMERA-CADENCE-WRITER-CLOSURE-REPORT.md"
        txt = p.read_text(encoding="utf-8")
        self.assertIn("独立注册函数 0x9E6BAD", txt)
        self.assertNotIn("由表面呈现函数 0x9E649A 经 [0xBE1554] 注册", txt)


if __name__ == "__main__":
    unittest.main()
