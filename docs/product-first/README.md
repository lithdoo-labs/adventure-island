# Product-First 设计档案（2026-11-16）

> **归档状态：NON-NORMATIVE / NOT APPROVED（2026-11-17）。** 本目录完整保留上一轮 OpenMS-Guided Product-First 设计提案，供来源追溯和未来逐项复核；它不再是当前设计入口、已批准需求集或实施路线图。

## 当前权威入口

当前状态、可审查组件候选、旧运行路径边界和下一轮审批门统一见 [当前设计基线](../design-baseline/README.md)。

## 档案内容

本目录的 ADR-001..016、65 项需求卡、模块契约、R0–R4 路线图、Golden Fixture 计划及 WP0 backlog 均保持提案性质。没有任何文件因被提交或列入目录而自动获得批准；不得把 PROPOSED、PRODUCT-READY、RE-GAP-STATIC 或设计审查意见转换成实现状态。

以下研究型资产继续有价值，但仅作为可追溯输入：

- [13 图覆盖矩阵](MAP-COVERAGE-13.csv)
- [13 图 Portal Graph](PORTAL-GRAPH-13.csv)
- [OpenMS 来源与许可证矩阵](OPENMS-SOURCE-AND-LICENSE-MATRIX.csv)

Portal Graph 的静态统计为 54 条非 sentinel 目标记录、46 条内部唯一目标、8 条闭包外目标，内部图正反向可达均为 13/13。它不授权运行时自动启用边，也不替代产品对闭包外目标、资源完整性和失败行为的审批。

OpenMS 参考锚点为 `07994de02756356e3e025e3aca9e79433898d2c8`，许可证为 GPL-3.0。保留来源矩阵不等于允许复制、链接或 vendoring 其代码。

## 使用规则

- 只引用其中有明确来源、范围和证据等级的事实。
- 不将任何 ADR、需求卡或路线图作为当前 MUST / MUST NOT。
- 不据此声称新 Scene ABI、Renderer 服务、ms 组件或 13 图玩法已实现。
- 未来若重新启动产品设计，应从当前基线重新审查，而不是直接执行旧 handoff。
