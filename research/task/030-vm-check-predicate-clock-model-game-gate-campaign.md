# Task 030 — VM Check Predicate & Clock-Model Fidelity Game-Gate Campaign

## Objective

Continue from Task 029.

Task 029 decoded the protector's bytecode VM and proved that its
verification walk is a **timeGetTime behavior state machine**:

- handler table at RVA 0x84B1E0 (opcode 0x00 = the error reporter),
  dispatch `xor bl,al; movzx eax,al; jmp [edi+eax*4]`, bytecode window
  RVA 0x865733-0x86A475, encrypted frame base `ebp=0xF97D9014`;
- the walk is a loop (Z-block 208 ops, 0xA6 branch −488 self-loop;
  X-block 127 ops, +5 exit), with per-cycle expected constants
  (Z=0x193155AD, X=0x193162AE, staging 0x193159AD/0x193163AD);
- each steady cycle calls the timeGetTime wrapper (native RVA 0xC4B4CC,
  lock-cmpxchg guard), compares consecutive samples
  (`cmp old,new; pushfd` at RVA 0xC5782C — flags 0x83 when new>old),
  and folds the flags byte + prev_delta<<16 (edx) + accumulator;
- the post-walk tail (132 ops) computes the error continuation via the
  0x2E3D5322 constant chain and installs it as the VM continuation
  (Task 028 D1).

Task 030 does not repeat environment experiments and does not re-audit
closed hypotheses (timing scale/granularity/absolute-uptime sweeps,
PEB/TEB fields, concurrency, GetVersionEx layout, cmdline quoting — all
falsified or fixed in 027/028).

The goal is to close the decode and act on it:

```
symbolic evaluator over the VM stack ops
 -> one full Z+X cycle + post-walk tail evaluated
 -> the terminal predicate NAMED (what clock behavior is demanded)
 -> faithful Win7 tick-timer model (15.625 ms phase-anchored ticks,
    equal-sample bursts) implemented from documented semantics
 -> faithful replay naturally selects the non-error continuation (V5)
      -> import reconstruction (V6) -> Tail-A (V7) -> game anchors (V8)
 OR the boundary is proven with the predicate named (Stop B/C)
```

## Milestones

- **T0** symbolic evaluator working — validated by reproducing the
  observed per-cycle values (result cell 2/0, accumulator evolution)
  from the decoded program + inputs alone
- **T1** terminal predicate named — the tail comparison's two sides
  expressed as functions of named inputs (flags sequence, delta chain,
  accumulator, constants)
- **T2** acceptable behavior window enumerated — the set of clock
  behaviors the predicate admits
- **T3** faithful tick-timer clock model implemented — 15.625 ms
  phase-anchored ticks (boot-anchored phase), equal-value bursts within
  a tick, integer-ms truncation semantics matching Win7 timeGetTime
- **T4** V5 outcome — the faithful replay naturally passes the old
  divergence (or the boundary is proven with the predicate named)
- **V5/V6/V7/V8** unchanged from Task 029 (continuation / import
  reconstruction / Tail-A / game anchors)

Milestone honesty rules inherited: no inflated claims; V5 counts only
on a natural pass; protector/support-DLL functions never count toward
V8; no empty placeholder artifacts.

## Main Work

### 1. Symbolic evaluator (T0)

Extend `scripts/maple079_vm_disasm.py` with an evaluator over the
tabulated opcode semantics (0x89/0x99/0x7D/0x75/0x8F/0xA8/0x61/0x88/0xA6
effect signatures from `result/task029-opcode-semantics.csv`):

- input: decoded program (one Z-block, one X-block, the tail) + the
  observed inputs (sample pair, prev_delta<<16, accumulator, constants);
- output: per-op symbolic stack/register state and the final comparison.

Validation requirement: the evaluator must reproduce, from inputs alone,
the observed result-cell values (2/0), the accumulator sequence
(0x97→0x83→0x93→0x87…→0x46), and the terminal continuation selection —
before its predicate output is trusted.

Create:

- scripts/maple079_vm_eval.py (or the evaluator inside the disassembler)
- result/task030-symbolic-eval.md

### 2. Name the terminal predicate (T1)

Evaluate the last X-block + post-walk tail symbolically:

- express the comparison that selects error-vs-normal continuation as
  `f(flags_sequence, delta_chain, accumulator, constants)`;
- record both sides with their exact dataflow (provenance labels
  inherited from Task 028: TIMEGETTIME:sampleN, API constants, etc.).

Create:

- result/task030-terminal-predicate.md

### 3. Enumerate the acceptable behavior window (T2)

From the predicate: which inter-sample behaviors pass?

- equal-value bursts (new==old) allowed? required?
- delta bounds / sequence constraints?
- the role of the observed first-delta irregularity (9 ms after the
  spin phase) and the steady 15/16 ms alternation;

Create:

- result/task030-clock-behavior-window.csv

### 4. Faithful tick-timer model (T3)

Implement Win7's documented default timer semantics in the replay clock
(evidence-based, not outcome-directed):

- 15.625 ms ticks (64 Hz) with a boot-anchored tick phase;
- timeGetTime returns the integer-ms truncation of the tick count —
  consecutive calls within one tick return EQUAL values, and the
  value advances by 15/16 ms across tick boundaries;
- Sleep rounds up to the next tick boundary;
- the model must be justified from the decoded predicate + documented
  Windows semantics, never tuned until a branch flips.

Create:

- result/task030-clock-model.md (semantics, sources, implementation)

