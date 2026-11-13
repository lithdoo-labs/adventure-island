# G36/G37 — Background type1–4 & Obj.flow shared tiling path `0x66A8D5` — targeted static forensics V2

**Round**: t080 (2026-11-13). **Lead agent derivation** (pending independent review).
**Source**: `.work/task-036/game-image-unpacked.bin`, SHA-256 `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` (verified at round start).
**Image**: unpacked main EXE, ImageBase `0x400000`, linear memory dump — `fileOffset = VA − 0x400000` **verified by anchors** (EV-04 IID bytes @0xBA0570, EV-22 vtable dwords @0xB0CB70, EV-01 code bytes @0x666F5D all match authoritative evidence under this mapping; PE section raw sizes do NOT cover data VAs, so section mapping was rejected empirically, not assumed).
**Tools**: capstone 5.0.7 linear sweep of explicit windows; no Ghidra output trusted for any claim below (Ghidra CSV used only to confirm function extents).

---

## 1. Function extent and calling convention — `0x66A8D5`

- Entry `0x66A8D5`: `mov eax, 0xaaf76e; call 0xa6fc7c` (MSVC SEH prolog), `sub esp,0x1d8`, EBP frame, SEH state byte at `[ebp-4]`.
- Epilogue at `0x66B478..0x66B4A4`: dtor `[ebp-0x10]` (0x415cd1), dtor `[ebp+8]` (0x415ceb = conditional Release via `[vtable+8]`), `lea ecx,[ebp+0x24]; call 0x6713df` (struct arg dtor), `leave`, **`ret 0x24` at `0x66B4A2`** — 9 stack dwords, callee cleanup, thiscall (`ecx` = container object, stored at `[ebp-0x40]`; `ebx = [ecx+0x38]` at entry = resource rect bag).
- `this+0x38` points to a rect-like bag `{+0x24 left, +0x28 top, +0x2C right, +0x30 bottom}` (consumed by the Obj zero-step fallback as width/height differences).
- Whole-image `E8 rel32` scan: **exactly 3 callers** — `0x667EB1` (Obj), `0x66A40E` (background normal branch), `0x66A80B` (background scroll branch). No hidden callers.

## 2. Complete parameter table (raw push reconstruction at all 3 call sites)

Common construction: arg1 is a **by-value smart pointer**: `lea eax,&resource; push eax; call 0x414a7e` (0x414A7E = `mov [esi],eax; AddRef via [vtable+4]; ret 4`) fills the reserved slot; callee Releases it in the epilogue (0x415CEB). arg8/arg9 form a struct `{d0, d1}` whose d1 is dtor'd by 0x6713DF.

| slot | bg normal `0x66A40E` | bg scroll `0x66A80B` | Obj `0x667EB1` | semantic (in-function proof) |
|---|---|---|---|---|
| arg1 `[ebp+8]` | resource smartptr | resource smartptr | resource smartptr | E_POINTER checks; this of 0x426F74/0x43FD38/0x43FD62/0x43FD8C/0x43B92C |
| arg2 `[ebp+0xC]` | `type` ([ebp-0x68] ← WZ `type`, id 0x1581) | mode: type4→1, type5→2, type6/7→3 (0x66A7B4–0x66A7D4) | WZ `flow` (id 0xBF0 → [ebp-0x68]) | consumed as `and 1` / `and 2` at 0x66AA19/0x66AA58 **before** any reuse |
| arg3 `[ebp+0x10]` | WZ `cx` (id 0x547 → [ebp-0x80]) | `cx` | WZ `cx` → [ebp-0x18] | horizontal step (zero-step replacement at 0x66A970) |
| arg4 `[ebp+0x14]` | WZ `cy` (id 0x548 → [ebp-0x84]) | `cy` | WZ `cy` → [ebp-0x60] | vertical step (0x66A9BF) |
| arg5 `[ebp+0x18]` | WZ `a` (id 0x54A → [ebp-0x5C], default `0xFF`) | `a` | **immediate `0xFF`** (0x667E95 — Obj never passes WZ alpha) | `cmp eax,0xFF; sub 0xFF-alpha` scaling at 0x66AD87 |
| arg6 `[ebp+0x1C]` | WZ `ani` (id 0x549 → [ebp-0x7C]) | `ani` | resource animated-state ([ebp-0x58] obj frame) | branch at 0x66B3AD |
| arg7 `[ebp+0x20]` | `0` | `0` | `1` (0x667E8A) | obj/background discriminator (0x66B38D, 0x66B42B) |
| arg8 `[ebp+0x24]` | **uninitialized** (reserved `push ecx`; ctor 0x548460 never writes `[ecx]` — only the a9 slot at +4 is set) | same | same — **not 0** (blind-review correction: `mov [eax+4],edi` at 0x667E8C writes the a9 slot, not a8) |
| arg9 `[ebp+0x28]` | layer container ptr = caller [ebp-0x60] = `+4` member of the `[ebp-0x64]` out-struct of map lookup `0x671B59` (0x66996B) | same | `0` (0x667E8C) | registration target when arg7==0 (0x66B43C) |

