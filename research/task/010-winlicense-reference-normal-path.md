# Task 010 — WinLicense / Protector Reference Correlation & Normal-Environment Path Identification

## Objective

Task 009 recovered the protector export walker, API resolver, `CreateFileA("\\\\.\\SICE")` probe, adjacent `\\\\.\\SIWVID` / `\\\\.\\NTICE` strings, and the `HKCU\\Software\\WinLicense` registry cluster. The current execution boundary is runtime-dependent: the `CreateFileA` result selects a branch, and the research workflow must not invent that result.

This task must identify the intended normal-environment path by combining public/reference evidence, static control-flow correlation, and passive observation on a clean system. The goal is not to bypass anti-debug logic. The goal is to answer, with evidence, what these probes mean and which path naturally occurs on an ordinary system that does not contain the historical debugger/driver targets.

## Known baseline

Client SHA-256:

`5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`

Task 009 facts:

- Generic export walker: RVA `0x0081CF01`
- Shared wrapper: RVA `0x00821750`
- Resolved APIs include `LoadLibraryA`, `GetLocalTime`, `CreateFileA`, `MessageBoxExA`
- `CreateFileA("\\\\.\\SICE")` callsite: RVA `0x00859757`
- String RVA: `0x00859507`
- Return test: `inc eax ; jne 0x00859A61` at RVA `0x00859779`
- `INVALID_HANDLE_VALUE` falls through to `0x00859780`
- Valid handle branches to `0x00859A61`
- Additional device-name strings: `\\\\.\\SIWVID` at `0x00859882`, `\\\\.\\NTICE` at `0x008599BF`
- Registry cluster includes `HKCU\\Software\\WinLicense` and WinLicense-related value names
- Tail A `0x002CE000–0x007EA000` is still unwritten
- ZtlTaskMem slots remain unwritten
- No WZ / Maple crypto / Winsock anchors have appeared

## Safety and scope constraints

Do not:

- patch the client or materialized protector code
- alter the `CreateFileA` return value
- force ZF/CF or branch targets
- hide a debugger or install anti-anti-debug plugins
- create fake SoftICE/SIWVID/NTICE device objects
- alter PEB/TEB debugger-related state
- hook the target process
- inject DLLs
- disable Smart App Control, Code Integrity, Defender, or other security controls
- create an unpacked executable
- dump the full process memory

Passive observation of the process and operating system is allowed. Public-reference research and static comparison are allowed. Temporary artifacts belong under `.work/task-010/` and must not be committed.

## Phase A — Public/reference research

Research historical and technical references for the following indicators:

- `\\\\.\\SICE`
- `\\\\.\\SIWVID`
- `\\\\.\\NTICE`
- `HKCU\\Software\\WinLicense`
- `WinLicenseVersion`
- `WinLicenseDriverVersion`
- `WinLicenseInstance`
- `CheckIN`, `CheckOUT`, `XprotExit`, `ExitOk`, `ProcIN`, `ProcOUT`, `ExitIN`, `ExitOUT`, `ExpInfo`, `Software\\WLkt`

Prefer primary or technically credible sources: archived vendor documentation, public source code, academic/technical write-ups, old SDK/docs, public malware-analysis reports only when they quote exact strings/structures, and public sample metadata when legally accessible.

For every source record:

- URL
- title
- publication/archive date if available
- exact indicator matched
- product/family attribution claimed by source
- whether the evidence is direct or secondary
- confidence

Do not treat search-engine snippets as evidence.

Generate:

- `result/winlicense-reference-index.md`
- `result/protector-reference-indicators.csv`

## Phase B — Attribution matrix

Build an evidence matrix comparing this sample against candidate protector families. At minimum consider whether the evidence supports or contradicts:

- WinLicense
- Themida
- XProtector / related Oreans lineage
- generic custom protector

Do not choose a family based on one string alone.

Compare:

- device names
- registry paths
- export resolver shape
- aPLib-like stage
- section layout
- self-modifying rounds
- API-loading behavior
- WinLicense value names
- historical date compatibility with CMS079-era software

Use verdicts:

- confirmed
- probable
- possible
- unsupported
- contradicted

Generate:

- `result/protector-attribution-matrix.csv`
- `result/protector-attribution.md`

## Phase C — Normal Windows semantics

Document the ordinary Windows semantics of:

`CreateFileA("\\\\.\\SICE", GENERIC_READ|GENERIC_WRITE, 3, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL)`

On a clean system with no corresponding device object, determine from Windows API semantics what return value is expected and what error state is normally produced.

This is documentation/correlation, not a request to synthesize that result inside the emulator.

Do the same for the expected meaning of the SIWVID and NTICE device names if reliable public references exist.

Generate:

- `result/device-probe-normal-semantics.md`

## Phase D — Passive clean-environment observation

On the current clean system, without attaching a debugger and without changing the process:

1. Verify whether the following device names exist from the operating-system side, using read-only/non-invasive system inspection where possible:
   - `\\\\.\\SICE`
   - `\\\\.\\SIWVID`
   - `\\\\.\\NTICE`
