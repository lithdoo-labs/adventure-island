# T086 — Independent Adversarial Reviewer Report (G24 / G08 / G09 / G10 / G17)

Reviewer: independent subagent, own scripts, own disassembly, no reuse of T086 lead material.
Scripts written under `C:\Users\lithd\AppData\Local\Temp\opencode\t086rev\` (outside `research/`).
Context read: `research/source-of-truth/claims.csv` + `gaps.csv` only (permitted baselines C-001/C-043/C-086/C-087), plus the two join CSVs named by the task (`protocol-opcodes.csv`, `task044-handler-map.csv`). No T086-* forensics, no t086_* scripts read.

## 0. Binary identity (SHA-256, verified before every use)

```
EXE  .work/task-036/game-image-unpacked.bin
     d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718   == expected PASS
DLL  .work/task-001/extracted/冒险岛online/Gr2D_DX8.dll
     ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1  == expected PASS
JAR  .work/task-063/server079.jar
     49382081ff5525380bc6024f61859d2e08c2983b0faca2554061c6d1218cf360  (no expected hash given; recorded)
```
Re-verified again after all analysis, immediately before writing this file (identical).

EXE treated as LINEAR image: `fileOffset = VA - 0x400000` (confirmed working: all disassembly below decodes as sane x86 at documented anchors). Gr2D PE ImageBase `0x50400000`, sections `.text 0x50401000+0x2b10c`, `.rdata 0x5042d000+0x72bb`, `.data 0x50435000+0x5204`.

Tooling: Python 3.14.4, capstone 5.0.7, pefile 2024.8.26, repo-local `wzpy` (`.work/task-023/tools/wz-python`), CFR 0.152 (`java -jar .work/task-002/tools/cfr-0.152.jar`).

---

## CHECK 1 — G24 candidate exhaustion (Gr2D slot25 → 0x5040418C → created object's class/vtable; slot45 semantics)

**Stated finding under review:** the EXE tile path's `call [eax+0xB4]` (slot45) at EXE 0x666F7D lands on an object created by Gr2D slot25 function 0x5040418C.

### (a) Where *arg15 (the out pointer) gets its value — full trace, my own bytes

`0x5040418C` head (thiscall, `ret 0x3C` further down):

```
504041A0  395d40          cmp dword ptr [ebp+0x40], ebx        ; ebx = 0
504041AA  750a            jne 0x504041CB
504041AC  b803400080      mov eax, 0x80004003                  ; E_POINTER guard on arg15
...
504041B6  8b7d08          mov edi, dword ptr [ebp+8]           ; edi = this
504041B9  399f90000000    cmp dword ptr [edi+0x90], ebx        ; device-state guard -> E_FAIL
...
50404215  895d08          mov dword ptr [ebp+8], ebx           ; [ebp+8] slot REUSED as local
50404218  8d4508          lea eax, dword ptr [ebp+8]
50404220  e821160000      call 0x50405846                      ; factory(&local)
```

`0x50405846`:
```
50405854  call 0x50406233      ; create+construct into temp2
5040587E  call 0x504062AA      ; QI-assign temp2 -> *(caller local)
50405895  mov eax, [ebp-4]; leave; ret
```

`0x50406233` (create path):
```
5040623E  mov ecx, dword ptr [0x5043a198]     ; object manager
5040624B  call 0x504074cf                     ; obtain slot
5040625D  push 0
5040625F  call 0x504067d7                     ; <<< CONSTRUCTOR
5040626E.. push [esi+0x10]; call [0x5042D028] ; refcount init on obj+0x10
50406283  mov eax, [ebp+8]; mov [eax], esi    ; *out = constructed object
```

`0x504062AA` (smart-pointer QI assign; `esi = ecx = &slot_in_0x5040418C_frame`):
```
504062B2  test eax, eax                ; eax = *(&temp2) = constructed object
504062BA  mov ecx, dword ptr [eax]     ; vtable = 0x5042E3F0
504062C0  push 0x50436540              ; riid = IID at 0x50436540
504062C6  call dword ptr [ecx]         ; QI(object, riid, &slot)  (arg slot overwritten in place)
504062DF  ...  mov edi, dword ptr [ebp+8]   ; QI'd pointer
504062EF  mov dword ptr [esi], edi     ; *slot = QI'd pointer (Release of old value)
```

Back in `0x5040418C`, the out write:
```
504045C1  8b4508          mov eax, dword ptr [ebp+8]     ; the QI'd object
504045C4  8b4d40          mov ecx, dword ptr [ebp+0x40]  ; arg15
504045CB  8901            mov dword ptr [ecx], eax       ; *arg15 = object
```

**Confirmed: \*arg15 is written at 0x504045CB with the object constructed by ctor 0x504067D7 and QI'd for the IID at 0x50436540.** (Matches the chain named in the task: 0x50405846 → 0x50406233 / 0x504062AA → ctor 0x504067D7.)

### (b) Concrete vtables installed by ctor 0x504067D7

```
504067D7  push esi; mov esi, ecx
504067DA  call 0x5040962b                      ; base init
504067E4  mov dword ptr [esi],    0x5042E3F0   ; +0x00  PRIMARY (76 slots)
504067EA  mov dword ptr [esi+4],  0x5042E3EC   ; +0x04  (77-slot run view)
504067F1  mov dword ptr [esi+8],  0x5042E3E8   ; +0x08  (78-slot run view)
504067F8  mov dword ptr [esi+0xC],0x5042E3D0   ; +0x0C  (84-slot run view)
504067FF  call dword ptr [0x5042D028]          ; InitializeCriticalSection(&0x50439B3C)
```

- All four are views into ONE contiguous dword block `0x5042E3D0..0x5042E520` that ends exactly at the ATL interface map (classic ATL layout).
- **PRIMARY vtable = 0x5042E3F0, 76 consecutive .text slots** (0x5042E3F0..0x5042E520). No COL at [vt-4] (consistent with C-006: no RTTI).
- Slot counts of the four views (maximal-run from each base): 76 / 77 / 78 / 84 — i.e. the same tail, entered at different offsets.
- A second install site `0x50406AF2` re-installs the identical quartet (`[esi-4]=0x5042E3F0, [esi]=0x5042E3EC, [esi+4]=0x5042E3E8, [esi+8]=0x5042E3D0`, then refcount=1).

### (c) QI thunk 0x50406AB4, interface map 0x5042E520, IID 0x50436540

```
50406AB4  push dword ptr [esp+0xC]     ; ppv
50406AB8  push dword ptr [esp+0xC]     ; riid
50406ABC  push 0x5042E520              ; pMap
50406AC1  push dword ptr [esp+0x10]    ; pThis
50406AC5  call 0x50401945              ; ATL InternalQueryInterface (same IQI as C-077)
50406ACA  ret 0xC
```

Interface map at 0x5042E520 (ATL `_ATL_INTMAP_ENTRY` = {piid, dw, cnt}), 5 entries + terminator, all `dw=0` (every IID resolves to pThis+0):

| # | piid | dw | IID |
|---|------|----|-----|
| 0 | 0x50436540 | 0 | **{6DC8C7CE-8E81-4420-B4F6-4B60B7D5FCDF}** |
| 1 | 0x50436390 | 0 | {F28BD1ED-3DEB-4F92-9EEC-10EF5A1C3FB4} |
| 2 | 0x50436560 | 0 | {4CFB57C7-EAE3-40B3-AC98-4B2750E3642A} |
| 3 | 0x50436550 | 0 | {01110BC6-D843-4FF1-918C-9CF64632FB15} |
| 4 | 0x50435110 | 0 | {00000000-0000-0000-C000-000000000046} = IUnknown |
| — | 0 (terminator) | | |

IID bytes at 0x50436540: `cec7c86d 818e 2044 b4f64b60b7d5fcdf` → **{6DC8C7CE-8E81-4420-B4F6-4B60B7D5FCDF}** — the "RawCanvas-family" IID named by G22/C-020. So the slot25-created object IS a 6DC8C7CE object, and since entry0 dw=0, the pointer the EXE receives via the out write carries **primary vtable 0x5042E3F0**.

### (d) slot45 (+0xB4) and slot56 (+0xE0) of the primary vtable

- `slot45 (+0xB4)` of 0x5042E3F0 = dword at 0x5042E4A4 = **0x50409ECD**
- `slot56 (+0xE0)` of 0x5042E3F0 = dword at 0x5042E4D0 = **0x50409DBA**

slot45 body:
```
50409ECD  mov eax, dword ptr [esp+4]     ; this
50409ED1  push dword ptr [eax+0xF8]      ; arg3 = this->[0xF8]
50409ED9  push dword ptr [esp+0xC]       ; arg2 = KEY (the EXE-pushed sort key)
50409EDD  neg ecx / sbb ecx, ecx         ; (this!=0) ? -1 : 0
50409EE1  lea edx, [eax+0xC]
50409EE4  and ecx, edx                   ; arg1 = this ? this+0xC : NULL
50409EE7  mov ecx, dword ptr [eax+0x2C]  ; thiscall this = this->[0x2C]
50409EEA  call 0x50409EF4                ; forward
50409EEF  xor eax, eax; ret 8
```

Forward body 0x50409EF4 (this=[this+0x2C], arg1=the `+0xC` sub-interface view → vtable **0x5042E3D0**, arg2=KEY, arg3=[this+0xF8]):
```
; fresh-registration branch (item slot array empty):
50409F1E  call [eax+0xC]     ; slot3 0x50406966: mov eax,[ecx+idx*4+0xE4]  (indexed getter; idx=0 here)
50409F27  call [eax+4]       ; slot1 0x5040694A: mov [ecx+0x38], KEY        <<< KEY STORED at view+0x38
50409F31  call [eax+0x14]    ; slot5 0x5040697B: mov [ecx+0xEC], arg3
; existing-item branch:
50409F4B  call 0x5040390D    ; node-list resolver on the registered item
50409FA3  call [eax]         ; slot0 0x50406946: mov eax,[ecx+0x38]         <<< READS the CURRENT key
50409FA5  push dword ptr [ebp+0xC]        ; the new KEY
50409FAA  cmp eax, dword ptr [ebp+0xC]
50409FAF  setle cl                        ; cl = (currentKey <= newKey)     <<< KEY COMPARISON
50409FB7  call [eax+4]       ; slot1 0x5040694A  — overwrites view+0x38 with the new KEY
50409FBA  mov eax,[ebx+0x20]; lea ecx,[eax+1]; mov [ebx+0x20],ecx          ; counter++
50409FCA  call [edx+8]       ; slot2 0x50406954: mov [ecx+edx*4+0xE4], eax ; indexed array store
50409FD1  call [eax+0x10]    ; slot4 getter, compared vs arg3
50409FF0  push dword ptr [ebx]; push esi
50409FF3  call 0x50403A42    ; ORDERED-LIST COMPARATOR (see below)
```
0x50403A42 walks two node chains via `call [eax+0x10]` (next) and `call [eax]` (key getter) and returns ±1 by `cmp ebx,eax; jle` — a genuine integer-key ordering comparator.

**Precise answer — what slot45 does with its second argument:** the sort key is consumed as the *ordering key of a keyed registration/insert*: (i) stored into the item view's key field `+0x38` via interface slot1 (`0x5040694A mov [ecx+0x38],eax`); (ii) read back via slot0 (`0x50406946`) and compared against the incoming key (`cmp`/`setle` at 0x50409FA5-0x50409FAF); (iii) used as the ordering value inside the linked-list comparator 0x50403A42 to position the item. It is never treated as a callback pointer and never discarded. This is static, disassembly-level confirmation of C-075's "keyed insert/registration" narrowing — and it finally identifies the "comparator body" territory G01/G07 were hunting: it lives *inside* slot45's forward body (cmp/setle + 0x50403A42), on the created object, not in any EXE-side callee.

slot56 body (0x50409DBA): SEH-protected dispatcher over the sub-objects at `[esi+0x38]`, `[esi+0x3C]`, `[esi+0x34]` — E_POINTER-guarded, calls their `[vt+0x24]` / `[vt+0x40]` methods with byte-sliced fragments of arg2 (`mov cl,[ebp+0xE]`, `shr ebx,0x18`), referencing IID 0x50436560 on failure. A flag/byte consumer — not an ordering function, not a producer of scene fields.

### (e) Candidate-exhaustion scan (production slot25 = +0x64 = 0x5040418C)

Method: byte-scan the whole DLL file for the dword `0x0050418C`; for each occurrence determine the containing maximal run of consecutive .text pointers and the ctor-installed logical base at −0x64.

- The dword 0x5040418C occurs **exactly twice** in the entire DLL file:
  - `0x5042D1B8` — logical base `0x5042D154` (class-2 primary; installed by ctor fragment `0x50401295: mov [esi],0x5042D154; mov [esi+4],0x5042D140`)
  - `0x5042D288` — logical base `0x5042D224` (class-1 inner; installed by ctor `0x504013E3: mov [esi],0x5042D224; mov [esi+4],0x5042D210; mov [edi],0x5042D204`)
- Maximal-run check: the runs containing these dwords start at 0x5042D140 (dword at run index 30) and 0x5042D204 (run index 33) — **no maximal run anywhere in the DLL places 0x5040418C at run index 25**; the only +0x64 holders are the two ctor-installed logical tables. No E9/E8 thunk targeting 0x5040418C exists anywhere in the file, so no indirect candidate can exist either.
- `mov [reg],imm32` census for the family confirms the only installed bases: 0x5042D154, 0x5042D140 (0x50401295); 0x5042D224, 0x5042D210, 0x5042D204 (0x504013E3 / 0x50401430).

**Candidate set = {0x5042D154, 0x5042D224} — EXHAUSTED.** Both share the same slot25 body 0x5040418C, so the production slot25 is class-invariant, exactly as C-086/C-087 state.

### Check-1 extras (independent structural results beyond the baselines)

- The 151-dword run 0x5042E2C4..0x5042E520 (C-020's "family") is a *composite*: `0x5042E2C4` is a **mini-holder table** installed at `0x50402A30` on a pooled 0x10-byte node object stored at `[esi+0x384]` (slots 0x50402B84/0x50402A51/0x50402AA3/...; slot[5]@0x5042E2D8 = purecall thunk 0x5042A610 per C-009); `0x5042E2CC` is **never installed anywhere** (it is just +8 into the mini-table). The container class owns only the tail quartet 0x5042E3D0/0x5042E3E8/0x5042E3EC/0x5042E3F0. The G22 "0x2E2C4 vs 0x2E2CC" ambiguity is therefore a *false alternative* — both are run-relative phantom bases; the 6DC8C7CE container's primary is 0x5042E3F0. The sibling factory 0x5040636A → ctor 0x50406B8B installs a different quintet **beyond** the intmap (0x5042E5A8/0x5042E57C/0x5042E570/0x5042E56C/0x5042E568; intmap 0x5042E520..0x5042E568 = 5×12+terminator).
- EXE side independently re-verified at the byte level: `0x666F5D imul ecx,ecx,0xBB8; sub ecx,esi; lea ecx,[ecx+ecx*4]; lea edi,[eax+ecx*2-0x3FFFB1EA]` (C-001 formula, key = z + 10*(layer*3000−zM) − 1073721834) → `0x666F6F lea ecx,[ebp-0x10]; call 0x42944A` (null-assert → created object) → `0x666F7B push edi (KEY); push esi; call [eax+0xB4]` → `cmp eax,ebx / jge` HRESULT gate with 0xBA0510 error. The slot45 receiver is the slot25-created object, NOT [0xBE2788] — confirmed with my own bytes.

### Check 1 verdict

**AGREE** with the stated finding and with C-086/C-087 (production slot25 = 0x5040418C on both long tables 0x5042D154/0x5042D224; out object = ctor 0x504067D7 product; QI IID {6DC8C7CE-...}). **New static result that further closes G24/G22:** the created object's primary vtable is **0x5042E3F0 (76 slots)**, its slot45 is **0x50409ECD** and is a **keyed ordered-insert**（主 Agent 闭环注：C-012/C-013 时代『已知候选 vtable 上 slot45=有序插入』的笼统断言维持已撤销/REFUTED——本结论限定于本轮新定身的节点主表 0x5042E3F0 之 slot45） (key stored at +0x38, compared cmp/setle, list comparator 0x50403A42) — the runtime dump G24 requests would CONFIRM this named prediction; G22's 0x2E2C4/0x2E2CC alternative is a phantom-run artifact (0x2E2C4 = separate mini-holder table; 0x2E2CC never installed).

---

## CHECK 2 — G08 formula (avatar depth key, EXE 0x401000–0xA80000)

**Stated hypothesis under review (v83 cross-version):** avatar depth key = −0x40000000 + 29992 + (controller?5:0) + (layer*3000 − group)*10.

### (a) Immediates 29991/29992/29995/29999 (0x7537/0x7538/0x753B/0x753F)

Raw dword scan of the whole band: **0 occurrences of all four values** as standalone dwords. The 299xx family exists ONLY as the low part of `lea` disp32 constants.

### (b) `lea` with disp32 ∈ [−0x40000000, −0x40000000+0x10000)

34 sites (full scan of every `8D /r` with mod∈{0,2} disp32 in the band, mod=01 disp8 excluded by construction). Authoritative K = disp + 2³⁰:

| site | disp | K | form |
|------|------|---|------|
| 0x666F68 | −1073721834 | **19990** | tile key (C-001) |
| 0x6688D2 | −1073739824 | **2000** | obj key (C-002) |
| 0x559F07 | −10741824+… | **0** | layer*30000 band (K=0) |
| 0x559F39 | −1073681854 | **59970** | layer*30000 − 59970 |
| 0x559F6B | −1073681844 | **59980** | layer*30000 − 59980 |
| 0x693E7E | −1073711841 | **29983** | avatar-band sibling |
| 0x6938A0 / 0x693D61 | −1073711839 | **29985** | " |
| 0x69392E / 0x693CD3 | −1073711838 | **29986** | " |
| 0x6939BC / 0x693C0F | −1073711837 | **29987** | " |
| 0x693A4A / 0x693B4B | −1073711836 | **29988** | " |
| 0x693812 / 0x693ABD / 0x6C3ABD / 0x7A9A0E / 0x69374E | −1073711835 / −1073711833 | **29989 / 29991** | " |
| 0x6C45A4, 0x70DDD7, 0x741942, 0x936409, 0x93E82A, 0x93E909, 0x93EF0D | −1073711834 | **29990** | **avatar/move key family (×10 form)** |
| 0x7A99D5 | −1073711832 | **29992** | flat 29992 site |
| 0x5181E6, 0x6C3A2C, 0x9889A8, 0x989AED | −1073711829 | **29995** | " |
| 0x50ED77 | −1073711825 | **29999** | " |
| 0x48CE02, 0x9882E4 | −1073711828 | **29996** | " |

**Every distinct type-base constant found:** `{0, 2000, 19990, 29983, 29985, 29986, 29987, 29988, 29989, 29990, 29991, 29992, 29995, 29996, 29999, 59970, 59980}`. The 299xx family has 12 members; **29993/29994/29997/29998 are NOT encoded as raw lea constants** (they arise arithmetically, below). Sentinel value `0xC0041F14` (K=270612) appears at 0x693732 and 0x7A9A17 as a "skip/already-registered" key.

### (c) imul-by-3000 (0xBB8, `69 /r`) sites

33 sites: 0x48CDF2, 0x48CE48, 0x50ED69, 0x5181D9, 0x666F5D, 0x69373F, 0x693802, 0x693890, 0x69391E, 0x6939AC, 0x693A3A, 0x693AAD, 0x693B3B, 0x693BFF, 0x693CC3, 0x693D51, 0x693DDF, 0x693E6E, 0x6C3A1C, 0x6C3AAF, 0x6C4591, 0x70DDBF, 0x741934, 0x7A99C8, 0x7A99FF, 0x9363EE, 0x93E80D, 0x93E8E0, 0x93EEE4, 0x9882D6, 0x9883FC, 0x988998, 0x989ADD. Every imul is followed by `sub reg,[x+0x134]` then `lea ×5` then `lea ×2` → total scale ×10.

### (d) The [reg+0xF28] sites and the exact recovered formulas

Census: 59 `mov reg,[reg+0xF28]` sites in the band. The sites matching the full avatar shape (read `[user+0xF28]`, M = value−0xC with neg/sbb/and null-guard, read `[M+0x130]` layer, `[M+0x134]` group, `[M+0x18]` controller):

**Site 0x9363D9** (self-contained; `[ecx+0xF28]`, ecx = user):
```
009363D9  mov eax,[ecx+0xF28]
009363DF  lea edx,[eax-0xC]; neg eax; sbb eax,eax; and eax,edx    ; M (null-guarded)
009363E8  mov edx,[eax+0x130]        ; layer
009363EE  imul edx,edx,0xBB8         ; *3000
009363F4  sub edx,[eax+0x134]        ; − group
009363FA  mov eax,[eax+0x18]         ; controller/flag
009363FD  neg eax; sbb eax,eax
00936401  and eax,5                  ; ctrl ? 5 : 0
00936404  inc eax                    ; +1
00936405  lea edx,[edx+edx*4]        ; *5
00936408  inc eax                    ; +1   → eax = ctrl ? 7 : 2
00936409  lea eax,[eax+edx*2-0x3FFF8ADA]
          ; KEY = −0x40000000 + 29990 + (ctrl?7:2) + 10*(3000*layer − group)