**Registration targets** (0x66B42B): arg7≠0 (Obj) → final `0x671234(ecx=this+0x50, &[ebp+0xC]-built tree)`; arg7==0 (bg) → `0x671234(ecx=[ebp+0x28], tree)` — i.e. backgrounds register into the caller-supplied layer container, Obj into the Obj-container's own `+0x50` member (whose type is fetched via `0x4B6B0C`/`0x429919` in the Obj loader at 0x667E6C–0x667E79).

## 3. mode dispatch (bits consumed at entry, before slot reuse)

- 0x66AA13: `eax = arg2 & 1` → `[ebp-0x38]` horizontal flag.
- 0x66AA55: `eax = arg2 & 2` → `[ebp-0x34]` vertical flag.
- **Mapping from WZ**: normal branch passes `type` directly → type1=horizontal, type2=vertical, type3=both. Scroll branch remaps type4→1 (horizontal), type5→2 (vertical), type6/7→3 (both). Obj passes `flow` directly → flow bit0/bit1 select axes; **flow=0 yields both flags clear**.
- `[ebp+0xC]` is a **reused slot with 3 phases**: (1) mode int at entry; (2) on the vertical path it is overwritten with the span divisor `1` or `cy` (0x66AA65/0x66AA6E) and used by `div [ebp+0xC]` (0x66AA95); (3) inside the per-tile loop, `lea eax,[ebp+0xC]` is passed as **arg1 (out pointer) of 0x427EB3** (0x66AB1A) and becomes an object handle after that call (see §7). The historical parameter table's "mode" column describes phase (1) only.

## 4. Zero-step (cx/cy=0) fallbacks — verified instruction-by-instruction

Horizontal (0x66A970–0x66A9BC), when `arg3 == 0`:
- If `arg7 != 0` (Obj): `edi = [this+0x38]->+0x2C − [..]->+0x24` (right − left = width).
- If `arg7 == 0` (bg): resolve item0 = `0x426F74(arg1, out, V{VT_I4,0})` = `arg1.vtable+0x100(Variant 0)`; `cl = 0x66B4A5(item0)` = `item0.vtable+0x58()`; `edi = 1 − (1 << cl)`; `edi += 0x43FD38(arg1)` = `arg1.vtable+0xB8()`. Net: `step = slotB8 + 1 − (1<<slot58)`.

Vertical (0x66A9BF–0x66AA10) mirrors with `[+0x30]−[+0x28]` (bottom − top) / `slot+0xC0` via 0x43FD62; shift source is the **same** item0 slot `+0x58` via 0x66B4A5.

Helper bodies (this session, from raw bytes):
- `0x66B4A5`: `push ebp; … call [vtable+0x58]` → returns dword (shift count semantics: shift amount).
- `0x43FD38`: `call [vtable+0xB8]` → dword; `0x43FD62`: `call [vtable+0xC0]`; `0x43FD8C`: `call [vtable+0xC8]` with out-param copy, `ret 4`; `0x43B92C`: `call [vtable+0x1C]` (child count).
- **None of these slots' method bodies are in this image** (runtime-bound objects) — consistent with G36's dynamic-target residual.

## 5. Span computation and loop bounds

