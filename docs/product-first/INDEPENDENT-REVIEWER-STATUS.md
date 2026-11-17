> **归档状态（2026-11-17）：历史提案 / 非现行规范。** 本文保留用于追溯；不代表当前产品批准、实现或架构要求。当前设计入口：[Design Baseline Reset](../design-baseline/README.md)。

# Independent Reviewer — 执行能力限制与复核交接

> **状态：NOT-RUN / BLOCKED。**
> 本文件是执行限制的真实记录，不是 Reviewer 报告，也不是 ACCEPT。

## 1. 请求的 Reviewer

名称：**OpenMS-Guided Product Contract Independent Reviewer**

要求流程：
1. Blind review：独立读取 Frozen ABI、MapScenePlanV1、65 项原始需求、产品转向规则、OpenMS 固定版本、13 图数据；先形成独立 BLIND-NOTES，不读取主 Agent 最终设计结论。
2. Adversarial review：阅读主 Agent 产物，逐条检查 65 卡覆盖、实现性、确定性测试、ABI、Portal graph、OpenMS 来源/版本、GPL 和 readiness。
3. Final re-review：修复阻塞项后复验；push 后 Reviewer 自己读取 GitHub 远程 tree；归档最终 ACCEPT / ACCEPT-WITH-CORRECTIONS / REJECT。

## 2. 本轮真实能力检查

本轮检查了当前执行环境的可用工具目录，只有 GitHub、Files、Skills、Plugin Management、Automations 与设置相关工具；没有可启动的独立 sub-agent / delegate / agent-runner 能力。

因此：
- 未启动独立 Reviewer。
- 未生成 BLIND-NOTES。
- 未执行对抗性审阅。
- 未执行 Reviewer push 后远程回读。
- 不以主 Agent 自审冒充独立审核。
- 不给出 ACCEPT 或 ACCEPT-WITH-CORRECTIONS。

## 3. 当前结论

**Reviewer verdict：NOT-RUN（环境能力缺失），不是 ACCEPT，也不是 REJECT。**

设计文档可以作为主 Agent 的工程化提案提交，但最终设计批准门禁仍未通过。任何后续执行环境若能启动真正独立 sub-agent，必须从本文件第 1 节重新开始，不能把本轮主 Agent 的分析结果伪装成 blind review。

## 4. 独立 Reviewer 交接包

Reviewer 应读取：
- components/RENDER-NODE-ABI-V1.md
- components/MAP-SCENE-PLAN-V1.md
- docs/product-first/REQUIREMENT-ADOPTION-MATRIX.csv
- docs/product-first/REQUIREMENT-CONTRACTS-V1.csv
- docs/product-first/MODULE-CONTRACTS-V1.md
- docs/product-first/ADR-REGISTER.md
- docs/product-first/WP0-AUDIT-AND-DECISION-BACKLOG.md
- docs/product-first/PORTAL-GRAPH-13.csv
- docs/product-first/MAP-COVERAGE-13.csv
- docs/product-first/OPENMS-SOURCE-AND-LICENSE-MATRIX.csv
- docs/product-first/TEST-AND-GOLDEN-FIXTURE-PLAN.md
- docs/product-first/IMPLEMENTATION-ROADMAP.md

Review 输出必须包括每个发现的 severity、文件/行、证据、可证伪场景、修复建议、主 Agent 裁决与最终状态；不能只写“looks good”。

## 5. Final gate

在真实独立 Reviewer 产出三阶段记录并 push 后远程复验之前：
- 设计审查状态不得标为最终 ACCEPT。
- 65 项保持 PROPOSED / NOT-APPROVED。
- R0 不能进入“设计批准完成”状态。
