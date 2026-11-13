# CMS079 Blind Review — Checkpoint 1 (CP1)
## Independent static-forensics review of function 0x66A8D5 and its call sites

Reviewer: independent subagent (blind; no access to lead-agent working files under `Temp\opencode\t080*`).
Date: 2026-11-13. All addresses are VAs in the unpacked main-image memory dump.

---

## 1. Binaries and hashes (verified by me, PowerShell Get-FileHash)

| File | SHA-256 (verified) | Role |
|---|---|---|
| `.work\task-036\game-image-unpacked.bin` | `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` | unpacked EXE, LINEAR dump, fileOffset = VA − 0x400000 |
| `.work\task-001\extracted\冒险岛online\Gr2D_DX8.dll` | `ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1` | PE file, ImageBase 0x50400000, section-table mapping |

Anchor check performed: dump `[0xBE2788] = 0` and `[0xBE1FB0] = 0` (device not yet created at dump time) — consistent with an early-stage dump; all COM vtables are runtime-bound and NOT observable in this dump. Gr2D analysis below is therefore correlative only.

## 2. My harness (reproducible)

`C:\Users\lithd\AppData\Local\Temp\opencode\reviewer-t080\harness.py` (+ step1..step34 scripts):
Python 3.14 + capstone 5.0.7 + pefile 2024.8.26, written from scratch.
- `va2off(va) = va − 0x400000`; `read(va,n)`; `u32(va)`; linear `disas(start,end)` (address + raw bytes + mnemonic printed).
- `scan_rel32(target)`: full-image scan for `E8/E9 rel32` reaching target.
- `scan_dword_ptr(target)`: raw dword occurrences of a VA (function-pointer tables).
- Gr2D side: pefile section walk, pointer-run vtable detector (≥16/≥48 consecutive code pointers), thunk-aware.

## 3. Caller inventory (Q: "identify ANY OTHER call sites")

- `scan_rel32(0x66A8D5)` over the whole image → exactly **three** `E8` sites: `0x667EB1`, `0x66A40E`, `0x66A80B`. No `E9` jumps.
- `scan_dword_ptr(0x66A8D5)` → **zero** raw-dword references (no pointer table / no indirect calls).
- Conclusion (DIRECT-INSTRUCTION): the caller set is exactly {0x667EB1, 0x66A40E, 0x66A80B}. No hidden signature-variant callers exist in this image.

## 4. Function extent and calling convention of 0x66A8D5 (Q1)

```
0066A8D5  b86ef7aa00    mov eax, 0xaaf76e
0066A8DA  e89d534000    call 0xa6fc7c          ; MSVC __EH_prolog (verified: push -1/push eax/push fs:0/set fs:0/ebp=esp+0xC/ret-into-body)
0066A8DF  81ecd8010000  sub esp, 0x1d8          ; 0x1D8 locals
0066A8E5  53            push ebx
0066A8E6  56            push esi
0066A8E7  57            push edi
0066A8E8  894dc0        mov [ebp-0x40], ecx     ; this ← ECX (thiscall)
0066A8EB  8b5938        mov ebx, [ecx+0x38]     ; ebx = this->+0x38 sub-object (used by Obj-style fallback)
```
Epilogue:
```
0066B478  8d4df0        lea ecx,[ebp-0x10]
0066B47B  e851a8daff    call 0x415cd1          ; dtor temp
0066B480  8d4d08        lea ecx,[ebp+8]
0066B483  e863a8daff    call 0x415ceb          ; Release(arg1 COM ptr)
0066B488  834dfcff      or dword [ebp-4], -1   ; SEH state off
0066B48C  8d4d24        lea ecx,[ebp+0x24]
0066B48F  e84b5f0000    call 0x6713df          ; dtor of the 8-byte arg8/9 object (guard-lock)
0066B494  8b4df4        mov ecx,[ebp-0xc]
0066B497  5f            pop edi
0066B498  5e            pop esi
0066B499  64890d00000000 mov fs:[0], ecx       ; unwind SEH
0066B4A0  5b            pop ebx
0066B4A1  c9            leave
0066B4A2  c22400        ret 0x24               ; ← CONFIRMED: callee cleanup of 0x24 bytes = 9 dword stack args
0066B4A5  ...                                  ; next function starts here (0x66B4A5, verified separate prologue)
```
- Extent: **0x66A8D5 … 0x66B4A4** (instruction bytes end 0x66B4A4); 0x66B4A5 is a new function. The historical "ret 0x24 at 0x66B4A2" is **CONFIRMED**.
- Convention: **thiscall with 9 stack args, callee cleanup** (`ret 0x24`), `this` in ECX saved to `[ebp-0x40]`; EBP frame + SEH (`__EH_prolog`); EBX/ESI/EDI saved; `this+0x38` cached in EBX for the whole function.
- Return value: **EAX is not deliberately set** on the normal path (last value is whatever `0x6713df` leaves). Treat as `void`. (DIRECT-INSTRUCTION)
- Stack args (callee names used throughout): `a1=[ebp+8]` COM node/layer smart ptr, `a2=[ebp+0xC]` mode, `a3=[ebp+0x10]` cx-step, `a4=[ebp+0x14]` cy-step, `a5=[ebp+0x18]` alpha (`a`, 0xFF=skip), `a6=[ebp+0x1C]` ani flag, `a7=[ebp+0x20]` parent-select flag, `a8=[ebp+0x24]`+`a9=[ebp+0x28]` = one 8-byte by-value guard-lock object `{dword0(uninitialized), handle}` (ctor `0x548460` uses only `[+4]`; dtor `0x6713DF` frees via `0x548567` iff `[+4]!=0`).

## 5. Parameter maps at the three call sites (Q2)

