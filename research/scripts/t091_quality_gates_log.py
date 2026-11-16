"""T091: run the three official quality gates and capture the real output to
forensics/T091-QUALITY-GATES.txt (mirrors the T090 t090_quality_gates_log.py)."""
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "research/result/stage-readiness/forensics/T091-QUALITY-GATES.txt"

CMDS = [
    ("clean-room generator", [sys.executable, "research/scripts/generate_cleanroom_deliverables.py"]),
    ("validator", [sys.executable, "research/scripts/validate_reverse_engineering.py"]),
    ("unit tests", [sys.executable, "-m", "unittest", "discover", "-s", "research/tests", "-q"]),
]

lines = ["T091 quality gates — live run (host: win32/py" + sys.version.split()[0] + ")"]
fail = False
for label, cmd in CMDS:
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True, encoding="utf-8", errors="replace")
    ok = r.returncode == 0
    fail |= not ok
    lines.append("")
    lines.append(f"$ {' '.join(cmd[1:])}  -> exit {r.returncode} ({label})")
    out = (r.stdout or "") + (r.stderr or "")
    lines.append(out.rstrip())
    print(label, "exit", r.returncode)
lines.append("")
lines.append("OVERALL: " + ("PASS" if not fail else "FAIL"))
OUT.write_text("\n".join(lines), encoding="utf-8")
print("wrote", OUT)
sys.exit(1 if fail else 0)
