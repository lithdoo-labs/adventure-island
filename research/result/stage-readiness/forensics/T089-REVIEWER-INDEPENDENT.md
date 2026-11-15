# T089 — Independent OpenMS Cross-Version Static Evidence Reviewer (archived)

> Archived by the T089 lead agent from the reviewer sub-agent's private working directory (independent context, independent scripts, read-only repo access, no commits/pushes). The reviewer session is real and separate; this file is a faithful concatenation of its four phase reports (Phases 1-3 archived with the round commit 95c137cc; Phase 4 added by this archive commit and re-read from the remote afterward, per the final-SHA rule).

---

# T089 — INDEPENDENT REVIEWER BLIND BASELINE NOTES (CMS079-ONLY)

**Reviewer**: T089 "Independent OpenMS Cross-Version Static Evidence Reviewer" — Phase 1 (BLIND).
**Blind declaration**: I did NOT read `research/reference/maplestory-symbols/*` and did NOT fetch any
external web resource in this phase. Everything below derives from (a) the CMS079 original binaries
and (b) the repo's own canonical ledgers/forensics listed in the tasking. No lead-agent script was
trusted for any evidence decision; all disassembly below was produced by my own scripts in this
directory (`t089_common.py`, `t089_g35_*.py`, `t089_g36*.py`, `t089_g39*.py`, `t089_g10*.py`;
raw outputs in `out-*.txt`).

**Repo baseline (verified)**: `git rev-parse HEAD` = `42e2d7fb8b7eb49f4cd3f61b48fc56cc391168ba`,
branch `design/adventure-field-map-scene`. READ-ONLY: no file in the repo was modified.

**Binary identities (SHA-256, independently recomputed 2026-11-16)**:

| file | sha256 | expected | match |
|---|---|---|---|
| .work/task-036/game-image-unpacked.bin | `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` | same | YES |
| .work/task-063/client-stage/Gr2D_DX8.dll | `ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1` | same | YES |
| .work/task-063/client-stage/Shape2D.dll | `9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b` | same | YES |
| .work/task-063/client-stage/PCOM.dll | `cf3807f3107152d3b305bfc84be36d58b62306c94f60133c8e80fd17f9d9e54b` | same | YES |
| .work/task-063/server079.jar | `49382081ff5525380bc6024f61859d2e08c2983b0faca2554061c6d1218cf360` | same | YES |

**Mappings used (self-derived from PE headers / verified)**:
- EXE = linear memory dump, ImageBase 0x400000, `fileOffset = VA − 0x400000` (10,330,112 bytes).
- Shape2D.dll PE: ImageBase 0x51400000; sections .text 0x1000/0xAA4E, .rdata 0xC000/0x351A,
  .data 0x10000/0x1CD0, .rsrc, .reloc; raw offsets == virtual addresses (identity mapping).
- Gr2D_DX8.dll PE: ImageBase 0x50400000; .text 0x1000/0x2B10C, .rdata 0x2D000, .data 0x35000,
  .data1 0x3B000 (raw 0x3A000 — NOT identity), .rsrc 0x3C000 (raw 0x3B000), .reloc 0x3D000.
- "Code band" = [0x401000, 0xBEA000) for the EXE (repo convention, EV-93); everything ≥ 0xBEA000
  is data. Note: my sweeps show structured data tables already at 0xB0xxxx–0xB9xxxx, so "in code
  band" is necessary-not-sufficient for "real instruction" — I verified instruction-boundary
  anchoring separately where it matters.

Capstone 5.0.7, CS_MODE_32, linear sweeps with exact-landing anchor verification.

---

## 1. G35 — the "imul ×1000" background-key question

### 1.1 What is actually at EXE 0x423E6B

Clean anchored sweep (earliest start 0x423E30 decodes through the site exactly):

```
00423E5C  a10c90bd00             mov eax, dword ptr [0xbd900c]
00423E61  8b8008020000           mov eax, dword ptr [eax + 0x208]
00423E67  85c0                   test eax, eax
00423E69  7417                   je 0x423e82
00423E6B  69c0e8030000           imul eax, eax, 0x3e8          <==
00423E71  6a00                   push 0
00423E73  50                     push eax
00423E74  68aa000000             push 0xaa                      ; 170
00423E79  ff7508                 push dword ptr [ebp + 8]
00423E7C  ff15d816be00           call dword ptr [0xbe16d8]
00423E82  33c0                   xor eax, eax
...        (SEH epilogue, ret 0x10 at 0x423E8F)
```

**Verdict**: 0x423E6B is a *1000 scaling of field `[ [0xBD900C] + 0x208 ]`* whose result is pushed
as an argument to a 4-arg indirect call via fn-ptr global `[0xBE16D8]` with constant 0xAA, in a
small function ending `ret 0x10`. Nothing in this window references backgrounds, layers, sort keys,
or the map loader (0x66xxxx). The historical identification of this site as "the" background-key
site is **unsupported by its local bytes**; at best it is an unrelated ×1000 scaling. EV-20's
"context insufficient" is accurate; the C-024 address attribution is not advanced by this site.

### 1.2 Whole-EXE census of `imul r32, rm32, 1000` (0x69 /r, imm32 = E8 03 00 00, all ModRM forms)

Method: every byte 0x69 in the image decoded with capstone at that offset; kept iff it decodes as
`imul ..., 0x3e8` in one instruction. Then instruction-boundary plausibility: earliest backward
decode chain (1..64 bytes) that lands exactly on the site.

**Result: 62 byte-pattern occurrences; 61 are anchored real instructions in the code band;
1 (0x00C99CDD, `imul ecx, dword ptr [ebx + 0x55006ade], 0x3e8`) is in the data band (misaligned).**

All 61 real sites (VA, operands):
```
00423E6B imul eax,eax,1000      004318C7 imul ecx,ecx,1000      00431AC2 imul eax,eax,1000
00431C21 imul eax,eax,1000      0049AC08 imul ecx,ecx,1000      00536885 imul eax,eax,1000
00561174 imul edi,edi,1000      00564F1D imul ecx,ecx,1000      00565089 imul ecx,ecx,1000
0056530C imul ecx,ecx,1000      00565422 imul ecx,ecx,1000      00565596 imul ecx,ecx,1000
0056D052 imul ecx,ecx,1000      0057363B imul esi,esi,1000      00589F09 imul edi,edi,1000
005C590D imul eax,eax,1000      005C59EB imul eax,eax,1000      00669923 imul eax,eax,1000  << loader
00669930 imul eax,eax,1000  << loader
00733A50 imul eax,eax,1000      0073CF0C imul edi,edi,1000      0076F732 imul esi,esi,1000
0076F79F imul esi,esi,1000      0076FC4B imul eax,eax,1000      0076FCAE imul eax,eax,1000
0077238D imul eax,eax,1000      0077EAD0 imul ecx,ecx,1000      00783366 imul eax,eax,1000
0079A1B3 imul ecx,ecx,1000      0079A1CA imul eax,eax,1000      0079A3A2 imul ecx,ecx,1000
0079A3B5 imul eax,eax,1000      0079A53D imul eax,eax,1000      0079A550 imul eax,eax,1000
0079A63C imul eax,eax,1000      0079A653 imul eax,eax,1000      0079A6B8 imul eax,eax,1000
0079A6CB imul eax,eax,1000      007AC5FF imul eax,eax,1000      007AC987 imul eax,eax,1000
008BE2D1 imul esi,esi,1000      0093A207 imul eax,eax,1000      0093A410 imul eax,eax,1000
0093A549 imul eax,eax,1000      0093A618 imul eax,eax,1000      0093ABFA imul eax,eax,1000
0093B92F imul eax,eax,1000      0093BA16 imul eax,eax,1000      0093BCDE imul eax,eax,1000
0093BD7B imul eax,eax,1000      0093BED9 imul eax,eax,1000      0093CAA2 imul eax,eax,1000
00963BDC imul esi,esi,1000      00968524 imul ecx,ecx,1000      00969F02 imul esi,esi,1000
00A30558 imul eax,eax,1000      00A3069D imul eax,eax,1000      00A30789 imul eax,eax,1000
00A7F2F5 imul eax,eax,1000      00A7F3F2 imul eax,eax,1000      00A7F41D imul eax,eax,1000
```
**EV-20's "exactly 1 imul-1000 site found" is CONTRADICTED as a whole-EXE statement** (it was a
windowed Round-4 scan). ×1000 is a common idiom in this binary; imul-count alone cannot identify
the background-key site.

### 1.3 The REAL loader key construction — 0x669923 / 0x669930 (inside loader 0x669397)

Anchored window (from the §1.2 census context dump, bytes exact):

```
006698C7  684b050000             push 0x54b                     ; WZ property id 0x54B
006698CC  50                     push eax
006698CD  e8feaf1300             call 0x7a48d0                  ; namespace fetch
006698D2  8bc8                   mov ecx, eax
006698D4  e88fcad9ff             call 0x406368
006698D9..006698F5               ; property-read chain 0x40263B -> 0x403AC7 -> 0x415344
006698FA  8bf0                   mov esi, eax
006698FC  f7de                   neg esi                        ; boolean-normalize (neg/sbb/neg)
00669901  1bf6                   sbb esi, esi
00669904  f7de                   neg esi                        ; esi = flag(property 0x54B)
0066991C  3bf3                   cmp esi, ebx                   ; ebx = 0
0066991E  8b4508                 mov eax, dword ptr [ebp + 8]   ; eax = arg1 (layer index)
00669921  740d                   je 0x669930
00669923  69c0e8030000           imul eax, eax, 0x3e8           ; key = idx*1000
00669929  2da0dcfb3f             sub eax, 0x3ffbdca0            ;   - 0x3FFBDCA0 (flag != 0)
0066992E  eb0b                   jmp 0x66993b
00669930  69c0e8030000           imul eax, eax, 0x3e8           ; key = idx*1000
00669936  2d00f40140             sub eax, 0x4001f400            ;   - 0x4001F400 (flag == 0)
0066993B  8945cc                 mov dword ptr [ebp - 0x34], eax
00669944..0066994E               ; ctor 0x6713AC on [ebp-0x64] (key-bearing node)
00669961  8d8fd0000000           lea ecx, [edi + 0xd0]
0066996B  e8e9810000             call 0x671b59                  ; layer-container map lookup
00669970..00669998               ; then resolve namespace 0x31D (push 0x31d; 0x7a48d0; 0x40634c;
                                 ;  [eax]; 0x447891 -> attaches the shared Vector2D into [ebp-0x14])
```

**Independent G35 verdict**: the layer/background key is `index*1000 − K` with a **selector flag =
boolean(WZ property id 0x54B)** and TWO key-space constants:
- K1 = 0x3FFBDCA0 (flag≠0), K2 = 0x4001F400 (flag=0); K2 − K1 = 0x61760 = 399200.
- As signed ints both keys are large negative numbers (≈ −1.07e9) for realistic indices — two
  parallel, well-separated key spaces. "index×1000 independent key space" (C-024) is **confirmed in
  multiplier**, but the historical formula omits the constant offsets and the selector.
- The key feeds map lookup 0x671B59 on `[this+0xD0]` — this is the container-selection the tiler's
  arg9 comes from (G36 §2 corroborated).

### 1.4 Dword immediates census (4-byte LE, any alignment, whole EXE)

| value | raw hits | verdict |
|---|---|---|
| 0x0001F400 (128000) | 2 | **BOTH unaligned byte-coincidences, NOT constants**: 0x70E6D8 is the imm16-tail of `cmp dword ptr [edi+0xb8], 0x1f4` (500) at 0x70E6D3 (`81 bf b8 00 00 00 f4 01 00 00`); 0xBA1A37 spans the last byte of dword 450 and the first 3 bytes of dword 500 inside an ascending data table (150,200,250,…,500) at 0xBA1A1C.. — i.e. **0x1F400 occurs ZERO times as a real aligned constant in the EXE**. |
| 0x00042640 (272000) | 0 | **no occurrence anywhere** in the EXE. |
| 0xC0000000 | 564 | 9 in the code band as real instructions (below); the rest are data-band table/vtable bytes. |