Horizontal (0x66AA13–0x66AA51), when bit0 set:
```
ebx = (arg3 == 0) ? 1 : arg3              ; divisor (avoid div-by-0)
view = 0x66B4F6([0xBE2788])               ; -> vtable+0x2C dword
eax = view + arg3*2 - 2                   ; lea eax,[eax+edi*2-2]
xor edx,edx; div ebx                      ; UNSIGNED
ebx = eax * arg3                          ; imul ebx,edi  -> horizontal span
```
Vertical (0x66AA55–0x66AA9B), bit1 set: same shape with `0x66B51D` → `vtable+0x30`, divisor in reused `[ebp+0xC]`.

Loop setup (0x66AA9F–0x66AABC):
- `[ebp-0x2c]` = y = 0; `[ebp-0x30]` = vspan; `[ebp-0x48]` = vspan + cy (outer limit); skip all if ≤0.
- `[ebp-0x24]` = x = 0; `[ebp-0x28]` = hspan + cx (inner limit); skip inner if ≤0.
- Increments: 0x66B466 `y += arg4; cmp [ebp-0x48]; jl inner-recheck`; 0x66B454 `x += arg3; cmp [ebp-0x28]; jl body`.
- **Iteration count per axis = ceil-ish via (view + 2*step − 2)/step** (unsigned); with step replaced per §4 when 0. `mode=0` (flow=0) ⇒ spans 0 ⇒ exactly ONE (x,y) iteration (single instance) — **closes the flow=0/flow>0 behavioral split for G37**.

## 6. Per-tile body (0x66AAC6–0x66B465) — object flow

Per (x,y) tile:
1. Build `V{VT_ERROR, DISP_E_PARAMNOTFOUND}` (0x40318F from data 0xBE7330) and `V{VT_I4, 0}` (0x4031B5).
2. `0x427EB3(ecx=[0xBE2788], out=&[ebp+0xC], 0,0,0,0,0, &V{3,0}, &V{error})` — see §7.
3. Child loop (`[ebp-0x18]` = 0 .. `0x43B92C(arg1)` count): per child:
   - resolve child via `0x426F74(arg1, &[ebp-0x1c], V{VT_I4, i})`;
   - read 3 int properties by string ids **0x155D, 0x1550, 0x1551** (defaults −1 for the latter two) via `0x414A49/0x404BA3/0x40263B/0x403AC7/0x415344`; *(pool is runtime-built from `[0xb07654]`; names not statically resolvable — see Residual)*;
   - if `this->[0xEC] > 0`: `child.vtable+0x5C(this->[0xEC])` (state select, HRESULT-checked);
   - alpha scaling: if `arg5 != 0xFF`: `d = 255−arg5`; `val1550 = max(0, val1550−d)`; `val1551 = max(0, val1551−d)` (0x66AD87–0x66ADA6);
   - create tiled instance: `0x427DE0(ecx=[ebp+0xC], &[ebp-0x1c4], child, V(155d), V(1550), V(1551), V{error}, V{error})` → `[ebp-0x1c4]` (0x427DE0 = `call [ecx+0x104]` creator, `ret 0x1C`).
4. Post-child object wiring (all on out-resolved objects, slots of runtime classes):
   - `0x66AF7B`: `call [obj+0x64]` with 16-byte copy (slot25-style PUT);
   - `0x66B044`: `call [obj+0x90]` with args `([ebp-0x24] − [ebp-0x54], [ebp-0x2c] − [ebp-0x50], V{error}, V{error})` — i.e. **(x−x0, y−y0)** (push order x-offset first, y-offset second — corrected after adversarial review), where `[ebp-0x50]/[ebp-0x54]` came from `0x4100A1/0x4100C8` = resolved item0 slots `+0x6C`/`+0x74` (origin x/y) — **tile position = loop offset − resource origin**;
   - `0x66B1A6`: `call [obj+0x9C]` with span/2-based args (`(vspan−0x50val)/2` etc., `sar 1`, negated) and 0xFFFF8001 sentinels for non-selected axes (0x66B0F1/0x66B113);
   - `0x66B23B`: `call [obj+0xFC]`; `0x66B285`: `call [obj+0xE0](-1)`;
   - `0x66B2B9`: `0x4423C0(arg1)`/`0x4566A7(arg2obj)` finalization;
   - arg7≠0 path: `0x414A7E(arg6, &[ebp+0xC]); call 0x66F890` (Obj animation registration); arg7==0 && arg6≠0 path: `0x427dba` variants + `0x42944A`/`0x427E6D` (bg animation attach — see G39);
   - final: `0x671234(registrar, tree)` per §2.

