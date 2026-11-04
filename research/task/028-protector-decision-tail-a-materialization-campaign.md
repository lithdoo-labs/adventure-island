# Task 028 — Protector Decision Isolation → Tail-A Materialization Campaign

## 0. Mission

Task 028 continues directly from Task 027 and makes the current technical objective narrower and harder:

> Isolate the exact replay/guest divergence decision in the post-probe protector path, recover the provenance and real semantics of every value feeding that decision, make the offline replay more faithful without forcing any branch or spoofing any environment answer, and use that fidelity gain to progress naturally toward import reconstruction, `ijl15.dll`, Tail-A materialization, and finally the real `MapleStory.exe` game body.

This is a **long-running exploratory reverse-engineering campaign**. The local AI should work autonomously for approximately 8–16 hours if the environment permits, iterating through dynamic replay traces, static data-flow analysis, guest-side truth probes, and main-EXE recovery without stopping after a single sub-result.

Task 028 is not a compatibility experiment and not another broad support-DLL inventory task.

The central current cut point is:

```text
SoftICE/SIWVID/NTICE probes
  -> GetCommandLineA
  -> GetVersionExA
  -> RegOpenKeyA
  -> deliberate #UD @ RVA 0x862E76
  -> SEH handler @ RVA 0x862F19
  -> ZwContinue -> RVA 0x862E7A
  -> LoadLibraryA(winmm.dll)
  -> GetProcAddress(timeGetTime)
  -> timeGetTime / behavior phase
  -> obfuscated resolver/gadget corridor around the 0x84Bxxx–0x857xxx RVA zones
  -> CURRENT REPLAY/GUEST DIVERGENCE
       replay: Themida/Oreans error-reporter path
       real guest spin: no error dialog
       historical successful guest: continued to ijl15.dll / iloveaki gate
```

Task 027 proved that simply scaling the virtual `timeGetTime` clock does not change the replay outcome. Therefore Task 028 must not assume that raw elapsed time is the cause.

The goal is to turn the current vague statement:

```text
"the replay diverges somewhere in the gadget chain"
```

into an evidence-backed statement of the form:

```text
conditional branch / decision D at RVA X
  consumes value V
  V is defined by instructions A/B/C
  V ultimately depends on source S
  S is API/PEB/TEB/registry/module/handle/timing/thread/etc. state
  replay currently models S as ...
  real Win7 semantics are ...
  therefore the replay model is faithful / incomplete / wrong
```

Then, only if the real semantics are known, improve the replay so it behaves like the real guest.

**Never set a value merely because it makes the protector take the desired branch.**

---

# 0.1 Starting evidence model

Treat the following Task 027 findings as the starting model, but verify them from current repository artifacts after synchronization:

- canonical `MapleStory.exe` SHA-256:
  `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`;
- Task 027 reached only R0 dynamically;
- current-session `iloveaki success.` was 0/3 and must not be promoted from historical Task 025 evidence;
- Task 027's faithful offline replay passes the SICE/SIWVID/NTICE probes truthfully;
- deliberate illegal instruction `0F 3F` at RVA `0x862E76` is real control flow;
- decoded-region SEH handler at RVA `0x862F19` resumes execution through `ZwContinue` at RVA `0x862E7A`;
- `winmm.dll` and `timeGetTime` appear immediately after that stage, matching real guest module chronology;
- replay then enters an Oreans/Themida error-reporter path that real guest runs have not shown;
- fast/slow clock-scale experiments did not alter that outcome;
- Tail A still has zero writes and the `ZtlTaskMem*` export destinations remain zero in all known replay states;
- no `CWvsApp`, `CClientSocket`, `CLogin`, `CStage`, `CField`, `CUser`, AES/IV client-side game anchors, `ws2_32`, or 9555 client activity has yet been recovered from the main executable;
- support-DLL recovery does not count as main-game-code recovery.

Do not silently relabel protector/loader functions as game functions.

---

# 0.2 Safety / research boundary

Allowed:

- offline static analysis of the user's local client binaries;
- offline replay/emulation of already observed/understood execution;
- faithful implementation of documented or experimentally measured Win7 API semantics;
- dynamic tracing **inside the offline emulator/replay**;
- register/flag/stack/memory read-write logging inside the replay;
- control-flow graphs, dynamic basic-block traces, def-use graphs, backward slices, provenance/taint-style analysis;
- static disassembly/decompilation/xrefs/PE/RTTI/vtable analysis;
- standalone guest-side truth probes that call normal Win7 APIs in their own helper process without injecting into MapleStory;
- normal process/module/thread/window/service enumeration;
- passive ETW/event/network observation;
- normal application UI actions if the historical `iloveaki` modal naturally reappears;
- controlled private-network tests against the user's local CMS079 server if the client naturally reaches networking;
- reference correlation using repository-provided v95 or other approved symbol bundles;
- project-owned reusable analysis scripts.

