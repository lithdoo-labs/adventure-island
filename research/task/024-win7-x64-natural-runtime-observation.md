# Task 024 — Windows 7 x64 Compatibility / Natural Runtime Observation

## 0. Purpose

Use the Windows 7 x64 package already present under the local `.raw/` tree to build an **isolated, clean compatibility VM** and observe the CMS079 client under a runtime environment much closer to its original era.

This is a **natural-runtime compatibility task**, not a protection-bypass task.

Primary questions:

1. Does the client progress farther on Windows 7 x64/WOW64 than on the current Windows 10/11 host?
2. Do the SoftICE-family probes (`\\.\SICE`, `\\.\SIWVID`, `\\.\NTICE`) naturally take the ordinary “device absent” path?
3. Does the Oreans/WinLicense runtime naturally proceed into its driver/service initialization stage?
4. Does Windows 7 x64 choose the `oreansx64.sys`/service route, attempt the legacy `Oreans.vxd` path, or stop earlier?
5. Does `HSUpdate.exe` run, and can `AspINet.dll` load without the modern Smart App Control / VerifiedAndReputableDesktop failure seen on the newer host?
6. Does `MapleStory.exe` eventually load `ws2_32.dll`?
7. Does the client make a real TCP connection to login port `9555`, channel ports `7575–7578`, or cash-shop port `8600` when a controlled local server is available?
8. What is the earliest observable blocker if the client still fails?
9. Does the result justify continuing with Win7 x64, or is a Win7 SP1 x86 VM still required as the final compatibility baseline?

This task must not disable security features, patch the executable, fake probe results, attach a debugger, inject code, or dump decrypted game/protector memory.

---

## 0.1 Important scope: x64 is not x86

The target client is a 32-bit PE/I386 program. On Windows 7 x64 it runs under WOW64.

Therefore this task can answer many user-mode compatibility questions, but **Windows 7 x64 is not a drop-in substitute for Windows 7 x86**.

Win7 x64 is suitable for observing:

- 32-bit `MapleStory.exe` user-mode behavior under WOW64;
- the ordinary SoftICE device-probe path;
- WinLicense/Oreans API resolution and environment checks;
- module loading;
- file/registry/service access;
- x64 driver/service attempts;
- HackShield/update behavior;
- window/dialog behavior;
- Winsock load and TCP connection attempts.

It does **not** prove the behavior of:

- a native 32-bit Win7 kernel;
- a 32-bit kernel driver path that would only be available on Win7 x86;
- the old VxD route as an actual Win7 x86 execution baseline.

If the x64 guest reaches a driver-signature or architecture-specific blocker, the correct result is “Win7 x86 still required”, not “disable enforcement”.

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

If tracked/uncommitted changes exist, stop and report the blocker. Do not stash, reset, discard, or overwrite user changes.

Then:

```text
git fetch origin
```

If the working tree is clean and the branch is not `main`, switch to `main`.

Then update only by fast-forward:

```text
git pull --ff-only origin main
```

Record:

```text
git rev-parse HEAD
```

as `STARTING_HEAD`.

If the repository cannot fast-forward cleanly, stop. Do not rebase or force-reset.

Only after this gate should the task begin.

---

## 0.3 Directory and artifact contract

Directory roles are fixed:

```text
.raw/
    proprietary/raw inputs; read-only

.work/task-024/
    all scratch data, VM metadata, temporary extraction, logs, screenshots,
    text exports, hypervisor notes, guest helper bundles and large traces

result/
    permanent Task 024 findings to commit

scripts/
    only reusable project-owned observation/normalization scripts

task/
    task specifications

glm-work/
    prior evidence only; do not place Task 024 final outputs here
```

Recommended scratch layout:

```text
.work/task-024/
├── image/
├── vm/
├── guest-tools/
├── logs/
├── events/
├── network/
├── screenshots/
└── transfer/
```

Do not commit VM disks, ISO/WIM/VHD/VHDX/GHO files, screenshots containing environment details, ETL/EVTX/PML traces, packet captures, raw memory, driver binaries, or the client/server archives.

