# T084 — Camera Call Graph & Update Chain (Static Forensics)

Round: t084 (2026-11-15). Binary: `.work/task-036/game-image-unpacked.bin`, SHA-256 `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718`, `fileOffset = VA − 0x400000`. Evidence windows: `forensics/T084-EV73-SCENE-CAMERA.txt`, `forensics/T084-EV70-OPCODE-0081.txt` (regenerable: `research/scripts/t084_dump_evidence.py`).

Related: G10 (OPEN-RUNTIME), G34 (OPEN-STATIC), P4-06/P4-07, C-026/C-027/C-028, C-054/C-055, C-064.

---

## 1. Verdict

**PARTIALLY CONFIRMED.** This round recovers the complete **static scene-orchestration skeleton** around the camera (scene class identity, load order, per-tick and per-draw dispatch, camera-rect consumer, viewport-size source, cross-map re-init order). The **per-frame follow write itself is not in the EXE image** — G10 remains OPEN-RUNTIME; the prior negative finding ("follow writes not found statically", C-028) is re-confirmed by the new structural evidence, not contradicted.

## 2. Scene-manager class identity (NEW, CONFIRMED)

- The map-scene manager is a **handler-base class whose methods are vtable slots shared by 33 handler vtables** spanning `0xB01308..0xB02730` (imm32 census of `0x5348E8`; primary representative `0xB01414`). This is the same family C-066 identified for `0x533EA4` (15 vtables for that method — the family overlap confirms one inheritance tree).
- Primary vtable `0xB01414` slot map (dword dump, EV-73/EV-70):

| slot | body | role (this round) |
|---|---|---|
| 0 | 0x533EA4 | field-enter/map-transition entry (calls 0x97EBC9 at 0x533FF1) |
| 2 | 0x666186 | WZ map load (tiles/objs/backs/attr/VR/life) |
| 3 | 0x5348E8 | scene init (load → info → sub-layers → user attach) |
| 12 | 0x53465B | per-tick dispatcher |
| 14 | 0x5346EF | per-draw dispatcher |
| 15 | 0x53471A | cull/visibility check (consumes the camera rect as args) |

- Slot3 scene-init call order (0x5348E8): `0x666186` (WZ load) → `0x534BA4` (info props, e.g. +0x13C) → `0x535105(arg)` → `0x535261` → `0x5364B8` (WZ 0x623) → `0x5369D6` (WZ 0x626) → `0x536E76` (WZ 0xD6F) → `0x5366A3` (WZ 0xF66) → conditional `0x66E7CB` (UI-element create when `[fieldctx+0x2FE4]==0`) → life enumeration.

## 3. Map-load order inside slot2 (0x666186) — CONFIRMED

Single window 0x6662DC-0x666312 proves the fixed sequence on the scene receiver (esi):

```
lea ecx,[esi+0x34]; call 0x4B6A47      ; get field sub-object (scene+0x34)
mov ecx,eax;    call 0xA4DDDB           ; init field #2 (physics default load; global [0xBE65F8], vtable 0xB0DE10)
0x666749  tiles load
0x6670C7  obj load
0x669203  back load
0x66BC81  auto-move attribute pass (0x66B544 family)
0x66E59E  VR fold  (camera BOUNDS: [scene+0xF0..0xFC] = VR ± (400,300), midpoint collapse — C-026)
0x66631A  WZ `life` (string 0x69C) read
```

**This is the camera-bounds initialization**: VR fold runs after all geometry registration and before life. The prior record (C-026) is unchanged; the new fact is its position in the chain and that the scene owns a second field object at +0x34 (besides the global field `[0xBDD498]` created by the collision-data load 0xA4D303).

## 4. Per-frame dispatch — CONFIRMED structure, camera write ABSENT

- Slot12 0x53465B (window 0x53465B-0x5346EC):
  1. sound/state pre-checks (`[0xBDD6F4]+0xA4` via `[0xBE18B8]`/`[0xBE18D0]`);
  2. `0xA106C3(fieldctx=[0xBD9028], arg1, arg2)` — fieldctx message/input dispatcher (opcode/key switch incl. 0xCF family; NOT a frame integrator);
  3. gated by `[0xBD9020]==0 && [0xBDD490]!=0` (in-game, user present): vt+0x28 probe on `this−4`, optional early user call `0x9532D8` when `[fieldctx+0x35C4] >= 0x2710`, then **`0x9533EA(user, arg1, arg2)`** — the user per-tick update (movement processing);
  4. slot14 0x5346EF → **`0x953AF4(user, arg1..arg4)`** — the user per-draw update.
