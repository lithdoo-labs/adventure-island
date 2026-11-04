# Task 029 — Protector VM bytecode decompilation campaign (final report)

RUN DATE 2026-10-14 · STARTING_HEAD `dfcd7f414af25987aa6dd98ee569e91e107e3d4d`
· canonical `MapleStory.exe` SHA-256
`5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`
· Python 3.14.4 / Unicorn 2.1.4 / Capstone 5.0.7 / Win11 x64 host ·
guest DLLs = Task 027 ISO set, unchanged.

## 0. Task 029 complete?

**Yes as a campaign — Stop D** (high-value decode work completed with a
precise cut point; the remaining step is mechanical and precisely
defined). Milestones: **V0 ✓, V1 ✓, V2 ✓ (tool + validation), V3 ✓
(structure), V4 partial, V5 not reached**; V6-V8 not reached. No
fidelity changes were needed this task; no branches forced; no
prohibited techniques.

## 1. Head / push

FINAL_COMMIT recorded at push time; no force push; `.work/` scratch
(dispatch log, listings, effect data) never committed.

## 2. Recovered VM model (V0)

Dispatch `xor bl,al; movzx eax,al; jmp [edi+eax*4]` (RVA 0x8574D4-9);
256-entry handler table at RVA 0x84B1E0 (**opcode 0x00 = the error
reporter itself**); bytecode at `esi` (executed window RVA
0x865733-0x86A475); encrypted frame base `ebp=0xF97D9014`; VM stack on
the native stack window 0x2FEF80-0x2FF000; rolling key in `bl`
(bl ^= opcode each dispatch; ebx32 keys 0x88 fetches).

## 3. Opcode coverage (V1)

All 256 table entries classified (`task029-vm-handlers.csv`): 171
in-image, 28 executed in the corridor. Per-op semantics for all executed
opcodes (`task029-opcode-semantics.csv`); fetch arithmetic **dynamically
verified** for 0x88 (imm32 = raw − 0x12833B5C − ebx, all 26 execs);
0x8E/0x92 const-chains decoded positionally (documented as such).

## 4. Disassembler + validation (V2)

`scripts/maple079_vm_disasm.py`: opcode sequence + handler map + raw/
keyed immediates + signed 0xA6 branch targets + rolling key; includes
the dispatch-log extractor and `--validate`. Validator reproduces
**25/26 walk expected constants** from the image decode and locates the
**0x2E3D5322** error-target constant in the image. Full 4,489-instruction
corridor listing produced.

## 5. Verification program status (V3)

The Task 028 "26 items" are a **loop**: the Z-block (208 ops ≈ 488
bytes) ends with an 0xA6 check whose taken branch is **−488** (self
loop); the X-block (127 ops) is the exit arm. Items 0-3 are staging
(item 2 embeds the "APIT"-CRC export-name-hash pass that resolves
Sleep). The post-walk tail (132 ops) contains the constant chain that
installs the error continuation.

## 6. Staged data status (V4)

Expected side (bytecode constants): Z=0x193155AD, X=0x193162AE,
staging 0x193159AD/0x193155AD/0x193163AD, final=0x193159AD. Actual side
(proven): per cycle the VM consumes a **timeGetTime sample pair**
(old/new via the wrapper at native RVA 0xC4B4CC with a lock-cmpxchg
guard), `cmp old,new; pushfd` (flags 0x83 for new>old), the previous
delta carried as **prev_delta<<16**, and the accumulator byte family.

**Key finding**: the verification walk is a **timeGetTime behavior state
machine** — the "staged datum" Task 028 hunted is the *clock's
inter-sample behavior*, not memory content. No memory-integrity
divergence exists in the steady state (read-sets identical across
items).

## 7. Continuation status (V5 — not reached, precisely blocked)

The terminal predicate (the tail's comparison of the final fold state)
was not symbolically evaluated — that single mechanical step (a small
symbolic evaluator over ~8 stack opcodes, run through one Z+X cycle and
the tail) separates two outcomes: either an acceptable behavior window
is enumerable (→ faithful clock model → V5/D4 attempt) or the boundary
is proven (Stop B/C). Recorded as B29-1 with the exact method.

## 8. Import / Tail-A / game anchors / network

V6/V7/V8 not reached: the walk never selects the non-error continuation
in the replay; Tail A writes 0; no ws2_32/9555 activity. No placeholder
artifacts created.

## 9. Strongest new finding / uncertainty / blocker

- **Strongest finding**: the walk's check core — `cmp old,new; pushfd`
  at RVA 0xC5782C-0xC5782E over consecutive timeGetTime samples with a
  prev-delta carry — i.e. the protector verifies *clock behavior*.
- **Strongest uncertainty**: the exact acceptable behavior window
  (equal-sample bursts? delta bounds? sequence shape?) — B29-1/B29-2.
- **Primary blocker**: B29-1 (symbolic fold evaluation); secondary
  B29-2 (faithful tick-phase clock model).

## 10. Recommended next broad direction

1. Extend `maple079_vm_disasm.py` with the symbolic evaluator (ops
   0x89/0x99/0x7D/0x75/0x8F/0xA8/0x61/0x88 effect signatures are already
   tabulated) → close the V4 expected-vs-actual equation → name the
   terminal predicate (V5).
2. Implement the evidence-based tick-timer model (15.625 ms phase-
   anchored ticks with equal-sample bursts) and re-run — outcome either
   naturally passes (→ immediately continue V6-V8 with the existing
   monitors) or the boundary is proven with the predicate named.

## 11. Artifacts

`result/29-protector-vm-bytecode-decompilation.md` (this file),
`task029-vm-architecture.md`, `task029-vm-handlers.csv`,
`task029-opcode-semantics.csv`, `task029-check-programs.md`,
`task029-check-items.csv`, `task029-staged-parameters.csv`,
`task029-staged-data-map.csv`, `task029-replay-baseline.md`,
`task029-milestones.csv`, `task029-blockers.csv`,
`task029-progression-timeline.csv`, `task029-main-static-bridge.md`.
Reusable tool: `scripts/maple079_vm_disasm.py`. No replay-fidelity
fixes were required this task (`task029-replay-fidelity-fixes` not
created — baseline identical).
