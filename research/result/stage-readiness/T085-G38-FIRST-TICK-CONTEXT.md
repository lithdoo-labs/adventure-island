# T085 WP1 — G38 Portal First-Tick / 0x9BE703 Movement Context Rebuild

Task: T085 (CMS079 static forensics). Binary: `.work/task-036/game-image-unpacked.bin`
(sha256 `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718`, linear
model `fileOffset = VA − 0x400000`). Evidence: EV-77 (0x9BE703 full body + helpers),
EV-78 (first-tick chain). All statements below are instruction-anchored; the
disassembly windows are in the evidence files.

## 1. Function identity and extent

- `0x9BE703` = move-object per-state physics vtable **slot4** (`vt+0x10`) in tables
  T1 0xB0C498, T2 0xB0C660, T4 0xB0C870, T5 0xB0C970, T7 0xB0CB70, T8 0xB0CC78.
  T3 (0xB0C760) slot4 = `0x9C6028` (swim variant) and T6 (0xB0CA70) slot4 =
  `0x9D06D4`; both are NEW facts (T084 only knew slot3 variants).
- Extent `0x9BE703–0x9BF13F` (883 reached instructions, recursive-descent),
  `ret 0xC` → thiscall with 3 stack args: `(M this, srcState*, int* budget, int mode)`
  — `arg1 = [ebp+8]` snapshot of the four encrypted pairs, `arg2 = [ebp+0xC]`
  budget pointer, `arg3 = [ebp+0x10]` mode flag (`1` = fresh-context rebuild,
  `0` = continuation/drop recovery).
- Local helper `0x9BF144` (called at 0x9BEA5D/0x9BEA8C) = pure integer
  cross-product corner-wedge test, `ret` cdecl 4 args, no state.
- `0x9BF7EA` = map-bounds partial-budget computer (ret 8): clamps M x/y at
  `M+0x138` (left), `M+0x140` (right), `M+0x13C` (top) with position clamp +
  velocity-zeroing + partial step; returns the consumable distance.
- FPU constants decoded: `0xAFECC0`=0.0, `0xAFEC20`=0.5, `0xB00D60`=0.499999999,
  `0xAFECD0`=0.001 (budget ms→s), `0xB0C5A0`=−0.001, `0xB064A8`=20.0 (swim margin),
  `0xB064B0`=1.3, `0xB05538`=0.3.

## 2. M encrypted-pair layout (write-side completed this round)

The four movement pairs are `(value, key)` slots at stride 0x18:
`M+0x20` x, `M+0x38` y, `M+0x50` vx, `M+0x68` vy; line-state pairs `M+0xE0` t,
`M+0xF8` tangential. The same-map teleport `0x9C1113` additionally writes mirror
pairs `M+0x80` (x), `M+0x98` (y), `M+0xB0` (0.0) — a second coordinate set whose
readers are outside this round's scope.

## 3. The context triplet/quadruplet and the [M+0x120] dead-field result

Complete memory-write census (EV-78 §writer-census; direct mod=10 disp32
encodings incl. `and`/`pop`, no `rep movs` alias into `M+0x100..0x128`,
LEA-alias non-M installer noted separately — see the receiver-provenance
bound in §3):

| Field | Writers |
|---|---|
| `M+0x110` | ctor=0 `0x9BC336`; slot1 `0x9BC622`@0x9BC6E5; slot13 `0x9BCA6F`@0x9BCBF0 (`and`,esi=0); slot5 `0x9BFB52`@0x9BFBF2 |
| `M+0x114` | ctor@0x9BC33C; slot1@0x9BC6CA; slot13@0x9BCC10; slot5@0x9BFB86 |
| `M+0x118` | ctor@0x9BC342; slot1@0x9BC6F3; slot13 `and 0`@0x9BCC06/0x9BCC61; `0x9BD008`; slot5@0x9BFB8C/0x9BFBAF |
| `M+0x120` | ctor=0@0x9BC348; slot5 `and 0`@0x9BFB9D — no nonzero write with M provenance found (see below) |

Receiver-provenance bound (t085.1 D1 wording): the direct disp32 write census
(no setter targeting a move object; all mod=10 encodings incl. `and`/`pop`)
plus the absence of `rep movs` aliasing into `M+0x100..0x128` establish the
dead-branch result **for movement-family M objects**; the image does contain a
LEA-alias installer for a **non-M class** (`0x9B7F43`: `lea edi,[esi+0x120]`;
`call 0x9B87EA`, write @0x9B8817; receivers traced to callers
0x7540B4/0x754384/0xA15EF5/0xA32327), so the claim is bounded by receiver
provenance rather than by encoding exhaustion.

Consequence (statically proven dead branches inside `0x9BE703`):
- 0x9BE8CB candidate filter "only the old pinned segment passes" requires
  `[M+0x120] != 0` → never taken.
- 0x9BE8F0/0x9BEA3A set/clear of the `[ebp-0x74]` falling-flag require
  `[M+0x120] == candidate` → never taken; flag stays 0.
