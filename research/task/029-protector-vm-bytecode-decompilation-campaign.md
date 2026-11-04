# Task 029 — Protector VM Bytecode Decompilation & Import Reconstruction Campaign

> This document is the canonical Task 029 specification. It combines the
> compact mission/milestone definition with the operational campaign
> machinery used by Tasks 026–028 (sync gate, safety boundary, budget,
> stop conditions, submission hygiene).

## Objective

Continue from Task 028.

Task 028 established that the 0x84Bxxx–0x866xxx region is not a normal
opaque blob but a custom bytecode VM:

- handler table around RVA 0x84B1E0 (opcode 0x00 = the error reporter
  0xC5941F itself)
- VM dispatch `jmp dword ptr [edi + eax*4]` (RVA 0x8574D9) on an
  obfuscated opcode byte (`xor bl, al; movzx eax, al`)
- VM state stored through encrypted frame addressing
  (`ebp = 0xF97D9014`, `[ebp + 0x744xxxx]` → Tail B)
- API resolution through "APIT" CRC-32 hashing (poly 0x54495041;
  `Sleep` resolution proven end-to-end)
- continuation selection controlled by VM state (D1 = RVA 0x84E638
  `pop [edx]` at n=20,204,446 installing 0xC5941F into cell [0x84B1E0])
- the verification walk (26 items; steady-state Z/X programs of 208/127
  ops; parameter cells 0x84B364/0x84B3B4/0x84B404/0x84B478/0x84B480)
  **completes normally** — the post-walk continuation selects the error
  entry, and the divergence lives in the staged-data dimension

Task 029 does not continue environment experiments. Task 028 already
fixed every externally-testable semantic defect and falsified the
timing / PEB-TEB / concurrency hypotheses; do not re-litigate them
unless the decode surfaces a specific new consumer.

The goal is to reverse the VM itself:

```
VM bytecode
 -> opcode semantics
 -> verification scripts
 -> staged parameter table
 -> continuation graph
 -> import reconstruction
 -> Tail-A materialization
 -> main EXE game logic
```

## Milestones

- **V0** VM inventory completed
- **V1** opcode handler table recovered
- **V2** bytecode disassembler working
- **V3** 26-check verification program reconstructed
- **V4** staged parameter table identified
- **V5** normal continuation path recovered
- **V6** import reconstruction observed
- **V7** Tail-A materialization observed
- **V8** MapleStory.exe game-side anchors recovered

Milestone honesty rules inherited from Task 028: no inflated claims;
V5 counts only when the faithful replay naturally selects the
non-error continuation (or the continuation's requirements are fully
decoded and proven unreachable offline — a valid boundary result);
protector/support-DLL functions never count toward V8.

## Main Work

### 1. Build VM model (V0)

Document:

- opcode byte format
- handler dispatch
- VM registers/state
- stack/frame behavior
- memory model
- branch/continuation mechanism

Create:

- result/task029-vm-architecture.md
- result/task029-vm-handlers.csv

### 2. Recover opcode semantics (V1)

For reachable handlers from the dispatch table:

Record:

- handler RVA
- opcode
- inputs
- outputs
- memory effects
- control-flow effects

Task 028's static first pass gives the starting classes: 0x61/0x3E =
`lodsb; xor al, bl` immediate fetch, 0x88/0x8E/0x92 = 32-bit immediate
variants, 0x7D = `pop [edx]` store-to-cell, 0x99 = `push [edx]`
push-cell, 0xA6 = conditional check (`lodsd; jmp 0xC4F6A5` →
`cmp [edi+0x20],0; je`), 0x36 = `push [edi+0x38]`. Cross-validate every
class dynamically with a clean opcode tracer added to
`scripts/maple079_full_replay.py` (record the dispatch index only at
the exact `movzx eax, al` → `jmp [edi+eax*4]` pair with `edi` equal to
the table base; this also removes the extraction noise seen in the
Task 028 ad-hoc opcode stream).

Create:

- result/task029-opcode-semantics.csv

### 3. Build bytecode disassembler (V2)

Use decoded image evidence only.

The disassembler should output:

- opcode sequence
- handler mapping
- immediate values
- VM state reads/writes
- branches

Decoder validation requirement: at least one protector constant known
from the dynamic trace (e.g. the error-target arithmetic
`add [esp+4], 0x2E3D5322`) must be reproduced from the decode alone
before the decoder is trusted.

