# T085 WP3 — G40 Movement slot3 Variants, slot4/slot9 Variants, Item Slots

Binary: `.work/task-036/game-image-unpacked.bin` (sha256 `d4a67597…31718`,
linear model). Evidence: EV-80. Independently cross-checked by the blind
reviewer (T085-REVIEWER-BLIND.md): extents, ret-8 signatures, both variants
being pre-processors that tail-delegate to `0x9BF1FA`, and their table
installations all agree.

## 1. The complete per-state physics vtable map (slots that vary)

| Table | slot1 | slot3 | slot4 | slot5 | slot6 | slot9 | slot10 |
|---|---|---|---|---|---|---|---|
| T1 0xB0C498 | 0x9BC622 | 0x9BF1FA | 0x9BE703 | 0x9BFB52 | 0x9BC404 | 0x9BCCFB | 0x9BCD6C |
| T2 0xB0C660 | 0x9BC622 | 0x9BF1FA | 0x9BE703 | 0x9BFB52 | 0x9BC404 | 0x9BCCFB | **0x9C2966** |
| T3 0xB0C760 | 0x9C3DD1 | **0x9C5B8A** | **0x9C6028** | 0x9BFB52 | 0x9BC404 | **0x9C3D1D** | 0x9C4AAF |
| T4 0xB0C870 | 0x9C9983 | 0x9BF1FA | 0x9BE703 | 0x9BFB52 | 0x9BC404 | **0x9C9CF7** | 0x9C9D31 |
| T5 0xB0C970 | 0x9CBE4F | **0x9CCAA8** | 0x9BE703 | 0x9BFB52 | 0x9BC404 | 0x9BCCFB | 0x9CBE89 |
| T6 0xB0CA70 | 0x9CFCB4 | 0x9BF1FA | **0x9D06D4** | 0x9BFB52 | 0x9BC404 | 0x9BCCFB | 0x9CFD0B |
| T7 0xB0CB70 | 0x9BC622 | 0x9BF1FA | 0x9BE703 | **0x9D3CCA** | **0x9D3DE6** | 0x9D3FE1 | 0x9D4024 |
| T8 0xB0CC78 | 0x9BC622 | 0x9BF1FA | 0x9BE703 | 0x9BFB52 | 0x9BC404 | 0x9D7AD5 | 0x9D7ADA |

