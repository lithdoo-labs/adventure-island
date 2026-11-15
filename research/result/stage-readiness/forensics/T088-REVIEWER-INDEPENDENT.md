# T088 INDEPENDENT REVIEWER REPORT — CAMERA CADENCE / VECTOR2D 0x31D WRITER CLOSURE

Reviewer: independent read-only sub-agent, own temp dir `C:\Users\lithd\AppData\Local\Temp\opencode\t088-reviewer\`.
Method: Phase 1 blind derivations from raw bytes (recorded in `BLIND-NOTES.md` BEFORE opening any T088
output), then Phase 2 comparison against the T088 deliverables. STATIC-ONLY: Python + capstone + pfile
only; no client run, no debugger, no capture. Repo working tree untouched (read-only).

Binary identity (re-verified, SHA-256):
- EXE `.work/task-036/game-image-unpacked.bin` = `d4a67597…a31718` ✓ (linear, VA−0x400000)
- Shape2D.dll = `9802bacc…c8111b` ✓ (0x51400000)
- PCOM.dll = `cf3807f3…9d9e54` ✓ (0x50C00000)
- server079.jar = `49382081…8cf360` ✓ (not needed this round)

---

## 1. Blind-vs-lead agreement matrix (confirmed items)

| Item | Lead (T088) | My blind derivation | Verdict |
|---|---|---|---|
| 0x31D census count | 80 = 63 push + 17 mov (whole image) | 38 push + 5 mov in band 0x401000–0x7EA000; 63 push + 17 mov whole image | **AGREE** (the "band" of the task text yields 43; the 80-row census spans the image) |
| Resolve idiom | push id; push &slot; 0x7A48D0 (manager getter); 0x40634C→0x7A4B2E (per-ID cache `[mgr+4]+id*4`) | identical, incl. lazy manager singleton at [0xBE2000] | **AGREE** |
| 0x447891 | PcCreateObject wrapper, IID {F28BD1ED-3DEB-4F92-9EEC-10EF5A1C3FB4}, not AddRef | identical; plus independent proof [0xBE1FB0] = GetProcAddress(PCOM, "PcCreateObject") via resolver 0x79C52F (name strings at 0xBA75FC etc.) | **AGREE** |
| Shape2D vtables | primary 0x5140C2F0 (+ parallel 0x5140C0FC), Set@+0x90 = 0x5140828F ret 0x2C; X→[this+0x1C], Y→[this+0x20]; getters +0x20/+0x28 | identical (I derived both tables, both getters, plain Set/Add at +0x40/+0x44 as well) | **AGREE** |
| Set semantics | VT_EMPTY/VT_ERROR → immediate store (peer==0) else tween via 0x51407FE1 (V3 VT_I4 duration, V4&0x10000000, pending list [this+0x30]) | identical immediate path; tween path matches (I decoded the temp-clone + Invoke + delta computation; lead went further into 0x514081F0 record layout) | **AGREE** |
| Creation chain | factory 0x51402FB6: record+0x10 lazy singleton; create once via [record+8], then QI | identical; decisive bytes 0x51403029 `cmp [esi+0x10],ebx` / 0x5140302F `jne` skip-create / 0x51403040 `push edi` out-slot = &record+0x10 | **AGREE** (singleton, no fresh-instance path in the chain; falsification attempt failed — see §3) |
| Funnel callers | 7 E8 callers, #6=0x9E6D18, #7=0x9F1ADF | identical list | **AGREE** |
| Writer #6 gates | 5 conjunctive gates (focus-id ≠, IsWindow, GetRect ok, rect non-empty, PtInRect(seeded point)) | identical (independently decoded; API names signature-inferred — no name strings in dump) | **AGREE** |
| Writer #6 point | cursor captured at registration via 0x5CABE1; cursor-follow mode, not world | identical; refinement: GetCursorPos→**ScreenToClient** (client coords) or cached [this+0x938/0x93C] | **AGREE** (wording: see C6) |
| Writer #7 | mouse band 0x200–0x206/0x20A; gate [0xBDD838]≠0 ∧ [[0xBDD838]+0xC]==0; x=LOWORD/y=HIWORD lParam | identical | **AGREE** |
| Focus writer | gates (rec≠0, [this+0x3B8]==0, payload≠0, tag∈{0x4F5C6A,0xD7511E}); resolve 0x93CBBE; Set 0x93CC9B; 10 E8 callers; 0x769B51 idiom N∈{500,800,1000} | identical (10 callers re-derived; all 10 carry N∈{0x1F4,0x320,0x3E8}; 8/10 with 0x769B51 in the −0x30 window) | **AGREE** |
| No per-tick writer | negative over decoded set | tick 0x53465B (38 L1 callees) and physics 0x9BE703 (+container 0x9BDF18, 165 L2 callees): zero 0x31D idioms, zero [reg+0x90] calls | **AGREE** (my scan strengthens the bound) |
| No deadzone/threshold | negative over decoded bodies | decoded gates re-derived: identity/presence/tag/rect only; equality redraw gate 0x9E65E9–0x9E65F6 verified (skip only if BOTH coords equal) | **AGREE** |
| Slot15 cull | window vs camera X0/Y0 from [0xBDD6F4] via 0x48AEC3 + 0x404B07/0x404B2E; extents [scene+0x1D0]/[scene+0x1D4] | identical formula (my 4 gates) | **AGREE** |
| 9 direct +0x1CC writers, no family install | none installs slot15-family vtable | identical: all 9 `mov [esi+0x1CC]` sites verified; zero family-table refs within ±0x120 (and at function granularity) | **AGREE** (but see C7 on the "no imm32 ref" overstatement) |
| 0x5CB0E0 clamp | [0,800]×[0,600] screen clamp on cursor wrapper | verified: `cmp` 0x320/0x258 clamps at 0x5CB0F1/0x5CB10A; also stores to [esi+0x938]/[esi+0x93C] (the cache 0x5CABE1 reads) | **AGREE** |

Ledger (R0/R6): EV-92 routing text matches raw bytes (0|1|6→0x564FBE, 2|5→0x564E52,
3|4→0x56512A-else-0x564E52, only <0/>6 no-op; my independent decode of 0x56599A–0x565A1C identical).
P2-01 = PRODUCT-READY with ORIGINAL-STATIC-PROVEN preserved inside `evidence_grade_and_type`, blocks=No.
P4-07: no stale `+0xD4` identity / `[0xBDD838]` creation-point / runtime-capture tasks (the only
"运行时捕获" occurrence in the matrix is P1-13 animation, unrelated); residuals =
[[user+0xF28]+0x14] semantics / cross-map input suppression / E2E3 pump phase, as claimed.
EV-93..EV-97 `source_sha256` recomputed with `evidence_canonical.py::canonical_sha256` — all 5 MATCH;
both companion hashes (classification CSV in EV-93, callgraph in EV-94) MATCH. Claims C-106..C-109
present with statuses CLOSED-STATIC ×3 + PARTIAL-STATIC (C-109); G10 next_action consistent; counts
109/97/41 ✓. Validator: **PASS 0 errors / 0 warnings**. Unit tests: **107/107 OK** (exit 0).

---

## 2. The single-instance falsification attempt (R1)

I actively tried to break "all 0x31D resolves alias one object":
- Shape2D factory 0x51402FB6: every path funnels through the record+0x10 cache check
  (`cmp [esi+0x10],ebx; jne skip`), creation once under lock via `[record+8]([record+0xC],
  0x5140DA0C, &record+0x10)`. **No fresh-instance path exists in DllGetClassObject.**
- The vtable slot+0x0C (0x51406970) that PCOM could call on the class object is the class-NAME
  getter (returns 'Shape2D#Vector2D' via 0x51402C90 string maker) — not an instance factory.
- EXE-side manager 0x7A4B2E caches per-ID in `[mgr+4]+0x31D*4` (global manager singleton at
  [0xBE2000]) — a second caching layer pointing at the same object.
- The only per-call "new" objects in the chain are the proxy/tween wrappers (0x48F721 proxies at
  EXE resolve layer; 0x514072CF temp clones inside the tween path) — neither is handed to callers
  as the resolved instance's replacement identity for Set purposes.
**Conclusion: the singleton closure (C-106) survives falsification.** The one place the lead's own
conclusion was UNDER-applied is the RECEIVER-OTHER pair (correction C1 below).

---

## 3. Corrections (re-derived from bytes; each with decisive evidence)

**C1 — RECEIVER-OTHER pair is misclassified; both are direct Sets on the SHARED Vector2D. (affects CSV + EV-93 text + report §2.2 + P2-05 wording)**
- Lead: rows 0x4B3BC5 / 0x4B3DAD = RECEIVER-OTHER ("receiver is the created sub-object, not the
  getter result").
- Mine: the receivers ARE shared-singleton objects created by in-function 0x31D resolves:
  - 0x4B3BC5: receiver eax=[ebp-0x1C]; the ONLY writes to [ebp-0x1C] are the init at 0x4B3738
    (`mov [ebp-0x1C], edi`) and the out-slot `lea ecx,[ebp-0x1C]` at 0x4B3764 fed to
    `call 0x447891` at 0x4B376D — from the resolve `mov esi,0x31D` at 0x4B3744. Under C-106 that
    object is THE shared CWzVector2D. Set args (x=[ebp-0x20], y=ebx) with default V3/V4.
  - 0x4B3DAD: receiver eax=[ebp-0x14]; writes: init at 0x4B3741 and out-slot `lea ecx,[ebp-0x14]`
    at 0x4B3824 fed to `call 0x447891` at 0x4B382D — from the resolve at 0x4B3813-0x4B3815
    (`push esi`(=0x31D); `push &[ebp-0xA4]`; `call 0x7A48D0/0x40634C`).
- Decisive bytes: 0x4B3744 (`be 1d 03 00 00`), 0x4B3764 (`8d 4d e4`), 0x4B376D (`e8 … → 0x447891`);
  0x4B3813 (`56`), 0x4B3824 (`8d 4d ec`), 0x4B382D (`e8 … → 0x447891`); receivers used at
  0x4B3B9A/0x4B3BC5 and 0x4B3D82/0x4B3DAD (`ff 91 90 00 00 00`).
- Correct classification: CONFIRMED-SHARED-WRITE-CONTEXT-UI (12 total, RECEIVER-OTHER 0). This
  also resolves the T087-reviewer "≥4 direct-write sites" note the lead tried to explain away.
- Status impact: none flips — C-106 is strengthened (two more direct shared-object writers join the
  census), P2-05/P2-06 stay DESIGN-DECISION; but EV-93's interpretation counts, the classification
  CSV, report §2.2 table, and P2-05 `evidence_grade_and_type` text need the 2/10/2/25 → 2/12/0/25
  recount.

**C2 — census `create_call_va` column is systematically +0x400000 off. (data quality)**
- e.g. resolve 0x9EC4D3 lists create call 0x00DEC4EE; the actual `call 0x447891` is at 0x9EC4EE
  (verified: `e8 af ac b0 ff` at 0x9EC4EE → 0x447891). 11/11 spot-checked rows follow
  true = listed − 0x400000; several listed values (e.g. 0xDEC4EE, 0xDDAB02) lie beyond the image
  end (~0xC5E000). resolve_va / function_start / attach columns are correct.

**C3 — one census attach-target inconsistency. (data quality)**
- Row resolve 0x0069213A lists attach_target `edi`; bytes at 0x692155-0x69215F show arg1=eax,
  out-slot=**ecx** (`lea ecx,[ebp-0x10]`), arg3=edi. The column elsewhere records the out-slot
  register, so this row should read `ecx`.

**C4 — "cleared-slot(VT_EMPTY)" bucket is mechanically wrong for both rows. (conclusion unaffected)**
- 0x9EC62A: V3 slot [ebp-0x30] IS VariantClear'd at 0x9EC57B, but is then re-templated from
  0xBE7330 (VT_ERROR/0x80020004) at 0x9EC5CB–0x9EC5D2 before the Set.
- 0x4EDE7C: same pattern (clear 0x4EDE29, template copy 0x4EDE2E–0x4EDE30).
- Both are VT_ERROR/missing, i.e. the same immediate class as the other 33; the bucket "33 default
  + 2 cleared VT_EMPTY" should read "35 default(VT_ERROR/missing)". Immediate-class conclusion
  unchanged (Shape2D treats VT_EMPTY and VT_ERROR identically at 0x51408296/0x5140829D).

**C5 — registration container of callback 0x9E6CA4 mis-attributed to 0x9E649A. (containment error; trigger semantics unchanged)**
- Report §3.1 and CFG §A2 say the callback is registered "by the surface-present fn 0x9E649A
  (registration tail 0x9E6C05-0x9E6CA3)". Bytes: 0x9E649A's function ends with a full SEH epilogue
  `…leave; ret 4` at 0x9E6B9C–0x9E6BAA; the registration code (0x9E6C3F `push 0x9E6CA4`;
  0x9E6C45 `call [0xBE1554]`) lives in a SEPARATE thiscall function starting 0x9E6BAD
  (`push ebx; mov ebx,ecx`), with no static jumps/calls into it (indirectly dispatched). 0x9E649A
  is itself called FROM the callback region (E8 at 0x9E6E10).
- The cursor seeding (0x9E6C30), the gates, and the cursor-mode conclusion are unaffected; only
  the containing-function attribution (report + CFG header) is wrong.

**C6 — "screen-space" wording for writer #6. (precision)**
- 0x5CABE1: [this+0xC]≠0 → copy cached [this+0x938]/[this+0x93C]; else [0xBE1768](pt) =
  GetCursorPos-style, then [0xBE1764]([this].hwnd, pt) = ScreenToClient-style. The cached point is
  itself written by 0x5CB0E0 after clamping to [0,800]×[0,600] (verified at 0x5CB0F1/0x5CB10A/0x5CB122-0x5CB128).
- So #6's point is a screen-cursor-derived **client-space** point (or the clamped cache), not raw
  screen coordinates. The classification "cursor-follow mode, not world-space" stands.

**C7 — "33 family vtables have no imm32 code reference" is false for the family's base table. (weakens an UNLOCATED statement)**
- T088-CAMERA-BOUNDS-SCENE-PORTAL.md §2 and EV-97 claim no imm32 code refs. Table **0xB01278**
  (family member, slot15=0x53471A at 0xB012B4) has four imm32 installs in .text:
  0x52F1BC `mov [ecx],0xB01278`, 0x52F1D1 `mov [esi],0xB01278` (inside the vtable-stamping
  thunk at 0x52F1CC), 0xA0B3A0 `mov [eax],0xB01278`, 0xA0BB2C `mov [ecx],0xB01278`.
- The installer of the family BASE table is therefore statically located (0x52F1CC thunk and the
  0xA0B3A0-region installer); the other 32 tables remain without static imm32 refs (runtime/
  derived installs), so "installer of the remaining 32 UNLOCATED" is the correct bounded statement.
  The load-bearing negative — none of the 9 direct +0x1CC writers installs a family table — is
  confirmed independently and unaffected.

---

## 4. R4 supplementary scan (INCONCLUSIVE containing functions, threshold-likes)

Scanned all 25 INCONCLUSIVE rows' containing functions (plus 0x4B2C8E) for `cmp r32, imm` with
imm > 8 (non-pointer immediates): three hits total —
0x6EDA01 `cmp 0xA(10)`, 0x9866AE `cmp 0xA(10)`, 0x7AA67B `cmp 0xC8(200)`.
- 0x7AA67B: `sub eax,[ebp+8]; cmp eax,0xC8; jg bail` inside 0x7A9F90 (which hosts Set sites
  0x7AA130/0x7AA1DD/0x7AA848). Predecessor block (0x7AA06F) computes `ecx = [ebp+8] − [ebx]` on a
  UI-list object (`[ebx]`, `[ebx+0x1C]` list fields) — a list-scroll/width range check, NOT a
  camera-vector delta (the shared V2D in this function is reached via the separate resolve at
  0x7AA090 with receiver [ebp-0x10]).
- 0xA/0xA hits are string/length-scale compares.
→ No threshold-on-camera-delta counterexample found; the lead's bounded negative stands, now with
the residual habitat explicitly probed.

---

## 5. Answers

**(Q1) Does any evidence contradict "the fieldctx-ctor Set at 0x9EC62A takes effect immediately"?**
No. Byte-level: V3=[ebp-0x30] cleared (0x9EC57B) then re-templated to VT_ERROR/0x80020004
(0x9EC5CB–0x9EC5D2) — the lead's "VT_EMPTY cleared slot" mechanism detail is wrong (C4) but the
class is the same: Shape2D 0x5140828F jumps to the immediate store for VT_EMPTY(0) and VT_ERROR(0xA)
alike (`cmp word [ebp+0x14],0; je …; cmp …,0xA; je 0x5140830E`), storing X→[this+0x1C],
Y→[this+0x20] when [this+0x24]==0. The Set(-400,-300) at 0x9EC62A is therefore immediate. Only
runtime caveat: if the singleton ever carries a non-null peer at +0x24 the immediate path forwards
to 0x51407A34 (still synchronous) — statically the ctor initializes the peer to NULL.

**(Q2) Is "writer #6/#7 are cursor-mode, not world-space" supported?**
Yes. #6: point = 0x5CABE1 read at registration = GetCursorPos→ScreenToClient client coords or the
cached [0x938/0x93C] point (clamped to [0,800]×[0,600] by 0x5CB0E0); gate = PtInRect on a window
rect. #7: x=LOWORD/y=HIWORD of the mouse-message lParam (client coords), gate
[[0xBDD838]+0xC]==0. Neither path touches world/avatar coordinates. Minor precision fix on
"screen-space" → "screen-cursor-derived client-space" (C6); conclusion unchanged.

**(Q3) Single most important next static step for G10?**
Census the writers of the avatar-container position object **[[user+0xF28]+0x14]** (the focus
writer's X/Y source, fetched via 0x93CD77 and read with slots +0x20/+0x28) — i.e., locate its
class/creation and enumerate its Set/Add sites. That closes the focus-writer geometry semantics
("does 0x93CB27 centre the avatar?"), which is the last open half of the decoded camera-cadence
story and the exact residual P2-05/P2-06/P4-07 and G10 all point at. (Second-order: with C1
applied, decoding the remaining INCONCLUSIVE sites drops to 23.)

---

## 6. Verdict

**ACCEPT-WITH-CORRECTIONS**

Numbered corrections (address | lead conclusion | my conclusion | decisive evidence | status impact):
1. 0x4B3BC5 & 0x4B3DAD | RECEIVER-OTHER (non-shared receiver) | CONFIRMED-SHARED-WRITE-CONTEXT-UI — receivers are the 0x31D-created shared V2D | resolves 0x4B3744/0x4B3813 + out-slots 0x4B3764 (`lea ecx,[ebp-0x1C]`)/0x4B3824 (`lea ecx,[ebp-0x14]`) → `call 0x447891` at 0x4B376D/0x4B382D; receivers consumed at 0x4B3BC5/0x4B3DAD (`call [ecx+0x90]`) | CSV/counts/EV-93 text/report §2.2/P2-05 wording must be updated; no claim/gap/matrix status flips (C-106 strengthened)
2. census CSV `create_call_va` (all rows) | VAs like 0x00DEC4EE | true call sites = listed − 0x400000 (0x9EC4EE etc.) | `e8 af ac b0 ff` at 0x9EC4EE → 0x447891; 11/11 spot rows; listed values exceed image end | data-quality fix only
3. census row 0x0069213A | attach_target edi | attach_target ecx (out-slot) | `lea ecx,[ebp-0x10]` 0x692156; `push edi` is arg3 | one-row fix
4. classification rows 0x9EC62A/0x4EDE7C | variant3_4 "cleared-slot(VT_EMPTY)" | both re-templated to VT_ERROR/missing → 35/39 uniform default class | 0x9EC5CB–0x9EC5D2 and 0x4EDE2B–0x4EDE30 (`push 0xBE7330; call 0x402C26`) after the clears | bucket label fix; immediate conclusion unchanged
5. report §3.1 / CFG §A2 header | callback registered by fn 0x9E649A (its "tail") | registered inside separate function 0x9E6BAD (indirectly dispatched); 0x9E649A is called BY the callback (0x9E6E10) | `ret 4` epilogue at 0x9E6BAA ends 0x9E649A's function; 0x9E6BAD starts `push ebx; mov ebx,ecx`; no static refs into 0x9E6BAD..0x9E6CA3 | attribution fix; trigger semantics unchanged
6. report/CFG "screen-space singleton base read" (#6) | screen cursor | GetCursorPos→ScreenToClient client coords, or cached clamped point | 0x5CABE1 body ([0xBE1768]/[0xBE1764] calls); cache written by 0x5CB0E0 after 0x320/0x258 clamps | wording fix; cursor-mode conclusion stands
7. BOUNDS §2 / EV-97 "33 family vtables have no imm32 code reference" | none | base table 0xB01278 has 4 imm32 installs (0x52F1BC, 0x52F1D1, 0xA0B3A0, 0xA0BB2C); installer of base table located (thunk 0x52F1CC); other 32 remain unlocated | bytes `c7 01/06/00/01 78 12 b0 00` at those sites; 0xB01278+0x3C=0x53471A | UNLOCATED statement should be narrowed to the 32 non-base tables; the 9-writer negative stands

Quality gates re-run by reviewer: validator PASS (0/0), unit tests 107/107 OK, canonical hashes
EV-93..97 + 2 companions MATCH, counts 109/97/41 confirmed.


---

## Lead closure record (T088, post-review)

All seven corrections were re-verified by the lead from raw bytes and applied:

1. **C1 (0x4B3BC5/0x4B3DAD receivers)** — verified: in-function resolves create the
   shared V2D into out-slots ([ebp-0x1C] @0x4B3764, [ebp-0x14] @0x4B3824, both
   `call 0x447891`). Both rows reclassified RECEIVER-OTHER -> CONFIRMED-SHARED-
   WRITE-CONTEXT-UI (classification now 2 / 12 / 0 / 25). CSV, EV-93, C-106 note,
   report §2.2 and matrix P2-05 updated. No status changes (strengthens C-106).
2. **C2 (census create_call_va +0x400000)** — verified; decode_attach had a
   double-BASE add. Fixed; 11 sites re-derived at correct VAs.
3. **C3 (0x69213A attach 'edi' -> out-slot)** — fixed generally: the attach
   resolver now follows `lea/mov` definitions of bare-register pushes; the row
   now reads [ebp-0x10].
4. **C4 (cleared-slot label)** — verified: after VariantClear at 0x9EC57B the
   V3 slot is re-templated from 0xBE7330 at 0x9EC5C3-0x9EC5D2 (`mov edi,
   0xBE7330; push edi; call 0x402C26`). Classifier extended (push-imm /
   mov-imm / call-0x40318F anchors); all 39 sites now uniformly
   default(VT_ERROR,missing). Immediate conclusion unchanged.
5. **C5 (registration function)** — verified: 0x9E6BAD is a separate function
   (`push ebx; mov ebx,ecx` prologue; registers the callback at 0x9E6C40);
   0x9E649A ends at 0x9E6BAA and is called BY the callback at 0x9E6E10.
   T088-FIELD-9E6CA4-CFG.txt §A2 regenerated; C-107/EV-94/report updated.
6. **C6 (client-space wording)** — applied to C-107/EV-94/cadence doc
   (screen-cursor-derived CLIENT-space point).
7. **C7 (family-vtable installs)** — verified: base table 0xB01278 is installed
   at 0x52F1CF (`mov [esi],0xB01278`), 0xA0B39E and 0xA0BB2A, each followed by
   the shared init 0x52F37F. The draft "33 family tables have no imm32 code
   reference" claim is WITHDRAWN; the bounded negative that stands is: none of
   the 9 direct +0x1CC writers installs a family vtable, and the derived
   tables / scene +0x1CC member install remain UNLOCATED. WP4 script, EV-97
   and report updated; the base-ctor sites are recorded as the next-step lead.

Non-blocking observations adopted: the 39-row CSV is 38 unique sites (0x6BE6F4
joined via both the resolve and the getter path) — disclosed in EV-93; the
reviewer's R4 extension (2-level callee scans of slot12 tick 0x53465B and
physics loop 0x9BE703: zero 0x31D idioms, zero slot+0x90 calls; 25
INCONCLUSIVE containing functions probed: only 3 cmp-imm>8 hits, none a camera
delta) is recorded as strengthening the no-per-tick / no-deadzone bounded
negatives.

Post-fix gates: Validator PASS (0 errors / 0 warnings); unit tests 107/107 OK;
clean-room regenerated in sync. Reviewer verdict stands at
**ACCEPT-WITH-CORRECTIONS -> corrections applied; final state ACCEPT**.
