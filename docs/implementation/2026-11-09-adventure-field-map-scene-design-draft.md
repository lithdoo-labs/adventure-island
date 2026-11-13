# Adventure Field & Map Scene Runtime 设计草案

> **状态：Draft。** 2026-11-09 评审已经收口绘制契约。完成定义是从童话村走到中央广场、商店街和动物园这条走廊上的行走、跳跃、蹲下、游泳、攻击、下跳、坐下和爬绳，以及走廊上的换图。跳跃分成陆地跳、水中跳和下跳。走廊一共 13 张图，名单在第 1.3 节。交付物是整条 `base` → `adventure-map` 进程，包括内容闭包、物理、移动和换图，不只是地图组件。这些功能还没有实现。客户端证据在 [MAP-MOTION-REVERSE.md](../../research/result/map/MAP-MOTION-REVERSE.md)。尚未接入的清单在第 12 节。
>
> **修订：** [2026-11-09 Adventure Field 设计评审修订](../reviews/2026-11-09-adventure-field-design-revision.md)。逻辑记录以 [MAP-SCENE-PLAN-V1.md](../../components/MAP-SCENE-PLAN-V1.md) 为准。
>
> **子契约状态：Adventure Island RenderNode ABI v1 已冻结。** 组件标签及其 attrs/data/children/events 以 [RENDER-NODE-ABI-V1.md](../../components/RENDER-NODE-ABI-V1.md) 为唯一规范。本文不改这套数据结构。架构、运行时和验收内容仍为 Draft。
>
> **2026-11-12 增补：** 位置钟与画面钟的分层仍在第 6.2 节。阶段目标要对齐客户端的行走、三种跳、蹲下、游泳、攻击、下跳、坐下、爬绳和走廊换图。地面一步的闭合式在第 6.5 节，指令在 [MAP-T1-T2-REVERSE.md](../../research/result/map/MAP-T1-T2-REVERSE.md)。这 13 张的立足属性是构造时写入的 1、1、0，对应缺省的 `drag`、`force`。`field+0x13C` 是 `mpRecovery`，这 13 张没有该属性，读出的整数是 0。`[move+0x190]` 上的四份双精度在这 13 张上是 1。`[move+0x198]` 挂接时指向 owner `+0x20` 的鞋子，基准是 `100`，缓坡阈值是 `0.9`。`0x70DF65` 在 8 张游泳图返回 1，在 5 张陆地返回 0。还没有客户端写入或数值的项在第 16 节。不把代数值写成已经对齐。画面钟只留在 `cms-actor`。LoomRealm gitlink 不升级。M1–M16 在 [MAP-M1-M16-REVERSE.md](../../research/result/map/MAP-M1-M16-REVERSE.md)，摘要在第 14 节。N1–N8 在 [MAP-N1-N8-REVERSE.md](../../research/result/map/MAP-N1-N8-REVERSE.md)，摘要在第 15 节。
>
> **2026-11-13 增补：** 依据 [SEC16-FORENSICS.md](../../research/result/atlas/SEC16-FORENSICS.md)（取证提交 `46e8a59f`）校正 R5/R9/R13/R14 和 `+0x61`，并在第 16.4 节加入 HeavenClient、MapleUnity 等社区实现交叉参考。社区代码是行为参考，不等于 CMS079 原版证据；与早期 M 系列摘要有冲突时，以第 16.3 节的最新取证边界为准。
>
> 日期：2026-11-09  
> 设计分支：`design/adventure-field-map-scene`  
> 基线：`main@554494452933b19de67db44dd8a0f38190df7d25`  
> LoomRealm gitlink：`93648192323bf5f57996b7b54cbae641d8a53fdb`（保持固定，不随本设计升级）

## 0. 摘要与建议决策

当前 `main` 已完成 Base → Adventure Map → `cms-actor` 的 PWA 垂直切片：正式 Game Entry、统一 Controls、只读 AvatarPlan Content、人物绘制和生命周期清理已经接通。当前 `systems/adventure-map/subsystem.mjs` 仍是角色展示运行时：方向输入改变 `locomotion/facing`，人物 `x/y` 根据 Viewport 居中；它没有世界坐标、地图绘制、物理 Tick、Foothold 碰撞、Camera 或地图切换。

下一阶段建议命名为 **Adventure Field & Map Scene Runtime**，沿用现有 `adventure-map` Subsystem，不增加第二个地图入口。核心决策：

1. **保留 `cms-actor` 的职责和 ABI。** 它继续只绘制人物；位置、运动和场景归属由 Field Runtime 决定。
2. **第一批是童话村到三张有座位的城镇。** 最少 13 张，名单在第 1.3 节。完成定义包括行走、三种跳跃、蹲下、游泳、攻击、坐下、爬绳，以及这条走廊上的换图。按键分配是产品约定，客户端函数见第 6.6 节。
3. **把纯游戏规则放进独立的 `libs/adventure-field/`。** `systems/adventure-map/` 负责 LoomRealm Frame、Controls、Content 和 RenderDomain 编排；纯函数库不依赖 DOM、LoomRealm 或浏览器 API。
4. **地图和物理参数放在 `content/[FSDB]adventure`。** 第 1.3 节的 13 张、它们引用的画布、有源记录的绳子和座位、`map.helper` 的游戏出口帧和 `physics.default` 已经写入。构建期再投影 MapScenePlan。浏览器组件不直接读取 FSDB、WZ 或本地文件。
5. **沿用现有组件职责，先更新绘制语义。** 六个 MVP 组件的分工保持不变。排序、Bounds、背景支持范围、Portal 资源和帧时间按 2026-11-09 修订执行，再进入实现。
6. **运动用固定步长的纯函数。** 参数来自 `physics.default`。已反汇编的式子形状在第 6.5 节和第 6.6 节。还没有写入或数值的项在第 16 节，不代成 `walkSpeed` 或 `jumpSpeed`。时间分成位置钟和画面钟，见第 6.2 节。

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

| 地图 | 编号 | `mapMark` | `swim` | 座位 | 绳子 |
|---|---|---|---:|---:|---:|
| 童话村 | `222000000` | `Folkvillige` | 0 | 0 | 1 |
| 井口 | `222000001` | `Folkvillige` | 0 | 0 | 1 |
| 矩形地带 | `230030200` | `AquaRoad` | 1 | 0 | 0 |
| 蘑菇珊瑚山丘 | `230030100` | `AquaRoad` | 1 | 0 | 1 |
| 蓝海草路 | `230030000` | `AquaRoad` | 1 | 0 | 0 |
| 大鱼峡谷 | `230020300` | `AquaRoad` | 1 | 0 | 0 |
| 沙城 | `230020200` | `AquaRoad` | 1 | 0 | 1 |
| 海草之塔 | `230020100` | `AquaRoad` | 1 | 0 | 0 |
| 东海叉路 | `230020000` | `AquaRoad` | 1 | 0 | 0 |
| 水下世界 | `230000000` | `AquaRoad` | 1 | 0 | 0 |
| 中央广场 | `230000001` | `AquaRoad` | 0 | 3 | 1 |
| 商店街 | `230000002` | `AquaRoad` | 0 | 6 | 6 |
| 动物园 | `230000003` | `AquaRoad` | 0 | 3 | 5 |

这 13 张是从童话村走到三张有座位的图的最短走廊，含两端。少一张就到不了这三张城镇里的全部。名字来自 `String.wz/Map.img/ossyria`。`swim`、座位条数和绳子条数来自 `Map.wz`。

井口的 VR 宽是 800。客户端内缩各 400 之后，左右收成同一个 x。上下仍有高度。没有 VR 的图，边界走小地图或立足线回退。`info.swim` 为 1 时游泳和水中跳；为 0 时行走、陆地跳、下跳和蹲下。矩形地带到水下世界是游泳。中央广场、商店街和动物园是陆地，座位在这三张上。矩形地带还有 `decHP`，这次不把它做成持续掉血。中央广场、商店街和动物园的 `fieldLimit` 是 4，其余是 0。下跳的 bit 17 不读这个整数。`field+0x13C` 来自 `info/mpRecovery`。这 13 张没有该属性，读出的值是 0，见第 16 节。

### 1.4 验证用的传送

换图由上键触发，框是门的 `x±20`、`y±50`，见第 7.2 节。`0x954B58` 跳过的是 `pt == 0`。走廊向西的门是 `pt` 2，用同一套框。

启用规则：`pt` 是 1、2 或 3，`tm` 属于这 13 张，并且不是 `999999999`。同图只改落点，不换 `mapId`。`tm` 不在这 13 张里的不换图，包括童话村的 `tower00`、`east00`，以及走廊分出去的 `230030101`、`230030001`、`230020201`、`230020101`、`230040200`、`230010400`。`pt` 10 不换图。`pt` 7、8、9、11、12、13 仍按第 7.2 节做本地效果。

从童话村到三张城镇的一条最短走法：

```text
222000000 in00     pt=1 → 222000001
222000001 sea00    pt=1 → 230030200
230030200 west00   pt=2 → 230030100
230030100 west00   pt=2 → 230030000
230030000 west00   pt=2 → 230020300
230020300 west00   pt=2 → 230020200
230020200 west00   pt=2 → 230020100
230020100 west00   pt=2 → 230020000
230020000 west00   pt=2 → 230000000
230000000 in00     pt=2 → 230000001
230000000 market00 pt=1 → 230000002
230000000 zoo00    pt=1 → 230000003
```

回程是对面的 `east00`、`out00`、`out01`。三张城镇之间还有 `pt` 1 的门，目标仍在这 13 张里，同样启用。井口 `st00` 的 `tm` 是 `999999999`，不换图。

`pt` 1 和 `pt` 3 不加载 `pv`。`pt` 2 加载 `pv`。没有对应游戏帧时不创建 `cms-portal`。逻辑换图仍然成立。

### 1.5 数据来源边界

`content/[FSDB]cms` 是转换来源。游戏读取 `content/[FSDB]adventure`。地图表见 [adventure_design.md](../../content/adventure_design.md) 第 4 章。构建期从转换库投影出自研表和 MapScenePlanV1。运行时和 Web Component 不读 CMS 表，也不读 WZ。

## 2. 目标、非目标与 MVP 定义

### 2.1 目标

- 能从 Adventure Content 加载第 1.3 节这 13 张图的背景、Tile、Obj、Foothold、Portal、绳子和座位。这 13 张已经在 adventure 库里。`read-adventure-fsdb.mjs` 还只发布纸娃娃。
- 使用像素世界坐标表示人物位置；人物坐标不再由 Viewport 居中计算。
- Camera 根据 Viewport 和 `effectiveBounds` 显示世界区域。跟随见第 16 节 R14。投影仍是视口左上角和 1:1。
- `swim` 为 0 时走陆地，为 1 时走水。三种跳的式子形状分开。初速数值、落地换姿和松开下键还没有客户端写入，见第 16 节。
- 上键在传送口换图，在绳子范围内爬绳。North 坐下，要命中座位。East 打出一次攻击。下跳和蹲下是两条状态。
- 沿第 1.4 节启用的门切换场景。换图由上键触发，每次切换是一次 `replace`。同图只改落点。
- PWA Bundle 只包含这 13 张地图的显式资源闭包；可重复构建且 Content Version 稳定。
- 固定步长的 Node 测试可以复现。`dt` 见第 16 节 R14。`cms-actor` 换帧是画面钟，单独算。

### 2.2 非目标

- 在线服务器、网络同步、封包收发和多人状态。
- 怪物、NPC 对话、Reactors、技能列表、任务和地图脚本。坐下用座位，爬绳用已入库的绳子。攻击只做一次动作，不做出招表。
- 矩形地带的 `decHP`，以及 `tm` 不在这 13 张里的出口。
- 全量 CMS079 地图导入或全库无损性结论。
- 把 `walkForce=140000` 或 `gravityAcc=2000` 写成 px/s，或拿它们代替第 6.5 节的地面一步。起跳和下落里还没有数值的 decrypt 槽也不代成这些常数。第 1.4 节的门仍走换图。其他 `pt` 的行为以已反汇编的分支为准。
- 把 Tile/Obj/Portal 的规则写进 `cms-actor`。

### 2.3 MVP 完成定义

完成定义包括画面、运动和换图：

1. PWA 能进入童话村，而不是占位背景或单独的 Actor 展示页。
2. 产品锚定和产品绘制顺序正确。人物按第 4.3 节插在当前层 Obj 的前后。渲染树节点数随背景数和图层数增长，而不是随 Tile/Obj 数量增长。
3. 人物 `x/y` 是世界坐标。Camera 按第 4.2 节跟随并夹取。Viewport resize 不改写玩家世界坐标。
4. 在 `info.swim` 为 0 的图上走出行走、陆地跳、落地、下跳和蹲下。这些图是童话村、井口、中央广场、商店街和动物园。行走按第 6.5 节的地面一步。落地换姿、松开下键、穿平台和墙见第 16 节。下跳只走第 6.6 节已经反汇编的门闩。
5. 在 `info.swim` 为 1 的图上改为游泳。这条走廊上是矩形地带到水下世界。水中跳不复用陆地跳的式子。四个方向的游速和水中起跳的数值见第 16 节。中央广场、商店街和动物园的 `swim` 是 0。
6. 上键在第 1.4 节启用的门里，并且当前有立足对象。`pt` 1、2 或 3，且 `tm` 在这 13 张里，就换图或同图改落点。落点写在哪、有没有吸附和冷却，见第 16 节。`replace` 失败时保留旧地图。
7. North 在座位命中时坐下。座位在中央广场、商店街和动物园，框是 `x±10`、`y±30`。坐下的槽由动作字 `(旧 & 1) | 0x14` 选出，式子在第 6.6 节。East 打出一次攻击。动作名和命中矩形见第 16 节 R9，不把 `locomotion` 改成攻击。抓绳用 `0xA4FC6F`。离开绳子的条件在第 6.6 节。
8. 原有 Actor、Controls、PWA Bundle、生命周期和安全构建测试没有回归。

行走按第 6.5 节验收，decrypt 槽不代成常数。其余运动等第 16 节的客户端写入或数值。已有的式子形状在第 6.5 节和第 6.6 节。不把代数值当成对齐结果。

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
                 ├── 每层 cms-map-layer pass=behind
                 ├── cms-avatar-layer（插在当前立足线那一层的 behind 与 front 之间）
                 │    └── cms-actor (stable key)
                 ├── 该层 cms-map-layer pass=front
                 ├── 其余层的 front
                 ├── cms-portal
                 └── cms-back (front=1)
```

### 3.1 职责归属

| 所有者 | 负责 | 不负责 |
|---|---|---|
| `systems/adventure-map/subsystem.mjs` | Frame 生命周期、Content 读取、Controls 消费、RenderDomain 投影、错误映射。调用 `step` 的间隔见第 16 节 R14 | 直接解析 CMS 原始文件、实现几何算法、把 `requestAnimationFrame` 当成位置钟、让视觉组件各自建钟 |
| `libs/adventure-field/`（拟新增） | 纯状态转换、Foothold 索引、移动积分、碰撞、Camera 计算、Portal 目标解析 | LoomRealm、DOM、网络、文件系统、定时器 |
| 构建期 Map Adapter | 读取 adventure 第 4 章和 `physics.default`，校验引用，生成 MapScenePlan 和资源闭包 | 运行时状态、玩家运动 |
| `cms-scene-view` | 世界到 Viewport 的场景投影、Camera Bounds | Foothold 碰撞、Portal 触发 |
| `cms-map-layer` | 批量绘制一层 Tile/Obj | 地图加载、交互规则、人物移动 |
| `cms-back` | 按传入的放置坐标绘制背景，包括已经加上滚动偏移的 type 4–7 | 自己累加滚动、自建换帧时钟 |
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
  import_adventure_field.py      # 已把第 1.3 节的 13 张、绳子、座位和 physics.default 写入 adventure

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

`scenePlan.bounds` 等于 `effectiveBounds`。组件收到的边界不再做第二次内缩。原版镜头跟随策略尚未证实，见第 16 节 R14 和 16.4 社区实现参考。不把「身体原点放到视口中心再夹取」写成客户端跟随。`step` 不读 Viewport。

`info/link` 指向其他地图时，Map Adapter 必须先解析链接目标的地图绘制内容，再生成当前 mapId 对应的场景计划；链接语义不能由组件猜测。

### 4.3 渲染顺序

下面是产品树顺序。客户端加载键已经恢复。`call [eax+0xB4]` 是经变体对象的 COM 风格虚调用（其返回值随后按 HRESULT 检查）；22 张候选虚表的第 45 槽全分类均无插入/比较语义，比较器体尚未定位，接口未绑定唯一候选；相同键的次序不推断。Obj 的加载键不读 `zM`，且 Obj 走栈封装 cdecl 通道而非该虚调用。人物和 Obj 的前后暂用产品规则，不能把未定位的比较器说成已经恢复。

每一层有两个稳定节点，都用 `cms-map-layer`：`pass=behind` 与 `pass=front`。换地图才改 children。每一步只改 attrs/data。`cms-actor` 的 key 保持不变，插在当前立足线那一层的两段之间。没有立足线时，插在 layer 0 的两段之间。

1. `front=0` 的背景。
2. 按 `layer=0..7`：该层 `pass=behind`，若这一层是人物所在层则接 `cms-avatar-layer`，再接该层 `pass=front`。
3. 本阶段启用的 `cms-portal`。
4. `front=1` 的近景背景。

人物和 Obj 谁在前，见第 16 节 R13。不按放置 `y` 把一层拆成前后两遍。

立足线的 `layer` 不变时，只更新各层的 data。`layer` 变了，才重排 `cms-scene-view` 的 children，把已有的 `cms-avatar-layer` 移到新层的两段之间，不新建人物节点。`update()` 不能改 children，所以这一次走场景子树的 replace。

NPC、Reactor 和座位都不建画面节点。座位点留在 MapScenePlan。Foothold 和 Rope 不作为正式画面节点；需要诊断时由 `cms-scene-view` 的可选辅助线显示。

换场景时保留 `cms-scene-view`、`cms-avatar-layer` 与 `cms-actor` 的 key；所有地图专属子节点使用单调递增的 `sceneEpoch` 生成新 key，避免地图 A → B → A 时违反 Render Update v1 的 one-shot key 规则。

### 4.4 Tile 与 Obj 绘制

- 一个非空地图层对应一个 `cms-map-layer`；不得为每个 Tile/Obj 创建 RenderNode 或 Web Component。
- Tile 使用 `Tile/{tileSet}` 中的真实 Canvas 尺寸、`origin` 和画布 `z`；位置是像素放置，不是统一格子。放置记录保留 `zM` 和源顺序。Obj 保留放置 `z`、`zM`、`flip` 和源顺序。
- 客户端已确认 Tile 键使用画布 `z` 与放置 `zM`，Obj 键使用放置 `z` 而不使用 `zM`。两条键的基准常数不同。`call [eax+0xB4]` 是经变体对象的 COM 风格虚调用（返回值按 HRESULT 检查）；22 张候选虚表第 45 槽全分类无插入/比较语义，比较器体尚未定位，接口未绑定唯一候选；相同键的次序不推断。Adapter 把键写入 MapScenePlan 的 `clientSortKey`，供诊断和以后的像素对照。
- 产品绘制顺序保持：Obj 组先于 Tile 组；Obj 按 `z` 升序；Tile 按 `canvasZ` 升序；同值保持源顺序。这个顺序来自 HaCreator，必须标注为产品约定。P1 的像素验收只证明产品顺序，不证明客户端比较器。
- 四张没有画布 `z` 的 Tile Canvas 不得把 `canvasZ` 默认为 0。引用它们的记录是 unsupported，不进入 `MapLayerPlanV1`。
- `zM` 继续进入视觉放置记录，供诊断和 Tile 键使用。人物与 Obj 的前后按第 4.3 节，不按未恢复的比较器。`reactor/name` 留在逻辑记录。`r` 不是 0，或存在 `flow` 时，Adapter 报告 unsupported。

### 4.5 Background

`cms-back` 每个背景放置项一个节点。Adapter 将源字段 `bS/no/ani/x/y/rx/ry/type/cx/cy/f/a` 映射到 ABI v1 的对应 attrs。源 `front` 只决定远景段或近景段，不投影为 attrs。`front` 参与客户端加载键。`call [eax+0xB4]` 是经变体对象的 COM 风格虚调用（返回值按 HRESULT 检查）；比较器体尚未定位，接口未绑定唯一候选；相同键的次序不推断。

客户端已确认 type 0–3 走普通分支，type 4 与 6 按 `rx` 水平滚动，type 5 与 7 按 `ry` 垂直滚动，距离是 `20000 / |rate|`。`+0x98` 的参数顺序已经确认。`0x43715C` 只把调用转到运行时虚表 `+0x58` 并返回一个 dword。该 layer 实例的动态目标未绑定，时间单位未证；不能据此断言所有 `+0x58` 方法体不在映像。距离 `20000 / |rate|` 是客户端的。每一步加几次、偏移符号怎样，见第 16 节 R14。不把 25 毫秒或正 rate 增加写成已经对齐的节拍。type 0–3 不滚动。`cx`、`cy` 为 0 时客户端不改用画布宽高。

帧缺少 `delay` 时停在第一帧。`Back/grassySoil.img/ani/0` 有 10 帧且都没有 `delay`，呈现为第一帧静止。`loop: true` 不补帧时间。带 `delay` 的背景，以及带 `delay` 的传送门画面，要逐帧推进。客户端没有这条写入：`0x43715C` 的返回值只加进滚动；动画列表在 `0x66A136` 交给虚表 `+0x110`，具体动态目标未绑定；移动对象虚表 `+0x110` 的方法体已在映像内定位，不能直接认定是此调用。`pv` 在 `0x71A968` 取得后直接交给 `0x43286E`，没有 delay 比较，也没有帧号写入。带 `delay` 的背景和传送门画面怎样换帧，见第 16 节 R14。缺 `delay` 的帧停在第一帧。不把每步加 25 毫秒写成客户端节拍。人物换帧仍由 `cms-actor` 的画面钟负责，见第 6.2 节。

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

第一批 allowlist 是第 1.3 节的 13 张。这 13 张、它们引用到的画布、有源记录的绳子和座位、`map.helper` 里 `portal/game` 的 `pv`/`ph`/`psh`，以及 `physics.default`，已经在 `content/[FSDB]adventure`。导入脚本是 `scripts/wz_fsdb/import_adventure_field.py`。构建适配器从这些 adventure 表投影 MapScenePlan，不再在运行时读转换库。

导入时读过的转换库表是：

- `[struct]Map`、`[struct]Physics`。
- `[group]Back`、`[group]Tile`、`[group]Obj`、`[group]Foothold`、`[group]Portal`、`[group]Rope`、`[group]map.Seat`。没有 `seat` 节点的图不写空座位文件。中央广场、商店街和动物园按源记录写座位。
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

每张地图一个 Plan。它是从 CMS 源记录投影出的运行时逻辑数据，不是新的 WZ 格式，也不把原始 CMS 记录直接塞进 RenderNode。根上有 `formatVersion`、`mapId`、带 `sourceBounds` 与 `effectiveBounds` 的 `bounds`、`backgrounds`、`layers`、`footholds`、`ropes`、`seats` 和 `portals`。没有座位的图，`seats` 是空数组。

Plan 中每个实际绘制资源都引用 `namespace/key/contentVersion`，并包含 source rectangle、Canvas 尺寸和 origin。Tile 另有画布 `canvasZ`，缺 `z` 时整张 Plan 不发布。投影到 RenderNode 的字段由 [RenderNode ABI v1](../../components/RENDER-NODE-ABI-V1.md) 冻结。`clientSortKey` 和 bounds 来源留在 Plan，不进入组件 data。Web Component 不读取 `struct.Tileset` 或 `struct.Obj`。

### 5.3 RenderNode 数据预算

LoomRealm Render Update v1 **没有通用的 `RenderNode.data` 字节上限**。现有 `cms-actor` 的 `AvatarPlanV1` 将 262,144 compact UTF-8 字节作为自身的应用层 validator 上限；该数字不是 LoomRealm wire protocol 限制。地图不得沿用这个数字作为未经测量的通用限制。

运行时按冻结 ABI 将地图 Plan 投影为独立节点：

- `cms-scene-view.data`：`scenePlan.bounds` 和可选 Foothold/Rope 调试几何。
- 每个 `cms-map-layer.data`：该层自己的 `mapLayerPlan.assets/tiles/objs`。
- 每个 `cms-back.data` / `cms-portal.data`：分别携带 `backPlan` / `portalPlan`（帧、原点和版本化资源引用）。
- `cms-avatar-layer`：空 attrs/data，只保留子树容器职责。
- `cms-actor.data`：保持原 `avatarPlan`，不与地图数据混合。

在这 13 张 allowlist 地图上测量每个最终 RenderNode.data 的 compact UTF-8 字节数、数组规模、引用资源数、解码并发和峰值内存，再决定 MapLayerPlanV1 / BackPlanV1 / PortalPlanV1 的应用层容量策略。测量必须按实际序列化字节进行，不得以 JavaScript 字符串长度代替。若超出之后制定的产品预算，应拆分 Content/渲染批次或缩减计划；不得把产品预算描述成 LoomRealm 协议上限。

### 5.4 Portal 资源现状

客户端资源选择已经确认。`pt` 2、4、7 读取 `Map/MapHelper.img/portal/game/pv`；10、11 读取实例 `image`，空值用 `default`；0、1、3、5、6、8 不加载 pv，逻辑记录的 `visual` 是 `none`；9、12 不发布；13 的使用路径读取 `Effect/BasicEff.img/VerticalJump`，也不发布成 pv。井口 `out00` 是 `pt` 3，没有画面，切换仍然成立。原始 WZ 含有 `MapHelper.img` 和 818 张 Canvas。`pv/0` 的 origin 是 `(43, 173)`，没有 `z` 和 `delay`。

当前 `content/[FSDB]cms/[resource]图` 没有 `MapHelper`。缺口是 Content 闭包，不是原始路径不存在。资源要经过提取、校验、转成 Content Resource、写入 allowlist，再用游戏画面验收。没有这些帧时不创建 `cms-portal`，逻辑 Portal Record 仍留在 Plan。禁止用 `portal/editor` 的 `sp/pi` 充当游戏画面，也不使用无贴图标冒充已验收的 PortalPlan。

`tm` 和 `tn` 已在实例加载函数中读取。`tm == 999999999` 时客户端使用函数直接返回。同图时 `tn` 匹配另一个 portal 的 `pn`。跨图调用收到 `pn`。同图和跨图的命中路径都不写人物 `+0x20` / `+0x38`。Field Runtime 继续持有 `(tm, tn)`。人物坐标写在哪，见第 16 节。

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
    seatId: null,
    forcedDx: 0,
    forcedDy: 0
  },
  camera: { x: 0, y: 0 },
  scroll: {},
  frames: {},
  portalScriptArmed: false,
  transition: { status: "idle", targetMapId: null }
}
```

