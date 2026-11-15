# T085 Static Forensics Report — CMS079 Portal First-Tick / Stand-Up Triggers / Movement State

Round: T085. Branch: `design/adventure-field-map-scene`. Baseline SHA
`16e8bd5b5c70d22a32948613ac6c598ebfe09e50` (post-T084.1). Binary:
`.work/task-036/game-image-unpacked.bin`, sha256
`d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718`
(verified before every tool run; linear model `fileOffset = VA − 0x400000`).
No original client execution, no breakpoints, no runtime observation of any
kind — pure static analysis with capstone 5.0.7.

## Executive summary

| WP | Target | Outcome |
|---|---|---|
| WP1 | G38 / 0x9BE703 | Full body + first-tick context-rebuild chain closed end-to-end (same-map T1 path, cross-map fresh-T7 path); `[M+0x120]` dead-field census; FSDB x1>x2 = 0 structural consequence |
| WP2 | G41 / 0x965A09 | slot14 caller enumeration complete: flag=0 at exactly two user sites, both trigger chains fully recovered (opcode 0xCF stand sub-case; arrival/packet-spawn RNG gate); SIT sub-case incl. seat box + seat teleport; up/down axis arbitration closed |
| WP3 | G40 | 8-table slot-variant map completed (new slot4/slot9 variants, T7 slot5/6 overrides); slot3 variants T3/T5 fully diffed (swim pre-processor vs platform-edge rand%2 skip, both delegate 0x9BF1FA); step table [M+0x190] install proven; shoe [M+0x198] bounded no-setter census |
| WP4 | G34 | Conversion hypothesis refuted; exactly two 90/30 meeting sites (override + accumulator), all other uses disjoint domains |
| WP5 | residual | Input-suppression gate chain recovered (focus/modal/keymap); G10/G01 boundaries unchanged; no T084.1 result reopened |

Independent review: a genuinely independent blind-reviewer sub-agent ran a
full parallel forensic pass (own scripts, own temp dir, own SHA verification)
BEFORE seeing any of this round's outputs; its findings were merged after
byte-level re-verification (0x9C3D1D override, 0x97FCBA router thunk, the
slot4-variant correction, the std-iterator reading of the candidate list).
The adversarial phase and final sign-off are recorded in
`forensics/T085-REVIEWER-BLIND.md` and `forensics/T0851-REVIEWER-REPORT.md`.

## 1. Deliverables

Work-package reports (this directory):
- `T085-G38-FIRST-TICK-CONTEXT.md` (WP1)
- `T085-G41-STANDUP-TRIGGERS.md` (WP2)
- `T085-G40-MOVEMENT-SLOT3-VARIANTS.md` (WP3)
- `T085-G34-CONSTANT-RELATION.md` (WP4)
- `T085-STATIC-RESIDUAL-TRIAGE.md` (WP5)

Evidence (forensics/, SHA-256 in evidence.csv):
- EV-77 `T085-EV77-9BE703-PHYSICS-LOOP-FULL.txt`
- EV-78 `T085-EV78-FIRST-TICK-CHAIN.txt`
- EV-79 `T085-EV79-STANDUP-CALLERS.txt`
- EV-80 `T085-EV80-SLOT3-VARIANTS.txt`
- EV-81 `T085-EV81-CONSTANT-5A-1E.txt`

Generator: `research/scripts/t085_dump_evidence.py` (deterministic,
sha-pinned). Ledger update: `research/scripts/t085_update_ledgers.py`.

## 2. Headline findings

1. **0x9BE703 completely recovered** (0x9BE703–0x9BF13F, ret 0xC, 883
   instructions): swept-box candidate gating, winding-based supporting-segment
   selection with corner resolution, landing install through slot5 vs the
   no-install serializer path for vertical segments, map-bounds partial
   budget, and six exits. `[M+0x120]` is a **cleared-only field for
   movement-family M objects** (ctor + slot5 `and 0`; no nonzero write with M
   provenance — direct disp32 census + no aliasing `rep movs`; a LEA-alias
   installer exists for a non-M class at 0x9B7F43→0x9B8817, so the claim is
   receiver-provenance-bounded), making the pinned-segment branch family
   statically dead for M.
