# T087 Independent Reviewer Report

Round: T087 · Branch `design/adventure-field-map-scene` (HEAD 5172dcb7) · Reviewer working dir: `C:\Users\lithd\AppData\Local\Temp\opencode\t087-reviewer\` (all scripts + `BLIND-NOTES.md` there; repo untouched).

**Binary identities (re-verified by me before use)** — all three match the pinned values: EXE `d4a67597…a31718` (linear, fileOffset = VA−0x400000), Shape2D.dll `9802bacc…c8111b`, server079.jar `49382081…8cf360`. PHASE 1 (blind) was completed and written down in `BLIND-NOTES.md` before any T087 file was opened.

---

## R1 — fieldctx+0xD4 identity

**(a) Blind derivation.** Constructor 0x9EC3E1: `mov [0xBDD6F4], ecx` at **0x9EC404** (`89 0d f4 d6 bd 00`; ecx = this via the neg/sbb trick, always non-null) → global installed. `lea edi,[ebx+0xD4]` / `mov [edi], esi(0)` at **0x9EC478/0x9EC47E** (+0xE0 also zeroed). Resolve: `push 0x31D` at 0x9EC4D3 (`68 1d 03 00 00`) → `call 0x7A48D0` → `mov ecx,eax; call 0x40634C` → `mov eax,[eax]` → `call 0x447891` at **0x9EC4EE** (args obj, &[this+0xD4], 0). Then QI of [0xBE2788] (0x4371B1), [vt+4], [vt+0x64]-init with {word 0xD, gr2d}, and finally on the attached object:
```
0x9EC61A  68 d4 fe ff ff     push 0xFFFFFED4   ; -0x12C (-300)
0x9EC620  68 70 fe ff ff     push 0xFFFFFE70   ; -0x190 (-400)
0x9EC625  50                 push eax          ; this = attached object
0x9EC62A  ff 91 90 00 00 00  call [ecx+0x90]
```
i.e. `[vt+0x90](vec, −400, −300, &B, &A)` — arg order (−0x190, −0x12C), negative half-screen.

Cipher re-derived independently: record = `[0xBA7B04 + id*4]` (verified in 0x7A4A5E); type = first signed byte; name = C-string after it; key setup 0x7A484B copies the 16 bytes at **0xB07640** (`d6 de 75 86 46 64 a3 71 e8 e6 7b d3 33 30 e7 2e`, len [0xB07650]=16) and rotates via **0x7A4CBE** = *byte-rotate LEFT by (type div 8) mod 16, then bit-rotate the 128-bit big-endian value LEFT by (type mod 8)*; keystream = key[i mod 16] (0x7A48B3); decrypt loop 0x7A4DA9 is `out = (c==k) ? c : c^k`. My implementation: **id 0x31D (type 0x51) → `Shape2D#Vector2D`**; **id 0x819 (type 0x4D) → `Gr2D_DX8`**; bonus: 0x43A → `Whistle`, 0xA58 → `UI/Basic.img/Cursor/%d`, 0x818 → `Data.wz`, 0x18 → valid GBK text (cipher generalizes). Shape2D.dll contains RTTI `.?AVCWzVector2D@@` (file off 0x10248) and UTF-16 `Shape2D#Vector2D` (off 0x115D0, right after ASCII `PcCreateObject`); no ASCII form, no `Gr2D_DX8` UTF-16 in this DLL.

**(b) Comparison.** **AGREE** with T087-FIELDCTX-D4-CONSTRUCTION.txt §1–3, report §1 and C-103 on every substantive item (chain, addresses, decryptions, RTTI/UTF-16 cross-evidence, EV-07 cross-check). **DISAGREE (documentation-level)** on the cipher formula *wording*: report §1.2, forensics §3, the C-103 claim text and the test docstring all say the byte step is a "rotate **right** by (type div 8)". The code and a decisive counter-check show it is a rotate **LEFT** (`temp[i] = buf[(r+i) % 16]`; `rotate_right` yields garbage `\xe2-\xd6…`, `rotate_left` yields `Shape2D#Vector2D`). Their own `rotate_bytes_right()` implementation (`arr[n:]+arr[:n]`) and unit test (`out[i] == arr[(10+i)%16]`) are correct — only the prose/name is inverted. Anyone re-implementing from the prose would fail.

