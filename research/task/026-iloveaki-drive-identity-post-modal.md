# Task 026 — Game Runtime Recovery Campaign

> This task **supersedes the earlier fine-grained Task 026 plan** while keeping the same task number and file path for continuity.
>
> The goal is no longer to spend an entire task proving one environmental variable at a time. Drive-letter, UAC/parent-path, `iloveaki`, PCA, and Win7 compatibility questions are now **subproblems**. The campaign objective is to cross the remaining loader/repack boundary and begin sustained recovery of MapleStory game-runtime code, classes, functions, and startup/login logic.

---

## 0. Mission

Task 026 is a **long-running exploratory reverse-engineering campaign**.

The primary question is:

> Can we get from the currently observed `iloveaki`/protector/repack boundary into the real Wizet/MapleStory runtime, and once there, recover enough stable function/class/call-chain anchors that code-logic reconstruction becomes a continuous process rather than isolated loader research?

The task is successful if it materially advances toward that goal, even if individual hypotheses such as `F:` vs `G:` turn out to be wrong.

The local AI is expected to work autonomously for a multi-hour session, branch into sub-experiments when useful, abandon low-value branches quickly, preserve evidence, and continuously update a single coherent recovery picture.

Do **not** stop after one interesting observation and do **not** turn every small uncertainty into a new task.

---

## 0.1 Current starting point

Treat the following as the current evidence baseline, not as assumptions that must be defended:

- canonical `MapleStory.exe` SHA-256:

```text
5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d
```

- Task 024 established that both Win7 x64 RTM and Win7 x86 SP1 can start the client naturally but do not reach game runtime in the original baseline runs.
- Task 025 established that Program Compatibility Assistant is a message-only `MINORPROBLEM` path and is not the dominant post-click blocker.
- Bare launch, `MapleStory.exe 127.0.0.1 9555`, and the original launcher batch were equivalent under the same controlled environment.
- Task 025 found two stable post-PCA outcomes:
  - a CPU-active spin with only early system modules;
  - a loader-success path that maps `iloveaki.dat`, `ijl15.dll`, `MSVCR90.dll`, related Windows libraries, and then shows `iloveaki` / `iloveaki success.`.
- In Task 025, those outcomes correlated with client-volume/mount conditions that presented as `G:` vs `F:`, but the exact causal variable is not yet proven.
- Task 024 contains an historical `F:` spin under a different parent/elevation path, so drive letter alone must not be assumed causal.
- Neither Task 024 nor Task 025 naturally reached:

```text
PCOM.dll
NameSpace.dll
Canvas.dll
ResMan.dll
ZLZ.dll
Gr2D_DX8.dll
Sound_DX8.dll
ws2_32.dll
9555
```

- Existing static work has already recovered a substantial protector chain including T1/T2/T3, round1/round2/round3 producers, resolver logic, SoftICE probes, command-line decoders, Oreans/WinLicense-related strings/logic, and the unresolved `0x862000+` mixed encoded/plaintext region.
- Existing WZ/resource work is mature enough that WZ format research is no longer the main blocker.
- Existing server/protocol work already identifies login/channel/cashshop ports and the CMS079 handshake/encryption model.

Task 026 must build on this state rather than repeat it.

---

## 0.2 Campaign philosophy

This task uses **hard milestones**, not micro-task completion.

The local AI may choose whatever sequence of safe static and passive dynamic techniques gives the best information gain.

Do not spend hours proving an environmental variable if the real game runtime can already be reached another way.

Do not continue an experiment merely because it was planned if evidence shows it is low value.

Prefer:

```text
cross boundary
→ identify stable anchors
→ recover functions/classes
→ reconstruct startup/login logic
```

over:

```text
perfectly characterize every compatibility quirk
→ still no game code
```

---

## 0.3 Exploration time budget

Target one sustained exploration session of approximately **4–8 hours** if the environment remains usable.

Use the budget roughly as follows, but adapt when evidence warrants:

```text
<= 10%   repository/data hygiene
<= 15%   environment/drive/UAC causal cleanup
20–30%   iloveaki/repack boundary + post-modal progression
40–60%   game-runtime/code recovery once a useful boundary is crossed
```

If a game-runtime milestone is reached early, immediately shift the majority of time into code recovery.

