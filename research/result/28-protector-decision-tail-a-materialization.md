# Task 028 — Protector decision & Tail-A materialization campaign (final report)

RUN DATE 2026-10-14 · STARTING_HEAD `a6c9b6cf7a12e0f22da71720cb7828b45c31bbc7`
(canonical `MapleStory.exe` SHA-256
`5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`,
revalidated; guest DLL set = Task 027's ISO-extracted Win7 SP1 x86
Professional DLLs at guest-observed bases, unchanged; Python 3.14.4 /
Unicorn 2.1.4 / Capstone 5.0.7 / Win11 x64 host).

## 0. Task 028 complete?

**Yes as a campaign — Stop D (time-budget exhaustion at a precisely
documented cut point) with D0+D1 reached and D2/D3 substantially
advanced but honestly incomplete.** All minimum success criteria of
task §30 are met: deterministic baseline, selective post-timeGetTime
trace, defensible exact D1 (with the VM-structure caveat the spec
itself anticipates), backward slice/provenance work, API fidelity
audit including three real corrections, evidence-based timing /
process-structure / concurrency assessments, updated static bridge,
blocker ledger, honest milestone state.

## 1. Push / commit

FINAL_COMMIT recorded at push time; no force push; `.raw/.work` never
staged (checkpoint/trace images live only in `.work/task-028/`).

## 2. What the campaign actually established

### 2.1 The corridor is a bytecode VM (new — the campaign's structural result)

- Handler table at RVA 0x84B1E0 (`table[0]` = the error reporter
  0xC5941F), dispatch `jmp [edi+eax*4]` (RVA 0x8574D9) on an obfuscated
  opcode byte, bytecode stream at `esi` (RVA 0x8624xx-0x8662xx),
  encrypted frame base `ebp=0xF97D9014` addressing all VM state in
  Tail B via `[ebp+0x744xxxx]`.
