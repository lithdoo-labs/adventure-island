# T091 — Independent Focus-Object Provenance Reviewer (Phases 1–3 archived)

> Archived by the T091 lead agent from the reviewer sub-agent's private working
> directory (real independent session `ses_e1cc3e339ffeW71CEheCLATUuv`, fresh
> context, private capstone scripts, read-only repo access, no commits/pushes).
> Reviewer private dir: `C:\Users\lithd\AppData\Local\Temp\opencode\t091-reviewer\`
> (23 independent scripts + `phase1-notes.md` + the phase report below).
> Phase 4 (post-push remote verification) will be appended by a follow-up
> archive commit after the round push, per the T090 process.

---

# T091 Independent Reviewer — Phase 1/2/3 Report (Focus-Object Provenance)

Reviewer: T091 independent focus-object provenance reviewer (real sub-agent, fresh context; did not participate in the lead's work).
Date: 2026-11-16. Method: STATIC-ONLY. The game client was never run.
Private working dir: `C:\Users\lithd\AppData\Local\Temp\opencode\t091-reviewer\` (all reviewer scripts and outputs; repo treated read-only).

## 0. Ground truth and reproduction

- EXE `.work\task-036\game-image-unpacked.bin` SHA-256 re-verified by me:
  `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` (matches the tasking).
- Shape2D.dll `.work\task-063\client-stage\Shape2D.dll` SHA-256 re-verified:
  `9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b` (matches; not needed for the decisive EXE-side checks this round).
- Phase 1 (BLIND) used ONLY the pinned T090 tree `3d9dfd5056d5d4693fcad4508650fcdf28b5f2cd` (`git show`) plus the EXE bytes. No working-tree T091 file was read before my blind findings were recorded in `phase1-notes.md`.
- All disassembly by my own capstone 5.0.7 scripts in my temp dir (`rev.py` library + `p1_*.py` / `p2_*.py`); the lead's `t091_*.py` scripts were NOT imported or executed. The lead's forensics were used only to compare against my own derivations after the fact.

## 1. Phase 1 — BLIND verification results (all from pinned tree + bytes)

1. **Focus writer 0x93CB27 ABI**: `ret 0xC` at 0x93CD74 → THREE stack args after `this`(ecx): arg1 record `[ebp+8]` (reused mid-body as the shared-V2D create out-slot), arg2 N `[ebp+0xC]`, arg3 `[ebp+0x10]`. Gates in order: record≠0; `[this+0x3B8]==0`; out `[ebp-0x10]`≠0, `[[ebp-0x10]]`≠0, `([[[ebp-0x10]]-4]>>1)≠0`; record tag `[record] ∈ {0x4F5C6A, 0xD7511E}` → known path (create chain `0x7A48D0(&out,0x31D)`/`0x40634C`/`0x447891` at 0x93CBBE-0x93CBDD, variants templated from 0xBE7330, X=`0x404B07`/Y=`0x404B2E` on the `[[arg3]+0x14]` member, `call [vt+0x90]` Set at 0x93CC9B) — else `0x4B1C27(this, &[ebp+0x10])` fill path that jumps to the tail and SKIPS the Set. No −(400,300) offset anywhere in the body.
2. **Getter 0x93CD77**: reads `[ecx+0x14]`, stores to the out param, AddRefs the member via `[vt+4]` when non-null, `ret 4`. Called twice in the writer (0x93CC20 and 0x93CC44), both times with `ecx=[ebp+0x10]` = arg3; both fetches AddRef'd; null member → 0x80004003 throw.
3. **0x769B51**: `ret 4` (ONE stack arg = string-id; this from `[0xBD8FEC]`).
4. **Call site 0x5C0342**: containing function is 0x5C0327..0x5C0348 (`push esi; mov esi,ecx … call 0x93CB27 … pop esi; ret`); **esi = this** of 0x5C0327; `[esi+0x44]` = string-id → `0x769B51`; writer this = `ecx=[esi+0x10]`; args (record(eax), N=0x320, arg3=esi).
5. **Call site 0x959493**: containing function 0x9573A6 (SEH prolog; frame 0x1818; this saved at [ebp-0x170C]; **`ret 0x1C` at 0x95C345 → SEVEN stack args + this**). At 0x959493: arg3-of-writer = `[ebp+0x20]` = 0x9573A6's arg7 (first-pushed by its callers).
6. **E8 census (mine)**: 0x93CB27 has exactly **10** E8 callers (list identical to C-119); 0x9573A6 has exactly **14** (0x5C031A, 0x95282D, 0x955126, 0x955149, 0x968705, 0x968798, 0x976409, 0x9767BA, 0x9768DB, 0x976A3A, 0x977B8E, 0x977BA7, 0x97A449, 0x97A559).
7. **7th-arg classification with dominance proofs (mine)**: arg7 = the FIRST of the 7 pushes. Per site: 0x5C031A → **esi = this of 0x5C02CB (OBJECT)**; 0x95282D → esi=0 (`xor`@0x95281A, no later def, no bypass); 0x955126/0x955149 → ebx=0 (`xor`@0x954F1E at fn entry of 0x954F0F, no later def); 0x968705 → ebx=0 (`xor`@0x9686F7 inline); 0x968798 → eax=0 (`xor`@0x968787 inline); 0x976409 → eax=0 (`xor`@0x9763FC; all 8 back-jumps re-target the xor itself; ebx is arg1); 0x9767BA/0x9768DB → esi=0 (`xor`@0x97672F in fn 0x976592, no later def; every jump into the push block originates after the xor); 0x976A3A → eax=0 (`xor`@0x976A2F inline); 0x977B8E → edi=0 (all entry paths covered by `xor`@0x977A63 for the 0x977B67-jumpers and `xor`@0x977B5E/0x977B62 for the fall-through/je paths); 0x977BA7 → eax=0 (`xor`@0x977B9C inline); 0x97A449 → edi=0 (`xor`@0x97A3AE, no later def); 0x97A559 → edi=0 (`xor`@0x97A4E9). **13 NULL + 1 OBJECT.**
8. **The other 8 direct callers of 0x93CB27**: 0x93E00B (N=0x3E8, arg3=ebx, `xor`@0x93DFF8); 0x959527 (N=0x320, `push 0`); 0x964E16 (N=0x3E8, pre-push ebx=0, `xor`@0x964370); 0x9651CC (N=0x3E8, id 0x40413D, pre-push ebx=0); 0x965567 (N=0x3E8, ebx=0); 0x98DC43 (N=0x1F4, id 0x406849, pre-push ebx=0 — both `xor`@0x98D757 and @0x98DC763 cover the 0x98D761 jmp path; containing code calls 0x43291A at 0x98DC0C); 0x990E21/0x990E91 (N=0x3E8, arg3=esi=0, `xor`@0x990B42 in fn 0x990B2E).
9. **Canonical text vs bytes (C-109/C-115/C-119 at the pinned SHA)**: every checked assertion matched my independent decode (ABI, gates, tag set, getter, caller table, "no F28 read on the Set path").

## 2. Phase 2 — adversarial re-derivation of the T091 claims (14 questions answered)

- **Q1 (esi at 0x5C0342)**: YES — `mov esi,ecx`@0x5C0328, no other esi def in 0x5C0327; esi is the method `this`, not a member/free register. The method is invoked with `ecx=ebx` (the 0x5C0349 `this`) at 0x5C0430.
- **Q2 (different objects at the two sites?)**: NO — 0x5C0349's tail dispatches 0x5C02CB/0x5C0327 on ONE ebx (`mov ecx,ebx` @0x5C0425 then two adjacent exclusive branches 0x5C0429/0x5C0430); 0x5C02CB and 0x5C0327 each have exactly ONE reference in the entire image (those direct E8 calls; zero imm32/data refs), so both Set-capable sites receive the same `this`. The branch selector is `[user-vt+0xC]` with user=`[W+0x10]` (0x5C041B-0x5C0420). CAVEAT → D1: they are NOT vtable-dispatched virtuals (see D1).
- **Q3 (all 14 callers covered?)**: YES — my own E8 census reproduces the same 14 sites; T091-ARG3-CALLER-IDENTITY.csv rows match my classification exactly (including the "ebx is arg1 = record" nuance at 0x976409 and the `[ebp-4]:=edi` sentinel note at 0x97A559).
- **Q4 (missed indirect callers of 0x93CB27/0x9573A6?)**: NONE FOUND — zero imm32/data occurrences of either address anywhere in the image (no vtable slot, no jump-table entry, no `mov r32, imm32` load), and zero E9/EB jmp-thunks to either (I scanned both). Computed-address dispatch cannot be excluded absolutely by static means, but no evidence exists for it.
- **Q5 ([W+0x14] really P's QI'd Vector2D view?)**: YES — 0x5BFE8C creates P (`call 0x9C2911`@0x5BFEBC; 0x240-byte alloc + ctor 0x9C28BF installing vtables 0xB0C660/[+0xC]=0xB0C5B0 and zeroing +0x238 — all verified by me), then `lea ecx,[ebx+0x14]; push &[ebp+8]; call 0x5C1A08` (0x5BFF11-0x5BFF18). 0x5C1A08 invokes QI on the P+0xC iface with IID 0xBA0500 and stores the out at `[esi]`=W+0x14 (store at 0x5C1A51 after releasing old). QI body 0x9C0EC0 memcmp-accepts IIDs {0xB0E760, 0xBD37B0, 0xBA0378, 0xBA0500} and returns SELF (P+0xC) with AddRef. The getters used by the Set are `[0xB0C5B0+0x20]=0x9C0FEF` and `[0xB0C5B0+0x28]=0x9C105F` (vtable dwords verified by me) — the same P the ctor created; not an offset-coincidental other class.
- **Q6 (getter bypass / [P+0x1C] delegate)**: 0x9C0FEF/0x9C105F are straight-line after the out-param null check (E_POINTER); no branch bypasses `call [edx+0x8C]` = `[0xB0C5B0+0x8C]=0x9C1499`. Inside 0x9C1499 the delegate check is `[view+0x10] = [P+0x1C]`; my own census of `[reg+0x1C]` writes in the whole 0x9BC000-0x9C3000 band found exactly TWO instructions: the base-ctor zero `mov [esi+0x1C],edi`@0x9BC324 (edi=xor'd) and a stack-frame write `mov [ebp+0x1C],eax`@0x9BC761 (not an object member). So within the P-family band the delegate is never installed — matches the claim. (Census is band-scoped; register-mediated writers outside the band are statically unresolvable in general — a documented-boundary class of limitation, not a found counterexample.)
- **Q7 (known-tag guarantee?)**: NONE — the record tag is runtime data (0x769B51/0x76EACD string-id → registry record); statics can only bound the branch. The T091 deliverables phrase the Set as GATED (tag ∈ {0x4F5C6A,0xD7511E}) and the unknown-tag path as fill-and-SKIP — no unconditional-Set claim found. Boundary properly stated.
- **Q8 (same instance chain / receiver-identity gap)**: CONSTRUCTION side closed by me: 0x94ACB7(local) stores a freshly allocated W at `local+4` (the wrapper idiom `{+0=state, +4=W}` — also written by 0x94AA93 node creation and read by 0x94ACCC); 0x948DE7 loads `esi=[ebp-0x10]`=W and calls the init-ctor `0x5BFE8C(ecx=W)`; the ctor installs [W+0x44]/[W+0x10]/[W+0x24..0x30]/[W+0x14] (all stores verified). CONSUMER side: 0x93839F loads X=[user+0x1C30], null-checks, and calls `0x5C0349(ecx=[X+4])` — the `[[user+0x1C30]+4]` deref is byte-exact; the install into user+0x1C30 is `0x5D5377` with branch-B arg4 = `[[scene-handler+0x9C]+0x68]` (read verified at 0x5EBAEE-0x5EBAF7; store verified at 0x5D53A7). GAP: the writer of `[Eye+0x68]` (and hence the ultimate writer of that X's +4) is NOT byte-located — the lead declares this honestly (R-T091-4), but C-120's main sentence states "a smart-ptr wrapper X whose +4 = W" as flat fact → D3. Cross-validation (usage route) is real: 0x5C0349/0x5C02CB/0x5C0327 read exactly the ctor-installed members, and 0x9573A6 reads `[arg7-vt+0x10]` (=0x94B9E9 `lea eax,[ecx+0x24]` = &W+0x24) under tag 0xD7511E at 0x958540-0x9585A (verified by me).
- **Q9 (untracked alternate install of [W+0x14] or W replacement?)**: NONE FOUND — the W ctor family zeroes [W+0x14]/[W+0x18] (0x94B960/0x94B964) and the only in-family writer of W+0x14 is the 0x5C1A08 attach; my sampled census of the +0x14 write-hits in the 0x5BE000-0x5C1000 band shows they are list-node stubs (e.g. 0x5BE029 inside a `push 0x18; alloc; mov [eax],vt; …` node ctor), not W writers. Receiver-unresolvable offset-collision sites remain a stated static boundary, not a found counterexample.
- **Q10 (creation vs coordinate updating conflation?)**: NONE — every deliverable consistently reports: INITIAL coordinates PROVEN end-to-end (packet 0xCE → W ctor → 0x9BC622 → encrypted base slots + target mirror), ONGOING target-refresh Set driver PARTIAL (entry decoded at `[0xB0C5B0+0x90]=0x9C16DD` → `[+0x40]=0x9C1113`; zero direct E8 callers — I re-censused E8/E9/imm32 myself: none; dispatch site not byte-located). The "camera holds the packet point until a Set lands" statement is sound: the `rep movsd` mirror at 0x9BC749 executes UNCONDITIONALLY (the flags `test [ebp+0x1C],0xFFFFFFFE` at 0x9BC737 only feeds the LATER `jne`@0x9BC74C which skips a second init call), so base==target at t0 and the extrapolation returns the packet point for any k.
- **Q11 (coordinate-space claims byte-correct?)**: YES — X±1 branch 0x5BFEEA-0x5BFEF6 (`[ebp+0x10]==0 → inc eax` = camera-null → X+1, else `dec eax` = X−1); Y−0x14 at 0x5BFF04 (`sub esi,0x14` on [W+0x28]); map-bounds block copied by 0x9BC602 from `[[0xBDD498]+0x24]` into [P+0x138..0x147] (`movsd` ×4 — verified); clamping in 0x9BC622 against [P+0x138]/[P+0x13C]/[P+0x140]/[P+0x144]; `[0xB0C5A8]` = 0.03333333333333333 (double 1/30 — verified) referenced at 0x9C1522; k = `([[0xBDD89C]+0x18] − 0x77F5A1([0xBE2788])) · 1/30` stored to [ebp+0x34] (0x9C14ED-0x9C1526 — verified); extrapolation `X = dec(P+0x20) + (dec(P+0x80)−dec(P+0x20))·k` with round constants [0xAFECC0]=0.0, [0xAFEC20]=0.5, [0xB00D60]=0.499999999 (all verified as doubles). The "world/map px" interpretation rests on the clamp domain (map bounds) and the camera's world-space role per earlier closed claims — reasonable, and the byte-level parts are exact.
- **Q12 (untracked conditional alias arg3↔[user+0xF28]?)**: NONE FOUND — 0x4B1C27 (verified by me) reads `[ecx+0xF28]` (this=user), writes it into the arg3 OUT-slot with AddRef, `ret 4`; the writer then jumps to the tail — the Set is skipped on that path, and the Set path never reads F28. user ctor zeroes +0xF24/+0xF28 (`mov [esi+0xF24],ebx`@0x93443D, `mov [esi+0xF28],ebx`@0x934443 — verified); 0x949B46 is a READ (`lea edi,[esi+0xF28]; push edi; call 0x44484B`) and 0x934B9E a RELEASE (`lea ecx,[esi+0xF28]; call 0x4063B5`) — verified. W is installed in the disjoint field user+0x1C30 (0x5D5377 store verified at 0x5D53A7). DISTINCT-DATAFLOW adjudication CONFIRMED; the 11 undecoded F28 lea sites remain a declared residual and cannot affect the Set path even if F28 were aliased (they only feed the skip-Set path).
- **Q13 (structural possibility stated as definitive fact?)**: three instances found — D1 (vtable-slot/"thunk"/"virtual method" mechanism claims, which are not merely structural but byte-wrong), D2 (owner-install value/args), D3 (the "[X+4]=W" edge in C-120 stated as fact while its installer is a declared residual). No other instance found; the core claims are consistently phrased with gates and honest residuals.
- **Q14 (scope discipline?)**: YES — `git status` shows ONLY research/ paths touched; the single research objective is pursued; WP0 errata were explicitly tasked; no unrelated gap was closed (Gaps stay 41; 0 status transitions; 1 new claim + 1 new evidence).

## 3. Mechanical checks (a-f)

- **(a) WP0-A**: PASS — C-106 now reads "the 80 id-0x31D candidate sites … split into 76 real create calls … and 4 sites that perform NO create call [t091 WP0-A …]", preserving the t088.1 reviewer proof and history.
- **(b) WP0-B**: PASS — C-108 carries the UNARMED-state qualifier and the C-116 0x51407A34 delta-store refinement ("the immediate/raw wording holds only for the unarmed vector; no reversal of the default-VARIANT branch proof") while keeping the 39/39 default-VARIANT proof.
- **(c) WP0-C**: PASS — G10 next_action no longer contains "trace filtered-coordinate consumers"; it now lists the real residuals (P Set dispatch site, [P+0x238] arm, wrapper lifecycle, E2/E3, 18 receivers, slot15 chain).
- **(d) WP0-D**: PASS — at pinned 3d9dfd50 the EV-104 row contains "44 distinct values [t090 phase-3 D1 …]" and "timeline doc sha 9290a45f69af1f85 [refreshed phase-4 R1b]"; I recomputed SHA-256 of `research/result/stage-readiness/T090-G39-ANIMATION-TIMELINE.md` = `9290a45f69af1f8518ea8f1cfe74115a7b6dd009173d3cd083e7c06396767fff` — matches; the file is unmodified in the working tree.
- **(e) Validator + tests**: PASS — `python research/scripts/validate_reverse_engineering.py` (my run, read-only): "Claims: 120 | Gaps: 41 | Evidence: 108 … RESULT: PASS (0 errors, 0 warnings)". `python -m unittest discover -s research/tests -q`: "Ran 256 tests … OK". Both match the lead's §H log. Test diffs vs the pinned tree are benign count migrations (119→120 claims, 107→108 evidence).
- **(f) git status**: PASS — all changes are under `research/` only (6 modified CSVs, 5 modified test files, new T091 reports/forensics/scripts/tests). No non-research path touched.

## 4. Findings (defects)

- **D1 (moderate; factual error in three deliverables — identity conclusion unaffected).**
  The W vtable 0xB0BC40 (decoded by me as dwords) contains `slot+4 = 0x5C02A9` (a `ret 0x10` predicate stub) and `slot+8 = 0x5C0324` (a bare `ret 4` — an EMPTY virtual). Neither dispatches to 0x5C02CB or 0x5C0327; the only references to 0x5C02CB/0x5C0327 in the whole image are the direct calls at 0x5C0429/0x5C0430. Wrong wording: T091-G10-FOCUS-PROVENANCE-REPORT.md L30 ("W vtable slot+8 的 0x5C0324 thunk 后体") and L54 ("W 的两个虚方法"); T091-FOCUS-OBJECT-PROVENANCE.md L23-24 ("two virtual methods of W itself"); T091-ARG3-CALLER-IDENTITY.csv rows 2/3 notes ("W vtable slot+8 (0x5C0324 thunk)" / "0x5C02CB is W vtable slot+4 family"). Fix: replace with "direct-called member methods of W (no vtable slot; exclusive direct callers 0x5C0429/0x5C0430 with ecx=ebx=W)". Note the canonical C-120 text ("W's own methods") is already correct and needs no change.
- **D2 (moderate; mis-derivation of the 0x9BC622 owner arguments — does not affect X/Y install, mirror, extrapolation, or the Set chain).**
  The call at 0x5BFF0E pushes, in order: the 0xA4F6F1 result (esi←eax@0x5BFEE3), 3, [ebp+0x20](ctor-arg7=0), [ebp+0x1C](ctor-arg6=0), Y−0x14, X±1, 1 — so 0x9BC622's stack args are (1, X±1, Y−0x14, 0, 0, flags=3, owner=0xA4F6F1-result). The provenance MD §1 graph line "0x9BC622(P, 1, X±1, Y−0x14, 0, 0, P)" and CSV rows 13/14 ("arg6 = P itself (push esi=P at 0x5BFEFB)", "owner=P at ctor: reads [P+0x1C]=0 delegate…") are wrong: the owner stored at [P+0x110]/[P+0x114] is the object returned by `0xA4F6F1([0xBDD498], X, Y, 0, 0x7FFFFFFF, 1)` (a map-space query returning a 0xB00D88-vtable object), and [P+0x130]/[P+0x134] copy `[owner+0x1C]/[owner+0x20]` from THAT object (when [P+0x110]≠0). The 6th arg is a flags value (3), tested with 0xFFFFFFFE at 0x9BC737. Fix: correct the arg list, the value_source cells of CSV rows 13/14, and the MD graph lines; note that W-vt+0 (0x94B9BE) is queried at 0x9BC6D2 to conditionally set [P+0x110].
- **D3 (minor; overclaim in canonical text).**
  C-120 states "a smart-ptr wrapper X whose +4 = W" as flat fact. The consumer's `[[user+0x1C30]+4]` deref is proven and the smart-ptr `{+4=W}` idiom is proven (0x94ACB7/0x94AA93/0x94ACCC), but the writer of `[Eye+0x68]` (the installer of that X) is declared unlocated (R-T091-4), so the edge "that X's +4 = this W" is convention-backed inference, not a byte-located write. Fix: qualify in C-120 (e.g. "X read as a smart-ptr wrapper whose +4 the consumer derefs as the receiver; installer edge bounded by R-T091-4").
- **D4 (cosmetic; artifact defect).**
  T091-FOCUS-CHAIN-DISASM.txt window "S" (anchored at 0x934437) decodes from a mid-instruction offset and prints garbage (`add byte ptr [ecx + 0xf249e], cl` etc.). The intended stores exist at 0x93443D/0x934443 (I verified them with a correct anchor). Fix: regenerate that window anchored at 0x93443D.

## 5. Verdicts

### TECHNICAL-PASS

Every decisive claim of the round — writer/getter ABI, 10+14 caller censuses with per-site dominance proofs, arg3 = W at both Set-capable sites (same instance via the exclusive 0x5C0429/0x5C0430 dispatch on one ebx), [W+0x14] = QI(P, 0xBA0500), the packet-0xCE initial coordinate chain with ±1/−20/clamp/mirror semantics, the getter→0x9C1499→extrapolation→0x93CC9B chain, and the arg3-vs-F28 adjudication — was independently re-derived by me from the bytes and is correct. D1/D2 are factual errors confined to secondary characterization in the deliverable files (the canonical C-120 text is clean except the D3 phrasing); none of them reverses a canonical claim or the objective. Required corrections below must land before commit.

### OBJECTIVE-SUCCESS (with honest residuals; item 4 PARTIAL — not blocking)

Per-gate adjudication (10 items):
1. Both Set-capable arg3 sources = W — **PROVEN** (reviewer-verified; note D1 wording fix).
2. Object class / structural identity — **PROVEN** (0x48 alloc 0x94B902, final vtables 0x94B9A5/0x94B9AB, init-ctor 0x5BFE8C; usage cross-validation incl. 0x958540-0x95855A).
3. +0x14 member type — **PROVEN** (QI 0xBA0500 self-return; vtable slots +0x20/+0x28/+0x8C verified).
4. Construction/installation + coordinate write path — **PARTIAL, non-blocking**: the INITIAL write is proven end-to-end (packet 0xCE → 0x99142A → 0x948DE7 → W ctor → 0x9BC622 base+mirror), and the task's required "坐标写入来源" for the chain is thereby proven; the ONGOING target-refresh dispatch site (slot+0x90→0x9C1113) remains unlocated and is honestly declared (R-T091-2). The mirror (unconditional `rep movsd`@0x9BC749) makes base==target at t0, so the provenance chain is not broken by this residual. Also R-T091-1 ([P+0x238] arm) and R-T091-4 (Eye installer) are declared and bounded.
5. Coordinate write source (initial) — **PROVEN** = server packet opcode 0xCE (X=v1, Y=v2, string-id=v4).
6. Write dataflow → 0x93CD77 getter — **PROVEN** (0x5BFF14-0x5BFF18 attach; getter reads [W+0x14]).
7. Getter result → 0x93CC9B Set — **PROVEN** (0x9C0FEF/0x9C105F → 0x9C1499 → 0x93CC15/0x93CC3B/0x93CC9B).
8. Coordinate space/offset semantics — **PROVEN** (world/map px; Y−20; X±1; map-bounds clamp from [[0xBDD498]+0x24]; 1/30 extrapolation k; round ±0.5).
9. arg3 ↔ [user+0xF28] — **DISTINCT-DATAFLOW-PROVEN** (Set never reads F28; fill path replaces arg3 and skips Set; disjoint user fields +0x1C30 vs +0xF28; ctor-zero verified; 2 of 13 lea sites classified read/release by me).
10. Independent reviewer pass — **this report**.

### Required corrections (blocking before commit)
1. D1 — fix the vtable-slot/"thunk"/"virtual method" wording in the report, provenance MD, and caller-identity CSV (3 files, ~4 spots).
2. D2 — correct the 0x9BC622 owner-argument derivation in the provenance MD §1 graph and CSV rows 13/14.
3. D3 — qualify the "[X+4] = W" edge in C-120 (canonical text).

### Recommendations (non-blocking)
1. D4 — regenerate DISASM window S with a correct anchor (0x93443D).
2. Consider recording in G10/C-120 that the record-tag membership ({0x4F5C6A,0xD7511E} vs unknown) is runtime data — the gated phrasing is already correct, an explicit boundary sentence would help future rounds.
3. Consider noting the [P+0x1C] census is band-scoped (0x9BC000-0x9C3000) with the standard offset-collision caveat.

## 6. Honesty statement

Items I could NOT verify (stated explicitly): (i) the ultimate writer of `[Eye+0x68]` / that X's `+4` (R-T091-4 — unlocated, declared by the lead); (ii) the opcode-number annotations in the caller CSV's notes column ("opcode 0xC8 handler 0x93DC3E", "opcode 0xC2 handler 0x990B2E") — the handler function identities are verified but I did not decode the 0x97FAC9 jump-table indices to confirm the opcode numbers; (iii) absolute exclusion of computed-address indirect calls (statically impossible in general — no evidence found); (iv) the derived-vtable forwarder bodies beyond 0x9C3DD1's head (slot targets verified, bodies not fully decoded). All other statements above come from my own scripts whose outputs I ran and read in this session.

---

## Lead's correction disposition (appended at archive time)

- D1: FIXED in report §0 (two spots), provenance MD §0, caller-identity CSV rows 2/3 (directly-called member methods; stub wording).
- D2: FIXED in provenance MD §1 graph + §3 note, member-writers CSV rows for [P+0x110]/[P+0x130] and the vx/vy value sources, main-report graph line (owner = 0xA4F6F1 result; flags=3).
- D3: FIXED in C-120 (installer-edge qualifier + R-T091-4 cross-ref).
- D4: FIXED (dump window S re-anchored at 0x93443D; regenerated).
- Rec 2/3: ADOPTED in C-120 (runtime tag-membership boundary + band-scoped census note).
- Gates re-run after corrections: clean-room regenerated; validator PASS 0/0 (120/41/108); 256/256 tests OK.

— End of Phases 1–3. Phase 4 (post-push remote verification) appended below after the round push.

---

# T091 Independent Reviewer — Phase 4 Report (Post-Push Remote Verification)

Reviewer: T091 independent focus-object provenance reviewer (same sub-agent session as Phases 1-3; verdicts then: TECHNICAL-PASS / OBJECTIVE-SUCCESS, findings D1-D4).
Date: 2026-11-16. Method: STATIC-ONLY; repo treated READ-ONLY; all outputs in `C:\Users\lithd\AppData\Local\Temp\opencode\t091-reviewer\` (scripts `p4_*.py`, outputs `p4_*.txt`).

## 1. Remote/local sync, commit chain, push shape

- `git fetch origin` executed.
- `git rev-parse HEAD origin/design/adventure-field-map-scene` → both `8c81201fa9aeb8dd5c8e45da67db0940197f63c8` — remote HEAD == local HEAD.
- `git status -sb` → `## design/adventure-field-map-scene...origin/design/adventure-field-map-scene` (no ahead/behind markers) — branch in sync with upstream.
- `git status --porcelain` → EMPTY — working tree clean.
- `git log --oneline -3` → `8c81201f research: t091 focus object provenance closure` → `3d9dfd50 research: t090 reviewer phase-2..4 archive and R1 fixes` → `e885ec80 research: t090 wz timing and camera provenance closure`.
- HEAD's parent is EXACTLY `3d9dfd5056d5d4693fcad4508650fcdf28b5f2cd` (the pinned T090 SHA); since origin == local HEAD and the parent is the previous remote HEAD, the push was a fast-forward (no rebase, no force).

