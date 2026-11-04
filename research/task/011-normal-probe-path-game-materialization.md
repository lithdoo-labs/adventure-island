# Task 011 — Normal Probe Path CFG & First Game-Materialization Boundary

## Goal

Continue from the Task 010 normal-environment result without patching or forcing any anti-debug outcome.

The ordinary-system edge for the first SoftICE probe is now high-confidence:

```text
CreateFileA("\\\\.\\SICE")
  -> INVALID_HANDLE_VALUE on a normal host with no SoftICE device
  -> inc eax
  -> ZF = 1
  -> fall through to RVA 0x00859780
```

Task 011 must determine what the normal path does after `0x00859780`, where the environment/protector probe cluster ends, and where the first non-probe stage begins.

The highest-value milestone is the first evidence of MapleStory game-image materialization:

- first write into Tail A `0x002CE000–0x007EA000`, or
- first write into the ZtlTaskMem slots, or
- first materialized region with strong MapleStory game anchors such as MSVC RTTI/vtables, WZ strings, Maple packet crypto constants, or Winsock/network behavior.

This task is not an anti-debug bypass task.

---

## Fixed target

Main sample SHA-256:

```text
5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d
```

If the hash differs, stop reusing existing RVA conclusions.

Known stage chain:

```text
EntryPoint RVA 0x009D8000
  -> T1 decode
  -> T2 aPLib-style depack
  -> Tail B stage-2 protector
  -> kernel32 discovery via GetLocalTime IAT
  -> in-place decode rounds
  -> generic export walker / API resolver
  -> SoftICE/WinLicense probe cluster
  -> ordinary-system edge 0x00859780
  -> UNKNOWN
```

Known Tail B:

```text
0x00819000–0x00912000
```

Known Tail A:

```text
0x002CE000–0x007EA000
```

Known ZtlTaskMem slots:

```text
0x005FC19F
0x005FC1B0
0x005FC1C1
```

Known SoftICE probe:

```text
CreateFileA callsite: 0x00859757
return test:          0x00859779 inc eax
                      0x0085977A jne 0x00859A61
normal edge:          0x00859780
present edge:         0x00859A61
```

Further normal-path names already visible:

```text
\\.\SIWVID  @ RVA 0x00859882
\\.\NTICE   @ RVA 0x008599BF
HKCU\Software\WinLicense
Software\WLkt
```

---

## Required reading

Read before execution:

```text
README.md

task/011-normal-probe-path-game-materialization.md

result/08-winlicense-reference-normal-path.md
result/probe-normal-path-analysis.md
result/probe-normal-path-correlation.csv
result/device-probe-normal-semantics.md
result/normal-environment-probe-observation.md
result/normal-environment-state.csv
result/protector-attribution.md
result/reference-cfg-correlation.md

result/07-protector-resolver-antidebug.md
result/protector-export-walker.md
result/protector-api-table-layout.md
result/protector-probe-map.md
result/protector-probe-convergence.md
result/post-probe-next-stage.md

result/06-stage2-inplace-decode.md
result/05-stage2-pe-scan-correlation.md

reference/maplestory-symbols/README.md
reference/maplestory-symbols/SOURCES.md
reference/maplestory-symbols/derived/cms079-correlation-seeds.csv
reference/maplestory-symbols/derived/function-family-seeds.md
```

Use the v95 material only as cross-version reference evidence. Do not transplant v95 addresses into CMS079.

---

## Hard constraints

Do not:

1. modify `.raw/`;
2. patch `MapleStory.exe`;
3. patch materialized protector bytes;
4. force ZF/CF or edit EIP to cross the probe;
5. return a fabricated `CreateFileA` result inside the emulator;
6. create fake `SICE`, `SIWVID`, or `NTICE` device objects;
7. hide a debugger;
8. use anti-anti-debug plugins;
9. edit PEB/TEB debugger-related state;
10. inject a DLL;
11. hook target-process APIs to change behavior;
12. disable Smart App Control, Code Integrity, Defender, or AppLocker;
13. create or distribute an unpacked executable;
14. commit full memory dumps or generated executable blobs;
15. commit third-party leaked EXE/PDB/IDB binaries.

Temporary generated data must stay under:

```text
.work/task-011/
```

A normal environment may be observed passively. A clean compatibility VM may be used if already available and trusted, but do not download arbitrary OS images or lower security controls merely to make the client run.

---

## Phase A — Reconfirm Task 010 normal-path facts

Reconfirm, without launching MapleStory under a debugger:

- the main EXE SHA-256;
- the local absence/presence of `\\.\SICE`, `\\.\SIWVID`, `\\.\NTICE`;
- Task 010's ordinary-system interpretation of `0x00859780`.

Do not repeat all public research unless a contradiction appears.

Record a concise reproducibility note.