- Slot15 0x53471A receives a **camera rect as arguments** (`[ebp+8]` x, `[ebp+0xC]` y) and culls children against world bounds `[scene+0x1D0]/[scene+0x1D4]` (window 0x534743-0x534850). The caller passing the camera coordinates was **not identifiable statically** (the `call [eax+0x3C]` sites found in 0x92xxxx belong to a different vtable family — string-0x76A/0x76B/0x1367 UI layer).
- Viewport size source: `0x66B4F6`/`0x66B51D` call **[0xBE2788] vtable slot11 (+0x2C) / slot12 (+0x30)** with an out-int (HRESULT-checked). These are getters; no EXE-side setter call for these slots exists in the image (scan of all `mov eax,[0xBE2788]` sites: only slots +0x8/+0x10/+0x18/+0x50/+0x60 are called).
- **Negative result (re-confirmed):** no per-frame writer of `[scene+0xF0..0xFC]` after the VR fold exists; no write of a follow/deadzone camera variable exists anywhere in the EXE (consistent with G10/C-028). The camera follow/interpolation/deadzone behavior therefore lives in the runtime-bound method bodies (Gr2D/DLL or runtime-constructed call targets), or is applied in the draw path outside this image.

## 5. Cross-map camera/state ordering — CONFIRMED (P4-06/P4-07)

0x97EBC9 (map-transition handler, EV-70) executes:

```
0x97EBFE alloc 0x3048 (pool 0xBE1DE0) -> new field object
0x97EC1F 0x94FDB4(newField, mapId)    -> FULL NEW-MAP LOAD
                                          (creates field #1 [0xBDD498] via 0xA4D303-class loader:
                                           physics + footholds + ropes + portals + VR re-fold)
0x97EC2F 0x980A8C(handler+4, newField, 0) -> attach/activate the new field
0x97EC37 mov ecx,[esi+8]; call 0x9507F0  -> ARRIVAL POSITION WRITE (C-055/EV-36)
```

Consequences (instruction-order proven, runtime-execution caveat below):

- The new map's camera bounds (VR) and collision tables are loaded **before** the arrival position write; the clamp values `[M+0x138..0x144]` copied by 0x9BC602 (C-064) therefore come from the **new** field (`[0xBDD498]+0x24`).
- The user tick (0x9533EA) and draw (0x953AF4) run only on subsequent slot12/slot14 dispatches — i.e. **after** the transition handler returns; there is no camera refresh inside 0x97EBC9 itself.

Caveat: static call order is proven; actual runtime scheduling of the frame loop relative to the handler is not observed (G10 runtime dependency unchanged).

## 6. Call graph (confirmed edges only)

```
[frame loop — caller unidentified statically]
  └─ handler-base vt slot12 0x53465B
       ├─ 0xA106C3(fieldctx)   (input/opcode messages; contains 0xCF-family switch)
       ├─ 0x9532D8(user)       (conditional, [fieldctx+0x35C4] >= 0x2710)
       └─ 0x9533EA(user)       (per-tick movement)
  └─ handler-base vt slot14 0x5346EF
       └─ 0x953AF4(user)       (per-draw)
  └─ handler-base vt slot15 0x53471A(scene, camX, camY)   <- camera-rect consumer
[map transition]
  slot0 0x533EA4 ──0x533FF1──> 0x97EBC9 ──> 0x94FDB4 (new map load ─> 0xA4D303 field#1 ─> VR fold 0x66E59E)
                                          ──> 0x980A8C (attach)
                                          ──> 0x9507F0 (arrival write ─> 0x9BC622 … C-055/C-062)
[scene init slot3 0x5348E8 ─> slot2 0x666186 ─> tiles/objs/backs/attr/VR/life; scene+0x34 field#2 via 0x4B6A47+0xA4DDDB]
```

## 7. Open questions (unchanged / sharpened)

1. Who calls slot12/14/15 (the frame-loop owner) — static caller not found (vtable-only edges).
2. The per-frame camera-rect producer feeding slot15 — OPEN (G10 runtime).
3. Follow/deadzone/smoothing parameters — OPEN-RUNTIME (G10).
4. G34 (0x5A vs 0x1E): no new site found this round; still no verified conversion site.

## 8. Claim/Gap ledger deltas

- NEW C-084 (Camera, B): scene-manager dispatch structure + load/cross-map ordering (EV-73, EV-70).
- G10: `verified_scope` extended (scene skeleton + camera-rect consumer + viewport getters + cross-map bounds-before-write order); status stays OPEN-RUNTIME.
- P4-06/P4-07 rows updated (upper-layer enumeration now done; camera write point still runtime).
