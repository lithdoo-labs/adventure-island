# Adventure Island — 当前设计基线

> **状态：Design Baseline Reset；记录日期：2026-11-17。** 本文取代旧版 DESIGN.md 的现行规范地位。旧文完整保存在 [历史设计档案](./docs/archive/legacy-DESIGN-2026-10-26.md)。

## 1. 当前状态

本轮是设计与仓库边界清理，不是新 Renderer、Scene ABI 或游戏功能实现。

- `ms-avatar` 与 `ms-action` 是当前唯一保留的可审查组件候选基线，见 [ms-avatar](./design/ms-components/ms-avatar.md) 和 [ms-action](./design/ms-components/ms-action.md)。
- 两份组件文档的现有字段、播放语义和父子关系在本轮不改；它们不是已批准或冻结的公共 API，也没有对应的新组件实现。
- 新增六份单组件讨论草案，并为首阶段 8 个标签建立独立组件树说明；这些文件均未批准、未冻结、未实现。
- [首阶段 Custom Element 组件树与遮挡关系](./design/ms-components/FIELD-COMPONENT-TREE-DRAFT.md)：建议 **8 个标签（6 个基础、2 个按需）**，包括六份新增单组件草案及两份既有 ms-avatar/ms-action V1 候选；完整索引见 [MS 组件目录](./design/ms-components/README.md)。
- [World Rendering Architecture — DOM + Multi-Canvas (OpenMS-guided Draft)](./design/ms-components/WORLD-RENDERING-ARCHITECTURE-DRAFT.md) 已更新为 **统一世界深度排序 + LoomRealm 管理 DOM + 多张静态批次 Canvas + 独立 Avatar/NPC/Mob/Obj Paint Unit** 的讨论方向，撤回跨组件 Renderable 注册/单一场景 Canvas 的默认前提。它**不是已批准的 Scene / Renderer 架构**，也不冻结 CMS079 深度公式。
- 除上述候选文档和讨论草案外，当前没有获批的场景树、世界绘制排序、Camera、Movement、Portal、Render Clock、共享解码缓存或 Projection Batch 架构。
- LoomRealm 仍固定在 `93648192323bf5f57996b7b54cbae641d8a53fdb`；本轮不改 Submodule，不假设上游已经提供任何尚未存在的能力。

## 2. 现行与非现行资料

| 资料 | 当前效力 |
|---|---|
| `design/ms-components/ms-avatar.md` | 可审查候选设计；未批准、未冻结、未实现 |
| `design/ms-components/ms-action.md` | 可审查候选设计；未批准、未冻结、未实现 |
| `design/ms-components/WORLD-RENDERING-ARCHITECTURE-DRAFT.md` | DOM + Multi-Canvas 世界呈现讨论草案；统一深度排序与独立绘制单元；未批准、未冻结、未实现 |
| `design/ms-components/FIELD-COMPONENT-TREE-DRAFT.md` | 首阶段组件树、地图/Avatar 遮挡关系、范围及测试门；未批准 |
| `design/ms-components/ms-scene-view.md` / `ms-map-back.md` / `ms-map-batch.md` / `ms-world-item.md` / `ms-map-object.md` / `ms-portal-visual.md` | 六份新增单组件讨论草案；未批准、未冻结、未实现 |
| `design/ms-components/RENDERNODE-ARCHITECTURE.md` | 探索性提案档案；不构成当前架构决策 |
| `design/ms-components/RENDERNODE-BASELINE-AUDIT.md` | 指定旧 HEAD 的只读审计快照；非当前基线 |
| `components/RENDER-NODE-ABI-V1.md` | 仅供旧 `cms-*` 运行路径兼容；不约束新设计 |
| `components/MAP-SCENE-PLAN-V1.md` | 旧运行路径的历史 Plan 草案；不约束新场景模型 |
| `docs/product-first/` | 2026-11-16 的需求、ADR、路线图提案档案；未批准 |
| `research/` 与 `docs/validation/` | 保留的研究和验收证据；按原报告的范围解释 |

## 3. 旧运行路径边界

仓库根目录的 Game Entry 当前仍以 `base → adventure-map` 运行，并通过 `presentation.json` 注册 `cms-actor`。对应 `cms-*` 组件、RenderNode ABI v1、MapScenePlanV1 和 PWA/Chromium 测试全部保留。

这套代码被定义为 Legacy Compatibility Runtime：

1. 可以继续构建和运行，用于复现既有结果与防止历史回归。
2. 其 CI 通过只证明该兼容路径通过，不证明 ms 组件、Scene ABI 或新产品功能已实现。
3. 除必要的兼容性修复外，不向旧 `cms-*` 接口添加新产品能力。
4. 新设计不得依赖旧的 Adventure Island `cms-*` ABI 或 MapScenePlanV1。LoomRealm 自身的 Render Update / Web Presentation API 是独立的上游平台协议，不应与旧项目级 ABI 混为一谈。

## 4. 保留的研究与技术资产

以下内容继续保留，供未来设计逐项引用，不自动升级为产品决定：

- CMS079 逆向研究的 Claims / Evidence / Gaps、任务报告和来源索引；
- 13 张目标地图的覆盖矩阵及 Portal Graph（54 条非 sentinel 记录、46 条内部唯一目标、8 条闭包外目标；图统计不等于运行时启用许可）；
- OpenMS GMS083 的来源路径、固定 SHA 与 GPL-3.0 许可证追溯；
- CMS079 WZ→FSDB 真实转换闭环及已知异常报告；
- LoomRealm 固定版本的 API 与平台能力审计。

任何结论仍受原始报告的样本范围、证据等级和本地数据可访问性约束。不得把静态闭包、样本覆盖或旧测试结果表述为全客户端完整性、全量无损或新组件验收。

## 5. 进入下一轮实现前的审批门

实现新场景或新 Renderer 前，必须先形成单独可审查的架构决策，至少覆盖：

- 场景 root、Domain 生命周期及地图切换事务；
- 首阶段组件树、DOM Paint Unit / Canvas 安全批次与确定性跨对象遮挡顺序；
- ms-avatar 如何向场景 Renderer 提供可合成画面；
- Content / decoded-resource 的所有权、缓存、租约与释放；
- Render Clock 与 Simulation Clock 的边界；
- 父子组件投影一致性及 LoomRealm 集成点；
- PWA 与 Hostra 的注册、脚本顺序、错误处理和一致性验收。

`WORLD-RENDERING-ARCHITECTURE-DRAFT.md` 当前仅提出 **统一世界排序 + DOM 多绘制单元 + 多 Canvas 安全深度合批** 的讨论模型。它没有批准任何 CMS079 深度常数、tie-break 规则、Custom Element/RenderNode ABI、Canvas 预算、批处理策略或 LoomRealm 上游改动。未经证据审计、明确审批和真实 WebProjector 浏览器测试，不得直接作为实施要求.

## 6. 不变约束

- 不运行原始 CMS079 客户端；不把客户端、WZ 或全量 FSDB/素材提交到 Git。
- 不复制或 vendoring OpenMS GPL-3.0 源码；行为参考必须独立实现并记录来源。
- 不修改 LoomRealm Submodule，除非另有明确依赖升级任务。
- 保留历史研究和旧运行路径，不能把归档等同于删除或抹除历史。
