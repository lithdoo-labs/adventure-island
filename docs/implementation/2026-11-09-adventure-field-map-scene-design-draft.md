# Adventure Field & Map Scene Runtime 设计草案

> **状态：Draft。** 2026-11-09 评审已经收口绘制契约。同日把完成定义扩到三张地图上的行走、跳跃、蹲下、游泳，以及沿井口往返。本文定义目标架构和验收门槛；这些功能还没有实现。
>
> **修订：** [2026-11-09 Adventure Field 设计评审修订](../reviews/2026-11-09-adventure-field-design-revision.md)。逻辑记录以 [MAP-SCENE-PLAN-V1.md](../../components/MAP-SCENE-PLAN-V1.md) 为准。
>
> **子契约状态：Adventure Island RenderNode ABI v1 已冻结。** 组件标签及其 attrs/data/children/events 以 [RENDER-NODE-ABI-V1.md](../../components/RENDER-NODE-ABI-V1.md) 为唯一规范。本文不改这套数据结构。架构、运行时和验收内容仍为 Draft。
>
> 日期：2026-11-09  
> 设计分支：`design/adventure-field-map-scene`  
> 基线：`main@554494452933b19de67db44dd8a0f38190df7d25`  
> LoomRealm gitlink：`93648192323bf5f57996b7b54cbae641d8a53fdb`（保持固定，不随本设计升级）

## 0. 摘要与建议决策

当前 `main` 已完成 Base → Adventure Map → `cms-actor` 的 PWA 垂直切片：正式 Game Entry、统一 Controls、只读 AvatarPlan Content、人物绘制和生命周期清理已经接通。当前 `systems/adventure-map/subsystem.mjs` 仍是角色展示运行时：方向输入改变 `locomotion/facing`，人物 `x/y` 根据 Viewport 居中；它没有世界坐标、地图绘制、物理 Tick、Foothold 碰撞、Camera 或地图切换。

下一阶段建议命名为 **Adventure Field & Map Scene Runtime**，沿用现有 `adventure-map` Subsystem，不增加第二个地图入口。核心决策：

1. **保留 `cms-actor` 的职责和 ABI。** 它继续只绘制人物；位置、运动和场景归属由 Field Runtime 决定。
2. **第一批验证童话村、井和水底。** 地图是 `222000000`、`222000001`、`230030200`。完成定义包括这三张图上的行走、跳跃、蹲下、游泳，以及沿井口往返。
3. **把纯游戏规则放进独立的 `libs/adventure-field/`。** `systems/adventure-map/` 负责 LoomRealm Frame、Controls、Content 和 RenderDomain 编排；纯函数库不依赖 DOM、LoomRealm 或浏览器 API。
4. **地图素材采用构建期显式闭包。** 从仓库已有 `[FSDB]cms` 记录生成版本固定的 Map Scene Plan 和 PNG Content；浏览器组件不直接读取 FSDB、WZ 或本地文件。
5. **沿用现有组件职责，先更新绘制语义。** 六个 MVP 组件的分工保持不变。排序、Bounds、背景支持范围、Portal 资源和帧时间按 2026-11-09 修订执行，再进入实现。
6. **运动用固定步长的纯函数，不宣称已经还原客户端积分。** `Physics/default` 提供参数。单位和积分尚未从客户端恢复。视觉组件不自建时钟。验收用注入的固定步长调用同一套函数。

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

### 1.3 第一批地图

验证地图取自当前 CMS079 `Map.wz`，不是后来版本里的 `224000000`。

| 地图 | 编号 | `mapMark` | `swim` | VR |
|---|---|---|---:|---|
| 童话村 | `222000000` | `Folkvillige` | 0 | 四个都有 |
| 井口 | `222000001` | `Folkvillige` | 0 | 四个都有 |
| 矩形地带 | `230030200` | `AquaRoad` | 1 | 没有 |

井口的 VR 宽是 800。客户端内缩各 400 之后，左右收成同一个 x。上下仍有高度。矩形地带没有 VR，边界走小地图或立足线回退。`info.swim` 为 1 的图使用游泳；为 0 的图使用行走、跳跃和蹲下。矩形地带还有 `decHP`，这次不把它做成持续掉血。

### 1.4 验证用的传送

只启用这条路线上的四扇门。源记录里没有 `hRange` / `vRange`，命中用客户端缺省 100 的一半。

```text
222000000 in00  pt=1  (-508, 244) → 222000001 st00
222000001 out00 pt=3  (-31, -463) → 222000000 in00
222000001 sea00 pt=1  (6, 513)    → 230030200 east00
230030200 east00 pt=1 (296, -98)  → 222000001 sea00
```

`pt` 1 和 `pt` 3 不加载 `pv`。逻辑门仍然可切换。没有游戏帧时不创建 `cms-portal`。井口的 `st00` 目标是 `999999999`，不作为换图门。矩形地带的 `west00` 指向 `230030100`，不在这次闭包里。