`swim` 来自当前地图的 `info.swim`，换图时随地图更新。`locomotion` 的 ABI 是 `stand`、`walk`、`jump`、`prone`、`swim`、`sit`、`climb`。校验器还只接受前三个，实现运动时一起改，不另做一套人物节点。攻击不占 `locomotion`，用已有的 `action` 事件。`forcedDx` / `forcedDy` 只给第 7.2 节的 `pt` 13，同一步加进速度后清零。`scroll` 按背景层记下第 4.5 节的滚动偏移，不改 MapScenePlan。`frames` 记下有 `delay` 的背景和传送门画面当前帧号与累加器。`portalScriptArmed` 只给 `pt` 7、8、11。`paused` 不放进这份状态，放在 `adventure-map`。状态里能由 `step` 改的部分仍是纯函数。镜头、滚动偏移和帧号由子系统在 `step` 返回后写入。Subsystem 是唯一运行时编排者，不能让 `cms-actor`、`cms-map-layer` 或 DOM 节点保存第二份权威位置。

进入童话村的出生点定为 `(-92, 294)`。这是六条 `sp` 里的一条，`pn` 为 `sp`，`pt` 为 0，`tm` 为 `999999999`。另外五条是 `(-2522, -104)`、`(-2185, 195)`、`(1487, 306)`、`(3220, -435)`、`(3278, -430)`，这次不使用。客户端没有选出这一条。换图之后的坐标见第 16 节 R10，不用这个出生点代替。

### 6.2 Tick 与确定性

时间分成两只钟。这是产品分层，不是已经还原的客户端结构。客户端没有给出「恰好两只钟、周期已知」。纸娃娃帧上的 `delay` 是画面停留。背景取时 `0x43715C` 转到 layer 虚表 `+0x58`，此处目标实例和时间单位未证；移动对象虚表的另一个 `+0x58` 方法已经在映像内定位，不能混同。物理分发 `0x9BCD6C` 的入参是调用方传来的毫秒，乘 `0xAFECD0` 的 `0.001` 变成秒。`0xB0C660` 的 `+0x24` 是 `0x9BCCFB`，结尾 `push 0x1E` 后返回。用户更新实际步进的移动对象虚表是 `0xB0CB70`：`+0x24` 是 `0x9D3FE1`，它调用 `0x9BCCFB` 并返回同一个 `0x1E`；`+0x28` 是 `0x9D4024`，里面调用 `0x9BCD6C`。`0x9BCCCA` 取 `+0x24` 的返回值，非 0 时交给 `+0x28`。爬绳 `0x9D80EC` 的 `3 * [+0x154]` 是一次调用的位移。

**位置钟**的客户端入参是立即数 `0x1E`，见第 16 节 R14。pin 没有 Tick。`step(state, input, dt)` 仍是纯函数，自己不读时钟。相同状态、相同输入、相同 `dt` 得到相同状态。不把 25 毫秒或一次最多 4 步写成这个 `dt`。方向来自现有 Controls。`north`、`south`、`east`、`up` 的边沿只进入一次调用。

**画面钟**只留在 `cms-actor`。它已经用自己的 `requestAnimationFrame` 按帧上的 `delay` 换身体和表情。运行库不逐帧推人物画面。走路的距离和 `walk` 的 180 毫秒帧不必锁在一起。`cms-back`、`cms-portal`、`cms-map-layer` 不各自再建一只画面钟。缺 `delay` 的背景停在第一帧。有 `delay` 的背景和传送门画面由位置钟按第 4.5 节推进帧号，组件只画传入的帧。type 4–7 的滚动也由位置钟改偏移。attr `paused` 为 `true` 时，人物不再累加 `delay`，背景和传送门的帧累加器也不加。

固定 gitlink `93648192323bf5f57996b7b54cbae641d8a53fdb` 的 `Frame` 只有 `id`、`params`、`signal` 和 `call`。`SubsystemScope` 提供 SharedState、SessionEvent、Content、Viewport、PresentationEvent 和 `createRenderDomain`，没有帧时间戳、帧间隔、游戏时钟或 Tick 订阅。PWA 的 `scheduler.schedule()` 没有暴露给 Subsystem，它只排协议期限。位置钟因此不能从 pin 里读出毫秒。测试在浏览器之外把 `dt` 传进 `step`。这个 `dt` 见第 16 节 R14，不注入 25。

Viewport 的现有接口是逻辑尺寸和订阅。`loomrealm.viewport-state/1` 仍是 Not Implemented / Not Qualified。Camera 可以按这个接口设计夹取，尺寸传递必须另做 resize、carrier 重连、无效尺寸和 Runtime 终止测试。Viewport 不提供游戏时间，不能当作位置钟，也不能当作画面钟。

位置钟使用固定时间步长。相同初始状态和相同输入序列应产生相同的 Field State。暂停不使用 `frame.signal` 的 abort。abort 会取消 Frame，并释放 Controls、视口订阅和 RenderDomain。`paused` 为真时不调用 `step`，见第 12.6 节。

### 6.3 Controls 映射

继续复用现有 common-controls，不监听 DOM、不重新实现 held-key tracker。面键名字就是 `north`、`south`、`east`。方向键仍是 `up`、`down`、`left`、`right`。下表的按键是产品约定，这次就用这张表，不再追客户端的默认键位。客户端用虚拟键和动作号，没有这四个面键名字。动作号进入的函数在第 6.6 节，不把 `0x33`、`0x34`、`0x35` 写成某个虚拟键的默认绑定。

| 输入 | 产品规则 |
|---|---|
| `left` / `right` | 地面时按第 6.5 节推进立足参数，并更新 `facing`。空中保留水平控制。游泳时改水平游速。`ropeId` 仍在时不改 `x`，也不改 `facing`。`ropeId` 清空之后恢复地面行走。这一步不新造下绳键 |
| `south` 按下边沿 | 跳跃键。`swim` 为 0 且站在立足线上时陆地跳一次。`swim` 为 1 时水中跳一次。按住不重复起跳。按住 `down` 时这条边沿改走下跳，不走上面两种跳 |
| `north` 按下边沿 | 坐下。座位的点落在人物 `x±10`、`y±30`，并且两段速度为 0、当前有立足，才进入。本地姿势写入见第 16 节。没有座位时这次边沿无效 |
| `east` 按下边沿 | 攻击一次。动作名和命中矩形见第 16 节。`locomotion` 不变 |
| `up` 按下边沿 | 当前有立足对象，并且人在第 7.2 节的传送框里，就换图。否则人在绳子范围内就爬那条绳子。两处都不在时，这个边沿不跳跃 |
| `down` | 没有同时出现 `south` 边沿时，站在立足线上进入蹲下。松开下键之后怎样离开，见第 16 节。游泳时的向下速度也见第 16 节。下跳不是蹲下 |
| 无方向 | 地面按第 6.5 节的 `key = 0` 分支收参数，不把 `vx` 写成 0。蹲下和坐下保持原地。空中不因为没有方向就把 `vx` 清零。游泳时没按住的轴写成 0 |

必须区分方向 State 和按下/释放边沿。跳跃、坐下、攻击和换图都不能因每次 State 刷新而重复触发。同一步里传送、抓绳、下跳、蹲下和另外两种跳只发生第一件匹配的事，顺序在第 6.7 节。

`prone` 画身体动作 `prone`。`sit` 画 `sit`。`climb` 画 `rope`。这两张验证图的绳子 `l` 都是 0。爬绳区域没有把 `ladder` 或 `rope` 写到人物上。`avatar.part.body.00002000` 没有名为 `swim` 的动作，有 `fly`（第 0、1 帧，`delay` 300）。水中跳的路径也没有动作号写入。`swim` 和水中跳画 `fly`，陆地跳画 `jump`。这是产品约定，用来分开两种姿势。

### 6.4 Foothold 几何与碰撞

`info.swim` 为 0 时，人物沿立足线行走、陆地跳、下跳和蹲下。蹲下把水平速度写成 0，脚留在当前立足线上，不向下穿平台。下跳离开当前立足线，条件在第 6.6 节。为 1 时，四个方向改变游速，跳跃键走水中跳，不复用陆地跳的速度。三种跳和游泳共用 `step(state, input, dt)`，分支分开。逐步积分的已恢复结构在第 6.5 节。游泳没有单独的积分函数。

Foothold 是地面接触与平台连接的权威数据，Tile 只是视觉资源。规则：

1. 建立按地图 `layer/platform/id` 索引的 Foothold 集合，并验证 `prev/next` 引用是否存在或为合法空值。
2. `x1 != x2` 的线段可作为水平/斜坡候选地面；用线性插值计算给定世界 X 的地面 Y。
3. 角色下落时检测脚底轨迹与候选线段的向下穿越，选择最早有效接触点，落地后设置 `grounded=true` 与 `footholdId`。
4. 沿平台移动时使用 `prev/next` 处理相邻段；端点交接要有确定性排序和容差，避免段间抖动。
5. `x1 == x2` 的竖线不能插值出站立高度。`0x9BED81` 比较这两个字段，相等时 `jge` 继续写下一段，不把这段丢掉。`0x9BE703` 没有半宽立即数。不把抓绳查询的 10 写成身体半宽。
6. `drag`（字符串 `0xADC`）非 0 时，把该整数乘 `0.01` 加密进属性 `+0x18`。`force`（字符串 `0xADD`）非 0 时，同样乘 `0.01` 加密进属性 `+0x24`。`forbidFallDown`（字符串 `0x1161`）收成 0 或 1 之后，经 `0x630025` 写进属性 `+0x30`。这 13 张没有这三个整数。构造函数 `0xA4F36C` 先写入 `+0x18 = 1`、`+0x24 = 0`、`+0x30 = 0`，缺省整数是 0，所以覆盖不发生。`field+0x13C` 由 `0x6ABC31` 写入 `info/mpRecovery`（字符串号 `0x5B8`）的整份整数。这 13 张没有 `mpRecovery`。同一函数里 `ebx` 在 `0x6AA869` 被清成 0，缺省整数就是这个 0，所以 `field+0x13C` 是 0。bit 17 为 1 且 `0x5024C5` 返回 0 时下跳直接返回。这 13 张上这一位是 0。不把 `forbidFallDown` 或 `fieldLimit` 解释成这个门闩。
7. 映像里没有单独的身体宽度字段。碰撞宽度见第 16 节。

已恢复的接触是脚点：向下穿过水平线或斜线时落到最早接触的那段。起点交叉为正时 `0x9BE9A0` 跳过这段，从较大 y 的一侧穿过去不停在这段上。半宽没有立即数。下跳仍只走第 6.6 节已经反汇编的门闩。蹲下时脚留在当前立足线。端点交接的容差也还没有数。

### 6.5 Physics 参数

`content/[FSDB]adventure/[struct]physics.Default/physics.default.json` 保存 `Physics.img` 的 19 个原始数，包括 `walkForce`、`walkSpeed`、`walkDrag`、`slipForce`、`slipSpeed`、`gravityAcc`、`fallSpeed`、`jumpSpeed`、`maxFriction`、`minFriction`，以及 `swimForce`、`swimSpeed`、`swimSpeedDec`。转换库里的 `struct.Physics/default` 只是导入来源。

这些名字不在四个 decrypt 槽旁边，本映像也没有给 `[move+0x190]`、`[move+0x198]` 配上这些字符串。陆跳和下跳的式子形状在第 6.6 节。字段名没有，三个跳的分支继续分开，不把缺名字的槽改写成 `walkForce` 或 `jumpSpeed`。

物理分发 `0x9BCD6C` 已经反汇编到这些结构。入参是调用方的毫秒增量，乘 `0xAFECD0` 的 `0.001` 变成秒。本地虚表 `+0x24` 返回立即数 `0x1E`。不把 `walkForce=140000` 或 `gravityAcc=2000` 写成 px/s。下面是已反汇编的结构。缺的写入和数值在第 16 节，不另造代数值。地面一步的指令在 [MAP-T1-T2-REVERSE.md](../../research/result/map/MAP-T1-T2-REVERSE.md)，其余结构在 [MAP-N1-N8-REVERSE.md](../../research/result/map/MAP-N1-N8-REVERSE.md)。

#### 地面一步

有立足时走 `0x9BD757`，调用点是 `0x9BCDE1`。`0x9BE703` 入口到 `0x9BEE0B` 之前仍然没有物理表乘法、没有键、没有 dt、没有坐标写入。指令在 [MAP-T1-T2-REVERSE.md](../../research/result/map/MAP-T1-T2-REVERSE.md)。

`dt` 是调用方毫秒乘 `0.001`。`B = DEC([move+0x198]+0x0C)`。`L = DEC(立足属性+0x24) + DEC([move+0x198]+0x90)`。`uvy` 是立足点 `+0x38`。`uvy < 0` 时 `slopeSign = +1`，否则为 `-1`。`P` 的初值是 `+0xE0` 第二槽的解密值。

`DEC(属性+0x18) = 1` 且 `DEC(属性+0x24) = 0` 时是特殊立足。速度选择量这时是 `DEC([move+0x198]+0x18)`，摩擦选择量是 `DEC([move+0x198]+0x30)`。否则两个选择量都是 `1`。

这 13 张的每条立足在客户端 `Map.wz` 里只有 `x1`、`y1`、`x2`、`y2`、`prev`、`next`。属性对象由 `0xA4F36C` 构造：`+0xC` 和 `+0x18` 加密写入 `1.0`，`+0x24` 加密写入 `0.0`，`+0x30` 经 `0x630025` 写入 `0`。几何记录 `0xA4F4B6` 把这个对象放在立足 `+0x28`。`drag`（`0xADC`）非 0 时，该整数乘 `0.01`（`0xAFEF10`）覆盖 `+0x18`。`force`（`0xADD`）非 0 时，同样覆盖 `+0x24`。`forbidFallDown`（`0x1161`）非 0 时重写 `+0x30`。这三个整数在这 13 张上都不存在，缺省值是 0，覆盖不发生。每条立足都是特殊立足。`DEC(属性+0xC) = 1`，`DEC(属性+0x18) = 1`，`DEC(属性+0x24) = 0`。`L` 的立足部分是 `0`，只剩 `DEC([move+0x198]+0x90)`。速度选择量和摩擦选择量走人物槽。

```
speedRaw = DEC(属性+0xC) · walkForce · 速度选择量 · DEC([move+0x190])
step₀ = key · speedRaw
```

`0x70DF65` 非 0 时 `step₀` 再乘 `swimSpeedDec`。

```
L = 0 且 key·step₀ > 0     step₁ = step₀
L = 0 且 key·step₀ ≤ 0     step₁ = 0
L ≠ 0 且 key = 0           step₁ = L · speedRaw
key·L > 0                  step₁ = step₀ · (1 + |L|)
key·L ≤ 0 且 key ≠ 0       step₁ = step₀ · (1 − 0.8·|L|)
```

`key = 0` 且 `L ≠ 0` 这一支不乘 `swimSpeedDec`。`uvy < 0` 时 `step = (1 − uvy²) · step₁`，否则 `step = (1 + uvy²) · step₁`。

速度上限的底是 `DEC(属性+0xC) · walkSpeed`。`key ≠ 0`、特殊立足、或 `DEC([move+0x198]+0x90) = 0` 时再乘 `DEC([move+0x198]+0x24)`。`0x70DF65` 非 0 时再乘 `swimSpeedDec`。记这个积为 `cap`。

```
L = 0                      endpoint = cap
L ≠ 0 且 key = 0           endpoint = |L| · cap
key·L > 0                  endpoint = cap · (1 + |L|)
key·L ≤ 0 且 key ≠ 0       endpoint = cap · (1 − 0.8·|L|)
```

