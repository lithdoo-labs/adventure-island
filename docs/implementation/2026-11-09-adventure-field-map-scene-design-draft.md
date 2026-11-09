# Adventure Field & Map Scene Runtime 设计草案

> **状态：Draft / 待评审。** 本文定义下一阶段的目标架构、MVP 范围和验收门槛；不代表地图组件、物理或传送功能已经实现。
>
> 日期：2026-11-09  
> 设计分支：`design/adventure-field-map-scene`  
> 基线：`main@554494452933b19de67db44dd8a0f38190df7d25`  
> LoomRealm gitlink：`93648192323bf5f57996b7b54cbae641d8a53fdb`（保持固定，不随本设计升级）

## 0. 摘要与建议决策

当前 `main` 已完成 Base → Adventure Map → `cms-actor` 的 PWA 垂直切片：正式 Game Entry、统一 Controls、只读 AvatarPlan Content、人物绘制和生命周期清理已经接通。当前 `systems/adventure-map/subsystem.mjs` 仍是角色展示运行时：方向输入改变 `locomotion/facing`，人物 `x/y` 根据 Viewport 居中；它没有世界坐标、地图绘制、物理 Tick、Foothold 碰撞、Camera 或地图切换。

下一阶段建议命名为 **Adventure Field & Map Scene Runtime**，沿用现有 `adventure-map` Subsystem，不增加第二个地图入口。核心决策：

1. **保留 `cms-actor` 的职责和 ABI。** 它继续只绘制人物；位置、运动和场景归属由 Field Runtime 决定。
2. **先做静态真实地图，再做物理和传送。** 第一批只使用射手村 `100000000` 与射手村集市 `100000100`。
3. **把纯游戏规则放进独立的 `libs/adventure-field/`。** `systems/adventure-map/` 负责 LoomRealm Frame、Controls、Content 和 RenderDomain 编排；纯函数库不依赖 DOM、LoomRealm 或浏览器 API。
4. **地图素材采用构建期显式闭包。** 从仓库已有 `[FSDB]cms` 记录生成版本固定的 Map Scene Plan 和 PNG Content；浏览器组件不直接读取 FSDB、WZ 或本地文件。
5. **沿用现有组件设计契约。** `cms-scene-view`、`cms-back`、`cms-map-layer`、`cms-avatar-layer`、`cms-portal` 已有 DESIGN 文档；本阶段是把这些契约实现出来，不重新发明渲染树。
6. **物理参数先校准再宣称复刻。** `Physics/default` 中有 CMS079 参数，但单位、积分方式和部分碰撞标志的语义仍需验证。

## 1. 当前基线与已知事实

### 1.1 已完成的运行切片

- 根目录 canonical Game Entry 以 `base` 为初始 Subsystem，由 `base` 调用 `adventure-map`。
- Base 持有一个 `game-controls-input`；Adventure Map 使用固定 LoomRealm common-controls 的 `createControlsConsumer` 与 `createDirectionalControlsTracker`。
- `cms-actor` 通过 `RenderNode.attrs` 接收 `x/y/locomotion/facing`，通过 `RenderNode.data.avatarPlan` 接收有界、已解析的绘制计划。
- 当前 PWA Bundle Builder 只发布单角色 Avatar Content 闭包、派生的 `struct.AdventureAvatarPlan/bootstrap` 和两份 classic script。
- 当前 Adventure Map 的 `x/y` 是 Viewport 展示坐标，不是地图世界坐标；`up` 播放 `jump` 动作不代表角色离地。

依据：[`docs/game-entry.md`](../game-entry.md)、[`2026-11-06-base-adventure-map-actor-slice-draft.md`](./2026-11-06-base-adventure-map-actor-slice-draft.md)、[`components/cms-actor/IMPLEMENTATION.md`](../../components/cms-actor/IMPLEMENTATION.md)。

### 1.2 组件设计已经存在，但尚未形成地图实现

以下目录目前已有 `DESIGN.md` 契约，地图组件的实际浏览器实现仍是后续工作：

| 组件 | 既有职责 | 本阶段约束 |
|---|---|---|
| `cms-scene-view` | 场景根、Camera、Bounds | 不直接绘制地图内容，不实现物理 |
| `cms-back` | 单个背景放置与视差 | 每个背景一个节点，遵循 `front` 绘制段 |
| `cms-map-layer` | 一层的 Tile 与 Obj 批量绘制 | 每层一个节点，不为单个 Tile/Obj 创建节点 |
| `cms-avatar-layer` | 人物容器 | 保持稳定 key，换地图不重建人物节点 |
| `cms-portal` | 可见出口 | 只呈现出口；触发和地图切换属于 Field Runtime |
| `cms-actor` | 纸娃娃动画 | 不增加地图读取、碰撞、移动或 Camera 逻辑 |

