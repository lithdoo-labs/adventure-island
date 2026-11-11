# Adventure Field & Map Scene Runtime 设计草案

> **状态：Draft。** 2026-11-09 评审已经收口绘制契约。完成定义是三张地图上的行走、跳跃、蹲下、游泳、攻击、下跳、坐下、爬绳，以及沿井口往返。跳跃分成陆地跳、水中跳和下跳。交付物是整条 `base` → `adventure-map` 进程，包括内容闭包、物理、移动和换图，不只是地图组件。这些功能还没有实现。客户端证据在 [MAP-MOTION-REVERSE.md](../../research/result/map/MAP-MOTION-REVERSE.md)。尚未接入的清单在第 12 节。
>
> **修订：** [2026-11-09 Adventure Field 设计评审修订](../reviews/2026-11-09-adventure-field-design-revision.md)。逻辑记录以 [MAP-SCENE-PLAN-V1.md](../../components/MAP-SCENE-PLAN-V1.md) 为准。
>
> **子契约状态：Adventure Island RenderNode ABI v1 已冻结。** 组件标签及其 attrs/data/children/events 以 [RENDER-NODE-ABI-V1.md](../../components/RENDER-NODE-ABI-V1.md) 为唯一规范。本文不改这套数据结构。架构、运行时和验收内容仍为 Draft。
>
> **2026-11-11 增补：** 位置钟与画面钟分开，约定写在第 6.2 节和第 12.6 节。一次 `step` 的输入、互斥和返回值写在第 6.7 节。位置钟等上游唤醒。画面钟只留在 `cms-actor`。浏览器连续走动继续不做。LoomRealm gitlink 不升级。M1–M16 的指令级结果在 [MAP-M1-M16-REVERSE.md](../../research/result/map/MAP-M1-M16-REVERSE.md)，摘要在第 14 节。各节按这些结果收口，不再把同一条当开放缺口。
>
> 日期：2026-11-09  
> 设计分支：`design/adventure-field-map-scene`  
> 基线：`main@554494452933b19de67db44dd8a0f38190df7d25`  
> LoomRealm gitlink：`93648192323bf5f57996b7b54cbae641d8a53fdb`（保持固定，不随本设计升级）

## 0. 摘要与建议决策

当前 `main` 已完成 Base → Adventure Map → `cms-actor` 的 PWA 垂直切片：正式 Game Entry、统一 Controls、只读 AvatarPlan Content、人物绘制和生命周期清理已经接通。当前 `systems/adventure-map/subsystem.mjs` 仍是角色展示运行时：方向输入改变 `locomotion/facing`，人物 `x/y` 根据 Viewport 居中；它没有世界坐标、地图绘制、物理 Tick、Foothold 碰撞、Camera 或地图切换。

下一阶段建议命名为 **Adventure Field & Map Scene Runtime**，沿用现有 `adventure-map` Subsystem，不增加第二个地图入口。核心决策：

1. **保留 `cms-actor` 的职责和 ABI。** 它继续只绘制人物；位置、运动和场景归属由 Field Runtime 决定。
2. **第一批验证童话村、井和水底。** 地图是 `222000000`、`222000001`、`230030200`。完成定义包括行走、三种跳跃、蹲下、游泳、攻击、坐下、爬绳，以及沿井口往返。按键分配是产品约定，客户端函数见第 6.6 节。
3. **把纯游戏规则放进独立的 `libs/adventure-field/`。** `systems/adventure-map/` 负责 LoomRealm Frame、Controls、Content 和 RenderDomain 编排；纯函数库不依赖 DOM、LoomRealm 或浏览器 API。
4. **地图和物理参数放在 `content/[FSDB]adventure`。** 三张地图、引用画布、`map.helper` 的游戏出口帧和 `physics.default` 已经写入。构建期再投影 MapScenePlan。浏览器组件不直接读取 FSDB、WZ 或本地文件。
5. **沿用现有组件职责，先更新绘制语义。** 六个 MVP 组件的分工保持不变。排序、Bounds、背景支持范围、Portal 资源和帧时间按 2026-11-09 修订执行，再进入实现。
6. **运动用固定步长的纯函数。** 参数来自 `physics.default`。陆跳和下跳的式子形状在第 6.6 节。重力、行走投影和受迫位移的结构，以及调用方毫秒乘 `0.001`，在第 6.5 节。映像里没有周期常数，也没有那四个 decrypt 槽的字段名。时间分成位置钟和画面钟，见第 6.2 节。位置钟叫 `step`，产品一步是 25 毫秒，由调用方注入。一次调用的输入、互斥和返回值见第 6.7 节。画面钟只留在 `cms-actor`。地图组件不各自建钟。当前 pin 没有位置钟的合法唤醒，浏览器连续走动继续不做，见第 12.6 节。

## 1. 当前基线与已知事实

### 1.1 已完成的运行切片

- 根目录 canonical Game Entry 以 `base` 为初始 Subsystem，由 `base` 调用 `adventure-map`。
- Base 持有一个 `game-controls-input`；Adventure Map 使用固定 LoomRealm common-controls 的 `createControlsConsumer` 与 `createDirectionalControlsTracker`。
- `cms-actor` 通过 `RenderNode.attrs` 接收 `x/y/locomotion/facing`，通过 `RenderNode.data.avatarPlan` 接收有界、已解析的绘制计划。
- 当前 PWA Bundle Builder 只发布单角色 Avatar Content 闭包、派生的 `struct.AdventureAvatarPlan/bootstrap` 和两份 classic script。
- 当前 Adventure Map 的 `x/y` 是 Viewport 展示坐标，不是地图世界坐标；`up` 播放 `jump` 动作不代表角色离地。
- 方向映射写在 `systems/adventure-map/subsystem.mjs` 的 `LOCOMOTION_BY_DIRECTION`：左右是 `walk`，上是 `jump`，下是 `stand`。视口订阅会改写人物 `x/y`。这是演示动作，不是场地移动。
- `cms-actor` 的校验器和 `locomotionActions` 仍只接受 `stand`、`walk`、`jump`。ABI 已经加入 `prone`、`swim`、`sit`、`climb`，实现还没跟上。

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

井口的 VR 宽是 800。客户端内缩各 400 之后，左右收成同一个 x。上下仍有高度。矩形地带没有 VR，边界走小地图或立足线回退。`info.swim` 为 1 的图使用游泳和水中跳；为 0 的图使用行走、陆地跳、下跳和蹲下。村和井各有一条绳子。矩形地带的 `ladderRope` 节点存在，子节点数是 0。这三张图的 `Map.wz` 都没有 `seat` 节点，没有座位可导入。矩形地带还有 `decHP`，这次不把它做成持续掉血。

### 1.4 验证用的传送

只启用这条路线上的四扇门。换图由上键触发，框是门的 `x±20`、`y±50`，见第 7.2 节。源记录里没有 `hRange` / `vRange`。缺字段时另一条函数用 100 的一半，那条不换这四扇门。

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
- `swim` 为 0 时，人物能在立足线上行走、陆地跳跃、下落、落地、下跳和蹲下。`swim` 为 1 时改为游泳，跳跃键走水中跳。陆地跳和水中跳的姿势不同。陆地跳的竖直速度在 `0x9BD20E`，下跳在 `0x9BCFED`。四个 decrypt 槽的字段名不在本映像。`info.swim` 没有抄进移动对象，水中动作号也没有写入。逐步积分的已恢复结构在第 6.5 节。产品仍把陆地跳和水中跳分成两个分支。
- 上键在传送口换图，在绳子范围内爬绳。North 坐下，要命中座位。East 打出一次攻击。下跳和蹲下是两条状态。
- 沿第 1.4 节的四扇门切换场景。换图由上键触发，每次切换是一次 `replace`。
- PWA Bundle 只包含这三张地图的显式资源闭包；可重复构建且 Content Version 稳定。
- 固定步长的 Node 测试可以复现。验收注入 25 毫秒。浏览器里还没有位置钟，连续走动不在这版的浏览器验收里。`cms-actor` 换帧是画面钟，单独算。

### 2.2 非目标

- 在线服务器、网络同步、封包收发和多人状态。
- 怪物、NPC 对话、Reactors、技能列表、任务和地图脚本。坐下用座位，爬绳用已入库的绳子。攻击只做一次动作，不做出招表。
- 矩形地带的 `decHP`、`west00`，以及这三张图以外的出口。
- 全量 CMS079 地图导入或全库无损性结论。
- 用像素距离验收运动。第 6.5 节只记录已经反汇编到的积分结构，不把 `walkForce` 写成 px/s。`pt` 7、8、9、11、12、13 的写入在第 14 节 M16，这四扇门仍只用第 7.2 节的上键框。
- 把 Tile/Obj/Portal 的规则写进 `cms-actor`。

### 2.3 MVP 完成定义

完成定义包括画面、运动和换图：

1. PWA 能进入童话村，而不是占位背景或单独的 Actor 展示页。
2. 产品锚定和产品绘制顺序正确。渲染树节点数随背景数和非空图层数增长，而不是随 Tile/Obj 数量增长。
3. 人物 `x/y` 是世界坐标。Camera 使用 `effectiveBounds` 夹取。Viewport resize 不改写玩家世界坐标。
4. 在 `222000000` 和 `222000001` 上，固定步长可以走出行走、陆地跳、落地、下跳和蹲下。蹲下时水平速度归零，脚仍站在当前立足线上。下跳离开当前立足线，并且只有第 6.6 节的条件成立才发生。
5. 在 `230030200` 上，同样的步长函数改为游泳。跳跃键走水中跳，不复用陆地跳的速度。四个方向改变游速。
6. 上键在第 7.2 节的传送框里换图，并且当前有立足对象。童话村 `in00` 进井，井口 `sea00` 进矩形地带，矩形地带 `east00` 回井，井口 `out00` 回村。落点是目标门的 `x/y`。`replace` 失败时保留旧地图。
7. North 在座位命中时坐下。East 打出一次攻击，不把 `locomotion` 改成攻击。这三张验证图没有座位，浏览器上 North 不命中；框的测试用夹具。村和井的绳子记录留在 Plan。有立足对象且上键边沿命中时，用 `0xA4FC6F` 的 x 各 10、y 和 y-20。空中抓绳用人物主坐标，不用 `+0x80` / `+0x98`。`l` 没有选择动作的指令，爬绳姿势画 `rope`，不作为客户端对齐项。解开绳子不是按键。
8. 原有 Actor、Controls、PWA Bundle、生命周期和安全构建测试没有回归。

画面验收是产品呈现，不是客户端像素一致。运动验收是 Node 注入 25 毫秒的这套函数，不是浏览器里的连续走动，也不是已经还原的客户端积分。

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
| `systems/adventure-map/subsystem.mjs` | Frame 生命周期、Content 读取、Controls 消费、RenderDomain 投影、错误映射。位置钟落地后，由这里调用 `step` | 直接解析 CMS 原始文件、实现几何算法、DOM 操作、自建 `setInterval` / `requestAnimationFrame`。当前 pin 没有位置钟，不在这里补一只 |
| `libs/adventure-field/`（拟新增） | 纯状态转换、Foothold 索引、移动积分、碰撞、Camera 计算、Portal 目标解析 | LoomRealm、DOM、网络、文件系统、定时器 |
| 构建期 Map Adapter | 读取 adventure 第 4 章和 `physics.default`，校验引用，生成 MapScenePlan 和资源闭包 | 运行时状态、玩家运动 |
| `cms-scene-view` | 世界到 Viewport 的场景投影、Camera Bounds | Foothold 碰撞、Portal 触发 |
| `cms-map-layer` | 批量绘制一层 Tile/Obj | 地图加载、交互规则、人物移动 |
| `cms-back` | 按当前支持范围绘制背景 | Camera 跟随决策、未恢复的滚动公式、自建换帧时钟 |
| `cms-avatar-layer` / `cms-actor` | 人物节点容器和纸娃娃绘制。`cms-actor` 用已有画面钟按 `delay` 换帧 | 位置决策、物理、地图切换。画面钟不改世界坐标 |
| `cms-portal` | 按传入数据绘制已启用的出口 | 触发区域计算、Content 加载、切换 Frame、自建换帧时钟 |

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
  read-adventure-fsdb.mjs        # 现有纸娃娃读取；地图表还没进白名单
  build-installation-bundle.mjs  # 扩展现有确定性 Bundle Builder
