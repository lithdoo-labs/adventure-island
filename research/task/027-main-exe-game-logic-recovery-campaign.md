# Task 027 — Main EXE Game Logic Recovery Campaign

## 0. Mission

Task 027 continues directly from Task 026, but tightens the definition of success.

Task 026 produced a useful static recovery baseline for the Wizet support DLLs and fully explained the `ijl15.dll` / `iloveaki.dat` repack layer. It did **not** yet establish runtime progression beyond the `iloveaki success.` modal during that session, and it did **not** recover the main `MapleStory.exe` game body containing the application/login/game-state logic.

The primary mission of Task 027 is therefore:

> Re-establish a reproducible clean runtime foundation, cross the `iloveaki` modal naturally if possible, observe the main executable's game-code materialization boundary, and convert any newly exposed main-EXE code into a sustained function/class/call-chain recovery pipeline.

This is a long-running exploratory campaign. The local AI should work autonomously for several hours, branch into useful sub-investigations, abandon low-value hypotheses quickly, and preserve a coherent evidence trail.

The campaign is **not** complete merely because more PCOM/NameSpace/Canvas/ZLZ functions are named. Those libraries are valuable support-runtime context, but Task 027 success is measured primarily by progress on **`MapleStory.exe` game logic**.

---

## 0.1 What Task 026 established

Treat the following as the starting evidence model, subject to verification against current repository results:

- Program Compatibility Assistant is not the post-click blocker.
- `ijl15.dll` is an 8 KiB repack loader stub.
- `iloveaki.dat` is the renamed Intel JPEG Library 1.51.
- `ijl15.dll!DllMain` loads `iloveaki.dat`, resolves six IJL exports, attempts an inert/misaligned `ZwCreateMutant` modification on Win7 SP1 x86, and displays `iloveaki success.` from inside `DllMain` while holding loader lock.
- Dismissing that modal should simply allow `DllMain` / loader completion; the stub contains no second gate after the message box.
- Task 025 historically reached that modal several times.
- Task 026 could no longer reproduce the modal even with a Task-025-stack control, indicating an infrastructure/environment reproducibility problem rather than a newly identified code wall.
- F:/G: drive-letter determinism is falsified; the exact environmental fork input remains unknown.
- Support DLL static recovery exists for PCOM, NameSpace, Canvas, ZLZ, ResMan, Gr2D_DX8, Sound_DX8, Shape2D and related classes/functions.
- The primary main-EXE static blocker remains the `0x862000+` mixed encoded/plaintext region and downstream Tail-A materialization.
- `MapleStory.exe` exports `ZtlTaskMemAllocImp`, `ZtlTaskMemFreeImp`, and `ZtlTaskMemReallocImp`; these point into the virtual Tail-A game-image region and are useful materialization anchors.
- Main-EXE anchors such as `CWvsApp`, `CClientSocket`, `CLogin`, login/network logic, and the version-79 client-side crypto path remain unrecovered.

Do not silently promote historical-runtime evidence to current-runtime evidence.

---

## 0.2 Safety / research boundary

Allowed:

- static analysis of the user's local on-disk binaries;
- static replay/emulation of already understood transforms;
- PE/import/export/string/RTTI/vtable/xref/call-graph analysis;
- ordinary process/module/thread/window/service enumeration;
- passive ETW/event/file/registry/network observation;
- normal application UI actions, including the application's own `确定` button;
- controlled host-only/private-network testing against the user's local CMS079 server;
- correlation with repository-provided v95/reference symbol material;
- project-owned scripts that normalize, correlate, or statically analyze results;
- rebuilding a clean VM/container/QEMU environment for reproducibility.

Forbidden:

- patching `MapleStory.exe`, `ijl15.dll`, `iloveaki.dat`, or protection branches;
- flipping/NOPing conditionals;
- fake SoftICE/Oreans devices;
- spoofing environment/API return values to satisfy checks;
- anti-debug bypass or debugger concealment;
- DLL injection;
- behavior-changing runtime hooks;
- kernel patches;
- driver-signature bypass/test-signing used to force old drivers;
- VM/hypervisor concealment;
- dumping decrypted/protected main-EXE code from process memory;
- using `ReadProcessMemory` to extract protected executable code;
- forcing environment values solely to make a protection check pass.