Forbidden:

- patching `MapleStory.exe`, `ijl15.dll`, `iloveaki.dat`, or protection code;
- forcing a conditional branch in the replay merely to see downstream code;
- manually setting registers/flags/memory to a guessed "success" value;
- spoofing API results, device presence, registry state, timing, CPUID, debugger state, or VM state to satisfy checks;
- fake SoftICE/Oreans devices;
- anti-debug or anti-emulation bypass;
- debugger concealment;
- DLL injection;
- behavior-changing runtime hooks in the real client;
- kernel patches;
- test signing or driver-signature bypass;
- VM/hypervisor concealment;
- dumping decrypted/protected main-EXE code from a running process;
- using `ReadProcessMemory` to extract protected executable code from the live client;
- committing reconstructed executable blobs, decrypted sections, raw VM/process dumps, or proprietary binaries.

Important distinction:

```text
faithful replay correction = allowed
```

Example: if real `GetVersionExA` writes a documented structure field that the replay omitted, implement that field exactly.

```text
success-directed spoof = forbidden
```

Example: if changing a field to `1` makes the error disappear but there is no evidence the real Win7 guest returns `1`, do not do it.

If the only way to continue a branch would be a prohibited technique, record the blocker and stop that branch.

---

# 1. Repository synchronization gate

Start from a clean current `origin/main`.

Run:

```text
git status --short
git branch --show-current
git remote -v
git rev-parse HEAD
```

If tracked/uncommitted changes exist, stop and report the repository-state blocker.

Do not automatically:

```text
git stash
git reset
git restore
git checkout -- .
git rebase
```

Then:

```text
git fetch origin
```

If clean and not on `main`:

```text
git switch main
```

Then:

```text
git pull --ff-only origin main
git rev-parse HEAD
```

Record the resulting SHA as:

```text
STARTING_HEAD
```

If fast-forward synchronization is impossible, stop rather than rewriting history.

After synchronization, re-read this Task 028 document from disk. Do not use a cached version.

---

# 2. Directory / artifact contract

```text
.raw/
    proprietary inputs, read-only

task/
    task specifications

.work/task-028/
    all scratch tracing, guest probes, replay checkpoints, raw traces,
    large CSV/JSON, decompiler databases, temporary binary images,
    emulator memory snapshots, generated CFGs, one-off scripts, VM logs

result/
    compact permanent conclusions and normalized evidence tables

scripts/
    reusable project-owned analysis/replay tooling

glm-work/
    prior-research reference only
```

Recommended scratch structure:

```text
.work/task-028/
├── preflight/
├── replay-baseline/
├── checkpoints/
├── gadget-traces/
├── slices/
├── api-fidelity/
├── guest-truth-probes/
├── static-corridor/
├── materialization/
├── functions/
├── classes/
├── references/
├── network/
└── logs/
```

Never commit:

- original EXE/DLL/DAT/SYS/VXD/WZ files;
- process dumps or VM memory dumps;
- replay memory-image binaries that contain decoded protected code;
- decrypted executable/code blobs;
- raw QEMU/VM images or snapshots;
- raw ETL/EVTX/PML/PCAP;
- Ghidra/IDA/radare databases;
- third-party binaries/source trees;
- huge raw instruction traces.

Commit only normalized textual/CSV findings and reusable project-owned scripts.

---

# 3. Mandatory reading

After synchronization, read at least:

```text
README.md

task/027-main-exe-game-logic-recovery-campaign.md
result/27-main-exe-game-logic-recovery.md
result/task027-milestones.csv
result/task027-blockers.csv
result/task027-runtime-foundation.md
result/task027-foundation-runs.csv
result/task027-main-static-bridge.md
result/task027-decoder-targets.csv
result/task027-main-image-boundary.md
result/task027-materialization-timeline.csv
result/task027-main-function-map.csv
result/task027-main-class-map.csv
result/task027-reference-correlation.csv
result/task027-main-call-edges.csv
result/task027-startup-login-callchain.md
scripts/maple079_full_replay.py
```

Read earlier protector chain results relevant to the corridor:

```text
result/06-stage2-inplace-decode.md
result/07-protector-resolver-antidebug.md
result/08-winlicense-reference-normal-path.md
result/09-probe-cluster-full-cfg.md
result/09-normal-probe-path-materialization.md
result/10-post-probe-stage.md
result/10b-static-extension.md
```

Read current Task 012/012c evidence for:

```text
0x862000+
round-3
Decoder C
Tail A
ZtlTaskMem exports
```

Read support runtime only as semantic context:

```text
result/19-wizet-dlls.md
result/20-wz-inventory.md
result/23-wz-library-cross-validation.md
```

Read the server/network baseline:

```text
result/01-server-baseline.md
result/02-runtime-network-bootstrap.md
result/03-compatibility-passive-capture.md
```

Read repository-provided v95/reference symbol seeds intended for CMS079 correlation.

Do not copy reference addresses into CMS079.

---

# 4. Canonical sample and tool gate

Revalidate:

```text
MapleStory.exe SHA-256
5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d
```

Also verify that the Task 027 replay tool starts cleanly:

```text
python scripts/maple079_full_replay.py --help
```

Record:

```text
Python version
Unicorn version
Capstone version
host architecture
input sample hash
guest-DLL source identity
```

If the client hash differs, stop reuse of prior RVA evidence.

Create:

```text
result/task028-replay-baseline.md
```

---

# 5. Task 028 milestone model

Task 028 uses decision/materialization milestones.

## D0 — Replay divergence reproduced deterministically

The Task 027 faithful replay reaches the same post-probe corridor and the same error-path divergence in at least two clean runs with an identical or explainably equivalent control-flow signature.

## D1 — Exact decision isolated

Identify the **specific conditional decision** that first irreversibly commits the replay to the real-guest-unseen error path.

Required evidence:

- decision instruction RVA;
- branch condition / relevant EFLAGS;
- predecessor block(s);
- successor blocks;
- which successor leads toward the error reporter;
- dynamic execution count;
- enough context to distinguish the decision from later error formatting code.

## D2 — Decision-input provenance recovered

Recover a defensible backward slice from the D1 decision to its root input(s).

Root inputs may be:

- API return values;
- API output buffers;
- `LastError`;
- PEB/TEB fields;
- module/loader state;
- registry result/state;
- command line;
- OS version/build;
- timer values;
- exception-context fields;
- handle/object state;
- thread/process state;
- initialized memory/table content;
- a decoded protector-owned value.

Do not label an input "anti-emulation" merely because the replay differs.

## D3 — Replay semantic gap explained

For every root input that differs or is uncertain, determine the real Win7 SP1 x86 semantics through documentation, system-DLL disassembly, or standalone guest truth probes.

Classify each source:

```text
faithful
incomplete
incorrect
unknown
context-dependent
```

## D4 — Faithful replay progresses beyond the old divergence

After implementing only evidence-backed semantic corrections, the replay naturally passes the D1 decision without branch forcing and reaches a new stable protector stage.

If the faithful result still takes the error path, D4 is not reached; record that finding honestly.

## D5 — Import-reconstruction / ijl15 boundary reached offline

Replay reaches a defensible stage where the protected executable naturally reconstructs game/runtime imports or loads/resolves `ijl15.dll` / equivalent downstream imports.

Historical runtime evidence alone does not count.

## D6 — Tail-A main-image materialization evidence

At least one previously zero/unwritten Tail-A region associated with the main executable naturally receives code/data through the faithful replay, with producer/destination provenance recorded.

Do not commit the resulting raw decoded bytes.

## D7 — First main-EXE game anchors

Recover at least 5 high-confidence **game-side `MapleStory.exe`** function/class anchors from the newly exposed image.

Protector/loader functions do not count.

## D8 — Main-EXE recovery baseline

Recover at least 20 high-confidence game-side main-EXE anchors and a defensible startup/application/network call-chain segment.

## D9 — Network/login boundary

If naturally reachable, identify `ws2_32`/socket/connect/9555 and begin linking main-EXE client networking to the already known server protocol.

The campaign should continue toward the highest safely reachable milestone rather than stopping after D1 or D2.

---

# 6. Time budget / priority

Recommended campaign duration:

```text
8–16 hours
```

Suggested allocation:

```text
baseline + deterministic replay        5–10%
decision isolation                     20–30%
backward slicing / provenance           20–30%
API/environment fidelity validation     15–25%
replay continuation                     15–30%
main-code recovery                      30–60% once D6 appears
VM experiments                           <=5% unless gate naturally returns
```

Once D6/D7 is reached, immediately shift most effort to actual game-code semantics.

