# MS 组件设计候选

> **当前状态：可审查候选，不是已批准或冻结的规范。** 本目录保留 `ms-avatar` 与 `ms-action` 两份组件设计作为当前组件候选基线；另有一份 World Rendering 架构讨论草案，但它不构成已批准的 Scene / Renderer 架构。

## 组件候选

| 组件 | 文档 | 当前定位 | 实现状态 |
|---|---|---|---|
| ms-avatar | [ms-avatar.md](./ms-avatar.md) | 纸娃娃合成与播放的候选设计基线 | 未实现；无新 Custom Element、完整 Validator 或真实浏览器验收 |
| ms-action | [ms-action.md](./ms-action.md) | Avatar 的动作 Clip 数据子组件候选设计 | 未实现；无新 Custom Element、完整 Validator 或真实浏览器验收 |

本轮不重定义上述两份文档中的字段、播放语义或父子关系。它们保持可审查状态，不标记为 Frozen / Normative；任何接口调整都应以可复现矛盾、CMS079 新证据或真实工程约束为依据。

## 当前讨论草案

- [World Rendering Architecture — OpenMS-guided Draft](./WORLD-RENDERING-ARCHITECTURE-DRAFT.md)：讨论组件语义树与 World Display List 分离、统一世界深度排序、Renderable 粒度、Compositor 和 LoomRealm 集成边界。**仅供讨论，未批准、未冻结、未实现**；其中 OpenMS/GMS083 公式不是 CMS079 事实，必须逐项验证。

## 非现行架构提案

- [RenderNode / Scene ABI v2 探索提案](./RENDERNODE-ARCHITECTURE.md)：归档的候选架构，不是批准的实施方案。
- [RenderNode 基线审计快照](./RENDERNODE-BASELINE-AUDIT.md)：针对旧 HEAD 的只读审计，不是当前分支的独立验收。

其中的 `ms-scene-view`、`ms-world-layer`、`ms-entity`、全局 Draw List、RenderProjectionBatch、共享 decoded cache、RenderClockProvider 和 World/UI/Overlay Domain 拓扑均未获批准。固定 LoomRealm commit 未提供的能力不得被描述为现有 API。

## 当前入口

请先阅读 [当前设计基线](../../docs/design-baseline/README.md)。旧 `cms-*` 运行时、项目级 RenderNode ABI v1 与 MapScenePlanV1 仅保留兼容用途，见 [components 目录说明](../../components/README.md)。