---

## 1. Existing evidence to read first

After synchronization, read at minimum:

- `README.md`
- `task/024-win7-x64-natural-runtime-observation.md`
- `result/07-protector-resolver-antidebug.md`
- `result/08-winlicense-reference-normal-path.md`
- `result/09-probe-cluster-full-cfg.md`
- `result/09-normal-probe-path-materialization.md`
- `result/10-post-probe-stage.md`
- `result/10b-static-extension.md` if present
- latest Task 012/012c post-probe/decoder-boundary result
- `result/04-static-loader-dataflow.md`
- `result/loader-emulation-observations.md`
- `result/anti-debug-rva-materialization.md`
- Task 005 compatibility / Code Integrity findings
- `result/file-manifest.csv`

Known client hash that must be reverified before applying existing RVA conclusions:

```text
MapleStory.exe SHA-256
5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d
```

Known modern-host observations to compare against:

- no-debug MapleStory run did not establish 9555/channel/cash-shop sockets during the previous sample;
- debugger attachment caused protector exits before Winsock load;
- `HSUpdate.exe` loading `AspINet.dll` was blocked on the modern host by Code Integrity / Smart App Control policy status `0xC0E90008`;
- the protector has a normal SoftICE-miss path;
- the post-probe stage contains Oreans/WinLicense driver/service logic and an embedded `XPROTVXD`/`Oreans.vxd` image;
- the static main-EXE route is currently blocked behind later encoded protector/runtime stages;
- Tail A and the three ZtlTaskMem exports have not yet been shown to materialize on the current route.

---

## 2. Phase A — Identify the Windows 7 x64 package in `.raw/`

Do not assume the exact package type.

Search `.raw/` read-only for plausible Windows 7 x64 artifacts, including for example:

```text
*.iso
*.wim
*.esd
*.vhd
*.vhdx
*.ova
*.ovf
*.7z
*.rar
*.zip
*.gho
```

For every plausible candidate record:

```text
relative_path
file_type
size
SHA-256
modified_time
container/compression type
```

Do not commit the full raw path if it contains personal user information; normalize it relative to `.raw/`.

If compressed, extract only the minimum necessary metadata into `.work/task-024/image/`. Never modify or rewrite the original package.

Try to establish, using metadata only where practical:

- Windows 7 edition;
- x64 architecture;
- Service Pack level;
- install image count/edition list if WIM/ISO;
- whether the package appears bootable;
- whether it is an installation medium or an already-installed VM/disk image.

Useful metadata tools may include existing local tools such as DISM/7-Zip/hypervisor inspectors. Do not install an untrusted extractor simply to continue.

If the package is not actually Windows 7 x64, report the mismatch and stop this task.

If it is Win7 x64 but not SP1, it may still be used for an exploratory run, but the report must label it precisely and must not call it “Win7 SP1”.

Output:

`result/win7x64-image-baseline.csv`

---

## 3. Phase B — Select an existing hypervisor safely

Detect already-installed virtualization options, for example:

- Hyper-V;
- VMware Workstation/Player;
- VirtualBox;
- an existing compatible VM environment.

Prefer an already-installed hypervisor.

Do not automatically install a new hypervisor, kernel driver, or virtualization product as part of this task. If no usable hypervisor exists, stop and report that blocker.

Record:

```text
hypervisor
version
host OS
host architecture
VM firmware mode
virtual CPU count
RAM
virtual disk type
network mode
```

Use a disposable VM with no personal data or accounts.

---

## 4. Phase C — Build an isolated Win7 x64 guest

### 4.1 Isolation requirements

The guest must not use bridged networking.

Preferred initial state:

- network disconnected, or
- host-only / internal private network.

Do not expose an unpatched Windows 7 guest directly to the internet.

For the baseline run, avoid unnecessary guest additions/integration tools if the VM can be operated without them. If guest tools are needed for practical file transfer or display, document them and take the clean snapshot before installing them when possible.

Disable shared clipboard/shared folders for the first natural run if the hypervisor supports this, to keep the environment contained.

