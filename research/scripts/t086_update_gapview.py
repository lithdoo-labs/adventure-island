#!/usr/bin/env python3
"""T086: sync REVERSE-ENGINEERING-GAP-REGISTER.md rows G01/G07/G08/G09/G10/G17/
G22/G24/G33 with the updated source-of-truth gaps.csv."""
import csv
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
VIEW = REPO / "research/result/REVERSE-ENGINEERING-GAP-REGISTER.md"
GAPS = REPO / "research/source-of-truth/gaps.csv"

rows = list(csv.DictReader(GAPS.open(newline="", encoding="utf-8")))
by_id = {r["gap_id"]: r for r in rows}
TARGETS = ["G01", "G07", "G08", "G09", "G10", "G17", "G22", "G24", "G33"]

text = VIEW.open(encoding="utf-8", newline="").read()
lines = text.splitlines(keepends=True)
out = []
replaced = 0
for line in lines:
    done = False
    s = line.strip()
    if s.startswith("| G"):
        parts = [p.strip() for p in s.strip("|").split("|")]
        if parts and parts[0] in TARGETS and len(parts) >= 4:
            g = by_id[parts[0]]
            scope = g["verified_scope"]
            if len(scope) > 900:
                scope = scope[:880] + "…"
            new = f"| {parts[0]} | {parts[1]} | {parts[2]} | {g['status']} | {scope} |\n"
            out.append(new)
            replaced += 1
            done = True
    if not done:
        out.append(line)
VIEW.write_text("".join(out), encoding="utf-8", newline="")
print(f"updated {replaced}/{len(TARGETS)} rows")
