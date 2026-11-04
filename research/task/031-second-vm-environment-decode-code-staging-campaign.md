# Task 031 — Second-VM Environment Decode & Code-Staging Boundary Campaign

## Objective

Continue from Task 030.

Task 030 proved by elimination that the corridor's error continuation is
a pure function of the runtime-decoded program state: every data-read
input channel (timing, DLL content, resolved pointers, pre-corridor API
outputs, PEB/TEB, concurrency) is faithful or inert. Two routes were
recommended: decode the **second VM instance** (VM2, handler table RVA
0x81464, context RVA 0x821464+, which consumes every environment API),
and confirm the boundary from the static side.

Task 031 adds the decisive missing channel:

> Task 030's census covered the corridor's **data reads**. It did not
> cover writes to the corridor's **executed instruction bytes**. If any
> pre-corridor stage (VM2, the round-2/3 decoders, or the staging
> programs) writes code that the corridor later **executes**, and any of
> those write values depends on an environment input the replay models
> unfaithfully, then the corridor program itself differs between replay
> and real guest — exactly consistent with Task 030's conclusion that
> the outcome is image-determined.

The campaign therefore:

```
dispatch-site scan (static pattern) -> all-VM census (instances, lifetimes)
 -> VM2 decode: table + opcode semantics + programs around each API consumption
 -> name every environment check VM2 performs (expected vs actual)
 -> CODE-STAGING CENSUS: pre-corridor writes to corridor-executed bytes;
    for each, resolve data dependence on environment inputs
 -> verdict: a NAMED unfaithful input (re-open D3 -> faithful fix ->
    natural continuation watch: import rebuild -> Tail A -> game anchors)
 OR the boundary is confirmed from both the dynamic and static sides
```

## Milestones

- **M0** all-VM census: every bytecode-VM instance (dispatch-site
  pattern scan of the decoded image; per-instance table, context,
  lifetime window)
- **M1** VM2 opcode reference (table RVA 0x81464 decoded; semantics may
  differ from VM1's)
- **M2** VM2 programs decoded around each environment-API consumption
  (GetLocalTime wSecond/wMilliseconds, probes, cmdline, GetVersionEx,
  registry, module loads)
- **M3** environment checks named: for each consumption, what VM2
  verifies/stages, expected vs replay-actual
- **M4** code-staging channel resolved: the complete set of pre-corridor
  writes to corridor-executed instruction bytes, each classified
  (deterministic decode / constant / environment-dependent)
- **M5** verdict: either a named unfaithful input with a faithful
  correction attempt (then immediately continue the standing ladder
  V5-V8: continuation / import reconstruction / Tail-A / game anchors),
  or the Stop-C boundary confirmed statically
- **V5/V6/V7/V8** unchanged from Tasks 029/030

Honesty rules inherited: no inflated claims; V5 only on a natural pass;
protector/support-DLL functions never count toward V8; no placeholder
artifacts.

## Main Work

### 1. Dispatch-site scan + all-VM census (M0)

- Statically scan the decoded image for the dispatch pattern
  (`xor bl,al; movzx eax,al; jmp dword ptr [edi+eax*4]` byte sequences)
  to enumerate all dispatch sites (VM1's are at RVA 0x574D4-9; VM2's at
  0x82089-E; there may be more).
- Add a lightweight dispatch logger to `scripts/maple079_full_replay.py`
  (code-hook check on the `movzx` sites; record n, site, edi, index,
  esi, bl) and run the full replay once.
- Cluster dispatches by `edi` (table base = VM instance identity);
  record each instance's first/last dispatch n, table RVA, context
  cells, and bytecode windows.

Create: `result/task031-vm-census.csv`

### 2. VM2 decode (M1/M2)

- Decode the VM2 handler table from the dump (cross-check: the table
  bytes' write history — confirm no post-VM2 rewrites).
- Adapt `scripts/maple079_vm_disasm.py` for VM2 (table, fetch-key
  arithmetic verified dynamically from targeted windows).
- Decode the programs around each environment-API consumption. Use
  targeted `--trace-from` runs per consumption window (the GLT window
  n≈13,285,873 and n≈13,304,345 are already located; locate the
  probes/cmdline/versionex/registry consumption points from the
  dispatch log + watch-list).

Create: `result/task031-vm2-opcodes.csv`, `result/task031-vm2-checks.md`

### 3. Environment checks named (M3)

For each consumption: what is compared/stored; expected value (bytecode
constant) vs replay-actual; classification faithful/incomplete/
incorrect/unknown. Special attention: whether any consumption output is
written into **cells or code that the corridor later uses** (data
channel was closed in 030 — but re-verify for the new instances).

Create: `result/task031-environment-checks.csv`

### 4. Code-staging census (M4 — the decisive phase)

- Watch list = every distinct instruction address the corridor
  executes (from the corridor trace).
- Full replay with `--write-log`; extract all writes with n <
  corridor-start to those addresses.
- For each pre-corridor code write: the writer window (`--trace-from`
  targeted run) → data dependence classification:
  `deterministic-decode` / `constant` / `environment-dependent(input)`.
- Any `environment-dependent` write into executed code = the named
  divergence candidate.

Create: `result/task031-code-staging.csv`

### 5. Verdict (M5)

- If a candidate exists: determine the real-guest semantics of that
  input (documents/probes), implement the faithful correction
  (smallest change, evidence-based, never outcome-directed), rerun
  (checkpoint + full), compare normalized traces, and watch the
  continuation naturally (then V6-V8 with the existing monitors).
- If none exists: the Stop-C boundary is confirmed from both sides;
  record honestly with the full elimination table updated.

Create/append: `result/task031-verdict.md`, milestones/blockers ledgers.

### 6. Continuation (V6-V8, only if M5 opens the path)

Import reconstruction watch, Tail-A first-write provenance, region
classification, function/class/anchor recovery — per the standing
ladder; artifacts only when reached.

## Restrictions

Inherited in full (Tasks 028-030): no patching, no branch forcing, no
outcome-directed clock/value tuning, no spoofing, no injection, no
live-process extraction; expected values from bytecode and actuals from
faithful replay are analysis, hand-writing either is forbidden. VM
experiments remain opportunistic only.

## Operational machinery (inherited)

Sync gate (clean tree, ff-only, record STARTING_HEAD); `.work/task-031/`
scratch; mandatory reading = Tasks 028-030 results (esp.
`task030-terminal-predicate.md`, `task030-blockers.csv` B30-1) +
`scripts/maple079_full_replay.py` + `scripts/maple079_vm_disasm.py`;
sample/tool gate with baseline count 20,211,773 (checkpoint resume);
time budget 8-16 h (M0 10%, M1/M2 25%, M3 15%, M4 20%, M5 10%,
continuation 30-50% if opened); stop conditions A-D as before; commit
message `Complete Task 031 second VM environment decode code-staging
campaign`; never force push; never commit `.raw/`, `.work/`, binaries,
dumps, decoded blobs.

## Final Report

Create `result/31-second-vm-environment-decode-code-staging.md` +
`task031-milestones.csv`, `task031-blockers.csv`,
`task031-progression-timeline.csv`, `task031-main-static-bridge.md`
(and the phase artifacts above). The report must state: census results
(instance count/lifetimes), VM2 decode coverage, the named environment
checks, the code-staging classification, the M5 verdict with evidence,
V-ladder status, strongest finding / uncertainty / blocker, next
direction.

The most important question Task 031 must answer:

```
"Does anything write environment-derived bytes into the code the corridor
executes — and if not, is the offline boundary now proven from both the
dynamic and static sides?"
```
