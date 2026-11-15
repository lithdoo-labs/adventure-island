# T085.1 Independent Adversarial Re-Review — FINAL VERDICT

Reviewer: the same independent sub-agent that produced the blind pass
(`forensics/T085-REVIEWER-BLIND.md`). This phase audited the main agent's full
T085 deliverable adversarially. Binary re-verified before any disassembly:

```
.work/task-036/game-image-unpacked.bin
  sha256 = d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718  (match)
```

Method: fresh capstone scripts in the reviewer's own scratch dir
(`%TEMP%\opencode\t085-reviewer\phase2_a.py`, `phase2_b.py`, plus re-used
personal `revtool.py`/`xref.py`; no t085_* scripts executed except the unit
tests as tests). Code section independently re-derived: 0x401000–0xBEA000.

## Adversarial findings

1. **Function boundaries — VERDICT: CONFIRMED.**
   Independently re-walked: `0x9BE703` = 0x9BE703–0x9BF13F, 883 insns, single
   epilogue `ret 0xC` (0x9BEE00), next function 0x9BF144 — identical to C-088.
   `0x9C5B8A` = …–0x9C5F5C(ret 8), `0x9CCAA8` = …–0x9CCC96(ret 8),
   `0x9C1113` = 0x9C1113–0x9C11F8(ret 0xC), `0x9507F0` = 0x9507F0–0x950DBE,
   `0x9BCD6C` = 0x9BCD6C–0x9BCFEA(ret 4), `0x9BF7EA` = 0x9BF7EA–0x9BF9D0
   (ret 8), `0x9BF144` = 0x9BF144–0x9BF1F9(plain ret). All match the EV
   anchors (end-address convention noted and consistent). No boundary misstate.

2. **Calling conventions / args — VERDICT: CONFIRMED.**
   ret 0xC = 3 stack args (srcState, budget*, mode). Mode flag re-proven at
   the push sites: `push 1` @0x9BCF2D (no-ctx path → slot4 call 0x9BCF3C),
   `push 0` @0x9BCEF0 (drop-recovery → 0x9BCF04); the third slot4 call site
   0x9BCFCF pushes `eax` which is statically 0 (`xor eax,eax` @0x9BCF47,
   unmodified through 0x9BCF64 `je 0x9bcfbf`) — mode=0, consistent with the
   claimed semantics. Cross-map arrival slot1 call @0x95096D: push order
   verified = args (1, x, y−0xA, 0, 0, [user+0x3C0], 0) → **arg7=0 CONFIRMED**
   and arg6=[user+0x3C0] matches C-062.