参考：[`components/README.md`](../../components/README.md) 及各组件目录中的 `DESIGN.md`。

### 1.3 第一批地图数据

地图数据已经存在于 `content/[FSDB]cms`。下表是当前仓库记录的条目数量，后续闭包构建必须对实际文件重新计数，不把本文数字作为硬编码输入。

| 数据 | 射手村 `100000000` | 射手村集市 `100000100` |
|---|---:|---:|
| `struct.Map` | 1 | 1 |
| `group.Foothold` | 315 | 210 |
| `group.Portal` | 34 | 24 |
| `group.Tile` | 815 | 665 |
| `group.Obj` | 254 | 249 |
| `group.Back` | 8 | 4 |

地图定义包含 `info`、`miniMap` 和 0–7 图层定义。射手村图层 0、1 使用 `woodMarble`；集市图层 0 使用 `logMarble`、图层 1 使用 `woodMarble`。其余空层不创建 `cms-map-layer` 节点。

两张地图的 Foothold 记录都包含 `layer/platform/id/x1/y1/x2/y2/prev/next`，可选 `force/forbidFallDown`。Tile 放置使用像素坐标及 `u/no/zM`；Obj 放置使用 `oS/l0/l1/l2/x/y/z/f/zM` 等字段。数据不是等宽网格。

### 1.4 首个双向 Portal 样本

首个可验证的地图连接是：

```text
Map 100000000
  portal pn=in00, pt=2
  tm=100000100, tn=out00
             │
             ▼
Map 100000100
  portal pn=out00, pt=2
  tm=100000000, tn=in00
```

注意：集市的 `in00` 指向 `100000101`，不属于本次双地图 MVP。不能把地图里所有 `pt=2` 的出口都自动启用；只有目标地图和目标 Portal 都在本次闭包内、且验证通过的连接才可触发。

### 1.5 数据来源边界

`content/[FSDB]cms` 是当前 CMS079 转换数据；`content/[FSDB]adventure` 是自研 Adventure FSDB。`content/adventure_design.md` 的地图章节尚未定义。本草案建议先将 CMS 表作为**只读构建输入**，通过构建期适配器生成 Adventure 专用的 `MapScenePlanV1`，不要让运行时或 Web Component 直接依赖 CMS 表结构。自研 FSDB 的最终地图表命名与长期导入策略留待地图章节评审。

## 2. 目标、非目标与 MVP 定义

### 2.1 目标

- 能从真实 Content 加载射手村和集市的背景、Tile、Obj、Foothold、Portal。
- 使用像素世界坐标表示人物位置；人物坐标不再由 Viewport 居中计算。
- Camera 根据 Viewport 和地图 Bounds 显示世界区域，并在后续阶段跟随人物。
- 人物能在 Foothold 上行走、跳跃、下落和落地；运动结果由确定性的 Field Runtime 计算。
- 能从射手村 `in00` 进入集市 `out00`，并从集市 `out00` 返回射手村 `in00`。
- PWA Bundle 仅包含两张地图的显式资源闭包；可重复构建且 Content Version 稳定。
- Node 单元测试、浏览器组件测试和正式 PWA E2E 均可复现。

### 2.2 非目标

- 在线服务器、网络同步、封包收发和多人状态。
- 怪物、NPC 对话、Reactors、Seat、绳梯、游泳、飞行、技能、任务和地图脚本。
- 全量 CMS079 地图导入或全库无损性结论。
- 完整复刻客户端的所有物理细节、Foothold 特殊标志和 Portal 触发算法。
- 把 Tile/Obj/Portal 的规则写进 `cms-actor`。

### 2.3 MVP 完成定义

第一版地图 MVP 必须满足：

1. PWA 启动后看到真实射手村，而非占位背景或单独 Actor 展示页。
2. 背景、瓦片和物件位置/原点/层级正确，渲染树节点数随背景数和非空图层数增长，而不是随 Tile/Obj 数量增长。
3. 人物 `x/y` 是世界坐标；Camera 静止时人物不会因 Viewport resize 被重置到世界中心。
4. 人物能在射手村主要地面完成左右行走、跳跃、下落和落地，不穿透主要平台。
5. 两张地图之间指定的 `in00 ↔ out00` 连接可以往返传送；不支持的出口明确保持不可触发。
6. 原有 Actor、Controls、PWA Bundle、生命周期和安全构建测试没有回归。

