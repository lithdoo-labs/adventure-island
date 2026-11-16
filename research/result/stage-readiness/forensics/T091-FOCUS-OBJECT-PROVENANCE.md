# T091 — G10 Focus Object Provenance (`[[arg3]+0x14]`) — Object Chain Forensics

Round t091 (2026-11-16). STATIC-ONLY. EXE
`d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718`
(base 0x400000). All windows byte-anchored in
[T091-FOCUS-CHAIN-DISASM.txt](T091-FOCUS-CHAIN-DISASM.txt);
caller classification by [T091-ARG3-CALLER-IDENTITY.csv](T091-ARG3-CALLER-IDENTITY.csv).

---

## 0. One-paragraph answer

`arg3` of the focus writer `0x93CB27` is **W — a 0x48-byte per-focus "camera-focus
wrapper" C++ object** (final vtables `0xB0BC40` primary / `0xB0BC64` secondary;
allocated by `0x94B8F7`/`0x94B92D`, initialized by `0x5BFE8C`). `[[arg3]+0x14]`
= `[W+0x14]` = a **QueryInterface-derived `IVector2D` (IID 0xBA0500) view of a
freshly-created 0x240-byte base-class movement object P** (factory `0x9C2911`,
ctor `0x9C28BF`, vtables `0xB0C660` primary / `0xB0C5B0` iface2). P's X/Y getters
return a **time-extrapolated position** between two encrypted slot pairs,
seeded from **server packet opcode 0xCE** with a fixed **Y−20 (0x14)** pixel
offset and ±1 X jitter, clamped to the map-bounds block copied from
`[[0xBDD498]+0x24]`. Both Set-capable callers (`0x5C0342`, `0x959493` via
`0x5C031A`) deliver **the same object identity W** — they are two directly-called
member methods of W (no vtable slot; exclusive direct callers `0x5C0429`/`0x5C0430`
with `ecx=ebx=W`; W vtable slot+8 holds a bare `ret 4` stub, not a thunk
[reviewer phase-2 D1 correction applied]), invoked adjacently by W's outer
method `0x5C0349`.

## 1. The object graph (all edges byte-proven)

```
opcode 0xCE packet (band 0xBC..0xCE dispatcher 0x97FAC9, arm 0x97FB7A/0x99142A)
   │ 4× 0x4066FF decode: v1..v4
   ▼
user vtable 0xB0BCE8 slot+0x7C = 0x948DE7 (this = the USER object)
   │ 0x94ACB7/0x94AA93 enumerate [user+0x1C24]
   │ 0x4423C0 on [user+0xEC8] -> vt+0xD4 -> the SHARED CAMERA Vector2D (C-106 alias)
   ▼
W ctor 0x5BFE8C(this=W, string-id=v4, user, cameraV2D, X=v1, Y=v2, 0, 0)
   ├─ W+0x44 = string-id (record tag source for 0x769B51)
   ├─ W+0x10 = the USER object (= `this` of 0x93CB27/0x9573A6!)
   ├─ W+0x24/+0x28 = X/Y;  W+0x2C/+0x30 = prior snapshot
   ├─ 0x9C2911 -> P (0x240 bytes, ctor 0x9C28BF: vtables 0xB0C660/0xB0C5B0, +0x238=0)
   ├─ 0x9BC602(P, W):  [P+0x14] = W (owner back-pointer);
   │                   P+0x138.. <- 16 bytes of [[0xBDD498]+0x24] (map bounds)
   ├─ 0xA4F6F1([0xBDD498], X, Y, 0, 0x7FFFFFFF, 1) -> owner object (map-space query; eax@0x5BFEE3)
   ├─ call [P-vt+4] = 0x9BC622(P, 1, X±1, Y−0x14, 0, 0, 3, owner=0xA4F6F1-result)
   │     ├─ clamp to [P+0x138..0x140]
   │     ├─ 0x6131F4-encrypt x→[P+0x20], y→[P+0x38], vx→[P+0x50], vy→[P+0x68]
   │     ├─ owner=[P+0x110]/[P+0x114] (conditional on W-vt+0 state query); copies [owner+0x1C]/[owner+0x20] → P+0x130/+0x134
   │     └─ rep movsd mirrors P+0x20..0x50 → P+0x80..0xB0 (base == target at t0)
   ├─ 0x5C1A08(&W+0x14, &P): QI(P+0xC iface, IID 0xBA0500) → [W+0x14] = P+0xC
   │     (QI 0x9C0EC0 accepts {0xB0E760, 0xBD37B0, 0xBA0378, 0xBA0500}, returns self+AddRef)
   ├─ 0x427EB3(renderer [0xBE2788], &camera, …); 0x429919(&W+0x18, …)
   └─ 0x5C0084(W) finalize (service QI IID 0xBA1D34)
   ▼
scene install: handler 0x5EBAB1 (vtable 0xB02FB8 slot+0x20)
   0x5D5377(user, 1, edi, [ebp-0x10], [obj9C+0x68]) → [user+0x1C30] = X
   where X = [scene-handler->0x9C]+0x68 member; X is a smart-ptr wrapper, [X+4] = W
   ▼
consumer (user update, 0x93839F): edi=[user+0x1C30]; receiver = [edi+4] = W
   0x5C0349(W):
     [W+0x2C/+0x30] ← [W+0x24/+0x28]   (save old)
     call [[W+0x14]+0x8C](P, &[W+0x24], &[W+0x28], 0…, V)   (refresh from P)
     gate: [P_primary+0x238] != 0     ← ctor-zeroed; setters in derived-class entries (0x9C3DAD family)
     branch: [user vt+0xC](=0x935076) result
        ≠0 → 0x5C02CB(W) ── 0x9573A6(this=[W+0x10]=user, …, arg7=W) → 0x959493: 0x93CB27(user, record, 0x320, W)
        =0 → 0x5C0327(W) ── 0x769B51([0xBD8FEC], [W+0x44]) → 0x5C0342: 0x93CB27([W+0x10]=user, record, 0x320, W)
   ▼
0x93CB27: tag ∈ {0x4F5C6A, 0xD7511E} → 0x93CD77: eax=[W+0x14] (P iface, AddRef)
   X = 0x404B07 → [P-vt+0x20] = 0x9C0FEF;  Y = 0x404B2E → [P-vt+0x28] = 0x9C105F
   both forward to slot+0x8C = 0x9C1499:
     [P+0x1C] delegate NULL (only writer = ctor zero) → extrapolation:
       X = round( dec(P+0x20) + (dec(P+0x80) − dec(P+0x20)) · k ),  k = elapsed·(1/30)
       (decryptor 0x548806; 0x6131F4 encryptor; round ±0.5 [0xAFEC20]/[0xB00D60];
        [0xB0C5A8] = 1/30; elapsed = [[0xBDD89C]+0x18] − 0x77F5A1([0xBE2788]) )
   ▼
0x93CC9B: Set(X, Y) on the SHARED CAMERA (created in-window at 0x93CBBE via the
   0x31D singleton chain, C-106/C-109) — the camera now targets P's position.
```