Create:

- scripts/maple079_vm_disasm.py

### 4. Decode verification scripts (V3)

Recover the programs involved in:

- item 0–3 staged table construction (export walks + "APIT"-CRC hashing)
- 26 verification checks (steady-state Z/X programs, the anomalous
  92-op item, the boundary programs, the post-walk tail)
- continuation selection

Do not patch success.

The goal is to understand the checks.

Create:

- result/task029-check-programs.md
- result/task029-check-items.csv

### 5. Recover staged parameter provenance (V4/V5)

For every consumed value:

Track:

- producer
- source API
- transform
- storage location
- VM consumer

Extract both sides as normalized tables:

- **actual** — the staged values each walk item reads in the faithful
  replay (per-item dump of the parameter cells and the accumulator fold)
- **expected** — the comparison immediates decoded from the bytecode
  (protector constants)

The per-item diff names the failing check(s) and their inputs; the
provenance walk then ties each input to its root source and to real
Win7 semantics (documents, system-DLL disassembly, or standalone guest
truth probes — e.g. Win7 Pro's exact `wSuiteMask` bits, if anything
consumes them).

Create:

- result/task029-staged-data-map.csv
- result/task029-staged-parameters.csv   (item, operand, actual, expected, match)

### 6. Continue to import reconstruction (V6)

Only after the VM naturally selects the non-error continuation.

Record:

- DLL hash/name resolution
- IAT writes
- API bindings
- module loading

Create:

- result/task029-import-reconstruction.md

### 7. Tail-A observation (V7)

If Tail-A receives writes:

Record metadata only:

- producer
- destination range
- size
- timing
- classification

Do not commit extracted protected code.

Create:

- result/task029-tail-a-materialization.md

### 8. Game-side recovery (V8)

If newly materialized main-EXE code appears, classify regions
(protector / loader / runtime-support / probable-game / confirmed-game)
and recover function/class/call-chain anchors with two independent
evidence sources per name. Only `MapleStory.exe` game-side anchors
count toward V8; protector and support-DLL rows are reported separately.
Useful target families, only with evidence: `CWvsApp`,
`CClientSocket`, `CLogin`, `CStage`, `CField`, `CUser`, `CUI*`,
application bootstrap, packet dispatch, network init.

Create (only when reached):

- result/task029-main-region-classification.csv
- result/task029-main-function-map.csv
- result/task029-main-class-map.csv
- result/task029-reference-correlation.csv
- result/task029-main-call-edges.csv
- result/task029-startup-login-callchain.md

## Restrictions

Do not:

- force VM continuation
- modify bytecode
- patch branches
- patch API results
- bypass protection
- dump decrypted protected code

All progress must come from understanding the existing execution model.

The distinction that governs this task:

```
expected values read out of the protector's own bytecode = analysis
staged actuals produced by a faithful replay              = analysis
writing either by hand to make the walk pass               = forbidden
```

If the decode shows the walk can only pass with data the offline
replay cannot faithfully produce, record the blocker and stop that
branch rather than synthesizing the value.

Full inherited safety boundary (identical to Task 028 §0.2): offline
static/dynamic analysis of the local client is allowed; standalone
guest truth probes are allowed; no patching, no branch forcing, no
spoofing, no debugger/VM concealment, no injection, no live-process
extraction, no committing original binaries or decoded blobs.

## Operational machinery (inherited from Tasks 026–028)

### Repository synchronization gate

From a clean `origin/main`:

```text
git status --short
git branch --show-current
git remote -v
git rev-parse HEAD
```

If tracked/uncommitted changes exist, stop and report. Otherwise
`git fetch origin`, switch to `main` if needed,
`git pull --ff-only origin main`, record `STARTING_HEAD`, then re-read
this document from disk. If origin advanced mid-campaign, fetch and
report divergence rather than rewriting history.

### Directory / artifact contract

```text
.raw/    proprietary inputs, read-only
task/    task specifications
.work/task-029/   all scratch decoding, traces, dumps, probes
result/  compact permanent conclusions / normalized tables
scripts/ reusable project-owned tooling
```

Scratch structure: `vmref/ programs/ staging/ replay-runs/
guest-truth-probes/ materialization/ functions/ classes/ references/
network/ logs/` under `.work/task-029/`. Never commit `.raw/`, `.work/`,
EXE/DLL/DAT/SYS/VXD/WZ, memory/replay images containing decoded code,
decrypted blobs, ETL/EVTX/PCAP, decompiler databases, or huge raw
traces.

