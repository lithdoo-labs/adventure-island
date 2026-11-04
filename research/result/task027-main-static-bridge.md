# Task 027 — Main static bridge (0x862000+ / Tail A)

STARTING_HEAD `bc71cca8d9059b81fc7ec293c82700bb44a80a24`. All work offline on
the canonical sample (`5d280cf1…`). Tool: `scripts/maple079_full_replay.py`
(promoted from this task's scratch), Unicorn 2.1.4 / Capstone 5.0.7, guest
Win7 SP1 x86 system DLLs extracted read-only from the project's install ISO
(`install.wim` index 4), client files from `.work/task-001/extracted/`.

## 0. Executive summary

Two static thrusts this campaign:

1. **Candidate decode hypotheses falsified cleanly** (see
   `result/task027-decoder-targets.csv`): section1-raw@0x1000, the probe-stop
   0x862000+ block, `uvrwsdpb`, and the tpuaozxc unread tail are **not**
   plain aPLib streams at their region starts. The resident aPLib depacker
   is *inline* at RVA 0x912116 (no callable routine), so "decoder-C = a
   second depack call" has no code to call — the next-stage decode is either
   an in-place loop family with new constants or a depack from a non-region
   offset.

2. **Faithful post-probe replay built — the static wall moved forward by one
   full stage.** By answering environment queries with the truthful values
   of the real guest (real ntdll/kernel32/user32/advapi32 at guest bases
   with relocations, absent devices fail, `IsDebuggerPresent=FALSE`,
   synthesized TEB/PEB), the replay executes past the SICE/SIWVID/NTICE
   probes and into the previously-unreachable post-probe protector:

```text
n=13.71M  \\.\SICE probe        -> INVALID_HANDLE (absent, truthful)
n=13.71M  \\.\SIWVID probe      -> absent
n=13.71M  \\.\NTICE probe       -> absent
n=14.19M  GetCommandLineA
n=17.25M  GetVersionExA
n=18.02M  RegOpenKeyA
n=18.86M  SEH frame installed; deliberate #UD at RVA 0x862E76
          -> real ntdll!KiUserExceptionDispatcher dispatch
          -> handler 0x862F19 (inside decoded 0x862000+ region) runs
          -> ZwContinue resumes at 0x862E7A (instruction AFTER the trap)
n=18.87M  LoadLibraryA(winmm.dll) + GetProcAddress(timeGetTime)   [4th module]
n=19.5-20.2M  timeGetTime timing phase (many samples, one Sleep)
n=20.21M  Themida error-reporter decision -> "Themida - http://www.oreans.com"
          MessageBoxExA path (emulation-detectable divergence; the real guest
          never shows this box)
```

## 1. New structural facts about the protector (confirmed-static)

| Fact | Evidence |
| --- | --- |
| The bytes at RVA 0x862E76 (`0F 3F`) are a **deliberate illegal-instruction trap**, not corruption | replay executes to it, ntdll dispatches STATUS_ILLEGAL_INSTRUCTION, the decoded region's own handler (0x862F19) continues execution at 0x862E7A — matching Task 003's runtime observation of exactly this RVA as the last in-image exception |
| 0x862000+ **is partially executed post-probe** | executed range 0x862D92–0x863280+ (sensible instruction flow), i.e. the region contains real code that a post-probe stage makes executable — the "still encoded at probe-stop" reading is now refined: encoded-at-probe-stop, decoded-and-executed later, with #UD/#GP traps woven in |
| Exception-driven control flow is load-bearing | SEH chain head at TEB[0], handler frames, `ZwContinue` context restore all required; a disassembler that doesn't model SEH sees garbage at the trap sites |
| Post-probe module 4 = winmm.dll, then a timeGetTime timing loop | matches the guest module timeline exactly (winmm = last pre-freeze module in every observed run) — the replay is on the real path at this point |
| The Themida error reporter is the probe-cluster's failure path | icon-char parser ('0'→0, '3'→0x10, '4'→0x30, '5'→0x40), title slot "Themida - http://www.oreans.com", text buffer ebp+0x74408dd, followed inline by the `\\.\SICE`/`\\.\SIWID`/`\\.\NTICE` strings at 0x859507+ |
| Win7 SP1 x86 SEH validation requires ExecuteFlags 0x36 | ntdll `RtlIsValidHandler` disassembly (0x776F040E chain): MEM_PRIVATE handler validity = `(ExecuteFlags >> 5) & 1`; DEP-off processes carry EXECUTE_DISPATCH|IMAGE_DISPATCH bits — this is what lets the runtime-generated handler run on the real guest |
| .rsrc holds a real directory tree but encoded payloads | RT_BITMAP ×4 (only #124 file-backed), RT_ICON ×2, RT_DIALOG 109/115, RT_GROUP_ICON, RT_VERSION @0x9D720E, RT_MANIFEST ×2 @0x9D7556 — all blobs high-entropy; version/manifest live in the tpuaozxc unread tail |

## 2. The current static boundary

The replay diverges from the real guest inside the obfuscated resolver walk
(0x84B→0x857 RVA zones, encrypted-EBP gadgets) and reaches the Themida
error reporter with a partially-built (garbage) message — an
emulation-detection class of divergence. Known unfaithful dimensions of the
replay at that point: virtual-clock scale for `timeGetTime` (calibrated
0.227 ms/1K instructions, but the real check's threshold is unknown),
single-threadedness, and unmodelled API side effects among the ~20 stubbed
exports. Pinning the exact failing comparison requires instrumented
data-flow tracing through the gadget chain — the tool now exists for it.

**Tail A remains unwritten in every offline state** (0 writes across all
replay variants); the ZtlTaskMem* slots stay zero; no game-code anchors
(AES key / IV / CWvsApp-family / ws2_32 strings) appear anywhere up to the
divergence point.

## 3. Method notes (reproducibility)

```text
guest DLLs:  7z e install.wim "4/Windows/System32/<dll>"   (index 4 = Professional)
replay:      python scripts/maple079_full_replay.py --exe ... --guest-dir ... \
             --client-dir ... --budget 600000000 --dump-image out.bin
disasm:      capstone over the dumped image (RVA == file offset in the dump)
```

Every guest-DLL base is the guest-observed value from
`result/task027-foundation-runs.csv` / module-first-seen data; every
answered API value is the truthful real-guest answer (documented per-stub in
the script). No patching of the sample, no injected "satisfying" answers:
absent devices/keys/files fail exactly as on the real OS.
