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
EV-01,bin/dummy.bin,00,0x666F5D,instruction,"imul","tile key",C-001,capstone
EV-02,bin/dummy.bin,00,0x6688C4,instruction,"imul","obj key",C-002,capstone
EV-03,bin/dummy.bin,00,0x2E2CC,instruction,"dtor","not insert",C-003;C-004,capstone
"""

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


def build_fixture(root):
    """Create the miniature repository at root. Returns nothing."""
    dirs = [
        'research/source-of-truth', 'research/result/atlas',
        'research/result/map', 'research/scripts', 'components',
    ]
    for d in dirs:
        os.makedirs(os.path.join(root, d), exist_ok=True)

    def w(rel, content):
        with open(os.path.join(root, rel), 'w', encoding='utf-8', newline='') as f:
            f.write(content)

    w('research/source-of-truth/claims.csv', CLAIMS)
    w('research/source-of-truth/gaps.csv', GAPS)
    w('research/source-of-truth/evidence.csv', EVIDENCE)
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
    # binary evidence source
    os.makedirs(os.path.join(root, 'bin'), exist_ok=True)
    w('bin/dummy.bin', '\x00\x01')


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


if __name__ == '__main__':
    unittest.main(verbosity=2)