### 1.5 数据来源边界

`content/[FSDB]cms` 是转换来源。游戏读取 `content/[FSDB]adventure`。地图表见 [adventure_design.md](../../content/adventure_design.md) 第 4 章。构建期从转换库投影出自研表和 MapScenePlanV1。运行时和 Web Component 不读 CMS 表，也不读 WZ。

## 2. 目标、非目标与 MVP 定义

### 2.1 目标

- 能从 Adventure Content 加载童话村、井口和矩形地带的背景、Tile、Obj、Foothold、Portal。
- 使用像素世界坐标表示人物位置；人物坐标不再由 Viewport 居中计算。
- Camera 根据 Viewport 和 `effectiveBounds` 显示世界区域。跟随算法留到客户端函数恢复之后。产品夹取仍用视口左上角和 1:1。
- `swim` 为 0 时，人物能在立足线上行走、跳跃、下落、落地和蹲下。`swim` 为 1 时改为游泳，上下左右都改变速度，不再按地面跳跃。
- 沿第 1.4 节的四扇门切换场景。每次切换是一次 `replace`。
- PWA Bundle 只包含这三张地图的显式资源闭包；可重复构建且 Content Version 稳定。
- 固定步长的 Node 测试，以及用同一函数注入步长的浏览器测试，都可以复现。

### 2.2 非目标

- 在线服务器、网络同步、封包收发和多人状态。
- 怪物、NPC 对话、Reactors、Seat、绳梯、飞行、技能、任务和地图脚本。
- 矩形地带的 `decHP`、`west00`，以及这三张图以外的出口。
- 全量 CMS079 地图导入或全库无损性结论。
- 完整复刻客户端的所有物理细节、Foothold 特殊标志和 Portal 触发算法。
- 把 Tile/Obj/Portal 的规则写进 `cms-actor`。

### 2.3 MVP 完成定义

完成定义包括画面、运动和换图：

1. PWA 能进入童话村，而不是占位背景或单独的 Actor 展示页。
2. 产品锚定和产品绘制顺序正确。渲染树节点数随背景数和非空图层数增长，而不是随 Tile/Obj 数量增长。
3. 人物 `x/y` 是世界坐标。Camera 使用 `effectiveBounds` 夹取。Viewport resize 不改写玩家世界坐标。
4. 在 `222000000` 和 `222000001` 上，固定步长可以走出行走、跳跃、落地和蹲下。蹲下时水平速度归零，脚仍站在当前立足线上。
5. 在 `230030200` 上，同样的步长函数改为游泳：四个方向改变速度，不要求立足线。
6. 童话村 `in00` 进井，井口 `sea00` 进矩形地带，矩形地带 `east00` 回井，井口 `out00` 回村。落点是目标门的 `x/y`。`replace` 失败时保留旧地图。
7. 原有 Actor、Controls、PWA Bundle、生命周期和安全构建测试没有回归。

画面验收是产品呈现，不是客户端像素一致。运动验收是这套固定步长函数的确定性结果，不是已经还原的客户端积分。

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
| `systems/adventure-map/subsystem.mjs` | Frame 生命周期、Content 读取、Controls 消费、RenderDomain 投影、错误映射 | 直接解析 CMS 原始文件、实现几何算法、DOM 操作、自建 `setInterval` / `requestAnimationFrame` |
| `libs/adventure-field/`（拟新增） | 纯状态转换、Foothold 索引、移动积分、碰撞、Camera 计算、Portal 目标解析 | LoomRealm、DOM、网络、文件系统、定时器 |
| 构建期 Map Adapter | 读取固定 CMS FSDB 输入、校验引用、生成 MapScenePlan 和资源闭包 | 运行时状态、玩家运动 |
| `cms-scene-view` | 世界到 Viewport 的场景投影、Camera Bounds | Foothold 碰撞、Portal 触发 |
| `cms-map-layer` | 批量绘制一层 Tile/Obj | 地图加载、交互规则、人物移动 |
| `cms-back` | 按当前支持范围绘制背景 | Camera 跟随决策、未恢复的滚动公式 |
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

Adventure Island RenderNode ABI v1 已冻结以下约定：世界 Y 向下；Camera 的 `(x,y)` 是 Viewport 左上角对应的世界坐标；不提供 Camera zoom，世界像素与 CSS 像素按 1:1 映射；世界点 `(wx,wy)` 投影到屏幕点 `(wx-camera.x, wy-camera.y)`。坐标允许有限小数，Field Runtime 不为绘制而回写取整后的世界位置；如需 pixel snapping，只能是组件内部呈现细节，不能改变权威坐标。Renderer 的 viewport 信息由 `cms-scene-view` 适配，不能反向改变这份 ABI。

### 4.2 Bounds

闭合算法在 [MAP-SCENE-PLAN-V1.md](../../components/MAP-SCENE-PLAN-V1.md)。这里只固定职责。

