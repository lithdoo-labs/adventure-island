"""T090 WP4-C part 3: honest label downgrade — receiver linkage untraced."""
import csv
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / "research/result/stage-readiness/forensics/T090-G10-RESIDUAL-SLOT90-CLASSIFICATION.csv"

rows = list(csv.DictReader(open(SRC, encoding="utf-8")))
for r in rows:
    if r["t090_classification"] == "CONFIRMED-SHARED-VECTOR2D-WRITE":
        r["t090_classification"] = "SHARED-WRITE-CONTEXT-POSSIBLE"
        r["reason"] = (
            "containing function resolves the 0x31D shared Vector2D in-window "
            "(byte-verified push 0x31D) AND the +0x90 receiver arrives via a "
            "pointer deref (mov reg,[reg2]); the exact object linkage "
            "(receiver == the resolved singleton vs another Vector2D-family "
            "object) is NOT fully traced — camera-relevant possible, not "
            "confirmed. Receiver def: " + r.get("receiver_def", "")
        )
    elif r["t090_classification"] == "RECEIVER-UNKNOWN-REASON":
        r["t090_classification"] = "RECEIVER-OTHER-POSSIBLE"
        r["reason"] = (
            "NO 0x31D resolve in the containing-function window; the +0x90 "
            "receiver arrives via a pointer deref/unknown register — the "
            "shared camera vector is not implicated by any in-window evidence. "
            "Receiver def: " + r.get("receiver_def", "")
        )

with open(SRC, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), lineterminator="\n")
    w.writeheader()
    w.writerows(rows)

from collections import Counter
for k, v in Counter(r["t090_classification"] for r in rows).most_common():
    print(k, v)
