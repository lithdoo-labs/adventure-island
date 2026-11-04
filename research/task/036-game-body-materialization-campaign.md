# Task 036 — Game-Body Materialization Capture Campaign (A+B+C)

## Objective

Complete the game-body reversing per the user's directive (all three
doors), Task 031's boundary notwithstanding — because the boundary was
proven OFFLINE-closed, and the user has now authorized the one remaining
channel:

```
A (in-rules)   VM gate retry — the QEMU guest infrastructure is back
               (container task024-qemu UP). Natural client run past the
               iloveaki modal (authorized OK-click machinery, Task 026);
               passive observation of materialization (screenshots,
               status, CPU) — no debugger, no guest-side instrumentation
C (authorized) materialization capture — at the right post-modal moment:
               monitor `stop` + `pmemsave` (QEMU host-side; INVISIBLE to
               the guest — no anti-debug surface), pull the dump, and
               scan for the materialization markers; if the game body
               has unpacked, extract + statically recover it with the
               Task-035 toolchain (protocol anchors + v95 naming)
B (in-rules)   reference-reconstruction document — synthesize the game
               body's architecture from v95 + the proven protocol chain
               + 034/035 engine facts, merged with whatever A/C yield
```

## Scope of the user authorization for C (fixed hygiene conditions)

- Offline only: the QEMU guest runs `-nic none` (historical faithful
  config) — no public network at any point; the host side stays
  loopback-only.
- The sample is the project's own client; the capture is QEMU host-side
  memory of our own VM — no guest-visible debugger, no anti-debug
  bypass, no client patching (the Task-026-class restrictions on
  DEBUGGING and PATCHING remain in force; what is lifted is exclusively
  the prohibition on extracting the protected code from a memory
  capture of our own offline VM run).
- Captures and derived binary material stay in `.work/task-036/` and are
  NEVER committed; only normalized text/CSV findings and project-owned
  scripts enter the repository.

## Milestones

- **M0** VM gate verified — QEMU up, `win7x86-clean` loadvm, screenshot
  evidence, client drive attached
- **M1** natural run to modal — client launched in the guest; iloveaki
  modal reached (historical behavior reproduced)
- **M2** post-modal continuation — authorized OK click; passive
  observation window (screenshots/status series)
- **M3** materialization capture — monitor stop + pmemsave at staged
  post-click delays; dump pulled to host
- **M4** marker scan + verdict — the materialization markers in the
  dump (packet AES key dwords; FUNTY_BYTES table in EXE-space; loaded
  ws2_32/wnaspi32 imports in-process; decrypted PE headers) —
  materialized vs not, honestly recorded
- **M5** (conditional) game-body recovery — if materialized: extract
  the game image, run the 035 toolchain over it, name functions via
  protocol anchors (032/033) + v95 structure; first-ever CMS079
  game-body code documentation
- **M6** reference-reconstruction document (B) — game-body architecture
  synthesis merged with A/C results

## Main Work

1. Re-verify the 025/026 machinery (t025-vm.sh subcommands, observer
   scripts, the authorized OK-click path in scripts/
   maple079_postmodal_observe.ps1).
2. M0-M2 with the ORIGINAL `-nic none` config (fidelity first).
3. M3: capture series at increasing post-click delays (e.g. 60/120/240s)
   — each run starts from loadvm (clean reset).
4. M4: scan tool (project-owned) — markers above + entropy map of the
   MapleStory.exe region + import-table reconstruction of the
   materialized image.
5. M5 if positive: extract code sections; capstone pass; anchor table
   (protocol constants, the renumbered opcode pushes, the AES/OFB
   construction, ZtlTaskMem* exports at their materialized RVAs);
   function naming; the CLogin/network cluster first (highest value).
6. M6: `result/task036-game-body-reconstruction.md`.

## Restrictions

- All inherited restrictions stand EXCEPT the memory-capture prohibition
  as scoped above (user-authorized 2026-10-14).
- No patching of MapleStory.exe ever; no guest-side debugger ever; no
  public network ever.
- Nothing binary in the repo; findings + scripts only.
- Honest reporting: if the dump shows NO materialization, that is the
  result — recorded with the same rigor as a success.

## Operational machinery (inherited)

Sync gate; `.work/task-036/` scratch (captures stay here); mandatory
reading: `result/26-*`, `result/task025-*`, `result/31-*` (boundary
context), `scripts/maple079_postmodal_observe.ps1`,
`.work/task-025/host/t025-vm.sh`; time budget 8-16 h; stop conditions
A-D; commit message `Complete Task 036 game-body materialization capture
campaign`; never force push.

## Final Report

`result/36-game-body-materialization-campaign.md` + milestones/blockers/
timeline CSVs. Must state: A/C outcomes with evidence; the
materialization verdict; recovered game-body coverage (if any); the B
document; strongest finding / uncertainty / blocker; next direction.