2. **First-tick chain closed**: same-map teleport clears only `[M+0x110]`;
   the next T1 tick snapshots the four encrypted pairs, runs the airborne
   integrator, then calls slot4 with **mode=1** which rebuilds and installs
   the context (or returns 0 and stays airborne). Cross-map arrivals create a
   **fresh T7 object** whose tick delegates to the same T1 body — with T7's
   own slot5/slot6 variants executing the landing install/record.
3. **FSDB structure gates the code paths**: in all 13 target maps no foothold
   is authored x1 > x2 (1607 rightward, 676 vertical) — so the m1>0
   tang-damp+install path covers every non-vertical foothold and verticals
   take the platform-gated no-install path; the state==7 subgate is dead for
   the local player (state getter is a constant-0 stub).
4. **Stand-up flag=0 triggers enumerated exhaustively**: opcode 0xCF STAND
   sub-case (0x9658CC → 0x965937) and the arrival/packet-spawn helper
   0x948AA2 (→ 0x948AB4), both RNG-gated; flag=1 only the known full reset;
   the SIT sub-case carries the seat occupancy box (x±0xA, y±0x1E) and the
   seat teleport 0x9D35F2.
5. **Input arbitration**: arrow axes are signed sums (DOWN−UP, RIGHT−LEFT);
   simultaneous opposite presses cancel to zero and suppress both grab
   directions — separate from the in-grab adjudication.
6. **slot3 variants demystified**: both are pre-processors that tail-delegate
   to the generic mover 0x9BF1FA; T3 = swim (lane/surface sub-modes with
   20.0 margins and platform-range lanes), T5 = platform-edge 50/50 RNG skip
   feeding the `[M+0x158]→0x9BD567→kind-1 notify` chain.
7. **G34 resolved**: no 90↔30 conversion exists; two meeting sites are an
   override (T3 slot9 returns 90 discarding the step value) and an
   accumulator (T4 slot9, threshold 90 over summed steps — the /3 is
   threshold/data coincidence, step is per-map data).

## 3. Ledger delta

- Claims: 87 → **94** (C-088..C-094; one PARTIAL-STATIC by design: C-093's
  bounded shoe negative).
- Evidence: 76 → **81** (EV-77..EV-81, each file hashed post-write).
- Gaps: 41 total; **G34, G38, G41 → CLOSED-STATIC**; G40 stays PARTIAL-STATIC
  with narrowed scope (T3/T6 slot4 bodies, walk/swim/land sequencing, shoe
  installer). No previously-closed gap reopened; T084.1's C-082/C-086/C-087
  corrections untouched (this round cites them as settled).
- Matrix: P3-15 → RE-READY (trigger enumeration was its only blocker);
  P4-06 → RE-READY (first-tick chain was its static residual; camera timing
  remains P4-07/G10's own runtime item).
- RE-READY count moves accordingly; no requirement's readiness was upgraded
  beyond what the new evidence proves.

## 4. Static vs runtime discipline

Everything above is machine-instruction-anchored static fact. NOT claimed:
wall-clock tick rate, observed frame scheduling order, camera refresh
behavior, the runtime identity of the slot25-created object (G24), the 0x81
registration mechanism (C-066 clause). Bounded negatives are stated as
bounded (e.g. the M+0x198 census excludes direct disp32 writes; the 14
COM/UI slot14 sites were sampled, not exhaustively proven).

## 5. Verification

- `python research/scripts/generate_cleanroom_deliverables.py`
- `python research/scripts/validate_reverse_engineering.py`
- `python -m unittest discover -s research/tests -q`
Logs: `forensics/T085-VALIDATOR-LOG.txt`, `forensics/T085-UNITTEST-LOG.txt`,
`forensics/T0851-CLEANROOM-LOG.txt` (final post-correction runs).