四个 VR 都是有限数时，Adapter 计算客户端已确认的有效边界：左右各收 400，上下各收 300；某一轴结果小于等于 0 时，该轴两边收到两端之和的有符号中点，向零截断。`sourceBounds` 保留原始 VR，`effectiveBounds` 是调整结果。400 和 300 是函数立即数，不表示客户端视口已经证明为 800×600。

VR 不完整时不套用这组立即数。产品回退先用 minimap 中心和尺寸，再用 foothold 外接矩形并左右扩 10、上扩 360、下扩 110。第一批里，童话村和井口四个 VR 都在，走客户端内缩。井口水平跨度是 800，左右收到同一个 x。矩形地带没有四个 VR，走产品回退。射手村和集市的 `info` 也没有这四字段，它们不在这次闭包里。

`scenePlan.bounds` 等于 `effectiveBounds`。组件收到的边界不再做第二次内缩。Camera 夹取使用这份边界。地图比视口小时如何摆放仍待逆向；在跟随函数出现之前，产品可以采用居中留白，并标明这是产品约定。

Camera 跟随、dead zone、world-to-screen 和 DPR 待逆向。世界像素到 CSS 像素 1:1 是产品约定。三者分开记录，不合成一套已经逆向完成的 Camera。

`info/link` 指向其他地图时，Map Adapter 必须先解析链接目标的地图绘制内容，再生成当前 mapId 对应的场景计划；链接语义不能由组件猜测。

### 4.3 渲染顺序

下面是产品树顺序。客户端加载键已经恢复，比较方向仍待逆向。MVP 子集为：

1. `front=0` 的背景。
2. 非空地图层，按 `layer=0..7`。
3. `cms-avatar-layer`，其中保留唯一 `cms-actor`。
4. 本阶段启用的 `cms-portal`。
5. `front=1` 的近景背景。

NPC、Reactor、Seat 暂不创建。Foothold 和 Rope 不作为正式画面节点；需要诊断时由 `cms-scene-view` 的可选辅助线显示。

换场景时保留 `cms-scene-view`、`cms-avatar-layer` 与 `cms-actor` 的 key；所有地图专属子节点使用单调递增的 `sceneEpoch` 生成新 key，避免地图 A → B → A 时违反 Render Update v1 的 one-shot key 规则。

### 4.4 Tile 与 Obj 绘制

- 一个非空地图层对应一个 `cms-map-layer`；不得为每个 Tile/Obj 创建 RenderNode 或 Web Component。
- Tile 使用 `Tile/{tileSet}` 中的真实 Canvas 尺寸、`origin` 和画布 `z`；位置是像素放置，不是统一格子。放置记录保留 `zM` 和源顺序。Obj 保留放置 `z`、`zM`、`flip` 和源顺序。
- 客户端已确认 Tile 键使用画布 `z` 与放置 `zM`，Obj 键使用放置 `z` 而不使用 `zM`。两条键的基准常数不同。比较方向和相同键次序待逆向。Adapter 把键写入 MapScenePlan 的 `clientSortKey`，供诊断和以后的像素对照。
- 产品绘制顺序保持：Obj 组先于 Tile 组；Obj 按 `z` 升序；Tile 按 `canvasZ` 升序；同值保持源顺序。这个顺序来自 HaCreator，必须标注为产品约定。P1 的像素验收只证明产品顺序，不证明客户端比较器。
- 四张没有画布 `z` 的 Tile Canvas 不得把 `canvasZ` 默认为 0。引用它们的记录是 unsupported，不进入 `MapLayerPlanV1`。
- `zM` 继续进入视觉放置记录。MVP 仍把 Actor 放在地图层之后，人物和 Obj 的深度穿插尚未实现。`reactor/name` 留在逻辑记录。`r` 不是 0，或存在 `flow` 时，Adapter 报告 unsupported。

### 4.5 Background

`cms-back` 每个背景放置项一个节点。Adapter 将源字段 `bS/no/ani/x/y/rx/ry/type/cx/cy/f/a` 映射到 ABI v1 的对应 attrs。源 `front` 只决定远景段或近景段，不投影为 attrs。`front` 参与客户端加载键，比较方向待逆向。

客户端已确认 type 0–3 走普通分支，type 4 与 6 按 `rx` 水平滚动，type 5 与 7 按 `ry` 垂直滚动，滚动步长为 `20000 / |rate|`。`+0x98` 的参数顺序已经确认，方法体和时间单位仍待逆向。P1 只静态绘制 type 0，不解释 `rx/ry`，不把 type 1–7 标成已实现。`cx` 是水平步长，`cy` 是垂直步长；值为 0 时客户端不改用画布宽高，产品也不替换成图像尺寸。

