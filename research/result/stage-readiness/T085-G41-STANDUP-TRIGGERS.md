# T085 WP2 — G41 Stand-Up Trigger Paths and Input Arbitration

Binary: `.work/task-036/game-image-unpacked.bin` (sha256 `d4a67597…31718`,
linear model). Evidence: EV-79 (full census + bodies). Cross-checked against
the independent blind reviewer's pass (T085-REVIEWER-BLIND.md), whose census
and call-site classification agree with this round's findings; the reviewer's
extra dispatch link (router thunk 0x97FCBA) was re-verified byte-level and
merged.

## 1. Census completeness

All `call dword ptr [reg+0x38]` encodings (`FF /2`, mod=01 disp8=0x38,
non-SIB) in the image: **29 code sites** + 1 data-section coincidence
(0xC93B63, beyond .text) + 2 SIB data-island false positives (0xB2418B/
0xB9147B) — 32 byte-matches total. The blind reviewer independently
enumerated the same set. The user stand-up body `0x965A09` exists in exactly
one image dword (0xB0BD60 = user vtable 0xB0BD28 slot14), so every user
stand-up dispatch MUST be one of the census sites with a receiver whose
vtable is 0xB0BD28.

## 2. USER slot14 dispatch sites (receivers proven)

| Site | Flag | Containing function | Trigger |
|---|---|---|---|
| 0x965937 | **0 (notify)** | 0x9658CC | network opcode 0xCF, sub-case STAND |
| 0x948AB4 | **0 (notify)** | 0x948AA2 | cross-map arrival / movement-packet spawn (arg1≠0) |
| 0x9500A3 | 1 (silent) | 0x950095 | user full reset (T084/C-081, unchanged) |

User-family-LIKELY, receiver formally unproven this round (listed separately
per the adversarial review D4 correction): **0x948BD8 (flag=0)** inside
**0x948B66** — retrieves M through the identical `0x4B1C27(this,&arg)` +
`p−0xC` saturating-subtract idiom and shares the `[ebx+0x2C]`/`0x70DF65` gate
signature with 0x948AA2, but no user-field write was disassembled to hard-
prove the receiver; it is excluded from the "exactly three user sites" count
until proven.

No user dispatch with a dynamic flag exists (reviewer concurs).

### 2.1 0x9658CC — opcode 0xCF sit/stand (full body recovered this round)

Dispatch: router `0x9571BF` (switch on opcode−0xCF, table 0x95732E — C-066)
is reached through the `[outer+8]` thunk `0x97FCBA` (reviewer find, verified:
`mov ecx,[ecx+8]; …; call 0x9571bf; ret 8`); case 0 → 0x957204 → 0x9658CC.

Body (this=user, edi):
- `[0xBD9028]+0x2088 = 0`; timer `0x994C7A` → `[0xBD9028]+0x208C`.
- Packet byte `0x4066C9(arg)` selects the sub-command:
  - **0 = STAND**: seat state cleared via `0x6131B9(0, user+0x2944)` →
    `[user+0x294C]`; RNG gate `0x416DE8(user+0x2E90, [user+0x2E98])`; when the
    gate returns non-zero → **`call [user-vt+0x38](0)`** = 0x965A09(flag=0) →
    `0x53E95D(M, 0xB)` movement record (C-081 chain). This is the missing
    flag=0 trigger: **server-driven stand-up**.
  - **≠0 = SIT**: seat id via `0x4259A2(arg)` → seat record from a stride-8
    table at `[0x4376F2()+0x16C]`; occupancy box = {x−0xA, y−0x1E, x+0xA,
    y+0x1E}; user position (`[user+4]`-vt slot4 getter) tested via
    `[0xBE1734]` point-in-rect; if inside → seat state 1 written
    (`0x6131B9(1, user+0x2944)`), M retrieved via `0x4B1C27(user,&arg)` +
    the `(p!=0)?p-0xC:0` saturating-subtract (the M = holder−0xC idiom), and
    `0x9D35F2(M, seat.x, seat.y)` teleports the move object onto the seat;
    if outside → seat state 0 + `0xA18753([0xBD9020], 0)`.

### 2.2 0x948AA2 — conditional stand-up on (re)spawn (full body this round)

