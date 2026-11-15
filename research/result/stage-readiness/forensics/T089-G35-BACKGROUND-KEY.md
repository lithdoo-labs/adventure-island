# T089 — G35 Background Depth Key: CMS079 Original Closure (forensics)

**Round**: t089 (2026-11-16). Lead-agent derivation; independently corroborated by the T089
blind reviewer (61-site census + 0x669923/0x669930 window, see T089-REVIEWER-BLIND-NOTES §G35).

**Sources** (all hashes verified at round start):
- EXE `.work/task-036/game-image-unpacked.bin` SHA-256 `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` (linear image, `fileOffset = VA − 0x400000`).
- 13-map resources `content/[FSDB]adventure/[group]map.Back/map.*.jsonl` (387 records).

**External candidate (level B, NOT evidence by itself)**: OpenMS GMS083 `0x0063CD4E`
(`https://docs.openms.dev/client/client-evidence`, read 2026-11-16): back `B−128000+index*1000`,
front `B+272000+index*1000`, `B = −0x40000000`.

---

## 1. The key computation (original bytes, loader 0x669397)

Property read at 0x6698C7: `push 0x54B` → `0x7A48D0/0x406368/0x40263B/0x403AC7/0x415344`,
then boolean normalization (`neg/sbb/neg`) at 0x6698FA–0x669904:
`esi = (value != 0) ? 1 : 0`.

Namespace id **0x54B decrypts to `front`** (static cipher per C-103; table 0xBA7B04,
record 0x00BC964C type 127 — see T089-NAMESPACE-ID-NAMES.txt).

```
0066991C  3bf3                   cmp esi, ebx            ; esi = front(0/1), ebx = 0
0066991E  8b4508                 mov eax, [ebp+8]        ; eax = index (arg1)
00669921  740d                   je 0x669930             ; front==0 -> BACK branch
00669923  69c0e8030000           imul eax, eax, 0x3e8    ; FRONT: index*1000
00669929  2da0dcfb3f             sub eax, 0x3ffbdca0     ;   -= (B + 271200)
0066992E  eb0b                   jmp 0x66993b
00669930  69c0e8030000           imul eax, eax, 0x3e8    ; BACK: index*1000
00669936  2d00f40140             sub eax, 0x4001f400     ;   -= (B - 128000)
0066993B  8945cc                 mov [ebp-0x34], eax     ; the depth key
```

Signed evaluation (32-bit):
- **back  (front==0): `key = −0x40000000 − 128000 + index·1000`** (−1073869824 + 1000·index)
- **front (front!=0): `key = −0x40000000 + 271200 + index·1000`** (−1073470624 + 1000·index)

### Cross-version contrast (mandatory separation)

| | back const | front const |
|---|---|---|
| GMS083 (OpenMS candidate) | B − 128000 | **B + 272000** |
| **CMS079 (proven bytes)** | B − 128000 (identical) | **B + 271200 — differs by 800** |

The CMS079 front space sits 800 units *below* GMS083's. Porting the GMS083 constant would have
been wrong; the difference also keeps the front space clear above the tile/obj space either way.

## 2. Index provenance (enumeration order)

Sole E8 caller of the loader 0x669397 is `0x669354`, inside the enumeration loop
(0x6692B9–0x66936E):

```
006692A4  mov ecx,[ebp-0x10]      ; the map's Back collection node
006692A7  call 0x409ffd           ; child count
006692AC  xor edi, edi            ; index = 0
006692B9  (loop) build V{VT_I4, edi}; [ebp-0x10].child(index) via 0x40263B/0x4032B2
00669351  push edi                ; arg1 = index
00669352  mov ecx, ebx            ; this = loader object
00669354  call 0x669397           ; load one background record
0066936A  inc edi; cmp edi,[ebp-0x20]; jl 0x6692b9
```

**index = the Back child-collection enumeration order (0,1,2,…)** — byte-proven.

## 3. Key consumption (registration into the sorted scene)

After the key store, the loader performs (0x669944–0x66996B):
`0x6713AC` record init → `0x671B59(ecx=[this+0xD0], &index, &record)` find-or-create
layer node keyed by the index (hash map `k*5 % buckets`, node {vtable 0xB04B9C/0xB04BA0,
next, key=index, record}) → resolve `0x31D 'Shape2D#Vector2D'` → `0x447891` create the
record's vector → `0x4371B1` origin read → `0x411FE1`/`call [vector+0x64]` attach to the
renderer origin vector.

