# Task 040 — Game-Logic Full-Decode Master Campaign (multi-session)

## Objective

The final phase of the client effort. The maps are drawn (dispatch
band map, protocol chain, engine architecture, codec family); this
campaign walks them — converting the recovered game body into named
game logic at scale, closing README goals #3/#4 to completion:

```
Phase 0  dispatch completion      — pump decode -> login dispatcher;
                                    login-band table; all 20 band-internal
                                    tables -> the COMPLETE opcode->handler map
Phase 1  protocol labeling        — server-side channel-zone opcode
                                    enumeration (live, 033 method);
                                    every enumerated opcode pinned onto the
                                    dispatch bands
Phase 2  codec closure            — compact-AES block functions decode;
                                    full equivalence proof vs
                                    maple079_packet.py (codec 100%)
Phase 3  handler factory          — batch decode+name: login handlers,
                                    burst handlers (CHARINFO/INVENTORY/
                                    SKILLS first), naming ledger
                                    (two-evidence rule), target >=100 named
Phase 4  security + builders      — CSecurity module map; COutPacket
                                    builder family (send grammar)
Phase 5  integration              — architecture docs updated with real
                                    addresses; the game-logic map document;
                                    README goals closure assessment
```

## Session plan (each 8-16 h, checkpoint = commit+push+ledger)

| Session | Focus | Exit criterion |
| --- | --- | --- |
| S1 | Phase 0.1-0.2 (pump -> login dispatcher -> login band table) | login handlers mapped |
| S2 | Phase 0.3 (band-internal tables, inventory band first; >=8 bands) | >=8 bands table-mapped |
| S3 | Phase 0.3 completion + Phase 1 (server-side enumeration) | complete dispatch map + enriched labels |
| S4 | Phase 2 (AES closure) + Phase 4.2 (builders) | codec 100% + send grammar |
| S5 | Phase 3 part 1 (login + burst handlers) | >=40 handlers named |
| S6 | Phase 3 part 2 + Phase 4.1 (CSecurity) | >=100 named + security map |
| S7 | Phase 5 (integration + final assessment) | the game-logic map document |

## Milestones (per phase)

- **F0-complete** the full opcode→handler map (login + in-game)
- **F1-complete** protocol labels pinned (c2s 0x14+ enumerated live)
- **F2-complete** codec equivalence proven end-to-end
- **F3-complete** >=100 handlers named with evidence classes
- **F4-complete** CSecurity mapped; builder family decoded
- **F5-complete** final documents + README closure assessment

## Working rules (inherited + this campaign)

- Static analysis of the Task-036 authorized capture; the VM is only
  re-run if a NEW capture is explicitly needed (same 036 method,
  hygiene unchanged).
- Nothing binary committed; findings/CSV/scripts only.
- Every named function carries its evidence class: [live] protocol /
  [img] in-image dispatch or code / [v95] reference-derived / [srv]
  server-code. Two independent evidences required for a NAME, one for
  a provisional label.
- Per-session honest ledgers; no inflated counts; provisional labels
  counted separately from names.

## Stop conditions

A) all phases complete; B) a hard blocker precisely characterized;
C) session budget exhausted with exact state recorded; D) user
redirect.

## Final Report

`result/40-game-logic-full-decode.md` (+ per-session addenda),
milestones/blockers/timeline ledgers per session, and the terminal
deliverable: `result/task040-game-logic-map.csv` — the named function
map of the CMS079 client.

The most important question Task 040 must answer:

```
"Can the full decode be completed to a named game-logic map — every
dispatch band resolved, the codec proven equivalent, and a hundred+
handlers named — closing the project's original goals against the
real binary?"
```