### 4.2 Security requirements

Do **not**:

- enable test-signing mode;
- disable driver signature enforcement;
- use `bcdedit` to weaken Code Integrity;
- disable the Windows firewall globally;
- disable UAC solely to make the protector succeed;
- install SoftICE/SICE/SIWVID/NTICE devices;
- create fake Oreans devices or services;
- create WinLicense registry keys to influence branches;
- manipulate system time to a historical date to alter signature behavior.

If normal execution naturally attempts to install a bundled driver/service inside the isolated VM, observe the result. Do not manually force the install to succeed.

### 4.3 Snapshot discipline

Create at least:

```text
snapshot A: win7x64-clean
```

After any strictly necessary benign prerequisites are installed, optionally create:

```text
snapshot B: win7x64-client-ready
```

Document all changes between snapshots.

---

## 5. Phase D — Guest OS baseline

Inside the guest collect text-only baseline data before copying/running the client.

At minimum record:

```text
systeminfo
ver
OS caption
OS version
build number
Service Pack
OSArchitecture
PROCESSOR_ARCHITECTURE
installed hotfix count if available
PowerShell version
```

Also record:

- whether the guest is x64;
- whether WOW64 is available;
- current firewall state;
- existing services/drivers whose names contain `oreans`, `xprot`, `sice`, `ntice`, `siwvid`, `hackshield`, `ehsvc`;
- presence/absence of `HKCU\Software\WinLicense`;
- presence/absence of `HKLM\Software\WLkt` and any corresponding key used by the decoded protector code;
- presence/absence of `HKCU\Software\Wine`;
- baseline loaded driver list.

Use only read-only queries.

Output:

`result/win7x64-vm-environment.csv`

---

## 6. Phase E — Transfer and verify the client

Copy the client into the VM using a controlled method appropriate to the available hypervisor, for example:

- a read-only attached ISO;
- a temporary secondary virtual disk;
- a host-only file transfer;
- an existing trusted guest-transfer mechanism.

Do not alter the original `.raw` archive.

Inside the guest, re-hash at minimum:

```text
MapleStory.exe
HShield/HSUpdate.exe
HShield/AspINet.dll
HShield/ehsvc.dll
HShield/ehsvc.old
```

Compare `MapleStory.exe` to the canonical SHA-256 above and compare the others to existing manifest results where available.

If `MapleStory.exe` differs, stop applying all existing RVA/protector conclusions.

Record the transfer mechanism and hash verification result.

---

## 7. Phase F — Baseline launch with no debugger and minimal instrumentation

The first execution must be deliberately simple.

Do not attach a debugger.

Do not start Procmon or another kernel-level tracing tool before the very first run unless there is no other practical way to observe the process.

Use normal user execution first. If elevation is naturally requested, record it. Do not preemptively change compatibility flags or RunAs settings unless the client itself requires them.

Run using the normal launcher form. If no server is yet available in the guest/private network, an initial no-server launch is acceptable for compatibility characterization.

Record:

```text
launch timestamp
command line
PID(s)
parent PID/process
integrity/elevation state if visible
window title/class
all visible dialog text that can be retrieved safely
process lifetime
exit code if obtainable
child processes
```

If a dialog body cannot be retrieved through ordinary UI APIs, record exactly that it is unavailable. Do not infer its meaning from the title alone.

Do not click through destructive installer/security prompts just to continue. Record them first.

---

## 8. Phase G — Module progression under WOW64

Without debugger/injection, observe which modules appear in `MapleStory.exe` over time.

Preferred sources:

- ordinary process/module enumeration;
- 32-bit PowerShell/WMI where needed for WOW64 visibility;
- `tasklist /m`;
- trusted Sysinternals tools only if already available or obtained from an official trusted source.

At minimum determine whether the following ever load:

```text
ws2_32.dll
wininet.dll
advapi32.dll
user32.dll
ntdll.dll
HShield/ehsvc.dll
AspINet.dll
PCOM.dll
NameSpace.dll
Canvas.dll
ZLZ.dll
```

Record first-seen timestamp when practical.