The key value itself is consumed at two sites:

1. **Non-ani branch — 0x669BD6**:
   `0x427EB3(ecx=[0xBE2788], &out, 0,0,0,0, KEY, …)` — the slot25 invoker (G36 §7);
   the depth key enters the Gr2D scene insertion path and the result registers via
   `0x429919` into the record list. *(Phase-2 D4 note: the serial-on-insert
   `inc [esi+0xD0]` byte sits at 0x5040AC96 inside the Gr2D frame writer, not the
   slot25 path; the authoritative statically-proven ordering receiver is C-097's
   slot45→tree comparator chain, with the runtime slot25 body of [0xBE2788] as the
   documented G24/G27 bridge — the G35 closure rests on the EXE-side key
   computation + delivery, which is fully static.)*
2. **Ani branch — 0x669FE6**: `push [ebp-0x34]` (KEY) together with `[ebp-0x5C]` (alpha `a`)
   and `[this+0xEC]` feeds the animated-background creation call chain
   (`0x43286E` variant init → `0x429411` → **`0x43E3A6(&out, …, KEY, a, ctx)`**, add esp 0x28),
   whose result registers via `0x429919`.

Both branches therefore hand the computed key to the runtime scene registration — the
draw-order linkage demanded by G35's residual.

## 4. Whole-image census (supersedes EV-20)

Whole-EXE census of `imul r32, r32, 1000` (opcode 0x69 /r, imm32 0x3E8): **61 sites**
(T089-G35-KEY-SEARCH.txt; the blind reviewer independently counts 61 decode-anchored sites).
The two sites in the map-loader band are exactly 0x669923/0x669930 — the two branches of the
single background-key computation. **EV-20's "exactly 1 imul-1000 site" and C-024's address
0x423E6B attribution are superseded**: 0x423E6B is an unrelated ×1000 scaling (blind reviewer:
feeds a `[0xBE16D8]` call with arg 0xAA over `[[0xBD900C]+0x208]`), not the background key.

Immediates: 0x0001F400 (128000) occurs 2× (data band only), 0x00042680 (272000) 0×,
folded B±const forms appear only inside the two `sub eax, imm32` instructions above —
the compiler folded the formula into those two constants, which is why naïve
constant-scans never found it.

## 5. 13-map resource verification (T089-G35-FSDB-CENSUS.txt)

387 Back records across the 13 maps (map.222000000…230030200), **26 with front=1**;
per-map record counts 1..47 (**index is 0-based**, so index domains are 0..n−1). Ordering envelope (signed):

```
back0  = −1073869824   <  tile base = −1073721834   <  obj base = −1073739824? (see note)
                                                          obj base = −1073739824 < tile base
front0 = −1073470624   >  every tile/obj key
```

(obj base −1073739824 < tile base −1073721834; both lie strictly between the back and front
key spaces; index·1000 with index ≤ 47 never crosses either gap.)

## 6. Signed boundary test vectors (T089-G35-FSDB-CENSUS.txt)

- back index 0/1/17 → −1073869824 / −1073868824 / −1073852824
- front index 0/1/17 → −1073470624 / −1073469624 / −1073453624
- negative-index signed-arithmetic checks (enum-impossible, arithmetic-verified):
  back −1 → −1073870824 (0xBFFE0818); front −1 → −1073471624 (0xC0041F78)
- The `je`-branch polarity: front flag 0 (back) takes the `0x4001F400` constant path;
  any nonzero front takes the `0x3FFBDCA0` path (boolean normalization makes the exact
  nonzero value irrelevant — matching the WZ boolean `front`).

## 7. Verdict

| item | grade |
|---|---|
| back/front key arithmetic (both constants) | DIRECT-INSTRUCTION (CMS079) |
| branch = boolean(WZ `front`, id 0x54B name-decrypted) | DIRECT-INSTRUCTION + static name proof |
| index = Back child enumeration order | DIRECT-INSTRUCTION |
| key consumption into scene registration (2 branches) | DIRECT-INSTRUCTION |
| 61-site census / EV-20 supersession | DIRECT-CENSUS |
| 13-map resource envelope | FSDB-VERIFIED |
| GMS083 B+272000 front constant | REFUTED-FOR-CMS079 (B+271200 instead) |

**G35 closure conditions are met**: complete formula, front/back branch, index source,
final consumption chain, boundary vectors, resource verification. Status proposal:
`PARTIAL-STATIC → CLOSED-STATIC`.
