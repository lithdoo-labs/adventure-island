# RenderNode 总体架构与 Scene ABI v2 设计

> 设计状态：**PROPOSED，等待 ADR 审批与独立 Reviewer。**
> 范围：WP1 总体结构、WP2 全局绘制顺序的架构裁决，以及统一资源/Clock/Projection Batch 的跨组件基础约束。
> 本文不修改 Frozen RenderNode ABI v1，也不把候选 Schema 标记为 Frozen。
> ms-avatar / ms-action V1 的公开设计保持不变。

## 1. 版本层次与目标

必须区分三层：

| 层 | 本轮处理 |
|---|---|
| LoomRealm Render Update v1 | 不变 |
| LoomRealm Web Presentation API v1 | 不变；Projection Batch 作为内部集成提案 |
| Adventure Island Frozen RenderNode ABI v1 | 不变，继续服务旧 cms-* 树 |
| Adventure Island Scene ABI v2 | 新增 ms-* tag family 和场景组合规则 |
| 组件内部 formatVersion | 每个 data plan 独立版本，不与 Render Update 版本混用 |

Scene ABI v2 仍使用 LoomRealm RenderNode 五字段。这里的 v2 是 Adventure Island 业务组件/场景树版本，不是 LoomRealm RenderNodeV2，也不要求增加第六个字段。

目标：

- 一个场景有确定的 Domain、root、children 和绘制顺序。
- Field Runtime 是游戏状态唯一权威；RenderNode 是只读呈现投影。
- 世界深度排序可以跨 Tile、Obj、Avatar、NPC、Mob、Reactor、Portal、Effect 和 Projectile。
- 静态地图元素批量表达；只有拥有独立呈现生命周期的对象才建立独立 Web Component。
- 资源、Clock、更新、失败和版本迁移具有统一语义。
- Canvas、WebGL 或其他内部 renderer 可替换，不改变 Field Runtime 和 RenderNode 业务数据所有权。

## 2. 总体架构

~~~mermaid
flowchart TB
  CB["Content / Bundle Builder"]
  FR["Field Runtime / Subsystems"]
  SS["Shared State"]
  RP["Render Projection"]
  RD["RenderDomain"]
  RS["LoomRealm Render Store"]
  WP["LoomRealm WebProjector"]
  WC["Adventure Island Web Components"]
  IN["InputGate"]
  UI["UI / Overlay Subsystems"]

  CB -->|"immutable plans + LogicalResourceRef"| RP
  FR -->|"authoritative snapshots"| RP
  SS -->|"shared authoritative facts"| FR
  SS -->|"read-only projection inputs"| RP
  RP -->|"replace / update / emit"| RD
  RD --> RS
  RS --> WP
  WP --> WC
  WC -->|"context.emitCustomEvent: input intent"| IN
  IN --> FR
  UI -->|"separate UI / Overlay RenderDomains"| RD
~~~

### 2.1 数据所有权矩阵

| 层 | 产生/持有的数据 | 可以更新什么 | 明确禁止 |
|---|---|---|---|
| Content / Bundle Builder | 静态地图定义、Avatar/Action 定义、资源清单、预编译 render chunks、contentVersion | 发布新的不可变 Content closure | 持有玩家运行时位置或战斗状态 |
| Field Runtime / Subsystem | 地图实例、玩家/NPC/Mob/Portal/Reactor/Seat 业务状态、碰撞、Foothold、Movement、Camera 决策、Portal Gate、Simulation Clock | 通过领域规则更新权威状态 | 把视觉帧号当作业务状态 |
| Shared State | 跨 Subsystem 的权威事实，例如当前角色共享数据 | 按其所属业务边界更新 | 变成 RenderNode 镜像数据库 |
| Render Projection | 从快照产生 attrs/data/children、决定节点存在、生成 key、计算 drawOrder | 更新 RenderDomain 投影 | 处理输入、物理、Portal 触发或资源 URL |
| RenderDomain | retained RenderNode state、revision、Domain zIndex | replace/update/emit/close | 拥有游戏状态或解析 Content |
| LoomRealm WebProjector | 节点身份映射、DOM 结构和 receiver 投影 | 机械更新 managed DOM | 作游戏决策、修改 Shared State |
| Web Components | 本地 Player、绘制缓存、资源 lease、DOM 生命周期 | 私有呈现状态和像素 | 修改受管理 attrs/data/children 或 Field Runtime |
| Renderer 内部服务 | 共享解码缓存、RenderClock、SceneViewProvider、ProjectionBatch | 服务租约与呈现生命周期 | 作为公开 RenderNode 字段或业务权威 |

核心规则：**Web Component 是呈现端，不是第二套游戏运行时。**

## 3. RenderDomain 拓扑

### 3.1 推荐 Domain 划分

| Domain | 是否默认建立 | root | 生命周期 |
|---|---|---|---|
| World Domain | 是 | 一个 ms-scene-view | 一个 Adventure Field Runtime 实例；地图切换时保留 Domain |
| UI Domain | 是，若 HUD/菜单由独立 Subsystem 管理 | 一个 ms-ui-root | 跨地图切换保留 |
| Overlay Domain | 可选 | 一个 ms-overlay-root | 仅用于需要独立最高层级/生命周期的转场、致命错误或全屏遮罩 |

不要按地图层、Actor、NPC 或每张地图建立 Domain。RenderDomainState 的 zIndex 是 Domain 级堆叠，不是节点深度排序。

World Domain 的 roots 数组目标为恰好一个 ms-scene-view。UI 和 Overlay 也各自使用单一 root。Screen-space UI 不进入 World Draw List；world-space Effect / Projectile 进入 World Draw List。

### 3.2 为什么不能把每个视觉层拆成 Domain

LoomRealm RenderDomain 的 replace/update 原子性只在一个 Domain 内成立。多个 Domain 之间没有共同 revision 或事务提交。

如果把地图、Avatar、Portal 分成多个 Domain，场景切换就可能出现地图已替换、Avatar 仍是旧地图、Portal 仍是旧目标的混合画面。因此同一 Field Scene 的世界内容必须位于一个 World Domain。

UI Domain 独立的理由是它的生命周期跨地图切换。Overlay Domain 不是默认强制项；只有需要在 World replace 期间保持顶层遮罩时才有收益。

### 3.3 Domain 生命周期