Do not use `ReadProcessMemory` or dump module memory.

Output:

`result/win7x64-process-module-observations.csv`

---

## 9. Phase H — HackShield / HSUpdate / Code Integrity observation

Determine whether any of these processes/modules appear naturally:

```text
HSUpdate.exe
ASPLnchr.exe
ehsvc.dll
AspINet.dll
AhnUpCtl.dll
HSInst.dll
```

If `HSUpdate.exe` runs, record whether it attempts to load `AspINet.dll` and whether Windows 7 permits the load.

Review, read-only, relevant guest event logs such as:

- Application;
- System;
- Microsoft-Windows-CodeIntegrity/Operational if present;
- Service Control Manager events.

Record only relevant filtered text/fields in permanent results. Raw EVTX remains in `.work/task-024/events/` if exported at all.

Compare specifically against the modern-host result:

```text
0xC0E90008
VerifiedAndReputableDesktop / Smart App Control block
```

Do not assume Windows 7 will have an equivalent policy.

Output:

`result/win7x64-protection-events.csv`

---

## 10. Phase I — Oreans/WinLicense natural runtime observation

The current static chain predicts, after the SoftICE-family miss path, an Oreans SecureEngine/driver stage containing:

```text
\\.\SICE
\\.\SIWVID
\\.\NTICE
\\.\Oreans.vxd
\\.\oreans32
\\.\Global\oreans32
\\.\Global\oreansx64
oreans32.sys
oreansx64.sys
XprotEvent
HKCU\Software\Wine
```

Observe natural filesystem/registry/service/device activity around these names.

Use a second run with passive tracing if needed. Preferred tools:

- built-in event logs/WMI/service queries;
- official Sysinternals Process Monitor if available and trusted;
- read-only filesystem/registry before/after diff.

Keep Procmon PML or equivalent binary traces in `.work/task-024/` only.

Record:

```text
artifact/API-facing object
first timestamp
operation class
result/status
path/service/key/device name
process
interpretation
confidence
```

Important:

- a failed open of `\\.\SICE`, `\\.\SIWVID`, or `\\.\NTICE` is the expected ordinary result;
- do not create those device objects;
- do not force a return value;
- do not manually install Oreans drivers;
- if x64 driver signature enforcement blocks a natural `oreansx64.sys` attempt, that is a valid compatibility result.

---

## 11. Phase J — Server-assisted private-network test

Only after the no-server compatibility run is documented, perform a controlled server-assisted test if practical.

Use a host-only/internal private network. Do not use bridged networking.

Preferred arrangement:

```text
Host / analysis machine
    CMS079 Java server
    login 9555
    channels 7575–7578
    cash shop 8600

Win7 x64 VM
    MapleStory.exe <private-host-address> 9555
```

Use the already-known server stack and protocol results. Verify the server is listening before launching the client.

If the server must bind to a host-only interface, use the narrowest practical firewall allowance. Do not disable the host or guest firewall globally.

Record:

- private host/guest addresses, redacted to a reproducible role label if desired;
- server PID;
- listening ports;
- MapleStory PID;
- whether `ws2_32.dll` loads;
- whether an ESTABLISHED/SYN state appears to 9555;
- whether the server accepts a connection;
- whether channel/cash-shop ports are later contacted;
- connection timing relative to process start;
- server-side log evidence if available.

Do not require packet decryption for Task 024 success.

Raw pcap/ETL/network traces, if created, remain in `.work/task-024/network/` and must not be committed.

Output:

`result/win7x64-network-observations.csv`

---

## 12. Phase K — Process/file/registry delta after each run

After each important run, collect a minimal before/after delta for:

- new services;
- new drivers;
- new files under Windows/system/temp/client directories that match relevant names;
- WinLicense/Oreans/HackShield registry keys;
- process children;
- event log entries;
- network connections.

Do not recursively archive the guest filesystem.

Do not commit newly created driver binaries or extracted protector payloads.

If the protector writes `Oreans.vxd`, `oreans32.sys`, or `oreansx64.sys`, record only metadata in `result/`:

```text
filename
size
SHA-256
signing status if obtainable
creation path (normalized)
creator process
```

Keep the actual file inside the disposable VM / `.work` only.

---

## 13. Phase L — Compatibility delta versus modern host

Create an explicit comparison table between the existing modern-host observations and the Win7 x64 guest.

At minimum compare:

```text
MapleStory starts
process remains alive
visible dialog
HSUpdate runs
AspINet load attempt
AspINet load result
Code Integrity error
SoftICE probes inferred/observed
Oreans driver/service activity
WOW64 status
ws2_32 loaded
9555 connection attempted
9555 connection established
channel port contacted
cash-shop port contacted
child processes
new services/drivers
final blocker
```

Output:

`result/win7x64-compatibility-delta.md`

This is the core deliverable.

---

## 14. Optional reusable observer script

If useful, create a Win7-compatible helper such as:

```text
scripts/maple079_win7_observe.ps1
```

Requirements:

- compatible with Windows PowerShell 2.0 where practical;
- no debugger APIs;
- no process injection;
- no process-memory reads;
- no API hooking;
- no security-setting changes;
- only process/module/service/network/event-log metadata collection.

Prefer built-in Win7 commands/WMI over modern-only cmdlets such as `Get-NetTCPConnection`.

The script may write raw temporary output to `.work/task-024/` and normalized CSV/MD to `result/` through the host-side workflow.

---

## 15. Explicitly prohibited actions

For Task 024, do **not**:

1. attach WinDbg/x64dbg/OllyDbg or another debugger;
2. patch `MapleStory.exe` or any DLL;
3. patch conditional branches or flags;
4. fake `CreateFileA` results;
5. fake SICE/SIWVID/NTICE device absence/presence;
6. create fake WinLicense/Oreans registry state;
7. inject a DLL;
8. hook API calls in the target process;
9. use anti-anti-debug plugins;
10. disable DSE / Code Integrity / UAC / firewall globally;
11. enable test signing;
12. install SoftICE;
13. manually force-load old Oreans drivers;
14. perform a full process-memory dump;
15. commit decrypted/unpacked executable code;
16. expose the Win7 VM directly to the public internet;
17. bridge the VM onto an untrusted LAN for convenience.

If progress requires one of these, stop and record the boundary.

---

## 16. Milestones

Use the following milestones to classify progress:

```text
M0  Win7 x64 package identified and hashed
M1  VM boots; exact edition/SP/build established
M2  MapleStory.exe hash verified inside guest
M3  no-debug baseline launch reproduced
M4  ordinary protector/device-probe aftermath observable
M5  Oreans/WinLicense driver/service stage observable
M6  ws2_32.dll loads
M7  real TCP attempt to login 9555
M8  server accepts connection / login-stage traffic exists
M9  channel or cash-shop transition occurs
```

The task can be successful without reaching M9. The important result is the exact natural boundary and its comparison to the modern host.

---

## 17. Interpretation rules

Use evidence labels:

```text
observed
confirmed
probable
possible
unknown
```

Do not infer that a static code path executed solely because its string exists in the binary.

Examples:

- `oreansx64.sys` string present: static evidence only;
- service creation event naming `oreansx64.sys`: observed runtime evidence;
- `ws2_32.dll` appears in MapleStory module list: confirmed loaded;
- TCP ESTABLISHED to 9555 with MapleStory PID: confirmed network progression.

Do not claim Tail A or ZtlTaskMem materialization from compatibility metadata alone. Task 024 is not a memory-dump task.

---

## 18. Decision at task end

Choose exactly one route:

### Route A — Win7 x64 materially advances the client

Use when the guest proceeds farther than the modern host, for example:

- passes the previous UI/protector blocker;
- reaches Oreans runtime naturally;
- loads `ws2_32.dll`;
- connects to 9555;
- or otherwise exposes a later natural stage.

Next step should be a **passive post-Win7-stage correlation task**, not a bypass task.

### Route B — Win7 x64 reaches an architecture/driver-signature boundary

Use when the user-mode path advances but the next blocker is specifically x64 driver/service/signature behavior.