Push lists reconstructed byte-by-byte (last push = lowest address = a1). All three sites call with ECX = the same manager `this` (loader `[ebp-0x48]`; Obj-loader `[ebp-0x38]`; the class that owns `+0x50` list, `+0x38` sub-object, `+0xEC` count).

### Site A — normal-background branch, call at `0x66A40E` (`0x66A3D7–0x66A40E`)
```
0066A3D7  8b45a0        mov eax,[ebp-0x60]      ; parent-container handle (see §9)
0066A3DA  51            push ecx                ; a9 slot
0066A3DB  51            push ecx                ; a8 slot
0066A3DC  8bcc          mov ecx,esp
0066A3DE  896508        mov [ebp+8],esp         ; EH temp tracking
0066A3E1  894104        mov [ecx+4],eax         ; a9 = [ebp-0x60]  (handle of guard-lock obj)
0066A3E4  e877e0edff    call 0x548460           ; ctor of {a8,a9} (uses [ecx+4] only)
0066A3E9  56            push esi                ; esi = 0 (xor esi,esi @0x66A3B0) → a7 = 0
0066A3EA  ff758c        push [ebp-0x7C]         ; a6 = prop id 0x549 ("ani")
0066A3ED  8d45f0        lea eax,[ebp-0x10]
0066A3F0  ff755c        push [ebp-0x5C]         ; a5 = prop id 0x54A ("a")
0066A3F3  ffb57cffffff  push [ebp-0x84]         ; a4 = prop id 0x548 ("cy")
0066A3F9  ff7580        push [ebp-0x80]         ; a3 = prop id 0x547 ("cx")
0066A3FC  ff7598        push [ebp-0x68]         ; a2 = prop id 0x1581 ("type") RAW bType
0066A3FF  51            push ecx                ; a1 slot
0066A400  8bcc          mov ecx,esp
0066A402  896508        mov [ebp+8],esp
0066A405  50            push eax                ; &[ebp-0x10]
0066A406  e873a6daff    call 0x414a7e           ; a1 = AddRef-copy of COM ptr in [ebp-0x10]
0066A40B  8b4db8        mov ecx,[ebp-0x48]      ; this
0066A40E  e8c2040000    call 0x66a8d5
```
| slot | value | origin |
|---|---|---|
| a1 | COM ptr copy | loader `[ebp-0x10]` = object created at `0x669BE1` via `0x427EB3`(dev v+0x64), assigned `0x429919` (`0x669BEB`) — the per-item **layer COM object** |
| a2 | `type` property (id 0x1581) raw | read `0x6696B5→0x6696E3` |
| a3 | `cx` (id 0x547) | `0x66970A→0x669738` |
| a4 | `cy` (id 0x548) | `0x66975F→0x66978D` |
| a5 | `a` (id 0x54A) | `0x6697BC→0x6697E9` |
| a6 | `ani` (id 0x549) | `0x669813→0x669846` |
| a7 | 0 | immediate (push esi, esi=0) |
| a8 | **uninitialized** dword | ctor 0x548460 never writes [ecx] |
| a9 | `[ebp-0x60]` | parent-container handle from map-lookup out-struct (see §9) |

Guard: `0x66A3CE cmp [ebp-0x68],esi(0); 0x66A3D1 je 0x66A45E` — **bType==0 never calls 0x66A8D5** (historical claim confirmed). Reached only when bType ∉ {4,5,6,7} and ≠ 0 → effective a2 ∈ {1,2,3} (8+ raw possible in theory, not in v079 data).

### Site B — scroll-background branch, call at `0x66A80B` (`0x66A7B4–0x66A80B`)
```
0066A7B4  8b4598        mov eax,[ebp-0x68]      ; bType
0066A7B9  83f804        cmp eax,4 ; je → esi=1
0066A7BE  83f805        cmp eax,5 ; je → esi=2
0066A7C3  7e10          jle …(esi stays 0)
0066A7C5  83f807        cmp eax,7 ; jg → esi=0
0066A7CA  6a03          push 3    ; type 6|7 → esi=3
0066A7D4  5e            pop esi
0066A7D5  8b45a0        mov eax,[ebp-0x60]      ; a9 handle
0066A7D8  51            push ecx                ; a9
0066A7D9  51            push ecx                ; a8
0066A7DA  8bcc / 896508 mov ecx,esp / [ebp+8],esp
0066A7DF  894104        mov [ecx+4],eax         ; a9 = [ebp-0x60]
0066A7E2  e879dcedff    call 0x548460
0066A7E7  6a00          push 0                  ; a7 = 0
0066A7E9  ff758c        push [ebp-0x7C]         ; a6 = ani
0066A7EC  8d45f0        lea eax,[ebp-0x10]
0066A7EF  ff755c        push [ebp-0x5C]         ; a5 = a
0066A7F2  ffb57cffffff  push [ebp-0x84]         ; a4 = cy
0066A7F8  ff7580        push [ebp-0x80]         ; a3 = cx
0066A7FB  56            push esi                ; a2 = mode (1/2/3, see dispatch)
0066A7FC  51            push ecx                ; a1 slot
0066A7FD  8bcc / 896508
0066A802  50            push eax
0066A803  e876a2daff    call 0x414a7e           ; a1 = [ebp-0x10]
0066A808  8b4db8        mov ecx,[ebp-0x48]
0066A80B  e8c5000000    call 0x66a8d5
```
Same table as site A except **a2 = normalized mode: bType 4→1, 5→2, 6|7→3** (bType 0–3/>7 → 0, but unreachable: entry to this branch requires bType ∈ {4,5,6,7} per `0x66A293–0x66A2CA`).

