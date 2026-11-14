# T082 — CMS079 Independent Static Forensics Blind Review

**Reviewer**: t082 (independent context, no lead-agent pseudocode used)
**Date**: 2026-11-14
**Inputs (hashes independently verified with own code)**:
- `.work/task-036/game-image-unpacked.bin` SHA-256 `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` ✅
- `.work/task-001/extracted/冒险岛online/Gr2D_DX8.dll` SHA-256 `ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1` ✅

**Method**: own Python harness (capstone 5.0.7 + pefile), linear VA mapping `fileOffset = VA − 0x400000` for EXE; PE section table for DLL. All disassembly windows with raw bytes+mnemonic saved in this directory. Repo untouched (read-only).

**Independently verified helper semantics (used throughout)**:
| fn | semantics | evidence |
|---|---|---|
| `0x548806(ptr, key)` | decrypt 8-byte double at `ptr` (2-dword xor chain, 0xBAADF00D, decimal helpers 0xA705FB/0xA700F4); verifies accumulated key vs arg2 (mismatch → error 5 via 0xA6FC9B); result in st0 | body re-read |
| `0x6131F4(ecx=slot, double by val)` | encrypted setter: key = 0x416E71(0xBDF028) RNG; `ret 8`; returns key → caller stores at `slot+0x10` | body re-read |
| `0xA70F94` | MSVC `_ftol` (fldcw 0x0C truncation), eax:edx | body re-read |
| constants | `[0xAFEC20]=0.5`, `[0xAFECC0]=0.0`, `[0xB00D60]=0.499999999`, `[0xAFECB8]=1.0`, `[0xB00D68]=3.0` | byte-read |

---

## Structural discovery (affects all tasks): TWO vtable families on the move object

1. **COM/QI wrapper family** (8 tables: 0xB0C3E8, 0xB0C5B0, 0xB0C6B0, 0xB0C7C0, 0xB0C8C0, 0xB0C9C0, 0xB0CAC0, 0xB0CBC8): slot0 = 0x9C0EC0 (4-IID QI dispatcher, C-031), slot16 (+0x40) = 0x9C1113 (same-map teleport writer). These are the tables G38 enumerated.
2. **Per-state move family** (8 tables enumerated: **0xB0C498, 0xB0C660, 0xB0C760, 0xB0C870, 0xB0C970, 0xB0CA70, 0xB0CB70, 0xB0CC78**), slots (0xB0CB70 shown; variants in brackets):
   - slot0 +0x00: state handler (0x9D356B)
   - slot1 +0x04: **0x9BC622** cross-map writer (variants 0x9C3DD1, 0x9C9983, 0x9CFCB4, 0x9CBE4F)
   - slot3 +0x0C: **0x9BF1FA** foothold transition (variants 0x9C5B8A, 0x9CCAA8)
   - slot4 +0x10: **0x9BE703** physics main loop (= C-029 m4 ✓; variant 0x9C6028, 0x9D06D4)
   - slot5 +0x14: **0x9BFB52** SetStandingContext (variant 0x9D3CCA in 0xB0CB70)
   - slot6 +0x18: 0x9BC404 moved-along notify (variant 0x9D3DE6)
   - slot10 +0x28: per-state tick; **0xB0CC78's = 0x9D7ADA = the rope grab function**
   - slot13 +0x34: 0x9BCA6F; slot14 +0x38: 0x9BCCFA (C-030)

Full slot dumps in `statevtables.txt`.

---

## Task A — G38 foothold rebind chain

### A.1 `0x53E95D` (0x53E95D–0x53EA07, thiscall, ret 4) — VERIFIED: notification marshaller, NOT a rebind

Body: `edi = this`; decrypts the four encrypted doubles (this+0x20 X, +0x38 Y, +0x50, +0x68 — the move-inner layout); `ebx = [this+0x148]`; `esi = 0x4B6ABE(&this+0x124, [this+0x12C])` (rope handle decrypt); converts the four doubles to ints via chained `_ftol` (the interleaved pushes ARE the cdecl arg-marshaling of the final call); calls:

```
0x6B87D1(ecx = this+0x19C, 3, [this+0x110], [this+0x118], rope, X, Y, v1, v2, [this+0x148], 0)   ; ret 0x28
```

