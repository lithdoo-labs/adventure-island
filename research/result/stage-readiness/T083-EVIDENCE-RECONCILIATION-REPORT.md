# T083 — Evidence Reconciliation & Independent Re-Audit Report

**Round**: t083 (2026-11-14) — t082 acceptance-fix round. No new Claim / Evidence / Gap IDs were created; no Gap was closed; no PARTIAL-STATIC or OPEN-RUNTIME status was upgraded.
**Branch**: `design/adventure-field-map-scene`. **Starting remote HEAD**: `db4d226163c159a0210881596e2a432d4461b9c4` (verified before any write: local `git rev-parse HEAD` == `git ls-remote` output; working tree clean).
**Binary identity** (re-verified this round by lead AND independent reviewer): `.work/task-036/game-image-unpacked.bin`, SHA-256 `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718`, linear mapping `fileOffset = VA − 0x400000`.

---

## 1. Executive Summary

The t082 remote independent acceptance found six classes of evidence-consistency defects (F1–F6). t083 fixed all six at the **source-of-truth** level, re-verified every disputed item against the raw binary/FSDB data, added a new fail-closed validator check family (CHECK 17) with 7 new unit tests, regenerated all clean-room deliverables through the official generator, and obtained a **truly independent sub-agent review** (separate context, separate temp directory, own harness, own hashes) whose five verdicts were **ACCEPT ×4 and ACCEPT-WITH-CORRECTIONS ×1**, with all five of its findings (2 required matrix corrections + 3 cosmetic polish items) applied before commit.

Two of the re-audits materially **strengthened** the t082 conclusions rather than weakening them:

- **F1**: the true 13-map Foothold census is **2283** records, not the t082-claimed 2154 (machine recount of all 13 files; v-dominant/degenerate/ladder/rope/seat figures re-confirmed unchanged).
- **F3**: the 0xA4F6F1 halfWidth audit is now **complete for all 24 call sites** — 23 sites pass constant **1** (19 direct `push 1` + 4 register-carried `edi=1`) and 1 site passes **2** (0x9C6B68); the t082 "4 dynamic + 1 undecodable" classifications were misreads (constant immediates and an alignment artifact).

Stage verdict unchanged: **NOT STAGE-READY**.

## 2. Git Baseline and Final SHA

| | SHA |
|---|---|
| Starting remote HEAD (t082 end) | `db4d226163c159a0210881596e2a432d4461b9c4` |
| t083 commit | see final report summary (fast-forward, single commit) |
| Final remote HEAD | verified equal to the local t083 commit after push |

Pre-write checks performed: remote HEAD match, clean working tree, t082 history preserved (no force push), Frozen ABI untouched (validator CHECK 13 pin passes), LoomRealm submodule pin untouched (`git status` shows no submodule change; `components/` unchanged — see §14 diff scope).

## 3. F1–F6 Fix Details

### F1 — EV-63 FSDB source hash (highest priority) — FIXED

- **Defect**: EV-63's `source_file` pointed at the FSDB data directory while `source_sha256` carried the **EXE** hash `d4a67597…` — no integrity proof for the data evidence at all.
- **Fix**: generated a deterministic manifest (`research/scripts/t083_fsdb_manifest.py` → `forensics/T083-FSDB-MANIFEST.txt`): 23 files (13 Foothold + 7 Rope + 3 Seat) sorted by (group, map id), UTF-8/LF/trailing-newline, per-file `relpath,bytes,sha256,records`, type-level census, body identity `MANIFEST-SHA256 ac792643…`; EV-63 now binds the manifest file with its full-file hash `1a6e488dbe15e4309cccc1eb771ac8b095540783e006bb3ba60fa9658e76b43f`.
- **Recount**: 13-file JSONL parse gives **Foothold 2283** (376+18+240+40+184+130+45+188+355+144+172+144+247), all with the 9 fields; v-dominant (|dy|>|dx|) per-map max **248** in 230020200; degenerate 0; **Rope 16 = ladder 14 / rope 2** (all y1<y2); **Seat 12** (3/6/3). t082's 2154 corrected everywhere with explicit correction markers; C-068 reasoning updated.
- **Allowlist**: every manifest file maps into the 13-map allowlist (fail-closed generator errors on any non-allowlist map file).

