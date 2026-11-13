# G38 — Portal same-map & cross-map arrival — targeted static forensics V2

**Round**: t080 (2026-11-13). **Lead agent derivation** (pending independent review).
**Source**: `.work/task-036/game-image-unpacked.bin` SHA-256 `d4a67597…31718` (verified); linear VA mapping (anchor-verified, see G36/G37 record).
**Design-draft claims under test** (docs/implementation/2026-11-09-adventure-field-map-scene-design-draft.md §16 M12/R10).

## 1. Same-map teleport — VERIFIED END-TO-END (new)

### 1.1 Trigger + cooldown gate (up-key handler region `0x963CE1–0x963D16`)
```
0x963CE1  call 0x994c7a            ; now = [[0xBDD89C]+0x18]  (global tick)
0x963CE6  cmp [esi+0x28F0], ebx(0) ; pending flag must be 0
0x963CFE  cmp [esi+0x2900], ebx    ; if armed:
0x963D06    ecx = [esi+0x2904]     ;   deadline
0x963D0C    ecx -= now
0x963D10    jg exit                ;   deadline > now → BLOCKED (cooldown)
```
### 1.2 Target resolution + pending store (`0x963D42–0x96426F`)
```
0x963D42  push [ebp+0x14]; ecx=[0xBDEB48]; call 0x71B4C0   ; portal-record resolver (global portal table at [0xBDEB48])
0x963D5B  edi = [record+0x10]   ; Y
0x963D5E  ebx = [record+0xC]    ; X        ← PortalRecord +0xC/+0x10 = x/y (same-map, direct)
0x963D6D  sub edi, 0xA          ; Y − 10  ← VERIFIED (same-map applies the −10 too, not only cross-map)
...
0x96423F  [esi+0x28F8] = ebx    ; pending X
0x964247  [esi+0x28F0] = 1      ; pending flag
0x96425A  [esi+0x2900] = now    ; arm cooldown
0x964260  eax = now + 0x78      ; trigger-side deadline = now + 120
0x964263  [esi+0x28FC] = edi    ; pending Y (already −10)
0x964269  [esi+0x2904] = eax
```
### 1.3 Apply (`0x9552F0`, next tick(s))
```
0x9552F4  call 0x994c7a          ; now
0x9552F9  cmp [esi+0x28F0],0     ; pending?
0x955308  eax=[esi+0x2900]; eax-=now; jg ret   ; armed-gate
0x955318  eax = [esi+0x28FC] (Y); ecx = [esi+0x28F8] (X)
0x955325  edi = [esi+0xF28]      ; move object (ATL outer)
0x95533D  call [vtable+0x40]     ; edi(this), X, Y
```
**Ownership confirmed**: `user+0x28F8/+0x28FC` = pending same-map teleport X/Y on the user object (esi = user); writers: trigger 0x96423F/0x964263, reset 0x4B6DCA/0x4B6DD0 (bulk-clear of +0x28CC..+0x28FC on teardown), cross-map mirror 0x95B8B0/0x95B8BC. (Trigger also stores an extra flag at `[+0x28F4]` @0x964251 — reviewer addition.)

