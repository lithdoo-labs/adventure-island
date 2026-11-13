#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Isolated tests for validate_reverse_engineering.py.

Every test builds a COMPLETE miniature fixture repository inside a temporary
directory and runs the validator with RE_VALIDATE_ROOT pointing at it.
The real repository is never read-modified-written by these tests.

Positive test: fixture passes.
Negative tests: one specific defect injected per test; each asserts the
EXPECTED ERROR CODE appears in validator output (not just exit status).
"""
import csv
import io
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCRIPT = os.path.join(REPO, 'research', 'scripts', 'validate_reverse_engineering.py')

sys.stdout = (io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
              if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8')
              else sys.stdout)

# --------------------------------------------------------------------------
# Fixture: a miniature but structurally complete repository
# --------------------------------------------------------------------------

CLAIMS = """claim_id,module,claim,status,evidence_grade,evidence_refs,binary_identity,address,reasoning,falsification,supersedes,affected_documents
C-001,Map/Sort,"tile key formula",CLOSED-STATIC,A,EV-01,bin,0x666F5D,"verified","none",(none),doc.md
C-002,Map/Sort,"obj key formula",CLOSED-STATIC,A,EV-02,bin,0x6688C4,"verified","none",(none),doc.md
C-003,Gr2D,"slot45 = ordered insert",SUPERSEDED,D,EV-03,bin,0x2E2CC,"refuted","covered","RC-02",doc.md
C-004,Map/Sort,"[eax+0xB4] semantics",OPEN-RUNTIME,R,EV-03,bin,0x666F7D,"runtime needed","dump",(none),"doc.md"
"""

GAPS = """gap_id,module,question,status,verified_scope,unresolved_scope,blocker,next_action,implementation_impact,claim_refs
G01,Map/Sort,"comparator semantics",OPEN-STATIC,"keys","body","unread","disasm","pluggable",C-001
G02,Map/Sort,"tile key",CLOSED-STATIC,"done","","","","",C-001
G03,Map/Sort,"[eax+0xB4] target class",OPEN-RUNTIME,"census","variant class","runtime","dump","opaque",C-004
"""

EVIDENCE = """evidence_id,source_file,source_sha256,address,evidence_type,instruction_or_data,interpretation,claim_id,reproducibility
EV-01,bin/dummy.bin,FULLHASH1,0x666F5D,instruction,"imul","tile key",C-001,capstone
EV-02,bin/dummy.bin,FULLHASH2,0x6688C4,instruction,"imul","obj key",C-002,capstone
EV-03,bin/dummy.bin,FULLHASH3,0x2E2CC,instruction,"dtor","not insert",C-003;C-004,capstone
"""
# FULLHASHn markers are replaced with generated 64-hex dummies in build_fixture
# (CHECK 16a requires full-length sha tokens).

CROSSWALK = """gap_id,runtime_issue_id,report_id,mapping_basis,notes
G01,R4-02,report.md,"comparator","same"
G03,"R-09;R4-01","report.md;other.csv","eax+0xB4","same"
"""

DOCUMENTS = """document_path,classification,authority,claim_ids,last_verified_commit,has_stale_content,notes
doc.md,ACTIVE,authority=claims,C-001,0000000,no,-
"""

OPEN_ISSUES = """id,module,issue,status,evidence_grade,minimal_verification,blocks_abi_freeze
R-09,Map/Sort,"[eax+0xB4] vtable",OPEN-RUNTIME,-,"dump",No
R4-01,Map/Sort,"same",OPEN-RUNTIME,-,"dump",No
"""

R4_GAPS = """id,module,gap,status,evidence,minimal_action
R4-01,Map/Sort,"[eax+0xB4] vtable",OPEN-RUNTIME,A,dump
R4-02,Map/Sort,"comparator",OPEN-STATIC,A,disasm
"""

RUNTIME_MD = """# runtime remaining
| ID |
|---|
| R-09 | [eax+0xB4] vtable |
"""

GAP_REGISTER_MD = """# gap register
| ID | 模块 | 问题 | 状态 | 证据 |
|---|---|---|---|---|
| G01 | Map/Sort | comparator | OPEN-STATIC | x |
| G02 | Map/Sort | tile key | CLOSED-STATIC | x |
| G03 | Map/Sort | eax target | OPEN-RUNTIME | x |