New facts beyond C-076: **slot4 has variants** (T3 0x9C6028, T6 0x9D06D4 —
C-076's "slot4=0x9BE703 physics loop" holds for 6 of 8 tables only), **slot9
has variants** (T3/T4), and T7 overrides slot5/slot6. State semantics anchored
this round: T1 = ctor default (ground movement); T2 = ctx-less water-entry
recovery tick; T3 = swim; T7 = fresh cross-map object (installed by ctor
0x9D34FA after the base ctor); T8 = climb (ctx = rope record).

## 2. slot3 variants — precise differences

Both are wrappers around the generic walk mover `0x9BF1FA` (extent
0x9BF1FA–0x9BF6E9, ret 8 — independently reproduced by the reviewer):

### 2.1 T3 slot3 0x9C5B8A (extent 0x9C5B8A–0x9C5F5F, ret 8) — SWIM

- Δt = decrypt(M+0xE0) − decrypt(src.t); Δt == 0 → straight delegate.
- `[M+0x238] == 1` (surface swim, set by the T2 recovery tick): direction-aware
  neighbor handling — neighbor chosen by Δt sign (ctx+0x50 next / ctx+0x4C
  prev), neighbor m1 must be > 0; t clamped to `len−20.0` / `20.0`
  ([0xB064A8]) near segment ends (0x9C5C6E–0x9C5CCD).
- `[M+0x238] == 2` (lane swim): platform-range table `[field+0x34]` indexed by
  ctx-platform AND `[M+0x23C]`; two platform ranges merged, span > 0x28
  narrowed by ±0x14 — swim lane bounds (0x9C5CE3–0x9C5D65).
- Tail (0x9C5EF2–0x9C5F53): `0x9C4B78(M, ±1, 0)` forces the input axis,
  `0x9C62A8(M)` runs the swim physics step, then **tail-delegates
  0x9BF1FA(M, arg1, arg2)** — the walk mover executes the actual move.
- Additional gates seen by the reviewer (concur): `[M+0x240]` object +
  RNG `[M+0x250]` family and helper `0x9C5341`.

### 2.2 T5 slot3 0x9CCAA8 (extent 0x9CCAA8–0x9CCC96, ret 8) — platform-edge RNG skip

- Δt == 0 → straight delegate.
- Reads the per-user table object `[[M+0x14]−4+0x94]` (= [user+0x94]; the
  reviewer's "[state+0x90]" is the same address through [M+0x14]+0x90) and
  queries it via `vt+0x18`, comparing the result with `[M+0x134]` (current
  platform) — platform-membership gate.
- Platform-range pair from `[field+0x34]+[ctx+0x20]·8` (span > 0x28 → ±0x14
  shrink); edge-proximity via ctx neighbor links (m1 sign gates) and x within
  the ctx x-range (ctx+0xC/+0x14).
- All gates passing → **`0xA70BAD` rand; `rand % 2`**:
  - odd → tail-delegate 0x9BF1FA (normal move);
  - even → copy 0x30 bytes (t/tang pairs) from src → M+0xE0, set
    **`[M+0x158] = 1`**, ret 0 — the move is SKIPPED this tick. Next tick,
    the T1 tick's pending action runs `0x9BD567(M)`: clears [M+0x158], sets
    `[M+0x15C]=1`, and if `0x9BD0D9(M)` returns non-zero notifies
    `0x53E95D(M, 1)` (kind-1 record).
- Semantic reading (DERIVED label): platform-change boundary — a 50/50
  hesitation/hop before crossing to a neighbor belonging to another platform.

### 2.3 What the variants are NOT

Neither variant reimplements the mover: both end in E8-tail calls to
0x9BF1FA with the original arguments. The two functions' shared "Δt == 0 →
delegate" head, the platform-range table reads, and the ±0x14/0x28 span
shrinking are byte-similar but serve different states (swim lanes vs
platform edges). No water branch exists inside 0x9BE703 itself (the water
query 0x979AA8 lives in the airborne integrator 0x9BDF18).

## 3. slot9 variants (step writers) — and the 0x5A connection (see WP4)

- T1/T2/T5 slot9 `0x9BCCFB` = standard step writer (G05/C-030: reads the step
  table installed at `[M+0x190]` from `[0xBDD498]+0xAC`; canonical entry 0x1E).
- **T3 slot9 0x9C3D1D** (reviewer find, verified): `call 0x9BCCFB; push 0x5A;
  pop eax; ret` — calls the standard step writer (side effects kept: the
  table snapshot into [M+0x190]) but **returns 90 regardless** — the swim
  state's step override.
- **T4 slot9 0x9C9CF7**: `[M+0x244] += 0x9BCCFB(); if sum >= 0x5A { sum −=
  0x5A; return 0x5A } else return 0` — step accumulator with 90-unit cycle;
  T4 slot10 0x9C9D31 seeds random timers (`rand%0x7D0`, `rand%0x3E8`,
  +0x1F4/+0x3E8 bases) into `[M+0x240]`-family fields — T4 is an AI-idle-ish
  state consuming the accumulated step bursts.

## 4. Item slots [M+0x190] / [M+0x198] and the "shoe defaults" question

- `[M+0x190]` = the per-map STEP TABLE pointer: ctor-zero, installed at
  0x9BCD2B (T1 tick) and 0x9BC85D (slot1 rebind) from `[0xBDD498]+0xAC`;
  read via `0x6A0545([M+0x190]+0x24)` in the walk integrator 0x9BD0D9.
- `[M+0x198]` = the SHOE-attribute item pointer: ctor-zero (0x9BC37E) and —
  bounded negative — **no setter found anywhere in the image's direct
  disp32-write census** (10 write sites image-wide; the 9 outside the
  movement ctor are in COM/UI regions and do not target M). Readers:
  `0x9BD0D9` (attrs +0x48/+0x24 combined with `[field+8]+0x70/+0x08`,
  friction `[M+0x150]`, multiplier 1.3), `0x9BDF18` (+0xC), and the wider
  0x9BD1xx–0x9BDCxx walk/jump family. The readers dereference without null
  guards after their state gates, so a valid object must be installed by
  code outside the examined movement/user-dispatch regions (probable
  equipment pipeline). **No default value is statically derivable from the
  movement family; the installer remains unidentified** — this stays a G40
  residual (runtime or an extended census of the equip code would close it).
  The four decrypted movement pairs (x/y/vx/vy) that C-061's marshaller
  reads are NOT the "DEC slots" of the shoe; the T1-era wording conflated
  them; this report keeps them explicitly separated.

## 5. Walk/swim/land sequencing (bounded statement)

Statically proven transitions this round: ground walk (T1, ctx=foothold) →
water entry (T2 install thunks 0x9C28BF/0x9C28FF → ctx-less recovery tick →
`[M+0x238]=1`) → swim (T3: lane/surface sub-modes with 20.0 margins);
airborne landing (T1 no-ctx path → 0x9BE703 mode=1 → slot5 install);
climb (T8 ctx=rope per C-069..C-073). NOT covered this round and still open
in G40: the full T3 0x9C6028/T6 0x9D06D4 slot4 bodies, swim→land exit
details, and slope-transition edge cases inside 0x9BD757's family. G40
therefore stays PARTIAL-STATIC with narrowed scope.
