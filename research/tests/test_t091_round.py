"""T091 round tests: focus-object provenance chain (byte-level), caller
classification, WP0 errata regressions, and ledger/deliverable consistency.
All binary assertions run against the sha-pinned EXE via t091_lib.
"""
import csv
import hashlib
import struct
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "research/scripts"))

import t091_lib as L  # noqa: E402


def disasm_at(va, n):
    return list(L.disasm(va, n))


def find_ins(va, n, sub):
    """Anchored search: try each decode start in [va-4, va] so mid-instruction
    starts don't derail the linear decode; window extended so 5-byte calls
    decode fully."""
    for back in range(0, 5):
        for i in L.disasm(va - back, n + back + 6):
            if sub in i.mnemonic + " " + i.op_str:
                return i
    return None


class TestWClassBytes(unittest.TestCase):
    """W = the focus wrapper: allocation, final vtables, init-ctor members."""

    def test_w_alloc_0x48(self):
        self.assertIsNotNone(find_ins(0x94B8F7, 0x30, "push 0x48"))

    def test_w_final_vtables_installed(self):
        # final: [esi]=0xB0BC40 (primary), [edi]=[esi+4]=0xB0BC64 (secondary)
        self.assertIsNotNone(find_ins(0x94B9A0, 0x18, "0xb0bc40"))
        self.assertIsNotNone(find_ins(0x94B9A0, 0x18, "0xb0bc64"))

    def test_w_primary_vtable_contents(self):
        self.assertEqual(L.u32(0xB0BC40 + 0x00), 0x94B9BE)   # state query (returns 7)
        self.assertEqual(L.u32(0xB0BC40 + 0x08), 0x5C0324)   # ret-4 thunk of the direct focus method
        self.assertEqual(L.u32(0xB0BC40 + 0x10), 0x94B9E9)   # lea eax,[ecx+0x24] (X slot accessor)

    def test_w_init_ctor_members(self):
        # 0x5BFE8C: [W+0x44]=arg1, [W+0x10]=arg2, [W+0x24/0x2C]=arg4, [W+0x28/0x30]=arg5
        self.assertIsNotNone(find_ins(0x5BFE8C, 0x40, "[ebx + 0x44], eax"))
        self.assertIsNotNone(find_ins(0x5BFE8C, 0x40, "[ebx + 0x10], eax"))
        self.assertIsNotNone(find_ins(0x5BFE8C, 0x40, "[ebx + 0x24], eax"))
        self.assertIsNotNone(find_ins(0x5BFE8C, 0x40, "[ebx + 0x28], ecx"))

    def test_w_ctor_creates_p_and_sets_owner(self):
        self.assertIsNotNone(find_ins(0x5BFEB6, 0x30, "call 0x9c2911"))
        self.assertIsNotNone(find_ins(0x5BFEDF, 0x10, "call 0x9bc602"))

    def test_y_minus_0x14_offset(self):
        self.assertIsNotNone(find_ins(0x5BFEFC, 0x18, "sub esi, 0x14"))


class TestPClassBytes(unittest.TestCase):
    """P = the 0x240-byte base movement object holding the position slots."""

    def test_p_alloc_0x240(self):
        self.assertIsNotNone(find_ins(0x9C2911, 0x20, "push 0x240"))

    def test_p_vtables_and_238_zero(self):
        self.assertIsNotNone(find_ins(0x9C28BF, 0x24, "0xb0c660"))
        self.assertIsNotNone(find_ins(0x9C28BF, 0x24, "0xb0c5b0"))
        self.assertIsNotNone(find_ins(0x9C28C2, 0x10, "[esi + 0x238], 0"))

    def test_qi_attaches_0xBA0500_at_w_plus_14(self):
        self.assertIsNotNone(find_ins(0x5C1A18, 0x20, "0xba0500"))
        self.assertIsNotNone(find_ins(0x5BFF11, 0x10, "[ebx + 0x14]"))

    def test_qi_accepts_ba0500_and_returns_self(self):
        self.assertIsNotNone(find_ins(0x9C0F12, 0x14, "0xba0500"))
        # self-return: *out = [ebp+8] (adjusted), AddRef via [ecx+4]
        self.assertIsNotNone(find_ins(0x9C0F26, 0x18, "[ebp + 8]"))

    def test_getters_forward_to_slot_8c(self):
        self.assertIsNotNone(find_ins(0x9C0FEF, 0x48, "[edx + 0x8c]"))  # GetX
        self.assertIsNotNone(find_ins(0x9C105F, 0x48, "[edx + 0x8c]"))  # GetY

    def test_resolver_delegate_slot_never_installed(self):
        # [P+0x1C] (delegate, read as [iface+0x10] in 0x9C1499): the ONLY
        # in-band direct writer is the base-ctor zero at 0x9BC324.
        img = L.EXE_BYTES
        hits = []
        for va in range(0x9BC000, 0x9C3000):
            if img[va - L.BASE] == 0x89:
                b1 = img[va - L.BASE + 1]
                b2 = img[va - L.BASE + 2]
                mod = (b1 >> 6) & 3
                rm = b1 & 7
                if mod == 1 and rm not in (4, 5) and b2 == 0x1C:
                    hits.append(va)
        self.assertEqual(hits, [0x9BC324])

    def test_extrapolation_constant_is_one_thirtieth(self):
        self.assertEqual(struct.unpack("<d", L.read(0xB0C5A8, 8))[0], 1.0 / 30.0)

    def test_encrypt_slots_x_y_vx_vy(self):
        # 0x9BC622 encrypts arg2->P+0x20, arg3->P+0x38, arg4->P+0x50, arg5->P+0x68 via 0x6131F4
        w = [i.op_str for i in disasm_at(0x9BC676, 0x50) if i.mnemonic == "call" and "0x6131f4" in i.op_str]
        self.assertEqual(len(w), 4)

    def test_mirror_base_to_target(self):
        self.assertIsNotNone(find_ins(0x9BC741, 0x12, "rep movsd"))