帧缺少 `delay` 时停留。`Back/grassySoil.img/ani/0` 有 10 帧且都没有 `delay`，呈现为第一帧静止。`loop: true` 不补帧时间。带 `delay` 的帧也先保留数值，P1 不自动推进，因为产品时钟和客户端时间单位都还没有。

## 4.6 公共 RenderNode ABI（Frozen）

Adventure Island 的公共 RenderNode 接口已独立冻结为 [components/RENDER-NODE-ABI-V1.md](../../components/RENDER-NODE-ABI-V1.md)。该文件是组件标签、attrs/data、children、事件、资源引用和场景树顺序的唯一规范来源；本设计草案不再复制一份可能漂移的字段表。

冻结范围包括：

- LoomRealm `RenderNodeV1` 五字段在 Adventure Island 中的使用方式；
- MVP 六个标签：`cms-scene-view`、`cms-back`、`cms-map-layer`、`cms-avatar-layer`、`cms-actor`、`cms-portal`；
- 每个标签的闭合 attrs/data schema、子节点约束和事件语义；
- `LogicalResourceRefV1`、资源版本校验和 Actor key 跨地图稳定规则；
- 视觉组件与 Adventure Field Runtime 权威状态的边界。

上游 LoomRealm 的 Render Update v1 和 Web Presentation API v1 在当前 gitlink pin 上已经冻结；Adventure Island ABI 是建立在它们之上的产品级契约。两者不能混称为同一层协议。NPC、Reactor、Seat、Mob 不在本次 MVP ABI 中，后续必须分别设计和验收。

## 5. Map Content 与 PWA Bundle

### 5.1 构建期闭包，不在浏览器读取 FSDB

当前 PWA Bundle Builder 有明确输入白名单、确定性排序、SHA-256 Content Version、引用闭包验证和路径安全约束。地图接入必须扩展同一 Builder，而不是另建绕过白名单的资源复制脚本。

第一批 allowlist 只包含 `222000000`、`222000001` 和 `230030200`。构建适配器从转换库读取这些地图，写入 `content/[FSDB]adventure` 第 4 章，再投影 MapScenePlan。源表是：

- `[struct]Map`。
- `[group]Back`、`[group]Tile`、`[group]Obj`、`[group]Foothold`、`[group]Portal`。
- 被引用的 `[struct]Tileset`、`[struct]Back`、`[struct]Obj` 定义。
- 上述定义引用的 `[resource]图/Back`、`[resource]图/Tile`、`[resource]图/Obj` PNG。
- 已提取并转成 Content Resource 的 `MapHelper` 游戏画面。原始路径已经确认；当前 FSDB 还没有这份资源，闭包在提取完成前不引用它。

构建器必须按记录引用计算闭包，检查缺失引用、重复 Content identity、资源 MIME、PNG 解码尺寸、SHA-256 与确定性。禁止递归打包整个 `[FSDB]cms`，禁止发布 WZ/客户端文件、研究资料、临时工作目录或未经确认的外部资源。

### 5.2 派生 Map Scene Plan

MapScenePlanV1 的闭合字段、缺字段策略、诊断码和投影边界以 [MAP-SCENE-PLAN-V1.md](../../components/MAP-SCENE-PLAN-V1.md) 为准。Content 身份暂定：

```text
kind      = record
namespace = struct.AdventureMapScenePlan
key       = <mapId>
```

每张地图一个 Plan。它是从 CMS 源记录投影出的运行时逻辑数据，不是新的 WZ 格式，也不把原始 CMS 记录直接塞进 RenderNode。根上至少有 `formatVersion`、`mapId`、带 `sourceBounds` 与 `effectiveBounds` 的 `bounds`、`backgrounds`、`layers`、`footholds` 和 `portals`。

Plan 中每个实际绘制资源都引用 `namespace/key/contentVersion`，并包含 source rectangle、Canvas 尺寸和 origin。Tile 另有画布 `canvasZ`，缺 `z` 时整张 Plan 不发布。投影到 RenderNode 的字段由 [RenderNode ABI v1](../../components/RENDER-NODE-ABI-V1.md) 冻结。`clientSortKey` 和 bounds 来源留在 Plan，不进入组件 data。Web Component 不读取 `struct.Tileset` 或 `struct.Obj`。

### 5.3 RenderNode 数据预算

LoomRealm Render Update v1 **没有通用的 `RenderNode.data` 字节上限**。现有 `cms-actor` 的 `AvatarPlanV1` 将 262,144 compact UTF-8 字节作为自身的应用层 validator 上限；该数字不是 LoomRealm wire protocol 限制。地图不得沿用这个数字作为未经测量的通用限制。

运行时按冻结 ABI 将地图 Plan 投影为独立节点：

