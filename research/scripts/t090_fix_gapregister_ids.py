"""T090: fix the gap-register appendix row IDs so they don't collide with the
validator's `^| G<n> |` single-occurrence rule (rows become `G<n>·t090`)."""
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
REG = REPO / "research/result/REVERSE-ENGINEERING-GAP-REGISTER.md"

t = REG.read_text(encoding="utf-8")
section_start = t.find("## T090 轮次增补")
assert section_start != -1
head, tail = t[:section_start], t[section_start:]
# within the t090 appendix only, rewrite "| G10 |" -> "| G10·t090 |" etc.
tail = re.sub(r"^\|\s*(G\d+)\s*\|", lambda m: f"| {m.group(1)}·t090 |", tail, flags=re.M)
REG.write_text(head + tail, encoding="utf-8", newline="")
print("appendix row ids qualified")
