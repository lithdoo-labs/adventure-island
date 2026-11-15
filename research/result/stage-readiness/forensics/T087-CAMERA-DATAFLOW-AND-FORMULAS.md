# T087 — Camera Dataflow & Formulas (CMS079, STATIC-ONLY)

Round: T087. Binary: `.work/task-036/game-image-unpacked.bin`
sha256 `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718`.
Companion evidence files (this round): `T087-FIELDCTX-D4-CONSTRUCTION.txt`,
`T087-FIELDCTX-D4-WRITER-CENSUS.csv`, `T087-BDD838-CLASS-VTABLE.txt`,
`T087-BDD838-WRITER-ALIASES.csv`, `T087-5CB573-INPUT-UPDATE.txt`.
Reproduction: `research/scripts/t087_wp1_fieldctx_d4.py`,
`research/scripts/t087_wp2_singleton_camera.py`.

Report-level labels (ORIGINAL-STATIC-PROVEN / STATIC-UNDERDETERMINED /
PRODUCT-SUBSTITUTION) stay in this document; they do not enter authority CSVs.

---

## 1. Object identities (the G10 core questions, answered)

### 1.1 [fieldctx+0xD4] = a shared Shape2D#Vector2D — THE WORLD CAMERA

| Edge | Instruction evidence |
|---|---|
| fieldctx ctor = **0x9EC3E1**; installs global `[0xBDD6F4]` | 0x9EC404 |
| ctor zeroes `+0xD4` | 0x9EC478 `lea edi,[ebx+0xD4]`; 0x9EC47E `mov [edi],esi` |
| ctor resolves namespace id **0x31D** | 0x9EC4D3 `push 0x31D`; 0x9EC4D9 `call 0x7A48D0`; 0x9EC4E0 `call 0x40634C` |
| ctor attaches the resolved object into `[this+0xD4]` | 0x9EC4EE `call 0x447891` (smart-pointer attach+AddRef) |
| ctor immediately calls `[obj.vt+0x90](obj, -400, -300, V, V)` | 0x9EC61A `push -0x12C`; 0x9EC620 `push -0x190`; 0x9EC62A `call [ecx+0x90]` |
| the object is **`Shape2D#Vector2D`** | namespace-record decryption (0x7A4DA9/0x7A484B/0x7A48B3/0x7A4CBE cipher, fully re-implemented in the WP1 script): id 0x31D → `Shape2D#Vector2D`; cross-check id 0x819 → `Gr2D_DX8` (matches EV-07) |
| Shape2D.dll hosts the class | RTTI name `.?AVCWzVector2D@@` + UTF-16 registration string `Shape2D#Vector2D` at Shape2D.dll .data 0x115D0 (dll sha256 `9802bacc…c8111b`) |

The `vt+0x90` args `(-0x190, -0x12C)` are exactly `(-800/2, -600/2)` — the
negative half-screen: the constructor CENTRES THE WORLD ORIGIN at screen
(400,300). ORIGINAL-STATIC-PROVEN (byte-level).

### 1.2 [0xBDD838] = the input/cursor manager singleton (NOT the world camera)

* Only ONE writer of the global in the whole band: **0xA012E5** (singleton ctor
  A 0xA012D3; object of 0xA04 bytes allocated at 0xA0125F; ctor B 0x5CA5A9).
* Ctor B installs: 3 device objects (`[0xBE157C](0,0,0,0)`), an event/thread
  registration (`[0xBE1528]`-family, callback 0x5CC1ED), two 256-entry key
  tables filled from the 204-byte table at 0xBA1D7B, **cursor position
  +0x938/+0x93C initialized to (400,300) = screen centre** (0x5CA787/0x5CA78D),
  a cursor-sprite set at +0x97C (namespace id 0xA58 → `UI/Basic.img/Cursor/%d`),
  and **the SAME Shape2D#Vector2D at +0x9B0** (id 0x31D again, attach at
  0x5CA6B1) — same namespace slot, hence the same instance as [fieldctx+0xD4].
* The 0x5CAB38 input dispatcher (driven at 0x9FEE24 by mode =
  `[0xBE179C](3, input+0x88, 0)`): case 0 = keyboard state processor (0x5CB9EC),
  case 1 = input-axis cursor mover (0x5CB573), case 2 = joystick axis processor
  (0x5CBE2A, ±700 deadband, ±1000 saturation). After the dispatch,
  0xA020E2 re-dispatches the result as WINDOW MESSAGES (WM_KEYDOWN band 0x100,
  mouse band 0x200-0x20A, 0x500/0x501) and forwards mouse-range messages with
  (x, y) into [0xBDD6F4] (fieldctx) methods.