**Check 1: PASS. Check 2: PASS.**

## 2. Diff scope, whitespace, frozen surfaces

- `git diff --name-only 3d9dfd50..HEAD` → **36 files, ALL under `research/`** (11 result/clean-room + forensics deliverables, 16 t091_* scripts, 3 source-of-truth CSVs, 6 test files). Filtering for any path NOT starting with `research/` returned **nothing**.
- `git diff 3d9dfd50..HEAD --check` → exit 0, no whitespace errors.
- Frozen surfaces: the diff contains **no** `components/`, **no** `content/`, **no** `.work/`, and **no** `loom-realm` path. `.gitmodules` confirms the submodule (`loom-realm` → github.com/lithdoo-labs/loom-realm.git); its pin is untouched by the round diff. The original binaries under `.work/` are untouched.

**Check 3: PASS (36/36 research/). Check 4: PASS. Check 5: PASS.**

## 3. Phase-3 required corrections at the pushed HEAD

- **D1 (vtable/virtual-method wording) — LANDED.**
  - `T091-G10-FOCUS-PROVENANCE-REPORT.md` L32: "0x5C0327 = W 的直接调用成员方法（全镜像仅直接调用者 0x5C0430，ecx=ebx=W）；W vtable 0xB0BC40 slot+8 是空 `ret 4` 短桩 0x5C0324（非 thunk）[reviewer D1 修正落地]"; L56: "0x5C02CB/0x5C0327（W 的两个直接调用成员方法，非 vtable 分发）[reviewer D1]".
  - `forensics/T091-FOCUS-OBJECT-PROVENANCE.md` L23-27: "two directly-called member methods of W (no vtable slot; exclusive direct callers 0x5C0429/0x5C0430 with ecx=ebx=W; W vtable slot+8 holds a bare `ret 4` stub, not a thunk [reviewer phase-2 D1 correction applied])".
  - `forensics/T091-ARG3-CALLER-IDENTITY.csv` rows 2/3 notes: "DIRECTLY-CALLED member method of W (no vtable slot; exclusive direct caller 0x5C0430 …; W vtable 0xB0BC40 slot+8 holds a bare ret-4 stub 0x5C0324, not a thunk - reviewer D1)" and "0x5C02CB is a DIRECTLY-CALLED member method of W (… W vtable 0xB0BC40 slot+4 = 0x5C02A9 is a ret-0x10 predicate stub, not a dispatch to 0x5C02CB - reviewer D1)". The stale "vtable slot+8 thunk 后体" / "slot+4 family" / "两个虚方法" wording is gone.