## 3. 总体架构

```text
Base Frame
  └── Adventure Map Frame
       ├── Controls Consumer (pinned common-controls)
       ├── Content Client
       │    ├── AvatarPlan/bootstrap
       │    └── MapScenePlanV1/{mapId}
       ├── Adventure Field Runtime (pure game logic)
       │    ├── player world state
       │    ├── foothold index / collision
       │    ├── movement fixed-step
       │    ├── camera state
       │    └── portal resolver / transition
       └── RenderDomain
            └── cms-scene-view
                 ├── cms-back (front=0)
                 ├── cms-map-layer (0..7)
                 ├── cms-avatar-layer
                 │    └── cms-actor (stable key)
                 ├── cms-portal
                 └── cms-back (front=1)
```

### 3.1 职责归属

| 所有者 | 负责 | 不负责 |
|---|---|---|
| `systems/adventure-map/subsystem.mjs` | Frame 生命周期、Content 读取、Controls 消费、Tick 驱动、RenderDomain 投影、错误映射 | 直接解析 CMS 原始文件、实现几何算法、DOM 操作 |
| `libs/adventure-field/`（拟新增） | 纯状态转换、Foothold 索引、移动积分、碰撞、Camera 计算、Portal 目标解析 | LoomRealm、DOM、网络、文件系统、定时器 |
| 构建期 Map Adapter | 读取固定 CMS FSDB 输入、校验引用、生成 MapScenePlan 和资源闭包 | 运行时状态、玩家运动 |
| `cms-scene-view` | 世界到 Viewport 的场景投影、Camera Bounds | Foothold 碰撞、Portal 触发 |
| `cms-map-layer` | 批量绘制一层 Tile/Obj | 地图加载、交互规则、人物移动 |
| `cms-back` | 背景绘制、平铺和视差 | Camera 跟随决策 |
| `cms-avatar-layer` / `cms-actor` | 人物节点容器和纸娃娃绘制 | 位置决策、物理、地图切换 |
| `cms-portal` | 按传入数据绘制已启用的出口 | 触发区域计算、Content 加载、切换 Frame |

### 3.2 建议源码布局

```text
libs/adventure-field/
  src/
    field-state.mjs
    foothold-index.mjs
    movement.mjs
    camera.mjs
    portal.mjs
    fixed-step.mjs
  test/

systems/adventure-map/
  subsystem.mjs                 # 现有入口，逐步接入 Field Runtime
  map-content.mjs               # Content Plan 读取与校验
  render-tree.mjs               # MapScenePlan → RenderNode 投影

scripts/pwa/
  read-cms-map-fsdb.mjs          # 只读、显式 allowlist 的构建适配器
  build-installation-bundle.mjs  # 扩展现有确定性 Bundle Builder

components/cms-scene-view/
components/cms-back/
components/cms-map-layer/
components/cms-avatar-layer/
components/cms-portal/
  src/*.mjs
  browser/*.browser.js
  test/
```

以上是建议布局，不是要求一次性创建全部文件。若实现阶段发现现有仓库惯例或 LoomRealm API 要求不同，应先修订本文，再改动实现。

## 4. 世界坐标、Camera 与渲染树契约

### 4.1 坐标原则

- 地图、Foothold、Portal 和 Actor 使用同一套像素世界坐标。
- `cms-actor.attrs.x/y` 表示身体原点在世界中的坐标；依据 `cms-actor` 既有契约，身体原点接近脚底，不是 Sprite 中心。
- `cms-scene-view.attrs.x/y` 表示 Camera 状态，不得再复用 Actor 的屏幕中心坐标。
- Viewport resize 只改变 Camera 的可见范围/夹取结果，不得改写玩家世界坐标或速度。
- Y 轴方向、缩放、像素取整和 Camera `x/y` 表示视口左上角还是中心点，需在组件实现前写成唯一契约并用像素测试固定。

本草案的暂定约定：世界 Y 向下；Camera 的 `(x,y)` 是 Viewport 左上角对应的世界坐标；世界点 `(wx,wy)` 投影到屏幕点 `(wx-camera.x, wy-camera.y)`。这是建议值，必须与固定 LoomRealm Renderer 的变换模型和 `cms-scene-view` 实际实现核对后冻结。