## 7. 0x427EB3 out-semantics — the shared key of G27 and this path

Raw body (0x427EB3–0x427F0D, this session):
- `esi = arg8`; pushes `&[ebp+0x24]` (out), copies arg8 (16B) and arg7 (16B) to stack, pushes arg2..arg6 and `this`, `call [vtable+0x64]` (slot25) with stack `(this, a2..a6, V(arg7), V(arg8), &outslot)`.
- Epilogue: `mov eax,[ebp+8]; mov ecx,[ebp+0x24]; mov [eax],ecx; ret 0x20` — **arg1 is an OUT pointer; the out receives the post-call first dword of the arg8 slot**.
- Gr2D vtable `0x5042D140` slot25 (+0x64) = `0x50403FBE` = trivial setter `mov eax,[esp+4]; mov ecx,[esp+8]; mov [eax+0xCC],ecx; xor eax,eax; ret 8` (re-verified from DLL bytes this session; vtable = exactly 40 slots, intmap adjoins at +0xA0).
- **Contradiction characterized**: if `[0xBE2788]`'s object were that class, the out slot would receive `&V{VT_ERROR}` (arg8 passthrough) and every subsequent `mov eax,[obj]`-style deref in this path would fault (vtable=0x0A). Since these paths demonstrably run in production, the runtime slot25 binding of `[0xBE2788]` must be a put-with-object-out writing an object pointer at out-offset 0. This narrows G24/G27 from "arg-order unknown" to "**out-value source = runtime slot25 body; one-dword dump at the out slot after 0x427EB3 settles it**" and adds a NEW hard constraint the runtime dump must satisfy.

## 8. Loader `0x669397` scroll branch (0x66A4E7–0x66A810) — scroll phase data flow

- rate = `[ebp+8](horizontal flag) ? rx([ebp-0x6C]) : ry([ebp-0x70])` (0x66A529).
- Offset bases: xoff = (horizontal flag ≠ 0) ? 100 : 0; yoff = (vertical flag ≠ 0) ? 100 : 0 (neg/sbb/and 0x64 tricks, 0x66A535/0x66A542).
- `step = 0x4E20 / |rate|` — `mov eax,0x4e20; cdq; idiv edi` — **signed division after abs** (0x66A56E).
- `sum = 0x43715C(layer)` + step, where `0x43715C` = thiscall `call [layer.vtable+0x58]` returning dword (body re-verified; unit unknown — G39).
- rate>0 ⇒ negate both offsets; rate==0 ⇒ zero them (0x66A578–0x66A58F).
- `+0x90(layer, x+xoff, y+yoff, V{error}, V{error})` (0x66A5F2) then `+0x90(layer, x, y, V{VT_I4, sum}, V{VT_I4, 0x10000000})` (0x66A692) — **the scroll phase enters the runtime object graph as a VT_I4 variant on the second +0x90 call**.
- `+0x98(layer, origin, 100, 100, 0, ry+100)` at 0x66A729 (horizontal) / `+0x98(layer, origin, 100, 100, rx+100, 0)` at 0x66A792 (vertical) — origin from `0x4371B1([0xBE2788])` = vtable slot `+0x5C` (body: out-copy of slot dword, `ret 4`).
- Tiling call `0x66A80B` per §2 with mode 1/2/3.

## 9. Sample coverage (FSDB 13-map, audited this round from `content/[FSDB]adventure/[group]map.Back|map.Obj`)

