# T083 INDEPENDENT STATIC FORENSICS REVIEW — REVIEWER REPORT

- **Reviewer role**: independent static forensics reviewer (subagent), t083 round of the CMS079 client reverse-engineering evidence reconciliation.
- **Repository audited**: `C:\Users\lithd\Documents\GitHub\adventure-island` (branch `design/adventure-field-map-scene`, working tree as found 2026-11-14; repo read-only for this review — no repo file was modified).
- **Method**: all conclusions below were re-derived from raw sources (the linear EXE image, the FSDB jsonl data, the CSV ledgers, and read-only `git show`) using the reviewer's own harness in `C:\Users\lithd\AppData\Local\Temp\opencode\t083-reviewer\` (`rvdis.py`, `rv_a_fsdb.py`, `rv_a_fixup.py`, `rv_c_scan.py`, `rv_c_args.py`, `rv_e_matrix.py`, `rv_e_stale_scan.py`). No t083 output was trusted as input to any verdict.
- **Binary identity (recomputed)**: `.work/task-036/game-image-unpacked.bin`, size 10,330,112 bytes (0x9DA000), SHA-256 `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` — **matches** the hash claimed in the task and used by all EXE-backed evidence rows. Image treated as linear dump, fileOffset = VA − 0x400000.

---

## REVIEW A — EV-63 / FSDB manifest

### Independent recount (my own scan of `content/[FSDB]adventure/[group]map.{Foothold,Rope,Seat}`)

23 jsonl files total (13 Foothold + 7 Rope + 3 Seat). Every file parsed line-by-line as JSON; every map id checked against the 13-map allowlist.

**Foothold (13 files, all 13 allowlist maps present):**

| map | records | | map | records |
|---|---:|---|---|---:|
| 222000000 | 376 | | 230020100 | 188 |
| 222000001 | 18 | | 230020200 | 355 |
| 230000000 | 240 | | 230020300 | 144 |
| 230000001 | 40 | | 230030000 | 172 |
| 230000002 | 184 | | 230030100 | 144 |
| 230000003 | 130 | | 230030200 | 247 |
| 230020000 | 45 | | **TOTAL** | **2283** |

- All 2283 records carry the full field set `{layer, platform, id, x1, y1, x2, y2, prev, next}` (single uniform field-set; 2283/2283 have prev+next).
- Degenerate (x1==x2 && y1==y2): **0**. Strict-vertical (x1==x2): 676; v-dominant (|dy|>|dx|): 738; **max per-map v-dominant count = 248 in 230020200** (next highest 119 in 230030200). Max v-dominant segment *length* is 172 (map 222000001) — the EV-63 phrase "max 248 in 230020200" is a per-map **count**, not a length (wording is ambiguous but the number is reproducible as the count).

**Rope (7 files: 222000000, 222000001, 230000001, 230000002, 230000003, 230020200, 230030100):** 16 records; **ladder (l=1) = 14, rope (l=0) = 2**; fields exactly `{x, y1, y2, l, uf, page, id}`; **y1 < y2 in 16/16 records (0 violations)**; uf==1 present in 13 records.

**Seat (3 files):** 12 records — 230000001 ×3, 230000002 ×6, 230000003 ×3.

**Dataset total: 23 files / 2311 records. No map outside the allowlist appears in any file.**

### Artifact / ledger cross-checks

- `research/result/stage-readiness/forensics/T083-FSDB-MANIFEST.txt` exists (EV-63 `source_file` resolves). Full-file SHA-256 = `1a6e488dbe15e4309cccc1eb771ac8b095540783e006bb3ba60fa9658e76b43f` = **exactly EV-63's `source_sha256`** (the old t082 EV-63, verified via `git show db4d2261:...`, pointed `source_file` at a data directory while carrying the EXE hash — an invalid binding; the t083 correction note describes this history accurately).
- The manifest's 23 per-file lines (relpath, bytes, sha256, records) match my recount **with 0 differences** after path-separator normalization (all 23 sha256 and byte sizes identical).
- The manifest's `MANIFEST-SHA256 ac7926436eeb56dd872700cff298d1d241ea5a2bd2fcb72400426928c5c1dc4a` **reproduces** as the SHA-256 of the manifest content preceding that line (header + 23 per-file lines + census + identity preamble). Re-derivation succeeded on first principled attempt (hash of everything before the identity line, LF endings).
- Manifest census block (Foothold 13/2283, Rope 7/16 with 14/2, Seat 3/12, TOTAL 23/2311) matches my recount exactly; committed generator `research/scripts/t083_fsdb_manifest.py` implements exactly this procedure (fail-closed on allowlist violations).
- EV-63's numbers (2283 with t082's 2154 explicitly corrected; ladder 14 / rope 2; Seat 12 with 3/6/3; 23 files/2311 records; field lists) all match my recount. t082's 2154 is indeed wrong (my count of the same 13 files is 2283).

