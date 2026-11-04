# Task 028 — Decision slice and provenance (D2)

Backward slice target: the D1 node (VM continuation store, RVA 0x84E638 at
n=20,204,446) — specifically the VM state that selected the post-walk
script which computes and installs the error target.

## 1. Slice method

1. Selective corridor trace with per-instruction registers/flags/writes
   (and per-instruction reads in the diagnostic run
   `.work/task-028/gadget-traces/ckrun7`).
2. Iteration differential slicing: align the 26 walk items at their heads
   (`0x84B6C7`) and at their final check (`0x84F6A9`), diff registers,
   paths, and memory-read sets.
3. Value-history searches for the decisive constants (0xC5941F,
   0x6A74526A/68, the accumulator bytes) through the full trace.
4. Read-surface aggregation over the whole run (`read_pages`,
   `k32_reads`, corridor `read_map`).

## 2. Slice chain (confirmed-replay, chronological)

```text
[pre-corridor]  probes (absent) -> GetCommandLineA -> GetVersionExA
                -> RegOpenKeyA(root) -> #UD 0x862E76 -> SEH 0x862F19
                -> ZwContinue 0x862E7A -> winmm/timeGetTime resolve
n=19,071,027    kernel32 export walk: e_lfanew(0x3C) -> DD[0](0x168)
                -> export dir (0xB4FC4) -> name-ptr table (0xB6528)
                -> first-char filter 'S' staged at [0xC1A361]
n=19,088,948+   custom CRC-32 (poly 0x54495041 "APIT", seed 0xFFFFFFFF,
                bitwise, final not) over kernel32 export names,
                154 S-block names / 3229 bytes hashed,
                exactly 1 match -> "Sleep" resolved
n=19,29x,xxx    0x81D14C loop family: hash/search machinery over staged
                blocks (same CRC); staged-data buildout in Tail B
n=19,315,277+   verification walk: 26 unrolled VM check items,
                accumulator at walk heads (0x46 boundary /
                0x83-0x97 running states), one timeGetTime sample
                every 3rd item (13 samples, 0x1260AB..0x126189,
                per-cycle delta ~15.5 ms), Sleep(50) once (n=19,389,422)
n=20,184,352    last walk item (fresh script esi=0xC661D1)
n=20,196,836    error target computed: add [esp+4], 0x2E3D5322 -> 0xC5941F
n=20,204,446    D1: pop [edx] stores 0xC5941F into VM cell [0x84B1E0]
n=20,206,427    push [edx] pushes the error continuation
n=20,211,743    ret -> 0x85941F reporter -> MessageBoxExA
```

## 3. Root inputs (the corridor's complete external surface)

The corridor (n=18.87M-20.21M) reads **only**: its own stack, Tail B VM
cells/bytecode, and kernel32 export structures. Zero PEB/TEB page reads,
zero other-module reads, zero registry/file/network access. Whole-run
surface (uncapped apilog, 4103 events): `LoadLibraryA`×4 (user32,
advapi32, ntdll, winmm), `GetLocalTime`×1, probes×3 (truthful absent),
`GetCommandLineA`×1, `GetVersionExA`×1, `RegOpenKeyA`×1 (root duplicate),
SEH dispatch + `ZwQueryInformationProcess(ProcessExecuteFlags=0x22)`×1
(ntdl-internal handler validation) + `ZwContinue`, `timeGetTime`×2022,
`Sleep(50)`×1, `MessageBoxExA`×1.

| Root input | Provenance label | Replay model | Status |
| --- | --- | --- | --- |
| kernel32 export names/tables | `MODULE:kernel32.dll` @0x76180000 (ISO build, no relocs) | real file mapped | faithful (verified: "Sleep" found, called) |
| advapi32 export zone (+0x15000-0x19000) | `MODULE:advapi32.dll` @0x75D90000 | real file mapped | faithful-by-construction (resolution succeeded: RegOpenKeyA called) |
| timeGetTime samples | `TIMEGETTIME:sample1..2022` | vclock (227 virtual-ms/1M insns) + optional 15.625 ms quantization | incomplete (granularity modeled; absolute scale unfaithful by nature; scale-invariance already proven by Task 027) |
| Sleep(50) | `API_RETURN:Sleep` | +50 ms to virtual clock | faithful-in-shape (rounding to timer tick not modeled) |
| GetLocalTime | `API_OUTBUF:GetLocalTime` | fixed (2026-10-02 13:01:51) | incomplete (any-value tolerance expected; no evidence of dependence) |
| GetCommandLineA | `CMDLINE` | now `F:\MapleStory.exe` unquoted (matches PowerShell Start-Process used by the real guest) | faithful (Task 027's quoted form corrected) |
| GetVersionExA | `API_OUTBUF:GetVersionExA` | strict 148-byte write, 6.1.7601/SP1 | faithful after Task 028 fix (old stub wrote 16 bytes OOB garbage) |
| RegOpenKeyA root duplicate handle | `API_OUTBUF:RegOpenKeyA` | ordinary small handle (0xA8+4i) | faithful after Task 028 fix (old value sat in the predefined-hive range) |
| SEH/CONTEXT restore | `EXCEPTION_CONTEXT:*` | real ntdll dispatch | faithful (Task 027, re-verified) |

## 4. What the walk's aggregate consumed

Every mid-walk item executes an instruction-identical path with an
identical memory-read set (28 distinct addresses: VM stack slots, VM
cells 0x84B200/0x84B204/0x84B364/0x84B3B4/0x84B404/0x84B478/0x84B480,
and the 7-byte item script at RVA 0x866173-0x866179). The only per-item
differences are register-carried state (the accumulator byte and the
family selector). Therefore the walk's aggregate — and hence the
post-walk script selection — is a pure fold over values staged
**before** the walk: the staged VM cells, the depacked Tail B data, the
resolved API addresses, and the timing samples.

## 5. Open slice question (carried to blockers)

Which staged datum differs from the real guest such that the post-walk
continuation selects the error entry. The timing dimension has now been
falsified three ways (rate: Task 027 scale tests; granularity: 15.625 ms
quantization changes flow but not outcome; absolute uptime: the
measured-plausible 60-300 s base sweep is outcome-invariant). All
external inputs are modeled faithfully or provably inert on this path.
The remaining candidate is a staged datum produced by the pre-walk
depack/staging pipeline and consumed by one of the 26 walk items —
decoding the walk scripts (bytecode at RVA 0x866xxx via the handler
table at RVA 0x84B1E0) is the bounded next step, recorded as B28-3 in
`task028-blockers.csv`.