摩擦先计算 `DEC(属性+0x18) · 摩擦选择量 · DEC([move+0x190]+0x0C)`，夹到 `[minFriction, maxFriction]`，小于 `1` 再乘 `0.5`，然后乘 `walkDrag`。这个积为 `0` 时，摩擦步长改用 `walkDrag × 0.2`。记 `δ` 为摩擦步长除以 `B` 再乘 `dt`，`δ₀` 为 `fric·walkDrag / B · dt`。收到一个区间时，高出上界就减一步并停在上界，低于下界就加一步并停在下界。

`0x9BDEA7` 的推进：界限小于 `0` 时不动。驱动为正且当前值低于界限时，加上 `驱动 / B · dt`，越过上界就停在上界。驱动小于或等于 `0` 且当前值高于负界限时同样相加，越过下界就停在下界。已经在驱动方向的界外则不动。

平地，`uvy = 0`。`endpoint ≥ 0` 时先用 `δ` 收到 `[−endpoint, endpoint]`。`key = 0` 且 `L = 0` 时再用 `δ₀` 收到 `0`。其余情况以 `step` 为驱动、`endpoint` 为界限推进。

缓坡，`uvy ≠ 0` 且 `DEC([move+0x198]+0x3C) ≥ |uvy|`。先用 `δ` 收到 `[−c, c]`。`slopeSign·P > 0` 时 `c = max((1+uvy²)·endpoint, 0)`，否则 `c = max(endpoint, 0)`。`fric = 0` 时把 `step` 改成 `step − |uvy|·slipForce·slopeSign`。`key = 0` 且 `fric ≠ 0` 且 `L = 0` 时用 `δ₀` 收到 `0`。其余情况以 `step` 为驱动推进：`slopeSign·step > 0` 时界限是 `max(endpoint, 0)`，否则是 `max((1+uvy²)·endpoint, 0)`。

陡坡，`uvy ≠ 0` 且 `DEC([move+0x198]+0x3C) < |uvy|`。先做缓坡的区间收束。`slopeSign` 与 `P` 同号时再用 `δ` 收到 `0`。然后：

```
key·slopeSign > 0     驱动 = −slopeSign·|uvy|·slipForce·0.5
                      界限 = |uvy|·slipSpeed·0.5
key = 0 且 L = 0      驱动 = −slopeSign·|uvy|·slipForce
                      界限 = |uvy|·slipSpeed
其余                  驱动 = −slopeSign·|uvy|·slipForce + step
                      界限 = |uvy|·slipSpeed + max((1+uvy²)·endpoint, 0)
```

`key·slopeSign > 0` 时驱动不含 `step`。

函数末尾固定两笔：`slot1 ← DEC(slot1) + (DEC(slot2) + P)·dt·0.5`，`slot2 ← P`。返回后先调虚表 `+0x0C`（`0x9BF1FA`）。`slot1` 落在 `[0, 立足点+0x40]` 时，`0x9BC992` 用第一槽投影并返回 `0`：

```
x = slot1 · 立足点[+0x30] + 立足点[+0xC]
y = slot1 · 立足点[+0x38] + 立足点[+0x10]
```

`slot2` 乘这两个方向分量，写入 `move+0x50` 和 `move+0x68`。返回 `0` 时分发器不再把 `slot2·dt` 加进 `slot1`。返回 `1` 时才做那次加法并再调一次。

`0x9BF1FA` 开头调用 `0x9BF9D3`。投影 `x = 一步后的 slot1 · 立足点[+0x30] + 立足点[+0xC]`。`move+0x138` 和 `move+0x140` 是 `0x9BC602` 从 `[0xBDD498]+0x24`、`+0x2C` 抄来的整数。物理对象建在外层对象的 `+0x10`，`[0xBDD498]` 和 `[[地图+0x34]+4]` 都是这个地址，`0xA4DDDB` 改的就是它。每读一条立足，`+0x24` 收成更小的 `min(当前, min(x1, x2) + 30)`，`+0x2C` 收成更大的 `max(当前, max(x1, x2) - 30)`。`+0x28` 收成 `min(当前, min(y1, y2) - 300)`，`+0x30` 收成 `max(当前, max(y1, y2) + 10)`。构造函数在这之前把 `0x7FFFFFFF`、`0x7FFFFFFF`、`0x80000000`、`0x80000000` 按左、上、右、下交给 `[0xBE16BC]`，目标是 `+0x24`。同一入口在 `0x414939` 收到的四个整数是 `-0x58`、`-0x3E`、`-0x12`、`-6`，第一份 x 在第二份 x 的左边。按这个顺序写下之后，装完立足的左界是所有 `min(x1, x2) + 30` 的最小值，右界是所有 `max(x1, x2) - 30` 的最大值。`0x9BC602` 在移动对象创建时抄这四份。本地人物的创建是 `0x948DE7`，调用点是 `0x96B5A3` 和 `0x991461`。同一只移动对象上没有第二条拷贝。投影落在 `+0x138` 和 `+0x140` 之间时，返回值就是入参毫秒。小于 `+0x138` 时，`slot1` 改成 `(move+0x138 - 立足点[+0xC]) / 立足点[+0x30]`，`slot2` 写成 0，返回 `trunc(毫秒 · (新slot1 - 旧slot1) / (一步后的slot1 - 旧slot1))`，再夹进 `[0, 毫秒]`。大于 `+0x140` 时用 `+0x140` 做同一件事。`0xA70F94` 是向 0 截断的浮点转整数。

留在 `[0, 立足点+0x40]` 时，调用方毫秒减去这份返回值，再调虚表 `+0x18`，函数返回 0。

走出这段时，`旧slot1` 是调用前的拷贝，`新slot1` 是一步之后的值。`新slot1 < 0` 时，比例是 `旧slot1 / (旧slot1 - 新slot1)`，邻段是当前立足 `+0x4C`。`新slot1` 大于长度时，比例是 `(长度 - 旧slot1) / (新slot1 - 旧slot1)`，邻段是当前立足 `+0x50`。调用方毫秒再减去 `trunc(上面的返回值 · 比例)`。`slot2` 按同一比例从旧值插到新值。

邻段指针是 0 时，`slot1` 写成 0 或当前长度，`0x9BC992` 仍用当前立足投影，虚表 `+0x14`（`0x9BFB52`）把 `[move+0x110]` 写成 0，函数返回 1。邻段 `+0x30` 大于 0 时，从起点走出就把 `slot1` 写成 0，从终点走出就写成邻段长度；插完的 `slot2` 若和走出方向反号就改成 0。`0x9BC992` 改用邻段投影，`0x9BFB52` 把 `[move+0x110]` 写成这条邻段，函数返回 1。邻段 `+0x30` 不大于 0 时，由邻段 `+0x38` 决定是停在当前段（`slot2` 写成 0，不换立足）还是按上面的空邻段清掉 `[move+0x110]`。

一步之前 `slot1` 已经不大于 0、一步之后的 `slot1` 大于 0，并且 `当前[+0x4C]` 的 `+0x50` 存在、不是当前段、它的 `+0x30` 大于 0 时，`slot1` 写成 0，`0x9BFB52` 换成那条，并把 `0x9BF9D3` 的返回值改成 0。对称的一侧用 `当前[+0x50]` 的 `+0x4C`，`slot1` 写成那条的长度。

`[move+0x190]` 由 `0x9BC85D`（该函数第一参数非 0 时）和 `0x9BCD2B` 写成 `[[0xBDD498]+0xAC]`。创建移动对象的路径 `0x5BFF0C` 把第一参数设成 `1`，所以会挂上。进图函数 `0xA4FCF8` 建立这个对象：`+0x00`、`+0x0C`、`+0x18`、`+0x24` 先加密写入 `1.0`，然后 `+0x00` 和 `+0x0C` 改成 `info/fs`，`fs` 为 0 时仍用 `1.0`。这 13 张没有 `fs`，缺省就是 `1.0`，所以 `DEC([move+0x190])`、`DEC(+0x0C)`、`DEC(+0x18)`、`DEC(+0x24)` 都是 `1`。

`[move+0x198]` 在挂接时写成 owner 的鞋子。`0x9BC622`（第一参数非 0）和 `0x9BCCFB` 都取 `[move+0x14]` 的虚表 `+0xC`。这个对象的虚表是 `0xB0BC40`，`+0xC` 是 `0x94B9C2`：它把 `[owner+0x20]` 写入返回的智能指针 `+4`。`0x9BFD4C` 再把 `[源+4]` 抄到 `[move+0x194+4]`，也就是 `[move+0x198]`。创建移动对象只有 `0x5BFE8C` 一条路径，owner 是 `0x94B92D` 分配的 0x48 字节对象，`[move+0x14]` 指向它。该构造函数调用 `0x692A82`，把鞋子放在 `+0x20`。构造时的解密值是 `+0x0C = 100`，`+0x18 = 1`，`+0x24 = 1`，`+0x30 = 1`，`+0x3C = 0.9`，`+0x48 = 1`，`+0x54 = 1`，`+0x60 = 1`，`+0x6C = 1`，`+0x78 = 0`，`+0x84 = 0`，`+0x90 = 0`。之后对这只鞋子调用 `0x6A05FF` 的地方没有出现。`0x9541C6` 改的是另一只鞋子，存在人物 `+0x293C`。

这 13 张因此可以代入：`B = 100`，`L = 0`，速度选择量和摩擦选择量都是 `1`，缓坡阈值 `0.9`。`speedRaw = walkForce`。按住方向时 `step₁ = key · walkForce`，8 张游泳图再乘 `swimSpeedDec`；松键时 `step₁ = 0`。`cap = walkSpeed`，游泳图再乘 `swimSpeedDec`，`endpoint = cap`。摩擦积是 `walkDrag`，步长是 `walkDrag / 100 · dt`。

- 无立足的下落在 `0x9BDF18`。`dt = 入参毫秒 × 0.001`。`fallLimit = DEC([move+0x190]+0x0C) × floatDrag1(+0x28)`，命中状态时改成 `DEC([move+0x190]+0x24) × fallSpeed(+0x68)`。`dragTerm = DEC([move+0x190]+0x0C) × floatDrag2(+0x30)`。`dragK = walkSpeed(+0x08) / walkForce(+0x00) × dragTerm`。`0x9BDEA7` 把 `dragTerm / 基准 × dt` 加到当前竖直速度，并向 `fallLimit` 钳制。基准是 `DEC([move+0x198]+0x0C)`。重力项是 `DEC([move+0x190]+0x24) × gravityAcc(+0x60) × 基准`，作为这次调用的输入。`0x979AA8` 在立足为 0、`0x70DF65` 返回 0、虚表 `+8` 返回 0、且 `DEC([move+0x198]+0x78) ≤ 0` 时返回 1。`0x9BDF8D` 把 `ecx` 设回这只移动对象再调用 `0x979AA8`。用户这只的虚表 `+8` 是 `0x9D3548`：`[move+0x190]` 为 0 时返回 0，否则 `0x429944` 解开 `+0x30` 的整数，等于 2 才返回 1。`0xA4FE49` 用参数 0 调用 `0x4B69F4` 初始化这个整数。地图 `+0x150` 非 0 时 `0xA4FDA4` 写成 1，否则 `+0x154` 非 0 时 `0xA4FDB1` 写成 2。这 13 张没有 `fly`，整数不是 2，所以 `0x9D3548` 返回 0。鞋子 `+0x78` 的构造值是 0。所以 5 张陆地在离地后进入命中分支，`fallLimit = fallSpeed`；8 张游泳图被 `0x70DF65` 挡在门外，`fallLimit` 仍是 `floatDrag1`。`0x9BDFC4` 比较 `[move+0x16c]`，零标志留到 `0x9BDFED` 的 `je`，中间的 `fnstsw` 不改它。标志为 0 且 `vy ≤ 0`，或标志非 0 且 `vy ≤ 0`，都进入 `0x9BE070`。`0x9BDEA7` 的输入是 `gravityAcc × B`，除以 `B = 100`。`vy` 小于 `fallSpeed` 时写成 `min(fallSpeed, vy + gravityAcc · dt)`，已经不小于 `fallSpeed` 时保持原值。标志为 0 且 `vy > fallSpeed` 时，`0x9BE025` 先算 `vy - floatDrag2 / 100 · dt`；结果仍不小于 `fallSpeed` 就保留，否则写成 `fallSpeed`。随后同一次 `0x9BDEA7` 看到 `vy` 已经不小于 `fallSpeed`，不再加重力。标志非 0 且 `vy > 0` 时，`0x9BDFF2` 把 `vy` 写成 `[move+0x174] × jumpSpeed × 0.001`，跳到 `0x9BE0AD`，这次不调用 `0x9BDEA7`。这次 `fild` 之前没有比较 `[move+0x168]`。用户更新在 `0x9BCCC4` 之前调用 `0x939477`。标志已经非 0 且解开的 `vy > 0` 时它返回 1；同时 `[user+0x2EE0] ≤ 0x994C7A()` 时，`0x951523` 把标志写成 0。`[user+0x2EE0]` 的直接写入只有 `0x963BEA`，值是 `0x994C7A() + 解密整数 × 0x3E8`。移动构造 `0x9BC2EB` 用 `edi = 0` 写到 `+0x170`，下一条写 `+0x190`，中间跳过 `+0x174`。`0x402D66` 分配 0x240 时标志是 0，不把这块清成 0。全映像里以 `[user+0xF28]` 这只移动对象为基址写入 `+0x174` 的只有 `0x963C65`。它在 `0x97A9DC` 返回非 0 之后，把 `0x76E2FA` 返回对象 `+0x13C` 的解密整数写入 `+0x174`，并把 `+0x168` 写成 1。`0x963B28` 的唯一调用点是 `0x975643`，技能号等于 `0x4F5C6D` 才进来。`+0x28` 是 `floatDrag1`，`walkDrag` 在 `+0x10`，这条指令没有乘它。
- 坐标写在下落处理器尾部。`0x9BE68F` 写 `+0x20` 槽对，校验 `+0x30`。`0x9BE6CE` 写 `+0x38` 槽对，校验 `+0x48`。式子是 `新坐标 = 旧坐标 + (旧速度 + 新速度) × dt × 0.5`。新的水平速度写 `+0x50` 槽对，校验 `+0x60`。新的竖直速度写 `+0x68` 槽对，校验 `+0x78`。
- 5 张陆地离地后 `0x979AA8` 返回 1，水平速度留在命中分支，不读 `flyForce`。松键时 `vx` 按 `floatDrag2 / 100 · dt` 收到 0；`vy < fallSpeed` 时步长再乘 `floatCoefficient`。按住方向时驱动是 `2 · key · floatDrag2`，界限是 `walkSpeed / walkForce · floatDrag2`。8 张游泳图进 `0x9BE3BA`。上限 `cap = swimSpeed`。先把 `vx` 收进 `[-cap, cap]`：高出 `cap` 时减去 `floatDrag1 / 100 · dt`，但不低于 `cap`；低于 `-cap` 时加上同一份，但不高于 `-cap`。`[ebp-0x28]` 在这条上仍是 `DEC([move+0x190]+0x0C) · floatDrag1`，这 13 张上是 `floatDrag1`。按住方向时 `0x9BE4F3` 再调用 `0x9BDEA7`：驱动是 `key · swimForce`，除以 100，乘 `dt`，正方向收到 `cap`，负方向收到 `-cap`。松键时 `0x9BE506` 拿 `vx` 和 `0x9BE46E` 压入的 `0` 比较，用同一份 `floatDrag1 / 100 · dt` 收到 0，跨过 0 就写成 0。竖直用同一份 `cap`。先把 `vy` 收进 `[-cap, cap]`，步长仍是 `floatDrag1 / 100 · dt`。`[move+0x154]` 为 0 时，`0x9BE650` 调用 `0x9BDEA7`，输入是 `swimForce`，除以 100，收到 `cap`。`[move+0x154] < 0` 时目标是 `0.3 × cap`，`0.3` 在 `0xB05538`：`vy` 大于目标就减去 `swimForce / 100 · dt`，小于目标就加上这份的一半（`0xAFEC20` 的 `0.5`），跨过目标就写成目标。`[move+0x154] > 0` 时目标是 `1.5 × cap`，`1.5` 在 `0xB06460`，这一步结束写成该目标。用户步进里上键把这个字写成 -1，下键写成 +1；`0x9D428A` 附近的那对解密非 0 时会把两个键和一起取反。
- 受迫位移在 `0x7ACCFF`：先把 `+0x180`、`+0x188` 清零，再累加传入的 dx、dy，并把 `+0x178` 写成 1。累加结果超过入参时写成入参本身。方向与 `0.0` 比较。没有另一颗限值常数。`0x9BD58F` 再把这两份加进速度槽。`pt` 13 传入 `(−门.x, 门.y)`。这不是行走积分。

留在本段和换到邻段都可以按上面的式子计算。夹投影 x 的那两个整数在进图之后写成什么，见第 16 节。落地换姿和松开下键还没有。

### 6.6 攻击、下跳、坐下、爬绳

证据在 [MAP-MOTION-REVERSE.md](../../research/result/map/MAP-MOTION-REVERSE.md) 和 [MAP-M1-M16-REVERSE.md](../../research/result/map/MAP-M1-M16-REVERSE.md)。这里只收进这次目标要用的结论。

**上键先传送。** `0x954B58` 在人物有立足对象时，用固定框 `x±20`、`y±50` 找 `pt != 0` 的门。这不是 `hRange` 那条测试。命中且 `tm` 不是 `999999999` 就换图，不再继续做别的。村和井的 `town` 是 1，错过门之后客户端走 `field+0x170`。矩形地带的 `town` 是 0，走另一条链表。这两条都不是 `seat`，也不是爬绳。产品的上键只做传送和爬绳。

**坐下对座位。** `seat` 装在 `field+0x16C`，每条两个整数，点测试把它们当 x、y。动作号 `0x33` 在 `0x955E0A` 调用 `0x95516A`。两段速度都为 0 且站在立足线上时，坐标取 `[user+0xEE8]` 和 `[user+0xEEC]`。`0x4376F2` 不弹这两个参数，返回 `[0xBDF54C]`，这个全局为 0 时返回 0。返回值是 `0x54634C` 的 `ecx`。框是传入的 x 减 10 到加 10、y 减 `0x1E` 到加 `0x1E`，沿 `[ecx+0x16C]` 的座位对查找。命中返回下标，否则返回 -1。下标小于 0 就不写标志。`0x9551E5` 把 `[0xBD9028]` 装进 `edi`，`0x955280` 写 `[edi+0x2088] = 1`，`0x955296` 把 `0x994C7A()` 写入 `[edi+0x208C]`。这两处是上下文对象，不是人物。`0x77FC6B` 把 `ecx` 设成 `0xBDF548`，`0x77FDC3` 写 `[esi+4]`，也就是 `[0xBDF54C]`。`0x77FB40` 把这个全局写成 0。报文之前没有 `sit`。人物上没有座位下标。`+0x2088` 的清零在换景处理器 `0x558579`、`0x55DAE2`、`0x57F13C`，不是再次按下或左右移动。产品在命中时把 `locomotion` 写成 `sit`，不发那条报文。行的形状在 adventure 第 4 章的 `[group]map.Seat`：`index`、`x`、`y`。童话村、井口和整条游泳走廊没有 `seat`，不写空文件。中央广场、商店街和动物园按源记录入库，坐标在第 16.1 节。浏览器在这三张城镇上 North 可以坐下。起来时人物上没有座位下标可清。坐下的身体不靠槽号写入：`user+0x2944` 的明文非 0 时动作字是 `(旧 & 1) | 0x14`，右移结果 10，`[avatar+0xE7C]` 为 0 时槽是 `0x27`。明文 1 的写入和本地 `0x95516A` 的关系在第 6.6 节的动作字式子里。命中框本身已经反汇编：座位的点落在人物 `x±10`、`y±30`。

**下跳和蹲下分开。** 动作号 `0x35` 在虚拟键 `0x28` 读为按下时进入 `0x95308C`，否则进入 `0x952F1F`。后者的函数体里没有 `prone`。产品把「按住 down 再按 south」交给 `0x95308C` 这条条件，把单独的 down 交给蹲下。产品用上的门闩是：当前有立足对象；脚下那扇门的 `pt` 不是 12 或 13；人物 y 加 300 之后 `0xA4F609` 为空或仍是当前立足对象；再在 `x±1`、`y+300` 到 `y+600` 里由 `0xA4F6F1` 得到立足段，并且它写出的 y 不在人物 y 的 `(y-5, y+5)` 里。成功后离开当前立足线。`0x940011(1, 1)` 只发效果。速度稍后由 `0x95539D` 把移动对象 `+0x160` 写成 1，再进入 `0x9BCFED`。竖直速度是 `decrypt([move+0x190]+0x24) / ([[[0xBDD498]+8]+0x70] * K)`。这 13 张的分子是 `1`，所以初速是 `1 / (jumpSpeed * K)`。`K` 是 `0xB0C590` 的 `-0.35355339`。结果写入 `+0x68`/`+0x78`。水平速度写成 0，写入 `+0x50`/`+0x60`。这四个 decrypt 槽旁边没有字段名。初速的数值见第 16 节。bit 17 为 1 时是拦住。`field+0x13C` 是 `info/mpRecovery`。这 13 张没有该属性，读出的整数是 0，这一位不拦住。同函数里其余返回写在下一段。不把 `forbidFallDown` 或 `fieldLimit` 解释成这个门闩。