Code-band 0xC0000000 instruction sites (all verified with clean anchored sweeps):
```
004AF568  68000000c0             push 0xc0000000 ; + [eax+0xB4] vtable-slot call (arg)
00559F07  8d8f000000c0           lea ecx, [edi - 0x40000000]      ; edi = i*30000 (0x7530 imul at 0x559EFB)
                                                              ; -> arg to [eax+0xB4] slot call
005E57BD  68000000c0             push 0xc0000000 ; arg to 0x427EB3 (the shared resolver helper!)
00643FFE  68000000c0             push 0xc0000000 ; push sequence w/ 0x1b2, 0x248, 0xfffff821, 0xfffffef8
006C3A72  68000000c0             push 0xc0000000 ; + [eax+0xB4] slot call (arg)
0079DBED  68000000c0             push 0xc0000000 ; arg to [0xbe15f4] call (device/D3D-style, 7 pushes)
00A6C972  68000000c0             push 0xc0000000 ; arg to [0xafe114] call
00A7EC14  c745f4000000c0         mov [ebp-0xc], 0xc0000000   ; 3-way selector vs 0x40000000/0x80000000
00A81CCE  81ff000000c0           cmp edi, 0xc0000000         ; HRESULT-style severity check (test 0x40000000 nearby)
```
**No 0xC0000000 site exists in the 0x66xxxx map-loader region.** Note the recurring
`call [vtable+0xB4]` sites (0x4AF56E, 0x6C3A78) and the 0x427EB3 arg at 0x5E57BD — 0xC0000000 is a
sentinel/flag argument in COM-slot calls in CMS079, not a map constant.

---

## 2. G36 — scroll-branch slot-call sites + Shape2D Vector2D vtable

### 2.1 The four layer-object call sites (raw bytes + argument shapes) — all verified byte-exact

**(a) 0x66A5F2 — first +0x90 (immediate position)**
```
0066A592  be3073be00             mov esi, 0xbe7330        ; V{VT_ERROR,missing} template
0066A598..0066A5A8              ; 0x40318F(&[ebp-0x58]) and 0x40318F(&[ebp-0x30]) build 2 default VARIANTs
0066A5C5..0066A5E1              ; two 16-byte VARIANT copies onto the stack (sub esp,0x10; movsd×4)
0066A5E2  8b758c                 mov esi, dword ptr [ebp - 0x74]
0066A5E5  03d6                   add edx, esi             ; edx = x + xoff
0066A5E7  52                     push edx                 ; arg y (pushed 2nd-to-last)
0066A5E8  8b5588                 mov edx, dword ptr [ebp - 0x78]
0066A5EB  03da                   add ebx, edx             ; ebx = y + yoff
0066A5ED  53                     push ebx                 ; arg x?? (see note)
0066A5EE  50                     push eax                 ; this = [ebp-0x14] object
0066A5F2  ff9190000000           call dword ptr [ecx + 0x90]      <==
```
(precise x/y mapping per Set body order: stack args are (this, x, y, V3, V4); the two variant
copies precede the pushes — the 16-byte blocks ARE V4 and V3.) Shape confirmed:
`Set(obj, x+xoff, y+yoff, V{VT_ERROR}, V{VT_ERROR})`.

**(b) 0x66A692 — second +0x90 (armed with the scroll phase)**
```
0066A63A  6a03                   push 3                   ; VT_I4
0066A63C  6800000010             push 0x10000000         ; V4 value
0066A644  e86c8bd9ff             call 0x4031b5           ; build V{VT_I4, 0x10000000} at [ebp-0x58]
0066A649  6a03                   push 3
0066A64B  ff75e4                 push dword ptr [ebp - 0x1c]  ; the sum (phase)
0066A655  e85b8bd9ff             call 0x4031b5           ; build V{VT_I4, sum} at [ebp-0x30]
0066A66E..0066A691              ; two 16-byte copies; push [ebp-0x74]; push [ebp-0x88]; push ebx(obj)
0066A692  ff9090000000           call dword ptr [eax + 0x90]      <==
```
Shape confirmed: `Set(obj, x, y, V{VT_I4,sum}, V{VT_I4,0x10000000})` — matches C-060's delivery
claim byte-for-byte.

**(c) 0x66A729 — horizontal +0x98**
```
0066A6F1  8b0d8827be00           mov ecx, dword ptr [0xbe2788]
0066A6FB  e8b1cadcff             call 0x4371b1           ; slot+0x5C out-read -> eax
0066A703  8b30                   mov esi, dword ptr [eax] ; esi = origin object
0066A715  8b4d90                 mov ecx, dword ptr [ebp - 0x70]   ; ry
0066A71D  83c164                 add ecx, 0x64           ; ry + 100
0066A720  51                     push ecx                ; arg6
0066A721  6a00                   push 0                  ; arg5
0066A723  6a64                   push 0x64               ; arg4 = 100
0066A725  6a64                   push 0x64               ; arg3 = 100
0066A727  56                     push esi                ; arg2 = origin
0066A728  57                     push edi                ; arg1 = this ([ebp-0x14])
0066A729  ff9098000000           call dword ptr [eax + 0x98]      <==
```

**(d) 0x66A792 — vertical +0x98** (same shape, arg5/arg6 swapped):
```
0066A77E  8b4d94                 mov ecx, dword ptr [ebp - 0x6c]   ; rx
0066A788  83c164                 add ecx, 0x64
0066A786  6a00                   push 0                  ; arg6
0066A78B  51                     push ecx                ; arg5 = rx + 100
0066A78C  6a64                   push 0x64
0066A78E  6a64                   push 0x64
0066A790  56                     push esi                ; origin
0066A791  57                     push edi                ; this
0066A792  ff9098000000           call dword ptr [eax + 0x98]      <==
```
Claimed shapes CONFIRMED at byte level for all four sites.

### 2.2 Who is the receiver? The scroll-branch "layer" IS the shared 0x31D Vector2D

From the anchored window at 0x669970–0x669998 (loader, before the scroll branch):
```
00669970  895dec                 mov dword ptr [ebp - 0x14], ebx        ; zero
00669976  681d030000             push 0x31d
0066997C  e84baf1300             call 0x7a48d0
00669987  e8c0c9d9ff             call 0x40634c
0066998C  8b00                   mov eax, dword ptr [eax]
00669998  e8f4deddff             call 0x447891                          ; attach -> [ebp-0x14]
```
And all four sites (2.1a–d) use `[ebp-0x14]` as the receiver. Independently verified supporting
facts: IID bytes at EXE 0xBA0500 == Shape2D 0x514101C0 (`ed d1 8b f2 eb 3d 92 4f 9e ec 10 ef 5a 1c 3f b4`
= GUID {F28BD1ED-3DEB-4F92-9EEC-10EF5A1C3FB4}); UTF-16 names `Vector2D`@0x5141014C,
`Convex2D`@0x51410138, `PolyShape2`@0x51410120 (note: **"PolyShape2", not "PolyShape"** — minor
correction to T088 wording); registration name `Shape2D#Vector2D`@0x514115D0; RTTI
`.?AVCWzVector2D@@`@0x51410248. (The factory record+0x10 lazy-singleton walk itself I did NOT
re-derive this round — repo-verified in EV-95; all pieces I spot-checked match.)

### 2.3 Shape2D.dll vtable at 0x5140C2F0 (full dump, slots +0x00..+0xC0)

PE mapping: RVA 0xC2F0 = file offset 0xC2F0 (.rdata). All 49 entries point into .text:

```
+0x00 0x51401a09  +0x04 0x514019e9  +0x08 0x514019f9  +0x0C 0x51406970  +0x10 0x5140699f
+0x14 0x514071e6  +0x18 0x514071fe  +0x1C 0x51407233  +0x20 0x5140724a  +0x24 0x51407282
+0x28 0x514074c8  +0x2C 0x51407500  +0x30 0x5140754d  +0x34 0x5140755e  +0x38 0x5140756f
+0x3C 0x51407580  +0x40 0x51407591  +0x44 0x514075c9  +0x48 0x51407622  +0x4C 0x514076bc
+0x50 0x514076c4  +0x54 0x51401a79  +0x58 0x514076cc  +0x5C 0x514076e8  +0x60 0x5140770d
+0x64 0x5140778c  +0x68 0x51407ab6  +0x6C 0x51407b26  +0x70 0x51407aee  +0x74 0x51407b57
+0x78 0x51407b88  +0x7C 0x51407cb2  +0x80 0x51407ce1  +0x84 0x51407da7  +0x88 0x51407e64
+0x8C 0x51407eb0  +0x90 0x5140828f  +0x94 0x514083cf  +0x98 0x5140847d  +0x9C 0x514086b3
+0xA0 0x51408a50  +0xA4 0x51408bed  +0xA8 0x51408c9a  +0xAC 0x51408ee7  +0xB0 0x51401a8e
+0xB4 0x51402c88  +0xB8 0x51402c7e  +0xBC 0x51402c62  +0xC0 0x51402c6c
```
Matches the repo's T088 table exactly (all 49 entries). GetX +0x20=0x5140724A → `[this+0x1C]`;
GetY +0x28=0x514074C8 → `[this+0x20]` (bodies re-verified in §5.3).

### 2.4 Slot bodies (candidates for attach/Set/parallax semantics)

**Slot +0x64 → 0x5140778C, `ret 0x14` (this + 4 stack args).** Head + semantics (full body dumped in
out-g36b.txt): VARIANT-gated (`cmp word [ebp+0xc],0 / 0xa` → fast path at 0x5140782F when
VT_EMPTY/VT_ERROR); else coerces arg2 to VT_UI4 (push 0xD) via 0x51405A4B, looks up a dictionary
(0x514054A8), iterates keys (0x5140A660), and on match takes the current-position-wrapper path
(0x514078EA: `push [esi+0x20]; add esi,0x24; push [esi-8]; push esi; call 0x514072cf` — the SAME
wrapper builder the Set interpolation uses) then commits via 0x51407981/0x51407A34. It is a
name/property-indexed accessor-mutator over the pending collection — the "slot25-style PUT" family
member for this class. E_POINTER/E_INVALIDARG paths standard.

**Slot +0x90 → 0x5140828F, `ret 0x2C`** — the Set body, re-verified byte-exact vs EV-95 (see §5.3).

