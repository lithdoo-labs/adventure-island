"""T091: strip trailing whitespace from the generated disasm dump (capstone
mnemonic padding) — mirrors the T090 whitespace-cleanup step."""
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "result/stage-readiness/forensics/T091-FOCUS-CHAIN-DISASM.txt"
t = p.read_text(encoding="utf-8")
lines = [l.rstrip() for l in t.splitlines()]
p.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("dump whitespace cleaned")