Conclusion:

```text
Win7 x86 remains required as compatibility baseline C2.
```

Do not disable enforcement.

### Route C — Same early blocker as modern Windows

Use when the client does not progress materially farther and the same user-mode/protector failure remains.

Next step returns to static/reference correlation.

### Route D — VM/image/tooling blocker

Use when the Windows 7 package cannot be booted/identified, no supported hypervisor exists, or the environment cannot be made reproducible without major host changes.

---

## 19. Required permanent outputs

Produce as applicable:

```text
result/24-win7-x64-natural-runtime.md
result/win7x64-image-baseline.csv
result/win7x64-vm-environment.csv
result/win7x64-process-module-observations.csv
result/win7x64-protection-events.csv
result/win7x64-network-observations.csv
result/win7x64-compatibility-delta.md
```

Optional:

```text
scripts/maple079_win7_observe.ps1
```

Important temporary evidence remains only under `.work/task-024/`.

---

## 20. Minimum success criteria

Task 024 is complete when:

1. the Win7 x64 package under `.raw/` is identified and SHA-256 recorded;
2. exact guest edition/architecture/build/SP is established, or a precise package blocker is recorded;
3. hypervisor/version/VM configuration are documented;
4. the client hash is reverified inside the guest;
5. at least one no-debug natural launch is performed;
6. process lifetime/window/dialog state is recorded;
7. module progression is observed well enough to answer whether `ws2_32.dll` loads;
8. HackShield/HSUpdate/AspINet behavior is compared to the modern host;
9. Oreans/WinLicense device/driver/service activity is characterized without forcing results;
10. relevant event-log evidence is summarized;
11. if practical, a controlled private-network server-assisted 9555 test is performed;
12. a clear modern-host vs Win7-x64 delta is produced;
13. the task selects Route A/B/C/D;
14. the report explicitly states whether Win7 x86 is still required.

---

## 21. Commit hygiene

Before commit:

```text
git status --short
git diff
git diff --cached
```

Only commit project-owned text/CSV/scripts.

Do not commit:

```text
.raw/
.work/
ISO/WIM/VHD/VHDX/OVA/GHO
VM snapshots/disks
EXE/DLL/SYS/VXD
WZ
EVTX/ETL/PML/PCAP
screenshots with environment/private data
memory dumps
unpacked/decrypted executable blobs
third-party tools/binaries
```

Suggested completion commit:

```text
Complete Task 024 Win7 x64 natural runtime observation
```

Then push normally:

```text
git push origin main
```

Do not force push.

If `origin/main` advanced while the task was running and the push is rejected, fetch and report the divergence instead of rewriting history automatically.

---

## 22. Final report checklist

The final execution report must state:

- Task 024 completion status;
- `STARTING_HEAD`;
- Windows 7 package relative path/type/size/SHA-256;
- guest edition;
- guest x64 confirmation;
- Service Pack/build;
- hypervisor/version;
- VM CPU/RAM/network mode;
- whether guest tools were installed before observation;
- client SHA-256 inside guest;
- whether MapleStory is running under WOW64;
- exact launch command form;
- PID/parent/child processes;
- process lifetime;
- visible window/dialog result;
- `HSUpdate.exe` observed or not;
- `AspINet.dll` load attempted or not;
- `AspINet.dll` load success/failure;
- Win7 Code Integrity/SCM evidence;
- SICE/SIWVID/NTICE observations;
- Oreans.vxd / oreans32.sys / oreansx64.sys observations;
- service/driver creation attempts;
- `HKCU\Software\Wine` probe evidence if observed;
- `ws2_32.dll` loaded or not;
- 9555 connection attempted or not;
- 9555 connection established or not;
- 7575–7578 contacted or not;
- 8600 contacted or not;
- server-side evidence if used;
- strongest difference versus the modern host;
- exact earliest blocker;
- Route A/B/C/D;
- whether Win7 x86 is still required;
- generated `result/` files;
- generated reusable `scripts/` files;
- final commit SHA;
- push status;
- unresolved blockers.
