"""T090: run the quality gates and capture REAL command output + exit codes to
forensics/T090-QUALITY-GATES.txt (re-run this before the final commit)."""
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "research/result/stage-readiness/forensics/T090-QUALITY-GATES.txt"

CMDS = [
    ("cleanroom", [sys.executable, "research/scripts/generate_cleanroom_deliverables.py"]),
    ("validator", [sys.executable, "research/scripts/validate_reverse_engineering.py"]),
    ("unittest", [sys.executable, "-m", "unittest", "discover", "-s", "research/tests", "-q"]),
]

lines = ["# T090 quality gates — real execution log", ""]
for name, cmd in CMDS:
    p = subprocess.run(cmd, cwd=str(REPO), capture_output=True, text=True)
    lines.append(f"## {name}")
    lines.append(f"$ {' '.join(cmd)}")
    lines.append(f"exit code: {p.returncode}")
    lines.append("stdout (tail):")
    lines.append("```")
    lines.extend((p.stdout or "").strip().splitlines()[-12:])
    lines.append("```")
    if p.stderr.strip():
        lines.append("stderr (tail, ResourceWarning notes kept verbatim):")
        lines.append("```")
        lines.extend(p.stderr.strip().splitlines()[-12:])
        lines.append("```")
    lines.append("")

OUT.write_text("\n".join(lines), encoding="utf-8", newline="")
print("written:", OUT)
for name, cmd in CMDS:
    p = subprocess.run(cmd, cwd=str(REPO), capture_output=True, text=True)
    print(name, "exit:", p.returncode)