### 5. V5 attempt (T4)

- rerun the faithful replay (full + checkpoint) with the T3 model;
- record whether the walk aggregate, the tail comparison, and the
  continuation selection change **naturally**;
- if passed: immediately continue to §6/§7;
- if not: use the T1 predicate to prove which requirement fails and why
  the offline replay cannot faithfully satisfy it → Stop B/C record.

Create/append:

- result/task030-replay-runs.csv
- result/task030-milestones.csv (honest state)

### 6. Import reconstruction (V6, only if V5 falls)

Record DLL hash/name resolution, IAT writes, API bindings, module
loading (watch specifically for ijl15.dll / PCOM / NameSpace / Canvas /
ZLZ / ws2_32 but do not assume order).

Create:

- result/task030-import-reconstruction.md

### 7. Tail-A + game anchors (V7/V8, only if reached)

- Tail-A first-write provenance (producer RVA, instruction, source,
  destination range, length; metadata only — never commit code bytes);
- region classification (protector/loader/runtime-support/probable-game/
  confirmed-game); function/class/call-chain recovery with two
  independent evidence sources per name; only `MapleStory.exe` game-side
  anchors count toward V8.

Create (only when reached):

- result/task030-tail-a-materialization.md
- result/task030-main-function-map.csv
- result/task030-main-class-map.csv
- result/task030-reference-correlation.csv
- result/task030-main-call-edges.csv
- result/task030-startup-login-callchain.md

## Restrictions

Do not:

- force VM continuation; modify bytecode; patch branches; patch API
  results; bypass protection; dump decrypted protected code;
- **tune the clock model until the branch changes** — the T3 model must
  be derived from the decoded predicate plus documented Win7 timer
  semantics; if the predicate admits several models, choose by
  documentation, not by outcome;
- write expected or actual values by hand to make the walk pass.

All progress must come from understanding the existing execution model.
Full inherited safety boundary (Task 028 §0.2): offline static/dynamic
analysis allowed; standalone guest truth probes allowed; no patching,
no spoofing, no injection, no live-process extraction, no committing
original binaries or decoded blobs.

## Operational machinery (inherited)

- **Sync gate**: clean tree, `main`, ff-only pull; record
  STARTING_HEAD; re-read this document from disk after sync.
- **Directories**: `.work/task-030/` scratch (`eval/ clock/ replay-runs/
  materialization/ functions/ classes/ logs/`); commit only normalized
  text/CSV + reusable scripts.
- **Mandatory reading**: `README.md`; `task/029-…campaign.md`;
  `result/29-protector-vm-bytecode-decompilation.md`;
  `result/task029-vm-architecture.md`;
  `result/task029-check-programs.md`; `result/task029-check-items.csv`;
  `result/task029-opcode-semantics.csv`; `result/task029-blockers.csv`;
  `result/28-protector-decision-tail-a-materialization.md`;
  `result/task028-decision-isolation.md`;
  `result/task028-replay-fidelity-fixes.csv`;
  `scripts/maple079_full_replay.py`; `scripts/maple079_vm_disasm.py`.
- **Sample/tool gate**: revalidate `5d280cf1…`; reproduce the Task 028/29
  baseline (count 20,211,772, box, checkpoint n=18,865,228);
  record `result/task030-replay-baseline.md`.
- **Time budget** (8–16 h): T0 evaluator 15–25%; T1/T2 predicate +
  window 20–30%; T3 clock model 10–15%; T4 V5 attempt 10%; V6–V8
  continuation 30–60% once V5 falls; VM experiments ≤5% opportunistic.
- **Stop conditions**: A) V8 reached with a sustainable pipeline;
  B) predicate proves the real semantics imply the same failure path and
  progress needs a prohibited bypass; C) the required root input cannot
  be recovered offline (prohibited live extraction); D) 8–16 h of
  high-value work with precise state + clear next direction. A single
  opcode resisting symbolic evaluation is not a stop condition.
- **Hygiene**: `git status --short && git diff && git diff --cached`;
  commit message `Complete Task 030 VM check predicate and clock-model
  game-gate campaign`; record FINAL_COMMIT; push `origin main`; never
  force; never commit `.raw/`, `.work/`, binaries, dumps, decoded blobs.

## Evidence vocabulary

Inherited: confirmed-static/-replay/-runtime, historical-runtime,
faithful/incomplete/incorrect/context-dependent, proven-root-input,
proven-control-dependency, supported-correlation, hypothesis,
falsified. "Anti-emulation check" remains forbidden as a confirmed
label until the decoded predicate demonstrates that intent.

## Final Report

Create:

- result/30-vm-check-predicate-clock-model-game-gate.md
- result/task030-milestones.csv
- result/task030-blockers.csv
- result/task030-progression-timeline.csv
- result/task030-main-static-bridge.md

The final report must state: Task 030 complete? STARTING_HEAD /
FINAL_COMMIT / push status; highest milestone and why; evaluator
validation status; the named terminal predicate; the acceptable clock
window; the clock model and its evidence base; V5 outcome (natural pass
/ boundary proof with the failing requirement named); V6/V7/V8 status
if reached; replay corrections (with evidence + regression); strongest
new finding / uncertainty / blocker; recommended next direction;
generated files.

The most important question Task 030 must answer is not:

```
"Can we make the walk pass?"
```

It is:

```
"What clock behavior does the protector's verification walk demand, does
a faithful Win7 timer model provide it, and does the faithful replay
therefore continue into import reconstruction and the game body — or is
the boundary real and provable?"
```