### 4.2 Bounds

边界优先级沿用 `cms-scene-view/DESIGN.md`：

1. `info` 中 `VRLeft/VRTop/VRRight/VRBottom` 四项齐全，且右大于左、下大于上时使用 VR。
2. 否则使用 `miniMap.width/height/centerX/centerY`：`left=-centerX`、`top=-centerY`、`right=width-centerX`、`bottom=height-centerY`。
3. 再否则使用 Foothold 外接矩形，并按既有设计左右扩 10、上扩 360、下扩 110。

Camera 必须夹取到 Bounds。若地图宽/高小于 Viewport，采用居中留白，不制造负向抖动。`info/link` 指向其他地图时，Map Adapter 必须先解析链接目标的地图绘制内容，再生成当前 mapId 对应的场景计划；链接语义不能由组件猜测。

### 4.3 渲染顺序

顺序以现有 `components/README.md` 为准，MVP 子集为：

1. `front=0` 的背景。
2. 非空地图层，按 `layer=0..7`。
3. `cms-avatar-layer`，其中保留唯一 `cms-actor`。
4. 本阶段启用的 `cms-portal`。
5. `front=1` 的近景背景。

NPC、Reactor、Seat 暂不创建。Foothold 和 Rope 不作为正式画面节点；需要诊断时由 `cms-scene-view` 的可选辅助线显示。

### 4.4 Tile 与 Obj 绘制

- 一个非空地图层对应一个 `cms-map-layer`；不得为每个 Tile/Obj 创建 RenderNode 或 Web Component。
- Tile 使用 `Tile/{tileSet}` 中的真实 Canvas 尺寸、`origin`、`z` 和 `foothold` 元数据；位置是像素放置，不是统一格子。
- 同层排序沿用现有契约：Obj 组先于 Tile 组；Obj 按放置记录 `z` 和稳定源顺序，Tile 按图集 Canvas `z` 和稳定源顺序。
- `zM` 必须保留在投影数据中，供后续人物/物件遮挡分带使用；MVP 先按现有渲染树把 Actor 放在地图层之后，因此部分前景树木/建筑遮挡可能不完全复刻。不能把这一限制隐藏成已完成。
- `flow`、`r`、`reactor`、`name` 等少数扩展字段按现有 `cms-map-layer/DESIGN.md` 保留或有意忽略，不能在 Adapter 中静默丢弃未知字段。

### 4.5 Background

`cms-back` 每个背景放置项一个节点。保留 `bS/no/ani/x/y/rx/ry/type/cx/cy/f/a/front`；静态和动画资源按 `Back/{bS}` 定义解析。平铺、滚动和视差按现有 `cms-back/DESIGN.md`，背景滚动只由 Camera 与本背景的参数决定，不把玩家坐标直接写进背景组件。

## 5. Map Content 与 PWA Bundle

### 5.1 构建期闭包，不在浏览器读取 FSDB

当前 PWA Bundle Builder 有明确输入白名单、确定性排序、SHA-256 Content Version、引用闭包验证和路径安全约束。地图接入必须扩展同一 Builder，而不是另建绕过白名单的资源复制脚本。

第一批 allowlist 只包含 `100000000` 和 `100000100`。构建适配器从以下 CMS 数据表读取记录：

- `[struct]Map`。
- `[group]Back`、`[group]Tile`、`[group]Obj`、`[group]Foothold`、`[group]Portal`。
- 被引用的 `[struct]Tileset`、`[struct]Back`、`[struct]Obj` 定义。
- 上述定义引用的 `[resource]图/Back`、`[resource]图/Tile`、`[resource]图/Obj` PNG。
- `cms-portal` 游戏画面所需的 Portal 资源（如果资源来源可在仓库或授权输入中确认）。

构建器必须按记录引用计算闭包，检查缺失引用、重复 Content identity、资源 MIME、PNG 解码尺寸、SHA-256 与确定性。禁止递归打包整个 `[FSDB]cms`，禁止发布 WZ/客户端文件、研究资料、临时工作目录或未经确认的外部资源。

### 5.2 派生 Map Scene Plan

建议新增版本化、只读的 `MapScenePlanV1` Content Record，暂定身份：

```text
kind      = record
namespace = struct.AdventureMapScenePlan
key       = <mapId>
```

