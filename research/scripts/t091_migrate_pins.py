"""T091: migrate historical claim-count pins 119->120 (T090 precedent style)."""
from pathlib import Path

EDITS = {
    "research/tests/test_t087_round.py": [
        ("# t090 migration: +C-116..C-119, +EV-104..EV-107 (reviewed T090 round)\n    self.assertEqual(len(self.claims), 119)",
         "# t090 migration: +C-116..C-119, +EV-104..EV-107 (reviewed T090 round)\n    # t091 migration: +C-120, +EV-108 (reviewed T091 round)\n    self.assertEqual(len(self.claims), 120)"),
    ],
    "research/tests/test_t088_round.py": [
        ("# t090 migration: +C-116..C-119, +EV-104..EV-107 (reviewed T090 round)\n    self.assertEqual(len(self.claims), 119)",
         "# t090 migration: +C-116..C-119, +EV-104..EV-107 (reviewed T090 round)\n    # t091 migration: +C-120, +EV-108 (reviewed T091 round)\n    self.assertEqual(len(self.claims), 120)"),
    ],
    "research/tests/test_t0881_round.py": [
        ('# t090 migration: 115->119 claims, 103->107 evidence (C-116..C-119/EV-104..EV-107)\n    self.assertEqual(len(_read(REPO / "research/source-of-truth/claims.csv")), 119)',
         '# t090 migration: 115->119 claims, 103->107 evidence (C-116..C-119/EV-104..EV-107)\n    # t091 migration: 119->120 claims, 107->108 evidence (C-120/EV-108)\n    self.assertEqual(len(_read(REPO / "research/source-of-truth/claims.csv")), 120)'),
    ],
    "research/tests/test_t089_round.py": [
        ("# t090 migration: 115->119 claims, 103->107 evidence (C-116..C-119/EV-104..EV-107)\n    self.assertEqual(len(claims), 119)",
         "# t090 migration: 115->119 claims, 103->107 evidence (C-116..C-119/EV-104..EV-107)\n    # t091 migration: 119->120 claims, 107->108 evidence (C-120/EV-108)\n    self.assertEqual(len(claims), 120)"),
    ],
    "research/tests/test_t090_round.py": [
        ("    self.assertEqual(len(claims), 119)",
         "    # t091 migration: 119->120 claims (C-120), 107->108 evidence (EV-108)\n    self.assertEqual(len(claims), 120)"),
    ],
}

for path, subs in EDITS.items():
    p = Path(path)
    t = p.read_text(encoding="utf-8")
    for old, new in subs:
        if old in t:
            t = t.replace(old, new)
            print("edited", path)
        else:
            print("ANCHOR MISS", path)
    p.write_text(t, encoding="utf-8")
