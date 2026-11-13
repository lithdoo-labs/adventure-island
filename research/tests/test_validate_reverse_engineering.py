#!/usr/bin/env python3
"""Negative tests for validate_reverse_engineering.py.
Each test creates intentionally broken data and verifies the validator FAILS.
This proves the validator actually checks what it claims to check."""
import os, sys, tempfile, shutil, csv, textwrap

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCRIPT = os.path.join(REPO, 'research', 'scripts', 'validate_reverse_engineering.py')

results = []

def run_test(name, setup_fn, expect_fail=True):
    """Create a temp broken file, run validator, check result."""
    tmpdir = tempfile.mkdtemp()
    backup = None
    target = None
    try:
        target, backup = setup_fn(tmpdir)
        # Run validator
        import subprocess
        r = subprocess.run([sys.executable, SCRIPT], capture_output=True,
                          timeout=120, cwd=REPO,
                          env={**os.environ, 'PYTHONIOENCODING': 'utf-8'})
        failed = r.returncode != 0
        if expect_fail and not failed:
            results.append((name, 'FAIL', 'validator PASSED on broken data'))
        elif not expect_fail and failed:
            results.append((name, 'FAIL', f'validator FAILED on clean data: {r.stdout[-200:]}'))
        else:
            results.append((name, 'PASS', ''))
    except Exception as e:
        results.append((name, 'ERROR', str(e)))
    finally:
        if backup and target and os.path.exists(backup):
            shutil.copy2(backup, target)
        if tmpdir:
            shutil.rmtree(tmpdir, ignore_errors=True)

# === Test 1: Invalid gap status ===
def setup_bad_status(tmpdir):
    gap = os.path.join(REPO, 'research', 'result', 'REVERSE-ENGINEERING-GAP-REGISTER.md')
    bak = os.path.join(tmpdir, 'gap.bak')
    shutil.copy2(gap, bak)
    text = open(gap, encoding='utf-8').read()
    text += "\n| G999 | Test | Bad status test | WRONG_STATUS_HERE | fake evidence |\n"
    open(gap, 'w', encoding='utf-8').write(text)
    return gap, bak

run_test('invalid-gap-status', setup_bad_status, expect_fail=True)

# === Test 2: Duplicate gap ID ===
def setup_dup_gap(tmpdir):
    gap = os.path.join(REPO, 'research', 'result', 'REVERSE-ENGINEERING-GAP-REGISTER.md')
    bak = os.path.join(tmpdir, 'gap.bak')
    shutil.copy2(gap, bak)
    text = open(gap, encoding='utf-8').read()
    text += "\n| G01 | Dup | Duplicate test | CLOSED-STATIC | MAP-R13 evidence |\n"
    open(gap, 'w', encoding='utf-8').write(text)
    return gap, bak

run_test('duplicate-gap-id', setup_dup_gap, expect_fail=True)

# === Test 3: CSV width mismatch in active deliverable ===
def setup_bad_csv(tmpdir):
    csv_path = os.path.join(REPO, 'research', 'result', 'FINAL-REVERSE-ENGINEERING-OPEN-ISSUES.csv')
    bak = os.path.join(tmpdir, 'csv.bak')
    shutil.copy2(csv_path, bak)
    text = open(csv_path, encoding='utf-8').read()
    text += '\nBAD-ID,BadModule,"too,few,cols",OPEN-RUNTIME\n'
    open(csv_path, 'w', encoding='utf-8').write(text)
    return csv_path, bak

run_test('csv-width-mismatch', setup_bad_csv, expect_fail=True)

# === Test 4: CLOSED without evidence ===
def setup_no_evidence(tmpdir):
    gap = os.path.join(REPO, 'research', 'result', 'REVERSE-ENGINEERING-GAP-REGISTER.md')
    bak = os.path.join(tmpdir, 'gap.bak')
    shutil.copy2(gap, bak)
    text = open(gap, encoding='utf-8').read()
    text += "\n| G998 | Test | Closed no evidence | CLOSED-STATIC | (nothing here) |\n"
    open(gap, 'w', encoding='utf-8').write(text)
    return gap, bak

run_test('closed-no-evidence', setup_no_evidence, expect_fail=True)

# === Test 5: method_index >= slot_count ===
def setup_bad_index(tmpdir):
    csv_path = os.path.join(REPO, 'research', 'result', 'atlas', 'R13-COM-INTERFACE-RESOLUTION.csv')
    bak = os.path.join(tmpdir, 'csv.bak')
    shutil.copy2(csv_path, bak)
    text = open(csv_path, encoding='utf-8').read()
    text += '\nTest.dll,TestClass,00000000-0000-0000-0000-000000000000,0,0x1000,5,99,0x2000,test_method,A,test\n'
    open(csv_path, 'w', encoding='utf-8').write(text)
    return csv_path, bak

run_test('method-index-out-of-bounds', setup_bad_index, expect_fail=True)

# === Report ===
print('=== Negative Test Results ===')
passed = sum(1 for _, s, _ in results if s == 'PASS')
failed = sum(1 for _, s, _ in results if s != 'PASS')
for name, status, detail in results:
    print(f'  [{status}] {name}: {detail}')
print(f'\nTotal: {len(results)}, PASS: {passed}, FAIL: {failed}')
if failed:
    print('NEGATIVE TESTS FAILED — validator does not catch all error classes')
    sys.exit(1)
else:
    print('ALL NEGATIVE TESTS PASS — validator catches injected errors correctly')
    sys.exit(0)
