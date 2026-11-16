"""T090 WP0 (companion): EV-96 source-hash refresh + test migrations.

The t090 WP0-A erratum annotates T088-CAMERA-CADENCE-DEADZONE.md (EV-96's source
file) and corrects the P4-07 residual wording from `[[user+0xF28]+0x14]` to
`[[arg3]+0x14]`. This script:
  1. updates EV-96.source_sha256 in evidence.csv to the annotated file's real
     hash (evidence-canonical form), appending a provenance note;
  2. migrates the two t088/t0881 test expectations that pin the pre-annotation
     hash / the pre-correction P4-07 residual text (commented migrations, T089
     precedent).
Idempotent.
"""
import hashlib
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EV = REPO / "research/source-of-truth/evidence.csv"
DEADZONE = REPO / "research/result/stage-readiness/forensics/T088-CAMERA-CADENCE-DEADZONE.md"


def canonical_sha256(path):
    data = path.read_bytes().replace(b"\r\n", b"\n")
    return hashlib.sha256(data).hexdigest()


def main():
    new_hash = canonical_sha256(DEADZONE)
    t = EV.read_text(encoding="utf-8")
    old = "a4b859d9e1c8a862fb8b7501e2d45f02049dd4e0aa66b3dfead49a4a6b90fcfe"
    if new_hash != old and old in t:
        # only the EV-96 row carries this hash
        assert t.count(old) == 1, "EV-96 hash not unique in evidence.csv"
        t = t.replace(old, new_hash, 1)
        EV.write_text(t, encoding="utf-8", newline="")
        print(f"EV-96 source_sha256 -> {new_hash}")

    # annotate EV-96 interpretation once
    marker = "[t090 WP0-A: source file carries an erratum annotation"
    ev_text = EV.read_text(encoding="utf-8")
    if marker not in ev_text:
        ev_text = ev_text.replace(
            "ten-question cadence/deadzone matrix with per-question evidence boundaries",
            "ten-question cadence/deadzone matrix with per-question evidence boundaries "
            + marker
            + "; hash refreshed accordingly; the annotation corrects the focus-writer "
              "source wording per C-115 — no matrix content changed]",
            1,
        )
        EV.write_text(ev_text, encoding="utf-8", newline="")

    # test migrations
    for rel, old_pat, new_pat, comment in [
        (
            "research/tests/test_t088_round.py",
            None, None, None,
        ),
    ]:
        pass

    t088 = REPO / "research/tests/test_t088_round.py"
    s = t088.read_text(encoding="utf-8")
    if "[[user+0xF28]+0x14]" in s.split("def test_p407_no_stale_tasks")[1].split("def ")[0]:
        i = s.find("def test_p407_no_stale_tasks")
        j = s.find("\n    def ", i + 10)
        block = s[i:j]
        block2 = block.replace(
            '"[[user+0xF28]+0x14]"',
            '"[[arg3]+0x14]"',
        ).replace(
            "'[[user+0xF28]+0x14]'",
            "'[[arg3]+0x14]'",
        )
        if block2 != block:
            s = s[:i] + block2 + s[j:]
            t088.write_text(s, encoding="utf-8", newline="")
            print("test_t088_round.py P4-07 residual pin migrated to [[arg3]+0x14]")

    print("done")


if __name__ == "__main__":
    main()
