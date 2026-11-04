# Task 035 — Engine Method-Level Recovery & Client Behavior Specification Campaign

## Objective

Continue from Task 034 (client architecture census) — the last two open
client-side tracks, combined per user direction:

```
Part A — engine method-level recovery (the one block of client code
         never actually READ):
   PCOM framework internals (PcInitModule/PcCreateObject/PcRootNameSpace
   full logic) -> NameSpace WZ mount flow (CWzArchive/CWzRawArchive/
   CArchiveSource/CWzNameSpace) -> Canvas→ZLZ stream path (CWzStream +
   ZLZCreateInflator usage) -> Sound state family (as time allows)
Part B — client behavior specification (synthesis, no new reversing):
   the per-packet client behavior spec built ONLY from the proven
   protocol chain (032/033), the v95 reference structure, and 034's
   engine facts — the document the project uses the day the game body
   becomes reachable.
```

Everything in Part A is static analysis of reachable, unprotected Wizet
engine DLLs. Part B is pure synthesis with evidence classes.

## Milestones

- **E0** target extraction — the exact function set for Part A pinned
  (PCOM exports as entries; 026 function-map rows + TD xrefs for the rest)
- **E1** PCOM framework internals — the full Pc* flow disassembled and
  documented (module table, object creation, namespace root handoff)
- **E2** NameSpace WZ mount flow — CWzArchive/RawArchive/ArchiveSource
  mount logic + CWzNameSpace lookup logic
- **E3** Canvas→ZLZ stream path — how Canvas consumes ZLZ inflators;
  CWzStream read path
- **E4** subsystem logic documents (E1-E3 results; Sound family if budget)
- **B1** client behavior specification — per proven protocol exchange:
  what the client must construct/send/parse, which v95 structures hold
  the state, evidence-classed

## Main Work

### Part A (E0-E4)

- Tooling: capstone (already available) + the project's own PE plumbing
  (034 scripts); a shared `.work` disassembly helper with xref/call-graph
  extraction per function.
- For each target function: full disassembly with imports/exports/strings
  annotated, call graph (depth 2), and a decompiled-style pseudocode
  summary written by hand from the instructions (no decompiler
  committed — findings only).
- Deliverable per subsystem: `result/task035-<subsystem>-logic.md`.

Create: `result/task035-pcom-framework-logic.md`,
`result/task035-namespace-mount-logic.md`,
`result/task035-canvas-zlz-stream-logic.md`.

### Part B (B1)

- Build the spec from: `result/task033-protocol-chain.md` (every proven
  exchange), `result/task033-client-dispatch-map.csv` + 034 naming
  (v95 structures), `result/task032/033 opcodes` tables.
- Format: per exchange — client preconditions (state fields), the exact
  bytes the client sends (from the live transcripts), the reply(s) the
  client parses (field-by-field where proven), the state transitions
  (CWvsContext/CLogin fields per v95, labeled), and the follow-up the
  client must perform (e.g., THE login-socket close before migration).
- Every row evidence-classed: live-proven / server-code-proven /
  reference-derived.

Create: `result/task035-client-behavior-spec.md` (+ CSV companion if the
table form is cleaner).

## Restrictions (inherited)

- Static analysis only; the protected client is never run.
- No committing any binary or third-party library; findings and
  project-owned scripts only.
- Reference material: names/structure only; every reference-derived row
  labeled; never addresses copied into CMS079 conclusions.
- Part B must not invent client behavior: unproven internals stay
  reference-derived or marked unknown.

## Operational machinery (inherited)

Sync gate (clean tree, ff-only, STARTING_HEAD); `.work/task-035/`
scratch; mandatory reading: `result/task026-function-map.csv`,
`result/task034-*` (census/graph/architecture),
`result/task033-protocol-chain.md`,
`reference/maplestory-symbols/upstream/**`; time budget 8-16 h
(E0 10%, E1 20%, E2 20%, E3 15%, E4 10%, B1 20%, buffer 5%); stop
conditions A-D as before; commit message `Complete Task 035 engine
method recovery client behavior specification campaign`; never force
push.

## Final Report

Create `result/35-engine-methods-client-behavior-spec.md` +
`task035-milestones.csv`, `task035-blockers.csv`,
`task035-progression-timeline.csv`. The report must state: subsystem
coverage and depth; the strongest logic-level discoveries; the spec's
coverage of the proven protocol chain; strongest finding / uncertainty /
blocker; next direction.

The most important question Task 035 must answer:

```
"Can the reachable engine code be read to method-level logic (framework,
WZ mount, stream path) — and can the client's per-packet behavior be
specified completely from proven evidence — completing every remaining
reachable client-side objective?"
```
