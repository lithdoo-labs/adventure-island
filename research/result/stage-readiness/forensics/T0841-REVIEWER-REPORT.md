# T084.1 Independent Adversarial Review — Verbatim Report (Sub-Agent, Round 1)

> Reviewer session: independent context; started from baseline `cdbe55ee2a1d8bbc8ceeef3fc3d66e864b56749f`; did NOT read t084.1 outputs (T084-1-SLOT25-SCOPE-RECONCILIATION.md, EV-74/75/76, t0841_*.py) as analysis inputs; own capstone/pefile scripts under `C:\Users\lithd\AppData\Local\Temp\opencode\reviewer\`; no file modifications; no commits. Returned 2026-11-15.

---

## 1. VERDICT

**ACCEPT-WITH-CORRECTIONS**

The t084.1 core corrections are independently confirmed by my own disassembly from the pinned binaries; the residual issues are wording/attribution-level (listed in §4) and none flips a readiness or stage verdict.

## 2. Method summary

- All three binaries hash-verified before any analysis (read-only):
  - EXE `.work/task-036/game-image-unpacked.bin` = `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` ✓
  - `Gr2D_DX8.dll` = `ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1` ✓
  - `PCOM.dll` = `cf3807f3107152d3b305bfc84be36d58b62306c94f60133c8e80fd17f9d9e54b` ✓
- Own scripts (capstone 5.0.7 / pefile), all in `C:\Users\lithd\AppData\Local\Temp\opencode\reviewer\`: `rv_common.py`, `rv_d1_gr2d_5040418c.py`, `rv_d1b_full.py`, `rv_d2_exe_427eb3.py`, `rv_d2b_cands.py`, `rv_d2c_tilepath.py`, `rv_d2d_fn666.py`, `rv_d2e_seh.py`, `rv_d3a_guids.py` … `rv_d3m_writes.py`, `rv_d5_dump.py`, `rv_d7_opcode81.py`, `rv_d7b_ctx.py`, `rv_d8_spotcheck.py`, `rv_d9_final.py`. Baseline docs read only via `git show cdbe55ee:...`.

## 3. Per-check findings

### D1 — 0x5040418C full analysis (Gr2D)
- **Boundary**: `5040418C b8 42af4250 (mov eax,0x5042af42) / e8 5a640200 (call __SEH_prolog 0x5042a5f0)` … epilogue `5040485F…5040485D c2 3c 00` → **`ret 0x3C`** = 15 stack dwords; end VA 0x50404860 (next fn starts there with its own SEH prolog). 602 instructions in my linear dump.
- **E_POINTER guard**: `504041A0 39 5d40 cmp [ebp+0x40], ebx` → zero ⇒ `b8 03400080` (0x80004003) → epilogue. Guard target = **arg15 `[ebp+0x40]`** (the out pointer, last pushed).
- **[this+0x90] guard**: `504041B6 8b7d08 mov edi,[ebp+8]` (this), `504041B9 39 9f90000000 cmp [edi+0x90], ebx` → zero ⇒ **0x80004005 (E_FAIL)**.
- **Out write**: `504045C1 mov eax,[ebp+8]` / `504045C4 mov ecx,[ebp+0x40]` / **`504045CB 8901 mov [ecx],eax`** — writes the object constructed into local `[ebp+8]` (zeroed at 0x50404215, built by `call 0x50405846` at 0x50404220) into `*arg15`. A **put-with-object-out**.
- **VARIANT handling**: `[ebp+0x30]`: vt==VT_EMPTY(0) or VT_ERROR(0xA) → esi=−1; else VariantChangeType(0x5040517C) to **0x13 = VT_UI4**; vt==0x13 → esi=value else esi=1. `[ebp+0x20]`: VT_EMPTY/VT_ERROR → skip (count=1); else convert to **VT_UI4(0x13)**; on failure convert to **0xD = VT_UNKNOWN**, extract punk, QI (0x504062aa; IID ptr 0x5043A160), enumerate items (`call [eax+0x2c]` = IDispatch::Invoke at 0x504046CE), **count clamp 0x400** at 0x50404634.
- **[this+0x128]: does NOT appear anywhere in the body** (only `[edi+0x90]` at 0x504041B9). The 0x128 collection belongs to slots 26/27/28 = 0x50404ECA/0x50404EE9/0x50404F05, each `lea ecx,[eax+0x128]` then call 0x50407ade/0x50407bec/0x50407f23 (verified).

### D2 — EXE 0x427EB3 push census and tile path
- Exact stack build before `427EEE ff5064 call [eax+0x64]`:
  - `427EC2 51 push ecx` where ecx=&[ebp+0x24] (**pointer arg**, deepest)
  - `427EC3 83ec10 sub esp,0x10` + 4×movsd = **VARIANT A by value** (16 B, copied from *[ebp+0x24])
  - `427ED1 83ec10 sub esp,0x10` + 4×movsd = **VARIANT B by value** (16 B, copied from *[ebp+0x20])
  - pushes `[ebp+0x1c]`, `[ebp+0x18]`, `[ebp+0x14]`, `[ebp+0x10]`, `[ebp+0xc]`, then `push ebx` (**this**)
- Callee-slot mapping: `[ebp+8]`=this, `[ebp+0xC..0x1C]`=the five dwords, `[ebp+0x20..0x2F]`=VARIANT B, `[ebp+0x30..0x3F]`=VARIANT A, `[ebp+0x40]`=&wrapper[ebp+0x24]. **Total = 15 dwords = 60 = 0x3C.**
- Compatibility: **0x5040418C (`ret 0x3c`) — exact match.** 0x50403FBE (`mov [eax+0xCC],ecx; xor eax,eax; ret 8`) and 0x50404E85 (`cmp [edx+0x78]; setne; mov [eax],ecx; ret 8`) each pop only 8 of 60 bytes. Nuance: the wrapper's `leave` at 0x427F0C recovers ESP, so the ret-8 imbalance corrupts edi/esi/ebx pops rather than the frame itself — the decisive failures are semantic: the boolean getter writes through the *second pushed dword's value* as an address (wild write) and never writes the real out; the readback at `427F01 mov eax,[ebp+8]` / `427F04 mov ecx,[ebp+0x24]` / `427F09 mov [eax],ecx` then forwards the **stale first dword of the caller's VARIANT slot at [ebp−0x48]** — matching the "stale vt dword 13" failure (VT_UNKNOWN=0xD=13).
- Tile path: caller 0x666EBC passes `ecx=[0xBE2788]` and args (…, &[ebp−0x38], &[ebp−0x48]) to 0x427EB3; the callee's out `*arg15` = caller's **[ebp−0x48]**, forwarded to **[ebp−0x10]**. `0x42944A` = E_POINTER-guarded `__thiscall` getter returning `[esi]`. At `0x666F6F lea ecx,[ebp-0x10]; call 0x42944a` → esi; **`0x666F7D ff90b4000000 call [eax+0xB4]` receiver = the slot25 RESULT object, NOT [0xBE2788]** (args: this=out-object, edi=computed ptr with 0xBB8 stride). `0x666FD4 ff90e0000000 call [eax+0xE0]` (slot 56) likewise on the out-object with arg −1. Release via `call [[eax]+8]` at 0x666FBA.

### D3 — IID and identity chain
- GUID bytes at EXE 0xBA0570 and Gr2D 0x50435120 are identical: `33ea76e5 65d4084f aab1e78d f73ee6d9` = **{E576EA33-D465-4F08-AAB1-E78DF73EE6D9}**. Occurrences: EXE 1 (0xBA0570), Gr2D 1 (0x50435120), PCOM 0. Extra: scanned **all 22 DLLs + MapleStory.exe** in the game folder — only Gr2D carries it.
- 0xBE1FB0: written at `0x79C549 a3 b01fbe00` — resolver 0x79C52F does `GetProcAddress` ([0xafe094]) × 5: **"PcCreateObject"→0xBE1FB0**, PcFreeUnusedLibraries→0xBE1FB4, PcSerializeObject→0xBE1FB8, PcSerializeString→0xBE1FBC, PcRootNameSpace→0xBE1FC0; then resolves+calls "PcInitModule". Module = default **L"PCOM.DLL"** (wide name at 0xBA7598) loaded by 0x79C47C. PCOM.dll exports exactly `DllCanUnloadNow, DllGetClassObject, PcCreateObject, PcFreeUnusedLibraries, PcInitModule, PcRootNameSpace, PcSerializeObject, PcSerializeString, PcTermModule` — no IID table.
- Creator 0xA0449B: cdecl, called by initializer with 3 args; guards `[0xBE1FB0]==0 → 0x800401F0` (CO_E_NOTINITIALIZED); calls `factory([ebp+8], 0xBA0570, esi(out), [ebp+0x10])` cdecl (`add esp,0x10`). Initializer 0xA00E5E: `push 0; push 0xbe2788; push ctx; call 0xa0449b` → **PcCreateObject writes [0xBE2788] through the out pointer**. First vtable call on the new object: `0xA00FB8 ff500c call [eax+0xC]` = **slot 3 (0-based)** with `(this, 0x320, 0x258, VARIANT×3)` = 15 dwords; first VARIANT has vt 0x4003 (VT_BYREF|VT_I4) — matching inner slot3's `test byte [ebp+0x15],0x40`. Second call `0xA01089 ff5050 call [eax+0x50]` = slot 20 with `(this, 0xFF000000)` = ret 8.
- Gr2D ctor 0x504013E3 (`ret 4`): `[obj+0]=0x5042D204` (outer), `[obj+0x10]=0x5042D224` (inner), `[obj+0x14]=0x5042D210` (mid), `[obj+0x18]=owner`. QI 0x504014A5 (outer, stdcall ret 0xC): IUnknown→self; else `AtlInternalQI(this+0x10, map=0x5042D1E0, …)`. QI 0x50401522 (inner): delegates to `[this+8]` (owner) first, fallback map with pThis=self. 0x5040184E = `sub [esp+4],4; jmp 0x50401522` this-adjustor thunk. ATL IQI 0x50401945: IUnknown → `pThis+map[0].dw`; entries {piid, dw, pFunc}, pFunc==1 → `pThis+dw`, pFunc==NULL → E_NOINTERFACE.
- Interface map at 0x5042D1E0: entry0 `{piid=0x50435120 ({E576EA33-…}), dw=0, pFunc=1}`, entry1 `{IID_IUnknown @0x50435110, dw=0, pFunc=1}`, terminator `{0,0,0}`. **QI({E576EA33-…}) returns pThis+0 = the INNER subobject (obj+0x10, vtable 0x5042D224).**
- Slot3 compatibility: inner slot3 = **0x504030D3, `ret 0x3c`** — matches the initializer's 15-dword call (checks `[ebp+0xC]`/`[ebp+0x10]` non-NULL = 800/600, VT_BYREF on first VARIANT; constructs the device at this+0x90 — `lea ecx,[ebx+0x90]` at 0x504031C2/0x504031ED). Mid slot3 = 0x50404860, `ret 0x10`, switches on `[ebp+0x10]`∈{1,2,0x200,0x401} else E_INVALIDARG — incompatible. Outer slot3 = the QI thunk — incompatible (this−4).
- Statically derivable: **[0xBE2788] = the inner interface pointer (vtable 0x5042D224, slot25=0x5040418C)** — via PcCreateObject(riid={E576EA33}) + Gr2D intmap dw=0 + initializer slot-call compatibility. The **runtime-data part is the PCOM name→class registry binding** (PcCreateObject 0x50C04CD1 resolves a runtime namespace registry and invokes the class entry's vtable slot +0xC `(this, arg4, riid, ppv)` at 0x50C04D9F); the concrete registered class cannot be enumerated statically from PCOM.dll.

### D4 — Was t084's C-082 justified? **No.**
1. "Fully enumerated (2 candidates)" was false **on its own evidence**: EV-72's own inner-table dump contains `[5042D288] slot25 (+0x64) = 5040418C`.
2. Both enumerated "candidates" are **phantom slots** produced by slicing one contiguous rdata block into three overlapping windows: 0x5042D204 is a **3-entry non-delegating IUnknown table** (mid table starts at +0xC — its slot3 "0x5040184E" is a −4 this-adjustor that is nonsensical with an outer this), so "outer slot25" actually reads **inner slot17 (+0x44)** at 0x5042D268; likewise 0x5042D140 is a **5-entry thunk table**, so its "+0x64" reads the class-2 long table 0x5042D154's **slot20** at 0x5042D1A4.
3. The real slot25 of **both** long tables (0x5042D224 @0x5042D288 and 0x5042D154 @0x5042D1B8) is **0x5040418C** — the very put-with-object-out t084 declared "absent from both static tables". The exhaustion inference was inverted, and no ret-imm/stack check was performed that would have exposed it. The t084.1 correction is justified and overdue.

### D5 — EV-72 vs raw dwords 0x5042D1E0..0x5042D2C8
I re-dumped every dword (see `rv_d5_dump.py`). **All 3×28 rows of EV-72's three tables are byte-accurate against the raw dwords — not a single value disagrees.** The defect is purely interpretive: the three "tables" are overlapping windows of one block (outer slots 3..27 ≡ mid slots 0..24; outer slots 8..27 ≡ inner slots 0..19), which is what produced the phantom slot25s of D4.

### D6 — Matrix rows
- **P3-13 (unchanged)**: RE-READY + blocks_acceptance=是 is legal under validator 16c — grade "A…", evidence refs EV-22/38/55/56/64/65/66 all exist in evidence.csv, and `unproven` contains the required **"「未解」限界"** boundary disclosure; consistent with §0/§3 (bounded sub-behavior readiness; runtime corroboration optional, non-blocking) and no 17c stale markers. **Consistent.**
- **P4-06 (baseline)**: stale field confirmed — `can_static_continue_or_runtime` demands "STATIC 枚举0x9BC622包装者之上的上层调用…" while the same row's `minimum_next_work` says that work closed in t084 (C-084/EV-73), remainder = runtime camera timing. Internal contradiction (not policed by 17c since the row is RE-GAP-STATIC and the markers are t082-era).
- **P4-07 (baseline)**: stale fields confirmed — `minimum_next_work` "STATIC 先查0x963C7D/0x954B58时间门" (a) re-demands the 0x963C7D-family cooldown gate already closed by C-054/EV-35 (which this very row cites; P4-01 explicitly records "EV-35 含 0x963C7D 族冷却门"), and (b) 0x954B58/0x71B44D is P4-01's registered work item. Both are cross-row/duplicate stale work items.

### D7 — Opcode 0x81
- EV-70's window bytes verified: `77E6F7 2d81000000 sub eax,0x81; je 0x77E720 (→0x77E72F); dec/je→0x77FC9E; dec/jne→ret; ret 8` — a 0x81/0x82/0x83 dispatcher ✓. Handler windows 0x533EA4–0x533F3F and 0x97EBC9–0x97EC5E contain **no** imm-0x81 in any form ✓.
- My full-EXE imm32 census found **3** sites, not 1+2: `sub eax,0x81 @0x77E6F7`; `cmp edx,0x81 @0x62B75D`; `cmp edi,0x81 @0x9355A9`. Neither omitted site binds 0x81 to the WARP chain — 0x62B75D is a **range guard that itself calls 0x77E6F3** (a third feeder of the same channel dispatcher — note this also means EV-70's "0x5414A1 … unrelated" is right in conclusion but incomplete in mechanism: 0x5414A1 *feeds* 0x77E6F3 too), 0x9355A9 is a 0x80..0x81 range check on a time-derived value. Byte-form `cmp al,0x81` sites are legion but overwhelmingly data-region/mid-instruction noise — a census-based negative must stay bounded.
- **Baseline C-083's "proves … per-handler-object registration / binding established by runtime registration data" was an overclaim**: the collision proves only *number reuse across contexts*. The t084.1 tightened wording ("negative bounded to examined patterns; mechanism remains UNVERIFIED") matches exactly what the evidence supports.

### D8 — Reproducibility spot-checks (script `rv_d8_spotcheck.py`)
(a) 0x5040418C epilogue = `5040485D c2 3c 00` → **ret 0x3c** ✓; (b) dword @**0x5042D288 = 0x5040418C** ✓; (c) GUIDs byte-identical `{E576EA33-D465-4F08-AAB1-E78DF73EE6D9}` at both VAs ✓; (d) pushes at 0x427EB3: 8 push + 2×`sub esp,0x10` totaling 80 bytes including the 5 frame pushes (ebp/ecx/ebx/esi/edi) → **60 bytes (0x3C) of call arguments = 15 dwords** ✓.

## 4. Differences (working-tree t084.1 rows vs my findings)

| # | Severity | Row | What it says vs my finding |
|---|---|---|---|
| 1 | **MED** | claims.csv C-082 (corrected) & C-086 | Conclusion matches mine (0x5040418C is the only matching body; exhaustion withdrawn). But the rows still carry the t084 phantom-slot labels: "outer 0x5042D204 slot25 = 0x50404E85" and "layer-table 0x5042D140 slot25 0x50403FBE". Per my ctor/boundary analysis (D4/D5) **neither table has a slot25 at all** (3- and 5-entry tables; +0x64 reads land in the long tables' slots 17/20). Body facts right, slot attribution still wrong; also unnoted that the second long table 0x5042D154 has the *same* real slot25 = 0x5040418C (strengthens C-086). |
| 2 | LOW | evidence.csv EV-75 note "EV-72 mid-table slot3/slot4 off-by-one correction" | My D5 row-by-row check: EV-72's three tables are byte-accurate vs raw dwords — there is no off-by-one in the values; the true defect is the overlapping-window interpretation. The "correction" phrasing misdescribes the error class. (EV-74/75/76 `source_sha256` values match my computed file hashes; all three files exist.) |
| 3 | LOW | claims.csv C-083 / G38 | Tightened wording matches my D7 exactly. Residual: census still enumerates only 0x5414A1/0x75A0AB as cmp sites; my census adds 0x62B75D (range guard calling 0x77E6F3) and 0x9355A9. Neither binds 0x81 to the WARP chain, so the bounded negative stands. |
| 4 | LOW-MED | gaps.csv G10 / matrix P4-07 | "EXE-image static territory is EXHAUSTED … / Gr2D side carries no producer to search" is an unbounded negative; the underlying C-028/C-084 results are bounded censuses. I did not independently re-run the scene+0xF0..0xFC writer census and recommend bounded phrasing ("not found in examined census"). |
| 5 | — (agreement) | G24/G27, matrix P1-09/P4-06 | G24's receiver correction (slot45 on the slot25 result object, not [0xBE2788]) and G27's resolution match my D2 exactly; P4-06/P4-07 stale fields identified in D6 are fixed in the working tree consistently with my analysis; P1-09's predicted capture values ([ESI] vtable = 0x5042D224 ⇒ DLL-relative 0x2D224) check out. |

## 5. Files needing modification / stage-verdict impact

- Optional corrections only: claims.csv C-082/C-086 (drop or footnote the phantom "slot25 of 0x5042D204/0x5042D140" attributions; optionally note 0x5042D154 slot25 = 0x5040418C), G10/P4-07 ("exhausted" → bounded phrasing), C-083 (complete the cmp census list). No hashes, addresses, or readiness values need changing.
- **No difference affects the stage verdict.** P1-09 stays RE-GAP-STATIC pending the (now confirmatory) bp 0x666F77 capture; G24 keeps its runtime item; no phase reaches all-RE-READY. **NOT STAGE-READY stands** — my independent analysis, if anything, moves one formerly "open discrimination" to a "named-prediction confirmation" without closing any runtime dependency.

---

# Appendix B — Review Rounds 2 & 3 (added after each verification pass)

**Round 2 verdict: ACCEPT-WITH-CORRECTIONS.** Diffs 1–3 RESOLVED (reviewer re-verified the boundary dwords `[0x5042D1A4]=50403FBE, [0x5042D1B8]=5040418C, [0x5042D268]=50404E85, [0x5042D288]=5040418C` against the DLL and re-disassembled the class-2 ctor fragment 0x50401295 + QI 0x504013CA; G24/P1-09 two-vtable prediction checked out; EV-75/76 hashes matched). Residuals flagged: (a) MED — Diff-4 bounded phrasing survived in P4-07 `can_static_continue_or_runtime`, G10 `blocker`, and the T084.1 report §6 prose; (b) LOW — EV-75's structure comment said "inner 39-entry" where T224 is 36 entries (0x5042D224..0x5042D2B3) followed by the 3-entry teardown vtable 0x5042D2B4 installed by dtor 0x504018CD (3+5+36+3=47); (c) BLOCKING-mechanical — clean-room registers were stale pending regeneration. All EV hash bindings verified matching.

**Round 2 disposition (main agent):** all three applied — `t0841_round3_fixes.py` records the changes (EV-75 comment corrected and hash refreshed to `aed558d0…3489baf` in the same change; G10 blocker and P4-07 can_static re-bounded; report §6 reworded), clean-room regenerated, validator PASS.

**Round 3 verdict: ACCEPT-WITH-CORRECTIONS (one LOW prose residual).** Items 1 (validator PASS), 3 (EV-75 36-entry + hash match) and 4 (EV-74/EV-76 hashes) all PASS; item 2(a)/(b) PASS; item 2(c) — one live unbounded sentence remained in the report §6 G10 边界重述 (a text variant the round-2 replace had not matched).

**Round 3 disposition (main agent):** the sentence was reworded to the bounded form exactly as prescribed; final validator re-run PASS (0/0), unit tests 44/44 OK, clean-room in sync. Final logs captured in `T0841-VALIDATOR-LOG.txt` / `T0841-UNITTEST-LOG.txt` / `T0841-CLEANROOM-LOG.txt`.

**Final review status: ACCEPT (close-out) — see Appendix C.**

---

# Appendix C — Round 4 (final sign-off, verbatim)

> Round-4 final sign-off (independent Reviewer, same session as Rounds 1–3): The single Round-3 residual is resolved. T084-1-SLOT25-SCOPE-RECONCILIATION.md §6 "G10 边界重述" now uses the bounded form ("已检查的 EXE 镜像普查中未发现 Camera 写点（C-028/C-084 有界负结论，非全镜像断言）；已检查的 Gr2D 路径中未见 scene 字段生产者；尚未检查=普查之外的运行时写入者与 slot15 caller 链；G10 保持 OPEN-RUNTIME")， and a whole-file scan confirms every remaining 穷尽/EXHAUST occurrence is quoted-history, a withdrawal note, or the explicitly-scoped slot25 candidate-set boundary (different topic). Spot-checks: gaps.csv G10 status = OPEN-RUNTIME; validate_reverse_engineering.py = RESULT: PASS (0 errors, 0 warnings); no other files changed since Round 3 in a way affecting prior PASS items (ledger CSVs, EV-74/75/76 hash bindings, matrix P4-07/G10 bounded fields all intact). Final verdict for round T084.1: **ACCEPT** — all four Round-2 differences and the Round-3 prose residual are closed; stage verdict NOT STAGE-READY is unaffected.

All four differences were processed and fixed; the fixes were re-submitted to the same Reviewer for verification (Round 2 verdict: **ACCEPT** — see Appendix B).

- **Diff 1 (MED)**: claims.csv C-082/C-086, EV-75/EV-76, matrix P1-09, T084-GR2D-SLOT25-ANALYSIS.md §6 and the T084.1 report now carry the phantom-slot re-attribution ([0x5042D1A4] = T154 slot20; [0x5042D268] = T224 slot17; 0x5042D204 = 3-entry, 0x5042D140/0x5042D210 = 5-entry thunk tables) plus the class-2 long table 0x5042D154 (ctor fragment 0x50401295, QI 0x504013CA, shared intmap) whose slot25 @0x5042D1B8 = the same 0x5040418C. The G24/P1-09 capture prediction was widened to "vtable 0x5042D224 OR 0x5042D154".
- **Diff 2 (LOW)**: the false "EV-72 mid-table off-by-one" claim was withdrawn everywhere it had appeared (EV-75 header, C-087, T084-GR2D-SLOT25-ANALYSIS.md §6, readiness-report memo, T084.1 report draft); EV-72 is recorded as byte-accurate with the overlapping-window interpretation as the defect class. The main agent independently re-verified EV-72 row-by-row before accepting this difference (its own earlier claim had been based on a misreading).
- **Diff 3 (LOW)**: C-083/G38/EV texts and the T084.1 report now enumerate the completed imm-0x81 census (0x77E6F3 sub; cmp 0x5414A1/0x62B75D feeders of the same channel dispatcher; 0x75A0AB/0x9355A9 unrelated range checks).
- **Diff 4 (LOW-MED)**: G10 verified_scope and matrix P4-07 minimum_next_work now use bounded phrasing ("not found in the examined EXE-image censuses … not an unbounded whole-image claim"); G10 remains OPEN-RUNTIME.