每张地图一个 Plan。它是从 CMS 源记录投影出的运行时数据，不是新的 WZ 格式，也不把原始 CMS 记录直接塞进 RenderNode。建议至少包含：

```js
{
  formatVersion: 1,
  mapId: "100000000",
  bounds: { left, top, right, bottom },
  backgrounds: [/* front, placement, parallax, versioned resource refs */],
  layers: [
    {
      layer: "0",
      tileSet: "woodMarble",
      tiles: [/* draw-ready tile placements */],
      objs: [/* draw-ready object placements */]
    }
  ],
  footholds: [/* validated segment records */],
  portals: [/* validated portal records */]
}
```

Plan 中每个实际绘制资源都应引用 `namespace/key/contentVersion`，并包含必要的 source rectangle、Canvas 尺寸、origin 和 z 信息；具体字段需与组件实现文档一起冻结。不要要求 Web Component 再读取 `struct.Tileset` 或 `struct.Obj` 等 CMS 结构表。

### 5.3 RenderNode 数据预算

`cms-actor` 的 `AvatarPlan` 有 262,144 字节的 RenderNode.data 上限。地图不能简单地把整个 MapScenePlan 放进单个节点。运行时应把 Plan 拆分为：

- `cms-scene-view.data`：Bounds 和可选 Foothold/Rope 调试几何。
- 每个 `cms-map-layer.data`：该层自己的 `tiles` 与 `objs` 数组。
- 每个 `cms-back` / `cms-portal`：少量 attrs，data 默认空。
- `cms-actor.data`：保持原 AvatarPlan，不与地图数据混合。

构建/投影测试必须对最终 compact UTF-8 JSON 字节数做测量，逐节点验证 LoomRealm Render Update V1 限制；不得只比较 JavaScript 字符串长度。若任一层超过协议限制，先拆分渲染批次或 Content 数据，不得放宽框架上限。

### 5.4 Portal 资源现状

现有 `cms-portal/DESIGN.md` 指向 `MapHelper.img/portal/game` 的 `pv` 动画；但当前 `content/[FSDB]cms/[resource]图` 根目录可见的资源子目录是 `Back/Look/MiniMap/Obj/Tile`，没有 `MapHelper`。因此 Portal 游戏动画资源闭包目前是**待确认项**。MVP 不得把 `portal/editor` 编辑器图标冒充游戏画面；若暂时拿不到合法游戏资源，应选择明确的无贴图/简化标记方案并在验收中标注，或将 Portal 视觉列为阻塞，不得悄悄引用不存在的 Content。

## 6. Adventure Field Runtime

### 6.1 运行时状态

静态地图 Plan 与可变游戏状态必须分开。建议的最小状态：

```js
{
  mapId: "100000000",
  player: {
    x: 0, y: 0,
    vx: 0, vy: 0,
    facing: "right",
    locomotion: "stand",
    grounded: false,
    footholdId: null
  },
  camera: { x: 0, y: 0 },
  transition: { status: "idle", targetMapId: null }
}
```

状态由 `libs/adventure-field` 的纯函数更新。Subsystem 是唯一运行时编排者，不能让 `cms-actor`、`cms-map-layer` 或 DOM 节点保存第二份权威位置。

### 6.2 Tick 与确定性

- 运动应使用固定时间步长和累积器，避免把浏览器帧间隔直接作为物理积分步长。
- 暂定目标 60 Hz；每帧限制最大补算步数，避免后台恢复时出现无限追赶。具体数值在性能测试后确定。
- Tick 驱动必须使用固定 LoomRealm gitlink 中真实存在的 Frame/Clock/Render API。当前 `adventure-map` 只依赖 Controls、Viewport 和 RenderDomain；在确认 pinned API 前，不得在 Subsystem 中自造 `requestAnimationFrame`、`setInterval` 或 DOM 事件循环。
- 相同初始状态和相同输入序列应产生相同的 Field State；时间来源和输入边沿必须可在 Node 测试中注入。

### 6.3 Controls 映射

继续复用现有 common-controls，不监听 DOM、不重新实现 held-key tracker。建议第一版规则：

| 输入 | 规则 |
|---|---|
| `left` / `right` | 设置水平目标方向，更新 `facing`，地面/空中按运动模型改变 `vx` |
| `up` 按下边沿 | 仅在允许跳跃的状态触发一次跳跃；按住不重复起跳 |
| `down` | MVP 暂不实现穿平台；保持无动作或仅供后续下落平台设计使用 |
| 无方向 | 地面应用阻力减速；空中不强制清零水平速度 |