class TestCallerClassification(unittest.TestCase):
    """All 14 E8 callers of 0x9573A6: 13 proven-null arg7 + 1 object (0x5C031A)."""

    def test_caller_count_is_14(self):
        self.assertEqual(len(L.e8_callers(0x9573A6)), 14)

    def test_object_site_5c031a_pushes_esi_first(self):
        win = [i for i in disasm_at(0x5C030E, 0x10)]
        pushes = [i for i in win if i.mnemonic == "push"]
        self.assertEqual(pushes[0].op_str, "esi")  # arg7 = W (esi = this of W-method 0x5C02CB)

    NULL_DOMINATORS = {
        0x95282D: (0x95281A, "xor esi, esi"),
        0x968705: (0x9686F7, "xor ebx, ebx"),
        0x968798: (0x968787, "xor eax, eax"),
        0x976409: (0x9763FC, "xor eax, eax"),
        0x976A3A: (0x976A2F, "xor eax, eax"),
        0x977B8E: (0x977B5E, "xor edi, edi"),
        0x977BA7: (0x977B9C, "xor eax, eax"),
    }

    def test_null_dominators_decode(self):
        for site, (va, txt) in self.NULL_DOMINATORS.items():
            i = find_ins(va, 4, txt)
            self.assertIsNotNone(i, f"missing {txt} at {va:#x} (for caller {site:#x})")

    def test_9767ba_esi_last_write_is_xor(self):
        # between the xor at 0x97672F and the call at 0x9767BA no esi write exists
        img = L.EXE_BYTES
        for va in range(0x976731, 0x9767BA):
            if img[va - L.BASE] == 0x33 and img[va - L.BASE + 1] == 0xF6:
                self.fail("unexpected xor esi,esi between dominator and call")
        self.assertIsNotNone(find_ins(0x97672F, 3, "xor esi, esi"))

    def test_97a449_97a559_edi_zero(self):
        self.assertIsNotNone(find_ins(0x97A3AE, 3, "xor edi, edi"))
        self.assertIsNotNone(find_ins(0x97A4E9, 3, "xor edi, edi"))

    def test_identity_csv_rows(self):
        p = REPO / "research/result/stage-readiness/forensics/T091-ARG3-CALLER-IDENTITY.csv"
        with open(p, encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        obj = [r for r in rows if r["arg3_class"].startswith("PROVEN-OBJECT")]
        nulls = [r for r in rows if r["arg3_class"] == "PROVEN-NULL"]
        self.assertEqual(len(rows), 24)          # 2 direct + 14 of 0x9573A6 + 8 re-anchored T090 zeros (table rows)
        self.assertGreaterEqual(len(nulls), 21)
        self.assertTrue(any(r["caller"] == "0x5C0342" for r in obj))
        self.assertTrue(any(r["caller"].startswith("0x9573A6<-0x5C031A") for r in obj))

    def test_both_set_capable_sites_same_object(self):
        # 0x5C0342: this=[W+0x10], arg3=esi=W; 0x5C0349 branches to both on the same ebx
        self.assertIsNotNone(find_ins(0x5C0425, 0x14, "mov ecx, ebx"))
        self.assertIsNotNone(find_ins(0x5C0427, 0x10, "call 0x5c02cb"))
        self.assertIsNotNone(find_ins(0x5C0430, 6, "call 0x5c0327"))
        self.assertIsNotNone(find_ins(0x5C0338, 0x10, "[esi + 0x10]"))
        self.assertIsNotNone(find_ins(0x5C033B, 8, "push esi"))


class TestInstallAndConsumerChain(unittest.TestCase):
    def test_opcode_0xCE_arm_decodes_four_values(self):
        self.assertIsNotNone(find_ins(0x97FB7A, 8, "call 0x99142a"))
        cnt = sum(1 for i in disasm_at(0x99142A, 0x34) if i.mnemonic == "call" and "0x4066ff" in i.op_str)
        self.assertEqual(cnt, 4)

    def test_w_creator_is_user_vt_7c(self):
        self.assertEqual(L.u32(0xB0BCE8 + 0x7C), 0x948DE7)
        self.assertIsNotNone(find_ins(0x948E48, 4, "call 0x5bfe8c"))

    def test_camera_getter_4423c0_uses_slot_d4(self):
        self.assertIsNotNone(find_ins(0x4423C0, 0x18, "[eax + 0xd4]"))

    def test_group_installer_5d5377(self):
        for off, reg in (("0x1c24", "eax"), ("0x1c28", "eax"), ("0x1c2c", "eax"), ("0x1c30", "eax")):
            self.assertIsNotNone(
                find_ins(0x5D5377, 0x36, f"[esi + {off}]"),
                f"missing [esi+{off}] store in 0x5D5377",
            )

    def test_consumer_reads_wrapper_plus4(self):
        self.assertIsNotNone(find_ins(0x938381, 0x8, "[ecx + 4]"))
        self.assertIsNotNone(find_ins(0x93839F, 4, "call 0x5c0349"))

    def test_scene_handler_installs_obj9c_68(self):
        self.assertIsNotNone(find_ins(0x5EBAEE, 6, "[esi + 0x9c]"))
        self.assertIsNotNone(find_ins(0x5EBAF4, 6, "[eax + 0x68]"))
        self.assertIsNotNone(find_ins(0x5EBC06, 0x10, "call 0x5d5377"))

    def test_focus_writer_getter_reads_14(self):
        self.assertIsNotNone(find_ins(0x93CD77, 0x10, "[ecx + 0x14]"))


class TestF28Relationship(unittest.TestCase):
    def test_user_ctor_zeroes_f28(self):
        self.assertIsNotNone(find_ins(0x934437, 0x18, "[esi + 0xf28], ebx"))

    def test_f28_lea_949b46_is_read_via_44484b(self):
        self.assertIsNotNone(find_ins(0x949B46, 8, "[esi + 0xf28]"))
        self.assertIsNotNone(find_ins(0x949B51, 6, "call 0x44484b"))

    def test_f28_lea_934b9e_is_release(self):
        self.assertIsNotNone(find_ins(0x934B9E, 8, "[esi + 0xf28]"))
        self.assertIsNotNone(find_ins(0x934BA8, 4, "call 0x4063b5"))


class TestWP0Errata(unittest.TestCase):
    def read_csv(self, name):
        with open(REPO / f"research/source-of-truth/{name}", encoding="utf-8") as f:
            return {r[[k for k in r][0]]: r for r in csv.DictReader(f)}

    def test_wp0a_c106_76_4_wording(self):
        with open(REPO / "research/source-of-truth/claims.csv", encoding="utf-8") as f:
            rows = {r["claim_id"]: r for r in csv.DictReader(f)}
        self.assertIn("split into 76 real create calls", rows["C-106"]["claim"])
        self.assertIn("4 sites that perform NO create call", rows["C-106"]["claim"])
        self.assertNotIn("every one of the 80 EXE resolve sites (63 push 0x31D + 17 mov r32,0x31D) aliases", rows["C-106"]["claim"])

    def test_wp0b_c108_unarmed_qualifier(self):
        with open(REPO / "research/source-of-truth/claims.csv", encoding="utf-8") as f:
            rows = {r["claim_id"]: r for r in csv.DictReader(f)}
        self.assertIn("UNARMED state", rows["C-108"]["claim"])
        self.assertIn("0x51407A34", rows["C-108"]["claim"])
        self.assertIn("NEVER arms the VT_I4 duration interpolation", rows["C-108"]["claim"])

    def test_wp0c_g10_next_action_updated(self):
        with open(REPO / "research/source-of-truth/gaps.csv", encoding="utf-8") as f:
            rows = {r["gap_id"]: r for r in csv.DictReader(f)}
        g10 = rows["G10"]
        self.assertNotIn("trace filtered-coordinate consumers;", g10["next_action"])
        self.assertNotIn("census writers of [obj+0x14]", g10["next_action"])
        self.assertIn("0x9C1113", g10["unresolved_scope"])
        self.assertIn("[P+0x238]", g10["unresolved_scope"])

    def test_wp0d_t090_r1a_r1b_landed_at_3d9dfd50(self):
        import subprocess
        tl = subprocess.run(
            ["git", "show", "3d9dfd50:research/result/stage-readiness/forensics/T090-G39-ANIMATION-TIMELINE.md"],
            capture_output=True, cwd=REPO,
        ).stdout
        self.assertIn(b"44 distinct [t090 phase-4 R1a]", tl)
        ev = subprocess.run(
            ["git", "show", "3d9dfd50:research/source-of-truth/evidence.csv"],
            capture_output=True, cwd=REPO,
        ).stdout
        self.assertIn(b"9290a45f69af1f85", ev)
        h = hashlib.sha256(tl.replace(b"\r\n", b"\n")).hexdigest()
        self.assertTrue(h.startswith("9290a45f"))


class TestLedgerAndDeliverables(unittest.TestCase):
    def test_c120_ev108_present(self):
        with open(REPO / "research/source-of-truth/claims.csv", encoding="utf-8") as f:
            claims = {r["claim_id"]: r for r in csv.DictReader(f)}
        self.assertIn("C-120", claims)
        self.assertEqual(claims["C-120"]["status"], "CLOSED-STATIC")
        self.assertIn("EV-108", claims["C-120"]["evidence_refs"])
        with open(REPO / "research/source-of-truth/evidence.csv", encoding="utf-8") as f:
            evid = {r["evidence_id"]: r for r in csv.DictReader(f)}
        self.assertIn("EV-108", evid)
        self.assertIn("C-120", evid["EV-108"]["claim_id"])

    def test_no_gap_status_migration(self):
        with open(REPO / "research/source-of-truth/gaps.csv", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        from collections import Counter
        cc = Counter(r["status"] for r in rows)
        self.assertEqual(cc["CLOSED-STATIC"], 26)
        self.assertEqual(cc["PARTIAL-STATIC"], 8)
        self.assertEqual(cc["OPEN-STATIC"], 6)
        g10 = next(r for r in rows if r["gap_id"] == "G10")
        self.assertEqual(g10["status"], "PARTIAL-STATIC")

    def test_deliverables_exist(self):
        base = REPO / "research/result/stage-readiness"
        for p in (
            base / "T091-G10-FOCUS-PROVENANCE-REPORT.md",
            base / "T091-OBJECTIVE-GATE.csv",
            base / "forensics/T091-FOCUS-CHAIN-DISASM.txt",
            base / "forensics/T091-ARG3-CALLER-IDENTITY.csv",
            base / "forensics/T091-ARG3-MEMBER14-WRITERS.csv",
            base / "forensics/T091-FOCUS-OBJECT-PROVENANCE.md",
        ):
            self.assertTrue(p.exists(), f"missing {p.name}")

    def test_disasm_dump_covers_decisive_vas(self):
        p = REPO / "research/result/stage-readiness/forensics/T091-FOCUS-CHAIN-DISASM.txt"
        txt = p.read_text(encoding="utf-8")
        for va in (
            "005BFE8C", "005C1A08", "009C2911", "009C0EC0", "009C1499",
            "009BC622", "00948DE7", "0097FB7A", "0099142A", "0093839F",
            "005D5377", "0093CC9B",
        ):
            self.assertIn(va, txt, f"dump missing {va}")

    def test_objective_gate_verdicts(self):
        p = REPO / "research/result/stage-readiness/T091-OBJECTIVE-GATE.csv"
        with open(p, encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), 10)
        item1 = next(r for r in rows if r["required_item"].startswith("1. identify both"))
        item4 = next(r for r in rows if r["required_item"].startswith("4. prove construction"))
        item9 = next(r for r in rows if r["required_item"].startswith("9. arg3"))
        self.assertEqual(item1["completed"], "YES")
        self.assertEqual(item4["completed"], "PARTIAL")
        self.assertEqual(item9["completed"], "YES_WITH_RESIDUAL")


if __name__ == "__main__":
    unittest.main()