`0x6B87D1` = **0x14-byte record maintenance**: allocates/fetches a record via `0x6B91E3` (node-pool/list at this+0x10 of the move+0x19C subobject), dedups by {type byte[+0], word[+0xC] (=[ctx+0x48] or −word[rope]), word[+0xE] (=[arg3+0x48]), byte[+0xA], range words}, fills {byte[+0]=kind, word[+2]=X, +4=Y, +6=v1, +8=v2, +0xA=[move+0x148], +0xC/+0xE=fh/rope ids}, accumulates counter word[+0x10]. **X/Y enter the record as 16-bit words.** Foothold/rope id convention: `word[[ctx+0x48]]` for the standing ctx, `−word[rope]` (negated) when only the rope handle exists.

**No foothold query is executed anywhere in this chain** (0x6B87D1 has no query calls; 0x6B8A18/0x6B8701 are sibling record/notify functions).

### A.2 `0x9BC89F` / `0x9BC992` (ret 8, thiscall) — VERIFIED: line-parameter projection pair

Transform record layout (rope/segment "line object"; same object family as the standing ctx):
`{+0xC: n1 (x1, int), +0x10: n2 (y1, int), +0x1C: x2, +0x20: y2, +0x30: m1 (cos, double), +0x38: m2 (sin, double), +0x40: len (double), +0x48: word id, +0x4C/+0x50: neighbor links}`

- `0x9BC992(this=dest4slots, arg1=src2slots, arg2=xf)`: slot1 = a·m1+n1; slot2 = a·m2+n2; slot3 = b·m1; slot4 = b·m2 (a = dec(src+0x00), b = dec(src+0x18)) — **line→world** (position + along-line velocity components).
- `0x9BC89F(this=dest2slots, arg1=src4slots, arg2=xf)`: axis choice by `0xA70FBB(m1)` (floor-family) ≤ 0.5; t = (S−nK)/mK on the dominant axis; slot2 = m1·v1+m2·v2 (velocity projection = speed along line); then clamp t to [0, [xf+0x40]] — **world→line**.

Call-site census (E8 scan): 0x9BC89F ← {0x9BC715 (cross-map arrival), **0x9D7ACB (rope grab path)**}; 0x9BC992 ← 18 sites {0x9BC724, 0x9BF006/06B/127/29B/3B4/577/640/6CF/758 (0x9BF1FA-family), 0x9C3EEF, 0x9C44D1/5AD/610, 0x9C9A14/BD0/C8D/CD7}.

### A.3 Caller `0x9BC622` (0x9BC622–0x9BC89C, ret 0x1C = 7 args) — VERIFIED with full inventory

args per G38: (1, X, Y−10, 0, 0, user+0x3C0, 0) via vtable slot m1.
1. `[move+0x18] = a1`; X clamped to [move+0x138, move+0x140], Y to [move+0x13C, move+0x144].
2. Encrypted setters: move+0x20 = X, move+0x38 = Y, move+0x50 = a4, move+0x68 = a5 (velocity zeroing ✓ C-055).
3. state = [move+0x14]→vt0(); **if state ≠ 7 → [move+0x110] = a7** (standing ctx install).
4. `[move+0x118] = 0`; if [move+0x110] ≠ 0 → **hints [move+0x130]/[move+0x134] = [ctx+0x1C]/[ctx+0x20]** (0x9BC6FB–0x9BC70F), then
   `0x9BC89F(move+0xE0, move+0x20, ctx)` followed by `0x9BC992(move+0x20, move+0xE0, ctx)` — **position snapped by exact 2D projection onto the ctx line segment, clamped to [0, len]** (high-elevation recompute included: both X and Y are re-derived from t).
   else → [move+0x130] = eax(=7 stale), [move+0x134] = 0.
5. `rep movsd 0x18` dwords: move+0x80.. ← move+0x20.. (second-copy mirror of the 4 slots ✓ G38 "+0x80/+0x98 second copies").
6. If a6 ∈ {0,1}: `[move+0x14]vt1(0, 0, a6&1, move)`.
7. `[move+0x148] = a6`; flag = (state ∈ {0,3}) ? 1 : 0 (three vt0() tests ==7/==0/==3/==4).
8. Decrypts the 4 slots again → `0x6B8701(move+0x19C, a1, flag, v2, v1, Y, X, a6, a7, 0)` (record notify).
9. `[move+0x154] = 0` (verticalKey), `[move+0x150] = 0`, `[move+0x190] = 0`; release move+0x194 (0x51844D).
10. If a1 ≠ 0: `[move+0x190] = [Physics([0xBDD498])+0xAC]` (C-030 re-seed ✓); install `[move+0x14]vt3()` result into move+0x194 via 0x9BFD4C.

