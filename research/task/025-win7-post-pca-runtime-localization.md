# Task 025 — Win7 Post-PCA Runtime Localization / Exploratory Observation

## 0. Purpose

Continue from the completed Win7 x64 RTM and Win7 x86 SP1 natural-runtime observations and answer a narrower but more important question:

> After Program Compatibility Assistant allows `MapleStory.exe` to continue, where is the process actually spending time, and which runtime boundary prevents it from reaching PCOM/NameSpace/Winsock/game startup?

This is a **long exploratory observation task**. It deliberately combines several low-risk evidence channels instead of betting on one technique.

Primary goals:

1. Close the missing launch-argument control variable by comparing the bare executable against the package's own launcher form `MapleStory.exe 127.0.0.1 9555`.
2. Determine whether Program Compatibility Assistant is merely the first visible event or the true execution blocker.
3. Build a time-resolved module/process/thread/file/registry/network timeline after the user selects “Run program”.
4. Determine whether the surviving CPU-active process is spinning in MapleStory/protector code, waiting on Windows/appcompat, or repeatedly touching some external dependency.
5. Correlate passive runtime observations with the protector stages already reconstructed statically, without dumping or patching protected code.
6. Establish a defensible next boundary: launch contract, appcompat, protector runtime, missing dependency, service/driver, or game-runtime transition.
7. Only if the client naturally reaches Winsock, test controlled private-network connection behavior to port 9555.

This is **not** an anti-debug bypass, unpacking, anti-cheat bypass, or memory-dumping task.

---

## 0.1 Current evidence and hypotheses

Read these as evidence, not assumptions:

- Win7 x64 RTM (`6.1.7600`) naturally starts the canonical client but shows Program Compatibility Assistant and never loads `PCOM.dll`, `NameSpace.dll`, `Canvas.dll`, `ZLZ.dll`, or `ws2_32.dll` during the recorded window.
- Win7 x86 SP1 (`6.1.7601`) shows the same visible compatibility warning and the same broad early module state.
- On both systems, after choosing “Run program”, the process remains alive and accumulates CPU time for more than a minute.
- `apphelp.dll` is loaded in both environments.
- Neither Win7 observation saw `HSUpdate.exe`, `ASPLnchr.exe`, `ehsvc.dll`, or `AspINet.dll` during the recorded window.
- Neither Win7 observation saw persistent Oreans/SoftICE services or files appear.
- No observation has yet shown `ws2_32.dll` in MapleStory on Win7.
- The previous Win7 runs launched `MapleStory.exe` without the package's known server arguments.
- The client package contains `单机登陆器.bat` with the launch contract `MapleStory.exe 127.0.0.1 9555`.

Hypotheses to test:

- H1: missing launch arguments cause or materially change the early runtime path.
- H2: PCA is only a visible compatibility notification; the real stall is in MapleStory/protector code after the user chooses “Run program”.
- H3: the process is repeatedly executing a hot user-mode loop rather than waiting passively.
- H4: the stall is associated with a repeated file/registry/service/device lookup that can be observed without debugging.
- H5: the stall occurs before the transition to Wizet game runtime (`PCOM` / `NameSpace`) and before Winsock.
- H6: Win7 x86 and x64 will remain behaviorally equivalent once launch arguments are controlled.

Do not normalize evidence to fit these hypotheses. A contradictory result is valuable.

---

## 0.2 Repository synchronization gate

Start from a clean, current `origin/main`.

From the repository root:

```text
git status --short
git branch --show-current
git remote -v
git rev-parse HEAD
```

If tracked/uncommitted changes exist, stop. Do not stash, reset, restore, rebase, or overwrite user changes.

Then:

```text
git fetch origin
```

If clean and not on `main`, switch to `main`, then:

```text
git pull --ff-only origin main
git rev-parse HEAD
```

Record that SHA as `STARTING_HEAD`.

If fast-forward is not possible, stop and report the repository-state blocker.

---

## 0.3 Directory and artifact contract

Use these directory roles:

```text
.raw/
    read-only proprietary inputs

task/
    task specifications

.work/task-025/
    all scratch data, copied guest logs, temporary traces, helper output,
    VM-side exports, Procmon PML/CSV, screenshots, temporary network captures,
    and one-off helper scripts

result/
    all permanent Task 025 findings to commit

scripts/
    only reusable project-owned observation/canonicalization scripts

glm-work/
    read-only prior research reference; do not place Task 025 final outputs here
```

