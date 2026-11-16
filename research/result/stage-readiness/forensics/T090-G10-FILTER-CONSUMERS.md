# T090 — G10 Filter Consumer Chain & Focus-Writer arg3 (WP4-A/WP4-B)

Round t090 (2026-11-16). Inputs: Shape2D.dll
(`9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b`,
ImageBase 0x51400000) + EXE (`d4a67597…31718`), capstone, sha-pinned scripts
`t090_wp4b_*.py` / `t090_wp4a_*.py`.

---

## 1. THE CONSUMER CHAIN (new, byte-proven end-to-end)

The T089 open question "whether the filtered coordinate feeds the slot15
consume side" is resolved: **structurally YES — once the animation wrapper
exists, every camera read is filtered and every immediate Set applies as a
delta onto the animated coordinate.**

### 1.1 The wrapper object (Vector2D+0x24)

- `0x51407340` (wrapper ctor, vtable stack {+0: 0x5140D8F0, +0x10: 0x5140D8EC,
  +0xC: 0x5140D8E8}, sub-object +0x30: 0x5140D8F4) builds an ANIMATION-STATE object
  (fields through at least +0x88 — >=0x90 bytes): x/y **by value** at +0x20/+0x24, record list +0x14,
  current record +0x1C, resolved outputs +0x60..+0x88 (see §1.3), armed +0x54,
  last tick +0x58.
- `0x514072CF(slot, X, Y)` lazily creates/caches the wrapper in a caller-supplied
  slot; every Shape2D engine site passes `&Vector2D+0x24` and the Vector2D's
  CURRENT raw X/Y ([v+0x1C]/[v+0x20]) as the initial snapshot.

### 1.2 Filter commit CREATES the wrapper (0x51408C9A = slot +0xA8)

```
51408C9A  mov eax,[esp+4]            ; the Vector2D
51408C9F  push [eax+0x20]            ; Y
51408CA5  push [eax-8+0x24]          ; X = [v+0x1C]
51408CA8  push eax+0x24              ; &v+0x24 (wrapper slot)
51408CA9  call 0x514072CF            ; create/get wrapper (snapshot)
...      find/create record id 0x1E0000 (vtables 0x5140D968/64/74,
         method 0x51408D23); [rec+8] = coefficient
51408D12  call 0x5140833B            ; commit record into the wrapper list
```

⇒ the EXE arming chain (0x437717 → Set(0,−50) → +0xA8 commit(100), C-114)
**instantiates the wrapper on the shared camera Vector2D at map load**.

### 1.3 The getters PUMP the engine and return the FILTERED coordinate

- `GetX` (slot +0x20 = 0x5140724A): `edx = this; ecx = [edx+0x24]`;
  wrapper == NULL → `*out = [this+0x1C]` (raw); **wrapper != NULL →
  `0x51406ADC(wrapper, &out, …)`**.
- `GetY` (slot +0x28 = 0x514074C8): same shape; out at the second resolver slot
  (`← [w+0x74]`).
- `0x51406ADC` (the resolver): locks [w+0x14]; **if armed and
  `[0x51411C34] != [w+0x58]` → runs the engine `0x51406CF7(wrapper, tick, …)`
  INLINE on the getter call**; then emits the resolved state:
  `[w+0x70]→out1 (X)`, `[w+0x74]→out2 (Y)`, `[w+0x68]/[w+0x6C]→out3/4`,
  doubles `[w+0x80]/[w+0x88]` (angle/elapsed family, 0x5140D8C0 = 360.0,
  0x5140D8E0 = 1/180).
- `0x51406CF7` (engine): applies every pending record (interp / parallax /
  **filter id 0x1E0000**) to the wrapper's x/y —
  `snapshot [w+0x20]/[w+0x24] → apply(record, &x, &y) → add deltas back`
  (0x51406F73–0x51406F81); computes the resolved outputs; retired records are
  removed (0x51406E43/0x51406F91).

### 1.4 Immediate Sets become DELTA stores when the wrapper exists