**`0x95308C` 里会直接返回的比较。** 下面这些值是构造函数和这 13 张的立足装载写进去的，比较都不成立。`0x5024C5` 返回非 0 时跳过 bit 17 那一拍，自己不返回。`0x96C96B` 只有下面五条里有一条成立才返回 1：`[user+0x28C0]` 非 0 并且 `0x96C9C6` 返回 0；`0x6A0ADF` 解开 `+0x2944`/`+0x294C` 得到非 0；`0x599662` 返回非 0；`([user+0x3C0] & ~1) == 0x12`；`[user+0x2F00]` 非 0。人物构造 `0x94FDB4` 在 `0x94FDD7` 把 `ebx` 清成 0，再用 `0xA70120` 把 `+0x28C0` 起 12 字节填成这个 0，把 `+0x2928` 起 8 字节也填成 0，并在 `0x94FEDA` 把 `+0x2F00` 写成 0。`0x965A09` 把 `+0x2944` 编成明文 0。子对象构造 `0x44FE90` 在 `0x44FF48` 做 `and eax, 1; or eax, 6`，写入 `[user+0x3C0]`，所以这个整数是 6 或 7，与 `~1` 相与是 6，不等于 `0x12`。`0x599662`、`0x95306D`、`0x952A38` 都先调用用户虚表 `+8`。这张虚表是 `0xB0BD28`，`+8` 是 `0x950E20`，返回 `[0xBD9028] + 0x2110`。三对分别是这块上的 `+0x2DC`/`+0x2E4`、`+0x4BC`/`+0x4C4`、`+0x630`/`+0x638`。启动桩 `0xA0AF10` 跳进 `0xA0AF9A`，把静态对象 `0xBE2E90` 写入 `[0xBD9028]`，再以 `this+0x2110` 调用 `0x784B5E`。`0x784B5E` 末尾调用 `0x78523B`，三处都是 `xor ecx, ecx` 再 `call 0x416E36`，校验分别落在 `+0x2E4`、`+0x4C4`、`+0x638`。明文 0 解开仍是 0，随后的 `neg/sbb/neg` 得到 0。`0x451B00` 的 `ecx` 是 `user+0x88`。同一子对象构造把 `+0x2F0` 写成 0，并把 `+0x33C` 置成 -1。`+0x2F0` 为 0 时 `0x451C70` 返回 0，`0x451B00` 走到 `0x451C68`，返回 -1。调用处 `0x95313C` 是 `cmp eax, -1; jg`，-1 不跳。`[user+0x2928]` 为 0 时也不跳。接受下跳的那条在 `0x953287` 把它写成 1，并把当前立足对象写入 `[user+0x292C]`。`0x95539D` 看到 1 就把它清回 0，把移动对象 `+0x160` 写成 1、`+0x164` 写成刚保存的立足对象，再 `call 0x53E95D`。脚下那扇门的 `pt` 是 12 或 13 才从 `0x953122`/`0x95312B` 返回。`0x96E48B` 的 `ecx` 是立足属性 `+0x30`。属性构造 `0xA4F3FB` 压入 0 再 `call 0x630025`。这 13 张没有 `forbidFallDown`，解开的整数是 0，`0x9531C0` 的 `je` 继续做下面的立足测试。三对明文要离开 0，走的是键比较之后的写入：`0x78ADCE` 在静态键 `0xBE12D0` 命中后，把 `0x4259A2` 的 16 位整数编进 `+0x2DC`；`0x78B9A9` 在 `0xBE12C0` 命中后调用 `0x78E98A`，编进 `+0x4BC`；`0x78C2AF` 在 `0xBE1270` 命中后调用 `0x78ED0E`，编进 `+0x630`。键没有命中时，这三对保持构造时的明文 0。

**陆地跳和水中跳不是同一条物理。** 客户端把 `swim` 收成 0 或 1 放在地图对象 `+0x150`。全映像没有把这块抄进移动对象，也没有把地图对象写进全局 `[0xBDF54C]`。`0x95A31E` 和 `0x69733B` 读的仍是全局 `+0x150`。两份 `+0x150` 没有关联指令。爬绳路径在 `0x9D7BF2` 把水平键交给 `0x9C4B78`，写进移动对象 `+0x150`。所以 `0x9BD0DE` 仍不能当成水中跳。陆地跳在 `+0x158` 被 `0x952F1F` 写成 1 之后，立足对象非 0 时由 `0x9BD20E` 把竖直速度写入 `+0x68`/`+0x78`。算式是 `-(decrypt([move+0x198]+0x48) * [[[0xBDD498]+8]+0x70]) / decrypt([move+0x190]+0x24)`。这 13 张上分子和分母都是 `1`，初速是 `-jumpSpeed`。`0x70DF65` 的判定是：`[move+0x190]` 为 0 就返回 0。指针非 0 时，`0x70DFC9` 解开该对象 `+0x30` 的整数，等于 1 就返回 1。进图时 `info.swim` 非 0 把这个整数写成 1，否则 `info.fly` 非 0 写成 2，都没有就保持 0。只有 1 通过，`fly` 的 2 不通过。没通过才测 `+0x3C` 的矩形。这 13 张没有 `swimArea`，列表是空的，包含返回 0。`swim` 为 1 的 8 张因此整图返回 1，其余 5 张返回 0。这 13 张的陆地跳分母 `decrypt([move+0x190]+0x24)` 是 1。没有立足对象时，`0x9BD455` 决定要不要写速度。虚表 `+8` 返回非 0，或 `0x70DF65` 返回非 0，或 `DEC(鞋子+0x78) > 0`，它就返回 1。这 13 张上虚表 `+8` 是 0，鞋子 `+0x78` 是 0，所以它的返回值就是 `0x70DF65`。返回 0 时 `0x9BD367` 直接返回 0，不写竖直速度。返回 1 时，`0x9BD378` 解开 `DEC([move+0x190]+0x18)`，`0xA70FBB` 清掉符号，这 13 张上得到 1。同一条上 `0x70DF65` 仍返回 1，于是 `DEC(鞋子+0x6C) · swimSpeed · 1 · 5.0` 取负，写入 `+0x68`/`+0x78`。鞋子 `+0x6C` 是 1，这 8 张的水中初速是 `-(swimSpeed · 5)`。`0x9BD40E` 的 `flySpeed` 要 `0x9BD455` 返回 1 且 `0x70DF65` 返回 0，这 13 张上不会同时成立。跳路径没有动作号写入。字段名仍没有。`info.swim` 没有抄进移动对象。

`0x4B6ABE` 解开 `move+0x124`。换段把 0 编进去，解出来是 0，上面的陆地式和水中式照常执行。抓绳 `0x9D80DF` 把绳子记录指针编进去，解出来非 0。水平键是 0 就返回 1，不改速度。水平键非 0 时，5 张陆地乘 `0.5`（`0xAFEC20`），8 张游泳图乘 `0.3`（`0xB05538`）。竖直初速是陆地式再乘这个系数。水平初速是 `DEC(鞋子+0x24) · walkSpeed · key · 1.3`（`0xB064B0`）。鞋子 `+0x24` 是 1。

**爬绳对绳子记录。** 单条绳子的 `l`、`uf`、`x`、`y1`、`y2`、`page` 已经按偏移读出，行在 `[group]map.Rope`。村的绳子是 `x=-3467`，`y1=-142`，`y2=-4`，`l=0`，`uf=1`。井的绳子是 `x=-51`，`y1=-499`，`y2=474`，`l=0`，`uf=0`。另外有绳的是 `230030100`、`230020200`、`230000001` 各 1 条，`230000002` 6 条，`230000003` 5 条。`230030200`、`230030000`、`230020300`、`230020100`、`230020000`、`230000000` 没有 `ladderRope`。查询是 `0xA4FC6F`：x 的两端各扩 10，再和记录 `+0xC` 比较；y 的两端和记录 `+0x10`、`+0x14` 比较。`0x9D7E9F` 先按符号加减 `0.5` 再转整数，x 同时作为两端，y 端点是这个整数和它减 20。这次要有立足对象、竖直键小于 0，并且还没挂在绳子上。抓绳 `0x9D7E9F` 用人物主坐标 `+0x20` / `+0x38`。已经挂上之后，`0x9D7D4F` 才读第二对槽：`+0x80`（校验 `+0x90`）和 `+0x98`（校验 `+0xA8`），和主坐标一起交给 `0xA4FC6F`。这对没有名字，也没有 `0x6131F4` 写入，不另定宽度。已经解开 `+0x124` 时，`0x9D80EC` 按竖直键把 y 加上 `3 * [+0x154]`。命中后 `0x9D80DF` 调用虚表 `0xB0CC78` 的 `+0x14`，函数是 `0x9BFB52`。它不比较记录 `+4`，也不读 `ladder` / `rope`。动作表里 `ladder`、`rope` 仍是 `0x24`、`0x25`。爬绳函数不写这两个下标。报文处理 `0x975E31` 调用 `0x97707B`。记录 `+4` 非 0 时 `0x97714A` 取 `0x33`（`ladder2`），记录存在且 `+4` 为 0 时取 `0x34`（`rope2`），`0x977179` 写入 `[user+0x3C4]`。`0x451B00` 大于 -1 时这次不写。产品画 `rope`。`uf` 和 `page` 保持原值。竖直键在 `0x9D7B95` 到 `0x9D7BD7` 读出。虚拟键 `0x26` 按下得到 -1，`0x28` 按下得到 1，`0x9C4B9C` 写入 `[move+0x154]`。`0x9D7C0F` 把这只移动对象交给 `0x9D80EC`。它先把 y 加上 `3 * [move+0x154]`，`0xB00D68` 是 3。键小于 0 且这次 y 小于记录 `+0x10` 时，记录 `+8` 非 0 就把 y 写成 `+0x10 - 5`，`0x9D8206` 再压三个 0，调用 `[move]` 的虚表 `+0x14`。记录 `+8` 为 0 时 y 写成 `+0x10`，函数返回，`+0x124` 不动。键大于 0 且这次 y 大于记录 `+0x14` 时，y 写成 `+0x14 + 1`，同样压三个 0 调用这个槽。爬绳对象的虚表是 `0x9D78C2` 写入的 `0xB0CC78`，`+0x14` 是 `0x9BFB52`。三个参数都是 0 时，`0x9BFBF2` 把 `[move+0x110]` 写成 0，`0x9BFBF8` 把明文 0 编进 `+0x124`。记录 `+8` 是 `uf`，`+0x10` 是 `y1`，`+0x14` 是 `y2`。村的 `uf` 是 1，上端和下端都会下来。井的 `uf` 是 0，上端停在 `y1`，下端才会下来。键是 0 时两端都不比较。

另一条清绳在 `0x9BCA6F`，端点不走它。`0x6B893B` 把一个字写入节点 `+0xC`：立足参数非 0 时取 `[立足+0x48]` 的低 16 位，否则绳子参数非 0 时取记录开头那个字的相反数，否则取 0。`0x6B8A18` 把节点 `+0xC` 抄到 `[ebp-4]`。字大于 0 时 `0x517DA8` 写立足对象。字小于 0 时取相反数交给 `0x9BCC9A`。这个函数在下标小于 1、`[ecx+0xA8]` 为空或下标不小于长度时返回 0，否则返回 `基址 + 下标 × 0x1C`。字大于等于 0，或这次返回 0，`0x9BCC34` 把明文 0 编进 `+0x124`。字等于 0 时立足对象也清掉。

**落地不在物理链上换姿势。** `0x9BC6E5` 把新的立足指针写入 `[move+0x110]` 之后调用 `0x9BC89F` 和 `0x9BC992`。owner 虚表 `0xB0BC40` 的 `+8` 是 `0x5C0324`，`ret 4`。有立足时 `0x93DDA9` 的比较成立，`0x93DDDF` 把 `0x7732E0` 的返回值写入 `[user+0x3C4]`。立足指针是 0 时这次不写。`0x7732E0` 在解开的 `[动作对象+0x160]` 不小于 0 时返回那个整数，否则按随机数取表项，表空则返回 -1。全映像把明文编进这个 `+0x160` 的指令只有 `0x76CAB6`。明文是 `0x4ACF31` 的返回值：从 `0xBDDB10` 起按名字比较，命中返回槽号，扫到 `0xBDE908` 还没有就返回 -1。`0x76E522` 在数组槽为空时调用 `0x76C83B`，那次才会执行 `0x76CAB6`。字符串号 850（`walk1`）和 871（`prone`）只在动作表登记时压栈。

**画面按动作字选槽。** `0x451DDC` 读 `[avatar+0x338]`，`0x451E6A` 把它算术右移 1。`+0x2F0` 和 `+0x304` 都为 0 时，`0x451F4C` 用 `(动作字 >> 1) - 1` 查 `0x452042`。右移结果 1 按 `[avatar+0x2C4]` 是否等于 1 返回槽 0 或 1；2 按 `[avatar+0x2C8]` 是否等于 1 返回槽 2 或 3；3 返回 `0x23`；4 返回 4；5 返回 `0x21`；6 返回 `0x22`；7 返回 `0x24`；8 返回 `0x25`；9 返回 `0x26`。右移结果 10 时读 `[avatar+0xE7C]`：0 得到槽 `0x27`，1 得到 `0x28`，2 得到 `0x29`，3 得到 `0x2A`，4 得到 `0x2B`，5 得到 `0x2C`。构造 `0x44FE90` 把 `+0x2C4`、`+0x2C8`、`+0x2F0`、`+0x304`、`+0xE7C` 写成 0，并把动作字写成 6 或 7：上下文 `[0xBD9028]+0x2FE4` 为 0 时是 6，非 0 时是 7。6 和 7 的右移结果都是 3，画面返回 `0x23`。`0x4516EE` 和 `0x4516E8` 在一个字节参数为 0 时把 `+0x2C4`、`+0x2C8` 写成 1，这时走槽和站槽分别是 0 和 2。头像在 `user+0x88`。子对象构造 `0x44FFDA` 先把虚表写成 `0xAFEEF8`，派生人物构造 `0x950099` 改成 `0xB0BCEC`。用户更新在 `0x95148B` 把 `edi` 清成 0，步进之后 `0x951530` 读 `[move+0x148]`，`0x951544` 调用 `0xB0BCEC+0xC`，也就是 `0x951436`。`0x935454` 再把这个字和 0 交给 `0x4520B7`。第二参数为 0 且和 `[avatar+0x338]` 不同时，`0x4520CD` 写入新动作字。按键函数 `0x9C4B78` 先把左右键写入 `[move+0x150]`、上下键写入 `[move+0x154]`，再把左右键、上下键、旧的 `[move+0x148]` 和移动对象交给 `[[move+0x14]+4]`，返回值写回 `[move+0x148]`。用户更新步进的是 `[user+0xF28]` 减 `0xC`。出生 `0x9D34FA` 把这只移动对象的虚表写成 `0xB0CB70`，`0x95094C` 把 `user+4` 交给 `0x9BC602`，所以 `[move+0x14]` 是 `user+4`。派生构造 `0x950087` 把这里写成虚表 `0xB0BD04`，`+4` 是 `0x956FCD`，`ret 0x10`。步进 `0xB0CB70+0x28` 是 `0x9D4024`。它用 `0x5CAAA9` 读 `VK 0x25`、`0x27`、`0x26`、`0x28`。左或上的返回值非 0 时 `neg/sbb` 得到 -1，右或下非 0 时 `neg/sbb/neg` 得到 +1，左右相加、上下相加。`0x416DE8` 解开 `[[用户虚表+8]+0x7D4]` 得到非 0 时，`0x9D428A` 把两个和都取相反数。上下文构造 `0xA0B01D` 以 `this+0x2110` 调用 `0x784B5E`，`0x784CE7` 再以同一对象调用 `0x78523B`。这条一直落到 `0x785E71`：`xor ecx, ecx` 之后 `call 0x416E36`，明文 0 编进 `+0x7D4`，`0x785E8C` 把校验写入 `+0x7DC`。`0x9D4270` 压的就是这份校验。解开是 0 时 `0x9D4285` 跳过取反。上下文 `[0xBD9028]+0x2FE4` 非 0 时两个和都写成 0。同一构造 `0xA0AFC2` 把 `ebx` 清成 0，`0xA0B18F` 把这个 0 写入 `+0x2FE4`，构造函数后段没有再写这个槽。这个值是 0 时 `0x9D42A5` 跳过清空。`0x9D42E6` 把水平、竖直这两个和交给 `0x9C4B78`。`0x956FCD` 的 `this` 是 `user+4`。`([user+0x3C0] & ~1) == 0x12` 并且第一次 `0x47376F` 解开的字非 0 时，旧动作字不是 4 或 5 就先把 `[move+0x1C4]` 写成 1，然后返回 `(旧动作字 & 1) | 4`。构造写入的 `+0x3C0` 是 6 或 7，与 `~1` 相与是 6，这条不进入。接着 `0x957118` 对 `[[0xBD9028]+0x2094]+0x61` 做 `0x47376F`。这个字是 0 就返回 `(旧动作字 & 1) | 0x12`，右移结果 9，槽是 `0x26`。`0xA0B008` 先把这个槽写成 0。`0xA1CF70` 把参数智能指针的 `+4` 抄进 `[this+4]`。`0xA11981` 的 `this` 是 `context+0x2090`，写的就是这个槽。`0x97EBF9` 在进图 `0x533FF1` 里调用它，指针来自 `0x533EBF` 的 `[参数+4]`。`0x77F257` 和 `0x77FCE5` 先 `0x7245A1` 分配、`0x4F50CA` 按入参流填写，再把这个槽写成该对象。字非 0 之后，`0x6A0ADF` 解开 `user+0x2944` 得到非 0 就返回 `(旧动作字 & 1) | 0x14`，右移结果 10，`[avatar+0xE7C]` 为 0 时槽是 `0x27`。构造 `0x965A09` 把这对明文写成 0。接收操作码 `0xCF` 在 `0x957201` 进入 `0x9658CC`。流里的字节为 0 时 `0x965902` 写成明文 0。字节非 0 时 `0x965993` 调用 `[0xBE1734]`，返回非 0 则 `0x9659A0` 写成明文 1，返回 0 则 `0x9659E2` 写成明文 0。本地 `0x95516A` 不写这一对。明文为 0 时调用 `0x93D1BA`。立足 `[move+0x110]` 非 0 且水平为 0：竖直大于 0 返回 `(旧 & 1) | 0xA`；竖直不大于 0 时，`[user+0x3BC] <= 0` 返回 `(旧 & 1) | 4`，大于 0 返回 `(旧 & 1) | 8`。`0x935526`、`0x977CDC`、`0x990E48` 把这个双字写成立即数 `0x1388`，基址同时有 `+0x88`。同一立即数还出现在 `0x95D870`、`0x9653EA`、`0x96BA59`、`0x97A1AD`、`0x98E48E`、`0x98E51C`。`0x7857B8` 和 `0x78E709` 写的是带 `+0x3B4` 密文对的另一只对象。全映像没有对 `+0x3BC` 做加、减或移位。`0x402D66` 对大于 `0x40` 的块在返回前不清字节，人物构造的 `0xA70120` 覆盖的是 `+0x28C0` 一带。立足非 0 且水平非 0：返回 `2 | (水平 < 0 ? 1 : 0)`。立足为 0：`0x70EB9E` 非 0 返回 `(旧 & 1) | 0xE`；否则 `0x70EBD8` 非 0 返回 `(旧 & 1) | 0x10`。这两个函数都解开 `[move+0x124]`，记录 `+4` 非 0 走前者，为 0 走后者。都不是时，水平小于 0 面向位是 1，大于 0 是 0，等于 0 沿用旧动作字的 bit 0。`0x70DF65` 非 0，或移动虚表 `+8` 非 0，底数是 6，否则底数是 3，返回 `(底数 << 1) | 面向位`。用户这只的 `+8` 是 `0x9D3548`：`[move+0x190]` 为 0 返回 0，否则 `0x429944([move+0x190]+0x30) == 2` 返回 1。底数 3 是动作字 6 或 7，槽 `0x23`；底数 6 是 12 或 13，槽 `0x22`。`0x70DF65` 在 8 张游泳图返回 1、5 张陆地图返回 0，所以上面的游泳图在离开立足后底数是 6。另一只由 `0x9C2911` 创建的移动对象走 `0x5BFEE5`，`[move+0x14]` 的虚表在 `0x94B9AB` 写成 `0xB0BC40`，`+4` 是 `0x5C02A9`，只返回 `6 | 面向位`。用户更新不步进那一只。

