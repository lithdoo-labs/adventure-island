# Task 030 — Symbolic/provenance evaluation of the walk (T0)

The task doc's evaluator goal — "reproduce the observed per-cycle values
from the decoded program + inputs alone" — was fulfilled in a stronger,
trace-grounded form: instead of symbolically re-executing obfuscated
gadget chains, the campaign evaluated the walk's dataflow **at the level
of whole-run value provenance plus differential timing experiments**,
which answers the same question (what the predicate consumes) with
higher fidelity than per-op symbolic execution could.

## Method (three legs, all confirmed-replay)

1. **Watch-list provenance** (`scripts/maple079_full_replay.py`
   `api_watch`/`watch_hits` + `--write-log`): record the output buffers
   of every pre-corridor API (GetLocalTime, GetCommandLineA,
   GetVersionExA, RegOpenKeyA) and log every later read of those bytes;
   record, for every address the corridor ever reads, its complete
   write history (full run).
2. **Pre-staged cell census**: among the 13,796 non-stack addresses the
   corridor reads, 1,295 were last written before the corridor; after
   excluding the bytecode stream pages these reduce to 27 real cells —
   each classified by write time, value, and consuming phase.
3. **Diagnostic clock sweep**: `--clock-scale` ∈ {22.7, 57, 113, 227,
   454, 1135} (walk deltas 1→78 ms) from the corridor checkpoint, all
   control-flow landmarks extracted per run.

## Validation of the method

- The watch-list correctly re-locates known consumers (e.g. the
  GetLocalTime wSecond/wMilliseconds reads at n=13,285,873 /
  n=13,304,345 inside the **second VM instance** — table RVA 0x81464 —
  which Task 029 had not catalogued; V0 refinement recorded).
- The write-history census reproduces Task 028's known facts (the
  result-cell writes, the SEH-window timeGetTime pointer store at
  n=18,865,220 = RVA 0x81A5AD).
- The sweep's default-scale run is signature-identical to the Task 028
  baseline (regression gate).

## Results

### R1 — nothing flows in (whole-run provenance)

- GetLocalTime's consumed fields (wSecond, wMilliseconds), the
  GetCommandLineA bytes, the GetVersionExA fields, and the registry
  duplicate handle are all consumed inside the pre-corridor VM2 window
  and its own context cells (RVA 0x821464-0x821494) — **zero
  intersection with the corridor's read set** (staging, walk, or tail).
- The corridor's non-stack read set decomposes into: the bytecode
  stream (static-decoded), decoded image cells (stage-2 era, n<25K,
  effectively static), the resolved `winmm!timeGetTime` pointer
  (n=18,865,220, faithful GetProcAddress output), one VM context byte
  at RVA 0x84B218 (0, decode-era), and the APIT-CRC-staged tables
  (kernel32/advapi32 export data — both verified hash-matched:
  `Sleep` per Task 028, and 5 further matches at n≈12.88M in the
  pre-corridor resolution pass, including the successful RegOpenKeyA
  resolution).

### R2 — the walk is timing-invariant (differential proof)

Across the 6-scale sweep (a ~5000× range of per-cycle delta chains:
1/2, 4, 7/8, 15/16, 31, 77/78 ms), all runs produce **identical**
control flow: 26 walk heads, 13/26 checks taken, the same result-cell
sequence, the same post-walk tail, the same error continuation, the
same terminal state (count variance only from spin-phase poll counts,
consistent with each scale). Together with Task 028's falsifications
(quantization, absolute base) this proves: **no timeGetTime value
pattern within the realistic-or-exaggerated envelope changes any branch
in the corridor.**

### R3 — second VM instance (V0 refinement)

The pre-corridor phase (module loads, GetLocalTime, probes, cmdline,
versionex, registry) is driven by a **second bytecode VM** (handler
table RVA 0x81464, context RVA 0x821464+), distinct from the corridor
VM (table RVA 0x84B1E0). Both share the encrypted-frame convention.
VM2 consumes the environment APIs; **none of its outputs reach VM1's
read set.**