Do not spend hours re-running the VM unless a new runtime observation can answer a specific replay question.

---

# 7. Phase A — Make the current replay divergence reproducible and cheap to iterate

The current replay requires approximately 20M instructions to reach the divergence. Task 028 should reduce iteration cost before deep tracing.

Extend `scripts/maple079_full_replay.py` carefully so it can create a **scratch-only replay checkpoint** at a stable point shortly before the `winmm/timeGetTime` / gadget corridor.

Suitable checkpoint candidates include:

- immediately after `ZwContinue` resumes at `0x862E7A`;
- immediately after `winmm.dll` and `timeGetTime` resolution;
- immediately before the first known timing/gadget loop.

A checkpoint may contain emulator memory/register state in `.work/task-028/checkpoints/` only.

Do not commit it.

Requirements:

- checkpoint restore must produce the same downstream trace as a full replay;
- verify this at least twice;
- include deterministic hashes of normalized control-flow traces rather than committing raw memory snapshots;
- if checkpointing changes behavior, abandon it and use the full replay.

Generate:

```text
result/task028-replay-determinism.csv
```

Fields should include:

```text
run_id
full_or_checkpoint
instruction_count_to_corridor
normalized_block_trace_sha256
error_decision_rva
error_path_reached
TailA_write_count
notes
```

---

# 8. Phase B — Build a selective dynamic block trace

Do not log all 20M instructions.

Start selective tracing only from the first `timeGetTime` resolution/call or another defensible corridor entry.

Capture at minimum:

```text
sequence index
EIP/RVA
basic-block start/end
branch type
branch target
EFLAGS before/after when relevant
registers changed
stack pointer
memory writes
API boundary events
exception/SEH events
```

For conditional branches, capture:

```text
instruction bytes
mnemonic/op_str
ZF/CF/SF/OF/PF
branch taken?
taken target
fallthrough target
```

Store the huge raw trace in:

```text
.work/task-028/gadget-traces/
```

Commit only normalized summaries.

Generate:

```text
result/task028-corridor-blocks.csv
result/task028-branch-decisions.csv
```

---

# 9. Phase C — Isolate the first irreversible error-path decision

Starting from the call/branch entering the Themida/Oreans error reporter, work backward through dynamic control flow.

Distinguish:

```text
error formatting / MessageBox path
```

from:

```text
decision that selected the error path
```

The D1 decision must be the earliest branch whose alternate successor would avoid the observed error-reporting region, not merely a branch inside the reporter.

For each candidate decision record:

```text
RVA
instruction
flags consumed
value-producing predecessor
error successor
alternate successor
number of executions
whether alternate successor was ever seen
confidence
```

If opaque predicates or exception-driven indirect control flow make the notion of a single `jcc` misleading, define D1 as the smallest control-dependence node that determines entry into the reporter and explain why.

Generate:

```text
result/task028-decision-isolation.md
result/task028-decision-candidates.csv
```

D1 should not be marked reached until this distinction is defensible.

---

# 10. Phase D — Dynamic def-use and backward slicing

Once D1 is isolated, trace the value(s) that determine its flags/target.

Build a backward slice from:

```text
D1 flags / comparison operands
```

through:

```text
cmp/test arithmetic
mov/load/store
xor/add/sub/adc/sbb
and/or
shifts/rotates
lea
stack spills/reloads
protector gadget transfers
exception-context restores
```

until the root inputs are identified.

A generic whole-program symbolic engine is not required. A targeted dynamic def-use tracker for the executed corridor is preferred.

If useful, extend the replay with lightweight provenance labels for:

```text
API_RETURN:<name>
API_OUTBUF:<name>:<field>
LAST_ERROR:<api>
PEB:<offset>
TEB:<offset>
REGISTRY:<key/value>
CMDLINE
OS_VERSION:<field>
TIMEGETTIME:<sample_id>
GETTICKCOUNT:<sample_id>
QPC:<sample_id>
HANDLE:<origin>
MODULE:<name/base>
EXCEPTION_CONTEXT:<field>
INITIAL_IMAGE:<rva>
DECODED_REGION:<rva>
```

Propagation does not need to solve arbitrary symbolic math; it must be good enough to explain the actual executed slice.

Generate:

```text
result/task028-decision-slice.md
result/task028-provenance-edges.csv
```

Each edge should record:

```text
dst_value_or_instruction
source_value_or_instruction
operation
RVA
runtime_sequence
confidence
```

---

# 11. Phase E — Audit every replayed API before D1