**(c) Counterexample searches.** Byte-rotation direction both ways (decisive); decryption of 8 ids incl. 2 not in their table; Shape2D string search ASCII+UTF-16+RTTI (3 patterns).

## R2 — [0xBDD838] singleton

**(a) Blind derivation.** Full-band scan (all mod=rm=5 + A1/A3 encodings, instruction-verified): **113** real absolute references. Writes to the global: **one pointer install at 0xA012E5** (`89 35 38 d8 bd 00`, inside ctor A 0xA012D3) plus two `and [0xBDD838],0` clears at **0x9FFAF1** and **0xA023CA** (release paths). Creation: 0xA0125F → operator-new(0xA04) → ctor A (installs global; zeroes +4/+0x92C/+0x978; +0x97C container init via 0xA70B1E(4, 0xD, 0x4B6FBB, 0x414A99); +0x9B0=0, +0x9B4=−1; +0x9BC sub-object vt 0xB0D318) → 0xA023D2 = get-or-create → ctor B **0x5CA5A9** on the singleton. Ctor B: 3 devices at +0x14/+0x18/+0x1C via [0xBE157C]; two 0x400-byte key tables at +0x24/+0x424 filled from 0xBA1D7C..0xBA1E49; **namespace id 0x31D attached at +0x9B0** (0x5CA68E/97/B1); QI [0xBE2788] → [vt+0x64]; **0x5CA774 calls 0x5CA91A with the pre-init values, then** byte-memset(0xA70120) of 44 bytes at +0x938 (covers +0x938..+0x963 only — +0x9B0 survives), **then +0x938=0x190 (400), +0x93C=0x12C (300)** at 0x5CA787/0x5CA78D; keyboard callbacks 0x5CC1ED/0x5CC2A5; +0x97C populated with **id 0xA58** by helper 0x5CAD4A (called at 0x5CA797) — verified `push 0xa58` at 0x5CAD72. So exactly one ns id is attached inline (0x31D at +0x9B0); 0xA58 goes to +0x97C via the helper. Dispatcher **0x5CAB38**: 0→0x5CB9EC(1), 1→0x5CB573, 2→0x5CBE2A; sole E8 caller 0x9FEE24 (mode from `[0xBE179C](3, input+0x88, 0)`). **0xA020E2 is a window-message dispatcher**: msg 0x100 → [0xBDD6F4]→0x9ED85C; 0x200–0x20A → 0x9ED2A5; 0x500–0x501 → 0x9EDA1D; else ignore (E8 callers 0x9FEE4B/0x9FF0C5/0x9FF0EC). Role: input/cursor manager owning the shared camera Vector2D at +0x9B0 — matches their classification; joystick case constants verified (0x110-byte state, 0x2BC=700 deadband, 0x3E8=1000 saturation at 0x5CBE8D/94).

**(b) Comparison.** **AGREE** with T087-BDD838-CLASS-VTABLE.txt and C-104 (single install writer, chain, layout incl. cursor init (400,300), clamps, dispatch, message band, cursor sprites 0xA58, behavioural role; their note that +0x97C gets 0xA58 via `call 0x5cad4a` is present in §2). Two nuances: (i) "exactly ONE store" should mention the two `and …,0` clears (0x9FFAF1/0xA023CA) — they are NULL-clears, not installs, so the claim stands for installs; (ii) §6a/§2 wording "*ctor init (0x5CA774) — passes the initial (400,300)*" is **not instruction-accurate**: the call at 0x5CA774 reads +0x938/+0x93C *before* the memset and before (400,300) are stored, so it passes uninitialized heap residue; no second call follows in the ctor. The camera start at (0,0) is established by the *fieldctx* ctor's direct (−400,−300) call, which their text does correctly identify. Minor misaligned disassembly block at 0x5CA740–0x5CA74B in their §2 (`inc ebp/cld/outsd…` garbage window) — presentation flaw only.