- `cms-scene-view.data`：`scenePlan.bounds` 和可选 Foothold/Rope 调试几何。
- 每个 `cms-map-layer.data`：该层自己的 `mapLayerPlan.assets/tiles/objs`。
- 每个 `cms-back.data` / `cms-portal.data`：分别携带 `backPlan` / `portalPlan`（帧、原点和版本化资源引用）。
- `cms-avatar-layer`：空 attrs/data，只保留子树容器职责。
- `cms-actor.data`：保持原 `avatarPlan`，不与地图数据混合。

在这三张 allowlist 地图上测量每个最终 RenderNode.data 的 compact UTF-8 字节数、数组规模、引用资源数、解码并发和峰值内存，再决定 MapLayerPlanV1 / BackPlanV1 / PortalPlanV1 的应用层容量策略。测量必须按实际序列化字节进行，不得以 JavaScript 字符串长度代替。若超出之后制定的产品预算，应拆分 Content/渲染批次或缩减计划；不得把产品预算描述成 LoomRealm 协议上限。

### 5.4 Portal 资源现状

客户端资源选择已经确认。`pt` 2、4、7 读取 `Map/MapHelper.img/portal/game/pv`；10、11 读取实例 `image`，空值用 `default`；0、1、3、5、6、8 不加载 pv，逻辑记录的 `visual` 是 `none`；9、12 不发布；13 的使用路径读取 `Effect/BasicEff.img/VerticalJump`，也不发布成 pv。井口 `out00` 是 `pt` 3，没有画面，切换仍然成立。原始 WZ 含有 `MapHelper.img` 和 818 张 Canvas。`pv/0` 的 origin 是 `(43, 173)`，没有 `z` 和 `delay`。

当前 `content/[FSDB]cms/[resource]图` 没有 `MapHelper`。缺口是 Content 闭包，不是原始路径不存在。资源要经过提取、校验、转成 Content Resource、写入 allowlist，再用游戏画面验收。没有这些帧时不创建 `cms-portal`，逻辑 Portal Record 仍留在 Plan。禁止用 `portal/editor` 的 `sp/pi` 充当游戏画面，也不使用无贴图标冒充已验收的 PortalPlan。

`tm` 和 `tn` 已在实例加载函数中读取。`tm == 999999999` 时客户端使用函数直接返回。同图时 `tn` 匹配另一个 portal 的 `pn`。跨图调用收到 `pn`，目标地图写入仍待逆向。Field Runtime 继续持有 `(tm, tn)` 这一产品级目标解析，不把未还原的落点写入当成已经完成的换图。

## 6. Adventure Field Runtime

### 6.1 运行时状态

静态地图 Plan 与可变游戏状态必须分开。建议的最小状态：