Report-level classification: **UI-SCROLL-SURFACE / SHARED-SCREEN-COORDINATE
SERVICE hybrid** — its own position is the SCREEN-SPACE cursor (init centre,
hard [0,800]×[0,600] clamp in the wrapper setter 0x5CB0E0, cursor sprites,
UI-grid producers 0x4BEDE7/0x5F1C7D). It is NOT the world camera; it is one of
the camera's writers (below).

### 1.3 The two T086.1 unknowns, resolved

| T086.1 open item | T087 answer |
|---|---|
| concrete class/role of [0xBDD838] | input/cursor manager singleton (behavioural; no RTTI name available) |
| concrete class of [fieldctx+0xD4] | `Shape2D#Vector2D` (namespace name statically decrypted; Shape2D.dll hosts CWzVector2D) |
| the writer of [fieldctx+0xD4] | installed once by the fieldctx ctor (0x9EC4EE); the OBJECT's x/y are then written through `[vt+0x90]` calls — see §2 |
| 0x5CB573's axis inputs | keyboard/joystick state of the singleton's own devices (case dispatch at 0x9FEE24); target = the singleton cursor, NOT the world camera |

## 2. The camera-write formula (0x5CA91A) — ORIGINAL-STATIC-PROVEN

`0x5CA91A(this = [0xBDD838] holder, x = [ebp+8], y = [ebp+0xC])`:

```
pack V{VT_ERROR, missing} ×2  (0xBE7330 data)
E_POINTER-check [this+0x9B0]                 ; the shared Vector2D
ecx = [ebp+0xC] (y); ecx += -0x12C (-300)    ; 0x5CA9AC
ecx = [ebp+8]  (x); ecx += -0x190 (-400)     ; 0x5CA9B8
call [Vector2D.vt+0x90](Vector2D, x-400, y-300, V, V)   ; 0x5CA9C1
```

**camera := (x − 400, y − 300)** — the point (x,y) becomes the screen centre.
The constants 400/300 are exactly half of 800/600 — mutually anchored with the
[0,800]×[0,600] clamp of 0x5CB0E0 (C-027/T086.1) and the fieldctx ctor's
(-400,-300) initial vector (which is `Set(0−400, 0−300)`, the same formula with
the world origin as the point).

E8-caller census of 0x5CA91A (7 sites, byte-pattern complete in band — the
WRITE FUNNEL; t087-reviewer counter-evidence merged: a DIRECT [vt+0x90] writer
family on the same namespace-cached Vector2D also exists — reviewer-verified
sites 0x43781F (0,−0x32), 0x692280 (−0xFF,0), 0x6BE6F4 (0x190,var), 0x6ED7CC
(0x97,0x8D) with 24 further candidates uncensused; whether their VARIANT args
carry identical position semantics is an open sub-question):

