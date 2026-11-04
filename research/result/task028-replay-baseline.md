# Task 028 — Replay baseline and determinism (D0)

## Environment

- Python 3.14.4, Unicorn 2.1.4, Capstone 5.0.7, pefile; host Windows 11
  x64 (AMD64).
- Sample: `MapleStory.exe` SHA-256
  `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`
  (revalidated this task; identical to all prior tasks).
- Guest DLLs: Win7 SP1 x86 Professional system DLLs extracted read-only
  from the project ISO (`install.wim` index 4), mapped at the
  guest-observed bases (kernel32 0x76180000, ntdll 0x77660000, winmm
  0x6F5E0000, …) — the Task 027 `guestdll` set, unchanged.
- Client files: `.work/task-001/extracted/<client>/` (ijl15.dll
  `b1bc97dc…`, iloveaki.dat `41d37bfb…` per Task 026 records).

## D0 — deterministic reproduction

Two untraced full runs (base1/base2) and two traced full runs
(base3/base4) reproduce the identical terminal state:

```text
count            = 20,211,773
why              = unmapped:0x80a7c4d (wild jump after the error box)
eip              = 0xC5B5E0
messageboxes     = ["Themida - http://www.oreans.com" (garbage text)]
seh_dispatches   = 1
probes           = SICE/SIWVID/NTICE absent (truthful)
Tail A writes    = 0 ; ZtlTaskMem slots = 0
API log          = 4103 events, identical sequence hash
```

Normalized signature (apilog sha256 `a9357b2b…`, image sha256, register
hash) identical across base3/base4 (full JSON, `base3.sig.json` vs
`base4.sig.json`).

## Corridor checkpoint (Phase A)

A v2 checkpoint is saved after the first `timeGetTime` stub returns
(n=18,865,228; the post-API point where winmm/timeGetTime resolution is
complete — one of the spec's suggested markers). Restores complete CPU
state (GPRs+EFLAGS), all mapped memory, SEH-head, vclock continuity,
handles/files/registry state, and the module registry.

Equivalence verified twice (ckrun2/ckrun4): the resumed runs' corridor
instruction/branch/API streams are **byte-identical** to the full run's
suffix (1,428,634 stream events), and final state hashes match. A
save/resume bug (register re-init clobbering, and resume runs
re-saving the checkpoint) was found and fixed during verification;
the final tooling is regression-clean (ck5/ck6/ck7 signature-identical).

Iteration cost: full replay ~75 s; checkpoint resume ~30 s.

## Determinism ledger

See `task028-replay-determinism.csv`.