~~~mermaid
stateDiagram-v2
  [*] --> Preparing
  Preparing --> Active: bundle + runtime + projection validated
  Preparing --> Failed: validation/resource closure failure
  Active --> TransitionPreparing: map transition requested
  TransitionPreparing --> Active: prepare failed; old scene retained
  TransitionPreparing --> Projecting: one World Domain replace accepted
  Projecting --> Active: critical projection batches complete
  Projecting --> Recovery: projection batch failed
  Recovery --> Projecting: fresh projection with fresh keys
  Active --> Closing: Field Runtime exits
  Closing --> [*]: RenderDomain.close()
~~~

Domain 创建时 RenderManager 接收初始 RenderDomainState；Domain 关闭后不再接受更新。地图 A → B → A 不应销毁并重新创建 World Domain；使用同一个 Domain 的 replace，并通过 sceneEpoch/key allocator 产生新场景实例身份。

## 4. RenderNode v1 结构和更新语义

RenderNode 仍然只有五个字段：

~~~ts
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject;
interface JsonObject {
  readonly [key: string]: JsonValue;
}

interface RenderNodeV1 {
  readonly key: string;
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly data: JsonObject;
  readonly children: readonly RenderNodeV1[];
}

interface RenderDomainStateV1 {
  readonly zIndex: number;
  readonly roots: readonly RenderNodeV1[];
}
~~~

RenderDomain 更新 API 的概念形状与 LoomRealm 固定实现一致：

~~~ts
interface StringDeltaV1 {
  readonly set?: Readonly<Record<string, string>>;
  readonly remove?: readonly string[];
}

interface DataDeltaV1 {
  readonly set?: Readonly<Record<string, JsonValue>>;
  readonly remove?: readonly string[];
}

interface RenderNodeUpdateV1 {
  readonly key: string;
  readonly attrs?: StringDeltaV1;
  readonly data?: DataDeltaV1;
}

interface RenderDomainUpdateV1 {
  readonly zIndex?: number;
  readonly nodes?: readonly RenderNodeUpdateV1[];
}

interface RenderEventV1 {
  readonly targetKey: string;
  readonly name: string;
  readonly data: JsonObject;
}

interface RenderDomainV1 {
  replace(state: RenderDomainStateV1): void;
  update(update: RenderDomainUpdateV1): void;
  emit(event: RenderEventV1): void;
  close(): void;
}
~~~

### 4.1 attrs / data / children 规则

- attrs：小型、闭集、字符串输入；数字和布尔值必须先序列化为明确字符串。
- data：闭集 JSON render plan；每个 tag 自己定义顶层字段、formatVersion、容量和 Validator。
- children：只用于有独立身份、资源/动画/生命周期或父子协作意义的组件。
- 单个 Tile、Obj、Foothold、Rope、粒子或普通 Sprite 不因“有图片”就成为 RenderNode。
- data 更新的 set 值是完整当前顶层成员，不是嵌套 Patch。
- 组件不得修改 managed attrs/data/children。

### 4.2 replace / update / emit

| 操作 | 允许变化 | 使用场景 |
|---|---|---|
| replace | 完整 roots/children 结构；可新增、删除、移动节点 | 地图切换、实体节点增删、Action 子节点增删/改名、子节点重排 |
| update | 已有节点的 attrs/data 顶层成员、Domain zIndex | Camera x/y、Actor x/y、facing/action、已存在 Clip 更新、drawOrder 更新 |
| emit | 单次 transient RenderEvent | Avatar one-shot、一次性视觉脉冲 |

update 不改变 key、tag、children。结构改变必须 replace。多节点 update 可以在同一 Domain 一次提交；跨 Domain 不具备事务性。

## 5. 目标场景树

### 5.1 Scene ABI v2 目标树

~~~text
ms-scene-view                         唯一 World Domain root
├── ms-back                           远景组，data.items[] 批量背景
├── ms-world-layer                    全局世界绘制端
│   ├── ms-entity                     玩家世界坐标/绘制身份 wrapper
│   │   └── ms-avatar                 已收口的 Avatar V1
│   │       ├── ms-action             stand / walk / jump / ...
│   │       └── ms-action
│   ├── ms-entity                     仅当某类实体确有独立呈现生命周期时使用
│   │   └── ms-life-visual            可选共享视觉实现，待独立 ABI 设计
│   └── ...                           其他独立 drawable providers
└── ms-back                           近景组，data.items[] 批量背景
~~~

Root children 顺序固定为远景 → World → 近景。World 内的实际 painter order 不由 DOM children 顺序决定，而由 ms-world-layer.data.worldPlan.drawOrder 决定。

ms-back 以远景/近景组为单位，而不是每一个背景条目建立一个节点。没有背景时允许空 items 数组；两个组节点可保持稳定身份。

### 5.2 ms-scene-view 的职责

ms-scene-view：

- 拥有 viewport clip、屏幕尺寸观察和 SceneViewProvider。
- 接收 Camera Subsystem 当前 camera-x / camera-y 快照。
- 将 Camera 与 viewport 信息提供给 World Renderer 和 Back Renderer。
- 作为 RenderClockProvider，向后代提供共享 RenderClock。
- 管理场景呈现根的挂载和销毁。

它不负责：

- 选择跟随目标；
- 计算 deadzone、平滑或 Camera clamp；
- 决定玩家移动；
- 处理 Foothold、Portal、碰撞或输入。

Camera 的权威状态仍属于 Camera Subsystem。Root 只投影快照。

### 5.3 ms-world-layer 的职责

ms-world-layer 是一个统一的世界绘制端：

- 消费地图 Tile / Obj 的批量绘制计划；
- 消费 Avatar、NPC、Mob、Reactor、Portal、Effect、Projectile 的有序绘制记录；
- 在一个绘制上下文中保持全局 painter order；
- 统一 viewport culling、透明度/混合顺序和 world-to-screen transform；
- 使用共享 Resource Cache 和 RenderClock；
- 在内部选择 Canvas 或 WebGL 实现。

它不拥有实体位置、速度、碰撞、触发范围、Reactor 状态或 Portal 目标。所有位置和视觉状态来自 Render Projection。

## 6. 全局 Draw List：推荐方案

### 6.1 候选方案比较

