# Task 030 — Terminal predicate (T1/T2/T4 outcome)

## The predicate, stated precisely

The Task 029 model ("the walk is a timeGetTime behavior state machine")
is **refined to its exact form by this task's evidence**:

1. The walk consumes the sample pair (`cmp old,new; pushfd`), the
   prev-delta carry, and the expected constants — **but no branch in
   the corridor depends on the sample values**. Across a 5000×
   clock-rate range (per-cycle deltas 1→78 ms), every control-flow
   landmark is bit-identical: 26 walk heads, 13/26 checks taken, the
   same result-cell (2/0) sequence, the same post-walk tail, the same
   error continuation (RVA 0x84E638 store → reporter 0x85941F).
2. Whole-run provenance: **no pre-corridor API output reaches the
   corridor's read set** (GetLocalTime/cmdline/versionex/registry all
   terminate inside the second VM instance, RVA 0x8214xx context).
   The corridor's inputs are exactly: the runtime-decoded image +
   bytecode (deterministic from the canonical sample), faithful
   resolved pointers (winmm!timeGetTime, user32!MessageBoxExA), and
   the APIT-CRC-staged tables over kernel32/advapi32 export data
   (same ISO-extracted DLLs as the real guest; both resolutions
   verified matched).
3. Therefore the terminal predicate — "which continuation does the
   post-walk tail install" — is, in the replay, a pure function of
   the runtime-decoded program state. **The error continuation is not
   selected by any environment input the replay can vary.**

## Consequence: the divergence channel is narrowed to one

Every input channel is now proven faithful or inert:

| Channel | Status |
| --- | --- |
| timeGetTime values/rate/pattern | inert (R2 sweep; quantization+base falsified in 028) |
| kernel32/advapi32 content | faithful (same files; resolutions matched) |
| resolved API pointers | faithful (GetProcAddress semantics; guest bases) |
| PEB/TEB fields | never read (028) |
| cmdline / GetVersionEx / GetLocalTime / registry | consumed by VM2 only; zero flow into the corridor (R1) |
| concurrency | falsified (028) |
| **runtime-decoded image / bytecode** | **the only remaining channel — unvalidated against ground truth** |

The real guest (same sample, same DLLs, same QEMU-TCG speed class) does
not take the error continuation: the F:-drive runs completed the
protector (reached the `iloveaki success.` modal = import rebuild +
ijl15 boundary), and G:-drive runs hung in a spin — **neither ever
showed the Themida box** the replay produces. Since the replay's
corridor is deterministic over the decoded image, and every externally
observable input is now accounted for, the divergence must live in the
decoded image state itself (i.e., the real guest's runtime memory after
the stage-2/3 decode + VM2 staging differs from the replay's in some
way that changes VM1's program), or in an aspect of real-machine
execution outside the emulated surface.

## T4 / V5 verdict

**Boundary proven (Stop C form).** Validating the runtime-decoded image
against the real guest's memory requires dumping decrypted/protected
code from a live process — a prohibited technique (Task 028 §0.2, this
task's Restrictions). No faithful replay correction exists on the
evidence available; no branch forcing was performed. The acceptable
clock-behavior window (T2) is correspondingly **empty** — the predicate
does not admit or reject any clock behavior; the clock model (T3,
`--tgt-15ms` from Task 028) is proven immaterial to the outcome and is
retained only as a fidelity option.