- **D2 (0x9BC622 owner args) — LANDED.**
  - Provenance MD graph: "经 0xA4F6F1([0xBDD498], X, Y, 0, 0x7FFFFFFF, 1) -> owner object (map-space query; eax@0x5BFEE3)" and "call [P-vt+4] = 0x9BC622(P, 1, X±1, Y−0x14, 0, 0, 3, owner=0xA4F6F1-result)"; §3 note L122-124: "The owner arg of the initial 0x9BC622 call is the 0xA4F6F1 map-space query result (eax@0x5BFEE3), NOT P; [flags] (3) tested with 0xFFFFFFFE at 0x9BC737 [reviewer phase-2 D2 correction applied]".
  - Main report §1 graph L52 now carries the corrected shape `0x9BC622(P,1,X±1,Y−20,0,0,3,owner=0xA4F6F1 结果)`; the stale "(…,0,0,P)" tail is absent from BOTH files (contains-check false).
  - `forensics/T091-ARG3-MEMBER14-WRITERS.csv` row 13: value_source = "the 0xA4F6F1([0xBDD498],X,Y,0,0x7FFFFFFF,1) map-space query result (esi=eax at 0x5BFEE3; pushed at 0x5BFEFB - reviewer D2 correction; NOT P)"; row 14: "owner = the 0xA4F6F1 result object (0xB00D88-vtable map-space object - reviewer D2 correction)".
