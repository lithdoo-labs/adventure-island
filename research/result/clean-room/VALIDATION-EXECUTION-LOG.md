# VALIDATION-EXECUTION-LOG（验证执行日志）

日期：2026-11-13。分支：`audit/clean-room-reverse-engineering`。全部为真实执行捕获（未手工编辑数字）。

## 1. 隔离测试

命令：`python -m unittest discover -s research/tests -v`

```
Ran 20 tests in 1.940s
OK
```

测试清单（1 正面 + 19 负面，每项断言**具体错误代码**而非仅退出码；全部操作临时目录 fixture，不触碰真实仓库）：

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

## 2. 全仓验证器

命令：`python research/scripts/validate_reverse_engineering.py`

```
=== validate_reverse_engineering.py (clean-room, fail-closed) ===
Repository: C:\Users\lithd\Documents\GitHub\adventure-island

CSV total: 421 (parsed 421, strict 7, legacy-width-issues 100)
MD scanned: 330
Open Issues rows: 9 | Runtime ids: 9
Claims: 47 | Gaps: 35 | Evidence: 32

ERRORS: 0
WARNINGS: 0

RESULT: PASS (0 errors, 0 warnings)
```

legacy-width-issues=100：task0xx 等历史原始转储的结构性问题，按 LEGACY_CSV_PREFIXES 显式豁免并计数上报（不静默跳过）。

## 3. 生成器

命令：`python research/scripts/generate_cleanroom_deliverables.py`

```
gap stats block regenerated: {'PARTIAL-STATIC': 5, 'CLOSED-STATIC': 14, 'OPEN-STATIC': 9, 'OPEN-RUNTIME': 5, 'BLOCKED': 1, 'SUPERSEDED': 1} total=35
clean-room deliverables written to research/result/clean-room/ (claims=47 gaps=35 evidence=32 retracted=10)
```

## 4. 回归顺序

生成器 → 验证器 → 测试 → 验证器（复跑）全部 PASS；期间验证器曾捕获本报告数据中的 4 处真实缺陷（CSV 宽度/引号、G09 未映射、归档段落活性措辞 2 处），均已修复后复验。