**(c) Counterexample searches.** Full-band encoding-complete global census (found the 2 clears); allocator 0x402D66 fresh path checked (no zeroing → ctor-call inputs are heap residue); 0x5CAD4A confirmed as the +0x97C/0xA58 populator.

## R3 — camera formula 0x5CA91A

**(a) Blind derivation.** 0x5CA91A(this, x, y): builds two 16-byte VARIANT-ish params from [0xAFE264]()+0x402C26(&p, 0xBE7330); E_POINTER gate on [this+0x9B0]; `add ecx, 0xFFFFFED4` at **0x5CA9AC** (`81 c1 d4 fe ff ff`, y−0x12C); `add ecx, 0xFFFFFE70` at **0x5CA9B8** (`81 c1 70 fe ff ff`, x−0x190); `call [eax+0x90]` at **0x5CA9C1** (`ff 90 90 00 00 00`). Formula confirmed: `[vt+0x90](vec, x−400, y−300, V, V)`. E8 census: **exactly 7 callers — 0x5CA774, 0x5CB12E, 0x5CB139, 0x5CB3DF, 0x5CB74B, 0x9E6D18, 0x9F1ADF** (matches their list 1:1; no dword occurrence of 0x5CA91A anywhere in the image → no fn-pointer path). Writer 0x9E6D18: `push [ebx+0x3C]` / `push [ebx+0x38]` (record +0x38/+0x3C pair), gated by [0xBE1734](&out, x, y)≠0. Writer 0x9F1ADF: `mov edi,[ebp+0x10]; shr eax,0x10` (y) / `movzx word ptr [edi]` (x) — packed 16:16 dword, low=x high=y. 0x5CB3DF is inside 0x5CB33F's mode-1 branch re-asserting current [+0x938]/[+0x93C].

**Adversarial result (important).** The namespace manager **caches one object per id** (0x7A4A5E caches decrypted names in table [mgr+0]; 0x7A4B2E caches the object wrapper in table [mgr+4] — verified), so *every* 0x31D resolution aliases the ONE Vector2D. Census: 63 `push 0x31D` sites in band; 28 have a `call [reg+0x90]` within 0x180 bytes; I verified receiver lineage end-to-end for four, each a **direct slot+0x90 call on the shared camera Vector2D, bypassing 0x5CA91A**:

| site | receiver provenance | args (x, y) |
|---|---|---|
| **0x43781F** | attach slot [ebp-0x10] of the 0x31D resolve at 0x437732 | (0, −0x32) |
| **0x692280** | attach slot [ebp-0x10] of the resolve at 0x69213A | (−0xFF, 0) |
| **0x6BE6F4** | resolve at 0x6BE5E8 (also uses the 0x48AEC3 getter at 0x6BE62A) | (0x190, var) |
| **0x6ED7CC** | attach slot [ebp-0x10] of the resolve at 0x6ED6C2 (`mov ebx,[ebp-0x10]` at 0x6ED7A9) | (0x97, 0x8D) |

*(My blind note "no 8th E8 caller" stands; these are not E8 callers — they are direct virtual calls.)*

**(b) Comparison.** **AGREE** with the formula, the 7-site E8 census, and both field-writer decodings (bytes identical). **DISAGREE with the exhaustiveness phrasing**: report §3.1/§3.3 ("全部 7 写入点" / "writers = …") and C-103 present the 7 funnel callers as *the* writer set. Under the report's own set-semantics reading of slot+0x90, the four sites above (and plausibly more of the 28 candidates) are additional camera writers. C-103's falsification field ("an 8th E8 caller of 0x5CA91A") is not triggered, but the writer-set enumeration is incomplete as written. This does not invalidate the identity/formula (which I reproduced byte-level) — it means the census is of the *funnel*, not of all slot+0x90 invocations on the shared object.

**(c) Counterexample searches.** E8 + dword-pointer census of 0x5CA91A; 499 band-wide `call [reg+0x90]` sites enumerated; provenance-filtered via 63 `push 0x31D` + 71 getter (0x48AEC3) caller sites with 0x180-byte windows; 4 sites fully receiver-verified; getter-adjacent hits (e.g. 0x4B3BC5) manually ruled out (receiver is a different object; Vector2D only wrapped as parameter).

