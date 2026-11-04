# Task 027 — Task 026 consistency audit (Phase 0)

Time-boxed housekeeping before new experiments. Goal: make the Task 026
permanent artifacts internally consistent, and draw the support-DLL vs
main-EXE distinction sharply so Task 027 milestones are measured on the
right axis. Historical observations were preserved; only stale status
text / false-causal language / count mismatches were corrected, each
marked with a `[T027 audit]` provenance note.

## 1. Checks and corrections

| # | Artifact | Issue found | Action |
| --- | --- | --- | --- |
| 1 | `result/task026-milestones.csv` M1 | status `reached` could be misread as current-session reproducibility (evidence was Task 025 historical + static decode) | status → `reached (historical-runtime + confirmed-static only)`; note records 0/8 Task-026-session runs reached the modal |
| 2 | `result/task026-milestones.csv` M3 | "first game runtime anchor" conflated support-DLL static recovery with game-code recovery | status → `reached (support-DLL static recovery only)`; note: MapleStory.exe body remained unrecovered |
| 3 | `result/task026-milestones.csv` M5 | same conflation for the function/class baseline | status → `reached (support-DLL baseline)`; note: only 3 MapleStory.exe rows (ZtlTaskMem*Imp, loader-adjacent, not game logic) |
| 4 | `result/task026-startup-callchain.md` | stale falsified causality `fork on client drive letter (F: -> continue; G: -> spin)` | replaced with "fork input UNKNOWN (co-varying correlates: letter, enumeration waves, timing — all falsified as necessary/sufficient by T26F3/F4/F7/C2)" |
| 5 | `result/task026-startup-callchain.md` | `user clicks 确定 ONCE [T26F3 in flight]` — T26F3 never reached the modal | corrected: click NEVER EXECUTED in Task 026; cut point A text updated to match |
| 6 | `result/task026-post-modal-observation.md` §1 | `T26F4 … TBD/TBD … discriminator in flight` | completed the row (F:/G:, F:-SPIN) and added T26F5/F6/F7 + C2 rows so the run inventory matches `task026-environment-matrix.csv` |
| 7 | `result/task026-post-modal-observation.md` §2 | forward-looking "T26F4 discriminates …" language left the file mid-run | rewritten as past tense with pointer to §7 final verdict |
| 8 | `result/task026-blockers.csv` B04 | `T26F5 running … pending T26F5` — T26F5 flaked and F6/F7 completed the falsification long before | B04 closed as RESOLVED-AS-FALSED and folded into B06 (environment regression) |
| 9 | `result/task026-blockers.csv` B06 | row still implied in-flight state | note added: all stale running/pending states cleared, final state = Stop C recorded |
| 10 | `result/26-game-runtime-recovery-campaign.md` §6 | `confirmed: 36` disagreed with the CSV (34) | corrected to 34 with provenance note |
| 11 | `result/task026-call-edges.csv` E19 | unquoted comma in `edge_evidence` shifted all following columns (confidence parsed as "WZ stream wrapper class") | field quoted; row now parses; edge counts below re-derived after the fix |

## 2. Recomputed counts (authoritative, from the CSVs)

### task026-function-map.csv (115 rows)

| confidence | count |
| --- | --- |
| confirmed | 34 |
| high | 8 |
| medium | 23 |
| low | 50 |

By module: PCOM 23, NameSpace 19, Sound_DX8 16, Canvas 12, Shape2D 13,
Gr2D_DX8 11, ResMan 6, WzMss 5, ZLZ 4, ijl15 stub 3, **MapleStory.exe 3**
(ZtlTaskMemAllocImp/FreeImp/ReallocImp — loader-adjacent exports, not
game logic).

### task026-class-map.csv (88 rows)

| confidence | count |
| --- | --- |
| high | 27 |
| medium | 7 |
| low | 54 |

All 88 rows are support-DLL classes (PCOM/NameSpace/Canvas/Gr2D/Sound/
Shape2D). Zero main-EXE classes.

### task026-call-edges.csv (23 rows, post-E19 repair)

| confidence | count |
| --- | --- |
| confirmed-static | 17 |
| confirmed-runtime | 2 |
| high | 2 |
| medium | 1 |

## 3. The distinction Task 027 will be measured on

Task 026's recovery baseline is real but lives entirely on the
**support-DLL side** (plus the 8 KiB repack stub):

```text
support-DLL static recovery   : 112 function rows, 88 class rows  (PCOM/
                                NameSpace/Canvas/ZLZ/Gr2D/Sound/
                                Shape2D/ResMan/WzMss + ijl15 stub)
main-EXE game-code recovery   : 3 function rows (ZtlTaskMem*Imp exports),
                                0 classes, 0 game-logic anchors
```

CWvsApp / CClientSocket / CLogin / CStage / CField / CUser / packet
dispatch / application startup / network initialization — none existed
as main-EXE anchors at the end of Task 026. Task 027 R4/R5 count only
the second category.