If a branch requires one of these techniques, record the boundary and stop that branch.

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

If tracked/uncommitted changes exist, stop and report the blocker. Do not stash, reset, restore, rebase, overwrite, or hide user changes.

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

Record the result as:

```text
STARTING_HEAD
```

If clean fast-forward is impossible, stop rather than rewriting history.

After synchronization, re-read this Task 027 document from disk. Do not rely on a cached copy.

---

# 2. Directory / artifact contract

```text
.raw/
    read-only proprietary inputs

task/
    task specifications

.work/task-027/
    VM/container reconstruction scratch, raw logs, ETW/EVTX/PCAP,
    decompiler databases, temporary static-analysis output, experiment
    traces, copied third-party tools, one-off helpers, large intermediate
    datasets

result/
    compact permanent findings, normalized CSV/Markdown, function/class maps,
    call edges, milestone/blocker ledgers

scripts/
    reusable project-owned tooling only

glm-work/
    prior-research reference only
```

Suggested scratch structure:

```text
.work/task-027/
├── preflight/
├── task026-consistency/
├── vm-rebuild/
├── gate-repro/
├── post-modal/
├── runtime-modules/
├── static-main/
├── materialization/
├── references/
├── functions/
├── classes/
├── callgraphs/
├── network/
└── logs/
```

Never commit original EXE/DLL/DAT/SYS/VXD/WZ files, VM disks/snapshots, raw ETL/EVTX/PML/PCAP, process dumps, decrypted executable/code blobs, decompiler databases, third-party binaries/source trees, or screenshots containing private host information.

---

# 3. Mandatory reading

After synchronization, read at least:

```text
README.md

result/25-win7-post-pca-runtime-localization.md
result/26-game-runtime-recovery-campaign.md
result/task026-milestones.csv
result/task026-blockers.csv
result/task026-post-modal-observation.md
result/task026-post-modal-timeline.csv
result/task026-environment-matrix.csv
result/task026-iloveaki-static.md
result/task026-iloveaki-xrefs.csv
result/task026-iloveaki-controlflow.md
result/task026-function-map.csv
result/task026-class-map.csv
result/task026-call-edges.csv
result/task026-startup-callchain.md
result/task026-reference-correlation.csv
result/task026-module-transition.csv
scripts/maple079_postmodal_observe.ps1
```

Read the main static-protector chain:

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

Read the latest Task 012/012c material concerning:

```text
0x862000+
decoder-C
mixed plaintext / encoded region
Tail A
ZtlTaskMem exports
```

Read resource/runtime context:

```text
result/19-wizet-dlls.md
result/20-wz-inventory.md
result/23-wz-library-cross-validation.md
```

Read server/network context:

```text
result/01-server-baseline.md
result/02-runtime-network-bootstrap.md
result/03-compatibility-passive-capture.md
```

Read repository-provided v95/reference symbol/function-family material intended for CMS079 correlation.

Never copy reference addresses into CMS079.

---

# 4. Phase 0 — Correct Task 026 state inconsistencies quickly

Before new experiments, spend at most ~30 minutes making the Task 026 permanent artifacts internally consistent.

Known issues to verify and correct if still present:

1. `task026-milestones.csv` should not claim current-session reproducibility for M1 if the modal was historical-only during Task 026.
2. Distinguish clearly between:

```text
support-DLL static recovery baseline
```

and:

```text
main-EXE game-code recovery
```

3. `task026-startup-callchain.md` may contain stale language implying F:/G: drive-letter causality and an OK click that never executed.
4. `task026-post-modal-observation.md` may contain mid-run `in flight` text that conflicts with the final C2 verdict.
5. `task026-blockers.csv` may contain stale `pending T26F5` state.
6. Recompute function confidence counts from the actual `task026-function-map.csv` if report/milestone totals disagree.