- **D3 (C-120 installer-edge qualifier) — LANDED.** C-120 now reads: "…a smart-ptr wrapper X that the consumer derefs at +4 as the receiver — the {+0=state,+4=W} wrapper idiom is byte-proven at 0x94ACB7/0x94AA93/0x94ACCC, but the writer of [Eye+0x68] (the installer of that X) is the bounded residual R-T091-4, so the X-to-W edge is convention-backed inference rather than a byte-located write [reviewer phase-2 D3 qualifier]". C-120 additionally carries the runtime tag-membership boundary ("the record-tag membership … is runtime data — the Set is gated on it statically, not guaranteed") and the band-scoped census note ("band-scoped (0x9BC000-0x9C3000) with the standard same-offset-different-class caveat") — recommendations 2/3 adopted.
- **D4 (DISASM window S) — LANDED.** `forensics/T091-FOCUS-CHAIN-DISASM.txt` window S is now anchored at 0x93443D and decodes `89 9e 24 0f 00 00  mov dword ptr [esi + 0xf24], ebx` / `89 9e 28 0f 00 00  mov dword ptr [esi + 0xf28], ebx` correctly (verified against my own Phase-2 anchored decode of the same bytes).

**Check 6: PASS** (with three minor non-blocking observations, see §6).

## 4. Ledger state at HEAD