## 2. Construction & installation (WP1-A/WP1-C route 1: ctor+vtable)

| item | value | VA evidence |
|---|---|---|
| W allocation | 0x48 bytes via `[0xBE1DE0]`→`0x402D66` | 0x94B902 `push 0x48` |
| W ctor (init) | final `[W]=0xB0BC40`, `[W+4]=0xB0BC64`; construction-state stores `0xB03A1C`/`0xAFE3F0` replaced at the tail | 0x94B944 / 0x94B9A5-0x94B9AB |
| W sub-object | `[W+0x20]` = 0x9C-byte object (ctor `0x692A82`), AddRef via `[0xAFE1BC]` | 0x94B968-0x94B99C |
| W init-ctor | `0x5BFE8C(this=W, arg1→+0x44, arg2→+0x10, arg4→+0x24/+0x2C, arg5→+0x28/+0x30)` | 0x5BFEA2-0x5BFEB9 |
| P factory | 0x240 bytes; ctor `0x9C28BF` (base `0x9BC2EB`), vtables 0xB0C660/+0xC=0xB0C5B0, +0x238 zeroed | 0x9C291D `push 0x240`; 0x9C28CE-0x9C28D4; 0x9C28C7 |
| P derived classes | movement-family derived vtables 0xB0C760/0xB0C870/0xB0C970/0xB0CA70 (stride 0x110) whose slot+4 forwarders (0x9C3DD1/0x9C9983/0x9CBE4F/0x9CFCB4) also write +0x238/+0x23C/+0x254/+0x258 | vtable refs at 0xB0C764/0xB0C874/0xB0C974/0xB0CA74 |
| QI for [W+0x14] | `0x5C1A08`: QI(P+0xC iface, IID **0xBA0500**) → self+AddRef | 0x5C1A18-0x5C1A2A; QI 0x9C0EC0-0x9C0F49 |
| IID 0xBA0500 | = the Shape2D Vector2D interface id (C-106: `IID@0xBA0500={F28BD1ED-…}`) | cross-ref C-106/C-114 |

**Cross-validation route 2 (usage+dataflow)** — W's methods 0x5C0349/0x5C02CB/
0x5C0327 read exactly the members the ctor installs ([W+0x10] as `this`,
[W+0x44] as record id, [W+0x14] via 0x93CD77, [W+0x24/+0x28] refreshed via
[[W+0x14]+0x8C]); 0x9573A6 reads W's vt+0x10 (`lea eax,[ecx+0x24]` = &W+0x24)
at 0x95855A/0x95B59F gated on tag 0xD7511E. Both routes agree → the class
identity is **not** offset-coincidental.

## 3. Position semantics (WP2)

- **Source**: server packet **opcode 0xCE** (dispatcher band 0xBC..0xCE at
  0x97FAC9, arm 0x97FB7A → 0x99142A decodes 4 values v1..v4):
  X = v1, Y = v2, ? = v3 (passed to 0x948DE7 arg2-slot, unused in ctor path),
  string-id = v4.