2. Record whether corresponding drivers/services are present.
3. Record relevant WinLicense registry keys if they already exist; do not create or delete them.
4. Record loaded driver/module metadata only; do not dump driver memory.

If a direct device-open test is used, it must be performed by a separate benign helper process, not by altering MapleStory or its emulator. The helper should simply call the documented Windows API and report success/failure and `GetLastError`. It must not create devices or install drivers.

If implemented, place helper source under `scripts/` but binaries under `.work/task-010/` only.

Generate:

- `result/normal-environment-probe-observation.md`
- `result/normal-environment-state.csv`

## Phase E — Static branch semantics

Revisit the Task 009 CFG and classify the branch behavior using evidence from Phases A–D.

For the SICE test:

- device absent path: `0x00859780`
- device present path: `0x00859A61`

Do not execute a synthetic branch. Instead determine whether public/reference behavior and clean-system observations support one edge as the normal path.

Apply the same reasoning to the SIWVID / NTICE sequence where possible.

For each branch provide:

- condition
- expected real-world condition
- evidence
- likely semantic role
- confidence

Generate:

- `result/probe-normal-path-correlation.csv`
- `result/probe-normal-path-analysis.md`

## Phase F — Registry cluster interpretation

Statically analyze the WinLicense registry cluster in the materialized Tail B code.

Identify, where possible:

- registry root
- key path
- value names
- read/write intent from call shape
- whether the cluster appears to inspect installation/runtime state, licensing state, process state, or anti-debug state
- callsites and unresolved API slots

Do not invent unresolved API names. If a call target is not identified, keep it unresolved and record the argument pattern.

Generate:

- `result/winlicense-registry-cluster.md`
- `result/winlicense-registry-calls.csv`

## Phase G — Reference-code / CFG correlation

If public reference code or disassembly for a matching WinLicense/Oreans-era probe sequence is available, compare only structural features:

- device probe order
- return-value test shape
- registry path/value order
- resolver behavior
- next-stage transition

Do not import or execute third-party bypass/crack code.

If a high-confidence reference indicates the normal no-device path eventually reaches a specific class of stage (for example further probes, initialization, decode, relocation, or application handoff), record that only as reference-supported expectation, not as an observed fact in this client.

Generate:

- `result/reference-cfg-correlation.md`

## Phase H — Determine the next legitimate research path

Choose one route:

### Route A — Normal path identified with high confidence

Requirements:

- clean-system state shows no historical debugger devices
- Windows API semantics predict `INVALID_HANDLE_VALUE`
- static branch mapping shows that value corresponds to a specific edge
- public/reference evidence agrees that this edge is the normal environment path

Next task should focus on static/reference correlation farther down that normal path, or on observing it naturally in a compatible environment. Do not force the emulator branch.

### Route B — Protector family identified, normal path still uncertain

Continue reference comparison before any deeper emulation.

### Route C — Normal path is clear, but the current OS/client cannot naturally reach it

Use a compatibility VM / reference sample strategy, not anti-debug bypass.

### Route D — Attribution and path both unresolved

Document the blockers and stop.

## Minimum success criteria

Task 010 is complete only if it provides:

- a public/reference index for all major indicators
- a reasoned protector-family attribution with confidence
- documented normal Windows semantics for the SICE `CreateFileA` call
- passive clean-system observation for the three device names / related state
- a branch-by-branch normal-path correlation
- interpretation of the WinLicense registry cluster
- a clear Route A/B/C/D recommendation

## Expected outputs

Create as many of the following as evidence supports:

- `result/08-winlicense-reference-normal-path.md`
- `result/winlicense-reference-index.md`
- `result/protector-reference-indicators.csv`
- `result/protector-attribution-matrix.csv`
- `result/protector-attribution.md`
- `result/device-probe-normal-semantics.md`
- `result/normal-environment-probe-observation.md`
- `result/normal-environment-state.csv`
- `result/probe-normal-path-correlation.csv`
- `result/probe-normal-path-analysis.md`
- `result/winlicense-registry-cluster.md`
- `result/winlicense-registry-calls.csv`
- `result/reference-cfg-correlation.md`

Optional:

- `scripts/device_probe_observer.c` or equivalent benign helper source

Do not commit compiled helper binaries.

## Final report

The final summary must state:

- client SHA-256
- strongest protector attribution and confidence
- strongest public-reference matches
- meaning of SICE / SIWVID / NTICE according to evidence
- normal `CreateFileA("\\\\.\\SICE")` result on a clean system
- clean-system observation result
- whether WinLicense registry state exists locally
- SICE normal branch target
- confidence that the no-device branch is the intended normal path
- interpretation of the WinLicense registry cluster
- whether any post-probe game-stage evidence was found by static/reference correlation
- Route A/B/C/D
- generated files
- commit SHA
- push status
- blockers

Before committing, run `git status` and `git diff`. Confirm `.raw/`, `.work/`, binaries, dumps, archives, private paths, credentials, and machine-specific sensitive data are not committed.

Suggested commit message:

`Complete Task 010 WinLicense reference and normal-path correlation`

Push normally. Do not force-push.