**攻击是一次动作。** 动作号 `0x34` 进入 `0x954F0F`，先调用 `0x9573A6`，再调用 `0x95C5B2`。`0x99772D` 按 `0x27`/`0x28` 选 `Attack`/`Attack2`，只用来播 `Sound/Weapon.img/%s/%s`，调用点是 `0x938547` 和 `0x43FCA7`，不在这条入口里。动作表在 `0xBDDB10`，一项 `0x18` 字节，登记函数 `0x4A7F89` 按调用顺序写入 149 项。名字是登记时压给 `0x7A48D0` 的字符串号，经 `0x7A4A5E` 从 `0xBA7B04` 取项、用 `0xB07640` 的 16 字节密钥解开。槽 0 是 `walk1`，1 是 `walk2`，2 是 `stand1`，3 是 `stand2`，`0x21` 是 `prone`，`0x22` 是 `fly`，`0x23` 是 `jump`，`0x24` 是 `ladder`，`0x25` 是 `rope`，`0x33` 是 `ladder2`，`0x34` 是 `rope2`。槽 5 是字符串 853，解开是 `swingO1`。槽 `0x10` 是 864，解开是 `stabO1`。`0x95C5B2` 把选中的下标留在 `[ebp-0xC68]`。下标不小于 0 时 `0x95D719` 把它交给 `0x935510`。`[ebp-0xD58]` 非 0 时下标是 `0x4E`，登记字符串 3548，解开是 `showdown`。`[ebp-0xD54]` 非 0 时是 `0x57`，字符串 945，解开是 `eorb`。`[ebp-0xD20]` 非 0 时是 `0x61`，字符串 955，解开是 `backstep`。`0x957C05` 把 `[user+0x354]` 抄进局部。`0x9573BD` 把 `ecx` 放进 `[ebp-0x170C]`。`0x95282B` 传入的是带 `+0x3C0` 的人物，七个栈参数里 `[ebp+8]`、`[ebp+0x14]`、`[ebp+0x20]` 都是 0。`[ebp+8]` 为 0 时 `0x9574B1` 把 `[ebp-0xBDC]` 写成 0。`[ebp+0x14]` 等于 `0x406849` 时下标是 `0x41`（`assassinationS`）。`[ebp-0xBDC]` 是 `0x111AF0` 或 `0xA98A5C` 时，`0x460061` 的结果是 `0x1E` 或 `0x1F` 则下标 `0x44`（`brandish1`），是 `0x28` 或 `0x29` 则下标 `0x45`（`brandish2`）。`[ebp-0xBDC]` 是 `0x12A193` 时下标 `0x46`（`sanctuary`），是 `0x12A191` 时下标 `0x4C`（`holyshield`）。`([user+0x3C0] & ~1) >> 1` 等于 5，并且 `[ebp+0x20]`、`[ebp+8]` 都是 0、原始 `+0x354` 非 0 时，下标是 `0x20`（`proneStab`）。构造写入的 `+0x3C0` 是 6 或 7，右移结果是 3，这条比较不成立。都不成立，并且 `[ebp-0xBDC]` 为 0、用户虚表 `+0x40` 的 `0x96D05F` 返回值除以 `0x3E8` 等于 2、`0x460061` 的结果等于 `0x2C` 时，下标是 `[ebp-0xC38] % 3 + 0x7F`，三个名字是 `swingT2PoleArm`、`swingP1PoleArm`、`swingP2PoleArm`。这条不成立时 `0x957ED1` 调用 `0x77325B`。参数从右往左是 `0x416E71` 的返回值、`[ebp+0xC]`、`[ebp+8]`、`0x460061` 的结果、原始 `+0x354`。第三参数为 0 时行号是 `2 * (值 - 1)`，表在 `0xBA5808`，一行 `0x18` 字节。值不在 1 到 9，或该行计数不大于 0，返回 -1。值落在里面时，槽是该行第 `计数 % 行计数` 项。第三参数为 0 的九行是：1 为 `swingO1`、`swingO2`、`swingO3`、`stabO1`、`stabO2`；2 为 `swingT2`、`swingP1`、`swingP2`、`stabT1`、`stabT2`；3 为 `swingT1`、`swingT3`；4 为 `swingT1`、`stabT1`；5 为 `swingT1`、`swingT2`、`swingT3`、`stabO1`、`stabO2`；6 为 `swingO2`；7 为 `stabO1`、`stabO2`；8 为 `stabO1`、`stabO2`；9 为 `swingT1`、`swingT2`、`swingT2`。下标小于 0 时 `0x957F55` 返回 0。`0x952836` 接着调用 `0x95C5B2`，第一参数是 `[ebp-0x24]`。这个槽先被写成 0，`0x76EACD` 可以改写它。它为 0 时 `0x95C72E`、`0x95C75E`、`0x95C78E` 把三个标志写成 0。它指向的对象首双字是 `0x3EE1AB` 或 `0x40684B` 时下标 `0x4E`（`showdown`）；是 `0x4E23EA` 时下标 `0x57`（`eorb`）；是 `0x4F5C6E` 时下标 `0x61`（`backstep`）。否则 `0x95CB94` 调用 `0x773491`，表在 `0xBA59B8`，一行 `0x10` 字节。第三参数为 0 时：值 3 的槽是 `0x16`（`shoot1`），值 4 是 `0x17`（`shoot2`），值 7 是 `0x18`、`0x19`、`0x1A`（`swingO1`、`swingO2`、`swingO3`），值 9 是 `0x62`（`shot`）。值 1、2、5、6、8 的计数是 0，返回 -1。两处调用都没有 `0x416DE8`。`0x416E36`（间隙函数）将随机数及校验键写成相邻双字对，`+0x354` 和 `+0x358` 分别对应其值槽和键槽；`0x416E71` 为随机值源。详见第 16.3 节。全映像没有 `mov [reg+0x354]`。`0x78572B` 在 `context+0x2110` 的构造 `0x78523B` 里编明文 0。`0x788E44`、`0x78E624`、`0x78FC1B` 也是 `lea` 之后调用 `0x416E36`。人物构造的 `0xA70120` 覆盖 `+0x28C0` 到 `+0x292F`，不覆盖 `+0x354`。用于选表的武器类参数不在 1 到 9 时两张表都返回 -1，`0x95D725` 不执行。上下文 `+0x207C` 非 0 时 `0x957499` 在选择器之前返回 0。这个双字在映像里是 0，构造函数不写它；唯一的 `mov` 写入是 `0x62C834`，值来自参数 `[ebp+0x38]`。矩形不走用户虚表 `0xB0BD28` 的 `+0x10`：那个槽是 `0x9503E8`，把 `eax` 清成 0 后返回。`0x95CFD6` 用的是 `[user+4]`。构造 `0x950087` 把这里写成虚表 `0xB0BD04`，`+0x10` 是 `0x4B6E2F`，返回 `ecx + 0xEE4`。调用时 `ecx` 是 `user+4`，所以指针是 `user+0xEE8`。横坐标是 `[user+0xEE8]`，纵坐标是 `[user+0xEEC] - 0x1C`。`0x955375` 和 `0x95538D` 把 `[user+0x28F8]`、`[user+0x28FC]` 抄进这两个槽。构造 `0x4B6DCB` 把那两个源写成 0。`0x95D4A2` 调用的 `0xA4F93C` 在两点重合时返回 1，否则交给 `0x5114AA` 排成矩形。两个函数都没有固定半宽。下标一旦不小于 0，`0x959026` 和 `0x95D725` 调用 `0x935510`，`0x9355FC` 把下标写入 `[user+0x3C4]`。`0x453A5A` 经 `0x451DD4` 取回这个数，`0x4544E1` 用它做 `下标 × 3 × 8 + 0xBDDB10`。用于选表的武器类无效或表项数为 0 时两个选择器返回 -1，不进 `0x935510`；`+0x354` 实际由间隙函数写入加密对。`+0xEE8` 的另外三处写入是 `0x934D4C`、`0x95557D`、`0x9658A5`。`0x96585C` 由命令 `0xD1` 进入，从查到的记录 `+0xC`、`+0x10` 写入这两个槽，再调用 `0x963C7D`。`0x96423F` 把 `ebx` 写入 `[user+0x28F8]`，把纵坐标参数减 1 写入 `[user+0x28FC]`。这几处都不是把移动对象 `+0x20` / `+0x38` 转成整数。这一下的槽就是上面两张表里的那一项。用于选表的武器类不在 1 到 9 时两个选择器都返回 -1，`+0x354` 不是武器类。矩形仍是 `[user+0xEE8]` 和 `[user+0xEEC] - 0x1C`。这两个整数相对主坐标的每帧写入见第 16 节。不做技能列表，不算伤害。

`VerticalJump` 是传送门 `pt` 12 调用的 `0x9549DF` 的效果名。`pt` 13 在全局地图态返回 19、20 或 21 且仍有立足对象时，调用 `0x53E95D(move, 19)`，再调用 `0x7ACCFF(move, −门x, 门y)`。人物下跳函数不读 `VerticalJump`。哨兵 `tm` 上，`pt` 7、8、11 发报文并写 `[user+0x2088] = 1`、`[user+0x208C]` 为时间戳。`pt` 9 没有专属写入。第 1.4 节的门是 `pt` 1、2 或 3，走换图。其余 `pt` 的产品行为在第 7.2 节。

**换图之后的坐标。** 同图分支 `0x954C3F` 调用 `0x963C7D`，把整数放进 `[user+0x28F8]` 和 `[user+0x28FC]`。纵坐标在 `0x9640AB` 由 `lea edi, [eax-1]` 得到。跨图分支 `0x954C98` 只调用 `0x53FF69`。这条报文的操作码是 `0x21`，压栈点是 `0x540091`。接收端 `0x5414A1` 在操作码为 `0x81` 到 `0x83` 时调用 `0x77E6F3`；`0x81` 进入 `0x77E72F`，`0x77EA2D` 调用 `0x5324D1`，`0x77EA3E` 把新场地交给 `0x77FB14`。新人物的位置在 `0x9507F0`：索引落在数组内时 x 取记录 `+0xC`、y 取记录 `+0x10`，`0x950964` 把 y 加上 `-0xA`，再调用移动虚表 `+4`。`0x9BC683` 把 x 编进 `move+0x20`，`0x9BC696` 把 y 编进 `move+0x38`。索引不小于 6 时改从 `0xA70BAD` 选出的记录取同一对字段。`0x95533D` 在 `[user+0x28F0]` 已置位、并且 `[user+0x2900]` 不晚于 `0x994C7A()` 时，用缓存整数调用移动对象 `+0xC` 那张虚表的 `+0x40`。本地表 `0xB0C5B0+0x40` 是 `0x9C1113`。`0x9C1166` 把第一个整数编进 `move+0x20`，`0x9C1192` 把第二个编进 `move+0x38`。返回后 `0x955387` 把 `0x994C7A()` 加上立即数 `0x258` 写入 `[user+0x2904]`。

### 6.7 一次 `step` 的契约

`step(state, input, dt)` 是纯函数。验收传入的 `dt` 是 25。函数不读时钟，不读 Controls，不读 Viewport，也不改 MapScenePlan 里的 Tile、Obj、门和背景放置坐标。速度数值的已恢复结构在第 6.5 节。验收注入的 25 不是这条虚表返回的 `0x1E`。这一节只定输入、同一步里哪一件发生，以及返回给画面钟的是什么。

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
| 7 | `edges.north`，人已经是 `sit` | 起来。本地清下标的写入见第 16 节。这一步不接着走 |
| 8 | `edges.north`，两段速度都为 0，当前有立足对象，座位的点落在人物 `x±10`、`y±30` | `locomotion` 写成 `sit`，记下 `seatId` |
| 9 | 人已经是 `sit`，且 `held.left` 或 `held.right` | 起来。本地清下标的写入见第 16 节。这一步不接着走 |

`edges.east` 不参加这张表。同一步里可以既走路或跳跃，又带上至多一条攻击。攻击不写进 `locomotion`。动作名和矩形见第 16 节。

表里的「已经是」看这一步开始时的 `locomotion`。这一步刚写成 `sit` 的，后面的方向 State 不再把它立刻拉起来。

互斥动作定完之后，方向 State 再作用到结果上：

- 地面、未蹲下、未坐下、未挂绳：水平位移按第 6.5 节。按住左右写 `walk`，都没按住写 `stand`。参数按该节的 `key = 0` 分支收，不把 `vx` 写成 0。
- 已经是 `prone`：按住 `down` 时保持原地，水平速度保持 0。不再按住则写成 `stand`。
- 已经是 `sit`：保持原地，直到第 7 或第 9 行起来。
- 空中且 `swim` 为 0：按第 6.5 节保留或改写 `vx`，并加快 `gravityAcc`。落地后按第 6.5 节写成 `walk` 或 `stand`。
- `swim` 为 1：四个方向按第 6.5 节改变游速。这里的下是游速，不是 `prone`。
- `ropeId` 仍在：`held.left` 和 `held.right` 不改 `x`，也不改 `facing`。`held.up` 或 `held.down` 的竖直位移仍用第 6.6 节的 `0x9D80EC`，不把 `3 * [+0x154]` 换算成每秒多少像素。离开绳子的条件也在第 6.6 节。已挂绳时的查询才读 `+0x80` / `+0x98`，不另定宽度。空中抓绳不用这一对。

返回值三块：

| 字段 | 内容 |
|---|---|
| `state` | 第 6.1 节的场地状态。允许改的是人物 `x`、`y`、`vx`、`vy`、`facing`、`locomotion`、`grounded`、`footholdId`、`ropeId`、`seatId`、`forcedDx`、`forcedDy`，以及 `portalScriptArmed`。镜头和 `scroll` 由子系统在返回后写入。`mapId` 要等传送的 `replace` 成功才改 |
| `action` | 没有攻击时为空。有攻击时只有一个位子。动作名和矩形见第 16 节 |
| `portal` | 没有换图时为空。有换图时带目标 `(tm, tn)`。函数不调用 `replace` |
| `effect` | 没有 `pt` 12 时为空。有时带第 7.2 节的水平偏移和竖直 `-2300`。不改人物坐标 |

画面钟只接收投影结果：`locomotion` 和 `facing` 写成 `cms-actor` 的 attrs，`x` / `y` 写成世界坐标。攻击位子由子系统交给已有的 `action` 事件。组件按这些换帧，不把坐标写回场地状态。换图之后怎样避免立刻走回上一张门，见第 16 节。不另定 500 毫秒。

松开下键、落地换姿、起来清座位，客户端都还没有对应写入。见第 16 节。`step` 不另造这三处状态变化。

### 7.1 解析规则

Portal 的 `pn` 是当前出口名，`pt` 是类型，`x/y` 是位置，`tm` 是目标地图，`tn` 是目标地图中的 Portal 名。地图运行库必须通过 `(tm, tn)` 找到目标地图 Plan 和目标 Portal；不能把当前 Portal 的坐标直接当作目标出生点。

MVP 启用第 1.4 节的门。`tm` 不在这 13 张里，或 `tm` 是 `999999999`，不换图。

井口 `st00` 的 `tm` 是 `999999999`，不换图。童话村 `tower00`、`east00` 和走廊上指向 13 张以外的门留在 MapScenePlan 中，不触发切换。

### 7.2 触发区域

换图用上键那条测试，不是走进门就跳。调用前 `0x954B58` 要求移动对象 `+0x110` 非 0，也就是当前有立足对象。`0x71B44D` 的框是门的 `x±20`、`y±50`，并且跳过 `pt == 0`。`pt` 2 不被这条跳过。`hRange` / `vRange` 属于另一条函数 `0x71B4FD`：缺字段时压入 100，命中用一半，所以半幅是 50。下跳只用它来排除 `pt` 12 和 13。不把 100 写进 FSDB 行。动画查找的固定框 `x±100`、`y±50` 也不拿来换图。

Portal 检测属于 Field Runtime；`cms-portal` 只负责画面。上键边沿触发一次。进入目标图之后怎样避免立刻走回上一张门，见第 16 节 R10。不另定 500 毫秒。

命中框相同，再按 `pt` 分支。第 1.4 节的门是 1、2 或 3，走换图。

- `pt` 7、8、11：不发报文。本地把 `portalScriptArmed` 写成真，并记下这一步的模拟时间。不换图。
- `pt` 9：没有专属写入。不换图，也不抓绳。
- `pt` 12：不换图，不改人物坐标，不改 `locomotion`。已记录的效果是：水平偏移按朝向取 200，再按左右键加减 100，竖直加载常量 `-2300`。哪一个键对应加、哪一个对应减，记录没有写成指令。产品约定：朝右基值 `+200`，朝左基值 `−200`；按住与朝向相同的方向再加 100，按住相反方向再减 100。这是门的效果，不是人物下跳。
- `pt` 13：不换图。仍有立足对象时，把 `forcedDx` 写成 `−门.x`，`forcedDy` 写成门的 `y`。累加时若超过这两笔入参，就写成入参本身；方向与 `0.0` 比较。没有另一颗限值。同一步再加进 `vx`、`vy` 后清零。不直接改坐标。客户端还要求地图态返回 19、20 或 21。那张虚表不在可用结果里。产品在有立足对象时就记这笔位移，并标明少了这道门。

这 13 张上的第 1.4 节的门不会走到这几档。夹具里出现 `pt` 7、8、9、11、12、13 时按上面的分支处理。

### 7.3 原子切换

`replace()` 替换整棵 RenderDomain 状态。`update()` 只能改已有节点的 attrs/data，不能改 children。地图切换必须调用 `domain.replace(nextRenderDomainState)`。

可以保证的一致性是：Field State 与本地 RenderDomain 状态一起提交。RenderManager 先提交本地权威状态，再异步发布 Render Snapshot。协议没有 Renderer ACK，也不保证 Web Component 已经完成图像解码。视觉失败后自动恢复旧地图不在当前协议里。

切换步骤：

1. 锁定当前 transition，忽略重复触发。
2. 从 Content 读取并校验目标 MapScenePlan；确认目标 Portal `tn` 存在，资源引用和诊断状态通过。
3. 在本地准备目标 Foothold 索引、effectiveBounds 和完整 RenderNode 树。准备失败时保留旧地图和旧玩家状态，不调用 replace。
4. 计算目标落点。同图路径把目标门的 `x`、`y-10`、空输出、上界 `0x7FFFFFFF` 和半宽 1 传给 `0xA4F6F1`。那个函数返回立足对象，不写人物坐标。跨图函数 `0x53FF69` 发报文，不写本地地图 id。人物坐标写在哪、有没有吸附，见第 16 节。不把目标门的 `x/y` 当成已经对齐的落点。
5. 同步调用 `domain.replace(nextTree)`。调用失败则不提交 Field Runtime 的新状态。
6. replace 成功后，再提交 `mapId`、MapScenePlan、Foothold 索引、玩家坐标/速度/立足线和 Camera 状态。`cms-avatar-layer` 与 `cms-actor` 的 key 保持不变，场景专属节点使用新的 `sceneEpoch`。
7. 清除 transition lock；设置短暂重触发保护。

Render 传输和组件资源加载沿用各自现有生命周期。这次切换是本地权威状态的原子提交。协议不提供 Renderer ACK，也不保证图片已经解码。首版不发送 `CHANGE_MAP` 网络封包。切换属于这次的完成定义。

## 8. 分阶段交付

| 阶段 | 交付 | 暂不包含 | 完成门槛 |
|---|---|---|---|
| P0：数据契约与闭包 | MapScenePlanV1、第 1.3 节 13 张的显式 allowlist、资源引用校验、Bundle 确定性 | 浏览器绘制 | 这 13 张所有必需引用闭合；重复构建字节一致；缺资源、缺 Tile `z`、未支持背景 type 均 fail closed |
| P1：静态 Scene Rendering | 场景组件的静态呈现；type 0 背景；type 4–7 按初始偏移绘制；有游戏 Portal 帧才画出口 | 物理、滚动推进、换帧推进、Portal 触发 | 产品锚定和产品绘制顺序正确；节点数量不随 Tile/Obj 数增长。此门槛是产品呈现，不是客户端像素一致 |
| P2：World Coordinates & Camera | 产品 Camera、effectiveBounds 夹取、第 4.2 节的跟随、Viewport resize | 客户端跟随函数 | resize 不改变玩家世界坐标；夹取使用 Plan 里的有效边界，组件不第二次内缩；未夹取时身体原点在视口中心；地图小于视口时整张图居中 |
| P3：移动 | 第 6.5 节的行走，以及三种跳、蹲下、游泳、坐下、攻击、爬绳和离开绳子，还有第 1.4 节的换图 | 技能列表；把 Physics 数值标成已证明的 px/s；用 `walkSpeed * dt` 给行走造位移；用代数值填 decrypt | 相同状态、输入和 `dt` 得到相同结果。行走用第 6.5 节。初速不用 `-555`、`-277.5`、`-700` 或 `3.125`。decrypt 槽不代成 `1` |
| P4：Portal Transition | 上键进入第 1.4 节的门后换图 | `decHP`、`tm` 不在这 13 张里的出口；走进门就跳；全像素事务；报文 | 返回的 `(tm, tn)` 与第 1.4 节一致。落点见第 16 节 R10。`replace` 失败保留旧地图 |

阶段 P0/P1 可以先独立验收。P2 不得用改变 Actor 屏幕中心的方式伪造世界移动。P3 和 P4 属于这次完成定义。行走按第 6.5 节实现。初速、周期、跟随和其余第 16 节的写入不代成常数。

## 9. 测试与验收策略

### 9.1 数据与构建测试

