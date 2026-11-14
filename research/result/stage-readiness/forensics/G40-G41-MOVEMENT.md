# G40/G41 — Movement subbranches & rope/seat state machine — targeted static forensics V2

**Round**: t080 (2026-11-13). **Lead agent derivation** (pending independent review).
**Source**: `.work/task-036/game-image-unpacked.bin` SHA-256 `d4a67597…31718` (verified); linear VA mapping (anchor-verified).
**Design-draft claims under test**: §6.5 (foothold transitions, shoe owner), §6.6 (rope/climb/seat), §16.3 (tick).

## 1. Climb `y += 3 × verticalKey` — VERIFIED (0x9D80EC function)

Function 0x9D80EC (fresh SEH prologue, this=move-object esi):
- `[move+0x158]≠0 → 0x9BD567` (velocity integration family, matches T1/EV-22 m4 loop) then `[[0xBDE960]+0x285C] = [move+0x150]` (position publish);
- `[move+0x178]≠0 → 0x9BD58F`;
- rope/decrypt: `0x4B6ABE(&move+0x124, move+0x12C)` → rope object (null → exit);
- `y_cur = 0x548806(&move+0x38)` (decrypt the encrypted double at **move+0x38 — same slot as portal Y**);
- `0x9D814F: fild [move+0x154]` (verticalKey int) `; 0x9D8158: fmul qword [0xB00D68]` — **double at 0xB00D68 = 3.0 (byte-read this session)** `; faddp; 0x9D8163: 0x6131F4(move+0x38, y+3·k)`; `[move+0x48] = ret` (encrypted y mirror).
- **Endpoint adjudication** (labels corrected t082 by C-072/EV-58 — t080 read swapped them; numeric facts unchanged, window re-verified t083):
  - `[move+0x154] < 0` branch (y-decreasing end): if `y < [rope+0x10]` (y-min = **top**, per 0xA4FC6F containment + FSDB y1<y2): `[rope+8]≠0` → `y = top − 5`; else `y = [0x4B6ABE-decrypt(rope)+0x10]` (re-read top);
  - `[move+0x154] > 0` branch (y-increasing end): if `y > [rope+0x14]` (y-max = **bottom**) → `y = bottom + 1`;
  - exit: `call [move.vtable+0x14](move, 0, 0, 0)` — **args (move,0,0,0)** (pushes ebx,ebx,ebx @0x9D8206/07/0D — corrected after adversarial review; earlier draft text said "(move,0,rope,0)").
- ⇒ **`y += 3 * verticalKey` VERIFIED**; unit = the encrypted-double y position (game units), per physics tick of this state; `[rope+0x10]/[rope+0x14]` = top/bottom y (t080's "bottom/top" labels and downward/upward direction words were swapped — see T082-G41 §4 / EV-58).

## 2. Rope grab rectangle — VERIFIED via seat-sibling pattern; rope `0xA4FC6F` not re-dumped this round

- Seat hit rect (0x96595A–0x96597C): seat table `[field+0x16C]` stride 8; rect = `(x−10, y−30, x+10, y+30)` (immediates 0xA / 0x1E) — **seat x±10/y±30 VERIFIED**.
- `0xA4FC6F` (rope grab x±10 per draft) — body not disassembled this round (window budget); kept OPEN.

## 3. Rope-end clear `0x9BFB52` — head verified, body continues

- Reads `move+0x130/+0x134` (same hint pair the cross-map teleport wrote from `[userfield+0x1C/+0x20]`); first vcall `[move.vtable+0x18]([ebp+0x10])`; stores `[move+0x114] = arg` (the rope/userfield ptr); full clear conditions beyond window — OPEN.

## 4. Seat state writer `0x9658CC` — VERIFIED (draft's opcode-0xCF target)

- `[fieldctx(0xBD9028)+0x2088] = 0`; `[+0x208C] = now(0x994C7A)`;
- arg1 = packet/param via `0x4066C9(arg1)`:
  - not-sitting path: `0x6131B9(ecx=0, edx=&user+0x2944)`; **`[user+0x294C] = result`** → clears seat state at **user+0x2944 base**;
  - sitting path: `0x4259A2(arg1)` → seat index; `esi = [0x4376F2()+0x16C] + idx*8`; rect x±10/y±30; current pos via `[[user+4]+0x10]`; hit test via `[0xBE1734](rect, x, y)`;
    - inside → `0x6131B9(ecx=1, edx=&user+0x2944)`; **`[user+0x294C] = 1-handle`** (SIT);
    - then `0x4B1C27(user,&arg)` → move unwrap → **`0x9D35F2(move, seat_x, seat_y)`** — sit position write;
- **`user+0x2944` ownership CONFIRMED** (seat-state subobject; value slot +0x294C; state encoded via 0x6131B9(0/1)).
- Draft's "0x9658CC receives 0xCF" — opcode dispatch binding NOT re-derived (same class of residual as G38's 0x81 registration).
- Seat arrival ALSO reuses the same-map teleport machinery: sibling function at 0x965860-region mirrors seat record `+0xC/+0x10 → user+0xEE8/+0xEEC` and calls **0x963C7D**(user, 0, 0, rec+0x4, rec+0x20, 1) — the up-key portal trigger family.

