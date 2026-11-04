# Task 031 — Second-VM environment decode & code-staging boundary campaign (final report)

RUN DATE 2026-10-14 · STARTING_HEAD `bd4801879f36b5026f8964d224f49aa330693c30`
· canonical `MapleStory.exe` SHA-256
`5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`
· Python 3.14.4 / Unicorn 2.1.4 / Capstone 5.0.7 / Win11 x64 host.

## 0. Task 031 complete?

**Yes — Stop C completed from both sides.** The campaign delivered the
all-VM census, the environment-check classification, the decisive
code-staging census, and the entry-state provenance; the M5 verdict
(boundary confirmed statically) completes the elimination begun in
Task 030. No fidelity corrections were warranted; no branches forced;
no prohibited techniques; regression gate green (default signature
unchanged).

## 1. Head / push

FINAL_COMMIT recorded at push time; no force push; `.work/` scratch
never committed.

## 2. Census results

Exactly **two** VM instances: VM2 (table RVA 0x821464, n
12,555,322-13,481,757, 2,248 dispatches, 32 opcodes) and VM1 (the
corridor). A third dispatch-site pattern (RVA 0x84A89A) never executes.
Between them: a **native environment phase** with zero VM dispatches.

## 3. VM2 decode coverage

Census + consumption windows complete (M1/M2 partial by design — the
full handler decode was provably unnecessary: VM2's outputs terminate
in its own context cells and never reach the corridor read set, code,
or entry state).

## 4. Named environment checks

VM2 consumes GetLocalTime's wSecond/wMilliseconds (and performs the
APIT-CRC resolution passes); the native phase consumes probes/cmdline/
versionex/registry — every one faithful (027/028 re-confirmed) and
zero-flow into the corridor.

## 5. Code-staging classification (M4 — the decisive phase)

- 4,512 of 4,515 corridor-executed addresses: written only in decode
  phases n<3.8M — **before the first environment API (n=12,671,622)** —
  deterministic sample-decode by construction.
- The 6 reporter instructions: re-written at n≈13.599M by the constant
  self-decrypt `new = ((orig + 0x5A192D3D) ^ 0x61799419)` (loop RVA
  0x593A1-0x59411, 49 dwords) — no environment input.
- VM1's entry state: seed 0x0748C71E = `(0x6B451A88 << 5) + 0x9EA5761E`
  (pure constants), `edi = 0x46BFD783` literal, `edx` constant chain,
  `esi` a decoded-image pointer. **No entry register is
  environment-derived.**
- Zero code writes across 3.8M→corridor (VM2 window and native window
  both empty).

## 6. V-ladder status

V5-V8 not reached (consequence of the verdict). Tail A 0 writes; no
import reconstruction; no game anchors; no network.

## 7. Strongest finding / uncertainty / blocker

- **Strongest finding**: the complete two-sided elimination — the
  corridor is a deterministic function of the sample + faithful
  answers, so the replay/real divergence is proven to lie **below the
  emulated surface** (or in the historical guests' below-hypervisor
  state — the F:/G: fork shares this signature).
- **Strongest uncertainty**: what actually drove the historical F:/G:
  fork (no API carries drive identity; the sample and DLLs were
  identical).
- **Primary blocker**: B31-1 (= B30-1 completed): the only remaining
  channels are prohibited (live extraction) or opportunistic (live
  passive observation).

## 8. Recommended next broad direction

The offline protector-decode route has reached a fully-proven boundary.
The highest-value safe continuations are: (1) opportunistic live-guest
passive observation of the F:/G: fork (non-code state only, per Task
030 §9); (2) pivot the campaign series to the **support-runtime and
server-side** legs (already recovered in Tasks 019-026) or to a fresh
research question, since the main-EXE protector boundary is now closed
offline. Completeness decode of VM2 remains available as documentation
work.

## 9. Artifacts

`result/31-second-vm-environment-decode-code-staging.md` (this file),
`task031-vm-census.csv`, `task031-environment-checks.csv`,
`task031-code-staging.csv`, `task031-verdict.md`,
`task031-milestones.csv`, `task031-blockers.csv`,
`task031-progression-timeline.csv`, `task031-main-static-bridge.md`.
Tooling: `--vm-dispatch-log` in `scripts/maple079_full_replay.py`.


## Continuation session addendum

A second session completed the remaining milestones and closed the last
open input channel:

- **M1 completed**: full VM2 opcode reference
  (
esult/task031-vm2-opcodes.csv — 32 executed opcodes with classes;
  loop-back op 0x69, branch op 0x54).
- **M2 completed**: the GLT-consumption program annotated (wMs enters via
  op 0x17 push [edx] at n=13,285,873; constant-chain fold into staged
  image bytes).
- **M3 deepened — the GLT differential elimination**: an 8-point sweep of
  (wSecond, wMilliseconds) across the real ranges (0-59 / 0-999) produced
  bit-identical instruction counts, API sequences, register hashes, and
  the same outcome on every run — only staged image bytes differed,
  proving no branch ever consumes them. The pre-corridor phase is now
  differentially invariant too, so **the whole 20.2M-instruction
  execution is invariant under every controllable input dimension**.

The Stop-C boundary now rests on three independent proofs: dynamic
invariance (030 R2 + the clock and GLT sweeps), data-read provenance
(030 R1), and code/entry determinism (031 M4). FINAL_COMMIT for this
session recorded at push time.