Task 027 identified unmodelled API side effects as one possible divergence source.

Build an API fidelity matrix for every API reached from the post-probe stage through D1.

For each API record:

```text
module
name
call_count
arguments observed
replay return value
replay LastError behavior
replay output-buffer writes
replay handle/object side effects
real/documented semantics source
confidence
status
```

Status:

```text
faithful
incomplete
incorrect
unknown
not-relevant-to-slice
```

Particular attention should go to APIs/functions involving:

```text
GetCommandLineA
GetVersionExA
RegOpenKeyA / registry family
LoadLibraryA
GetProcAddress
VirtualQuery / memory queries if present
timeGetTime
Sleep
GetTickCount / QPC if present
GetCurrentProcess/Thread IDs if present
TLS/FLS APIs if present
interlocked operations if present
exception/continuation APIs
```

Do not assume this list is exhaustive; use the actual replay trace.

Generate:

```text
result/task028-api-fidelity.csv
```

---

# 12. Phase F — Standalone guest truth probes

When an API's exact Win7 behavior is uncertain and it materially affects the D1 slice, write a **standalone project-owned probe** that runs as its own normal process inside the same Win7 SP1 x86 guest.

The probe must not attach to, inject into, debug, hook, or modify MapleStory.

It may call the same Windows API and record ordinary return values/structures for the same type of inputs.

Examples of legitimate measurements:

- exact `GetVersionExA` structure contents;
- registry return codes and `LastError` behavior for the same key string;
- module path/drive semantics;
- `timeGetTime` granularity and wrap behavior;
- `VirtualQuery` results for an analogous allocation type;
- documented TEB/PEB fields observable from the helper's own process;
- exception-context layout in a helper process if needed to confirm OS mechanics.

Do not design the helper to discover "what value makes MapleStory pass".

Store raw probe logs in `.work/task-028/guest-truth-probes/`.

Commit reusable source/scripts only if broadly useful.

Generate:

```text
result/task028-guest-truth.csv
```

---

# 13. Phase G — Validate PEB/TEB/loader-state fidelity

Because protector code often reads process structures directly, verify fields actually touched by the D1 backward slice.

Do not blindly attempt to recreate every PEB/TEB field.

For each touched offset record:

```text
structure
architecture
field/offset
replay value
real Win7 meaning
realistic value in this process class
source/evidence
slice relevance
status
```

Potential categories include:

```text
PEB loader lists
ProcessHeap
OS version fields
BeingDebugged
NtGlobalFlag only if actually read
ImageBaseAddress
ProcessParameters / command line
TLS slots
TEB exception list
stack base/limit
ClientId
LastErrorValue
```

Do not modify a field simply because it is associated with anti-debugging.

Generate:

```text
result/task028-process-structure-fidelity.csv
```

---

# 14. Phase H — Check whether single-threaded replay is actually relevant

Task 027 listed single-threadedness as a possible mismatch, but this must be evidence-driven.

Before D1, determine whether the executed protector path:

- calls thread-creation APIs;
- waits on synchronization objects;
- reads thread IDs in a meaningful way;
- expects APC/timer callbacks;
- uses interlocked state shared with another thread;
- depends on asynchronous loader behavior.

If no such evidence exists before D1, downgrade single-threadedness as a cause.

If evidence exists, model only the minimum faithful concurrency semantics required by the observed path.

Do not invent extra threads or schedules merely to obtain success.

Generate:

```text
result/task028-concurrency-assessment.md
```

---

# 15. Phase I — Timing analysis, but no success-directed clock tuning

Task 027 already proved a wide clock scale change did not alter the error outcome.

Task 028 may still analyze timing because timing values may feed an obfuscated checksum or state machine rather than a simple threshold.

For the D1 backward slice:

- enumerate every timer sample that actually contributes;
- record arithmetic performed on those samples;
- identify whether differences, low bits, parity, wraparound, ordering, or call counts matter;
- compare replay call counts and ordering with what is externally observable on the real guest;
- use standalone truth probes for real API granularity if needed.

Do not tune the clock until the branch changes and call that a solution.

Any clock-model change must be justified independently by real Win7 semantics.

Generate timing-specific rows in:

```text
result/task028-decision-slice.md
result/task028-api-fidelity.csv
```

No separate giant timing report is required unless timing becomes the proven root cause.

---

# 16. Phase J — Implement only evidence-backed replay corrections

When D2/D3 identifies a replay semantic gap, implement the smallest faithful correction in:

```text
scripts/maple079_full_replay.py
```

or a clean reusable helper module under `scripts/` if the tool becomes too large.