Do not spend more than ~60 minutes total on `F:`/`G:`/UAC mechanics unless that work is directly required to reproduce the only known progression path.

---

## 0.4 Safety / research boundary

This is an authorized local compatibility/reverse-engineering task on the user's own sample.

Allowed:

- offline PE/static analysis;
- disassembly/decompilation of local on-disk files;
- static transformation/replay of already-understood decode algorithms against the original local sample;
- string/xref/RTTI/vtable/import/export analysis;
- ordinary process/module/thread/window enumeration;
- passive ETW/event/file/registry/network observation;
- normal application UI actions such as clicking `Run program` or the application's own `确定` button;
- controlled private-network testing against the user's local CMS079 server;
- cross-version/reference correlation using repository-provided symbols and references;
- building project-owned scripts that normalize or correlate findings.

Forbidden:

- patching `MapleStory.exe`, `iloveaki.dat`, or protection logic;
- flipping branches/NOPing checks;
- anti-debug bypass;
- debugger concealment;
- fake SoftICE/Oreans devices;
- spoofing API/environment return values;
- DLL injection;
- runtime API hooks used to alter behavior;
- kernel patches;
- driver-signature bypass/test-signing for the purpose of forcing old drivers;
- VM/hypervisor concealment;
- process-memory dumps of decrypted/protected executable code;
- extracting protected code through `ReadProcessMemory`;
- force-writing environment values solely to make a protection check pass.

If progress requires one of these prohibited techniques, stop that branch and record the boundary.

---

# 1. Repository synchronization gate

Start from a clean, current `origin/main`.

From repository root:

```text
git status --short
git branch --show-current
git remote -v
git rev-parse HEAD
```

If tracked/uncommitted changes exist, stop and report the blocker.

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

Record this as:

```text
STARTING_HEAD
```

If clean fast-forward is impossible, stop rather than rewriting history.

---

# 2. Directory / artifact contract

```text
.raw/
    read-only proprietary inputs

task/
    task specifications

.work/task-026/
    all scratch analysis, VM raw logs, decompiler databases, ETW/EVTX/PCAP,
    copied third-party tools, temporary extracted metadata, static-analysis output,
    one-off scripts, experiment traces, and large intermediate datasets

result/
    compact permanent findings, normalized CSV, Markdown, function/class maps

scripts/
    reusable project-owned tooling only

glm-work/
    prior research reference; do not use as the final Task 026 result directory
```

Recommended scratch layout:

```text
.work/task-026/
├── preflight/
├── task025-repair/
├── iloveaki/
├── runtime/
├── static-main/
├── reference-correlation/
├── functions/
├── classes/
├── callgraphs/
├── network/
├── traces/
└── logs/
```

Never commit:

- original EXE/DLL/SYS/VXD/DAT/WZ files;
- VM images/snapshots;
- process dumps;
- decrypted executable/code blobs;
- raw PML/ETL/EVTX/PCAP;
- debugger/decompiler databases;
- third-party binaries/source trees;
- large raw JSON/tree dumps;
- screenshots containing private host/environment details.

---

# 3. Mandatory reading

After synchronization, read the latest versions of at least:

```text
README.md
result/24-win7-x64-natural-runtime.md
result/24-win7-x86-sp1-natural-runtime.md
result/25-win7-post-pca-runtime-localization.md
result/task025-launch-matrix.csv
result/task025-appcompat-evidence.md
result/task025-thread-summary.md
result/task025-module-timeline.csv
result/task025-event-timeline.csv
result/task025-repeated-operations.csv
result/task025-static-runtime-correlation.md
scripts/maple079_runtime_observe.ps1
```

Static/protector chain:

```text
result/04-static-loader-dataflow.md
result/05-stage2-pe-scan-correlation.md
result/06-stage2-inplace-decode.md
result/07-protector-resolver-antidebug.md
result/08-winlicense-reference-normal-path.md
result/09-probe-cluster-full-cfg.md
result/09-normal-probe-path-materialization.md
result/10-post-probe-stage.md
result/10b-static-extension.md
```

Also read the latest Task 012/012c findings concerning:

```text
0x862000+
mixed plaintext/encoded islands
decoder-C search boundary
```

Resource/runtime references:

```text
result/19-wizet-dlls.md
result/20-wz-inventory.md
result/23-wz-library-cross-validation.md
```

Server/network baseline:

```text
result/01-server-baseline.md
result/02-runtime-network-bootstrap.md
result/03-compatibility-passive-capture.md
```

Read any repository-provided v95/reference symbol/function-family seed material that is intended for CMS079 correlation.

Do not copy reference addresses into CMS079. Use reference material only for names, signatures, class/function relationships, strings, and structural hypotheses.

---

# 4. Phase 0 — Fast hygiene only

Task 025 contains a known `task025-launch-matrix.csv` schema/data ordering defect.

Repair it early, but **time-box this work to ~30 minutes**.

Use preserved raw evidence where available. Do not invent values.

Requirements:

- correct the CPU/WS/thread field ordering if proven;
- correct the A3 working-directory field if proven;
- verify at least one spin run and one `iloveaki` run against raw evidence;
- append a short correction/refinement note to the Task 025 report rather than rewriting its historical observations;
- create:

```text
result/task026-task025-data-repair.md
```

If raw evidence is insufficient, mark uncertain fields `unknown` and move on.

This repair is housekeeping, not the campaign goal.

---

# 5. Milestone model

Track progress using the following hard milestones.

## M0 — Reproducible known baseline

At least one known Task 025 outcome can be reproduced on the current Win7 x86 SP1 VM with the canonical executable hash.

## M1 — Reproducible `iloveaki` success gate

The client reliably reaches:

```text
iloveaki.dat loaded
→ iloveaki success.
```

under a documented environment.

## M2 — Post-modal boundary crossed

After clicking the application-owned `确定` button once, the process naturally progresses to a new stable state.

This can be:

- a new module set;
- a new dialog/error;
- another loader stage;
- game-runtime initialization;
- a process transition;
- Winsock/network initialization.

## M3 — First real Wizet/MapleStory runtime anchor

At least one of the following becomes confirmed-runtime or is otherwise reached through a defensible static/runtime boundary:

```text
PCOM.dll
NameSpace.dll
Canvas.dll
ResMan.dll
ZLZ.dll
Gr2D_DX8.dll
Sound_DX8.dll
```

or an equivalent clearly game-side code boundary is identified.

## M4 — Network runtime reached

At least one of:

```text
ws2_32.dll loaded
socket/connect attempt
9555 connection attempt
server accept
```

is observed naturally.

## M5 — Function/class recovery baseline

At least **20 high-confidence game-side function/class anchors** are recovered with evidence and placed in a reusable symbol/function map.

## M6 — Startup/login logic chain

A defensible high-level chain is reconstructed from game startup toward login/network handling, with named or provisionally named functions/classes and evidence links.

The campaign should keep moving toward the highest reachable milestone.

---

# 6. Priority rule: cross the `iloveaki` gate first

The highest immediate-value experiment is no longer another long PCA study.

Use the shortest reproducible route from Task 025 to reach:

```text
iloveaki success.
```

If the previous `F:`/mount/elevated-parent configuration still reproduces it, use that as the working path.

Do not spend the entire task proving why that environment works before observing what happens next.

Once the `iloveaki` dialog is stable:

1. capture pre-click module/process/thread/window state;
2. click the application's own `确定` button **exactly once**;
3. do not automatically dismiss subsequent dialogs;
4. observe for at least 120 seconds or until a clear new stable boundary appears;
5. repeat at least once if the outcome is important and reproducible.

Allowed because this is a normal application UI action, not a patched/bypassed branch.

Generate a time-normalized post-modal timeline.

---

# 7. Environmental causal cleanup is subordinate

The `F:`/`G:` and parent/elevation questions remain useful, but they are no longer the main deliverable.

Spend at most ~60 minutes total unless they are necessary to obtain M1/M2 reproducibly.

If useful, perform a compact controlled matrix:

```text
same client volume/device topology
same launch command
same observer
same network state
only logical drive letter changed
```

and/or:

```text
same client volume/letter
same command
same observer
only parent/elevation launch path changed
```

Record enough to classify the Task 025 correlation as:

```text
letter-causal
mount/device-causal
parent/elevation-causal
co-causal
still-unknown
```

