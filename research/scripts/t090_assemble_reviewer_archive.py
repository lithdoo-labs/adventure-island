"""T090: assemble T090-REVIEWER-INDEPENDENT.md — archive header + phase-1
blind notes (faithful copy). Phases 2-4 appended by later steps."""
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "research/result/stage-readiness/forensics/T090-REVIEWER-INDEPENDENT.md"
BLIND = REPO / "research/result/stage-readiness/forensics/T090-REVIEWER-BLIND-NOTES.md"

header = """# T090 — Independent CMS079 Static Closure Reviewer (archived)

> Archived by the T090 lead agent from the reviewer sub-agent's private working
> directory (real independent session(s), private scripts, read-only repo
> access, no commits/pushes). Session history: the Phase-1 blind run hit the
> account's sub-agent session budget mid-round after completing its q1–q7
> verification scripts; a resumed reviewer incarnation finished the blind
> synthesis, detected that its pinned T089 canonical copies had been extracted
> AFTER the lead's WP0 commit (contamination), disclosed this, and re-derived
> the Q6 verdicts from clean `git show d1dcb8b4:` extracts. This file is a
> faithful concatenation of the blind notes and the phase reports as they
> complete.

---

"""

blind = BLIND.read_text(encoding="utf-8")
OUT.write_text(header + blind, encoding="utf-8", newline="")
print("assembled:", OUT)
