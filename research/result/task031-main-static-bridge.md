# Task 031 — Static bridge update (complete elimination)

Extends `result/task030-main-static-bridge.md`. Canonical sample
`5d280cf1…`; all RVAs `MapStory.exe`… (`MapleStory.exe`) from the
decoded dump + fresh targeted traces.

## New facts (all confirmed-replay)

| Fact | Evidence |
| --- | --- |
| Exactly **two** bytecode VMs; VM2 (table RVA 0x821464, site 0x82208B) lives n 12.56M-13.48M; VM1 (0x84B1E0, site 0x8574D6) is the corridor; site 0x84A89A never executes | dispatch-site scan + `--vm-dispatch-log` census (6737 dispatches) |
| **Native environment phase** (13.48M-18.87M): probes/cmdline/versionex/registry/#UD/winmm run without any VM | census (zero dispatches in window) |
| Code-staging: 4512/4515 executed addresses written only pre-API (decode phases n<3.8M); the 6 reporter instructions re-written by a **constant self-decrypt** `((orig+0x5A192D3D)^0x61799419)` (loop RVA 0x593A1-0x59411, 49 dwords, n≈13.599M); zero code writes 3.8M→corridor | `--write-log` census over the executed-address watch list + writer-window trace |
| VM1 entry state is constant-derived: seed 0x0748C71E = (0x6B451A88<<5)+0x9EA5761E; edi=0x46BFD783 literal; edx=0xB3E9=0xD465+0xDF84 | producer-window traces (n=19,294,654; n=18,865,209-223) |
| advapi32 name-zone resolution ran natively at the 18.02M era (esi=advapi32+0x15000) — the 0x81D1xx engine is shared native code, not VM2 | entryprov trace n=18,023,731 |

## The completed elimination table

| Channel | Status | Proven by |
| --- | --- | --- |
| corridor data reads | faithful or inert | 030 R1 (watch-list provenance) |
| corridor branches vs timing | invariant (5000×) | 030 R2 + sweep |
| corridor executed code | deterministic (pre-API decode + constant self-decrypt) | **031 M4** |
| VM1 entry registers | constants / decode-derived | **031 M4** |
| VM2 environment consumption | terminates in VM2 context | 030 R1 + 031 M3 |
| native-phase APIs | faithful | 027/028 + 031 M3 re-check |
| PEB/TEB / concurrency | never read / falsified | 028 |

The corridor is a deterministic function of the canonical sample + the
faithful environment answers. **The offline route's boundary is now
proven from both the dynamic and static sides** (Stop C complete) —
see `task031-verdict.md`.

## Tooling

`scripts/maple079_full_replay.py`: `--vm-dispatch-log` (all-VM dispatch
census via the three dispatch-site movzx addresses). All prior options
unchanged; default-config signature regression-clean.

## Boundary status

Unchanged elsewhere: Tail A 0 writes; ZtlTaskMem zero; no import
rebuild / ijl15 / ws2_32 / game anchors. Remaining safe directions are
the Task 030 §9 routes (opportunistic live observation; completeness
decode of VM2).
