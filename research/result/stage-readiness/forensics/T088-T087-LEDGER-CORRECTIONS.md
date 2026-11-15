# T088 — T087 Ledger Corrections (WP0) + Integration Record

Round: T088 (2026-11-15). Applied by `research/scripts/t088_wp0_ledger_fixes.py`
(one-shot script, audit-preserved). All corrections re-verified against raw
bytes before application; no forensic file was regenerated without content
change.

## F1 — EV-92 (G17 BOAT 0x98 state machine) routing fix

**Finding (T087 acceptance):** the t087-reviewer corrected the 0x98 grammar in
C-105/G17/forensics, but `evidence.csv` EV-92 retained the pre-correction
routing (`state 2|5 → 0x56512A`, missing state 0, wrong state-4 wording).

**Fix applied:** EV-92 `instruction_or_data` now carries the byte-accurate
routing (signed compares; only state<0 or state>6 no-op):
- states 0|1|6 → 0x564FBE when `[this+0x774]==0`
- states 2|5 → 0x564E52 when `[this+0x774]==0`
- states 3|4 → 0x56512A when `[this+0x774]==1 && flag==1`, else 0x564E52
  when `[this+0x774]==0`

Consistency: C-105, G17 verified_scope and forensics/T087-G17-BOAT-0x97-0x98.txt
§3 were already correct — EV-92 is now aligned with them. The original
forensic file and its hash are unchanged (its content was correct; only the
ledger copy was stale). A unit test (`test_t088_round.py::
test_ev92_routing_consistent`) pins the corrected routing and forbids the
stale strings from re-entering Evidence metadata.

## F2 — P2-01 readiness enum fix

**Finding:** P2-01 carried `readiness = ORIGINAL-STATIC-PROVEN` — a
report-level evidence label, not one of the matrix's requirement-readiness
values (RE-GAP-STATIC / RE-READY / PRODUCT-READY / DESIGN-DECISION).

**Fix applied:** `readiness = PRODUCT-READY` (the value P2-01 held before
T087, consistent with its `product_alternative_authorization` = Frozen ABI
§5.2 formal product definition and `blocks_acceptance=否`). The
report-level classification is preserved inside
`evidence_grade_and_type` ("报告级标签 ORIGINAL-STATIC-PROVEN 保留于此说明列").
C-103/EV-89/EV-90 A-grade transform evidence unchanged; `blocks_acceptance`
unchanged (否). No new readiness enum was introduced.

## F3 — P4-07 refresh + writer-set wording

**Finding:** P4-07 still listed T087-completed tasks
(`[fieldctx+0xD4]` identity, `[0xBDD838]` creation point) and a
STATIC-ONLY-prohibited runtime capture suggestion; P2-01/P2-05/P2-06 said
"全部 7 写入点" without the direct-slot family qualifier.

**Fix applied:**
- P4-07 `claim_ids/evidence_ids/evidence_grade_and_type/unproven/
  can_static_continue_or_runtime/minimum_next_work` rewritten around the
  T088 residuals: focus-writer target semantics (`[[user+0xF28]+0x14]`
  writer census), cross-map input suppression, E2/E3 message-pump phase
  interleaving (statically undecidable → product contract). No runtime
  task remains. P4-07 stays DESIGN-DECISION with `blocks_acceptance=是`.
- P2-01/P2-05/P2-06 writer-set wording now reads: **7 个 0x5CA91A 漏斗调用点
  + 直接 [vt+0x90] 写入家族（39 候选已逐项分类）**, with the T088 trigger
  re-classification (#6/#7 = cursor mode) recorded in the evidence
  descriptions.

## Integration additions (same script run)

- Claims: C-106 (shared-singleton closure), C-107 (writer #6/#7 trigger
  re-classification), C-108 (Shape2D Set semantics), C-109 (focus-writer
  family). C-103/C-028 revised with correction-context notes.
- Evidence: EV-93..EV-97 (canonical LF hashes; companion-file hashes inside
  interpretation columns per the T086.1/T087 convention).
- Gaps: G10 verified/unresolved scopes rewritten; status stays
  PARTIAL-STATIC (the focus-writer target semantics and 25 INCONCLUSIVE
  census sites keep it open).
- Matrix: P2-05/P2-06/P4-07 refreshed as above.

Post-fix gates (this run): Validator PASS (0 errors / 0 warnings); counts
109/41/97.


## Review closure (post-acceptance)

The independent reviewer (forensics/T088-REVIEWER-INDEPENDENT.md, blind-first
protocol) returned ACCEPT-WITH-CORRECTIONS; all 7 corrections were re-verified
from raw bytes and applied (see the closure record in that file). The two
classification-count changes (C1: 2/12/0/25) and the C7 withdrawal of the
"no imm32 family-table reference" draft claim are the only substantive edits;
F1/F2/F3 as described above are unaffected.
