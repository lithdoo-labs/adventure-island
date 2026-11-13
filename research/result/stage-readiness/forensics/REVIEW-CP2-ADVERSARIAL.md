# CMS079 Adversarial Review — Round 2 (CP2)
## Independent reviewer audit of the lead agent's five forensic records (t080)

Reviewer: same independent subagent as CP1 (blind report: `reviewer-t080\CP1-BLIND.md`).
Date: 2026-11-14. Binaries re-hashed this round: EXE dump `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718`, Gr2D `ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1` — unchanged, match CP1.
Harness: same CP1 harness (`reviewer-t080\harness.py` + new `cp2_*.py` scripts). All WP2–WP5 claims below were re-derived from raw bytes by me; WP1 items already byte-verified in CP1 were cross-checked against the lead's text rather than re-derived.

---

## WP1 — G36/G37 (tiling 0x66A8D5) — verdict table

| Lead claim | My independent result | Verdict |
|---|---|---|
| ret 0x24 @0x66B4A2, 9 stack args, thiscall, 3 callers (0x667EB1/0x66A40E/0x66A80B) | Identical to CP1 byte-verification (extent 0x66A8D5–0x66B4A4; E8/dword scan: no other refs) | **ACCEPT** |
| Parameter table incl. arg8 correction ("a8 uninitialized; 0x667E8C writes a9 not a8") | Matches CP1 exactly (a8 = garbage at all 3 sites; a9 = handle/0) | **ACCEPT** |
| arg9 bg = caller `[ebp-0x60]` = `+4` of `[ebp-0x64]` out-struct of `0x671B59` (0x66996B) | Matches CP1 §13.6 resolution | **ACCEPT** |
| Mode dispatch (bit0/bit1 consumed 0x66AA19/0x66AA58 before slot reuse; 3-phase `[ebp+0xC]` reuse) | Matches CP1 §6 | **ACCEPT** |
| Zero-step fallbacks (slotB8/C0 + 1−(1<<item0.slot58); Obj rect diffs at [this+0x38]) | Matches CP1 §7 | **ACCEPT** |
| Span formula/unsigned div/divisor=step?step:1; loop bounds; per-axis iteration count | Matches CP1 §8 | **ACCEPT** |
| Per-tile flow (0x427EB3 out=&[ebp+0xC]; child loop; ids 0x155D/0x1550/0x1551 defaults −1 latter two; 0x427DE0=call [ecx+0x104] ret 0x1C; +0x90 draw at (x−x0,y−y0); +0x9C rect; +0xFC/+0xE0; 0x671234 registration) | Matches CP1 §9 (I verified the 0x7a48d0 line-ids 0x155D/0x1550/0x1551 and `push -1` defaults for the latter two at 0x66AC45/0x66ACC6; 0x155D's arg block pushes 0x78) | **ACCEPT** |
| §6 arg order in the +0x90 call: "([ebp-0x2c]−[ebp-0x50], [ebp-0x24]−[ebp-0x54], V, V)" | Actual stack order after `this`: **arg1 = x−x0 = [ebp-0x24]−[ebp-0x54]** (pushed 0x66B041), arg2 = y−y0 (pushed 0x66B038). Record lists them y-first | **ACCEPT-WITH-CORRECTION** (order as written is swapped; CSV/EV do not carry this detail) |
| FSDB audit: Back 387 = {0:109, 1:155, 2:36, 3:9, 4:78}, no 5/6/7; all 387 have cx==0 or cy==0 | Re-ran counts myself (13 jsonl files): **identical** (type dist exact; inclusion-exclusion 216+359−188=387 ⇒ all records have cx==0 or cy==0) | **ACCEPT** |
| Obj 1817 = flow {0:1762, 1:55}, all flow=1, cx/cy absent, rx −12..12, rx not an argument of 0x66A8D5 | Counts match (absent→0 semantics OK; all flow=1; cx/cy all absent). **BUT rx range is −15..15** (distinct: −15…−5, 7…15), not −12..12 | **ACCEPT-WITH-CORRECTION** (rx range wrong) |
| idiv-hazard unreachable in 13-map scope (no type4–7 with rx==0 or ry==0) | My scan: 78 type-4 records, 0 with rx==0, 0 with ry==0 | **ACCEPT** |
| §7/§12 Gr2D vtable 0x5042D140 = 40 slots, slot25=0x50403FBE trivial setter ret 8; runtime-binding constraint | Matches CP1 (40-entry scan + body disasm). Constraint is sound DERIVED-FROM-INSTRUCTION | **ACCEPT** |
| §9 note: "type2 → mode bit1 only (vertical); any doc claiming type2 tiles horizontally is wrong" | Matches CP1 (bit1-only) | **ACCEPT** |

**WP1 overall: ACCEPT** (two minor corrections: +0x90 arg order in record §6; Obj rx range −15..15).

## WP2 — G38 (portal) — verdict table

| Lead claim | My independent result (addresses) | Verdict |
|---|---|---|
| Trigger gate: 0x963CE1 `call 0x994c7a`; [esi+0x28F0]==0 required; armed gate [0x2900]≠0 && [0x2904]−now>0 → blocked | Byte-verified: 0x963CE1/0x963CE6/0x963CFE/0x963D06-0x963D10 | **ACCEPT** |
| 0x963D42 `push [ebp+0x14]; ecx=[0xBDEB48]; call 0x71B4C0`; record +0xC=X/+0x10=Y | Byte-verified 0x963D42–0x963D5E | **ACCEPT** |
| Y−10 at **0x963D6D** (same-map applies −10 too) | `sub edi,0xA` @0x963D6D ✓ | **ACCEPT** |
| (Reviewer addendum) trigger foothold gate | 0x963D64–0x963D79: portal trigger calls **0xA4F6F1(X, Y−10, 0, 0x7FFFFFFF, 1)** and requires a nonzero result — a foothold probe with **halfWidth=1** (see WP3 R12) — not mentioned in G38 | ACCEPT (addition) |
| Pending stores: [0x28F8]=X @0x96423F, [0x28F0]=1 @0x964247, [0x2900]=now @0x96425A, [0x28FC]=Y @0x964263, [0x2904]=now+0x78 @0x964260/69 | All byte-verified; plus an extra store **[esi+0x28F4]=eax @0x964251** (portal id) not listed in the record — omission, not error | **ACCEPT** |
| Apply 0x9552F0: now; pending check; armed gate [0x2900]−now>0→ret; X=[0x28F8] Y=[0x28FC]; this=[user+0xF28] (ATL outer, −0xC adjust); `call [vt+0x40]`(this,X,Y) | All byte-verified 0x9552F0–0x95533D (−0xC adjust at 0x95532B-0x955338; call shape exact) | **ACCEPT** |
| Mirrors +0xEF0/+0xEF4/+0xEE8/+0xEEC, clear +0x28F0, [0x2900]=now, [0x2904]=now+0x258 @0x955387 | All byte-verified 0x955350–0x955393 | **ACCEPT** |
| 0x9C1113 at vtable slot+0x40 in **8 sibling vtables** (dwords 0xB0C428…0xB0CC08; table starts 0xB0C3E8/0xB0C5B0/0xB0C6B0/0xB0C7C0/0xB0C8C0/0xB0C9C0/0xB0CAC0/0xB0CBC8) | Re-scanned dwords myself: **exactly those 8 hits**, table-start arithmetic checks out | **ACCEPT** |
| 0xB0CB70 slot16 = 0x9BC4F5 = `mov eax,0x80004005; ret 0x24` (E_FAIL stub) | Byte-verified (dword @0xB0CBB0; body at 0x9BC4F5) | **ACCEPT** |
| (Reviewer addendum) fresh move-state vtable | ctor `0x9D34FA` (called by 0x9D359D) writes **`[esi]=0xB0CB70`** @0x9D352F → a freshly created move object has slot+4=0x9BC622 but slot+0x40=E_FAIL — sharpens the "live vtable is runtime state" limit with a concrete initial state | ACCEPT (addition) |
| 0x9C1113 body: ret 0xC (3 args); [this+0x104]=0; RNG pair via 0x9BFD85; encrypted setters X→inner+0x20 & copy, Y→inner+0x38 & copy; fldz velocity zeroing; trailer [x]≠0→0x53E95D(x,3) | Core verified: ret 0xC @0x9C11F8; [ebx+0x104]=0 @0x9C111C; 0x9BFD85 @0x9C1133; X→this+0x14 @0x9C1166 and this+0x74 @0x9C1151; Y→this+0x2C @0x9C1192 and this+0x8C @0x9C117F; fldz setters; trailer 0x9C11E2–0x9C11F0. **BUT four offsets in the record are wrong** (see discrepancies) | **ACCEPT-WITH-CORRECTIONS** |
| Cross-map: 0x97EC37 calls 0x9507F0(ecx=[esi+8]) inside 0x97EBC9 | Byte-verified 0x97EC2F (call 0x980A8C), 0x97EC34-0x97EC37 | **ACCEPT** |
| Spawn byte [edi+0xD1]&0x7F, bit7 alternate; portal table [[0xBDEB48]+4] stride 8, entry=[base+idx*8+4], record +0xC/+0x10 | Byte-verified 0x950835–0x950886 | **ACCEPT** |
| Alternate path 0xA49808 + 0x3B9AC9FF sentinels; 0x9D359D; 0x971BC8(user+0xF28,&obj) | Sentinels @0x9508A5-0x9508BE ✓; 0x9D359D ✓ (0x248-byte alloc); 0x971BC8 spot-checked ✓ | **ACCEPT** |
| Position write 0x950951–0x95096D: `call [vt+4]`(1, X, Y−10, 0, 0, user+0x3C0, 0); Y−10 @0x950964 | Byte-verified exactly (pushes 0x950958–0x95096D; `add eax,-0xA` @0x950964) | **ACCEPT** |
| m1 = 0x9BC622: [move+0x18]=1; X clamp [0x138..0x140], Y clamp [0x13C..0x144]; fild→0x6131F4 at move+0x20 (X) / +0x38 (Y); zeros +0x50/+0x68; fh hint [userfield+0x1C/+0x20]→move+0x130/+0x134 when [0x110]≠0 | Byte-verified 0x9BC622–0x9BC6FB (clamps 0x9BC644-0x9BC673; setters 0x9BC676-0x9BC6BC; [ebx+0x18]=arg1 @0x9BC63B; hint read [edi+0x1C] @0x9BC6FB with edi=arg7=user+0x3C0) | **ACCEPT** |
| Cross-map mirror 0x95B8B0-0x95B8E7: [0x28F8]/[0x28FC]=x/y; [0x2900]=V; [0x2904]=V+1 | Byte-verified exactly (V+1 via inc @0x95B8E0) | **ACCEPT** |
| Reset writers 0x4B6DCB/0x4B6DD1 bulk-clear +0x28CC..+0x28FC | Bulk `mov [esi+0x28xx],edi` chain verified; actual instruction addresses **0x4B6DCA/0x4B6DD0** (record's +1 = displacement bytes); visible range starts +0x28E0 in my window (+0x28CC store is just above, not re-dumped) | **ACCEPT** (cosmetic address nit) |
| "write-then-rebind" ordering (coordinate setters run before 0x9BC89F/0x9BC992 rebind) | Supported at call-sequence level: setters at 0x9BC676-0x9BC6BC precede the 0x9BC6FB+ hint/rebind code path in the same invocation | **ACCEPT** (sequence-level; rebind bodies unread, as the record itself notes) |
| Opcode 0x81 = WARP_TO_MAP (corpus A-grade; dispatch byte-binding unverified) | Consistent labeling; not re-derived (corpus item). No overreach | **ACCEPT** (as labeled) |

**WP2 overall: ACCEPT-WITH-CORRECTIONS** — four setter-offset errors inside 0x9C1113 (below), plus omissions that do not change conclusions.

## WP3 — G40/G41 (movement) — verdict table

| Lead claim | My independent result | Verdict |
|---|---|---|
| Climb `y += 3·verticalKey`: fild [move+0x154] @0x9D814F; **fmul qword [0xB00D68]**; double @0xB00D68 = 3.0; faddp; 0x6131F4(move+0x38); [move+0x48]=ret | Byte-verified; **0xB00D68 = 3.0 exactly** (raw 0x4008000000000000) | **ACCEPT** |
| [move+0x158]≠0→0x9BD567; publish [[0xBDE960]+0x285C]=[move+0x150]; [move+0x178]≠0→0x9BD58F; rope via 0x4B6ABE(&move+0x124, move+0x12C) null→exit; y_cur via 0x548806(&move+0x38) | All byte-verified 0x9D80F6–0x9D814A | **ACCEPT** |
| Endpoint clamps: down: y<[rope+0x10] → ([rope+8]≠0 ? bottom−5 : re-decrypt rope+0x10); up: y>[rope+0x14] → top+1 | Byte-verified 0x9D816B–0x9D81F6 (`add ecx,-5` @0x9D8198; `inc edi` @0x9D81F2) | **ACCEPT** |
| Exit: `call [move.vtable+0x14](move, 0, rope, 0)` | **WRONG args**: pushes are `ebx,ebx,ebx` @0x9D8206/0x9D8207/0x9D820D → **(move, 0, 0, 0)** — no rope on the stack | **ACCEPT-WITH-CORRECTION** |
| Seat rect (0x96595A–0x96597C): table [field+0x16C] stride 8; x−10/y−30/x+10/y+30 | Byte-verified 0x96594C-0x96597C (`sub 0xA`/`sub 0x1E`/`add 0xA`/`add 0x1E`) | **ACCEPT** |
| Seat writer 0x9658CC: [0xBD9028+0x2088]=0; [+0x208C]=now; not-sitting 0x6131B9(0,&user+0x2944)→[user+0x294C]; sitting 0x4259A2→idx; hit via [0xBE1734]; inside→0x6131B9(1,…)→[0x294C]; 0x4B1C27→0x9D35F2(move, seat_x, seat_y) | All byte-verified 0x9658CC–0x9659CA (0x6131B9 calls at 0x96590A/0x9659A0; [0x294C] stores at 0x965915/0x9659A5; [0xBE1734] @0x96598D; 0x9D35F2 @0x9659CA) | **ACCEPT** |
| Seat arrival reuses teleport trigger: mirrors rec+0xC/+0x10→user+0xEE8/+0xEEC; 0x963C7D(user,0,0,rec+4,rec+0x20,1) | Byte-verified in the 0x96585C function (0x9658A2–0x9658C2) | **ACCEPT** |
| 0x9C4B08 switch [move+0x238]∈{0→0x9C4BB0, 1→0x9C4D5D, 2→0x9C4F05, 3→(0x9C538E,0x9C5672)} | Byte-verified 0x9C4B08–0x9C4B43 (exact) | **ACCEPT** |
| Countdown [move+0x240]≠0 && [0x244]==0 → [0x248]−=dt; negative → 0x9C3E1C(move,0,0,0); 0x9BCD6C(move,dt) main tick | Byte-verified 0x9C4B44–0x9C4B6D; dispatcher itself is `ret 4` (single dt arg) → dt caller-supplied; 0x9BCD6C body: [0x170]=[0x16C], [0x158]→0x9BD567, [0x178]→0x9BD58F ✓ (0x9BCD88-0x9BCD9F) | **ACCEPT** |
| 0x9BF1FA head: push [arg2]/arg1 → 0x9BF9D3; 0x548806(arg1+0x10); fcomp [0xAFECC0] ("likely 0.0"); fh neighbors [fh+0x4C]→[fh+0x50]; edi≠ecx guard; fld [edi+0x30] slope | Byte-verified 0x9BF1FA–0x9BF283. **[0xAFECC0] = 0.0 exactly** (byte-read). Neighbor read confirmed at 0x9BF259/0x9BF264. Record omits the second decrypt pair (move+0xE0/0xF0 @0x9BF230-0x9BF24D) — omission only | **ACCEPT** |
| 0x9BF160 = integer cross-product orientation test | Verified (imul/sub chains) | **ACCEPT** |
| 0xA4F6F1: args x/yTop/?/yBottom/halfWidth; yBottom<yTop→0; 0x5114AA(collection+0x44, x−halfWidth, yTop−1, x+halfWidth, yBottom, &{0xB00D88}) | Byte-verified 0xA4F6F1–0x9BC740: `lea ebx,[edi+eax]` (x+w) @0xA4F732, `dec edx` (yTop−1) @0xA4F735, `sub edx,eax` (x−w) @0xA4F73A, out=&{0xB00D88} @0xA4F71D/0xA4F72D. **halfWidth = [ebp+0x18] parameter CONFIRMED**. Note: 0xB00D88's static content (low dword 0x5115B6 — a code address) is not a sane double default; it is a default/marker slot the callee overwrites | **ACCEPT** (R12 "caller-dependent" stands) |
| (Reviewer addendum) one concrete halfWidth data point | The same-map portal trigger calls 0xA4F6F1 with **halfWidth=1** (push 1 @0x963D64), yBottom=0x7FFFFFFF — partially answers G40's "call-site audit pending" | ACCEPT (addition) |
| Shoe owner pair 0x94B9C2/0x9BFD4C | Spot-checked 0x94B9C2 shape as described (reads +0x20, refcount via [0xAFE1BC]); 0x9BFD85 family co-location consistent with 0x9C1113 usage | **ACCEPT** (as labeled; family-level) |
| rope grab 0xA4FC6F, walk-state body, 0x9BFB52 beyond head — OPEN | Not re-derived (honestly marked OPEN) | n/a |

**WP3 overall: ACCEPT-WITH-CORRECTIONS** (exit-vcall args wrong in record/claim; one "double@0xB00D88" labeling caveat).

## WP4 — G39 (animation clock) — verdict table

| Lead claim | My independent result | Verdict |
|---|---|---|
| 0x66A136 `[resource.vtable+0x110]` HRESULT-checked registration; 0x66A1BB `[eax+0xD8](obj, flag=[ebp-0x20]≠0)`; origin via item0 slots +0x6C/+0x74 (0x4100A1/0x4100C8) | Matches CP1 byte-verification (0x66A136/0x66A1BB/0x66A1D1-0x66A26E) | **ACCEPT** |
| 0x43715C = vtable+0x58 slot read (not GetTickCount) | Matches CP1 (wrapper body, out returned in EAX, plain ret) | **ACCEPT** |
| Scroll phase VT_I4 delivery at 0x66A63A–0x66A692 (V{VT_I4,sum} + V{VT_I4,0x10000000} into second +0x90) | Matches CP1 §11 (ZVariant(sum) built at 0x66A64B; draw at 0x66A692) | **ACCEPT** |
| **"0x66B544 reads EXACTLY two string-id properties (0x54F, 0x550)"; historical 5-attr claim CONTRADICTED-IN-PART** | **REJECTED.** True function extent = 0x66B544–0x66BC80 (next EH-prolog fn at 0x66BC81). Census of the WHOLE function: **six** `call 0x7a48d0` sites — property reads with ids **0x54F→[ebp-0x1C] (0x66B5BB), 0x550→[ebp-0x18] (0x66B634), 0x551→[ebp-0x28] (0x66B776), 0x552→[ebp-0x20] (0x66B7F0), 0x553→edi (0x66B86D)** — each a full 0x414A49/0x404BA3/0x40263B/0x403AC7/0x415344 chain on **item0** ([ebp-0x14] = 0x426F74(arg1, V{VT_I4,0}) at 0x66B58E) — plus a sixth 0x7a48d0 (id **0x31D**, 0x66B96E) that is the **layer-object creation** (0x40634C + 0x447891), not a property read. Dispatch on [ebp-0x1C]∈{0,1,2,3} at 0x66B9A0-0x66B9BA (= moveType switch) and rate-sign handling on the 0x553 value at 0x66B9C0-0x66B9CC. **The historical five-attribute claim (moveType,moveR,moveW,moveH,moveP) is SUPPORTED at byte level (5 property chains); the lead's "exactly two / CONTRADICTED-IN-PART" is a window-truncation error — their scan window 0x66B544–0x66B760 ends 0x16 bytes before the 0x551 site.** | **REJECT** (C-059/EV-40 and the G39 gap note must be corrected) |
| Frame-delay unit/accumulation OPEN-RUNTIME | Agreed (bodies runtime-bound) | **ACCEPT** |

**WP4 overall: ACCEPT except the 0x66B544 property-count claim → REJECT** (record §2, C-059, EV-40, G39 note).

## WP5 — R13/G27 (0x427EB3 out-semantics) — verdict table

| Lead claim | My independent result | Verdict |
|---|---|---|
| 0x427EB3 epilogue 0x427F01–0x427F09: `eax=[ebp+8]; ecx=[ebp+0x24]; mov [eax],ecx; ret 0x20` — arg1 is OUT; out = post-slot25 arg8-slot dword | Matches CP1 byte-verification exactly | **ACCEPT** |
| Tile path pushes 0x666E8C–0x666ED5: V{error}@[ebp-0x48] (0x40318F, 0xBE7330); 0x411FE1(&[ebp-0x38], [ebp-0x14], 1) packs V{VT_UNKNOWN(0xD), layer}+AddRef; ecx=[0xBE2788]; push &[ebp-0x48](arg8)/&[ebp-0x38](arg7)/ebx×3(arg4-6)/edi(arg3)/[ebp-0x20](arg2)/&[ebp-0x10](arg1=OUT); call 0x427EB3 | **Every push byte-verified** (0x666E8C-0x666ED5). 0x411FE1 verified: `mov word [esi],0xd; mov [esi+8],eax; AddRef [eax]` ✓ | **ACCEPT** |
| arg2 "(name/property id)", arg3 "(pre-key property value)" | **Imprecise labels**: arg2 = [ebp-0x20] = `0x403211` int of property id **0x331 ("x")** (read chain 0x666D9F-0x666DC9); arg3 = edi = int of id **0x332 ("y")** (0x666E19-0x666E1E). These are coordinate ints (or pointer-carrying variant payloads), not a "name". The verdict-table wording "(name, key-property, …)" should read "(x-int, y-int, 0, 0, 0, V{layer}, V{missing})" | **ACCEPT-WITH-CORRECTION** (labels; order is correct) |
| 0x666F5D tile-key imul chain (EV-01); 0x666F6F 0x42944A → [slot]; 0x666F79 vtable; 0x666F7D `call [eax+0xB4]`(key) | All byte-verified (imul 0xBB8 @0x666F5D; esi/eax moves at 0x666F77/79; call at 0x666F7D) | **ACCEPT** |
| 0x42944A = one-level deref + E_POINTER check, **not** attach/AddRef | Matches CP1 (push esi; cmp [esi],0 → fail; eax=[esi]; ret) | **ACCEPT** |
| [ebp-0x10] last-write audit: only the 0x427EB3 out (0x666ED1 passes &[ebp-0x10]); Released via `call [[ebp-0x10]+8]` at 0x667000 | Byte-exhaustive re-scan (all `89 4x e0/f0`-style + disp32 patterns) of 0x666C0D–0x667052: [ebp-0x10] is only ever address-taken (0x666ED1/0x666F6F/0x666FE6) or read; Release at 0x666FF5–0x667003 (vtable load @0x667000, call @0x667003) | **ACCEPT** |
| Reframe: "arg order was never wrong; the open question is the runtime out-write binding" | Supported: pushes match out-first order at all three 0x427EB3 call shapes (tile path, tiler 0x66AB1E, loader 0x669BE1); the static Gr2D slot25 body never writes the out slot, so `*out = &V{error}` would fault downstream — the runtime binding must write an object pointer. Sound DERIVED-FROM-INSTRUCTION constraint | **ACCEPT** |
| (Reviewer addendum) unresolved local anomaly, logged for next round | 0x666DC9 stores an **int** (id 0x331 read) into [ebp-0x20], yet 0x666FAC-0x666FBA conditionally Releases [ebp-0x20] as a COM object (`call [[eax]+8]`, guarded by SEH state 0x15 set at 0x666FB1). No intervening store exists (byte-scanned). Either the property variant carries a pointer at +8 that `0x403211` returns, or the slot doubles as an EH-scope object. Does not affect the audited claims; flag for the next round | logged |

**WP5 overall: ACCEPT** (arg2/arg3 semantic labels need correction; anomaly logged).

---

## Discrepancy list (address-level)

| # | Record/claim | Lead says | Bytes say | Severity |
|---|---|---|---|---|
| D1 | G39 §2 / C-059 / EV-40 / G39-gap-note | 0x66B544 reads exactly two string-id props (0x54F/0x550); historical 5-attr claim unsupported; window "0x66B544-0x66B760" | **Five** property chains (0x54F→[ebp-0x1C] @0x66B5BB, 0x550→[ebp-0x18] @0x66B634, 0x551→[ebp-0x28] @0x66B776, 0x552→[ebp-0x20] @0x66B7F0, 0x553→edi @0x66B86D) + sixth 0x7a48d0 (0x31D @0x66B96E) = layer creation. Historical 5-attr claim SUPPORTED | **HIGH (REJECT)** |
| D2 | G38 §1.4 / EV-35 / (C-054 OK) | X second copy at "inner+0x68"; Y second copy at "inner+0x80"; zero setters "inner+0x44/0x4C/0x5C/0x64-family" | X2 = **inner+0x80** (this+0x74, call @0x9C1151); Y2 = **inner+0x98** (this+0x8C, call @0x9C117F); zero setters at **inner+0x50/0x68/0xB0/0xC8** (this+0x44/0x5C/0xA4/0xBC, calls @0x9C11A4/0x9C11B6/0x9C11C8/0x9C11DA). Primaries inner+0x20 (@0x9C1166) / inner+0x38 (@0x9C1192) correct | MEDIUM |
| D3 | G38 §1.4 | RNG pair-sum at "[inner+0x120]" | `mov [esi+0x12c],eax` @0x9C113B (esi=inner) → **inner+0x12C** | LOW |
| D4 | G40 §1 / C-056 / EV-37 | exit vcall `[move-vt+0x14](move, 0, rope, 0)` | pushes ebx,ebx,ebx @0x9D8206/07/0D → **(move, 0, 0, 0)** — no rope argument | MEDIUM (claim text wrong; motion math unaffected) |
| D5 | G36 §9 | Obj flow rx range "−12..12" | **−15..15** (distinct −15…−5, 7…15; 55 records) | LOW |
| D6 | G36 §6 | +0x90 arg listing "(y−y0, x−x0, …)" | actual arg order after this: **(x−x0, y−y0)** (pushes @0x66B041/0x66B038) | LOW |
| D7 | R13 §3 | arg2 "name/property id", arg3 "pre-key property value" | arg2 = int of property id 0x331 ("x") @0x666DC9; arg3 = int of id 0x332 ("y") @0x666E1E | LOW (labels) |
| D8 | G38 §1.3 | reset writers "0x4B6DCB/0x4B6DD1" | instruction starts **0x4B6DCA/0x4B6DD0** (cited +1 = disp byte) | COSMETIC |
| D9 | G40 §7 | out default "double@0xB00D88" | static content low-dword = 0x5115B6 (code VA) — not a sane double; treat as default/marker slot only | LOW |
| D10 | C-048 wording | arg8/9 as "{0, container-struct}" | arg8 is **uninitialized** at all sites (record's own table says so; claim text simplifies to "0") | COSMETIC |

## Consistency audit

- **Inflated grades**: none found beyond the D1 case — G39 §2 marks its (wrong) two-read claim implicitly DIRECT and even escalates it into a "historical discrepancy"; with five chains present this is both wrong and grade-inflated (the scan was not exhaustive of the function). All runtime-bound items are correctly demoted to UNVERIFIED/OPEN-RUNTIME across the records.
- **Single-map-sample overgeneralization**: the FSDB numbers are properly scoped ("13-map set"); scroll-remap 6/7→3 correctly labeled dead-in-scope; no overreach spotted. The `idiv`-hazard reachability claim is correctly scoped to the 13 maps.
- **Retracted-claim violations (C-006/C-008/C-012/C-013/C-015/C-016/C-018/C-021/C-042)**: none. C-053 does not name a class (C-006 safe); does not call 0x427EB3 a creator (C-008 safe); [eax+0xB4] stays "slot45, semantics runtime" (C-012/C-013 safe); HRESULT-check reading not re-labeled comparator (C-015 safe); C-052's differing registration targets actually reinforce C-016; C-018/C-021/C-042 untouched.
- **Ledger↔record consistency**: C-048..C-058, C-060 ↔ records consistent (minor wording drift D10 in C-048; D4 propagated into C-056/EV-37; D2 propagated into EV-35). **C-059/EV-40 and the G39 gap note carry D1 and must be rewritten** (five reads: 0x54F/0x550/0x551/0x552/0x553; sixth 0x7a48d0 = creation id 0x31D; historical 5-attr claim now byte-supported; moveType = [ebp-0x1C] switch @0x66B9A0, rate-like sign handling on 0x553 value @0x66B9C0-CC). G24/G27 reframing rows are consistent with my WP5 verification.

## Unresolved disputes

1. **D1** — I hold that 0x66B544 reads five string-id properties; the lead's record/claim says two. My census is exhaustive over the true function extent (0x66B544–0x66BC80, next EH-prolog at 0x66BC81) and lists every chain address. REJECT stands unless the lead can show the 0x551/0x552/0x553 chains (0x66B776/0x66B7F0/0x66B86D) are unreachable — the straight-line dispatch at 0x66B9A0-0x66B9BA consuming [ebp-0x1C] and the 0x44484B calls consuming [ebp-0x28]/[ebp-0x20]/edi indicate they are live.
2. **0x666FAC anomaly** (WP5 addendum) — [ebp-0x20] stored as int @0x666DC9, Released as object @0x666FAC-0x666FBA. Not a dispute with the lead (they did not claim it), but it constrains any future emulation of the tile path.

## Overall verdicts

- **WP1 (G36/G37): ACCEPT** — matches my CP1 byte-verification throughout; corrections D5/D6.
- **WP2 (G38): ACCEPT-WITH-CORRECTIONS** — every structural claim verified byte-level (gates, slots, Y−10 ×2, clamps, mirrors, 8-vtable enumeration, E_FAIL stub, fresh-state vtable=0xB0CB70); corrections D2/D3/D8.
- **WP3 (G40/G41): ACCEPT-WITH-CORRECTIONS** — climb/seat/tick/0xA4F6F1 all verified incl. 3.0 constant and fh+0x4C/+0x50; correction D4 (exit args), caveat D9; bonus: portal halfWidth=1 data point.
- **WP4 (G39): REJECT on the 0x66B544 property-count claim** (D1 — five chains, not two; historical 5-attr claim supported); the rest of G39 (§1, §3) ACCEPT.
- **WP5 (R13/G27): ACCEPT** — out-write epilogue, push reconstruction, [ebp-0x10] audit, 0x42944A semantics, and the reframe all verified; label correction D7; anomaly logged.

---

# FINAL-CHECK (pre-commit scope review, 2026-11-14)

## 1. Commit scope - PASS
- `git status --short`: 13 modified files, ALL under `research/` (source-of-truth x4, clean-room x4, REVERSE-ENGINEERING-GAP-REGISTER.md, stage-readiness x4) + untracked: 3 new stage MDs and `forensics/` (5 lead records + 2 archived reviewer reports). Nothing outside research/.
- `components/RENDER-NODE-ABI-V1.md`: untouched (empty status).
- `loom-realm` submodule: `93648192323bf5f57996b7b54cbae641d8a53fdb` unchanged.
- No .bin/.dll/.exe/.wz anywhere in status or staged; nothing staged at all.

## 2. Delta spot-checks since CP2
- C-048 arg8 wording -> "{uninit dword, container-handle} struct" (my D10 applied).
- C-049 address field -> 0x667EA0(obj flow) (the flow push I verified in CP1).
- C-056 exit args -> "(move,0,0,0)" (my D4 applied).
- C-059 -> five-property rewrite (my D1 applied; matches my census 0x54F..0x553 + moveType switch + rate-sign; EV-40 rewritten with my exact addresses and full extent 0x66B544-0x66BC80; G39 gap row rewritten).
- C-054 second-copy offsets - PARTIALLY applied: the G38 record body was corrected (inner+0x80/this+0x74 @0x9C1151; inner+0x98/this+0x8C @0x9C117F; zero setters inner+0x50/0x68/0xB0/0xC8; pair-sum inner+0x12C), BUT EV-35's detail string and the G38 record's verdict-table row still carry the stale "(+0x68/+0x80 copies)". Frame check: no consistent base yields (+0x68,+0x80) as the (X2,Y2) pair - this-frame is (+0x74,+0x8C), move/inner-frame is (+0x80,+0x98); +0x68 in move frame is a velocity-ZERO slot (this+0x5C). C-054's own claim text (move+0x20/+0x38) is correct and unaffected.
- Statuses: C-048..C-060 all CLOSED-STATIC; each backed by my CP2 ACCEPT / ACCEPT-WITH-CORRECTIONS with corrections applied - except the EV-35 residual above. Runtime caveats retained in rationale/falsifier fields (no grade inflation).

## 3. Stage docs - PASS
- The three new MDs faithfully summarize reviewed evidence; no new unaudited factual claims; hashes in STATIC-FORENSICS-REPRODUCTION.md match my verifications; the reproduction recipe matches my methodology.
- P0-P4 matrix: column-level diff shows ONLY P4-04 changed readiness status (RE-GAP-STATIC -> RE-READY, col 18), backed by my WP2 ACCEPT-WITH-CORRECTIONS with corrections applied; its note honestly retains "opcode dispatch byte-binding not done". All other changed rows only updated Claim/Evidence refs, gap notes, next-step text - consistent with my verified findings (P1-13 "rx not an argument", P3-06 "portal halfWidth=1", P3-15 "0xCF registration still unproven").
- INDEPENDENT-STATIC-REVIEW.md summarizes my reviews accurately; archived forensics/REVIEW-CP2-ADVERSARIAL.md is byte-identical to my original (22871/22871 chars).

## 4. Validator - PASS
python research/scripts/validate_reverse_engineering.py -> PASS (0 errors, 0 warnings); Claims 60 / Gaps 41 / Evidence 41.

## 5. git diff --check - PASS (clean; only pre-existing LF/CRLF conversion notices, no whitespace errors).

## Verdict

BLOCKING (1 item, trivial fix):
- research/source-of-truth/evidence.csv EV-35: replace "(+0x68/+0x80 copies)" with "(+second copies +0x80/+0x98 in move frame = this+0x74/+0x8C)" - and the same stale pair in forensics/G38-PORTAL-ARRIVAL.md verdict-table row ("same-map writes ... (+second copies +0x68/+0x80)"). This is my CP2 discrepancy D2, applied in the record body but not in these two strings; a grade-A evidence row must not carry wrong instruction offsets.

Non-blocking nits (fix at will, do not hold the commit):
- C-059 address column still shows the truncated window "0x66B544-0x66B760" (claim text already carries the full extent).
- C-057 rationale typo "0x2544" (claim text correctly says user+0x2944).
- INDEPENDENT-STATIC-REVIEW.md says "D2-D10 all applied" - slightly overstated until the EV-35/table fix lands.

COMMIT-APPROVED after the single EV-35/G38-table string fix above; everything else in scope, faithful, validated, and clean.