必须区分方向 State 和按下/释放边沿；跳跃不能因每次 State 刷新而重复触发。多方向同时按下的优先级沿用 pinned tracker 的输出，不另写第二套状态机。

### 6.4 Foothold 几何与碰撞

Foothold 是地面接触与平台连接的权威数据，Tile 只是视觉资源。第一版建议：

1. 建立按地图 `layer/platform/id` 索引的 Foothold 集合，并验证 `prev/next` 引用是否存在或为合法空值。
2. `x1 != x2` 的线段可作为水平/斜坡候选地面；用线性插值计算给定世界 X 的地面 Y。
3. 角色下落时检测脚底轨迹与候选线段的向下穿越，选择最早有效接触点，落地后设置 `grounded=true` 与 `footholdId`。
4. 沿平台移动时使用 `prev/next` 处理相邻段；端点交接要有确定性排序和容差，避免段间抖动。
5. `x1 == x2` 的垂直线不作为普通地面；其墙体/边界语义先保留并记录诊断，不在第一版假定它是可站立平台。
6. `force`、`forbidFallDown` 和平台跨层规则先原样保留。语义没有被测试或逆向证据确认前，不根据字段名猜测其行为。
7. 首版采用明确的脚底接触模型；角色横向宽度、墙体碰撞、穿平台和下落平台作为后续独立能力，不把点接触测试描述为完整角色碰撞。

建议先覆盖水平平台、斜坡、平台端点、从平台边缘走落、向下穿越平台和无可落地平台等单元测试。对垂直线、特殊 flag 和复杂多层重叠场景建立 fixture，未实现的情况应显式返回 unsupported/diagnostic，而不是静默套用水平地面规则。

### 6.5 Physics 参数

`content/[FSDB]cms/[struct]Physics/default.json` 当前包含 `walkForce`、`walkSpeed`、`walkDrag`、`slipForce`、`slipSpeed`、`gravityAcc`、`fallSpeed`、`jumpSpeed`、`maxFriction`、`minFriction` 等参数。

这些值是参数来源，不等于单位、积分顺序和客户端公式已经确认。实现前需要：

- 对照 Task 050/Task 060 及已有客户端逆向证据，记录每个字段的证据等级。
- 用简单地面、斜坡、跳跃高度、空中时间和最大下落速度建立可重复测量。
- 先冻结自研简化模型的单位和转换，再将 CMS 参数映射到模型。
- 不把 `walkForce=140000` 或 `gravityAcc=2000` 直接当作 px/s 或 px/s²，除非测试证实该解释。

## 7. Portal 与地图切换

### 7.1 解析规则

Portal 的 `pn` 是当前出口名，`pt` 是类型，`x/y` 是位置，`tm` 是目标地图，`tn` 是目标地图中的 Portal 名。地图运行库必须通过 `(tm, tn)` 找到目标地图 Plan 和目标 Portal；不能把当前 Portal 的坐标直接当作目标出生点。

MVP 只激活以下连接：

| 当前地图 | 当前 Portal | 目标地图 | 目标 Portal |
|---|---|---|---|
| `100000000` | `in00` | `100000100` | `out00` |
| `100000100` | `out00` | `100000000` | `in00` |

其他出口可保留在 MapScenePlan 中供后续扩展，但若目标地图不在本次 Bundle 或目标 Portal 不存在，则标记为不可用，不触发切换。

### 7.2 触发区域

`hRange/vRange` 只在少量 Portal 记录出现，不能假设所有出口都有完整触发尺寸。首版需要在设计和测试中明确一套项目触发区域（例如以 Portal 坐标为中心的可配置 AABB），并将它与原始字段区分保存。触发尺寸不是已确认的 CMS079 原始语义。

Portal 检测属于 Field Runtime；`cms-portal` 只负责画面。触发必须有冷却/锁，避免进入目标地图后立刻触发反向出口。

### 7.3 原子切换

切换步骤：

1. 锁定当前 transition，忽略重复触发。
2. 从 Content 读取并校验目标 MapScenePlan；确认目标 Portal `tn` 存在。
3. 准备目标地图渲染树数据、Foothold 索引和 Camera Bounds；准备失败时保留旧地图和旧玩家状态。
4. 计算目标落点。初始建议使用目标 Portal 的世界 `x/y`，再按验证后的 Foothold 规则吸附到可站立位置；吸附容差必须显式配置并测试。
5. 一次性提交 `mapId`、MapScenePlan、Foothold 索引、玩家坐标/速度/立足线和 Camera 状态。
6. 更新 RenderDomain：替换背景、地图层、Portal 和场景 Bounds；`cms-avatar-layer` 与 `cms-actor` 的 key 保持不变。
7. 清除 transition lock；设置短暂重触发保护。

