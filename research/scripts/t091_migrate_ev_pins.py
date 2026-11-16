"""T091: migrate evidence-count pins 107->108 in three legacy test files."""
from pathlib import Path

q = chr(34)
subs = [
    ("research/tests/test_t0881_round.py",
     f"        self.assertEqual(len(_read(REPO / {q}research/source-of-truth/evidence.csv{q})), 107)",
     f"        self.assertEqual(len(_read(REPO / {q}research/source-of-truth/evidence.csv{q})), 108)"),
    ("research/tests/test_t088_round.py",
     "        self.assertEqual(len(self.evidence), 107)",
     "        self.assertEqual(len(self.evidence), 108)"),
    ("research/tests/test_t089_round.py",
     "self.assertEqual(len(ev), 107)",
     "self.assertEqual(len(ev), 108)"),
]
for f, old, new in subs:
    p = Path(f)
    t = p.read_text(encoding="utf-8")
    if old in t:
        p.write_text(t.replace(old, new, 1))
        print("edited", f)
    else:
        print("MISS", f)