- 严格 JSON / JSONL 解析；空行、坏行、重复 id、错误类型、缺字段均有明确策略。
- MapScenePlan 的字段、引用、Bounds、图层号、Portal 目标和 Foothold `prev/next` 做结构校验。
- 每个 PNG 的 namespace/key/MIME/contentVersion/解码尺寸与引用矩形一致。
- 只包含第 1.3 节的 13 张及其传递引用；没有整个 CMS FSDB、WZ、客户端文件或研究目录。
- Bundle 在相同输入下字节级确定；资源缺失、重复 identity、版本冲突和越界引用均 fail closed。
- 逐个 RenderNode 测量 compact UTF-8 data 大小，并单独测量 MapScenePlan、资源闭包总字节、解码并发、峰值内存、Canvas 尺寸和资源工作集。这些是应用层测量。LoomRealm Render Update v1 没有通用 data 字节上限，不得把测量结果写成协议上限。`cms-map-layer` 使用视口尺寸 Canvas。射手村 `miniMap.width` 为 7174，这个宽度只说明不能用整幅世界 Canvas。射手村不在这次验证地图里。

### 9.2 Field Runtime 单元测试

P0/P1 覆盖 Plan 校验、产品 Bounds、诊断键和静态投影。运动和换图使用注入的 `dt`。地面一步按第 6.5 节测：给定同一组 `DEC` 槽、同一立足和同一个 `dt`，`P`、两槽和留在本段时的 `x/y` 与该节一致。这 13 张上的 `DEC` 值还没有，不把槽代成 `1` 之后的像素写成验收数。初速、换姿、下绳、攻击矩形和换图落点也先不写成验收数。已经反汇编、可以测的还有：

- 相同状态、相同输入和相同 `dt` 产生相同状态。
- `edges.south` 且 `held.down` 只走下跳那条门闩；门闩失败时不改走另外两种跳。
- 按住 `down` 再按 `south` 才进入下跳函数。单独的 `down` 是蹲下。松开之后的姿势见第 16 节。
- 下跳要求当前有立足对象，脚下门的 `pt` 不是 12 或 13，并且 `x±1`、`y+300` 到 `y+600` 的立足段 y 不在人物 y 的上下 5 像素里。
- `north` 只在座位的点落在人物 `x±10`、`y±30`、两段速度为 0、当前有立足时进入坐下搜索。
- 上键边沿还要求当前有立足对象。人在门的 `x±20`、`y±50` 内，只返回传送意图，不抓绳。
- 抓绳用 `0xA4FC6F` 的 x 各 10、y 与 y-20。`ropeId` 仍在时左右不改 `x`。竖直位移用 `0x9D80EC`。上键越过 `y1` 且 `uf` 非 0，或下键越过 `y2`，清掉 `ropeId`。`uf` 为 0 的上端停在 `y1`。
- 水平平台、斜坡、端点连接、prev/next、向下穿越和无效几何。竖线和身体宽度见第 16 节。
- 第 1.4 节的门往返只测「返回了哪个 `(tm, tn)`」。落点坐标见第 16 节。`st00` 的哨兵 `tm` 和指向 13 张以外的门不换图。坐下用中央广场、商店街和动物园的源座位。

### 9.3 Browser / PWA E2E

- 通过正式 `bootstrapWebPresentation()` 和真实 Content API 加载地图组件与 PNG。
- 使用可信键盘输入驱动 Controls；不使用合成 `KeyboardEvent` 伪造设备输入。
- 行走、三种跳、蹲下、游泳、坐下、攻击、爬绳和第 1.4 节的门，状态判定用同一个 `step`。行走位移按第 6.5 节。三种跳的初速见第 16 节。抓绳用 `0xA4FC6F` 和 `0x9D80EC`。`cms-actor` 的换帧是画面钟，不作为世界坐标移动的验收。
- 对照固定像素样本时，标明样本验收的是产品锚定和产品顺序。滚动距离按第 4.5 节验收偏移，不验收客户端像素。
- Frame cancel/failure 时释放 Controls Consumer、Viewport 订阅、RenderDomain 和组件资源。
- 运行现有 `npm test`、PWA Bundle、PWA staging 和浏览器 E2E 回归。

## 10. 风险与待评审决策

| 项目 | 当前事实/风险 | 设计处理 |
|---|---|---|
| 自研 Map FSDB 章节 | 第 4 章已写。第 1.3 节的 13 张、绳子、座位和 `physics.default` 已入库。`read-adventure-fsdb.mjs` 的白名单仍只有纸娃娃 | 发布这 13 张之前，把地图表和物理表加进该白名单 |
| 位置钟 | 固定 pin 没有 Tick | 客户端入参是立即数 `0x1E`，见第 16 节 R14。不写成 25 毫秒，也不写成一次最多 4 步 |
| 演示移动 | `LOCOMOTION_BY_DIRECTION` 把下键映射成 `stand`，视口订阅改写 `x/y` | 迁入 `libs/adventure-field`。Controls 消费器留下。视口中心不再是人物世界坐标 |
| 出生点 | 六条 `sp` 都不是换图门。客户端没有选出其中一条 | 产品出生点是 `(-92, 294)`。换图不使用它 |
| Camera 坐标约定 | 跟随、dead zone、地图小于视口不在本映像 | 1:1、视口左上角和 world-to-screen 已在第 4.1 节冻结。跟随按第 4.2 节：身体原点放到视口中心后再夹取。地图小于视口时整张图居中。没有 dead zone |
| Physics 参数单位 | 19 个数已在 adventure。四个 decrypt 槽没有字段名，装载者不在映像。`info.swim` 没有抄进移动对象。地面一步和下落梯形的客户端形状在第 6.5 节 | 求值用第 6.5 节的式子。不把 `walkForce` 或 `gravityAcc` 标成 px/s。地面摩擦乘 `walkDrag`。`0x70DF65` 非 0 时地面 `step₀` 和速度上限乘 `swimSpeedDec` |
| 座位 | 走廊上只有中央广场 3 个、商店街 6 个、动物园 3 个。坐标在第 16.1 节 | 这三张城镇进 Bundle。不在没座位的图上造座位 |
| 爬绳命中 | 命中框在 `0xA4FC6F`。`l` 没有写到人物上。空中抓绳用主坐标。已挂绳才读 `+0x80` / `+0x98`，没有写入。端点清绳是 `0x9BFB52(0, 0, 0)`：上键越过 `y1` 且 `uf` 非 0，或下键越过 `y2` | 验收命中框、`0x9D80EC` 的竖直位移和这两端。姿势画 `rope` |
| Foothold 特殊标志 | 这 13 张每条立足的 `drag`、`force`、`forbidFallDown` 都缺省。属性因此是 `+0xC = 1`、`+0x18 = 1`、`+0x24 = 0`、`+0x30 = 0`，地面一步走特殊立足。`field+0x13C` 是 `mpRecovery`，这 13 张读出 0 | 求值用第 6.5 节。bit 17 在这 13 张上是 0。不把 `fieldLimit` 或 `forbidFallDown` 当成这个门闩 |
| Portal 触发范围 | 上键换图用固定框 `x±20`、`y±50`。`hRange` 那条测试是另一函数，缺字段时半幅 50 | 换图不走 `hRange`。不把 100 写回源行 |
| Portal 视觉资源 | `map.helper` 的 `pv`/`ph`/`psh` 已在 adventure。`pt` 1 和 3 不加载 `pv`。`pt` 2 加载 `pv` | 没有对应游戏帧就不创建 `cms-portal`。换图不依赖出口画面 |
| `zM` 人物遮挡 | 比较器体尚未定位（22 张候选虚表第 45 槽全分类无比较语义）。Obj 加载键不读 `zM`，且 Obj 走栈封装 cdecl 通道而非虚表 `+0xB4` | 人物按第 4.3 节用 Obj 的 `y` 分前后。`zM` 仍只进 Tile 键和诊断 |
| Map Link | `info/link` 会让地图绘制内容引用另一张地图 | Map Adapter 构建期解析并校验链接，不能递归无界读取 |
| Bundle 体积 | Tile/Obj/Back 引用会带来大量 PNG | P0 先测量实际闭包字节数，再确定缓存/体积预算 |

2026-11-09 修订已经明确：

1. 地图数据进 adventure 第 4 章。运行时逻辑契约仍是 MapScenePlanV1。
2. Portal 没有游戏帧时不创建视觉节点，不用编辑器图标或无贴图标记充当通过验收的画面。`pt` 3 属于这一类，逻辑切换仍然成立。
3. Camera `x/y` 采用世界视口左上角，这是产品约定。`scenePlan.bounds` 使用 `effectiveBounds`。
4. 时间分成位置钟和画面钟。调用方毫秒见第 16 节 R14。画面钟只留在 `cms-actor`。地图组件不自建时钟。
5. 运动按第 6.5 节已经反汇编的式子。地面一步是 `0x9BD757`，不用 `walkSpeed * dt`。空中、三种起跳和游泳的数值见第 16 节。竖线和半宽见第 16 节 R12。`forbidFallDown` 与 bit 17 分开。这 13 张的 `fieldLimit` 是 0 或 4，不是 bit 17。不把 `walkForce` 写成 px/s。
6. 上键在有立足对象且人在 `x±20`、`y±50` 时，按第 1.4 节换图。落点见第 16 节。North 在三张城镇对座位做点测试。East 发一次攻击，动作名见第 16 节。按键用第 6.3 节。挂绳时左右不改 `x`。离开绳子见第 6.6 节。出生点是 `(-92, 294)`。

## 11. 建议的后续 Issue 拆分

评审通过后再创建实现 Issue，建议按依赖拆成：

1. **P0 — 内容进入进程**：把 adventure 的地图表和 `physics.default` 加进 `read-adventure-fsdb.mjs`，投影 MapScenePlan，扩展 Bundle Builder 和 `presentation.json`。
2. **P1 — 场景组件**：`cms-scene-view`、`cms-back`、`cms-map-layer`、`cms-avatar-layer`、`cms-portal` 的浏览器实现。`cms-actor` 的校验器接上 `prone`、`swim`、`sit`、`climb`。
3. **P2 — 产品 Camera 与 Viewport**：世界坐标、effectiveBounds 夹取、第 4.2 节的跟随、resize。视口变化不改人物世界坐标。
4. **P3 — 迁走演示移动并实现 `step`**：立足线和行走按第 6.5 节实现，decrypt 槽不代成常数。陆地跳、水中跳、下跳、蹲下、游泳、坐下、攻击和爬绳仍不把第 16 节缺的数值填上。爬绳接上 `0xA4FC6F` 和 `0x9D80EC`。
5. **P4 — 门的切换和其余 `pt`**：上键、当前有立足对象、人在传送框内之后，第 1.4 节的门换图。`pt` 2 同样换图。`pt` 7、8、9、11、12、13 按第 7.2 节做本地效果，不发报文。哨兵 `tm` 和指向 13 张以外的门不换图。命中路径不写人物 `+0x20` / `+0x38`。进入目标图之后的坐标见第 16 节，不用出生点 `(-92, 294)` 代替。坐下在中央广场、商店街和动物园。

每个 Issue 只实现一个可独立验收的垂直切片；不得在同一任务里顺带升级 LoomRealm pin、重跑 WZ 转换或引入全量地图资源。`prone`、`swim`、`sit`、`climb` 已写入 ABI。实现时改校验器，不另起一套人物 ABI。

## 12. 整条子系统进程尚未接入的内容

交付物是 `base` 调起 `adventure-map` 的整条进程。地图组件只负责画面。物理、移动和换图都在这条进程里完成。

### 12.1 现在跑到哪里

进程目前是：`base` 持有 Controls，调起 `adventure-map`；子系统读 `struct.AdventureAvatarPlan/bootstrap`；RenderDomain 只有一个 `cms-actor`；人物画在视口中心；方向键只改 `locomotion` 和 `facing`。取消或失败时会释放 Controls、视口订阅和 RenderDomain。

没有世界坐标、地图绘制、立足线、物理、Camera 夹取和换图。第 1.3 节的 13 张和 `physics.default` 已经在 adventure 库里。这条进程还读不到地图，因为读取白名单仍只有纸娃娃。

### 12.2 现有移动要迁走

仓库里没有一套可迁移的客户端积分。要迁走的是 `subsystem.mjs` 里的演示映射：

- `LOCOMOTION_BY_DIRECTION`：左右 `walk`，上 `jump`，下 `stand`。
- `centeredPosition` 和视口订阅对人物 `x/y` 的改写。

迁走之后，方向状态、面键和按下边沿仍由 `createControlsConsumer` 提供。`south` 是跳跃键，`north` 是坐下，`east` 是攻击，`up` 是传送或爬绳。单独的 `down` 在陆地上进入 `prone`。人物组件继续按 `locomotion` 播帧，这是画面钟，不是位置钟。攻击用 `action` 事件。画面钟不决定位置和是否落地。迁走演示映射之后，连续走动由第 12.6 节的位置钟调用 `step`。

### 12.3 内容进入进程

- `scripts/pwa/read-adventure-fsdb.mjs` 的白名单加上第 4 章的地图表和 `[struct]physics.Default`。
- 构建期 Adapter 从这些表投影 `struct.AdventureMapScenePlan`。Plan 带 `effectiveBounds`、图层、立足线、绳子、座位、传送门和 `swim`。运行时投影不写回 FSDB。没有 `seat` 的图，`seats` 为空。
- `scripts/pwa/build-installation-bundle.mjs` 现在只打包 `base`、`adventure-map`、Controls 和 `cms-actor`。三份 Plan、地图 PNG 和 `physics.default` 要进入同一个确定性闭包。
- 根目录 `presentation.json` 现在只注册 `cms-actor`。五个场景组件实现之后再注册它们的 classic script。

### 12.4 物理库

`libs/adventure-field/` 还不存在。它是纯函数，不依赖 LoomRealm、DOM、网络、文件系统和定时器。第一版包含：

- `step(state, input, dt)`。契约在第 6.7 节。相同状态、输入和 `dt` 得到相同状态。`dt` 是调用方毫秒。本地虚表 `+0x24` 返回立即数 `0x1E`。
- 立足线索引：水平段和斜坡、`prev/next`、向下落地，落地后记下 `footholdId`。竖线和身体宽度见第 16 节。
- `swim` 为 0：行走、陆地跳、下落、下跳、蹲下。行走位移按第 6.5 节。下跳使用第 6.6 节的门闩。初速见第 16 节。
- `swim` 为 1：水中跳不复用陆地跳的式子。这 13 张上 `0x70DF65` 与 `info.swim` 一致，地面一步因此乘 `swimSpeedDec`。没有立足时的初速是 `-(swimSpeed · 5)`。离地后的水平式在第 6.5 节。
- 坐下读座位。只有中央广场、商店街和动物园有座位，坐标在第 16.1 节。爬绳读已有的绳子记录，命中框用 `0xA4FC6F`。`ropeId` 仍在时左右不改 `x` 和 `facing`。离开绳子见第 6.6 节。攻击动作名和命中矩形见第 16 节。
- 传送判定用上键边沿、当前立足对象和门的 `x±20`、`y±50`，并且优先于抓绳。启用规则在第 1.4 节：`pt` 1、2、3 且 `tm` 在这 13 张里。`st00` 的 `tm` 是 `999999999`，不换图。`pt` 7、8、9、11、12、13 按第 7.2 节返回本地效果。函数只返回意图，不调用 `replace`，也不发报文。
- Camera 公式按第 4.2 节。库里是纯函数，由调用方传入视口尺寸。`step` 不读 Viewport。

积分用第 6.5 节已经反汇编的式子。行走用该节的地面一步。`walkForce=140000` 和 `gravityAcc=2000` 不写成 px/s。陆地跳、下跳和水中跳的初速在第 6.6 节。其余还没有数值的位移见第 16 节。

### 12.5 子系统一帧里做什么

`adventure-map` 仍是唯一入口。下面六步是位置钟叫醒之后的一次调用。浏览器按第 12.6 节循环这六步。一次调用里：

1. 从 Content 读三份 MapScenePlan 和 `physics.default`。
2. 按第 6.1 节建立场地状态。初始坐标是 `(-92, 294)`。
3. `paused` 为真时不调用 `step`，把经过的墙钟时间丢掉，并把 `cms-actor` 的 `paused` 写成 `true`。为假时，按第 6.7 节把 Controls 的按住状态和这一步的边沿收成 `input`，调用 `step`。攻击位子交给已有的 `action` 事件。`effect` 交给呈现，不改人物坐标。传送意图在 `replace` 成功之后才改 `mapId`。
4. 按第 4.2 节重算镜头，按第 4.5 节加上这一步的滚动偏移和换帧，再投影整棵场景树。`cms-avatar-layer` 与 `cms-actor` 的 key 保持稳定，地图节点使用 `sceneEpoch`。`paused` 为真时，镜头、滚动和换帧都不推进。
5. 上键边沿、当前有立足对象，并且人在启用门的 `x±20`、`y±50` 时，按第 7.2 节的 `pt` 分支处理。`pt` 1、2 或 3 且目标在这 13 张里才换图。跨图才 `domain.replace`。同图只改落点，不换 `mapId`。准备失败或 `replace` 失败则留在旧地图。落点见第 16 节 R10。走进门不换图。
6. 取消或失败时清掉这只 interval，并释放 Controls、视口订阅和 RenderDomain。

### 12.6 步长调用点

固定 gitlink `93648192323bf5f57996b7b54cbae641d8a53fdb`。位置钟和画面钟按第 6.2 节分开。浏览器里的连续走动由 `adventure-map` 的一只 `setInterval` 完成。

| 决定 | 层 | 结论 |
|---|---|---|
| 谁反复调用 `step` | `adventure-map` | pin 没有 Tick。间隔见第 16 节 R14。视觉组件不建这只钟 |
| 一步多少毫秒 | `libs/adventure-field` 的 `step` 入参 | 调用方毫秒见第 16 节 R14。不传 25 |
| 一次醒来最多几步 | `adventure-map` | 见第 16 节 R14。不写成 4 |
| 暂停时停不停 | `adventure-map` 的 `paused` | 客户端的暂停信号还没有。`abort` 仍是取消，不拿它当暂停 |

#### 调用者

`step(state, input, dt)` 自己不读时钟。第 12.5 节的六步是一次调用里要做的事。固定 pin 没有东西把第 3 步反复叫起来。

`base` 只创建唯一的 `game-controls-input`，然后 `frame.call("adventure-map", frame.params)`。子 Frame 结束、失败或取消时，`finally` 关掉这个输入域。它不解释输入，不持有场地状态。子 Frame 活跃时，`base` 停在这次 `call` 上。Controls 投递给当前顶层 Frame，也就是 `adventure-map`。这里没有循环，也没有 Tick。

`adventure-map` 的 `frame()` 在一次 activate 里进入。现在它读 AvatarPlan，创建 `cms-actor`，用 `createControlsConsumer` 和 `createDirectionalControlsTracker` 在 `onState`/`onEvent` 里改 `locomotion`/`facing`，然后 `Promise.race` 等到 `frame.signal` 取消或致命错误。人物 `x/y` 仍由视口尺寸居中，不是世界坐标。`cms-actor` 自己的画面钟会换身体帧，不改这个坐标。Frame 上没有帧回调。`SubsystemScope` 没有帧时间戳、帧间隔、游戏时钟或 Tick 订阅。PWA 的 `MainPlatform.scheduler.schedule()` 不在 Scope 上。Runner 里的另一份 `scheduler` 只交给 Runtime Control 的 hello、Frame 和清理期限。要在这个 `frame()` 里循环，只能自建定时器。产品只允许这里建一只 `setInterval`。视觉组件不建。`requestAnimationFrame` 不充当位置钟。

Controls 的 `onState`/`onEvent` 也不是位置钟。`createControlsConsumer` 返回前会同步投递一份空 State。方向键的 `repeat === true` 已被现有 `createDirectionalControlsTracker` 丢掉，按住左右不会靠重复事件再进来。`onState` 在有效集合变化时发一份 `down`。非空时，`game-controls-input` 每 1000 毫秒重发同一份，空集合停止重发。2500 毫秒没有新的 State 时，消费侧退回空集合。这是输入新鲜度。按住左右期间，tracker 里的方向保持为左或右，但没有按 25 毫秒再进入的回调。把 1000 毫秒那一次重发拿来调用 `step`，一步会变成 1 秒，而且松键之后重发停止：陆地跳的空中、下落、地面减速、游泳减速都没有下一次调用。不另写一套 held-key tracker 去补这个空档。现有 tracker 继续只记方向，不叫 `step`。

`cms-actor`、`cms-map-layer`、`cms-back`、`cms-scene-view`、`cms-avatar-layer`、`cms-portal` 和 `game-controls-input` 都不调用 `step`。不新造地图入口。Viewport 不能当 Tick。`cms-actor` 已有的 `requestAnimationFrame` 只换帧，不读成位置钟。

因此：pin 没有 Tick。客户端步进入参是立即数 `0x1E`，见第 16 节 R14。镜头跟随策略尚未查明；移动对象 `+0x58/+0x110` 方法体已定位在映像内，但尚不能与背景层调用直接划等号。不把间隔写成 25 毫秒，也不把补算上限写成 4。纯函数库不持有定时器。Node 测试在浏览器之外调用 `step`。

`0x9BCD6C` 的入参是调用方毫秒，乘 `0.001` 变成秒。`walkForce`、`gravityAcc`、`jumpSpeed` 都不是这个毫秒。Controls 的 1000 毫秒是 State 重发，2500 毫秒是过期退回空集合。纸娃娃 `fly` 的 `delay` 300 是画面停留。这些都不是位置钟的周期。

