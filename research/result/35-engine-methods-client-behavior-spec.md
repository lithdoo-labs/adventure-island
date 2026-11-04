# Task 035 — Engine method recovery & client behavior specification (final report)

RUN DATE 2026-10-14 · STARTING_HEAD `ecaf684ae3e190735e6bcb2fff90ad7bb54df331`
· canonical client sample `5d280cf1…` unchanged; static analysis only —
the protected client was never run.

## 0. Task 035 complete?

**Yes — Stop A: E0-E4 and B1 all reached.** Both user-directed tracks
delivered: the reachable engine code read to method-level logic, and the
client's per-packet behavior fully specified from proven evidence.

## 1. Head / push

FINAL_COMMIT at push; no force push; text artifacts only (the
disassembly tooling stays in `.work/` as documented scratch — it is a
one-shot analyzer, no committed third-party code; capstone is a pip
dependency of the analysis environment, not the repo).

## 2. Part A — the strongest logic-level discoveries

1. **PCOM is a hand-rolled COM workalike, now fully specified**: real
   `IID_IClassFactory`, CO_E_NOTINITIALIZED/E_POINTER HRESULT gates, a
   module registry whose records carry {hModule, DllGetClassObject,
   DllCanUnloadNow, factory-map}, FreeLibrary unload polling, and the
   namespace root as an AddRef'd singleton. Engine DLLs bind its five
   Pc* functions by name at runtime (BindPCOM table decoded in
   NameSpace @ 0x9A8D).
2. **NameSpace binds ALL imports dynamically** (name strings in .rdata)
   and mounts WZ archives as **memory-mapped files**
   (CreateFileMappingA/MapViewOfFile); `_lrotl/_lrotr` imports are the
   string-crypto rotates. The famous 2002 plaintext header string is
   **dead code** — zero references anywhere (v079 mounts the
   PKG1-encrypted format Task 023 already parses).
3. **The Canvas→ZLZ wiring decoded at instruction level**: exactly three
   call sites (create-inflator / create-deflator / close-filter) owned
   by one filtered-stream wrapper class (vtable 0x286D4) holding its
   ZIStream* at [this+4] and forwarding reads/writes through the
   filter's first virtual. This is the single point the repack's custom
   codec enters the Wizet engine.
4. Tooling finding (B35-1): these DLLs' import descriptors have
   INT ≠ IAT — call-site recovery must resolve through FirstThunk
   (documented for all future static work).

## 3. Part B — the client behavior specification

`task035-client-behavior-spec.md`: the launch contract (argv ip/port),
the login leg exchange-by-exchange (with the exact proven bytes and the
**login-socket-close-before-migration** requirement), the channel entry
burst inventory, the cash-shop boundary, and the renumbered opcode
table — every row tagged [live]/[srv]/[v95]/[?]. Unproven internals are
explicitly marked unknown; nothing is invented.

## 4. Strongest finding / uncertainty / blocker

- **Strongest finding**: the engine's integration spine (PCOM
  activation + dynamic binding + memory-mapped WZ mount + the ZLZ
  injection point) is now documented at instruction level — the
  "framework" layer of the client is a *closed book*.
- **Strongest uncertainty**: channel-zone opcode values (0x14+) and the
  client's cash-shop entry construction remain unenumerated.
- **Primary blocker**: the game body (inherited VM boundary) — nothing
  new required from it for either Part A or B.

## 5. Recommended next direction

(a) live-enumerate the channel-zone opcode table (extends the 033
method); (b) if the engine matters further: the Sound family and
Gr2D/Shape2D render pipeline by the same method; (c) the client side is
otherwise **statically complete** — the remaining doors are the
opportunistic VM gate or the server/protocol legs.

## 6. Artifacts

`result/35-engine-methods-client-behavior-spec.md` (this file),
`task035-pcom-framework-logic.md`, `task035-namespace-mount-logic.md`,
`task035-canvas-zlz-stream-logic.md`, `task035-client-behavior-spec.md`,
`task035-milestones.csv`, `task035-blockers.csv`,
`task035-progression-timeline.csv`.
