# T088 — Camera Update Cadence, Deadzone & Smoothing (STATIC-ONLY)

Round: T088. Binary identities: EXE `d4a67597…a31718`,
Shape2D.dll `9802bacc…c8111b` (full sha256
`9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b`),
PCOM.dll `cf3807f3…9d9e54`.
Sources: `T088-SHAPE2D-VECTOR2D-SET-SEMANTICS.txt`,
`T088-FIELD-9E6CA4-CFG.txt`, `T088-PACKED-COORD-WRITER-CALLGRAPH.txt`,
`T088-DIRECT-SLOT90-WRITER-CLASSIFICATION.csv` (all sha-pinned generators).

Report-level labels only; authoritative CSV statuses unchanged by this file.

---

## 1. The ten questions, answered with evidence boundaries

| # | Question | Answer | Grade / boundary |
|---|---|---|---|
| 1 | Camera follows player every tick? | **No per-tick camera writer exists in the decoded set.** Every writer is EVENT-driven: cursor events (funnel #2/3/5, mouse band #7, enumeration #6), map-load init (fieldctx ctor), scripted focus records (0x93CB27), UI surfaces (direct sites). No writer sits inside the slot12 tick 0x53465B or the physics loop 0x9BE703 chains. | A for the negative on decoded paths; the 25 INCONCLUSIVE census sites are the residual |
| 2 | Horizontal deadzone? | **None found in any decoded gate.** Gates are identity/presence/tag/rect-containment compares — no distance threshold on (camera − target) appears in 0x5CA91A, 0x5CB0E0, 0x5CB573, 0x9E6CA4, 0x9F1784, 0x93CB27, or Shape2D Set. | bounded negative (decoded bodies) |
| 3 | Vertical deadzone? | Same as horizontal — none. | bounded negative (decoded bodies) |
| 4 | Deadzone varies with facing? | No facing-dependent compare exists in the decoded gates. | bounded negative |
| 5 | Velocity/position-delta smoothing? | **Not in the camera path.** The only smoothing machinery in the system is Shape2D's V3-time interpolation (§3), which the camera writers do not arm (defaults). The physics-loop speed interpolation (C-067) is move-object side, unrelated to the camera writers. | A for decoded writers |
| 6 | Do VARIANTs trigger interpolation? | **Only if V3 (3rd arg) is non-empty.** VT_I4 → duration in global ticks; V4 & 0x10000000 kept as flags. Every joined census site passes V{VT_ERROR,missing} ×2 (39/39; C4 correction) — (39/39 uniform default V{VT_ERROR,missing} — t088-reviewer C4: the two VariantClear-cleared slots are re-templated from 0xBE7330, e.g. fieldctx ctor 0x9EC5C3-0x9EC5D2). | A (Shape2D body instruction-level) |
| 7 | One-frame delay? | No deferred/ring-buffer write found; the immediate path stores synchronously inside the Set call. The interpolated path is explicitly multi-frame but not armed by camera writers. | bounded |
| 8 | Forced reposition after portal? | **Yes-candidate**: the focus writer 0x93CB27 is called from the same-map portal-trigger family (caller 0x964E16 inside the 0x963CE1 chain neighbourhood) and the packet-spawn family (0x98DC43) — i.e., camera focus writes are issued by portal/spawn event handlers themselves (synchronous with arrival processing). | B: caller-context proven; the exact position semantics of the target object (§2) not fully closed |
| 9 | Camera hold/lock state? | No lock flag found in decoded writers; the nearest "suppression" is the mouse-band gate `[singleton+0xC]==0` (input-device-slot gate), which *enables* mouse-pan only when no device is active — a mode gate, not a camera lock. | bounded |
| 10 | Map-bounds clamp at camera write? | **No** (see T088-CAMERA-BOUNDS-SCENE-PORTAL.md §3): bounds enter at the slot15 cull window (consume side) and the VR fold (load side). Screen clamps [0,800]×[0,600] exist only on the CURSOR wrapper 0x5CB0E0. | bounded negative (decoded writers) |

## 2. Writer #6/#7 re-classification (T087 correction)

T087 labelled funnel writers #6 (0x9E6D18) and #7 (0x9F1ADF) as
"world-space gameplay writers". T088 decoding refutes the world-space reading:

* **#6** 0x9E6D18 fires inside callback **0x9E6CA4**, registered by the SEPARATE registration function 0x9E6BAD via `[0xBE1554](0x9E6CA4, ebx)` (t088-reviewer C5).
  The record fields `+0x38/+0x3C` are seeded at 0x9E6C30 by
  `0x5CABE1([0xBDD838], &[ebx+0x38])` — the **screen-cursor-derived client-space singleton base read** (t088-reviewer C6). The write gate is `PtInRect(&hwnd_rect, cursor)` — a
  window-rect containment test, not a world-position predicate.
* **#7** 0x9F1ADF fires in the **window-proc mouse band** (messages
  0x200–0x206, 0x20A) of 0x9F1784: `y = lParam>>16; x = (word)lParam` —
  the raw Win32 packed **client-space mouse coordinates** — then
  `0x5CA91A(singleton, x, y)`. Gate: `[singleton+0xC]==0`.