Deliverable:

```text
result/task011-normal-path-baseline.md
```

---

## Phase B — Static CFG recovery from the normal edge

Starting at:

```text
RVA 0x00859780
```

recover the static control-flow graph forward through the entire known probe cluster.

Do not stop merely because code is obfuscated. Follow unconditional gadgets, direct branches, call/pop/ret dispatch, table-based control flow where statically resolvable, and wrapper/resolver calls identified by Tasks 008–009.

For each basic block record:

- block start RVA;
- block end RVA;
- successors;
- predecessor count;
- semantic class;
- key strings/data referenced;
- API slot or resolver use;
- confidence.

Semantic classes:

```text
device-probe
registry-probe
protector-state
resolver
self-decode
memory-materializer
relocation/fixup
import-builder
error/UI
unknown
```

Special attention:

```text
0x00859882  \\.\SIWVID
0x008599BF  \\.\NTICE
WinLicense registry cluster around 0x00859CF4 and later
```

For SIWVID and NTICE, statically determine whether each string is actually passed to the same `CreateFileA` path. Do not infer that merely from a `lea`.

Deliverables:

```text
result/normal-probe-path-cfg.csv
result/normal-probe-path-analysis.md
```

---

## Phase C — Probe sequence and convergence map

Build an ordered probe timeline for the ordinary path.

For every probe identify, where possible:

- target string/key/object;
- resolver/API used;
- callsite RVA;
- return-value test;
- normal-miss edge;
- detection edge;
- immediate downstream behavior;
- later convergence point, if any.

Do not execute detection branches just to classify them.

Determine whether the normal path is structurally:

```text
SICE miss
 -> SIWVID miss
 -> NTICE miss
 -> WinLicense state checks
 -> next stage
```

or whether the order differs.

Deliverables:

```text
result/normal-probe-sequence.csv
result/probe-convergence-task011.md
```

---

## Phase D — Identify the first post-probe stage

The main goal of this phase is to find the first block that is no longer primarily an environment/protector-state probe.

Look for structural transitions such as:

- a new decode loop;
- a decompressor;
- a large copy/transform;
- `VirtualAlloc`/`VirtualProtect`-like behavior;
- section-sized writes;
- relocation processing;
- import reconstruction;
- a jump into a newly written region;
- a stable non-self-modifying MSVC function cluster.

Define a candidate post-probe boundary only when there is evidence of a semantic transition.

Record:

```text
boundary RVA
predecessor stage
successor stage
why it is not just another probe
confidence
```

Deliverable:

```text
result/first-post-probe-stage.md
```

---

## Phase E — Natural-run passive observation

If the current host can launch the client without a debugger, perform one or more normal runs using the clean system state already established by Task 010.

Do not hook or modify the process.

Allowed passive sources include:

```text
ETW ImageLoad
Process Explorer / VMMap metadata
CreateToolhelp32Snapshot
EnumProcessModulesEx
VirtualQueryEx
window/UI text readout
read-only file/registry/process event observation
network connection observation
```

The purpose is not to read all process memory. The purpose is to determine whether a normal run naturally progresses beyond the SICE/SIWVID/NTICE/WinLicense probe cluster.

Record:

- process lifetime;
- module-load sequence;
- visible dialogs/windows;
- file/registry access related to the probe cluster;
- whether game ports `9555`, `7575–7578`, or `8600` are contacted;
- whether new mapped/image/private executable regions appear;
- whether Tail A appears committed/executable, if determinable from metadata.

If the target never reaches the game ports, state the precise last observable milestone rather than guessing.

Deliverables:

```text
result/task011-passive-runtime-observation.md
result/task011-runtime-events.csv
```

---

## Phase F — First materialization-event detection

For offline/static analysis, and for any passive runtime metadata that safely exposes the fact of a write/materialization, prioritize these events:

```text
E1: first write into Tail A 0x002CE000–0x007EA000
E2: first write to 0x005FC19F / 0x005FC1B0 / 0x005FC1C1
E3: first execute outside Tail B
E4: first newly executable private/image-like region
E5: first large deterministic transform after the probe cluster
```

For each observed event record:

- producer RVA;
- source range, if known;
- destination range;
- length;
- previous backing state;
- resulting classification;
- SHA-256 of a temporary generated block if available offline;
- confidence.

Do not commit generated code blobs.

Deliverable:

```text
result/task011-materialization-events.csv
```

---

## Phase G — MapleStory game-anchor scan

Only after a new deterministic materialized block or new stable region appears, scan that region for MapleStory anchors.

Task 002 crypto anchors:

```text
AES key prefix:
13 00 00 00 08 00 00 00 06 00 00 00 B4 00 00 00
1B 00 00 00 0F 00 00 00 33 00 00 00 52 00 00 00

IV table prefix:
EC 3F 77 A4 45 D0 71 BF B7 98 20 FC 4B E9 B3 E1

IV seed:
F2 53 50 C6
```