### A.4 Answers to the seven questions

| # | question | verdict | key facts |
|---|---|---|---|
| 1 | Who executes the fh query? | Same-map: **nobody in the 0x53E95D chain** — it is record-notification only (0x6B87D1). Cross-map: no query either — the caller-supplied ctx (user+0x3C0) is projected onto. Actual spatial queries live in the physics tick: 0x9BE703 → 0x5114AA swept-box (0x9BE853–0x9BE888) and 0xA4F6F1 | 0x53E95D→0x6B87D1 (no query); 0x9BC622 (no query); 0x9BE703@0x9BE888 |
| 2 | move+0x130/+0x134 consumers; do hints override queries? | Consumers: 0x9BFB52 (default + change-detect → vt+2-of-inner notify), **0x9BE913 (physics loop: candidate[+0x20] vs move+0x134 identity compare)**, 0x9C5E32/0x9CCBED (walk: vt+0x18 result vs move+0x134). **Hints never feed query coordinates** — all queries use decrypted X/Y | addresses above |
| 3 | X/Y or Y−10 for fh query? | Queries use **rounded X/Y directly** (round-half-away: +0.5 / −0.499999999 then _ftol). The −10 exists only in teleport/grab CALLERS before writes (0x963D6D trigger; 0x950964 cross-map; grab boxes) | 0x9BE724–0x9BE7F3 |
| 4 | Downward nearest-standable search? | Yes in the vertical queries: 0xA4F6F1 keeps the **topmost crossing** (each accepted y shrinks the upper bound, 0xA4F7A5); 0x9BE703's candidate loop iterates the swept box | 0xA4F795–0xA4F7A8 |
| 5 | No-candidate handling? | 0xA4F6F1 → returns 0, *outY untouched. 0x9BF1FA no-neighbor → clamp t (0 or len by direction), interpolate speed, reproject on current ctx, **vt+0x14(move, NULL, 0, consumed) → ctx cleared**, ret 1 (drop trigger; no internal state switch) | 0x9BF654–0x9BF6E2 |
| 6 | Coordinate snapped to slope? | **Yes** — arrival: exact projection+clamp via 0x9BC89F/0x9BC992 pair; walk transitions: world re-derived parametrically from t via 0x9BC992 on every step; rope grab: X←rope x, Y←top/min | A.3 step 4; 0x9BF3AF |
| 7 | Fields holding fh id/ptr/links? | move+0x110 ctx ptr; move+0x114 ctx copy; move+0x118 flag (kind-0xF gate); move+0x124/+0x12C encrypted rope-handle pair; move+0x130/+0x134 ctx x2/y2 (identity hints); move+0xE0..+0xF8 line-state (t, speed); move+0x80.. second copies. Line object: +0x48 word id, +0x4C/+0x50 prev/next links, +0x30/+0x38 unit dir, +0x40 len | — |

**Counter-evidence actively sought**: searched for any query parameter sourced from move+0x130/+0x134 — none (only identity compares); searched 0x6B87D1/0x6B8701/0x6B8A18 for query calls — none; verified the "7" written to move+0x130 on the no-ctx path is stale-eax (push 7; pop eax at 0x9BC6D6-0x9BC6D8), i.e. a compiler artifact, not a designed x-hint — flagged as a static oddity.

---

## Task B — G40 full segment-transition chain `0x9BF1FA`

**Extent 0x9BF1FA–0x9BF6E9, ret 8** (this=move ebx, arg1 = src 2-slot base [ebp+8], arg2 = int* budget [ebp+0xC]). It is **slot3 (+0x0C)** of 7/8 per-state vtables (variants 0x9C5B8A in 0xB0C760, 0x9CCAA8 in 0xB0C970).

