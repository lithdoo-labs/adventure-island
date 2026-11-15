# T085 WP5 — Static Residual Triage (G10 Camera, G01/R13, Input Suppression)

Lower-priority work package, executed only with the budget left after
WP1–WP4. Contains only genuine findings from this round; nothing here reopens
T084.1-accepted results.

## 1. Input suppression (portal / general movement input) — NEW static gates

While recovering the T8 (climb) tick 0x9D7ADA and the T7 tick 0x9D4024 heads
(EV-78/EV-79), the input-suppression gate chain before any movement input is
read was recovered:

1. `0x9D8233(M)` — climb-state validator (non-zero → climb handling, no
   ground input read at all).
2. Keyboard focus: `[0xBDD89C]+4` compared against the function-pointer
   global `[0xBE1790]` (0x9D7AF1–0x9D7B09) — the "who owns the keyboard"
   check; mismatch → input path skipped.
3. `0x9EA638([0xBDD6F4])` — second focus/modal gate.
4. `[0xBD9020] != 0` — UI-modal/global-object presence gate (the same
   singleton whose slot14 dispatch appears at 0xA11C0E).
5. Only then: keymap object `[0xBDF54C]` (null-check + vt+0x4C probe with
   `&0xBDD808` name buffer) and the axis reader `0x5CAAA9([0xBDD838], VK)`
   for VK_LEFT/UP/RIGHT/DOWN.

In T7's tick the equivalent family of gates is `0x96C96B(user)` and the
state byte `[user_global+0x1B64]` vs {0xFF, <2} (0x9D406E–0x9D407E), which
routes between record-write+delegate branches.

This locates the CLIENT-SIDE input arbitration layer (focus + modal + keymap)
that any portal-arrival input suppression would act through; the previously
proven same-map 0x78/0x258 cooldown mechanics (T082) sit above it. What
remains open is unchanged: the cross-map `0x81` handler registration
mechanism (C-066 clause) — no new static evidence this round, and per the
T084.1 boundary the number-collision fact must not be read as proof of
dynamic registration.

## 2. G10 Camera — no new static evidence, boundary unchanged

This round did not chase slot15 callers or any new camera-rect producer; the
T084.1 bounded negative stands (no post-load writer of scene+0xF0..0xFC found
in the examined EXE-image/Gr2D-side censuses — a bounded claim, not an
unbounded one). G10 stays OPEN-RUNTIME. The first-tick chain (WP1) now
provides an additional static anchor a future runtime capture can use: the
camera-relevant arrival sequence is teleport-write/arrival-write → first
0x9BE703 tick; observing the camera-rect immediately after that tick would
bracket the producer window without needing a full frame-capture spec.

## 3. G01/R13 — no new static evidence

No slot25/canvas-traversal work was redone (T084.1 accepted results stand);
G01 remains PARTIAL-STATIC with the runtime endpoint shared with G24.
G24/G27 unchanged.

## 4. Residual classification after T085

Can continue statically:
- G40: T3 slot4 0x9C6028 / T6 slot4 0x9D06D4 full bodies; 0x9BD757 walk-step
  integrator family; the `[M+0x198]` shoe installer (equipment-pipeline
  census); T2/T3 water-entry transition callers (0x9C28BF/0x9C28FF thunks'
  dispatchers).
- G11/G12/G16/G20 (unchanged from prior rounds).

Static path exhausted, needs runtime:
- G10 camera producer (per-frame writer), G24 slot25 object identity capture,
  G08 avatar key, G09 runtime ordering, G36/G37 dynamic-layer bodies, G39
  animation clock.

Product decision:
- G33 equal-key stability policy; camera follow/deadzone strategy (pluggable);
  avatar-vs-object ordering rule.

Ready for engineering implementation (with T085 additions):
- Portal arrival position/state/snap + first-tick context rebuild (G38 chain
  now complete); stand-up/sit triggers incl. opcode 0xCF sub-cases; up/down
  input axis; step-as-data semantics (90/30 sites documented); swim lane
  bounds and margins as data-driven behavior.