Both are cursor-followed mode (the same family as writers #2/#3/#5). No
world-coordinate source reaches the funnel.

## 3. Shape2D Set semantics (the geometry/smoothing engine)

`Set(this, x, y, V3, V4)` (vtable 0x5140C2F0 +0x90, body 0x5140828F, ret 0x2C):

```
if V3.vt in {VT_EMPTY, VT_ERROR}:            # camera writers pass this
    if [this+0x24]==0: [this+0x1C]=x; [this+0x20]=y     # immediate int store
    else: 0x51407A34(this,&x,&y)                        # aux-notified store
else:                                         # V3 armed (VT_I4 = duration)
    cur  = 0x514072CF(...)                    # current-position wrapper
    rec  = 0x51407FE1(&V3,&V4, x-curx, y-cury, [0x51411C34])
          # 0x514081F0: V3 -> VT_I4 duration; rec+0x20 = V4 & 0x10000000
    0x5140833B(cur, rec)                      # insert into [this+0x30] pending list
```

X/Y getters: slot+0x20 → `[this+0x1C]`, slot+0x28 → `[this+0x20]`
(EXE wrappers 0x404B07/0x404B2E).

**Consequences**

1. The funnel formula `camera := point − (400,300)` is an UNCONDITIONAL
   immediate store (geometry), confirming T087's negative on deadzone
   *inside the write itself* — now backed by the callee body, not just the
   caller.
2. The engine can animate the vector (time-parameterized), but no
   camera-relevant site arms it. EV-41's scroll-phase call arms it on a
   per-object Vector2D (tiling), not on the shared camera.
3. Default-VARIANT calls are NOT interpolated: "default VARIANT" is here a
   *proven* immediate, not an assumption.

## 4. The focus-writer family (the follow candidate)

`0x93CB27(this, scriptRecord)` (10 E8 callers) resolves the shared 0x31D
object directly and issues `Set(X(src), Y(src))` where
`src = [[this+0xF28]+0x14]` (avatar-container member, slots +0x20/+0x28). **[t090 WP0-A erratum]** superseded by C-115 (Set src = `[[arg3]+0x14]`; the F28 expression is byte-proven only for the fill-and-skip path that never Sets).
Callers fetch the record via `0x769B51([0xBD8FEC], string_id, N, 0)` with
N ∈ {500, 800, 1000}. This is a **scripted/event focus** operation, called
from portal-trigger, packet-spawn, seat and input regions.

**Open half (bounded):** the writers of `[F28obj+0x14]` were not censused
this round (the object is not obtained via namespace id 0x31D — no +0x14
attach exists in the 80-site resolve census — so it is a private position
object of another class). Until its writer census is done, the claim
"0x93CB27 renders the avatar at screen centre" stays UNPROVEN; what is
proven is the instruction chain and the caller families. Falsifier: a
writer of [F28+0x14] storing non-avatar-centred values.

## 5. Cadence model (as far as statically proven)

```
per OS mouse message (band 0x200-0x20A)  --[singleton+0xC==0]-->  camera := mouse-(400,300)
per enumeration/present pass            --[PtInRect(cursor)]---->  camera := cursor-(400,300)
per cursor setter/mover call            ------------------------->  camera := cursor-(400,300)
per map load (fieldctx ctor)            ------------------------->  camera := (-400,-300)
per focus-record event (10 callers)     --[tag/count/owner gates]-> camera := (X(src),Y(src))
per UI-surface event (direct sites)     ------------------------->  camera := context offsets
per tick: NO camera write (decoded set) ; slot15/draw READ the camera
```

Frame cadence therefore comes from the EVENT SOURCES (message pump,
enumeration passes, focus events), not from a tick-scheduled updater.
Whether the pump delivers mouse messages before or after the scene draw in
a given frame is not statically decidable here (STATIC-UNDERDETERMINED).

## 6. Parameterized product contract (P2 implementation)

Implementable with original fidelity:
* shared view vector; `screen = world − camera`;
* initial camera per map load = `(-400,-300)`;
* immediate semantics for every plain Set (no hidden interpolation);
* mouse-band pan semantics `camera := mouse − (400,300)` under the
  device-slot gate;
* consume-side culling (slot15 window) rather than camera clamping.

PRODUCT-SUBSTITUTION territory (must not be labelled original):
* per-tick avatar-centred follow with optional deadzone/smoothing (the
  original's focus semantics depend on the [F28+0x14] writer census);
* camera map-edge clamping (original produces the equivalent result on the
  consume side; a product may clamp the camera value directly — a visible
  difference only if the camera is read by other consumers mid-frame).