- `research/source-of-truth/`: **claims=120 / gaps=41 / evidence=108**; clean-room registers in sync (120/41/108).
- C-120: status **CLOSED-STATIC**, evidence_grade **A**; EV-108 present and cross-referenced.
- G10: status **PARTIAL-STATIC** (no migration); gap status counts {CLOSED-STATIC: 26, PARTIAL-STATIC: 8, OPEN-STATIC: 6, SUPERSEDED: 1} — identical to T090.
- WP0-A: C-106 contains "split into 76 real create calls" + "4 sites that perform NO create call". WP0-B: C-108 contains "UNARMED state" + "0x51407A34" + "NEVER arms the VT_I4 duration interpolation". WP0-C: G10 next_action no longer contains "trace filtered-coordinate consumers" and now leads with the real residuals (P Set dispatch site / [P+0x238] arm).

**Check 7: PASS.**

## 5. Gates re-run at the pushed HEAD (read-only; clean-room generator NOT run)

- `python research/scripts/validate_reverse_engineering.py` → "Claims: 120 | Gaps: 41 | Evidence: 108 … ERRORS: 0 / WARNINGS: 0 / RESULT: PASS (0 errors, 0 warnings)".
- `python -m unittest discover -s research/tests -q` → exit 0, "Ran 256 tests in 8.816s / OK".
- Both match `forensics/T091-QUALITY-GATES.txt` at HEAD (live log: generator + validator PASS + 256 OK, OVERALL: PASS).

