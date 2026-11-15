#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""t089_fix_g10_row.py — restore T088.1 bounded-negative markers in G10 gap row
(append-only refinement, preserving the pins test_t0881_round protects)."""
import csv
import io
import os

REPO = os.environ.get('RE_VALIDATE_ROOT') or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GP = os.path.join(REPO, 'research', 'source-of-truth', 'gaps.csv')

with open(GP, 'r', encoding='utf-8', newline='') as f:
    rows = list(csv.reader(f))
header = rows[0]
idx = {r[0]: i for i, r in enumerate(rows[1:])}
i = idx['G10'] + 1
g = rows[i]
col = {name: k for k, name in enumerate(header)}

g[col['verified_scope']] = (
    "t088 verified scope retained in full (identity/formula/Set semantics/triggers/cadence/bounds; "
    "t088.1 precision notes unchanged); t089 ADDS (C-114/C-115/EV-102): CMS079 smooth filter PROVEN - "
    "Shape2D Vector2D slots +0xA4 (0x51408BED query) / +0xA8 (0x51408C9A commit) with filter id 0x1E0000; "
    "commit method 0x51408D23 snaps on first commit then applies deadband 28.0 ([0x5140D978]) + residual "
    "0x51408E33 = max(0, coef*1000*D/(dt*D+coef*1000)); EXE arms it at exactly 3 call [vector+0xA8] sites "
    "(0x43787D with push 0x64 = coefficient 100, 0x942DF7, 0x94A796); 0x437717 = target-vector helper "
    "(resolve 0x31D -> create -> attach parent -> +0x90 Set(0,-0x32) = (0,-50) offset -> +0xA8 filter(100) "
    "-> attach into renderer origin via 0x4371B1 on [0xBE2788]); caller 0x950993 (in 0x94F715) renews "
    "[user+0xF28] then calls 0x437717; focus-writer source corrected: [[arg3]+0x14] via getter 0x93CD77 "
    "(0x769B51 is ret 4; the [this+0xF28] path via 0x4B1C27 handles unknown tags and SKIPS the Set) - C-115"
)
g[col['unresolved_scope']] = (
    "[[user+0xF28]/arg3 container] writer census refined by t089 to [[arg3]+0x14] member write census "
    "(the +0x14 store into the caller-supplied object; [user+0xF28] renewal arms the (0,-50)+filter target "
    "but the Set path reads arg3); runtime interleaving of filtered target vs immediate shared-Vector2D "
    "Sets (E2/E3 pump phases statically undecidable); 25 INCONCLUSIVE direct-slot census sites (not decoded "
    "in t089); slot15-family scene +0x1CC installer (t088.1 retained: TEN direct +0x1CC writers incl. "
    "0x952ECE - none installs a slot15-family vtable in-window, bounded negative; the BASE table 0xB01278 "
    "imm32 install chain = 0x52F1BC/0x52F1CF/0xA0B39E/0xA0BB2A + shared init 0x52F37F + register-mediated "
    "0x52EEF1/0x8DC052; the 32 DERIVED tables have zero imm32 occurrence in the code band and their "
    "construction/install chain is untraced; [scene+0x1CC] class identity unproven); whether/where the "
    "filtered coordinate feeds the slot15 consume side; t089-bounded: NO 0x00641EF1-equivalent clamp "
    "traced this round (0xC0000000 code sites listed in T089-G35-KEY-SEARCH.txt)"
)
g[col['blocker']] = (
    "none - static work continues (t088.1 CLOSED items [fieldctx+0xD4] identity / [0xBDD838] identity "
    "remain CLOSED; t089 adds filter-target chain as proven, no new blocker)"
)
g[col['next_action']] = (
    "STATIC: census writers of [obj+0x14] on the arg3 class; decode the 25 INCONCLUSIVE containing "
    "functions; trace filtered-coordinate consumers; T089 WP3 retained: trace the slot15 derived-table "
    "construction/install chain from the base-ctor sites 0x52F1BC/0x52F1CF/0xA0B39E/0xA0BB2A and shared "
    "init 0x52F37F (the [scene+0x1CC] member identity); then re-evaluate G10 closure"
)
g[col['implementation_impact']] = (
    "camera follow now has a PROVEN candidate mechanism (smooth filter, 28px deadband, coef 100, "
    "(0,-50) target geometry) - product may implement follow via this engine while pump-phase "
    "interleaving remains a documented design boundary; world->screen transform + camera centering + "
    "per-map initial camera remain EXACTLY implementable (ORIGINAL-STATIC-PROVEN)"
)
g[col['claim_refs']] = "C-026;C-028;C-101;C-102;C-103;C-104;C-106;C-107;C-108;C-109;C-114;C-115"

buf = io.StringIO()
w = csv.writer(buf, lineterminator='\r\n')
w.writerow(header)
w.writerows(rows[1:])
with open(GP, 'w', encoding='utf-8', newline='') as f:
    f.write(buf.getvalue())
print('G10 row refined (T088.1 markers restored + T089 additions)')
