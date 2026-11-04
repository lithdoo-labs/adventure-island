# Task 029 — Verification check programs (V3/V4)

All evidence confirmed-replay from the Task 028 corridor trace +
decoded-image dump; artifacts: `task029-check-items.csv`,
`task029-staged-parameters.csv`, full disassembly
`.work/task-029/programs/full-corridor-vm.disasm`.

## 1. Program inventory

| Program | Ops | Stream extent | Role |
| --- | --- | --- | --- |
| staging item 0 | 37 | 0xC65733-0xC657D3 | prologue: constants + first cell stores |
| staging item 1 | 44 | 0xC65811-0xC65A50 | continuation prep (a6 +501 jump) |
| staging item 2 | 495 | 0xC65A50-0xC65E35 | **name-hash pass**: embeds the export walk driver (the 0x81D14C "APIT" CRC loop runs under this program) |
| staging item 3 | 276 | 0xC65E35-0xC6616F | table buildout (a6 +27) |
| **Z-block** | 208 | ≈488 bytes ending 0xC660A0-adjacent | steady-state check; 0xA6 branch −488 (self-loop) |
| **X-block** | 127 | 0xC660A0-family | exit arm; 0xA6 branch +5 (forward) |
| short-Z item 18 | 92 | — | variant without 0x88 fetch |
| boundary item 19 | 116 | — | B-phase (0xA6 outcome +0/no-check) |
| final item 25 | 59 | 0xC662xx | 0xA6 +5 exit into the post-walk tail |
| post-walk tail | 132 | 0xC661D1→0xC6A475 | continuation install (contains the 0x2E3D5322 constant chain producing 0xC5941F) |

## 2. The steady-state cycle (Z → X alternation, 13+13 iterations)

```text
Z-block (208 ops):
  - VM housekeeping (0x89/0x99/0x7D cell traffic on 0x84B1E0-0x84B1F8)
  - timeGetTime wrapper call (native 0xC4B4CC; lock cmpxchg guard)
      -> new sample vs old sample: cmp old,new; pushfd
  - fold: flags byte + prev_delta<<16 (edx) + 0x88 expected constant
  - result-cell store (0x7B chain): [0x84B200] = 2 (continue) / 0 (exit)
  - 0xA6 check: cmp [0x84B200],0
        != 0 -> esi -= 488   (loop the Z-block again)
        == 0 -> exit path (X-block)
X-block (127 ops):
  - the alternate arm; its own 0xA6 (+5) proceeds forward
  - hands (new_sample, new_delta<<16) to the next cycle
```

## 3. Expected constants (protector-side, decoded from bytecode)

| Cycle | 0x88 immediate | observed fold outcome |
| --- | --- | --- |
| staging 0/1 | 0x193155AD / 0x193155AD | table build |
| staging 2 | 0x193163AD | name-hash pass (Sleep resolved) |
| staging 3 | 0x193162AE | table build |
| Z steady ×13 | 0x193155AD | result 2 → loop |
| X steady ×13 | 0x193162AE | result 0 → exit arm |
| final | 0x193159AD | boundary acc 0x46 → tail |

Bit-0 of the constants: Z/staging = 1, X = 0 — consistent with the
result-cell polarity (2/odd = continue, 0/even = exit).

## 4. What the check consumes (actual side)

Per cycle, observed on the VM stack / registers:

- old sample, new sample (e.g. 0x1260EF / 0x1260FE);
- `cmp old,new` EFLAGS saved via pushfd (0x83 for new>old);
- prev_delta<<16 in edx (e.g. 0x00090000);
- the accumulator byte family (0x83/0x87/0x93/0x97 mid-walk, 0x46
  boundary) walked in Task 028;
- VM cells 0x84B200/0x84B204 (results) and 0x84B364/0x84B3B4/0x84B404/
  0x84B478/0x84B480 (parameters, read-identical across items).

No other external input exists in the steady state — the cycle is a pure
function of (old, new, prev_delta, acc, constants).

## 5. Remaining decode step (V5, blocked item)

The exact terminal predicate that compares the final fold state against
the expected constants (and thereby selects the error continuation vs
the normal one) lives in the post-walk tail's 132-op program. The
0x2E3D5322 constant chain is decoded positionally; what is missing is
the symbolic evaluation of the fold inputs through the last X-block so
the comparison's two sides can be named. See blockers B29-1.
