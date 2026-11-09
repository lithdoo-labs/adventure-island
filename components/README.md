# Web Component

第一阶段的画面组件。子系统持有渲染树，Web Projector 按标签创建元素。元素只画当前副本，不决定人物走到哪、场景有没有切换。

**公共接口规范：** [Adventure Island RenderNode ABI v1](./RENDER-NODE-ABI-V1.md) 已冻结，统一定义 RenderNode 五字段、Custom Element receiver、资源引用和 MVP 组件的 attrs/data/children/events。各组件 DESIGN 说明来源数据与画法，不得覆盖该 ABI。

资料有两处：

- 地图绘制顺序来自 [研究任务 023](../research/task/023-third-party-wz-parser-cross-validation.md) 的地图合成，证据见 [研究结果 23](../research/result/23-wz-library-cross-validation.md)。`compose` 先画远景，再画 0 到 7 层的物件和瓦片，然后是生命体、反应堆、传送门，最后是近景。立足线和绳梯只作为编辑辅助线，不进正式画面。
- 人物插层来自 [研究任务 050](../research/task/050-subsystem-semantic-deep-recovery-master-campaign.md) 的 `SPAWN_PLAYER`，证据见 [研究结果 50](../research/result/50-subsystem-semantic-deep-recovery.md)。角色被放进 `FieldDispatcher+0x24` 的 avatar layer，不是整张图的最上面。

## 渲染树

```text
cms-scene-view
├── cms-back              back 里 front=0 的远景，每个背景一个
├── cms-map-layer         地图层 0 到 7。瓦片和物件是层上的数组
├── cms-avatar-layer
│   └── cms-actor
├── cms-npc               life 里 type=n。第一阶段不放
├── cms-reactor           第一阶段不放
├── cms-seat              第一阶段不放
├── cms-portal            可见出口，彼此并列
└── cms-back              back 里 front=1 的近景
```

换场景时替换远景、地图层、NPC、反应堆、座位和出口。`cms-scene-view`、`cms-avatar-layer` 与 `cms-actor` 的 key 保持不变；地图专属节点 key 使用单调递增的 `sceneEpoch`，遵守 Render Update v1 的 one-shot key 规则。第一阶段的树只有远景、地图层、人物层和出口。`cms-npc`、`cms-reactor`、`cms-seat` 当前仅有来源/职责草案，不属于已冻结的 RenderNode ABI v1；启用前必须补齐各自的闭合 attrs/data/event schema 与测试。

## 组件

| 目录 | 标签 | 第一阶段 |
|---|---|---|
| [cms-scene-view](./cms-scene-view/DESIGN.md) | `cms-scene-view` | 镜头和场景范围 |
| [cms-back](./cms-back/DESIGN.md) | `cms-back` | 远景和近景 |
| [cms-map-layer](./cms-map-layer/DESIGN.md) | `cms-map-layer` | 层 0 到 7 |
| [cms-avatar-layer](./cms-avatar-layer/DESIGN.md) | `cms-avatar-layer` | 人物所在的层 |
| [cms-actor](./cms-actor/DESIGN.md) | `cms-actor` | 纸娃娃。走和站循环；技能和普攻只播一遍，然后回到当前移动 |
| [cms-npc](./cms-npc/DESIGN.md) | `cms-npc` | 不放。`life` 里 `type=n` 的对话 |
| [cms-reactor](./cms-reactor/DESIGN.md) | `cms-reactor` | 不放。箱子、开关、花的点击和受击 |
| [cms-seat](./cms-seat/DESIGN.md) | `cms-seat` | 不放。坐下的坐标 |
| [cms-portal](./cms-portal/DESIGN.md) | `cms-portal` | 场景出口。第一阶段唯一的地图交互 |

## 不做成组件的东西

- 立足线、绳梯。碰撞数据。需要看的时候由 `cms-scene-view` 画辅助线。
- 单个瓦片、单个物件。瓦片是像素放置数组 `tiles`。物件是放置数组 `objs`，共 165,125 条，字段是画面和遮挡（含 `zM`），不是点击目标。
- 物件上的交互不由物件组件接收。走进场景用 [cms-portal](./cms-portal/DESIGN.md)，对话用 [cms-npc](./cms-npc/DESIGN.md)，打或点箱子、开关、花用 [cms-reactor](./cms-reactor/DESIGN.md)，坐下用 [cms-seat](./cms-seat/DESIGN.md)。约 11,817 个物件的 `reactor` 字段只表示图跟着反应堆变；约 3,697 个 `name` 只给脚本找图。详见 [cms-map-layer](./cms-map-layer/DESIGN.md)。
- 怪物。同在 `life`，但是 `type=m`。第一阶段不放进树，也还没有单独目录。
- 方向键。沿用 LoomRealm 的 `game-controls-input`，不放在本目录。

`apps/pwa/` 和 `apps/hostra/` 加载同一套组件。