00936410  push eax
00936411  add ecx,0x88
00936417  call 0x452147              ; → guarded slot45 forwarder (see below)
```
`0x452147(this=user+0x88, key)`: if `[this+0xE44] != 0` then `esi=[this+0xE44]; push key; push esi; call [eax+0xB4]` — i.e. **the user-avatar key IS pushed as arg2 to `call [reg+0xB4]`** via this forwarder (HRESULT gate + 0xBA0510 error report, same shape as the tile path).

**Sites 0x93E82A / 0x93E909 / 0x93EF0D** (esi = user; identical construction reading `[esi+0xF28]`):
key = −0x40000000 + 29990 + (ctrl?7:2) + 10*(3000L−g), then **`dec edi`** at 0x93E87C/0x93E926/0x93EF2A → the value pushed into the stack-package channel (`mov ecx,esp; call 0x43286E` ctor family; then 0x432858/0x404B2E/0x404B07 marshalling; cf. C-017/C-085) is **key−1**.

**Site 0x70DDD7** (holder object; M from `[edi+0x124]`):
```
0070DDB9  mov edi,[edi+0x124]        ; container holder
0070DD9A/0x70DDA0  mov ecx,[eax+0x134]; mov ebx,[eax+0x130]   ; from M
0070DDA7  mov esi,[eax+0x18]         ; ctrl
0070DDBF  imul ebx,ebx,0xBB8
0070DDC5  sub ebx,ecx
0070DDCA  neg esi; sbb esi,esi; and esi,5
0070DDD1  lea ecx,[ebx+ebx*4]
0070DDD4  add esi,3                  ; ctrl ? 8 : 3
0070DDD7  lea ecx,[esi+ecx*2-0x3FFF8ADA]
0070DDDE  push ecx; push edi
0070DDE0  call dword ptr [eax+0xB4]  ; KEY = −0x40000000 + 29990 + (ctrl?8:3) + 10*(3000L−g)
0070DDE6  test eax,eax; jge; …0xBA0510…
```

**Site 0x7A99D5** (holder `[edi+0x14C]`): key = −0x40000000 + **29992** + 10*(3000L−g) (no controller term) → `push; push edi; call [eax+0xB4]`. Alternate branch 0x7A99F0: if `[edi+0xC4]==0` → key = −0x40000000 + **29991** + 10*(3000L−g) (0x7A99FF imul, 0x7A9A0E lea), else sentinel `ebx = 0xC0041F14`.

**Site 0x693713 family** (holder `[esi+0x118]`, life/mob family): key = −0x40000000 + **29991** + 10*(3000L−g); if `[M+0x238]==3` → sentinel 0xC0041F14; → `push ebp; push ebx([esi+0x474]); call [eax+0xB4]` (0x693772).

Sibling clusters at 0x6938xx–0x693Exx (K = 29983..29989), 0x6C3Axx/0x6C45xx, 0x7419xx, 0x988xxx (29995/29996), 0x48CE0E/0x50ED77/0x5181E6 (29996/29999/29995) all follow the same shape reading +0x130/+0x134 from their M-like objects and feed `call [reg+0xB4]` (e.g. 0x48CE0E).

### Recovered formula (canonical form)

```
key = −0x40000000 + K_eff + 10*(3000*[M+0x130] − [M+0x134])
K_eff per site family:
  user-avatar  (0x9363D9, 0x93E82A, 0x93E909, 0x93EF0D):  29990 + (2 + ([M+0x18] != 0 ? 5 : 0))  =  {29992, 29997}
  holder+0x124 (0x70DDD7):                               29990 + (3 + (ctrl ? 5 : 0))            =  {29993, 29998}
  holder+0x14C (0x7A99D5 / 0x7A9A0E):                    29992 flat / 29991 fallback; sentinel 0xC0041F14
  holder+0x118 (0x693713 family):                        29991 flat; sentinel 0xC0041F14 when [M+0x238]==3
  other type bands: 29983, 29985–29989, 29995, 29996, 29999 (and non-299xx: 0 / 2000 / 19990 / 59970 / 59980)
