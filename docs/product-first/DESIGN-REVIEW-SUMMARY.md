> **归档状态（2026-11-17）：历史提案 / 非现行规范。** 本文保留用于追溯；不代表当前产品批准、实现或架构要求。当前设计入口：[Design Baseline Reset](../design-baseline/README.md)。

# 主 Agent 设计审查总结（非独立 Reviewer 结论）

> 结论类别：主 Agent 静态设计审计 / 工程化提案。**不是独立 Reviewer ACCEPT**。独立 Reviewer 状态仍为 NOT-RUN / BLOCKED。

## 1. 执行基线与提交

- 仓库：lithdoo-labs/adventure-island
- 分支：design/openms-guided-product-first
- 设计初始化基线：d7ad96cb11a697c20fa48e6fd25983b9c39ce708
- 第一批设计产物提交：f72e521e3fd3e2660aabbc9294c60c879a63cabc
- 第一批提交已回读远程分支与 Git tree；其父提交为初始化基线。

## 2. 需求覆盖

| 项目 | 结果 |
|---|---:|
| P0 | 13 |
| P1 | 15 |
| P2 | 8 |
| P3 | 20 |
| P4 | 9 |
| 合计 | 65 |
| Markdown 需求卡 | 65 |
| CSV 唯一 Requirement ID | 65 |
| 设计状态 | 65 PROPOSED |
| 批准状态 | 65 NOT-APPROVED |

每张需求卡包含用户目标、地图范围、模块/权威 owner、输入/输出、状态变化、资源字段、正常/边界/错误回滚、OpenMS pinned commit/文件位置、CMS079 历史 readiness/Gap、079/083 差异、ABI 影响、性能目标、单元/集成测试、13 图验收、依赖和未决决定。

## 3. 产品设计结果

- P0：Map Descriptor、Info 字段、group presence、资源闭包、Bounds、Physics。
- P1：Tile/Obj 顺序、Back type0–4 候选、frame clock、Obj flow V2、Avatar zmap/smap 与 frozen tree 边界、Portal visual V2。
- P2：世界/屏幕坐标、Camera top-left、VR/minimap/Foothold fallback、viewport resize、deadzone/filter。
- P3：30ms fixed tick 候选、InputGate tick assignment、ground/air/swim、Foothold collision、jump/drop、rope/seat、姿态与错误恢复。
- P4：严格 tm/tn 唯一解析、Up trigger、arrival、状态重置、cooldown、atomic replace/rollback、13 图 graph。

## 4. 13 图数据与 Portal graph

- 13/13 Map struct、13/13 Portal JSONL。
- 5 land / 8 water。
- Back/Foothold/Obj/Portal group files 各 13/13；Tile 9/13、Rope 7/13、Seat 3/13，缺文件需要 manifest 判定。
- 54 条非 sentinel 目标记录；46 条内部唯一目标；8 条闭包外；内部 unresolved 0。
- 内部图正向/反向可达 13/13。
- 46 条内部边只列为启用候选；目标资源闭包未验收前不得静默启用。

## 5. 未决 ADR

ADR-001 Portal graph 迁移；ADR-002 Camera/bounds；ADR-003 fixed tick/InputGate；ADR-004 Portal trigger/arrival/atomicity；ADR-005 Back/Obj/Portal V2；ADR-006 Movement Plan V2 fields；ADR-007 Avatar depth/ABI；ADR-008 info/link；ADR-009 GPL/assets。ADR-010 独立 Reviewer 环境限制为 BLOCKED / NOT-RUN。

## 6. 质量与审查限制

已执行：GitHub 文件读取、CSV/JSONL 静态解析、13 图 Portal target matching、正向/反向 reachability、需求 ID/字段覆盖、README 链接存在性、远程 commit/tree 回读、protected path SHA 比较。

未执行：本地仓库 shell、npm tests、浏览器/PWA/Hostra E2E、性能基准、CI dispatch（当前工具没有本地 runner/dispatch）。基线与新 commit 的 GitHub status/workflow 查询为空，不代表测试通过。

没有可启动的独立 sub-agent；blind review、adversarial review、final re-review 均未执行。不得把本总结作为独立 ACCEPT，也不得将需求状态升级为 READY。

## 7. 下一轮实施建议

先在具备独立 Reviewer 能力的环境完成三阶段审查；产品负责人审批 ADR-001..009；然后执行 R0 schema/manifest/PortalGraph validators 与 GF-00..GF-09；R1 三图垂直切片；R2 13 图完整资源闭包和 Portal graph；R3 V2 动态呈现；R4 战斗/死亡/击退等后续范围。
