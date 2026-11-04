# Task 029 — VM architecture (V0/V1/V2 deliverable)

STARTING_HEAD `dfcd7f414af25987aa6dd98ee569e91e107e3d4d` · canonical
`MapleStory.exe` SHA-256 `5d280cf1…` (revalidated) · Python 3.14.4 /
Unicorn 2.1.4 / Capstone 5.0.7. Baseline reproduced (Task 028 final
default: count 20,211,772, error box, corridor checkpoint n=18,865,228) —
see `task029-replay-baseline.md`.

## 1. The VM at a glance (all confirmed-replay unless noted)

```text
handler table   RVA 0x84B1E0 (256 dword entries; 171 point into the
                decoded image; 28 executed in the corridor)
dispatch        xor bl, al ; movzx eax, al ; jmp dword ptr [edi+eax*4]
                (RVA 0x8574D4-0x8574D9) — the index is the RAW opcode byte;
                bl ^= rawbyte updates a rolling key each dispatch
entry invariant edi = table base (0xC4B1E0), eax = opcode byte
bytecode stream esi (observed 0xC65733-0xC6A475 = RVA 0x865733-0x86A475)
frame base      ebp = 0xF97D9014 (encrypted constant); VM data addressed
                [ebp + 0x744xxxx] -> Tail B cells
opcode 0x00     the error reporter itself (0x85941F) — "execute 0 = report"
VM stack        native stack window 0x2FEF80-0x2FF000 (push/pop machinery)
```

## 2. Register conventions at dispatch (from 4489 clean dispatches)

| reg | role |
| --- | --- |
| eax | current opcode byte (index) |
| ebx | rolling key in bl (bl ^= opcode each dispatch); ebx32 also keys 0x88 fetches |
| esi | bytecode stream position |
| edi | handler-table base |
| ebp | encrypted VM frame base (0xF97D9014) |
| edx | frequently the "current cell/value" operand register |

## 3. Opcode classes (details: task029-vm-handlers.csv / -opcode-semantics.csv)

- **immediates**: 0x61/0x3E/0x42 (imm8 keyed by bl), 0x1F (imm16),
  0x88 (**imm32 = raw − 0x12833B5C − ebx**, dynamically verified on all 26
  execs), 0x8E/0x92 (imm32 via multi-gadget const chains), 0x79 (imm8 +
  bl rekey).
- **cells**: 0x7D `pop dword ptr [edx]` (store cell — the Task 028 D1
  instruction class), 0x99 `push dword ptr [edx]` (push cell),
  0x36 `push [edi+0x38]`, 0x7B (result-cell chain:
  `pop [edi+0x20]; xor 0x6A745268`).
- **check/branch**: 0xA6 `lodsd <signed-offset>; cmp [edi+0x20],0; je`
  → **esi += offset on taken** — the walk's loop/exit instruction.
- **stack/ALU**: 0x89 (regmove family), 0x75/0x8F/0xA8 (ALU), assorted
  shuffles (0x43/0x45/0x47/0x78/0x7C/0xA3/0xAD/0x15/0x40/0x5C).

## 4. Program structure decoded (V3)

- The "26 walk items" of Task 028 are a **loop structure**, not unrolled
  items: the Z-block (208 ops ≈ 488 stream bytes) ends in an 0xA6 check
  whose taken branch is **−488** (self-loop of the whole block); the
  X-block (127 ops) is the exit arm (+5 forward).
- Steady-state expected constants (0x88 immediates, one per item):
  Z-arm **0x193155AD**, X-arm **0x193162AE**, staging items
  0x193159AD / 0x193155AD / 0x193163AD, final item 0x193159AD.
- Items 0-3 are the staging programs (export walks + "APIT" CRC-32
  hashing inherited from Task 028); item 2 contains the full name-hash
  pass (3229 bytes / 154 names / 1 match = "Sleep").

## 5. The timing-check core (V4 — the campaign's key finding)

Inside each steady-state item the VM calls a **timeGetTime wrapper**
(native RVA 0xC4B4CC):

```text
pushal                      ; saves BOTH samples: old (stack+0x10),
                            ;                new (stack+0x1C)
cmp eax, [edi+0x2c]         ; VM frame validation
lock cmpxchg [edi+0x1C?]    ; VM reentrancy lock (cell 0x84B210)
...
mov ecx, [esp]              ; ecx = OLD sample (e.g. 0x1260EF)
cmp ecx, eax                ; eax = NEW sample (e.g. 0x1260FE)   <-- n=19526670
pushfd                      ; EFLAGS of (old - new) pushed: 0x83
                            ;   (CF=1: new>old; ZF would be 1 if equal)
<keyed byte chain>          ; decodes/jitters the flags byte into the fold
```

Simultaneously `edx` carries **prev_delta << 16** (e.g. 0x00090000 =
the previous 9 ms delta), i.e. the walk folds the **consecutive-sample
comparison flags + delta chain**. The VM stack visibly carries the
sample pair (0x1260EF / 0x1260FE), the encrypted frame base, and VM
cell pointers (0xC4B1E0-0xC4B1F8) through the item.

**Consequence**: the verification walk is a **timeGetTime-behavior state
machine** — it checks how the guest's clock behaves between consecutive
samples (advance/stop/jump relations and the delta sequence), not a
memory-integrity property. This finally names the Task 028 "staged
datum": the staged input is the *sample-pair behavior*.

Falsification status (inherited + this task): raw scale (Task 027),
15.625 ms quantization (Task 028 — flow changed, outcome same), absolute
uptime base (Task 028 sweep). What was NOT yet modeled faithfully: the
*pattern* of equal/advance comparisons and the exact fold predicate —
see blockers.

## 6. Tooling

`scripts/maple079_vm_disasm.py` — VM bytecode disassembler
(op sequence + handler map + raw/keyed immediates + signed 0xA6 branch
targets + rolling key), with `--validate` (reproduces the walk expected
constants and locates the 0x2E3D5322 error-target constant in the image).
Full corridor listing (4489 instructions) in
`.work/task-029/programs/full-corridor-vm.disasm`.