### Site C — Obj loader, call at `0x667EB1` (`0x667E83–0x667EB1`) in function `0x66735F`
```
00667E83  51            push ecx          ; a9 slot
00667E84  51            push ecx          ; a8 slot
00667E85  8bc4          mov eax,esp
00667E87  896508        mov [ebp+8],esp
00667E8A  6a01          push 1            ; a7 = 1
00667E8C  897804        mov [eax+4],edi   ; a9 = edi = 0
00667E8F  ff75a8        push [ebp-0x58]   ; a6 = out-value of query 0x66885B (by-ref, see below)
00667E92  8d45f0        lea eax,[ebp-0x10]
00667E95  68ff000000    push 0xff         ; a5 = 0xFF (immediate → alpha skip in callee)
00667E9A  ff75a0        push [ebp-0x60]   ; a4 = prop id 0x548 ("cy")
00667E9D  ff75e8        push [ebp-0x18]   ; a3 = prop id 0x547 ("cx")
00667EA0  ff7598        push [ebp-0x68]   ; a2 = prop id 0xBF0 ("flow") RAW
00667EA3  51            push ecx          ; a1 slot
00667EA4  8bcc / 896508
00667EA9  50            push eax
00667EAA  e8cfcbdaff    call 0x414a7e     ; a1 = [ebp-0x10] (node from query 0x66885B, filled at 0x667D28)
00667EAF  8bce          mov ecx,esi       ; esi = [ebp-0x38] = this
00667EB1  e81f2a0000    call 0x66a8d5
```
| slot | value | origin |
|---|---|---|
| a1 | COM ptr copy | Obj-loader `[ebp-0x10]` = out of `0x66885B` at `0x667D28` (node query built from `0x429411`-copy of `[ebp-0x28]`) |
| a2 | `flow` property (id 0xBF0) raw | read `0x667842–0x667876`; call skipped if 0 (`0x667E7E je 0x667EB6`) |
| a3 | `cx` (id 0x547) | `0x667897→0x6678CB` (same string-cache id as bg loader → same property name) |
| a4 | `cy` (id 0x548) | `0x6678EC→0x669920` |
| a5 | 0xFF | immediate |
| a6 | `[ebp-0x58]` | passed **by pointer** into `0x66885B` (`0x667CEA`) → out-value of the node query (semantics UNVERIFIED) |
| a7 | 1 | immediate |
| a8 | **uninitialized** dword | never written at this site |
| a9 | 0 | `mov [eax+4],edi`, edi=0 |

Cross-loader consistency (DERIVED-FROM-INSTRUCTION): string-cache ids 0x547/0x548 feed a3/a4 in BOTH loaders; ids 0x545/0x549/0x54A/0x1581/0x331/0x332 match the historical names (rx 1349=0x545, ry 1350=0x546, ani 1353=0x549, a 1354=0x54A, type 5505=0x1581, x 817=0x331, y 818=0x332). The id→name mapping itself is runtime string-cache; names marked historical-corroborated.

## 6. Mode dispatch inside 0x66A8D5 (Q3)

```
0066AA13  8b450c        mov eax,[ebp+0xc]     ; a2 = mode
0066AA16  6a01          push 1
0066AA18  5b            pop ebx               ; ebx = 1
0066AA19  23c3          and eax,ebx           ; bit0
0066AA1B  8945c8        mov [ebp-0x38],eax    ; H-flag
0066AA1E  7433          je 0x66aa53           ; bit0==0 → span_x = 0 (xor ebx,ebx @0x66AA53)
...
0066AA55  8b450c        mov eax,[ebp+0xc]
0066AA58  83e002        and eax,2             ; bit1
0066AA5E  8945cc        mov [ebp-0x34],eax    ; V-flag
0066AA61  743a          je 0x66aa9d           ; bit1==0 → span_y = 0
```
Later use of the flags (loop-bounds / rect defaults):
```
0066B0AA  395dcc        cmp [ebp-0x34],ebx    ; V
0066B0B3  8b45b8        mov eax,[ebp-0x48]    ; span_y+cy ; else [ebp-0x18]=0xFFFF
0066B0C2  395dc8        cmp [ebp-0x38],ebx    ; H
0066B0C7  8b45d8        mov eax,[ebp-0x28]    ; span_x+cx ; else [ebp-0x3C]=0xFFFF
0066B0D6  395dcc        cmp [ebp-0x34],ebx    ; V → [ebp-0x20] = -cy − floor(span_y/2), else 0xFFFF8001
0066B0F8  395dc8        cmp [ebp-0x38],ebx    ; H → [ebp-0x14] = -cx − floor(span_x/2), else 0xFFFF8001
```
- bit0 ⇒ horizontal tiling axis (x), bit1 ⇒ vertical axis (y); both bits ⇒ both axes (two nested do-while loops).
- **mode==0 at runtime is prevented at ALL THREE call sites** (A: bType==0 jumps away `0x66A3D1`; B: only 1/2/3; C: flow==0 jumps away `0x667E81`). The callee nevertheless handles mode 0 defensively: spans 0 → each loop still executes exactly once for positive steps, rect defaults 0xFFFF/0xFFFF8001 are used (single, non-tiled copy). (DIRECT-INSTRUCTION for the guards; DERIVED for the mode-0 behavior.)
- Slot reuse note: `[ebp+0xC]` (mode slot) is REUSED as the vertical divisor at `0x66AA65/0x66AA6E` (`div [ebp+0xC]` @ `0x66AA95`) and later as the OUT pointer for layer creation (`lea eax,[ebp+0xc]; push eax` @ `0x66AB1A`) — mode is dead by then. Bits are read before any reuse (bit0 @0x66AA19, bit1 @0x66AA58).

## 7. Zero-step fallbacks (Q4) — instruction-by-instruction

