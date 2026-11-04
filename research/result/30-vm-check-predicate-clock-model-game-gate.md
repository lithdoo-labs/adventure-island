# Task 030 — VM check predicate & clock-model game-gate campaign (final report)

RUN DATE 2026-10-14 · STARTING_HEAD `73e9d37cba8703d8800167eef58eb1d1e654e146`
· canonical `MapleStory.exe` SHA-256
`5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`
· Python 3.14.4 / Unicorn 2.1.4 / Capstone 5.0.7 / Win11 x64 host.

## 0. Task 030 complete?

**Yes — Stop C/D hybrid**: the campaign completed T0-T2 with a decisive
negative-form T1, rendered T3 immaterial, and converted T4 into a
precisely-proven boundary (B30-1). No fidelity corrections were
warranted (none invented); no branches forced; no prohibited techniques
used; regression gate green throughout.

## 1. Head / push

FINAL_COMMIT recorded at push time; no force push; `.work/` scratch
never committed.

## 2. Evaluator validation status (T0)

Delivered in provenance+differential form (stronger than per-op
symbolic execution): watch-list (API output buffers → later reads),
whole-run write-history census over the corridor read set, and a
6-scale diagnostic clock sweep. Validated against known landmarks
(GetLocalTime consumer relocation, SEH-window pointer store, Task 028
result cells); default run signature-identical to baseline.

## 3. The named terminal predicate (T1)

**The continuation selection is a pure function of the runtime-decoded
program state.** Two proof legs:

- **R1 (zero-flow)**: no pre-corridor API output reaches the corridor.
  GetLocalTime's wSecond/wMilliseconds, the cmdline bytes, the
  GetVersionEx fields, and the registry handle all terminate inside the
  newly-discovered **second VM instance** (table RVA 0x81464). The
  corridor's inputs are: decoded image + bytecode (deterministic from
  the sample), faithful resolved pointers, and APIT-CRC-staged tables
  over kernel32/advapi32 export data (both resolutions verified
  matched).
- **R2 (invariance)**: across clock scales 22.7→1135 (walk delta chains
  1→78 ms — a 5000× envelope) every control-flow landmark is
  bit-identical. Combined with Task 028's quantization and
  absolute-base falsifications: **no clock behavior changes any corridor
  branch.**

Task 029's "timeGetTime behavior state machine" reading is thereby
refined: the samples are consumed but drive nothing.

## 4. Acceptable clock window (T2) / clock model (T3)

The window is **empty** — the predicate admits or rejects no clock
behavior. The 15.625 ms tick model (Task 028 `--tgt-15ms`) is retained
as a fidelity option and is proven immaterial to the outcome.

## 5. V5 outcome (T4) — boundary proven

Every input channel is now proven faithful or inert except one: the
**runtime-decoded image**. The real guest (same sample, same DLLs, same
QEMU-TCG class) never takes the error continuation — F:-drive runs
reached the `iloveaki success.` modal (import rebuild + ijl15 boundary
crossed), G:-drive runs hung in a spin; **neither ever showed the
Themida box** the replay produces. Cross-validating the decoded image
requires dumping protected code from the live process — prohibited.
This is the Stop C condition, now reached by elimination rather than
by tooling exhaustion.

## 6. V6/V7/V8

Not reached (consequence of T4): no import reconstruction, Tail A
writes 0, no game anchors, no network. No placeholder artifacts.

## 7. Replay corrections

One tooling defect fixed (not a semantics change): checkpoint resume
overwrote `--clock-scale` with the saved value (silently neutralizing
checkpoint-based clock experiments; Task 027/028 full-run experiments
were unaffected). Regression-verified. Recorded in
`task030-replay-baseline.md`.

## 8. Strongest new finding / uncertainty / blocker

- **Strongest finding**: the divergence-elimination proof — the replay
  divergence is independent of *every* controllable input; plus the
  discovery of the **second (pre-corridor) VM instance** consuming all
  environment APIs with zero flow into the corridor VM.
- **Strongest uncertainty**: where exactly the decoded-state divergence
  lives (stage-2/3 decode vs VM2 staging vs real-machine execution
  aspects outside the emulated surface) — and the unexplained F:/G:
  fork on the real guest (B30-2), which shares the same signature.
- **Primary blocker**: B30-1 — decoded-image ground truth (prohibited
  channel).

## 9. Recommended next broad direction

The offline replay route has reached its evidence boundary at the
corridor. Two honest continuations, in priority order:

1. **Runtime-observational route (if the VM gate reopens naturally)**:
   a single instrumented guest run that passively records *when* the
   protector completes vs hangs (F:/G: fork) and captures any
   non-code-observable state (module timeline deltas, thread
   appearance timing) around the fork — no code extraction.
2. **Static route**: full decode of the second VM (table RVA 0x81464)
   — its programs consume every environment API and stage VM1's
   context; a decoded VM2 would either expose a check whose input the
   replay models unfaithfully (re-opening D3 with a named input) or
   confirm the elimination proof from the static side.

## 10. Artifacts

`result/30-vm-check-predicate-clock-model-game-gate.md` (this file),
`task030-replay-baseline.md`, `task030-symbolic-eval.md`,
`task030-terminal-predicate.md`, `task030-clock-behavior-window.csv`,
`task030-milestones.csv`, `task030-blockers.csv`,
`task030-replay-runs.csv`, `task030-progression-timeline.csv`,
`task030-main-static-bridge.md`. Tooling: watch-list + `--write-log` +
checkpoint clock-scale fix in `scripts/maple079_full_replay.py`.