<!--GAP-STATS-AUTO-->
| 状态 | 数量 |
|---|---|
| CLOSED-STATIC | 1 |
| PARTIAL-STATIC | 0 |
| OPEN-STATIC | 1 |
| OPEN-RUNTIME | 1 |
| BLOCKED | 0 |
| SUPERSEDED | 0 |
| CLOSED-RUNTIME | 0 |
| **总计** | **3** |
<!--/GAP-STATS-AUTO-->
"""

STRICT_CSVS = {
    'R13-DISPATCH-RESOLUTION.csv': 'rva,slot45_target,slot45_rva,slots,identity\n0x1,t,0x2,5,i\n',
    'R13-SLOT45-CANDIDATES.csv': ('dll,vtable_rva,n_slots,slot45_rva,classification,instruction_head,grade\n'
                                  'A.dll,0x100,50,0x200,dtor,"push esi",A\n'),
    'R13-COM-INTERFACE-RESOLUTION.csv': ('dll,class_name,iid,interface_offset,vtable_rva,slot_count,method_index,method_rva,'
                                         'method_semantics,confidence,evidence_source\n'
                                         'A.dll,cls,11111111-2222-3333-4444-555555555555,0,0x100,50,25,0x200,setter,A,src\n'),
    'FINAL-REVERSE-ENGINEERING-COVERAGE.csv': ('module,claim,current_status,evidence_grade,report,runtime_needed\n'
                                               'Map/Sort,key,CLOSED-STATIC,A,doc.md,No\n'),
    'FINAL-REVERSE-ENGINEERING-OPEN-ISSUES.csv': OPEN_ISSUES,
    'ROUND4-MODULE-COVERAGE.csv': ('module,priority,report,new_this_round,static_status,remaining_status,open_count,minimal_action\n'
                                   'Map/Sort,1,doc.md,2,CLOSED,OPEN,1,disasm\n'),
    'ROUND4-REMAINING-GAPS.csv': R4_GAPS,
}

ABI_CONTENT = '# frozen render node abi v1 (fixture)\n'


MATRIX = """requirement_id,phase,behavior,required_original_fact,original_exactness,claim_ids,evidence_ids,evidence_grade_and_type,13map_actual_coverage,single_sample_risk,conflicting_reports,gap_ids,unproven,impact,implementation_feasibility,blocks_acceptance,can_static_continue_or_runtime,product_alternative_authorization,readiness,minimum_next_work
FX-01,P9,fixture old-evidence row,old summary fact,原版事实精确到已证子项,C-001,EV-01,"B；源数据已核，非本轮新反汇编",13图,无,,G01,old parts remain,impact,部分实现可行,是,STATIC old work,无,RE-GAP-STATIC,old work
FX-02,P9,fixture bounded ready row,bounded sub-behavior fact (限界子行为),原版精确（限界子行为）,C-002,EV-02,"A；fixture 指令级（限界子行为）",13图,无,,G02,residual disclosed,impact,本子项可单独实施,否（限界子行为已就绪；阶段整体另见）,STATIC optional,无,RE-READY,子行为已闭合
"""

REPORT = """# fixture readiness report
Overall: NOT STAGE-READY。
坐标写入子行为已取得新的直接静态证据；Foothold 重绑、完整状态重置、Camera 更新及剩余 opcode 绑定仍未完全闭合。
"""


def build_fixture(root):
    """Create the miniature repository at root. Returns nothing."""
    dirs = [
        'research/source-of-truth', 'research/result/atlas',
        'research/result/map', 'research/scripts', 'components',
        'research/result/stage-readiness',
    ]
    for d in dirs:
        os.makedirs(os.path.join(root, d), exist_ok=True)

    def w(rel, content):
        with open(os.path.join(root, rel), 'w', encoding='utf-8', newline='') as f:
            f.write(content)

    # full 64-hex dummy hashes (CHECK 16a)
    ev_content = EVIDENCE
    for n in (1, 2, 3):
        ev_content = ev_content.replace(f'FULLHASH{n}', f'{n:02x}' * 32)
    w('research/source-of-truth/claims.csv', CLAIMS)
    w('research/source-of-truth/gaps.csv', GAPS)
    w('research/source-of-truth/evidence.csv', ev_content)
    w('research/source-of-truth/issue-crosswalk.csv', CROSSWALK)
    w('research/source-of-truth/documents.csv', DOCUMENTS)
    w('research/result/REVERSE-ENGINEERING-GAP-REGISTER.md', GAP_REGISTER_MD)
    w('research/result/REVERSE-ENGINEERING-RUNTIME-REMAINING.md', RUNTIME_MD)
    for name, content in STRICT_CSVS.items():
        w(f'research/result/atlas/{name}', content)
    # one legacy csv (exemption must catch it by prefix)
    w('research/result/task063-dump.csv', 'a,b\n1,2\nbroken\n')
    # frozen ABI + pin
    w('components/RENDER-NODE-ABI-V1.md', ABI_CONTENT)
    import hashlib
    abi_hash = hashlib.sha256(ABI_CONTENT.encode()).hexdigest()
    w('research/source-of-truth/frozen-abi.txt',
      '# pin\ncomponents/RENDER-NODE-ABI-V1.md ' + abi_hash + '\n')
    # a plain active md
    w('research/result/map/doc.md', '# doc\nSee [doc2](doc2.md)\n')
    w('research/result/map/doc2.md', '# doc2\n')
    # t081 CHECK 16 fixtures: requirement matrix + readiness report
    w('research/result/stage-readiness/P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv', MATRIX)
    w('research/result/stage-readiness/P0-P4-READINESS-REPORT.md', REPORT)
    # binary evidence source
    os.makedirs(os.path.join(root, 'bin'), exist_ok=True)
    w('bin/dummy.bin', '\x00\x01')

    # generate clean-room deliverables via the real generator (integration)
    env = dict(os.environ)
    env['RE_VALIDATE_ROOT'] = root
    subprocess.run([sys.executable, SCRIPT_GEN], capture_output=True,
                   timeout=120, env=env, check=True, cwd=root)


SCRIPT_GEN = os.path.join(REPO, 'research', 'scripts', 'generate_cleanroom_deliverables.py')


def run_validator(root):
    env = dict(os.environ)
    env['RE_VALIDATE_ROOT'] = root
    env['PYTHONIOENCODING'] = 'utf-8'
    return subprocess.run([sys.executable, SCRIPT], capture_output=True,
                          timeout=180, env=env, cwd=root)


class IsolatedValidatorTests(unittest.TestCase):
    """Each test gets a pristine fixture in its own temp dir."""

    def setUp(self):
        self.root = tempfile.mkdtemp(prefix='re-validate-test-')
        build_fixture(self.root)

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def _run(self):
        return run_validator(self.root)

    def _edit(self, rel, old, new, count=1):
        p = os.path.join(self.root, rel)
        with open(p, encoding='utf-8') as f:
            text = f.read()
        assert old in text, f'pattern not found in {rel}: {old!r}'
        text = text.replace(old, new, count)
        with open(p, 'w', encoding='utf-8', newline='') as f:
            f.write(text)

    # ---------------- positive ----------------

    def test_01_valid_repo_passes(self):
        r = self._run()
        self.assertEqual(r.returncode, 0, r.stdout.decode('utf-8', 'replace'))

    # ---------------- negatives: each asserts a specific error code ----------------

    def test_02_illegal_gap_status_fails(self):
        self._edit('research/source-of-truth/gaps.csv', 'CLOSED-STATIC,"done"', 'WRONG-STATUS,"done"')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('GAP-STATUS', out)

    def test_03_illegal_grade_fails(self):
        self._edit('research/source-of-truth/claims.csv', 'CLOSED-STATIC,A,EV-01', 'CLOSED-STATIC,A(joint),EV-01')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('CLAIM-GRADE', out)

    def test_04_duplicate_claim_fails(self):
        self._edit('research/source-of-truth/claims.csv',
                   'affected_documents\nC-001',
                   'affected_documents\nC-001,Map/Sort,"dup",CLOSED-STATIC,A,EV-01,bin,0x1,"v","n",(none),d\nC-001')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('CLAIM-DUP', out)

    def test_05_duplicate_gap_fails(self):
        self._edit('research/source-of-truth/gaps.csv',
                   'claim_refs\nG01',
                   'claim_refs\nG01,Map/Sort,"dup",CLOSED-STATIC,"","","","","",C-001\nG01')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('GAP-DUP', out)

    def test_06_csv_row_width_fails(self):
        self._edit('research/source-of-truth/claims.csv',
                   'C-002,Map/Sort,"obj key formula",CLOSED-STATIC,A,EV-02,bin,0x6688C4,"verified","none",(none),doc.md',
                   'C-002,Map/Sort,"obj key formula",CLOSED-STATIC,A,EV-02,bin,0x6688C4,"verified"')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('CSV-WIDTH', out)

    def test_07_slot_index_out_of_bounds_fails(self):
        self._edit('research/result/atlas/R13-COM-INTERFACE-RESOLUTION.csv',
                   '0x100,50,25,0x200,setter,A,src', '0x100,50,99,0x200,setter,A,src')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('CSV-INDEX', out)

    def test_08_closed_without_evidence_fails(self):
        # CLOSED claim referencing an evidence id that does not exist
        self._edit('research/source-of-truth/claims.csv',
                   'CLOSED-STATIC,A,EV-01', 'CLOSED-STATIC,A,EV-99')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('EVID-REF', out)

    def test_09_closed_vs_open_conflict_fails(self):
        # G02 CLOSED in source-of-truth, view says OPEN-STATIC
        self._edit('research/result/REVERSE-ENGINEERING-GAP-REGISTER.md',
                   '| G02 | Map/Sort | tile key | CLOSED-STATIC | x |',
                   '| G02 | Map/Sort | tile key | OPEN-STATIC | x |')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('GAP-VIEW-MISMATCH', out)

    def test_10_stale_runtime_item_fails(self):
        # R-09 dropped from runtime-remaining markdown
        self._edit('research/result/REVERSE-ENGINEERING-RUNTIME-REMAINING.md', 'R-09', 'R-98')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('XFILE-STALE', out)

    def test_11_broken_md_reference_fails(self):
        self._edit('research/result/map/doc.md', '(doc2.md)', '(missing-file.md)')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('MD-REF', out)

    def test_12_statistics_mismatch_fails(self):
        self._edit('research/result/REVERSE-ENGINEERING-GAP-REGISTER.md',
                   '| CLOSED-STATIC | 1 |', '| CLOSED-STATIC | 9 |')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('STATS-MISMATCH', out)

    def test_13_retracted_marked_verified_fails(self):
        self._edit('research/result/map/doc.md',
                   '# doc', '# doc\nslot45 = ordered insert on 0x2E2CC — VERIFIED (A)')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('RETRACTED-ACTIVE', out)

    def test_14_unmapped_open_runtime_fails(self):
        # G03 loses its crosswalk mapping
        self._edit('research/source-of-truth/issue-crosswalk.csv',
                   'G03,"R-09;R4-01","report.md;other.csv","eax+0xB4","same"',
                   'G99,"R-09;R4-01","report.md;other.csv","eax+0xB4","same"')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('XWALK-UNMAPPED', out)

    def test_15_frozen_abi_modified_fails(self):
        self._edit('components/RENDER-NODE-ABI-V1.md', '(fixture)', '(fixture) MUTATED')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('ABI-MODIFIED', out)

    def test_16_missing_strict_schema_fails(self):
        os.remove(os.path.join(self.root, 'research/result/atlas/ROUND4-REMAINING-GAPS.csv'))
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('CSV-STRICT-MISSING', out)

    def test_17_missing_source_of_truth_fails(self):
        os.remove(os.path.join(self.root, 'research/source-of-truth/evidence.csv'))
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('SOT-MISSING', out)

    def test_18_crosswalk_dangling_runtime_id_fails(self):
        # R4-01 removed from ROUND4 csv but still mapped in crosswalk
        self._edit('research/result/atlas/ROUND4-REMAINING-GAPS.csv',
                   'R4-01,Map/Sort,"[eax+0xB4] vtable",OPEN-RUNTIME,A,dump\n', '')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('XWALK-DANGLING', out)

    def test_19_evidence_source_file_missing_fails(self):
        os.remove(os.path.join(self.root, 'bin/dummy.bin'))
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('EVID-FILE', out)

    def test_20_gap_view_missing_row_fails(self):
        self._edit('research/result/REVERSE-ENGINEERING-GAP-REGISTER.md',
                   '| G03 | Map/Sort | eax target | OPEN-RUNTIME | x |\n', '')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('GAP-VIEW-MISSING', out)

    def test_21_assertive_retracted_claim_without_verified_fails(self):
        # review finding P0-1: prose re-asserts a refuted claim with NO
        # VERIFIED keyword anywhere (SEC16-style sentence)
        self._edit('research/result/map/doc.md', '# doc',
                   '# doc\n结论：+0xB4 = 有序插入，比较器在 DLL 内部。这是终局。')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('RETRACTED-ASSERTIVE', out)

    def test_22_unbalanced_quote_swallowing_lines_fails(self):
        # review finding P1-1: unterminated quote merges following lines into
        # one record — width stays constant, so only line-count check catches it
        p = os.path.join(self.root, 'research/source-of-truth/documents.csv')
        with open(p, 'a', encoding='utf-8') as f:
            f.write('second.md,ACTIVE,authority=claims,C-002,0000000,no,-\n')
        self._edit('research/source-of-truth/documents.csv',
                   'doc.md,ACTIVE,authority=claims,C-001,0000000,no,-',
                   'doc.md,ACTIVE,authority=claims,C-001,0000000,no,"-')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('CSV-QUOTE', out)

    def test_23_cleanroom_copy_out_of_sync_fails(self):
        # clean-room generated CSV must be byte-identical to source-of-truth
        cc = os.path.join(self.root, 'research/result/clean-room')
        os.makedirs(cc, exist_ok=True)
        with open(os.path.join(cc, 'GAP-REGISTER.csv'), 'w', encoding='utf-8') as f:
            f.write('gap_id\nGXX\n')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('CLEANROOM-SYNC', out)

    def test_24_runtime_patch_placeholder_assertion_fails(self):
        # review finding P0-2: assertive "runtime patch placeholder" restatement
        # with address far from keyword (wide gap defeats narrow windows)
        self._edit('research/result/map/doc.md', '# doc',
                   '# doc\n委派表 0x2D090-0x2D0AC 的静态值为运行时补丁的占位 RVA（.rdata 尾部，非代码）。')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('RETRACTED-ASSERTIVE', out)

    # ---------------- t081 CHECK 16: evidence-integrity positives/negatives ----------------

    def test_25_fixture_matrix_and_report_pass(self):
        # positive: bounded RE-READY row + corrected report markers all pass
        r = self._run()
        self.assertEqual(r.returncode, 0, r.stdout.decode('utf-8', 'replace'))

    def test_26_ellipsis_sha_fails(self):
        # 16a: ellipsis-shortened hash in a NEW binary evidence row must fail
        self._edit('research/source-of-truth/evidence.csv',
                   'EV-01,bin/dummy.bin,' + '01' * 32,
                   'EV-01,bin/dummy.bin,d4a67597…31718')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('EVID-SHA', out)

    def test_27_short_hex_sha_fails(self):
        # 16a: hex-like but non-64 token must fail
        self._edit('research/source-of-truth/evidence.csv',
                   'EV-02,bin/dummy.bin,' + '02' * 32,
                   'EV-02,bin/dummy.bin,' + 'ab' * 20)
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('EVID-SHA', out)

    def test_28_stale_climb_args_resurface_fails(self):
        # 16b: superseded (move,0,rope,0) reappearing in an ACTIVE store must fail
        self._edit('research/source-of-truth/evidence.csv',
                   '"imul","tile key"',
                   '"imul (exit vtable+0x14(move,0,rope,0))","tile key"')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('STALE-ARGS', out)

    def test_29_stale_climb_args_in_audit_context_passes(self):
        # 16b negative-control: the same string WITH correction-context markers is
        # legitimate audit history and must NOT fail (no false positives on archives)
        self._edit('research/result/stage-readiness/P0-P4-READINESS-REPORT.md',
                   '坐标写入子行为已取得新的直接静态证据',
                   '审计记录：此前曾写 (move,0,rope,0)，已纠正为 (move,0,0,0)。坐标写入子行为已取得新的直接静态证据')
        r = self._run()
        self.assertEqual(r.returncode, 0, r.stdout.decode('utf-8', 'replace'))

    def test_30_matrix_stale_source_grade_fails(self):
        # 16c: row citing this-round instruction evidence (EV-33..EV-42) while
        # describing it as a stale non-fresh summary must fail
        full_e3 = ('EV-03,bin/dummy.bin,' + '03' * 32 +
                   ',0x2E2CC,instruction,"dtor","not insert",C-003;C-004,capstone')
        self._edit('research/source-of-truth/evidence.csv', full_e3,
                   full_e3 + '\nEV-33,bin/dummy.bin,' + '33' * 32 +
                   ',0x66A8D5,instruction,"ret 0x24","tiling",C-001,capstone')
        self._edit('research/result/stage-readiness/P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv',
                   'C-001,EV-01,"B', 'C-001,EV-01;EV-33,"B')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('MATRIX-STALE-SOURCE', out)

    def test_31_ready_conflict_fails(self):
        # 16c: RE-READY + D-grade/stale description + blocks=是 without boundary
        # disclosure must fail (FX-02 cites only old EV-02, so the grade/stale
        # legs of the RE-READY check are what fire here)
        self._edit('research/result/stage-readiness/P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv',
                   '"A；fixture 指令级（限界子行为）",13图,无,,G02,residual disclosed,impact,本子项可单独实施,否（限界子行为已就绪；阶段整体另见）',
                   '"D；原有静态证据摘录非本轮新反汇编",13图,无,,G02,nothing,impact,只能部分编码,是')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('MATRIX-READY-CONFLICT', out)

    def test_32_matrix_unknown_refs_fail(self):
        # 16c: unknown claim/evidence ids in the matrix must fail
        self._edit('research/result/stage-readiness/P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv',
                   'C-001,EV-01,"B', 'C-999,EV-01,"B')
        self._edit('research/result/stage-readiness/P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv',
                   'C-002,EV-02,"A', 'C-002,EV-99,"A')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('MATRIX-REF', out)

    def test_33_report_stale_p4_conclusion_fails(self):
        # 16d: readiness report re-asserting the superseded P4 conclusion must fail
        self._edit('research/result/stage-readiness/P0-P4-READINESS-REPORT.md',
                   'Overall: NOT STAGE-READY。',
                   'Overall: NOT STAGE-READY。原版准确到达与同步 reset 仍缺权威 C/EV。')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('REPORT-STALE', out)

    def test_34_report_missing_corrected_marker_fails(self):
        # 16d: removing the required corrected marker must fail
        self._edit('research/result/stage-readiness/P0-P4-READINESS-REPORT.md',
                   '坐标写入子行为已取得新的直接静态证据', '旧文本占位')
        r = self._run()
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('REPORT-MARKER', out)

    # ------- t082: deliverable-presence strictness (real-repository rule) -------

    def test_35_strict_mode_matrix_absent_fails(self):
        # deliverable matrix absent + strict deliverables flag -> MATRIX-MISSING
        os.remove(os.path.join(self.root,
                               'research/result/stage-readiness/P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv'))
        env = dict(os.environ)
        env['RE_VALIDATE_ROOT'] = self.root
        env['RE_VALIDATE_STRICT_DELIVERABLES'] = '1'
        env['PYTHONIOENCODING'] = 'utf-8'
        r = subprocess.run([sys.executable, SCRIPT], capture_output=True,
                           timeout=180, env=env, cwd=self.root)
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('MATRIX-MISSING', out)

    def test_36_strict_mode_report_absent_fails(self):
        # readiness report absent + strict deliverables flag -> REPORT-MISSING
        os.remove(os.path.join(self.root,
                               'research/result/stage-readiness/P0-P4-READINESS-REPORT.md'))
        env = dict(os.environ)
        env['RE_VALIDATE_ROOT'] = self.root
        env['RE_VALIDATE_STRICT_DELIVERABLES'] = '1'
        env['PYTHONIOENCODING'] = 'utf-8'
        r = subprocess.run([sys.executable, SCRIPT], capture_output=True,
                           timeout=180, env=env, cwd=self.root)
        out = r.stdout.decode('utf-8', 'replace')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('REPORT-MISSING', out)

    def test_37_lenient_fixture_without_matrix_still_passes(self):
        # miniature fixture without the matrix stays lenient (no strict flag set)
        os.remove(os.path.join(self.root,
                               'research/result/stage-readiness/P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv'))
        r = self._run()
        self.assertEqual(r.returncode, 0, r.stdout.decode('utf-8', 'replace'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