Horizontal (edi = a3, "cx"):
```
0066A970  8b7d10        mov edi,[ebp+0x10]
0066A973  85ff          test edi,edi
0066A978  7545          jne 0x66a9bf          ; nonzero → keep
0066A97A  397d20        cmp [ebp+0x20],edi(0) ; a7
0066A97D  7408          je 0x66a987           ; a7==0 → vtable-slot path
0066A97F  8b7b2c        mov edi,[ebx+0x2c]    ; a7!=0 (Obj path): [this+0x38]+0x2C
0066A982  2b7b24        sub edi,[ebx+0x24]    ; − [this+0x38]+0x24
0066A985  eb35          jmp 0x66a9bc
0066A987  (null checks a1, item0)
0066A99F  8b4df0        mov ecx,[ebp-0x10]    ; item0 = a1->v+0x100(ZVariant(int 0)) via 0x426F74 @0x66A927
0066A9A2  e8fe0a0000    call 0x66b4a5         ; → item0->v+0x58  (shift count n)
0066A9A7  6a01 / 5f     edi = 1
0066A9AE  d3e2          shl edx,cl            ; edx = 1<<n
0066A9B0  8b4d08        mov ecx,[ebp+8]       ; a1 (the layer COM object)
0066A9B3  2bfa          sub edi,edx           ; edi = 1 − (1<<n)
0066A9B5  e87e53ddff    call 0x43fd38         ; → a1->v+0xB8
0066A9BA  03f8          add edi,eax           ; cx = a1.slot_0xB8 + 1 − (1 << item0.slot_0x58)
0066A9BC  894d10        mov [ebp+0x10],edi
```
Vertical (esi = a4, "cy"): identical shape at `0x66A9BF–0x66AA10`:
```
0066A9CB  mov esi,[ebx+0x30]; sub esi,[ebx+0x28]        ; Obj path: [this+0x38]+0x30 − +0x28
0066A9F6  call 0x66b4a5                                      ; item0->v+0x58 (SAME helper, item0 again)
0066AA09  call 0x43fd62                                      ; a1->v+0xC0
0066AA0E  add esi,eax                                        ; cy = a1.slot_0xC0 + 1 − (1 << item0.slot_0x58)
```
Verified helper slots (each: `mov eax,[esi]` → `call [eax+slot]` with (this,&out), out returned in EAX):
- `0x43FD38` → **v+0xB8**; `0x43FD62` → **v+0xC0**; `0x66B4A5` → **v+0x58**; `0x426F74` → **v+0x100** (16-byte ZVariant key by value); `0x43B92C` → **v+0x1C** (count); `0x4100A1` → **v+0x6C** (x0), `0x4100C8` → **v+0x74** (y0).
- Historical formulas CONFIRMED exactly:
  - a7==0 (both bg sites): `step = a1.v[+0xB8] + 1 − (1 << child.v[+0x58])` (H) and `… v[+0xC0] …` (V), child = item index 0 fetched via **v+0x100** with ZVariant(int,3) key. ✓
  - a7!=0 (Obj site): `step_H = [this+0x38].d[+0x2C] − d[+0x24]`, `step_V = d[+0x30] − d[+0x28]`. ✓
- Note (subtle, correct in historical): if the REPLACED step is still 0, the span divisor becomes 1 but the final `imul` by step keeps span 0 (see §8) — i.e. not "step→1".

## 8. Span computation (Q5)

Horizontal (bit0 set; edi=step_x, ebx=divisor):
```
0066AA20  85ff          test edi,edi
0066AA22  7402          je 0x66aa26
0066AA24  8bdf          mov ebx,edi           ; divisor = step, else stays 1 (ebx=1 @0x66AA16-18)
0066AA26  833d8827be00 00  cmp [0xbe2788],0   ; device must exist (E_INVALIDARG fail @0x66AA2F)
0066AA39  8b0d8827be00  mov ecx,[0xbe2788]
0066AA3F  e8b20a0000    call 0x66b4f6         ; → device v+0x2C with (this,&out); EAX = view width
0066AA44  33d2          xor edx,edx
0066AA46  8d4478fe      lea eax,[eax+edi*2-2] ; view + 2*step − 2
0066AA4A  f7f3          div ebx               ; UNSIGNED divide by (step ? step : 1)
0066AA4C  8bd8          mov ebx,eax
0066AA4E  0fafdf        imul ebx,edi          ; span_x = ((view + 2*step − 2)/divisor) * step
0066AA53  33db          xor ebx,ebx           ; (bit0 clear → span_x = 0)
0066AA5B  895dbc        mov [ebp-0x44],ebx    ; save span_x
```
Vertical (bit1 set; esi=step_y):
```
0066AA65  c7450c01000000 mov [ebp+0xc],1      ; divisor slot (reused mode arg) = 1
0066AA6E  89750c        mov [ebp+0xc],esi     ; if step≠0 → divisor = step
0066AA84  8b0d8827be00  mov ecx,[0xbe2788]
0066AA8A  e88e0a0000    call 0x66b51d         ; → device v+0x30 ; EAX = view height
0066AA8F  8d4470fe      lea eax,[eax+esi*2-2]
0066AA93  33d2          xor edx,edx
0066AA95  f7750c        div [ebp+0xc]
0066AA98  0fafc6        imul eax,esi          ; span_y = ((view + 2*step − 2)/divisor) * step
0066AA9D  33c0          xor eax,eax           ; (bit1 clear → span_y = 0)
0066AAA3  8945d0        mov [ebp-0x30],eax    ; save span_y
```
CONFIRMED (DIRECT-INSTRUCTION): `view = [0xBE2788].v[+0x2C]` (V: `+0x30`); `divisor = step ? step : 1`; `span = ((view + 2*step − 2) / divisor) * step`; division is unsigned (`xor edx,edx; div`). The "+2*step−2" is `lea eax,[eax+reg*2-2]`.
Caveat (agrees with historical): whether v+0x2C/+0x30 semantically are "width/height" cannot be proven from this image (bodies are runtime COM); dump predates device creation ([0xBE2788]==0).