scripts/wz_fsdb/
  import_adventure_field.py      # 已把三张地图和 physics.default 写入 adventure

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

Adventure Island RenderNode ABI v1 已冻结以下约定：世界 Y 向下；Camera 的 `(x,y)` 是 Viewport 左上角对应的世界坐标；不提供 Camera zoom，世界像素与 CSS 像素按 1:1 映射；世界点 `(wx,wy)` 投影到屏幕点 `(wx-camera.x, wy-camera.y)`。坐标允许有限小数，Field Runtime 不为绘制而回写取整后的世界位置；如需 pixel snapping，只能是组件内部呈现细节，不能改变权威坐标。Renderer 的 viewport 信息由 `cms-scene-view` 适配，不能反向改变这份 ABI。

### 4.2 Bounds

闭合算法在 [MAP-SCENE-PLAN-V1.md](../../components/MAP-SCENE-PLAN-V1.md)。这里只固定职责。

四个 VR 都是有限数时，Adapter 计算客户端已确认的有效边界：左右各收 400，上下各收 300；某一轴结果小于等于 0 时，该轴两边收到两端之和的有符号中点，向零截断。`sourceBounds` 保留原始 VR，`effectiveBounds` 是调整结果。400 和 300 是函数立即数，不表示客户端视口已经证明为 800×600。

VR 不完整时不套用这组立即数。产品回退先用 minimap 中心和尺寸，再用 foothold 外接矩形并左右扩 10、上扩 360、下扩 110。第一批里，童话村和井口四个 VR 都在，走客户端内缩。井口水平跨度是 800，左右收到同一个 x。矩形地带没有四个 VR，走产品回退。射手村和集市的 `info` 也没有这四字段，它们不在这次闭包里。

`scenePlan.bounds` 等于 `effectiveBounds`。组件收到的边界不再做第二次内缩。Camera 夹取使用这份边界。跟随、dead zone 和地图小于视口的摆放不在本映像。产品夹取用 `effectiveBounds`。地图比视口小时居中留白。world-to-screen 用上面已经冻结的投影。1:1 是产品约定。DPR 不改这份 ABI。

`info/link` 指向其他地图时，Map Adapter 必须先解析链接目标的地图绘制内容，再生成当前 mapId 对应的场景计划；链接语义不能由组件猜测。

### 4.3 渲染顺序

下面是产品树顺序。客户端加载键已经恢复。比较器不在本映像，相同键的次序不推断。MVP 子集为：

1. `front=0` 的背景。
2. 非空地图层，按 `layer=0..7`。
3. `cms-avatar-layer`，其中保留唯一 `cms-actor`。
4. 本阶段启用的 `cms-portal`。
5. `front=1` 的近景背景。

NPC、Reactor 和座位都不建画面节点。座位点留在 MapScenePlan。Foothold 和 Rope 不作为正式画面节点；需要诊断时由 `cms-scene-view` 的可选辅助线显示。

换场景时保留 `cms-scene-view`、`cms-avatar-layer` 与 `cms-actor` 的 key；所有地图专属子节点使用单调递增的 `sceneEpoch` 生成新 key，避免地图 A → B → A 时违反 Render Update v1 的 one-shot key 规则。

### 4.4 Tile 与 Obj 绘制

- 一个非空地图层对应一个 `cms-map-layer`；不得为每个 Tile/Obj 创建 RenderNode 或 Web Component。
- Tile 使用 `Tile/{tileSet}` 中的真实 Canvas 尺寸、`origin` 和画布 `z`；位置是像素放置，不是统一格子。放置记录保留 `zM` 和源顺序。Obj 保留放置 `z`、`zM`、`flip` 和源顺序。
- 客户端已确认 Tile 键使用画布 `z` 与放置 `zM`，Obj 键使用放置 `z` 而不使用 `zM`。两条键的基准常数不同。比较器不在本映像，相同键的次序不推断。Adapter 把键写入 MapScenePlan 的 `clientSortKey`，供诊断和以后的像素对照。
- 产品绘制顺序保持：Obj 组先于 Tile 组；Obj 按 `z` 升序；Tile 按 `canvasZ` 升序；同值保持源顺序。这个顺序来自 HaCreator，必须标注为产品约定。P1 的像素验收只证明产品顺序，不证明客户端比较器。
- 四张没有画布 `z` 的 Tile Canvas 不得把 `canvasZ` 默认为 0。引用它们的记录是 unsupported，不进入 `MapLayerPlanV1`。
- `zM` 继续进入视觉放置记录。MVP 仍把 Actor 放在地图层之后，人物和 Obj 的深度穿插尚未实现。`reactor/name` 留在逻辑记录。`r` 不是 0，或存在 `flow` 时，Adapter 报告 unsupported。

### 4.5 Background

`cms-back` 每个背景放置项一个节点。Adapter 将源字段 `bS/no/ani/x/y/rx/ry/type/cx/cy/f/a` 映射到 ABI v1 的对应 attrs。源 `front` 只决定远景段或近景段，不投影为 attrs。`front` 参与客户端加载键。比较器不在本映像，相同键的次序不推断。

客户端已确认 type 0–3 走普通分支，type 4 与 6 按 `rx` 水平滚动，type 5 与 7 按 `ry` 垂直滚动，滚动步长为 `20000 / |rate|`。`+0x98` 的参数顺序已经确认。`0x43715C` 只把调用转到运行时虚表 `+0x58` 并返回一个 dword。`+0x58` 和 `+0x98` 的方法体是运行时建出来的，静态不可达，时间单位没有。P1 只静态绘制 type 0，不解释 `rx/ry`，不把 type 1–7 标成已实现。`cx` 是水平步长，`cy` 是垂直步长；值为 0 时客户端不改用画布宽高，产品也不替换成图像尺寸。

帧缺少 `delay` 时停留。`Back/grassySoil.img/ani/0` 有 10 帧且都没有 `delay`，呈现为第一帧静止。`loop: true` 不补帧时间。带 `delay` 的帧也先保留数值，P1 不自动推进，因为产品时钟和客户端时间单位都还没有。背景换帧属于画面钟，这只钟不放进每个 `cms-back`。人物换帧由 `cms-actor` 已有的画面钟负责，见第 6.2 节。

## 4.6 公共 RenderNode ABI（Frozen）

Adventure Island 的公共 RenderNode 接口已独立冻结为 [components/RENDER-NODE-ABI-V1.md](../../components/RENDER-NODE-ABI-V1.md)。该文件是组件标签、attrs/data、children、事件、资源引用和场景树顺序的唯一规范来源；本设计草案不再复制一份可能漂移的字段表。

冻结范围包括：

- LoomRealm `RenderNodeV1` 五字段在 Adventure Island 中的使用方式；
- MVP 六个标签：`cms-scene-view`、`cms-back`、`cms-map-layer`、`cms-avatar-layer`、`cms-actor`、`cms-portal`；
- 每个标签的闭合 attrs/data schema、子节点约束和事件语义；
- `LogicalResourceRefV1`、资源版本校验和 Actor key 跨地图稳定规则；
- 视觉组件与 Adventure Field Runtime 权威状态的边界。

上游 LoomRealm 的 Render Update v1 和 Web Presentation API v1 在当前 gitlink pin 上已经冻结；Adventure Island ABI 是建立在它们之上的产品级契约。两者不能混称为同一层协议。NPC、Reactor、Mob 不在本次 MVP ABI 中。座位是逻辑点，不另做画面标签。

## 5. Map Content 与 PWA Bundle

### 5.1 构建期闭包，不在浏览器读取 FSDB

当前 PWA Bundle Builder 有明确输入白名单、确定性排序、SHA-256 Content Version、引用闭包验证和路径安全约束。地图接入必须扩展同一 Builder，而不是另建绕过白名单的资源复制脚本。

第一批 allowlist 只包含 `222000000`、`222000001` 和 `230030200`。这三张图、它们引用到的画布、`map.helper` 里 `portal/game` 的 `pv`/`ph`/`psh`，以及 `physics.default`，已经在 `content/[FSDB]adventure`。导入脚本是 `scripts/wz_fsdb/import_adventure_field.py`。构建适配器从这些 adventure 表投影 MapScenePlan，不再在运行时读转换库。

导入时读过的转换库表是：

- `[struct]Map`、`[struct]Physics`。
- `[group]Back`、`[group]Tile`、`[group]Obj`、`[group]Foothold`、`[group]Portal`、`[group]Rope`。这三张图的源图像没有 `seat`，转换库不写座位文件。
- 被引用的 `[struct]Tileset`、`[struct]Back`、`[struct]Obj`，以及 `MapHelper.img` 的 `portal/game`。
- 上述画布对应的 `[resource]图` PNG。编辑器 `sp`/`pi` 没有导入。

构建器必须按记录引用计算闭包，检查缺失引用、重复 Content identity、资源 MIME、PNG 解码尺寸、SHA-256 与确定性。禁止递归打包整个 `[FSDB]cms`，禁止发布 WZ/客户端文件、研究资料、临时工作目录或未经确认的外部资源。

### 5.2 派生 Map Scene Plan

MapScenePlanV1 的闭合字段、缺字段策略、诊断码和投影边界以 [MAP-SCENE-PLAN-V1.md](../../components/MAP-SCENE-PLAN-V1.md) 为准。Content 身份暂定：

```text
kind      = record
namespace = struct.AdventureMapScenePlan
key       = <mapId>
```

每张地图一个 Plan。它是从 CMS 源记录投影出的运行时逻辑数据，不是新的 WZ 格式，也不把原始 CMS 记录直接塞进 RenderNode。根上有 `formatVersion`、`mapId`、带 `sourceBounds` 与 `effectiveBounds` 的 `bounds`、`backgrounds`、`layers`、`footholds`、`ropes`、`seats` 和 `portals`。这三张图没有座位，`seats` 是空数组。

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

