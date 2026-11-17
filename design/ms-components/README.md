# MS 组件与首阶段场景设计索引

> **状态：Design Baseline Reset；以下均未批准、未冻结、未实现。** ms-avatar / ms-action 是此前保留的两份详细 V1 候选基线；另外六份标签设计和组件树属于本轮 **DOM + Multi-Canvas 首阶段讨论草案**，不是已经批准的 Scene / RenderNode ABI。

## 阅读顺序

1. [首阶段组件树、层级、遮挡关系与阶段边界](./FIELD-COMPONENT-TREE-DRAFT.md) — 8 个标签、完整示例、Canvas 穿插和验证矩阵。
2. [World Rendering Architecture — DOM + Multi-Canvas](./WORLD-RENDERING-ARCHITECTURE-DRAFT.md) — OpenMS 绘制事实、LoomRealm 职责边界、静态 Canvas 安全切分。
3. 依下表阅读每个组件的独立文档；旧 ms-avatar / ms-action 的数据/播放 ABI 本轮未重定义。

## 首阶段 8 个 Custom Element 候选

| 标签 | 本阶段必要性 | 单组件文档 | 视觉/深度职责 | 设计状态 |
| --- | --- | --- | --- | --- |
| `ms-scene-view` | 基础必需 | [ms-scene-view](./ms-scene-view.md) | 场景 root、Viewport / Camera World Plane | 新增讨论草案 |
| `ms-map-back` | 基础必需 | [ms-map-back](./ms-map-back.md) | 普通/前景 Back 图片或 Canvas，统一世界排序 | 新增讨论草案 |
| `ms-map-batch` | 基础必需 | [ms-map-batch](./ms-map-batch.md) | Tile/Obj 的有限尺寸静态 Canvas，按安全深度切分 | 新增讨论草案 |
| `ms-world-item` | 基础必需 | [ms-world-item](./ms-world-item.md) | Player 世界位置、显隐、stack-rank 外层 DOM | 新增讨论草案 |
| `ms-avatar` | 基础必需 | [ms-avatar V1](./ms-avatar.md) | 角色纸娃娃局部 Canvas，内部 zOrder | 原保留的详细候选基线 |
| `ms-action` | 当前 Avatar V1 结构下必需 | [ms-action V1](./ms-action.md) | Action Clip 数据子节点，不绘制 | 原保留的详细候选基线 |
| `ms-map-object` | 特殊 Obj / 深度交错需要时 | [ms-map-object](./ms-map-object.md) | 独立地图 Obj DOM（图片或局部 Canvas） | 新增讨论草案 |
| `ms-portal-visual` | Portal 有可见外观要求时 | [ms-portal-visual](./ms-portal-visual.md) | Portal 外观；不负责业务触发和传送 | 新增讨论草案 |

- 六个基础标签是**阶段范围建议**；其中 ms-action 的独立标签必要性依赖尚未批准的 Avatar V1 父子结构。
- ms-map-object 和 ms-portal-visual 是**按需选用**，不意味着每个 Obj 或每个业务 Portal 都需要一个独立 DOM。
- 本阶段移动、Foothold、Camera 决策和 Portal 传送由 Field Subsystem 负责，不因其有业务逻辑就额外创建 Custom Element。
- ms-npc、ms-mob、ms-reactor、ms-map-animation、ms-world-effect、ms-effect-batch、ms-hud 暂不作为首阶段实现范围；后续需要时重新审查具体子组件设计。

## 与 LoomRealm 和旧设计的关系

LoomRealm 固定 RenderNode 五字段 `key / tag / attrs / data / children`，由 WebProjector 管理受控 Light DOM；组件内部只管理 Shadow DOM、资源、Canvas 和视觉帧。不创建跨组件 Renderable Registry、统一单 Canvas，也不把 OpenMS StreamScene 当作游戏架构复制。

- [RenderNode / Scene ABI v2 探索档案](./RENDERNODE-ARCHITECTURE.md) — 历史提案、非现行方案。
- [旧基线审计快照](./RENDERNODE-BASELINE-AUDIT.md) — 只读历史证据。
- [当前设计基线](../../docs/design-baseline/README.md) — 审批门、历史资源与兼容边界。

归档提案中的 ms-world-layer、ms-entity、全局 Draw List、RenderProjectionBatch 等未获批准；固定 LoomRealm commit 没有提供所提议的 Renderer 内部 ProjectionBatch API。旧 cms-* 运行路径保留作为历史兼容，不作为新组件接口。