**Slot +0x98 → 0x5140847D, `ret 0x18` (this + 5 stack args — matches the loader's 6 pushes exactly).**
```
5140847D  b86eb74051             mov eax, 0x5140b76e      ; SEH prolog
51408482  e899280000             call 0x5140ad20
51408487  83ec0c                 sub esp, 0xc
5140848E  395d0c                 cmp dword ptr [ebp + 0xc], ebx   ; arg2 (origin) != 0
51408495  750a                   jne 0x514084a1
51408497  b803400080             mov eax, 0x80004003               ; E_POINTER
514084A1  395d10                 cmp dword ptr [ebp + 0x10], ebx   ; arg3 (100) != 0
514084A4  0f84bf000000           je 0x51408569                     ; E_INVALIDARG
514084AA  395d14                 cmp dword ptr [ebp + 0x14], ebx   ; arg4 (100) != 0
514084B3  8b0d741c4151           mov ecx, dword ptr [0x51411c74]   ; class/global singleton
514084BC  e8b61a0000             call 0x51409f77
514084CE  e8ac000000             call 0x5140857f                   ; record ctor: installs vtables
514084D9  ff750c                 push dword ptr [ebp + 0xc]        ; origin
514084DC  8d7e08                 lea edi, [esi + 8]
514084E4  e8d0a6ffff             call 0x51402bb9                  ; -> record+0x08 = origin obj
514084F7  8b0f                   mov ecx, dword ptr [edi]
514084F9  e8dbd7ffff             call 0x51405cd9                  ; GetX(origin)
514084FE  89460c                 mov dword ptr [esi + 0xc], eax    ; record+0x0C = X0
5140850F  8b0f                   mov ecx, dword ptr [edi]
51408511  e8ead7ffff             call 0x51405d00                  ; GetY(origin)
51408516  894610                 mov dword ptr [esi + 0x10], eax   ; record+0x10 = Y0
51408519  8b4510                 mov eax, dword ptr [ebp + 0x10]
5140851C  894614                 mov dword ptr [esi + 0x14], eax   ; record+0x14 = arg3 (100) = Dx
5140851F  8b4514                 mov eax, dword ptr [ebp + 0x14]
51408522  894618                 mov dword ptr [esi + 0x18], eax   ; record+0x18 = arg4 (100) = Dy
51408525  8b4518                 mov eax, dword ptr [ebp + 0x18]
51408528  89461c                 mov dword ptr [esi + 0x1c], eax   ; record+0x1C = arg5 = Wx
5140852B  8b451c                 mov eax, dword ptr [ebp + 0x1c]
5140852E  894620                 mov dword ptr [esi + 0x20], eax   ; record+0x20 = arg6 = Wy
51408531..51408543              ; current-pos wrapper 0x514072CF(this+0x24,[this+0x1C],[this+0x20])
51408546  56                     push esi
51408549  e8edfdffff             call 0x5140833b                  ; SAME commit as Set-interp
5140857C  c21800                 ret 0x18
```
And the record's **applier body 0x514085B3** (record vtable family 0x5140D920/0x5140D91C/0x5140D930
installed by ctor 0x5140857F):
```
514085C9  8b4e08                 mov ecx, dword ptr [esi + 8]
514085CC  e808d7ffff             call 0x51405cd9                  ; GetX(rec.obj)
514085D1  2b460c                 sub eax, dword ptr [esi + 0xc]    ; - X0
514085D8  0faf461c               imul eax, dword ptr [esi + 0x1c]  ; * Wx
514085DC  99                     cdq
514085DD  f77e14                 idiv dword ptr [esi + 0x14]       ; / Dx
514085E0  0107                   add dword ptr [edi], eax          ; out_x += (X-X0)*Wx/Dx
514085EE  8b4e08                 mov ecx, dword ptr [esi + 8]
514085F1  e80ad7ffff             call 0x51405d00                  ; GetY(rec.obj)
514085F6  2b4610                 sub eax, dword ptr [esi + 0x10]   ; - Y0
514085F9  0faf4620               imul eax, dword ptr [esi + 0x20]  ; * Wy
514085FE  f77e18                 idiv dword ptr [esi + 0x18]       ; / Dy
51408601  014704                 add dword ptr [edi + 4], eax      ; out_y += (Y-Y0)*Wy/Dy
51408609  c20c00                 ret 0xc
```
**INDEPENDENT NEW STATIC FACT (blind phase)**: Shape2D slot +0x98 is a *parallax/scroll attach*:
it registers into the SAME pending-animation list as Set's interpolation ([this+0x30] collection
via commit 0x5140833B) a record `{obj=origin, X0, Y0, Dx, Dy, Wx, Wy}`, and the record applies
`out += (pos − origin) * W / D` per axis. With the loader's arguments (§2.1c/d):
horizontal: `out_x += (X−X0)·0/100 = 0`; `out_y += (Y−Y0)·(ry+100)/100`.
vertical: `out_x += (X−X0)·(rx+100)/100`; `out_y += 0`.
i.e. **parallax ratio = (rate+100)/100 relative to the [0xBE2788] slot+0x5C origin object** — the
CMS079 G36 "concrete +0x98 transform body" residual is CLOSED STATICALLY for the scroll-branch
pair (caveat: the out-pointer consumers and call cadence of the applier are not traced; the
applier-to-record-vtable linkage is established by ctor-vtable installation + field match, INFERENCE
grade on the exact vtable slot index, DIRECT on the formula).

**Slot +0x9C → 0x514086B3, `ret 0x34`** (this + 12 stack dwords): clamps two int args
([ebp+0x24], [ebp+0x28]) to ≤0xFFFFFF, VARIANT-gates [ebp+0xC] (fast path when VT_EMPTY/VT_ERROR),
coerces to VT_UI4, resolves a collection member (0x51405448), conditionally invokes
`[obj+8]` (Release-style) — an "attach member object with two clamped ints" method; the tiler's
span/2-based +0x9C call shape is consistent with this arity.

### 2.5 G36 independent verdicts

- The four scroll-branch call shapes: CONFIRMED byte-exact (argument order/counts/variant arming).
- The scroll-branch receiver is the shared CWzVector2D (namespace 0x31D chain + IID equality +
  call-shape match of ret 0x2C/ret 0x18 vs the push counts) — the "runtime-bound COM target"
  residual is closed for THESE sites (NOT for the per-tile objects resolved via 0x427EB3, whose
  class identity remains runtime-bound; [0xBE2788] itself is provably NOT a CWzVector2D, see §3.5).
- The +0x98 parallax attach semantics: NEW static closure (formula above).
- Obj/bg tiling layout, zero-step fallbacks, span math: not re-derived this round (repo grade A
  already; no contradicting bytes encountered in any overlapping window).

---

## 3. G39 — animation/scroll clock

### 3.1 EXE 0x43715C ("layer slot +0x58 read") — body + neighborhood

```
0043715C  55                     push ebp
0043715D  8bec                   mov ebp, esp
0043715F  51                     push ecx
00437160  56                     push esi
00437161  8bf1                   mov esi, ecx
00437163  8b06                   mov eax, dword ptr [esi]     ; vtable
00437165  8d4dfc                 lea ecx, [ebp - 4]
00437168  51                     push ecx                     ; &out
00437169  56                     push esi                     ; this
0043716A  ff5058                 call dword ptr [eax + 0x58]  ; slot +0x58
0043716D  85c0                   test eax, eax
0043716F  7d0c                   jge 0x43717d
00437171  680005ba00             push 0xba0500                ; Vector2D IID!
00437177  50                     push eax
00437178  e8927d6300             call 0xa6ef0f                ; QI-style error helper
0043717D  8b45fc                 mov eax, dword ptr [ebp - 4] ; return the out dword
00437180  5e                     pop esi
00437181  c9                     leave
00437182  c3                     ret
```
CONFIRMED: a thiscall wrapper returning `[vtable+0x58](this, &out)` — NOT GetTickCount.
**NEW**: its error path references IID 0xBA0500 — the wrapper is typed against the Vector2D
interface family. E8-census: **97 callers** (incl. 0x66A567 the scroll-phase site); full list in
out-g39b/c notes.

Neighborhood (all decoded, key items):
- 0x437183: `ret 4` wrapper for slot **+0x64** with a 16-byte VARIANT stack copy (`call [eax+0x64]`,
  this + VARIANT) — another slot25-family caller.