### F2 — C-056/C-072 rope endpoint labels — FIXED

- Authoritative semantics (re-verified from bytes this round, window 0x9D8165–0x9D8213): `rope+0x10 = y-min = top` (branch `y < top` → `top−5` if `uf≠0` else re-read top), `rope+0x14 = y-max = bottom` (key>0 branch `y > bottom` → `bottom+1`); exit vcall `(M,0,0,0)` via three `push ebx` @0x9D8206/07/0D.
- C-056 now carries the corrected labels **with** the C-072 correction linkage; EV-37's old `[rope+0x10] bottom (y=bottom-5)…[rope+0x14] top (y=top+1)` text rewritten with correction annotation (numeric facts unchanged); t080 report `G40-G41-MOVEMENT.md` §1 and verdict table corrected in place with explicit "labels corrected t082 by C-072/EV-58" markers; t080 direction words ("downward/upward") recorded as swapped. C-072 remains the correction record; machine instructions untouched.

### F3 — 0xA4F6F1 call-site census — FIXED (strengthened)

- Exhaustive rel32 scan: **exactly 24 direct E8 sites** (t082's total claim was correct; its published table listed only 15 addresses and its classification summed to 23).
- Full re-audit with alignment-corrected windows + stack simulation (generator `research/scripts/t083_a4f6f1_audit.py`, artifact `forensics/T083-A4F6F1-CALLSITE-AUDIT.txt`): **19 direct `push 1`** (incl. 0x963D72 portal, 0x955498 teleport-apply where the literal 1 is a leftover `abs()`-argument slot — helper 0xa70b13 = 1-arg cdecl abs, verified; and 0x964074 which decodes cleanly as `push 1` @0x964068 — the t082 "undecodable" was an alignment artifact), **4 register-carried `edi=1`** (0x70D024/0x9364D4/0x9364FF/0x93652A — all `push 1; pop edi` immediates; 0x70D024's edi preserved across callee-saved 0x70D1D9, save/restore verified), **1 `push 2`** (0x9C6B68). **0 dynamic, 0 undecodable.**
- t082 error causes recorded: 7 sites unlisted in its table; 0x955498's `esi` misread as the width (it was the abs() argument); 0x964074 window mis-aligned.
- C-073/EV-57 rewritten to the corrected census; forensics §5 table now lists all 24 sites; archives annotated (history preserved, not deleted).

### F4 — RE-READY rows' stale minimum_next_work — FIXED

- **P0-09**: removed "为 FSDB 数据清点登记 DATA 类 EV（下轮）" (EV-63 registered and now manifest-bound). Remaining: ENGINEERING ingestion + non-empty validation.
- **P3-03**: removed "STATIC 扩0x9BF1FA分支…" (full chain recovered t082, C-067). Remaining: fh loader write-side + slot3 variants (both genuinely open) + ENGINEERING tests.
- **P3-06**: removed the halfWidth audit task (complete per F3, incl. 0x964074). Now "无静态残项…实现按调用语境取半宽".
- **P3-14**: removed "STATIC 展开0x9BFB52端点/0x9BCC9A的返回门" (0x9BFB52 recovered, C-070). Remaining: RUNTIME rope-record hint tension dump; ladder/rope fork stays on P3-13.
- **P4-05**: removed "读 0x53E95D/0x9BC89F/0x9BC992 三个重绑体" (recovered t082, EV-43/46/47). Now "无（…Camera 顺序见 P4-07/G10）".
- **P3-15**: removed the completed "0xCF opcode 注册" (C-066/EV-52); kept the genuinely-open **0x6A0ADF 起身/取消链**.
- Preserved per instructions: P4-06 Camera residual, P3-13 ladder/rope fork, P3-15 stand-up chain, and all runtime dependencies. No stage upgraded to STAGE-READY; G38/G40/G41 remain PARTIAL-STATIC.

### F5 — Readiness report timeline & stale conclusions — FIXED

- Timeline corrected against git history (row counts recomputed via `git show` at each commit, independently re-verified by the reviewer): t080 start `e676ab0a` = 47/32/41; t080 end `3b7b987c` = **60/41/41**; t081 end `e137fc19` = **60/42/41** (EV-42 split); t082 end `db4d2261` = 77/63/41. The report previously attributed t081's 42nd evidence to t080.
- Stale-conclusion sweep: the §0 "unverified leftovers" list no longer cites 0x9BF1FA/0xA4FC6F (closed t082 — only shoe +0x198/four DEC slots remain); the fh census reads 2283 with the 2154 correction; the P3 halfWidth row reads 23×1/1×2; report header and a t083 memo record this round's scope; RE-READY set enumerated (16 rows, set-verified); NOT STAGE-READY retained.

### F6 — G38/C-055 vs C-062 cross-map semantics — FIXED

- C-055 now states: arg7=0 on the 0x9507F0 path ⇒ hint copy and 0x9BC89F/0x9BC992 projection snap **SKIPPED**, hint fields cleared (precise semantics per C-062: `[M+0x134]=0`, `[M+0x130]=7` stale-eax artifact); immediate rebind only for arg7≠0 callers; C-062 is the authority and the correction lineage is explicit. Verified PortalRecord / Y−10 / bounds clamps / velocity-reset conclusions unchanged.
- EV-36's instruction text and interpretation corrected (was "foothold hint copy … from [userfield+0x1C/+0x20]" — the t080 arg-misread); re-verified this round from 0x950900–0x950980 (`xor eax,eax; push eax` = a7=0 first push, etc.).
- C-063 qualified: the projection pair executes **only** for arg7≠0 callers.
- t080 `G38-PORTAL-ARRIVAL.md` §2/§3 annotated with t082 CORRECTION blocks (history retained, current semantics unambiguous); C-062's movzx anchor precision fixed (movzx @0x98CFEF, store @0x98CFF2 — reviewer finding #5).
- Readiness report P4 section already carried the t082 correction; matrix P4-04/P4-06 sync verified.

## 4. FSDB Manifest & Hash Verification

See F1 above; manifest artifact `forensics/T083-FSDB-MANIFEST.txt` (23 files, 2311 records, per-file SHA-256, deterministic ordering/encoding, self-identity `MANIFEST-SHA256 ac792643…`, EV-63 bound to full-file hash `1a6e488d…`). The independent reviewer reproduced every hash, size, count, the census, and both hashes with **0 differences**, and verified the t082 binding (directory + EXE hash) as accurately-described history via `git show db4d2261`.

## 5. Rope Endpoint Final Ruling

Corrected semantics CONFIRMED by two independent decodes (lead re-verification + reviewer from-scratch disassembly):

| field | meaning | clamp |
|---|---|---|
| rope+0x10 | y-min (top) | `y < top` → `top−5` if `uf≠0`, else re-read top (via re-decrypted handle) |
| rope+0x14 | y-max (bottom) | key>0 ∧ `y > bottom` → `bottom+1` |
| exit | — | `vt+0x14(M,0,0,0)`, three `push ebx` @0x9D8206/07/0D |

Corroboration: 0xA4FC6F containment requires the query y-range inside `[[rec+0x10],[rec+0x14]]`; FSDB 16/16 rope records have y1<y2. Slot naming remains grade-B DERIVED pending a loader-side write read (per C-072) — not upgraded.

## 6. HalfWidth Full Call-Site Census

24 direct E8 sites (sorted): 0x546803, 0x54709B, 0x5BFEDA, 0x5CDC9C, 0x5CE033, 0x5CE496, 0x70D024, 0x7C3F5C, 0x7C439E, 0x7C484C, 0x9364D4, 0x9364FF, 0x93652A, 0x953236, 0x955498, 0x963D72, 0x964074, 0x9640E7, 0x9641B9, 0x977F52, 0x97A2B9, 0x97A32E, 0x9C6B68, 0x9CC207.

| halfWidth | count | sites |
|---|---|---|
| 1 — direct `push 1` | 19 | all above except the two rows below (incl. portal 0x963D72, teleport-apply 0x955498, landing 0x9CC207; at 0x955498 the literal 1 is the leftover abs() argument slot) |
| 1 — register `edi=1` (`push 1; pop edi; push edi`) | 4 | 0x70D024, 0x9364D4, 0x9364FF, 0x93652A |
| 2 — direct `push 2` | 1 | 0x9C6B68 |
| dynamic / undecodable | 0 | — |

Full per-site windows + method + cross-check notes: `forensics/T083-A4F6F1-CALLSITE-AUDIT.txt` (regenerable via `research/scripts/t083_a4f6f1_audit.py`). P3-06 consequence: no PARTIAL site remains; implementation takes the width per call context (1, except the single 2).

## 7. Cross-map arg7 Final Semantics

Re-verified from 0x950900–0x950980 and 0x9BC622–0x9BC89C (lead + reviewer):

- 7-arg push order a7..a1 with **a7=0** (`xor eax,eax; push eax` first) and a6=`[user+0x3C0]`; a3=Y−10; a1=1; `call [edx+4]` (slot m1 = 0x9BC622, `ret 0x1C`).
- Inside 0x9BC622: clamps [M+0x138..0x144] → encrypted setters M+0x20/+0x38/+0x50/+0x68; `[M+0x114]=a7`; `[M+0x110]=a7` installed only when `vt0([M+0x14])≠7`; `cmp [M+0x110],0; je 0x9BC72B` **skips** the hint copy (`[M+0x130/0x134] ← [a7+0x1C/+0x20]`) and both projection calls; the skip path writes `[M+0x130]=7` (stale-eax artifact) / `[M+0x134]=0`.
- Distinctions enforced in the ledgers: same-map = clear-ctx + notify + physics-loop rebuild (C-061); cross-map = fresh move object, arg7=0, no immediate rebind (C-062/C-065); arg7≠0 callers (e.g. 0x98D052 pushing a 0x517DA8 lookup result — reviewer-verified) get the immediate hint copy + projection snap (C-063).
- Algorithm-body-recovery conclusions were NOT retracted — only the conflation of "algorithm exists" with "this path executes it".

## 8. Claims / Evidence / Gaps Sync Result

- Counts unchanged by design: **77 Claims / 63 Evidence / 41 Gaps** (no adds, no closes, no status upgrades). Gap distribution unchanged: CLOSED-STATIC 14 / PARTIAL-STATIC 12 / OPEN-STATIC 9 / OPEN-RUNTIME 4 / BLOCKED 1 / SUPERSEDED 1.
- Corrected rows: claims C-055, C-056, C-062 (anchor precision), C-063, C-068, C-073; evidence EV-36, EV-37, EV-57, EV-63. All IDs preserved.
- Bidirectional reference integrity re-verified (validator checks 6/8/9 + reviewer's independent scan: zero dangling references in any direction).
- Clean-room deliverables regenerated via the official generator (`generate_cleanroom_deliverables.py`); CHECK 15 sync passes (byte-identical copies).

## 9. Requirement Matrix Revision Record

Rows touched: P0-09, P3-03, P3-06, P3-13, P3-14, P3-15, P4-05, P4-06 (the first five per F4; P3-13/P4-06 per reviewer findings #2/#3 — stale/partially-covered next-work targets cleaned to the genuinely-open remainders). 65 rows × 20 columns; readiness distribution RE-READY 16 / RE-GAP-STATIC 27 / PRODUCT-READY 15 / DESIGN-DECISION 7 (RE-READY set unchanged from t082: P0-04 P0-08 P0-09 P0-13 P1-07 P1-08 P2-02 P3-01 P3-03 P3-06 P3-07 P3-09 P3-14 P3-16 P4-04 P4-05).

## 10. Readiness Report Revision Record

Header (t083 round declaration), §0 timeline (t080 end = 60/41; t081 = 60/42), §0 leftover list (only shoe +0.198 defaults + four DEC slots remain un-verified of the design-draft list), §P0 fh census (2283 + manifest), §P3 halfWidth row (23×1/1×2), new t083 memo (scope + RE-READY set + NOT STAGE-READY). All historical statements carry their round context.

## 11. Independent Reviewer Report

Truly independent sub-agent (fresh context, own temp dir `Temp/opencode/t083-reviewer/`, own harness `rv*.py`, own hashes; repo read-only; t083 outputs not trusted as inputs). Full report committed verbatim at `forensics/T083-REVIEWER-REPORT.md`. Verdicts:

| Review | Verdict |
|---|---|
| A — EV-63 / FSDB manifest | **ACCEPT** |
| B — Rope endpoint semantics | **ACCEPT** |
| C — halfWidth audit | **ACCEPT** |
| D — Cross-map arg7 | **ACCEPT** |
| E — Readiness/matrix | **ACCEPT-WITH-CORRECTIONS** |

Lead responses to all 5 discrepancy-register items: #1 EV-63 wording ("per-map |dy|>|dx| count max 248") — applied; #2 P3-13 stale targets — applied; #3 P4-06 partial coverage — applied (next-work now "layers above the wrappers + scene-entry init + Camera order"); #4 C-055 "hints zeroed" looseness — applied (precise C-062 semantics referenced); #5 C-062 movzx anchor — applied (0x98CFEF/0x98CFF2). No unresolved objections remain.

## 12. Validator Result

`python research/scripts/validate_reverse_engineering.py` → **PASS (0 errors, 0 warnings)** (log: `forensics/T083-VALIDATOR-LOG.txt`), now including the new CHECK 17 family: 17a EVID-SHA-MATCH (evidence hash must equal the actual source file — verified for all 58 locally-present single-hash rows incl. EV-63→manifest), 17b LABEL-REGRESSION (F1/F2/F3/F6 stale strings blocked in active stores with correction-marker exemptions), 17c MATRIX-STALE-TASK (completed-work markers blocked in RE-READY next-work), 17d CALLSITE-SUM (census total must equal class-count sum; C-073/EV-57 agreement; explicit zero-dynamic/undecodable line), 17e CORRECTION-CHAIN (C-056↔C-072 and C-055↔C-062 linkages; EV-63↔manifest binding + manifest self-identity). No existing check was weakened.

## 13. Unit Test Result

`python -m unittest research.tests.test_validate_reverse_engineering` → **44/44 OK** (log: `forensics/T083-UNITTEST-LOG.txt`; 37 t082-baseline tests all retained and passing + 7 new: manifest-hash mismatch, wrong source binding, broken correction chain, matrix stale next-work, census sum mismatch, stale-count regression, stale-endpoint-label regression). Fixture upgraded to carry real file hashes (CHECK 17a-compatible).

## 14. Clean-Room / Diff Scope

Regenerated deliverables: `clean-room/{CLAIM-CONSISTENCY-REGISTER,GAP-REGISTER,ISSUE-CROSSWALK,EVIDENCE-INDEX,RETRACTED-CLAIMS}.csv` + gap-stats auto-block. Changed files are confined to `research/` (source-of-truth CSVs, stage-readiness deliverables, forensics, scripts, tests); **`components/` untouched** (Frozen ABI pin passes), **LoomRealm submodule untouched**, **`content/` untouched** (read-only input to the manifest), `.work/` untouched. Full diff summary in the commit.

## 15. Remaining Open Items (unchanged by design)

1. G10/G38-E Camera refresh chain; P4-06 upper layers above the 0x9BC622 wrappers + scene-entry init.
2. G41 ladder/rope walk-side fork (0x517DA8/0x9BCC9A candidates; 0x9BCA6F l/uf consumers).
3. G41 rope-record hint tension — runtime dump [M+0x130/0x134] at grab.
4. G41 seat stand-up chain 0x6A0ADF.
5. G40 fh loader write-side direct proof; slot3 variants; shoe +0x198 defaults + four DEC slots.
6. G38-D' 0x81→0x97EBC9 handler-vtable registration (OPEN-STATIC).
7. G24/G27 runtime single-value dump (bp 0x666F77); G36/G37/G39 dynamic layer capture; P4-01 hit-box EV.
8. P0-01 map.info allowlist data EV registration.

## 16. Final Acceptance Decision

All F1–F6 defects are actually fixed (not papered over — two were replaced by stronger, machine-reproducible results); raw evidence, sources and hashes agree; no contradictory active conclusions remain; the call-site census is reproducible (validator-enforced); the matrix carries no stale next-work; the readiness timeline is git-verified; clean-room is in sync; validator PASS; 44/44 tests pass; the independent reviewer raised no unresolved material objection (all findings applied). Stage status remains **NOT STAGE-READY**.

**Decision: ACCEPT-WITH-CORRECTIONS → corrections applied in-round → final state ACCEPT** (the round's own acceptance bar: F1–F6 fixed with evidence-supported handling, reviewer objections resolved before commit).