Loop bounds and increments (do-while):
```
0066AAA6  03c6        add eax,esi        ; y_end = span_y + cy
0066AAAA  8945b8      mov [ebp-0x48],eax
0066AAAD  0f8ec50900  jle 0x66b478       ; y_end<=0 → done
0066AAB3  03df        add ebx,edi        ; x_end = span_x + cx
0066AAB5  895dd8      mov [ebp-0x28],ebx
0066AAB8  8365dc00    and [ebp-0x24],0  ; x = 0
0066AABC  83fdd800    cmp [ebp-0x28],0
0066AAC0  0f8ea00900  jle 0x66b466       ; x_end<=0 → skip inner body
          …body…
0066B454  8b45dc      mov eax,[ebp-0x24]
0066B457  034510      add eax,[ebp+0x10]  ; x += cx
0066B45A  3b45d8      cmp eax,[ebp-0x28]  ; x < x_end ?
0066B45D  8945dc      mov [ebp-0x24],eax
0066B460  0f8c60f6ff  jl 0x66aac6         ; inner loop
0066B466  8b45d4      mov eax,[ebp-0x2c]
0066B469  034514      add eax,[ebp+0x14]  ; y += cy
0066B46C  3b45b8      cmp eax,[ebp-0x48]  ; y < y_end ?
0066B46F  8945d4      mov [ebp-0x2c],eax
0066B472  0f8c40f6ff  jl 0x66aab8         ; outer loop
```
→ per axis: iterations = span/step + 1 (x = 0, cx, …, span).

## 9. What the function DOES with the span (Q6) — loop body object writes

Per (x,y) tile (body `0x66AAC6–0x66B454`):
1. `0x427EB3(dev=[0xBE2788], &out=[ebp+0xC], 0,0,0,0,0, ZVariant(int 0,3), ZVarNull(0xBE7330))` at `0x66AB1E` — creates a fresh layer COM object (wraps `dev->v[+0x64]`; `0x427EB3` is `ret 0x20`, passes (this,a2..a6,*a7 16bv,*a8 16bv,&out-slot) to the virtual call and stores the result through a1). This OVERWRITES the mode slot `[ebp+0xC]`.
2. For i = 0 … `0x43B92C(a1)` (count via v+0x1C) − 1: fetch item i by `0x426F74(a1, ZVariant(i,3))` (v+0x100), read three int properties per item (chains `0x414A49→0x404BA3→0x40263B→0x403AC7→0x415344`), clamp two of them by `(0xFF − a5)` when `a5 != 0xFF` (`0x66AD87–0x66ADA6`: `mov eax,0xff; cmp [ebp+0x18],eax; je skip; sub eax,[ebp+0x18]; … sub ebx/eax; clamp 0`), build three ZVariants and call **`0x427DE0(created_layer, ret-temp, item_node, v3, v2, v1, nullVar, nullVar)`** at `0x66AE45` — per-item sprite add. If `this->[+0xEC] > 0`: `item->v[+0x5C](item, this->[0xEC])` at `0x66AD72`.
3. Draw at offset: `0x43FD8C(layer_wrapper,&out)` (v+0xC8 resolve) → obj; **`obj->v[+0x90](this, ZVarNull, ZVarNull, x−x0, y−y0)`** at `0x66B044` where `x0 = item0->v[+0x6C]`, `y0 = item0->v[+0x74]` (read once pre-loop at `0x66A955/0x66A96B`; x,y = loop counters `[ebp-0x24]/[ebp-0x2C]`). **Historical "+0x90 receivers" confirmed; there is NO +0x98 call inside 0x66A8D5** (the +0x98 calls are in the loader — §10).
4. `0x4371B1(dev,&out)` (v+0x5C) → obj2; **`obj2->v[+0x9C](this, 16-byte struct from 0x411FE1(devObj,1), left, top, right, bottom)`** at `0x66B1A6` where left/top = `-step − floor(span/2)` or 0xFFFF8001, right/bottom = `span+step` or 0xFFFF — a clip/culling rect set.
5. **`layer->v[+0xFC](this, 16-byte struct from 0x411FE1(a1,1))`** at `0x66B23B` — attach the WZ/layer node a1.
6. **`layer->v[+0xE0](this, −1)`** at `0x66B285`.
7. Tail inter-object sync: `0x66B4CC(a1raw)` (v+0xF0) → X; `0x4D63AD(layer, X)` (v+0xF4); `0x4423C0(a1raw)` (v+0xD4) → Y; `0x4566A7(layer, Y)` (v+0xD8) (addresses `0x66B36E–0x66B2C1` region, exact calls at `0x66B378/0x66B388`... see dump `0x66B36E–0x66B3A9`).
8. Parent attach (`0x66B38D–0x66B443`):
   - a7≠0 (site C): `0x671234(&this->+0x50, &layer)` — the manager's own list (via `0x4B6B0C` inside 0x671234).
   - a7=0, a6≠0 (ani): `0x427E6D(inner, 0x20, strA, strB)` — wraps **v+0x110** (`0x66B3B6–0x66B3F0`) — then STILL falls to `0x671234(a9, &layer)`.
   - a7=0, a6=0: directly `0x671234(a9, &layer)` — a9 = the parent container handle (bg sites: loader `[ebp-0x60]`).
   - `0x671234` = `push esi; call 0x4B6B0C(this); push [arg]; call 0x429919` — list-head resolve + AddRef-assign. `ret 4`.
9. Destroy slot (`0x415CEB` = COM Release on `[ebp+0xC]`), inner/outer loop increments (§8).
10. Function return: EAX undefined (see §4).

## 10. The +0x98 / +0x90 calls in the loader 0x669397 (Q7)

`origin`/`cam` = `[[0x4371B1([0xBE2788])]` — i.e. `dev->v[+0x5C]` output, dereferenced once (`mov esi,[eax]`).