## R4 — world-to-screen + converter semantics + gating constants

**(a) Blind derivation.** 0x9EA402–0x9EA446: `ecx=[0xBDD6F4]`; 0x48AEC3 → out=[fieldctx+0xD4]; cam_x = 0x404B07([out]) (slot+0x20); obj_x = 0x404B07([this+0x14]); `sub esi, eax` at **0x9EA446** → screen_x = obj.world_x − camera.x. ✓ 0x9EC924 (get): base read 0x5CABE1, then `add [esi],eax` / `add [esi+4],eax` (0x9EC961/0x9EC981) — **camera added on read**. 0x9EC989 (set): `sub [ebp+8],eax` / `sub [ebp+0xC],eax` (0x9EC9BE/0x9EC9DB) — **offset subtracted on write**, then 0x5CB0E0. 0x5CB0E0: clamp(x,0,0x320), clamp(y,0,0x258) (bytes 0x5CB0F1 `b8 20 03 00 00`, 0x5CB10A `b8 58 02 00 00`), then [+0xC]-branched store+0x5CA91A / 0x5CA91A+fallback pair [0xBE1754]/[0xBE1750]. 0x5CB573 fully decoded: 20-byte input state via [dev+0x24]; 5-bit direction mask (0x5CAAA9 with key ids 0x11/0x10 + state bits); **speed=[+0x970]+5; pos += speed·axis/10 (signed idiv)**; same [0,800]×[0,600] clamps; equality-change gate at 0x5CB6A6/0x5CB703 (skip no-op writes); direct stores 0x5CB713/0x5CB71F; queue cmd 0x200 via 0x5CC30A(+0x9BC); then 0x5CA91A. **No threshold/deadzone/smoothing constant exists in 0x5CA91A / 0x5CB0E0 / 0x5CB573 / ctor 0x5CA5A9** — the only gates are the bounds clamps, the equality gate, and a device-lost check (0x5CD092 redirect at 0x5CB6B5). The 0x5CBE2A ±700/±1000 constants are joystick input normalization, not camera gating.

**(b) Comparison.** **AGREE** with report §3.2/§3.3 and matrix P2-06's bounded negative claim — verified within the same bounds, and the residual wording ("negative conclusion bounded to the decoded family") is accurate.

**(c) Counterexample searches.** Full decode of all three functions hunting cmp-with-immediate/deadzone patterns; constants found limited to clamps/scale/queue-ids listed above.

## R5 — G17 BOAT 0x97/0x98

**(a) Blind derivation.** Router **0x5658FF**: `sub eax,0x97`; 0x97 → this−8 → **0x565935**; 0x98 → this−8 → **0x56599A**; else → 0x54112E (E8 callers 0x56592C/0x56591F). **0x97 = sub-opcode dispatcher**: ReadByte (0x4066C9); byte−7 switch over 0x07..0x0C — 7/9/11 → `ret 4` stubs (0x565A1F/0x565A44/0x565A7A); 8 → arg byte, ==2 → 0x564E52([this+0x768]); 10 → arg 4 → 0x56512A, arg 5 → 0x565492; 12 → arg ==6 → 0x564FBE. **0x98 = two-byte state machine** (state=esi, flag=eax; signed compares):
- state < 0 or > 6 → no-op;
- **{0, 1, 6}** → if [this+0x774]==0 → **0x564FBE**;
- **{2, 5}** → if [this+0x774]==0 → **0x564E52**;
- **{3, 4}** → if [this+0x774]==1 && flag==1 → **0x56512A**; elif [this+0x774]==0 → **0x564E52**.

Boat object at this+0x768, dock mode [this+0x774]. Whistle: `push 0x43A` at **0x564E7B** (in 0x564E52) and **0x564FE7** (in 0x564FBE); resolved object → 0x996E5C(obj, 0x64); gates [boat+0x40]≠0&&[boat+0xC]==0 vs [boat+0x44]≠0&&[boat+0xC]==1 (mutually exclusive dock states). Jar (read myself): sendops `BOAT_EFFECT = 0x98` (and `BOAT_HIDE = 0x99`); recvops `SHIP_OBJECT = 0xD9`; recvops names for 0x97/0x98 are `FAMILY_OPERATION`/`DELETE_JUNIOR` (unrelated) — no client-side name binding can be claimed. ✓