1. `[ebp-8] = 0x9BF9D3(this, arg1, *arg2)` — **0x9BF9D3 is NOT a segment-edge finder**: it is a **map-horizontal-bounds clamp**. It computes worldX = round(dec(move+0xE0.t))·[ctx+0x30] + [ctx+0xC], compares vs [move+0x138]/[move+0x140]; on violation clamps t to (bound−x1)/m1, zeroes speed, and returns the consumed portion = int(fraction × budget) clamped [0, budget]. (Refines t080's "edge finder" label.)
2. Branch structure (all on encrypted decryptions of src.t and move+0xE0.t):
   - Backward (src.t ≤ 0 < line.t): F = [[move+0x110]+0x4C]; N = [F+0x50]; guards N≠0, N≠ctx; if [N+0x30] > 0 → transfer: t=0 (or t=[N+0x40] via 0x9BF343), `0x9BC992(move+0x20, move+0xE0, N)` (position = N anchor/far-end), `vt+0x14(move, N, 0, 0)`. Else clamp t=0/speed=0.
   - Forward (src.t ≥ len, line.t < len): N = [[ctx+0x50]+0x4C]; guards; if [N+0x30] > 0 → transfer with t=[N+0x40]; else clamp t=len/speed=0 or ctx=NULL (see 5).
   - **prev/next adjacency at fh+0x4C/+0x50 VERIFIED** with explicit selection rule: transfer only into a neighbor whose direction component [+0x30] is strictly positive and which is not the current ctx (self-loop guard `cmp edi, ecx` 0x9BF26F/0x9BF331).
3. Crossing interpolation (0x9BF3D0 sub-path): copy of line-state to stack; speed branch flag [ebp-4] (<0 backward); ratio r = t/(t−speed) (backward) or (len−t)/(speed−t) (forward); **consumed = int(edge_result × r)**; `*arg2 -= consumed`; if neighbor = 0 → see 5.
4. On transfer: t = (backward? [N+0x40] : 0) — direction-dependent landing end; new speed = src_speed + (line_speed − src_speed)·r (linear interpolation), sign-consistency clamp (0x9BF5F3–0x9BF639); `0x9BC992(move+0x20, move+0xE0, N)`; `vt+0x14(move, N, 0, consumed)`; **ret 1**.
5. **No-neighbor drop path** (0x9BF654): t = clamp end (0 if backward, len if forward), speed interpolated, `0x9BC992(move+0x20, move+0xE0, [move+0x110])` (reproject on CURRENT ctx), **`vt+0x14(move, NULL, 0, consumed)`** → standing ctx cleared; ret 1. No state switch or virtual drop call inside — the drop is signaled by ctx=NULL to the state layer.
6. In-segment main path (0x9BF371→0x9BF3AF): `0x9BC992(move+0x20, move+0xE0, [move+0x110])` (reproject world from t — slope elevation recompute every step); `*arg2 -= edge_result`; `vt+0x18(move, edge_result)`; **ret 0**.
7. Exit-field consistency: every exit re-encrypts (t, speed) pair + performs one 0x9BC992 reprojection + exactly one notify (vt+0x14 on transfer/clear, vt+0x18 on in-segment). Horizontal velocity: not truncated — the along-segment speed is interpolated/clamped and world components are re-derived (slot3/slot4 = b·m1/b·m2).
8. No re-issued collision query inside the function (pure parametric walk). Callers (0x9C5F53 in a function that pre-checks [ctx+0x38]·f > 0 and compares a vt+0x18 result vs **move+0x134**; 0x9CCC8D same shape) pass a remaining-budget int*; recursion/loop lives in the caller.

**Counter-evidence sought**: looked for a lateral-velocity truncation (fstp/fldz on slot3/4) — none; looked for a state-switch vcall on the no-neighbor path — none (only vt+0x14 with NULL).

---

## Task C — G41 rope grab/leave + vertical-line call-site audit

### C.1 `0xA4FC6F` (0xA4FC6F–0xA4FCF5, ret 0x10) — VERIFIED

Pure spatial query, thiscall: `this = ecx` (**[0xBDD498] at all call sites** → rope table at `[this+0xA8]`, count at `[table−4]`, stride **0x1C** records `{+0xC x, +0x10 y1, +0x14 y2}`):
- X range = **[min(x1,x2) − 10, max(x1,x2) + 10]** (0xA4FC94/0xA4FC98 — the ±10 is an expansion of the CALLER-PROVIDED x span, not an assumption);
- Y range = exact [min(y1,y2), max(y1,y2)] overlap of the record's [y1,y2] — **no y expansion**;
- returns RopeRecord* or 0. **No rope/ladder type flag, no up/down key logic, no state gating, no writes** — all of those live in the callers.

Callers (6): 0x9D4473/0x9D45C3/0x9D4739 (state family with validator **0x9D4975**) and 0x9D7D4F/0x9D7E9F/0x9D8015 — the latter inside **0x9D7ADA = slot10 (+0x28) of per-state vtable 0xB0CC78** (validator **0x9D8218**). Common gating (0x9D7ADA flow):
1. current rope handle (0x4B6ABE(move+0x124, move+0x12C)) must be **0** (not already attached);
2. verticalKey [move+0x154] sign selects the branch; validator ≠ 0;
3. **DOWN** (key<0, 0x9D7DBE): query `0xA4FC6F([0xBDD498], X, Y, X, Y−20)` → box [X±10]×[Y−20, Y]; on hit: zero BOTH velocities (0x6131F4 fldz at move+0x68 then move+0x50), `X ← [rec+0xC]`, `Y ← min(Y, [rec+0x14])`, `vt+0x14(move, rec, 0, 0)`, ret 1;
4. **UP** (key>0, 0x9D7F0B): query `0xA4FC6F(..., X, Y, X, Y+10)`; additional gate `[rec+0x10] ≤ Y+10` (rope top within reach, 0x9D8088 `jg` reject); on hit: zero velocities, `X ← [rec+0xC]`, `Y ← [rec+0x10]` (top), `vt+0x14(move, rec, 0, 0)`, ret 1.
- Up/down are mutually exclusive by key sign (checked in down-then-up order within one tick).
- Foothold not "cleared" — it is REPLACED: vt+0x14 installs the rope ctx into move+0x110 (and via 0x9BFB52 the encrypted handle into move+0x124).

### C.2 `0x9BFB52` (0x9BFB52–0x9BFC32, ret 0xC) — VERIFIED: it IS slot5 "SetStandingContext"

1. `vt+0x18(move, arg3)` first (moved-along notify);
2. (x,y) defaults = hints (move+0x130/+0x134); if arg1 ≠ 0 → override from **[arg1+0x1C]/[arg1+0x20]**, `move+0x114 = arg1`, `move+0x118 = 0`, release [move+0x120] (0x5117D1); elif arg2 ≠ 0 → x = [arg2+0x18], y = 0, `move+0x118 = 0`, `move+0x16C = 0`;
3. if (x,y) changed → store hints, `[[move+0x14]vt+2](move)` notify;
4. `[move+0x110] = arg1`; `0x9BFD85(arg2, &move+0x124)` encrypts the handle pair (key → [move+0x12C]);
5. `[move+0x148] = [[move+0x14]vt4]([move+0x150], [move+0x154], [move+0x148], move)` — state counter advance;
6. tail `0x9BFC35`: re-decrypts all four slots + rope handle; kind = 0x11 if [move+0x16C]≠0, else 0xF if [move+0x118]≠0, else 0; `0x6B8949(move+0x19C, kind, [move+0x110], [move+0x118], rope, X, Y, v1, v2, [move+0x148])` — forced-new-record notify (ret 0x24 variant of 0x6B87D1).

No position snapping inside 0x9BFB52 (positions are handled by grab/0x9BF1FA/0x9BC622). Re-entry to gravity: ctx=NULL paths come from 0x9BF1FA's no-neighbor exit and the climb endpoint exits (`vt+0x14(move,0,0,0)` per C-056, re-verified constant 3.0 at 0xB00D68); the state layer then resumes 0x9BD567/0x9BD58F integration in 0x9BCD6C→0x9BE703.
Variant 0x9D3CCA (slot5 of 0xB0CB70) pre-processes (keypad/state checks incl. [move+0x238] frame budget 0x150/(state−0x12)) and tail-calls 0x9BFB52 at 0x9D3DDA (its only E8 caller).
Walk-state sibling (function ending 0x9BCC97): input>0 → ctx via `0x517DA8`; input<0 → rope record via `0x9BCC9A` (the stride-0x1C accessor); writes hints from [ctx+0x1C]/[+0x20]; maintains move+0x124 pair (0x9BFD85 / 0x4B6ABE change detection).

**Static tension (OPEN)**: the grab passes the 0x1C-stride compact record as slot5 arg1, and 0x9BFB52 reads [arg1+0x1C]/[arg1+0x20] — which lands on the ADJACENT entry of the compact table. Either (i) the [this+0xA8] table entries are sub-records of larger allocations, or (ii) hint reads on rope-grab read neighbor-entry data. No runtime data to distinguish; flagged as falsifiable (dump move+0x130/+0x134 at a rope grab).

### C.3 `0xA4F6F1` call-site audit (24 E8 sites; ret 0x14 = 5 args + this; arg order (x, yTop, outY*, yBottom, halfWidth), pushes right-to-left)

| halfWidth | sites | classification |
|---|---|---|
| **1** (immediate) | 0x546803, 0x54709B, 0x5BFEDA, 0x5CDC9C, 0x5CE033, 0x5CE496, 0x7C3F5C, 0x7C439E, 0x7C484C, 0x953236, **0x963D72** (portal trigger: pushes 1, 0x7FFFFFFF, 0, Y−10, X — t080's data point re-confirmed), 0x9640E7, 0x9641B9, 0x977F52, 0x97A2B9, 0x97A32E, **0x9CC207** (pushes 1, 0x7FFFFFFF, &[ebp-0x28], edi=Y−10, X) | Portal trigger family (0x963xxx/0x964xxx), teleport-apply (0x953236), map-transition (0x977F52, 0x97A2B9, 0x97A32E), movement-internal (0x9CC207), non-movement/UI (0x546/0x547/0x5BF/0x5CD/0x5CE/0x7C3-0x7C4) |
| **2** (immediate) | **0x9C6B68** (pushes 2, 0x7FFFFFFF, 0, Y, X) | Movement (0x9C6Bxx, same function as 0x9C6BBA 0x53E95D caller) |
| dynamic (register) | 0x70D024 (edi), 0x9364D4 (edi), 0x9364FF (edi), 0x955498 (esi) | user-helpers / same-map apply |
| window undecodable | 0x964074 (structurally same family as 0x9640E7 → likely 1) | Portal trigger |

Canonical non-movement shape: `(x, yTop, 0, 0x7FFFFFFF, 1)` — plumb-line to map bottom. Full windows in `C3_A4F6F1_callsites.txt`.
**R12 resolution stands** (C-058): width is a per-call-site argument; observed static values are 1 (dominant), 2 (one movement site), and register-dynamic (4 sites).

> **t083 correction footnote (F3)**: the "dynamic (register)" and "window undecodable" rows above were superseded by the t083 full re-audit (`T083-A4F6F1-CALLSITE-AUDIT.txt` / EV-57): 0x70D024/0x9364D4/0x9364FF carry **constant edi=1** (push 1; pop edi immediately before), 0x93652A (unlisted above) likewise edi=1, 0x955498's halfWidth is the leftover constant **1** from the abs() helper argument slot (esi was abs()'s argument, not the width), and 0x964074 decodes cleanly as **push 1** @0x964068 (the t082 window was mis-aligned). Corrected census: **23×1 + 1×2, 0 dynamic, 0 undecodable**. This archive records the t082 blind-review state and is retained as audit history.

---

## Task D — R13 disputed call sites

### D.1 EXE `[ebp-0x20]` anomaly (function 0x666C0D–0x667052) — SOLVED: compiler stack-slot reuse

Writers of [ebp-0x20] (complete census):
- `0x666C2B, 0x666C6A, 0x666D92`: `mov [ebp-0x20], esp` — esp-temps for the id-lookup helper (0x7A48D0(&stackdword, id)); dangling after the helper returns (MSVC esp-save artifacts);
- `0x666D25`: `mov [ebp-0x20], esp` — stack-package cdecl marshaling temp;
- **`0x666DC9`: `mov [ebp-0x20], eax`** — eax = 0x403211() = the **x-int of property 0x331** (id-lookup chain 0x7A48D0→0x406368→0x40263B→0x403AC7→0x403211 at 0x666D95–0x666DC4);
- `0x6670D9`: `mov [ebp-0x20], ecx` — inside a DIFFERENT function (0x667055+), not this frame.

Readers:
- `0x666ECE`: `push [ebp-0x20]` — the int consumed as 0x427EB3 arg2 (x-int) — **live range of the int ends here**;
- `0x666F22`: `lea eax, [ebp-0x20]; push eax` — address taken; the push survives no-arg `0x414A49` (verified body: pure null-checked deref, `ret`, takes no stack args) and becomes the arg of **`0x404BA3`**;
- `0x666FAC`: `mov eax, [ebp-0x20]; if ≠0 → call [[eax]+8](eax)` — Release-class read.

**0x404BA3 verified as the re-writer**: body = `push [vt+0x68]([this], &[ebp-4]) out; eax=[ebp+8]; ecx=[ebp-4]; mov [eax], ecx; ret 4` — writes the out slot. Therefore between the int-read (0x666ECE) and the Release-read (0x666FAC) the slot is re-initialized as an OBJECT POINTER by 0x404BA3's out.

Competing explanations:
1. **Stack-slot reuse across disjoint live ranges (VERIFIED)** — [ebp-0x20] = ≥4 logical variables (3× esp-temp, 1× int, 1× out-object). Refutation condition: differing bytes at 0x404BA3/0x666F25, or 0x414A49 turning out `ret 4` (it is `ret` — verified).
2. **Decompiler variable-merge artifact (explains the appearance, not the facts)** — pseudocode presents one variable; instruction-level shows the boundary at 0x666F2D/0x404BA3. Refutation: any value-flow from 0x666DC9 to 0x666FAC that does not pass through 0x404BA3's out (none exists: the only address-taker is 0x666F22).
3. **VARIANT/smart-pointer layout misjudgment (REFUTED)** — the int at 0x666DC9 and the pointer at 0x666FAC are never simultaneously live; SEH scope bytes ([ebp-4] indices 2,4,6,…,0x1A) order the scopes consistently; no cross-function write (0x6670D9 belongs to 0x667055's frame).

### D.2 DLL candidate vtable `0x5042D204`

(a) **Legal vtable start: YES** — installed by constructor `0x504013E3` (`mov [edi], 0x5042D204` @0x5040140E; second initializer `0x50401430` @0x50401430; ctor called from 0x50401338). All dwords in the cluster point into `.text` (0x50401000–0x5042D000).
(b) **"47 entries" = run-scan artifact**: the constructor proves the region is a **vtable GROUP**: outer @0x5042D204 ([this+0x00]), inner interface @0x5042D224 ([this+0x10]), inner interface @0x5042D210 ([this+0x14]) — each with its own QI/AddRef/Release prologue (outer: 0x504014A5/0x50410720/0x50401472; 0x5042D210: 0x5040184E/58/62; 0x5042D224: 0x50401522/0x50401502/0x50401512). As a SINGLE table the 47-slot claim is REFUTED; as the count of consecutive .text pointers in the cluster it is correct (47 exactly, cluster ends 0x5042D2C0).
(c) **slot +0x58 → 0x50403EFC: VERIFIED** ([0x5042D25C] = 0x50403EFC).
(d) **reads [this+0x28]: VERIFIED** — `0x50403EFC: eax=[esp+8](out); null→E_POINTER; ecx=[esp+4](this); ecx=[ecx+0x28]; [out]=ecx; xor eax,eax; ret 8` — a getter (*out = [this+0x28]).
(e) **Relation to 0x5042D140 (40 slots, C-005)**: separate class clusters, NOT overlapping; separated by the ATL intmap at 0x5042D1E0 = `{E576EA33…, 0, 1}, {00000000-0000-0000-C000-000000000046 (IUnknown), 0, 1}, {0,0,0}` (IIDs byte-verified). **Ownership refinement**: the intmap is CONSUMED by the 0x5042D204-class (inner-iface QI 0x50401522 → 0x50401945 AtlInternalQueryInterface with pEntries=0x5042D1E0 @0x5040154E-0x50401554), while table A's slots 0–2 are `sub [esp+4],4; jmp` this−4 adjustor thunks into the 0x504013CA family — i.e. A and B belong to two related but distinct classes; the intmap is B-side. C-005's statement (intmap adjoins the 40-slot table) remains locationally true; if any consumer attributed the intmap to the A-class, that is corrected here.
(f) **Static binding**: constructors 0x504013E3 (from 0x50401338) and 0x50401430 install 0x5042D204; the object also locks a module counter (push 0x50439B3C; call [0x5042D028] — an IAT import, hint 0x33F84). **Runtime object identity binding (which vtable the live [0xBE2788] object uses) is NOT statically provable** — that remains the G24-class runtime dump. The distinction "adjacent-vtable/getter discovery (static)" vs "runtime object identity binding" is hereby explicit.

---

## Verdict tables

### Task A
| sub-behavior | verdict |
|---|---|
| 0x53E95D = thin marshaller → 0x6B87D1 record notify (no fh query) | VERIFIED |
| 0x9BC89F/0x9BC992 = inverse/forward line projection (world↔t,speed) with clamp | VERIFIED |
| 0x9BC622 full arrival inventory (clamp→write→ctx install→projection snap→mirror→notify→resets) | VERIFIED |
| hints move+0x130/+0x134 = ctx x2/y2; identity-compared only, never query inputs | VERIFIED |
| fh queries use rounded X/Y (no −10 inside); −10 belongs to teleport callers | VERIFIED |
| no-candidate → clamp + vt+0x14(NULL) + ret 1 (drop signal) | VERIFIED |
| 0x1C-stride compact rope table vs full line-ctx object duality | VERIFIED (tension on grab-hint reads flagged OPEN) |

### Task B
| sub-behavior | verdict |
|---|---|
| full 0x9BF1FA body recovered (0x9BF1FA–0x9BF6E9) | VERIFIED |
| fh+0x4C/+0x50 neighbor links + [N+0x30]>0 transfer rule + self-loop guard | VERIFIED |
| 0x9BF9D3 = map-bounds clamp + partial-step (not segment-edge finder) | VERIFIED (label corrected) |
| crossing interpolation ratio + consumed-budget accounting | VERIFIED |
| no-neighbor → ctx=NULL via vt+0x14, ret 1, no state switch | VERIFIED |
| lateral velocity not truncated; world re-derived parametrically | VERIFIED |

### Task C
| sub-behavior | verdict |
|---|---|
| 0xA4FC6F hit box = x-span ±10, exact y overlap, stride-0x1C table | VERIFIED |
| up-grab (X, Y..Y+10, top≤Y+10), down-grab (X, Y−20..Y) boxes | VERIFIED |
| grab writes: zero v-both, X←rope x, Y←top / min(Y, y2), vt+0x14(rope) | VERIFIED |
| rope/ladder type distinction | OPEN (no flag check found in query or grab paths read; ladder-vs-rope split may live in 0x517DA8 vs 0x9BCC9A walk-side selection) |
| 0x9BFB52 = slot5 SetStandingContext (hints/handle/notify/state-advance) | VERIFIED |
| 0xA4F6F1 audit: 17×w=1, 1×w=2, 4×dynamic, 1×undecodable | VERIFIED (0x964074 PARTIAL) |

### Task D
| sub-behavior | verdict |
|---|---|
| [ebp-0x20] anomaly = stack-slot reuse; 0x404BA3 re-writes slot between reads | VERIFIED (2 explanations + refutation conditions given) |
| 0x5042D204 legal start / +0x58 → 0x50403EFC / reads [this+0x28] | VERIFIED |
| 47 slots as single table | REFUTED (vtable group per constructor) |
| intmap ownership → B-class QI chain | VERIFIED (refinement of C-005 context) |
| runtime identity binding of 0x5042D204-class | OPEN-RUNTIME (explicitly distinguished from static discovery) |

---

## Conflicts / corrections vs claims.csv and t080 docs

1. **No CLOSED claim refuted.** C-054/C-055/C-056/C-057/C-058/C-029/C-030 all re-confirmed at instruction level (0x9BC622 clamps/hints; climb constant 3.0; seat rect untouched this round).
2. **G38 §3 semantics refined (its own OPEN item)**: "rebind helpers 0x9BC89F/0x9BC992" are not a foothold SEARCH — they are the projection snap onto a caller-supplied line ctx; the same-map 0x53E95D is a notification marshaller. The word "rebind" should be avoided in the design draft for these.
3. **G38 §1.4 structural clarification**: the "8 sibling vtables" with 0x9C1113 at slot16 are the COM/QI wrapper family, not the per-state move vtables; a second 8-table per-state family exists (0xB0C498…0xB0CC78) carrying the physics slots. Both facts stand; docs should not conflate them.
4. **C-005 context refinement**: the intmap at 0x5042D1E0 is consumed by the 0x5042D204-class QI (0x50401522), not by the 0x5042D140 table (whose slots 0-2 are this−4 adjustor thunks). C-005's wording ("adjoining") remains true; any ownership inference beyond adjacency is corrected.
5. **t080's "0x9BF9D3 edge finder" label corrected**: map-horizontal-bounds clamp + partial-step computation.

## Window files (this directory)
taskA_53E95D.txt, taskA_9BC89F.txt, taskA_9BC992.txt, A2_*.txt (6B87D1/9BC622/helpers/constants), callsites.txt, B_9BF1FA.txt, B_9BF9D3.txt, B_9BF160.txt, B_caller_*.txt, B2_*.txt, C_A4FC6F.txt, C_9BFB52.txt, C_A4F6F1.txt, C_grab_*.txt, C_exit_*.txt, C3_A4F6F1_callsites.txt, A3_*.txt, A4_9C1113.txt, A5_9BE7xx.txt, A6_*.txt, statevtables.txt, D1_666C00.txt, taskD2*_out.txt