**Back records (387)**: type0=109, type1=155, type2=36, type3=9, type4=78; **no type 5/6/7 records exist in the 13-map set** (the scroll-remap 6|7→3 branch is dead code for this scope; type5/7 vertical-scroll paths unverifiable against local data).
**Zero-step usage**: ALL 387 records have cx==0 or cy==0 (e.g. type4 uses cx=1000..1800 with cy==0; type1/2/3 often both 0) — the zero-step fallback formulas are a **primary path**, not an edge case, for this map set.
**idiv-hazard reachability**: no type4 record has rx==0 → the blind-review `idiv`-by-zero hazard at 0x66A574 is unreachable in the 13-map scope (data-validation rule retained for future ingestion).
**Obj records (1817)**: flow distribution {0: 1762, 1: 55} — the 55 flow placements are all flow=1 (horizontal), cx/cy absent (→0 → resource-width fallback), rx present ('−15'..'15', reviewer-corrected range) but **rx is NOT an argument of 0x66A8D5** (its consumer is elsewhere — dynamic-layer candidate); zero flow=2/3 in this set.

**Note/correction candidate**: normal branch passes `type` UNMAPPED, so type2 → mode bit1 only (vertical), type3 → both. The historical table said "type != 0 时再调用 0x66A8D5，实参包含 cx,cy,type" — consistent; but any doc claiming type2 tiles horizontally is wrong. (Direct instruction evidence; flag for product doc review.)

## 10. Conclusion grades for this round

| finding | grade |
|---|---|
| 3 callers; ret 0x24 9-arg layout; per-site parameter table | DIRECT-INSTRUCTION |
| mode bit0/bit1 axis select; type/flow mapping incl. flow=0 single-iteration | DIRECT-INSTRUCTION |
| zero-step fallback formulas (slotB8/C0 + 1−(1<<slot58); rect width/height for Obj) | DIRECT-INSTRUCTION |
| span = ((view+2·step−2)/divisor)·step, unsigned div, divisor=1 when step=0 | DIRECT-INSTRUCTION |
| view source = [0xBE2788] slots +0x2C/+0x30 (horizontal/vertical) | DIRECT-INSTRUCTION (slot identity); "viewport size" semantics UNVERIFIED |
| per-tile child loop, 3 property ids (0x155D/0x1550/0x1551), alpha max(0,v−(255−a)) scaling | DIRECT-INSTRUCTION |
| tile position = loop offset − item0 origin (+0x6C/+0x74) | DIRECT-INSTRUCTION |
| scroll phase = slot58 + 20000/|rate| delivered as VT_I4 via second +0x90 | DIRECT-INSTRUCTION (formula); time unit UNVERIFIED |
| registration targets (this+0x50 vs arg9 container) | DIRECT-INSTRUCTION |
| 0x427EB3 arg1 = OUT pointer; out = post-slot25 arg8-slot dword | DIRECT-INSTRUCTION |
| runtime slot25 must write object-ptr-at-offset-0 (else paths fault) | DERIVED-FROM-INSTRUCTION (constraint) |
| concrete draw/transform math inside +0x90/+0x98/+0x9C/… targets | UNVERIFIED (runtime-bound; unchanged G36 residual) |
| string names for ids 0x155D/0x1550/0x1551 | EXTERNAL-BLOCKED (pool runtime-built) |

## 11. Residual (what stays open)

1. `+0x98/+0x90/+0x9C/+0x64/+0xFC/+0xE0` concrete bodies — runtime objects (unchanged: G36 dynamic part, G24/G27 narrowed per §7).
2. Time/phase unit of `vtable+0x58` values (G39).
3. String names 0x155D/0x1550/0x1551 (affects exact per-child property semantics; counts and defaults proven).
4. `[0xBE2788]`-slot25 runtime binding (single-dword dump settles G24+G27; constraint documented in §7).
5. **`idiv`-by-zero hazard at 0x66A574** (blind-review finding): if a scroll background (type 4–7) has rate==0 (rx for horizontal / ry for vertical), the `cdq; idiv edi` at 0x66A574 executes with edi=0 BEFORE the rate==0 offset-zeroing at 0x66A58B — a latent divide fault dependent on WZ data. 13-map FSDB audit: no type 4–7 record in the target set has rx==0 or ry==0 (checked below), so the hazard is unreachable in the 13-map scope; retained as a data-validation rule for any future map ingestion.
6. **Gr2D 0x5042D204 vtable (47 entries)** adjoins the 40-entry 0x5042D140 table; its slot +0x58 = 0x50403EFC (`mov eax,[this+0x28]` int getter) is readable statically — a candidate next-round lead for binding the layer-object slot semantics without runtime (reviewer correlative finding, INFERENCE grade).