- 0x4371B1: `ret 4` wrapper for slot **+0x5C** with out-copy (`mov [eax],ecx`). **34 E8 callers**
  (incl. 0x6699D2, 0x66A382, 0x66A6FB, 0x66A764 — the loader's "origin" reads).
- 0x4371E3: destructor walking 13 members at stride 0x14 (this+0x30..this+0x10C) — matches the
  pending-record collection layout.

### 3.2 Shape2D slots +0x58/+0x5C = the animation clock (NEW static closure)

**Slot +0x58 body 0x514076CC (out-pointer getter), `ret 8`:**
```
514076CC  8b442408               mov eax, dword ptr [esp + 8]
514076D0  85c0                   test eax, eax
514076D2  7507                   jne 0x514076db
514076D4  b803400080             mov eax, 0x80004003              ; E_POINTER
514076DB  8b0d341c4151           mov ecx, dword ptr [0x51411c34]  ; GLOBAL TICK
514076E1  8908                   mov dword ptr [eax], ecx          ; *out = tick
5140876E3  33c0                   xor eax, eax
5140876E5  c20800                 ret 8
```
**Slot +0x5C body 0x514076E8 (monotonic setter), `ret 8`:**
```
514076E8  a1341c4151             mov eax, dword ptr [0x51411c34]
514076ED  85c0                   test eax, eax
514076EF  8b4c2408               mov ecx, dword ptr [esp + 8]      ; new tick
514076F3  740d                   je 0x51407702
514076F5  8bd1                   mov edx, ecx
514076F7  2bd0                   sub edx, eax
514076F9  7907                   jns 0x51407702                     ; require new >= old (or old==0)
514076FB  b857000780             mov eax, 0x80070057               ; else E_INVALIDARG
51407702  890d341c4151           mov dword ptr [0x51411c34], ecx   ; THE ONLY WRITE of the tick
51407708  33c0                   xor eax, eax
```
Tick 0x51411C34 .text references (complete census): readers at 0x51406B0C/0x51406B28/0x51406B32
(0x51406ADC-coerce family), 0x51407BF4 (slot +0x78), 0x51407E00/0x51407E0D (slot +0x84),
0x514082D7 (Set interpolation anchor), 0x514083F5 (+0x94 Move variant), 0x51408A64/0x51408AAB
(slot +0xA0); **writer: only 0x51407704 inside slot +0x5C**.

**Consequences (given the §2.2 receiver identity)**: the scroll phase
`sum = slot58(layer) + 20000/|rate|` at 0x66A567 is `sum = globalTick + 20000/|rate|` —
**the "unit runtime-bound" G39 residual is CLOSED STATICALLY: the unit is the Shape2D global tick
[0x51411C34], the same clock the Set interpolation uses** (so the armed V{VT_I4,sum} record lives
on one shared timeline). I independently re-verified the sum chain:
```
0066A564  8b4dec                 mov ecx, dword ptr [ebp - 0x14]   ; the shared Vector2D
0066A567  e8f0cbdcff             call 0x43715c                     ; slot+0x58 -> tick
0066A56C  8bc8                   mov ecx, eax
0066A56E  b8204e0000             mov eax, 0x4e20                   ; 20000
0066A573  99                     cdq
0066A574  f7ff                   idiv edi                          ; edi = |rate|
0066A576  03c8                   add ecx, eax                      ; sum
0066A57A  894de4                 mov dword ptr [ebp - 0x1c], ecx
```
(rate selection esi=[ebp-0x6C] vs [ebp-0x70] at 0x66A529; |rate| via neg; offset-base neg/sbb/and
0x64 tricks at 0x66A535..0x66A546; rate>0 negate at 0x66A57F; rate==0 zero at 0x66A58B — all
re-verified byte-level, matching G36 forensics §8.)

### 3.3 `push 0x78` census — NEGATIVE in the map band

- 5-byte form `68 78 00 00 00`: **0 occurrences** in the entire EXE.
- 2-byte form `6A 78` followed by E8 within 12 bytes: **23 candidate sites image-wide; 0 in the
  0x42xxxx–0x44xxxx band**. Sites (push → E8 target): 0x4CBDF1→0x621B65; 0x50FE68/0x50FFBD/
  0x510148→0x4031B5 (V{VT_I4,0x78} builders); 0x52D0E1, 0x53F9A9, 0x53FA50, 0x53FC70, 0x53FDB2,
  0x53FEE9, 0xA48273→0x6F5E40; 0x618E27→0x402E97; 0x67C56F→0xA70120; 0x71ADCD→0x403AC7;
  0x7ED778→0x414A49; 0x876B63→0x402D66; 0x8FE16A→0x8EE9BC; 0x9495BC→0xA6FC7C; 0x9BD062→0x40634C;
  0xA31C46→0x7A48D0. (0x847870→0x56847882, 0xA2A3B6→0x4B8AF415, 0xA2A4AE→0x538AF50D are
  mid-instruction byte coincidences — targets outside the image.)
**There is no `push 0x78`+property-getter pattern in the 0x42–0x44 object-wrapper band.**

### 3.4 The animation-registration helper 0x436DB3 (contains the 0x437100–0x437159 region)

SEH fn (`mov eax,0xA894D0; call 0xA6FC7C`), `ret 0x14` (this + 4 stack args), **6 E8 callers**
(0x93BEB4, 0x95968C, 0x959713, 0x95E9ED, 0x98E259, 0x98E2A0 — overlapping the focus-writer caller
families). Key byte-verified facts:
- Head resolves namespace **id 0x31B** (not 0x31D) via 0x7A48D0/0x406368/**0x403819** create.
- Calls slot **+0x2C**(obj, 0x320, 0x258) — (800, 600)! — and slots +0x70/+0x78(obj, 0) and
  +0x8C(obj, 0, 0, 0xFF000000) on that object.
- 0x436FA2: `0x427EB3(ecx=[0xBE2788], out=[ebp-0x14], -400, -300, 0, 0, [ebp+0x14], V, V)`
  — pushes `0xfffffe70` (−400) and `0xfffffed4` (−300) — **the camera-centering constants again**,
  as resolve coordinates.
- 0x436FEC: `call [ecx+0xE0](obj, 0xFFFFFF)` on the resolved object.
- **TWO clock sources in one function**:
  (a) `0x42944A(&[ebp-0x14], 3)` → `0x43715C()` (slot+0x58 = global tick) `+ [ebp+8]` →
      `0x425E28` VARIANT build (0x437074–0x437090);
  (b) `call 0x994C7A` (= `mov eax,[0xBDD89C]; mov eax,[eax+0x18]; ret` — a SECOND cached clock)
      `+ [ebp+8] + [ebp+0xC]` stored into the registered node: `[esi+4] = clock2+arg1+arg2`,
      `[esi] = 0`, `[esi+8] = arg3` (0x437106–0x437138; node via 0x44752D at [this+0x148],
      attached through 0x429919([esi+0xC])).
- 0x994C7A has **420 E8 callers** image-wide — it is the app's dominant frame-clock read.
  [0xBDD89C] is the same global whose +4 was the keyboard-focus hwnd in C-107's gates; +0x18 is
  its time field.
- The +0x110 registration slot itself (0x66A136) re-verified: `call [eax+0x110](resource, 0x20,
  V{VT_ERROR}, V{VT_ERROR})` (IID 0xBA0510 on the error path — a second resource-interface IID),
  followed by `call [eax+0xD8](obj, flag)` at 0x66A1BB with flag=([ebp-0x20]!=0).

### 3.5 Gr2D_DX8.dll raw windows (for later cross-version comparison; recorded verbatim in out-g39.txt)

- **0x5040A900–0x5040A9A0**: getter/setter pair for field +0x48 at 0x5040A913/0x5040A930
  (`mov eax,[ecx+0x48]; *out=eax; ret 8` / `mov [eax+0x48],ecx; ret 8`), and the index dispatcher
  0x5040A940 (arg 0 → special "2"; arg 1 → member-list lookup at [esi+0xA4] via 0x5040C51E;
  0 ≤ arg < [esi+0xC4] → array [esi+0xBC] via 0x5040C81A) feeding the 0x5040AB01 resolver.
- **0x5040AB00–0x5040AC00** (fn 0x5040AB01, `ret 0x18`): ctor on [arg1+0x9C] (0x5040188A), calls
  the 0x5040A940 dispatcher, {-1,1,2} switch, double-deref `[eax+4]->[eax]` array-of-pairs chains
  over fields +0xC4/+0xC8/+0xCC, refcount dec at +0x9C — an indexed item resolver.
- **0x5040B900–0x5040BA80**: window contains a **percent-scaling +0x90 call**:
  ```
  5040B952  8b45d8                 mov eax, dword ptr [ebp - 0x28]
  5040B955  0faf4508               imul eax, dword ptr [ebp + 8]     ; * arg1
  5040B959  6a64/59/99/f7f9        cdq; idiv 100                     ; / 100
  ... same for [ebp-0x2C] ...                                       ; second axis
  5040B98E  ff9290000000           call dword ptr [edx + 0x90]       ; Set-family call (obj=[ebx+0x40])
  ```
  i.e. `Set(obj, x·arg/100, y·arg/100, V, V)` with VARIANT args — a rate/delay-accumulation-shaped
  candidate in Gr2D. The next function (0x5040B9DE) opens with `push 0x3E8` (1000) into
  `0x504027BB(&[ebp-0x1C], &[ebp+0x10], 0x3E8)` — another 1000 constant, VARIANT-coercion shaped.
  Error string IID 0x50436390 on the +0x90 call's failure path.
- The 0x5042D1E0 intmap family adjoins the 40-slot vtable 0x5042D140 (slot25 +0x64 = 0x50403FBE,
  confirmed present); not re-derived further this round.

### 3.6 G39 independent verdicts

- 0x43715C = slot+0x58 wrapper: CONFIRMED (and now UNIT-RESOLVED: = Shape2D global tick, §3.2).
- `push 0x78` map-band hypothesis: NEGATIVE (no sites).
- Two-clock architecture discovered: Shape2D tick [0x51411C34] (written only by slot+0x5C,
  monotonic-guarded) vs EXE [[0xBDD89C]+0x18] (0x994C7A, 420 callers). Their relationship
  (who copies whom) is NOT established statically this round.
- The registration helper 0x436DB3 (6 callers) writes nodes `{0, clock2+a1+a2, a3}` at [this+0x148]
  — a concrete frame-delay accumulation record shape for G39.

---

## 4. G10 — focus writer, cursor mover, funnel, Set family

### 4.1 0x93CB27 focus writer (full body re-derived; Set at 0x93CC9B)

Prologue/gates (bytes exact):
```
0093CB27  b8a49eae00 / e84b311300    SEH prolog (mov eax,0xAE9EA4; call 0xA6FC7C)
0093CB37  8b7d08                 mov edi, [ebp+8]         ; arg1 = script record
0093CB3A  85ff                   test edi, edi ; je exit  ; gate 1: record present
0093CB47  83beb803000000         cmp [esi+0x3b8], 0 ; jne exit   ; gate 2 (esi=this)
0093CB54..0093CB79               ; 0x412258 record->payload; count = ([eax-4])>>1 ; gate 3: != 0
0093CB85  8b07                   mov eax, [edi]           ; tag = [record]
0093CB87  3d6a5c4f00             cmp eax, 0x4f5c6a ; je KNOWN
0093CB92  3d1e51d700             cmp eax, 0xd7511e ; je KNOWN
0093CB99..                       ; UNKNOWN: 0x4B1C27(this,&[ebp+0x10]) fill; 0x420AA1 assign
                                 ; [ebp+8]; jmp 0x93CCF4 (SKIPS the Set)
0093CBBE  681d030000             push 0x31d               ; KNOWN path:
0093CBC4  e8077de6ff             call 0x7a48d0            ;   resolve shared Vector2D
0093CBCB  e87c97acff             call 0x40634c
0093CBD2  6a00                   push 0
0093CBD7  51                     push &[ebp+8]... wait — push ecx(=&[ebp+8])
0093CBDD  e8afacb0ff             call 0x447891            ;   attach -> [ebp+8] reused as object
```
(n.b. 0x93CBD4 `lea ecx,[ebp+8]` is the out-slot; the earlier [ebp+8] record is released by
0x447891's own prologue — slot reuse, consistent with the repo reading.)

The Set call:
```
0093CC15  8b4d10                 mov ecx, dword ptr [ebp + 0x10]   ; arg3
0093CC18  8d45e4                 lea eax, [ebp - 0x1c]
0093CC1B  50                     push eax
0093CC20  e852010000             call 0x93cd77                     ; out = [[arg3]+0x14] (AddRef)
0093CC3B  8b4d10 / 0x93cd77      ; second identical fetch -> [ebp-0x18]
0093CC5A  837d0800               cmp [ebp+8], 0 ; jne ok           ; object present gate
0093CC6B  8bce / e8...404b2e     ; GetY(src) -> [ebp+0x10]
0093CC77  e88b7eacff             call 0x404b07                    ; GetX(src) -> eax
0093CC7C..0093CC9A              ; two 16-byte default VARIANT copies (0xBE7330 templates)
0093CC8F  ff7510                 push dword ptr [ebp + 0x10]       ; y
0093CC98  50                     push eax                          ; x
0093CC99  53                     push ebx                          ; this = shared Vector2D
0093CC9B  ff9190000000           call dword ptr [ecx + 0x90]       <== Set(shared, X(src), Y(src), V, V)
0093CCA5  680005ba00 ...         ; error path IID 0xBA0500
```
The src getter 0x93CD77 (`ret 4`): `mov eax,[ecx+0x14]; *out=eax; if eax: AddRef([vt+4])` —
**the Set source is `[[arg3]+0x14]`, a private object with X/Y read via Vector2D-style getters
(0x404B07/0x404B2E → [vt+0x20]/[vt+0x28])**.
The fill helper 0x4B1C27 (`ret 4`): `mov eax,[ecx+0xF28]; *out=eax; AddRef` — binds **[this+0xF28]**
(the avatar container) — but only on the UNKNOWN-tag path, which SKIPS the Set.

**Caller census — 10 E8 callers (matches EV-94's count), but the idiom is NOT 1-arg-uniform:**
0x769B51 is `ret 4` (exactly ONE stack arg — verified), so the N/0 slots pre-pushed below some
0x769B51 calls flow to 0x93CB27. Effective 0x93CB27 args at every site: `(record, N, arg3)`:

| caller | N (arg2) | arg3 | notes |
|---|---|---|---|
| 0x5C0342 | 0x320 (800) | esi | caller's object (id read from [esi+0x44]); this=[esi+0x10] |
| 0x93E00B | 0x3E8 (1000) | 0 | ebx=0 (xor ebx,ebx at 0x93DFF8) |
| 0x959493 | 0x320 (800) | [ebp+0x20] | this=[ebp−0x170C] |
| 0x959527 | 0x320 (800) | 0 | |
| 0x964E16 | 0x3E8 (1000) | 0 | pre-pushes below the 0x769B51 call |
| 0x9651CC | 0x3E8 (1000) | 0 | id 0x40413D |
| 0x965567 | 0x3E8 (1000) | 0 (ebx) | |
| 0x98DC43 | 0x1F4 (500) | 0 | id 0x406849 |
| 0x990E21 | 0x3E8 (1000) | esi | id from `call [vt+0x40]` |
| 0x990E91 | 0x3E8 (1000) | esi | |

**Consequence (material nuance for C-109)**: the Set source is `[[arg3]+0x14]`. 6 of 10 callers
pass arg3 = 0 (known-tag records through those sites would fault at `[[0]+0x14]`; so those sites
must in practice deliver unknown-tag records → fill-and-skip, or the semantics differ); 3–4 pass an
object pointer. The blanket "src = [[this+0xF28]+0x14]" is byte-proven ONLY for the fill-and-skip
path (which does not Set); for the Set path it holds iff a caller's arg3 == [this+0xF28] —
plausible (the 0x5C0342/0x990E21/0x990E91 object pushes) but NOT yet byte-proven by any decoded
caller window this round.

### 4.2 0x5CB573 cursor mover — head + the write stores (all byte-verified)

Head (raw `55 8b ec 83 ec 34 …`): `edi=[esi+0xC]` (device) … memset 0x14-byte state at [ebp−0x34]
(0xA70120) … `call [vt+0x24](device, &state, 0x14)` … arrow-key reads via 0x5CAAA9 …
input-vector assembly … then:
```
005CB643  8b8670090000           mov eax, dword ptr [esi + 0x970]   ; speed
005CB649  83c005                 add eax, 5                         ; + 5
005CB64F  0faf45cc               imul eax, dword ptr [ebp - 0x34]   ; * x-axis
005CB654  6a0a/59/99/f7f9        cdq; idiv 10                       ; / 10
005CB659  038638090000           add eax, dword ptr [esi + 0x938]   ; + cursor x
... same for y with [ebp-0x30], +0x93C ...
005CB67E..005CB6A3              ; clamp x to [0, 0x320=800], y to [0, 0x258=600]
005CB703  399638090000           cmp dword ptr [esi + 0x938], edx   ; equality-change gate
005CB70B  398e3c090000           cmp dword ptr [esi + 0x93c], ecx
005CB713  898e3c090000           mov dword ptr [esi + 0x93c], ecx   <== y store
005CB719  8d8ebc090000           lea ecx, [esi + 0x9bc]             ; notify queue
005CB71F  899638090000           mov dword ptr [esi + 0x938], edx   <== x store
005CB725  e8e00b0000             call 0x5cc30a                      ; alloc notify record
005CB73D  894808                 mov [eax+8], ecx                   ; packed y<<16|x
005CB742  c70000020000           mov dword ptr [eax], 0x200         ; cmd 0x200
005CB74B  e8caf1ffff             call 0x5ca91a                      ; CAMERA FUNNEL
```
(The no-device path calls [0xBE1754]/[0xBE1750] with a [vt+0x20] read — cursor import family.)

### 4.3 0x5CA91A funnel — body verified, formula exact

```
005CA929  8b3564e2af00           mov esi, dword ptr [0xafe264]      ; VariantInit-style fn
005CA92F..005CA972              ; build 2 default VARIANTs from 0xBE7330 templates
005CA973  83bbb009000000         cmp dword ptr [ebx + 0x9b0], 0     ; this+0x9B0 member present?
005CA97A  8db3b0090000           lea esi, [ebx + 0x9b0]
005CA990  8b1e                   mov ebx, dword ptr [esi]           ; the shared Vector2D
005CA992..005CA9C0              ; two 16-byte VARIANT copies
005CA9AC  81c1d4feffff           add ecx, 0xfffffed4                ; y − 300
005CA9B8  81c170feffff           add ecx, 0xfffffe70                ; x − 400
005CA9C1  ff9090000000           call dword ptr [eax + 0x90]        <== Set(shared, x−400, y−300, V, V)
005CA9CB  680005ba00 ...         ; error path IID 0xBA0500
```
`camera := point − (400,300)` — CONFIRMED byte-exact (also independently at 0x9EC61A-family
constant reuse in 0x436F97/0x436F9C and 0x5CA9AC/0x5CA9B8).

### 4.4 Shape2D Set family at 0x5140818E–0x51408340

Region contents (clean decode; 0x5140818E itself is mid-instruction — the nearest clean starts):
- 0x5140819A–0x514081A6: vtable-store pair `mov [edx],0x5140D918; mov [ecx],0x5140D90C; ret`.
- 0x514081A7 / 0x514081C8: two destructors (vtable re-stamp 0x5140D90C / 0x5140D918; conditional
  removal from globals 0x51411B00 / 0x51411C78 via 0x5140256C / 0x51402860) — the pending-record
  object's lifetime plumbing.
- **0x514081F0 = the V3 time extractor** (§2.4's arming gate, byte-identical to EV-95 §3):
  VT_EMPTY/VT_ERROR → S_OK with NO write (fast path 0x51408280); VT_I4 → `[out] = V.val`;
  else VariantChangeType-coerce to VT_I4 (0x51405842 with push 3, push 0).
- **0x5140828F = Set, `ret 0x2C`** — immediate vs interpolated split CONFIRMED:
```
51408296  66397514               cmp word ptr [ebp + 0x14], si      ; V3.vt == VT_EMPTY?
5140829D  66837d140a             cmp word ptr [ebp + 0x14], 0xa     ; VT_ERROR?
        -> je 0x5140830e  IMMEDIATE path:
5140830E  8b4508                 mov eax, [ebp + 8]                 ; this
51408311  8b4824                 mov ecx, [eax + 0x24]
51408314  3bce                   cmp ecx, esi
51408316  750e                   jne 0x51408326
51408318  8b4d0c                 mov ecx, [ebp + 0xc]               ; x
5140831B  89481c                 mov dword ptr [eax + 0x1c], ecx    <== [this+0x1C] = x
5140831E  8b4d10                 mov ecx, [ebp + 0x10]              ; y
51408321  894820                 mov dword ptr [eax + 0x20], ecx    <== [this+0x20] = y
51408326..5140832E              ; else 0x51407A34(this,&x,&y) notified store
        else INTERPOLATED path (514082A4..):
514082B1  e819f0ffff             call 0x514072cf                    ; current-pos wrapper
514082CC  e80be8ffff             call 0x51406adc                    ; VARIANT coerce — NOTE:
        ; [ebp+8] and [ebp-4] are OUT-SLOTS of this coerce (slot reuse): afterwards they hold
        ; current-x / current-y, so the deltas below are target−current:
514082DB  8b4510/2b4508          mov eax,[ebp+0x10]; sub eax,[ebp+8]     ; dy
514082E2  8b450c/2b45fc          mov eax,[ebp+0xc];  sub eax,[ebp-4]     ; dx
514082D5  ff35341c4151           push dword ptr [0x51411c34]             ; global tick
514082F1  e8ebfcffff             call 0x51407fe1                         ; build record
51408307  e82f000000             call 0x5140833b                         ; commit to [this+0x30]
51408338  c22c00                 ret 0x2c
```
EV-95/C-108 confirmed instruction-level, with the slot-reuse subtlety in the delta computation now
explicitly explained (the repo's body quote matches the bytes; the coerce-outs overwriting [ebp+8]
is why `sub eax,[ebp+8]` is dy and not obj-ptr arithmetic).

---

## 5. Corrections / nuances vs the repo ledger (blind-phase findings)

1. **EV-20 "exactly 1 imul-1000 site"** — contradicted by whole-EXE census: 61 anchored real
   `imul ×1000` sites (§1.2). C-024's address 0x423E6B context (§1.1) does not support a
   background-key identification; the real key construction is at 0x669923/0x669930 with
   constants 0x3FFBDCA0/0x4001F400 and a 0x54B-property selector (§1.3).
2. **"PolyShape" (T088 §5.1)** — actual UTF-16 name at 0x51410120 is **"PolyShape2"**.
3. **G39 "unit runtime-bound" for slot58** — CLOSED STATICALLY here: slot +0x58 of the shared
   Vector2D returns the Shape2D global tick [0x51411C34] (§3.2); the scroll phase lives on the same
   timeline as the Set interpolation.
4. **EV-94 caller idiom** — 0x769B51 takes exactly one stack arg (`ret 4`); all 10 callers of
   0x93CB27 effectively pass `(record, N∈{500,800,1000}, arg3)` with arg3 = 0 in 6 cases and an
   object in the rest (§4.1 table). The "uniform" reading under-specifies arg3, and the
   `src=[[this+0xF28]+0x14]` attribution is only byte-proven for the fill-and-skip path.
5. **G36 scroll-branch "runtime-bound COM targets"** — the receiver is statically identified as
   the shared CWzVector2D; the +0x98 attach body + parallax applier formula are now static facts
   (§2.4). (The per-tile objects from 0x427EB3 remain runtime-bound; and [0xBE2788] is provably
   NOT a CWzVector2D — its +0x5C is used as a getter through 0x4371B1, while Vector2D's +0x5C is
   the monotonic tick SETTER, so a Vector2D there would be a type error.)
6. **Two-clock architecture** (§3.4): Shape2D tick [0x51411C34] (sole writer: slot +0x5C body,
   monotonic guard) vs EXE [[0xBDD89C]+0x18] (0x994C7A, 420 callers). Registration helper 0x436DB3
   consumes BOTH. Relationship between the two clocks: unknown (static open).

## 6. CMS079-only provable facts (summary)

**G35**: `imul r,rm,1000` occurs at 61 real code sites; the loader key is
`index*1000 − {0x3FFBDCA0 | 0x4001F400}` (selector = boolean of WZ property 0x54B), feeding
0x671B59 on [this+0xD0]; 0x423E6B itself scales [[0xBD900C]+0x208] by 1000 for a [0xBE16D8] call
with arg 0xAA; 0x1F400 never occurs as a real constant; 0x42640 never occurs; 0xC0000000 occurs
in 9 code instructions (slot+0xB4 args, a 0x427EB3 arg, device-call args, a 3-way selector, an
HRESULT-style compare) — none in the map-loader region.

**G36**: the four scroll-branch call shapes are byte-exact as claimed; the receiver is the shared
0x31D CWzVector2D (vtable 0x5140C2F0 — all 49 entries verified); Set +0x90 = 0x5140828F ret 0x2C;
attach +0x98 = 0x5140847D ret 0x18 building `{obj,X0,Y0,Dx,Dy,Wx,Wy}` committed through the SAME
0x5140833B pending-list commit as Set-interpolation, with applier formula
`out += (pos−origin)·W/D` per axis — horizontal scroll: `Δy = (Y−Y0)(ry+100)/100`, vertical:
`Δx = (X−X0)(rx+100)/100`; +0x64 0x5140778C ret 0x14 = VARIANT-gated property accessor-mutator;
+0x9C 0x514086B3 ret 0x34 = clamped-int member attach; IID/RTTI/name identities all verified.

**G39**: 0x43715C = `call [vt+0x58](this,&out)` (97 callers), 0x4371B1 = `+0x5C` out-wrapper
(34 callers); Vector2D slot+0x58 = GetGlobalTick([0x51411C34]), slot+0x5C = monotonic
SetGlobalTick (the tick's ONLY writer); scroll phase = tick + 20000/|rate| (idiv chain re-verified);
`push 0x78`+getter pattern: 0 sites in the 0x42–0x44 band (0 five-byte; 23 two-byte image-wide);
Gr2D windows recorded incl. the ×arg/100 +0x90 percent-scaling site and the 0x3E8 coercion;
registration helper 0x436DB3 (6 callers) writes {0, [[0xBDD89C]+0x18]+a1+a2, a3} nodes at
[this+0x148] and also arms a tick+delay VARIANT via 0x43715C.

**G10**: 0x93CB27 gates (record present, [this+0x3B8]==0, payload count≠0, tag∈{0x4F5C6A,
0xD7511E}) all byte-verified; known-tag path: Set(shared, GetX(src), GetY(src), V, V) at 0x93CC9B
with src = [[arg3]+0x14] via getter 0x93CD77; unknown-tag path: fill from [this+0xF28] (0x4B1C27
verified) and SKIP; caller census = 10 × (record, N, arg3) with N∈{500,800,1000} (table §4.1);
0x5CB573 = input-axis mover: speed [this+0x970]+5, ×axis, /10, +cursor, clamp [0,800]×[0,600],
equality-gated stores 0x5CB713/0x5CB71F, notify cmd 0x200, then funnel 0x5CA91A =
Set(shared, x−400, y−300, V, V) at 0x5CA9C1; Shape2D Set immediate-vs-pending split confirmed with
the coerce slot-reuse explained; delta record anchored at the global tick.

## 7. What CMS079 alone CANNOT prove (needs runtime or cross-version help)

- **G35**: whether the two key spaces map to draw-order/bg-vs-Obj separation (no sort-consumer
  decoded); the semantics of property 0x54B's name (string pool runtime-built); what [[0xBD900C]+0x208]
  and fn-ptr [0xBE16D8] actually are (import-table resolution incomplete here).
- **G36**: identity/class of the PER-TILE objects from 0x427EB3 (their +0x90/+0x9C/+0x64/+0xFC/+0xE0
  bodies); the identity of [0xBE2788]'s class (its +0x5C getter body, +0x64 slot25 binding);
  string names 0x155D/0x1550/0x1551; who CALLS the parallax applier 0x514085B3 and at what cadence
  (pending-list walk not decoded); whether the attach record and the interp records interleave.
- **G39**: the relationship between the two clocks ([0x51411C34] vs [[0xBDD89C]+0x18]) and their
  wall-time rate; portal frame timing (untouched); whether the 0x436DB3 node fields {0, t+a1+a2, a3}
  drive per-frame delays (consumer not decoded); the Gr2D windows' true roles (recorded raw for
  cross-version comparison, not identified).
- **G10**: the semantics of [[arg3]+0x14] (the focus target's writer census — is it avatar-centred?);
  whether any caller's arg3 actually equals [this+0xF28]; the frame phase in which mouse-band
  writers fire relative to draw; whether any of the 25 INCONCLUSIVE direct-slot sites is a camera
  writer; the containing functions' bodies for the arg3-object callers (0x5C0342/0x990E21/0x990E91).

— End of blind notes. Phase 2 not started in this session.


---

# T089 — INDEPENDENT REVIEWER PHASE 2 REPORT (Adversarial Cross-Version Review)

**Reviewer**: T089 "Independent OpenMS Cross-Version Static Evidence Reviewer" — Phase 2.
**Date**: 2026-11-16. **Mode**: READ-ONLY on the repo; all outputs/scripts in
`C:\Users\lithd\AppData\Local\Temp\opencode\t089-reviewer\` (this file, `t089p2_*.py`, `out-p2-*.txt`).
**Repo state**: HEAD `42e2d7fb8b7eb49f4cd3f61b48fc56cc391168ba` (unchanged; the lead's T089 work is
uncommitted — 72 modified/added paths, all under `research/`). No repo file was modified by me.

**Documents reviewed** (in tasked order): T089-OPENMS-CMS079-MATCH-MATRIX.csv (26 rows),
T089-GAP-CLOSURE-AUDIT.csv, T089-G35-BACKGROUND-KEY.md, T089-SHAPE2D-GR2D-ENGINE.md,
T089-NAMESPACE-ID-NAMES.txt / T089-NAMESPACE-BULK.txt, claims C-110..C-115 + C-024 edit +
C-097 (context), EV-98..EV-103 + EV-20 annotation, gaps G35/G36/G37/G39/G10,
P0-P4 matrix P0-05/06/07/10, T089-OPENMS-STATIC-GAP-CLOSURE-REPORT.md, test_t089_round.py,
T0881-PHASE3B-REMOTE-ARCHIVE.md, T088-CAMERA-CADENCE-WRITER-CLOSURE-REPORT.md (WP0-B cell).

**Method**: every challenged fact re-derived from the pinned binaries with my own scripts
(capstone 5.0.7; PE section mapping self-derived; namespace cipher independently re-implemented
from the C-103 algorithm description and validated against 30+ records + 2 control ids).
Binary hashes re-verified this session: EXE/Shape2D/Gr2D/PCOM/server079.jar all match the
canonical values.

---

## Summary of independent verification (POSITIVE results first)

| Claim | My independent check | Result |
|---|---|---|
| G35 key bytes 0x66991C–0x66993B (both constants, je polarity) | anchored sweeps; `2d a0 dc fb 3f` (0x3FFBDCA0) follows the 0x669923 imul (front, fall-through flag≠0); `2d 00 f4 01 40` (0x4001F400) at 0x669930 (back, je flag==0) | CONFIRMED (matches forensics doc, C-110 reasoning, EV-98, test — NOT the matrix, see D3) |
| G35 index = Back enumeration order | loop 0x6692B9–0x66936E decoded: `xor edi,edi` … `push edi; mov ecx,ebx; call 0x669397` (0x669351/0x669354) … `inc edi; cmp; jl` | CONFIRMED |
| G35 consumption sites | 0x669BD6 `push [ebp-0x34]` (KEY) into 0x427EB3 slot25 call on [0xBE2788], result → 0x429919; 0x669FE6 `push [ebp-0x34]` into the 0x43286E→0x44484B→0x429411→**0x43E3A6** chain (add esp 0x28), result → 0x429919 | CONFIRMED |
| G35 FSDB | recounted myself: 13 files, **387 records, 26 front=1**, per-map 1..47 | CONFIRMED exactly |
| front constant vs GMS083 | CMS079 front = B+271200 (0x3FFBDCA0 signed −1073470624 = −0x40000000+271200); GMS083 B+272000 refuted-for-CMS079 | CONFIRMED (delta 800) |
| Namespace decryptions | own cipher implementation (byte-rotate r=type÷8 + 128-bit **big-endian** bit-rotate type%8, XOR): `front`, `bS`, `Map/Back/`, `rx/ry/cx/cy/ani/a`, `back/%d`, `back%d`, `ani/%d`, `type`, `delay`, `a0`, `a1`, `repeat`, `repeatStartIndex`, `pv`, `Map/MapHelper.img`, `game`, `portalStart/Continue/Exit`, `Map/MapHelper.img/portal/game/pg`, `once`, `blend`, `x/y`, `Shape2D#Vector2D` (control), `Gr2D_DX8` (control) — all reproduce; `0x15F8` has no record (table→garbage) ✓; `0x1122/0x1123` are GBK strings ✓ | CONFIRMED (with D5 quirk note) |
| Shape2D second table 0x5140C0FC | dumped slots: +0x58/+0x5C/+0x64/+0x90/+0x94/+0x98/+0x9C/+0xA4/+0xA8 identical to 0x5140C2F0 (only +0x00/+0x04 QI/lifetime differ) | CONFIRMED table-invariant engine layout |
| Gr2D frame writer 0x5040ABE6 | VT_I4 checks (`cmp word [ebp+0x10],3`), −1 defaults (`or eax,-1`), stores delay→**[edx+0x0C]** (0x5040ACE3 `89 42 0c`), a0→+0x10, a1→+0x14, z-pair→+0x18/+0x1C; `inc [esi+0xD0]` at 0x5040AC96 | CONFIRMED (field offsets correct; one address typo in G35 doc, D4) |
| Gr2D accumulator | `mov eax,[esi+0xC]` (delay) × [ebp−0x1C] (scale) `div 0x3E8` **unsigned** → `add [ebp+8],eax` (end-ts) at 0x5040BCC7–DD; signed total period at 0x5040BC59–65; mode gates `test [ebp+0xC],0x20` (0x5040BC02) / `0x10` (0x5040BD39); mode selector 0x50403ECA ([this+0x2C]: 0x17→0x10, 0x16→0x20) | CONFIRMED |
| Delay pairing | 36 `push 0x155D` sites code-band; **18 paired with `push 0x78`** incl. 0x43EC79/0x43EC81 and 0x66ABCD | COUNTS CONFIRMED — but see D2 (universality refuted) |
| repeat triage | 0x66F937 `cmp eax,-1` → jne 0x66F9C4 `cmp eax,-2`; pushes 0x20 (0x66F8F9), 0 (0x66F986), 0x10 (0x66FA44); `call [eax+0x110]` same slot as loader ani-branch; `push 0x8D4` at 0x66891C (inside 0x66885B) | CONFIRMED |
| Portal family | `push 0xF7D/0xF7E/0xF7F` at 0x71BAE3/0x71BDA9/0x71B81C; FSDB HelperFrame counts pv=8, Start=4, Continue=7, Exit=3 (use=game, name pv/ph) | CONFIRMED |
| Camera filter (Shape2D) | [0x5140D978]=**28.0** deadband; [0x5140D8D0]=0.499999999 / [0x5140D8D8]=0.5 clamps; +0xA4 query 0x51408BED & +0xA8 commit 0x51408C9A with `push 0x1E0000`; commit-method 0x51408D23 snap path (fild→double history +0x10/+0x18, time +0x20, armed +0xC); residual 0x51408E33 = `|D|≤28.0 → |D|` else `max(0, coef·1000·|D|/(elapsed·|D|+coef·1000))` (`imul eax,eax,0x3E8`); template vtable dword @0x5140D970 = 0x51408D23 ✓ | CONFIRMED |
| +0xA8 census | my census over **all 8** modrm forms (0x90–0x97): exactly **3** sites {0x43787D, 0x942DF7, 0x94A796}; only 0x43787D pushes an immediate (0x64=100); the other two push variables | CONFIRMED (and the test's 6-of-8 census happens to be safe, D7) |
| 0x437717 body | full decode: resolve 0x31D→**0x447891** (the C-106 singleton chain) into [ebp−0x10]; +0x64 property-put attaching arg1 (F28 container wrapped via 0x411FE1); `push -0x32; push 0; push ebx; call [eax+0x90]` = **Set(shared, 0, −50)** at 0x43781F; `push 0x64; call [eax+0xA8]` filter commit(100) at 0x43787D; then 0x4376F2/origin chains via 0x4371B1 on [0xBE2788] and 0x444907(ecx=0xBE2788); ret 4 | CONFIRMED with adjudication (D1/D9) |
| 0x5CA91A funnel / 0x5CB573 / Set family | re-verified in Phase 1; unchanged | CONFIRMED |
| Tests | `python -m unittest discover -s research/tests -q` → **174/174 OK** (my run) | CONFIRMED |
| WP0-A git facts | `git log` HEAD=42e2d7fb, parent=60f1ee92, tree=563f171b, 26 files — all re-verified directly | CONFIRMED |
| WP0-B edit | T088 report now reads “独立注册函数 0x9E6BAD … 0x9E649A … 由回调 0x9E6E10 调用 … t089 WP0-B 勘误” — matches C-107/EV-94 | CONFIRMED |
| PCOM hash | file = repo-canonical `cf3807f3107152d3b305bfc84be36d58b62306c94f60133c8e80fd17f9d9e54b`; task book wrote `…b623061c94…` (extra `1`) — typo | CONFIRMED (D13) |

---

## FINDINGS

### D1 — BLOCKING (claim-text corrections) — C-114/C-115/EV-102 misdescribe the 0x437717 caller chain and object identity

Byte facts (my decode):
1. **0x43291A is `mov eax,[0xBDD460]; ret`** — a global getter, NOT an object creation.
   C-114's "caller 0x950993 (in 0x94F715) **renews [user+0xF28] (release old, 0x43291A new)** then
   calls 0x437717 **on it**" is wrong on both counts: 0x43291A does not create anything, and
   0x437717 is invoked with **ecx = [0xBDD460]** (a global manager object), with the *existing*
   F28 object passed as arg1 (0x950978–0x95097E: `push ecx; mov [ecx],eax` where
   `eax=[ebx+0xF28]`, then AddRef). No write-back to `[user+0xF28]` exists in the cited window
   (0x950940–0x9509A0). The same shape holds at the other two callers (0x66F143, 0x670C60:
   0x4B1C27 F28-getter → 0x43291A → `ecx=[0xBDD460]` → call 0x437717).
2. **"create vector" is the shared singleton**: the resolve chain at 0x437732–0x437754 is
   `push 0x31D → 0x7A48D0 → 0x40634C → 0x447891` — the C-106 per-class-singleton chain. The
   vector that receives `Set(0,−50)` and `filter(100)` is **the ONE shared CWzVector2D** (the
   camera-class object per C-103's consume-side identity), not a fresh per-call target vector.
   This actually *strengthens* the "camera filter armed" reading (see D9) but the claim text
   "create vector … target-vector helper" must be reworded to the singleton fact.
3. **Containing-function attributions wrong**: EV-102/C-114 cite "0x942DF7 (0x9426B0)" and
   "0x94A796 (0x949DA3)". The SEH functions actually containing the sites start at **0x942AC5**
   and **0x94A2AE** respectively (0x9426B0 is a genuine plain prologue but its function cannot
   contain 0x942DF7 because 0x942AC5's SEH prologue lies between; likewise 0x949DA3 < 0x94A2AE).
The G10 substance (filter armed, coef 100, (0,−50), F28-linked, on the shared vector) survives;
these are wrong *facts inside a CLOSED-STATIC grade-A claim*, so they must be fixed before
acceptance. No re-derivation needed — corrections are wording/address level.

### D2 — BLOCKING (claim-text correction) — "UNIVERSAL DEFAULT 120" for delay is refuted by bytes

36 `push 0x155D` sites exist; 18 pair with `push 0x78` (=120). Of the 18 unpaired sites I
decoded the default pushes: **150 (`push 0x96`)** at 0x406ED1/0x4071D8, **60 (`push 0x3C`)** at
0x408113/0x409077, **180 (`push 0xB4`)** at 0x40EE40/0x40F58A/0x410827, **1000 (`push 0x3E8`)**
at 0x5FA87A/0x9420CB, and several register/variable defaults. C-112's "with UNIVERSAL DEFAULT
120", the engine doc §2 "the 120 default is universal in this build", and the G39 gap row
"delay id 0x155D default 120 universal (18 sites)" are **overstated**. C-112's own falsification
field ("or an additional delay default value") is literally triggered. The correct statement:
"default 120 at 18 sites including the frame converter (0x43EC69) and the tiler per-child read
(0x66ABCD); other reader families carry their own defaults (60/150/180/1000/variable)". The
G39 timing core (id, unit=/1000 scale, accumulation, modes) is unaffected, and the
portal-duration arithmetic remains valid **as a default-based estimate** (and note the portal
family's own delay read at 0x71A72A is *not* among the 18 verified-120 sites — the estimate's
boundary should be stated).

### D3 — NON-BLOCKING (matrix fix) — MATCH-MATRIX rows 2/3 have the branch↔address association swapped

Row 2 (GMS083 back) cites CMS079 `0x669923-0x669929` quoting "sub eax,0x4001F400"; the bytes at
0x669923–0x66992E are `imul; sub 0x3FFBDCA0` — the **FRONT** code. Row 3 (front) cites
`0x669930-0x669936` quoting "sub 0x3FFBDCA0"; the actual sub there is **0x4001F400** — the
**BACK** code. The forensics doc §1, C-110's reasoning field, EV-98 and the test all carry the
**correct** polarity (`je` front==0 → 0x4001F400 back path), so the closure is not corrupted —
but the deliverable matrix must swap the two `cms079_address` values (and the quoted subs) to
match the bytes. This was exactly the (d)-class hazard; it is contained to the matrix.

### D4 — NON-BLOCKING (address typo + correlative wording) — G35 doc §3

`inc [esi+0xD0]` is at Gr2D **0x5040AC96** (disp32 form `FF 86 D0 00 00 00`; the only .text
occurrence), not "0x5040AB96". Moreover that serial-increment lives in the **frame-record
writer**, not in the slot25 insertion path; using it as "cf." evidence for the key's insertion
ordering is correlative. The defensible ordering linkage is the repo's own C-097 (Gr2D slot45
keyed ordered-tree insert + comparator, CLOSED-STATIC A) — but note the bridge "0x427EB3 slot25
output → C-097 tree" is not byte-traced in T089, and [0xBE2788]'s slot25 body remains
runtime-bound (G24/G27). G35's CLOSED-STATIC remains acceptable on: formula + branch + index +
**delivery** into both registration chains (byte-proven) + FSDB envelope + the established
C-097 ordering receiver; recommend one sentence in the G35 doc making the delivery-vs-ordering
boundary explicit.

### D5 — NON-BLOCKING (methodology note) — namespace cipher zero-plaintext quirk

Records whose plaintext would contain a byte equal to the key byte (cipher byte XORs to 0) are
handled by the lead's decryptor as "plaintext := key byte" (test `_decrypt_id`: `if p == 0:
p = key[i%16]`). This reproduces `flow` (cipher 0x66, key[0]=0x66) and `back%d` (0x64/0x64).
My independent implementation confirms all 30+ claimed names under this rule, but the rule
itself is an encoder inference; the runtime decryptor's treatment of zero-plaintext bytes is
not directly evidenced. EV-103 should carry a one-line methodology note (names affected:
at least `flow`, `back%d`).

### D6 — NON-BLOCKING (ledger hygiene) — EV-100/EV-102 mix binaries under one source_file

EV-100's `source_file`/`source_sha256` = Gr2D.dll only, but its address/instruction fields
include EXE windows (0x43EC69–0x43EF70, the 18 delay sites). EV-102 has the same shape
(Shape2D sha; EXE addresses 0x437717…/0x950970…). Either add the second source (EXE sha is
already canonical) or split the rows. The hashes present are correct for the binaries they name.

### D7 — NON-BLOCKING (test robustness) — `test_commit_site_census` covers 6 of 8 modrm forms

The test skips `esp` (0x94+SIB) and `ebp` (0x95) encodings of `call [reg+0xA8]`. My full
8-form census confirms the count is 3 anyway, so the pinned fact is right; the test would
simply be stronger complete. No action required for acceptance.

### D8 — NON-BLOCKING (wording) — "index domains 1..47"

Per-map record *counts* are 1..47; the enumeration index itself is 0-based (0..count−1)
(`xor edi,edi` at 0x6692AC). The envelope math is unaffected. Suggest "per-map counts 1..47,
enumeration index 0-based".

### D9 — ADJUDICATION (checklist c/g) — receiver identity and "camera filter" naming: UPHELD, with the singleton fact to be stated

- The scroll-branch +0x90/+0x98 receiver (G36) is statically **the shared 0x31D CWzVector2D**
  (resolve chain verified; IID 0xBA0500 = Shape2D 0x514101C0 verified; both vector-family
  tables carry identical engine slots, so the conclusion is *also* table-invariant). The lead's
  "table-invariant" hedge is correct but weaker than provable; C-111/gap row may state the
  singleton identity.
- The G10 filter arming (0x437717) likewise lands on **the shared singleton** — i.e., the
  camera-class object itself — not on a private UI/name-tag follower. "Camera filter exists and
  is armed (coef 100, (0,−50) base, F28 container attached)" is byte-defensible.
- No T089 document claims "the CMS079 camera follows with a 28px deadband": statuses say
  "architecture proven present and armed", and the unresolved scope explicitly retains the
  consumer/interleaving questions. **No deadzone overreach found.**
- Remaining honest caveats (already listed by the lead, seconded by me): the filtered-output
  consumer (pending-list walk output → slot15/world→screen) is not decoded; Set(0,−50) writing
  the shared vector's base from map-object-registration contexts (callers 0x66F143/0x670C60)
  coexists with the (−400,−300) map-load init — behavioral resolution is the already-listed
  runtime-interleaving residual.

### D10 — ADJUDICATION (checklist f) — OpenMS browser-policy separation: PASS

No T089 claim/evidence/gap/matrix row cites a docs.openms.dev page as CMS079 fact. OpenMS
addresses/constants appear only as level-B direction (matrix columns, report §4), and the two
refutations (front constant; EV-20) are decided on CMS079 bytes. P0-05/06/07/10 rows cite only
CMS claims/evidence.

### D11 — ADJUDICATION (checklist a/b) — no wrong GMS083→CMS079 mapping found; immediate-only matches: none misrepresented

Every MATCH row I checked resolves to CMS079 bytes at CMS079 addresses with function-level
context (key pair + branch; attach/evaluator full bodies; accumulator full body; frame-writer
full body; filter bodies; vtable slot dwords). The constant-only row that mattered (GMS083
front B+272000) is correctly REFUTED. Honest verdict labels elsewhere (MATCH-STRUCTURE,
MATCH-COUNTS, INCONCLUSIVE-IDS-DIFFER, NOT-RUN).

### D12 — ADJADICATION (checklist e) — Gr2D field offsets: PASS

Delay lands at record **+0x0C** (0x5040ACE3 `89 42 0c`), a0 +0x10, a1 +0x14; the accumulator
reads **[esi+0xC]** as the frame delay (0x5040BCC7) — same field, writer and consumer agree.

### D13 — CONFIRMED — task-book PCOM SHA-256 typo

Task book: `…be36d58b623061c94f…` (63 hex chars worth of damage — an inserted `1`); file and
repo-canonical: `…be36d58b62306c94f…`. The lead's report §1 documents this correctly.

### D14 — ADJUDICATION (checklist h/l/m) — honesty, tests, archive: PASS

- G36/G37 residuals (+0x9C 0x514086B3, first-frame attachment baseline, per-frame draw bodies)
  are retained verbatim in claim/audit/gap rows — honest.
- Test migrations 109→115 / 97→103 are commented per-file ("t089 migration: …"); the
  `[[user+0xF28]+0x14]` pins were relaxed to the dual form (historical framing retained
  alongside `[[arg3]+0x14]`) — regression intent preserved; 174/174 pass (my run).
- WP0-A archive is accurate and explicitly disclaims reviewer-session participation; all its
  git facts re-verified by me. WP0-B edit matches C-107/EV-94 (registration fn 0x9E6BAD;
  0x9E649A ends 0x9E6BAA and is called by the callback at 0x9E6E10).

### D15 — NON-BLOCKING (caveat to add) — "interpolation END TIME" for the scroll phase is walker-inference

The record built via 0x51407FE1 stores `{+0x10 dx, +0x14 dy, +0x18 start=tick, +0x1C V3 value,
+0x20 flags&0x10000000}` — i.e., it holds BOTH the current tick and the delivered
`tick+20000/|rate|` value. Whether +0x1C behaves as an **end time** (lead's C-111 wording; the
behaviorally sane reading and the GMS083-parallel) or as a **duration** (C-108's older wording)
is decided by the pending-list walker, which is not decoded in T089. The delivery bytes and the
tick-unit anchoring are proven; the scheduling semantics should be labeled
CORRELATIVE-until-walker-decoded (also reconcile C-108's "duration" vs C-111's "end time"
wording).

---

## Reproducibility of EV-98..EV-103 (checklist k)

- EV-98 (EXE sha ✓), EV-99 (Shape2D sha ✓), EV-100 (Gr2D sha ✓; see D6), EV-101 (EXE sha ✓,
  FSDB path ✓), EV-102 (Shape2D sha ✓; see D1/D6), EV-103 (EXE sha ✓). All `source_sha256`
  values match the canonical binaries. Cited byte windows reproduced by my own scripts except
  where noted above (D1 addresses, D4 address, D2 counts).

## Provisional verdict (pre-fix): **ACCEPT-WITH-CORRECTIONS**

The round's substance is sound: every status-bearing conclusion I attacked (G35 closure core,
G36 engine closure, G39 timing core, G37 narrowing, G10 filter existence/arming, namespace
names, FSDB counts, cross-version refutations) is supported by CMS079 bytes that I reproduced
independently. The defects found are factual wording errors inside two CLOSED-STATIC claims and
presentation/metadata issues — none reverses a status, but D1/D2 are wrong facts in grade-A
claim text and must be corrected before Phase 3.

## Corrections required before Phase 3

1. **(D1)** C-114, C-115, EV-102, G10 gap row, engine doc §9, report WP5: replace the
   "renews [user+0xF28] (release old, 0x43291A new) then calls 0x437717 on it" description with
   the byte facts: 0x43291A reads global [0xBDD460]; 0x437717 runs on that global with the
   existing F28 container as arg1 (0x950978–0x950985 stash+AddRef); no F28 write-back in the
   window. Replace "create vector" with "resolve the shared 0x31D singleton (0x447891 chain)".
   Fix containing-function attributions to 0x942AC5 / 0x94A2AE.
2. **(D2)** C-112, EV-100 wording, engine doc §2, G39 gap row: withdraw "universal"; state
   "default 120 at 18 sites (incl. frame converter 0x43EC69 and tiler 0x66ABCD); other readers
   carry 60/150/180/1000/variable defaults (e.g. 0x406ED1=150, 0x408113=60, 0x40EE40=180,
   0x5FA87A=1000)"; mark the portal 960/480/840/360 ms figures as default-based estimates.
3. **(D3)** Swap the `cms079_address` values (and quoted subs) in MATCH-MATRIX rows 2 and 3.
4. **(D4)** Fix 0x5040AB96→0x5040AC96 in T089-G35-BACKGROUND-KEY.md §3 and add one sentence
   bounding the slot25-delivery vs C-097-ordering-receiver linkage (runtime-bound bridge).
5. **(D5)** Add the zero-plaintext quirk note to EV-103 (affected: `flow`, `back%d`).
6. **(D6)** Fix EV-100/EV-102 source metadata (add the EXE source or split rows).
7. **(D15)** Label the scroll-phase end-time semantics as walker-inference in C-111/engine doc
   §5, and reconcile with C-108's "duration" wording (one record layout, two readings, walker
   undecoded).
8. **(D8)** Optional wording: "per-map counts 1..47; enumeration index 0-based".

— End of Phase-2 report. Phase 3 not started.


---

# T089 — INDEPENDENT REVIEWER PHASE 3 REPORT (Correction Verification)

**Reviewer**: T089 Independent Reviewer. **Date**: 2026-11-16. **Mode**: READ-ONLY repo; outputs in
`C:\Users\lithd\AppData\Local\Temp\opencode\t089-reviewer\` (this file, `t089p3_cleanroom.py`).
**Repo state**: HEAD `42e2d7fb8b7eb49f4cd3f61b48fc56cc391168ba` unchanged; lead's corrections
present as uncommitted working-tree edits (applied via `research/scripts/t089_reviewer_fixes.py`
+ document edits). Nothing committed/pushed; no repo file modified by me.

**Method**: for each Phase-2 finding I inspected the CURRENT text of every required surface
(claims.csv, evidence.csv, gaps.csv, match-matrix, T089-SHAPE2D-GR2D-ENGINE.md,
T089-G35-BACKGROUND-KEY.md, main report, audit CSV, test file), re-checked contested clauses
against my Phase-1/2 disassembly logs, and re-ran all gates myself.

---

## Per-finding disposition table

| Finding | Disposition | One-line justification |
|---|---|---|
| **D1** (blocking: 0x437717 chain) | **ACCEPTED-CORRECTION** (with 2 residual one-word defects, listed as blockers below) | C-114/C-115/EV-102/G10-gap/engine §9/main WP5/audit-G10 now all state the getter (`0x43291A = mov eax,[0xBDD460]; ret`), the `[0xBDD460]` global receiver, the stash+AddRef at 0x950978-85, the C-106 shared-singleton resolution, containing fns 0x942AC5/0x94A2AE, "armed ON the shared camera vector", and "no F28 write-back in this window" — all byte-consistent with my Phase-2 decode. Residuals: (a) the clause "after its old value is **Released** at 0x950970-85" (C-114 + engine doc L207-208) asserts a Release call that does not exist — 0x950970-85 is Read+stash+**AddRef** (`call [ecx+4]`); (b) match-matrix row 20 still says "caller renews [user+0xF28]". |
| **D2** (blocking: universal 120) | **ACCEPTED-CORRECTION** (1 residual word) | C-112/EV-100/G39-gap/engine §2 (L54-55, L63)/main WP3 all now say "18 of the 36 sites; NOT universal; explicit defaults 150/60/180/1000 or variable" with example families, and G39 unresolved adds "per-consumer default table for the 18 non-120 sites" — exactly my finding. Residual: engine doc **L144 (§7)** still reads "With the **universal** 120-ms default (§2): pv loop = 960 ms…". |
| **D3** (matrix rows 2/3 swap) | **ACCEPTED-CORRECTION** | Row 2 (back) now cites `0x669930-0x669936` with `sub 0x4001F400`; row 3 (front) cites `0x669923-0x669929` with `sub 0x3FFBDCA0` — matches the bytes; `reviewer_ruling` updated to `phase2-verified`. |
| **D4** (G35 §3 address + bridge) | **ACCEPTED-CORRECTION** | §3 now carries the exact boundary note: `inc [esi+0xD0]` sits at **0x5040AC96** in the frame writer "not the slot25 path"; ordering receiver = C-097 slot45→tree comparator chain; [0xBE2788] slot25 body = documented G24/G27 bridge; "closure rests on the EXE-side key computation + delivery, which is fully static". |
| **D5** (cipher quirk note) | **ACCEPTED-CORRECTION — and upgraded** | EV-103 interpretation now carries the quirk note for `flow`/`back%d` citing **0x7A4DEA** — and my own decode of 0x7A4DDA-0x7A4DF0 confirms the RUNTIME decryptor itself implements the rule (`xor byte [esi],al; jne skip; mov byte [esi],al` = zero-plaintext → store key byte), so the rule is byte-proven, not merely inferred; the note's "encoder inference" phrasing is conservative (its own citation proves it). |
| **D6** (cross-module provenance) | **ACCEPTED-CORRECTION** | EV-100 and EV-102 now inline-annotate the EXE content with `sha d4a67597…31718` (their `source_file`/`source_sha256` remain the named DLL, correctly). |
| **D7** (test census forms) | **ACCEPTED-CORRECTION** | `test_commit_site_census` now sweeps modrm 0x90/91/92/93/**95**/96/97 plus the esp/SIB form `FF A4 24 + disp32`; still asserts 3 — consistent with my full-census result. |
| **D8** (0-based index wording) | **ACCEPTED-CORRECTION** | G35 gap row and doc §5 both read "per-map record counts 1..47 (index is 0-based, so index domains are 0..n−1)". |
| **D15** (end-time correlative) | **STILL-INCONCLUSIVE (partial)** | G36 gap row, engine doc §5 (L111) and the verdict table now mark the END-TIME reading CORRELATIVE with "C-108 'duration' wording retained" — but **claims.csv C-111 still asserts** "…= the Set-interpolation END TIME (auto-scroll duration in tick-ms)" without qualification (the fix script did not touch C-111). One clause to fix. |
| D9/D10/D11/D12/D13/D14 (adjudications & confirmations) | NO ACTION NEEDED — unchanged and unregressed | C-110 wording untouched (still correct); OpenMS separation intact; Gr2D offsets intact; PCOM typo note intact (main report §1); WP0-A/WP0-B untouched; test migrations intact. |

## Gates (run by me, from the repo)

| Gate | Command | Result |
|---|---|---|
| Validator | `python research/scripts/validate_reverse_engineering.py` | **PASS — 0 errors / 0 warnings** (exit 0; "Claims: 115 \| Gaps: 41 \| Evidence: 103") |
| Unit tests | `python -m unittest discover -s research/tests -q` | **174 / 174 OK** (exit 0) |
| Clean-room sync | my comparator (`t089p3_cleanroom.py`): CLAIM-CONSISTENCY-REGISTER vs claims.csv, EVIDENCE-INDEX vs evidence.csv, GAP-REGISTER vs gaps.csv | **PASS — all three registers BYTE-IDENTICAL to source-of-truth after CRLF normalization** (which also proves the generator was re-run after the ledger fixes: the registers contain the corrected C-112/C-114/G10/G36/G39/G35 rows) |

## Remaining blockers (all one-line wording fixes; no re-derivation)

1. **C-114 + engine doc L207-208**: delete/replace "after its old value is Released" — the window
   0x950970-85 contains Read+stash+AddRef only (`call [ecx+4]`); no Release call exists there.
2. **claims.csv C-111**: qualify the scroll-phase clause to match the corrected surfaces, e.g.
   "…delivered as the +0x90 VT_I4 time parameter (flag 0x10000000) with value globalTick+
   20000/|rate| — END-TIME reading CORRELATIVE (walker undecoded; C-108 'duration' retained)".
3. **Engine doc L144**: replace "the universal 120-ms default (§2)" with "the frame-converter-family
   120-ms default (§2)" (and optionally note the portal family's own delay read is not among the
   18 verified-120 sites).
