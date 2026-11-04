# Task 027 — Main EXE game logic recovery campaign (final report)

RUN DATE 2026-10-13/14 · STARTING_HEAD `bc71cca8d9059b81fc7ec293c82700bb44a80a24`
(sample `MapleStory.exe` SHA-256 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`,
revalidated host-side and in every guest run; `ijl15.dll` `b1bc97dc…`,
`iloveaki.dat` `41d37bfb…` — all match Task 026 records, so every prior RVA
conclusion remained valid.)

## 0. Task 027 complete?

**Yes — as a campaign, ending on Stop C (R1 blocked by infrastructure at the
deepest ordinary-workflow reset level) + Stop D (~7 h of high-value
exploration completed with a precise next direction).** All minimum success
criteria met: sync/HEAD recorded (origin unreachable at start, retried
clean mid-campaign, no divergence), Task 026 stale-state audit done,
canonical sample revalidated, VM/QEMU foundation systematically rebuilt
(container → QEMU → transfer image → **WSL2 hypervisor**), current-session
R1 attempted 3× with full instrumentation, main-EXE materialization/static
bridge work performed (major tooling breakthrough), milestone/blocker
ledgers maintained, and every count/artifact distinguishes current runtime,
historical runtime, support-DLL static, and main-EXE recovery.

Highest milestone reached: **R0** (and honestly only R0 — see §2).

## 1. FINAL_COMMIT / push status

Recorded at push time (see §12). No force push; origin/main had not
diverged.

## 2. Milestones — why nothing above R0 is claimed

- **R0 reached** — the rebuilt foundation reproduces the known historical
  outcome class (client spin) on demand with the exact signature, including
  after the deepest reset (T27F3).
- **R1 blocked (0/3)** — T27F1/F2 (fresh container + fresh QEMU + fresh
  xfer3.img, F:-client, exact T25 success topology) and T27F3 (after full
  `wsl --shutdown` + container restart) all spun; `aki=False` for every
  full window. Historical Task 025 evidence was NOT counted (per spec).
  Infrastructure falsification ladder now closed: container uptime, QEMU
  lifetime, transfer-image state, hypervisor-VM state — all excluded; what
  remains outside ordinary workflow is the Windows host itself.
- **R2 not-started** (requires R1; the authorized OK-click machinery was
  staged in every run and never fired).
- **R3 not-started** — Tail A has **0 writes** in every offline state; the
  ZtlTaskMem slots stay zero. The significant 0x862000+ progress this task
  (see §6) is *protector-side* execution, not game-code materialization.
- **R4/R5 not-started** — 0 game-side anchors (see §7 for the honest
  counting).
- **R6/R7 not-started** — no ws2_32/socket/9555 ever, in any run, ever.

## 3. Task 026 consistency fixes

11 corrections (audit: `result/task027-task026-consistency-audit.md`):
M1/M3/M5 relabeled to distinguish historical-runtime/support-DLL claims;
falsified F:/G: causal language and "T26F3 in flight" removed from the
startup chain; T26F4 "discriminator in flight" completed + F5/F6/F7/C2 rows
added to the observation file; stale B04/B06 pending states closed; the
confirmed-count 36→34 transcription error fixed; call-edges row E19's
quoting bug repaired (all 23 rows now parse).

## 4. VM/QEMU foundation

Rebuilt (details: `result/task027-runtime-foundation.md`): container
restart, fresh QEMU per run (lifecycle fix — every run ends with guest
shutdown), fresh `xfer3.img` (new FAT, MBR-compatible, minimal staging),
unchanged snapshot `win7x86-clean` and client disk, full WSL2 hypervisor
reset for T27F3. QEMU 7.2.22 TCG / coreduo / 2048 MB recorded. Reproducible
spin ✓; gate ✗ (0/3 — Stop C at hypervisor level).

## 5. iloveaki gate / OK click

Not reached this session (0/3). OK click never executed. Post-modal
observation not applicable; per task rules no placeholder files were
created for those phases.

## 6. Main-EXE static bridge — the campaign's real progress

New reusable tool: **`scripts/maple079_full_replay.py`** — a faithful
offline replay that answers environment queries with truthful guest values
(real Win7 SP1 x86 DLLs extracted from the project ISO, mapped at
guest-observed bases with relocations applied; absent devices/keys/files
fail as on the real OS; no debugger; synthesized TEB/PEB; **real ntdll
SEH dispatch incl. `ZwContinue`**). It executes the protector **past the
SoftICE probes for the first time** and up to the post-probe timing phase
(n≈20.2M instructions):

1. Probes SICE/SIWVID/NTICE answered truthfully (absent) — passed.
2. **The runtime's exception-driven control flow reproduced**: deliberate
   illegal instruction at RVA **0x862E76** (matches Task 003's runtime
   exception RVA exactly) → ntdll dispatch → handler **0x862F19 inside the
   decoded 0x862000+ region** → resume at 0x862E7A. Consequence: 0x862000+
   is *not* uniformly "encoded data" — parts are executed post-probe
   through SEH traps, and static disassembly there must model exceptions.
3. `winmm.dll` loads (4th module — matching the guest module timeline
   exactly), then a `timeGetTime` timing loop: the fork territory.
4. The replay then diverges into the **"Themida - http://www.oreans.com"
   error reporter** (probe-cluster failure path, icon-char parser, strings
   `\\.\SICE`/`\\.\SIWID`/`\\.\NTICE` inline at 0x859507) — an
   emulation-detection divergence; clock-scale tests (100× fast / 10×
   slow) prove the failing check is *scale-invariant*, i.e. not the raw
   timing values.
5. Also falsified cleanly: all four "region-start aPLib" decode hypotheses
   (section1-raw, probe-stop 0x862000+, uvrwsdpb, tpuaozxc tail) via a
   validated redirected-depack replay; the depacker is inline at
   0x912116 (no second-depack-call hypothesis possible); .rsrc payloads
   are encoded with only the directory tree plaintext.

Tail A / ZtlTaskMem / 0x862000+ status: Tail A untouched (0 writes) in
every offline state; Ztl slots zero; 0x862000+ refined as above
(`result/task027-main-image-boundary.md`,
`result/task027-materialization-timeline.csv`).

## 7. Function / class recovery (main EXE only)

`result/task027-main-function-map.csv`: **25 rows, all module=MapleStory.exe**
— 22 confirmed, 3 medium: entry stub, T1/T2/T3 chain producers, inline
aPLib depacker (new), MZ/PE scan, walker/wrapper, round-3, probes,
driver-install, Themida error reporter (new), #UD trap + SEH handler (new),
obfuscation gadgets, and the 3 ZtlTaskMem export slots. **Zero of these are
game-side anchors** — they are protector/loader/ztl-export infrastructure
and do NOT count toward R4/R5 (explicitly marked).

`result/task027-main-class-map.csv`: **0 game-side classes** (one honest
placeholder row saying exactly that). All 88 support-DLL classes remain in
task026-class-map.csv and are not counted.

## 8. startup/login chain

`result/task027-startup-login-callchain.md` +
`result/task027-main-call-edges.csv`: 16 edges — 11 confirmed
(static/runtime/replay) now extending through the #UD trap choreography and
the winmm/timing phase, 4 projected, 1 not-started. Current cut point:
inside the post-probe timing/behavior phase — the same place the real guest
timeline freezes and the replay diverges.

## 9. v95/reference correlations

`result/task027-reference-correlation.csv`: all game-side seeds remain
**unmatched** (game code unreached); accepted correlations are
protector-attribution only (Oreans/Themida family — now strengthened by the
on-error-box title; ZtlTaskMem export anchors). No addresses copied; the
`\\.\SIWID` spelling recorded verbatim.

## 10. Blockers

- **Primary (runtime, R1)**: B27-1 — gate closed under every ordinary
  reset; only the Windows host itself remains uncontrolled. Stop C.
- **Primary (static)**: B27-2 — the replay's emulation-detectable check
  inside the encrypted-EBP gadget chain (0x84B→0x857 zones); exact
  comparison not yet isolated; tooling ready.
- Secondary: encoded resource payloads (B27-3); aPLib-at-region-start
  falsified (B27-5); orchestrator lifecycle fixed (B27-4).

## 11. Strongest finding / uncertainty / next direction

- **Strongest new finding**: the protector's post-probe stage runs on
  exception-driven control flow with handlers inside the decoded 0x862000+
  region — reproduced offline through real ntdll dispatch — and the
  fork/decision territory is the `winmm`/`timeGetTime` phase immediately
  after, where every observed guest run freezes.
- **Strongest uncertainty**: the exact input of the fork (both for the
  guest's spin-vs-gate and for the replay's error-path divergence — the
  latter is proven scale-invariant, so it is not raw elapsed-time).
- **Recommended next broad direction**: continue the faithful replay
  through the resolver-gadget walk with per-gadget data-flow tracing to
  isolate the exact failing comparison; every downstream payoff (0x862000+
  decode semantics → import rebuild → ijl15 boundary → Tail A
  materialization → game code) then becomes reachable offline, independent
  of the blocked VM gate.

## 12. Artifacts

Results: `result/27-main-exe-game-logic-recovery.md` (this file),
`task027-task026-consistency-audit.md`, `task027-runtime-foundation.md`,
`task027-foundation-runs.csv`, `task027-milestones.csv`,
`task027-blockers.csv`, `task027-main-static-bridge.md`,
`task027-decoder-targets.csv`, `task027-main-image-boundary.md`,
`task027-materialization-timeline.csv`, `task027-main-function-map.csv`,
`task027-main-class-map.csv`, `task027-reference-correlation.csv`,
`task027-main-call-edges.csv`, `task027-startup-login-callchain.md`.
No network-stage or support-DLL-refinement files (phases not reached).
New reusable script: `scripts/maple079_full_replay.py`. Task 026 artifacts
corrected in place (§3).

FINAL_COMMIT / push status: recorded in the commit metadata at push time.