Recommended scratch layout:

```text
.work/task-025/
├── baseline/
├── guest/
├── runs/
│   ├── A-bare/
│   ├── B-loopback-9555/
│   ├── C-batch/
│   ├── D-private-host/
│   └── repeats/
├── procmon/
├── appcompat/
├── threads/
├── modules/
├── events/
├── network/
└── logs/
```

Do not commit PML, EVTX, ETL, PCAP, executable binaries, DLL/SYS/VXD files, process dumps, screenshots containing private host details, VM disks, or third-party tools.

---

## 1. Mandatory reading before execution

After synchronization, read at least:

```text
README.md
result/02-runtime-network-bootstrap.md
result/03-compatibility-passive-capture.md
result/04-static-loader-dataflow.md
result/05-stage2-pe-scan-correlation.md
result/06-stage2-inplace-decode.md
result/07-protector-resolver-antidebug.md
result/08-winlicense-reference-normal-path.md
result/09-probe-cluster-full-cfg.md
result/09-normal-probe-path-materialization.md
result/10-post-probe-stage.md
result/10b-static-extension.md
result/24-win7-x64-natural-runtime.md
result/24-win7-x86-sp1-natural-runtime.md
```

Also read the latest Task 012/012c result files that describe the `0x862000+` mixed encoded/plaintext region and decoder-C search boundary.

Reconfirm the canonical executable SHA-256:

```text
5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d
```

Do not reuse prior RVA/protector conclusions if the guest executable hash differs.

---

## 2. Preferred environment

Use the existing Win7 x86 SP1 VM as the primary experimental environment because it is the closest available native 32-bit baseline:

```text
Windows 7 Professional SP1
6.1.7601
x86
```

Do not rebuild the OS if the existing guest is intact.

Use the existing Win7 x64 RTM result as a comparison baseline. Re-run x64 only if a specific Task 025 observation requires a controlled comparison and doing so is low-cost.

Keep networking disconnected for Phases A–C until the task explicitly reaches the private-network stage.

Do not install a new hypervisor if the existing QEMU path is still usable.

---

## 3. Guest-state gate

Before any Task 025 run, record the guest state:

```text
OS build / service pack
architecture
computer name
system time
firewall profiles
network adapters
MapleStory.exe SHA-256
relevant services/drivers
relevant registry keys
```

Relevant names include:

```text
SICE
SIWVID
NTICE
oreans32
oreansx64
ehsvc
WinLicense
WLkt
Wine
```

Do read-only queries. Do not create missing keys/services/devices.

If the VM is not in a reproducible clean state, restore the existing clean snapshot rather than manually deleting artifacts one by one.

Record the snapshot/checkpoint identity used for every run.

---

## 4. Experimental principle: one variable at a time

Every launch experiment must record:

```text
run_id
snapshot/base state
exact command line
working directory
network state
firewall state
PCA interaction
instrumentation enabled
start time
PID / parent PID
end time or sample cutoff
exit code if available
```

Do not change launch arguments, network, instrumentation, compatibility settings, and system state simultaneously.

At least two repeats are required for any surprising result before calling it reproducible.

---

## 5. Phase A — Launch-contract matrix, no network

Run the following variants from the same clean x86 SP1 guest state, with the guest NIC disconnected.

### A1 — bare executable

```text
F:\MapleStory.exe
```

This reproduces the previous observation.

### A2 — explicit loopback/server arguments

```text
F:\MapleStory.exe 127.0.0.1 9555
```

There is intentionally no server listening on guest loopback in this phase.

The purpose is to isolate **argument parsing / startup-path selection**, not successful networking.

### A3 — execute the package launcher batch

Run the original `单机登陆器.bat` if the exact file is available in the copied client tree and confirm its SHA/content before execution.

Record the command line actually observed for MapleStory.

Do not edit the batch file.

### A4 — exact executable with only IP argument

Optional diagnostic only if A1/A2 differ:

```text
F:\MapleStory.exe 127.0.0.1
```

Use this only to understand argument arity. Do not turn this into broad fuzzing.

For every variant, after PCA appears, choose the same ordinary `Run program` option and continue observation for a fixed window, preferably at least 120 seconds unless the process exits sooner.

Do not suppress PCA in this phase.

---

## 6. Required Phase-A comparison

For A1/A2/A3 compare:

