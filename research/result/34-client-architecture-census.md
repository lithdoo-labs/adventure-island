# Task 034 — Client game-logic architecture census (final report)

RUN DATE 2026-10-14 · STARTING_HEAD `e6355c264723c0fdfc2a7b629ee68072e3061e15`
· canonical client sample `5d280cf1…` unchanged; **static analysis only** —
the protected client was never run in this task.

## 0. Task 034 complete?

**Yes — Stop A: G0 through G5 all reached.** The campaign question is
answered: the client's architecture is completely mapped around the
protector boundary, with every claim's evidence class explicit
(proven-in-module / proven-absent / reference-derived / unreachable).

## 1. Head / push

FINAL_COMMIT at push; no force push; only text/CSV artifacts + no new
scripts needed beyond `.work/` scratch (the census tools remain in
`.work/task-034/`; they are one-shot analyzers, documented by this
report).

## 2. Census results

- **61 PE modules** censused (G0): engine 9 + ZLZ + stubs + anti-cheat
  stack + launchers. MapleStory.exe: kernel32-only static imports, 3
  exports (`ZtlTaskMem{Alloc,Free,Realloc}Imp`), packed.
- **64 real class names** (G1) via RTTI across the 10 game modules —
  the full `CWz*` engine object model (stream/archive/namespace/property/
  UOL/canvas/font/sound/shape families) with TD RVAs, merged with 026's
  vtable candidates. RTTI dialect identified as VC6-style inline TD
  comparison (why COL/vtable linkage doesn't apply — B34-1).
- **Anchor verdicts** (G2): the 256-byte shuffle table is present
  byte-identical in Canvas/PCOM/**ZLZ** (+ the obfuscated WZ-key array);
  the packet AES key, IV seed, hello prefix and server strings are
  **provably absent from every reachable module** → the packet codec is
  pinned to the EXE interior.
- **Module graph** (G3): launcher = `MapleStory.exe 127.0.0.1 9555`
  (server address from argv — the repack's modification); the engine is
  a COM-plugin system (DllGetClassObject everywhere) activated through
  PCOM (`PcCreateObject/…`); Canvas→ZLZ is the static codec edge; the
  EXE exports the Ztl allocator the DLLs consume.
- **Architecture document** (G5): `task034-client-architecture.md` — the
  layered map with the honest boundary.

## 3. Strongest finding / uncertainty / blocker

- **Strongest finding**: the client's reachable architecture is now
  *closed* — every module classified, every engine class a real symbol,
  the codec located by provable absence, and the launcher/framework
  mechanics pinned. Combined with 032/033's protocol chain, the project
  now possesses: the wire semantics + the engine object model + the
  reference structure of the game body + the exact boundary between
  them.
- **Strongest uncertainty**: per-method depth inside the engine DLLs
  (virtual-slot naming) remains heuristic (B34-1) — acceptable, since
  class identity and subsystem boundaries are proven.
- **Primary blocker**: the game body itself (B34-2, inherited 027-031);
  nothing new is required from it for the architecture picture.

## 4. Recommended next direction

(a) **ZLZ codec deep-dive**: the one reachable crypto module — full
analysis of `ZLZCreateInflator/Deflator/CloseFilter` and the
shuffle/key use, yielding the exact WZ/stream decryption algorithm the
client applies (complements `maple079_packet.py`'s validated table);
(b) channel-zone opcode enumeration (033 §6) to complete the renumbered
tables; (c) opportunistic VM-gate observation remains the only door to
the game body itself.

## 5. Artifacts

`result/34-client-architecture-census.md` (this file),
`task034-module-census.csv`, `task034-class-census.csv`,
`task034-anchor-search.csv`, `task034-module-graph.md`,
`task034-naming.csv`, `task034-client-architecture.md`,
`task034-milestones.csv`, `task034-blockers.csv`,
`task034-progression-timeline.csv`.