4. (Cosmetic) **Match-matrix row 20**: replace "caller renews [user+0xF28]" with "caller passes the
   [user+0xF28] container as arg1 (0x950978-85)".

## Phase-3 verdict

**READY-FOR-COMMIT — CONTINGENT ON THE 3 ONE-LINE FIXES ABOVE** (items 1-3 are wrong-or-unqualified
facts inside CLOSED-STATIC grade-A material and should not be committed as-is; item 4 rides along).
Nothing structural remains: every Phase-2 blocking finding has been corrected on the substantive
surfaces, all corrected text matches the bytes in my Phase-1/2 decode logs, the D5 correction is
stronger than required (byte-proven at 0x7A4DEA), and all three quality gates pass under my own
execution.

— End of Phase-3 report. Phase 4 not started.


---

# T089 — INDEPENDENT REVIEWER PHASE 4 REPORT (Post-Push Remote Verification & Final Verdict)

**Reviewer**: T089 Independent Reviewer. **Date**: 2026-11-16. **Mode**: READ-ONLY (`git fetch`,
`ls-remote`, `show`, `diff`, `log`, `status` only; no push, no working-tree writes). Outputs in
`C:\Users\lithd\AppData\Local\Temp\opencode\t089-reviewer\` (this file).
**Candidate commit**: `95c137cc456007666f5380c28d57bc8b07508496` on
`origin/design/adventure-field-map-scene`.

---

## Verification matrix

| # | Check | Expected | Observed | Verdict |
|---|---|---|---|---|
| 1a | Remote HEAD | `95c137cc456007666f5380c28d57bc8b07508496` | `git ls-remote origin design/adventure-field-map-scene` → `95c137cc456007666f5380c28d57bc8b07508496` | **PASS** |
| 1b | Remote == local HEAD | equal | `git rev-parse HEAD` → `95c137cc…` (identical); `git status -sb` shows branch in sync with upstream, clean | **PASS** |
| 1c | Fast-forward, no force | parent must be `42e2d7fb…` | `git show --format=%P` → single parent `42e2d7fb8b7eb49f4cd3f61b48fc56cc391168ba`; the remote sat at `42e2d7fb` before the push (T0881-PHASE3B archive's ls-remote read + my Phase-2/3 `git log`); an update `42e2d7fb → 95c137cc` whose parent is `42e2d7fb` is a fast-forward by definition; `git fetch` produced no forced-update output | **PASS** |
| 2a | Parent SHA | `42e2d7fb…` | `42e2d7fb8b7eb49f4cd3f61b48fc56cc391168ba` | **PASS** |
| 2b | Tree SHA | record | **`fae1a5015f812c7d1f1ba3619ffaf2311d5deba4`** | recorded |
| 2c | File count | 74 | `git diff --name-only 42e2d7fb..95c137cc` → **74** | **PASS** |
| 2d | Insertions/deletions | — | **74 files changed, 22332 insertions(+), 31 deletions(-)** | recorded |
| 2e | Subject | `research: t089 openms-guided static gap closure` | exact match (author lithdoo, 2026-11-16T02:58:28+08:00) | **PASS** |
| 3 | Scope: every path starts `research/` | no exceptions | non-research path filter returned **empty** (74/74 under `research/`) | **PASS** |
| 4a | Committed claims.csv | C-110..C-115 present; C-114 without "old value is Released"; C-111 correlative end-time | all six present (all CLOSED-STATIC); C-114: `Released` clause **gone**, replaced by "the existing [user+0xF28] container is read, stashed and **AddRef'd (vt+4)** as arg1 at 0x950970-85; no F28 write-back in this window" (byte-accurate vs my disassembly); singleton chain, `mov eax,[0xBDD460]; ret` getter, and 0x942AC5/0x94A2AE attributions all present; C-111: "…delivered as the +0x90 VT_I4 time parameter with flag 0x10000000 (**end-time reading CORRELATIVE — pending-list walker undecoded, C-108 duration wording retained**)…" | **PASS** |
| 4b | Committed gaps.csv | G35 = CLOSED-STATIC | `G35 status: CLOSED-STATIC`; also G36 carries the CORRELATIVE wording, G39 the "18 of 36 / not universal" wording, G10 the corrected `[0xBDD460]` chain | **PASS** |
| 4c | Committed engine doc | no "universal" default claim; AddRef (not Released) chain | zero hits for `universal` and `Released`; L205: "the existing `[user+0xF28]` container is read, stashed and AddRef'd (vt+4)" | **PASS** |
| 5a | Validator at committed state | PASS 0/0 | real output: `ERRORS: 0` / `WARNINGS: 0` / `RESULT: PASS (0 errors, 0 warnings)`, exit 0 (working tree clean at the same SHA — `git status --porcelain` empty) | **PASS** |
| 5b | Unit tests | 174/174 | real output: `Ran 174 tests in 8.260s` / `OK`, exit 0 | **PASS** |
| 6 | Frozen ABI pin + LoomRealm submodule | unchanged | `git diff 42e2d7fb..95c137cc -- components` → empty; `-- loom-realm` → empty | **PASS** |
| 7 | Reviewer archive committed & faithful | three phase reports, substance intact | `git show 95c137cc:research/result/stage-readiness/forensics/T089-REVIEWER-INDEPENDENT.md` exists (1087 lines; header declares faithful concatenation). My normalized comparison: **0 of 487 pure-ASCII signature lines missing** across the three private reports (363/363 blind, 106/106 phase-2, 18/18 phase-3); verdict strings (ACCEPT-WITH-CORRECTIONS, READY-FOR-COMMIT, CONTINGENT ON) and key facts (B+271200, deadband 28.0) all present. The 219 missed lines are ALL non-ASCII (em-dash/§/−) mojibake introduced by the archival encoding — an encoding artifact, not content loss (two control greps that returned 0 hits — "61 imul", "T089-REVIEWER-PHASE3.md" — also return 0 in my private originals, i.e. bad probes, not omissions) | **PASS** (with cosmetic note below) |
| 8 | Final-SHA problem | stated | see note below | stated |

**Cosmetic note (non-blocking)**: the archived `T089-REVIEWER-INDEPENDENT.md` has mojibake on
non-ASCII characters (UTF-8 re-encoded through a CJK code page — "—" renders as "锛?"-style
sequences). Substance is fully intact (0 ASCII-line losses). When the lead archives this Phase-4
report in the follow-up commit, the same file can be re-saved with correct UTF-8 in the same pass.

## Final-SHA problem (item 8 — explicit statement)

By construction, this Phase-4 report **cannot** be part of commit `95c137cc`: the report verifies
that commit post-push, so it did not exist when the commit was made. The disposition agreed with
the lead: the lead will archive `T089-REVIEWER-PHASE4.md` (from my private directory) in a
**follow-up review-archive commit**, then re-read the final `HEAD` (and, if that archive commit
also requires verification, record its SHA in the round's closing note). The T089 round's
technical content is fully contained in `95c137cc`; the archive commits are metadata-only.

## Round summary (reviewer's ledger)

- **Phase 1 (blind)**: independently pre-verified the CMS079 baseline (61-site imul census,
  0x669923/0x669930 dual-constant key, shared-Vector2D receiver, global-tick slots, parallax
  attach/evaluator, caller-idiom correction `[[arg3]+0x14]`) — all later confirmed by the lead.
- **Phase 2 (adversarial)**: ACCEPT-WITH-CORRECTIONS; 15 findings (2 blocking wording-facts,
  13 non-blocking/adjudications); every MATCH row attacked; two GMS083 items correctly refuted
  for CMS079 (front constant delta 800; EV-20 census artifact).
- **Phase 3**: corrections verified on all required surfaces (D5 even upgraded to byte-proven at
  0x7A4DEA); gates green; 3 one-line residuals identified.
- **Phase 4 (this report)**: those 3 residuals are confirmed **fixed in the committed text**;
  remote/local/tree/scope/pins/archive all verified; gates re-run green at the committed state.

## FINAL VERDICT (T089 round as a whole): **ACCEPT**

All Phase-2 corrections landed (including the Phase-3 residual one-liners), the push is a clean
fast-forward confined to `research/`, the frozen pins are untouched, quality gates pass under my
own execution at the committed SHA, and the independent-review record is archived with substance
fully intact (encoding artifact noted, cosmetic only). The one carry-forward for T090 remains the
G10 residual set (arg3 `+0x14` writer census, filtered-coordinate consumers, 25 INCONCLUSIVE
sites, slot15 derived tables) and the WZ-side delay values — all honestly recorded in the ledger.

— End of Phase-4 report. T089 reviewer engagement closed.