Every correction must have:

```text
issue ID
old behavior
real Win7 behavior
source/evidence
new behavior
regression test
impact on D1 slice
```

Maintain:

```text
result/task028-replay-fidelity-fixes.csv
```

After each correction:

1. rerun from the checkpoint/full baseline;
2. verify earlier known stages remain identical;
3. compare normalized block trace;
4. determine whether D1 operands changed;
5. determine whether the branch outcome changed naturally;
6. record the first new divergence if any.

If a correction unexpectedly changes earlier probe behavior, investigate rather than stacking more changes.

---

# 17. Phase K — If the replay passes D1, keep going immediately

Do not stop Task 028 simply because the old Themida error path disappears.

Continue faithful replay until one of the following:

```text
new confirmed protector stage
import reconstruction
ijl15.dll resolution/load boundary
Tail-A writes
main game-code materialization
new clearly characterized blocker
```

For each newly reached stage record:

```text
first instruction/RVA
new modules/APIs
new decoded regions
new writes to previously untouched main-image ranges
new import table activity
exceptions/SEH
control-flow transition
```

Generate/update:

```text
result/task028-progression-timeline.csv
result/task028-main-static-bridge.md
```

---

# 18. Phase L — Import reconstruction target

If replay reaches import rebuilding, characterize it carefully.

Track:

```text
DLL name source
API name/ordinal source
resolver function
IAT/import-slot destination
write sequence
module base
GetProcAddress result
main-image destination
```

Look specifically for natural emergence of:

```text
ijl15.dll
PCOM.dll
NameSpace.dll
Canvas.dll
ZLZ.dll
ws2_32.dll
```

but do not assume their order.

Generate:

```text
result/task028-import-reconstruction.csv
```

Only create this file if this stage is actually reached.

---

# 19. Phase M — Tail-A materialization watch

Continue the existing Tail-A write monitor, but improve it from a simple count to producer provenance.

For every write into the main executable's previously zero Tail-A game-image range, capture:

```text
sequence
producer RVA
write instruction
source address/value provenance
destination RVA
length
page protection/state if modeled
first-write / overwrite
nearby import/export anchor
```

Do not commit written bytes.

Instead store safe metadata:

```text
range start/end
write count
SHA-256 of transient local range only if useful
entropy before/after
executable-like heuristic
PE/code/string anchor counts
```

Raw materialized memory images stay only in `.work/task-028/materialization/` and must not be committed.

Generate:

```text
result/task028-tail-a-writes.csv
result/task028-materialization-summary.md
```

D6 requires actual natural writes, not projected addresses.

---

# 20. Phase N — Detect transition from protector code to game code

Do not label the first executable-looking Tail-A block as game logic automatically.

Use multiple signals:

- relocation/import references;
- calls into known Wizet support DLLs;
- ordinary C++ prologues/epilogues rather than protector gadgets;
- RTTI/vtable/string structures;
- WZ/resource names;
- UI/game strings;
- network constants;
- v95 structural/reference matches;
- adjacency to `ZtlTaskMem*` exports;
- coherent call graph.

Classify regions as:

```text
protector
loader
runtime-support
probable-game
confirmed-game
unknown
```

Generate:

```text
result/task028-main-region-classification.csv
```

---

# 21. Phase O — Main-EXE function recovery once D6 appears

Once probable/confirmed game regions become available, immediately build:

```text
result/task028-main-function-map.csv
```

Only `MapleStory.exe` game-side functions count toward D7/D8.

Fields:

```text
function_id
RVA
provisional_name
confidence
region_class
subsystem
source_kind
runtime/replay_seen
reference_symbol
reference_version
reference_match_features
unique_strings
constants
imports/support_DLL_calls
callers
callees
class_candidate
packet/resource anchors
notes
```

High-confidence naming should preferably have two independent evidence sources.

Useful target families, only if evidence supports them:

```text
CWvsApp
CClientSocket
CLogin
CStage
CField
CUser
CUI*
application bootstrap
packet dispatch
network init
send/receive
resource bootstrap
```

Do not count protector functions already recovered in Task 027 toward D7/D8.

---

# 22. Phase P — Main-EXE class recovery

If C++ structures become visible, generate:

```text
result/task028-main-class-map.csv
```

Use:

```text
RTTI
vtable stores
constructors/destructors
singleton globals
throw sites
unique strings
callgraph
support-DLL interactions
reference correlation
```

Do not force v95 class names onto CMS079 when only weak structural similarity exists.

---