- 0x9BF086 `cmp [ebp-0x74],0; je` therefore ALWAYS jumps to the return-0 path;
  the pinned-segment re-project block `0x9BF08F–0x9BF13F` (incl. its `vt+0x14`
  call) is unreachable in this image.

## 4. Candidate gating and the FSDB structural consequence

For each swept-box candidate (live path, `[M+0x120]==0`):
1. `m1 = candidate+0x30` unit-direction x. `fcomp 0.0; ja skip` → checks apply
   only when `m1 <= 0.0`.
2. When `m1 <= 0.0`: platform (`cand+0x20`) must equal field-default
   (`[0xBDD498]+0x40`) or current platform (`M+0x134`); otherwise require
   `state([M+0x14].vt0()) == 7` AND layer match with `[M+0x114]+0x1C`.
3. FSDB census (EV-80): 13 target maps, 2283 footholds — `x1 > x2` = **0**,
   vertical (`x1 == x2`) = 676. So `m1 > 0` holds for every non-vertical
   target-map foothold and `m1 == 0.0` for verticals: the platform/layer gate
   applies exactly to vertical segments; verticals are cross-platform reachable
   only in state 7.
4. For the LOCAL user, `[M+0x14] = user+4` (set by 0x9BC602 @0x9BC608 from the
   0x9507F0 call at 0x95094C), and `user+4`'s vtable 0xB0BD04 slot0 =
   `0x4B6E2C` = `xor eax,eax; ret` → state getter returns 0, never 7 → the
   state-7 branch is statically dead for the local player in this build.
   (Whether other M owners — remote players/life — install a state object whose
   slot0 can return 7 is outside this round's evidence.)

## 5. The recovered first-tick chain (portal arrival → context rebuild)

### 5.1 Same-map portal (0x9C1113 slot16 of the COM-wrapper family)

1. `and [P+0x104], 0` → `[M+0x110] = 0` (ctx clear; C-061 confirmed; +0x114/
   +0x118/+0x120 are NOT cleared by the teleport — but +0x120 is provably
   always 0, and +0x114 stale values are only read behind the dead/m1>0 gates).
2. Rope handle re-encrypted null into `M+0x124` (0x9BFD85 @0x9C1133).
3. Writes x,y into `M+0x20`/`M+0x38`; zeroes `M+0x50`/`M+0x68` (velocity) and
   mirror pairs `M+0x80`/`M+0x98`/`M+0xB0`.
4. Notifies `0x53E95D(M, 3)` when `[M+0x18] != 0` (kind-3 record into M+0x19C).
5. **Rebind is deferred** — no physics happens inside 0x9C1113 (C-061 stands).

### 5.2 Next tick after same-map teleport (state T1)

`0x9BCD6C` (T1 slot10) — order of operations per tick:
1. `[M+0x170] = [M+0x16C]`; pending actions: `[M+0x158]`→0x9BD567, `[M+0x178]`→
   0x9BD58F, `[M+0x160]`→0x9BCFED, `[M+0x168]`→0x9BD53F.
2. `[M+0x110] == 0` → **no-context path 0x9BCF0C**:
   a. snapshot 0x60 bytes `M+0x20..0x80` (the four pairs) to stack;
   b. `0x9BDF18(M)` airborne integration (gravity from `[field+8]+0x28/+0x30`,
      shoe attrs `[M+0x198]+0xC`, `[M+0x190]+0xC` and `+0x24`, terminal
      velocity `[M+0x174]×[field+8]+0x70×dt`);
   c. `call [vt+0x1C]` (slot7; T1 slot7 0x9BC4CC = single `ret` stub);
   d. **`call [vt+0x10]` = 0x9BE703(M, snapshot, &budget, 1)** — mode=1;
   e. ret 0 → done (still airborne, full budget consumed, slot6 record written);
      ret 1 && budget>0 && `[M+0x110]!=0` → continue walk logic (t/tang
      snapshot → slot3 chain); ret 1 && `[M+0x110]==0` → 0x9BCFBF recovery.
3. `[M+0x110] != 0` (has ctx): snapshot t/tang pairs, `0x9BD757(M)` walk-step
   integrator, `call [vt+0xC]` (slot3 = 0x9BF1FA), then the same tail.
   Mid-step context drop (`[M+0x110]==0` after slot3) → 0x9BCE78: manual
   integrate + **0x9BE703(M, snapshot, &budget, 0)** — mode=0.

### 5.3 Inside 0x9BE703 — rebuild mechanics (live path)

1. `0x9BF7EA(M, src, budget)` map-bounds clamp + partial budget.
2. Four decrypt+round (floor(x±0.5)) of src.x/src.y/M.x/M.y → integers.
3. dx==0 && dy==0 → budget −= full; slot6 notify; ret 0.
4. Swept-box query `0x5114AA([0xBDD498]+0x44, out@ebp-0xB4{0xB00D88 walker},
   src.x, src.y, M.x, M.y)` (C-061's address anchors re-confirmed).
5. Iterate candidates (0x10-byte list nodes); apply §4 gates; integer winding
   tests select the best supporting segment pair (segA,segB); shared-endpoint
   corners resolved through prev/next links + 0x9BF144 wedge test.
6. No segment → 0x9BEDC2: budget −= full; `vt+0x18` slot6 record; ret 0
   (stays ctx-less; airborne continues next tick).
7. Segment found → consumed = full × crossing-ratio; interpolate velocities;
   select the landing segment edi; encrypt tangential into `M+0xF8`;
   `[M+0x118]==edi` early-out (tang fixup, ret 0, no reinstall).
8. Install: budget −= consumed; t = crossing parameter encrypted into `M+0xE0`
   clamped to `[0, len]` (0x9BEE56–0x9BEE98);
   - `seg.m1 > 0.0` (all non-vertical target-map footholds): `[M+0x150] < 0` →
     tang = 0 else tang × 0.5 (0x9BF018–0x9BF05C); `0x9BC992` reproject coords;
     **`vt+0x14` slot5 SetStandingContext(M, seg, 0, consumed)** → installs the
     ctx triplet (+0x110/+0x114/+0x118) and (layer,platform) at +0x130/+0x134,
     clears +0x120; ret 1.
   - `seg.m1 <= 0.0` (verticals in target maps): mode==0 → plain 0x9BC992
     reproject + slot6 record (0x9BF002); mode!=0 → full velocity re-derivation
     with slope alignment, re-encrypt vx/vy + both coord pairs, slot6 record
     (0x9BEEB7–0x9BF000); **no slot5 install** — object remains ctx-less and
     re-queries next tick.

### 5.4 Cross-map portal (fresh object)

`0x97EBC9` handler: new map load `0x94FDB4` → attach `0x980A8C` → arrival write
`0x9507F0` (C-083 order re-confirmed). Inside `0x9507F0` (EV-78 §9508E0):
1. Random portal pick: `rand % count`, portal record `+0xC/+0x10` = x,y.
2. `0x9D359D` allocates a **fresh T7 object** (base ctor 0x9BC2EB zeroes the 13
   ctx fields incl. +0x110/+0x114/+0x118/+0x120, then 0x9D34FA overwrites the
   vtable to T7 0xB0CB70 and zeroes +0x238/+0x23C, `+0x240 = 0x994C7A()`).
3. `0x971BC8(user+0xF28, &M)` installs M into the user's holder.
4. `0x9BC602(M, user+4)` map-bounds + state-object install.
5. `vt+4` slot1 `0x9BC622(M, 1, x, y−0xA, 0, 0, [user+0x3C0], 0)` — arg7=0
   (no immediate rebind, C-062 re-confirmed at the instruction level; arrival
   y is adjusted by −0xA).
6. `0x953FA5(user)` appearance reset; `0x934C06`; RNG `0x416DE8(user+0x265C,
   [user+0x2664])`; `0x948AA2(user, rng, 1)` → conditional stand-up (WP2).
7. First tick: T7 slot10 `0x9D4024` → gates → **`0x9BCD6C(M, budget)`** (both
   early branches delegate) → the same §5.2 no-context path with the T7 vtable
   in the register (slot4 = 0x9BE703, slot5 = **0x9D3CCA variant**, slot6 =
   **0x9D3DE6 variant** — the landing install/record for cross-map objects go
   through the T7 variants; 0x9D3CCA head adds a reentrancy flag [0xBE2844] +
   `[0xB0CBB8]/[field+8]+0x68` divisor; 0x9D3DE6 gates on `([user+0x3C0]&~1)==0x12`).

### 5.5 Water/swim transitions (structure only)

T2 = ctx-less recovery tick `0x9C2966`: if `[M+0x110]==0` → snapshot →
`0x9BDF18` → **0x9BE703(mode=1)** → on success `[M+0x238]=1`; if ctx exists →
only `[M+0x238]=1`. T2 is installed by thunks 0x9C28BF/0x9C28FF (water entry);
T3 (swim) slot3 0x9C5B8A consumes `[M+0x238]` sub-modes 1 (surface swim with
t-margins 20.0 at foothold ends) and 2 (lane bounds via platform-range table
`[field+0x34]` indexed by ctx-platform and `[M+0x23C]`). Full swim sequencing
remains in G40 scope.

## 6. Static chain (machine-proven) vs frame order (NOT observed)

PROVEN static order within one call: teleport-write → (next tick) snapshot →
integrate → slot4 query → install/notify. NOT observed: the wall-clock tick
rate, the per-frame scheduler that calls slot10, and camera refresh timing —
those stay runtime (G10) per the T084.1 boundary discipline. No runtime
execution was performed in this round.

## 7. G38 ledger impact

The previously-missing "first Movement tick reads new coordinates, rebuilds
context, restores normal motion" is now closed end-to-end for same-map (T1
no-ctx path) and cross-map (fresh T7 → delegated T1 path) arrivals, with the
branch-level behavior for vertical vs non-vertical segments and the dead
`[M+0x120]` branches documented. Residuals: camera refresh timing (tracked in
G10, unchanged), opcode 0x81 registration (C-066 clause, unchanged), runtime
corroboration optional. Recommend G38 → CLOSED-STATIC with those cross-refs.