`tm` 和 `tn` 已在实例加载函数中读取。`tm == 999999999` 时客户端使用函数直接返回。同图时 `tn` 匹配另一个 portal 的 `pn`。跨图调用收到 `pn`。同图和跨图的命中路径都不写人物 `+0x20` / `+0x38`。Field Runtime 继续持有 `(tm, tn)`。产品落点是目标门的 `x/y`。

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
    footholdId: null,
    ropeId: null,
    seatId: null
  },
  camera: { x: 0, y: 0 },
  transition: { status: "idle", targetMapId: null }
}
```

`swim` 来自当前地图的 `info.swim`，换图时随地图更新。`locomotion` 的 ABI 是 `stand`、`walk`、`jump`、`prone`、`swim`、`sit`、`climb`。校验器还只接受前三个，实现运动时一起改，不另做一套人物节点。攻击不占 `locomotion`，用已有的 `action` 事件。状态由 `libs/adventure-field` 的纯函数更新。Subsystem 是唯一运行时编排者，不能让 `cms-actor`、`cms-map-layer` 或 DOM 节点保存第二份权威位置。

进入童话村的出生点定为 `(-92, 294)`。这是六条 `sp` 里的一条，`pn` 为 `sp`，`pt` 为 0，`tm` 为 `999999999`。另外五条是 `(-2522, -104)`、`(-2185, 195)`、`(1487, 306)`、`(3220, -435)`、`(3278, -430)`，这次不使用。这是产品决定，不是客户端选出的那条。不能把视口中心当成出生坐标。换图落点仍是目标门的 `x/y`，不改用这个出生点。

### 6.2 Tick 与确定性

时间分成两只钟。这是产品分层，不是已经还原的客户端结构。客户端没有给出「恰好两只钟、周期已知」。纸娃娃帧上的 `delay` 是画面停留。背景取时 `0x43715C` 转到 layer 虚表 `+0x58`，方法体静态不可达，时间单位没有。物理分发 `0x9BCD6C` 的入参是调用方传来的毫秒，乘 `0xAFECD0` 的 `0.001` 变成秒。映像里没有周期常数。爬绳 `0x9D80EC` 的 `3 * [+0x154]` 是一次调用的位移，相邻两次调用的间隔不在本映像。

**位置钟**放在 `adventure-map` 这条进程里。它只叫醒 `step(state, input, dt)`。一次调用更新人物的世界坐标、速度、朝向、`locomotion`、立足线、绳子和座位，再投影到 `cms-actor` 的 attrs。Tile、Obj、门和 type 0 背景的坐标来自 MapScenePlan，不在每个周期重算。方向来自现有 Controls：这只钟读取按住状态，不另写 held-key tracker。`north`、`south`、`east`、`up` 的边沿只进入一次调用。

`step` 是纯函数，自己不读时钟。产品一步是 25 毫秒，由调用方传入。相同状态、相同输入、相同的 25 得到相同状态。40 次调用等于 1 产品秒模拟时间。这个数不来自 `0x43715C`，也不是 `walkForce=140000`、`gravityAcc=2000` 或 `jumpSpeed=555`。墙钟上多久叫醒一次，以及迟到时最多补几次，仍等上游 Clock。调用点、暂停和仍在等待的项目写在第 12.6 节。

**画面钟**只留在 `cms-actor`。它已经用自己的 `requestAnimationFrame` 按帧上的 `delay` 换身体和表情。运行库不逐帧推画面。走路的距离和 `walk` 的 180 毫秒帧不必锁在一起。`cms-back`、`cms-portal`、`cms-map-layer` 不各自再建一只画面钟。缺 `delay` 的背景停在第一帧。有 `delay` 的背景帧 P1 也不推进。type 4–7 的滚动还缺 `+0x98` 的函数体。

固定 gitlink `93648192323bf5f57996b7b54cbae641d8a53fdb` 的 `Frame` 只有 `id`、`params`、`signal` 和 `call`。`SubsystemScope` 提供 SharedState、SessionEvent、Content、Viewport、PresentationEvent 和 `createRenderDomain`，没有帧时间戳、帧间隔、游戏时钟或 Tick 订阅。PWA 的 `scheduler.schedule()` 没有暴露给 Subsystem，它只排协议期限。子系统不自建 `requestAnimationFrame` 或 `setInterval` 来充当位置钟。因此浏览器里现在没有合法的位置钟，连续走动继续不做。测试在浏览器之外注入 25。

Viewport 的现有接口是逻辑尺寸和订阅。`loomrealm.viewport-state/1` 仍是 Not Implemented / Not Qualified。Camera 可以按这个接口设计夹取，尺寸传递必须另做 resize、carrier 重连、无效尺寸和 Runtime 终止测试。Viewport 不提供游戏时间，不能当作位置钟，也不能当作画面钟。

位置钟落地之后，运动仍使用固定时间步长和可注入的时间源。相同初始状态和相同输入序列应产生相同的 Field State。目标频率和最大补算步数到那时再冻结。暂停没有单独信号：`frame.signal` 的 abort 会取消 Frame，并释放 Controls、视口订阅和 RenderDomain。游戏暂停继续等上游 Clock。

### 6.3 Controls 映射

继续复用现有 common-controls，不监听 DOM、不重新实现 held-key tracker。面键名字就是 `north`、`south`、`east`。方向键仍是 `up`、`down`、`left`、`right`。下表的按键是产品约定，这次就用这张表，不再追客户端的默认键位。客户端用虚拟键和动作号，没有这四个面键名字。动作号进入的函数在第 6.6 节，不把 `0x33`、`0x34`、`0x35` 写成某个虚拟键的默认绑定。

| 输入 | 产品规则 |
|---|---|
| `left` / `right` | 地面时行走并更新 `facing`。空中保留水平控制。游泳时改水平游速。`ropeId` 仍在时不改 `x`，也不改 `facing`。`ropeId` 清空之后恢复地面行走。这一步不新造下绳键 |
| `south` 按下边沿 | 跳跃键。`swim` 为 0 且站在立足线上时陆地跳一次。`swim` 为 1 时水中跳一次。按住不重复起跳。按住 `down` 时这条边沿改走下跳，不走上面两种跳 |
| `north` 按下边沿 | 坐下。人物周围的座位框命中才进入 `sit`。再次按下或按下左右时起来。起来时 `seatId` 不改。客户端没有把座位下标写在人物上，`+0x2088` 的清零只在换景处理器，不是这次按键。没有座位数据时这次边沿无效 |
| `east` 按下边沿 | 攻击。发一次 `action` 事件。当前纸娃娃没有对应攻击动作时丢掉这次事件，`locomotion` 不变 |
| `up` 按下边沿 | 当前有立足对象，并且人在第 7.2 节的传送框里，就换图。否则人在绳子范围内就爬那条绳子。两处都不在时，这个边沿不跳跃 |
| `down` | 没有同时出现 `south` 边沿时，站在立足线上进入蹲下，水平速度归零，不穿平台。松开下键的分支不写 `prone`，已经是 `prone` 就保持原地。游泳时改为向下的速度。下跳不是蹲下 |
| 无方向 | 地面减速。蹲下和坐下保持原地。空中不强制清零水平速度。游泳时减速 |

必须区分方向 State 和按下/释放边沿。跳跃、坐下、攻击和换图都不能因每次 State 刷新而重复触发。同一步里传送、抓绳、下跳、蹲下和另外两种跳只发生第一件匹配的事，顺序在第 6.7 节。

`prone` 画身体动作 `prone`。`sit` 画 `sit`。`climb` 画 `rope`。这两张验证图的绳子 `l` 都是 0。爬绳区域没有把 `ladder` 或 `rope` 写到人物上。`avatar.part.body.00002000` 没有名为 `swim` 的动作，有 `fly`（第 0、1 帧，`delay` 300）。水中跳的路径也没有动作号写入。`swim` 和水中跳画 `fly`，陆地跳画 `jump`。这是产品约定，用来分开两种姿势。

### 6.4 Foothold 几何与碰撞

`info.swim` 为 0 时，人物沿立足线行走、陆地跳、下跳和蹲下。蹲下把水平速度写成 0，脚留在当前立足线上，不向下穿平台。下跳离开当前立足线，条件在第 6.6 节。为 1 时，四个方向改变游速，跳跃键走水中跳，不复用陆地跳的速度。三种跳和游泳共用 `step(state, input, dt)`，分支分开。逐步积分的已恢复结构在第 6.5 节。游泳没有单独的积分函数。

Foothold 是地面接触与平台连接的权威数据，Tile 只是视觉资源。第一版建议：

1. 建立按地图 `layer/platform/id` 索引的 Foothold 集合，并验证 `prev/next` 引用是否存在或为合法空值。
2. `x1 != x2` 的线段可作为水平/斜坡候选地面；用线性插值计算给定世界 X 的地面 Y。
3. 角色下落时检测脚底轨迹与候选线段的向下穿越，选择最早有效接触点，落地后设置 `grounded=true` 与 `footholdId`。
4. 沿平台移动时使用 `prev/next` 处理相邻段；端点交接要有确定性排序和容差，避免段间抖动。
5. `x1 == x2` 的垂直线不作为普通地面；其墙体/边界语义先保留并记录诊断，不在第一版假定它是可站立平台。
6. `force` 先原样保留。`forbidFallDown` 收成 0 或 1 之后，经 `0x630025` 写进每条立足线记录的 `+0x30`。`field+0x13C` 的 bit 17 来自地图 flags，值码 40 对应 `0x20000`。两者不是同一位。下跳第一道门仍读 bit 17，不把 `forbidFallDown` 解释成这一位，也不根据字段名把 `force` 猜成行为。
7. 首版采用明确的脚底接触模型；角色横向宽度、墙体碰撞、穿平台和下落平台作为后续独立能力，不把点接触测试描述为完整角色碰撞。

建议先覆盖水平平台、斜坡、平台端点、从平台边缘走落、向下穿越平台和无可落地平台等单元测试。对垂直线、特殊 flag 和复杂多层重叠场景建立 fixture，未实现的情况应显式返回 unsupported/diagnostic，而不是静默套用水平地面规则。

### 6.5 Physics 参数

`content/[FSDB]adventure/[struct]physics.Default/physics.default.json` 保存 `Physics.img` 的 19 个原始数，包括 `walkForce`、`walkSpeed`、`walkDrag`、`slipForce`、`slipSpeed`、`gravityAcc`、`fallSpeed`、`jumpSpeed`、`maxFriction`、`minFriction`，以及 `swimForce`、`swimSpeed`、`swimSpeedDec`。转换库里的 `struct.Physics/default` 只是导入来源。

这些名字不在四个 decrypt 槽旁边，本映像也没有给 `[move+0x190]`、`[move+0x198]` 配上这些字符串。陆跳和下跳的式子形状在第 6.6 节。字段名没有，三个跳的分支继续分开，不把缺名字的槽改写成 `walkForce` 或 `jumpSpeed`。

物理分发 `0x9BCD6C` 已经反汇编到这些结构。入参是调用方的毫秒增量，乘 `0xAFECD0` 的 `0.001` 变成秒。映像里没有周期常数。产品验收注入的 25 是调用方选择的毫秒，不是从映像读出的周期。40 次仍等于 1 产品秒。不把 `walkForce=140000` 或 `gravityAcc=2000` 写成 px/s。Node 测试验收第 6.7 节的状态变化，不验收像素距离。

- 有立足时，行走在 `0x9BE703`：斜率投影，乘 `0.5` 的梯形项，写回 `+0xE0` 那一块。这里没有把 `walkForce` 接进这条指令。
- 无立足的下落在 `0x9BDF18`：乘 `+0x60`、`+0x68`、`+0x28`、`+0x30`，再乘这份 dt。按物理加载表，这四项是 `gravityAcc`、`fallSpeed`、`floatDrag1`、`floatDrag2`。`walkDrag` 在加载表的 `+0x10`，这条指令没有乘它。游泳没有另一条积分函数。不把 `floatDrag1` / `floatDrag2` 写成已经接上的游泳公式。
- 受迫位移在 `0x7ACCFF`：把传入的 dx、dy 累加进普通双精度 `+0x180`、`+0x188`，并把 `+0x178` 写成 1。`0x9BD58F` 再把这两份加进速度槽。这不是行走或游泳积分。`pt` 13 会调用它。

### 6.6 攻击、下跳、坐下、爬绳

证据在 [MAP-MOTION-REVERSE.md](../../research/result/map/MAP-MOTION-REVERSE.md) 和 [MAP-M1-M16-REVERSE.md](../../research/result/map/MAP-M1-M16-REVERSE.md)。这里只收进这次目标要用的结论。

**上键先传送。** `0x954B58` 在人物有立足对象时，用固定框 `x±20`、`y±50` 找 `pt != 0` 的门。这不是 `hRange` 那条测试。命中且 `tm` 不是 `999999999` 就换图，不再继续做别的。村和井的 `town` 是 1，错过门之后客户端走 `field+0x170`。矩形地带的 `town` 是 0，走另一条链表。这两条都不是 `seat`，也不是爬绳。产品的上键只做传送和爬绳。

**坐下对座位。** `seat` 装在 `field+0x16C`，每条两个整数，点测试把它们当 x、y。动作号 `0x33` 在两段速度都为 0 且站在立足线上时，看座位的点是否落在人物 `x±10`、`y±30` 里。命中就把下标交给后续报文，并写 `[user+0x2088] = 1`、`[user+0x208C] = 0x994C7A()`。报文之前没有 `sit`。人物上没有座位下标。`+0x2088` 的清零在换景处理器 `0x558579`、`0x55DAE2`、`0x57F13C`，不是再次按下或左右移动。产品在命中时把 `locomotion` 写成 `sit`，不发那条报文。起来时不改 `seatId`。行的形状在 adventure 第 4 章的 `[group]map.Seat`：`index`、`x`、`y`。这三张验证图的源图像没有 `seat`，所以不写空文件来假装有座位。浏览器上这三张图的 North 不命中。有 `seat` 节点的其他地图以后再按这个形状导入。

**下跳和蹲下分开。** 动作号 `0x35` 在虚拟键 `0x28` 读为按下时进入 `0x95308C`，否则进入 `0x952F1F`。后者的函数体里没有 `prone`。产品把「按住 down 再按 south」交给 `0x95308C` 这条条件，把单独的 down 交给蹲下。产品用上的门闩是：当前有立足对象；脚下那扇门的 `pt` 不是 12 或 13；人物 y 加 300 之后 `0xA4F609` 为空或仍是当前立足对象；再在 `x±1`、`y+300` 到 `y+600` 里由 `0xA4F6F1` 得到立足段，并且它写出的 y 不在人物 y 的 `(y-5, y+5)` 里。成功后离开当前立足线。`0x940011(1, 1)` 只发效果。速度稍后由 `0x95539D` 把移动对象 `+0x160` 写成 1，再进入 `0x9BCFED`。竖直速度是 `decrypt([move+0x190]+0x24) / ([[[0xBDD498]+8]+0x70] * K)`，`K` 是 `0xB0C590` 的 `-0.35355339`，写入 `+0x68`/`+0x78`。水平速度写成 0，写入 `+0x50`/`+0x60`。这四个 decrypt 槽旁边没有字段名，不把这条改写成已经接上名字的公式。`forbidFallDown` 写的是立足线记录 `+0x30`，与 `field+0x13C` 的 bit 17 不是同一位。bit 17 仍只按这条函数里已经记录的门使用。产品不把 `forbidFallDown` 解释成下跳开关。

**陆地跳和水中跳不是同一条物理。** 客户端把 `swim` 收成 0 或 1 放在地图对象 `+0x150`。全映像没有把这块抄进移动对象，也没有把地图对象写进全局 `[0xBDF54C]`。`0x95A31E` 和 `0x69733B` 读的仍是全局 `+0x150`。两份 `+0x150` 没有关联指令。爬绳路径在 `0x9D7BF2` 把水平键交给 `0x9C4B78`，写进移动对象 `+0x150`。所以 `0x9BD0DE` 仍不能当成水中跳。陆地跳在 `+0x158` 被 `0x952F1F` 写成 1 之后，立足对象非 0 时由 `0x9BD20E` 把竖直速度写入 `+0x68`/`+0x78`。算式是 `-(decrypt([move+0x198]+0x48) * [[[0xBDD498]+8]+0x70]) / decrypt([move+0x190]+0x24)`。没有立足对象时，`0x70DF65` 先看 `[move+0x190]`。指针为 0 就返回 0。`+0x30` 的方法返回 1 算飞行，否则用 `+0x3C` 做矩形包含。返回非 0 时，`0x9BD42D` 把 `decrypt([move+0x198]+0x6C)`、物理对象 `+0x48`（`swimSpeed`）、清掉符号位后的那份双精度和 `0xB04F40` 的 `5.0` 相乘，取负，写入 `+0x68`/`+0x78`。返回 0 时仍改用全局 `+0x90` 和 `+0x58`。这条门不是地图的 `info.swim`。跳路径没有动作号写入。`[move+0x190]+0x18`、`+0x24` 和 `[move+0x198]+0x48`、`+0x6C` 旁边没有字段名。`+0x180`、`+0x188` 的来源是第 6.5 节的受迫位移，不是行走或游泳积分。产品保持两个分支：陆地跳用 `jump` 姿势，水中跳用 `fly` 姿势。水中跳的速度仍分开校准，不把 `0x9BD42D` 写成 `info.swim` 的公式。

**爬绳对绳子记录。** 单条绳子的 `l`、`uf`、`x`、`y1`、`y2`、`page` 已经按偏移读出。村的绳子是 `x=-3467`，`y1=-142`，`y2=-4`，`l=0`，`uf=1`。井的绳子是 `x=-51`，`y1=-499`，`y2=474`，`l=0`，`uf=0`。矩形地带的节点存在，子节点数是 0。查询是 `0xA4FC6F`：x 的两端各扩 10，再和记录 `+0xC` 比较；y 的两端和记录 `+0x10`、`+0x14` 比较。`0x9D7E9F` 先按符号加减 `0.5` 再转整数，x 同时作为两端，y 端点是这个整数和它减 20。这次要有立足对象、竖直键小于 0，并且还没挂在绳子上。抓绳 `0x9D7E9F` 用人物主坐标 `+0x20` / `+0x38`。已经挂上之后，`0x9D7D4F` 才读第二对槽：`+0x80`（校验 `+0x90`）和 `+0x98`（校验 `+0xA8`），和主坐标一起交给 `0xA4FC6F`。这对没有名字，也没有 `0x6131F4` 写入，不另定宽度。已经解开 `+0x124` 时，`0x9D80EC` 按竖直键把 y 加上 `3 * [+0x154]`。命中后 `0x9D80DF` 调用虚表 `0xB0CC78` 的 `+0x14`，函数是 `0x9BFB52`。它不比较记录 `+4`，也不读 `ladder` / `rope`。动作表里这两个名字的下标仍是 `0x24`、`0x25`。爬绳区域没有把它们写到人物上，`l` 不选择姿势。产品画 `rope`。`uf` 和 `page` 保持原值。端点把 y 夹回记录范围，不是下绳。立足下标为负且 `0x9BCC9A` 返回 0 时，`0x9BCC34` 到 `0x9BCC3C` 经 `0x9BFD85` 把 `+0x124` 写成空。这不是按键。产品状态里还没有这个立足下标，`step` 不另造一次失败来清 `ropeId`。

**攻击是一次动作。** 动作号 `0x34` 进入 `0x954F0F`，先调用 `0x9573A6`，再调用 `0x95C5B2`。`0x99772D` 按 `0x27`/`0x28` 选 `Attack`/`Attack2`，只用来播 `Sound/Weapon.img/%s/%s`，调用点是 `0x938547` 和 `0x43FCA7`，不在这条入口里。`swingO1`、`stabO1` 是整个字符串号 853、864，不是拼出来的。它们在动作表里的下标是 5 和 `0x10`，由 `0xBDDB10` 加下标乘 `0x18` 得到；登记时 `[ebp-4]` 上的同两个数是 SEH 状态。`0x954F0F` 在调用 `0x9573A6` 之前没有把这两个下标写到人物上。`0x95C5B2` 里出现的 `0x4E`、`0x57`、`0x61` 也不是这两个下标。`0x95D4A2` 调用的 `0xA4F93C` 在两点重合时返回 1，否则交给 `0x5114AA` 排成矩形。两个函数都没有固定半宽。选中的动作下标停在局部 `[ebp-0xC68]`，没有写到人物上。矩形的两个坐标来自用户虚表 `+0x10` 所返回指针的 `[+0]` 和 `[+4] - 0x1C`，没有对上人物 `+0x20` / `+0x38`。半宽没有。`0xBA59B8` 的类型 1、2、5、6、8 在本映像只有读，没有写，不断成死槽，也不新开捕获。产品只在 east 的边沿发一次不带名字和半宽的 `action`。没有对应身体动作时丢掉。不做技能列表，不算伤害。

`VerticalJump` 是传送门 `pt` 12 调用的 `0x9549DF` 的效果名。`pt` 13 在全局地图态返回 19、20 或 21 且仍有立足对象时，调用 `0x53E95D(move, 19)`，再调用 `0x7ACCFF(move, −门x, 门y)`。人物下跳函数不读 `VerticalJump`。哨兵 `tm` 上，`pt` 7、8、11 发报文并写 `[user+0x2088] = 1`、`[user+0x208C]` 为时间戳。`pt` 9 没有专属写入。这四扇验证门的 `pt` 是 1 或 3，仍只用第 7.2 节的框。

### 6.7 一次 `step` 的契约

`step(state, input, dt)` 是纯函数。验收传入的 `dt` 是 25。函数不读时钟，不读 Controls，不读 Viewport，也不改 MapScenePlan 里的 Tile、Obj、门和背景放置坐标。速度数值的已恢复结构在第 6.5 节。验收注入的 25 是调用方毫秒，不是映像里的周期。这一节只定输入、同一步里哪一件发生，以及返回给画面钟的是什么。

调用方传入的 `input` 分成两份，函数不在两次调用之间保存边沿：

```js
{
  held: { left: false, right: false, up: false, down: false },
  edges: { north: false, south: false, east: false, up: false }
}
```

`held` 来自这一步的 Controls State。`left` 与 `right` 同时为真时，只保留 `createDirectionalControlsTracker` 顺序里较后的那一个，另一个在进入 `step` 之前写成假。`up` 与 `down` 同样处理。函数自己不再排这套顺序，也不另做 held-key tracker。`edges` 只表示这一步新按下。键还按着时，下一步的边沿是假。`repeat === true` 不是边沿。`up` 的按住和 `up` 的边沿是两件事：按住只给已经挂上的绳子做竖直位移，边沿才去做传送或抓绳。

同一步先按下面的顺序看互斥动作，命中第一条就停。后面的传送、抓绳、三种跳、蹲下和坐下都不再发生。

| 顺序 | 条件 | 这一步只做 |
|---|---|---|
| 1 | `edges.up`，当前有立足对象，人在启用门的 `x±20`、`y±50` 内，门的 `pt` 不是 0，`tm` 不是 `999999999` | 返回一条传送意图。不抓绳，不跳跃。立足对象为 0 时 `0x954B58` 直接返回 |
| 2 | 上一条不成立，`edges.up`，当前有立足对象，还没挂绳，`0xA4FC6F` 用 x 各 10、y 与 y-20 命中 | 挂上这条绳子，`locomotion` 写成 `climb` |
| 3 | `edges.south` 且 `held.down`，`ropeId` 为空 | 只尝试下跳。不蹲下，也不走陆地跳或水中跳。门闩仍是第 6.6 节；门闩失败则这条边沿用完，不再改走别的跳 |
| 4 | `edges.south`，`swim` 为 0，`ropeId` 为空，当前有立足对象 | 陆地跳一次 |
| 5 | `edges.south`，`swim` 为 1，`ropeId` 为空 | 水中跳一次。速度不复用陆地跳 |
| 6 | `held.down`，没有 `edges.south`，`swim` 为 0，`ropeId` 为空，当前有立足对象 | 进入 `prone`，水平速度写成 0，脚留在当前立足线 |
| 7 | `edges.north`，人已经是 `sit` | 起来，`locomotion` 写成 `stand`。`seatId` 这一步不改。这一步不接着走 |
| 8 | `edges.north`，两段速度都为 0，当前有立足对象，座位的点落在人物 `x±10`、`y±30` | `locomotion` 写成 `sit`，记下 `seatId` |
| 9 | 人已经是 `sit`，且 `held.left` 或 `held.right` | 起来，`locomotion` 写成 `stand`。`seatId` 这一步不改。这一步不接着走 |

`edges.east` 不参加这张表。同一步里可以既走路或跳跃，又带上至多一条攻击。攻击不写进 `locomotion`。没有可播的身体动作时，这条攻击不发给组件。动作下标没有写到人物上，半宽也没有，这一步不选定。

表里的「已经是」看这一步开始时的 `locomotion`。这一步刚写成 `sit` 的，后面的方向 State 不再把它立刻拉起来。

互斥动作定完之后，方向 State 再作用到结果上：

- 地面、未蹲下、未坐下、未挂绳：`held.left` 或 `held.right` 行走，并把 `facing` 写成这一侧。两个都假则地面减速。
- 已经是 `prone` 或 `sit`：保持原地，水平速度保持 0。
- 空中：保留水平控制，不因为没有方向就把水平速度清零。
- `swim` 为 1：四个按住的方向改变游速；都没按住则减速。这里的下是游速，不是 `prone`。
- `ropeId` 仍在：`held.left` 和 `held.right` 不改 `x`，也不改 `facing`。`held.up` 或 `held.down` 的竖直位移仍用第 6.6 节的 `0x9D80EC`，不把 `3 * [+0x154]` 换算成每 25 毫秒多少像素。已挂绳时的查询才读 `+0x80` / `+0x98`，不另定宽度。空中抓绳不用这一对。客户端在立足下标为负且绳查找返回 0 时清 `+0x124`。产品状态没有这个下标，这一步不新造按键，也不猜一次失败来清 `ropeId`。`ropeId` 一旦按那条条件清空，左右恢复上面的地面行走。

返回值三块：

| 字段 | 内容 |
|---|---|
| `state` | 第 6.1 节的场地状态。允许改的是人物 `x`、`y`、`vx`、`vy`、`facing`、`locomotion`、`grounded`、`footholdId`、`ropeId`、`seatId`。`mapId` 要等传送的 `replace` 成功才改 |
| `action` | 没有攻击时为空。有攻击时只有一个位子，不带动作名和半宽 |
| `portal` | 没有换图时为空。有换图时带目标 `(tm, tn)`。函数不调用 `replace` |

画面钟只接收投影结果：`locomotion` 和 `facing` 写成 `cms-actor` 的 attrs，`x` / `y` 写成世界坐标。攻击位子由子系统交给已有的 `action` 事件。组件按这些换帧，不把坐标写回场地状态。换图冷却仍用第 7.2 节已有的重触发保护，这一步不另定冷却毫秒。

下面三处客户端没有对应写入，这一步保持原状态：

- 松开 `down` 的分支不写 `prone`。已经是 `prone` 时，方向 State 仍保持原地。
- 落地链不写身体动作名。落地只按第 6.4 节写下 `grounded` 和 `footholdId`，`locomotion` 不改。
- 起来时人物上没有座位下标可清。第 7、9 行不改 `seatId`。

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

换图用上键那条测试，不是走进门就跳。调用前 `0x954B58` 要求移动对象 `+0x110` 非 0，也就是当前有立足对象。`0x71B44D` 的框是门的 `x±20`、`y±50`，并且跳过 `pt == 0`。这四扇门的 `pt` 是 1 或 3，都参与。`hRange` / `vRange` 属于另一条函数 `0x71B4FD`：缺字段时压入 100，命中用一半，所以半幅是 50。下跳只用它来排除 `pt` 12 和 13。不把 100 写进 FSDB 行。动画查找的固定框 `x±100`、`y±50` 也不拿来换图。

Portal 检测属于 Field Runtime；`cms-portal` 只负责画面。上键边沿触发一次。触发必须有冷却，避免进入目标地图后立刻触发反向出口。

### 7.3 原子切换

`replace()` 替换整棵 RenderDomain 状态。`update()` 只能改已有节点的 attrs/data，不能改 children。地图切换必须调用 `domain.replace(nextRenderDomainState)`。

可以保证的一致性是：Field State 与本地 RenderDomain 状态一起提交。RenderManager 先提交本地权威状态，再异步发布 Render Snapshot。协议没有 Renderer ACK，也不保证 Web Component 已经完成图像解码。视觉失败后自动恢复旧地图不在当前协议里。

切换步骤：

1. 锁定当前 transition，忽略重复触发。
2. 从 Content 读取并校验目标 MapScenePlan；确认目标 Portal `tn` 存在，资源引用和诊断状态通过。
3. 在本地准备目标 Foothold 索引、effectiveBounds 和完整 RenderNode 树。准备失败时保留旧地图和旧玩家状态，不调用 replace。
4. 计算目标落点。同图路径把目标门的 `x`、`y-10`、空输出、上界 `0x7FFFFFFF` 和半宽 1 传给 `0xA4F6F1`。那个函数返回立足对象，不写人物坐标。跨图函数 `0x53FF69` 发报文，不写本地地图 id。产品落点使用目标门的 `x/y`，目标地图用 Plan 里的 `(tm, tn)`。目标地图 `swim` 为 0 时，再按立足线规则吸附。吸附容差必须显式配置并测试。
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
| P3：移动 | 注入 25 毫秒的 `step`：陆地行走、陆地跳、下跳、蹲下，水中游泳和水中跳，坐下，攻击，爬绳 | 穿平台、复杂墙体；技能列表；地图组件自建画面钟；浏览器里的位置钟和连续走动；把 Physics 数值当成已证明的客户端单位；用另一套绳子宽度当通过条件 | 相同状态、输入和 `dt` 得到相同结果。验收注入的 `dt` 是 25。三种跳的速度分支分开。爬绳命中用已核实的 x 各 10、竖直 20。`l` 没有写到人物上，姿势画 `rope`，不宣称已经对齐客户端动作槽。 |
| P4：Portal Transition | 上键进入第 7.2 节的框后，四扇门各一次 `replace` | `west00`、`decHP`、这三张图以外的出口；走进门就跳；全像素事务 | 往返落在目标门 `x/y`；`replace` 失败保留旧地图 |

阶段 P0/P1 可以先独立验收。P2 不得用改变 Actor 屏幕中心的方式伪造世界移动。P3 和 P4 属于这次完成定义。P3 的运动验收是 Node 注入 25 毫秒的 `step`。浏览器连续走动要等第 12.6 节的位置钟，不进 P3 的通过条件。`cms-actor` 已有的画面钟保持不变，不拿它代替位置钟。地图组件不自建时钟。补算上限和暂停等待上游 Clock。

## 9. 测试与验收策略

### 9.1 数据与构建测试

- 严格 JSON / JSONL 解析；空行、坏行、重复 id、错误类型、缺字段均有明确策略。
- MapScenePlan 的字段、引用、Bounds、图层号、Portal 目标和 Foothold `prev/next` 做结构校验。
- 每个 PNG 的 namespace/key/MIME/contentVersion/解码尺寸与引用矩形一致。
- 只包含三张地图及其传递引用；没有整个 CMS FSDB、WZ、客户端文件或研究目录。
- Bundle 在相同输入下字节级确定；资源缺失、重复 identity、版本冲突和越界引用均 fail closed。
- 逐个 RenderNode 测量 compact UTF-8 data 大小，并单独测量 MapScenePlan、资源闭包总字节、解码并发、峰值内存、Canvas 尺寸和资源工作集。这些是应用层测量。LoomRealm Render Update v1 没有通用 data 字节上限，不得把测量结果写成协议上限。`cms-map-layer` 使用视口尺寸 Canvas。射手村 `miniMap.width` 为 7174，这个宽度只说明不能用整幅世界 Canvas。射手村不在这次验证地图里。

### 9.2 Field Runtime 单元测试

P0/P1 覆盖 Plan 校验、产品 Bounds、诊断键和静态投影。运动和换图使用注入的 `dt`，验收场景的 `dt` 是 25，覆盖：

- 相同状态、相同输入和相同 `dt` 产生相同状态。验收的 `dt` 是 25。输入用第 6.7 节的 `held` 与 `edges`。同一步把边沿再传一次，传送、跳跃、坐下、攻击和抓绳都不重复。
- 左右加速、松键减速、空中水平控制。`south` 边沿只起跳一次。陆地跳和水中跳不共用速度。`edges.south` 且 `held.down` 只走下跳；门闩失败时不改走另外两种跳。
- 按住 `down` 再按 `south` 才下跳。单独的 `down` 是蹲下，水平速度为 0，脚留在当前立足线。
- 下跳要求当前有立足对象，脚下门的 `pt` 不是 12 或 13，并且 `x±1`、`y+300` 到 `y+600` 的立足段 y 不在人物 y 的上下 5 像素里。
- `swim` 为 1 时四个方向改变游速。没有 `held.down` 的跳跃键走水中跳。
- `north` 只在座位的点落在人物 `x±10`、`y±30` 时进入 `sit`。调用前已经是 `sit` 时，`north` 或左右只起来，这一步不接着走。
- `east` 只占一个攻击位子，`locomotion` 不变。它可以和同一步的行走或跳跃一起出现。没有攻击动作时不发 `action`。下一步边沿为假时不再占这个位子。
- 上键边沿还要求当前有立足对象。立足对象为 0 时不返回传送意图。有立足对象且人在门的 `x±20`、`y±50` 内，只返回传送意图，不抓绳。松开 `down` 不离开 `prone`。落地不改 `locomotion`。起来不改 `seatId`。抓绳用 `0xA4FC6F` 的 x 各 10、y 与 y-20。`ropeId` 仍在时左右不改 `x` 和 `facing`。竖直位移用 `0x9D80EC`，不把 `3 * [+0x154]` 写成每秒像素。已挂绳查询读 `+0x80` / `+0x98`，不另写宽度。空中抓绳不用这一对。不新造下绳键，也不在没有立足下标时猜一次失败。
- 水平平台、斜坡、端点连接、prev/next、平台掉落、向下穿越和无效几何。
- Foothold id 丢失、地图切换时清除旧接触状态、边界值和非有限数 fail closed。
- Camera Bounds、Viewport 小于/大于地图、地图比视口小、resize 不修改玩家坐标。
- 四扇门往返，落点是目标门的 `x/y`。`st00` 的哨兵 `tm` 和 `west00` 不换图。目标不存在、重复触发和加载失败都保留旧地图。

### 9.3 Browser / PWA E2E

- 通过正式 `bootstrapWebPresentation()` 和真实 Content API 加载地图组件与 PNG。
- 使用可信键盘输入驱动 Controls；不使用合成 `KeyboardEvent` 伪造设备输入。
- 静态绘制验收产品锚点和产品图层顺序。浏览器不验收连续走动。行走、三种跳、蹲下、游泳、坐下、攻击、爬绳和四扇门的判定使用 Node 注入 25 毫秒的同一个 `step`。爬绳用 `0xA4FC6F` 和 `0x9D80EC`。镜头跟随留到客户端函数恢复之后。`cms-actor` 的换帧是画面钟，不作为世界坐标移动的验收。
- 对照固定像素样本时，标明样本验收的是产品锚定和产品顺序。背景视差在 `+0x98` 恢复前不作为通过条件。
- Frame cancel/failure 时释放 Controls Consumer、Viewport 订阅、RenderDomain 和组件资源。
- 运行现有 `npm test`、PWA Bundle、PWA staging 和浏览器 E2E 回归。

## 10. 风险与待评审决策

| 项目 | 当前事实/风险 | 设计处理 |
|---|---|---|
| 自研 Map FSDB 章节 | 第 4 章已写，三张地图和 `physics.default` 已入库。`read-adventure-fsdb.mjs` 的白名单仍只有纸娃娃 | 发布这三张图之前，把地图表和物理表加进该白名单，并扩展 Bundle Builder |
| 位置钟 | 固定 pin 没有 Tick。`base`、`adventure-map` 的 Frame、Controls 的 `onState`/`onEvent` 都不能按 25 毫秒反复调用 `step`。暂停没有单独信号 | 产品一步是 25 毫秒，Node 注入。浏览器连续走动继续不做。画面钟只留在 `cms-actor`。补算上限和暂停等待上游 Clock。见第 12.6 节 |
| 演示移动 | `LOCOMOTION_BY_DIRECTION` 把下键映射成 `stand`，视口订阅改写 `x/y` | 迁入 `libs/adventure-field`。Controls 消费器留下。视口中心不再是人物世界坐标 |
| 出生点 | 六条 `sp` 都不是换图门。客户端没有选出其中一条 | 产品出生点是 `(-92, 294)`。换图不使用它 |
| Camera 坐标约定 | 跟随、dead zone、地图小于视口不在本映像 | 1:1、视口左上角和 world-to-screen 已在第 4.1 节冻结。夹取用 `effectiveBounds`。地图小于视口时居中留白 |
| Physics 参数单位 | 19 个数已在 adventure。四个 decrypt 槽没有字段名。`info.swim` 没有抄进移动对象。积分结构在第 6.5 节：调用方毫秒乘 `0.001`，映像没有周期常数 | 三个跳的分支分开。不把 `walkForce=140000` 或 `gravityAcc=2000` 标成 px/s。不验收像素距离 |
| 座位 | 客户端座位在 `field+0x16C`。这三张图的 `Map.wz` 没有 `seat` 节点 | 这三张图上 North 不命中。框用夹具测。不写空座位文件 |
| 爬绳命中 | 命中框在 `0xA4FC6F`。`l` 没有写到人物上。空中抓绳用主坐标。已挂绳才读 `+0x80` / `+0x98`，没有写入。清绳是 `0x9BCC9A` 返回 0，不是按键 | 验收命中框和 `0x9D80EC` 的竖直位移。姿势画 `rope` |
| Foothold 特殊标志 | `forbidFallDown` 写立足线记录 `+0x30`。`field+0x13C` bit 17 是地图 flags。不是同一位 | 下跳门闩仍用已经反汇编的条件。不把 `forbidFallDown` 当成 bit 17 |
| Portal 触发范围 | 上键换图用固定框 `x±20`、`y±50`。`hRange` 那条测试是另一函数，缺字段时半幅 50 | 换图不走 `hRange`。不把 100 写回源行 |
| Portal 视觉资源 | `map.helper` 的 `pv`/`ph`/`psh` 已在 adventure。这四扇门的 `pt` 是 1 或 3，不使用这些帧。PWA 闭包还没发布它们 | 没有游戏帧就不创建 `cms-portal`。这四扇门的切换不依赖出口画面 |
| `zM` 人物遮挡 | 现有首版树把 Actor 放在地图层之后 | MVP 记录限制；后续根据证据设计对象前后分带 |
| Map Link | `info/link` 会让地图绘制内容引用另一张地图 | Map Adapter 构建期解析并校验链接，不能递归无界读取 |
| Bundle 体积 | Tile/Obj/Back 引用会带来大量 PNG | P0 先测量实际闭包字节数，再确定缓存/体积预算 |

2026-11-09 修订已经明确：

1. 地图数据进 adventure 第 4 章。运行时逻辑契约仍是 MapScenePlanV1。
2. Portal 没有游戏帧时不创建视觉节点，不用编辑器图标或无贴图标记充当通过验收的画面。`pt` 3 属于这一类，逻辑切换仍然成立。
3. Camera `x/y` 采用世界视口左上角，这是产品约定。`scenePlan.bounds` 使用 `effectiveBounds`。
4. 时间分成位置钟和画面钟。位置钟的产品一步是 25 毫秒，当前 pin 没有合法唤醒，浏览器连续走动继续不做。画面钟只留在 `cms-actor`。地图组件不自建时钟。补算上限和暂停等上游 Clock。见第 6.2 节和第 12.6 节。
5. 首版运动支持脚底点接触、水平/斜坡、蹲下不穿平台、下跳的已确认门闩、游泳和水中跳。垂直段给出诊断。`forbidFallDown` 与 bit 17 分开保留。逐步积分用第 6.5 节的结构，不验收像素距离。
6. 上键在有立足对象且人在 `x±20`、`y±50` 时换图。North 对座位坐下。East 发一次攻击。按键用第 6.3 节，同一步的互斥用第 6.7 节。挂绳时左右不改 `x`。出生点是 `(-92, 294)`。爬绳命中用 `0xA4FC6F`。姿势画 `rope`。松开 `down` 不离开 `prone`，落地不改 `locomotion`，起来不改 `seatId`。

## 11. 建议的后续 Issue 拆分

评审通过后再创建实现 Issue，建议按依赖拆成：

1. **P0 — 内容进入进程**：把 adventure 的地图表和 `physics.default` 加进 `read-adventure-fsdb.mjs`，投影 MapScenePlan，扩展 Bundle Builder 和 `presentation.json`。
2. **P1 — 场景组件**：`cms-scene-view`、`cms-back`、`cms-map-layer`、`cms-avatar-layer`、`cms-portal` 的浏览器实现。`cms-actor` 的校验器接上 `prone`、`swim`、`sit`、`climb`。
3. **P2 — 产品 Camera 与 Viewport**：世界坐标、effectiveBounds 夹取、resize。不含跟随函数。视口变化不改人物世界坐标。
4. **P3 — 迁走演示移动并实现 `step`**：立足线、行走、陆地跳、水中跳、下跳、蹲下、游泳、坐下和一次攻击。爬绳接上 `0xA4FC6F` 和 `0x9D80EC`。姿势画 `rope`。出生点用 `(-92, 294)`。验收注入 25 毫秒。浏览器连续走动继续不做，直到上游给出位置钟的唤醒。Controls 消费器留下。`cms-actor` 的画面钟不在这项里重做。积分结构用第 6.5 节，不在这项里另开客户端问题。
5. **P4 — 四扇门切换**：上键、当前有立足对象、人在传送框内之后的一次 `replace`。`west00` 和哨兵 `tm` 不换图。命中路径不写人物 `+0x20` / `+0x38`。进入目标图之后的坐标是目标门的 `x/y`，不是出生点。这三张图没有座位，不放进换图这一项。

每个 Issue 只实现一个可独立验收的垂直切片；不得在同一任务里顺带升级 LoomRealm pin、重跑 WZ 转换或引入全量地图资源。`prone`、`swim`、`sit`、`climb` 已写入 ABI。实现时改校验器，不另起一套人物 ABI。

## 12. 整条子系统进程尚未接入的内容

交付物是 `base` 调起 `adventure-map` 的整条进程。地图组件只负责画面。物理、移动和换图都在这条进程里完成。

### 12.1 现在跑到哪里

进程目前是：`base` 持有 Controls，调起 `adventure-map`；子系统读 `struct.AdventureAvatarPlan/bootstrap`；RenderDomain 只有一个 `cms-actor`；人物画在视口中心；方向键只改 `locomotion` 和 `facing`。取消或失败时会释放 Controls、视口订阅和 RenderDomain。

没有世界坐标、地图绘制、立足线、物理、Camera 夹取和换图。三张地图和 `physics.default` 已经在 adventure 库里，这条进程还读不到。

### 12.2 现有移动要迁走

仓库里没有一套可迁移的客户端积分。要迁走的是 `subsystem.mjs` 里的演示映射：

- `LOCOMOTION_BY_DIRECTION`：左右 `walk`，上 `jump`，下 `stand`。
- `centeredPosition` 和视口订阅对人物 `x/y` 的改写。

迁走之后，方向状态、面键和按下边沿仍由 `createControlsConsumer` 提供。`south` 是跳跃键，`north` 是坐下，`east` 是攻击，`up` 是传送或爬绳。单独的 `down` 在陆地上进入 `prone`。人物组件继续按 `locomotion` 播帧，这是画面钟，不是位置钟。攻击用 `action` 事件。画面钟不决定位置和是否落地。迁走演示映射之后，浏览器仍没有位置钟，所以没有另一套走动可以顶上。

### 12.3 内容进入进程

- `scripts/pwa/read-adventure-fsdb.mjs` 的白名单加上第 4 章的地图表和 `[struct]physics.Default`。
- 构建期 Adapter 从这些表投影 `struct.AdventureMapScenePlan`。Plan 带 `effectiveBounds`、图层、立足线、绳子、座位、传送门和 `swim`。运行时投影不写回 FSDB。这三张图的 `seats` 为空。
- `scripts/pwa/build-installation-bundle.mjs` 现在只打包 `base`、`adventure-map`、Controls 和 `cms-actor`。三份 Plan、地图 PNG 和 `physics.default` 要进入同一个确定性闭包。
- 根目录 `presentation.json` 现在只注册 `cms-actor`。五个场景组件实现之后再注册它们的 classic script。

### 12.4 物理库

`libs/adventure-field/` 还不存在。它是纯函数，不依赖 LoomRealm、DOM、网络、文件系统和定时器。第一版包含：

- `step(state, input, dt)`。契约在第 6.7 节。相同状态、输入和 `dt` 得到相同状态。验收的 `dt` 是 25。
- 立足线索引：水平段和斜坡、`prev/next`、脚底向下穿越，落地后记下 `footholdId`。`x1 == x2` 的垂直段给出诊断，不当成地面。
- `swim` 为 0：行走、陆地跳、下落、下跳、蹲下。蹲下时水平速度为 0，不穿平台。下跳使用第 6.6 节的门闩。`edges.south` 且 `held.down` 失败时不改走陆地跳。
- `swim` 为 1：四个方向改变游速。参数用 `swimForce`、`swimSpeed`、`swimSpeedDec`。没有 `held.down` 时跳跃键走水中跳。水中跳的速度不复用陆地跳。
- 坐下读座位。爬绳读已有的绳子记录，命中框用 `0xA4FC6F`。`ropeId` 仍在时左右不改 `x` 和 `facing`。不另猜宽度，也不新造下绳键。攻击只占一个位子。
- 传送判定用上键边沿、当前立足对象和门的 `x±20`、`y±50`，并且优先于抓绳。四扇门是 `in00`、`out00`、`sea00`、`east00`。`st00` 的 `tm` 是 `999999999`，`west00` 指向闭包外，两者不换图。函数只返回意图，不调用 `replace`。
- Camera 只用 `effectiveBounds` 夹取。跟随算法留到客户端函数恢复之后。

积分是产品约定。`walkForce=140000` 和 `gravityAcc=2000` 在校准之前不写成 px/s 或 px/s²。校准用平地、斜坡、跳跃高度、空中时间和最大下落速度，并标明证据等级。

### 12.5 子系统一帧里做什么

`adventure-map` 仍是唯一入口。下面六步是位置钟叫醒之后的一次调用。当前 pin 没有这只钟，浏览器不会按这个清单循环。一次调用里：

1. 从 Content 读三份 MapScenePlan 和 `physics.default`。
2. 按第 6.1 节建立场地状态。初始坐标是 `(-92, 294)`。
3. 按第 6.7 节把 Controls 的按住状态和这一步的边沿收成 `input`，调用 `step`。攻击位子交给已有的 `action` 事件。传送意图在 `replace` 成功之后才改 `mapId`。
4. 投影整棵场景树。`cms-avatar-layer` 与 `cms-actor` 的 key 保持稳定，地图节点使用 `sceneEpoch`。
5. 上键边沿、当前有立足对象，并且人在启用门的 `x±20`、`y±50` 时准备目标状态，成功后 `domain.replace`。准备失败或 `replace` 失败则留在旧地图。落点是目标门的 `x/y`；目标图 `swim` 为 0 时再吸附立足线。走进这四扇门不换图。
6. 取消或失败时释放 Controls、视口订阅和 RenderDomain。

### 12.6 步长调用点

固定 gitlink `93648192323bf5f57996b7b54cbae641d8a53fdb`。位置钟和画面钟按第 6.2 节分开。浏览器里的连续走动继续不做。

| 决定 | 层 | 结论 |
|---|---|---|
| 谁反复调用 `step` | 进程编排 | 现有 pin 没有合法调用点。`base`、`adventure-map` 的 Frame、Controls 的 `onState`/`onEvent` 都不做这个循环 |
| 一步多少毫秒 | `libs/adventure-field` 的 `step` 入参 | 产品一步是 25 毫秒。测试注入。浏览器不注入 |
| 暂停时停不停 | Frame 生命周期 | pin 没有暂停信号。继续等上游 Clock。`abort` 是取消 |

#### 调用者

`step(state, input, dt)` 自己不读时钟。第 12.5 节的六步是一次调用里要做的事。固定 pin 没有东西把第 3 步反复叫起来。

`base` 只创建唯一的 `game-controls-input`，然后 `frame.call("adventure-map", frame.params)`。子 Frame 结束、失败或取消时，`finally` 关掉这个输入域。它不解释输入，不持有场地状态。子 Frame 活跃时，`base` 停在这次 `call` 上。Controls 投递给当前顶层 Frame，也就是 `adventure-map`。这里没有循环，也没有 Tick。

`adventure-map` 的 `frame()` 在一次 activate 里进入。它读 AvatarPlan，创建 `cms-actor`，用 `createControlsConsumer` 和 `createDirectionalControlsTracker` 在 `onState`/`onEvent` 里改 `locomotion`/`facing`，然后 `Promise.race` 等到 `frame.signal` 取消或致命错误。人物 `x/y` 仍由视口尺寸居中，不是世界坐标。`cms-actor` 自己的画面钟会换身体帧，不改这个坐标。Frame 上没有帧回调。`SubsystemScope` 没有帧时间戳、帧间隔、游戏时钟或 Tick 订阅。PWA 的 `MainPlatform.scheduler.schedule()` 不在 Scope 上。Runner 里的另一份 `scheduler` 只交给 Runtime Control 的 hello、Frame 和清理期限。要在这个 `frame()` 里自己循环，就要自建 `requestAnimationFrame` 或 `setInterval`。子系统和视觉组件都不这样做来充当位置钟。

Controls 的 `onState`/`onEvent` 也不是位置钟。`createControlsConsumer` 返回前会同步投递一份空 State。方向键的 `repeat === true` 已被现有 `createDirectionalControlsTracker` 丢掉，按住左右不会靠重复事件再进来。`onState` 在有效集合变化时发一份 `down`。非空时，`game-controls-input` 每 1000 毫秒重发同一份，空集合停止重发。2500 毫秒没有新的 State 时，消费侧退回空集合。这是输入新鲜度。按住左右期间，tracker 里的方向保持为左或右，但没有按 25 毫秒再进入的回调。把 1000 毫秒那一次重发拿来调用 `step`，一步会变成 1 秒，而且松键之后重发停止：陆地跳的空中、下落、地面减速、游泳减速都没有下一次调用。不另写一套 held-key tracker 去补这个空档。现有 tracker 继续只记方向，不叫 `step`。

`cms-actor`、`cms-map-layer`、`cms-back`、`cms-scene-view`、`cms-avatar-layer`、`cms-portal` 和 `game-controls-input` 都不调用 `step`。不新造地图入口。Viewport 不能当 Tick。`cms-actor` 已有的 `requestAnimationFrame` 只换帧，不读成位置钟。

因此：现有 pin 里没有合法的位置钟。浏览器连续走动继续不做。Node 测试在浏览器之外调用 `step`，注入 25。

#### 产品步长

产品一步是 25 毫秒。它是 `step` 的 `dt` 参数，由调用方传入。函数不读时钟。Node 验收注入 `25`。相同状态、相同输入、相同的 25 得到相同状态。40 次这样的调用等于 1 产品秒模拟时间。墙钟上一秒叫几次，不由这个数决定。

这是产品约定。客户端和 pin 都没有给出可用的毫秒数：

- `0x43715C` 是 layer 虚表 `+0x58` 的取值，时间单位未知。
- `physics.default` 的 `walkForce=140000`、`gravityAcc=2000`、`jumpSpeed=555` 以及其余原始数都不是毫秒，也不是 px/s。
- 背景滚动的 `20000 / |rate|` 是距离步长。`cx`/`cy` 也是距离步长。
- Controls 的 1000 毫秒是 State 重发，2500 毫秒是过期退回空集合。
- 纸娃娃 `fly` 的 `delay` 300 是画面钟的帧停留。P1 背景帧不自动推进。缺 `delay` 的帧停在第一帧。有 `delay` 的背景帧这次也不推进。

25 不占用第 6、7 节已经用来表示像素的 10、20、30、50、300、600。它不写进 `physics.default`，也不写成 Frame 或 `SubsystemScope` 上的新字段。这次不升级 pin。

目标频率和最大补算步数仍不冻结。25 毫秒是一次 `step` 代表的模拟时间，不是浏览器每 25 毫秒醒一次。没有调用者，就没有补算。上游时钟若以后一次唤醒里调用多次 `step`，每次 dt 仍是 25。最多几次，这次不写。

四个 decrypt 槽没有字段名。攻击下标没有写到人物上，半宽也没有。已挂绳的第二对坐标没有名字和写入。这些都不参与这个毫秒数。爬绳命中仍用 `0xA4FC6F` 的 x 各 10、y 与 y-20，挂上之后的竖直位移仍用 `0x9D80EC`。25 毫秒不把 `3 * [+0x154]` 换算成每秒像素。空中抓绳不用 `+0x80` / `+0x98`。不新造下绳键。

#### 一次调用的 input

输入的形状、左右同时按下时怎么取舍、边沿只生效一次，以及同一步的互斥，都写在第 6.7 节。函数在两次调用之间不保存未处理的边沿。浏览器里没有人按步组装这份 `input`。测试在每次调用时自己放入 `held` 和至多这一步的边沿。

这三张图没有座位，`north` 不命中。出生点仍是 `(-92, 294)`。换图落点仍是目标门的 `x/y`。这两处坐标不是步长，也不由浏览器循环产生。

#### 暂停

pin 里没有暂停信号。`SubsystemDefinition` 只有 `initialize`、`frame`、`shutdown`、`failed`。`Frame` 和 `SubsystemScope` 上的 `signal` 都是 `AbortSignal`。

`frame.suspend` 是 Main 的行政挂起。成功时 Activation 永久撤销，不能恢复成原来的激活。固定 pin 的实现会 `abort` 这个 `frame.signal`。`adventure-map` 把 abort 收成 `cancelled()`，`finally` 释放 Controls、视口订阅和 RenderDomain。这是取消。

普通 `frame.call` 会挂起调用方的 Activation。协议不向调用方再发送 `frame.suspend`，实现也不 abort 调用方的 signal。`base` 在等待 `adventure-map` 时就处于这种挂起。这是子帧调用。

`game-controls-input` 的全屏遮罩不写入 `controls.state`、`controls.event` 或场地状态。Viewport 也不提供暂停。画面钟即使位置停了也会继续换帧；现在没有一根信号可以同时停下两只钟。

因此这次不回答「暂停时停步」或「暂停时继续步」。游戏暂停继续等上游 Clock。不使用 `signal.abort` 冒充暂停。纯函数不增加暂停参数。

#### 仍然等上游 Clock

- 一个子系统可以订阅、且不必自建 `requestAnimationFrame`、`setInterval` 或第二套游戏时钟的唤醒。上游若把这个唤醒交给 Subsystem，接收它的仍是现有 `adventure-map` Frame，不新增地图入口，也不交给视觉组件。这次 pin 没有这个唤醒，所以这一句不是现在的调用点。
- 目标频率：唤醒多快。25 毫秒的产品步长不代替这个频率。
- 最大补算步数。
- 暂停：一个不 abort、不释放 Controls、视口订阅和 RenderDomain 的停步信号，以及停步期间步子停不停。这个信号若以后要同时停住画面钟，再单独写。
- 背景和传送门的多帧推进。`0x43715C` 只转发到运行时虚表 `+0x58`，方法体静态不可达，时间单位没有。缺 `delay` 的帧继续停在第一帧。type 4–7 的 `+0x98` 同样静态不可达。

镜头跟随、dead zone 和地图小于视口的摆放不在本映像。背景滚动的方法体静态不可达。逐步积分的结构在第 6.5 节，像素距离仍不是这版的通过条件。

#### 浏览器连续走动

按这个方案，浏览器连续走动继续不做。可以做的是 Node 里对同一个 `step` 注入 25 毫秒：行走、三种跳、蹲下、游泳、坐下、一次攻击、爬绳的已核实命中和 `0x9D80EC`，以及四扇门在输入边沿上的判定。人物在浏览器里的世界坐标不会因按住左右而连续变化。画面上的迈步动作可以继续由 `cms-actor` 的画面钟播放。第 12.2 节把演示映射迁进 `step`。迁走之后浏览器仍不循环调用 `step`。

### 12.7 画面和人物动作

`cms-scene-view`、`cms-back`、`cms-map-layer`、`cms-avatar-layer`、`cms-portal` 只有 `DESIGN.md`，没有浏览器实现。`cms-map-layer` 用视口尺寸画布，按 Camera 裁剪，不把整张地图画成世界位图。这些组件不建立画面钟，也不调用位置钟。

`cms-actor` 的画面钟保持现有实现：按 `delay` 换帧，不改世界坐标，也不把坐标写回场地状态。`locomotion` 和 `facing` 来自第 6.7 节的 `state`。攻击位子来自同一次返回值，走 `action` 事件；没有可播动作时不发。它还要实现 `prone`、`swim`，并补上 `sit`、`climb`。`prone` 指向 `prone`，`sit` 指向 `sit`，`swim` 和水中跳指向已有的 `fly`，陆地跳指向 `jump`，`climb` 指向 `rope`。爬绳区域没有把 `ladder` 或 `rope` 写到人物上。当前校验器只接受 `stand`、`walk`、`jump`。这四扇门不创建 `cms-portal`。

### 12.8 验收

第 9 节的 Node 测试和浏览器测试都还没有对应程序。现有 E2E 只覆盖居中的纸娃娃。运动验收使用 Node 注入 25 毫秒的 `step`。浏览器连续走动不作为通过条件。镜头跟随不在本映像，背景方法体静态不可达，像素距离不验收。`cms-actor` 换帧只说明画面钟还在，不说明人物已经沿世界坐标走动。

## 13. 相关资料

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
- [`research/result/map/MAP-MOTION-REVERSE.md`](../../research/result/map/MAP-MOTION-REVERSE.md)
- [`research/result/map/MAP-M1-M16-REVERSE.md`](../../research/result/map/MAP-M1-M16-REVERSE.md)
- [`research/result/map/MAP-GAPS-FINAL-CLOSURE.md`](../../research/result/map/MAP-GAPS-FINAL-CLOSURE.md)
- [`research/result/map/MAP-PHYSICS-CORRECTION.md`](../../research/result/map/MAP-PHYSICS-CORRECTION.md)
- [`research/result/map/MAP-REVERSE-STATUS.md`](../../research/result/map/MAP-REVERSE-STATUS.md)
- [`research/task/060-map-wz-extraction.md`](../../research/task/060-map-wz-extraction.md)
- [`research/result/task050-behavior-flows.md`](../../research/result/task050-behavior-flows.md)

## 14. 一次逆向任务

这一节保存 M1–M16 的题目和 A 级结果。指令在 [MAP-M1-M16-REVERSE.md](../../research/result/map/MAP-M1-M16-REVERSE.md)。各节已经按结果收口。没有 M17。

做法保持原记录：同一张解包映像，指令级，地址用 VA。和 [MAP-MOTION-REVERSE.md](../../research/result/map/MAP-MOTION-REVERSE.md) 冲突时以指令记录为准。Ghidra 反编译不当成结论。

不重开，也不要写进结果：

- 键位表、出生点 `(-92, 294)`、产品一步 25 毫秒、两只钟的产品分层。位置钟的唤醒、补算和暂停属于上游 Clock，不在这张映像里。
- 陆跳式子 `0x9BD20E`、下跳式子 `0x9BCFED`、`+0x70` = `jumpSpeed`、`gravityAcc` 在 `+0x60`。
- 抓绳框 `0xA4FC6F`、爬绳 `y += 3 * [+0x154]`、座位框 `x±10`/`y±30`、传送框 `x±20`/`y±50` 以及 `+0x110` 为 0 时 `0x954B58` 返回。
- 没有名为 `swim` 的身体动作。动作表槽位：`sit` 是 `0x27`（十进制 39），`prone` 是十进制 33，`ladder2` 是 `0x33`（十进制 51）。这三个数不是同一个动作号。输入动作号 `0x33` 的入口仍按 `0x95516A` 的座位搜索，不把槽名当成这次要推翻的框。
- VR 内缩 400/300。第 4.1 节的 Y 向下、视口左上角、1:1 和 world-to-screen。DPR 不改 ABI。
- 绳子端点的 y 夹紧。它不是下绳。

| 编号 | 要看到的写入 | 从这里看 | 设计用法 | 本次结果 |
|---|---|---|---|---|
| M1 | 松开下键之后，哪条指令改掉蹲下。`0x9533EA` 最高字节带 `0x80` 的松开路径有没有对 `prone` 的写入。`0x952F1F` 把 `+0x158` 写成 1 已记录，不要再把它当成离开蹲下 | `0x9533EA` 的松开分支 | 已经是 `prone` 就保持原地 | 没有写入：松开分支（0x953570 起，含尾调 0x968550 一层）不写 prone |
| M2 | 脚落到立足线之后，身体动作写成哪一个名字。`0x9BCFF2` 读 `Jump` 是 `0x9BCFED` 的速度路径，不要再当成落地换姿。`0x95A31E` 的动作号 2 是 `stand1`，读的是全局 `+0x150`，不要再当成落地 | 立足对象从 0 变成非 0 之后的动作名写入 | 落地只写 `grounded` 和 `footholdId` | 没有写入：落地链（0x9BC622→0x9BC89F/0x9BC992、分发器及其虚表方法）不写动作名 |
| M3 | `0x95516A` 在报文之前有没有把 `sit` 写到人物上；起来时有没有清掉人物上的座位下标。`field+0x2088 = 1` 已记录。task050 里另一对象的 `+0x2088` 是复位标志，不要当成 `seatId` | `0x95516A`，以及再次进入或左右移动时的清零 | 命中时产品写成 `sit`。第 7、9 行不改 `seatId` | 报文前无 sit 写入；下标只进报文；本地仅 field+0x2088=1 与 +0x208C=时间戳；清除只在换景处理器（0x558579/0x55DAE2/0x57F13C） |
| M4 | 水中跳的速度写入，写进哪一对加密槽。地图 `field+0x150` 有没有抄进移动对象。全局 `[0xBDF54C]+0x150` 与地图字段是不是同一份。水中当时播放的动作号。`0x9BD0DE` 读的 `+0x150` 是水平键，不要再当成水中跳 | `0x9BCD6C` 附近、`info.swim` 的读取点 `0x534C86` | 水中跳单独分支，姿势用 `fly` | vy 写 +0x68/+0x78（0x9BD42D）；info.swim 无 move 拷贝；0xBDF54C 无写入者、与地图字段无关联指令；动作号无写入；[move+0x190]=多用途记录（+0x18/+0x24 加密双精度、+0x30 飞行判定、+0x3C 矩形容器） |
| M5 | `decrypt([move+0x190]+0x24)`、`decrypt([move+0x198]+0x48)`、`+0x6C`、`decrypt([move+0x190]+0x18)` 旁边的字段名。式子形状不重写 | `0x9BD20E`、`0x9BCFED`、`0x9BD42D` | 三个跳的分支继续分开校准 | 字段名没有（四个 decrypt 旁无字符串；全映像无 +0x190 存储指令，+0x198 仅 0x5FFF96 且对象不符） |
| M6 | 行走、游泳、重力各一次积分的指令，以及相邻两次调用相隔的时间量度。`0x9BD58F` 对 `+0x180`、`+0x188` 的来源。没有周期就写没有 | 移动对象物理分发 `0x9BCD6C` 的逐步路径 | 不把 `walkForce` 或 `gravityAcc` 写成 px/s。Node 不验收像素距离 | 行走=0x9BE703 斜率投影+0.5 梯形；重力/阻力=0x9BDF18（gravityAcc/fallSpeed/walkDrag/floatDrag2 ×dt）；受迫位移=0x7ACCFF 写 +0x180/+0x188 累加器（0x9BD58F 消费）；dt=入参毫秒×0.001；周期常数没有 |
| M7 | 哪条指令用绳子记录的 `l` 选择 `ladder` 或 `rope`。已经排除读记录 `+4` 的函数不再逐个重开：`0x9BFB52`、`0x9BFD85`、`0x6B8949`、`0x9D3CCA`、`0x9D47FA`、`0xA4FC6F` | 动作名写到人物上的那次调用 | `climb` 画 `rope` | 没有写入：爬绳区域无 0x24/0x25 动作槽立即数（命中均为方向键 0x25-0x28 查询）、无 0xBDDB10 引用 |
| M8 | `+0x80`、`+0x98` 的名字，以及 `0x6131F4` 或等价写入。空中抓绳是否用这一对 | `0x9D7D4F` | 不猜宽度。测试与立足抓绳分开 | 第二对坐标槽（+0x80 校验 +0x90、+0x98 校验 +0xA8），只读；名字没有；写入没有；空中抓绳不用这对（抓绳用主对 +0x20/+0x38） |
| M9 | 哪条指令清掉已挂上的绳子（`+0x124` 或当时的等价槽），输入是什么。端点 y 夹紧不要写成下绳 | `0x9D80EC` 的调用方，以及 `+0x124` 的清零 | 不新造下绳键 | 0x9BCC34–0x9BCC3C（lea edx,[move+0x124]; xor ecx,ecx; call 0x9BFD85）；输入=0x9BCC9A 绳查找返回 0 |
| M10 | east 这一下写到人物上的动作下标。命中矩形的两个坐标从哪来，半宽是哪一个立即数或字段。持武器时类型 1、2、5、6、8 会不会填进 `0xBA59B8`。未持武器为空已经看过，不要再断成死槽 | `0x954F0F`、`0x9573A6`、`0x95C5B2`、`0xA4F93C`、`0x5114AA`、`0x773491` | 仍发一个不带名字和半宽的 `action`。不算伤害 | 下标只停局部 [ebp-0xC68]（无人物写入）；矩形坐标=用户虚表+0x10 指针的 [+0]/[+4]−0x1C；半宽没有；空行 1/2/5/6/8 静态无写入者（全映像 6 处只读引用），本次不新开捕获 |
| M11 | `field+0x13C` bit 17 和立足线 `forbidFallDown` 是不是同一位。`0xA4E6F9` 只把它收成 0 或 1，不要再把它写成下跳开关，除非这条写入证明如此 | `0x95308C` 的第一道门，以及立足线加载 | 原样保留，给出诊断 | 不是同一位：forbidFallDown（串 0x1161）收敛 0/1 后经 0x630025 写立足线记录 +0x30；field+0x13C bit 17 是地图 flags（值码 40→0x20000） |
| M12 | 换图之后人物 `+0x20`、`+0x38` 的写入。同图 `0x963D89` 只组报文。跨图 `0x53FF69` 发报文。这两处都不要再当成已经写了本地坐标 | `0x954B58` 命中之后的同图与跨图路径 | 产品落点仍是目标门的 `x/y` | 没有写入：同图本地分支 0x96422C 只写 +0x28F0..+0x2904 并 0x53E95D(move,4) 只读序列化；跨图按记录只发报文 |
| M13 | 镜头跟随、dead zone，以及地图小于视口时的摆放。VR 函数 `0x66E59E` 和它的唯一调用点 `0x66630D` 已经排除 | 跟随函数本体 | 产品夹取用 `effectiveBounds`。地图小于视口时居中留白 | 没有：MAP-CAMERA-REVERSE 已做全映像搜索，跟随/dead zone/小图摆放均不在本映像 |
| M14 | Tile、Obj、背景加载键的比较方向，以及相同键的次序。比较器不在本映像，键进入虚表 `+0xB4`。Henesys 的 tile 35 和 34 键相同，只用来核对次序 | 虚表 `+0xB4` 的比较函数 | P1 继续用产品顺序：Obj 组先于 Tile 组，同值保持源顺序 | 键交接 0x666F7D call [eax+0xB4] 指令级核实（Tile/Obj 公式不变）；比较器不在本映像；次序不推断 |
| M15 | layer 虚表 `+0x98` 的方法体。`+0x58`（`0x43715C`）的时间单位。参数顺序已经确认，不要重排参数 | `0x43715C` 所在层对象 | P1 只静态画 type 0。缺 `delay` 的帧停在第一帧 | 0x43715C 是对运行时虚表 +0x58 的转发壳（返回 dword）；虚表运行时构建，+0x58/+0x98 方法体静态不可达；时间单位没有 |
| M16 | `pt` 7、8、9、11、12、13 的分支各自写什么。`pt` 12 和 13 的 `VerticalJump` 已确认不是人物下跳，不要再接回 `0x95308C` | `0x954B58` 里 `tm == 999999999` 的那条，以及 `0x9549DF` | 这四扇门只用第 7.2 节的上键框 | pt 7/8/11→发报文（串 0x61）+ 写座位标志对（[user+0x2088]=1、+0x208C=时间戳）；pt 9→哨兵不匹配，落通用路径无专属写；pt 12→0x9549DF；pt 13→0x53E95D(move,19)+0x7ACCFF(move,−门x,门y) |

16 条都已回答，等级都是 A。下落路径 `0x9BDF18` 乘的 `+0x28` 按物理加载表是 `floatDrag1`，`walkDrag` 在 `+0x10`。上表 M6 那一格沿用逆向笔记里的注释，正文第 6.5 节按加载表。各节不再把这 16 条当开放缺口。