Do not continue beyond what is needed to make the runtime path reproducible.

Output, if actually executed:

```text
result/task026-environment-matrix.csv
```

The absence of perfect causal isolation does not block later campaign phases if a stable progression path is available.

---

# 8. Offline `iloveaki.dat` analysis

Analyze the unchanged local on-disk `iloveaki.dat` as a PE/module.

Record:

```text
size
SHA-256
machine/type
preferred image base
entry point RVA
sections
permissions
entropy
imports
exports
resources
TLS callbacks
relocations
load config
debug/PDB path
version info
signature status
compiler/runtime hints
```

Search/xref:

```text
iloveaki
success
success.
MapleStory
```

and any actual path/volume/environment-related strings or APIs present.

Map the `iloveaki success.` call site if possible:

```text
string RVA
referencing function
message/dialog API or wrapper
nearby condition(s)
callers/callees
return path after dialog dismissal
```

Use static disassembly/decompilation of the disk file only.

Do not patch branches or produce a bypass binary.

Outputs:

```text
result/task026-iloveaki-static.md
result/task026-iloveaki-xrefs.csv
result/task026-iloveaki-controlflow.md
```

This track should run in parallel with post-modal runtime observation rather than delaying it.

---

# 9. Post-modal runtime campaign

For every successful M1 run, record before and after the single `确定` click:

```text
relative time
PID/parent/children
CPU
thread count/states
window class/title
module first-seen times
service/driver side effects
network socket state
process exit
next dialog/error
```

Mandatory module watch list:

```text
iloveaki.dat
ijl15.dll
MSVCR90.dll
PCOM.dll
NameSpace.dll
Canvas.dll
ResMan.dll
ZLZ.dll
Gr2D_DX8.dll
Sound_DX8.dll
ehsvc.dll
AspINet.dll
ws2_32.dll
wininet.dll
```

Also record every newly loaded non-system module.

Classify the post-modal result:

```text
P0  cannot reproduce iloveaki gate
P1  process exits
P2  returns to CPU spin
P3  new modal/error boundary
P4  HackShield/update stage starts
P5  Wizet resource/game runtime starts
P6  Winsock/socket stage starts
P7  private-server login connection observed
```

Do not treat one module as proof of later stages.

Outputs:

```text
result/task026-post-modal-timeline.csv
result/task026-post-modal-observation.md
```

---

# 10. If a new boundary appears, continue within Task 026

Do not stop and propose a new task merely because a new dialog/module appears.

Investigate the new boundary immediately using the same allowed techniques.

Examples:

- new dialog → capture exact title/body/process/module state; trace its static string/xref if available;
- new DLL → perform quick PE/import/export/string/RTTI analysis;
- new child process → record command line/module set/lifetime;
- new file/registry dependency → determine whether it is missing, optional, or normal startup state;
- new game DLLs → begin function/class mapping immediately;
- Winsock → move into the controlled network phase.

Continue until:

- progress reaches a major stable runtime milestone;
- the exploration budget is exhausted;
- or continuing would require a prohibited bypass technique.

---

# 11. Controlled private-network phase

Only enable networking after a natural runtime signal justifies it, such as:

```text
ws2_32.dll
socket/connect activity
game runtime initialization
```

Use only:

```text
host-only
internal/private
```

Do not bridge the Win7 guest to the public Internet.

Use the existing CMS079 server baseline:

```text
login      9555
channels   7575–7578
cash shop  8600
```

If the server runs on the host/private side, remember that guest `127.0.0.1` is the guest itself. Use the private host address when appropriate.

Record:

```text
ws2_32 first seen
connect target
SYN
ESTABLISHED
server accept
15-byte handshake observed?
client response?
subsequent channel/cashshop attempts?
```

The task does not require full packet reverse engineering if that is already covered elsewhere.

Raw captures stay in `.work/task-026/network/`.

Output if reached:

```text
result/task026-network-bootstrap.md
result/task026-network-events.csv
```

---

# 12. Transition immediately into code recovery once game runtime appears

The moment M3 is reached, change strategy.

Do **not** keep spending the majority of time on compatibility observations.

Start constructing a reusable code-recovery dataset.

Primary sources:

1. canonical CMS079 on-disk binaries and already-understood decoded/static regions;
2. unpacked Wizet runtime DLLs already present in the client;
3. repository-provided v95/reference symbol/function-family seeds;
4. CMS079 server protocol/opcode knowledge;
5. WZ/resource object model knowledge;
6. RTTI/vtables/type names if present;
7. imports/exports and cross-module calls;
8. strings and format strings;
9. class-factory/PCOM object names;
10. deterministic static signatures and call-graph relationships.

Do not copy v95 addresses into CMS079.

---

# 13. Function recovery methodology

Create a canonical function map with one row per candidate function.

Suggested fields:

```text
function_id
module
RVA_or_static_offset
provisional_name
confidence
source_kind
reference_name_if_any
reference_version
reference_match_basis
strings
imports_called
exports_called
known_callers
known_callees
class_candidate
subsystem
notes
```

Confidence levels:

```text
confirmed
high
medium
low
unknown
```

A high-confidence name should have at least two independent supporting signals where practical, for example:

```text
reference structural match + unique string
RTTI/class relationship + call graph
known protocol opcode + packet layout
PCOM object name + imported factory call
vtable position + multiple call sites
```

Avoid mass-renaming based on weak byte similarity alone.

Output:

```text
result/task026-function-map.csv
```

Target for M5:

```text
>= 20 high-confidence game-side anchors
```

If enough material exists, aim for 50+ total candidates across confidence levels.

---

# 14. Class / vtable recovery

Build a class-oriented map where evidence allows.

Candidate targets include families such as:

```text
CWvsApp
CClientSocket
CLogin
CUI*
CField*
CUser*
CMapLoadable
CWnd
CStage
CAnimationDisplayer
```

These are examples/reference targets, not assumed CMS079 symbols.

For each candidate class record:

```text
class_name_or_provisional_name
module
RTTI/type-name evidence
vtable candidate
constructor/destructor candidates
important virtuals
member-access patterns
reference-version correlation
confidence
```

Use reference symbols structurally, not as address truth.

Output:

```text
result/task026-class-map.csv
```

---

# 15. Recover startup/application initialization logic

The first major logic-reconstruction target is the startup chain.

Attempt to build a chain conceptually resembling:

```text
PE/protector/repack completion
→ application/runtime initialization
→ PCOM/resource initialization
→ graphics/sound/window startup
→ network/client-socket initialization
→ login-stage creation
```

Do not force this exact architecture if CMS079 evidence differs.

For every link record:

```text
caller
callee
why the edge is believed
module
RVA/offset if statically known
runtime milestone if observed
confidence
```

Output:

```text
result/task026-startup-callchain.md
result/task026-call-edges.csv
```

M6 requires a defensible chain, not necessarily a complete original source reconstruction.

---

# 16. Recover network/login anchors when available

Use the server/protocol knowledge already established to search for code-side anchors associated with:

```text
login server connection
9555
handshake/version 79
send/receive initialization
packet encryption/decryption
login request/response handling
channel selection
channel transition
```

Possible evidence sources:

- port constants;
- packet/opcode constants;
- handshake version values;
- IV/key constants;
- socket API call graph;
- reference `CClientSocket`/packet functions;
- server-side packet layouts already documented.

Do not assume all crypto/network functions live in one class.

Output network-related candidates into the same canonical function map and summarize in:

```text
result/task026-login-network-logic.md
```

---

# 17. Reference-version correlation campaign

Use the existing reference/symbol bundle aggressively once game-side code is accessible.

For each reference candidate, compare structural features such as:

```text
callee family
string anchors
RTTI/class relationship
vtable slot
switch/branch shape
import usage
constant sets
packet/opcode behavior
resource-object interactions
```

Never treat matching ordinal/address/absolute RVA as evidence by itself.

Record correlation seeds and outcomes in:

```text
result/task026-reference-correlation.csv
```

Suggested fields:

```text
cms079_candidate
reference_version
reference_symbol
match_features
conflicting_features
confidence
accepted_name
```

---

# 18. Continue static decoding work only when it serves game-code recovery

The unresolved `0x862000+` encoded/mixed region remains important, but Task 026 should not repeat broad blind decoder searches with no new evidence.

Resume decode work only when one of the following occurs:

- runtime progression identifies a boundary/module/region that points back into `0x862000+`;
- `iloveaki` static analysis reveals a producer/consumer relation;
- a reference signature/function family gives a plausible target inside the region;
- a concrete game-runtime anchor is found adjacent to a decoded/plaintext island.

Then perform targeted offline/static analysis against the canonical on-disk sample.

Allowed:

- emulate/replay already-understood transforms;
- derive candidate transforms from static code;
- validate against structural expectations;
- produce compact derived metadata/digests.

Do not commit reconstructed executable blobs.

---

# 19. Create a living milestone ledger

Create:

```text
result/task026-milestones.csv
```

Fields:

```text
milestone
status
time_reached
evidence
primary_artifact
confidence
notes
```

Statuses:

```text
not-started
in-progress
reached
blocked
not-applicable
```

Update it as the campaign proceeds.

This lets the final result show actual forward progress rather than a long narrative of experiments.

---

# 20. Create a compact blocker ledger

When a branch stops making progress, record the blocker once and move on.

Create:

```text
result/task026-blockers.csv
```

Fields:

```text
blocker_id
stage
symptom
evidence
attempted_non-invasive_methods
why_not_resolved
would_require_prohibited_technique?
next_safe_option
```

Do not spend the session rediscovering the same blocker.

---

# 21. Autonomy rules for the local AI

The local AI is explicitly authorized to:

- create additional `.work/task-026/` scratch scripts;
- run multiple safe experiments without asking for approval each time;
- choose alternative static-analysis tools already installed;
- use Ghidra/IDA/radare2/objdump/capstone/pefile or equivalent offline tools if available;
- compare multiple repository reference datasets;
- restructure its analysis approach when evidence changes;
- repeat promising experiments;
- abandon low-information experiments early;
- create reusable project-owned scripts under `scripts/` when justified.

The AI should **not** stop to ask the user about ordinary analytical choices.

Stop/ask only if:

- repository state is unsafe to modify;
- required local files are missing;
- the VM is irrecoverably broken;
- continuing requires a prohibited bypass technique;
- an action would install a privileged system component or materially modify the host.

---

# 22. Avoid analysis traps

Do not let the campaign get stuck in any of these patterns:

### Trap A — endless compatibility micro-tests

If a reproducible M1 path exists, use it and move forward.

### Trap B — treating every mismatch as a new task

Keep it inside Task 026 unless it becomes a separate major research domain.

### Trap C — chasing protector branding instead of game code

Knowing another Oreans/WinLicense detail has low value unless it helps cross the game-runtime boundary.

### Trap D — copying v95 names too aggressively

Reference material is a naming/correlation aid, not CMS079 ground truth.

### Trap E — counting functions without semantic recovery

The goal is meaningful anchors and call chains, not arbitrary disassembly coverage.

### Trap F — stopping at first network activity

If `ws2_32` or 9555 appears, continue into startup/login logic recovery if time remains.

---

# 23. Evidence labels

Use:

```text
confirmed-runtime
confirmed-static
controlled-causal
controlled-correlation
reference-supported
probable
possible
not-observed
unknown
observer-affected
```

For code names additionally use confidence:

```text
confirmed
high
medium
low
```

Do not collapse `reference-supported` into `confirmed` without CMS079-local evidence.

---

# 24. Desired permanent outputs

The campaign should produce the smallest useful set of durable artifacts.

Core outputs:

```text
result/26-game-runtime-recovery-campaign.md
result/task026-milestones.csv
result/task026-blockers.csv
result/task026-task025-data-repair.md
result/task026-post-modal-observation.md
result/task026-post-modal-timeline.csv
result/task026-function-map.csv
result/task026-class-map.csv
result/task026-call-edges.csv
result/task026-startup-callchain.md
result/task026-reference-correlation.csv
```

When applicable:

```text
result/task026-environment-matrix.csv
result/task026-iloveaki-static.md
result/task026-iloveaki-xrefs.csv
result/task026-iloveaki-controlflow.md
result/task026-module-transition.csv
result/task026-login-network-logic.md
result/task026-network-bootstrap.md
result/task026-network-events.csv
```

Do not create empty placeholder files for phases that were never reached.

Reusable scripts may be added under `scripts/`.

---

# 25. Minimum success criteria