**Check 8: PASS.**

## 6. Deliverable spot-checks at HEAD

- `T091-G10-FOCUS-PROVENANCE-REPORT.md` — present (reviewer row cites this session's id, TECHNICAL-PASS/OBJECTIVE-SUCCESS, and the D1/D2/D3 landings).
- `T091-OBJECTIVE-GATE.csv` — **10 rows**, `reviewer_verdict` column FILLED on all rows (items 1-3,5-8 PROVEN; 4 PARTIAL non-blocking; 9 DISTINCT-DATAFLOW-PROVEN confirmed; 10 DONE referencing T091-REVIEWER-INDEPENDENT.md).
- `forensics/T091-FOCUS-CHAIN-DISASM.txt` — present, window S fixed.
- `forensics/T091-ARG3-CALLER-IDENTITY.csv` — **24 data rows**.
- `forensics/T091-ARG3-MEMBER14-WRITERS.csv` — **20 data rows**.
- `forensics/T091-FOCUS-OBJECT-PROVENANCE.md` — present with D1/D2 corrections.
- `forensics/T091-REVIEWER-INDEPENDENT.md` — present (122 lines): my Phase 1-3 report verbatim + the lead's "correction disposition" appendix (D1/D2/D3/D4 FIXED, Rec 2/3 ADOPTED, gates re-run) + the closing marker "End of Phases 1-3. Phase 4 (post-push remote verification) appended below after the round push".
- `forensics/T091-QUALITY-GATES.txt` — live output log.

**Check 9: PASS.**

## 7. Phase bookkeeping (no fabricated post-push content)

The archived reviewer file at HEAD contains ONLY Phases 1-3 plus the lead's correction-disposition note, and explicitly defers Phase 4 to a post-push appendix. Nothing in the pushed commit claims post-push verification that did not happen; this report is the Phase-4 record to be appended by the lead in the follow-up archive commit.

**Check 10: PASS — confirmed: the pushed HEAD contains only Phases 1-3 (no fabricated post-push content).**

## 8. Minor non-blocking observations (for the next round's ledger touch-up; none affect verdicts)

- **O1**: EV-108's verification prose still carries the stale call shape "[edx+4]=0x9BC622(P,1,X+-1,Y-0x14,0,0,P)" — the D2 fix was applied to the MD/CSV/report and to C-120 (which is clean), but not to this evidence-row prose. Cosmetic; recommend aligning on the next evidence-row edit.
- **O2**: two arg-INDEX labels remain swapped relative to the (correct) positional order in the fixed graph line "0, 0, 3, owner=…": provenance MD L123 says "arg7 is a flags value (3)" and MEMBER14 CSV row 13 prefixes "arg6 =" for the owner — under the standard last-push=arg1 numbering, flags = the 6th stack arg ([ebp+0x1C]) and owner = the 7th ([ebp+0x20]). The VALUES (owner = 0xA4F6F1 result; flags = 3) are correct everywhere; only the two label words are off.
- **O3**: `research/tests/test_t091_round.py` comment at the `u32(0xB0BC40 + 0x08)` assertion still uses the word "thunk" ("ret-4 thunk of the direct focus method"); the byte assertion itself is correct and all prose deliverables use the fixed wording.

## 9. Final check table

| # | Check | Result |
|---|---|---|
| 1 | fetch; remote==local HEAD (8c81201f); in sync; clean tree | PASS |
| 2 | parent of HEAD == 3d9dfd50; fast-forward (no rebase/force) | PASS |
| 3 | 36/36 changed paths under research/; zero non-research | PASS |
| 4 | `git diff --check` clean | PASS |
| 5 | components/, content/, loom-realm submodule pin, .work/ untouched | PASS |
| 6 | D1/D2/D3/D4 landed at HEAD (details in §3) | PASS (O1-O3 noted) |
| 7 | 120/41/108; C-120 CLOSED-STATIC/A; G10 PARTIAL-STATIC; WP0-A/B/C | PASS |
| 8 | validator PASS 0/0 (120/41/108); 256 tests OK (exit 0) | PASS |
| 9 | 8 deliverables present; gate CSV 10 rows reviewer-filled; 24/20 CSV rows | PASS |
| 10 | reviewer file = Phases 1-3 only; Phase 4 deferred to appendix | PASS |

## Overall Phase-4 verdict

**ARCHIVE-ACCEPT.**

The round was pushed as a single fast-forward commit `8c81201f` on `design/adventure-field-map-scene` (parent `3d9dfd50`), touching only `research/` (36 files), whitespace-clean, with all frozen surfaces untouched; all Phase-3 blocking corrections (D1, D2, D3) and D4 plus recommendations 2/3 verifiably landed in the pushed files; the ledger and clean-room registers are consistent (120/41/108) with no gap-status migration; both quality gates re-run by me at the pushed HEAD pass identically to the archived log; and the archived reviewer file contains only Phases 1-3 with the Phase-4 appendix correctly deferred. The three observations (O1-O3) are cosmetic leftovers that do not affect any claim, verdict, or gate and can be folded into the next round's routine ledger edits.

---

## Lead's Phase-4 archive disposition (appended at final archive)

- O1/O2/O3 folded into THIS archive commit (EV-108 call shape; arg-index labels in the provenance MD and writers CSV; test comment) — `t091_final_archive.py`.
- Round chain: `3d9dfd50` → `8c81201f` (round commit, pushed, Phase-4 verified) → this archive commit (reviewer Phase-4 appendix + O1-O3 fold-in).

— End of Phase 4.
