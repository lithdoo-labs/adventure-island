"""T091 final: rewrite G10 unresolved_scope ONCE, cleanly = T090 text (all
pinned tokens kept) + t091 refresh; migrate remaining count pins with correct
anchors; then caller regenerates clean-room."""
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

# ---- 1. G10 unresolved_scope (token-complete rewrite) ----
p = REPO / "research/source-of-truth/gaps.csv"
with open(p, encoding="utf-8", newline="") as f:
    rdr = csv.reader(f)
    fields = next(rdr)
    rows = list(csv.DictReader(f, fieldnames=fields))
for r in rows:
    if r["gap_id"] == "G10":
        r["unresolved_scope"] = (
            "[[arg3]+0x14] identity chain CLOSED t091 (C-120: arg3 = W the focus wrapper, [W+0x14] = QI(P,0xBA0500) view of the "
            "0x240-byte base movement object P, initial coordinates from packet opcode 0xCE) — REMAINING inside the chain: the "
            "ongoing Set driver of P's target slots (vtable slot+0x90->+0x40 = 0x9C1113; zero direct E8 callers; the dispatch "
            "site is not byte-located) and the [P+0x238] arm dispatch (gate of 0x5C0349; base ctor zeroes it; derived-entry "
            "setters decoded incl. 0x9C3DAD, dispatch site not located); Eye-side writer of [obj9C+0x68] (the W-wrapper install "
            "into the scene); [[user+0xF28] relationship now adjudicated DISTINCT-DATAFLOW-PROVEN (C-120: the Set never reads "
            "F28; the unknown-tag fill path 0x4B1C27 replaces arg3 and skips the Set; F28 direct-write census unchanged — ctor "
            "zero + 13 lea sites of which 2 now classified read (0x949B46 via 0x44484B) / release (0x934B9E via 0x4063B5), 11 "
            "undecoded); E2/E3 pump interleaving of filtered target vs immediate Sets (statically undecidable); wrapper "
            "persistence across scene transitions; the 18 SHARED-WRITE-CONTEXT-POSSIBLE receiver sites (the t088 INCONCLUSIVE "
            "census set, reclassified t090; pointer-deref receivers, exact object untraced); slot15-family scene +0x1CC "
            "installer (t088.1 retained: TEN direct +0x1CC writers incl. 0x952ECE - none installs a slot15-family vtable "
            "in-window, bounded negative; the BASE table 0xB01278 imm32 install chain = 0x52F1BC/0x52F1CF/0xA0B39E/0xA0BB2A + "
            "shared init 0x52F37F + register-mediated 0x52EEF1/0x8DC052; the 32 DERIVED tables have zero imm32 occurrence in "
            "the code band and their construction/install chain is untraced; [scene+0x1CC] class identity unproven); t089-"
            "bounded: NO 0x00641EF1-equivalent clamp traced this round (0xC0000000 code sites listed in T089-G35-KEY-SEARCH.txt)"
        )
        print("G10 unresolved_scope rewritten (token-complete)")
with open(p, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(rows)

# ---- 2. count pins with correct anchors ----
EDITS = {
    "research/tests/test_t087_round.py": [
        ("        # t090 migration: +C-116..C-119, +EV-104..EV-107 (reviewed T090 round)\n        self.assertEqual(len(self.claims), 119)\n        self.assertEqual(len(self.evidence), 107)",
         "        # t090 migration: +C-116..C-119, +EV-104..EV-107 (reviewed T090 round)\n        # t091 migration: +C-120, +EV-108 (reviewed T091 round)\n        self.assertEqual(len(self.claims), 120)\n        self.assertEqual(len(self.evidence), 108)"),
    ],
    "research/tests/test_t088_round.py": [
        ("        # t090 migration: +C-116..C-119, +EV-104..EV-107 (reviewed T090 round)\n        self.assertEqual(len(self.claims), 119)",
         "        # t090 migration: +C-116..C-119, +EV-104..EV-107 (reviewed T090 round)\n        # t091 migration: +C-120, +EV-108 (reviewed T091 round)\n        self.assertEqual(len(self.claims), 120)"),
    ],
    "research/tests/test_t0881_round.py": [
        ('self.assertEqual(len(_read(REPO / "research/source-of-truth/claims.csv")), 119)',
         '# t091 migration: 119->120 claims (C-120)\n        self.assertEqual(len(_read(REPO / "research/source-of-truth/claims.csv")), 120)'),
    ],
    "research/tests/test_t089_round.py": [
        ("        self.assertEqual(len(claims), 119)",
         "        # t091 migration: 119->120 claims (C-120)\n        self.assertEqual(len(claims), 120)"),
    ],
}
for path, subs in EDITS.items():
    fp = REPO / path
    t = fp.read_text(encoding="utf-8")
    for old, new in subs:
        if old in t:
            t = t.replace(old, new, 1)
            print("edited", path)
        else:
            print("ANCHOR MISS", path)
    fp.write_text(t, encoding="utf-8")