### Mandatory reading

`README.md`; `task/028-protector-decision-tail-a-materialization-
campaign.md`; `result/28-protector-decision-tail-a-materialization.md`;
`result/task028-milestones.csv`; `result/task028-blockers.csv`;
`result/task028-decision-isolation.md`; `result/task028-decision-slice.md`;
`result/task028-provenance-edges.csv`; `result/task028-main-static-bridge.md`
(includes the first opcode table); `result/task028-replay-fidelity-fixes.csv`;
`result/task028-api-fidelity.csv`; `result/task028-replay-determinism.csv`;
`scripts/maple079_full_replay.py`. Context as needed: Task 027 results,
Task 012/012c evidence for 0x862000+/Tail A/ZtlTaskMem, protector-chain
results 06–10b, support-runtime context 19/20/23, server/network
baseline 01/02/03.

### Sample and tool gate

Revalidate `MapleStory.exe` SHA-256
`5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`
and `python scripts/maple079_full_replay.py --help`. Record
Python/Unicorn/Capstone versions, host arch, guest-DLL source identity.
Reproduce the Task 028 final baseline once (post-fix default: count
20,211,772, error box, corridor checkpoint at n=18,865,228) and record
it as the Task 029 reference run
(`result/task029-replay-baseline.md`). Iteration cost: ~30 s from the
corridor checkpoint, ~75 s full.

### Time budget

```text
8–16 hours total

baseline + V0/V1 opcode reference        10–20%
V2/V3 disassembler + program decode      25–35%
V4/V5 tables + failing-check naming      15–25%
continuation attempt (fix or boundary)   10–20%
V6–V8 continuation if the path opens     30–60% once reached
VM experiments / guest probes            <=5% (opportunistic)
```

### Stop conditions

- **Stop A** — V8 reached and a sustainable recovery pipeline exists.
- **Stop B** — the decode proves the real semantics imply the same
  failure path and further progress requires a prohibited bypass.
- **Stop C** — the required root input cannot be recovered offline
  without prohibited live-code extraction.
- **Stop D** — 8–16 hours of high-value work completed with the decode
  state precisely documented and a clear next direction.

A single opcode class remaining `unknown`, or a single program
resisting decode, is not a stop condition.

### Submission hygiene

```text
git status --short && git diff && git diff --cached
```

Commit only safe text/CSV findings and reusable project-owned scripts.
Suggested commit message:

```text
Complete Task 029 protector VM bytecode decompilation campaign
```

Record `FINAL_COMMIT`, push `origin main`, never force.

## Evidence vocabulary

Inherited from Task 028: confirmed-static / confirmed-replay /
confirmed-runtime / historical-runtime / observed-side-effect;
faithful / incomplete / incorrect / context-dependent / unverified;
proven-root-input / proven-control-dependency / supported-correlation /
hypothesis / falsified. Do not use "anti-emulation check" as a
confirmed label; prefer "replay/guest divergence decision" until the
decode proves intent.

## Final Report

Create:

- result/29-protector-vm-bytecode-decompilation.md
- result/task029-milestones.csv
- result/task029-blockers.csv
- result/task029-replay-fidelity-fixes.csv (or a note that none were needed)
- result/task029-progression-timeline.csv
- result/task029-main-static-bridge.md

The final report must state:

- Task 029 complete? STARTING_HEAD / FINAL_COMMIT / push status
- highest milestone reached and why
- recovered VM model
- opcode coverage (documented / unknown counts; decoder validation)
- verification program status (which programs decoded)
- staged data status (tables extracted; items mismatching)
- the named failing check(s) and their inputs, if reached
- continuation status (natural pass, evidence-backed fix, or proven boundary)
- import reconstruction status
- Tail-A status (raw bytes committed? MUST BE no)
- game-side anchors (counts; protector/support rows separate)
- strongest new finding / strongest uncertainty / next blocker
- recommended next broad direction
- generated result files and scripts

The most important question Task 029 must answer is not:

```
"Can we make the walk pass?"
```

It is:

```
"What exactly does the protector's verification walk check, what does it
expect, what does a faithful environment actually provide — and does the
faithful replay therefore continue, or is the boundary real?"
```