### Verdict A: **ACCEPT**

Justification: I re-enumerated the dataset, recomputed every per-file hash/size/count and every census figure from the raw jsonl, and everything in the committed manifest and in EV-63 reproduces exactly — including the manifest's self-referential body hash and the full-file hash bound in the evidence row; the t082→t083 correction history (directory+EXE-hash binding → manifest binding; 2154→2283) is accurately described. Only cosmetic notes: the "max 248 in 230020200" phrasing is ambiguous (it is the per-map count of v-dominant segments, not a length), and the group directories also contain `.desc.meta`/`.info.meta` files which the manifest (correctly) excludes.

---

## REVIEW B — Rope endpoint semantics

### Independent decode — climb-state tick (function at 0x9D80EC, ends 0x9D8217 `ret 4`)

Prologue: `esi = ecx` (move object), **`xor ebx, ebx`** (ebx = 0 for the whole function). Rope record re-fetched via `0x4B6ABE(move+0x124, [move+0x12C])` → edi; NULL → exit. Climb motion: decrypt y (`0x548806(move+0x38)`), `fild [move+0x154]` (verticalKey), `fmul [0xB00D68]`, `faddp`, store via `0x6131F4` → **y += key × 3.0**; qword at 0xB00D68 byte-read = **3.0** (and 0xB00D60 = 0.499999999, the rounding half used elsewhere).

Endpoint clamps (my decode of 0x9D816B–0x9D8213):

- `cmp [move+0x154], ebx; jge 0x9D81CE` — key ≥ 0 jumps directly onto the `jle` at 0x9D81CE (flags still live from the same cmp), so **key == 0 exits with no endpoint check**; key < 0 falls through to the **top-end check**:
  - 0x9D817F `mov ecx, [edi+0x10]`; `fild` (as double); compare vs y: **if y < [rope+0x10]** → `cmp [edi+8], ebx` (uf flag): **uf ≠ 0 → `add ecx, -5` → y = [rope+0x10] − 5**; **uf == 0 → alt path 0x9D81A3**: re-fetch the rope record (`0x4B6ABE(move+0x124, [move+0x12C])`) and `fild [eax+0x10]` → **y = re-read [rec+0x10]** (no −5). If y ≥ [rope+0x10] → `jae 0x9D81C8` → cmp key again → key < 0 → exit (bottom check unreachable on this path).
  - key > 0 (from 0x9D81CE `jle` not taken): re-decrypt y; 0x9D81DC `mov edi, [edi+0x14]`; compare: **if y > [rope+0x14]** → `inc edi` → **y = [rope+0x14] + 1**; else `jbe` exit.
- **Exit notification**: `push ebx / push ebx / push ebx` at **0x9D8206 / 0x9D8207 / 0x9D820D**, `mov ecx, esi`, `call [eax+0x14]` → **vt+0x14 (M, 0, 0, 0)** — three pushes confirmed, ebx = 0 confirmed.

So: **+0x10 is compared when y goes below the smaller end (top), +0x14 when y exceeds the larger end (bottom, gated on key>0); writes are top−5 (uf≠0) / re-read top, and bottom+1.**

### Independent decode — 0xA4FC6F containment (0xA4FC6F–0x9FCF5, `ret 0x10`)