**(b) Comparison.** **AGREE** with the router, the 0x97 grammar, the boat offsets, the Whistle gates, the jar values, and the open-naming adjudication (report §4, forensics §1–2/§4–6). **DISAGREE with the 0x98 grammar summary table** (forensics §3, C-105 claim text, G17 verified_scope): three errors against the bytes — (i) states 2|5 → target is **0x564E52**, not 0x56512A; (ii) the {3,4}-branch mode-0 fallback → **0x564E52**, not 0x56512A; (iii) "states 0|3 no-op" is wrong: state **0** joins the {0,1,6}→0x564FBE group (`test/jl` is signed; 0 is not <0) and state **3** belongs to the {3,4} branch. Their own raw dump in the same file correctly shows `call 0x564e52` at 0x56599F — a transcription error that propagated into the ledger. *(Transparency: my blind note initially repeated the state-0-as-no-op slip; corrected on signed-compare analysis.)*

**(c) Counterexample searches.** Full decode of both handlers + all six sub-handlers; `push 0x43A` band scan around the boat family; jar properties grep including the 0x97/0x98 recv rows.

## R6 — ledgers / evidence / tests

- **C-103/C-104/C-105 vs forensics**: read and compared above; content consistent across report/forensics/CSVs except the errors listed (C-103 rotate-direction prose; C-105 grammar table; C-103/G10/P2-05 "all writers"/"only place a deadzone can live" phrasing).
- **EV-89..EV-92 source_sha256**: all four recomputed with `research/scripts/evidence_canonical.py::canonical_sha256` — **MATCH** (7141f646…, 940c8a4c…, faf20b5e…, 005a7b77…). Companion CSV hashes embedded in interpretation columns also match actual files (T087-FIELDCTX-D4-WRITER-CENSUS.csv = b3373056…, 208 rows; T087-BDD838-WRITER-ALIASES.csv = cff57f6f…, 113 rows — row count independently confirmed by my 113-reference census).
- **EV-15**: repaired hash `520d8333…a3898` recomputed against `research/result/atlas/R13-SLOT45-CANDIDATES.csv` — **MATCH** (3047 bytes, in-repo, single file). Audit trail present.
- **G10**: still PARTIAL-STATIC with the cadence/deadzone residual explicit — verified, and my R3 finding *reinforces* keeping it partial (more un-censused writer sites). Minor: "the ONLY place a deadzone can still live" is too strong. **G17**: PARTIAL-STATIC with C-105 appended; carries the same grammar-table errors.
- **Matrix P2-01/P2-05/P2-06**: consistent with the evidence (P2-01 ORIGINAL-STATIC-PROVEN is justified by the transform layer I verified; P2-05/06 keep explicit residuals and blocks_acceptance=是). Same "only upstream of the two field writers" overstatement in P2-05/P2-06 unproven fields.
- **Unit tests**: `python -m unittest research.tests.test_t087_round -q` → **16/16 OK**; full suite (t0861 + t087 + validator tests) → **85/85 OK**, matching the report. Note `test_byte_rotation_formula` anchors the *correct* (left) behavior under a "right" name.
- **Validator**: `python research/scripts/validate_reverse_engineering.py` → **PASS, 0 errors / 0 warnings**, counts 105/41/92.

---

## Verdict: **ACCEPT-WITH-CORRECTIONS**

The round's core results — the fieldctx construction chain, the namespace-name cipher (results), the shared-object identity [fieldctx+0xD4] == [singleton+0x9B0], the singleton's creation/layout/dispatch, the camera write formula `camera := point − (400,300)` with its 7 funnel callers, the world→screen edge, the converter semantics, the bounded no-deadzone negative claim, and the G17 payload structure — were all independently re-derived from raw bytes and **stand**. The corrections are textual/ledger-level, not structural.

