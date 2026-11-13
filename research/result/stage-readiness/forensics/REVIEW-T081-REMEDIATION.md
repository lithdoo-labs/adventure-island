# REVIEW-T081-REMEDIATION — Evidence Integrity Reviewer verification of the t081 remediation patch

- **Reviewer**: CMS079 Evidence Integrity Reviewer t081 (same session as `PHASE1-DIAGNOSIS.md`, reviewer-t081 temp dir).
- **Date**: 2026-11-14. **Tree audited**: working tree at `C:\Users\lithd\Documents\GitHub\adventure-island`, uncommitted t081 remediation on top of `3b7b987cc0f56e321511545af4b3b4ad47aabc9e` (t080).
- **Method**: every check below was executed against the actual files (reads, repo-wide greps, CSV parsing, validator run, 34-test run, one live mutation test with byte-verified restore). Binaries were re-hashed in Phase 1 this session; EV-37's window was independently disassembled from raw bytes in Phase 1 (`53 53 89 46 48 8B 06 53 8B CE FF 50 14` at fileOffset 0x5D8206).

## Check table

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 1 | **F1 — EV-37 final text matches the bytes** | **PASS** | `evidence.csv` L38 now reads `exit vtable+0x14(move,0,0,0) (three push ebx @0x9D8206/07/0D)` — matches this reviewer's independent byte decode exactly. Repo-wide grep for the superseded pattern returns only: validator constant (`validate_reverse_engineering.py` L594), test fixtures (`test_validate_reverse_engineering.py` L449/452/463 — regression negatives), `REVIEW-CP2-ADVERSARIAL.md` L64/L115 (archived audit record), and `G40-G41-MOVEMENT.md` L18 (corrected text quoting the old string as history). No ACTIVE store carries it. Three-way consistency C-056 (`[move-vt+0x14](move,0,0,0)`) / EV-37 / G40 record §1+§9 all agree. |
| 2 | **F2 — matrix sources + grades (21 rows)** | **PASS** (1 residual, see D-1) | Programmatic: 65 rows / 20 cols intact; the 21 EV-33..41-citing rows ∩ stale-phrase rows = **empty**; RE-READY rows with stale phrase = **none**; RE-READY rows with zero evidence refs = **none**. Spot-checked all 8 required rows plus the rest: P0-05, P1-02, P1-05, P1-09 (cites EV-34/42), P3-06, P4-04, P4-05, P4-07 — every grade is scoped (proven sub-behavior named, residual named), no blanket A, no readiness flips except P4-04; completed steps removed from next-work (P1-02/03/04, P1-05, P1-06, P1-09, P0-06/07, P4-04, P4-05). P1-10 deliberately NOT upgraded (`B+D；比较器本体/等键策略未证…t080 增加出参约束（C-053）而非闭合`) — boundary rule respected. Unrelated rows untouched (verified cell-by-cell against the Phase-1 snapshot for 27 non-target rows). |
| 3 | **F2 — P4-04 boundary consistency** | **PASS** | L61: `required_original_fact` rewritten to the bounded coordinate-commit sub-behavior with explicit deferral of Foothold/Camera/full-reset to P4-05/06/07; grade `A；t080 指令级（限界子行为：跨图坐标提交链全参/夹取/Y−10/速度清零，EV-36）`; `blocks_acceptance` = `否（限界子行为已就绪；P4 阶段整体验收仍被 P4-05/06/07 阻塞）`; `unproven` keeps the 0x81 dispatch-table byte-binding residual disclosed; `can_static`/`min_next` now only the optional 0x97EBC9 registration-table trace. All four Phase-1 required adjustments applied; RE-READY retained under Option A exactly as adjudicated. |
| 4 | **F3 — readiness report** | **PASS** | End-to-end re-read. §0 L9 baseline accounting now three-era correct (clean-room 47/32/**35** → t080 start 47/32/**41** → t080 end **60/41/41**) — matches this reviewer's git-verified numbers (`ce528d4b`=35 gaps, `d60c7b20`+6→41, parent `e676ab0a`=41). L16 binaries-missing claim corrected; L13 draft-chain status scoped (verified vs remaining); §1 P4 row + §P4 bullets rewritten to "坐标写入子行为已取得新的直接静态证据（C-054/EV-35 同图、C-055/EV-36 跨图）" with Foothold/reset/Camera/opcode residuals kept open; P3 table rows 斜坡/落地/抓绳/坐下/鞋owner all updated with t080-proven vs open split; §2 items 2/6 rewritten; the old "t080 插入" patch note reduced to a historical memo (L84) with body text edited in place. Stale-pattern sweep (`缺权威 C/EV|尚未独立建条|非本轮|35 Gap 基线|需核证|即便核证|没有原始 EXE|t080 插入`) → only the correct three-era "35 Gap" hit remains. `NOT STAGE-READY` (L7) and P4 `未就绪` (L26) preserved. |
| 5 | **F4 — EV-34 hashes + args; EV-42** | **PASS** | EV-34 (L35): EXE-only `source_file`, full 64-hex EXE sha, EXE-only addresses, corrected labels `arg2=x-int (property id 0x331), arg3=y-int (id 0x332), arg4-6=0, arg7=V{VT_UNKNOWN,layer} packed via 0x411FE1, arg8=V{VT_ERROR,missing}`, `arg1=OUT (value determined by the runtime slot25 binding, NOT statically closed)` — matches Phase-1 spec; interpretation cross-references EV-42. EV-42 (L43): Gr2D-only source, full 64-hex DLL sha, vtable 40 slots + intmap + slot25 dword 0x5042D1A4 + body 0x50403FBE, constraint-not-closed interpretation, `claim_id=C-053`. 9 columns each; sha-field audit: only legitimate sentinels remain (`(in-repo csv)`, `(multi-file)`); no ellipsis hash anywhere in evidence.csv. |
| 6 | **Claim ↔ Evidence refs** | **PASS** | C-053 `evidence_refs` = `EV-34;EV-42`; C-053 claim text unchanged (verified against Phase-1 snapshot); only C-053 references EV-34; EV-42 referenced by no other claim; matrix P1-09/P1-10 refs remain valid; EVID-DUP/EVID-CLAIM/EVID-REF all pass. Clean-room mirrors `EVIDENCE-INDEX.csv`≡`evidence.csv` and `CLAIM-CONSISTENCY-REGISTER.csv`≡`claims.csv` (SHA-256 identical pairs, re-verified post-patch). Ledger: **60 claims / 42 evidence / 41 gaps**. |
| 7 | **Validator + tests** | **PASS** | `python research/scripts/validate_reverse_engineering.py` → **PASS, 0 errors 0 warnings** (Claims 60 / Gaps 41 / Evidence 42). `python -m unittest discover -s research/tests -q` → **Ran 34 tests, OK**. CHECK 16 code read: 16a rejects ellipsis/short hashes + compound-file 1:1 mapping; 16b scans only 7 explicitly-listed ACTIVE files with a context-bounded correction-marker exemption (not blanket; forensics archives are outside the scan set); 16c D-regex `D(?![A-Za-z])` correctly does not fire on `DATA`; boundary-disclosure rule (`限界`) enforced for RE-READY+blocks=是; 16d report stale-pattern + required-marker checks. `git diff` of the validator is **purely additive (+190 lines, zero deletions)** — no existing check weakened. |
| 8 | **Gap-status integrity** | **PASS** | 41 gaps; status distribution unchanged and correct (CLOSED-STATIC 14 / PARTIAL-STATIC 12 / OPEN-STATIC 9 / OPEN-RUNTIME 4 / BLOCKED 1 / SUPERSEDED 1). G24 = OPEN-RUNTIME, G27 = PARTIAL-STATIC, G38/G41 = PARTIAL-STATIC — none improperly closed; gaps.csv not modified at all this round. Retracted-claim history intact (CHECK 12 passes). D1–D10 correction history preserved: REVIEW-CP1/CP2 archives unmodified (absent from git status); G36/G38/G39/G40-G41 records untouched; only R13 §6 labels fixed as requested. |
| 9 | **Frozen ABI + submodule** | **PASS** | Validator CHECK 13 passes (no ABI-MODIFIED). `loom-realm` submodule at `93648192323bf5f57996b7b54cbae641d8a53fdb` — unchanged from t080. `git diff --stat -- . ':!research'` = 0 lines. |
| 10 | **Git diff scope** | **PASS** | `git status --short`: 10 modified files, all under `research/` — source-of-truth ×2 (claims/evidence only; gaps untouched), stage-readiness ×4 (report, matrix, INDEPENDENT-STATIC-REVIEW, forensics/R13), clean-room generated ×2, validator, tests. No staged files, no binaries, nothing outside authorized paths. |

## Additional verifications

- **The 11 RE-READY rewrites did not inflate**: current RE-READY set = {P0-04, P0-08, P0-13, P1-07, P1-08, P2-02, P3-01, P3-07, P3-09, P3-16, P4-04}; every grade names its actual backing EV and matches that EV's ledger grade (EV-01/02/21/22/26/27 are all A-grade; P3-09 honestly keeps `B+DATA` rather than claiming A). No readiness was added; three were removed (see below).
- **The 3 downgrades are honest and disclosed**: P0-01/P0-09 (FSDB data census with **no** registered EV) and P4-01 (trigger chain proven via EV-35 mention, but the x±20/y±50 hitbox constants have no EV in the ledger — verified by grep, `0x954B58`/`0x71B44D` appear in no claim/evidence row). Each carries an explicit `unproven` disclosure and a path back to RE-READY; readiness report §P0 (L30) and §P4 (L74) carry matching "t081 边界修订" notes.
- **INDEPENDENT-STATIC-REVIEW.md t081 addendum** (L38): the overstated "已全部应用" is corrected with a precise account of which D-fixes (EV-35 offsets, EV-37 args, R13 verdict-table labels) only landed in t081 — accurate; references this report.
- **R13-G27-OUT-SEMANTICS.md §6** (L63): verdict-table labels now `(x-int [0x331], y-int [0x332], 0,0,0, V{layer}, V{missing})` with `labels corrected t081 per reviewer D7` — matches the corrected body §3; the historical label text survives only in correction-context (L44) and the CP2 archive.

## Manual mutation test (negative control)

Mutated `evidence.csv` EV-37 back to `exit vtable+0x14(move,0,rope,0)` (backup taken first):

```
RESULT: FAIL (3 errors)
  [FAIL] CLEANROOM-SYNC EVIDENCE-INDEX.csv differs from source-of-truth/evidence.csv
  [FAIL] ARGS-AGREE   EV-37 instruction text no longer carries the corrected (move,0,0,0) climb-exit args
  [FAIL] STALE-ARGS   evidence.csv: superseded climb-exit args "(move,0,rope,0)" present as an ACTIVE conclusion
```

Restored from backup (SHA-256 identical to pre-mutation), validator re-run → **PASS (0 errors, 0 warnings)**. The regression net catches the F1 class redundantly (ledger scan + claim↔evidence agreement + mirror sync).

## Discrepancies found

- **D-1 (required, trivial) — P1-13 `minimum_next_work` retains a completed static step**: cell still says `STATIC 0x667EB1→0x66A8D5目标函数分支`, but that flow-binding branch was instruction-proven this round (C-052/EV-33 covers 0x667E7E–0x667EB1) and the same row's `can_static_continue_or_runtime` already says `RUNTIME 随 G36/G39 捕获；STATIC 仅余 flow-rx 消费者` — the two cells contradict each other. Fix: change `minimum_next_work` to e.g. `STATIC 仅余 flow-rx 消费者定位；动画层随 G36/G39 运行时捕获`. (Same fix class the lead applied to 13 other rows; this one cell was missed.)
- **D-2 (optional) — P3-15 next-work wording**: `重查0x9658CC/0x6A0ADF的写入与取消` / `追0x9658CC/0x6A0ADF及回包状态` — 0x9658CC's write chain is complete (EV-38); the remaining work is 0x6A0ADF cancel/stand-up + 0xCF registration. Defensible as path context (grade/unproven cells fence it correctly), but dropping `0x9658CC…写入` would be cleaner.
- **D-3 (optional, pre-existing) — readiness report §P0 RE-READY list (L30)** still lists "Obj 的 oS/l0/l1/l2/z/f/zM（各有权威 EV 支撑）" while the covering matrix row P0-05 is RE-GAP-STATIC (flow subset); suggest scoping to "Obj 基础键字段（flow 子集另列）". Not a t081 regression (same wording pre-existed); flagged for completeness.
- **D-4 (informational)** — `ARGS_AUDIT_EXEMPT_FILES` (validator L599) is defined but unused; the actual STALE-ARGS scan is already bounded to 7 named ACTIVE files. Dead constant, no integrity impact. (Also: the lead's handoff said "11 more RE-READY rows" but listed 10 ids — the files are correct; 11 = the 10 rewrites + P4-04 which was already inside the 21-row set.)

## Overall verdict

**ACCEPT-WITH-CORRECTIONS** — all four acceptance finding classes (F1–F4) are correctly remediated in the actual files; ledger, matrix, report, mirrors, validator, tests, git scope, frozen ABI, submodule, and historical audit records all verify clean, and the mutation negative-control proves the regression net works. One trivial correction (D-1, single matrix cell) should land before commit; D-2/D-3 are optional polish. COMMIT-APPROVED after D-1.


---

## Lead-agent completion addendum (post-review corrections applied)

Reviewer verdict was ACCEPT-WITH-CORRECTIONS (COMMIT-APPROVED after one trivial cell fix). Applied after the review:

- **D-1 (required)**: P1-13 minimum_next_work updated to 'STATIC 仅余 flow-rx 消费者定位；动画层随 G36/G39 运行时捕获' (as reviewer suggested).
- **D-2 (nit)**: P3-15 minimum_next_work updated to 'STATIC 追 0x6A0ADF 取消链与 0xCF opcode 注册（写链已证 EV-38）'.
- **D-3 (nit)**: readiness report §P0 RE-READY list now scopes 'Obj 的 oS/l0/l1/l2/z/f/zM（基础字段；flow 子集另列 P0-05）'.
- **D-4 (nit)**: dead ARGS_AUDIT_EXEMPT_FILES constant removed from the validator (exemption semantics documented in comment; behavior unchanged).

Post-correction gates: validator PASS (0 errors / 0 warnings); 34/34 unit tests OK; ledger 60 claims / 42 evidence / 41 gaps; gaps.csv untouched this round; frozen ABI + LoomRealm pin unchanged.