| 维度 | A. 继续分组式树 | B. Scene Draw List / World Render Layer |
|---|---|---|
| ABI 复杂度 | 低，复用 cms-map-layer / avatar-layer 思路 | 中，需要 draw plan 和 drawable provider 内部接口 |
| RenderNode 数量 | 固定层节点少，但无法跨层穿插 | 固定少量 layer + 少数独立 drawable nodes |
| 更新开销 | 每层各自更新，实体深度跨层时无法表达 | 静态批次稳定；实体位置单独更新；仅排序变化时更新 drawOrder |
| 全局排序 | 只能组件内部排序，无法跨组件 | Projection 输出全局序列 |
| Canvas/WebGL | 多个绘制端需要合成与层级协调 | 一个统一 painter，后端可替换 |
| 透明混合 | 跨组件混合困难 | 同一绘制上下文内确定顺序 |
| 视口裁剪 | 各层重复实现 | 统一 viewport 和空间工作集 |
| 动态实体 | 需固定放在某个组 | 可在地图静态批次之间插入 |
| v1 兼容 | 可继续运行旧 ABI | 新 tag family；不改 v1 |
| 主要代价 | 无法满足 CMS079 跨对象深度 | 需要内部 drawable surface 与 Projection Batch |

### 6.2 推荐决定

**推荐 B：Scene Draw List / World Render Layer。**

理由：

1. Frozen v1 的分组树已明确不能把 Actor 插入同层 Obj 深度带。
2. 当前 CMS079 证据已恢复跨对象排序键控插入、比较器、Avatar 键和次级键；继续把 Avatar 固定放在所有 MapLayer 后面不是 V2 目标。
3. 单一 World Renderer 能够在 Canvas/WebGL 内部实现统一 painter，不需要把每个 Tile/Obj 变成 DOM 节点。
4. Render Projection 可以把静态 map batches 和动态 drawable refs 合并成有序序列；组件只执行，不自行决定业务深度。
5. OpenMS StreamScene 的统一可排序 world container 是 GMS083 行为参考；本方案不复制 PixiJS Container。

### 6.3 DrawOrder 语义

World Draw Plan 的 drawOrder 是**从后向前**的 painter sequence：数组前面的项目先绘制，后面的项目覆盖前面的项目。

Render Projection 负责：

- 从 MapScenePlan / Content render records 获取静态 Tile / Obj sort facts；
- 从 Field Runtime snapshot 获取动态实体当前 sort facts；
- 使用统一的 RenderOrder comparator 生成确定顺序；
- 把连续静态项目压缩为 batch；
- 在静态 batch 与 entity surface / dynamic record 之间插入顺序引用。

已知 CMS079 证据支持键升序、小键先画；T086 补充比较器和第二键。比较器具有层级路径比较，不能简化为只按 y 排序。精确相等时如产品仍保留两个不同 Render record，sourceOrdinal 只作为 Adventure Island 的确定性最终兜底；不把该兜底宣称为 CMS079 稳定插入行为。

组件不得重新排序 drawOrder。Validator 必须检查：

- 引用 ID 唯一；
- 每个 batch / entity reference 都能解析；
- 每个 draw item 的资源和 source rect 有效；
- 顺序数组无悬空引用；
- 同一帧不出现重复 draw identity；
- 容量和资源工作集不超限。

### 6.4 DrawList 数据草案

~~~ts
interface LogicalResourceRefV1 {
  readonly namespace: string;
  readonly key: string;
  readonly contentVersion: string;
}

interface RectV1 {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface MapDrawItemV1 {
  readonly kind: "tile" | "obj";
  readonly resource: LogicalResourceRefV1;
  readonly source: RectV1;
  readonly x: number;
  readonly y: number;
  readonly alpha: number;
  readonly blend: "normal" | "add";
}

type MapDrawBatchV1 =
  | {
      readonly id: string;
      readonly kind: "inline";
      readonly items: readonly MapDrawItemV1[];
    }
  | {
      readonly id: string;
      readonly kind: "resource";
      readonly resource: LogicalResourceRefV1;
      readonly itemCount: number;
    };

type WorldDrawOrderEntryV1 =
  | { readonly kind: "batch"; readonly id: string }
  | { readonly kind: "entity-surface"; readonly drawId: string }
  | { readonly kind: "record"; readonly id: string };

interface WorldDrawPlanV1 {
  readonly formatVersion: 1;
  readonly mapId: string;
  readonly staticBatches: readonly MapDrawBatchV1[];
  readonly records: readonly WorldDrawRecordV1[];
  readonly drawOrder: readonly WorldDrawOrderEntryV1[];
}

interface WorldDrawRecordV1 {
  readonly id: string;
  readonly kind: "npc" | "mob" | "reactor" | "portal" | "effect" | "projectile";
  readonly resource: LogicalResourceRefV1;
  readonly source: RectV1;
  readonly x: number;
  readonly y: number;
  readonly alpha: number;
  readonly blend: "normal" | "add";
}
~~~

这是全局结构草案，不是已冻结的 ms-world-layer Schema。具体记录字段、帧动画、blend modes 和容量必须在组件 ABI 阶段按实际内容样本收口。

### 6.5 动态更新策略

- Entity 的 x/y/facing/action 等小型高频状态优先更新对应 ms-entity / visual node attrs。
- drawOrder 只有在相对 painter order 改变时才更新，不因每个像素位置变化而必然重发。
- 静态 map batch 不随每个 Simulation tick 重发。
- Camera 移动时只更新可见工作集 / chunk refs；不把整张地图放入一个 RenderNode。
- 普通 NPC/Mob/Reactor/Portal 若只是 Sprite/Frame 记录，优先放在 records 数组；只有需要独立生命周期、独立资源租约、独立交互或复杂动画状态时才提升为独立组件。
- 对大地图使用 viewport culling 和可选的 immutable MapRenderChunk resource；分块大小、单块字节和可见工作集上限由 13 张目标地图实测后冻结。
- 透明对象严格保留 drawOrder；只有连续且不会改变混合结果的项目才允许合批。

## 7. 组件职责矩阵

| 候选 | 是否独立 Web Component | 默认职责/组织 |
|---|---|---|
| ms-scene-view | 是 | Scene root、Camera snapshot、Viewport、RenderClockProvider |
| ms-back | 是，按 far/front 两组 | 一组内用 data.items[] 批量背景 |
| ms-map-layer | 否，默认不单独保留 | 八个 map layers 是 World Draw Plan 的批量数据 |
| ms-world-layer | 是 | 全局 draw list、Canvas/WebGL、culling、混合顺序 |
| ms-avatar-layer | 否 | 旧容器只保留在 cms ABI v1 |
| ms-entity | 是，但仅用于复杂 drawable provider | 世界坐标、drawId、visual child 组合 |
| ms-avatar | 是，保持 V1 | 纸娃娃、Animation Player、内部资源租约、Canvas surface |
| ms-action | 是，保持 V1 | 具名 Clip 数据型直接子节点 |
| ms-npc | 默认否 | NPC 是 World Draw Plan record；必要时与 Mob 共用 ms-life-visual |
| ms-mob | 默认否 | Mob 是 World Draw Plan record；不按每只 Mob 创建组件 |
| ms-reactor | 默认否 | Reactor 视觉状态投影为 record；业务状态归 Reactor Subsystem |
| ms-portal | 默认否 | Portal 视觉投影为 record；目标/触发/冷却归 Portal Subsystem |
| ms-seat | 否 | Seat 位置、占用和交互范围属于 Field Runtime |
| ms-effect | 默认否 | Effect records 批量绘制；不按粒子建节点 |
| ms-projectile | 默认否 | Projectile records 批量绘制；不按每发子弹建节点 |

### 7.1 为什么 ms-entity 有必要

ms-avatar V1 明确不拥有世界 x/y、Camera 或世界深度。ms-entity 是一个很窄的世界放置 wrapper：

- attrs 持有 draw-id 和当前世界位置/可见状态；
- children 恰好一个独立 visual provider，例如 ms-avatar；
- 不持有移动、碰撞、Foothold 或业务状态；
- 通过内部 WorldDrawableSurface 接口向 ms-world-layer 暴露当前完整帧。

它不是所有游戏实体的强制容器。没有独立 visual provider 的 NPC/Mob/Portal/Reactor 仍然是 World Draw Plan records。

### 7.2 Avatar 与 World Renderer 的内部接口

ms-avatar V1 的 attrs/data/children 不变。它目前拥有自己的内部 Canvas。Scene ABI v2 需要一个不公开到 RenderNode 的组件间接口：

~~~ts
interface WorldDrawableSurfaceV1 {
  readFrame(): {
    readonly source: CanvasImageSource;
    readonly pixelWidth: number;
    readonly pixelHeight: number;
    readonly originX: number;
    readonly originY: number;
    readonly frameVersion: number;
  } | null;