4 stack args (x1q,y1q,x2q,y2q), thiscall (`ecx` used as `add ecx,0xA8` table base... specifically table = `[ecx+0xA8]`, count at `[table-4]`, stride **0x1C**). Both axes min/max-normalized; **x span expanded ±0xA** (`sub [ebp+8],0xA; add [ebp+0x10],0xA`); per record: `edx=[rec+0xC]` must lie inside the expanded x span; **hit requires `[rec+0x14] ≥ ymin` AND `[rec+0x10] ≤ ymax`** — i.e. the query y-range must be contained in `[[rec+0x10], [rec+0x14]]`, which makes **+0x10 the y-min end and +0x14 the y-max end**. Returns record pointer or 0; no writes, no rope/ladder flag read, no key logic (pure spatial query — consistent with C-069).

### Cross-checks and ledger consistency

- FSDB: **16/16 rope records have y1 < y2** — consistent with +0x10=y-min, +0x14=y-max naming (loader mapping y1→+0x10 still unproven; C-072 correctly keeps the label at grade B "DERIVED pending loader-side read").
- `claims.csv` C-056 (current text, including the parenthetical that slot naming was corrected t082 by C-072 and that t080's direction words were swapped) and C-072 (explicit CORRECTION record: +0x10=top, +0x14=bottom, −5/+1, 3.0, exit args unchanged) — **both consistent with my decode**.
- `evidence.csv` EV-37 (window 0x9D80EC–0x9D8210, 3.0 byte-read, three `push ebx` at 0x9D8206/07/0D, corrected labels) and EV-58 (0x9D8165–0x9D8213 window summary: y-min end (−5 with uf) on +0x10; +1 on +0x14 at the key>0 end) — **consistent with my decode, instruction for instruction**.
- The correction history is properly separated from current conclusions: current claim text states the corrected semantics and cites the superseded t080 wording as history; no active text asserts the swapped labels.

### Verdict B: **ACCEPT**

Justification: my from-scratch disassembly of the climb tick (0x9D80EC–0x9D8217) and the containment query (0xA4FC6F) reproduces every load-bearing fact in C-056/C-072/EV-37/EV-58 — slot roles (+0x10 = y-min/top compared when y goes below it; +0x14 = y-max/bottom compared when y exceeds it, gated key>0), written values (top−5 with uf≠0, re-read top otherwise, bottom+1), the 3.0 multiplier (byte-verified at 0xB00D68), and the three-push (M,0,0,0) exit vcall — and the FSDB y1<y2 invariant plus the 0xA4FC6F containment orientation independently corroborate the corrected (t082/t083) naming, with the t080 swap correctly recorded as history rather than fact.

---

## REVIEW C — halfWidth audit (0xA4F6F1)

### Function convention (independently verified)

0xA4F6F1: SEH prologue; `sub esp,0x14`; **uses incoming `ecx` (`add ecx,0x44` → query into this+0x44 via 0x5114AA)** → thiscall; **`ret 0x14` → 5 stack args**. Body: `esi=[ebp+0x14]` vs `edx=[ebp+0xC]` guard (`esi < edx → return 0`) ⇒ a2=yTop, a4=yBottom; `edi=[ebp+8]` (x), `eax=[ebp+0x18]` (w); box pushes = `(edi−eax, yTop−1, edi+eax, yBottom, &local)` ⇒ **a1=x, a2=yTop, a3=[ebp+0x10]=out, a4=yBottom, a5=halfWidth; box = (x−w, yTop−1, x+w, yBottom)**; result walk interpolates y at x over candidate records and writes the found y through `*out` when non-NULL; returns record or 0. The task's stated convention (thiscall, ecx=[0xBDD498], args (x, yTop, out, yBottom, halfWidth), halfWidth pushed FIRST) is **confirmed from the body**.

### Exhaustive scan and per-site decode (my own harness)

Exhaustive scan of every `E8` byte in the 10,330,112-byte image: **exactly 24 rel32 call sites target 0xA4F6F1**, every one of them alignment-confirmable (≥5-instruction clean decode windows exist at all 24). Sorted list:

`0x546803 0x54709B 0x5BFEDA 0x5CDC9C 0x5CE033 0x5CE496 0x70D024 0x7C3F5C 0x7C439E 0x7C484C 0x9364D4 0x9364FF 0x93652A 0x953236 0x955498 0x963D72 0x964074 0x9640E7 0x9641B9 0x977F52 0x97A2B9 0x97A32E 0x9C6B68 0x9CC207`

Per-site halfWidth from my stack simulation over best-aligned windows (19/4/1 split):

- **Direct `push 1` (19 sites)**: 0x546803, 0x54709B, 0x5BFEDA, 0x5CDC9C, 0x5CE033, 0x5CE496, 0x7C3F5C, 0x7C439E, 0x7C484C, 0x953236, **0x955498**, 0x963D72, **0x964074**, 0x9640E7, 0x9641B9, 0x977F52, 0x97A2B9, 0x97A32E, 0x9CC207.
- **Register-carried edi=1 (4 sites)**: **0x70D024, 0x9364D4, 0x9364FF, 0x93652A**.
  - 0x9364xx: `push 1; pop edi` @0x9364BC–BE; between there and all three sites only eax/ecx/edx are written — edi stays 1.
  - 0x70D024: `push 1; pop edi` @0x70CFB3–B5; the intervening `call 0x70D1D9` **saves/restores edi** (`push edi` @0x70D1E6, `pop edi` @0x70D3B5); no direct edi write before `push edi` @0x70D011. (The other intervening indirect call relies on the standard callee-saved-edi convention — same assumption the audited artifact documents.)
- **`push 2` (1 site)**: **0x9C6B68** (out=NULL, yBottom=0x7FFFFFFF, x/yTop from two `0xA70F94` ftol conversions).
- **Dynamic: 0. Undecodable: 0.** Total 24 = 23×1 + 1×2.

**Special sites re-derived by hand:**
- Helper **0xA70B13 = 1-arg cdecl abs()**: `mov eax,[esp+4]; test eax,eax; jge; neg eax; ret` (plain `ret`, caller cleanup) — exactly as the artifact states. At **0x955498**: `push 1` @0x955481; `push esi` @0x955483; `call abs` (arg = esi via [esp+4]); `pop ecx` @0x955489 discards the esi slot **leaving the literal 1 on the stack**; then four pushes (a4=|esi|+ebx, a3=&[ebp−8], a2=ebx, a1=[ebp−0x18]) → the leftover 1 lands as the 5th arg = **halfWidth 1**. (esi itself is floored to 0x1E at 0x95547E–80 when < 0x1E.)
- **0x964074**: `push 1` @0x964068 in a cleanly aligned window — decodes without difficulty (t082's "undecodable" was indeed an artifact).
- Non-movement canonical shape `(x, yTop, out, 0x7FFFFFFF, 1)` observed at the map/background and mob sites, matching EV-57's "typical non-movement shape".

### Ledger/artifact consistency

- **C-073**: census 24 sites, 23 pass 1 (19 direct + 4 register edi=1) and 1 passes 2 (0x9C6B68), 0 dynamic, 0 undecodable; t082 census (17×1/1×2/4 dynamic/1 undecodable = 23 classified) recorded as miscounted — **matches my audit exactly**, including the per-site lists.
- **EV-57**: same census, same site lists, artifact + generator cited — **matches**.
- **T083-A4F6F1-CALLSITE-AUDIT.txt**: header (24 sites, sha256 of image, corrected census), 24 per-site windows, census footer, and the four cross-check notes (0x964074 alignment artifact, 0x70D024 edi preservation, 0x9364xx shared edi, 0x955498 abs mechanics, 0x9C6B68 push 2) — all **consistent with the binary and with my independent decode** (I re-derived the key windows myself; the artifact's printed instruction streams for the sites I re-disassembled are byte-identical).

### Verdict C: **ACCEPT**

Justification: my independent exhaustive rel32 scan found exactly the same 24 call sites (no more, no fewer), and my own alignment-corrected stack simulation classified every site — 19 direct push-1, 4 register-carried edi=1 (with the edi=1 immediates and callee-save at 0x70D1D9 verified), and one push-2 at 0x9C6B68, with 0 dynamic and 0 undecodable — which is precisely the census asserted by C-073/EV-57 and the committed audit artifact; the function's convention (thiscall, ret 0x14, (x,yTop,out,yBottom,halfWidth), box (x−w, yTop−1, x+w, yBottom)) was re-derived from the body, and the tricky sites (0x955498 abs-leftover, 0x964074, the edi family) were hand-verified against the raw bytes.

---

## REVIEW D — Cross-map arg7 semantics

### 0x9507F0 (cross-map arrival) — independent decode

Spawn byte `[edi+0xD1] & 0x7F` (bit7 test at 0x950857); bit7-clear path reads the stride-8 table at `[0xBDEB48]` → record; `[rec+0xC]`/`[rec+0x10]` → x/y (0x950879–88). Fresh move object via `0x9D359D` (0x950915). `0x9BC602(M, user+4)` installs `[M+0x14]=user+4` and copies the map-bounds block to M+0x138..0x144 (0x950948–4C). Then the m1 call (0x950951–0x95096D):

```
mov ecx,[ebp-0x2C](M); mov edx,[ecx](vt); xor eax,eax
push eax        ; a7 = 0        (pushed FIRST = last arg)
push [ebx+0x3C0]; a6 = [user+0x3C0]   (ebx = ecx at entry = user)
push eax        ; a5 = 0
push eax        ; a4 = 0
mov eax,[ebp-0x1C]; add eax,-0xA; push eax   ; a3 = Y-10
push [ebp-0x20] ; a2 = X
push 1          ; a1 = 1
call [edx+4]    ; vt slot1 = 0x9BC622
```

**7 pushes in the order a7,a6,a5,a4,a3,a2,a1; a7=0; a6=[ebx+0x3C0] where ebx=user.** This is byte-for-byte the instruction sequence quoted in EV-48.

### 0x9BC622 (m1) — independent decode (0x9BC622–0x9BC89C, `ret 0x1C` = 7 args)

- a1 → `[M+0x18]`; **a2 clamped to [M+0x138..M+0x140]** → encrypted setter move+0x20; **a3 clamped to [M+0x13C..M+0x144]** → move+0x38; a4 → move+0x50; a5 → move+0x68 (all via `fild` + 0x6131F4).
- **a7 = [ebp+0x20]**: `edi=a7`; `[M+0x114]=edi`; **state = vt0([M+0x14])** (via `call [eax]` at 0x9BC6D2); `push 7; pop eax; sub ecx,eax; neg; sbb; inc` → (state==7)?1:0; `jne` → **install `[M+0x110]=a7` only when state ≠ 7** (0x9BC6E5).
- `xor ecx,ecx`; `[M+0x118]=0`; `cmp [M+0x110],0; je 0x9BC72B` — **the conditional jump that skips the hint copy and both projection calls when [M+0x110]==0**.
- Non-zero path: **hint copy `[M+0x130]=[edi+0x1C]`, `[M+0x134]=[edi+0x20]`** (0x9BC6FB–0x9BC70F); **`0x9BC89F(ecx=M+0xE0, esi=M+0x20, edi)`** (0x9BC715) and **`0x9BC992(ecx=M+0x20, push M+0xE0, push edi)`** (0x9BC724).
- **Hint-zeroing path** (je target 0x9BC72B): `[M+0x130]=eax`, `[M+0x134]=ecx` — at that point ecx=0 (xor'd) and **eax=7, the stale value left by the `push 7; pop eax` idiom** → [M+0x130]=7, [M+0x134]=0. C-062's "no-ctx path writes 7 into [M+0x130] as stale-eax artifact" is exactly right.
- a6 handling: `test [ebp+0x1C], 0xFFFFFFFE` @**0x9BC737** (0/1 flag test); vt1 call with `a6 & 1` (the `push 1/rep movsd/pop esi` idiom leaves esi=1, so `and edx,esi` = a6&1); `[M+0x148]` = a6 (or vt1 return when a6∈{0,1}); `0x6B8701` notify over M+0x19C with the four decrypted slots ftol'd; `[M+0x154/0x150/0x190]=0`; **a1≠0 → `[M+0x190]=[Physics([0xBDD498])+0xAC]` + `0x9BFD4C(M+0x194, ...)`** (cross-map passes a1=1, so this branch runs).

### Cross-checks

- **Caller censuses (my scans)**: direct E8 callers of **0x9BC89F = {0x9BC715, 0x9D7ACB}** (2 sites — exactly C-063's set); direct E8 callers of **0x9BC992 = 18 sites** (0x9BC724, 0x9BF006, 0x9BF06B, 0x9BF127, 0x9BF29B, 0x9BF3B4, 0x9BF577, 0x9BF640, 0x9BF6CF, 0x9BF758, 0x9C3EEF, 0x9C44D1, 0x9C45AD, 0x9C4610, 0x9C9A14, 0x9C9BD0, 0x9C9C8D, 0x9C9CD7) — count matches C-063. Direct E8 callers of 0x9BC622 = 4 (0x9C3DEC/0x9C999E/0x9CBE6C/0x9CFCD3, inside the C-076 wrappers).
- **The arg7≠0 caller exists**: second caller at 0x98D052–0x98D06B pushes `a7=[ebp+0x10]` (result of `0x517DA8(...)`, non-NULL context lookup) — so the projection snap genuinely executes only for arg7≠0 callers, and the post-call sync `[user+0x3C0] ← [M+0x148]` (0x98D06E–77) matches EV-49. The a6 writer `call 0x4066C9; movzx eax,al; mov [ebx+0x3C0],eax` sits at 0x98CFEA–0x98CFF2 (the movzx is at 0x98CFEF; C-062's "movzx al @0x98CFF2" anchors the store 3 bytes later — cosmetic).
- **Ledger texts**: C-055 (arg7=0 on this call path → hint copy and 0x9BC89F/0x9BC992 snap SKIPPED, hints zeroed, immediate rebind only for arg7≠0 callers; correction lineage recorded), C-062 (full arg table incl. the [M+0x130]=7 stale-eax artifact and state≠7 install condition), C-063 (projection pair executed only by arg7≠0 callers), EV-36/EV-45/EV-48 — **all consistent with my decode**. One wording nit: C-055/EV-36's shorthand "hints are zeroed" is loose for [M+0x130], which receives the stale 7 (only [M+0x134] is zeroed); C-062 states the precise mechanism, so the ledger as a whole is accurate.

### Verdict D: **ACCEPT**

Justification: my independent disassembly of both windows reproduces the entire asserted structure — the 7-arg push order with a7=0 first, a6=[user+0x3C0], Y−10; ret 0x1C; the clamps; the state≠7 install condition for [M+0x110]; the je that skips the hint copy and both projection bodies when [M+0x110]==0; the [M+0x130]=7 stale-eax artifact; the a6 0/1 test at 0x9BC737; and the caller censuses (2 and 18 sites) — and the current C-055/C-062/C-063 and EV-36/EV-45/EV-48 texts, including their explicit correction history versus t080's misreadings, match my decode with only two cosmetic wording notes ("hints are zeroed" vs [M+0x130]=7; the movzx address anchor).

---

## REVIEW E — Readiness/matrix consistency

### Structural integrity (my checks)

- Matrix: **65 rows** (matches report's "65 行"); readiness distribution RE-READY 16 / RE-GAP-STATIC 27 / PRODUCT-READY 15 / DESIGN-DECISION 7; **the RE-READY set equals exactly the report's claimed list** (P0-04/P0-08/P0-09/P0-13/P1-07/P1-08/P2-02/P3-01/P3-03/P3-06/P3-07/P3-09/P3-14/P3-16/P4-04/P4-05 — verified set-equal, no extras/missing).
- **No dangling references**: every matrix claim_id/evidence_id/gap_id resolves in claims.csv (77 unique)/evidence.csv (63 unique)/gaps.csv (41 unique); every evidence.csv→claim_id and claims.csv→evidence_refs back-reference also resolves. (Informationally, 23 claims / 19 evidence rows are not cited by any matrix row — including C-076/EV-49/EV-61 — but unreferenced ≠ dangling.)
- **Ledger timeline verified by `git show`** (read-only): t080-start (e676ab0a, parent of 3b7b987c) = 47/32/41; **t080 end (3b7b987c) = 60 claims / 41 evidence / 41 gaps**; **t081 end (e137fc19) = 60/42/41**; **t082 end (db4d2261) = 77/63/41**; current working tree = **77/63/41** (with 41 gaps distributed CLOSED-STATIC 14 / PARTIAL-STATIC 12 / OPEN-STATIC 9 / OPEN-RUNTIME 4 / BLOCKED 1 / SUPERSEDED 1 — matching the report's gap distribution). All five timeline statements in the report are correct, including the t083-F5 correction (t080 end = 41 EV; the 42nd belongs to t081).
- **fh census**: appears as 2283 with the 2154 correction noted (report L9/L30 area and t083 memo F1; matrix P0-09) — my recount says 2283 is correct.
- **halfWidth census**: appears as 23×1/1×2 (0 dynamic / 0 undecodable) with the t082 17×1/4×dynamic/1×undecodable miscount explicitly noted (report P3 landing row and t083 memo F3; matrix P3-06) — my audit confirms.
- **NOT STAGE-READY**: still asserted (report §0) with the per-stage verdict table unchanged; t083 memo states the RE-READY set is unchanged and the stage verdict maintained — consistent with the matrix.
- **No stale conclusions in ACTIVE text**: the only "unverified" phrasing in the active ledgers is C-055's "dispatch-table byte-binding still unverified (noted)" — which refers to the genuinely-open 0x81→0x97EBC9 binding (OPEN-STATIC per C-066), not to 0x9BF1FA/0xA4FC6F; both of the latter are described as closed (C-067/C-069) everywhere they appear in the report, matrix, and ledgers. The cross-map hint copy is described with the corrected semantics (arg7=0 ⇒ branch never executes, hints zeroed/overwritten per C-062) in report L78 and in C-055/EV-36; no active text describes it as executing.

### minimum_next_work staleness (the six named rows)

- **P0-09 (RE-READY)**: next work = ENGINEERING record ingestion + non-empty validation, with the data-EV registration explicitly acknowledged done (EV-63 + manifest). **Not stale.**
- **P3-03 (RE-READY)**: next work = fh loader write-side + slot3 variant diffs (neither covered by any claim — C-068 explicitly marks loader write-side as not directly read; slot3 variants only listed in C-076) + ENGINEERING tests. **Not stale** (completed work "0x9BF1FA full body recovered t082" is labeled as done).
- **P3-06 (RE-READY)**: "无静态残项（24 站点半宽普查 t083 完结：23×1、1×2、0 动态、0 不可解码）" — matches my audit; **not stale**.
- **P3-14 (RE-READY)**: RUNTIME hint-tension dump of [M+0x130/0x134] — genuinely not statically resolvable; **not stale**.
- **P4-05 (RE-READY)**: "无（吸附三体已恢复 t082…；Camera 残项见 P4-07/G10）" — **not stale**.
- **P3-15 (RE-GAP-STATIC)**: STATIC trace of **0x6A0ADF** stand-up/cancel chain — 0x6A0ADF appears **nowhere** in claims.csv/evidence.csv (grep count 0), i.e. genuinely open, and the row correctly records 0xCF dispatch (C-066/EV-52) and seat writes (EV-38) as already covered. **Not stale; the 0x6A0ADF residual is preserved.**

### Residual preservation

- **P4-06 Camera residual**: preserved (unproven column = "Camera 更新顺序（G10 关联，未开始）"; RE-GAP-STATIC retained).
- **P3-13 ladder/rope fork residual**: preserved (unproven column = fork location candidates 0x517DA8/0x9BCC9A — neither address appears in claims/evidence — plus rope-record hint tension; RE-GAP-STATIC retained; blocks_acceptance = 是).
- **P3-15 0x6A0ADF residual**: preserved (see above).

### Discrepancies found (the basis for the verdict)

1. **P3-13's `minimum_next_work` ("STATIC 追0xA4FC6F和0x9BCA6F及l分支") and `can_static_continue_or_runtime` ("STATIC 核0xA4FC6F、0x9D7E9F和实际l/uf的13图分支") still list already-covered work**: 0xA4FC6F's full body + 6 caller windows are CLOSED-STATIC (C-069/EV-55), and 0x9D7E9F is one of the EV-56 grab caller windows. The genuinely open items (the l/uf consumer fork — 0x9BCA6F, 0x517DA8/0x9BCC9A candidates — and the [M+0x130/0x134] runtime tension) are mixed with recovered targets. The t083 memo F4 scoped its cleanup to "五项 RE-READY 行与 P3-15", so P3-13 was simply not touched — the memo is accurate about what it did, but the row's next-work text is stale relative to the registered evidence.
2. **P4-06's `minimum_next_work` ("STATIC 枚举0x9BC622上层和进入场景初始化分支") is partially covered**: the direct-E8 upper layer of 0x9BC622 is already enumerated and registered (C-076: exactly 4 direct callers = the state wrappers, which I re-verified as 0x9C3DEC/0x9C999E/0x9CBE6C/0x9CFCD3). Work above the wrappers and the scene-entry init branches remain genuinely open, so the item is ambiguous/partially stale rather than wrong.

### Verdict E: **ACCEPT-WITH-CORRECTIONS**

Justification: every checkable consistency claim holds under independent recomputation — matrix row count and RE-READY set, zero dangling references in all directions, ledger counts now and at 3b7b987c/e137fc19/db4d2261 (via read-only git), gap distribution, the 2283/2154 and 23×1/1×2 census corrections, the NOT STAGE-READY verdict, clean next-work on the six named rows, preserved P4-06/P3-13/P3-15 residuals, and no stale 0x9BF1FA/0xA4FC6F-unverified or hint-copy-executes text anywhere in the active documents — but P3-13 (and, partially, P4-06) still lists minimum-next-work targets that are already covered by registered claims/evidence (0xA4FC6F fully recovered per C-069/EV-55; 0x9D7E9F in EV-56; 0x9BC622's direct callers closed by C-076), which is exactly the class of staleness the t083 F4 cleanup was meant to remove but, by its own scoping, did not.

---

## Discrepancy register (all findings)

| # | Severity | Location | Finding |
|---|---|---|---|
| 1 | Minor (data wording) | EV-63 / T083-FSDB-MANIFEST lineage | "v-dominant segments present (max 248 in 230020200)" is the max per-map **count** of v-dominant segments (248 in 230020200; runner-up 119), not a length (max v-dominant length = 172, in 222000001). Number reproducible; wording ambiguous. |
| 2 | Minor (matrix staleness) | matrix P3-13 `minimum_next_work` / `can_static_continue_or_runtime` | Lists 0xA4FC6F (closed by C-069/EV-55) and 0x9D7E9F (covered by EV-56) as work to trace; only 0x9BCA6F / l-branch consumers / runtime hint dump are genuinely open. |
| 3 | Minor (matrix staleness, partial) | matrix P4-06 `minimum_next_work` | "枚举0x9BC622上层" — direct E8 callers already enumerated/registered (C-076; re-verified: 4 sites). Layers above the wrappers / scene-entry init remain open. |
| 4 | Cosmetic (wording) | C-055 / EV-36 | "hints are zeroed" is loose for [M+0x130], which receives the stale 7 (push 7; pop eax idiom); only [M+0x134] is zeroed. C-062 records the precise artifact, so the ledger is internally accurate. |
| 5 | Cosmetic (address anchor) | C-062 | "movzx al @0x98CFF2" — 0x98CFF2 is the `mov [ebx+0x3C0],eax` store; the movzx itself is at 0x98CFEF. EV-49's instruction quote lists both correctly. |

No factual errors were found in any of the audited t083 conclusions: every hash, count, call-site census, argument decode, control-flow gate, and matrix/report consistency statement that I could recompute from raw sources reproduced exactly.

## Five verdicts

| Review | Verdict |
|---|---|
| A — EV-63 / FSDB manifest | **ACCEPT** |
| B — Rope endpoint semantics | **ACCEPT** |
| C — halfWidth audit (0xA4F6F1) | **ACCEPT** |
| D — Cross-map arg7 semantics | **ACCEPT** |
| E — Readiness/matrix consistency | **ACCEPT-WITH-CORRECTIONS** |

**Corrections required** (both minor, both in the matrix): clean the stale targets out of P3-13's `minimum_next_work`/`can_static_continue_or_runtime` (drop or mark 0xA4FC6F and 0x9D7E9F as already recovered; keep 0x9BCA6F, the l/uf fork consumers, and the runtime hint dump), and sharpen P4-06's next-work to the genuinely-open remainder (layers above the 0x9BC622 wrappers + scene-entry init branches + Camera order). Optional polish: EV-63's "max 248" wording, C-055's "hints zeroed" shorthand, C-062's movzx address anchor.
