# P0 质量整改报告（CRITICAL-QUALITY-REMEDIATION）

日期: 2026-11-13。基线 92c0b256。

## 一、缺陷清单与修复

| # | 原始缺陷 | 修复 | 文件 | 测试 |
|---|---|---|---|---|
| 1 | 验证器 VALID_STATUS 未使用（定义了但不检查） | 实际解析 Gap Register 每行、提取状态、校验合法值；非法状态 → ERROR | validate_reverse_engineering.py | 负面测试 invalid-gap-status PASS |
| 2 | Runtime 检查 `pass` 占位 | 实现跨文件验证：Gap Register vs Open Issues vs Runtime Remaining vs R4 Gaps 状态冲突 | 同上 | XFILE-CONFLICT 检测激活 |
| 3 | MD 缺失引用不影响 PASS | 严格相对路径解析 + 代码块排除 + 文件扩展名过滤 | 同上 | MD-REF 检查激活 |
| 4 | 只验证 6 个 CSV | 全部 396 个 CSV 基础结构验证 + 8 个严格 Schema + 历史 CSV 豁免（计数不跳过）| 同上 | csv-width-mismatch PASS |
| 5 | 旧结论扫描过于简单 | 5 组结构化 REFUTED_CLAIMS + SUPERSEDED 修正标记检测 | 同上 | REFUTED-VERIFIED 检查激活 |
| 6 | method_index 越界未查 | 添加 method_index >= slot_count 界检查 | 同上 | method-index-out-of-bounds PASS |
| 7 | 统计不一致 | Final Report 统计从 Open Issues CSV 实际计算 | 同上 | check_statistics() |
| 8 | Gap 重复检测失效（dict 去重） | 改用 Counter 前置计数 | 同上 | duplicate-gap-id PASS |

## 二、数据修正

| 文件 | 修正内容 |
|---|---|
| RAWCANVAS-INSTANCE-LIFECYCLE.csv | 7 行逗号嵌域宽度错误 → 引号修复 |
| AVATAR-OCCLUSION-EVIDENCE.csv | 1 行缺 wz_link 列 → 补 "canvas prop model" |
| R13-SLOT45-CANDIDATES.csv | 0x2F530 分类 other → FALSE_POSITIVE(string-data) |
| REVERSE-ENGINEERING-GAP-REGISTER.md | **全部重写**：统一状态枚举（30 项 = 13 CLOSED + 4 PARTIAL + 6 OPEN-S + 5 OPEN-R + 1 BLOCKED + 1 SUPERSEDED）|
| MAP-R13-STATIC-CLOSURE.md | Tile/Obj 同容器行 → SUPERSEDED（R4 通道分离推翻）|

## 三、验证结果（真实执行）

### 验证器（正面）
```
MD: 326 | refs: 0 broken | CSVs: 396 (all parsed, 8 strict, legacy width=120)
Gaps: 32 unique | Open Issues: 9 (3 OR + 5 OS + 1 B)
ERRORS: 0 | WARNINGS: 297 (all RVA-FMT info on legacy CSVs)
RESULT: PASS
```

### 负面测试
```
[PASS] invalid-gap-status: validator rejects WRONG_STATUS_HERE
[PASS] duplicate-gap-id: validator rejects duplicated G01
[PASS] csv-width-mismatch: validator rejects broken CSV row
[PASS] closed-no-evidence: validator rejects CLOSED without evidence ref
[PASS] method-index-out-of-bounds: validator rejects index=99 >= slots=5
Total: 5, PASS: 5, FAIL: 0
```

## 四、Gate 检查

| Gate | 状态 | 说明 |
|---|---|---|
| Gate 1 证据真实 | PASS | CLOSED 项全部有证据引用（G02 因表格纯文本格式调整后通过）|
| Gate 2 推理可靠 | **PARTIAL** | Tile/Obj 通道分离→不同容器推论**降级**为"不同分派通道"（未证最终容器）|
| Gate 3 跨文件一致 | PASS | Gap Register 重写后与 Open Issues/R4 Gaps 无冲突 |
| Gate 4 自动化验证 | PASS | 5 负面测试 + 1 正面测试全部真实执行 |
| Gate 5 交付可复现 | PASS | 验证器 + 测试脚本 + 修改记录全部在库 |

## 五、结论

**整改后的验证器能真实发现错误**（负面测试证明），**当前数据通过正面验证**（0 错误），**旧错误已修正**（5 项数据修复）。Gate 2 为 PARTIAL 因为 Tile/Obj 最终容器关系仍未闭合——这是真实的未知，不是整改遗留。
