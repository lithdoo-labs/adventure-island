# Task 031 — Verdict (M5)

## The question

> Does anything write environment-derived bytes into the code the
> corridor executes — and if not, is the offline boundary now proven
> from both the dynamic and static sides?

## The answer

**No environment-derived byte ever reaches the corridor — and yes, the
boundary is now proven from both sides.**

## Evidence chain (this task)

1. **All-VM census** (`task031-vm-census.csv`): exactly two bytecode VM
   instances — VM2 (table RVA 0x821464, n 12,555,322-13,481,757) and
   VM1 (the corridor, table RVA 0x84B1E0). A third dispatch-site pattern
   (RVA 0x84A89A) never executes. Between VM2's death and VM1's birth
   lies a **native environment phase** (probes, cmdline, versionex,
   registry, #UD/SEH, winmm resolve) with zero VM dispatches.

2. **Code-staging census** (`task031-code-staging.csv`): of the 4,515
   addresses the corridor executes, 4,512 were written only in the
   decode phases (n < 3.8M — **before the first environment API at
   n=12,671,622**, hence deterministic sample-decode by construction);
   the 6 remaining (reporter instructions) were re-written at
   n≈13,598,792-13,599,530 by a **self-decrypt loop** (RVA
   0x593A1-0x59411) applying the constant transform
   `new = ((orig + 0x5A192D3D) ^ 0x61799419)` over 49 dwords — no
   environment input. **Zero code writes** in the windows 3.8M-12.56M,
   12.56M-13.59M (VM2), and 13.61M-18.87M (native env phase).

3. **VM1 entry state**: the bytecode seed 0x0748C71E is computed from
   pure constants (`(0x6B451A88 << 5) + 0x9EA5761E`, n=19,294,654-661);
   `esi = seed + ebp`, `ebx = seed`; `edi = 0x46BFD783` is a literal
   `mov`; `edx = 0xB3E9` is a constant chain (`0xD465 + 0xDF84`); the
   remaining `esi` value 0xC5FBFF is a popal-restored decoded-image
   pointer. **No entry register is environment-derived.**

4. Combined with Task 030: the corridor's reads are faithful/inert
   (R1), its branches timing-invariant across a 5000× envelope (R2),
   and its code + entry state deterministic from the sample (this task).

## Continuation addendum (same task, second session): the GLT differential elimination

The one input the elimination chain had left untested was the pre-corridor
unfaithful value itself: the GetLocalTime stub's fixed
(wSecond=30, wMilliseconds=0) vs the real guest's actual launch wall clock.
VM2 demonstrably consumes both fields (n=13,285,873 / 13,304,345 via opcode
0x17 `push [edx]`), and Task 030's invariance sweeps started at the corridor
checkpoint — the pre-corridor phase had never been differentially tested.

**Differential sweep** (`--glt-sec/--glt-ms`, 8 combinations spanning the
real ranges 0-59 / 0-999, full replays):

```text
(sec=30,ms=0) (0,0) (7,123) (15,500) (29,999) (45,250) (58,513) (3,750):
  count    = 20,211,772 (all identical)
  apilog   = d2785d46… (all identical — same API sequence)
  regs     = 62586341… (all identical)
  outcome  = same Themida box (all)
  image    = DIFFERS per combination (VM2 stages GLT-derived bytes)
```

Interpretation: the GLT-derived staged bytes do differ (image hash), but
**no branch-relevant code ever reads them** — the entire 20.2M-instruction
execution, every branch and every API call, is bit-identical across the
full real range of wall-clock values. The last unfaithful input is
thereby eliminated as a divergence cause, closing the loop: the replay's
full execution (pre-corridor + corridor) is invariant under every
controllable input dimension.

With this, the Stop-C boundary is proven from three sides: dynamic
invariance (030 R2 + this sweep), data-read provenance (030 R1), and
code/entry determinism (031 M4) — plus input-differential invariance of
the whole run (this addendum).

## Consequence

The corridor's execution is now proven to be a **deterministic function
of the canonical sample bytes plus faithful environment answers**. The
real guest — same sample, same DLL files (same ISO), same truthful
environment answers — must therefore traverse the same corridor program.
Since the historical guests' outcomes (F: modal / G: spin, never a
Themida box) differ from the replay's (box), and every channel inside
the emulation is now accounted for, the divergence cannot be a replay
fidelity defect at any layer we can observe:

- either the historical F:/G: guests' runtime state differed below the
  emulated surface (B30-2's below-hypervisor fork — consistent with the
  drive-correlation that no API carries), or
- the real machine diverged in an aspect of native execution the
  emulator cannot mirror without becoming the real machine.

**This is the complete Stop-C boundary**: validating further requires
either the prohibited live-code-extraction channel or a live-guest
non-code observation (the Task 030 §9 routes). No faithful correction
exists on the available evidence; none was invented; no branches were
forced at any point in Tasks 028-031.
