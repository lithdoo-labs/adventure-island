# T085 WP4 — G34 The 0x5A / 0x1E Constant Relation

Binary: `.work/task-036/game-image-unpacked.bin` (sha256 `d4a67597…31718`).
Evidence: EV-81 (census + anchor windows). Two fully independent censuses were
performed (lead agent and blind reviewer; different scanners, same image hash)
and their findings merged after byte-level re-verification of every differing
site.

## 1. Hypotheses

- H1: a real numeric conversion 90 ↔ 30 exists (e.g. a ×3/÷3 scaling chain or
  tick converter).
- H2: the constants serve disjoint semantic domains.

## 2. Result

**H1 rejected; H2 holds — with exactly two sites where the constants
interact, and neither interaction is a conversion.** (An inert co-occurrence
exists inside the T5 tick 0x9CBE89 — 0x9CC0CF `add dword [ebx+0x23C],0x1E`
and 0x9CC640 `and edi,0x5A` share the function without interacting — recorded
per the adversarial review D2 correction. Both censuses are bounded to the
0x401000–0xA80000 instruction window.)

### 2.1 Interaction site (a): T3 slot9 override at 0x9C3D1D

```
009C3D1D  e8d98fffff    call 0x9BCCFB      ; standard step writer; returns the
                                          ; step value (canonical table entry 0x1E)
009C3D22  6a5a          push 0x5a
009C3D24  58            pop eax            ; eax = 90 — the 30 is DISCARDED
009C3D25  c3            ret
```
The swim state substitutes a fixed step of 90 for whatever the step table
returned. No arithmetic between 90 and 30 occurs; the 30 never reaches the
caller. (Blind-reviewer find; re-verified.)

### 2.2 Interaction site (b): T4 slot9 accumulator at 0x9C9CF7

```
009C9CFA  call 0x9BCCFB                  ; per-tick step value (0x1E canonical)
009C9D0C  add [esi+0x244], eax           ; accumulate
009C9D18  cmp eax, 0x5a                  ; threshold 90
009C9D27  add eax, -0x5a                 ; wrap on fire
```
With the canonical table step 30 the accumulator fires every 3 ticks — but
the ratio is `threshold / data_value`, not a hardcoded ×3: the step table is
per-map data, and a different table value changes the cycle length. (Lead
find; confirmed against the reviewer's independent census.)

### 2.3 Domain separation (all other sites)

- 0x5A (82 instruction sites in .text): UI metrics (the 0x95B9F0–0x95C250
  dialog builder family, paired with 0x1E pushes), swim-family RNG-tick
  divisors `((rand%400+800)/90 → [M+0x4D4]`, `(rand%2000+1000)/90)` at
  0x9C4BF3/0x9C4DB6/0x9C4EAD/0x9C51BD/0x9C52E5, ASCII 'Z' compares,
  fieldctx/UI pushes (0x977D8A, 0x9E1849, 0xA01446, 0xA11952, 0xA141A6).
- 0x1E (223 instruction sites + the step-table data value): geometry
  half-extents — the seat occupancy box `y±0x1E` at 0x965965/0x965976, the
  0x9B4AAF/0x9B4B2B/0x9B4F16/0x9B4F92 hit-test `sub edx,0x1E` expansions,
  0x9D06B9 (T6 slot4), 0x958624/0x958635 (query family), 0x99F453/0x99F4E3;
  bound/index compares (`cmp eax,0x1E`: 0x93B8C4, 0x942880, 0x955473,
  0x96D444, 0x96DC7F, 0x974D24, 0x974E1D, 0x975D91, 0x97A40E); argument
  pushes (0x9BCA4C slot13, 0x9BCD5D T1 tick, 0x9C3F53, 0x9C9A35, 0x9CCA0D,
  0x9D4969, …); and the step-table value itself (data, not an immediate).

## 3. Falsifiers (what would overturn this verdict)

1. An instruction multiplying or dividing by 3 between a 0x5A load and a 0x1E
   load — none exists (both censuses, window 0x401000–0xA80000).
2. A third site where the constants interact — none found by either census
   (the T5-tick co-occurrence is inert by construction).
3. A target-map FSDB step value ≠ 0x1E — would demonstrate the accumulator
   cycle is data-driven, further weakening any "×3" reading (the 13-map data
   set carries step tables; spot-checked canonical value 0x1E per EV-23).

## 4. Ledger impact

G34's question ("0x5A vs 0x1E conversion relation") is answered: **no
conversion relation exists; the two constants are separate-domain constants
that interact at exactly two state-specific step sites (override and
accumulator; a third co-occurrence inside the T5 tick is inert)**. The
historical reports that treated 90/30 as a suspected tick-conversion
multiplier are corrected. Recommend G34 → CLOSED-STATIC.
Tick/step conversion remains a per-state mechanism (override value 90 for
swim, accumulator cycle for T4) and any product reimplementation must treat
step as data, not as 3×30.
