# T085 Independent Blind Review

Reviewer: independent subagent (blind pass — no T085-* main-agent report was read).
Date: 2026-11-15. Repo at git `16e8bd5b5c70d22a32948613ac6c598ebfe09e50` (clean, no commit made).

## Method

### Binaries and SHA-256 verification (certutil, before any analysis)

```
SHA256 of .work/task-036/game-image-unpacked.bin:
  d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718   (matches expected)
SHA256 of .work/task-001/extracted/冒险岛online/Gr2D_DX8.dll:
  ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1   (matches expected)
```

Only the EXE was disassembled (Gr2D not needed for T1–T4).

### Image model (independently re-derived, not assumed)

- The dump is a flat linear memory image: `fileOffset = VA - 0x400000`, size 0x9DC000 bytes.
- PE header parsed from the dump itself: 7 sections; first executable section (unnamed,
  chars 0x60000020) has VA 0x1000, VirtualSize 0x7E9000 → **code VA range 0x401000–0xBEA000**
  (vtables live inside this range too; e.g. 0xB0BD28 < 0xBEA000).
- Raw section rawsize/vsiz in the header reflect the original packed file and were ignored.

### Scripts (all written fresh for this review; none copied from t085_*/main-agent code)

Scratch dir: `C:\Users\lithd\AppData\Local\Temp\opencode\t085-reviewer\`

| script | purpose |
|---|---|
| `revtool.py` | SHA-pinned image loader; `window` (linear disasm), `func` (recursive-descent walk → basic blocks/extent/ret-N/calls), `find`, `vtable`, `imm`, `sweep` (full .text linear sweep with bad-byte resync; 2,672,037 instructions, 23,881 bad bytes) |
| `xref.py` | E8/E9 rel32 caller census + whole-image dword scan (`slots`) for vtable-slot membership |
| `t2_bytes.py`, `t2_ctx.py` | exhaustive byte census of every `FF /2` `call [r/m+0x38]` encoding (mod01/mod02, reg and SIB forms) + per-hit context dump |
| `t4_imm.py` | single-pass immediate census (0x5A / 0x1E) over the resyncing sweep, control-transfer targets excluded |

Raw evidence dumps (referenced below, all in scratch dir):
`t1_9BE703_map.txt` (block map/call table), `t1_9BE703_full.txt` (883-line full disasm),
`t2_hits.txt`, `t2_ctx.txt`, `t3_9C5B8A_map.txt`, `t3_9C5B8A_full.txt`, `t3_9C5B8A_part2.txt`,
`t3_9CCAA8_map.txt`, `t3_9CCAA8_full.txt`, `t3_9BF1FA_map.txt`, `t3_9C3D46_map.txt`,
`t4_imm.txt`, `sweep.txt`.

Helper functions identified during T1 (each disassembled and confirmed):
- `0x548806(lo_ptr, checksum)` — **decrypt** of an encrypted 0x18-byte record `{payload lo+0, payload hi+4, key1+8, key2+0xC, checksum+0x10}`; 2-iteration XOR chain seeded `0xBAADF00D`, per-dword transforms `0xA705FB(5,k)` / `0xA700F4(5,x)`, final chain compared against the checksum arg → double returned on FPU stack.
- `0x6131F4(this=record_base, double)` — **encrypt** inverse; draws fresh random keys from the global RNG object at `0xBDF028` (`0x416E71` family), returns the new checksum dword which callers store at `record+0x10`.
- `0xA70F94` = `_ftol` (fldcw chop, fistp qword); `0xA70B13` = `abs(int)`; `0xA718D0` = 64×64 signed multiply (`__allmul`-style); `0xA70BAD` = `rand`.

---

## T1 — 0x9BE703 physics loop (slot4)

### Extent, prologue/epilogue, calling convention

- **Extent: 0x9BE703 – 0x9BF13F** (recursive descent, 883 instructions, 160 basic blocks; full map in `t1_9BE703_map.txt`). The last instruction is `jmp 0x9BF07E` at 0x9BF13F; the next function begins at **0x9BF144** (`push ebp` prologue of the neighbor-transfer validator) — the gap contains no padding bytes, functions are adjacent.
- Prologue `0x9BE703`: `mov eax, 0xAF2CAF; call 0xA6FC7C` (MSVC SEH frame thunk), `sub esp, 0xA8`, `push ebx/esi/edi`; `esi=[ebp+8]` (arg1), `ebx=[ebp+0xC]` (arg2), `edi=ecx` (**this = M**), `[ebp-0x10]=M`.
- **Single epilogue at 0x9BEDF2–0x9BEE00** shared by all exits: SEH unwind (`mov ecx,[ebp-0xC]; mov fs:[0],ecx`), `leave`, **`ret 0xC`** → callee pops 3 stack args. Signature: `int __thiscall M::PhysicsLoop(movrec* arg1, int* budget arg2, int flag arg3)` — arg3 is only consumed at 0x9BEEAD (`cmp dword ptr [ebp+0x10], 0`).
- 883 instructions / one ret — verified there are no other `ret`s reachable.

### Entry sequence and the swept-box query 0x5114AA

1. `0x9BF7EA(M, *budget)` → `[ebp-0x64] = step` (int). I disassembled 0x9BF7EA separately: it decrypts M.X1/M.Y1 (M+0x20/M+0x38 records) and the record's X1/Y1, and **clamps X against `[M+0x138]` and `[M+0x140]`** re-encrypting the clamped value (`fild [ebx+0x138]`/`[ebx+0x140]`, encrypt via 0x6131F4) — the map clamp bounds.
2. Five decrypt-round-ftol chains compute rounded ints of record X1/Y1 and M X1/Y1. The rounding idiom is:
   `fcom qword [0xAFECC0]` (vs 0.0) → `fadd [0xAFEC20]` / `fsub [0xB00D60]` (±0.5) → `call 0xA70F94` (ftol) — i.e. **round-half-away applied to decrypted coordinates**. Results: `[ebp-0x20]=rec.x1`, `[ebp-0x14]=rec.y1`, `[ebp-0x2C]=M.x1`, `[ebp-0x28]=M.y1`.
3. `dx = M.x1-rec.x1 → [ebp-0x5C]`, `dy = M.y1-rec.y1 → [ebp-0x9C]`; if `dx==0 && dy==0` (0x9BE81C/0x9BE820) → **exit E1**: `*budget -= step`, `M` vtable slot6 `(step)` at 0x9BE82C, return 0 (via `jmp 0x9BEDF2`, skipping the not-yet-built container).
4. **Query construction (0x9BE836–0x9BE888)**: local container at `[ebp-0xB4]` initialized with cookie `0xB00D88`; then
   `push &container; push M.y1; push M.x1; push rec.y1; push rec.x1; ecx = [[0xBDD498]]+0x44; call 0x5114AA`
   → thiscall on **field+0x44** with args `(x1, y1, x2, y2, out)` — the swept-box foothold-space query. Push order verified: last push `[ebp-0x20]` = rec.x1 is arg1.
5. Result iteration: the loop at 0x9BE8A0–0x9BE9xx walks a MSVC `std::_Tree` iterator (node `_Val` at +4; the `neg/sbb/and` climb at 0x9BE8A2–0x9BE8BC is `_Treeinc`). Candidates are **foothold records**; reads observed: `+0xC/+0x10` (n1/n2), `+0x14/+0x18` (x2/y2), `+0x20` (platform), `+0x1C` (layer), `+0x30/+0x38` (unit dir doubles), `+0x40` (len), `+0x4C/+0x50` (prev/next links) — matches the T082-era layout.

### Candidate acceptance gates (in loop order)

- `[M+0x120] != 0 && [M+0x120] != candidate` → reject (0x9BE8BE/0x9BE8CD).
- `[M+0x120] == candidate`: decrypt M.Y2 (M+0x68 rec) > 0 → set falling-flag `[ebp-0x74]=1` (0x9BE8D3–0x9BE8F0).
- `dir1 = [cand+0x30] > 0.0` → accept (0x9BE8FA `ja`).
- else `[cand+0x20] == [field+0x40]` (platform == a field-level default) → accept (0x9BE905–0x9BE911).
- else `[cand+0x20] == [M+0x134]` (platform match) → accept (0x9BE913).
- else: **state-object gate**: `ecx=[M+0x14]` (state object), `call [state_vt+0]` (slot0 = state-id getter) → id==7 (`sub 7; neg; sbb; inc` idiom) then `[ [M+0x114] +0x1C ] == [cand+0x1C]` (layer equality via the auxiliary ctx at M+0x114) → accept, else reject (0x9BE91B–0x9BE947).
- Accepted candidate: segment cross-product tests (0x9BE94D–0x9BEA0D) decide whether the swept start/end lie on opposite sides; on-segment cases trigger **neighbor transfer validation** `0x9BF144(prev, cur, x1, y1)` (called 0x9BEA5D / 0x9BEA8C with `([ebp-0x2C],[ebp-0x28])` = rounded M coords) using the `+0x4C/+0x50` links; winners stored as from/to records `[ebp-0x50]/[ebp-0x44]`.
- 64-bit crossing parameter via `0xA718D0` (allmul) of cross products → t as double `[ebp-0x80]` (0x9BEAAA–0x9BEB80), interpolated crossing coordinate `[ebp-0x58]`, orientation tie-break swaps from/to (0x9BEBB3–0x9BEC14).

### Movement application and exits

- If no from/to pair: `0x9BEC17` end-of-loop check `[ebp-0x48]` (iterator) → iterate; after loop, `[ebp-0x24]==0 || [ebp-0x30]==0` → **E-path** 0x9BF086.
- Ratio `[ebp-0x4C] = [ebp-0x70]/[ebp-0x34]` (accumulated crossing numerator/denominator, seeded 2/1).
- Interpolation against the movement record's own encrypted X2/Y2 (arg1+0x30/+0x48 records) and M's X2/Y2 (M+0x50/M+0x68) and the **M+0xF8 record** (Z param) — heavy FPU; writes:
  - **Z record M+0xF8/M+0x108** via `0x6131F4` at 0x9BED96 and 0x9BEDBA (with `[M+0x118]==chosen_ctx` gate at 0x9BEDA1);
  - records M+0x50 (X2), M+0x68 (Y2), M+0x20 (X1), M+0x38 (Y1) via 0x6131F4 at 0x9BEF0D/0x9BEF23/0x9BEF8E/0x9BEFF8 (all `mov [ebx+0x10/0x28/0x40/0x58], eax` with ebx=M+0x20 → checksums at M+0x30/0x48/0x60/0x78);
  - **`0x9BC992(recblock, ctx)`** (disassembled: projects params onto ctx line — `out1 = decrypt(a.rec1)*ctx.dir1 + ctx.n1` etc., writes 3 encrypted records) called at 0x9BF006/0x9BF06B with `ecx=M+0x20` and at 0x9BF127 with `ecx=M+0x20`;
  - **M+0xE0 record** written at 0x9BEE53/0x9BEE98/0x9BF0C3–0x9BF124.
- **Exit paths (all reach the shared epilogue):**
  - **E1** 0x9BE831: no displacement → budget-=step, slot6(step), `eax=0`.
  - **E2** 0x9BE895→0x9BEDC8: query produced no candidate (`[ebp-0xA8]==0`) → budget-=step, slot6(step), destroy container (`0x511E2B` with cookie 0xB00D88), `eax=0`.
  - **E3** 0x9BEDC2/0x9BEDC8: all candidates rejected / no from-to pair and falling-flag==0 → same as E2, `eax=0`.
  - **E4** 0x9BF086→0x9BF08F–0x9BF13D (falling-flag `[ebp-0x74]!=0`): reads `[M+0x120]`'s dir/n1, rewrites M+0xE0 record twice, `0x9BC992(M+0x20, [M+0x120])`, then **slot5 `[eax+0x14] ([M+0x120], 0, step)`**, budget-=step (0x9BF13A), `eax=1`.
  - **E5** 0x9BEEAD (arg3==0): apply movement, **slot6 `[eax+0x18] ([ebp-0x34]=final step)`**, `eax=1`.
  - **E6** 0x9BF018–0x9BF07B (arg3!=0): apply movement, `0x9BC992`, then **slot5 `(edi=chosen_ctx, 0, step)`** at 0x9BF07B, `eax=1` (slot6 not called on this path — slot5 supersedes).

### Indirect calls and their object families

| site | instruction | receiver | family / target |
|---|---|---|---|
| 0x9BE82C | `call [edx+0x18]` | edx=`[M]`, ecx=M, arg=step | M per-state physics vtable **slot6** = 0x9BC404 (7/8 tables; 0x9D3DE6 in table#7) |
| 0x9BE920 | `call [eax]` | eax=`[ [M+0x14] ]` | **state object [M+0x14] vtable slot0** (state-id getter; compared with 7) |
| 0x9BEDD2 | `call [edx+0x18]` | edx=`[M]` | M physics slot6 (step consume/notify) |
| 0x9BF013 | `call [eax+0x18]` | eax=`[M]` | M physics slot6 |
| 0x9BF07B | `call [eax+0x14]` | eax=`[M]`, args (ctx,0,step) | M physics **slot5 = SetStandingContext 0x9BFB52** (0x9D3CCA in table#7) |
| 0x9BF137 | `call [eax+0x14]` | eax=`[M]`, args ([M+0x120],0,step) | M physics slot5 |

No user-vtable or field-vtable indirect calls occur inside the loop (field is used only as data: `[0xBDD498]+0x44` receiver of 0x5114AA and `+0x40` compare).

### M field read/write table (this function only)

| field | access | where / notes |
|---|---|---|
| +0x14 | R | 0x9BE91B state object → vtable slot0 (state id, ==7 gate) |
| +0x18 | — | not touched here (slot4's own family table) |
| +0x20/+0x30 (X1 rec) | R (decrypt 0x9BE78F), W checksum M+0x30 (0x9BEF8E) | current X |
| +0x38/+0x48 (Y1 rec) | R (0x9BE7BE), W checksum M+0x48 (0x9BEFF8) | current Y |
| +0x50/+0x60 (X2 rec) | R (0x9BEC6A), W checksum M+0x60 (0x9BEF0D) | other X |
| +0x68/+0x78 (Y2 rec) | R (0x9BEC55), W checksum M+0x78 (0x9BEF23) | other Y (falling test uses it) |
| +0xE0 rec & +0xF8/+0x108 rec | R/W | Z/param records; encrypted via 0x6131F4 |
| **+0x110** | **NOT accessed** | standing ctx is *not* read by slot4 — only aux slots below |
| +0x114 | R (0x9BE933) | aux ctx; +0x1C (layer) compared with candidate layer |
| +0x118 | R (0x9BEDA1) | if == chosen ctx → extra Z recompute |
| +0x120 | R (0x9BE8BE, 0x9BEA16, 0x9BF095) | "stay-on" ctx; equality gates + E4 target of slot5 |
| +0x130/+0x134 | R +0x134 only (0x9BE913) | platform compare vs candidate +0x20 |
| +0x138/+0x140 | R (inside 0x9BF7EA, called at entry) | X clamp bounds |
| +0x148/+0x14C/+0x16C/+0x19C | not accessed here | (0x9BF027 reads **[M+0x150]** via `fild`) |
| coordinates/velocity | see record rows | all encrypted pairs; velocity delta implied via record arithmetic |

- **Water/swim: none.** No branch in 0x9BE703 references a water/swim flag; the only field-level data gates are `field+0x40` and `field+0x44` (space) and clamp bounds via 0x9BF7EA.
- **Rope context: no rope-record (+0/+4/+8/+0xC/+0x10/+0x14/+0x18) reads.** The candidates are foothold records exclusively; rope handling must live in the slot3 variants (see T3).

### Independent vtable census of the 8 physics tables (dword-verified)

| table | slot3 (+0xC) | slot4 (+0x10) | slot5 (+0x14) | slot6 (+0x18) |
|---|---|---|---|---|
| 0xB0C498 #1 | 0x9BF1FA | 0x9BE703 | 0x9BFB52 | 0x9BC404 |
| 0xB0C660 #2 | 0x9BF1FA | 0x9BE703 | 0x9BFB52 | 0x9BC404 |
| 0xB0C760 #3 | **0x9C5B8A** | **0x9C6028** | 0x9BFB52 | 0x9BC404 |
| 0xB0C870 #4 | 0x9BF1FA | 0x9BE703 | 0x9BFB52 | 0x9BC404 |
| 0xB0C970 #5 | **0x9CCAA8** | 0x9BE703 | 0x9BFB52 | 0x9BC404 |
| 0xB0CA70 #6 | 0x9BF1FA | **0x9D06D4** | 0x9BFB52 | 0x9BC404 |
| 0xB0CB70 #7 | 0x9BF1FA | 0x9BE703 | **0x9D3CCA** | **0x9D3DE6** |
| 0xB0CC78 #8 | 0x9BF1FA | 0x9BE703 | 0x9BFB52 | 0x9BC404 |

**Independent correction to the task premise:** slot4 = 0x9BE703 in only **6 of 8** tables; table #3 (0xB0C760) installs 0x9C6028 and table #6 (0xB0CA70) installs 0x9D06D4 as slot4. Additional finds: slot12 (+0x30)=0x9BCA59 and slot13 (+0x34)=0x9BCA6F on all checked tables; slot9 (+0x24) of table #3 = 0x9C3D1D (see T4); slot14 (+0x38) = 0x9BCCFA (7/8) or 0x9C4946 (#3).

---

## T2 — census of `call [reg+0x38]` (potential user slot14 stand-up)

### Census method and totals

Exhaustive byte census of all `FF /2` encodings with disp 0x38 (mod=01 `FF 5r 38`, SIB `FF 54 sib 38`, mod=10 disp32 `FF 9r 38 00 00 00`, SIB variant) across 0x401000–0xBEA000: **29 raw hits** (`t2_hits.txt`), each contextually disassembled (`t2_ctx.txt`). No disp32/SIB forms occurred (all 29 are `FF 50/51/56 38`). Linear-sweep cross-check found only 2 — the byte census is the authoritative list.

### Anchor: which slot14 can the sites hit?

Whole-image dword scan: **the only dword equal to 0x965A09 anywhere in the image is at 0xB0BD60 = 0xB0BD28+0x38** — i.e. *any* `call [reg+0x38]` whose receiver's vtable is the user vtable 0xB0BD28 dispatches 0x965A09, and no other vtable exposes it. Other slot14s reachable by the same opcode at other receivers: M physics tables → 0x9BCCFA (a bare `ret` no-op; #3 → 0x9C4946), field vt 0xB0DD98+0x38 → 0xA52AC2.

### Proven user stand-up sites (receiver PROVEN user)

1. **0x965937 — flag = 0 (literal `push 0`)**:
   `mov eax,[edi]; push 0; mov ecx,edi; call [eax+0x38]`
   - Containing function **0x9658CC** (SEH prolog `mov eax,0xAEC6B0`; `ret 4`); `edi = ecx` (this). Immediately before: `0x6131B9(0, this+0x2944)` (seat-state-0 write), RNG reset `0x416DE8(this+0x2E90, [this+0x2E98])`, gated on its result — the exact C-081 seat stand-up chain.
   - Receiver provenance chain: 0x9658CC's only E8 caller **0x957204** (switch case of dispatcher 0x9571BF, 30-case jump table at 0x95732E, opcodes 0xCF–0xEC, `this` inherited in ecx) ← called by **0x97FCC9** inside thunk 0x97FCBA (`ecx = [outer+8]`) ← called from 0x97F6A3 (outer opcode router, 0xCF–0xEC arm).
   - Static identity proof: (a) 0x965A09 exists in exactly one vtable slot = user slot14; (b) the receiver's field usage (+0x2944 seat state, +0x2E90/+0x2E98 chair RNG pair) matches the user layout written at the 0xB0BD28 construction sites; (c) the stand-up semantic (slot14 semantics = 0x965A09's own body). Residual runtime uncertainty: [outer+8]'s construction is not traced end-to-end (noted in Confidence).
2. **0x948AB4 — flag = 0 (literal `push 0`)**, gated by `test ebx(arg1); je`:
   `mov eax,[edi]; push 0; call [eax+0x38]` inside 0x948AA2 (`ret 4`, this=ecx→edi). Follow-up code immediately loads `0x4B1C27(this,&arg)` → `[eax]` and applies the `x ? x-0xC : 0` idiom — the same **M = [user+…]-0xC** pointer convention seen inside 0x965A09 (`mov ecx,[esi+0xF28]; lea eax,[ecx-0xC]; neg/sbb/and; call 0x53E95D(…,0xB)`), plus `[edi+0x38C]` and `edi+0x88` accesses (user+0x88 vtable-ptr field is written at construction 0x950099). One of its 3 E8 callers is **0x9509D7**, inside the same construction chain that installs vtable 0xB0BD28 (0x950081), passing `ecx = ebx` = the object under construction. Classification: **user stand-up, flag=0** (strong static evidence, construction-context).
3. **Direct-E8 reference point re-verified:** 0x965A09's only E8 caller **0x9500A3** pushes **flag=1** (`push 1` at 0x950095) with `ecx=esi`, directly after `mov [esi],0xB0BD28; [esi+4]=0xB0BD04; [esi+8]=0xB0BD00` (0x950081–0x95008E) — construction-time stand-up reset without notify. Also re-verified 0x965A09 itself: extent 0x965A09–0x965A8C, **ret 4**, flag==0 branch → `0x53E95D(M',0xB)` with `M' = [user+0xF28] ? [user+0xF28]-0xC : 0` (0x965A74–0x965A85).

### Non-user sites (receiver provenance established or bounded)

| site | receiver | flag arg | family / classification |
|---|---|---|---|
| 0x9BCCE1 | `[esi]`, this of 0x9BCCC4 | none pushed | **M physics slot14** (0x9BCCFA no-op / 0x9C4946) — NOT user. 0x9BCCC4 also calls slot9 (+0x24), slot10 (+0x28 arg), slot11 (+0x2C); sets [this+0x14C]=1; one caller 0x951529-2B manipulates [esi+0x16C]/[esi+0x148] (M fields) |
| 0xA11C0E | `[0xBD9020]` global object | none visible | manager with vtable triple written at 0x4FD6EC (`0xAFEAxx` family) — **not user** |
| 0x652EBA / 0x656A14 | `[0xBDEDF8]` / `[0xBDEDFC]` globals | none | sibling globals stored at 0x652DFC/0x656942 — non-user family |
| 0x465394 | `[[esi+0x1C]]` (child object, called with `push eax`) | object ptr | child-object vtable; sibling calls `[ecx+8]` after — COM-ish; not user layout |
| 0x4950D7 | `mov esi,[ecx]` (this vtable) | **edx:eax 64-bit** | forwarding thunk `ret 8` passing a 64-bit arg — incompatible with user slot14(int flag) |
| 0x404B8A / 0xA174B7 | `[esi]`, this | this+out-local | wrapper stubs `push local; push this` forwarding 2 args — not user flag form |
| 0x427452, 0x8A2807, 0x9E05A0, 0x7CE488, 0x76191A | `[ecx]` direct | forwarded arg | single-arg vtable-forwarding thunks `ret 4`; none of these thunk addresses appear in any vtable dword in the image |
| 0x499E22 | `[esi]`, this of a setter | this+&local | object with +0x64/+0x68/+0xA4 fields — not user layout |
| 0x52A55A | `[esi]`, this | **no push** (after `push 1; call [eax+0x34]` slot13) | state dispatcher family |
| 0x586357 | `[[ecx+0x768]]` | forwarded | field-of-object; outer object has +0x768 slot — not user |
| 0x63FAE9 | `[esi]`, this | none | packet/UI dispatcher |
| 0x87DD79 | `[esi]`, this | `push [esi+0x5C8]` (dynamic) | object with +0x5C8/+0xAFC(=0x1F40) — timer manager-ish |
| 0x923CC5 | `[esi]`, this of 0x9244E2 (E8-called from 0x923A3F, opcode 0x7D1/0x1F4 arm of 0x923A?? router) | `sete cl` → **0/1 dynamic** | packet-handler object (+0x56C/+0x58C/+0x824/+0x844/+0x848) — not user |
| 0x924524 / 0x92459A / 0x9245FB | `[esi]`, same object | `push edi` = **0** (xor'd at entry), gated by `[esi+0x824]` | same packet-handler family — flag 0 but receiver is not user |
| 0x948BD8 | `[esi]` | `push 0` | object checked via `0x70DF65(edi)` and [ebx+0x2C]; receiver evidence insufficient for user (no user-layout fields in window) — unproven |
| 0x9DDB99 | `[edi-0x588]` | none | site calls import thunk `[0xBE1674]` first — DirectSound/DirectX-family, **not user** |
| 0x9DDF5E | `[[esi+0x10]]` | object | calls `[ecx+0x7C]` before — DirectX enumeration family, not user |
| 0x9DE0BA | `[esi]`, this of 0x9DE0AC | this+out-local | wrapper stub (same class as 0x404B7C) |
| 0x9F1EC7 | `[[esi+0x80]]` | byte flag 0x41/0x48/0x49-derived | object with char-coded flags — window/font family, not user |

### Summary

- **User slot14 (0x965A09) call sites: 0x965937 (flag=0, notify path), 0x948AB4 (flag=0), plus direct E8 0x9500A3 (flag=1).** No site pushes a dynamic flag onto a proven user receiver.
- Every other census site dispatches a different family's slot14 (M physics 0x9BCCFA/0x9C4946, field 0xA52AC2 would require a field receiver — none found), or is a forwarding thunk/COM/DirectX wrapper.
- The `[user+0xF28]` chain: confirmed *inside* 0x965A09 itself (`M = [user+0xF28]-0xC` before 0x53E95D(_,0xB)); the equivalent `-0xC` idiom at 0x948AC5 corroborates the same user/M convention at the 0x948AB4 site.

---

## T3 — 0x9C5B8A vs 0x9CCAA8 (slot3 variants) and relation to 0x9BF1FA

### Extents and conventions

- **0x9C5B8A–0x9C5F5C** (331 ins, 40 blocks), prologue `push ebp; sub esp,0x18`, **`ret 8`** at 0x9C5F5C; next function 0x9C5F5F.
- **0x9CCAA8–0x9CCC96** (170 ins), **`ret 8`** at 0x9CCC96; next function 0x9CCC99.
- **0x9BF1FA–0x9BF6E9**, **`ret 8`** at 0x9BF6E9 — independently reproduces the T082-era extent/ret of the generic slot3 (C-067) exactly.
- Both variants have **zero E8 callers** — reachable only through vtable slot3 dispatch (see table: #3→0x9C5B8A, #5→0x9CCAA8, others→0x9BF1FA). Signature (all three): `__thiscall(M, src_rec* arg1, int* budget arg2)` ret 8.

### The decisive structural finding: both are PRE-processors that delegate to 0x9BF1FA

- 0x9C5B8A tail: `… call 0x9C62A8(ecx=M); push [ebp+0xC]; mov ecx,ebx; push [ebp+8]; call 0x9BF1FA` (0x9C5F44–0x9C5F53), then common epilogue `ret 8`. `ebx = ecx` at entry — **same this**.
- 0x9CCAA8 tail: `push [ebp+0xC]; mov ecx,ebx; push [ebp+8]; call 0x9BF1FA` (0x9CCC85–0x9CCC8D), `ret 8`.
- So they are **wrappers/extensions, not reimplementations**: state-specific gating first, then the generic foothold-step logic runs unchanged.

### Entry condition (identical)

`delta = decrypt(M+0xE0 rec) − decrypt(arg1 rec at +0x0)`; `if delta == 0.0` (fcom 0xAFECC0; je) → **immediate delegate to 0x9BF1FA** (0x9C5BCE / 0x9CCAE9). All interesting logic requires a nonzero velocity/param delta on the Z block.

### Structured diff

| aspect | 0x9C5B8A (table #3 0xB0C760) | 0x9CCAA8 (table #5 0xB0C970) |
|---|---|---|
| state gates | **`[M+0x238]` switch: 1 or 2** (other values → delegate) | **state object chain**: `eax=[M+0x14]; edi = [ (eax? eax-4 : 0) + 0x94 ]` (i.e. [state+0x90] sub-object) |
| foothold/ctx reads | `[M+0x110]` ctx: +0x30/+0x38 dir doubles, +0x40 len, +0x4C/+0x50 prev/next; `[M+0x134]` platform; const 0xB064A8 threshold | same ctx fields (+0x30/+0x38/+0x40/+0x4C/+0x50); same 0xB064A8-family compares |
| platform/page tables | path 2: `eax=[field+0x34]; idx=[ctx+0x20]; pair=[eax+idx*8] (+4)`, second idx `[M+0x23C]` → min/max bounds, **0x28 span → ±0x14 shrink** | `edx=[field+0x34]; idx=[ctx+0x20]; pair=[edx+idx*8]` → min/max, same **0x28/±0x14** shrink |
| extra object | `[M+0x240]` object: **slot6 `[eax+0x18]` result == [M+0x134]** (page/platform match); **slot4 `[eax+0x10]` → `[eax+4]` int** compared with decrypt(M Y1) (0x9C5E95–0x9C5EB3) | `[state+0x90]` sub-object (edi): vtable at [edi]; `lea ecx,[edi+4]; call [eax+0x18]` == [M+0x134]; `lea ecx,[edi+4]; call [eax+0x10]` → `[eax+4]` int vs decrypt(M Y1) (0x9CCC44–0x9CCC52) |
| randomness | RNG `[M+0x250]` via `0x416E71` (0x9C5EB7) — gate only (`test al,1`) | **`rand()` (0xA70BAD) % 2 parity gate** before the special path (0x9CCC5A–0x9CCC67) — 50% branch |
| special-path body | copy 0xC dwords (0x30 bytes) from arg1 → **M+0xE0 block** (0x9C5EC7–0x9C5ECA); `call 0x9C5341(M, 0)` (0x9C5ED0); return **eax=0 without delegating** (0x9C5ED5); also Z recompute path encrypts M+0xE0 (0x9C5F01/0x9C5F13), `[ebx+0x4D4]` check, `0x9C4B78(M, ±1, 0)`, `0x9C62A8(M)` then delegate | copy 0xC dwords arg1 → M+0xE0 (0x9CCC6C–0x9CCC75); **`[M+0x158] = 1`** (0x9CCC77); return **eax=0 without delegating** (0x9CCC81); otherwise delegate |
| velocity/coord updates | Z-block (M+0xE0/M+0xF8) param recompute: `(bound − ctx.n1)/ctx.dir1` idiom (0x9C5EEC–0x9C5F01); decrypt(M Y1) at 0x9C5E95 | Y1 record decrypt (0x9CCC3C); no Z recompute expressions — simpler |
| notify calls | none direct (only via delegation and 0x9C4B78/0x9C62A8) | none direct |
| water/swim | none | none |
| exit paths | (a) delta==0 → delegate; (b) gate fail → delegate; (c) special → copy+0x9C5341, ret 0; (d) Z-recompute → 0x9C4B78/0x9C62A8 → delegate; epilogue ret 8 | (a) delta==0 → delegate; (b) gate fail → delegate; (c) rand-parity → copy+M+0x158=1, ret 0; epilogue ret 8 |

### State semantics implied by table membership

- 0x9C5B8A belongs to table #3, which **also overrides slot4** (0x9C6028), slot7 (0x9C5F5F), slot9 (0x9C3D1D), slot14 (0x9C4946) — the most heavily specialized table; it reads `[M+0x238]/[M+0x23C]` (page-pair indices, incremented by 0x1E at 0x9CC0CF with 0xC8 cap elsewhere) and uses platform range tables — consistent with a **rope/ladder-family state** (two indexed endpoints, page tables at field+0x34, ±20-unit range margins).
- 0x9CCAA8 belongs to table #5, which keeps the **standard physics loop 0x9BE703 as slot4** but gates through a **state-object sub-object at [state+0x90]** and a **rand()%2 parity** — a probabilistic transition (e.g. climb wobble/edge slip) before the normal foothold step.
- 0x9BF1FA (generic) remains the shared implementation for 5 tables and the final phase of both variants — consistent with, and extending, C-067's clamp+neighbor-transfer description.

---

## T4 — 0x5A (90) vs 0x1E (30) relation (G34)

### Census totals (instruction encodings only, control-transfer targets excluded)

- **0x5A: 206 raw / 178 in the code region** (<0xBB0000; ≥0xBB0000 hits are misdecoded data in the .rdata tail).
- **0x1E: 799 raw / 771 code-region.**
- Full lists in `t4_imm.txt`. Dominant encodings: `6A 5A` (push imm8), `83 F8/r 5A` (cmp imm8), `C6 45 FC 5A` (mov byte [ebp-4], imm8), `6B C0 5A` (imul imm8), `83 C1/E8 5A` (add/sub imm8), and the 0x1E equivalents.

### 0x5A semantic domains (classified per site)

1. **M-state tick generator (physics family, strongest)** — the idiom `r = 0x416E71(M+0x250) % N; ticks = (r + base) / 0x5A; [M+0x4D4 or +0x4D8] = ticks`:
   - 0x9C4BF3 (in 0x9C4BB0): `(RNG % 0x190 + 0x320) / 0x5A → [M+0x4D4]` (≈ 9–13)
   - 0x9C4DB6, 0x9C51BD: same expression → [M+0x4D4]/[M+0x4D8]
   - 0x9C4EAD, 0x9C52E5: `(RNG % 0x7D0 + 0x3E8) / 0x5A → [M+0x4D8]` (≈ 12–34)
   → 0x5A is a **divisor converting an RNG spread into a count of 90-unit periods** (randomized duration in 90-unit ticks).
2. **90-cap / 90-offset constants**: 0x9C9D18 (`cmp eax,0x5A`), 0x9C9D2A (`add eax,-0x5A; …; eax=0x5A` — store x−90, return 90), 0x9CC640 (`edi = (x?0x5A:0)+0x3C` → 60 or 150).
3. **ASCII 'Z' (0x5A) character compares** — CRT/charset/string domains: 0xA71A38, 0xA7236A/7F, 0xA72A46/5B, 0xA7AE0D, 0x7A6291, 0x62AB35, 0x882270, 0x9A518-era, etc.
4. **UI/display jitter**: the 0x95B9F1 cluster — 11× `push 0x5A` around `idiv 8 / abs(0xA70B13)` in one damage/display function (0x95Bxxx region).
5. **Ratio scaling (not a 3× chain)**: 0x796696/0x7967392 `imul eax,eax,0x5A` then `idiv` — `x*90/den + 10` (a [10,100] mapping in a UI/sound function).
6. Compiler noise: `mov byte [ebp-4],0x5A` = SEH try-level indices (dozens of sites) — excluded from semantics.

### 0x1E semantic domains

1. **Movement step / budget chunk (physics)**:
   - **0x9BCCFB returns literal 30**: extent 0x9BCCFB–0x9BCD6B; body = copy 0x18 dwords M+0x20→M+0x80 (checkpoint of the 4 coordinate records), `eax=[[0xBDD498]+0xAC] → [M+0x190]` (step snapshot — this is the EV-23 `[Physics+0xAC]` read, value 0x1E established dynamically by T084; the **same function then returns the literal 30** at 0x9BCD5D `push 0x1e; pop eax`), query state slot3 (`call [[M+0x14]]+0xC`) and push result into `0x9BFD4C(M+0x194, …)`. A sibling motif (snapshot + state query, no literal return) exists at 0x9BC852–0x9BC877.
   - 0x9BCA4C: `push 0x1E; call [eax+0x34]` — **slot13 (ctx fork 0x9BCA6F) invoked with literal 30** (after slot12 gate), inside 0x9BCA34.
   - 0x9C3F53 (in the 0x9C3E91 helper): `ecx=0x1E; if (budget>30) chunk=30 else chunk=budget; budget-=chunk` — **30-unit budget slicing**.
   - 0x9B4AAF/0x9B4B2B/0x9B4F16/0x9B4F92, 0x9D06B9: `sub edx,0x1E` — coordinate ±30 offsets passed to spawn-like calls (e.g. 0x9B4AAF: `push [esi+0x20]-0x1E; push 0; push 0xB0; push 1; push esi …`).
2. **Counter/state inits**: 0x9C69AA `mov [esi+0x470],0x1E` (vs 0x14 at 0x9C698A — 30-or-20 timer); 0x9CC0CF `add [M+0x23C],0x1E; cmp …,0xC8` (page-index advance by 30, cap 200); 0x9D0006 `cmp [edi+0x250],0x1E` (RNG-state compare).
3. Compiler noise: `mov byte [ebp-4],0x1E` SEH scope indices (≈500+ of the 771 code-region hits).
4. Misc UI/packet constants (0x95BAFF cluster etc.).

### H1 vs H2 verdict

- **H1 (a real numeric 90↔30 conversion): REJECTED at instruction level.** No mul/div-3 chain links the two anywhere. The only ×3-shaped candidate (`imul eax,eax,0x5A` at 0x796696/0x7967392) feeds a ratio `x*90/den+10` in a UI/sound function with no 30 anywhere near it. No function computes 90 from 30 or 30 from 90 arithmetically.
- **H2 (disjoint domains): PREDOMINANTLY CONFIRMED, with ONE documented exception.** The single instruction-level point where both constants meet is:
  - **0x9C3D1D–0x9C3D25 (slot9 of physics table #3, dword at 0xB0C784 = 0xB0C760+0x24):**
    `call 0x9BCCFB` (whose `eax` return is **30**) followed immediately by `push 0x5A; pop eax; ret` — the 30 is **discarded and overridden with 90**, keeping only 0x9BCCFB's side effects (coordinate checkpoint + [field+0xAC]→[M+0x190] snapshot + state query). This is a **per-state step-unit override (30 → 90)**, not a conversion: state #3's step accessor answers 90 while the generic states answer 30.
  - Falsification addresses: H1 would be proven by any arithmetic instruction pair chaining the two (e.g. a `×3`/`÷3` applied to a value derived from `[field+0xAC]` or from the 0x9C4BB0 tick formula — none exists; disprove my H1-rejection by finding one). H2-disjointness would be falsified by any *other* function containing both constants in the same dataflow — the nearest co-occurrences are inert (e.g. 0x95Bxxx UI function pushes both as independent magic args; 0x9C3D22/0x9C3F53 are ±0x231 apart but in different functions with independent uses: return-90 vs budget-chunk-30).
- Bottom line: **90 = 3×30 is numeric coincidence as far as the binary shows; the program's own relationship between the two is "default step 30, state-#3 override 90", plus independent RNG-tick (÷90) and step/budget (30) domains.** If the main agent's T085 claims a deeper numeric conversion, the burden of proof is an explicit address pair; 0x9C3D1D is the only candidate site and it is an override.

---

## Confidence & uncertainties

1. **T1 extent/blocks/exits: high.** Recursive descent validated against clean linear decode and function adjacency (0x9BF144 next). SEH-scope stores (`[ebp-4]`) were treated as compiler metadata, not semantics.
2. **Encrypted-record model: high for structure** (0x18-byte records, payload/keys/checksum, stride 0x18 between records at M+0x20/38/50/68 and singles at +0xE0/+0xF8; verified through 0x548806/0x6131F4 disassembly and every call-site push pattern). **Medium for field naming** (which record is "X vs Y vs prev/dest") — inferred from usage order and the 0x9BC992 line-projection semantics.
3. **Physics vtable census: high** — dword-verified for all 8 tables, slots 0–14 sampled; correction of the briefing's "slot4 = 0x9BE703" for 6/8 tables is byte-exact.
4. **T2 user-receiver proofs: high for 0x965937/0x9500A3** (sole-vtable-dword argument is airtight statically); **medium-high for 0x948AB4** (layout + construction-chain caller; [outer+8] construction chain not fully traced). Remaining thunks (0x427452 etc.) are proven *not* to be vtable-resident, but their dynamic receivers are unidentified — classified negatively (not user) by argument shape and context, which is strong but not absolute.
5. **T3: high.** Variant↔table membership dword-verified; delegation-to-0x9BF1FA verified in both; the 0x9BF1FA extent independently reproduces the ledger value. State-name labels (rope/ladder/climb) are interpretive, flagged as such.
6. **T4: high for the census** (resyncing sweep; ≥0xBB0000 hits excluded as data). The `[field+0xAC] == 0x1E` runtime value is *assumed from the task's EV-23 premise* — statically I can only prove the read site (0x9BCD1F) and the *literal* 30 return; the value's heap initialization is outside static reach (multiple candidate `+0xAC` writers exist for different objects).
7. Linear-sweep caveat: 23,881 undecodable bytes mean ~0.9% of the text is data-in-code; the byte-pattern census (T2) and targeted window disassembly (T1/T3/T4 key sites) do not depend on sweep completeness, but a hypothetical census miss inside a data island cannot be fully excluded.
8. I did not read any T085-* file; the only ledger inputs were the task briefing and (for orientation on what to verify) claims.csv lines quoted via grep in this session — all four conclusions above are re-derived from the binary.

---

## Appendices — raw disassembly dumps (self-contained)

### Appendix A: T1 — swept-box query construction + no-displacement exit (0x9BE7F3-0x9BE8A0)

```
009BE7F3  8945d8                 mov dword ptr [ebp - 0x28], eax
009BE7F6  8b45d4                 mov eax, dword ptr [ebp - 0x2c]
009BE7F9  2b45e0                 sub eax, dword ptr [ebp - 0x20]
009BE7FC  33f6                   xor esi, esi
009BE7FE  8945a4                 mov dword ptr [ebp - 0x5c], eax
009BE801  89856cffffff           mov dword ptr [ebp - 0x94], eax
009BE807  8b45d8                 mov eax, dword ptr [ebp - 0x28]
009BE80A  2b45ec                 sub eax, dword ptr [ebp - 0x14]
009BE80D  3975a4                 cmp dword ptr [ebp - 0x5c], esi
009BE810  898564ffffff           mov dword ptr [ebp - 0x9c], eax
009BE816  898574ffffff           mov dword ptr [ebp - 0x8c], eax
009BE81C  7518                   jne 0x9be836
009BE81E  3bc6                   cmp eax, esi
009BE820  7514                   jne 0x9be836
009BE822  8b459c                 mov eax, dword ptr [ebp - 0x64]
009BE825  2903                   sub dword ptr [ebx], eax
009BE827  8b17                   mov edx, dword ptr [edi]
009BE829  50                     push eax
009BE82A  8bcf                   mov ecx, edi
009BE82C  ff5218                 call dword ptr [edx + 0x18]
009BE82F  33c0                   xor eax, eax
009BE831  e9bc050000             jmp 0x9bedf2
009BE836  c745cc01000000         mov dword ptr [ebp - 0x34], 1
009BE83D  c7459002000000         mov dword ptr [ebp - 0x70], 2
009BE844  8975dc                 mov dword ptr [ebp - 0x24], esi
009BE847  8975d0                 mov dword ptr [ebp - 0x30], esi
009BE84A  89758c                 mov dword ptr [ebp - 0x74], esi
009BE84D  89b554ffffff           mov dword ptr [ebp - 0xac], esi
009BE853  89b558ffffff           mov dword ptr [ebp - 0xa8], esi
009BE859  89b55cffffff           mov dword ptr [ebp - 0xa4], esi
009BE85F  c7854cffffff880db000   mov dword ptr [ebp - 0xb4], 0xb00d88
009BE869  8d854cffffff           lea eax, [ebp - 0xb4]
009BE86F  50                     push eax
009BE870  ff75d8                 push dword ptr [ebp - 0x28]
009BE873  8b8568ffffff           mov eax, dword ptr [ebp - 0x98]
009BE879  ff75d4                 push dword ptr [ebp - 0x2c]
009BE87C  8d4844                 lea ecx, [eax + 0x44]
009BE87F  ff75ec                 push dword ptr [ebp - 0x14]
009BE882  8975fc                 mov dword ptr [ebp - 4], esi
009BE885  ff75e0                 push dword ptr [ebp - 0x20]
009BE888  e81d2cb5ff             call 0x5114aa
009BE88D  8b8558ffffff           mov eax, dword ptr [ebp - 0xa8]
009BE893  3bc6                   cmp eax, esi
009BE895  0f842d050000           je 0x9bedc8
009BE89B  eb03                   jmp 0x9be8a0
009BE89D  8b7df0                 mov edi, dword ptr [ebp - 0x10]
```

### Appendix A2: T1 — shared epilogue + ret 0xC (0x9BEDC2-0x9BEE00)

```
009BEDC2  8b5d0c                 mov ebx, dword ptr [ebp + 0xc]
009BEDC5  8b7df0                 mov edi, dword ptr [ebp - 0x10]
009BEDC8  8b459c                 mov eax, dword ptr [ebp - 0x64]
009BEDCB  2903                   sub dword ptr [ebx], eax
009BEDCD  8b17                   mov edx, dword ptr [edi]
009BEDCF  50                     push eax
009BEDD0  8bcf                   mov ecx, edi
009BEDD2  ff5218                 call dword ptr [edx + 0x18]
009BEDD5  33f6                   xor esi, esi
009BEDD7  834dfcff               or dword ptr [ebp - 4], 0xffffffff
009BEDDB  8d8d4cffffff           lea ecx, [ebp - 0xb4]
009BEDE1  c7854cffffff880db000   mov dword ptr [ebp - 0xb4], 0xb00d88
009BEDEB  e83b30b5ff             call 0x511e2b
009BEDF0  8bc6                   mov eax, esi
009BEDF2  8b4df4                 mov ecx, dword ptr [ebp - 0xc]
009BEDF5  5f                     pop edi
009BEDF6  5e                     pop esi
009BEDF7  5b                     pop ebx
009BEDF8  64890d00000000         mov dword ptr fs:[0], ecx
009BEDFF  c9                     leave 
```

### Appendix B: T2 — user stand-up flag=0 site (0x965902-0x965940 window)

```
00965902  8d9744290000           lea edx, [edi + 0x2944]
00965908  33c9                   xor ecx, ecx
0096590A  e8aad8caff             call 0x6131b9
0096590F  ffb7982e0000           push dword ptr [edi + 0x2e98]
00965915  89874c290000           mov dword ptr [edi + 0x294c], eax
0096591B  8d87902e0000           lea eax, [edi + 0x2e90]
00965921  50                     push eax
00965922  e8c114abff             call 0x416de8
00965927  85c0                   test eax, eax
00965929  59                     pop ecx
0096592A  59                     pop ecx
0096592B  0f84c7000000           je 0x9659f8
00965931  8b07                   mov eax, dword ptr [edi]
00965933  6a00                   push 0
00965935  8bcf                   mov ecx, edi
00965937  ff5038                 call dword ptr [eax + 0x38]
```

### Appendix B2: T2 — construction-time direct call, flag=1 (0x95007D-0x9500A9)

```
0095007D  c645fc1c               mov byte ptr [ebp - 4], 0x1c
00950081  c70628bdb000           mov dword ptr [esi], 0xb0bd28
00950087  c7460404bdb000         mov dword ptr [esi + 4], 0xb0bd04
0095008E  c7460800bdb000         mov dword ptr [esi + 8], 0xb0bd00
00950095  6a01                   push 1
00950097  8bce                   mov ecx, esi
00950099  c78688000000ecbcb000   mov dword ptr [esi + 0x88], 0xb0bcec
009500A3  e861590100             call 0x965a09
009500A8  6a10                   push 0x10
```

### Appendix C: T3 — 0x9CCAA8 tail: delegate to 0x9BF1FA + ret 8 (0x9CCC6C-0x9CCC99)

```
009CCC6C  6a0c                   push 0xc
009CCC6E  59                     pop ecx
009CCC6F  8dbbe0000000           lea edi, [ebx + 0xe0]
009CCC75  f3a5                   rep movsd dword ptr es:[edi], dword ptr [esi]
009CCC77  c7835801000001000000   mov dword ptr [ebx + 0x158], 1
009CCC81  33c0                   xor eax, eax
009CCC83  eb0d                   jmp 0x9ccc92
009CCC85  ff750c                 push dword ptr [ebp + 0xc]
009CCC88  8bcb                   mov ecx, ebx
009CCC8A  ff7508                 push dword ptr [ebp + 8]
009CCC8D  e86825ffff             call 0x9bf1fa
009CCC92  5f                     pop edi
009CCC93  5e                     pop esi
009CCC94  5b                     pop ebx
009CCC95  c9                     leave 
009CCC96  c20800                 ret 8
```

### Appendix C2: T3 — 0x9C5B8A tail: helpers then delegate (0x9C5F1B-0x9C5F5F)

```
009C5F1B  83bbd404000000         cmp dword ptr [ebx + 0x4d4], 0
009C5F22  7420                   je 0x9c5f44
009C5F24  dd45e8                 fld qword ptr [ebp - 0x18]
009C5F27  dc1dc0ecaf00           fcomp qword ptr [0xafecc0]
009C5F2D  dfe0                   fnstsw ax
009C5F2F  9e                     sahf 
009C5F30  7605                   jbe 0x9c5f37
009C5F32  83c8ff                 or eax, 0xffffffff
009C5F35  eb03                   jmp 0x9c5f3a
009C5F37  6a01                   push 1
009C5F39  58                     pop eax
009C5F3A  6a00                   push 0
009C5F3C  50                     push eax
009C5F3D  8bcb                   mov ecx, ebx
009C5F3F  e834ecffff             call 0x9c4b78
009C5F44  8bcb                   mov ecx, ebx
009C5F46  e85d030000             call 0x9c62a8
009C5F4B  ff750c                 push dword ptr [ebp + 0xc]
009C5F4E  8bcb                   mov ecx, ebx
009C5F50  ff7508                 push dword ptr [ebp + 8]
009C5F53  e8a292ffff             call 0x9bf1fa
009C5F58  5f                     pop edi
009C5F59  5e                     pop esi
009C5F5A  5b                     pop ebx
009C5F5B  c9                     leave 
009C5F5C  c20800                 ret 8
```

### Appendix D: T4 — slot9 of table#3: call step-writer (ret 30) then override eax=90 (0x9C3D1D-0x9C3D26)

```
009C3D1D  e8d98fffff             call 0x9bccfb
009C3D22  6a5a                   push 0x5a
009C3D24  58                     pop eax
009C3D25  c3                     ret 
```

### Appendix D2: T4 — tick generator: (RNG%400+800)/0x5A -> [M+0x4D4] (0x9C4BB0-0x9C4C25)

```
009C4BB0  55                     push ebp
009C4BB1  8bec                   mov ebp, esp
009C4BB3  83ec18                 sub esp, 0x18
009C4BB6  53                     push ebx
009C4BB7  56                     push esi
009C4BB8  8bf1                   mov esi, ecx
009C4BBA  8b86d4040000           mov eax, dword ptr [esi + 0x4d4]
009C4BC0  57                     push edi
009C4BC1  33ff                   xor edi, edi
009C4BC3  3bc7                   cmp eax, edi
009C4BC5  7e0c                   jle 0x9c4bd3
009C4BC7  48                     dec eax
009C4BC8  8986d4040000           mov dword ptr [esi + 0x4d4], eax
009C4BCE  e97b010000             jmp 0x9c4d4e
009C4BD3  39be40020000           cmp dword ptr [esi + 0x240], edi
009C4BD9  0f846f010000           je 0x9c4d4e
009C4BDF  8d8e50020000           lea ecx, [esi + 0x250]
009C4BE5  e88722a5ff             call 0x416e71
009C4BEA  33d2                   xor edx, edx
009C4BEC  b990010000             mov ecx, 0x190
009C4BF1  f7f1                   div ecx
009C4BF3  6a5a                   push 0x5a
009C4BF5  59                     pop ecx
009C4BF6  8bc2                   mov eax, edx
009C4BF8  0520030000             add eax, 0x320
009C4BFD  33d2                   xor edx, edx
009C4BFF  f7f1                   div ecx
009C4C01  8986d4040000           mov dword ptr [esi + 0x4d4], eax
009C4C07  ff7630                 push dword ptr [esi + 0x30]
009C4C0A  8d4620                 lea eax, [esi + 0x20]
009C4C0D  50                     push eax
009C4C0E  e8f33bb8ff             call 0x548806
009C4C13  dd5df8                 fstp qword ptr [ebp - 8]
009C4C16  59                     pop ecx
009C4C17  59                     pop ecx
009C4C18  8b8e40020000           mov ecx, dword ptr [esi + 0x240]
009C4C1E  8b01                   mov eax, dword ptr [ecx]
009C4C20  ff5010                 call dword ptr [eax + 0x10]
009C4C23  db00                   fild dword ptr [eax]
```

### Appendix D3: T4 — step-writer 0x9BCCFB body+tail: [field+0xAC]→[M+0x190], returns 0x1E (0x9BCD0C-0x9BCD2B + 0x9BCD5A-0x9BCD6C)

```
009BCD0C  6a18                   push 0x18
009BCD0E  59                     pop ecx
009BCD0F  8d7320                 lea esi, [ebx + 0x20]
009BCD12  8dbb80000000           lea edi, [ebx + 0x80]
009BCD18  f3a5                   rep movsd dword ptr es:[edi], dword ptr [esi]
009BCD1A  a198d4bd00             mov eax, dword ptr [0xbdd498]
009BCD1F  8b80ac000000           mov eax, dword ptr [eax + 0xac]
009BCD25  8b4b14                 mov ecx, dword ptr [ebx + 0x14]
009BCD28  8d55ec                 lea edx, [ebp - 0x14]
```

