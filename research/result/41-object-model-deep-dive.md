# Task 041 — Object-model deep-dive (final report)

RUN DATE 2026-10-16 · STARTING_HEAD `43e10e6aa7401c012b31bef08fbf698fa6e53e7d`
· corpus: the Task-036 capture; static only.

## 0. Verdict

**Stop C (a precisely-characterized temporal boundary)** with O0/O3
delivered structurally and the campaign's central question answered —
with an important negative: **the capture predates the game logic**.

## 1. The temporal finding (the campaign's headline)

- The static globals region (RVA 0x7D9xxx) sits in the capture's
  ZERO/missing pages; the singleton pointers read as NULL
  (version/delegate/socket/band objects — all not-yet-constructed).
- The CWvsContext object (a STATIC in-image object at RVA 0x7E2E90,
  reached via [0xBD9028] → 0xBE2E90) has **all identity fields zero**
  (CharacterId +0x205C = 0).
- Interpretation: the Task-036 capture is from the PROTECTOR-ERA
  spin — the body was UNPACKED (hence the readable image and
  initialized codec objects) but the game logic had not yet run (no
  warp, no context population). Consistent with: cipher objects live,
  game singletons null.

## 2. What IS delivered

- **CWvsContext structure**: static object @ RVA 0x7E2E90, **vtable @
  0x70D3C8 with 24 methods mapped** (including the characteristic
  0x29BBA-family short stubs shared with the 0x701xxx vtable family).
- **The field atlas (from handler semantics, S3/S040)**:
  +0x205C CharacterId (WARP writes) · +0x2080 warp byte · +0x2084
  spawn is-it-me compare · +0x2F60 char-changed flag · +0x2FE8 (0xA2
  check) — all verified by code, values pending a later-phase capture.
- **O4 integration**: the atlas joins `task040-game-logic-map.csv`.

## 3. The follow-up this defines (Task 042)

A **re-capture at a later phase** (post-modal + longer wait, or driven
to the login screen via the authorized OK-click machinery + the local
server) would populate the live objects — the same 036 method, now
with known targets: CWvsContext fields, the NULL singletons, the
identity model. The infrastructure (VM + observer + server) is all
proven.

## 4. Artifacts

`result/task041-milestones.csv`, `task041-blockers.csv`,
`task041-progression-timeline.csv`, this report; logs in
`.work/task-041/logs/`.
