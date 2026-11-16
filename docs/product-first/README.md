# OpenMS-Guided Product-First：设计总入口

> **方向已批准；详细规格仍为 DRAFT，不等于产品 READY。** 日期：2026-11-16。本目录为产品设计，不篡改 CMS079 已验收证据。

## 基线、范围与来源

- 原研究分支 `design/adventure-field-map-scene` 在 T088.1 的基线为 `42e2d7fb8b7eb49f4cd3f61b48fc56cc391168ba`；产品设计新分支 `design/openms-guided-product-first` 从该提交创建。
- 历史研究保留：109 Claims / 97 Evidence / 41 Gaps（25 CLOSED-STATIC、9 PARTIAL-STATIC、6 OPEN-STATIC、1 SUPERSEDED）；历史 65 项需求仍由 `research/result/stage-readiness/P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv` 记录。
- OpenMS 参考：https://github.com/tensorfish/openms @ `07994de02756356e3e025e3aca9e79433898d2c8`；这是可复核的参考版本，不是直接依赖 pin。OpenMS 为 JS/PixiJS/Bun/PostgreSQL 项目，根 LICENSE 为 GPL-3.0。
- 13 张图：`222000000, 222000001, 230030200, 230030100, 230030000, 230020300, 230020200, 230020100, 230020000, 230000000, 230000001, 230000002, 230000003`。先以前三张验证垂直切片，再验完整 13 图。
- 产品最终目标：地图资源与遮挡、Backdrop/Obj、Avatar、Foothold/Movement、Camera、Portal 同图/跨图、时钟与故障恢复，PWA/Hostra 一致。

## 当前决策与未决项

**已决定**：OpenMS 行为优先作为候选，使用本作架构独立实现；不要求每项功能先得到 CMS079 指令级闭合。资源/协议/ABI 差异仍必须验证。CMS079 STATIC-ONLY 只禁止运行原始客户端，不禁止运行本作合成夹具或 E2E。

**未决定**：Camera deadzone 与跟随目标、物理 Tick、Portal 命中盒/冷却、背景动态帧、完整 13 图门 enabled 列表、旧服务端协议兼容、直接 GPL 集成模式。必须先做 ADR，不得默认为 OpenMS 的数值即产品决定。

## 资料与权威优先级

1. Frozen `components/RENDER-NODE-ABI-V1.md`、LoomRealm pin、InputGate/RenderDomain/资源安全边界。
2. 已批准的产品行为契约与 `components/MAP-SCENE-PLAN-V1.md` 当前 schema；如有冲突必须 ADR 和版本变更。
3. 本地合法的 13 图 WZ/FSDB 数据与静态资源快照。
4. OpenMS 的可定位 SHA/文件/文档中的候选算法与用例；仅为跨版本参考，不是 CMS079 直接证据。
5. `research/source-of-truth` 中 CMS079 原版研究结论，仍然有效但不做产品前置条件。

## 阅读顺序

- [OpenMS 行为与架构适配契约](OPENMS-ADAPTATION-CONTRACT.md)
- [产品就绪迁移规则](PRODUCT-READINESS-MIGRATION.md)
- [65 项逐条提案矩阵](REQUIREMENT-ADOPTION-MATRIX.csv)
- [新会话交接](NEW-SESSION-HANDOFF.md)
- 正式 `DESIGN.md`、`components/README.md`、`components/MAP-SCENE-PLAN-V1.md`、`components/RENDER-NODE-ABI-V1.md`

## 法律、资源与测试

- **OpenMS GPL-3.0**：默认只参考事实性行为与接口概念并独立实现；不得直接复制/集成 OpenMS 代码，除非单独进行衍生/分发义务评估并获批准。
- **游戏资产**：不镜像/发布原版游戏客户端、WZ、全量素材、第三方资料包；资源构建基于使用者授权的本地输入。不要因为本地可读取就假定可公开分发。
- **状态不串用**：新产品设计 `PROPOSED` 与旧 `RE-GAP-STATIC` 属于两套矩阵；此提交不更新历史 Original Claim、Gap 或 Readiness。
- **明确冲突**：旧 `MAP-SCENE-PLAN-V1.md` §7 只启用四条 Portal 连接，但 P4-09 的目标是 13 图全走廊；必须产出全边清单、端点与闭包外处理决策，不能偷偷扩大旧 enabled 白名单。


## WP0–WP5 产品设计细化（2026-11-16）

本轮已建立可审查的工程提案；65 项均保持 PROPOSED / NOT-APPROVED，未声称实现或 CMS079 等价。

- [WP0 审计与决策 backlog](WP0-AUDIT-AND-DECISION-BACKLOG.md)
- [65 项需求卡（Markdown）](REQUIREMENT-CONTRACTS-V1.md)
- [65 项需求矩阵（CSV）](REQUIREMENT-CONTRACTS-V1.csv)
- [P0–P4 模块契约](MODULE-CONTRACTS-V1.md)
- [ADR Register](ADR-REGISTER.md)
- [13 图地图覆盖矩阵](MAP-COVERAGE-13.csv)
- [13 图 Portal Graph](PORTAL-GRAPH-13.csv)
- [OpenMS 来源与许可证追溯](OPENMS-SOURCE-AND-LICENSE-MATRIX.csv)
- [Golden Fixture / 测试计划](TEST-AND-GOLDEN-FIXTURE-PLAN.md)
- [R0–R4 实施路线图](IMPLEMENTATION-ROADMAP.md)
- [独立 Reviewer 能力限制](INDEPENDENT-REVIEWER-STATUS.md)

实测 Portal graph：54 条非 sentinel 目标记录、46 条内部唯一目标、8 条闭包外目标；内部图正反向可达均为 13/13。旧四门白名单尚未被代码迁移；ADR-001 仍待批准。

独立 sub-agent 能力在本轮环境不可用，Reviewer 状态 NOT-RUN；不得把本轮主 Agent 审计标记为独立 ACCEPT。


- [主 Agent 设计审查总结（非独立 ACCEPT）](DESIGN-REVIEW-SUMMARY.md)