**0x66A3AA** (normal branch, bType 0–3):
```
0066A378  8b0d8827be00 mov ecx,[0xbe2788]
0066A37E  8d4508       lea eax,[ebp+8]
0066A381  50           push eax
0066A382  e82acedcff   call 0x4371b1        ; v+0x5C → eax
0066A38B  8b30         mov esi,[eax]        ; origin
0066A399  ff7590       push [ebp-0x70]      ; ry (id 0x546)   [5th arg]
0066A39F  ff7594       push [ebp-0x6c]      ; rx (id 0x545)   [4th arg]
0066A3A4  6a64         push 0x64            ; 100
0066A3A6  6a64         push 0x64            ; 100
0066A3A8  56           push esi             ; origin
0066A3A9  57           push edi             ; this = layer [ebp-0x14]
0066A3AA  ff9098000000 call [eax+0x98]
```
→ `v+0x98(layer, origin, 100, 100, rx, ry)` — **historical claim CONFIRMED**.

**0x66A729** (H-flag set ⇒ bType 4/6):
```
0066A715  8b4d90       mov ecx,[ebp-0x70]   ; ry
0066A71D  83c164       add ecx,0x64         ; ry+100
0066A720  51           push ecx             ; [5th]
0066A721  6a00         push 0               ; [4th] = 0
0066A723  6a64 / 6a64  push 100, 100
0066A727  56           push esi (origin)
0066A728  57           push edi (layer)
0066A729  ff9098000000 call [eax+0x98]
```
→ `v+0x98(layer, origin, 100, 100, 0, ry+100)` — **historical "type4/6 → (0, ry+100)" CONFIRMED** (branch selected by `[ebp+8]`(H-flag)≠0 at `0x66A6DA`).

**0x66A792** (H-flag clear ⇒ bType 5/7):
```
0066A77E  8b4d94       mov ecx,[ebp-0x6c]   ; rx
0066A786  6a00         push 0               ; [5th] = 0
0066A788  83c164       add ecx,0x64         ; rx+100
0066A78B  51           push ecx             ; [4th]
0066A78C  6a64 / 6a64  push 100, 100
0066A790  56 / 57      push origin, layer
0066A792  ff9098000000 call [eax+0x98]
```
→ `v+0x98(layer, origin, 100, 100, rx+100, 0)` — **historical "type5/7 → (rx+100, 0)" CONFIRMED**.

Also in the loader (scroll branch), two `v+0x90` draws feeding the tile call:
- `0x66A5F2`: `v+0x90(layer, strVar(0xBE7330-null), strVar(0xBE7330-null), ±100+[ebp-0x78](x), ±100+[ebp-0x74](y))` — the ±100 offsets are computed at `0x66A538–0x66A58F` via `neg/sbb/and 0x64` (flag→−100, flipped to +100 when rate>0; both zeroed when rate==0).
- `0x66A692`: `v+0x90(layer, ZVariant([ebp-0x78]=x,3), ZVariant([ebp-0x74]=y,3), ZVariant(sum,3), ZVariant(0x10000000,3))` — built at `0x66A63A–0x66A64B`.

## 11. Scroll branch step computation (Q8)

```
0066A529  837d0800     cmp [ebp+8],0          ; H-flag
0066A52D  8b7594       mov esi,[ebp-0x6c]     ; rx (0x545) if H
0066A530  7503         jne 0x66a535
0066A532  8b7590       mov esi,[ebp-0x70]     ; ry (0x546) if !H
0066A535  8b5d08       mov ebx,[ebp+8]        ; H-flag
0066A538  8b45cc       mov eax,[ebp-0x34]     ; V-flag
0066A53B  f7db / 1bdb / 83e364  neg/sbb/and 0x64   ; ebx = H ? −100 : 0
0066A542  f7d8 / 1bc0 / 83e064                 ; eax = V ? −100 : 0 → [ebp-0x18]
0066A54E  8bfe         mov edi,esi
0066A550  7f02         jg 0x66a554
0066A552  f7df         neg edi                ; edi = |rate|
0066A554  (layer null check)
0066A564  8b4dec       mov ecx,[ebp-0x14]     ; layer
0066A567  e8f0cbdcff   call 0x43715c          ; eax = layer->v[+0x58]  (verified wrapper)
0066A56C  8bc8         mov ecx,eax
0066A56E  b8204e0000   mov eax,0x4e20         ; 20000
0066A573  99           cdq
0066A574  f7ff         idiv edi               ; SIGNED divide by |rate|
0066A576  03c8         add ecx,eax            ; sum = slot58 + 20000/|rate|
0066A57A  894de4       mov [ebp-0x1c],ecx
0066A578  85f6         test esi,esi
0066A57D  7e0c         jle 0x66a58b           ; rate<=0 → keep −100 / 0
0066A57F–0x66A589      rate>0 → negate both ±100 values (+100)
0066A58B/0x66A58D      rate==0 → both offsets = 0
```
- `0x43715C` verified: thiscall wrapper, `call [vtable+0x58]` with (this,&out), returns out as EAX, plain `ret` — **historical claim CONFIRMED** ("reads layer vtable +0x58 and returns it as the function result"). Object = `[ebp-0x14]` (the layer created at `0x669998` via `0x447891`).
- `step = 20000/|rate|` with `0x4E20` and `cdq; idiv` — **CONFIRMED** (note: idiv, i.e. SIGNED — matches since |rate| ≥ 0).
- The sum is used at `0x66A64B` → `ZVariant(sum,3)` → 5th arg region of the `v+0x90` draw at `0x66A692` (a scroll-position selector for the sprite), NOT added to cx/cy of the 0x66A8D5 call (site B passes raw cx/cy properties).

## 12. Gr2D side (correlative only)

