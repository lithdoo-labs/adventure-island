# Task 009 — Protector API Resolver Reconstruction & Anti-Debug Boundary Mapping

## Objective

Continue from Task 008 without bypassing anti-debug behavior.

Task 008 reached a stable protector API-resolution stage and stopped when the generated code attempted an environment probe involving `CreateFileA("\\\\.\\SICE")`.

This task has two goals:

1. Fully reconstruct the protector-side API resolver and its resolved API table across `kernel32`, `user32`, `advapi32`, `ntdll`, and any additionally observed modules.
2. Precisely map the anti-debug / environment-probe boundary around the SoftICE device check, including both control-flow branches, without forcing either branch.

This task is analysis-only. It must not become an anti-debug bypass task.

---

## Current baseline

Client SHA-256:

`5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`

Known chain:

```text
EntryPoint RVA 0x009D8000
  -> T1 decode
  -> T2 aPLib-style depack
  -> stage-2 protector @ 0x0081C6C5
  -> locate kernel32 via GetLocalTime IAT
  -> in-place decode rounds
  -> export walker / API resolver
  -> LoadLibraryA / MessageBoxExA / GetLocalTime resolved
  -> USER32 / ADVAPI32 / NTDLL observed
  -> CreateFileA("\\.\SICE") probe
  -> Task 008 stop
```

Known protected region:

`Tail B = 0x00819000–0x00912000`

Still not materialized:

`Tail A = 0x002CE000–0x007EA000`

ZtlTaskMem slots:

```text
0x005FC19F
0x005FC1B0
0x005FC1C1
```

Current classification:

`protector runtime initialization / resolver stage`

Game image has not yet been reached.

---

## Hard boundaries

Do not:

- patch `MapleStory.exe`;
- patch the generated protector code;
- change conditional branches;
- force success/failure flags;
- fake `CreateFileA` results;
- fake absence/presence of SoftICE;
- hide a debugger;
- install anti-anti-debug plugins;
- modify PEB/TEB anti-debug fields;
- inject DLLs;
- hook the real process;
- disable Smart App Control, Code Integrity, Defender, or other OS protections;
- generate or commit an unpacked executable;
- commit generated binary blobs or process dumps.

All transient data must stay under:

`.work/task-009/`

---

## Phase A — Reproduce Task 008 natural replay

Re-run the existing offline path without shortcuts.

The replay must naturally reach the protector resolver stage from the previous known chain.

Record:

- client SHA-256;
- kernel32 disk SHA-256;
- observed kernel32 base;
- `GetLocalTime` VA/RVA;
- stage-2 materialized block hash;
- first resolver entry RVA;
- instruction count to the `CreateFileA("\\.\SICE")` boundary.

If Task 008 cannot be reproduced deterministically, fix replay reproducibility first and stop there.

Output:

`result/07-protector-resolver-antidebug.md`

---

## Phase B — Reconstruct the export walker exactly

Recover the resolver algorithm in full.

Document:

- resolver entry RVA;
- module-base input;
- API-name input;
- PE export directory traversal;
- `AddressOfFunctions` access;
- `AddressOfNames` access;
- `AddressOfNameOrdinals` access;
- string comparison routine;
- forwarder handling, if any;
- ordinal handling, if any;
- resolver return convention;
- failure convention;
- destination table writes.

Determine whether there is:

- one generic resolver used for all modules;
- one resolver per module;
- a generic walker plus thin wrappers.

Output:

`result/protector-export-walker.md`

`result/protector-resolver-cfg.csv`

---

## Phase C — Rebuild the protector API table

Trace every resolved API that can be recovered before the SoftICE probe boundary.

At minimum inspect calls associated with:

- `kernel32.dll`;
- `user32.dll`;
- `advapi32.dll`;
- `ntdll.dll`.

For every resolved API record:

- module;
- API name;
- resolver callsite RVA;
- resolved VA;
- destination slot RVA;
- first consumer RVA;
- call count before boundary;
- semantic category;
- confidence.

Useful semantic categories:

```text
module loading
memory management
file/device probing
process/thread inspection
registry
window/UI
exception handling
system information
anti-debug/environment probe
unknown
```

Output:

`result/protector-resolved-api-map.csv`

`result/protector-api-table-layout.md`

---

## Phase D — Identify module loading order

Recover the protector's module initialization sequence.

Track all calls that load or obtain module handles.

For each module, record:

- module name;
- acquisition method;
- caller RVA;
- observed or replayed base;
- subsequent APIs resolved from it.

Distinguish:

- modules already present in the process;
- modules loaded by the protector;
- modules only referenced by name but never loaded.

Output:

`result/protector-module-load-order.csv`

---

## Phase E — Map the SoftICE probe boundary

Precisely locate the code surrounding:

`CreateFileA("\\.\SICE")`

Recover:

- string address/RVA;
- function that constructs or references it;
- resolved `CreateFileA` slot;
- callsite RVA;
- all arguments;
- return-value check;
- branch instruction RVA;
- success-target RVA;
- failure-target RVA;
- resource cleanup, such as `CloseHandle`;
- subsequent control-flow on both branches.

Do not execute either branch by faking API return values.

Analyze both branches statically far enough to determine their immediate purpose.

Classify each branch as one of:

```text
continue protector initialization
show message / terminate
run additional probes
enter another decode stage
unknown
```

Output:

`result/softice-probe-boundary.md`

`result/softice-branch-cfg.csv`