## 5. Alert / time-step chain — partial (G12/G34)

- `0x9C4B08`: switch on `[move+0x238]` ∈ {0→0x9C4BB0, 1→0x9C4D5D, 2→0x9C4F05, 3→(0x9C538E,0x9C5672)} — state dispatcher;
- `0x9C4B44–0x9C4B6A`: if `[move+0x240]≠0 && [move+0x244]==0`: **`[move+0x248] -= ebx(arg)`**; on negative → `0x9C3E1C(move,0,0,0)` — a per-tick countdown with an EXPLICIT dt argument;
- `0x9C4B6A: 0x9BCD6C(move, ebx)` — main tick processor taking the same dt arg; its body: `[move+0x170] = [move+0x16C]`; `[move+0x158]≠0 → 0x9BD567`; `[move+0x178]≠0 → 0x9BD58F` — **the same integration entrypoints as climb**, so the dt arg flows into the physics integration family (EV-23's 0x1E step input at 0x9BCCFB sits in this same function family).
- **0x1E is NOT proven to be the global fixed tick** — it is one observed step input; the dispatcher accepts a caller-supplied dt ( ebx ). G34 remains OPEN; the "5000 decrement" (G12) now has a structural candidate ([move+0x248] pattern with dt-subtract) but the user+0x3BC-specific decrement path is still unbound.

## 6. Foothold transition `0x9BF1FA` — head verified

- Fresh EBP frame; `0x9BF206: push [arg2]; push arg1; call 0x9BF9D3` (edge finder); `0x9BF213: 0x548806(arg1+0x10)` decrypt current; `fcomp [0xAFECC0]` (a double constant — read: pending, likely 0.0) with `ja/jbe` — above/below tests vs current y;
- `0x9BF253: ecx=[move+0x110]; eax=[ecx+0x4C]` (current foothold); `edi=[eax+0x50]` (**prev/next neighbor slots at foothold+0x4C/+0x50 — DRAFT'S +0x4C/+0x50 VERIFIED**); `edi≠ecx` guard;
- `0x9BF277: fld [edi+0x30]` (neighbor geometry) + `fcomp` — neighbor slope test; continues into the transition proper (window ends).
- The preceding 0x9BF160 function is a pure integer cross-product (orientation test: `(x2−x1)·(y3−y1) − (y2−y1)·(x3−x1)` twice) — the segment-side classifier feeding the transition.

## 7. Vertical-line collision `0xA4F6F1` — R12 ambiguity RESOLVED AS CALLER-DEPENDENT

- Fresh function (SEH, `ret 0x10` for the PREVIOUS function at 0xA4F6E0 → 0xA4F6F1 starts its own frame):
- args: `[ebp+8]=x, [ebp+0xC]=yTop, [ebp+0x14]=yBottom(esi), [ebp+0x18]=halfWidth`;
- `if yBottom < yTop → return 0` (no vertical span);
- queries `0x5114AA(collection+0x44, x−halfWidth, yTop−1, x+halfWidth, yBottom, &{dword@0xB00D88})` — **an axis query box of width 2·halfWidth around the line x** (the 0xB00D88 slot is a marker/output slot — its static bytes are a code-VA low dword, not a meaningful constant; reviewer note);
- walks result chain `[[result+4]→[+0x14]…]` for candidates.
- ⇒ The collision half-width is a PARAMETER, not a hardcoded constant; the R12 "vertical line = zero width vs half width" conflict is settled per-callsite: whichever value callers pass at 0xA4F6F1's E8 sites decides. **First concrete call-site data point (reviewer, adversarial round): the same-map portal trigger passes halfWidth = 1 (@0x963D64 `push 1` before the call).** (Full call-site argument audit = next-round minimal action; the portal x±20 / rope x±10 constants are separate immediates in their own functions.)

## 8. Shoe/decrypt owner `0x94B9C2 → 0x9BFD4C` — VERIFIED as owner-copy pair

- 0x94B9C2 (tiny): `eax=[this+0x20]; [out+4] = eax; if eax → [0xAFE1BC](eax+4)` (refcount); `ret 4` — **reads owned slot +0x20 and hands it out**;
- 0x9BFD4C: `edi=arg; [0xAFE1BC]([edi+4]+4)` (release old); if `[this+4]≠0 → 0x51844D(this,0)`; `[this+4] = [edi+4]` — **installs the slot into a owning wrapper**;
- family context: 0x9BFD85 = C-035 RNG-pair writer (0x416E71/0xBDF028/0xBAADF00D) — the decrypt-pair machinery sits in the same object family as the shoe/walk slots (supports draft's "decrypt槽 ownership" framing);
- **the four DEC([move+0x190])=1 slots / shoe +0x198 default values from the draft were NOT re-derived this round** (require the walk-state function body; kept OPEN — draft claims remain C-grade until then).

## 9. Verdict table

| sub-behavior | verdict | grade |
|---|---|---|
| climb `y += 3·verticalKey`, constant 3.0 @0xB00D68, slot move+0x38 | VERIFIED | DIRECT-INSTRUCTION + DIRECT-DATA |
| climb endpoint clamps (top−5 with uf / bottom+1 / rope-y fallback — labels corrected t082 by C-072/EV-58; t080 said bottom−5 / top+1); exit vcall args (move,0,0,0) | VERIFIED | DIRECT-INSTRUCTION |
| seat rect x±10/y±30 (stride-8 table at field+0x16C) | VERIFIED | DIRECT-INSTRUCTION |
| seat state write user+0x2944 base / +0x294C via 0x6131B9(0/1) | VERIFIED | DIRECT-INSTRUCTION |
| seat arrival reuses 0x963C7D teleport trigger family | VERIFIED | DIRECT-INSTRUCTION |
| foothold neighbors at fh+0x4C/+0x50 consumed in 0x9BF1FA | VERIFIED (head; full transition body OPEN) | DIRECT-INSTRUCTION |
| 0xA4F6F1 vertical query takes caller halfWidth (x±w box) | VERIFIED | DIRECT-INSTRUCTION |
| R12 conflict resolution | RESOLVED-AS-CONDITIONAL: width = callsite arg (audit pending) | DERIVED-FROM-INSTRUCTION |
| tick dt is caller-supplied through 0x9C4Bxx → 0x9BCD6C; 0x1E not proven global | VERIFIED (structure) | DIRECT-INSTRUCTION |
| shoe +0x198 defaults, four DEC slots, walk full body | OPEN (not re-derived) | — |
| rope grab 0xA4FC6F x±10 | OPEN (window budget) | — |
| alert user+0x3BC decrement binding to the [move+0x248] pattern | HYPOTHESIS | INFERENCE |

## 10. Residual

1. 0xA4F6F1 call-site argument audit (settles concrete half-widths for R12).
2. 0x9BF1FA full transition body (slope recompute, drop-on-no-neighbor).
3. Rope grab 0xA4FC6F body.
4. Walk-state body for shoe defaults/four DEC slots.
5. 0xCF opcode registration (seat) — same class as G38 0x81.