`this` = user (proven: uses the identical `0x4B1C27(this,&arg)` + `p−0xC`
M-retrieval idiom as the 0x9658CC sit path, and 0x9509D7 passes `ecx=ebx`
where ebx is 0x9507F0's this = the user). Behavior:
- `arg1 != 0` → **`call [user-vt+0x38](0)`** (stand-up with notify) — gated
  upstream by an RNG pair in every caller;
- M retrieved; mobility checks `0x70EB9E/0x70EBD8(M)`; conditional
  `0x93CD99(user, eax, 1)`; then user resets: `0x4566FC(user+0x88, arg)`,
  vt slot3, `0x941CE9`, `0x93F864`, `0x940667([user+0x1C1C])`,
  `0x941224([user+0x1C20])`; ret 8.

Callers (all three verified):
1. **0x9509D7** inside 0x9507F0 (cross-map arrival; RNG gate
   `0x416DE8(user+0x265C, [user+0x2664])`, arg2=1) — so portal arrival itself
   fires the stand-up notify when the gate passes;
2. **0x98D0C2** in the user-movement packet spawner (0x98CFxx family: reads
   stance via `0x965A8F` → `[user+0xF04]`, `[user+0x3C0]`, fresh M via
   0x9D359D at 0x98D016) — the periodic server position sync;
3. 0x94489D (same family, not fully read this round).

## 3. Non-user slot14 sites (classification)

- **0x948BD8** — inside 0x948B66 (see §2, user-family-likely, receiver
  formally unproven; kept out of the proven-user count).
- **0x9BCCE1** — receiver is the MOVE object (writes `[M+0x14C]=1`): the
  M-family state driver `0x9BCCC4` = slot9 → (if step) slot14 → slot10 → (if
  ret) slot11. T1 slot14 = 0x9BCCFA = single `ret` stub; T3 = 0x9C4946.
  M-family slot14 is a per-state hook, NOT stand-up.
- **0x923CC5 / 0x924524 / 0x92459A / 0x9245FB** — life-object controllers
  (field signature +0x824/+0x82C/+0x844/+0x848; dynamic flag from a
  `[esi+0x56C]` switch / `sete` of state compares).
- **0x9DDB99** — life sub-object `[edi−0x588]`, flag=ebx (dynamic).
- **0x9F1EC7** — UI-ish `[esi+0x80]` receiver, byte arg 0x49.
- **0x9E05A2** — 3-insn forwarding thunk `0x9E05A0` (calls slot14 of its ecx).
- **0x9DE0BA / 0xA174B7** — HRESULT-checked COM calls with out-pointers.
- **0x9DDF5E** — slot14+slot32 paired COM interface use.
- **0xA11C0E** — global singleton `[0xBD9020]` (scene/field-manager family).
- **0x404B8A … 0x8A280D** (14 sites) — COM/UI/CRT/PCOM families; none reaches
  user-object fields (sampled; bounded claim, not an exhaustive per-site proof).

## 4. Up+down simultaneous input (G41 residual — closed)

Inside T8 (climb) tick `0x9D7ADA` at 0x9D7B8B–0x9D7BD9 (after the UI-focus
gates incl. `[0xBDD89C]`/`[0xBE1790]` keyboard focus and keymap object
`[0xBDF54C]`):
- `0x5CAAA9(keymap=[0xBDD838], VK)` is the key-state reader;
- vertical axis = `(+1 if VK_DOWN(0x28) pressed) + (−1 if VK_UP(0x26) pressed)`
  → **DOWN=+1, UP=−1, simultaneous = 0**;
- horizontal axis = `(+1 if VK_RIGHT(0x27)) + (−1 if VK_LEFT(0x25))` → same
  cancellation;
- the axes are stored via `0x9C4B78(M, horiz, vert)`.
Since the rope-grab adjudication (C-071) branches strictly on the vertical
key's SIGN (key>0 down-grab box, key<0 up-grab box), **simultaneous up+down
yields 0 → neither grab path fires in that tick**; ditto left+right for
lateral input. The adjudication lives in the grab functions; the arbitration
lives in this axis computation — the two formerly-conflated layers are now
separately anchored. The `l` (rope+4) ladder/rope type flag remains without a
static consumer (C-079 stands; T084's record-id-sign fork is untouched).

## 5. G41 ledger impact

P3-15 items: stand-up write chain (C-081) + the flag=0 trigger enumeration
(this round: exactly two user sites, both named, both with their full trigger
chains) + up/down arbitration (this round) are closed. What remains genuinely
open in G41's original scope: none blocking — the residual "general runtime
corroboration" stays optional. Recommend G41 → CLOSED-STATIC (rope/grab
mechanics were already closed by C-069..C-073/C-078..C-080).