# 23. Phase Q — Reference correlation

As soon as game-side functions appear, correlate aggressively with repository-provided reference material.

Compare:

```text
unique strings
constants
callee families
vtable layout
singleton access
packet opcodes
crypto constants
resource names
switch structures
support-DLL calls
```

Never copy v95 addresses into CMS079.

Generate:

```text
result/task028-reference-correlation.csv
```

Record accepted, rejected, and conflicted candidates.

---

# 24. Phase R — Startup/login call chain

If sufficient main code appears, extend the current chain beyond the protector:

```text
protector completion
 -> import/runtime completion
 -> application bootstrap
 -> resource subsystem
 -> graphics/audio
 -> network object
 -> login state
 -> 9555 connection / handshake
```

Actual CMS079 ordering must follow evidence.

Generate:

```text
result/task028-main-call-edges.csv
result/task028-startup-login-callchain.md
```

Every edge must be labeled:

```text
confirmed-static
confirmed-replay
confirmed-runtime
high
medium
projected
```

Do not hide projected edges among confirmed ones.

---

# 25. Phase S — Network gate

Only if game/network code naturally reaches networking:

Use host-only/internal private networking only.

Never bridge the unpatched Win7 guest to the public Internet.

Known project endpoints:

```text
login      9555
channels   7575–7578
cash shop  8600
```

If the server runs on the host side, guest `127.0.0.1` is not the host; use the private host-only IP.

Observe:

```text
ws2_32 first seen
socket/connect
SYN
ESTABLISHED
server accept
15-byte CMS079 handshake
client response
channel/cashshop transition
```

Raw PCAP/ETL stays in `.work/task-028/network/`.

Generate only if reached:

```text
result/task028-network-events.csv
result/task028-login-network-logic.md
```

---

# 26. VM/runtime route is now opportunistic only

Task 027 exhausted ordinary foundation resets without recovering the historical gate.

Task 028 must not spend hours on repeated QEMU/USB/F:/G: permutations.

Allowed runtime policy:

- if the existing VM is already available, one low-cost sanity run is acceptable;
- if `iloveaki success.` naturally reappears after an external environmental change, immediately capture it and execute the already-authorized single OK click;
- otherwise record that R1 remains unavailable and continue offline replay work.

Do not make VM gate recovery the primary campaign goal.

---

# 27. Evidence vocabulary

Use explicit evidence labels:

```text
confirmed-static
confirmed-replay
confirmed-runtime
historical-runtime
observed-side-effect
high
medium
low
projected
unknown
```

For replay fidelity findings additionally use:

```text
faithful
incomplete
incorrect
context-dependent
unverified
```

For causal claims:

```text
proven-root-input
proven-control-dependency
supported-correlation
hypothesis
falsified
```

Do not use "anti-emulation check" as a confirmed label until the semantics actually demonstrate that purpose.

Prefer wording such as:

```text
replay/guest divergence decision
```

until intent is proven.

---

# 28. Milestone and blocker ledgers

Maintain:

```text
result/task028-milestones.csv
result/task028-blockers.csv
```

Milestones D0–D9 must be conservative.

For blockers record:

```text
blocker_id
stage
symptom
exact evidence
attempted safe methods
what was falsified
why unresolved
requires prohibited technique?
next safe option
```

Once a blocker is precisely characterized, do not spend hours rediscovering it.

---

# 29. Required core artifacts

Expected permanent outputs, depending on reached stages:

```text
result/28-protector-decision-tail-a-materialization.md
result/task028-milestones.csv
result/task028-blockers.csv
result/task028-replay-baseline.md
result/task028-replay-determinism.csv
result/task028-corridor-blocks.csv
result/task028-branch-decisions.csv
result/task028-decision-isolation.md
result/task028-decision-candidates.csv
result/task028-decision-slice.md
result/task028-provenance-edges.csv
result/task028-api-fidelity.csv
result/task028-guest-truth.csv
result/task028-process-structure-fidelity.csv
result/task028-concurrency-assessment.md
result/task028-replay-fidelity-fixes.csv
result/task028-progression-timeline.csv
result/task028-main-static-bridge.md
```

Create only when actually reached/useful:

```text
result/task028-import-reconstruction.csv
result/task028-tail-a-writes.csv
result/task028-materialization-summary.md
result/task028-main-region-classification.csv
result/task028-main-function-map.csv
result/task028-main-class-map.csv
result/task028-reference-correlation.csv
result/task028-main-call-edges.csv
result/task028-startup-login-callchain.md
result/task028-network-events.csv
result/task028-login-network-logic.md
```