- **Fixed offsets**: initial base slots get **(X±1, Y−0x14)** — ±1 by the
  camera-non-null branch at 0x5BFEEA (`[ebp+0x10]==0 → X+1 else X−1`), Y−20 at
  0x5BFF04 (`sub esi, 0x14`). No other fixed geometric transform on this path.
- **Space/clamping**: world/map pixel coordinates; 0x9BC622 clamps x,y against
  the 16-byte bounds block at [P+0x138..0x140] copied from `[[0xBDD498]+0x24]`
  (the physics/global-map object, findings §3.2).
- **Read-out**: extrapolated — `X = round(base + (target−base)·elapsed/30)`
  between encrypted slot pairs (P+0x20 base / P+0x80 target; decryptor
  0x548806, encryptor 0x6131F4 — the same slot-pair machinery as findings
  §4.3 with x@+0x20/y@+0x38/vx@+0x50/vy@+0x68). At ctor time base==target
  (rep movsd mirror), so the camera holds the packet point until a Set lands.
- **Set path**: vtable 0xB0C5B0 slot+0x90 (`0x9C16DD`) → slot+0x40
  (`0x9C1113`) writes the target pair (P+0x80/P+0x98 + checksums). No direct
  E8 callers exist; dispatch is vtable-mediated (see §5 residual R-T091-2).
  The owner arg of the initial 0x9BC622 call is the 0xA4F6F1 map-space query
  result (eax@0x5BFEE3), NOT P; arg7 is a flags value (3) tested with
  0xFFFFFFFE at 0x9BC737 [reviewer phase-2 D2 correction applied].

## 4. arg3 ↔ [user+0xF28] (WP3)

- `this` of `0x93CB27`/`0x9573A6` = [W+0x10] = **the user** (vtable 0xB0BCE8;
  the ctor 0x9343EF that zeroes +0xF24/+0xF28 and initializes pet[3] at
  +0x1BB4 is this class's ctor family).
- The unknown-tag fill path `0x4B1C27` replaces arg3 with **[user+0xF28]** and
  SKIPS the Set (C-115). The known-tag Set path reads **[[W+0x14]]**.
- **Verdict: DISTINCT-DATAFLOW-PROVEN.** W is created by opcode 0xCE and
  installed into user+0x1C30 (via the wrapper X = [obj9C+0x68]); the F28 slot
  is a disjoint member (+0xF28) with its own bounded installer census (T090:
  1 direct writer = ctor-zero; 13 lea sites — of which this round
  byte-verified 0x949B46 READS F28 via the smart-ptr copy 0x44484B and
  0x934B9E RELEASES it via 0x4063B5; none writes W). The Set source is never
  F28, and W never flows into F28 in any decoded path. Residual: the remaining
  F28 lea sites stay T090-bounded (see §5 R-T091-3).

## 5. Honest residuals

- **R-T091-1 — [P+0x238] gate.** 0x5C0349 requires [P+0x238]≠0; the base ctor
  zeroes it; the +0x238 setters decoded so far (0x9C3DAD: owner via 0x9BC602 +
  +0x238/+0x23C; derived-table forwarders) are vtable-dispatched — the
  specific dispatch site that arms the base-class focus P was not located this
  round.
- **R-T091-2 — the ongoing Set driver of P's target slots.** The initial write
  is proven (W ctor → 0x9BC622); the Set entry (slot+0x90→+0x40 = 0x9C1113)
  exists and its math is decoded, but no byte-located caller dispatching it on
  W's P was found (E8 census = 0 in-band; global `call [reg+0x90]` census is
  receiver-unresolvable per the task's own offset-collision warning). The
  extrapolation read side is closed; the target-refresh side is bounded.
- **R-T091-3 — F28 installer sites.** 13 lea sites from T090 remain
  undecoded (2 of them now classified as read/release).
- **R-T091-4 — Eye chain.** [obj9C+0x68] = X (the W-wrapper) was proven as a
  read at 0x5EBAEE/0x5EBBD5-0x5EBC0C; the writer of [Eye+0x68] was not located
  (the Eye object at handler+0x9C is installed via 0x472D53/0x4D6268, itself
  not fully decoded).

## 6. What CMS079 bytes prove (summary)

1. arg3 = W (the focus wrapper), identical at both Set-capable sites.
2. W's class: 0x48 bytes, vtables 0xB0BC40/0xB0BC64, ctor chain 0x94B8F7/0x94B92D/0x5BFE8C.
3. [W+0x14] = QI(P, IID 0xBA0500) where P = 0x240-byte base movement object
   (0x9C2911/0x9C28BF, vtables 0xB0C660/0xB0C5B0).
4. Initial coordinates from packet opcode 0xCE, (X±1, Y−20), clamped to map bounds.
5. X/Y getters = encrypted-slot extrapolation (0x9C1499), base==target at t0.
6. The Set lands on the shared camera (0x93CC9B), completing
   packet → W → P → getter → Set end-to-end.
7. 13/14 callers of 0x9573A6 pass arg7=0 (dominance-proven registers);
   only 0x5C031A passes W.
8. The user (not W, not P) is the `this` of the focus writer; F28 is the
   unknown-tag fallback that never feeds the Set.
