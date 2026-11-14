# T084 Independent Static-Forensics Reviewer Report

- **Reviewer role**: independent subagent; all disassembly produced from raw bytes with the reviewer's own scripts. No round-report text was used as an input to any verdict below; claim text was read only from `research\source-of-truth\claims.csv` and evidence rows only from `research\source-of-truth\evidence.csv`.
- **Date**: 2026-11-15
- **Scope**: newly-registered claims C-078..C-085, evidence EV-64..EV-73, plus audit task on C-068.

## Binary identity (computed by reviewer, not trusted)

| Artifact | SHA-256 (computed) | Expected | Verdict |
|---|---|---|---|
| `.work\task-036\game-image-unpacked.bin` (EXE image, linear model VA−0x400000) | `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` | same | MATCH — audit proceeded |
| `.work\task-001\extracted\冒险岛online\Gr2D_DX8.dll` | `ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1` | `ad67b9a0…` (ledger rows EV-05 et al.) | MATCH |

## Methods

Reviewer scripts (all in `C:\Users\lithd\AppData\Local\Temp\opencode\t084-reviewer\`):

| Script | Purpose |
|---|---|
| `dislib.py` | reviewer's own disassembly library: linear fileOffset=VA−0x400000 reads, capstone 5.x 32-bit windows, whole-image exhaustive `E8 rel32` caller scan, dword readers |
| `r5_dll.py` | manual PE section-table walk of Gr2D_DX8.dll (no pefile dependency; ImageBase 0x50400000 read from optional header = 0x50400000), RVA→file-offset, vtable dword reads, body disassembly |
| `r8_audit.py` | ledger audit: recomputed SHA-256 of every EV-64..EV-73 source file, claim↔evidence cross-reference resolution, C-068 marker check |

Key byte-level anchors cited below are quoted as `address: bytes` from the reviewer's own capstone output.

---

## R1 — C-078 (movement ctx fork at slot13) — **ACCEPT**

Independent disassembly of 0x9BCA6F..0x9BCC97, 0x9BCC9A..0x9BCCC1, 0x6B87D1..0x6B8800, 0x517DA8..0x517E2B, 0x51847B..0x5184CD.

- (a) **0x9BCA6F calls 0x6B8A18 with 7 stack args**: seven consecutive `push` (0x9BCAC0–0x9BCADE: `[ebp-8]`, `[ebx+0x148]`, `[ebp-4]`, `[ebp-0x28]`, `[ebp-0x20]`, `[ebp-0x18]`, `[ebp-0x10]`) then `lea ecx,[ebx+0x19c]; call 0x6b8a18` @0x9BCADF/0x9BCAE5. Sign of the 16-bit id at [ebp-4] tested twice: `xor edi,edi` @0x9BCBAC, `66 39 7d fc  cmp word ptr [ebp-4], di` @0x9BCBAE and again @0x9BCBD2, followed by `jle` @0x9BCBBA / `jge` @0x9BCBD6. ✔
- (b) **Positive path**: `movsx eax, word ptr [ebp-4]; mov ecx, dword ptr [0xbdd498]; push eax; call 0x517da8` @0x9BCBBC–0x9BCBC7. ✔
- (c) **Negative path**: `movsx eax, word ptr [ebp-4]; mov ecx,[0xbdd498]; f7d8 neg eax; push eax; call 0x9bcc9a` @0x9BCBD8–0x9BCBE5. ✔ Foothold ctx install `[M+0x130]=[fh+0x1C]`, `[M+0x134]=[fh+0x20]` @0x9BCC18–0x9BCC24; rope ctx install `[M+0x130]=[rope+0x18]`, `[M+0x134]=0` @0x9BCC7A–0x9BCC84 — exactly "(page,0)" given the R2 finding that rope+0x18 = page.
- (d) **0x9BCC9A**: `cmp eax,1; jb → return 0` (index≥1 required) @0x9BCC9E; `mov edx,[ecx+0xa8]` @0x9BCCA3; `add ecx,0xa8`; null-table check; `cmp eax,[edx-4]; jae → 0` (count at base−4) @0x9BCCB3; `imul eax,eax,0x1c` @0x9BCCB8. ✔
- **0x6B87D1 id derivation**: `mov eax,[ebp+0xc]; … je; mov edi,[eax+0x48]` (foothold, positive) @0x6B87DA–0x6B87E9; else `mov eax,[ebp+0x14]; … mov di, word ptr [eax]; neg di` @0x6B87EB–0x6B87F5; else `xor edi,edi` @0x6B87FA. ✔
- **0x517DA8**: `add ecx,0x90; call 0x51847b` @0x517DCF–0x517DD5 — the only container touch; no `+0xA8` reference anywhere in 0x517DA8..0x517E2B (nor in 0x51847B). 0x51847B = hash lookup: `div dword ptr [esi+8]` (bucket count at map+8) @0x518495, bucket heads at `[esi+4]` @0x51849D, node walk `cmp [esi+8],key` @0x5184A6 / `next=[esi+4]` @0x5184AB, value at node+0xC @0x5184C1. The 997 bucket count is write-side proven: field ctor `mov dword ptr [ecx+8], 0x3e5` @0xA54731 (map at `lea ecx,[esi+0x90]` @0xA54722). ✔
- Cross-check: slot13 dword = 0x9BCA6F at `[vt+0x34]` in **all 8** physics tables 0xB0C498/0xB0C660/0xB0C760/0xB0C870/0xB0C970/0xB0CA70/0xB0CB70/0xB0CC78 (reviewer dword walk). ✔
- Falsification criterion (rope reaching 0x517DA8 / foothold reaching 0x9BCC9A): **not observed** — the two consumers are strictly segregated by the jg/jge sign fork.

## R2 — C-079 (rope loader write-side + no-consumer census for rope+4) — **ACCEPT**

- Count head 0xA4EFCE..0xA4F09D: `call 0x409ffd` (count) @0xA4EFCE; `inc eax` (count+1) @0x4EFDA; `lea ecx,[esi+0xa8]; push; call 0xa51577` @0xA4EFDB–0xA4EFE5; `mov [ebp-0x10],eax` (count); `mov edi,1; cmp [ebp-0x10],edi; jl end` (1-based loop) @0xA4EFEA–0xA4EFF0; `mov [ebp-0x1c],0x1c` (stride) @0xA4EFF6.
- Allocator 0xA51577 (reviewer-verified): `imul eax,edi,0x1c; add eax,4` alloc @0xA51590; `add eax,4; mov [esi],eax` (base past header) @0xA515A1; `mov [eax-4],edi` (count header at −4) @0xA515A6. ✔
- Fill loop 0xA4F091..0xA4F2F4 — every record write anchored:

| Write | Address | Bytes/anchor | Property id immediate |
|---|---|---|---|
| `[rec+0] = edi` (1-based index) | 0xA4F0A6 | `89 3e` | — |
| `[rec+4] = bool` (neg/sbb/neg) | 0xA4F0D8–0xA4F0DE | `f7d8; 1bc0; f7d8; mov [esi+4],eax` | `push 0x832` @0xA4F0A0 |
| `[rec+8] = bool` (neg/sbb/neg) | 0xA4F13B–0xA4F141 | same pattern, `mov [esi+8],eax` | `push 0x833` @0xA4F105 |
| `[rec+0xC] = int` | 0xA4F199–0xA4F19E | `call 0x415344; mov [esi+0xc],eax` | `push 0x331` @0xA4F168 |
| `[rec+0x10] = int` | 0xA4F1F6–0xA4F1FB | `mov [esi+0x10],eax` | `push 0x830` @0xA4F1C5 |
| `[rec+0x14] = int` | 0xA4F253–0xA4F258 | `mov [esi+0x14],eax` | `push 0x831` @0xA4F222 |
| `[rec+0x18] = int` | 0xA4F2B0–0xA4F2B5 | `mov [esi+0x18],eax` | `push 0x627` @0xA4F27F |

  Loop tail `[ebp-0x1c] += 0x1c; inc edi; cmp edi,count; jle` @0xA4F2E6–0xA4F2EE. ✔ Full mapping {0:index, 4:l(0x832), 8:uf(0x833), 0xC:x(0x331), 0x10:y1(0x830), 0x14:y2(0x831), 0x18:page(0x627)} confirmed.
- **NO-CONSUMER census for rope+4** — reviewer disassembled all required windows *and extended them through the shared tails the given windows jump into* (0x9D47FA tail for grabs 1–3, 0x9D80C9/0x9D80D6 tails for grabs 4–6, wrapper continuation 0x9CC09F..0x9CC0B2), so the census is not truncated mid-basic-block. Rope-record field reads found:
  - 0xA4FC6F hit test: `[eax+0xC]` @0xA4FCCC, `[eax+0x10]` @0xA4FCE1, `[eax+0x14]` @0xA4FCD9 (+ table machinery `[ecx+0xA8]`, `[eax-4]`, stride 0x1C). No +4.
  - grab1 0x9D4473 (rec=ebx): `[ebx+0xC]` @0x9D44A4; tail passes ebx to `call [vt+0x14]` @0x9D47FA–0x9D4803. No +4.
  - grab2 0x9D45C3 (rec=ebx): `[ebx+0xC]` @0x9D45F4, `[ebx+0x14]` @0x9D4617; `jmp 0x9D47ED` into shared tail (no new field). No +4.
  - grab3 0x9D4739 (rec=ebx): `[ebx+0x10]` @0x9D4774; shared tail `[ebx+0x10]` @0x9D47AC/0x9D47E7, `[ebx+0xC]` @0x9D47D7. No +4.
  - grab4 0x9D7D4F (rec=edi): `[edi+0xC]` @0x9D7D80; tail @0x9D80D6. No +4.
  - grab5 0x9D7E9F (rec=edi): `[edi+0xC]` @0x9D7ED0, `[edi+0x14]` @0x9D7EF3; `jmp 0x9D80C9` tail. No +4.
  - grab6 0x9D8015 (rec=edi): `[edi+0x10]` @0x9D8050, `[edi+0xC]` @0x9D80B3, `[edi+0x10]` @0x9D8088/0x9D80C3; tail @0x9D80D6. No +4.
  - climb 0x9D80EC (rec=edi via 0x4B6ABE): `[edi+0x10]` @0x9D817F, `[edi+8]` @0x9D8193, `[edi+0x14]` @0x9D81DC, re-lookup `[eax+0x10]` @0x9D81B5. No +4. (Context: climb multiplier double at 0xB00D68 byte-read by reviewer = 3.0.)
  - wrapper 0x9CC077..0x9CC0B2: inline re-lookup (`cmp eax,1; jb`, `[ecx+0xA8]`, `[edx-4]`, `imul 0x1c`) then passes the record pointer to `call [edx+0x14]` @0x9CC0A8 — no field read off the record at all.
  - slot13 path 0x9BCA6F/0x9BCC9A: `[edi+0x18]` @0x9BCC7A only. No +4.
  **Result: zero reads of [rope+4] across the complete enumerated consumer set.** Falsification criterion not observed. ✔

## R3 — C-080 (foothold loader write-side) — **ACCEPT** (with an arg-numbering note against the task prompt; see D2)

- Writer 0xA4F4B6..0xA4F547 (`ret 0x28` @0xA4F547 — 10 stack dwords ✔). Observed stack-slot→offset mapping:
  - `[ebp+8]→[esi+0x48]` @0xA4F516–0xA4F519 (arg1 = id) ✔
  - `[ebp+0xC]→[esi+0xC]`, `[ebp+0x10]→[esi+0x10]`, `[ebp+0x14]→[esi+0x14]`, `[ebp+0x18]→[esi+0x18]` @0xA4F4DA–0xA4F4F3 (args 2–5 = x1,y1,x2,y2) ✔
  - `[ebp+0x1C]→[esi+0x1C]`, `[ebp+0x20]→[esi+0x20]` @0xA4F4F6–0xA4F4FF (args 6–7 = layer,platform) ✔
  - `[ebp+0x24]→[esi+0x4C]` @0xA4F51C–0xA4F51F and `[ebp+0x28]→[esi+0x50]` @0xA4F522–0xA4F52B (args 8–9 = links)
  - `[ebp+0x2C]→[esi+0x28]` with ref-count call @0xA4F502–0xA4F510: `mov eax,[ebp+0x2c]; test; mov [esi+0x28],eax; je; add eax,4; push eax; call dword ptr [0xafe1bc]` (arg10 = piece, refcounted)
  Link ids pinned by reviewer: `push 0x6c1` @0xA4E75C → `[ebp-0x10]` @0xA4E792 (→arg8→+0x4C); `push 0x6c2` @0xA4E7B9 → `edi` @0xA4E7EF (→arg9→+0x50). So 0x6C1→+0x4C, 0x6C2→+0x50 exactly as claimed. **Note D2**: in *stack-arg numbering* the piece (→+0x28, refcounted) is arg10 and links are args 8/9; the task prompt's "arg8→+0x28, arg9→+0x4C, arg10→+0x50" follows the claim's semantic enumeration order, not stack order. The C-080 ledger row itself uses no arg numbers → no ledger change required.
- Vtable stores: `mov dword ptr [esi], 0xafe3f0` @0xA4F4CC, then `mov dword ptr [esi], 0xb0dda4` @0xA4F52E. ✔ (store order 0xAFE3F0 → 0xB0DDA4)
- Derived fields 0xA4F54A..0xA4F5A2: dx=`[esi+0x14]-[esi+0xC]` @0xA4F553–0xA4F556, dy=`[esi+0x18]-[esi+0x10]` @0xA4F560–0xA4F563; squares+sum @0xA4F573–0xA4F57B; `call 0xa71204` (sqrt) @0xA4F584; `fst [esi+0x40]` (len) @0xA4F589; `fld dx; fdiv st(1); fstp [esi+0x30]` @0xA4F58D–0xA4F593; same for dy → `[esi+0x38]` @0xA4F596–0xA4F59B. ✔ sqrt(dx²+dy²)→+0x40, unit direction→+0x30/+0x38.
- Call site 0xA4E974..0xA4EA04: `push 0x58; mov ecx,0xbe1de0; call 0x402d66` (0x58-byte pool alloc) ✔; `call 0xa4f4b6` @0xA4E9AC ✔; `lea ecx,[esi+0x90]; call 0xa513f6` @0xA4E9DE/0xA4E9E4 ✔ (hash-map insert — body verified: `div [esi+8]` @0xA51435, node {next+4,key+8,value+0xC}, new node vtable 0xB0DDBC/0xB0DDB8); `lea ecx,[esi+0x44]; call 0xa4ffcd` @0xA4E9F0/0xA4E9FF ✔ (spatial insert with x1,y1,x2,y2,record args).
- Node-name parses via 0xA70518 — all three exist and share the shape "load name ptr; deref; push; `call 0xa70518`":
  - 0xA4E1CC `e8 47 23 02 00` (from `[ebp-0x34]`)
  - 0xA4E2F5 `e8 1e 22 02 00` (from `[ebp-0x7C]`)
  - 0xA4E425 `e8 ee 20 02 00` (from `[ebp-0x70]`)
  0xA70518 body wraps import `[0xAFE208]` then `call 0xa7039f` — the name→int conversion family. ✔
- Cross-consistency: rope ctx install in slot13 copies rope+0x18 (= page, prop 0x627 per R2) into M+0x130 with M+0x134=0, resolving the "rope ctx installs (page,0)" clause.

## R4 — C-081 (seat stand-up chain) — **ACCEPT-WITH-CORRECTIONS** (see D1)

- 0x965A09..0x965A8C (`ret 4` @0x965A8C): `lea edx,[esi+0x2944]; xor ecx,ecx; call 0x6131b9` @0x965A0D–0x965A15 — seat state 0 write via 0x6131B9(0, user+0x2944) ✔; result handle → `[esi+0x294C]` @0x965A24 ✔; chair RNG pair resets at user+0x2E90 (`call 0x416e36` @0x965A2A) and user+0x2E9C (`call 0x416e36` @0x965A53) ✔; decrypted id → `call 0x965a8f` @0x965A3D, result → `[esi+0xf04]` @0x965A4D ✔; conditional notify: `xor edi,edi; … cmp [esp+0xc],edi; jne skip` @0x965A58–0x965A72, then `mov ecx,[esi+0xf28]; lea eax,[ecx-0xc]; neg ecx; sbb ecx,ecx; push 0xb; and ecx,eax; call 0x53e95d` @0x965A74–0x965A85 — arg1==0 gate + M=[user+0xF28]−0xC + push 0xB ✔.
- 0x965A8F stance map: reviewer raw bytes `3d ed ed 2d 00` (cmp eax,0x2DEDED) @0x965A93 and `3d ef ed 2d 00` (cmp eax,0x2DEDEF) @0x965A9A bound the →1 range to **[0x2DEDED, 0x2DEDEF]** (0x2DED00+{ED,EE,EF}), **not** "0x2DED00-FF" as the claim text states (D1). All other entries verified exactly: 0x2DEE15→2 @0x965AA5, 0x2DEE19→3 @0x965AAC, 0x2DEE16→4 @0x965AB7, 0x2DEE1B→2 @0x965AC2 (shared target 0x965AC9), 0x2DEE2D→5 @0x965ACD.
- 0x6A0ADF..0x6A0B2C: encrypted-pair decrypt+checksum only — reads [arg1]/[arg1+4]; `call 0xa705fb` @0x6A0AF0; `xor esi,0xbaadf00d` @0x6A0AFB; `call 0xa700f4` @0x6A0B02; checksum `cmp eax,[ebp+0xc]; je ok; push 0xb12650; … call 0xa6fc9b` @0x6A0B0C–0x6A0B21; returns decrypted value. **No state writes** (only stack locals). "0x6A0ADF stand-up" hypothesis refutation stands. ✔
- Vtable: dword at 0xB0BD28+0x38 = 0x965A09 (slot14; reviewer dword read; slots 12–16 = 0x9670F1, 0x9671D3, 0x965A09, 0x948DE7, 0x96D05F). ✔
- Caller census: reviewer whole-image E8 rel32 scan — **exactly one** direct caller 0x9500A3, preceded by `push 1` @0x950095 (flag=1, notify suppressed) ✔. Falsification criterion (second direct caller with flag=0) not observed.

## R5 — C-082 (Gr2D slot25 candidate set) — **ACCEPT** (task-prompt address note D3)

Manual PE walk (ImageBase from optional header = 0x50400000; 6 sections; .text RVA 0x1000). DLL hash matches ledger (table above).

- `[0x5042D204 + 0x64]` = dword at **0x5042D268** = `0x50404E85` ✔. (Note D3: the review task quoted "0x5042D264", but 0x204+0x64=0x268; 0x5042D264 is slot24 and holds 0x50403F7E. The ledger claim/EV-72 say "outer slot25 = 0x50404E85", which is correct.)
- Body 0x50404E85..0x50404EA6: `mov eax,[esp+8]; test eax,eax; jne; mov eax,0x80004003` (E_POINTER guard) @0x50404E85–0x50404E92; `mov edx,[esp+4]; xor ecx,ecx; cmp [edx+0x78],ecx; setne cl; mov [eax],ecx` → **\*arg2 = ([this+0x78] != 0)** @0x50404E94–0x50404EA0; `xor eax,eax; ret 8` ✔.
- `[0x5042D140 + 0x64]` = dword at 0x5042D1A4 = `0x50403FBE` ✔; body `mov eax,[esp+4]; mov ecx,[esp+8]; mov [eax+0xcc],ecx; xor eax,eax; ret 8` — trivial setter ✔.
- Both candidates fail the C-053 out constraint as claimed (trivial setter never writes out; boolean out would fault the 0x666FAC `[[out]+8]` Release path).

## R6 — C-083 (map-transition handler) — **ACCEPT**

- 0x97EBC9..0x97EC5B (`ret 8` @0x97EC5B): `push 0x3048; mov ecx,0xbe1de0; call 0x402d66` (0x3048 pool alloc) @0x97EBFE–0x97EC08 ✔; `call 0x94fdb4` @0x97EC1F (with `push [eax]` where eax=[ebp+0xC]) ✔; `lea ecx,[esi+4]; call 0x980a8c` @0x97EC29/0x97EC2F ✔; `mov ecx,[esi+8]; call 0x9507f0` @0x97EC34/0x97EC37 ✔ — order alloc→load→attach→arrival-write exactly as claimed.
- Caller: byte at 0x533FF1 = `e8`, rel32 `d3 ab 44 00` → 0x533FF6+0x44ABD3 = **0x97EBC9** ✔; site lies inside function 0x533EA4 (SEH prologue `mov eax,0xa9aa4e; call 0xa6fc7c` @0x533EA4–0x533EA9; body runs through 0x533FF9). Reviewer exhaustive E8 scan over the whole EXE image: **sole** direct caller of 0x97EBC9 = 0x533FF1 ✔.
- Vtable: dword at 0xB01414 = 0x533EA4 (slot0) ✔.
- Collision dispatch 0x77E6F3: `mov eax,[esp+4]; sub eax,0x81; je 0x77e720; dec eax; je 0x77e712; dec eax; jne 0x77e72c` @0x77E6F3–0x77E702 — **three branches** (0x81→call 0x77E72F, 0x82→call 0x77FC9E, 0x83→call 0x77F209, else exit) ✔ — channel-context 0x81/0x82/0x83 as claimed.

## R7 — C-085 (stack-package bodies, negative comparator result) — **ACCEPT** (wording note D4)

- 0x43286E..0x432888: `and [esi],0; cmp [esp+8],0; je ret; push 0x80004003; call 0xa6ef01; mov eax,esi; pop esi; ret 4` — E_POINTER null-assert guard only; no data-vs-data comparison, no ordering. ✔
- 0x44484B and 0x429411: `mov eax,[esp+4]; mov eax,[eax]; test eax,eax; [esi]=eax; je; mov ecx,[eax]; push eax; call [ecx+4]` (attach + conditional AddRef). Reviewer byte compare — 25 bytes `8b4424048b0085c0568bf1890674068b0850ff51048bc65ec2…` **byte-identical** at both sites. ✔
- 0x43E3A6..0x43E46B: builds two VARIANTs (`push 0xbe7330; call 0x40318f` VT_ERROR-missing init @0x43E3BE–0x43E3C9; `call 0x4031b5`), E_POINTER guard on [0xBE2788], 8 pushes, **`call 0x427eb3` @0x43E409** ✔, then VARIANT cleanup (0x4029B7 ×2) and downstream pack (0x414A1D/0x411FE1). No ordering logic. ✔
- All comparisons present in the four bodies are against zero/registers-known-zero (E_POINTER, HRESULT, null guards); **no comparison of two data values and no ordering logic anywhere** — negative comparator result confirmed.

## R8 — Ledger audit — **ACCEPT** (with D1 correction demand and D4 wording suggestion)

- (a) **EV-64..EV-73**: all 10 source files exist under `research\result\stage-readiness\forensics\` and every `source_sha256` equals the reviewer-recomputed SHA-256 (10/10 match; script `r8_audit.py`).
- (b) **Cross-references**: C-078{EV-64,EV-65}, C-079{EV-66,EV-68}, C-080{EV-67,EV-64}, C-081{EV-69}, C-082{EV-72}, C-083{EV-70,EV-73}, C-084{EV-73,EV-70}, C-085{EV-71} — every forward ref resolves to an existing evidence id, and every EV-64..EV-73 `claim_id` back-ref (incl. EV-67→{C-080,C-078}, EV-68→{C-079,C-078}, EV-70/73→{C-083,C-084}) resolves to an existing claim. No dangling edges either direction.
- (c) **CLOSED-STATIC vs falsification criteria** (checked against the reviewer's own disassembly):
  - C-078 "rope reaching 0x517DA8 / foothold reaching 0x9BCC9A" — not observed (sign fork segregates strictly). ✔
  - C-079 "any reader of rope+4" — not observed in the full consumer set incl. shared tails. ✔
  - C-080 "another writer mapping a WZ foothold field differently" — not observed in the verified writer/insert chain (full-image writer census out of reviewer scope; no contradiction found). ✔
  - C-081 "second direct caller of 0x965A09 with flag=0" — exhaustive E8 scan shows sole caller 0x9500A3 with flag=1. ✔ (But the claim *text* carries D1 — a factual error in the stance-map range.)
  - C-082 "third static slot25 with put-with-object-out" — not observed among the verified cluster tables (full Gr2D census inherited from round, both named candidates re-verified). ✔
  - C-083 "another direct caller of 0x97EBC9 / static imm 0x81 binding" — sole E8 caller confirmed; the only `sub eax,0x81` dispatch found is the channel-context switch at 0x77E6F3. ✔
  - C-085 falsification wording is broader than the verified substance — see D4; the substantive negative (no comparator/ordering) holds.
- (d) **C-068 correction marker**: C-068 claim text contains "t084 label correction by C-080/EV-67: +0x1C/+0x20 = layer/platform (was 'x2/y2 hint source'); x2/y2 live at +0x14/+0x18" — **mentions C-080** ✔. Reviewer's R3 writer verification independently substantiates that correction (x2/y2 → +0x14/+0x18; layer/platform → +0x1C/+0x20).

---

## Discrepancy register

| # | Severity | Location | Finding | Required action |
|---|---|---|---|---|
| D1 | **Medium (claim-text factual error)** | C-081 row; code at 0x965A93/0x965A9A | Claim says stance map "0x2DED00-FF→1". Actual bytes `3d ed ed 2d 00` (cmp eax,0x2DEDED) and `3d ef ed 2d 00` (cmp eax,0x2DEDEF) bound the →1 range to **[0x2DEDED..0x2DEDEF]** = 0x2DED00+{ED,EE,EF} (3 values), not the 256-value page. All other stance entries (0x2DEE15/1B→2, 0x2DEE19→3, 0x2DEE16→4, 0x2DEE2D→5) verified exact. | Correct the range clause in C-081 (text-level; does not affect the claim's substance or its falsification criterion). |
| D2 | Low (task-prompt vs binary; ledger unaffected) | 0xA4F4B6 arg table; call site 0xA4E98B–0xA4E9AC | Physical stack order maps **arg8→+0x4C (prop 0x6C1), arg9→+0x50 (prop 0x6C2), arg10→+0x28 (piece, ref-counted)**. The review task's expected "arg8→+0x28, arg9→+0x4C, arg10→+0x50" reflects C-080's semantic enumeration order, not stack order. C-080 row itself uses semantic names only → no ledger correction needed. | None (recorded for precision). |
| D3 | Low (task-prompt arithmetic; ledger unaffected) | DLL 0x5042D204 cluster | 0x5042D204+0x64 = **0x5042D268** (slot25) = 0x50404E85 as claimed. The task-quoted address 0x5042D264 is slot24 = 0x50403F7E. EV-72/C-082 wording ("outer slot25=0x50404E85") is correct. | None. |
| D4 | Low (falsification wording) | C-085 falsification column | "any comparison instruction inside the four bodies (none)" is literally over-broad: zero-comparison guards exist (e.g. `cmp [esp+8],0` @0x432874; `cmp [0xbe2788],ebx` @0x43E3DC; HRESULT `cmp eax,ebx` @0x43E41B). No comparison **of two data values** / ordering logic exists — the claim substance is verified. | Suggest tightening the falsification text to "any data-vs-data comparison or ordering logic". |

No HIGH discrepancies found. No falsification criterion of any CLOSED-STATIC claim (C-078..C-085) was observed in the reviewer's disassembly.

## Verdict summary

| Task | Claim | Verdict |
|---|---|---|
| R1 | C-078 | **ACCEPT** |
| R2 | C-079 | **ACCEPT** |
| R3 | C-080 | **ACCEPT** (note D2, ledger unaffected) |
| R4 | C-081 | **ACCEPT-WITH-CORRECTIONS** (D1) |
| R5 | C-082 | **ACCEPT** (note D3, ledger unaffected) |
| R6 | C-083 | **ACCEPT** |
| R7 | C-085 | **ACCEPT** (wording note D4) |
| R8 | ledger audit | **ACCEPT** (10/10 hashes match; refs bidirectionally complete; C-068 marker present) |
