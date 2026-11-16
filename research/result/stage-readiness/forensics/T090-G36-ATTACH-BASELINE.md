# T090 — G36 Attach Baseline & First-Frame Position Boundary (WP2-B)

Round t090. Inputs: Shape2D.dll (sha `9802bac…8111b`), EXE (sha `d4a675…31718`),
original Map.wz (sha `9e0d2a0…5f69`).

## 1. What "attach baseline" means in the proven dataflow

The G36 parallax attach (slot +0x98 = 0x5140847D, C-111) snapshots the SOURCE
object's position at attach time:

```
514084F7  mov ecx,[edi]          ; the source object (record+8)
514084F9  call 0x51405CD9       ; GetX(source)
514084FE  mov [esi+0xC],eax     ; X0 = source X at attach
51408511  call 0x51405D00       ; GetY(source)
51408516  mov [esi+0x10],eax    ; Y0
```

The loader (0x66A729/0x66A792) passes as source the **[0xBE2788] slot+0x5C
origin object** (read through 0x4371B1). The evaluator
(0x514085B3) later computes `local += trunc((src_now − src_attach)·W/D)`.

## 2. Static reach of the baseline value

- The baseline is whatever the origin object's position IS at the moment the
  map loader registers the background — a runtime value.
- The scene-setup chain 0x436DB3 resolves a node with the coordinates
  (−400, −300) (0x436FA2, byte-verified T089 blind notes) and the map-load VR
  fold (C-026) writes the camera BOUNDS; but the focus writer 0x93CB27, the
  filter arming 0x437717 (Set(0,−50) on the SHARED camera vector), and the
  cursor-follow writers all write the shared vector/origin family around map
  load — and their ORDER relative to the back-registration is a pump-phase
  (E2/E3) property that is statically undecidable (G10 residual, unchanged).

## 3. Conclusion (WP2-B)

**The first-frame ABSOLUTE screen position cannot be uniquely recovered from
static data**: the attach baseline is a runtime snapshot of the origin object,
and the load-order interleaving of camera writers is not statically decidable.
What IS static and closed: the relative layout math (C-048..C-052 spans,
C-111 ratios), the baseline-snapshot mechanism itself (this document), and the
per-map record data (T090-G36-13MAP-LAYOUT.csv — 387 back records over the 13
maps, matching the FSDB census count; per-record x/y/rx/ry/cx/cy/type/front/a
plus computed C-051 spans and C-111 parallax ratios with viewport 800×600).

This matches the OpenMS GMS083 caveat (attachment-baseline-dependent first
frame) — same boundary class, independently reached on CMS079 bytes.