Task 026 should not be judged by whether every planned sub-experiment was performed.

Minimum acceptable campaign completion requires:

1. repository sync and `STARTING_HEAD` recorded;
2. canonical sample identity revalidated;
3. Task 025 machine-readable defect repaired or explicitly marked unrepairable;
4. at least one reproducible `iloveaki` success path attempted;
5. the `iloveaki` modal `确定` button clicked once in a controlled run and the post-modal outcome recorded, unless M1 itself becomes unreproducible;
6. `iloveaki.dat` receives offline static characterization;
7. milestone ledger and blocker ledger are maintained;
8. if game runtime is reached, function/class recovery begins in the same task;
9. if network runtime is reached, private-server observation begins in the same task;
10. final report identifies the highest milestone actually reached and the single most important remaining blocker.

A strong completion should reach M3 or higher.

An excellent completion should reach M5/M6 and leave a reusable function/class/call-chain dataset.

---

# 26. Campaign stop conditions

End the campaign only when one of these is true:

### Stop A — major recovery baseline achieved

M5/M6 achieved and enough artifacts exist for systematic follow-on code reconstruction.

### Stop B — hard natural boundary

The highest safe/non-invasive runtime boundary is sharply localized and further progress would require prohibited bypass/patch/dump techniques.

### Stop C — environment failure

The VM/sample/repository environment can no longer produce reproducible evidence.

### Stop D — exploration budget exhausted

After ~4–8 hours, the campaign has exhausted high-value safe branches. Record the strongest blocker and next safe direction.

Do not stop merely because one hypothesis failed.

---

# 27. Final report structure

Create:

```text
result/26-game-runtime-recovery-campaign.md
```

The report must answer, concisely but concretely:

```text
Task 026 complete?
STARTING_HEAD
FINAL_COMMIT
push status
```

Then:

## Highest milestone

```text
highest M0–M6 reached
why it qualifies
primary evidence
```

## Runtime progression

```text
PCA
→ iloveaki
→ post-modal result
→ first game module (if any)
→ Winsock/network (if any)
```

## Environment findings

Only summarize environment variables that materially affected progression.

State whether F/G/UAC is:

```text
causal
co-causal
correlated
unresolved
irrelevant to current progression path
```

## iloveaki

```text
SHA-256
PE summary
success-dialog call-site status
important imports/strings
what happens after OK
```

## Game runtime

List all confirmed game-side modules reached.

## Function recovery

```text
total function candidates
high-confidence count
confirmed count
important recovered functions
```

## Class recovery

```text
class candidates
high-confidence classes
important vtables/constructors if known
```

## Startup/login chain

Present the best reconstructed chain with confidence annotations.

## Network

If reached:

```text
ws2_32
9555 attempt
server accept
handshake
channel/cashshop progression
```

## Static unresolved boundary

Explain whether `0x862000+` is still blocking and how current runtime findings relate to it.

## Remaining blocker

Name **one primary blocker** and secondary blockers separately.

## Next research direction

Recommend a broad next phase, not a dozen micro-tasks.

---

# 28. Pre-commit audit

Before commit:

```text
git status --short
git diff
git diff --cached
```

Verify no prohibited artifacts are staged.

Allowed permanent areas:

```text
result/
scripts/
```

and verified repairs/refinement notes to existing tracked research documents.

Do not commit `.work/` or proprietary/raw binaries.

---

# 29. Commit and push

Suggested completion commit:

```text
Complete Task 026 game runtime recovery campaign
```

Then:

```text
git rev-parse HEAD
```

Record as:

```text
FINAL_COMMIT
```

Push normally:

```text
git push origin main
```

Never force-push.

If `origin/main` moved during the campaign, fetch and report the divergence. Do not automatically rewrite history.

---

# 30. Final instruction to the executor

Do not treat this task as a checklist that must be completed linearly.

The campaign order is:

```text
get reproducible progression
→ cross iloveaki
→ follow the next natural boundary
→ enter game runtime
→ immediately start recovering code semantics
→ build function/class/call-chain maps
→ use network/runtime evidence to validate names
```

Environmental questions are only important insofar as they help that progression.

The desired outcome is not another compatibility report.

The desired outcome is the beginning of a **systematic CMS079 game-code recovery pipeline**.