- The Task 012-era mystery zone 0x862000+ is **VM bytecode territory**
  (including the #UD/SEH choreography at 0x862E76/0x862F19).
- A custom CRC-32 with polynomial bytes 0x5041/0x5449 ("APIT"), seed
  0xFFFFFFFF, bitwise, final `not` (RVA 0x81D14C-0x81D197) implements
  hash-based name lookup: the replay proves it resolved **Sleep** from
  kernel32 (154 S-block names / 3229 bytes hashed, exactly 1 match) and
  walked advapi32's name zone for the registry API.

### 2.2 D1 — the exact decision

The error path is not gated by a native `jcc`; it is a VM continuation
selection (task §9's opaque-predicate provision applies):

- **D1 node**: RVA **0x84E638** `pop dword ptr [edx]` at n=20,204,446 —
  installs 0xC5941F (reporter / handler-table[0]) into VM continuation
  cell [0x84B1E0], overwriting the 13th timeGetTime sample.
- Consumed by RVA 0x85694F `push [edx]` (n=20,206,427) and the final
  `ret` (RVA 0x857108, n=20,211,743) into the reporter.
- Error successor: 0x85941F → icon-char parser → MessageBoxExA
  ("Themida - http://www.oreans.com"). Alternate successor: any other
  continuation (the real guest's import-rebuild path).
- The walk itself (26 unrolled check items, accumulator bytes
  0x46-boundary / 0x83-0x97-running) **completes normally** — the
  mid-walk "anomaly" I first chased (item 25 result-flip) turned out to
  be the planned boundary phase, an important negative result that took
  real work to falsify.

### 2.3 D2/D3 — provenance and semantic gaps

- The corridor's **complete external surface**: kernel32 + advapi32
  export structures (faithful — same files, same bases, resolution
  verified end-to-end), timeGetTime ×2022, Sleep(50) ×1. **Zero
  PEB/TEB debug-field reads, zero registry-data/file/other-DLL reads.**
- Three genuine replay defects found and fixed (F1-F4):
  GetVersionExA WORD/BYTE layout + **16-byte out-of-bounds write past
  the caller's 148-byte struct** (real memory corruption!), GetCommandLine
  quoting verified against the WMI-captured exact command line of the
  gate-bearing runs (`"F:\MapleStory.exe"`, quoted — Task 027 was
  right, an interim unquoted "fix" of mine was reverted on evidence),
  RegOpenKeyA duplicate-handle value moved out of the predefined-hive
  range.
- Timing falsified three ways as the divergence cause: rate (Task 027),
  15.625 ms granularity (modeled, flow changed, outcome same), absolute
  uptime base (measured-plausible 60-300 s sweep — outcome invariant).
- **Honest bottom line**: after all evidence-backed corrections the
  replay still commits to the error continuation (D4 not reached). The
  remaining divergence lives in the staged-data dimension — the walk's
  steady-state items run identical 208/127-op VM programs over a
  staged parameter table built during items 0-3 (export walks +
  "APIT"-CRC hashing). Decoding those programs via the handler table is
  the bounded, precisely-defined next step (B28-3).

## 3. Milestones (honest)

D0 reached · D1 reached (VM-continuation form) · D2 partial (surface
complete; specific staged datum not pinned) · D3 partial (three real
gaps fixed; decisive gap unidentified) · D4-D9 not reached (Tail A
still 0 writes; no import rebuild; no game code; no network).

## 4. Strongest new findings

1. The post-probe protector is a **dispatch-table bytecode VM** whose
   bytecode, handler table, and state all live in the decoded 0x84B-0x866
   zone — a structural model for every future corridor question.
2. The **"APIT" CRC-32** and the hash-based manual API resolution
   (proven: Sleep) — the protector resolves APIs without GetProcAddress
   and verifies them cryptographically.
3. The whole-run external surface is **tiny** — 16 API events + two
   export-table walks — and **never touches PEB/TEB debug fields**,
   falsifying the anti-debug-surface hypotheses for this path.
4. The GetVersionExA **buffer overflow** was a real replay defect
   corrupting protector memory (now fixed).

## 5. Strongest uncertainty / primary blocker

Which staged datum (or which of the 26 checks' expected values) differs
from the real guest (B28-1/B28-3). Secondary: the guest-truth value of
Win7 Pro's exact `wSuiteMask` bits (provisional 0x0100 — not consumed
on this path).

## 6. Recommended next broad direction

Decode the VM: document the ~30 opcode handlers reachable from the
handler table (RVA 0x84B1E0) against the dumped decoded image, decode
the 208-op Z-program and 127-op X-program, and read out the staged
parameter table the 26 items consume. That converts B28-1 from
"unknown staged datum" into a named check with named inputs — after
which either a faithful model exists for it or the boundary is proven
to require live extraction (Stop C condition).

## 7. Artifacts

`result/28-protector-decision-tail-a-materialization.md` (this file),
`task028-milestones.csv`, `task028-blockers.csv`,
`task028-replay-baseline.md`, `task028-replay-determinism.csv`,
`task028-corridor-blocks.csv`, `task028-branch-decisions.csv`,
`task028-decision-isolation.md`, `task028-decision-candidates.csv`,
`task028-decision-slice.md`, `task028-provenance-edges.csv`,
`task028-api-fidelity.csv`, `task028-guest-truth.csv`,
`task028-process-structure-fidelity.csv`,
`task028-concurrency-assessment.md`,
`task028-replay-fidelity-fixes.csv`,
`task028-progression-timeline.csv`,
`task028-main-static-bridge.md`.
No import-reconstruction/Tail-A/function-map artifacts (stages not
reached — per spec no empty files). Reusable tooling:
`scripts/maple079_full_replay.py` (checkpoint v2, selective tracer,
read/write provenance, fidelity options `--tgt-15ms`, `--vclock-base`,
`--cmdline`, `--apilog-out`).
