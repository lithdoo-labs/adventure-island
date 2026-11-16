# T090 — Independent CMS079 Static Closure Reviewer (archived)

> Archived by the T090 lead agent from the reviewer sub-agent's private working
> directory (real independent session(s), private scripts, read-only repo
> access, no commits/pushes). Session history: the Phase-1 blind run hit the
> account's sub-agent session budget mid-round after completing its q1–q7
> verification scripts; a resumed reviewer incarnation finished the blind
> synthesis, detected that its pinned T089 canonical copies had been extracted
> AFTER the lead's WP0 commit (contamination), disclosed this, and re-derived
> the Q6 verdicts from clean `git show d1dcb8b4:` extracts. This file is a
> faithful concatenation of the blind notes and the phase reports as they
> complete.

---

# T090 REVIEWER — PHASE-1 BLIND REVIEW NOTES (CMS079 Static Closure)

Reviewer role: T090 independent static-closure reviewer (blind phase).
Date: 2026-11-16. All work performed with local python/capstone scripts only; READ-ONLY on the repo; no commits/pushes.
Private working dir: `C:\Users\lithd\AppData\Local\Temp\opencode\t090-reviewer\` (q1_*…q7_* outputs + this file).

---

## (i) Repo HEAD / pinned-tree verification

- **Pinned review tree: `d1dcb8b4a0db55b9498bfc99a5d828d9411be463`** ("research: t089 reviewer phase-4 remote verification archive"). All canonical T089 text for this blind review was taken from this tree via `git show d1dcb8b4:<path>`.
- Current repo HEAD at review time: `e9e71ba3e27353a7800cf0aa348300bf0d0fb7ef` ("research: t090 wp0 canonical errata …", the lead's single post-T089 commit). **Its contents were NOT used for blind findings** (see contamination note below).
- Uncommitted lead work exists in the working tree; not read.
- **Contamination disclosure (self-reported):** my earlier-session pinned copies `T089-report.md`, `T089-audit.csv`, `T089-matrix.csv` (copied 10:27–10:29 local) turned out to be **post-WP0 versions** — the pinned report contains a `[t090 WP0-B 勘误]` header and the pinned audit CSV has rewritten `reviewer_opinion` values (`archived-ACCEPT …`) and a changed G40 `start_status`. Upon detecting this I re-extracted the true T089-tree state with `git show d1dcb8b4:` into `t089tree_audit.csv`, `t089tree_matrix.csv`, `t089tree_claims.csv`, `t089tree_gaps.csv` and derived **all Q6 conclusions below from the tree copies only**. Where the post-WP0 copy had already been seen, the affected number is marked `[leak-seen]` and my independent count is given alongside. (For the record: matrix *verdict columns* are byte-identical between tree and post-WP0 copies; the WP0 diff sits in other columns. `gaps.csv` (GAP-REGISTER) is identical to the tree copy.)

## (ii) Binary hash table (SHA-256, recomputed once at review time; 16-hex prefixes)

| Binary | SHA-256 prefix (mine) | Matches T089-cited hash? |
|---|---|---|
| `.work\task-036\game-image-unpacked.bin` (EXE @0x400000) | `d4a67597a7e1a072` | YES — matrix CSV cites `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` |
| `.work\task-063\client-stage\Shape2D.dll` ( @0x51400000) | `9802baccd7875432` | YES — matrix cites `9802baccd787543221391b4b902c…` |
| `.work\task-063\client-stage\Gr2D_DX8.dll` ( @0x50400000) | `ad67b9a08a0a360e` | YES — matrix cites `ad67b9a08a0a360e9a31f0274d29b8…` |
| `.work\task-063\client-stage\PCOM.dll` ( @0x50C00000) | `cf3807f3107152d3` | YES — report §1 cites `cf3807f3…b62306c94…` |

All four binaries my scripts decode are the exact bytes T089 hashed. EXE code band scanned: 0x401000–0xBEA000.

---

## (iii) Per-question findings

### Q1 — C-109/C-115 parameter layout of the focus writer 0x93CB27 (q1_*, q8_finish*)

**0x769B51** (string/record resolver): `this=ecx` (callers pass `[0xBD8FEC]`), **one** stack arg `[ebp+8]`; wraps `0x7743B9(ecx+4, &arg, &out)`; returns the record object in `eax`; **`ret 4`** (bytes `c2 04 00` @0x769B99). ⇒ C-109's "0x769B51([0xBD8FEC], string_id, N, 0)" arg list is wrong; C-115's "ret 4 (ONE arg)" is correct.

**0x93CB27** (thiscall, `ecx=this`): 3 stack args — arg1=[ebp+8] (record/string from 0x769B51), arg2=[ebp+0xC] (=N), arg3=[ebp+0x10] (object). Callee-scope cleanup inferred **ret 0xC** (callers do no `add esp,0xC` after the call — e.g. 0x5C0347 goes straight to `pop esi`; the `ret` instruction itself was not decoded — honest caveat).
- Gates: arg1≠0 (0x93CB3A); `[this+0x3B8]==0` (0x93CB47); payload length `([obj][0][-4]>>1)≠0` (0x93CB5F–0x93CB7B, BSTR-like length).
- **Tag test** `eax=[arg1]` vs `{0x4F5C6A, 0xD7511E}` (0x93CB85–0x93CB97):
  - **Tagged → Set path:** 0x93CC15 `ecx=[ebp+0x10]` (**arg3**) → **0x93CD77** reads **`[ecx+0x14]`** (`mov eax,[ecx+0x14]; *out=eax; if(eax) eax->vtbl[1](eax)` = AddRef getter, `ret 4`), twice; X = **0x404B07** (`[vt+0x20]`), Y = **0x404B2E** (`[vt+0x28]`); then **Set = `call [ecx+0x90]` @0x93CC9B** with (string, X, Y) — the exact Set site C-109 cites. **Set source = `[[arg3]+0x14]`.**
  - **Untagged → F28 path:** 0x93CB99 `lea eax,[ebp+0x10]; push eax; call 0x4B1C27` — 0x4B1C27 does `*out = [this+0xF28]; if(nonnull) obj->vtbl[1](obj)` (AddRef), i.e. **the arg3 slot is overwritten with `[this+0xF28]`**, then re-strings via 0x420AA1 and `jmp 0x93CCF4` — **past the Set: Set is SKIPPED.**
  - Post-phase (both paths, 0x93CCF4+): uses arg2 (=N) with 0x414A7E/[esi+0xECC] and 0x44484B — a timed/queued follow-up with N as duration-ish parameter.
- **Caller table (E8 census = exactly 10 sites; matches C-109's 10):**

| caller | arg1 | arg2 = N | arg3 | arg3-zero proof |
|---|---|---|---|---|
| 0x5C0342 (in wrapper 0x5C0327, this=[esi+0x10]) | 0x769B51([esi+0x44]) | **0x320** (800) | **esi = wrapper object (NON-ZERO)** | — |
| 0x964E16 | 0x769B51(esi) | **0x3E8** (1000) | ebx = 0 | xor ebx,ebx @0x964370 dominates; no later ebx write (q1_ebx_f28) |
| 0x9651CC | 0x769B51(0x40413D) | **0x3E8** | ebx = 0 | same |
| 0x965567 | 0x769B51(eax) | **0x3E8** | ebx = 0 | same |
| 0x98DC43 | 0x769B51(0x406849) | **0x1F4** (500) | ebx = 0 | xor ebx,ebx @0x98D757/0x98D763 dominate |
| 0x990E21 (fn 0x990B2E) | 0x769B51(vcall [eax+0x40]) | **0x3E8** | esi = 0 | xor esi,esi @0x990B42; no esi write 0x990B44–0x990E0B (Q5m/Q5n raw scan) |
| 0x990E91 (fn 0x990B2E) | 0x769B51(edi) | **0x3E8** | esi = 0 | same, no esi write visible to 0x990E88 |
| 0x93E00B (fn 0x93DC3E) | — | not captured | **0** (prior-session finding) | xor ebx,ebx @0x93DFF8 dominates (q1_fill_path/q1_ebx_f28) |
| 0x959493 / 0x959527 (fn 0x9573A6) | — | **not captured within budget** | not captured | containing fn start 0x9573A6 (Q5o) |

  N set verified = {500, 800, 1000} — matches C-115's "{500,800,1000}".
- **NEW TENSION (my bytes, beyond the canonical text):** 9 of 10 callers pass **arg3=0**. In the tagged path 0x93CD77 would dereference `[0+0x14]` — a null-deref. Therefore those 9 callers can only execute the **untagged** path, in which the Set is **skipped**. Only 0x5C0342 is byte-proven able to reach the Set (non-null arg3). The "10-caller focus-writer family" framing (C-109) is thus correct about the call census but the *Set* is reachable from at most 1 proven caller; which callers' records actually carry tags {0x4F5C6A, 0xD7511E} is undetermined statically.

### Q2 — The 36 `push 0x155D` delay sites + paired defaults (q2_delay.txt, q2_pair.py)

- Census `68 5D 15 00 00` in 0x401000–0xBEA000: **exactly 36 sites** (list in q2_delay.txt / q2_pair.py output).
- Uniform idiom: `push <default>; push ecx; mov eax,esp; push 0x155D; push eax; call 0x7A48D0` → 0x7A48D0(va_list*, id=0x155D); several sites then chain `0x406368` (0x989C76, 0x988B2D, 0x9892E6, 0x98758E).
- **Paired default (nearest preceding push): 0x78 (120) ×11, 0x96 (150) ×2, 0x3C (60) ×2, 0x3E8 (1000) ×2, variable/other ×19** (e.g. `push [eax]` @0x989C61, register pushes). **180 (0xB4) was NOT observed** in the nearest-push window — it is either inside the 19 variable sites or an error in the T089 phrasing ("显式默认 150/60/180/1000").
- Containing functions: 31 total; clusters 0x407B44 ×4; 0x406BDD, 0x697A2D, 0x987CA8 ×2 each; 27 singletons. Site 0x43EC81 (fn 0x43EC69, paired 0x78) independently confirms the T089 matrix row "0x0043F768 delay default 0x78 → 0x43EC69 (push@0x43EC79/0x43EC81)".

### Q3 — Shape2D 0x514086B3 (vtable slot +0x9C) full decode (q3_slot9c/q3_cont/q3_callsites)

- **Slot:** +0x9C on **both** tables `0x5140C0FC` (abs 0x5140C198) and `0x5140C2F0` (abs 0x5140C38C). The two tables are identical for +0x88…+0xAC and differ **only at +0xB0** (0x5140AD40 vs 0x51401A8E). Neighbours: +0x90=0x5140828F (Set: wstring @arg[ebp+0x14], checks wchar 0/0xA), +0x98=0x5140847D (parallax attach; E_POINTER 0x80004003 null-arg checks), +0xA4=0x51408BED, +0xA8=0x51408C9A.
- **Boundary/ABI:** SEH-wrapped (0x5140AD20 prologue, fs:[0] unwind at 0x51408773). **`ret 0x34`** (0x5140877C) = 13 stack dwords. Two dword args ([ebp+0x24]=arg7, [ebp+0x28]=arg8) validated **unsigned ≤ 0xFFFFFF** (`cmp ebx,0xFFFFFF; ja` → `mov eax,0x80070057` E_INVALIDARG @0x51408769). Wstring at [ebp+0x0C]: first wchar `==0` or `==0xA` skips record creation.
- **Semantics (record builder):** obtains engine object via `[0x51411C70]`→0x51409FC8, ctor **0x51408856** (installs vtables 0x5140D938/0x5140D934 at [esi]/[esi+4], zeroes +0x8/+0x1C, calls `[0x51411860]` on &esi+0xC — critical-section-like init); copies rect origin [ebp+0x1C]/[ebp+0x20] and computes extent `lea ecx,[eax+edi]`, `lea edx,[ecx+ebx]` (w=arg7, h=arg8); calls **0x51408A12(&[ebp+0x2C], 0)** and installs one of two handlers at **[rec+0x1C]**: **0x514088DB** (range clamp: `if lo>=hi+extent → clamp`) or **0x514088A9** (tile/mod: `(v-lo) mod extent` with negative fixup) — i.e. wrap-mode select; publishes via resolver **0x514072CF** + attach 0x5140833B; releases the temp interface at [ebp+0x24] via `vtbl[2]`; returns **S_OK** (`xor eax,eax` @0x51408835) or E_INVALIDARG.
  ⇒ +0x9C is a **create-primitive variant**: rect+size+two 0xFFFFFF-masked dwords (colour-space components) + wrap mode (clamp vs modulo) + a mode selector arg — *not* a duplicate of +0x90 (text Set) nor +0x98 (parallax attach). This closes the T089 G36 residual "+0x9C 变体语义" at the body level (draw-side consumption still outside).
- **EXE call-site census `call [reg+0x9C]`: exactly 8 sites** — 0x43759C, 0x4379D4, 0x4B3B0B, 0x4B3EC1, 0x66B1A6, 0x66C0EF, 0x66D6D0, 0x66DA86. Contexts of 0x43759C and 0x66DA86 show twin `sub esp,0x10` + movsd argument blocks + IID **0xBA0500** failure logging — consistent with the 13-arg/`ret 0x34` ABI and a COM-style error contract.

### Q4 — Camera filter consumers (+0xA4 query / walker / X-Y getters) (q4_filter/q4_commit/q4_walker/q4_walk2/q4_vtables)

- **+0xA4 = 0x51408BED (`ret 8`)** — filter QUERY/consume: arg2 = out ptr (null → E_POINTER); resolver 0x514072CF; helper **0x51408C44(this, 0x1E0000)** searches the pending list `[this+0x3C]` for a record tagged **0x1E0000** (compares `[cand+4]` via record method); on hit: `*out = [hit+8]`, **clears dirty `[this+0x54]`**, decrements pending count `[this+0x18]` (zeroing `[this+0x14]` when drained); on miss `*out = 0`; returns S_OK.
- **+0xA8 = 0x51408C9A (`ret 8`)** — filter COMMIT (publisher): same tag search; hit → `[hit+8] := arg`; miss → allocates via `[0x51411C68]`/0x5140A019 and installs template vtables **0x5140D968/[esi+4]=0x5140D964** (+aux 0x5140D974), sets `[rec+8]:=arg`, attaches via 0x5140833B. Record method **0x51408D1D returns the tag 0x1E0000**. Template contents dumped (q4_vtables): 0x5140D968 = [0x51408E80, 0x51408D1D, 0x51408D23, 0x51408EBF, 0, 0x403C0000(=2.95f), 0x51409B39, 0x5140AB37]; 0x51408E33-0x51408E7D = the deadband residual evaluator (`fcom [0x5140D8C8]`, clamp-to-zero below deadband, `ret 0xC`).
- **X/Y getters:** slot +0x20 = **0x5140724A**, +0x28 = **0x514074C8** (`ret 8`, out-ptr checked). Fast path: if `[rec+0x24]==0` return X=`[rec+0x1C]` / Y=`[rec+0x20]`. Slow path **0x51406ADC** (getter walker): takes `ecx`=record, checks dirty `[rec+0x54]` and frame `[rec+0x58]` vs global tick **[0x51411C34]**, then calls walker **0x51406CF7** which sets `[obj+0x54]:=1`, `[obj+0x58]:=frame`, walks the pending list `[obj+0x3C]` evaluating records via `[ecx+0x8C]` (with `[obj+0x1C]` as current attached object), and finally reads/updates `[obj+0x50]`, `[obj+0x20]`, `[obj+0x24]`; the getter then returns X/Y from **[obj+0x70]/[obj+0x74]** (and [+0x68]…).
- **Wiring verdict:** the filtered commit/query records and the getters' slow-path walker manipulate the **same object state** (`+0x54` dirty, `+0x18/+0x14` pending count, `+0x3C` list, tag search helper 0x51408C44 shared by +0xA4/+0xA8/0x51408D1D) — Shape2D-internally the filter output **does** feed the walker/getter ecosystem. **BUT: EXE census of `call [reg+0xA4]` = 0 sites** (q4_commit Q4e). No direct EXE dispatch to the query slot was found in the byte form scanned; the EXE side only proves the 3 `[vector+0xA8]` commit sites (C-114's census; not re-verified here). The "filtered output consumed by EXE" link therefore remains open on the consumer side.
- Q1/q4 cross-check: the EXE wrappers **0x404B07/0x404B2E** call exactly `[vt+0x20]/[vt+0x28]` and are the X/Y getters 0x93CB27 uses for the Set — the same getters the filter-refreshed records back.

### Q5 — The `[[arg3]+0x14]` object class (q5_f28/q5_sib/q5_lea/q5_writer/q5_census2/q5_arg3objs/q5_fn990b2e)

- The getter **0x93CD77** (`ret 4`): `eax=[ecx+0x14]; *out=eax; if(eax) eax->vtbl[1](eax)` — an AddRef smart-pointer accessor; **byte-identical in shape to the F28 getter 0x4B1C27** (`*out=[this+0xF28]; AddRef`). So `+0x14` of the arg3 object is itself a ref-counted child object (a position/vector holder), matching C-109's "BOUNDED: src is a private position object of the avatar-container class".
- **+0xF28 field census (EXE, raw-byte `28 0F 00 00` disp):** 64 read sites, 5 `cmp` sites (0x934CC6, 0x936441, 0x93E821, 0x93EC76, …), and **exactly ONE direct writer: 0x934443 `mov [esi+0xF28], ebx`** — inside ctor **0x9343EF**, and it writes **zero** (part of the zeroing block +0xF24/+0xF28/+0xF30/+0xF34/+0xF38/+0xF3A/+0xF3C/+0xF3E; note `[esi+0xF2C]:=eax`(arg) at 0x93444C). Ctor 0x9343EF is called from 0x4B6D86, 0x94FDCC, 0x98CC66.
- **Caveat 1:** 13 **LEA** sites take `&obj->F28` (0x934B9E, 0x936447, 0x936812, 0x970E8, 0x93F218, 0x949B46, 0x950920, 0x985F0A, 0x986402, 0x98A068, 0x98D021, 0x98D269, 0x991568) — the field's address is passed around, so indirect writers (smart-ptr out-params) are NOT excluded by the direct-writer census. The claim "[this+0xF28] never written except zeroed at construction" holds only for direct 89/C7 forms.
- **Caveat 2 (self-correction):** my q1_ebx_f28/q5_census2 "0 disp32 0xF28 sites" tallies were **buggy scans** (opcode-filter errors); the authoritative numbers are the 64-site raw-byte census above and the q5_sib 7-site 0xF20–0xF30 window.
- **arg3-object callers:** 0x5C0342 passes `esi` = wrapper-0x5C0327's `this` (fields +0x10, +0x44 in use); 0x990E21/0x990E91 (fn 0x990B2E, a WZ-decode function using 0x4066C9/0x4066FF) pass **esi=0** (proven, Q1 table). The 0x950970 site (C-114 chain) reads `[ebx+0xF28]` with the identical AddRef shape and flows into 0x43291A→0x437717 — consistent with C-114's F28-container stash description.
- Which class the arg3 object belongs to (i.e. who writes `[[arg3]+0x14]`'s contents) remains **open**: the +0x14 child's writers were not censused this session.

### Q6 — T089 canonical errata (verified against `git show d1dcb8b4:` copies)

**(a) C-109 stale text vs C-115.** C-109 (t088, in `research/result/clean-room/CLAIM-CONSISTENCY-REGISTER.csv` @d1dcb8b4) says: *"Set(X(src), Y(src)) with src = [[this+0xF28]+0x14] (AddRef getter 0x93CD77; …)"* and *"uniform idiom 0x769B51([0xBD8FEC], string_id, N, 0) -> record -> 0x93CB27"*. My bytes: the Set source is **`[[arg3]+0x14]`** (0x93CD77 reads `[ecx+0x14]` with `ecx=[ebp+0x10]`=arg3); the `[this+0xF28]` path (0x4B1C27) **fills the arg3 slot and skips the Set**; and 0x769B51 is `ret 4` with ONE arg (N goes to 0x93CB27, not 0x769B51). **C-115's wording is byte-exact; C-109's Set-source phrasing and 0x769B51 arg list are stale/wrong.** (C-109's 10-caller census and N values {0x320, 0x3E8, 0x1F4} match my bytes; its "0x93E00B/0x959493/0x959527 N=0x3E8" sub-claims were not re-verified.)

**(b) Matrix row count / verdict distribution vs report §3.** T089-tree `T089-OPENMS-CMS079-MATCH-MATRIX.csv` contains **24 data rows** (25 lines incl. header). Verdict distribution (machine-tabulated from the tree copy): MATCH ×12, MATCH-STRUCTURE ×2, MATCH-COUNTS ×1, "MATCH (shared engine)" ×1 (= **16 MATCH-class**), REFUTED-CONSTANT-MATCH-SEMANTICS ×1 + REFUTED-OLD-EVIDENCE ×1 (= **2 REFUTED-class**, both counted as refutations; REFUTED-OLD-EVIDENCE is an internal row), INCONCLUSIVE ×1 + INCONCLUSIVE-IDS-DIFFER ×1 (= **2**), RESOLVED ×1 (internal), **NOT-RUN ×3 (G40/G20/G16)**. The T089-tree report §3 states *"矩阵 26 行中 22 行为本轮执行 … 4 NOT-RUN"* — **all three numbers disagree with its own CSV** (26≠24 rows; executed = 24−3 = **21**; NOT-RUN = **3**). The "22" coincides with the external-candidate count (24 − 2 internal rows: EV-20 refutation + string-ids RESOLVED), i.e. the report mixed two counting scopes. `[leak-seen: the post-WP0 pinned report reaches the same conclusion; my counts above were re-derived independently from the tree CSV.]`

**(c) Audit CSV pending opinions + G40 contradiction.** T089-tree `T089-GAP-CLOSURE-AUDIT.csv` (8 rows) ships **`reviewer_opinion = pending` for all 5 targeted gaps** (G35/G36/G39/G37/G10) — no recorded opinion despite the report's §5 "independent reviewer" narrative — and G40/G20/G16 have `end_status = n/a`. **G40 contradiction inside the tree:** audit says `G40 start_status = OPEN-STATIC, end_status = n/a`, while the same tree's `research/result/clean-room/GAP-REGISTER.csv` says `G40 status = PARTIAL-STATIC` with a rich verified_scope (EV-23/26, C-058/C-067/C-068/C-080 …) — the audit row is stale relative to the register. `[leak-seen: post-WP0 audit rewrites the opinions to "archived-ACCEPT …" and G40 start to PARTIAL-STATIC — consistent with, but not used for, my finding.]`

### Q7 — Map.wz portal frame census (q7_wz_probe2/3b/4, re-run this session)

Source: `.work\task-001\extracted\*\Map.wz`, opened via repo wzpy (region EMS), `MapHelper.img → portal/game`. (Prior-session probe outputs were lost; probes 3b/4 re-run today; read-only.)
- **pv:** 8 frames, each only an `origin` vector — **no delay / a0 / a1** properties.
- **ph/default:** portalStart **4** frames, portalContinue **7**, portalExit **3** — origins only, **no delay/a0/a1**.
- **psh/default:** 4 / 7 / 3 (origins only). **psh/1:** 1/1/1 frames with `z=0`; **portalStart/0 carries `a0=0, a1=200, delay=1500`**; **portalExit/0 carries `a0=255, a1=0, delay=1500`**; portalContinue/0 has only `z=0`. **psh/2:** 6 / 14 / 6; **psh/3:** 6 / 14 / 6 (first frames: origin + z only).
- Recursive whole-`portal`-subtree search: **`delay` ×3** (editor/tp = 100; psh/1 Start = 1500; psh/1 Exit = 1500), **`a0` ×2 and `a1` ×2 (only psh/1)**, **`z0`/`z1` ×0**.
- Cross-check vs T089 matrix row "pv loop 8f/960ms ph 4+7+3" (MATCH-COUNTS): my **pv=8 and ph/psh-default 4/7/3 are independently confirmed**; the **960 ms figure was NOT re-derived** (no per-frame delay exists in WZ for pv/ph — it must come from the engine default path; Q2's EXE-side census is the only static evidence for defaults). psh/2 and psh/3 (6/14/6) are additional data not asserted in the matrix row.

---

## (iv) What CMS079 bytes PROVE vs what REMAINS OPEN

**CMS079 bytes prove (this review, independent):**
1. 0x769B51 is `ret 4`, one arg, returns the record object (C-115 arg-fix confirmed).
2. 0x93CB27: 3 args (record, N, arg3); gates arg1≠0, `[this+0x3B8]==0`, BSTR-length≠0; tag set {0x4F5C6A, 0xD7511E}; **Set source = `[[arg3]+0x14]`** via 0x93CD77; X/Y via 0x404B07/0x404B2E = `[vt+0x20]/[vt+0x28]`; Set call site 0x93CC9B `[vt+0x90]`; untagged path replaces arg3 with `[this+0xF28]` (0x4B1C27) and **skips the Set**.
3. Exactly 10 E8 callers; N ∈ {0x320, 0x3E8, 0x1F4} (7 sites byte-verified); **arg3=0 at 6+ of them** (register-zeroing dominance proofs).
4. 36 `push 0x155D` sites, idiom + paired defaults 120×11 / 150×2 / 60×2 / 1000×2 / variable×19; 31 containing functions; 0x43EC69/0x43EC81 pair confirmed.
5. Shape2D +0x9C = 0x514086B3 full body: `ret 0x34`, 13 args, 0xFFFFFF dword bounds → E_INVALIDARG, wchar 0/0xA string gate, record ctor 0x51408856 (vtables 0x5140D938/0x5140D934), rect+extent copy, clamp(0x514088DB)-vs-mod(0x514088A9) wrap handler installed at [rec+0x1C] selected by 0x51408A12(arg, 0), S_OK/E_INVALIDARG returns; slot +0x9C identical in 0x5140C0FC and 0x5140C2F0 (tables differ only at +0xB0); 8 EXE `call [reg+0x9C]` sites with 0xBA0500 error contract.
6. Shape2D +0xA4 (0x51408BED, `ret 8`) = tag-0x1E0000 pending-record **query** (consume value, clear dirty, drain count); +0xA8 (0x51408C9A) = **commit** (find-or-create with templates 0x5140D968/0x5140D964/0x5140D974, store value at [rec+8]); 0x51408D1D returns the tag; getters +0x20/+0x28 fast-path `[rec+0x1C]/[rec+0x20]`, slow-path walker 0x51406CF7 refreshes the same dirty/count/list state against global tick [0x51411C34] and yields [+0x70]/[+0x74]; **EXE `call [reg+0xA4]` census = 0**.
7. +0xF28: 64 EXE read sites, 5 cmp sites, exactly 1 direct writer (ctor-zeroing 0x934443); 13 LEA alias sites; arg3+0x14 child = AddRef'd position object (0x93CD77 ≡ 0x4B1C27 shape).
8. T089 canonical-state errata: report §3 stats (26/22/4) contradict its own matrix CSV (24 rows / 21 executed / 3 NOT-RUN; 16 MATCH-class / 2 REFUTED / 2 INCONCLUSIVE / 1 RESOLVED internal / 1 internal refutation); audit CSV ships 5 `pending` opinions and a G40 start=OPEN-STATIC that contradicts the GAP-REGISTER's PARTIAL-STATIC at the same tree.
9. Map.wz portal census: pv=8, ph/default 4/7/3, psh/default 4/7/3, psh/1 1/1/1 with {a0,a1,delay} = {0,200,1500}/{−}/{255,0,1500}, psh/2 & psh/3 = 6/14/6; delay/a0/a1 exist **only** in psh/1 (+editor/tp=100) within the portal subtree.

**Remains open (not closed by these bytes):**
1. Which callers of 0x93CB27 can actually reach the tagged/Set path: arg3=0 at 9 of 10 sites ⇒ Set unreachable-or-faulting for them; only 0x5C0342 proven arg3≠0. Record-tag population ({0x4F5C6A,0xD7511E}) per caller is a runtime property — static census cannot close it.
2. N/arg3 at 0x93E00B, 0x959493, 0x959527 (not captured within budget); 0x93CB27's `ret` immediate inferred (ret 0xC) from caller cleanup, not decoded directly.
3. Writers of `[[arg3]+0x14]`'s contents (the "remaining semantic half" C-109 already flags) — not censused.
4. +0xF28 indirect writers via the 13 LEA alias sites (out-param style) — direct census insufficient.
5. EXE-side consumer of the +0xA4 filter query (0 `call [reg+0xA4]` sites) — the filter→EXE readout link is unproven in bytes.
6. The "960 ms" pv loop figure (matrix MATCH-COUNTS row) — no WZ-side delay for pv/ph; depends on engine defaults (Q2 EXE side only).
7. Q2's 19 variable-default sites (which default each uses) and whether "180" exists at all.
8. +0x9C draw-side consumption (who interprets the created record) — body closed, consumers not.

## (v) Disagreements with the T089 canonical text (quotes from the d1dcb8b4 tree)

1. **C-109 vs bytes (substantive, already superseded by C-115 but text left stale):** C-109: *"Set(X(src), Y(src)) with src = [[this+0xF28]+0x14] (AddRef getter 0x93CD77 …)"* — wrong for the Set path; bytes give `[[arg3]+0x14]`; the F28 path skips the Set. Also C-109: *"uniform idiom 0x769B51([0xBD8FEC], string_id, N, 0) -> record"* — 0x769B51 takes exactly one argument (`ret 4`).
2. **T089 report §3 vs its own CSV:** *"实际检查候选：22（矩阵 26 行中 22 行为本轮执行 … 4 NOT-RUN）"* — the shipped matrix has 24 rows, 21 executed, 3 NOT-RUN. (The report's own §3 in the tree; WP0 later corrected it — my count is independent.)
3. **T089 audit CSV vs GAP-REGISTER (same tree):** audit `G40,start_status=OPEN-STATIC,end_status=n/a` vs register `G40,status=PARTIAL-STATIC` with extensive verified scope — internally inconsistent bookkeeping; plus 5 shipped `reviewer_opinion=pending` rows.
4. **C-109 caller framing (nuance, new):** *"EXACTLY 10 E8 callers … an EVENT/SCRIPT-driven focus"* — census count confirmed, but 9 of the 10 pass arg3=0, so the Set itself is byte-reachable only from 0x5C0342; "10-caller focus family" overstates the Set-path reachability. C-115 does not address arg3 values.
5. **T089 report WP3 (minor):** *"其余站点使用显式默认 150/60/180/1000 或变量默认"* — 180 (0xB4) not observed among the 36 sites' nearest paired pushes (120×11, 150×2, 60×2, 1000×2, variable×19); either inside the variable population or erroneous.

## Process notes / honesty ledger
- Prior-session q7 probe outputs were lost; probes re-run this session (read-only, repo `.work` files).
- q1_ebx_f28 "0 disp32 0xF28 sites" and q5_census2 "0 unique instr VAs" were buggy scans, superseded by the raw-byte 64-site census and q5_sib; kept for the record.
- The three pinned T089 canonical copies in this directory are post-WP0 (contaminated); all Q6 verdicts re-derived from `git show d1dcb8b4:` extracts saved as `t089tree_*.csv`. `gaps.csv` is identical to the tree's GAP-REGISTER.
- Binary hashes recomputed once (SHA-256 prefixes, table above) and cross-checked against the hash strings cited inside the T089 matrix/report — all four match.

— End of Phase-1 blind notes. Phase 2 not started.



---

# T090 — INDEPENDENT REVIEWER PHASE 2 REPORT (Adversarial Review)

(archived verbatim from the reviewer's private report)

# T090 REVIEWER — PHASE-2 ADVERSARIAL REVIEW (CMS079 Static Closure)

Reviewer role: T090 independent static-closure reviewer, Phase 2 (adversarial re-derivation of the lead's uncommitted T090 working-tree material).
Date: 2026-11-16. READ-ONLY on the repo; STATIC-ONLY; all outputs in this private dir (`C:\Users\lithd\AppData\Local\Temp\opencode\t090-reviewer\`).
Phase-1 blind notes: `T090-REVIEWER-BLIND-NOTES.md` (this dir) / archived copy `research/result/stage-readiness/forensics/T090-REVIEWER-BLIND-NOTES.md`.
Phase-2 scripts (this dir): `p2_wz_census.py`, `p2_exe_gr2d.py`, `p2_exe2.py`, `p2_s2d.py`, `p2_part4.py`, `p2_shacheck.py`.

Binary identities re-verified once at review time (SHA-256, full):
- EXE `.work/task-036/game-image-unpacked.bin` = `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` ✓
- Shape2D `.work/task-063/client-stage/Shape2D.dll` = `9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b` ✓
- Gr2D `.work/task-063/client-stage/Gr2D_DX8.dll` = `ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1` ✓
- `Map.wz` = `9e0d2a0fcecac2c99ee3cb15b03c41b5617d7d0637b55fb132f0eeed27155f69` ✓ (re-hashed by `p2_wz_census.py` at load)

Repo state: HEAD = `e9e71ba3` (WP0 commit, verified); `git status` shows ONLY `research/` paths modified/untracked → checklist (j) PASS (frozen ABI / LoomRealm untouched).

---

## 1. Verification matrix (checklist item → independent check → verdict)

| # | Item | My check (script) | Verdict |
|---|---|---|---|
| a | Map.wz census honesty | **Independent re-walk of the original WZ** with my own resolver/frameset logic (`p2_wz_census.py`, different code path from `t090_wp1b_frame_census.py`), plus machine recount of the delivered CSV | **HONEST / REPRODUCED.** My walk: 4,255 map frame rows + 1 missing-resource row + 91 portal rows = **4,347** ✓; explicit delay 2,448 map + 2 portal = **2,450** ✓; **44 distinct values, 100..4000** ✓; top 190×284 / 200×265 / 170×258 / 180×248 / 165×215 / 205×196 ✓ (my total 3000×159 = lead's obj 99 + back 60); per-consumer obj 3,540/2,114 ✓, back-ani1 526/334 ✓; multi-frame **329 = 99 all + 225 none + 5 mixed** ✓ (mine: 326 map-side + pv + ph + psh-mixed reconciles EXACTLY: 223+2=225, 4+1=5); resources 471 map + 3 portal + 1 missing = **475** ✓; portal pv=8, ph/default 4/7/3, psh/default 4/7/3, psh/1 1/1/1, psh/2-3 6/14/6 ✓; only explicit portal timing = psh/1 Start {a0=0,a1=200,delay=1500} / Exit {a0=255,a1=0,delay=1500} ✓. **No FSDB-vs-WZ confusion found** (C-113's FSDB counts stay labeled FSDB; C-117's numbers are all WZ-derived). BUT the prose says "35 distinct" in two places (→ D1) and one wrong map-id (→ D2). |
| b | animationScale default 1000 | `p2_exe_gr2d.py` Gr2D section | **VERIFIED.** dword @`0x5042E500` = `0x5040B9DE` ✓; the dword occurs **exactly once** in Gr2D ✓; `0x5042E3F0` is a code vtable (slot0=`0x50406ab4`) ✓. Accumulator head `0x5040B9DE`: `push 0x3e8; lea eax,[ebp+0x10]; push eax; lea eax,[ebp-0x1c]; push eax; call 0x504027bb` ✓. Coercion `0x504027BB`: `esi=[ebp+0xC]` (VARIANT), `ax=[esi]`, `je 0x5040283D` on VT_EMPTY(0) / `cmp ax,0xA; je` on VT_ERROR ✓; fast path `0x5040283D`: `mov eax,[ebp+0x10]` (=arg3=0x3E8) `; mov ecx,[ebp+8]; mov [ecx],eax` — stores **1000** ✓. `[ebp+0x10]` of the accumulator = **3rd stack arg** of the `[vt+0x110]` call; EXE `0x66A136 call [eax+0x110]` pushes (this, 0x20, 16-byte VARIANT block) so arg3 = first VARIANT dword — the "V3" labeling is consistent with the T089 registration convention. |
| c | 36-site default matrix + portal flat default | `p2_exe_gr2d.py` matrix section | **VERIFIED IN FULL.** 36 `68 5D 15 00 00` sites; my independent seed classification: **120×18 all imm8 `6A 78`** at exactly the lead's 18 addresses (incl. 0x43EC81 frame converter, 0x66ABCD tiler) — blind-phase D-B adjudication stands, my blind scanner had missed imm8 forms; **150×2** @0x406EDC/0x4071E3; **60×2** @0x40811B/0x40907F; **180×3** @0x40EE4B/0x40F595/0x410832 with preceding bytes `68 B4 00 00 00 51 8B C4` — D-A stands; **1000×2** @0x5FA885/0x9420D6; **register×9** (eax 0x408D66/0x409C9C/0x45377E; ebx 0x69834A/0x6985F7/0x71A72A/0x76AF9B; edi 0x6913CF; ecx 0x989C69). Portal: `xor ebx,ebx` (`33 DB`) @0x71A21C ✓; my sweep found **zero** ebx-writing instructions 0x71A21C..0x71A72A ✓; site context `push ebx; push ecx; mov eax,esp; … push 0x155D` ✓ → flat-record delay default = **0** ✓. My 36-site band scan also confirms 0x71A72A is the ONLY 0x155D site in 0x71A000–0x71C000 (C-117's portal-band negative ✓). |
| d | C-116 filter-consumer chain | `p2_s2d.py` + `p2_part4.py` | **VERIFIED END-TO-END.** (i) ctor `0x51407340`: x/y **by value** `mov [esi+0x20],eax` (eax=[ebp+8]) / `mov [esi+0x24],eax` (eax=[ebp+0xC]) ✓; vtable stack installed at 0x5140738B/0x514073AE/0x514073B4/0x514073BD = `[w]=0x5140D8F0`, `[w+0x10]=0x5140D8EC`, `[w+0xC]=0x5140D8E8`, `[w+0x30]=0x5140D8F4` ✓ (initial temp `[w]=0x5140C8B4` replaced at 0x514073AE); record list `+0x14` zeroed ✓; armed `+0x54` zeroed ✓. (ii) `0x51408C9A`: `mov eax,[esp+4]; push [eax+0x20] (Y); add eax,0x24; push [eax-8] (=X=[v+0x1C]); push eax; call 0x514072CF` ✓ — commit CREATES the wrapper on &Vector2D+0x24; tag search `push 0x1E0000; call 0x51408C44`; hit → `[rec+8]=coef` (0x51408CC7), miss → alloc `[0x51411C68]`→0x5140A019 with `[rec+4]=0x5140D974` ✓. (iii) getters `0x5140724A`/`0x514074C8` (`ret 8`): `edx=this; ecx=[edx+0x24]`; NULL → raw `[this+0x1C]`/`[this+0x20]`; non-NULL → `call 0x51406ADC` (X: out at resolver arg1; Y: out at arg2 → `[w+0x74]`) ✓. (iv) resolver `0x51406ADC`: locks [w+0x14]; `cmp [w+0x54],0` (armed) + `mov eax,[0x51411C34]; cmp eax,[w+0x58]` (tick) → on advance **inlines `call 0x51406CF7`** (0x51406B3A) ✓; outputs `[ebp+8]←[w+0x70]`, `[ebp+0xC]←[w+0x74]`, `+0x10←[w+0x68]`, `+0x14←[w+0x6C]`, `+0x18←[w+0x60]`, `+0x1C←[w+0x64]`, doubles via `[0x5140D8C0]=360.0` ✓. Engine delta window **exact**: 0x51406F73-0x51406F81 (`add [ebx+0x20],eax` / `add [ebx+0x24],eax` after snapshot subtraction) ✓. (v) Set fast path `0x5140830E` (`ret 0x2C`): wrapper==NULL → raw `[v+0x1C]/[v+0x20]` stores; else `call 0x51407A34` ✓; delta store `0x51407A34`: reads current via 0x51406ADC then `[edi+0x20] += ([argX]) − current` / `[edi+0x24] += …` ✓. (vi) **EXE `call [reg+0xA4]` census = 0** (my scanner covers FF/2 with mod=10 across all rm/SIB encodings) ✓. Slot15 chain: `0x48AEC3` = `[ecx+0xD4]` AddRef-getter (`ret 4`) ✓; `0x404B07` → `call [eax+0x20]`, `0x404B2E` → `call [eax+0x28]` ✓; consumers numerous (E8 callers: 0x48AEC3×71, 0x404B07×141, 0x404B2E×115) — the "structurally consumed" reading is supported and the claim's falsification field correctly bounds it (direct raw-field reads not censused). Constants `[0x5140D8C8]=0.0` (sign gate: `fcom qword [0x5140d8c8]` @0x51408D6B inside 0x51408D23) ✓, `[0x5140D978]=28.0` ✓, `0x5140D8C0=360.0` ✓, `0x5140D8E0=1/180` ✓. Vtable slots identical on both tables for +0x20/+0x28/+0x90/+0x98/+0x9C/+0xA4/+0xA8 ✓. One wording defect: "0x60-byte" wrapper (→ D3). |
| e | C-118 (+0x9C) | blind Q3 + `p2_s2d.py`/`p2_part4.py` | **VERIFIED.** `ret 0x34` (0x5140877C, blind-verified); unsigned clamps `ebx=[ebp+0x24]`/`edi=[ebp+0x28]` vs `0xFFFFFF` → `ja 0x51408769` (E_INVALIDARG 0x80070057) at 0x514086C1-0x514086DB ✓; VARIANT gate VT_EMPTY/VT_ERROR → fast path `0x5140878F` ✓; else `call 0x51405A4B` (VT_UI4 coercion, @0x51408719) + `call 0x51405448` (member resolve, @0x51408725) ✓; **rect math exactly 0x514087CF-0x514087E3**: `eax=[ebp+0x20]; lea ecx,[eax+edi]; push; ecx=[ebp+0x1C]; lea edx,[ecx+ebx]; push; push eax; push ecx; lea eax,[esi+0xC]; push; call [0x5141185C]` ✓; mode select 0x51408A12 → `[rec+0x1C] = 0x514088DB (clamp) / 0x514088A9 (mod)` ✓; wrapper snapshot via 0x514072CF(v+0x24,…) and **pending-list commit `call 0x5140833B`** @0x5140881F ✓; member invocation `call [ecx+8]` @0x51408832 ✓; **8 EXE `call [reg+0x9C]` sites exactly**: 0x43759C/0x4379D4/0x4B3B0B/0x4B3EC1/0x66B1A6/0x66C0EF/0x66D6D0/0x66DA86 ✓; 0x4B3B0B dynamic rect math confirmed literally: `lea esi,[ecx+ecx+0xA5]`, `lea esi,[ecx+ecx+0xD4]`, `0x28-ecx`, `0x18-ecx` ✓. |
| f | C-119 caller table | `p2_exe2.py` + `p2_exe_gr2d.py` | **VERIFIED.** `0x959493`: `push [ebp+0x20]; push 0x320; push [ebp+8]; mov ecx,[ebp-0x170c]; call 0x93cb27` → arg3=[ebp+0x20], N=0x320 ✓. `0x959527`: `push 0; push 0x320; push [ebp+8]; …; call 0x93cb27` → arg3=literal 0, N=0x320 ✓. `0x990B42: xor esi,esi` ✓ (blind: no esi write to 0x990E88) → 0x990E21/0x990E91 esi=0 ✓. Caller-of-caller: fn `0x9573A6` has **14 E8 callers** (my census, matches adjudication); `0x5C031A` pushes 7 stack args with arg7(=[ebp+0x20] in callee)=**esi = object** ✓; `0x95282D` arg7=esi with `xor esi,esi` @0x95281A → **0** ✓; `0x955126` arg7=ebx with dominating `xor ebx,ebx` @0x954F1E and no ebx write before the call → **0** ✓. `0x98DC43` context: `call 0x43291a` @0x98DC0C (the [0xBDD460] getter per C-114) then `call 0x43d092` @0x98DC13, then `push ebx (0); push 0x1F4; push 0x769B51(0x406849); … call 0x93cb27` @0x98DC43 ✓. **8 zero + 2 object-capable confirmed.** Coverage nuance → D4. |
| g | WP0 errata (committed e9e71ba3) | `git show e9e71ba3:…` + `p2_shacheck.py` | **VERIFIED.** C-109 at HEAD keeps Set site 0x93CC9B, gates (record/[this+0x3B8]==0/payload/tag set), "EXACTLY 10 E8 callers"; source = `[[arg3]+0x14]` with old expression bracketed **"[HISTORICAL t088 INFERENCE, SUPERSEDED: 'src = [[this+0xF28]+0x14]' … must not be re-used as the Set-path source]"** ✓; EV-94 carries the t090 WP0-A re-verification annotation ✓. **EV-96 sha `01fe046014dda4d7…` matches the annotated `T088-CAMERA-CADENCE-DEADZONE.md` byte-for-byte** ✓ (recomputed). T089 report §3 at HEAD: "矩阵总计 **24 数据行**：MATCH 类 **16** …" — matches my blind independent count of the d1dcb8b4 matrix CSV (24/16/2 REFUTED/2 INCONCLUSIVE/1 internal RESOLVED/3 NOT-RUN; external 22, executed 19) ✓. Audit CSV: 5 targeted gaps = `archived-ACCEPT (phase2 …; phase3 verified; phase4 ACCEPT — T089-REVIEWER-INDEPENDENT.md phases 2-4)` citing the real archived reviewer doc ✓; **G40 start_status = PARTIAL-STATIC** with WP0-C note; G20/G16 'n/a' end cells replaced with authoritative statuses + notes ✓. Matrix `reviewer_ruling` ∈ {n/a, phase2-verified, phase4-round-accept (row not individually re-derived by reviewer)} — honest labels ✓. |
| h | Tests | run by me in the repo worktree (read-only) | `python -m unittest discover -s research/tests -q` → **`Ran 215 tests … OK`** ✓ (one unrelated ResourceWarning); `python research/scripts/validate_reverse_engineering.py` → **`Claims: 119 | Gaps: 41 | Evidence: 107; ERRORS: 0; WARNINGS: 0; RESULT: PASS`** ✓ — both match report §5 verbatim. 41 T090 tests = 20 committed at WP0 + 21 added this round (21 new `def test_` in the working-tree diff, incl. `test_no_status_migration_this_round`, `test_a4_query_census_zero`) ✓. |
| i | Gap honesty | ledger diff + residual CSV | **NO OVERREACH FOUND.** G10/G36/G37/G39 all start=PARTIAL-STATIC end=PARTIAL-STATIC (no migration; enforced by a test). G39 residual honestly keeps: portal per-frame default unlocated (0x71A72A is a different dataflow), 8 register-seed defaults variable, "960/480/840/360 remain default-based estimates". G10 residual keeps [[arg3]+0x14] writers, arg3↔F28, E2/E3 pump phase, wrapper persistence, 18 POSSIBLE receiver linkages; the "EXE never queries the filter" negative is census-bounded in C-116 ("all modrm forms incl. SIB") and my independent census returns 0. G36 keeps "first-frame absolute offsets statically unprovable in principle". `T090-G10-RESIDUAL-SLOT90-CLASSIFICATION.csv`: 25 rows, t088 INCONCLUSIVE×25 → 18 SHARED-WRITE-CONTEXT-POSSIBLE + 7 RECEIVER-OTHER-POSSIBLE, with `verified=UNKNOWN` on all rows — honest, no fabricated closure. |
| j | Frozen surfaces untouched | `git status --porcelain` | **PASS** — every modified/untracked path is under `research/`. |

Blind-phase disagreement adjudications re-checked: **D-A (180×3) the lead is right** (bytes `68 B4 00 00 00` before all three sites); **D-B (120×18 all imm8) the lead is right** (my blind scanner missed imm8 forms); **D-C (8+2) the lead is right** (0x959527 = literal `push 0`; 0x959493 caller-dependent); **D-D** terminological, fine.

---

## 2. Findings

### D1 — "35 distinct delay values" in EV-104 + timeline doc contradicts the true count 44 — NON-BLOCKING (correction required)
- Where: `research/source-of-truth/evidence.csv` EV-104 ("2,450 explicit delays (**35 distinct values**)"); `research/result/stage-readiness/forensics/T090-G39-ANIMATION-TIMELINE.md` §2 ("**35 distinct explicit delay values**"). C-117 itself says 44 — so the round's own artifacts disagree.
- Truth: my independent WZ walk AND the lead's own delivered CSV both give **44 distinct values (100..4000)** (`p2_wz_census.py`; CSV recount).
- Reproduce: `python p2_wz_census.py` → "distinct values: 44"; or `Counter` over `delay` where `delay_explicit=='True'` in `T090-G39-WZ-FRAME-CENSUS.csv` → 44.
- Fix: change 35 → 44 in EV-104 and timeline §2.

### D2 — Timeline doc misattributes the missing resource's map id — NON-BLOCKING (correction required)
- Where: `T090-G39-ANIMATION-TIMELINE.md` §2 says the missing `Back/…/back/…` resource is "referenced by **222000000**"; the delivered CSV row and my walk both say **222000001** (path `Back/.img/back/0`, empty bS).
- Reproduce: grep `RESOURCE-MISSING` in `T090-G39-WZ-FRAME-CENSUS.csv`, or see `p2_wz_census.py` output "missing resources: 1 -> [('222000001', 'Back/.img/back/0')]".
- Fix: 222000000 → 222000001 (or state the map explicitly from the CSV).

### D3 — C-116 "0x60-byte" wrapper size contradicts the proven field extent — NON-BLOCKING (correction required)
- Where: C-116 claim text ("builds a 0x60-byte ANIMATION-STATE object" via the forensic §1.1) vs the same claim's "resolved outputs w+0x60..+0x88" — the resolver byte-provenly reads `[w+0x60]..[w+0x74]` and the doubles at `[w+0x80]/[w+0x88]`, so the object spans ≥0x90 bytes. The allocation size is not derivable from the bytes I checked (allocator `[0x51411C7C]→0x5140A18A`).
- Reproduce: `p2_s2d.py` resolver dump (outputs incl. `[esi+0x60]..[esi+0x74]`) + ctor dump (fields to +0x5C zeroed; outputs beyond).
- Fix: drop the byte-size figure or replace with "≥0x90 bytes (field extent)".

### D4 — C-119 caller-of-caller coverage for 0x959493 is 3 of 14 — ADJUDICATION (recommended clarification, not an error)
- The claim "object (esi) via caller 0x5C031A, zero via 0x95282D and 0x955126" is byte-true for those three callers, but fn `0x9573A6` has **14** E8 callers (my census: 0x5C031A, 0x95282D, 0x955126, 0x955149, 0x968705, 0x968798, 0x976409, 0x9767BA, 0x9768DB, 0x976A3A, 0x977B8E, 0x977BA7, 0x97A449, 0x97A559); the other 11 arg7 windows are undecoded, so "2 object-capable" is a lower bound on object-capability, not a complete caller classification. The wording "CALLER-DEPENDENT" is honest; add a coverage note (or decode the remaining 11 next round, per the G10 receiver-linkage residual).
- Reproduce: `p2_exe2.py` prints the 14-caller list.

### D5 — EV-106's slot9c companion sha is stale — NON-BLOCKING (correction required)
- EV-106 cites "slot9c e4abf9cf9db4db29…" but `forensics/T090-G36-SLOT9C-DISASM.txt` currently hashes to `0504e3e37c341923…` (file evidently regenerated/appended — e.g. by `t090_wp2a_slot9c_fastpath.py` — after the EV row was written). All six other companion shas I checked MATCH (census 9d3f731f…, timeline 26b1e0cc…, matrix 40795342…, filter-consumers da95cd42…, arg3 table 0d74231c…, residual bfb953cf…).
- Reproduce: `python p2_shacheck.py`.
- Fix: refresh the slot9c sha in EV-106.

### D6 — Deliverables list references a not-yet-existing file — NON-BLOCKING (process note)
- Main report §0/§6 cite `T090-REVIEWER-INDEPENDENT.md` (reviewer Phase-2/3/4); the file is absent from the tree (my Phase-2 output lives in the reviewer's private dir per process). Drop from §6 until the reviewer phases land, or create the pointer file.

### Positive deviations worth recording (no action)
- The "225 default-dependent of 329 multi-frame" figure looked off vs my map-side-only recount (223/326) but reconciles EXACTLY once the portal family is included (pv+ph delay-less multi-frame; psh mixed) — the claim is accurate as stated ("13 target maps + MapHelper portal family").
- C-117's top-list mixes a per-consumer figure ("3000×99" is obj-only; back-ani adds 60, total 159) with corpus-level counts for the other values — cosmetic only, both numbers appear correctly in the timeline table.
- Residual classification CSV marks all 25 rows `verified=UNKNOWN` — exemplary honesty.

---

## 3. Provisional verdict

**ACCEPT-WITH-CORRECTIONS.**

The round's substantive claims — C-116 (filter consumer chain), C-117 (WZ timing closure: explicit-delay census, animationScale=1000, 36-site default matrix, portal flat default 0), C-118 (+0x9C body), C-119 (caller table), WP0 errata — all re-derive from the pinned CMS079 bytes/WZ with my independent scripts, including the negative censuses (A4=0). Gap bookkeeping is honest (no status migration; bounded negatives; UNKNOWN verification markers). The defects found are prose/bookkeeping-level, none touch a byte-level conclusion.

**Required corrections before commit:**
1. D1: EV-104 + `T090-G39-ANIMATION-TIMELINE.md` §2 — "35 distinct" → **44**.
2. D2: timeline §2 missing-resource map id 222000000 → **222000001**.
3. D3: C-116 — remove/fix the "0x60-byte" wrapper size (field extent ≥0x90).
4. D5: EV-106 — refresh the `T090-G36-SLOT9C-DISASM.txt` sha (`e4abf9cf…` → `0504e3e3…` at the time of this review).

**Recommended (non-blocking):** D4 coverage note for 0x959493's 14-caller set; D6 deliverable reference.

— End of Phase-2. Phase 3 not started (per instructions).


---

# T090 — INDEPENDENT REVIEWER PHASE 3 + 4 REPORT (Correction Verification, Post-Push Remote Verification & Final Verdict)

(archived verbatim from the reviewer's private report)

# T090 REVIEWER — PHASE-3 (correction verification) + PHASE-4 (remote verification & final verdict)

Reviewer role: T090 independent static-closure reviewer, Phases 3–4. Date: 2026-11-16.
READ-ONLY on the repo; all outputs in `C:\Users\lithd\AppData\Local\Temp\opencode\t090-reviewer\`.
Phase-2 report: `T090-REVIEWER-PHASE2.md` (this dir). Scripts this phase: `p34_checks.py`–`p34_checks4.py`.

---

## 1. Phase-3 verification matrix (D1–D6 dispositions)

| Finding | Expected disposition | Observed at HEAD e885ec80 | Verdict |
|---|---|---|---|
| **D1** "35 distinct" → 44 | EV-104 corrected **and** `T090-G39-ANIMATION-TIMELINE.md` §2 corrected (Phase-2 required-correction #1 named BOTH locations) | EV-104: "**44 distinct values [t090 phase-3 D1: count recomputed from the committed census — the original prose said 35]**" ✓. C-117 says 44 ✓. **Timeline §2 L35 still reads "- **35 distinct explicit delay values** (100 … 4000)" with NO correction note** (the same file's L24–26 DID get a D2 bracketed note, so the fix pass ran but missed L35) | **PARTIAL — residual R1a** |
| **D2** missing-resource map id | 222000000 → 222000001 in timeline | Timeline L24: "referenced by **222000001** … [t090 phase-3 D2: attribution corrected from the census CSV; the original prose said 222000000]" ✓ | **FIXED** |
| **D3** "0x60-byte" wrapper size | phrase gone; field-extent wording only | `0x60-byte` absent from all claims/docs (only in `scripts/t090_phase3_fixes*.py` as provenance of the removal). Filter-consumers L21: "(fields through at least +0x88 — >=0x90 bytes)" ✓. C-116 text: only offset references (w+0x20/+0x24, w+0x14, outputs w+0x60..+0x88, X@w+0x70/Y@w+0x74) — no size claim ✓. EV-106: "wrapper ctor/layout (fields through at least +0x88)" ✓ | **FIXED** |
| **D4** 0x9573A6 14-caller coverage | COVERAGE note in C-119 | C-119: "COVERAGE: 0x9573A6 has 14 E8 callers of which 3 are decoded (0x5C031A/0x95282D/0x955126) — the arg3 object-capability of 0x959493 is proven for the decoded trio only [t090 phase-3 D4]" ✓ (matches my Phase-2 census exactly) | **FIXED** |
| **D5** stale slot9c sha | EV-106 refreshed to match committed file | EV-106 cites "slot9c 3c71593126f431ca… [companion slot9c sha refreshed phase-3 D5]"; my recomputed SHA-256 of the LF-normalized committed `T090-G36-SLOT9C-DISASM.txt` = **3c71593126f431ca…** ✓ | **FIXED** |
| **D6** absent reviewer file | file exists; phases 2–4 appended by lead's archive commit after reviewer reply (agreed disposition, same as T089) | `research/result/stage-readiness/forensics/T090-REVIEWER-INDEPENDENT.md` exists with archive header + session-provenance note + Phase-1 blind notes; no phase-2/3/4 sections yet (as agreed — this reply unblocks them) | **FIXED (per agreed disposition)** |

**Evidence-crash recovery check (D1 rider):** evidence.csv at HEAD = exactly **107 data rows** ✓. `git diff e9e71ba3..e885ec80 -- research/source-of-truth/evidence.csv` = **4 appended lines (EV-104..107), zero deletions** → EV-1..103 are byte-identical to the WP0 commit (the restore-from-HEAD claim holds) ✓. EV-96 still carries the WP0 hash `01fe046014dda4d7…` with the t090 WP0-A annotation ✓.

**Companion-sha sweep at HEAD (LF-normalized, SHA-256):** census `9d3f731f…` ✓, matrix `40795342…` ✓, filter-consumers `72f9ae82…` ✓ (refreshed from Phase-2's da95cd42 after the D3 edit), slot9c `3c715931…` ✓, arg3 `0d74231c…` ✓, residual `bfb953cf…` ✓ — **but timeline `26b1e0cc22d777b2` cited vs `18109888d3ed1661` computed → STALE** (the phase-3 D2 edit to the timeline post-dates EV-104's sha; the D5-class defect re-introduced for this one file) → **residual R1b**.

## 2. Phase-4 verification matrix (remote & committed state)

| # | Check | Expected | Observed | Verdict |
|---|---|---|---|---|
| 1 | Remote/local sync | `origin/design/adventure-field-map-scene` = e885ec80… = local HEAD; branch in sync; tree clean | ls-remote = `e885ec80991d0c9191ae651443553b54e607c6e2`; HEAD identical; `branch -vv` shows in-sync tracking; `status --porcelain` empty | **PASS** |
| 2 | Parent chain, no force | e885ec80 → e9e71ba3 → d1dcb8b4 | HEAD~1 = `e9e71ba3…` (WP0 errata), HEAD~2 = `d1dcb8b4…` (T089 archive) — fast-forward chain intact | **PASS** |
| 3 | Round diff scope | all paths under research/; ~119 files (main commit) | d1dcb8b4..e885ec80: **130 files, +13,724 / −78**; main commit e9e71ba3..e885ec80 alone: **119 files, 0 non-research** (the other 11 files are the WP0 errata commit's) | **PASS** |
| 4 | Whitespace | `diff --check` clean | clean (no output) | **PASS** |
| 5 | Frozen pins | `components`, `loom-realm` untouched | diff empty | **PASS** |
| 6 | Ledger state | C-116..C-119 CLOSED-STATIC/A; C-109/C-115 corrected; evidence 107; gaps statuses; G10 tokens | Claims 119 rows: C-115/C-116/C-117/C-118/C-119 all **CLOSED-STATIC, evidence_grade A**; C-109 PARTIAL-STATIC/B with the corrected `[[arg3]+0x14]` wording + bracketed HISTORICAL t088 note intact. Evidence **107** rows incl. EV-104..107. Gaps 41 rows: **G35 CLOSED-STATIC; G10/G36/G37/G39/G40 PARTIAL-STATIC** (no migration). G10 retains `t088.1` + `slot15` clause + `[[arg3]+0x14]` + `[[user+0xF28]` + **"RESOLVED by C-116"** — all five tokens verified present | **PASS** |
| 7 | Gates at committed state | PASS 0/0, 119/41/107; 215 tests OK | `validate_reverse_engineering.py` → **exit 0**, "Claims: 119 \| Gaps: 41 \| Evidence: 107 / ERRORS: 0 / WARNINGS: 0 / RESULT: PASS"; `unittest discover -q` → **exit 0**, "Ran 215 tests in 8.923s / OK" (one unrelated ResourceWarning, known from Phase-2) | **PASS** |
| 8 | Forensics integrity | census 4347 / matrix 36 / arg3 10 / residual 25 / audit 8 + no 'pending' opinions / QUALITY-GATES real | 4347 ✓, 36 ✓, 10 ✓, 25 ✓, 8 ✓. No cell equals 'pending' (sole 'pending' substring = "pending-list commit" technical term in G36's proven column) ✓. `T090-QUALITY-GATES.txt` committed with captured live output incl. "RESULT: PASS" and "Ran 215 … OK" ✓ | **PASS** |
| 9 | Report artifacts | main report + readiness t090 + gap-register t090 appendix committed | `result/stage-readiness/T090-WZ-TIMING-CAMERA-CLOSURE-REPORT.md` committed, cites T090-REVIEWER-INDEPENDENT ✓; `P0-P4-READINESS-REPORT.md` t090 section (6 mentions) ✓; `REVERSE-ENGINEERING-GAP-REGISTER.md` t090 appendix (8 mentions) ✓ | **PASS** |

Audit `reviewer_opinion` labels honest: phase2-verified / phase4-round-accept style, G10 row records "ACCEPT-WITH-CORRECTIONS — corrections D1-D5 landed, none blocking" (the stale-timeline discovery below post-dates that row).

## 3. Residual findings (non-blocking)

- **R1a — `T090-G39-ANIMATION-TIMELINE.md` §2 L35 still asserts "35 distinct explicit delay values".** Phase-2 required correction #1 named BOTH EV-104 and timeline §2; only EV-104 was fixed. The committed census CSV, C-117 and EV-104 all say **44** (machine-verified twice: my independent WZ walk + CSV recount). One-word fix: 35 → 44, ideally with the same bracketed phase-3 note style used at L24–26.
- **R1b — EV-104's companion sha for the timeline doc is stale**: cites `26b1e0cc22d777b2…` (pre-edit hash) but the committed file hashes `18109888d3ed1661…` (LF-normalized). Root cause is the same edit that fixed D2 — the sha was not refreshed afterwards. Exactly the D5 defect class; fix is a one-field refresh. All six other companion shas verified MATCH.
- No other regressions: `'0x60-byte'` exists only in the phase-3 fix scripts (removal provenance); `'35 distinct'` exists only in the timeline + those scripts; frozen surfaces, gaps statuses, and the G10 residual wording are untouched.

## 4. FINAL VERDICT — T090 round

# **ACCEPT-WITH-CORRECTIONS**

All substantive T090 conclusions (C-116 filter-consumer chain, C-117 WZ timing closure incl. the 44-value census / animationScale=1000 / 36-site default matrix / portal flat default 0, C-118 +0x9C body, C-119 caller table, WP0 errata) remain independently re-derived and byte-backed from my Phase-2 scripts; the remote push is clean, scoped, and reproducible (gates exit 0 at the committed state). Of the six Phase-2 findings, D2–D6 are fully landed and D1 landed in EV-104 but not in the timeline §2 prose, which also left one stale companion sha in EV-104. Both residuals are one-line bookkeeping fixes that can ride the already-agreed post-reply archive commit (which will append this reviewer's phase 2–4 sections to `T090-REVIEWER-INDEPENDENT.md`) — no reopening of the round is required.

**Corrections to land with the archive commit:**
1. R1a: timeline §2 L35 "35 distinct explicit delay values" → **44** (+ optional bracketed note).
2. R1b: EV-104 timeline-doc companion sha `26b1e0cc22d777b2…` → recomputed `18109888d3ed1661…` (refresh after the edit, then re-run the validator).

— End of Phases 3–4.