  subscribeFrameInvalidated(listener: () => void): () => void;
}
~~~

ms-entity 将 Avatar 的 surface 与世界位置绑定；ms-world-layer 按 drawOrder 在正确位置 drawImage / composite。未来若改 WebGL，可把内部 surface 表示替换为 texture handle，但不得改变 ms-avatar RenderNode ABI。

这是新内部集成契约，必须单独 ADR、实现测试和性能验收；不能假设现有 ms-avatar 文档已经提供该接口。

## 8. Node key 与身份生命周期

### 8.1 稳定身份

建议在一个 World Domain generation 内保持以下 key 稳定：

- scene-root；
- back:far；
- world-layer；
- back:front；
- entity:player；
- avatar:player。

它们在同一 Domain generation 内不删除、不重建。玩家换装/换动作只更新 attrs/data 或 Action children。

### 8.2 场景专属身份

- sceneEpoch 是 Render Projection 私有单调计数，只用于生成 Node key；不得放入 attrs/data。
- 地图专属节点 key 包含 sceneEpoch；地图 A → B → A 必须生成新的 key。
- 如果静态地图只存在于 World Draw Plan data，不为每张 Tile/Obj 分配 key。
- 动态实体 Node key 使用实体逻辑 ID + spawn generation / 单调实例序号。
- ms-action 的 attrs.name 是逻辑 Action 身份；同一个 live key 不允许改名。Clip 内容修订可更新 data.clip；改名必须 replace 并使用 fresh key。
- drawId 不是 RenderNode key，但必须在当前 World Plan 中唯一；实体 despawn/respawn 使用新的 spawn identity，防止 stale input 混淆。

### 8.3 replace 与移动

同一 key、同一 tag 出现在 replace 前后树中时，可保留同一个 HTMLElement，即使其 parent 发生变化。若 key 在某次已提交 retained tree 中消失，就永久消费，不能在后续 replace 复用。Live key 不能改 tag；tag 变化需要新 key。

## 9. 更新原子性与场景切换

### 9.1 选择 update 或 replace

| 变化 | 操作 |
|---|---|
| Camera x/y、Actor x/y、facing、action | update |
| 一个已存在 ms-action 的 clip 修订 | update |
| 父 Avatar appearance 与多个 Clip 同时换装 | 同一 Domain 一次多节点 update |
| 增删/重排 ms-action children | replace |
| 增删/重排 ms-entity provider children | replace |
| 地图切换且地图实体树结构变化 | replace |
| 仅 visibleChunks / drawOrder / map plan 顶层数据变化 | update |
| Resource contentVersion 更新但 tag/children 不变 | update |
| tag family 或 children schema 改变 | 新 ABI tag + replace |

### 9.2 Map Transition 提交顺序

~~~mermaid
sequenceDiagram
  participant F as Field Runtime
  participant P as Render Projection
  participant D as World RenderDomain
  participant S as Render Store
  participant W as WebProjector
  participant C as Components
  F->>F: prepare destination state + resource closure
  F->>P: immutable candidate snapshot
  P->>P: validate plans + allocate fresh scene keys
  P->>D: replace(candidate RenderDomainState)
  D->>S: atomic retained snapshot commit
  D-->>P: synchronous validation accepted
  P->>F: synchronous authoritative state pointer swap
  S->>W: publish snapshot
  W->>C: managed subtree projection
  C-->>W: Projection Batch complete / failed
  W-->>F: internal presentation readiness signal
~~~

重要区别：

- RenderDomain.replace() 同步返回成功，代表 RenderManager 已接受并更新 retained state；不代表 WebProjector 的所有 callback 已成功。
- Replace 的参数校验失败时，不提交 Field Runtime candidate；旧场景保持权威。
- replace 成功后，Field Runtime 与 retained Render Store 在同一同步提交路径完成切换；不要在两次 Domain 提交之间逐步换场景。
- 后续 Component projection batch 失败不是 RenderDomain.replace() 失败。此时不要假装可以复用已删除的旧 Node key 回滚。保持转场遮罩、关闭新的输入 gate，并用 fresh keys 重新投影当前权威场景；无法恢复时显示明确错误。
- Resource decode readiness 与 Projection Batch 是不同阶段。组件不必等待所有图片解码才完成结构投影；但不得提交半帧。

### 9.3 跨 Domain 原子性

World / UI / Overlay 之间没有事务。转场遮罩可保持在 Overlay Domain，覆盖 World replace；遮罩在关键 World projection batch 完成后才淡出。若不需要独立遮罩生命周期，就把转场状态留在 UI Domain，不额外建立 Overlay Domain。

## 10. RenderProjectionBatch

### 10.1 当前事实

ms-avatar V1 已要求：

~~~ts
interface RenderProjectionBatchResult {
  readonly batchId: number;
  readonly status: "complete" | "failed";
}

interface RenderProjectionBatchReceiver {
  beginRenderProjectionBatch(batchId: number): void;
  endRenderProjectionBatch(result: RenderProjectionBatchResult): void;
}
~~~

固定 LoomRealm WebProjector 尚无此接口。不得宣称已实现。

### 10.2 推荐抽象

把它提升为 Renderer 内部的 ProjectionBatchCoordinator，但按**依赖闭包 / 父子子树**隔离，而不是全 Domain 一个全局门闩：

- 先识别本次 retained commit 影响的 receiver roots。
- 若父级 data 依赖直接子节点的 data，则以父 receiver 子树为一个批次。
- 若多个 receiver 子树互不依赖，则分别 begin/end，错误互不污染。
- 若依赖闭包重叠，合并到最近共同 receiver ancestor。
- begin 在该 managed subtree 任何结构/attrs/data 投影之前同步调用。
- end 在该子树所有必要 delivery attempts 完成后调用。
- 任一必要结构/context/data callback 失败，status=failed。
- 批次失败不得保留冒充新状态的旧像素；组件按自身 fail-closed 策略清除。
- Event 只能在其目标依赖批次结束后投递；批次 failed 时丢弃，不缓存。
- Resource fetch / decode 不属于 Projection Batch；它们是异步资源就绪状态。
- Batch result 只用于 presentation consistency/readiness，不是业务状态或 User Input。

### 10.3 与 World Draw List 的关系

ms-avatar 子树的批次保证父级 appearance 与所有 ms-action Clip 组合一致。ms-world-layer 需要另一个较窄的批次来保证 worldPlan.drawOrder 与 ms-entity provider 注册关系一致。

单个 Avatar 失败可以隔离：World Renderer 跳过该 drawable 并报告 DRAWABLE_NOT_READY；其他 entity 仍可绘制。Player Avatar 是否阻止转场遮罩淡出，由 Host 的 critical drawable policy 决定，不由 Avatar 自己修改业务状态。

### 10.4 LoomRealm 最小变更边界

候选变更仅限 Renderer 内部投影 seam / WebProjector 生命周期通知：

- 不新增 RenderNode 字段；
- 不新增 Render Update message；
- 不扩展 WebPresentationContext；
- 不新增公开 service locator；
- 不把 batch result 变成 RenderEvent；
- 不改变 RenderDomain replace/update/emit 语义。

需要 LoomRealm 单独 ADR、固定 commit 升级批准和真实浏览器集成测试。本轮不修改 Submodule。

## 11. 统一 Resource ABI

### 11.1 资源身份

所有资源继续使用 LogicalResourceRefV1：

~~~ts
interface LogicalResourceRefV1 {
  readonly namespace: string;
  readonly key: string;
  readonly contentVersion: string;
}
~~~

Web Component 只能通过 WebPresentationContext.resources.resource(namespace, key, expectedContentVersion, {signal}) 读取。返回 bytes、mime、contentVersion。组件不得访问 URL、FSDB、WZ 路径、私有 Content Index、bearer token 或文件系统。

### 11.2 两级缓存所有权

| 缓存 | 所有者 | 内容 | 生命周期 |
|---|---|---|---|
| Content / Bundle cache | Content Runtime / Bundle | 原始不可变 bytes、manifest、版本闭包 | Content 发布/安装生命周期 |
| Renderer decoded cache | Renderer Window | ImageBitmap / decoded image / decoded render chunk | Renderer session + leases |

两者不能混为一谈。Content cache 不应被 Web Component 当作解码缓存；组件也不应复制一份完整 Content Index。

### 11.3 Renderer 级共享解码缓存

推荐建立 Renderer Window 级共享 PresentationResourceCache：

- 主 identity key 为 namespace + key + contentVersion。
- 返回的 MIME、实际尺寸和解码结果作为 entry metadata；同一 identity 出现 MIME/尺寸冲突时拒绝。
- 多个组件同时请求相同资源时共享一个 in-flight read/decode。
- 每个组件只持有独立 lease；一个组件释放不得关闭其他组件仍在使用的 ImageBitmap。
- refCount 大于零或 pinCount 大于零的 entry 不得被 LRU 逐出。
- 绘制使用 try/finally pin/unpin。
- 每个 lease 可以取消自己的等待；底层 AbortController 仅在没有剩余消费者时 abort。
- createImageBitmap 已启动后不假设可立即取消；过期结果在完成后 close，不得进入 live cache。
- 解码并发和总 decoded bytes 必须有界；LRU 以实际解码字节预算计量，不能只按 entry 数量。
- 资源版本变化产生新的 cache identity；旧版本只在 leases/pins 归零后释放。
- 错误按资源 identity 隔离，不得因一个坏图集清空全局缓存。

ms-avatar V1 仍然拥有其逻辑页面集合和 lease 生命周期；共享缓存拥有实际 decoded page。这样保留 Avatar 组件所有权，同时避免 Back/Map/Avatar 重复解码相同页面。

MapRenderChunk 若使用 JSON/binary render data，应有独立 schema validator 和 decoded-plan cache；不能把它误认为图片 ImageBitmap cache。

## 12. 统一 Render Clock

### 12.1 三种时间严格分离

| 时间 | 权威所有者 | 用途 |
|---|---|---|
| Simulation Clock | Field Runtime / Subsystem | 物理、移动、技能、碰撞、Portal gate |
| Render Clock | Renderer presentation runtime | Avatar、Back、NPC/Mob、Portal、Reactor、Effect、Projectile 的视觉时间 |
| Transient RenderEvent | LoomRealm Render Update | 一次性呈现脉冲，不是时钟或 retained state |

### 12.2 Provider 组织

ms-avatar V1 的 RenderClockProvider 契约保持不变：

~~~ts
interface RenderClock {
  subscribe(listener: (deltaMs: number) => void): () => void;
}

interface RenderClockProvider {
  getRenderClock(): RenderClock;
  subscribeRenderClockInvalidated(listener: () => void): () => void;
}
~~~

推荐：

- Renderer Window 内只有一个 RAF scheduler。
- 每个 Scene root 提供稳定身份的 RenderClock scope。
- ms-scene-view 是 World Domain 最近祖先 Provider。
- UI root 可使用同一底层 scheduler 的独立 scope。
- 组件订阅 Provider，不自行创建 RAF。
- ms-avatar 没有有效祖先 Provider 时保留 V1 定义的本地 Clock fallback；正常 Scene 树中必须使用 Scene Provider。
- ms-action 不订阅 Clock；它只保存 Clip。

### 12.3 时间语义

严格沿用 ms-avatar V1：

- deltaMs 是有限、非负的真实经过毫秒数；不得用固定 16ms。
- Provider 显式暂停时可以停止 tick，但仍然有效；暂停期间不累计。
- Provider 失效时发 invalidated，组件解绑并寻找最近 Provider。
- 切换 Clock 只重置采样基准，保留动画累计相位。
- 已连接但浏览器后台 RAF 停调或掉帧，不自动等于显式暂停；恢复 tick 时按实际 delta seek，不补画中间帧。
- 同一元素 DOM 暂时断连时冻结该实例动画；重新连接后从冻结相位继续。
- 大 delta 直接数学定位当前帧，不逐帧追赶。
- Simulation 暂停是否同步暂停 Render Clock，必须由场景/Host 显式控制；组件不得猜测。

Back / Portal / NPC / Mob / Reactor / Effect / Projectile 使用同一场景时钟，不各自维护 RAF。

## 13. 事件与输入

### 13.1 Subsystem → Component

RenderEvent 仅用于一次性视觉脉冲，例如 ms-avatar 的 action：

~~~json
{
  "targetKey": "avatar:player",
  "name": "action",
  "data": { "action": "brandish1" }
}
~~~

动作 Clip 必须先通过 retained children 发布。Event 不创建 Clip、不证明技能成功、不改变业务动作优先级。事件丢失不补播。

持续状态（当前 action、facing、expression、portal phase、reactor visual state）必须通过 retained attrs/data 更新。

### 13.2 Component → Subsystem

组件只能通过 context.emitCustomEvent() 返回 User Input v1 意图。候选事件包括 world-pointer / world-interaction-intent；payload 必须使用 InputEvent v1 schema。

- InputGate 检查来源、目标身份、当前 Field generation、输入时序和速率限制。
- Subsystem 重新检查实体是否存在、是否可交互、距离/范围/状态是否有效。
- Component 提供的 drawId 只是候选目标，不是命中或权限证明。
- Portal 组件不得发起地图切换；Reactor 组件不得改变 Reactor 状态；Seat 组件不得分配座位。
- 组件不得直接修改 Shared State。

## 14. 生命周期与失败处理

### 14.1 组件生命周期

| 阶段 | 规则 |
|---|---|
| 初始挂载 | connectedCallback 不代表 attrs/data/children 全部就绪 |
| Context 投影 | 仅保存 LoomRealm 注入的 Resource Client / Custom Event emitter |
| attrs/data 投影 | 验证闭集；data 是完整当前对象 |
| children 变化 | 由 Projector 管理；组件只读 managed children |
| update | 更新局部 presentation state；不修改游戏状态 |
| replace | 允许 children 结构变化；key identity 规则继续生效 |
| DOM 移动 | 重新查找最近 Provider；保留组件本地合法相位 |
| 暂时断连 | 停止 tick/paint，取消不再需要的 lease，冻结本地相位 |
| 重新连接 | 读取最新 retained attrs/data，重新绑定 Provider |
| 最终销毁 | 解除 Clock/observer/event subscription，释放所有 lease 和缓存引用 |

### 14.2 错误分层

| 错误层 | 例子 | 处理 |
|---|---|---|
| Projection validation | 未知 tag、重复 key、非法 attrs/data | 不发布无效投影 |
| RenderDomain validation | stale key、非法 delta、缺少节点 | 同步拒绝；不部分修改 store |
| Projector structural | Custom Element 未注册、DOM 结构不能建立 | 报告 structural failure；不声称自动恢复 |
| Component callback | receiveRenderData/context 失败 | 记录局部错误；按 ProjectionBatch 失败处理 |
| Resource | NOT_FOUND / CONFLICT / INVALID / UNAVAILABLE / CANCELLED | 隔离到对应资源/组件；不回退 URL |
| Drawable | 缺失 drawId、无效 source rect、绘制异常 | 跳过/清除对应 drawable 并诊断 |
| Clock | Provider invalidated、delta 非法 | 解绑/重新发现 Provider；拒绝非法时间 |
| Input | stale entity / invalid payload / gate closed | InputGate 拒绝，不改变权威状态 |

ms-avatar 的既有 fail-closed 规则继续生效：父子组合身份变化或无效时清除旧像素；资源尚未就绪与组合无效是不同状态，不允许半帧。

## 15. 版本与 cms-* 迁移

### 15.1 不采用就地改名

- cms-scene-view / cms-back / cms-map-layer / cms-avatar-layer / cms-actor / cms-portal 属于 Frozen RenderNode ABI v1。
- ms-avatar / ms-action 属于已收口的新组件 V1 设计，但没有进入 Frozen cms ABI v1。
- cms-avatar-layer 恰好要求一个 cms-actor；它不能直接容纳 ms-avatar + ms-action。
- cms-scene-view 的 v1 children schema 已冻结，不能在原 tag 下偷偷增加 ms-* children。

因此新场景使用新 root：ms-scene-view。ms-world-layer 与 ms-entity 组成新世界树。

### 15.2 双轨迁移

1. 保留 LegacyRenderProjectionV1，继续产生 cms-* 树。
2. 新建 ModernRenderProjectionV2，从同一 FieldRuntime snapshot + Content closure 产生 ms-* 树。
3. 不做 cms RenderNode → ms RenderNode 的字段改名转换；两者都从权威状态重新投影。
4. 测试时在隔离 Browser/Renderer context 并行跑 V1/V2 fixture；不要在同一生产 Domain 同时显示两棵树。
5. V2 先完成 3 张垂直切片地图，再扩展 13 张。
6. PWA 与 Hostra 使用相同 tag registry、classic script 顺序、bundle hash 和 ABI fixture。
7. 只有 V2 的功能、资源、像素、性能、事件、平台 parity 全部通过，且无生产路径依赖 cms-* 后，才单独批准旧组件弃用。

不升级 LoomRealm Submodule，不修改 Frozen ABI v1。

## 16. TypeScript 总体接口草案

以下是跨层接口草案。具体 tag 的 attrs/data 闭集、字节上限和数组上限留给各自组件 ABI 文档冻结。

~~~ts
interface FieldRenderSnapshot {
  readonly fieldGeneration: number;
  readonly mapId: string;
  readonly camera: {
    readonly x: number;
    readonly y: number;
  };
  readonly viewport: {
    readonly width: number;
    readonly height: number;
  };
  readonly actors: readonly ActorRenderSnapshot[];
  readonly life: readonly LifeRenderSnapshot[];
  readonly interactions: readonly InteractionRenderSnapshot[];
}

interface RenderProjection {
  project(snapshot: FieldRenderSnapshot): RenderDomainStateV1;
  publishUpdate(update: RenderDomainUpdateV1): void;
  publishReplace(state: RenderDomainStateV1): void;
  publishEvent(event: RenderEventV1): void;
}

interface RenderKeyAllocator {
  nextStableInstanceKey(kind: string, logicalId: string): string;
  beginSceneEpoch(): number;
  nextSceneKey(kind: string, localId: string): string;
}

interface ScenePlanV1 {
  readonly formatVersion: 1;
  readonly mapId: string;
  readonly worldBounds: RectV1;
}

interface EntityPlanV1 {
  readonly formatVersion: 1;
  readonly originX: number;
  readonly originY: number;
}

interface RenderProjectionBatchReceiver {
  beginRenderProjectionBatch(batchId: number): void;
  endRenderProjectionBatch(result: RenderProjectionBatchResult): void;
}

interface RenderProjectionBatchResult {
  readonly batchId: number;
  readonly status: "complete" | "failed";
}
~~~

FieldRenderSnapshot 是只读投影输入示意，不是 LoomRealm RenderNode data。RenderKeyAllocator 的 sceneEpoch 不写入 attrs/data。

## 17. 完整场景 RenderNode 示例

下面示例展示目标树和排序穿插方式。ms-scene-view / ms-back / ms-world-layer / ms-entity 的 schema 仍是 Proposed；ms-avatar / ms-action 子树沿用已收口 V1。示例中的资源 identity 是合成测试占位值，不代表仓库中存在该资源。

~~~json
{
  "zIndex": 0,
  "roots": [
    {
      "key": "scene-root",
      "tag": "ms-scene-view",
      "attrs": {
        "map": "222000000",
        "camera-x": "-400",
        "camera-y": "-300"
      },
      "data": {
        "scenePlan": {
          "formatVersion": 1,
          "mapId": "222000000",
          "worldBounds": {
            "x": 0,
            "y": 0,
            "w": 2048,
            "h": 1024
          }
        }
      },
      "children": [
        {
          "key": "back:far",
          "tag": "ms-back",
          "attrs": {
            "plane": "far"
          },
          "data": {
            "backPlan": {
              "formatVersion": 1,
              "items": []
            }
          },
          "children": []
        },
        {
          "key": "world-layer",
          "tag": "ms-world-layer",
          "attrs": {},
          "data": {
            "worldPlan": {
              "formatVersion": 1,
              "mapId": "222000000",
              "staticBatches": [
                {
                  "id": "batch:ground:0",
                  "kind": "inline",
                  "items": [
                    {
                      "kind": "tile",
                      "resource": {
                        "namespace": "adventure",
                        "key": "example/map/ground-atlas",
                        "contentVersion": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
                      },
                      "source": {
                        "x": 0,
                        "y": 0,
                        "w": 1,
                        "h": 1
                      },
                      "x": 0,
                      "y": 0,
                      "alpha": 1,
                      "blend": "normal"
                    }
                  ]
                },
                {
                  "id": "batch:obj:0",
                  "kind": "inline",
                  "items": [
                    {
                      "kind": "obj",
                      "resource": {
                        "namespace": "adventure",
                        "key": "example/map/object-atlas",
                        "contentVersion": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
                      },
                      "source": {
                        "x": 0,
                        "y": 0,
                        "w": 1,
                        "h": 1
                      },
                      "x": 440,
                      "y": 290,
                      "alpha": 1,
                      "blend": "normal"
                    }
                  ]
                }
              ],
              "records": [],
              "drawOrder": [
                {
                  "kind": "batch",
                  "id": "batch:ground:0"
                },
                {
                  "kind": "entity-surface",
                  "drawId": "player"
                },
                {
                  "kind": "batch",
                  "id": "batch:obj:0"
                }
              ]
            }
          },
          "children": [
            {
              "key": "entity:player",
              "tag": "ms-entity",
              "attrs": {
                "draw-id": "player",
                "x": "400",
                "y": "300"
              },
              "data": {
                "entityPlan": {
                  "formatVersion": 1,
                  "originX": 0,
                  "originY": 0
                }
              },
              "children": [
                {
                  "key": "avatar:player",
                  "tag": "ms-avatar",
                  "attrs": {
                    "action": "stand1",
                    "facing": "right",
                    "expression": "default",
                    "one-shot-enabled": "true"
                  },
                  "data": {
                    "formatVersion": 1,
                    "appearance": {
                      "zOrder": ["body"]
                    },
                    "sprites": {
                      "pages": {
                        "body": {
                          "resource": {
                            "namespace": "adventure",
                            "key": "example/avatar-atlas",
                            "contentVersion": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
                          },
                          "width": 1,
                          "height": 1
                        }
                      },
                      "items": {
                        "body.stand1.0": {
                          "page": "body",
                          "source": {
                            "x": 0,
                            "y": 0,
                            "w": 1,
                            "h": 1
                          }
                        }
                      }
                    },
                    "expressions": {
                      "default": {
                        "frames": [
                          {
                            "durationMs": 0,
                            "layers": []
                          }
                        ]
                      }
                    }
                  },
                  "children": [
                    {
                      "key": "action:player:stand1:1",
                      "tag": "ms-action",
                      "attrs": {
                        "name": "stand1"
                      },
                      "data": {
                        "clip": {
                          "formatVersion": 1,
                          "playback": {
                            "mode": "loop"
                          },
                          "frames": [
                            {
                              "durationMs": 100,
                              "move": [0, 0],
                              "rotate": 0,
                              "flip": false,
                              "showFace": true,
                              "layers": [
                                {
                                  "id": "body",
                                  "sprite": "body.stand1.0",
                                  "z": "body",
                                  "origin": [0, 0]
                                }
                              ]
                            }
                          ]
                        }
                      },
                      "children": []
                    },
                    {
                      "key": "action:player:walk1:2",
                      "tag": "ms-action",
                      "attrs": {
                        "name": "walk1"
                      },
                      "data": {
                        "clip": {
                          "formatVersion": 1,
                          "playback": {
                            "mode": "loop"
                          },
                          "frames": [
                            {
                              "durationMs": 100,
                              "move": [0, 0],
                              "rotate": 0,
                              "flip": false,
                              "showFace": true,
                              "layers": [
                                {
                                  "id": "body",
                                  "sprite": "body.stand1.0",
                                  "z": "body",
                                  "origin": [0, 0]
                                }
                              ]
                            }
                          ]
                        }
                      },
                      "children": []
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "key": "back:front",
          "tag": "ms-back",
          "attrs": {
            "plane": "front"
          },
          "data": {
            "backPlan": {
              "formatVersion": 1,
              "items": []
            }
          },
          "children": []
        }
      ]
    }
  ]
}
~~~

这个示例重点是：

- RenderNode 仍然只有五个字段。
- ms-avatar 只保存局部纸娃娃数据，不持有世界 x/y。
- ms-entity 持有世界放置输入。
- drawOrder 可以把 Avatar surface 插入 Tile/Obj 静态批次之间。
- Tile/Obj 是批量记录，不是单独 RenderNode。
- sceneEpoch 不出现在 attrs/data；只用于投影器生成地图专属 Node key。

## 18. 测试与验收矩阵

| 类别 | 必须覆盖 |
|---|---|
| RenderNode Schema | 五字段闭集、attrs 全字符串、data plain JSON、未知字段拒绝 |
| RenderDomain | create/replace/update/emit/close、revision、stale key、tag immutable、key consumed |
| Scene Tree | root 唯一、children 顺序、空 Back group、稳定 Avatar identity |
| DrawOrder | Tile/Obj/Avatar/NPC/Mob/Reactor/Portal 交叉排序、升序、小键先画、次级键、完全相等兜底 |
| Transparency | alpha/additive 顺序、合批不得改变混合结果 |
| Viewport | camera move、边界裁剪、可见 chunk、地图 A→B→A |
| Projection Batch | 首次挂载、父子同时更新、增删重排、callback throw、nested receiver、Event 前置顺序 |
| Resource | 同 ref 并发去重、lease、pin/unpin、Abort、版本冲突、MIME、尺寸、source rect、LRU 字节预算 |
| Clock | 30/60/120Hz、真实 delta、后台 RAF stall、显式 pause、DOM disconnect、Provider 替换、大 delta |
| Lifecycle | move/reparent、temporary disconnect/reconnect、final destroy、late resource completion |
| Event | RenderEvent lost/no replay、stale target、one-shot replacement、InputGate rejection |
| Transition | prepare failure、replace validation failure、projection failure、fresh-key recovery、overlay shielding |
| Platform parity | PWA / Hostra 相同脚本顺序、组件注册、RenderNode fixture、像素 golden、事件行为 |
| Performance | node count、draw item count、payload bytes、decoded memory、decode concurrency、frame time |

不得将未运行的测试标为 PASS。先建立合成 fixture；不得运行原始 CMS079 客户端。

## 19. Proposed ADR

| ADR | 主题 | 建议状态 |
|---|---|---|
| ADR-011 | Scene Draw List / ms-world-layer 全局深度排序 | PROPOSED |
| ADR-012 | Renderer 内部 RenderProjectionBatch | PROPOSED；阻塞 ms-avatar 浏览器集成 |
| ADR-013 | Renderer Window 级共享 decoded resource cache | PROPOSED |
| ADR-014 | Scene RenderClockProvider 与单一 RAF scheduler | PROPOSED |
| ADR-015 | Adventure Scene ABI v2、ms-scene-view root 和 cms/ms 双轨迁移 | PROPOSED |
| ADR-016 | World / UI / optional Overlay RenderDomain 拓扑 | PROPOSED |

这些 ADR 未获审批，不是 Frozen 决策。ADR-007 的 v1 兼容部分继续有效；其未来深度排序方向由 ADR-011/015 重新裁决。

## 20. 未决问题与下一步

1. 13 张目标地图的可见 Draw Item 数量、payload 字节、MapRenderChunk 尺寸和 decoded memory 预算尚未实测。
2. ms-world-layer 的最终 static batch schema、resource-backed batch 格式和 Validator 需基于前三张地图收口。
3. WorldDrawableSurfaceV1 是暴露 CanvasImageSource 还是后续抽象 texture handle，需要实现评审；当前仅定义内部接口草案。
4. RenderProjectionBatch 的 LoomRealm 内部实现需要独立维护者批准；本轮不动 Submodule。
5. Camera 的 CMS079 focus source 仍有未闭合项；产品 Camera 决策必须把 CMS079 事实和 OpenMS GMS083 候选分开。
6. ms-life-visual 是否值得作为独立共享组件，应由 NPC/Mob 实际帧结构、资源和生命周期样本决定。
7. 需要独立 Reviewer 对排序 comparator、投影批次和跨平台树进行对抗审查。

推荐顺序：先审批 ADR-011/012/015/016；再冻结 ms-scene-view / ms-world-layer / ms-entity 的基础 ABI；再设计 ms-back；然后把已收口 ms-avatar/action 接入 WorldDrawableSurface；最后设计生命体、交互对象和特效记录。

## 21. 固定来源

- LoomRealm Render Update v1：93648192323bf5f57996b7b54cbae641d8a53fdb
- LoomRealm Web Presentation API v1：93648192323bf5f57996b7b54cbae641d8a53fdb
- LoomRealm WebProjector：packages/renderer/src/internal/web-projector.ts，固定同一 commit
- OpenMS GMS083：07994de02756356e3e025e3aca9e79433898d2c8
- CMS079 最新世界排序：T086-STATIC-GAP-CLOSURE-REPORT.md、T086.1 勘误附录、MAP-R13-STATIC-CLOSURE.md、claims.csv、evidence.csv、gaps.csv
- CMS079 Camera：T087-CAMERA-STATIC-IDENTITY-REPORT.md、T088-CAMERA-CADENCE-WRITER-CLOSURE-REPORT.md