stack-package consumers push key−1 (dec edi at 0x93E87C/0x93E926/0x93EF2A)
```

### Check 2 verdict

**PARTIAL → AGREE on value, DISAGREE on literal encoding.** For the user-avatar sites the machine code yields `−0x40000000 + 29990 + (2 + (ctrl?5:0)) + 10*(3000*layer − group)`, which is **arithmetically identical** to the v83 hypothesis `−0x40000000 + 29992 + (ctrl?5:0) + 10*(...)` (both produce {29992, 29997}). So the hypothesis is CORRECT for the avatar key value. However, as a statement about "the" formula it is incomplete for this image: (i) the controller bit is `[M+0x18] != 0` (move-object field), not directly a "controller" argument; (ii) there is a +1-higher band (0x70DDD7: {29993, 29998}); (iii) flat 29991/29992 sites and sentinels (0xC0041F14) exist; (iv) the stack-package path pushes key−1. G08's status as OPEN-RUNTIME can be downgraded: the avatar key construction is now statically recovered at four user-side sites plus the 0x452147→`call [reg+0xB4]` forwarder.

---

## CHECK 3 — G09 occlusion data (Base.wz)

Library: repo-local `wzpy` (`.work/task-023/tools/wz-python`), `WzFile.open(path, region='EMS')`; images parsed via `root.get(name).parse()`, children via `img.children()` (a method), values via `getattr(node,'value',None)`.

| image | entries | notes |
|---|---|---|
| zmap.img | **149** | all entries are WzNullProperty — the z-number IS the ordinal position (order = z index); first: mobEquipFront, tamingMobFront, mobEquipMid, saddleFront, mobEquipUnderSaddle, tamingMobMid, characterStart…; last: Af, At, Fc, Hr, Hd, Bd |
| zmap_cn.img | **149** | **identical to zmap.img** — ordered name list equal entry-by-entry (dict and ordered comparison both True); no value layer exists (null properties), so "differs" is vacuously false |
| smap.img | **147** | 106 bound entries (state name → component code), 41 unbound (incl. bare component codes Sr/Wg/Ma/Ws/Pn/So/Si/Wp/Gv/Ri/Cp and emotionOverBody) |

5 sample smap bindings (layer name → component code):
```
weaponWristOverGlove -> Wp
weaponOverGlove       -> Wp
capeOverHead          -> Sr
gloveWristOverHair    -> Gw
gloveOverHair         -> Gl
```
(also observed: handOverHair → Bd, weaponOverHand → Wp, shieldOverHair → Si.)

### Check 3 verdict

**AGREE** with the settled C-043 model (zmap 149-layer numbering). zmap_cn does NOT differ from zmap in this v079 Base.wz (same 149 names, same order, no value payload). smap = 147 entries (106 effective bindings) — a concrete count not previously pinned in the baselines I was given.

---

## CHECK 4 — G10 camera chain (EXE)

### (a) Census of `call [reg+0x3C]`

- disp8 form `FF 5x 3C` (mod=01, reg=2, rm≠100): **28 sites** — 0x4951A2, 0x495769, 0x4D6763, 0x4D6F49, 0x4E0C85, 0x4E146A, 0x522B5F, 0x52A600, 0x548048, 0x68D5B1, 0x8A26B5, 0x8A26CF, 0x8A26DB, 0x8A27DD, 0x8A27ED, 0x8A371F, 0x8A3D7D, 0x8A3D90, 0x923DE2, 0x924564, 0x9245AA, 0x92460B, 0x9DDC18, 0x9DE0E1, 0x9DE108, 0x9E2670 ([edx]), 0x9E4032 ([edx]), 0x9F20A4.
- disp32 form `FF 9x 3C 00000000`: **0 sites**.
- SIB form `FF 54 sib 3C`: **0 sites**.

Total: **28**. None of the 28 sites lies inside the scene-manager slot bodies (0x533EA4–0x534850 family).

### (b) Callers of scene per-tick 0x53465B (direct E8 census, image-wide)

Exactly **ONE**: `0x5658CA`. It sits inside wrapper `0x5658BF`:
```
005658BF  push esi
005658C0  push [esp+0xC]        ; forward arg
005658C4  mov esi, ecx
005658C6  push [esp+0xC]        ; forward arg
005658CA  call 0x53465B         ; the scene per-tick
005658CF  cmp dword ptr [esi+0x770], 1
005658D8  inc dword ptr [esi+0x7AC]      ; 40-tick counter
005658DE  cmp dword ptr [esi+0x7AC], 0x28
005658ED  and dword ptr [eax], 0
005658F0  lea ecx,[esi+0x764]; call 0x565630   ; periodic (every 40 ticks) action
005658FC  ret 8
```
`0x5658BF` itself has **zero** E8 callers and appears as a vtable dword at **0xB01338 = table 0xB01308 slot12** — inside the 33-table handler family 0xB01308..0xB02730 (C-083/C-084). 0x53465B itself is the slot12 dword in 32 further tables (0xB012A8, 0xB013C0, …, 0xB026D0).

### (c) EXE 0x953AF4 — what it does

```
00953AF4  push esi; mov esi, ecx
00953AF7  lea ecx,[esi+0x2990]
00953AFD  call 0x8EE966                 ; per-phase sub-init on this+0x2990
00953B02  mov eax,[esp+8]               ; arg1
00953B06  sub eax,0x201; je ->0x956AC3  ; arg1 = 0x201
00953B0D  dec eax;    je ->0x9564EE     ; arg1 = 0x202
00953B10  dec eax;    je ->0x956411     ; arg1 = 0x203
00953B13  dec eax; dec eax; jne +0x22   ; arg1 = 0x205 -> 0x9563E7
00953B39  pop esi; ret 0x10             ; 4 stack args (this in ecx)
```
0x953AF4 is a **draw-phase switch dispatcher** (arg1 ∈ {0x201,0x202,0x203,0x205} → 0x956AC3 / 0x9564EE / 0x956411 / 0x9563E7). **It is NOT a camera producer:** zero references to `[reg+0xF0..0xFC]` in its own body, and a bounded scan (0x400 bytes each) of all four callees plus 0x8EE966 found **0** reads or writes of the +0xF0..0xFC camera-rect fields. (Its sole E8 caller is 0x534712 — inside slot14 0x5346EF's body, confirming the C-084 slot14→0x953AF4 association.)

### (d) Slot15 (0x53471A) callers

Direct E8 callers image-wide: **ZERO**. 0x53471A exists only as a vtable dword, in **33 tables** (0xB012B4, 0xB01344, 0xB013CC, 0x51450… → 0xB026DC — slot15 of the whole 0xB01308..0xB02730 family). Since none of the 28 `call [reg+0x3C]` code sites is inside any scene-family body, no static evidence binds any of them to the scene-family receiver.

### Check 4 verdict

**AGREE with C-084's OPEN status** — no statically identifiable slot15 caller/receiver exists; 0x953AF4 is a phase dispatcher, not a camera producer. **New sharpening:** the per-tick's only static entry is the 33-table family slot12, either directly (32 tables) or via wrapper 0x5658BF (table 0xB01308 @0xB01338) which adds a 40-tick periodic action on [this+0x764] — one hop more structure than "frame-loop caller unidentified", but the family receiver itself remains vtable-bound, so G10's blocker (no per-frame camera-rect producer identified) stands.

---

## CHECK 5 — G17 opcode sources

### (a) Jar properties

`recvops.properties`: **148** entries; `sendops.properties`: **218** entries (matches the stated 148+218).

### (b) Join with `research/result/protocol-opcodes.csv` (442 rows = 178 recv + 264 send) by (direction, name)

| bucket | count |
|---|---|
| exact-match-from-properties (name present AND corpus opcode == properties value) | **365** |
| — of which explicit-0xFF placeholder value (corpus `0x00FF`) | 11 (6 recv: SERVERLIST_REREQUEST, AFTER_LOGIN, REGISTER_PIN, PLAYER_DC, VIEW_ALL_CHAR +1; 5 send: SEND_LINK, PIN_OPERATION, PIN_ASSIGNED, ALL_CHARLIST, CYGNUS_CHAR_CREATED) |
| value mismatch | **1** — `send DOJO_WARP_UP`: corpus `0x00D1`, but the jar line is literally `DOJO_WARP_UP = SHOW_ITEM_GAIN_INCHAT 1` (malformed properties line; adjacent `SHOW_ITEM_GAIN_INCHAT = 0xD0`). Corpus value unverifiable from this line — minor data defect worth flagging |
| names-absent-from-properties | **76** — **all 76 carry corpus opcode 0xFFFE** (0 inconsistent) |
| reverse gap (properties names missing from corpus) | 0 recv / 0 send |

365 + 1 + 76 = 442 ✓.

### (c) Enum constants (CFR 0.152 decompilation)

- `handling/RecvPacketOpcode.class` → **161** enum constants (PONG … MOONRABBIT_HP)
- `handling/SendPacketOpcode.class` → **241** enum constants (PING … BEANS_GAME1)

The enums exceed the properties files (161 vs 148; 241 vs 218) — the surplus constants (≥13 recv / ≥23 send) are value-less until `ExternalCodeTableGetter` loads the properties at runtime, which is consistent with G17/C-047's "numeric values live server-side" framing.

### (d) EXE switch head 0xA10CE3

```
00A10CE3  mov edx, dword ptr [ebp+8]
00A10CE6  lea eax, dword ptr [edx-0x20]
00A10CE9  cmp eax, 0x60
00A10CEC  ja 0xA11184                       ; default
00A10CF2  jmp dword ptr [eax*4+0xA111A1]    ; 97-entry jump table (opcode range 0x20..0x80)
```
- Jump table at 0xA111A1 (unaligned dword reads): 97 entries, 93 distinct targets; default 0xA11184 taken by **5** opcodes: **0x2E, 0x38, 0x39, 0x3D, 0x75** → **92 non-default case stubs**.
- Every stub is `push dword ptr [ebp+0xC]; call <handler>; jmp 0xA1119D` (common tail).
- Join with `task044-handler-map.csv` (97 rows, key `opcode`, expectation `handler_rva + 0x400000`):

```
total cases            : 97
default entries        : 5
non-default cases      : 92
match stub callee == handler_rva+0x400000 : 92 / 92   (mismatches: 0)
```

### Check 5 verdict

**AGREE.** All counts reproduce (148/218; 365 exact / 11 explicit-0xFF inside them / 76 absent-all-0xFFFE; 161/241 enum constants; 92/92 handler-map match). One defect found: the `DOJO_WARP_UP` properties line in the jar is corrupt, so that single corpus row (0x00D1) is not properties-derivable — the corpus's "loaded from properties" note for it should be corrected.

---

## Summary of differences found (precise)

1. **G08 (formula decomposition)** — the literal encoding is `−0x40000000 + 29990 + (2+(ctrl?5:0)) + 10*(3000L−g)` at 0x936409/0x93E82A/0x93E909/0x93EF0D (value-identical to the stated v83 29992/29997), `+3`-band at 0x70DDD7 ({29993, 29998}), flat-29992/29991 sites at 0x7A99D5/0x7A9A0E, flat-29991 life band at 0x693713, sentinel 0xC0041F14 at 0x693732/0x7A9A17, and **key−1** pushed at 0x93E87C/0x93E926/0x93EF2A. The hypothesis as stated is correct in value but not in constant decomposition, and it covers only the user-avatar band.
2. **G22/C-020 (family start ambiguity)** — both candidate starts are phantom: `0x5042E2C4` is a separate 4-slot-ish mini-holder table (installed at 0x50402A30 on pooled 0x10-byte nodes at [owner+0x384]); `0x5042E2CC` is never installed. The 6DC8C7CE container class primary is `0x5042E3F0` (76 slots); sibling class tables live beyond the intmap at 0x5042E568..0x5042E5A8 (ctor 0x50406B8B).
3. **G24 (slot45 semantics)** — now positively resolved at the instruction level (0x50409ECD → 0x50409EF4 → key store +0x38 via 0x5040694A, cmp/setle at 0x50409FA5-0x50409FAF, list comparator 0x50403A42). This supersedes the C-012-era "slot45 candidates zero-insert-semantics" negative result for THIS class (the C-012 census read slot45 from run-relative phantom bases, e.g. [0x5042E2CC+0xB4] = dword at 0x5042E380, which is the destructor-phase table start).
4. **G10** — new structural facts (0x5658BF wrapper @ vtable 0xB01338 slot12; 40-tick periodic on [this+0x764]; 0x953AF4 = phase switch {0x201,0x202,0x203,0x205}; no +0xF0..0xFC access in any of its callees) — consistent with, and sharpening, the C-084 bounded negative.
5. **G17** — `DOJO_WARP_UP = SHOW_ITEM_GAIN_INCHAT 1` malformed line in sendops.properties (jar); the one non-exact join row.

---

## FINAL VERDICT

**ACCEPT-WITH-CORRECTIONS**

Justification: every load-bearing claim I was asked to adversarially test reproduces from my own bytes — the 0x5040418C out-write chain (0x50405846→0x50406233→ctor 0x504067D7→QI {6DC8C7CE}→*arg15 at 0x504045CB), the candidate-exhaustion for slot25 (exactly two dword occurrences 0x5042D1B8/0x5042D288, both ctor-installed, no thunks), the EXE tile path at 0x666F5D–0x666F7D, the avatar key family (value-identical to the v83 formula at the user sites), the zmap/zmap_cn/smap counts, the camera-chain negatives (28 `call [reg+0x3C]`, zero direct slot15 callers, 0x953AF4 not a camera producer), and the full G17 join (365/11/76; 161/241; 92/92). The corrections are additive, not destructive: the G08 constant decomposition and its sibling bands (29983–29999, sentinel, key−1) must be recorded before freezing any implementation constant; the G22 alternative is a phantom-run artifact and should be closed by the ctor-installed primary 0x5042E3F0; and the slot45 body now provides the positive ordered-insert（闭环注：限定于节点主表 0x5042E3F0；C-012 笼统断言维持已撤销） semantics (key stored/compared, comparator 0x50403A42) that prior rounds could only bound negatively — the runtime dump predicted by G24 remains worthwhile as confirmation, but the static derivation is now complete down to the comparator instructions. The single G17 data defect (DOJO_WARP_UP) is a one-line corpus annotation fix.