Do not rewrite Task 026's historical observations. Add correction/refinement notes or update stale status text while preserving provenance.

Create:

```text
result/task027-task026-consistency-audit.md
```

This is housekeeping. Do not spend the campaign here.

---

# 5. Canonical sample gate

Revalidate the main client sample before using any prior RVA conclusions:

```text
MapleStory.exe SHA-256
5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d
```

Also revalidate:

```text
ijl15.dll
iloveaki.dat
```

against Task 026's recorded hashes.

If the main EXE differs, stop reuse of prior RVA conclusions and report the sample mismatch.

---

# 6. Campaign milestone model

Task 027 uses stricter milestones than Task 026.

## R0 — Clean reproducible infrastructure

A freshly reconstructed QEMU/VM execution foundation can reproduce at least one known historical Task 025/026 runtime outcome with the canonical client.

## R1 — Current-session `iloveaki success.` reproduced

The current Task 027 environment itself reaches:

```text
ijl15.dll loaded
iloveaki.dat loaded
iloveaki success.
```

Historical Task 025 evidence alone does **not** satisfy R1.

## R2 — Post-modal boundary crossed

The application-owned `确定` button is clicked exactly once and the process naturally reaches a new stable state after `DllMain` returns.

## R3 — Main EXE materialization evidence

At least one defensible indication shows that a previously unavailable main-EXE game-code region has materialized or become semantically analyzable.

Examples include:

- Tail-A/ZtlTaskMem export bytes or code becoming naturally backed/executable through a safe observable channel;
- new main-image code paths correlated to post-modal behavior;
- newly recoverable static transform output tied to runtime evidence;
- main-image functions beyond the protector/repack layer becoming identifiable through a defensible static/runtime bridge.

Support DLL analysis alone does not satisfy R3.

## R4 — First main-EXE game-logic anchors

Recover at least 5 high-confidence **MapleStory.exe** game-side function/class anchors.

Examples of desirable families, if supported by evidence:

```text
CWvsApp
CClientSocket
CLogin
CField
CUser
CStage
packet dispatch
application startup
network initialization
```

Equivalent CMS079 structures are acceptable if names differ.

## R5 — Main-EXE recovery baseline

Recover at least 20 high-confidence **MapleStory.exe** game-side function/class anchors with reusable evidence.

Support-DLL rows do not count toward this threshold.

## R6 — Runtime network boundary

Observe naturally at least one of:

```text
ws2_32.dll loaded by MapleStory runtime
socket/connect attempt
9555 attempt
server accept
```

## R7 — Startup/login logic chain

Reconstruct a defensible high-level chain from main application startup through network/login initialization with evidence-linked main-EXE functions/classes.

The campaign should move toward the highest safely reachable milestone.

---

# 7. Time budget and priority

Recommended campaign duration if the environment is available:

```text
6–12 hours
```

Suggested allocation, not a rigid checklist:

```text
Task026 cleanup                 <= 5%
VM/QEMU foundation rebuild     15–25%
gate reproduction/post-modal   20–30%
main-EXE static/runtime bridge  25–40%
main-EXE function recovery     30–50% once R3 appears
network/login recovery         opportunistic after R6
```

Do not spend hours trying to prove a minor environmental variable if a known route can progress the client.

Once R3/R4 is reached, shift most effort to code semantics.

---

# 8. Phase A — Rebuild the VM/QEMU foundation from a clean basis

Task 026 ended with an infrastructure/environment regression: the previously reproducible modal stopped appearing even under the historical Task 025 stack.

Do not continue hot-plugging the same long-lived runtime indefinitely.

Reconstruct the experiment foundation using the existing trusted local assets while keeping proprietary inputs read-only.

Preferred actions:

- terminate and recreate the QEMU process cleanly;
- if the VM orchestration runs inside a long-lived local container/process namespace, recreate that environment cleanly if ordinary project workflow supports it;
- create a fresh transfer image from project-owned observer/scripts rather than reusing a heavily mutated hot-plug transfer image;
- attach the client disk using a deterministic controller/port topology;
- restore the known clean Win7 x86 SP1 snapshot or produce a fresh equivalent snapshot if the old snapshot proves irreproducible;
- document exact QEMU command line, QEMU version, CPU model, RAM, storage/controller topology, USB topology, snapshot identity, and launch sequence;
- keep guest networking disconnected during gate-reproduction work.

Do not change the client executable, protection logic, system security enforcement, or API results.

The goal is reproducibility, not environmental spoofing.

Create:

```text
result/task027-runtime-foundation.md
result/task027-foundation-runs.csv
```

For each foundation attempt record:

```text
run_id
host/container freshness indicator
QEMU PID/session identity
QEMU command hash/text reference
snapshot
client disk identity
transfer disk identity
attach topology
client letter
parent/elevation path
PCA shown/clicked
CPU signature
module outcome
iloveaki reached?
notes
```

---

# 9. Phase B — Re-establish R1 quickly

Use the clean foundation to reproduce the shortest known path to:

```text
iloveaki success.
```

Do not re-open the entire F:/G: investigation unless necessary.

Run small controlled variations only when they have clear information value, for example:

- fresh QEMU process vs immediate second run;
- fresh transfer image vs reused transfer image;
- ordinary parent/UAC vs already elevated direct launch;
- single attach sequence vs known historical sequence.

Keep each variation documented.

If R1 is achieved, stop environmental experimentation and immediately continue to R2.

If R1 still cannot be achieved after a reasonable clean-foundation matrix, record exactly which historical variables remain uncontrolled and shift parallel effort to the main-EXE static bridge rather than burning the whole campaign on compatibility.

---

# 10. Phase C — Cross the modal immediately when R1 appears

When `iloveaki success.` appears:

1. record timestamp and target PID;
2. capture ordinary process/thread/module/window state;
3. confirm `ijl15.dll` and `iloveaki.dat` are loaded;
4. click the application's own `确定` button exactly once;
5. do not automatically click any later dialog;
6. observe for at least 300 seconds or until a clear stable transition occurs.

Use the existing Task 026 `Check-Aki`/post-modal observer logic if it remains correct; fix ordinary observer bugs if required.

Record after the click:

```text
CPU/thread transition
new modules
new windows/dialogs
new child processes
service/driver side effects
PCOM/NameSpace/Canvas/ResMan/ZLZ/Gr2D/Sound loads
ws2_32/wininet loads
socket state
process exit
```

Output:

```text
result/task027-post-modal-timeline.csv
result/task027-post-modal-observation.md
```

Classify the natural outcome:

```text
Q0 modal cannot be reproduced
Q1 OK -> process exits
Q2 OK -> returns to CPU spin
Q3 OK -> new modal/error
Q4 OK -> further protector/loader stage
Q5 OK -> Wizet support runtime loads
Q6 OK -> main-EXE game body evidence appears
Q7 OK -> network runtime begins
```

Do not stop just because Q3/Q4 appears. Analyze the new boundary within the same campaign.

---

# 11. Phase D — Main-EXE materialization watch

This is the central Task 027 bridge.

Track the mapped main module and the known virtual regions using only safe ordinary metadata channels.

Important static anchors:

```text
ImageBase 0x00400000
SizeOfImage 0x009DA000
0x862000+ unresolved protected region
Tail A / game-image virtual area
ZtlTaskMemAllocImp RVA 0x5FC19F
ZtlTaskMemFreeImp  RVA 0x5FC1B0
ZtlTaskMemReallocImp RVA 0x5FC1C1
```

Allowed observations include normal PE/module metadata, virtual-memory region metadata where available without reading protected contents, protection-state transitions, committed/private/image region summaries, export-call reachability inferred through ordinary behavior, and static transform/replay correlation.

Do **not** extract decrypted code bytes from live process memory.

Goal: determine whether post-modal progression causes the previously empty/unmaterialized Tail-A region to become backed/executable or otherwise yields a defensible game-code boundary.