```text
PCA appears?
PCA event time
MapleStory survives after Run program?
CPU time at 10/30/60/120 seconds
working set at 10/30/60/120 seconds
thread count
module set and first-seen time
child processes
window classes/titles
file activity summary
registry activity summary
service/driver side effects
ws2_32 loaded?
PCOM loaded?
NameSpace loaded?
HSUpdate spawned?
```

The central Task 025 question is whether A2/A3 cause any meaningful divergence from A1.

Generate:

```text
result/task025-launch-matrix.csv
```

---

## 7. Phase B — PCA / AppCompat attribution, read-only

Do not treat Program Compatibility Assistant as the root cause merely because it is visible.

Collect read-only evidence about why Windows flags this executable:

- Application log entries from `Microsoft-Windows-ApplicationExperienceInfrastructure`.
- Relevant `AppCompatFlags` registry values.
- Existing compatibility database metadata that can be queried with built-in Windows tools.
- `apphelp.dll` module presence and timing.
- EXE version/product/company/signature metadata.

If built-in `sdb` query tools are present, use them read-only. Do not install, remove, patch, or disable compatibility databases.

Do not set compatibility layers such as `WINXPSP3`, do not write `AppCompatFlags\Layers`, and do not suppress PCA in the main evidence runs.

Questions to answer:

1. Is the warning tied to executable identity/name/version metadata?
2. Does it appear identically for A1/A2/A3?
3. Does MapleStory continue executing after PCA releases control?
4. Is `apphelp.dll` still present long after the warning is dismissed?

Generate:

```text
result/task025-appcompat-evidence.md
```

---

## 8. Phase C — Thread activity characterization without debugger

The previous runs show a process alive for >1 minute with increasing CPU time. Characterize that state without attaching a debugger and without reading process memory.

Use built-in or ordinary process APIs to sample threads periodically.

Preferred fields per sample:

```text
timestamp
run_id
pid
thread_id
thread_state
wait_reason if available
user_processor_time
kernel_processor_time
total_processor_time
start_address if the normal API exposes it
priority/current priority if available
```

Sampling interval should be coarse enough to avoid materially perturbing the target, e.g. once per second or once per 2–5 seconds.

Do not suspend/resume threads. Do not call `GetThreadContext`, do not change thread priorities, and do not inspect stack memory.

If `.NET ProcessThread.StartAddress` is available and returns a valid address, classify it only by containing module/range using normal module enumeration:

```text
MapleStory image
ntdll/kernel32/etc.
unknown mapped region
```

Do not dereference the address or dump its bytes.

Determine:

- how many threads exist;
- whether one thread consumes nearly all CPU;
- whether CPU usage is user time or kernel time;
- whether thread count changes over time;
- whether the hot thread start address is inside MapleStory or a Windows DLL;
- whether the process is mostly running or waiting.

Generate:

```text
result/task025-thread-activity.csv
result/task025-thread-summary.md
```

---

## 9. Phase D — Time-resolved module timeline

Previous results only gave module snapshots. Build a module timeline.

Poll the MapleStory process periodically and record first/last seen times for modules.

At minimum track:

```text
apphelp.dll
winmm.dll
advapi32.dll
ws2_32.dll
wininet.dll
crypt32.dll
PCOM.dll
NameSpace.dll
Canvas.dll
ResMan.dll
ZLZ.dll
Gr2D_DX8.dll
Sound_DX8.dll
ehsvc.dll
AspINet.dll
```

Also record any new non-system DLL that appears unexpectedly.

Fields:

```text
run_id
timestamp
pid
module_name
normalized_path
base_address if available
module_size
first_seen
last_seen
```

Do not read module contents from process memory.

Generate:

```text
result/task025-module-timeline.csv
```

---

## 10. Phase E — Process and window timeline

Poll process tree and top-level windows.

Track:

```text
MapleStory.exe
HSUpdate.exe
ASPLnchr.exe
any HShield process
consent.exe / PCA UI process where relevant
unexpected child processes
```

For windows, record only:

```text
timestamp
PID
class
title
visible?
```

Do not automate hidden UI controls beyond what is required to click the normal `Run program` choice consistently.

Generate:

```text
result/task025-process-window-timeline.csv
```

---

## 11. Phase F — Passive filesystem/registry/process tracing

Only after A1/A2/A3 have been run once without Procmon, use a passive file/registry/process tracer for a second controlled series.

Preferred tool if already available or obtainable from the official Microsoft Sysinternals source:

```text
Process Monitor
```

If Procmon must be obtained, record exact source URL/version/hash in `.work/task-025/` notes; do not commit the binary.

Do not install arbitrary third-party hooks/drivers.

Filters should minimize noise and focus on MapleStory and its children.

Capture categories:

```text
Process/Thread
File System
Registry
```

Network activity may be recorded if the tool naturally provides it, but do not depend on Procmon for packet contents.

Do not use stack capture if it requires invasive configuration or significantly changes behavior.

Raw `.PML` remains under `.work/task-025/procmon/` and is never committed.

Export a filtered CSV or summarize events into safe project-owned CSVs.

---

## 12. Repetition / hot-failure analysis

For each major run, aggregate repeated operations by:

```text
operation
path/key/object
result/status
count
first_time
last_time
rate per second
```

High-value patterns include repeated:

```text
NAME NOT FOUND
PATH NOT FOUND
ACCESS DENIED
BAD NETWORK PATH
BUFFER OVERFLOW / retry patterns
registry key probes
CreateFile attempts on device names
DLL search loops
```

Do not assume a frequent failed lookup is causal. Correlate event timing with CPU/thread/module state.

Generate:

```text
result/task025-repeated-operations.csv
```

The final report should identify the top repeated missing/failed dependencies, if any.

---

## 13. SoftICE / Oreans / WinLicense passive evidence

Specifically look for natural accesses to known strings/objects already derived statically:

```text
\\.\SICE
\\.\SIWVID
\\.\NTICE
\\.\Oreans.vxd
oreans32.sys
oreansx64.sys
XprotEvent
HKCU\Software\WinLicense
Software\WLkt
HKCU\Software\Wine
```

Record only observed file/registry/device/service events.

Do not create the objects. Do not alter return values. Do not create fake registry keys. Do not install fake drivers.

If none are observed, say so explicitly and do not infer that the static code did or did not execute unless the observation channel would necessarily have seen it.

Generate relevant rows in:

```text
result/task025-protector-runtime-events.csv
```

---

## 14. Static/runtime correlation without process-memory reads

Correlate runtime evidence with prior static findings only at a high level.

Allowed correlations:

- module-load phase vs expected protector/game boundary;
- device/registry names vs known static protector strings;
- thread start address falling inside the mapped MapleStory image vs system DLL;
- service/driver/file names vs already documented Oreans stage;
- first `ws2_32.dll` load vs transition toward game network runtime.

Do not infer exact current EIP/RVA from thread start address.

Do not use `ReadProcessMemory`, process dumps, mini-dumps, debugger attach, hardware breakpoints, VEH hooks, injected DLLs, API hooks, or branch patches.

The purpose is to identify **which known subsystem boundary has or has not been crossed**, not to deprotect the executable.

Generate:

```text
result/task025-static-runtime-correlation.md
```

---

## 15. Optional Phase G — CPU-affinity / repeatability diagnostic

Only if behavior is highly timing-sensitive and the existing QEMU TCG configuration shows inconsistent runs, a single diagnostic comparison may pin the VM to one virtual CPU or use the same existing vCPU count consistently.

Do not change CPU model, OS, RAM, and command line simultaneously.

This is for repeatability only, not for bypassing timing checks.

Do not attempt to spoof `RDTSC`, CPUID, hypervisor flags, or timing APIs.

---

## 16. Decision gate before any network test

Do **not** set up a private game server merely because Task 025 includes a network phase.

Proceed to networking only if at least one launch variant naturally shows one or more of:

```text
ws2_32.dll loaded by MapleStory
connect-related file/network event
socket visible in netstat
PCOM/NameSpace/game runtime modules loaded
```

If no such evidence appears, skip the network phase and state why.

---

## 17. Phase H — controlled private 9555 test, only after gate

If the network gate is met, use a private/internal/host-only network only.

No bridged/public Internet.

Use the known server topology:

```text
login:    9555
channels: 7575–7578
cashshop: 8600
```

Prefer running the existing Java server on the host/private side rather than installing extra runtimes into the clean Win7 guest.

Test two launch forms separately:

```text
MapleStory.exe 127.0.0.1 9555
```

and, only when a host-only private address is required:

```text
MapleStory.exe <PRIVATE_HOST_IP> 9555
```

Understand that guest `127.0.0.1` addresses the guest itself; do not conflate it with the host.

For each network run record:

```text
exact command line
private topology
server listen status
client PID
ws2_32 first_seen
SYN / connect attempt
ESTABLISHED if any
server accept timestamp
whether a 15-byte v79 handshake is sent by the server
whether the client closes immediately or continues
channel/cashshop attempts
```

Packet captures, if used, stay under `.work/task-025/network/` and are not committed.

Do not require packet decryption for Task 025 success.

Generate:

```text
result/task025-network-observations.csv
```

---

## 18. AppCompat is not to be bypassed in this task

Do not:

```text
remove compatibility database entries
set custom compatibility flags to suppress PCA
disable Application Experience service to evade the warning
rename/patch the executable to avoid matching
modify version resources
modify manifests
```

Task 025 is about locating the natural post-PCA runtime state.

If read-only evidence shows that PCA merely warns and releases the process, document that. If evidence shows the process is genuinely blocked waiting on the compatibility subsystem, document that instead.

---

## 19. Instrumentation-effect control

Because Procmon and repeated polling can perturb old protected software, compare at least one no-instrumentation baseline to an instrumented run.

If enabling Procmon changes:

```text
process lifetime
CPU pattern
module set
window behavior
child processes
```

mark the trace as potentially observer-affected.

Do not escalate to stealth/hiding techniques.

If the target behaves differently under instrumentation, that difference itself is the result.

---

## 20. Required timeline normalization

Normalize timestamps within each run to:

```text
t0 = MapleStory process creation
```

Important relative events:

```text
PCA dialog shown
Run program selected
first CPU sample
first module sample
first non-system module
first repeated failed object access
first protector-related object access
first child process
first PCOM
first NameSpace
first ws2_32
first socket
process exit / sample cutoff
```

This makes A1/A2/A3 directly comparable despite different wall-clock times.

Generate:

```text
result/task025-event-timeline.csv
```

---

## 21. Required interpretation categories

Every important observation should be labeled as one of:

```text
confirmed-runtime
observed-side-effect
static-only
probable
possible
not-observed
unknown
observer-affected
```

Examples:

- `ws2_32.dll` in module list = confirmed-runtime.
- `oreansx64.sys` string in static decoded bytes = static-only.
- repeated `CreateFile` for a missing path in Procmon = observed-side-effect.
- a hot thread whose start address lies in MapleStory image = confirmed runtime location at image granularity, but not proof of current instruction pointer.

---

## 22. Required output files

Produce as many as applicable:

```text
result/25-win7-post-pca-runtime-localization.md
result/task025-launch-matrix.csv
result/task025-appcompat-evidence.md
result/task025-thread-activity.csv
result/task025-thread-summary.md
result/task025-module-timeline.csv
result/task025-process-window-timeline.csv
result/task025-repeated-operations.csv
result/task025-protector-runtime-events.csv
result/task025-static-runtime-correlation.md
result/task025-event-timeline.csv
result/task025-network-observations.csv      # only if network phase is reached
```

Optional reusable helper:

```text
scripts/maple079_runtime_observe.ps1
```

If a helper is specific to the VM or one-off Procmon invocation, keep it in `.work/task-025/` instead of `scripts/`.

---

## 23. Main questions the final report must answer

The final report must explicitly answer:

1. Does `MapleStory.exe 127.0.0.1 9555` behave differently from bare `MapleStory.exe`?
2. Does the original batch launcher behave differently from directly entering the same command line?
3. Is PCA only a warning, or is there evidence it remains causally involved after `Run program`?
4. Which thread consumes CPU after PCA, and is it MapleStory-image-side or system-DLL-side at coarse granularity?
5. Is the process running, waiting, or alternating between both?
6. Does thread count change over time?
7. Which modules appear after t0, and does the process ever cross into PCOM/NameSpace/Winsock?
8. Are there repeated failed file/registry/object lookups correlated with the CPU loop?
9. Are SoftICE/Oreans/WinLicense object accesses actually observed at runtime?
10. Does instrumentation change behavior?
11. What is the earliest defensible runtime boundary after PCA?
12. Is the blocker more consistent with launch contract, appcompat, protector, external dependency, driver/service, or game runtime?
13. Is there enough evidence to justify another dynamic compatibility experiment, or should work return to static/reference correlation?

---

## 24. Route classification

Choose exactly one final route.

### Route A — Launch contract changes progression

A2/A3 materially advance beyond A1, for example by loading PCOM/NameSpace/Winsock or changing the dominant runtime path.

