# research/source-of-truth/ — 唯一权威研究数据基线

建立：2026-11-13（clean-room 审计轮）。此前数百份 Markdown 各自维护的统计与状态自此收敛到本目录。

## 文件与角色

| 文件 | 角色 | 修改规则 |
|---|---|---|
| `claims.csv` | 全部逆向声明（47 条）：status ∈ 7 值枚举，grade ∈ A/B/C/D/R | 结论变更必须同步 evidence + affected_documents |
| `gaps.csv` | 全部缺口（35 条），含 verified/unresolved 范围与下一步 | 状态变更须经证据；验证器校验枚举 |
| `evidence.csv` | 证据登记：源文件 + SHA-256 + 地址 + 指令/数据 + 可复现性 | 源文件必须真实在盘（验证器校验） |
| `issue-crosswalk.csv` | Gap ID ↔ Runtime Issue ID（R-xx/R4-xx/ME-xx）↔ 报告 正式映射 | OPEN-RUNTIME gap 必须有映射（验证器校验） |
| `documents.csv` | 文档分类：ACTIVE/HISTORICAL/SUPERSEDED/FROZEN + 过期标记 | 文档整改后更新 |
| `frozen-abi.txt` | 冻结 ABI sha256 pin（components/RENDER-NODE-ABI-V1.md） | 只能经独立 ABI 评审后更新 |

## 生成与校验

```bash
python research/scripts/generate_cleanroom_deliverables.py   # 生成统计块 + research/result/clean-room/*.csv
python research/scripts/validate_reverse_engineering.py     # fail-closed 校验（14 类检查）
python -m unittest discover -s research/tests -v            # 隔离测试（20 项）
```

状态枚举：`CLOSED-STATIC | CLOSED-RUNTIME | PARTIAL-STATIC | OPEN-STATIC | OPEN-RUNTIME | BLOCKED | SUPERSEDED`
证据等级：`A`（直接完整可复核）`B`（多源互证）`C`（有据未全证）`D`（假设）`R`（仅运行时可证）。
等级与状态独立使用，例如 `OPEN-STATIC + B` 合法。禁止 `A(joint)` 类复合等级。

## 关键事实速查（详见 claims.csv）

- 已撤销：0x427EB3=CreateRawCanvas；slot45=有序插入；Tile/Obj 同容器；RTTI 已证类名；0x5042D0A0=补丁表；"稳定插入已验证"；COM 比较回调；"音频仅哈希动态导入"。
- 已成立（A 级）：tile/obj 键公式；[0xBE2788] Gr2D 接口链；层虚表 0x5042D140+intmap；0x427EB3=属性 PUT；purecall IAT；通道分离；VR 折叠；0x1E 步进；+0x3BC 写侧 9 站点；WINMM 静态导入；RNG 加密对。