Do not create empty placeholder artifacts merely to satisfy a filename list.

Reusable tool changes belong in:

```text
scripts/maple079_full_replay.py
```

or clearly named supporting `scripts/` modules if justified.

---

# 30. Minimum success criteria

Task 028 should not declare meaningful completion after merely rerunning Task 027.

Minimum useful completion requires:

1. deterministic D0 replay baseline;
2. selective post-`timeGetTime` trace;
3. at least one defensible D1 decision candidate, preferably exact D1;
4. backward slice/provenance work from that decision;
5. API fidelity audit for all slice-relevant APIs;
6. evidence-based assessment of timing, process structures, and concurrency as root causes;
7. at least one concrete semantic fidelity improvement **or** a defensible conclusion that current inputs are already faithful;
8. updated main-static bridge and blocker ledger;
9. honest D0–D9 milestone state.

Strong completion:

```text
D4 or D5
```

Excellent completion:

```text
D6 / Tail-A materialization
```

Ideal completion:

```text
D7–D9
```

with main-EXE game logic beginning to emerge.

---

# 31. Campaign stop conditions

End Task 028 only if one of the following is true:

### Stop A — major success

D7/D8/D9 reached and a sustainable main-EXE recovery pipeline now exists.

### Stop B — precise faithful boundary

D1–D3 are fully understood and the real semantics imply the same failure path, while further progress requires a prohibited bypass rather than better modeling.

### Stop C — tooling/evidence limit

The exact root input cannot be recovered after a serious trace/slice campaign because the required evidence channel is unavailable without prohibited live-code extraction.

### Stop D — time-budget exhaustion

Approximately 8–16 hours of high-value work completed, with the current decision/slice/progression state precisely documented and a clear next broad direction.

A single hypothesis failing is not a stop condition.

A single API fix is not a stop condition.

Disappearing the old error reporter is not a stop condition; continue downstream.

---

# 32. Submission hygiene

Before committing:

```text
git status --short
git diff
git diff --cached
```

Commit only safe text/CSV findings and reusable project-owned scripts.

Do not commit:

```text
.raw/
.work/
EXE/DLL/DAT/SYS/VXD/WZ
replay memory dumps
materialized code blobs
VM images
ETL/EVTX/PML/PCAP
decompiler databases
third-party binaries/source
```

Suggested commit message:

```text
Complete Task 028 protector decision and Tail-A materialization campaign
```

Then:

```text
git rev-parse HEAD
```

Record as:

```text
FINAL_COMMIT
```

Push:

```text
git push origin main
```

Never force push.

If origin advanced during the campaign, fetch and report divergence rather than rewriting history automatically.

---

# 33. Final report requirements

The final response/report must explicitly state:

```text
Task 028 complete?
STARTING_HEAD
FINAL_COMMIT
push status

highest D milestone reached
why it is actually reached

canonical sample hash
replay/tool versions

D0:
is replay deterministic?
checkpoint equivalent to full replay?

D1:
exact decision RVA
instruction/control node
error successor
alternate successor
flags/operands

D2:
root input(s)
full provenance summary

D3:
for each root input:
replay semantics
real Win7 semantics
faithful/incomplete/incorrect/unknown
proof source

API fidelity:
which APIs were wrong or incomplete?
which were ruled out?

PEB/TEB/process state:
which touched fields matter?

concurrency:
relevant or falsified?

timing:
what exact timer samples participate?
raw scale causal or falsified?

replay corrections:
what changed?
why justified?
regression results

D4:
did replay naturally pass old divergence?
if yes, first new stage
if no, exact remaining reason

D5:
import reconstruction / ijl15 reached?

D6:
Tail A writes?
first producer RVA
first destination range
number of ranges
raw bytes committed? MUST BE no

main EXE game recovery:
number of game-side functions
confirmed/high counts
number of classes
most important 10–20 anchors

support DLL rows:
report separately; do not count toward D7/D8

startup/login chain:
confirmed edges
projected edges
current cut point

network:
ws2_32?
socket?
9555?
server accept?
handshake?

VM gate:
only mention if naturally reappeared; do not over-focus

strongest new finding
strongest remaining uncertainty
primary blocker
secondary blockers
recommended next broad direction

generated result files
generated scripts
```

The most important question Task 028 must answer is not:

```text
"Can we make the replay take the success branch?"
```

It is:

```text
"What exact state causes the decision, what are the real Win7 semantics of that state, and can a faithful replay naturally continue far enough to materialize the main game image?"
```