Create:

```text
result/task027-materialization-timeline.csv
result/task027-main-image-boundary.md
```

Evidence tags must distinguish:

```text
confirmed-runtime-metadata
confirmed-static
static-runtime-correlation
projected
unknown
```

---

# 12. Phase E — Targeted static attack on `0x862000+`

Do not resume blind whole-region decoder hunting.

Use new Task 026/027 anchors to narrow the problem:

- protector-side decision occurs upstream of `ijl15.dll` load;
- import reconstruction eventually loads `ijl15.dll`;
- ZtlTaskMem exports point into Tail A;
- post-modal runtime behavior may reveal timing/order of the next materialization step;
- any new module/load/error string may provide additional plaintext islands or resolver calls.

Perform targeted static work such as:

- identify cross-references to reconstructed import names or IJL symbols in already decoded regions;
- map control-flow predecessors that can reach the import-rebuild step;
- correlate writes/transform loops with destination ranges overlapping Tail A or ZtlTaskMem export RVAs;
- search for tables/descriptors whose decoded destinations cover the game-image ranges;
- test candidate transforms only when a concrete producer/destination hypothesis exists;
- correlate new post-modal module order with static resolver dictionaries;
- revisit Q15/Q18/Q19 or equivalent unresolved descriptor hypotheses only if new evidence constrains them.

Allowed: offline static replay/emulation against the original local sample.

Do not commit decoded executable blobs.

Generate:

```text
result/task027-decoder-targets.csv
result/task027-main-static-bridge.md
```

Each candidate should include:

```text
candidate_id
producer/caller RVA
source range
destination range
transform evidence
runtime correlation
validation test
result
confidence
```

---

# 13. Phase F — Build a MAIN-EXE-only function map

Create a new map that is explicitly separate from the Task 026 support-DLL map:

```text
result/task027-main-function-map.csv
```

Every row must refer to `MapleStory.exe` unless explicitly marked as a bridge/helper.

Fields:

```text
function_id
RVA_or_static_offset
provisional_name
confidence
subsystem
source_kind
runtime_seen?
reference_symbol
reference_version
reference_match_features
unique_strings
constants
imports/APIs
known_callers
known_callees
class_candidate
packet/resource anchors
notes
```

Confidence:

```text
confirmed
high
medium
low
unknown
```

For `high`, prefer at least two independent evidence families, e.g.:

- structural reference match + unique string;
- vtable/ctor relation + call graph;
- protocol constant + network behavior;
- resource path/string + call semantics;
- reference function family + distinctive constants/callees.

Do not count Task 026 PCOM/NameSpace/Canvas rows toward R4/R5.

---

# 14. Phase G — Main-EXE class recovery

Create:

```text
result/task027-main-class-map.csv
```

Search for main-EXE game/application classes using whatever evidence becomes available:

```text
RTTI/type descriptors
vtable candidates
constructor/destructor patterns
singleton/global access patterns
unique strings
reference-family correlation
call graph
packet/resource behavior
```

High-value candidate families include, only if evidence supports them:

```text
CWvsApp
CClientSocket
CLogin
CStage
CField
CUser
CUI*
CMapLoadable
```

CMS079 may use different names/organization. Use provisional names when uncertain.

Fields:

```text
class_id
provisional_name
confidence
RTTI evidence
vtable
ctor
dtor
important methods
global/singleton evidence
reference correlation
subsystem
notes
```

---

# 15. Phase H — Reference correlation at scale

Use repository-provided v95/reference material aggressively once main-EXE functions become visible.

Match by combinations of:

```text
unique strings
constant sets
callee families
RTTI/vtable slot patterns
switch topology
packet opcodes
resource names
API families
crypto constants
singleton/global patterns
```

Never copy addresses.

Generate:

```text
result/task027-reference-correlation.csv
```

Track rejected correlations too, especially when a superficially similar v95 function conflicts structurally with CMS079.

---

# 16. Phase I — Recover the application startup chain

As soon as enough main-EXE anchors exist, build a code-logic chain rather than isolated names.