Other anchors:

```text
List.wz
.wz
WS2_32
WSAStartup
socket
connect
send
recv
```

C++/game-code indicators:

```text
MSVC RTTI / .?AV / .?AU
vtable-like pointer clusters
normal thiscall-like function groups
EH metadata
stable string/xref clusters
Ztl-related thunks
```

Record first-seen stage/region for every hit.

Deliverable:

```text
result/task011-game-anchor-hits.csv
```

---

## Phase H — Cross-version symbol correlation

If, and only if, game-like materialization evidence appears, begin limited correlation against:

```text
reference/maplestory-symbols/derived/cms079-correlation-seeds.csv
reference/maplestory-symbols/upstream/Bia10.Maple.Client.V95/
```

Do not use raw address translation between versions.

Require multiple evidence types before assigning a CMS079 symbol name:

1. behavior;
2. call-graph relationships;
3. constants/strings;
4. singleton access shape;
5. RTTI/vtable evidence;
6. field-layout plausibility.

Priority candidates:

```text
CClientSocket
CClientSocket::SendPacket
CInPacket
COutPacket
CWvsContext
CWvsApp
CLogin
SendLoginPacket
SetWorldInfo
```

Use confidence levels:

```text
confirmed
high
medium
low
unmatched
```

Do not mark a symbol confirmed from a single v95 address or a single similar string.

Deliverables, only if applicable:

```text
result/task011-symbol-correlation.csv
result/task011-symbol-correlation-notes.md
```

---

## Optional helper script

A new helper may be added:

```text
scripts/maple079_normal_path_analyze.py
```

Allowed functions:

- parse previously generated Tail B block;
- recover direct CFG around `0x00859780`;
- classify string/API references;
- emit CSV/JSON;
- scan newly materialized offline buffers for the known anchors;
- compare candidate CMS079 evidence against the reference seed table.

It must not:

- attach a debugger;
- patch target bytes;
- write target process memory;
- invent API results;
- choose anti-debug branches for execution.

---

## Minimum success criteria

Task 011 is complete when all of the following have a concrete answer:

1. main sample hash reconfirmed;
2. static normal-path CFG from `0x00859780` materially extended;
3. SIWVID and NTICE roles are confirmed or precisely left unresolved;
4. WinLicense probe/state cluster ordering is clearer than Task 010;
5. the first post-probe stage is identified, or a precise runtime-dependent blocker is established;
6. Tail A write status is known;
7. ZtlTaskMem write status is known;
8. first execute-outside-Tail-B status is known;
9. Maple crypto/WZ/Winsock/RTTI anchor status is known for any new materialized region;
10. any v95 symbol correlation is evidence-based and explicitly confidence-rated;
11. the next route is selected.

---

## Final route selection

Choose exactly one:

### Route A — Game materialization reached

Use when Tail A, ZtlTaskMem, or a strong game-like region appears.

Next task:

```text
Game Code Boundary & CClientSocket / CInPacket / COutPacket Recovery
```

### Route B — Post-probe materializer identified but not yet completed

Use when the first non-probe decode/materializer is structurally identified but game anchors are not yet present.

Next task:

```text
Post-Probe Materializer Reconstruction
```

### Route C — Normal path continues through more probes

Use when additional probes are confirmed and no non-probe stage is yet visible.

The report must name the next probe/blocker and its RVA.

### Route D — Natural runtime environment still blocks progress

Use when static analysis cannot resolve the next edge and the clean current host does not naturally progress far enough.

Next step should be passive compatibility/reference work, not anti-debug bypass.

---

## Expected outputs

Generate as many as applicable:

```text
result/09-normal-probe-path-materialization.md
result/task011-normal-path-baseline.md
result/normal-probe-path-cfg.csv
result/normal-probe-path-analysis.md
result/normal-probe-sequence.csv
result/probe-convergence-task011.md
result/first-post-probe-stage.md
result/task011-passive-runtime-observation.md
result/task011-runtime-events.csv
result/task011-materialization-events.csv
result/task011-game-anchor-hits.csv
result/task011-symbol-correlation.csv
result/task011-symbol-correlation-notes.md
```

Optional:

```text
scripts/maple079_normal_path_analyze.py
```

---

## Repository hygiene

Before committing:

```text
git status
git diff
```

Do not commit:

```text
.raw/
.work/
EXE/DLL/WZ
memory dumps
materialized binary blobs
unpacked executable
PDB/IDB leak binaries
pcap/etl/evtx
local usernames or private paths
credentials
```

Recommended commit message:

```text
Complete Task 011 normal probe path and materialization boundary
```

Then push normally. Do not force-push.