```js
{
  mapId: "222000000",
  swim: 0,
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

`swim` 来自当前地图的 `info.swim`，换图时随地图更新。`locomotion` 取 `stand`、`walk`、`jump`、`prone`、`swim`。状态由 `libs/adventure-field` 的纯函数更新。Subsystem 是唯一运行时编排者，不能让 `cms-actor`、`cms-map-layer` 或 DOM 节点保存第二份权威位置。

### 6.2 Tick 与确定性

固定 gitlink `93648192323bf5f57996b7b54cbae641d8a53fdb` 的 `Frame` 只有 `id`、`params`、`signal` 和 `call`。`SubsystemScope` 提供 SharedState、SessionEvent、Content、Viewport、PresentationEvent 和 `createRenderDomain`，没有帧时间戳、帧间隔、游戏时钟或 Tick 订阅。PWA 平台上的 `scheduler.schedule()` 没有暴露给 Subsystem。

运动仍然做。步长由测试或宿主调用注入，函数本身不读取时钟。`libs/adventure-field` 提供 `step(state, input, dt)`。相同初始状态、相同输入和相同 `dt` 得到相同状态。Subsystem 和视觉组件都不自建 `requestAnimationFrame`、`setInterval` 或第二套游戏时钟。当前 pin 没有 Frame Clock，所以浏览器里的连续走动也调用这个函数，不另写一套物理。补算上限和暂停留到上游 Clock 评审。

Viewport 的现有接口是逻辑尺寸和订阅。`loomrealm.viewport-state/1` 仍是 Not Implemented / Not Qualified。Camera 可以按这个接口设计夹取，尺寸传递必须另做 resize、carrier 重连、无效尺寸和 Runtime 终止测试。Viewport 不提供游戏时间，不能当作 Tick。

时钟落地之后，运动仍使用固定时间步长和可注入的时间源。相同初始状态和相同输入序列应产生相同的 Field State。目标频率和最大补算步数到那时再冻结。

### 6.3 Controls 映射

继续复用现有 common-controls，不监听 DOM、不重新实现 held-key tracker。建议第一版规则：

| 输入 | 规则 |
|---|---|
| `left` / `right` | 地面时行走并更新 `facing`。空中保留水平控制。游泳时改水平游速 |
| `up` 按下边沿 | `swim` 为 0 且站在立足线上时跳一次。按住不重复起跳。游泳时改为向上的速度 |
| `down` | 站在立足线上时进入蹲下，水平速度归零，不穿平台。游泳时改为向下的速度 |
| 无方向 | 地面减速。蹲下保持原地。空中不强制清零水平速度。游泳时减速 |

必须区分方向 State 和按下/释放边沿；跳跃不能因每次 State 刷新而重复触发。多方向同时按下的优先级沿用 pinned tracker 的输出，不另写第二套状态机。

`cms-actor` 的 `locomotion` 使用上面五个值。`prone` 画身体动作 `prone`。`avatar.part.body.00002000` 没有名为 `swim` 的动作，有 `fly`（第 0、1 帧，`delay` 300）。姿态字节还原前，`swim` 画 `fly`。这是产品约定。

### 6.4 Foothold 几何与碰撞

`info.swim` 为 0 时，人物沿立足线行走、跳跃和蹲下。蹲下把水平速度写成 0，脚留在当前立足线上，不向下穿平台。为 1 时，四个方向改变速度，不要求立足线，也不起跳。两种模式共用 `step(state, input, dt)`。`Physics/default` 的 `swimForce`、`swimSpeed`、`swimSpeedDec` 是游泳参数。单位和客户端积分仍待逆向。

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

`content/[FSDB]cms/[struct]Physics/default.json` 当前包含 `walkForce`、`walkSpeed`、`walkDrag`、`slipForce`、`slipSpeed`、`gravityAcc`、`fallSpeed`、`jumpSpeed`、`maxFriction`、`minFriction`，以及 `swimForce`、`swimSpeed`、`swimSpeedDec`。

这些值是参数来源，不等于单位、积分顺序和客户端公式已经确认。实现前需要：

- 对照 Task 050/Task 060 及已有客户端逆向证据，记录每个字段的证据等级。
- 用简单地面、斜坡、跳跃高度、空中时间和最大下落速度建立可重复测量。
- 先冻结自研简化模型的单位和转换，再将 CMS 参数映射到模型。
- 不把 `walkForce=140000` 或 `gravityAcc=2000` 直接当作 px/s 或 px/s²，除非测试证实该解释。

## 7. Portal 与地图切换

### 7.1 解析规则

Portal 的 `pn` 是当前出口名，`pt` 是类型，`x/y` 是位置，`tm` 是目标地图，`tn` 是目标地图中的 Portal 名。地图运行库必须通过 `(tm, tn)` 找到目标地图 Plan 和目标 Portal；不能把当前 Portal 的坐标直接当作目标出生点。

MVP 只激活第 1.4 节的四扇门：

| 当前地图 | 当前 Portal | 目标地图 | 目标 Portal |
|---|---|---|---|
| `222000000` | `in00` | `222000001` | `st00` |
| `222000001` | `out00` | `222000000` | `in00` |
| `222000001` | `sea00` | `230030200` | `east00` |
| `230030200` | `east00` | `222000001` | `sea00` |

井口 `st00` 的 `tm` 是 `999999999`，不换图。矩形地带 `west00` 指向 `230030100`，目标不在这次 Bundle 里，`enabled` 为 false。其他出口可留在 MapScenePlan 中，目标地图或目标名字不存在时不触发切换。

### 7.2 触发区域

这四扇门的源记录没有 `hRange` 和 `vRange`。客户端缺字段时压入 100，命中矩形用这个值的一半，所以半宽和半高是 50。Field Runtime 在读取时使用这个缺省，不把 100 写进 FSDB 行，也不写进 MapScenePlan 的可选字段。动画查找用的固定框 `x±100`、`y±50` 是另一条函数，不拿来做换图命中。

Portal 检测属于 Field Runtime；`cms-portal` 只负责画面。触发必须有冷却，避免进入目标地图后立刻触发反向出口。

### 7.3 原子切换

`replace()` 替换整棵 RenderDomain 状态。`update()` 只能改已有节点的 attrs/data，不能改 children。地图切换必须调用 `domain.replace(nextRenderDomainState)`。

可以保证的一致性是：Field State 与本地 RenderDomain 状态一起提交。RenderManager 先提交本地权威状态，再异步发布 Render Snapshot。协议没有 Renderer ACK，也不保证 Web Component 已经完成图像解码。视觉失败后自动恢复旧地图不在当前协议里。

切换步骤：

1. 锁定当前 transition，忽略重复触发。
2. 从 Content 读取并校验目标 MapScenePlan；确认目标 Portal `tn` 存在，资源引用和诊断状态通过。
3. 在本地准备目标 Foothold 索引、effectiveBounds 和完整 RenderNode 树。准备失败时保留旧地图和旧玩家状态，不调用 replace。
4. 计算目标落点。同图路径曾把目标门的 `x` 和 `y-10` 传给后续函数，落点写入待逆向。产品落点使用目标门的 `x/y`。目标地图 `swim` 为 0 时，再按立足线规则吸附。吸附容差必须显式配置并测试。
5. 同步调用 `domain.replace(nextTree)`。调用失败则不提交 Field Runtime 的新状态。
6. replace 成功后，再提交 `mapId`、MapScenePlan、Foothold 索引、玩家坐标/速度/立足线和 Camera 状态。`cms-avatar-layer` 与 `cms-actor` 的 key 保持不变，场景专属节点使用新的 `sceneEpoch`。
7. 清除 transition lock；设置短暂重触发保护。

Render 传输和组件资源加载沿用各自现有生命周期。这次切换是本地权威状态的原子提交。协议不提供 Renderer ACK，也不保证图片已经解码。首版不发送 `CHANGE_MAP` 网络封包。切换属于这次的完成定义。

## 8. 分阶段交付

| 阶段 | 交付 | 暂不包含 | 完成门槛 |
|---|---|---|---|
| P0：数据契约与闭包 | MapScenePlanV1、三张地图显式 allowlist、资源引用校验、Bundle 确定性 | 浏览器绘制 | 三张地图所有必需引用闭合；重复构建字节一致；缺资源、缺 Tile `z`、未支持背景 type 均 fail closed |
| P1：静态 Scene Rendering | 场景组件的静态呈现；type 0 背景；有游戏 Portal 帧才画出口 | 物理、滚动背景、帧动画、Portal 触发 | 产品锚定和产品绘制顺序正确；节点数量不随 Tile/Obj 数增长。此门槛是产品呈现，不是客户端像素一致 |
| P2：World Coordinates & Camera | 产品 Camera、effectiveBounds 夹取、Viewport resize | 跟随函数 | resize 不改变玩家世界坐标；夹取使用 Plan 里的有效边界，组件不第二次内缩 |
| P3：地面与游泳 | 注入步长的 `step`：两张陆地的行走、跳跃、蹲下，矩形地带的游泳 | 绳梯、穿平台、复杂墙体；组件自建时钟；把 Physics 数值当成已证明的客户端单位 | 相同状态、输入和 `dt` 得到相同结果。Node 测试与浏览器调用同一函数 |
| P4：Portal Transition | 第 1.4 节四扇门各一次 `replace` | `west00`、`decHP`、这三张图以外的出口；全像素事务 | 往返落在目标门 `x/y`；`replace` 失败保留旧地图 |

阶段 P0/P1 可以先独立验收。P2 不得用改变 Actor 屏幕中心的方式伪造世界移动。P3 和 P4 属于这次完成定义。步长由调用方注入。Subsystem 和视觉组件不自建时钟。补算上限等待上游 Clock 评审。

## 9. 测试与验收策略

### 9.1 数据与构建测试

- 严格 JSON / JSONL 解析；空行、坏行、重复 id、错误类型、缺字段均有明确策略。
- MapScenePlan 的字段、引用、Bounds、图层号、Portal 目标和 Foothold `prev/next` 做结构校验。
- 每个 PNG 的 namespace/key/MIME/contentVersion/解码尺寸与引用矩形一致。
- 只包含三张地图及其传递引用；没有整个 CMS FSDB、WZ、客户端文件或研究目录。
- Bundle 在相同输入下字节级确定；资源缺失、重复 identity、版本冲突和越界引用均 fail closed。
- 逐个 RenderNode 测量 compact UTF-8 data 大小，并单独测量 MapScenePlan、资源闭包总字节、解码并发、峰值内存、Canvas 尺寸和资源工作集。这些是应用层测量。LoomRealm Render Update v1 没有通用 data 字节上限，不得把测量结果写成协议上限。`cms-map-layer` 使用视口尺寸 Canvas。射手村 `miniMap.width` 为 7174，这个宽度只说明不能用整幅世界 Canvas。射手村不在这次验证地图里。

### 9.2 Field Runtime 单元测试

P0/P1 覆盖 Plan 校验、产品 Bounds、诊断键和静态投影。运动和换图使用注入的 `dt`，覆盖：

- 相同状态、相同输入和相同 `dt` 产生相同状态。
- 左右加速、松键减速、空中水平控制、跳跃边沿和跳跃冷却。
- 蹲下时水平速度为 0，脚留在当前立足线，不穿平台。
- `swim` 为 1 时四个方向改变速度，不要求立足线，不起跳。
- 水平平台、斜坡、端点连接、prev/next、平台掉落、向下穿越和无效几何。
- Foothold id 丢失、地图切换时清除旧接触状态、边界值和非有限数 fail closed。
- Camera Bounds、Viewport 小于/大于地图、地图比视口小、resize 不修改玩家坐标。
- 四扇门往返，落点是目标门的 `x/y`。`st00` 的哨兵 `tm` 和 `west00` 不换图。目标不存在、重复触发和加载失败都保留旧地图。

### 9.3 Browser / PWA E2E

- 通过正式 `bootstrapWebPresentation()` 和真实 Content API 加载地图组件与 PNG。
- 使用可信键盘输入驱动 Controls；不使用合成 `KeyboardEvent` 伪造设备输入。
- 静态绘制验收产品锚点和产品图层顺序。行走、跳跃、蹲下、游泳和四扇门换图使用与 Node 相同的步长函数。镜头跟随留到客户端函数恢复之后。
- 对照固定像素样本时，标明样本验收的是产品锚定和产品顺序。背景视差在 `+0x98` 恢复前不作为通过条件。
- Frame cancel/failure 时释放 Controls Consumer、Viewport 订阅、RenderDomain 和组件资源。
- 运行现有 `npm test`、PWA Bundle、PWA staging 和浏览器 E2E 回归。

## 10. 风险与待评审决策

| 项目 | 当前事实/风险 | 设计处理 |
|---|---|---|
| 自研 Map FSDB 章节 | 第 4 章已写。`read-adventure-fsdb.mjs` 的白名单仍只有纸娃娃 | 发布这三张图之前，把地图表加进该白名单 |
| LoomRealm Tick API | 固定 pin 的 Frame 和 SubsystemScope 没有时钟 | 运动调用注入 `dt` 的 `step`。Subsystem 和视觉组件不自建定时器。补算上限等待上游 Clock |
| Camera 坐标约定 | 跟随和 world-to-screen 待逆向 | 1:1 与视口左上角是产品约定；VR 内缩是客户端已确认算法；三者分开验收 |
| Physics 参数单位 | `Physics/default` 数值已存在，但完整积分公式/单位未确认 | 建立校准 fixture，标注证据等级 |
| Foothold 特殊标志 | `force/forbidFallDown` 的客户端行为尚未完全还原 | 原样保留，首版不猜测语义 |
| Portal 触发范围 | 这四扇门没有 `hRange/vRange` | 读取时用客户端缺省 100，命中半幅 50。不把 100 写回源行 |
| Portal 视觉资源 | 原始路径已确认；当前 FSDB 和 PWA 闭包还没有 MapHelper | 按提取、校验、Content、allowlist、游戏画面五步补齐；没有帧就不创建 `cms-portal` |
| `zM` 人物遮挡 | 现有首版树把 Actor 放在地图层之后 | MVP 记录限制；后续根据证据设计对象前后分带 |
| Map Link | `info/link` 会让地图绘制内容引用另一张地图 | Map Adapter 构建期解析并校验链接，不能递归无界读取 |
| Bundle 体积 | Tile/Obj/Back 引用会带来大量 PNG | P0 先测量实际闭包字节数，再确定缓存/体积预算 |

2026-11-09 修订已经明确：

1. 地图数据进 adventure 第 4 章。运行时逻辑契约仍是 MapScenePlanV1。
2. Portal 没有游戏帧时不创建视觉节点，不用编辑器图标或无贴图标记充当通过验收的画面。`pt` 3 属于这一类，逻辑切换仍然成立。
3. Camera `x/y` 采用世界视口左上角，这是产品约定。`scenePlan.bounds` 使用 `effectiveBounds`。
4. 当前固定 LoomRealm 没有 Frame Clock。运动用注入步长。Subsystem 和视觉组件不自建定时器。
5. 首版运动支持脚底点接触、水平/斜坡、蹲下不穿平台，以及 `swim` 为 1 时的四向游泳。垂直段和特殊标志保留并给出诊断。客户端积分单位待逆向。

## 11. 建议的后续 Issue 拆分

评审通过后再创建实现 Issue，建议按依赖拆成：

1. **P0 — MapScenePlanV1 与三张地图的 Content Closure**：数据适配、资源闭包、确定性 Bundle、引用完整性测试。
2. **P1 — CMS Map Scene Components**：`cms-scene-view`、`cms-back`、`cms-map-layer`、`cms-avatar-layer`、`cms-portal` 浏览器实现与像素测试。
3. **P2 — 产品 Camera 与 Viewport**：世界坐标、effectiveBounds 夹取、resize。不含跟随函数。
4. **P3 — 固定步长运动**：陆地行走、跳跃、蹲下，以及矩形地带的游泳。调用注入 `dt` 的 `step`。
5. **P4 — 四扇门切换**：第 1.4 节的一次 `replace`。`west00` 和哨兵 `tm` 不换图。

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
- [`components/MAP-SCENE-PLAN-V1.md`](../../components/MAP-SCENE-PLAN-V1.md)
- [`docs/reviews/2026-11-09-adventure-field-design-revision.md`](../reviews/2026-11-09-adventure-field-design-revision.md)
- [`research/result/map/MAP-REVERSE-STATUS.md`](../../research/result/map/MAP-REVERSE-STATUS.md)
- [`research/task/060-map-wz-extraction.md`](../../research/task/060-map-wz-extraction.md)
- [`research/result/task050-behavior-flows.md`](../../research/result/task050-behavior-flows.md)