---

## Phase F — Enumerate nearby anti-debug / environment probes

Search only the already materialized protector region and resolved API map for adjacent environment checks.

Examples of probe classes to identify, not bypass:

- device probes;
- debugger-related process/window names;
- debug object / debug port checks;
- `NtQueryInformationProcess` usage;
- timing checks;
- exception-behavior checks;
- system-driver or service checks;
- registry checks;
- window-class/title checks.

Do not assume any specific technique unless supported by code/data.

For each probe record:

- probe ID;
- caller RVA;
- API/primitive;
- probe target;
- return test;
- branch targets;
- downstream behavior;
- confidence.

Output:

`result/protector-environment-probes.csv`

`result/protector-probe-map.md`

---

## Phase G — Static branch convergence analysis

For the SoftICE check and any neighboring probes, determine whether branches later reconverge.

Important questions:

1. Does the no-device path continue toward another resolver/decode stage?
2. Does the device-present path immediately terminate?
3. Do both branches eventually converge?
4. Is there a shared error routine?
5. Is there a common message-box routine?
6. Does either branch reference Tail A, ZtlTaskMem, or another materializer?

Use static CFG analysis only.

Output:

`result/protector-probe-convergence.md`

---

## Phase H — Identify the next non-probe stage

After statically mapping the environment-probe cluster, identify the first meaningful stage beyond it.

Look for evidence of:

- another in-place decode round;
- a new decompressor;
- an import-table builder;
- relocation/fixup logic;
- Tail A writes;
- ZtlTaskMem writes;
- creation of a new executable region;
- RTTI / WZ / Winsock / Maple crypto anchors.

Do not execute a protected branch by faking anti-debug results.

The goal is to identify the next stage structurally, not to force entry into it.

Output:

`result/post-probe-next-stage.md`

---

## Phase I — Re-scan known anchors after any deterministic decode

Only if another decode transformation can be reproduced without bypassing a probe, scan its output for:

### Maple crypto

AES key:

```text
13 00 00 00 08 00 00 00 06 00 00 00 B4 00 00 00
1B 00 00 00 0F 00 00 00 33 00 00 00 52 00 00 00
```

IV table prefix:

`EC 3F 77 A4 45 D0 71 BF B7 98 20 FC 4B E9 B3 E1`

IV seed:

`F2 53 50 C6`

### Resource/network strings

```text
List.wz
.wz
WS2_32
WSAStartup
connect
send
recv
```

### C++/game-code indicators

- MSVC RTTI;
- vtable-like clusters;
- ordinary function prologues;
- readable game/resource strings;
- import-thunk-like clusters.

Output:

`result/task009-anchor-scan.csv`

---

## Phase J — Optional helper script

Create or extend:

`scripts/maple079_protector_resolver.py`

It may:

- parse the already materialized Task 008 block;
- identify export-walker patterns;
- reconstruct resolved API slots;
- generate module/API tables;
- identify `\\.\SICE` xrefs;
- emit branch CFG metadata.

It must not:

- attach to the real process;
- modify process memory;
- fake API results;
- patch branch instructions.

---

## Minimum success criteria

Task 009 succeeds if all of the following are answered:

1. Task 008 natural replay is reproducible.
2. Export walker is reconstructed.
3. Resolved API table layout is mapped.
4. At least the pre-probe API set is identified.
5. `CreateFileA("\\.\SICE")` callsite and argument construction are identified.
6. The return-value branch is mapped.
7. Both immediate branches are statically classified.
8. Nearby probe cluster is mapped or shown absent.
9. The next meaningful post-probe stage is identified structurally, or a precise blocker is documented.
10. Tail A / ZtlTaskMem / crypto / WZ / network status is explicitly reported.

---

## Final route

Choose exactly one:

### Route A — Post-probe stage structurally identified

Use when static analysis identifies the next materializer/resolver/decode stage clearly enough for a new task without bypassing a probe.

### Route B — Probe cluster fully mapped, runtime-dependent boundary remains

Use when anti-debug/environment checks are understood but no further deterministic stage can be reached without real runtime state.

### Route C — Game-image evidence appears

Use only if a deterministic non-bypass transform exposes Tail A, ZtlTaskMem, RTTI/WZ, crypto, or Winsock/game-like code.

### Route D — Resolver reconstruction incomplete

Use when the resolver/API-table model itself remains uncertain.

---

## Expected outputs

At minimum:

```text
result/07-protector-resolver-antidebug.md
result/protector-export-walker.md
result/protector-resolver-cfg.csv
result/protector-resolved-api-map.csv
result/protector-api-table-layout.md
result/protector-module-load-order.csv
result/softice-probe-boundary.md
result/softice-branch-cfg.csv
result/protector-environment-probes.csv
result/protector-probe-map.md
result/protector-probe-convergence.md
result/post-probe-next-stage.md
result/task009-anchor-scan.csv
```

Optional:

`scripts/maple079_protector_resolver.py`

---

## Commit hygiene

Before commit:

```text
git status
git diff
```

Do not commit:

- `.raw/`;
- `.work/`;
- EXE/DLL/WZ;
- memory dumps;
- generated/decrypted binary blobs;
- unpacked executables;
- PCAP/ETL/EVTX;
- debugger databases;
- local user paths;
- credentials.

Suggested commit message:

`Complete Task 009 protector resolver and anti-debug boundary mapping`

Then:

`git push`

Do not force-push.