| # | original address | main agent conclusion | my conclusion | counterexample path | affects gap status? | minimal fix |
|---|---|---|---|---|---|---|
| 1 | 0x7A4D17–0x7A4D3F (cipher byte step) | "rotate **right** by (type div 8) mod 16" (report §1.2, forensics §3, C-103, test docstring) | rotate **LEFT**: `temp[i]=buf[(r+i)%16]` (their own code/test implement left) | `rotate_bytes_right(key,10)` yields ciphertext garbage; left yields `Shape2D#Vector2D` | No | Replace "rotate right" with "rotate left" in the 4 prose locations (keep code/tests as-is) |
| 2 | 0x56599A–0x565A1A (0x98 state machine) | states 2\|5→0x56512A; state 4 fallback→0x56512A; "states 0\|3 no-op" (forensics §3, C-105, G17) | {2,5}→**0x564E52**; {3,4} mode-0 fallback→**0x564E52**; **state 0 joins {0,1,6}→0x564FBE**; only <0 or >6 are no-ops | bytes at 0x56599F (`call 0x564e52`) in their own dump; signed `test/jl`+`jle` chain | No (G17 stays PARTIAL-STATIC) | Regenerate the §3 table + C-105/G17 text from the raw disassembly |
| 3 | 0x43781F, 0x692280, 0x6BE6F4, 0x6ED7CC | "全部 7 写入点" / writers enumerated as the 7 E8 callers of 0x5CA91A (report §3.1/§3.3, C-103) | ≥4 verified *direct* `[vt+0x90]` sites on the same namespace-cached Vector2D (shared per id via 0x7A4B2E/0x7A4A5E caching), with args (0,−0x32), (−0xFF,0), (0x190,var), (0x97,0x8D); 24 more candidates uncensused | per-id cache tables at [mgr+0]/[mgr+4]; receiver lineages traced for the 4 sites | No (G10 remains PARTIAL-STATIC — this *supports* it) | Reword to "7 funnel callers of 0x5CA91A **plus** a direct-slot writer family (census open)"; soften G10/P2-05/P2-06 "the ONLY place a deadzone can live" |
| 4 | 0x5CA774 (ctor writer #1) | "passes the initial (400,300) so the camera starts at (0,0)" | call passes **pre-init heap residue**; (400,300) stored *after* (0x5CA779–0x5CA78D), no follow-up call; camera start (0,0) comes from the fieldctx ctor's direct (−400,−300) call | instruction order 0x5CA764→0x5CA78D; allocator 0x402D66 fresh path does not zero | No | Reword §6a/EV-90 row: "ctor re-notify with pre-init values; fields then set to (400,300); (0,0) start established by the fieldctx ctor" |

Non-blocking observations: two `and [0xBDD838],0` clears (0x9FFAF1, 0xA023CA) beside the single install store; misaligned disassembly block at 0x5CA740–0x5CA74B in T087-BDD838-CLASS-VTABLE.txt §2; "+0x97C id 0xA58" is populated by helper 0x5CAD4A (already noted in their file, worth one clarifying word against reading it as an inline ctor attach).

---

## Lead closure record (T087, post-review)

All four corrections were re-verified by the lead from the raw bytes (0x5659FF `call 0x564e52`; 0x43781F receiver/args; 0x5CA774 order-of-operations) and applied:
1. rotate-direction prose fixed in report §1.2, forensics §3 (regenerated), C-103, test docstring; helper renamed `rotate_bytes_left`.
2. G17 0x98 grammar table regenerated from the corrected decode; C-105/G17 updated.
3. "7 写入点" reworded to "7 funnel callers + direct-slot writer family (census open)" in report, forensics (§6/§7), C-103, EV-90, G10, matrix P2-05/P2-06; the VARIANT-semantics open sub-question recorded.
4. ctor 0x5CA774 re-characterized as pre-init re-notify in forensics §2/§6a and EV-90; release-path NULL clears (0x9FFAF1/0xA023CA) annotated in §1; the 0x5CA740 window alignment fixed.

Post-fix gates: Validator PASS (0 errors / 0 warnings); unit tests 85/85 OK; clean-room regenerated in sync. Reviewer verdict stands at **ACCEPT-WITH-CORRECTIONS → corrections applied; final state ACCEPT**.