- Gr2D exports only `DllCanUnloadNow`/`DllGetClassObject`; the EXE dump's import directory is destroyed (only a leftover kernel32/GetLocalTime descriptor) and `[0xBE2788]=0`, `[0xBE1FB0]=0` at dump time ⇒ **no runtime vtable binding observable**. Any claim naming the concrete Gr2D functions behind v+0x2C/+0x30/+0x58/+0x5C/+0x64/+0x90/+0x98/+0x9C/+0xC8/+0xD4/+0xD8/+0xE0/+0xF0/+0xF4/+0xFC/+0x110 is UNVERIFIABLE from these two files.
- Static vtable candidates in Gr2D (`0x5042D140` 40 entries, `0x5042D204` 47 entries — the only tables in the `0x50403xxx/0x50404xxx` family) fit the *layer-ish* profile: e.g. `0x5042D204+0x58 = 0x50403EFC` returns `[this+0x28]` (int getter), `+0x5C = 0x50403F19` returns `[this+0x370]*100/128`. The device-ish tables `0x504366D0/0x504367B8` contain debug-thunk/real pairs (`0x50411A05` thunk → real `0x50411A12`, a float 2×2-transform getter consistent with a transformed view-size getter at +0x2C). I could NOT bind which table the runtime [0xBE2788] object uses. INFERENCE, low confidence.

## 13. Counter-evidence hunt (Q9)