Set fast path (0x5140830E, ret 0x2C): wrapper == NULL → raw stores
`[v+0x1C]=x, [v+0x20]=y` (the T089 C-108 reading — valid for the UNARMED
state); **wrapper != NULL → `0x51407A34(v, &x, &y)`**: locks [w+0x14], reads
the wrapper's current coordinate (0x51406ADC), and applies
`[w+0x20] += (new_x − current_x)`, `[w+0x24] += (new_y − current_y)` —
the FILTER's displacement is preserved across immediate Sets (the camera glides
toward the new target instead of snapping).

### 1.5 Consequence for the G10 consumers

- The scene-cull slot15 reads `[fieldctx+0xD4]` X/Y via the COM getters
  0x404B07/0x404B2E → slots +0x20/+0x28 → **filtered** (when armed).
- world→screen 0x9EA446 reads the camera via the same getters → **filtered**.
- The focus-writer source reads (0x404B07/0x404B2E on `[[arg3]+0x14]`) and the
  funnel 0x5CA91A's Set both operate on/through the wrapper-mediated value.
- The EXE NEVER queries the filter coefficient: `call [reg+0xA4]` census =
  **0 sites** (all modrm forms incl. SIB); the +0xA4 body (0x51408BED) is an
  internal query-and-remove returning the COEFFICIENT, not the coordinate.
- Threshold constants: [0x5140D8C8] = **0.0** (the sign gate in 0x51408D23's
  |D| compare), deadband [0x5140D978] = **28.0** (C-114), round clamps
  0.499999999/0.5, 360.0 and 1/180 at the resolver outputs.

### 1.6 Honest boundaries

- The chain is proven STRUCTURALLY: filtered reads hold whenever the wrapper is
  armed. Whether the wrapper stays armed across scene transitions (record
  retirement removes records; the wrapper itself persists until…) and the
  E2/E3 pump interleaving (which Set lands before which draw) remain
  runtime-bound — unchanged residual class.
- C-108's "IMMEDIATE store" wording is hereby REFINED: immediate vs the raw
  fields holds only for the UNARMED Vector2D; with the wrapper, the immediate
  path is the delta store 0x51407A34 (no contradiction — C-108's sites were
  classified pre-arming).

## 2. Focus-writer caller table (WP4-A refinement of C-109/C-115)

Anchored decode of all 10 E8 callers (`t090_wp0a_callers_anchored.py` +
`t090_wp4a_arg3_identity.py`); `0x93CB27` ret 0xC = (this, record, N, arg3);
`0x769B51` ret 4 (one arg); the pre-push idiom carries N/arg3 beneath the
0x769B51 call:

| caller | N | arg3 | arg3 provenance |
|---|---|---|---|
| 0x5C0342 | 0x320 | **object** | esi = the containing method's this (`push esi; push 0x320; push eax`; this=[esi+0x10], string-id [esi+0x44]) |
| 0x93E00B | 0x3E8 | 0 | ebx (xor at 0x93DFF8) |
| 0x959493 | 0x320 | **object** | [ebp+0x20] (containing function's arg) |
| 0x959527 | 0x320 | 0 | push 0 |
| 0x964E16 | 0x3E8 | 0 | ebx, pre-push |
| 0x9651CC | 0x3E8 | 0 | ebx, pre-push (string-id 0x40413D) |
| 0x965567 | 0x3E8 | 0 | ebx |
| 0x98DC43 | 0x1F4 | 0 | ebx, pre-push (string-id 0x406849); **containing code calls the [0xBDD460] getter 0x43291A at 0x98DC0C then 0x43D092 — the packet-spawn focus caller runs in the same global-camera-manager context as the 0x437717 filter arming (C-114)** |
| 0x990E21 | 0x3E8 | 0 | **esi = 0 (xor esi,esi at 0x990B42 in fn 0x990B2E — CORRECTS the T089 reviewer's "object" reading)** |
| 0x990E91 | 0x3E8 | 0 | esi = 0 (same) |

⇒ **8 of 10 callers pass arg3 = 0** (known-tag records through those sites
would fault at `[[0]+0x14]` — they must deliver unknown-tag records that take
the 0x4B1C27 fill-and-skip path, which binds `[this+0xF28]`); only 0x5C0342 and
0x959493 can byte-legally execute the Set. The `[[arg3]+0x14]` member-writer
census for those two objects remains open (the +0x14 store sites on those
classes are not yet censused) — the arg3↔F28 relationship stays a two-dataflow
question, unresolved.
