"""T090: migrate the historical count pins (T089 precedent, commented)."""
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

MIG = [
    ("research/tests/test_t087_round.py",
     "        # t089 migration: +C-110..C-115, +EV-98..EV-103 (reviewed T089 round)\n"
     "        self.assertEqual(len(self.claims), 115)\n"
     "        self.assertEqual(len(self.evidence), 103)",
     "        # t089 migration: +C-110..C-115, +EV-98..EV-103 (reviewed T089 round)\n"
     "        # t090 migration: +C-116..C-119, +EV-104..EV-107 (reviewed T090 round)\n"
     "        self.assertEqual(len(self.claims), 119)\n"
     "        self.assertEqual(len(self.evidence), 107)"),
    ("research/tests/test_t088_round.py",
     "        # t089 migration: +C-110..C-115, +EV-98..EV-103 (reviewed T089 round)\n"
     "        self.assertEqual(len(self.claims), 115)\n"
     "        self.assertEqual(len(self.evidence), 103)",
     "        # t089 migration: +C-110..C-115, +EV-98..EV-103 (reviewed T089 round)\n"
     "        # t090 migration: +C-116..C-119, +EV-104..EV-107 (reviewed T090 round)\n"
     "        self.assertEqual(len(self.claims), 119)\n"
     "        self.assertEqual(len(self.evidence), 107)"),
    ("research/tests/test_t0881_round.py",
     '        self.assertEqual(len(_read(REPO / "research/source-of-truth/claims.csv")), 115)\n'
     '        self.assertEqual(len(_read(REPO / "research/source-of-truth/evidence.csv")), 103)',
     '        # t090 migration: 115->119 claims, 103->107 evidence (C-116..C-119/EV-104..EV-107)\n'
     '        self.assertEqual(len(_read(REPO / "research/source-of-truth/claims.csv")), 119)\n'
     '        self.assertEqual(len(_read(REPO / "research/source-of-truth/evidence.csv")), 107)'),
    ("research/tests/test_t089_round.py",
     "        self.assertEqual(len(claims), 115)\n"
     "        self.assertEqual(len(ev), 103)",
     "        # t090 migration: 115->119 claims, 103->107 evidence (C-116..C-119/EV-104..EV-107)\n"
     "        self.assertEqual(len(claims), 119)\n"
     "        self.assertEqual(len(ev), 107)"),
]

for rel, old, new in MIG:
    p = REPO / rel
    t = p.read_text(encoding="utf-8")
    if old in t:
        p.write_text(t.replace(old, new, 1), encoding="utf-8", newline="")
        print("migrated", rel)
    elif new in t:
        print("already migrated", rel)
    else:
        print("PATTERN NOT FOUND in", rel)