1. **Hidden register args?** No. All three sites pass exactly 9 dword slots (verified push-by-push); the callee reads only [ebp+8]..[ebp+0x28]; `ret 0x24` balances. EAX/ESI/EDI before the calls carry only temp-construction data (a1 copy, ±100 flags), never extra parameters.
2. **Stack misalignment?** None: at each site, pushes since last stack-consuming call = 9 dwords + callee-cleanup ⇒ esp restored by `ret 0x24`. The `0x414A7E`(`ret 4`) and `0x548460`(`ret`) helpers balance their own args.
3. **Mode > 3?** Site A passes bType raw ⇒ values ≥ 8 would still be bit-tested (`and 1` / `and 2`); WZ v079 data has 0–7 only (historical counts). Site C passes `flow` raw — any int is accepted, only bits 0/1 matter. No instruction constrains a2 to 0–3.
4. **Other callers?** E8/E9 scan + dword scan: none besides the three sites (§3).
5. **arg8 is uninitialized at ALL sites** (`0x548460` writes nothing at [ecx]; site C writes only [eax+4]=0). The guard-lock class only ever reads +4 ⇒ benign, but it means the historical "two extra pointer slots" are (a8=garbage, a9=handle). If any code ever reads a8 it would see garbage — none does (verified: only 0x6713DF touches the pair, at +4).
6. **Would arg9=0 crash?** At bg sites a9 = loader `[ebp-0x60]`. My first pass found only a zeroing write (`0x66994B mov [ebp-0x60],ebx`, ebx=0) ⇒ apparent NULL-deref contradiction (`0x4B6B0C` reads `[this+0x10]`). RESOLVED: `[ebp-0x60]` is the second dword of the 8-byte out-struct at `[ebp-0x64]` filled by the map lookup `0x671B59` (`lea ecx,[edi+0xD0]`, `0x66996B`), i.e. a valid per-index parent container; the compiler addresses its `+4` member directly. (DIRECT-DATA for the zeroing + use; DERIVED for the 0x671B59 out-struct interpretation — the function's tail allocates nodes `{vt=0xB04BA0,…}` from pool `[0xBE7A1C]`.)
7. **Division by zero**: guarded — H divisor = `step?step:1` (ebx), V divisor = same via `[ebp+0xC]`; `idiv edi` (scroll) would fault for rate==0, but the loader path at `0x66A54E–0x66A552` does not guard rate==0 before `idiv` — **rate==0 in a scroll background (bType 4–7 with rx/ry==0) would divide by zero at 0x66A574** (`idiv edi` with edi=0). Historical report does not mention this. The `rate==0 → offsets 0` handling at `0x66A58B` is AFTER the idiv ⇒ unreachable. Potential crash path / data-dependent (WZ scroll backgrounds presumably always have nonzero rx/ry). NEW FINDING (DIRECT-INSTRUCTION).
8. **`[ebp+8]` slot reuse in the loader**: the loader's arg1 slot becomes the H-flag (`0x66A29E/0x66A2A3`) and then an EH-temp tracker at the call sites (`mov [ebp+8],esp`) — harmless but explains odd-looking `mov [ebp+8],eax` at `0x669956`.
9. **0x66A18F path** (`mov ecx,[ebp-0x60]` as `this` for `0x4B6B0C`) is guarded by property 0x53A of the frame node (`0x66A03B–0x66A093`) and a `v+0xF4([ebp-0x10],1)` result check — data-dependent; consistent with (6).

## 14. Agreement / disagreement with historical MAP-BACKGROUND-REVERSE.md

Confirmed by my independent derivation (bytes agree):
- ret 0x24 @0x66B4A2, 9 stack args, thiscall. ✓
- Parameter identity a1..a7 at all sites; mode normalization at site B (4→1, 5→2, 6|7→3); bType==0 skip at 0x66A3CE/0x66A3D1; `[ebp+8]` reused as H-flag. ✓
- Zero-step fallback formulas (slots +0xB8/+0xC0, `1<<child.slot_0x58`, child via v+0x100 item 0; Obj `[this+0x38]` field diffs). ✓
- Span formula incl. unsigned div, `divisor = step?step:1`, "span stays 0 if replaced step is 0". ✓
- View slots +0x2C/+0x30 via 0x66B4F6/0x66B51D; 0x43715C reads v+0x58 and returns it. ✓
- Scroll: rate = rx|ry by H-flag; step = 20000/|rate| (0x4E20, cdq/idiv); sum = layer.slot_0x58 + step. ✓
- All three v+0x98 argument lists (this, origin, 100, 100, …) incl. type4/6 vs type5/7 variants and origin from dev v+0x5C via 0x4371B1. ✓
- Property-id↔name mapping (x=817/0x331, y=818/0x332, rx=0x545, ry=0x546, type=0x1581, cx=0x547, cy=0x548, ani=0x549, a=0x54A) — consistent with my id derivation; names themselves are runtime string-cache, not in bytes near the calls (historical-corroborated).

Refinements / additions beyond the historical report (my findings):
- a8/a9 identified: one 8-byte by-value guard-lock object {uninit dword0, handle}; ctor 0x548460 (alloc via [0xAFE1BC]), dtor 0x6713DF (free via 0x548567 iff +4≠0); a9 doubles as the parent container for `0x671234` when a7==0. The historical report left these as "two pointer slots, not cx/cy".
- a9 at bg sites = loader `[ebp-0x60]` = `+4` member of the `[ebp-0x64]` out-struct of `0x671B59` (0x66996B) — per-index parent container, NOT always-null (apparent contradiction resolved).
- The a7==0 && a6==0 path always ends in `0x671234(a9, &layer)` — including after the ani (0x427E6D/v+0x110) path; the attach is not exclusive.
- Inside 0x66A8D5 the per-item draw is **v+0x90** (with x−x0, y−y0, both null-variants); there is **no +0x98 call inside 0x66A8D5** (the +0x98 trio lives in the loader only). The report's phrasing could be read otherwise; bytes are unambiguous.
- Latent `idiv-by-zero` at 0x66A574 when a scroll background has rate==0 (see §13.7) — not in the historical report.
- 0x66A8D5 returns nothing meaningful (EAX undefined); historical silent — worth stating.
- x0/y0 origin: item "0" of a1 read pre-loop via v+0x6C/+0x74 (0x4100A1/0x4100C8) — the draw offset is (x_loop − x0, y_loop − y0); not spelled out historically.

Disagreements: none at instruction level. The historical report's caution that slot +0x2C/+0x30 semantics ("视口宽高") are not provable from this image is reiterated and strengthened ([0xBE2788]==0 in this dump).

## 15. Open questions

1. Runtime vtable binding of `[0xBE2788]` and of the created layer objects (needs a later-stage dump or runtime hook) — all v-slot *semantics* (view size, "slot_0x58" units, v+0x90 draw meaning) remain named-by-slot only.
2. Property-name resolution for string-cache ids (0xBF0 "flow"?, 0x53A, 0x1550/0x1551/0x1552/0x155D, 0x31D, 0x100/0x1550-variants in the per-item chains) — the string pool is filled at runtime; names not present in bytes.
3. `[ebp-0x58]` (site-C a6) semantics: out-value of the 0x66885B node query; unit/meaning unknown (it is only forwarded as a6).
4. Whether the 0x66A574 idiv can actually fire with rate==0 in shipped WZ data (recommend WZ-data audit of bType 4–7 items with rx/ry==0).
5. Gr2D class names for vtables 0x5042D140/0x5042D204/0x504366D0/0x504367B8 (only two exports; PDB absent).

## 16. Confidence labels (per major finding)

| Finding | Label |
|---|---|
| Caller set = 3 E8 sites, no pointer refs | DIRECT-INSTRUCTION |
| ret 0x24 / 9 args / thiscall / SEH EBP frame / extent 0x66A8D5–0x66B4A4 | DIRECT-INSTRUCTION |
| Epilogue releases a1 (0x415CEB) and destroys a8/a9 (0x6713DF) | DIRECT-INSTRUCTION |
| Push-by-push arg maps at 0x66A40E / 0x66A80B / 0x667EB1 | DIRECT-INSTRUCTION |
| a1 origin (loader: 0x427EB3 product; obj: 0x66885B out) | DIRECT-INSTRUCTION |
| Property-id → slot mapping (0x547/0x548/0x54A/0x549/0x1581/0x545/0x546/0x331/0x332/0xBF0) | DIRECT-INSTRUCTION (ids) / historical-corroborated (names) |
| Mode dispatch bit0/bit1, guards excluding mode 0 at all sites | DIRECT-INSTRUCTION |
| Mode-0 callee behavior (single iteration, default rect) | DERIVED-FROM-INSTRUCTION |
| Zero-step fallbacks (slots +0xB8/+0xC0, 1<<child.v+0x58, [this+0x38] diffs) | DIRECT-INSTRUCTION |
| Span formula, unsigned div, divisor selection, loop bounds | DIRECT-INSTRUCTION |
| Loop body: 0x427EB3 create, per-item 0x427DE0, v+0x90 draw at (x−x0,y−y0), v+0x9C rect, v+0xFC attach, v+0xE0(−1), v+0xF0/F4/D4/D8 sync, 0x671234 parent attach | DIRECT-INSTRUCTION |
| a8/a9 = 8-byte guard-lock {uninit, handle}; a9 = parent when a7==0 | DIRECT-INSTRUCTION (mechanics) / DERIVED (purpose) |
| [ebp-0x60] = +4 of [ebp-0x64] out-struct from 0x671B59 | DERIVED-FROM-INSTRUCTION |
| Scroll: rate sel, 20000/|rate| cdq+idiv, sum=v+0x58+step, sum→ZVariant→v+0x90 | DIRECT-INSTRUCTION |
| v+0x98 arg lists incl. ±100 variants and origin=dev v+0x5C | DIRECT-INSTRUCTION |
| idiv-by-zero hazard at 0x66A574 for rate==0 | DIRECT-INSTRUCTION (hazard), INFERENCE (reachability) |
| Gr2D vtable identities / slot semantics | UNVERIFIED (correlative) |
| EAX return value undefined | DIRECT-INSTRUCTION |