Next work should focus on the correct launch contract and controlled private networking.

### Route B — Natural protector/runtime hot loop localized

A1/A2/A3 are equivalent, but passive observation localizes a reproducible CPU-active stage or repeated dependency/object access inside the MapleStory/protector phase.

Next work should correlate that stage with the existing static decoder/protector map without bypassing it.

### Route C — AppCompat remains causally dominant

Evidence shows that after the user selects `Run program`, the process is still blocked by or repeatedly interacting with the compatibility subsystem in a way that explains lack of progression.

Next work should be appcompat/reference research, not protector bypass.

### Route D — External dependency/service blocker

A reproducible missing DLL/file/registry/service/driver dependency explains the stall.

Next work should characterize the dependency and historical environment requirements. Do not fabricate the dependency merely to force progression.

### Route E — Natural game/network transition reached

The process naturally loads PCOM/NameSpace/Winsock and/or attempts 9555.

Next work should move to controlled protocol/bootstrap observation.

### Route F — No reliable localization

Results remain noisy/inconclusive or instrumentation changes behavior too much.

Document the uncertainty and return to static/reference analysis rather than escalating to invasive techniques.

---

## 25. Minimum success criteria

Task 025 is complete when all of these are true:

1. Repository synchronization and `STARTING_HEAD` are recorded.
2. Win7 x86 SP1 guest/sample identity is revalidated.
3. A1/A2/A3 are executed from controlled equivalent states.
4. Launch-argument behavior is compared directly.
5. PCA/AppCompat evidence is collected read-only.
6. Thread activity is sampled without debugger/thread suspension.
7. A module timeline is produced.
8. A process/window timeline is produced.
9. At least one no-Procmon run and one passive traced run are compared, if Procmon is practical.
10. Repeated file/registry/process events are summarized, if tracing is practical.
11. Protector-related objects are searched for in passive evidence.
12. Static/runtime correlation is written without process-memory reads.
13. Network testing is either performed after the gate or explicitly skipped because the gate was not met.
14. A single Route A–F is selected.
15. The report identifies the earliest defensible post-PCA runtime boundary and the strongest remaining uncertainty.

---

## 26. Safety / integrity boundaries

Do not perform any of the following:

```text
debugger attach
anti-debug bypass
branch patching
return-value spoofing
API hooking/injection
DLL injection
process-memory dumping
ReadProcessMemory-based code extraction
thread suspension/context hijacking
hardware breakpoints
PEB/debug-flag manipulation
SoftICE/Oreans fake-device creation
driver-signature bypass
test-signing enablement
kernel patching
hypervisor concealment
RDTSC/CPUID spoofing
anti-VM evasion
```

If progress would require one of these, stop and classify the route accordingly.

---

## 27. Commit hygiene

Before committing:

```text
git status --short
git diff
git diff --cached
```

Commit only permanent project-owned findings/scripts.

Do not commit:

```text
.raw/
.work/
ISO/WIM/VHD/QCOW2
EXE/DLL/SYS/VXD
PML/EVTX/ETL/PCAP
process dumps
screenshots with private environment details
third-party binaries
large raw CSV/event dumps that belong in .work
```

Suggested completion commit:

```text
Complete Task 025 Win7 post-PCA runtime localization
```

Push normally to `origin/main`. Do not force-push.

If `origin/main` advances and push is rejected, fetch and report the divergence instead of rewriting history automatically.

---

## 28. Final execution report checklist

The local AI's final response must state:

```text
Task 025 complete?
STARTING_HEAD
FINAL_COMMIT
push status

primary guest build / arch / snapshot
canonical MapleStory hash verified?

A1 bare result
A2 127.0.0.1:9555 result
A3 original batch result
whether launch arguments changed progression

PCA/AppCompat evidence summary
whether PCA appears causally active after Run program

thread count / hot thread summary
user vs kernel CPU
start-address coarse classification if available

module timeline highlights
PCOM loaded?
NameSpace loaded?
ws2_32 loaded?
HSUpdate/ehsvc/AspINet observed?

repeated failed file/registry/object accesses
SoftICE/Oreans/WinLicense runtime events
instrumentation effect?

network gate reached?
9555 attempted/established if tested

exact earliest defensible post-PCA boundary
strongest uncertainty
Route A/B/C/D/E/F
recommended next task

generated result files
generated reusable scripts
blockers
```

The report must distinguish what was actually observed from what is inferred.