任何步骤失败都不能留下半切换状态。首版不发送 `CHANGE_MAP` 网络封包；这只是本地地图场景切换。

## 8. 分阶段交付

| 阶段 | 交付 | 暂不包含 | 完成门槛 |
|---|---|---|---|
| P0：数据契约与闭包 | MapScenePlanV1、两地图显式 allowlist、资源引用校验、Bundle 确定性 | 浏览器绘制 | 两张地图所有必需引用闭合；重复构建字节一致；缺资源 fail closed |
| P1：静态 Scene Rendering | `cms-scene-view/back/map-layer/avatar-layer/portal` 最小可用实现；射手村真实地图和 Actor | 物理移动、Portal 触发 | 背景/Tile/Obj 的坐标、origin、z 与像素样本正确；节点数量不随 Tile/Obj 数增长 |
| P2：World Coordinates & Camera | Actor 世界坐标、Camera Bounds/夹取/Viewport resize | 完整物理 | resize 不改变玩家世界状态；Camera 变换和 Bounds 像素测试通过 |
| P3：Foothold Movement | 固定 Tick、左右行走、跳跃、重力、落地、斜坡 | 绳梯、穿平台、复杂墙体 | 射手村指定路线无穿地；确定性 Node 测试与 Chromium 操作通过 |
| P4：Portal Transition | `in00 ↔ out00` 双向原子切换 | 其他地图和特殊 Portal | 两地图往返、目标落点、重复触发保护、失败回滚通过 |

阶段 P0/P1 可以先独立验收，不必等待物理完成。P2/P3 不得用改变 Actor 屏幕中心的方式伪造世界移动。

## 9. 测试与验收策略

### 9.1 数据与构建测试

- 严格 JSON / JSONL 解析；空行、坏行、重复 id、错误类型、缺字段均有明确策略。
- MapScenePlan 的字段、引用、Bounds、图层号、Portal 目标和 Foothold `prev/next` 做结构校验。
- 每个 PNG 的 namespace/key/MIME/contentVersion/解码尺寸与引用矩形一致。
- 只包含两张地图及其传递引用；没有整个 CMS FSDB、WZ、客户端文件或研究目录。
- Bundle 在相同输入下字节级确定；资源缺失、重复 identity、版本冲突和越界引用均 fail closed。
- 逐个 RenderNode 测量 compact UTF-8 data 大小，不超过固定 LoomRealm 协议限制。

### 9.2 Field Runtime 单元测试

- 固定 Tick 下相同输入序列产生相同状态。
- 左右加速、松键减速、空中水平控制、跳跃边沿和跳跃冷却。
- 水平平台、斜坡、端点连接、prev/next、平台掉落、向下穿越和无效几何。
- Foothold id 丢失、地图切换时清除旧接触状态、边界值和非有限数 fail closed。
- Camera Bounds、Viewport 小于/大于地图、地图比视口小、resize 不修改玩家坐标。
- Portal 目标不存在、目标 Portal 不存在、重复触发、加载失败回滚和成功往返。

### 9.3 Browser / PWA E2E

- 通过正式 `bootstrapWebPresentation()` 和真实 Content API 加载地图组件与 PNG。
- 使用可信键盘输入驱动 Controls；不使用合成 `KeyboardEvent` 伪造设备输入。
- 验证地图真实绘制、Actor 像素、镜头跟随、人物站立/行走/跳跃/落地、两地图传送。
- 对照固定像素样本检查 Tile 拼接、Obj 原点、背景视差、图层顺序和透明度。
- Frame cancel/failure 时释放 Controls Consumer、Viewport 订阅、RenderDomain 和组件资源。
- 运行现有 `npm test`、PWA Bundle、PWA staging 和浏览器 E2E 回归。

## 10. 风险与待评审决策

