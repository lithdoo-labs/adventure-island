# Task 025 — Static/runtime correlation (no process-memory reads)

Correlates Task 025 runtime observation with the static protector map (Tasks
004–012c) at boundary granularity only. The canonical executable SHA-256
`5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d` was
revalidated inside the guest in every run, so existing RVAs and the static
protector chain remain applicable. No ReadProcessMemory, no dumps, no debugger,
no thread contexts were used for anything below.

## 1. Which static boundary each runtime outcome sits in

### Spin outcome (client disk as G:, runs A1R1/A1R3/A1P/A1P2/A1E)

- Module set is exactly the 16 system DLLs of the pre-game bootstrap
  (ntdll, kernel32, KERNELBASE, apphelp, USER32, GDI32, LPK, USP10, msvcrt,
  IMM32, MSCTF, ADVAPI32, sechost, RPCRT4, winmm + the mapped MapleStory.exe
  image). `MapleStory.exe` maps at `0x00400000` (static `ImageBase`, no ASLR for
  the main image) with module size 10,330,112 = static `SizeOfImage`
  (0x9DA000) — **confirmed-runtime**.
- No game-side module ever loads; no window is ever created; one initial
  thread spins at ~0.95 CPU-s/s forever; ~45 % user / ~55 % kernel.
- Static map position: this is the pre-materialization protector stage — the
  static chain (T1 → T2 → T3 → round1 → round2 → round3 → SICE/SIWVID/NTICE
  probe cluster → decoders A/B → driver-install block → `0x862000+` encoded
  region, Tasks 004–012c) lives entirely inside the mapped image and produces
  exactly this profile: **no file IO after startup, no registry IO after
  startup, no new modules** (A1E kernel trace: 0 FileIo events attributed to
  the game PID across 150 s; only 46 Registry/Open + 21 QueryValue at process
  start, then silence).
- The static replay's own stop point — `CreateFileA("\\.\SICE")` at replay
  instruction 2,409,207 (Task 008/009) — is *compatible* with the observed
  syscall-heavy, file-less loop, but Task 025 has **no channel that can prove
  the spin executes that specific probe loop**; attribution of the spin to a
  specific RVA is `unknown`.

### Loader-success outcome (client disk as F:, runs A1R2/A2R1/A3R1)

- After ~2.6–2.7 CPU-seconds (93 % user-mode) of loader work, the process
  loads the repack's game-side runtime: `iloveaki.dat` (mapped at 0x60000000),
  `ijl15.dll`, `MSVCR90.dll` (WinSxS), `SHELL32/SHLWAPI/ole32/OLEAUT32`,
  `uxtheme/dwmapi`, and shows a modal dialog `#32770` titled `iloveaki` with
  static text "iloveaki success." and a 确定 button, then goes message-idle.
- Still **no** `PCOM.dll`, `NameSpace.dll`, `Canvas.dll`, `ResMan.dll`,
  `ZLZ.dll`, `Gr2D_DX8.dll`, `Sound_DX8.dll` (all present as files in the
  client directory, never loaded), **no `ws2_32.dll`**, no HShield components.
- Static map position: past the pre-game protector into the repack's own
  wrapper stage (`iloveaki.*` layer, absent from the static Wizet/protector
  map — this is repack-added code), parked at a modal gate before the Wizet
  game-DLL/network transition.

## 2. Protector runtime objects vs static strings

Static expectations (from Tasks 007–012c decoded regions):

| Static object | Static evidence | Task 025 runtime observation |
| --- | --- | --- |
| `\\.\SICE`, `\\.\SIWVID`, `\\.\NTICE` CreateFile probes | static-only (Task 009/011) | **not observed**: services SICE/SIWVID/NTICE absent before+after every run; no FileIo events by the game PID at all in the A1E kernel trace |
| `\\.\Oreans.vxd`, `%s\Oreans.vxd` | static-only (Task 012 driver-install plaintext) | **not observed**: no `oreans*` files anywhere after any run, no new drivers (`driverquery` identical before/after) |
| `oreans32.sys` / `oreansx64.sys`, `OpenSCManagerA/CreateServiceA/StartServiceA` | static-only (Task 012) | **not observed**: services oreans32/oreansx64 absent before+after every run |
| `XprotEvent`, `SetEvent/WaitForSingleObject/CreateEventA` trio | static-only (Task 012 resolver dictionary) | **not observed as named objects** (no channel exposed them; nothing persisted) |
| `HKCU\Software\WinLicense`, `Software\WLkt`, `HKCU\Software\Wine` | static-only (Tasks 009–012) | **not observed**: keys absent before and after every run (read-only `reg query`) |
| `apphelp.dll` | — | present in every run from process start (SDB APPHELP evaluation), no post-click activity |

Honesty note: with Procmon unavailable on this guest (v4.11 runs but its
capture engine no longer supports Win7; v3.86 is not obtainable from an
official source), one-shot device CreateFile probes by the game would only
have been visible via the ETW kernel trace — which shows zero FileIo events
attributed to the game PID for the whole window. "Not observed" therefore
means "no persistent side effect and no file-IO-level trace event", not
"the static code did not execute".

## 3. Thread-start granularity

All threads' `StartAddress` resolve to the ntdll `RtlUserThreadStart`
trampoline on this OS/.NET combination, so the hot thread cannot be attributed
to the MapleStory image vs a system DLL via that API (documented in
`task025-thread-summary.md`). No EIP inference is made.

## 4. Boundary conclusion

- Post-PCA, the process is **inside the pre-game protector stage in both
  outcomes**; the observable fork is produced by the client-side loader, not by
  appcompat, not by HShield, not by any external dependency, service, or
  driver (all negatively confirmed), and not by missing file/registry objects
  (kernel trace shows none being probed during the spin).
- The spin's file-less, registry-less, single-threaded, ~55 %-kernel profile
  is consistent with in-memory protector computation (the static `0x862000+`
  encoded region still has no decoder identified — Task 012c), but exact-stage
  attribution stays `unknown`.
- The success path stops at the repack's own `iloveaki` modal gate, before the
  first Wizet game DLL or Winsock load — i.e. before both the PCOM/NameSpace
  boundary and the network boundary.
