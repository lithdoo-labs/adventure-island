# VALIDATION-EXECUTION-LOG（验证执行日志）

日期：2026-11-13。分支：`audit/clean-room-reverse-engineering`。全部为真实执行捕获（未手工编辑数字）。
本版为独立复核（FAIL 判定）→ 定向修复后的**最终复验**记录；首轮执行历史见文末。

## 1. 隔离测试（最终）

命令：`python -m unittest discover -s research/tests -v`

```
Ran 24 tests in 3.307s
OK
```

测试清单（1 正面 + 23 负面，每项断言**具体错误代码**；fixture 经真实生成器构建于 tempfile.mkdtemp 临时目录，真实仓库零写入）：

| # | 测试 | 注入缺陷 | 期望错误码 |
|---|---|---|---|
| 01 | valid_repo_passes | 无（正面） | 退出码 0 |
| 02 | illegal_gap_status | WRONG-STATUS | GAP-STATUS |
| 03 | illegal_grade | A(joint) | CLAIM-GRADE |
| 04 | duplicate_claim | 重复 C-001 | CLAIM-DUP |
| 05 | duplicate_gap | 重复 G01 | GAP-DUP |
| 06 | csv_row_width | 缺列行 | CSV-WIDTH |
| 07 | slot_index_out_of_bounds | method_index=99 ≥ slots=50 | CSV-INDEX |
| 08 | closed_without_evidence | CLOSED 引用 EV-99 | EVID-REF |
| 09 | closed_vs_open_conflict | 视图 OPEN vs SoT CLOSED | GAP-VIEW-MISMATCH |
| 10 | stale_runtime_item | R-09 从运行时清单消失 | XFILE-STALE |
| 11 | broken_md_reference | missing-file.md | MD-REF |
| 12 | statistics_mismatch | 统计块 1→9 | STATS-MISMATCH |
| 13 | retracted_marked_verified | "slot45=ordered insert — VERIFIED" | RETRACTED-ACTIVE |
| 14 | unmapped_open_runtime | G03 失去 crosswalk 映射 | XWALK-UNMAPPED |
| 15 | frozen_abi_modified | ABI 文件被改写 | ABI-MODIFIED |
| 16 | missing_strict_schema | 删除严格 Schema CSV | CSV-STRICT-MISSING |
| 17 | missing_source_of_truth | 删除 evidence.csv | SOT-MISSING |
| 18 | crosswalk_dangling | R4-01 从 R4 CSV 消失 | XWALK-DANGLING |
| 19 | evidence_source_file_missing | bin/dummy.bin 删除 | EVID-FILE |
| 20 | gap_view_missing_row | 台账视图缺 G03 | GAP-VIEW-MISSING |
| 21 | assertive_retracted_claim_without_verified | "+0xB4=有序插入，比较器在 DLL 内"（无 VERIFIED，复核 P0-1 场景） | RETRACTED-ASSERTIVE |
| 22 | unbalanced_quote_swallowing_lines | 未闭合引号吞并后续行（复核 P1-1 场景） | CSV-QUOTE |
| 23 | cleanroom_copy_out_of_sync | clean-room 副本与权威源不一致 | CLEANROOM-SYNC |
| 24 | runtime_patch_placeholder_assertion | "运行时补丁的占位 RVA"宽距断言（复核 P0-2 场景） | RETRACTED-ASSERTIVE |

## 2. 全仓验证器（最终）

命令：`python research/scripts/validate_reverse_engineering.py`

```
=== validate_reverse_engineering.py (clean-room, fail-closed) ===
Repository: C:\Users\lithd\Documents\GitHub\adventure-island

CSV total: 421 (parsed 421, strict 7, legacy-width-issues 100)
MD scanned: 331
Open Issues rows: 9 | Runtime ids: 9
Claims: 47 | Gaps: 35 | Evidence: 32

ERRORS: 0
WARNINGS: 0

RESULT: PASS (0 errors, 0 warnings)
```

legacy-width-issues=100：task0xx 等历史原始转储的结构性问题，按 LEGACY_CSV_PREFIXES 显式豁免并计数上报（不静默跳过）。

## 3. 生成器（幂等复验）

命令：`python research/scripts/generate_cleanroom_deliverables.py`

```
gap stats block regenerated: {'PARTIAL-STATIC': 5, 'CLOSED-STATIC': 14, 'OPEN-STATIC': 9, 'OPEN-RUNTIME': 5, 'BLOCKED': 1, 'SUPERSEDED': 1} total=35
clean-room deliverables written to research/result/clean-room/ (claims=47 gaps=35 evidence=32 retracted=10)
```

生成后验证器复跑保持 PASS（统计块与 clean-room 副本与权威源同步，CLEANROOM-SYNC 校验通过）。

## 4. 首轮执行历史（含被复核推翻的状态，如实保留）

- 首轮（提交 ce528d4b 前）：20/20 测试 OK；验证器 PASS（0 错误 / 2 EXEMPT-STALE 警告）。
- 独立复核判定 **FAIL**：3 P0（SEC16 两处复活措辞、STATIC-CLOSURE L37 补丁表残留、验证器假阴性）+ 3 P1。
- 定向修复（唯一一轮，见 INDEPENDENT-REVIEW-REPORT.md §二）后：验证器曾在修复过程中真实检出 10 项错误
  （3 处 Tier-B 存活措辞 + 4 处同步行尾差异 + 引号问题），逐一修复后抵达上述最终全绿状态。