### 1.4 Dispatch target and position write — `0x9C1113` VERIFIED WITH CORRECTION
- `call [edx+0x40]` target candidates: **0x9C1113 sits at vtable slot +0x40 in 8 sibling vtables** (slot dwords found at 0xB0C428, 0xB0C5F0, 0xB0C6F0, 0xB0C800, 0xB0C900, 0xB0CA00, 0xB0CB00, 0xB0CC08 → table starts 0xB0C3E8, 0xB0C5B0, 0xB0C6B0, 0xB0C7C0, 0xB0C8C0, 0xB0C9C0, 0xB0CAC0, 0xB0CBC8).
- **Correction**: EV-22's vtable `0xB0CB70` is a *sibling* in the same family whose slot+0x40 = `0x9BC4F5` = `mov eax,0x80004005; ret 0x24` (E_FAIL stub). The move object family swaps per-state vtables; only 8 of ≥9 install 0x9C1113 at slot16. The draft's flat "0x95533D→0x9C1113" holds iff the live vtable is one of the 8 (runtime state; statically enumerable).
- 0x9C1113 body (`ret 0xC` = 3 args, matches caller's 3 pushes):
  - `[this+0x104] = 0`; RNG-cookie pair at inner+0x118/0x11C via 0x9BFD85 (C-035 pair-writer family); `[inner+0x12C] = pair-sum`;
  - `fild X` → **0x6131F4(ecx=this+0x14 = inner+0x20)** — encrypted double setter (uses 0x416E71 / 0xBDF028 / 0xBAADF00D / 0xA700F4 — same machinery as EV-27/C-035) → **"encrypted coordinate setter" = YES**;
  - X again → setter at **inner+0x80** (this+0x74, @0x9C1151 — corrected after adversarial review); `fild Y` → setters at **inner+0x38** and **inner+0x98** (this+0x8C, @0x9C117F — corrected);
  - four `fldz` setters at **inner+0x50/0x68/0xB0/0xC8** (@0x9C11A4/B6/C8/DA — corrected) — **velocity zeroing**;
  - trailing `[inner+0xC]≠0 → 0x53E95D(this,3)` notification.
  - **In inner-object coordinates the primary X/Y encrypted setters sit at move+0x20 / move+0x38 — draft's offsets CONFIRMED** (with this = the ATL-outer, i.e. `[user+0xF28]`, offsets shift by −0xC).
- **State-vtable gating (reviewer bonus, adversarial round)**: ctor `0x9D34FA` installs vtable **0xB0CB70** on a fresh move state — concrete proof the move object swaps per-state vtables; since 0xB0CB70's slot16 is the E_FAIL stub, a same-map teleport against a move object in that state returns E_FAIL rather than writing position — per-state acceptance gating is original behavior, not an error path.
- After the call, 0x9552F0 mirrors X/Y into user `+0xEE8/+0xEEC` and `+0xEF0/+0xEF4`, clears `+0x28F0`, sets `[user+0x2900]=now`, `[user+0x2904]=now+0x258` (**post-apply cooldown 600 ticks**).

### 1.5 Cooldown — VERIFIED with structure
- Unit: the `0x994C7A` tick (`[[0xBDD89C]+0x18]`); consistent with ms (600 ms = 0x258, 120 ms = 0x78).
- Two distinct windows: trigger arms `now+0x78` (0x964260); apply re-arms `now+0x258` (0x955387). Gate = `[0x2900]≠0 && [0x2904]>now`.
- Draft's "同图间隔 0x258" = the post-apply window ✓ (the trigger-side 0x78 is a new fact it lacked).

## 2. Cross-map arrival — VERIFIED END-TO-END (new)

- Opcode `0x0081` = **WARP_TO_MAP** (send, server→client) — from A-grade protocol corpus (protocol-opcodes.csv, C-046). Client dispatch-table byte-binding not re-derived this round (handler registration is a table; single E8 caller chain below).
- `0x9507F0` (this=user) is called from `0x97EC37` inside map-transition handler `0x97EBC9` (allocates 0x3048 buffer, dispatches 0x980A8C, applies to user at [esi+8]).
- Body of 0x9507F0:
  - spawn byte from packet field `[edi+0xD1] & 0x7F` (bit7 = alternate spawn path);
  - portal-record path (bit7 clear): table `[[0xBDEB48]+4]`, entry stride 8, `record+0xC/+0x10 = x/y` ✓;
  - alternate path (bit7 set): `0xA49808(index)` with 0x3B9AC9FF sentinels → field singleton `0x4376F2`/`0x54765B` fallback, else `[ebp-0x48/0x44]`;
  - `0x9D359D` → new move state; `0x971BC8(user+0xF28, &obj)` attach;
  - **position write** `0x950951–0x95096D`: `call [vtable+4]` (slot m1 = **0x9BC622**) with `(1, X, Y−10, 0, 0, user+0x3C0, 0)` — **Y−10 VERIFIED**;
  - `0x9BC622` body: X clamped to `[move+0x138..0x140]`, Y to `[move+0x13C..0x144]` (**map-bounds clamp before write**); `fild` + encrypted setters at **move+0x20 (X)**, **move+0x38 (Y)**, zeros at +0x50/+0x68 (**velocity reset**); `[move+0x18]=1`; foothold hint `[userfield+0x1C/+0x20] → move+0x130/+0x134` when `[move+0x110]≠0`; rebind helpers `0x9BC89F/0x9BC992` (move+0xE0 collection);
  - downstream resets: `0x953FA5(user)` state reset, `0x934C06`, `0x948AA2`, `0x948B66`, copies `[0xBD9028]+0x3568/0x356C/0x3570 → user+0x2860/0x2864/0x2868` (position mirror);
  - cross-map pending mirror at `0x95B8B0–0x95B8E7`: `[user+0x28F8/+0x28FC] = x/y`; `[user+0x2900]=V; [user+0x2904]=V+1` (near-immediate re-arm, V from packet context).

## 3. Foothold re-attach ordering (partially resolved)

- Same-map: 0x9C1113 does NOT itself call a foothold resolver in the disassembled window; trailing `0x53E95D(move,3)` is the rebind/notification candidate (body unread this round).
- Cross-map: explicit hint copy `move+0x130/+0x134 ← [userfield+0x1C/+0x20]` + `0x9BC89F/0x9BC992` rebind chain (bodies unread this round).
- Ordering (coordinate-write vs snap): coordinate setters run inside 0x9C1113/0x9BC622 BEFORE the rebind helpers → **write-then-rebind** order established statically at the call-sequence level.

## 4. Verdict table

| sub-behavior | verdict | grade |
|---|---|---|
| user+0x28F8/+0x28FC ownership (pending teleport X/Y) | VERIFIED | DIRECT-INSTRUCTION |
| same-map write path 0x95533D → vtable+0x40 → 0x9C1113 (8 sibling vtables) | VERIFIED-WITH-LIMITS (live vtable is runtime state; 0xB0CB70 slot16 is E_FAIL stub) | DIRECT-INSTRUCTION |
| same-map writes via encrypted setters move+0x20/move+0x38 (+second copies +0x80/+0x98 = this+0x74/+0x8C) | VERIFIED | DIRECT-INSTRUCTION |
| same-map Y−10 | VERIFIED (happens at trigger time, 0x963D6D) | DIRECT-INSTRUCTION |
| cooldown = armed gate + 0x78 trigger window + 0x258 post-apply window, tick `[[0xBDD89C]+0x18]` | VERIFIED | DIRECT-INSTRUCTION |
| cross-map PortalRecord +0xC/+0x10 = x/y (stride-8 table at [0xBDEB48]) | VERIFIED | DIRECT-INSTRUCTION |
| cross-map Y−10 at 0x950964; m1=0x9BC622 args (1, x, y−10, 0,0, user+0x3C0, 0) | VERIFIED | DIRECT-INSTRUCTION |
| cross-map velocity reset (zero setters +0x50/+0x68) + bounds clamp +0x138..0x144 | VERIFIED | DIRECT-INSTRUCTION |
| opcode 0x81 = WARP_TO_MAP → 0x9507F0 | opcode name from corpus (A); dispatch-table byte-binding UNVERIFIED this round | DIRECT-DATA + INFERENCE |
| foothold rebind semantics (0x53E95D / 0x9BC89F / 0x9BC992 bodies) | OPEN | not read |
| camera update timing after teleport | OPEN | not traced |
| climb/seat/stance reset completeness | PARTIAL (0x953FA5 called; body unread) | not read |

## 5. Residual

1. Foothold rebind bodies (same-map 0x53E95D; cross-map 0x9BC89F/0x9BC992) — statically readable, next round candidate.
2. 0x953FA5 full state-reset inventory (draft's "velocity, climb, seat, land/water state resets" — velocity proven via setters; others body-unread).
3. Opcode dispatch-table byte binding (0x81 → 0x97EBC9 registration).
4. Camera refresh after arrival (G10 dependency).
