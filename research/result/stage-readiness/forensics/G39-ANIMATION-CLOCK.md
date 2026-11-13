# G39 — Animation & scroll clock — targeted static forensics V2

**Round**: t080 (2026-11-13). **Lead agent derivation** (pending independent review).
**Source**: `.work/task-036/game-image-unpacked.bin` SHA-256 `d4a67597…31718` (verified); Gr2D for vtable slots.

## 1. Frame registration chain (0x66A136 region — inside the `ani` branch of loader 0x669397)

- `0x66A136: call [resource.vtable+0x110]` — HRESULT-checked; the animation registration slot on the resource object (this is the "+0x110" from the gap register; slot body runtime-bound).
- `0x66A1BB: call [eax+0xD8](obj, flag)` — flag = `[ebp-0x20]!=0`.
- Origin read: `V{VT_I4,0}` → `0x426F74(resource, out, V)` → `0x4100A1` (item0 slot **+0x6C**) and again → `0x4100C8` (item0 slot **+0x74**) — the same origin-x/y pair consumed by the tiler's per-tile +0x90 positioning.
- ⇒ the static chain now binds: animation object creation via slot +0x110; origin via item0 slots +0x6C/+0x74; delay accumulation itself lives in the runtime method bodies.

## 2. Auto-move attributes (0x66B544) — CORRECTED after adversarial review

- True function extent **0x66B544–0x66BC80** (next SEH function at 0x66BC81; reviewer-established).
- Full census: **five** property chains on item0 of arg1 — id **0x54F → [ebp-0x1C]** (@0x66B5BB), **0x550 → [ebp-0x18]** (@0x66B634), **0x551 → [ebp-0x28]** (@0x66B776), **0x552 → [ebp-0x20]** (@0x66B7F0), **0x553 → edi** (@0x66B86D) — plus a sixth `call 0x7a48d0` (id 0x31D @0x66B96E) that is the **layer creation** chain (0x40634C+0x447891), not a property read.
- `[ebp-0x1C]` drives a `{0,1,2,3}` switch at 0x66B9A0 (**moveType** semantics); the 0x553 value gets rate-sign handling at 0x66B9C0–CC.
- **Verdict (corrected)**: the historical `moveType,moveR,moveW,moveH,moveP` five-attribute claim is **byte-supported**. The lead's initial two-property count (C-059 first draft) was a window-truncation error (scan ended 0x66B760, 0x16 bytes before the 0x551 site) — caught by adversarial review, claim rewritten.

## 3. Scroll phase time base (0x43715C / layer+0x58)

- 0x43715C body (re-verified): thiscall wrapper `call [obj.vtable+0x58]` returning dword — historical claim confirmed at byte level (it is NOT GetTickCount; it is a slot read on the layer object).
- Consumer (scroll branch, 0x66A567): `sum = slot58(layer) + 20000/|rate|`; delivered as `V{VT_I4, sum}` into the second `+0x90` call alongside `V{VT_I4, 0x10000000}` — the phase enters the runtime object graph as an integer variant. **Unit remains runtime-bound** (no static instruction divides/multiplies it by a time constant in this window).

## 4. Verdicts

| item | verdict |
|---|---|
| animation slot +0x110 registration + item0 origin +0x6C/+0x74 | DIRECT-INSTRUCTION |
| 0x43715C = vtable+0x58 slot read (not a Win32 tick) | DIRECT-INSTRUCTION |
| scroll phase = slot58 + 20000/|rate| as VT_I4 into +0x90 | DIRECT-INSTRUCTION |
| 0x66B544 five-attribute read set (ids 0x54F/0x550/0x551/0x552/0x553; moveType switch {0..3}) | DIRECT-INSTRUCTION (corrected; reviewer-verified full extent 0x66B544–0x66BC80) |
| frame delay unit / accumulation / loop / missing-delay rule | OPEN-RUNTIME (bodies behind +0x110/+0x90) |
| portal frame timing | not traced this round (OPEN) |

## 5. Residual

The clock lives in runtime-bound method bodies (`+0x110`, `+0x90`, layer `+0x58` implementations) — statically exhausted for the visible chain; a minimal runtime capture (one animated background, dump `slot58` value twice 1 s apart) settles unit and direction.