四个 decrypt 槽没有字段名。攻击选择下标可写 `[user+0x3C4]`；`+0x354/+0x358` 是随机数加密对，矩形见第 16 节 R9。已挂绳的第二对坐标没有名字和写入。爬绳命中仍用 `0xA4FC6F`。离开绳子见第 6.6 节。

#### 一次调用的 input

输入的形状、左右同时按下时怎么取舍、边沿只生效一次，以及同一步的互斥，都写在第 6.7 节。函数在两次调用之间不保存未处理的边沿。位置钟每次调用前，用现有 tracker 里的方向和这一步新出现的边沿组装 `input`。不另写一套 held-key tracker。测试在每次调用时自己放入 `held` 和至多这一步的边沿。

没有座位的 10 张上，`north` 不命中。中央广场、商店街和动物园按第 16.1 节的坐标坐下。出生点仍是 `(-92, 294)`。换图之后的坐标见第 16 节。这两处坐标不是步长，也不由浏览器循环产生。

#### 暂停

pin 里没有暂停信号。`SubsystemDefinition` 只有 `initialize`、`frame`、`shutdown`、`failed`。`Frame` 和 `SubsystemScope` 上的 `signal` 都是 `AbortSignal`。

`frame.suspend` 是 Main 的行政挂起。成功时 Activation 永久撤销，不能恢复成原来的激活。固定 pin 的实现会 `abort` 这个 `frame.signal`。`adventure-map` 把 abort 收成 `cancelled()`，`finally` 释放 Controls、视口订阅和 RenderDomain。这是取消。

普通 `frame.call` 会挂起调用方的 Activation。协议不向调用方再发送 `frame.suspend`，实现也不 abort 调用方的 signal。`base` 在等待 `adventure-map` 时就处于这种挂起。这是子帧调用。

`game-controls-input` 的全屏遮罩不写入 `controls.state`、`controls.event` 或场地状态。Viewport 也不提供暂停。

`paused` 放在 `adventure-map`，不放进 `step` 的参数，也不放进第 6.7 节的互斥表。这次不新增手柄键。子系统提供 `setPaused`。

`paused` 为真时：interval 仍会醒，但步数写成 0，并把经过的墙钟时间丢掉。同时把 `cms-actor` 的 attr `paused` 写成 `true`。组件看到 `true` 就不再累加 `delay`，身体和表情都停在当前帧。写成 `false` 后画面钟继续。这是新增的一个 attr，其他 attrs 不改。`abort` 仍是取消，会释放 Controls、视口订阅和 RenderDomain。纯函数不增加暂停参数。

#### 调用周期还没有

`0x9BCD6C` 的入参来自虚表 `+0x24`。本地这张表返回立即数 `0x1E`。25 毫秒和一次最多 4 步不是这条指令。`setPaused` 也不是从映像读出的。地面一步的式子在第 6.5 节。decrypt 数值、命中状态和 `+0x174` 见第 16 节。缺 `delay` 的帧停在第一帧。`swimSpeedDec` 在 `0x9BD757` 里、`0x70DF65` 非 0 时参加 `step₀` 和速度上限。

#### 浏览器连续走动

按住左右时，位置钟每个醒来调用 `step`。世界坐标按第 6.5 节从 `slot1` 投影。可以同时做的是 Node 里对同一个 `step` 注入调用方毫秒：门框、座位框、抓绳框和 `0x9D80EC` 这些已经反汇编的判定。画面上的迈步动作仍由 `cms-actor` 的画面钟播放。

### 12.7 画面和人物动作

`cms-scene-view`、`cms-back`、`cms-map-layer`、`cms-avatar-layer`、`cms-portal` 只有 `DESIGN.md`，没有浏览器实现。`cms-map-layer` 用视口尺寸画布，按 Camera 裁剪，不把整张地图画成世界位图。这些组件不建立画面钟，也不调用位置钟。

`cms-actor` 的画面钟保持现有实现：按 `delay` 换帧，不改世界坐标，也不把坐标写回场地状态。attr `paused` 为 `true` 时不再累加 `delay`。`locomotion` 和 `facing` 来自第 6.7 节的 `state`。攻击位子来自同一次返回值，走 `action` 事件。动作名见第 16 节。它还要实现 `prone`、`swim`，并补上 `sit`、`climb`。`prone` 指向 `prone`，`sit` 指向 `sit`，`swim` 和水中跳指向已有的 `fly`，陆地跳指向 `jump`，`climb` 指向 `rope`。爬绳区域没有把 `ladder` 或 `rope` 写到人物上。当前校验器只接受 `stand`、`walk`、`jump`。`pt` 1 和 `pt` 3 不创建 `cms-portal`。`pt` 2 在 `pv` 帧存在时创建。

### 12.8 验收

第 9 节的 Node 测试和浏览器测试都还没有对应程序。现有 E2E 只覆盖居中的纸娃娃。运动的位移和初速等第 16 节。`cms-actor` 换帧只说明画面钟还在，不说明人物已经沿世界坐标走动。

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
- [`research/result/map/MAP-N1-N8-REVERSE.md`](../../research/result/map/MAP-N1-N8-REVERSE.md)
- [`research/result/map/MAP-GAPS-FINAL-CLOSURE.md`](../../research/result/map/MAP-GAPS-FINAL-CLOSURE.md)
- [`research/result/map/MAP-PHYSICS-CORRECTION.md`](../../research/result/map/MAP-PHYSICS-CORRECTION.md)
- [`research/result/map/MAP-REVERSE-STATUS.md`](../../research/result/map/MAP-REVERSE-STATUS.md)
- [`research/task/060-map-wz-extraction.md`](../../research/task/060-map-wz-extraction.md)
- [`research/result/task050-behavior-flows.md`](../../research/result/task050-behavior-flows.md)

## 14. 一次逆向任务

这一节保存 M1–M16 的题目和 A 级结果。指令在 [MAP-M1-M16-REVERSE.md](../../research/result/map/MAP-M1-M16-REVERSE.md)。各节已经按结果收口。没有 M17。

做法保持原记录：同一张解包映像，指令级，地址用 VA。和 [MAP-MOTION-REVERSE.md](../../research/result/map/MAP-MOTION-REVERSE.md) 冲突时以指令记录为准。Ghidra 反编译不当成结论。

已经有指令记录、这次要接着问的缺口在第 16 节。下面这些是已经读到的事实，写缺口时不要把它们再当成未知：

- 键位是这次目标自己指定的：North 坐下，South 跳，East 攻击，上键先传送再爬绳。出生点 `(-92, 294)` 是六份 `sp` 里的一份，不是客户端选出的那份。
- 陆跳式子 `0x9BD20E`、下跳式子 `0x9BCFED`、水中式子 `0x9BD42D`、`+0x70` = `jumpSpeed`、`gravityAcc` 在 `+0x60`。这 13 张上陆地跳初速是 `-jumpSpeed`，下跳是 `1 / (jumpSpeed * K)`，水中跳是 `-(swimSpeed · 5)`。
- 抓绳框 `0xA4FC6F`、爬绳 `y += 3 * [+0x154]`、座位框 `x±10`/`y±30`、传送框 `x±20`/`y±50` 以及 `+0x110` 为 0 时 `0x954B58` 返回。
- 没有名为 `swim` 的身体动作。动作表槽位：`sit` 是 `0x27`（十进制 39），`prone` 是十进制 33，`ladder2` 是 `0x33`（十进制 51）。这三个数不是同一个动作号。
- VR 内缩 400/300。第 4.1 节的 Y 向下、视口左上角、1:1 和 world-to-screen。
- 绳子端点：上键越过 `y1` 且 `uf` 非 0，或下键越过 `y2`，`0x9BFB52` 把 `+0x124` 编成明文 0。`uf` 为 0 时上端停在 `y1`。

| 编号 | 要看到的写入 | 从这里看 | 设计用法 | 本次结果 |
|---|---|---|---|---|
| M1 | 松开下键之后，哪条指令改掉蹲下。`0x9533EA` 最高字节带 `0x80` 的松开路径有没有对 `prone` 的写入。`0x952F1F` 把 `+0x158` 写成 1 已记录，不要再把它当成离开蹲下 | `0x9533EA` 的松开分支 | 离开蹲下见第 16 节 | 没有写入：松开分支（0x953570 起，含尾调 0x968550 一层）不写 prone |
| M2 | 脚落到立足线之后，身体动作写成哪一个名字。`0x9BCFF2` 读 `Jump` 是 `0x9BCFED` 的速度路径，不要再当成落地换姿。`0x95A31E` 的动作号 2 是 `stand1`，读的是全局 `+0x150`，不要再当成落地 | 立足对象从 0 变成非 0 之后的动作名写入 | 落地换姿见第 16 节 | 落地链 `0x9BC6E5` 之后的 `0x9BC89F`、`0x9BC992` 不写动作名。owner `+8` 是 `0x5C0324`，`ret 4`。有立足时 `0x93DDDF` 写入 `0x7732E0` 的返回值，那个值来自动作对象 `+0x160` |
| M3 | `0x95516A` 在报文之前有没有把 `sit` 写到人物上；起来时有没有清掉人物上的座位下标。`field+0x2088 = 1` 已记录。task050 里另一对象的 `+0x2088` 是复位标志，不要当成 `seatId` | `0x95516A`，以及再次进入或左右移动时的清零 | 本地 `sit` 见第 16 节 | 报文前无 sit 写入；下标只进报文；本地仅 field+0x2088=1 与 +0x208C=时间戳；清除只在换景处理器（0x558579/0x55DAE2/0x57F13C） |
| M4 | 水中跳的速度写入，写进哪一对加密槽。地图 `field+0x150` 有没有抄进移动对象。全局 `[0xBDF54C]+0x150` 与地图字段是不是同一份。水中当时播放的动作号。`0x9BD0DE` 读的 `+0x150` 是水平键，不要再当成水中跳 | `0x9BCD6C` 附近、`info.swim` 的读取点 `0x534C86` | 水中跳单独分支，姿势用 `fly` | vy 写 +0x68/+0x78（0x9BD42D）；info.swim 无 move 拷贝；0xBDF54C 无写入者、与地图字段无关联指令；动作号无写入；[move+0x190]=多用途记录（+0x18/+0x24 加密双精度、+0x30 飞行判定、+0x3C 矩形容器） |
| M5 | `decrypt([move+0x190]+0x24)`、`decrypt([move+0x198]+0x48)`、`+0x6C`、`decrypt([move+0x190]+0x18)` 旁边的字段名。式子形状不重写 | `0x9BD20E`、`0x9BCFED`、`0x9BD42D` | 初速见第 6.6 节 | 字段名仍没有。陆地初速是 `-jumpSpeed`，水中初速是 `-(swimSpeed · 5)`。清符号的来源是 `DEC([move+0x190]+0x18)`。指针来自 `0x9BFD4C` |
| M6 | 行走、游泳、重力各一次积分的指令，以及相邻两次调用相隔的时间量度。`0x9BD58F` 对 `+0x180`、`+0x188` 的来源。没有周期就写没有 | 移动对象物理分发 `0x9BCD6C` 的逐步路径 | 有立足的地面一步见第 6.5 节的 `0x9BD757`。无立足的坐标见第 6.5 节。不把 `walkForce` 写成 px/s | 行走函数 `0x9BE703` 本身只做斜率投影。地面参数和世界坐标在 `0x9BD757` / `0x9BC992`，见第 6.5 节。重力/阻力=0x9BDF18；受迫位移=0x7ACCFF 写 +0x180/+0x188（0x9BD58F 消费）；dt=入参毫秒×0.001；周期常数没有 |
| M7 | 哪条指令用绳子记录的 `l` 选择 `ladder` 或 `rope`。已经排除读记录 `+4` 的函数不再逐个重开：`0x9BFB52`、`0x9BFD85`、`0x6B8949`、`0x9D3CCA`、`0x9D47FA`、`0xA4FC6F` | 动作名写到人物上的那次调用 | `climb` 画 `rope` | 没有写入：爬绳区域无 0x24/0x25 动作槽立即数（命中均为方向键 0x25-0x28 查询）、无 0xBDDB10 引用 |
| M8 | `+0x80`、`+0x98` 的名字，以及 `0x6131F4` 或等价写入。空中抓绳是否用这一对 | `0x9D7D4F` | 不猜宽度。测试与立足抓绳分开 | 第二对坐标槽（+0x80 校验 +0x90、+0x98 校验 +0xA8），只读；名字没有；写入没有；空中抓绳不用这对（抓绳用主对 +0x20/+0x38） |
| M9 | 哪条指令清掉已挂上的绳子（`+0x124` 或当时的等价槽），输入是什么。端点 y 夹紧不要写成下绳 | `0x9D80EC` 的调用方，以及 `+0x124` 的清零 | 离开绳子见第 6.6 节 | 端点是 `0x9D8206` 把三个 0 交给 `0x9BFB52`。`0x9BFBF2` 清立足，`0x9BFBF8` 把明文 0 编进 `+0x124`。上键且 y 小于 `y1` 还要 `uf` 非 0；下键且 y 大于 `y2` 不读 `uf`。`0x9BCC34` 是另一条，看节点字 |
| M10 | east 这一下写到人物上的动作下标。命中矩形的两个坐标从哪来，半宽是哪一个立即数或字段。持武器时类型 1、2、5、6、8 会不会填进 `0xBA59B8`。未持武器为空已经看过，不要再断成死槽 | `0x954F0F`、`0x9573A6`、`0x95C5B2`、`0xA4F93C`、`0x5114AA`、`0x773491` | 动作名和矩形见第 16 节。不算伤害 | 式子在第 6.6 节。`0x77325B` 用 `0xBA5808`，类型 1、2、5、6、8 在这张表里有槽。`0x773491` 用 `0xBA59B8`，这五个类型的计数是 0。用于选表的武器类不在 1 到 9 时两处都返回 -1；`+0x354` 是随机值槽。留下的下标由 `0x9355FC` 写入 `[user+0x3C4]`。矩形指针是 `user+0xEE8`。半宽没有 |
| M11 | `field+0x13C` bit 17 和立足线 `forbidFallDown` 是不是同一位。`0xA4E6F9` 只把它收成 0 或 1，不要再把它写成下跳开关，除非这条写入证明如此 | `0x95308C` 的第一道门，以及立足线加载 | bit 17 为 1 才拦住。这 13 张的 `mpRecovery` 缺省，读出 0，这一位不拦住 | 不是同一位。`forbidFallDown` 写属性 `+0x30`，这 13 张是构造值 0。`field+0x13C` 是 `info/mpRecovery`（字符串 `0x5B8`），缺省整数是 `ebx = 0` |
| M12 | 换图之后人物 `+0x20`、`+0x38` 的写入。同图 `0x963D89` 只组报文。跨图 `0x53FF69` 发报文。这两处都不要再当成已经写了本地坐标 | `0x954B58` 命中之后的同图与跨图路径 | 落点在第 6.6 节。命中路径不写 `+0x20` / `+0x38` | 同图把整数放进 `+0x28F8`、`+0x28FC`。`0x95533D` 再调用 `0x9C1113`，编进 `move+0x20`、`+0x38`。跨图 `0x954C98` 只发操作码 `0x21`。接收 `0x81` 之后，新人物由 `0x9507F0` 按记录 `+0xC`、`+0x10` 落点，y 再加 `-0xA`。同图间隔立即数是 `0x258` |
| M13 | 镜头跟随、dead zone，以及地图小于视口时的摆放。VR 函数 `0x66E59E` 和它的唯一调用点 `0x66630D` 已经排除；`0x9C0EC0` 经复核是四 IID QI 分派器（非跟随函数），`0x9BC404` 是位置/状态序列化器（部分精读） | 跟随函数本体（EXE 全映像搜索未命中；不排除 DLL 侧运行时绑定） | 见第 16 节 R14 | 未找到直接跟随写入；`0x5A↔0x1E` 关系与跟随策略保持 OPEN（Gap G10/G34） |
| M14 | Tile、Obj、背景加载键的比较方向，以及相同键的次序。比较器体尚未定位：Tile 键经变体对象虚表 `+0xB4` 交给 COM 风格调用（返回值按 HRESULT 检查，非比较结果），Obj 键走栈封装 cdecl 通道；22 张候选虚表第 45 槽全分类无比较语义。Henesys 的 tile 35 和 34 键相同，只用来核对源顺序（不证明绘制顺序） | 比较器体（栈封装被调族或绘制遍历内） | P1 继续用产品顺序：Obj 组先于 Tile 组，同值保持源顺序 | 键交接 0x666F7D call [eax+0xB4] 指令级核实（Tile/Obj 公式不变）；比较器未定位；次序不推断 |
| M15 | layer 虚表 `+0x98` 的方法体。`+0x58`（`0x43715C`）的时间单位。参数顺序已经确认，不要重排参数 | `0x43715C` 所在层对象 | 滚动节拍在第 4.5 节。缺 `delay` 的帧停在第一帧 | 0x43715C 是对运行时虚表 +0x58 的转发壳（返回 dword）；虚表运行时构建，+0x58/+0x98 方法体静态不可达；时间单位没有 |
| M16 | `pt` 7、8、9、11、12、13 的分支各自写什么。`pt` 12 和 13 的 `VerticalJump` 已确认不是人物下跳，不要再接回 `0x95308C` | `0x954B58` 里 `tm == 999999999` 的那条，以及 `0x9549DF` | 本地效果在第 7.2 节。第 1.4 节的 `pt` 1、2、3 走换图。不发报文 | pt 7/8/11→发报文（串 0x61）+ 写座位标志对（[user+0x2088]=1、+0x208C=时间戳）；pt 9→哨兵不匹配，落通用路径无专属写；pt 12→0x9549DF；pt 13→0x53E95D(move,19)+0x7ACCFF(move,−门x,门y) |

16 条都已回答，等级都是 A。下落路径 `0x9BDF18` 乘的 `+0x28` 按物理加载表是 `floatDrag1`，`walkDrag` 在 `+0x10`。上表 M6 那一格沿用逆向笔记里的注释，正文第 6.5 节按加载表。各节不再把这 16 条当开放缺口。下落坐标和换帧的后续指令在第 15 节。

## 15. N1–N8

指令在 [MAP-N1-N8-REVERSE.md](../../research/result/map/MAP-N1-N8-REVERSE.md)。八条都是 A。没有 N9。

| 编号 | 结论 | 设计用法 |
|---|---|---|
| N1 | 行走段入口到尾部之前没有物理表乘法、没有 `0x6131F4`、没有键、没有 dt | 地面世界坐标由 `0x9BD757` 的 `slot1` 经 `0x9BC992` 投影，见第 6.5 节。不用 `walkSpeed * dt` 代替 |
| N2 | 下落式子已列出。`dt` 有 8 处乘法。单位不写 | 可代入的 decrypt、命中状态和 `+0x174` 见第 16 节 |
| N3 | `0x9BE68F` 写 `+0x20`，`0x9BE6CE` 写 `+0x38`。新坐标 = 旧坐标 +（旧速度 + 新速度）× dt × 0.5 | 这条梯形只在下落分支。它依赖还没有的速度，见第 16 节 |
| N4 | `swimForce`、`swimSpeed` 在下落水平项，经 `0x70DF65`。当时看到的两个处理器没读 `swimSpeedDec` | 这 13 张上 `0x70DF65` 与 `info.swim` 一致。地面一步在返回 1 时乘 `swimSpeedDec` |
| N5 | `[move+0x198]` 由 `0x9BFD4C` 挂上 owner `+0x20` 的鞋子 | 这 13 张陆地跳初速是 `-jumpSpeed`，下跳是 `1 / (jumpSpeed * K)`，水中初速是 `-(swimSpeed · 5)` |
| N6 | 钳制边界就是传入的 dx、dy。方向与 `0.0` 比较。没有另一颗限值 | `pt` 13 按这个钳制，再加进速度 |
| N7 | 返回值只进滚动。帧推进在虚表 `+0x110`，静态不可达 | 有 `delay` 的背景按第 4.5 节的产品节拍换帧 |
| N8 | `pv` 直接绘制。没有 delay 比较，没有帧号写入 | 有 `delay` 的传送门画面用同一节拍。缺 `delay` 的帧停在第一帧 |

## 16. 对齐还缺的客户端写入

阶段目标是这 13 张上的行走、陆地跳、水中跳、下跳、蹲下、游泳、攻击、坐下、爬绳，以及第 1.4 节的换图，并且与 CMS079 客户端一致。地面一步的式子在第 6.5 节。这 13 张没有 `drag`、`force`，立足属性因此是 `1`、`1`、`0`。`[move+0x190]` 的四份双精度是 `1`。`[move+0x198]` 是 owner 鞋子，地面一步的代入在第 6.5 节。`0x70DF65` 在 8 张游泳图返回 1，在 5 张陆地返回 0。`field+0x13C` 的 `mpRecovery` 读出 `0`，bit 17 不拦住下跳。5 张陆地离地后走命中分支。`vy` 小于 `fallSpeed` 时加上 `gravityAcc · dt` 并钳到 `fallSpeed`；`[move+0x16c]` 为 0 且已经超过 `fallSpeed` 时按 `floatDrag2 / 100 · dt` 收回。8 张游泳图的竖直键式子在第 6.5 节。陆地跳初速是 `-jumpSpeed`，下跳是 `1 / (jumpSpeed * K)`，水中跳是 `-(swimSpeed · 5)`。换段时两槽怎样改，写在第 6.5 节。换图之后的左右界、初速字段名、`[move+0x174]`、落地和蹲下、坐下身体、攻击槽、换图坐标、半宽、绘制顺序和步进入参都核对过，结果在第 16.2 节。绳子端点在第 6.6 节。