| 项目 | 当前事实/风险 | 设计处理 |
|---|---|---|
| 自研 Map FSDB 章节 | `content/adventure_design.md` 地图章尚未定义 | MVP 先用 CMS FSDB 构建期投影；长期 schema 另行评审 |
| LoomRealm Tick API | 当前 Subsystem 未使用游戏物理 Tick | 先核对固定 gitlink 的 Frame/Clock API；不自造浏览器定时器 |
| Camera 坐标约定 | 现有 DESIGN 只定义 `x/y` 为 Camera 坐标，原点/符号需冻结 | 实现前补充唯一坐标契约与像素测试 |
| Physics 参数单位 | `Physics/default` 数值已存在，但完整积分公式/单位未确认 | 建立校准 fixture，标注证据等级 |
| Foothold 特殊标志 | `force/forbidFallDown` 的客户端行为尚未完全还原 | 原样保留，首版不猜测语义 |
| Portal 触发范围 | 多数 Portal 没有 `hRange/vRange` | 首版定义项目 AABB；明确不是原始客户端算法 |
| Portal 视觉资源 | 当前 FSDB 图资源树未包含 `MapHelper` | 找到合法资源或明确简化/阻塞；不使用编辑器图标冒充游戏画面 |
| `zM` 人物遮挡 | 现有首版树把 Actor 放在地图层之后 | MVP 记录限制；后续根据证据设计对象前后分带 |
| Map Link | `info/link` 会让地图绘制内容引用另一张地图 | Map Adapter 构建期解析并校验链接，不能递归无界读取 |
| Bundle 体积 | Tile/Obj/Back 引用会带来大量 PNG | P0 先测量实际闭包字节数，再确定缓存/体积预算 |

以下问题应在 P0 评审时明确：

1. 是否接受以 CMS FSDB 为构建输入、以 MapScenePlanV1 为运行时契约；还是先完成 `adventure_design.md` 的地图 FSDB 章再实施？本草案推荐前者。
2. Portal 缺少 `MapHelper` 游戏动画资源时，MVP 是否允许无贴图标记，还是必须先补齐资源？
3. Camera `x/y` 是否采用世界视口左上角约定？
4. 固定 LoomRealm 是否提供合适的 Frame Tick/Clock 能力；若没有，应该扩展哪个正式契约，而不是在 Subsystem 内绕过框架？
5. 首版 Foothold 是否只支持脚底点接触与水平/斜坡平台？本草案推荐明确限制并保留诊断。

## 11. 建议的后续 Issue 拆分

评审通过后再创建实现 Issue，建议按依赖拆成：

1. **P0 — MapScenePlanV1 与双地图 Content Closure**：数据适配、资源闭包、确定性 Bundle、引用完整性测试。
2. **P1 — CMS Map Scene Components**：`cms-scene-view`、`cms-back`、`cms-map-layer`、`cms-avatar-layer`、`cms-portal` 浏览器实现与像素测试。
3. **P2/P3 — Adventure Field Runtime**：世界坐标、Camera、固定 Tick、Foothold 索引和基础运动。
4. **P4 — Portal Transition**：目标地图解析、落点、原子切换和双向 E2E。

每个 Issue 只实现一个可独立验收的垂直切片；不得在同一任务里顺带升级 LoomRealm pin、重跑 WZ 转换、修改 AvatarPlan ABI 或引入全量地图资源。

## 12. 相关资料

- [`docs/game-entry.md`](../game-entry.md)
- [`docs/implementation/2026-11-06-base-adventure-map-actor-slice-draft.md`](./2026-11-06-base-adventure-map-actor-slice-draft.md)
- [`docs/implementation/2026-11-06-cms079-playable-content-plan.md`](./2026-11-06-cms079-playable-content-plan.md)
- [`content/adventure_design.md`](../../content/adventure_design.md)
- [`components/README.md`](../../components/README.md)
- [`components/cms-scene-view/DESIGN.md`](../../components/cms-scene-view/DESIGN.md)
- [`components/cms-back/DESIGN.md`](../../components/cms-back/DESIGN.md)
- [`components/cms-map-layer/DESIGN.md`](../../components/cms-map-layer/DESIGN.md)
- [`components/cms-avatar-layer/DESIGN.md`](../../components/cms-avatar-layer/DESIGN.md)
- [`components/cms-portal/DESIGN.md`](../../components/cms-portal/DESIGN.md)
- [`components/cms-actor/IMPLEMENTATION.md`](../../components/cms-actor/IMPLEMENTATION.md)
- [`research/task/060-map-wz-extraction.md`](../../research/task/060-map-wz-extraction.md)
- [`research/result/task050-behavior-flows.md`](../../research/result/task050-behavior-flows.md)