3. **Census encoding completeness (C-090) — VERDICT: CONFIRMED with two
   notes.** My independent byte census reproduces the site set: 29 real
   mod=01 `FF 5r 38` sites in .text; no real mod=10/disp32 or SIB-form call
   sites exist (0xB2418B/0xB9147B sit in zero-filled data islands — the main
   agent's exclusion is correct; verified at 0xB24170-0x9B). mod=00
   (`call [reg]`/`call [abs]`) forms are slot0/absolute dispatch and cannot be
   slot14 by construction. The single-dword argument (0x965A09 exists only at
   0xB0BD60 = 0xB0BD28+0x38) reproduces exactly. Notes: (a) the 30th site
   **0x00C93B63 lies outside the code section** (>0xBEA000, beyond .rsrc
   VirtualSize 0xC17D20) — it is a data byte-pattern coincidence, not a "real
   site"; (b) census site **0x948BD8 is missing from the classification** in
   G41 §3/C-090 (it is in the 30-site list but in neither the user nor
   non-user tables). Neither affects the 3-user-site enumeration.

4. **Phantom vtable slots — VERDICT: CONFIRMED (none).** Dumped slots 0..16
   of all 8 physics tables; **40/40 claimed slot dwords verify at real
   indices**: slot4 T3=0x9C6028 @0xB0C770 / T6=0x9D06D4 @0xB0CA80; slot9
   T3=0x9C3D1D @0xB0C784 / T4=0x9C9CF7 @0xB0C894 / T7=0x9D3FE1 / T8=0x9D7AD5;
   T7 slot5=0x9D3CCA/slot6=0x9D3DE6; all slot1/slot3/slot10/slot11 entries in
   the G40 table match. One comment-level error found: EV-81's verdict anchor
   says "(T4 slot9, vtable dword **0xB0C884+0x24**)" — 0xB0C884+0x24=0xB0C8A8
   (slot14's dword); the correct address is **0xB0C870+0x24=0xB0C894** (value
   0x9C9CF7 is correct). See defect D5.

5. **Static-order vs runtime-frame-order — VERDICT: CONFIRMED (disciplined).**
   T085-G38 §6 explicitly separates "PROVEN static order within one call" from
   "NOT observed: wall-clock tick rate / per-frame scheduler / camera timing";
   matrix P4-06 keeps camera order in its `unproven` column and assigns it to
   P4-07/G10; P4-07 wording unchanged. No static-order-as-runtime overreach
   found.

6. **Field-offset PROVEN vs DERIVED hygiene — VERDICT: BOUNDARY-NOTE.**
   Writer/read anchors verified for [M+0x110/0x114/0x118] (slot5 writes
   0x9BFB86/0x9BFB8C/0x9BFBAF/0x9BFBF2 — all byte-confirmed), [M+0x190]
   (install 0x9BCD2B/0x9BC85D), [M+0x238] (0x9C2966-family; 0x9C28BF thunk
   `and [esi+0x238],0` verified), [M+0x244] (0x9C9D0C `add` verified),
   [M+0x158]/[M+0x15C] (0x9BD567 verified: `and [esi+0x158],0;
   mov [esi+0x15c],1; call 0x9BD0D9; push 1; call 0x53E95D`). Three semantic
   labels lean DERIVED without a tag: (a) "M+0x50/M+0x68 = vx/vy" (supported
   by velocity-zeroing in 0x9BF7EA, but the same slots are written as an
   interpolated pair in the m1<=0 path — interpretive); (b) "[M+0x150]
   friction" in C-093 (reader-anchored, name untagged); (c) "m1 = unit
   -direction x" carries C-068's DERIVED status and is load-bearing for the
   FSDB `x1<x2 ⇒ m1>0` bridge in C-088 — the consequence silently inherits a
   DERIVED label. Labels should be tagged; no instruction-level fact is wrong.

7. **Unbounded negatives — VERDICT: DEFECT (D1) on [M+0x120]; CONFIRMED on
   [M+0x198].**
   - [M+0x198] (C-093): my independent full-encoding census reproduces
     **exactly the 10 direct disp32 write sites** claimed; 0x9BC37E is the
     ctor zero; the other 9 are in COM/UI regions; C-093 explicitly bounds the
     negative ("register-offset/SIB stores via an aliasing pointer cannot be
     fully excluded"). Properly bounded everywhere I read.
   - [M+0x120] (C-088 / EV-78 census / G38 §3): the wording "NO setter
     anywhere in the image (all encodings incl and/pop/SIB/rep-movs checked)"
     is **false at the encoding level**: my census finds **21 write-class
     [..+0x120] instructions** image-wide, 19 beyond the two cited. Most
     materially: (i) `lea edi,[esi+0x120]` @0x9B7F43 feeds ecx=obj+0x120 into
     **0x9B87EA, which at 0x9B8817 (`mov [ebx],eax`) installs a NONZERO heap
     pointer into [obj+0x120]** (a vector constructor) — a LEA-alias write of
     the exact kind the claim says was excluded; its containing function
     0x9B7F25 has 4 E8 callers (0x7540B4/0x754384/0xA15EF5/0xA32327), none in
     the movement family, so it almost certainly targets another class; (ii)
     bulk zero-fill including +0x120 at 0x9AF3FE (manager family, writes 0);
     (iii) a field copy `mov eax,[esi+0x120]; mov [ebx+0x120],eax` at
     0x952D1D/0x952D23 (copies +0x118..+0x124 between objects). The
     substantive dead-branch conclusion probably survives (no demonstrated
     writer of a MOVE object at M+0x120), but the claim asserts an
     encoding-level completeness that was not performed. Correction demanded
     (D1): re-scope to "no writer targeting a move object, receiver-provenance
     checked for all 21 encoding-level [..+0x120] write sites" and document
     the 19 non-M sites (or state the M-scoping explicitly).

8. **13-map FSDB scoping — VERDICT: CONFIRMED.** All statements scope to "13
   target maps" (C-088, G38 §4, EV-80). I independently recomputed 4 of the 13
   maps from `content/[FSDB]adventure/[group]map.Foothold/map.*.jsonl`:
   222000000 n=376/x1<x2=318/vert=58, 230000000 240/225/15, 230020200
   355/107/248, 230030200 247/128/119 — **all match EV-80 exactly**;
   x1>x2=0 in every sampled map; the 13-map totals (2283/1607/676) are
   arithmetically consistent with the per-map rows.

9. **Ledger consistency — VERDICT: CONFIRMED.** SHA-256 of all five evidence
   files recomputed: **5/5 MATCH** their evidence.csv rows. Zero dangling
   claim↔evidence↔gap↔document references among C-088..C-094 / EV-77..EV-81 /
   G34/G38/G40/G41 (correct columns re-checked after an initial reviewer
   parsing slip). C-093 PARTIAL-STATIC as designed; G40 remains PARTIAL-STATIC
   with narrowed scope and named residuals; documents.csv registers all six
   T085 reports plus the blind-review file.

10. **Gap closures — VERDICT: CONFIRMED (G38, G41), BOUNDARY-NOTE (G34
    wording).** G38's closure cross-references camera (G10) and 0x81
    registration (C-066) as non-blockers — justified by the first-tick chain
    evidence, which I verified end-to-end at the instruction level (teleport
    head 0x9C1113 `and [ebx+0x104],0` + 0x9BFD85(M+0x124) verified; T1 tick
    pending-action dispatch table 0x9BCD6C verified incl. [M+0x170]=[M+0x16C]
    and all four pending actions; mode=1/0 slot4 calls verified). G41's
    closure rests on the census + the two flag=0 trigger bodies (0x9658CC and
    0x948AA2 both re-verified). G34's verdict is falsifiable as written
    ("interact"), but the executive-summary phrasing "exactly two 90/30
    meeting sites" is imprecise — see D2: a third inert co-occurrence exists
    inside T5 slot10 0x9CBE89 (extent 0x9CBE89–0x9CC90F, 842 insns), which
    contains BOTH `add [ebx+0x23C],0x1E` @0x9CC0CF and `and edi,0x5A` (+`add
    edi,0x3C` → 60/150) @0x9CC640 — same function, disjoint dataflows, no
    interaction. Verdict unaffected; wording must distinguish "meet" from
    "interact", and 0x9CC640 must be added to the EV-81 census list (it is
    in-window at 0x9CC640 < 0xA80000 and absent). Also EV-81's census window
    "0x401000-0xA80000" truncates .text (ends 0xBEA000) — declared, and my
    full-window census confirms nothing verdict-relevant lives above 0xA80000
    (CRT/data noise only), but the bound should be stated as a truncation.

11. **Readiness moves (P3-15, P4-06 → RE-READY) — VERDICT: CONFIRMED.**
    P3-15's blocker was the flag=0 trigger enumeration — delivered (C-090,
    3 sites, both flag=0 chains fully recovered; SIT sub-case incl. seat box
    x±0xA/y±0x1E — re-verified at 0x96595A window — and seat teleport
    0x9D35F2 exists and calls [vt+0x40] = COM-family slot16). P4-06's static
    residual was the first-tick chain — delivered (C-088/C-089/C-090). The
    matrices keep camera timing under P4-07/G10 with runtime status and do
    not claim it closed. The "更新顺序" (update-order) fact is covered by
    static per-call order only — which the matrix says explicitly.

12. **T084.1 preservation — VERDICT: CONFIRMED.** `git diff` of
    claims.csv = 7 added lines (C-088..C-094), zero modified/deleted rows;
    C-082/C-086/C-087 text byte-identical; T085 reports cite them as settled
    (G38 §5.4 "C-083 order re-confirmed"; residual triage §2/§3 leave
    G10/G01 boundaries untouched; no T084.1 EV file altered except the three
    T0841-EV* files whose hashes were re-normalized by the CRLF fix covered
    by test_47 — their evidence.csv hashes were re-verified by the validator
    logs and are outside my re-hash scope but the fix's defect class is
    exactly what test_47 guards).

13. **Blind-find merging fidelity — VERDICT: CONFIRMED with one misquote
    (D3).** 0x9C3D1D quoted byte-exact in G34 §2.1 and attributed ("Blind
    -reviewer find; re-verified"); 0x97FCBA merged with attribution in
    G41 §2.1 — but the report prose quotes it as "`mov ecx,[ecx+8]; …;
    **jmp** 0x9571BF; ret 8`" while the instruction at 0x97FCC9 is
    **`call 0x9571bf`** (EV-79's generated dump is correct — report prose
    must match evidence bytes). The slot4-variant correction is credited in
    C-089 ("refines C-076") and the main report; the single-dword 0x965A09
    fact appears in G41 §1. My blind census's 29 sites are a strict subset of
    their 30; every differing site reconciles (0xC93B63 = data section).

14. **Tests 45–48 — VERDICT: CONFIRMED.** Read and ran
    `T085ScriptTests`: 4/4 pass in 0.79 s. test_45 (tampered SHA → abort with
    no files written) genuinely exercises the negative; test_46 (missing
    binary → clean failure); test_47 reproduces the exact CRLF-on-checkout
    hash-mismatch defect class against the real validator; test_48 proves
    ledger-updater idempotence refusal on double-apply. Tests match their
    docstrings.

Additional byte-accuracy check performed: 312 sampled disassembly lines
across EV-77..EV-81 compared against my fresh capstone decode — **0
mismatches**. The evidence files are byte-faithful to the pinned binary.

## Corrections demanded

| # | File + location | Correction |
|---|---|---|
| D1 | `research/source-of-truth/claims.csv` C-088 (clause "DEAD BRANCHES (census-proven)… all encodings incl and/pop/SIB/rep-movs checked"); `forensics/T085-EV78-FIRST-TICK-CHAIN.txt` census comment line "[M+0x120]: … NO SETTER ANYWHERE"; `T085-G38-FIRST-TICK-CONTEXT.md` §3 table row M+0x120 | Re-scope the negative to the move object: state that the image-wide encoding census finds **21 write-class [..+0x120] sites**, that receiver provenance was (or must be) checked for all of them, and name the non-M candidates: the LEA-alias vector installer 0x9B7F43→0x9B87EA@0x9B8817 (nonzero pointer; callers 0x7540B4/0x754384/0xA15EF5/0xA32327, non-movement family), the bulk zero-fill 0x9AF3FE (writes 0), and the field copy 0x952D1D/0x952D23. Keep the dead-branch conclusion explicitly conditional on M-scoped receiver provenance. |
| D2 | `forensics/T085-EV81-CONSTANT-5A-1E.txt` census section; `T085-G34-CONSTANT-RELATION.md` §2/§3; `claims.csv` C-094 phrase "Exactly two sites where the constants meet" | (a) Add the omitted in-window 0x5A site **0x9CC640** (`and edi,0x5A; add edi,0x3C` → 60/150) to the census; (b) reword "exactly two meeting sites" to "exactly two sites where the constants **interact**", noting the inert co-occurrence inside T5 slot10 0x9CBE89 (0x9CC0CF uses 0x1E; 0x9CC640 uses 0x5A; disjoint dataflows); (c) state the census window 0x401000–0xA80000 as a truncation of .text (0xBEA000) with nothing verdict-relevant above it (reviewer-verified). |
| D3 | `T085-G41-STANDUP-TRIGGERS.md` §2.1 parenthetical "`mov ecx,[ecx+8]; …; jmp 0x9571BF; ret 8`" | Fix the instruction: 0x97FCC9 is `call 0x9571bf` (EV-79 dump is correct). |
| D4 | `T085-G41-STANDUP-TRIGGERS.md` §3 / `claims.csv` C-090 non-user classification | Add census site **0x948BD8** to the classification (receiver unproven; not established as user — classify as "non-user, receiver not fully proven" rather than omitting it). |
| D5 | `forensics/T085-EV81-CONSTANT-5A-1E.txt` H1/H2 verdict anchor "(T4 slot9, vtable dword 0xB0C884+0x24)" | Fix the dword address: T4 slot9 lives at **0xB0C870+0x24 = 0xB0C894** (value 0x9C9CF7 correct). |
| D6 | `claims.csv` C-090 / `T085-G41-STANDUP-TRIGGERS.md` §1 "30 real sites" | Recount: **29 real code sites in .text + 1 data-section byte-pattern coincidence (0xC93B63, outside the code section)**; keep or drop 0xC93B63 but label it correctly. |

All six corrections are documentation/wording/completeness fixes; none
overturns a CLOSED-STATIC status, a gap state, or a matrix readiness move on
its substance.

## Final verdict

**ACCEPT-WITH-CORRECTIONS**

The main agent's T085 deliverable is substantively sound: every
instruction-anchored claim I re-derived reproduces byte-exactly (vtable map
40/40; first-tick chain incl. mode-arg provenance; arg7=0; census encoding
family; FSDB census on a 4-map independent recount; 0x9C9CF7 accumulator,
0x9BD567 pending action, 0x9C2966, 0x9C1113, 0x9D35F2, 0x9BC602/0x4B6E2C
state-getter stub; evidence files byte-faithful; SHAs and ledger refs clean;
tests genuine). The defects found are real but confined to one over-broad
negative ([M+0x120], D1), one census omission + wording (D2), and four
smaller documentation inaccuracies (D3–D6). Corrections D1–D6 must be applied
before commit.

## COMMIT-APPROVED: no (pending re-check)

Corrections demanded: D1–D6 above, each mapped to its exact file+location.
Once the main agent applies them, this reviewer will re-verify the edited
passages (C-088 clause, EV-78 census comment, G38 §3 row, EV-81 census +
verdict anchor, G41 §1/§2.1/§3, C-090/C-094 wording) in a follow-up pass and
flip COMMIT-APPROVED to yes if the diffs match the demanded scope and no new
text introduces fresh overclaims.


## Phase-3 re-verification

Binary re-verified before all re-checks (sha256 d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718, match). All corrections re-derived from the binary with the reviewer's own scripts; regenerated evidence files re-hashed and re-decoded.

**D1 — [M+0x120] receiver-provenance bound: VERIFIED.**
- research/scripts/t085_dump_evidence.py: EV-78 census note now reads BOUND-scoped: no nonzero move-object +0x120 write in the movement family; names the LEA-alias installer 0x9B7F43 -> 0x9B87EA@0x9B8817 with its non-M callers (0x7540B4/0x754384/0xA15EF5/0xA32327), the bulk-zero 0x9AF3FE, the field-copy 0x952D23, and states the bound is receiver provenance, not encoding exhaustion.
- Regenerated forensics/T085-EV78-FIRST-TICK-CHAIN.txt carries the same note (verified verbatim).
- claims.csv C-088: DEAD BRANCHES clause now prefixed (census-bounded by receiver provenance, t085.1 D1 wording) with the LEA-alias installer and its callers enumerated inline; falsification column updated to any write of a nonzero value into a move-object +0x120.
- T085-G38-FIRST-TICK-CONTEXT.md section 3: new Receiver-provenance bound paragraph with the identical facts; the M+0x120 table row now says no nonzero write with M provenance found (see below).
- Non-blocking residual (note only): gaps.csv G38 verified_scope still carries the compressed phrase [M+0x120] cleared-only -> pinned-branch family dead without restating the bound; the row cites C-088, which now carries it. Acceptable as a summary; no fix demanded.

**D2 — EV-81 co-occurrence + window + interact wording: VERIFIED, WITH ONE NEW DEFECT (D7).**
- EV-81 (regenerated): census window header now declares 0x401000-0xA80000 with the D2 tag; 0x9CC640 (and edi,0x5A) added; verdict wording now Exactly TWO sites where the constants INTERACT; inert co-occurrence inside T5 tick 0x9CBE89 recorded; falsifier (b) notes both censuses bounded to the window.
- claims.csv C-094: interact wording + inert co-occurrence + window bound all present.
- T085-G34-CONSTANT-RELATION.md sections 2/3/4: interact phrasing, inert co-occurrence paragraph, window declared in the result statement and falsifiers, section 4 updated. All three demanded elements landed.
- NEW DEFECT (D7): the correction text mischaracterizes **0x9CC0CF as push 0x1E** in four places (EV-81 census note + verdict anchor, claims.csv C-094, T085-G34 section 2). The instruction at 0x9CC0CF is actually **add dword ptr [ebx+0x23C], 0x1E** (83 83 3C 02 00 00 1E — reviewer re-decoded this phase). The immediate value 0x1E and the co-occurrence-within-0x9CBE89 fact are correct (0x9CBE89 extent 0x9CBE89-0x9CC90F covers both sites), so the verdict is unaffected, but the mnemonic at a cited address is wrong inside a CLOSED-STATIC claim — the same evidence-accuracy class as D3, and must be fixed for consistency.

**D3 — 0x97FCBA instruction quote: VERIFIED.** T085-G41-STANDUP-TRIGGERS.md section 2.1 now quotes call 0x9571bf (was jmp), matching EV-79's byte-accurate dump (0x97FCC9 = E8 F1 74 FD FF).

**D4 — 0x948BD8/0x948B66 classification: VERIFIED.**
- G41 sections 1/2/3: 0x948BD8 now listed as user-family-LIKELY / receiver formally unproven inside 0x948B66, counted separately from the three proven user sites; section 3 lists it with the explicit unproven caveat.
- EV-79 (regenerated): census note adds the same classification and a new disassembly window of the 0x948B66 head.
- claims.csv C-090: Exactly THREE user dispatch sites exist (plus one user-family-LIKELY site 0x948BD8 inside 0x948B66 ... formally unproven ... counted separately). gaps.csv G41 row mentions 0x948BD8/0x948B66.
- Reviewer byte-verification: 0x948B66 is a real function (extent 0x948B66-0x948D05, 147 ins) containing 0x948BD8; the claimed details are exact — 0x4B1C27(this,&[ebp-4]) + p-0xC saturating-subtract at 0x948B7A-0x948B88, [ebx+0x2C]/0x70DF65 gate signature at 0x948BA8-0x948BCC, push 0 + call [eax+0x38] at 0x948BD4-0x948BD8.

**D5 — T4 slot9 dword address: VERIFIED.** EV-81 verdict anchor now reads vtable dword 0xB0C894 = 0xB0C870+0x24 (value 0x9C9CF7 unchanged and correct; dword re-read this phase).

**D6 — census count wording: VERIFIED.** T085-G41 section 1, claims.csv C-090, and the regenerated EV-79 note all state: 29 code sites + 1 data-section coincidence (0xC93B63, beyond .text) + 2 SIB data-island false positives (0xB2418B/0xB9147B) — 32 byte-matches total. EV-79's site list now separates 0xC93B63 as (data).

**Evidence integrity:** all five evidence.csv hashes recomputed post-regeneration — **5/5 MATCH** (EV-77/80 unchanged; EV-78/79/81 regenerated with new hashes recorded). Regenerated disassembly content re-decoded at 167 sampled lines across EV-78/79/81: **0 mismatches**. No other claim, gap, or matrix text was altered beyond the demanded scope (spot-checked C-088/C-090/C-094, G38/G41 rows, G34/G38/G41 reports; C-082/C-086/C-087 and T084.1 rows untouched).

**Remaining demand (blocking):** D7 — replace push 0x1E with add [ebx+0x23C],0x1E at 0x9CC0CF in research/result/stage-readiness/forensics/T085-EV81-CONSTANT-5A-1E.txt (two comment lines), research/source-of-truth/claims.csv C-094, and research/result/stage-readiness/T085-G34-CONSTANT-RELATION.md section 2; regenerate EV-81 via t085_dump_evidence.py and refresh its evidence.csv hash. One-word fix; no conclusion changes.

FINAL: COMMIT-APPROVED: no


## Phase-3b

D7 micro-check (binary SHA re-verified via the sha-pinned loader before disassembly):
- 0x9CC0CF re-disassembled independently: 83 83 3C 02 00 00 1E = add dword ptr [ebx + 0x23c], 0x1e.
- (1) forensics/T085-EV81-CONSTANT-5A-1E.txt: both 0x9CC0CF mentions (census note + verdict anchor) now read add dword [ebx+0x23C],0x1E; no push form remains attached to 0x9CC0CF (remaining push 0x1E strings in the census list are the genuine 6A 1E sites, e.g. 0x9BCA4C/0x9BCD5D/0x9C3F53).
- (2) claims.csv C-094: 0x9CC0CF add dword [ebx+0x23C],0x1E — confirmed, no 9CC0CF push remains.
- (3) T085-G34-CONSTANT-RELATION.md section 2: 0x9CC0CF add dword [ebx+0x23C],0x1E — confirmed.
- EV-81 sha256 recomputed = 3031b9ff7a8b2f680aba4c75001ea13f395ffee0e24da1d2b95de4c0acb68f3c — matches evidence.csv EV-81 row and the stated post-fix hash.
All D1-D7 corrections verified; no new defects introduced.

FINAL: COMMIT-APPROVED: yes