### 16.1 座位坐标

读 `.work/task-001/extracted/冒险岛online/Map.wz` 的 `Map/Map2`。地图号以 `2220` 或 `2300` 开头的一共 56 张。座位是顶层 `seat` 下的向量。名字来自 `String.wz/Map.img/ossyria`。

有座位的只有下面三张。从童话村走到这三张，最短要第 1.3 节的 13 张。不在没座位的图上造座位。坐下的槽由第 6.6 节的动作字 `(旧 & 1) | 0x14` 选出。

| 地图 | 名字 | 座位 |
|---|---|---|
| `230000001` | 中央广场 | `(-286, -69)`、`(-316, -69)`、`(-256, -69)` |
| `230000002` | 商店街 | `(-287, -1190)`、`(-317, -1190)`、`(-257, -1190)`、`(265, 82)`、`(235, 82)`、`(295, 82)` |
| `230000003` | 动物园 | `(266, 7)`、`(236, 7)`、`(296, 7)` |

### 16.2 写入核对

| 编号 | 卡住的行为 | 已经看到的 | 核对结果 |
|---|---|---|---|
| R1 | 地面按住左右时世界 `x` 怎么变，松键之后怎么停 | 留在本段、换段和投影夹取都在第 6.5 节。左界是创建移动对象时那张图全部立足 `min(x1, x2) + 30` 的最小值，右界是 `max(x1, x2) - 30` 的最大值。`0x9BC602` 只在创建时抄入 `move+0x138`、`+0x140` | `0x9BC602` 有十个直接调用，每次 `ecx` 都是同一函数里刚分配的移动对象。本地这只只在 `0x5BFEE5` 经过一次，来源是 `0x9C2911` 的返回值。没有第二次拷贝 |
| R2 | 空中左右和松键时的水平速度 | 5 张陆地离地后走命中分支。松键按 `floatDrag2 / 100 · dt` 收到 0；`vy < fallSpeed` 时步长再乘 `floatCoefficient`。按住方向时驱动是 `2 · key · floatDrag2`，界限是 `walkSpeed / walkForce · floatDrag2`。8 张游泳图先把 `vx` 收进 `[-swimSpeed, swimSpeed]`，步长是 `floatDrag1 / 100 · dt`。按住方向时 `0x9BDEA7` 的驱动是 `key · swimForce / 100 · dt`，收到 `±swimSpeed`。松键时 `0x9BE506` 的比较值是 0，同一份步长收到 0 | 两条水平式都在第 6.5 节 |
| R3 | 下落时竖直速度 | 式子在第 6.5 节。5 张陆地：`vy` 小于 `fallSpeed` 时写成 `min(fallSpeed, vy + gravityAcc · dt)`。`[move+0x16c]` 为 0 且 `vy` 大于 `fallSpeed` 时先按 `floatDrag2 / 100 · dt` 收回，不低于 `fallSpeed`。8 张游泳图在 `0x9BE3BA`：先把 `vy` 收进 `[-swimSpeed, swimSpeed]`，竖直键为 0 时向 `swimSpeed` 加上 `swimForce / 100 · dt`；竖直键小于 0 时走向 `0.3 × swimSpeed`；竖直键大于 0 时这一步结束写成 `1.5 × swimSpeed` | `[move+0x16c]` 非 0 且进入步进时 `vy` 已经大于 0，才走 `0x9BDFF2`：`vy = [move+0x174] · jumpSpeed · 0.001`。`0x951523` 在 `0x939477` 返回 1 且 `[user+0x2EE0] ≤ 0x994C7A()` 时先把标志写成 0。这两个双字的直接写入都在 `0x963B28`，调用点 `0x975643` 要求技能号 `0x4F5C6D`。`+0x174` 写入的是技能对象 `+0x13C` 的解密整数。分配不把 `[user+0x2EE0]` 清掉 |
| R4 | 陆地跳、下跳、水中跳的初速 | 陆地跳是 `-jumpSpeed`。下跳是 `1 / (jumpSpeed * K)`，`K = -0.35355339`。水中那份清符号双精度是 `0xA70FBB` 作用在 `DEC([move+0x190]+0x18)` 上的结果，这 13 张上是 1，所以初速是 `-(swimSpeed · 5)`。挂绳后水平键非 0 再跳，竖直再乘 `0.5` 或 `0.3`，水平是 `walkSpeed · key · 1.3` | 四个槽没有字段名。`0xA4FE23`、`0xA4FE36` 对 `+0x18`、`+0x24` 做 `fld1`。`0x692BA1`、`0x692BCE` 对鞋子 `+0x48`、`+0x6C` 做 `fld1`。`drag`、`force` 写的是立足属性。式子已经能代入 |
| R5 | 落地后身体回到站立还是 alert | 槽 2 是 `stand1`，槽 0 是 `walk1`。立足非 0、水平为 0、竖直不大于 0 时，`[user+0x3BC] <= 0` 选 `(旧&1)|4`（槽 2），`>0` 选 `(旧&1)|8`（槽 4 alert）；移动时按 walk 路径 | 全镜像该字段 26 条引用、9 处写 `0x1388=5000`，但未找到直接 `sub/dec`；不能据此证明原版每拍递减。社区 HeavenClient 有 `5000ms` 的 TimedBool alert 倒计时，可作为行为等价实现参考，见第 16.4–16.5 节 |
| R6 | 松开下键之后怎样离开蹲下 | 槽 `0x21` 是 `prone`。松开分支不写它。动作号开关只有 `0x32` 到 `0x35`。字符串号 871 只在登记时压栈。用户区里的 `mov [ebp-4], 0x21` 是 SEH 状态 | 水平为 0、竖直大于 0、立足非 0 时 `0x93D238` 返回 `(旧 & 1) | 0xA`，右移结果 5，槽是 `0x21`。下键回到 0 且左右仍为 0 时返回 `(旧 & 1) | 4`，右移结果 2 |
| R7 | 爬到绳子端点之后怎样下来 | 上键是 `[move+0x154] = -1`，下键是 1。上键且 y 小于 `y1`：`uf` 非 0 时 y 写成 `y1 - 5`，再 `0x9BFB52(0, 0, 0)` 清 `+0x110` 和 `+0x124`；`uf` 为 0 时 y 写成 `y1`，绳子还在。下键且 y 大于 `y2`：y 写成 `y2 + 1`，同一调用清绳。节点字由 `0x6B893B` 写入，端点不走 `0x9BCC34` | 式子在第 6.6 节 |
| R8 | 坐下和起来时身体怎么换 | 动作号 `0x33` 进入 `0x95516A`。框在 `0x54634C`：x±10、y±`0x1E`，座位对在 `[ecx+0x16C]`。坐标是 `[user+0xEE8]`、`[user+0xEEC]`。`ecx` 来自 `0x4376F2`，即 `[0xBDF54C]` 或 0。命中后写的是上下文 `[0xBD9028]+0x2088 = 1` 和 `+0x208C` 时间戳。报文之前没有动作名。`0x77FB40` 把这个全局写成 0 | `0x6A0ADF` 解开 `user+0x2944` 非 0 时 `0x957169` 返回 `(旧 & 1) | 0x14`。右移结果 10，`[avatar+0xE7C]` 为 0 时槽是 `0x27`。构造 `0x965A09` 把明文写成 0。操作码 `0xCF` 进入 `0x9658CC`：点测试非 0 时 `0x9659A0` 把明文写成 1，否则 `0x9659E2` 写成 0。本地 `0x95516A` 不写这一对，上下文 `+0x2088` 也不进动作字 |
| R9 | 攻击动作名、随机选择和命中矩形 | `0x77325B/0x773491` 使用 `0xBA5808/0xBA59B8` 动作变体表；`+0x354` 全镜像 13 条直接引用均为读取/传参。间隙函数 `0x416E36` 写 `{[user+0x354] 随机值,[user+0x358] 键}` 加密对，PRNG 来自 `0x416E71`/`0xBDF028`；武器类 1–9 是分派器的另一个参数。选中下标写 `[user+0x3C4]`，矩形用 `[user+0xEE8]` 和 `[user+0xEEC]-0x1C` | 表级规则已闭合：`variant=table[weaponClass][decryptedRand % count]`；无效类/空行返回 -1，不调用 `0x935510`。社区项目同样按武器类型/随机值选动作，但加密与 PRNG 不同，不能宣称逐位一致，见第 16.3–16.4 节 |
| R10 | 换图之后人出现在哪，怎样避免立刻走回去 | 命中路径不写 `+0x20` / `+0x38`。同图 `0xA4F6F1` 只返回立足对象。跨图 `0x53FF69` 发报文 | 式子在第 6.6 节。跨图落点是记录 `+0xC` 与 `+0x10`，y 再加 `-0xA`。同图间隔立即数是 `0x258`。没有吸附容差立即数 |
| R11 | 这 13 张上下跳会不会被 bit 17 拦住 | `field+0x13C` 是 `info/mpRecovery`，读出 0，bit 17 不拦住。其余会直接返回的比较在第 6.6 节。构造值和这 13 张的立足装载都不成立。三对明文只在静态键 `0xBE12D0`、`0xBE12C0`、`0xBE1270` 命中后改写 | `0x4259D0` 读游标上的下一个 16 位字。这个字在运行时缓冲里，映像不含这个整数。没有命中时三对仍是明文 0 |
| R12 | 身体横向宽度、竖线、向上穿过平台 | 没有身体宽度字段。`x1 == x2` 不能插值出站立高度。向下穿过水平线或斜线落到最早接触，这一条已经有 | 半宽没有立即数。竖线在 `0x9BED81` 相等时继续。向上穿过在 `0x9BE9A0` 跳过 |
| R13 | 人物与 Obj 的绘制排序 | 比较键 `z + 10*(layer*3000-zM)-1073721834` 已证；`0x666F7D` 的 `call [eax+0xB4]` 是经变体对象的 COM 风格虚调用（返回值按 HRESULT 检查，非比较结果），`[0xBE2788]` 是运行时接口全局。22 张候选虚表第 45 槽全分类无插入/比较语义，比较器体尚未定位，不是"不在映像里" | 可实现已确认键的数值比较，但具体接口、同键顺序及场景遮挡精度未证。需运行时转储 `[0xBE2788]→vtable` 唯一化；其他开源客户端的攻击目标距离排序并非此 COM 排序器，见第 16.4 节 |
| R14 | 位置钟、镜头跟随、滚动和换帧 | 移动对象虚表 `0xB0CB70` 的 m4=`0x9BE703` 是物理主循环；`0x9BCCFB` 负责重置并写 `move+0x190=[Physics+0xAC]`，链路中出现 `0x1E` 步进入参。移动对象 `+0x58=0x9C0EC0`、`+0x110=0x9BC401` 均在镜像内（Ghidra 合并函数），但尚未精读 | `0x1E` 入参已证，`0x5A↔0x1E` 关系、相机跟随/dead zone/小图策略仍待证。背景层方法须另外绑定动态对象；可暂参考 HeavenClient 平滑跟随与边界夹取，显式标为产品实现策略（第 16.3–16.5 节） |

第 1.3 节的 13 张、绳子和座位已经在 adventure 库里。上一表的核对结果写在最后一列。怪物、报文、技能列表、伤害、`decHP`、`tm` 不在这 13 张里的出口，不在这次目标里。

### 16.3 第 16 节五项取证更新（2026-11-13）

权威证据文件：[SEC16-FORENSICS.md](../../research/result/atlas/SEC16-FORENSICS.md)（提交 `46e8a59f`）。**原版静态已证 ≠ 原版运行时已证 ≠ 社区源码参考 ≠ 产品行为等价**。此前“没有找到写入/方法体”只说明指定扫描或反编译范围缺失，不等于原版不存在。

| 项目 | 新证据与可实现层级 | 最小剩余取证 |
|---|---|---|
| 死亡字 `+0x61` | disp32 0 条、disp8 77 条，多数在盲区；尚不能将这些无类型引用归属 user 或断定是死亡位，dead 槽号也没有与动作表对齐。**仅行为级可实现**。 | 死亡事件前后 `user±0x100` 的内存 diff，另核 dead 槽名 |
| R9 `+0x354` | `0x416E36` 是相邻 `{随机值,键}` 加密对的写入者；`0x416E71` 提供随机值；武器类 1–9 来自另一个参数。**动作表级闭合**。 | 无表级缺口；精确 PRNG 状态序列另行验证 |
| R13 `[eax+0xB4]` | `0x666F7D` 是经变体对象的 COM 风格虚调用（返回值按 HRESULT 检查，非比较回调）；`[0xBE2788]` 指向运行时接口；DLL 中有 22 张候选虚表（第 45 槽全分类无插入/比较语义），方法体并非不在镜像。**键级可实现、比较器体未定位、动态绑定未证**。 | 读取 `[0xBE2788]→vtable` 并定位 m45 及同键行为 |
| R14 镜头 | `0xB0CB70` 为移动对象虚表，`0x9BCCFB` 写 `move+0x190=[Physics+0xAC]`；`0x1E` 已定位。移动对象 `+0x58=0x9C0EC0`、`+0x110=0x9BC401` 位于镜像内却未精读。**步进参数可实现，跟随策略未证**。 | 精读两处方法并采样角色坐标／视口原点／边界；`0x5A↔0x1E` 换算待证 |
| `[user+0x3BC]` | 全镜像 26 条引用，9 次写 `0x1388=5000`、两次条件写，未发现直接 `sub/dec`。可能经计算偏移或通用计时器递减。**条件式已证、倒计时来源未证**。 | 触发攻击/受击后逐 tick 采样，确认变化、时间单位及归零路径 |

### 16.4 开源复刻客户端源码对照（**仅为社区实现**）

所引代码均为第三方重写/移植，不是 Nexon CMS079 原版客户端源码；同源衍生项目不能算独立证据。以下链接固定到本次检索的提交，方便复核：

- **HeavenClient / JourneyClient**（C++）：[Stance.cpp](https://github.com/ryantpayton/MapleStory-Client/blob/cbb0fe27cf9683a12eca0a569121d8033cdc2a4d/Character/Look/Stance.cpp)、[CharLook.cpp](https://github.com/ryantpayton/MapleStory-Client/blob/cbb0fe27cf9683a12eca0a569121d8033cdc2a4d/Character/Look/CharLook.cpp)、[Char.cpp](https://github.com/ryantpayton/MapleStory-Client/blob/cbb0fe27cf9683a12eca0a569121d8033cdc2a4d/Character/Char.cpp)、[TimedBool.h](https://github.com/ryantpayton/MapleStory-Client/blob/cbb0fe27cf9683a12eca0a569121d8033cdc2a4d/Util/TimedBool.h)、[Camera.cpp](https://github.com/ryantpayton/MapleStory-Client/blob/cbb0fe27cf9683a12eca0a569121d8033cdc2a4d/Gameplay/Camera.cpp)、[Stage.cpp](https://github.com/ryantpayton/MapleStory-Client/blob/cbb0fe27cf9683a12eca0a569121d8033cdc2a4d/Gameplay/Stage.cpp)、[Combat.cpp](https://github.com/ryantpayton/MapleStory-Client/blob/cbb0fe27cf9683a12eca0a569121d8033cdc2a4d/Gameplay/Combat/Combat.cpp)（`cbb0fe27`）。
- **MapleUnity**（C#，HeavenClient 移植/参考，不能算独立原版证据）：[Player.cs](https://github.com/ilia810/MapleUnity/blob/afe2633853c884a38c338d0561d29b5d1d250ac4/Assets/Scripts/GameLogic/Core/Player.cs)、[WeaponProfile.cs](https://github.com/ilia810/MapleUnity/blob/afe2633853c884a38c338d0561d29b5d1d250ac4/Assets/Scripts/GameLogic/Data/WeaponProfile.cs)、[Combat.cs](https://github.com/ilia810/MapleUnity/blob/afe2633853c884a38c338d0561d29b5d1d250ac4/Assets/Scripts/GameLogic/Core/Combat.cs)、[CameraController.cs](https://github.com/ilia810/MapleUnity/blob/afe2633853c884a38c338d0561d29b5d1d250ac4/Assets/Scripts/GameView/CameraController.cs)（`afe26338`）。
- **Maplewright**：[仓库](https://github.com/Sheilem/maplewright)。可参考原版行为测量的研究方法，本次没有核验它对五项的对应实现，**不拿它为任何具体公式背书**。LibreMaple/MortalClient 等同源衍生项目亦不视为独立的原版机制证据。

| 对照项 | 社区源码实际做法 | 与第 16 节的关系 |
|---|---|---|
| 死亡 | HeavenClient 用 `Char::State::DIED=18` 通过 `Stance::by_state` 映射 `DEAD`；MapleUnity 用 `Player.IsDead => hp<=0`，死亡时停止运动并触发事件，复活重置。 | 可以独立维护 `isDead`，但不能据此认定原版 `+0x61` 或 dead 槽位号 |
| R9 | HeavenClient `getattackstance` 查武器动作候选列表，`randomizer.next_int(stances.size())` 选项；MapleUnity `WeaponProfile.CreateAttack` 用 `(uint)choice%stances.Count`，随机值由战斗层传入。 | 支持“武器类 × 随机变体”的**架构**；HeavenClient 的 C++ `Randomizer` 并不实现 CMS079 `+0x354/+0x358` 加密对或同一 PRNG 序列 |
| R13 | HeavenClient `find_closest` 用 `multimap<distance,oid>`，MapleUnity 用 `OrderBy(SourceDistance)` 选择攻击目标。 | 这两者是**目标选择排序**，并非场景图 `[eax+0xB4]` COM 比较器；最多提供通用数值排序的实现思路 |
| R14 | HeavenClient 的 `Stage::update` 在 player 更新之后调用 `camera.update(player.position)`；`Camera::update` 按 `hdelta=W/2-playerX-next_x`，当 `abs(hdelta)>=5` 时 `next_x+=hdelta*(12/W)`，纵向类似，最后地图边界夹取；进图直接 `set_position`。MapleUnity `LateUpdate` 用 `Lerp(current,target+offset,0.125)`，再夹到边界。 | 可作平滑镜头＋死区＋地图边界的**产品候选策略**；HeavenClient `next_x` 是渲染平移量，而本设计 Camera 是世界视口**左上角**，接入须做符号转换；绝不可当成原版已证镜头公式 |
| `+0x3BC` | HeavenClient 攻击/受击调用 `look.set_alerted(5000)`；`CharLook` 仅在站立姿势且 `alerted` 有效时覆盖为 `ALERT`；`TimedBool` 按 tick 递减并清零，`Constants::TIMESTEP=8`（ms）。 | 与原版写 `5000` 和 alert 判别式高度相似，支持 **5000ms 行为等价方案**，但既不证明原版 `+0x3BC` 的递减代码，也不能把 HeavenClient 的 8ms 替换原版 `0x1E` |

### 16.5 产品实现决策、验收与证据标注

1. **死亡：** Field Runtime 自有生命状态（如 `isDead`），按权威 HP/死亡事件更新；行为级映射 dead 动作。原版 `+0x61` 与 dead 槽位不写成已证。Frozen `cms-actor` 的 `locomotion` 当前没有 dead，若现有画面层无法内部映射则延后并走正式 ABI 版本评审，不擅改枚举。
2. **R9：** 使用已逆向的候选动作表与独立武器类参数，随机数先按已证加密对路径解码，再按 `rand%count` 选动作；无效类/空行无动作，保留特殊分支。单测使用固定种子或显式随机序列；**表级闭合不等于逐位 PRNG 一致**。
3. **R13：** `clientSortKey` 和原始放置顺序继续保留。P1 暂沿用第 4.3/4.4 节产品组序；未绑定 vtable 及同键规则时，不声称精确原版遮挡。可增加键碰撞、稳定排序与截图回归。
4. **R14：** 将镜头做成可替换策略，初版可参考 HeavenClient 的平滑、dead zone、地图 bounds；再用原版轨迹校准。`cms-scene-view` 的 `x/y` 仍是**世界左上角**，`step` 不读 Viewport，视觉组件不自建物理钟。`0x1E` 是原版已证参数，HeavenClient 的 `8ms` 是另一客户端的步长，二者不能混用；`0x5A↔0x1E` 换算继续标注待验证。
5. **alert：** 维护与移动状态分开的 `alertRemainingMs`，在攻击及已经验证的受击事件时设为 `5000`；每次 `step` 用明确定义为毫秒的 `dt` 递减且夹到 0。站立且 `>0` 显示 alert，到 0 显示 stand1；行走/跳跃不被强制覆盖。**这是社区交叉支持的产品行为等价方案，不是原版字段递减已证**。Frozen `cms-actor` 无 alert locomotion，必须走已有画面层可行映射或 ABI 评审，不私自扩枚举。

**后续最小取证队列：** 死亡前后 `user±0x100` diff 和 dead 槽名；R13 读取 `[0xBE2788]→vtable`；R14 精读 `0x9C0EC0/0x9BC401` 并记录视口轨迹；`+0x3BC` 在事件触发后逐 tick 采样。R9 的表级规则已闭合，不再作为缺运行时输入项。