| Caller site | Feeds | Coordinate space |
|---|---|---|
| 0x5CA774 (singleton ctor re-notify) | PRE-INIT values (memset + (400,300) stores follow at 0x5CA787/0x5CA78D; no second call — the camera start (0,0) is established by the FIELDCTX ctor's (-400,-300) Set) | screen |
| 0x5CB12E / 0x5CB139 (cursor setter 0x5CB0E0, both `[this+0xC]` branches) | clamped cursor pos | cursor-followed camera mode |
| 0x5CB3DF (0x5CB33F error path) | retry value | — |
| 0x5CB74B (keyboard mover 0x5CB573) | post-move cursor pos | cursor-followed mode |
| **0x9E6D18** (field record loop) | record fields `+0x38/+0x3C` pair | world-space pair (gameplay path) |
| **0x9F1ADF** (field packed-coord path) | one dword: low word = x, high word = y | world-space packed 16:16 |

Writers 0x9E6D18/0x9F1ADF are the GAMEPLAY camera writers (field-family,
virtual dispatch targets). Their per-event gating (every tick vs on-threshold)
was not traced end-to-end this round — that is precisely where any deadzone
would live. ORIGINAL-STATIC-PROVEN: the write formula itself, at all 7 sites.

## 3. Coordinate systems and the conversion edges

```
player world position (move object, encrypted pair; C-055/C-088)
        │  (movement engine; T085/T086 chains)
        ▼
WORLD point (x, y) ──── 0x5CA91A ────►  camera Vector2D := (x−400, y−300)
        │                                   ([fieldctx+0xD4] == [singleton+0x9B0])
        │                                   initial: (-400,-300) from fieldctx ctor
        ▼
screen(world) = world − camera            (0x9EA446: sub esi, eax — field draw path)
        ▲
        │ 0x9EC924 (fieldctx.camera_get, flag=1):  out = cursor + camera
        │ 0x9EC989 (fieldctx.camera_set, flag≠0):  cursor = in − camera
SCREEN-space cursor ([0xBDD838]+0x938/+0x93C; init (400,300); clamp [0,800]×[0,600])
        ▲
        │ 0x5CB573 keyboard axes (speed [+0x970]+5, /10) · 0x5CBE2A joystick axes
        │ 0x5CB0E0 absolute setter · UI-grid producers 0x4BEDE7/0x5F1C7D
        ┘
```

* `0x9EC924/0x9EC989` are therefore NOT "camera get/set" — they are the
  **screen↔world converters** combining the cursor with the camera vector.
  The 24 consumers of 0x9EC924 (incl. 0x953B3D hit-tests, 0x953AF4 per-draw
  family) convert hover points into world space.
* slot15 (0x53471A) cull window re-verified from raw bytes this round:
  `X1 + (3 − X0) ≤ arg_x ≤ X1 + ([scene+0x1D0] − X0) + 5` (Y isomorphic with
  margins 5/5) where X0/Y0 = camera Vector2D X/Y and X1/Y1 = the scene's own
  `[scene+0x1CC]` member's X/Y (E_POINTER-guarded, same getter wrappers). The
  window is a parallax-layer test: a layer whose own offset X1 differs from the
  world camera X0 gets a shifted cull band (consistent with G36 layer scroll).
  The installer of the scene's +0x1CC inner object is STATIC-UNDERDETERMINED
  this round (the embedded vtable 0xB002C0 seen in ctor 0x52429B belongs to a
  different class family than the 33 slot15 vtables).

## 4. What is now proven vs still open

### ORIGINAL-STATIC-PROVEN (new this round)
1. `[fieldctx+0xD4]` identity: shared `Shape2D#Vector2D`; full construction
   chain ctor→namespace→attach; initial value `(-400,-300)`.
2. `[0xBDD838]` identity: input/cursor manager; creation chain, layout,
   keyboard/joystick/mouse dispatch, cursor semantics, screen clamp.
3. The camera-write formula `camera := point − (400,300)` at 0x5CA91A and its
   7-site writer census (incl. two field-family world-space writers).
4. world→screen edge `screen = world − camera` at 0x9EA446.
5. 0x9EC924/0x9EC989 = screen↔world converters (cursor±camera), not camera IO.
6. The T086.1 "two UI-grid producers vs one input updater" ambiguity resolved:
   both target the CURSOR; the cursor manager additionally drives the camera.

### STATIC-UNDERDETERMINED (bounded)
1. **Follow cadence / deadzone**: whether writers 0x9E6D18/0x9F1ADF fire every
   tick or on-threshold (a deadzone would be their upstream gate). Not decoded
   this round; no deadzone constants were found inside 0x5CA91A itself. The
   direct-slot writer family (≥4 verified sites, census open) is a further
   uncensused writer set.
2. Shape2D-internal store instructions behind `[vt+0x90]` (PCOM property
   indirection in Shape2D.dll 0x5140xxxx) — the EXE-side contract and the
   observable X/Y semantics are proven; the internal routing is not.
3. `[scene+0x1CC]`'s inner object installer (slot15's X1/Y1 source).
4. The trigger events feeding writer A's record list / writer B's packed
   coordinates (virtual dispatch targets; containing functions identified,
   upstream gating not fully traced).

## 5. P2 implementation contract (parameterized)

Implementable NOW with original fidelity:
* camera as a world-space point vector `camera = centre − (400,300)`;
* `screen = world − camera` for every world→screen conversion;
* screen↔world conversions combine cursor + camera exactly as 0x9EC924/0x9EC989;
* initial camera per map load = `(-400,-300)` (world origin centred);
* screen-space cursor/scroll surfaces clamp to [0,800]×[0,600].

PRODUCT-SUBSTITUTION (must not be labelled ORIGINAL-STATIC-PROVEN):
* follow cadence (per-tick vs event), deadzone band, smoothing. Given the
  cursor-followed mode proven at 0x5CB12E/0x5CB74B, a product may reasonably
  choose "camera centres the active focus point" (cursor or avatar) with an
  optional deadzone band; differences show at low speeds and at map edges.
* map-edge clamping of the camera (the VR-fold bounds at [scene+0x1D0/+0x1D4]
  feed the CULL window, not a camera clamp we could prove).

## 6. Impact on the P0-P4 matrix

P2-01 (world→screen): the transform is now ORIGINAL-STATIC-PROVEN
(screen = world − camera; converters at 0x9EC924/0x9EC989) — upgrade from
PRODUCT/D to A/B-grade static evidence.
P2-05 (who writes the camera): resolved at the mechanism level (0x5CA91A + 7
writer families); the gameplay event gating remains the bounded residual.
P2-06 (deadzone/smoothing): still DESIGN-DECISION; no deadzone constants found
in the camera-write path itself (this round's negative result is scoped to the
decoded functions, not the whole binary).