Desired high-level structure:

```text
protected entry
-> loader/protector completion
-> application bootstrap
-> Wizet support runtime initialization
-> resource namespace/WZ initialization
-> graphics/audio/window initialization
-> network subsystem creation
-> login stage creation
-> login connection/send/receive
```

The actual CMS079 ordering may differ.

For each edge record:

```text
caller
callee
RVA(s)
evidence
runtime milestone
reference correlation
confidence
```

Outputs:

```text
result/task027-main-call-edges.csv
result/task027-startup-login-callchain.md
```

Projected edges must be clearly marked and must not be counted as confirmed logic.

---

# 17. Phase J — Network/login progression

If runtime naturally reaches `ws2_32` or a socket boundary, immediately extend the campaign into the private network.

Use only host-only/internal networking. No bridged/public Internet.

Known server baseline:

```text
login      9555
channels   7575-7578
cash shop  8600
```

Known handshake baseline is already documented in the repository.

If server runs on the host rather than the guest, do not use guest `127.0.0.1`; use the private host-only address.

Observe:

```text
ws2_32 first seen
socket creation
connect target
SYN/ESTABLISHED
server accept
15-byte handshake sent
client response
channel transition
cash-shop transition
```

Raw PCAP/ETL remains under `.work/task-027/network/`.

Permanent outputs only if reached:

```text
result/task027-network-events.csv
result/task027-login-network-logic.md
```

Once packet-handling code becomes statically visible, correlate against the already verified server-side AES/custom-crypto implementation and opcode families.

---

# 18. Main-EXE recovery acceptance rules

A function/class does not become `high` merely because a v95 name looks plausible.

Useful evidence combinations:

```text
reference structural match + unique string
RTTI/vtable + constructor stores
network behavior + packet constants
resource path + support-DLL interaction
crypto constants + send/receive call graph
singleton/global use + lifecycle call chain
```

Maintain explicit uncertainty.

If only support-DLL logic is recovered, report it as support-DLL enrichment, not main-EXE progress.

---

# 19. Milestone ledger

Maintain:

```text
result/task027-milestones.csv
```

Columns:

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

R1 must be current-session runtime evidence.
R4/R5 must count main-EXE game-side anchors only.

---

# 20. Blocker ledger

Maintain:

```text
result/task027-blockers.csv
```

Columns:

```text
blocker_id
stage
symptom
evidence
attempted_safe_methods
why_unresolved
requires_prohibited_technique?
next_safe_option
```

Once a blocker is well characterized, do not spend hours rediscovering it.

---

# 21. Autonomous-work rule

The local AI may autonomously:

- rebuild the ordinary QEMU/container execution foundation;
- write temporary helpers under `.work/task-027/`;
- repeat safe controlled runs;
- use installed Ghidra/IDA/radare2/objdump/capstone/pefile or similar offline tooling;
- use repository reference bundles;
- write reusable scripts under `scripts/`;
- change the order of analysis based on evidence;
- abandon low-value branches;
- deepen main-EXE code analysis once anchors appear.

Do not stop to ask the user about routine analysis choices.

Stop only for:

- dirty/unsafe repository state;
- missing or mismatched canonical sample;
- unusable VM/input assets;
- need for privileged host changes outside ordinary project workflow;
- a branch that can continue only with forbidden bypass/patch/dump techniques.

---

# 22. Anti-patterns to avoid

Do not:

- spend the entire campaign on F:/G:;
- continue proving PCA behavior again;
- treat `iloveaki.dat` as unexplained;
- count support-DLL symbols toward main-EXE R4/R5;
- declare `CWvsApp` from a weak single v95 resemblance;
- blindly scan the whole `0x862000+` region with random transforms;
- stop immediately after loading PCOM/NameSpace;
- stop immediately after `ws2_32` loads;
- create a new task for every new dialog/module;
- overwrite contradictory historical evidence instead of recording refinements.

The target is **main game-code semantics**.

---

# 23. Recommended permanent outputs

Core outputs:

```text
result/27-main-exe-game-logic-recovery.md
result/task027-milestones.csv
result/task027-blockers.csv
result/task027-task026-consistency-audit.md
result/task027-runtime-foundation.md
result/task027-foundation-runs.csv
result/task027-post-modal-observation.md
result/task027-post-modal-timeline.csv
result/task027-main-image-boundary.md
result/task027-materialization-timeline.csv
result/task027-main-static-bridge.md
result/task027-decoder-targets.csv
result/task027-main-function-map.csv
result/task027-main-class-map.csv
result/task027-reference-correlation.csv
result/task027-main-call-edges.csv
result/task027-startup-login-callchain.md
```

Conditional outputs only if relevant/reached:

```text
result/task027-network-events.csv
result/task027-login-network-logic.md
result/task027-support-dll-refinements.md
```

Do not create empty placeholder files for phases that were not reached.

---

# 24. Strong completion criteria

Minimum campaign completion:

- clean repository sync recorded;
- Task 026 stale-state audit completed;
- canonical sample revalidated;
- VM/QEMU foundation reconstruction attempted systematically;
- current-session R1 either reproduced or blocked with clear evidence;
- post-modal OK click executed if R1 appears;
- main-EXE materialization/static bridge work performed;
- milestone/blocker ledgers maintained;
- final report clearly distinguishes current runtime, historical runtime, static support-DLL recovery, and main-EXE recovery.

Strong completion:

```text
R3 or R4
```

Very strong completion:

```text
R5
>=20 high-confidence main-EXE game-side anchors
```

Ideal completion:

```text
R7
startup -> login logic chain with main-EXE evidence
```

---

# 25. Campaign stop conditions

End Task 027 only when one of the following is true:

A. R5/R7 has established a sustainable main-EXE code-recovery baseline.

B. A precise safe boundary is documented and every high-value non-invasive path is exhausted.

C. The VM/sample/repository foundation cannot produce reliable evidence despite a clean rebuild.

D. Approximately 6–12 hours of high-value exploration are exhausted and the next major experiment requires a fresh campaign.

A failed individual hypothesis is not a stop condition.

---

# 26. Commit / push discipline

Before committing:

```text
git status --short
git diff
git diff --cached
```

Commit only compact permanent findings and project-owned reusable scripts.

Do not commit `.raw/`, `.work/`, proprietary binaries, VM images, raw traces, dumps, decoded protected blobs, third-party tools, or decompiler databases.

Suggested completion commit:

```text
Complete Task 027 main EXE game logic recovery campaign
```

Then:

```text
git rev-parse HEAD
```

Record:

```text
FINAL_COMMIT
```

Push:

```text
git push origin main
```

Never force push.

If `origin/main` advances during the campaign, fetch and report divergence rather than automatically rebasing or rewriting history.

---

# 27. Final report requirements

The final report must answer, explicitly and compactly:

```text
Task 027 complete?
STARTING_HEAD
FINAL_COMMIT
push status

highest R milestone
why it is legitimately reached

Task026 consistency fixes made

canonical hashes

VM/QEMU foundation:
what was rebuilt
what became reproducible
what remained nondeterministic

current-session iloveaki gate:
reached yes/no
number of reproductions

OK click:
executed yes/no
post-modal outcome

main-image materialization:
what changed
Tail-A evidence
ZtlTaskMem export-region evidence
0x862000+ status

main-EXE function recovery:
total candidates
confirmed/high counts
most important 10-20 anchors

main-EXE class recovery:
important classes
confidence
RTTI/vtable/singleton evidence

support-DLL recovery:
new refinements only
(do not count these toward main-EXE milestone)

startup/login call chain:
confirmed edges
projected edges
cut point

runtime network:
ws2_32?
socket?
9555?
server accept?
handshake?

v95/reference correlations:
accepted
rejected
strongest matches

primary blocker
secondary blockers

strongest new finding
strongest remaining uncertainty

recommended next broad direction

generated result files
generated scripts
```

The final report must not claim a higher milestone than the evidence permits.
