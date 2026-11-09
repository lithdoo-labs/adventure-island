# 2026-11-09 Adventure Field 设计评审修订

> 状态：修订已写入草案、RenderNode ABI 说明、MapScenePlanV1 和四个地图组件 DESIGN。  
> 日期：2026-11-09  
> 设计分支：`design/adventure-field-map-scene`  
> 上游草案：[Adventure Field 地图场景草案](../implementation/2026-11-09-adventure-field-map-scene-design-draft.md)  
> 逻辑契约：[MAP-SCENE-PLAN-V1.md](../../components/MAP-SCENE-PLAN-V1.md)  
> 呈现契约：[RENDER-NODE-ABI-V1.md](../../components/RENDER-NODE-ABI-V1.md)  
> 逆向状态：[MAP-REVERSE-STATUS.md](../../research/result/map/MAP-REVERSE-STATUS.md)

本次修订不改变 RenderNode 五字段，不改变六个 MVP 标签的数据结构，也不把地图公式写回 LoomRealm Render Update。组件实现仍排在这些契约之后。

同日晚些时候，完成定义改为童话村 `222000000`、井口 `222000001`、矩形地带 `230030200` 上的行走、跳跃、蹲下、游泳，以及沿井口的四扇门换图。第 3.4 节把 `pt` 3 改到不加载 pv 的一类，使井口 `out00` 可以切换。第 3.6 节和第 5 节改为注入步长，不再把运动移出当前目标。Bounds、排序、type 0、缺 `delay` 停留和 `replace` 原子性保持原决定。

## 1. 状态词

设计文档使用下面四个词。逆向笔记里的 VERIFIED、PARTIALLY VERIFIED、INFERRED、UNKNOWN 保留在 `research/result/map/`。一条函数只恢复了键或分支时，已恢复的子事实写「客户端已确认」，缺失的比较器或函数体写「待逆向」。

| 状态 | 含义 |
|---|---|
| 客户端已确认 | 反汇编已经证明这一条具体行为 |
| 产品约定 | Adventure Island 自己的呈现、坐标或验收选择 |
| 待逆向 | 比较器、函数体、时间单位或跟随算法还没有 |
| unsupported | 当前支持范围画不对；Adapter 失败并给出诊断，不补默认值 |

## 2. 继续保留

- RenderNode ABI v1 的五字段，以及 attrs 字符串、data JSON Object、replace / update / emit 分工。
- 六个 MVP 组件的职责：场景根、背景、整层地图、人物容器、人物、出口。
- `cms-map-layer` 整层批量绘制。Tile 和 Obj 不各做一个 RenderNode。
- Field Runtime 持有玩家、Foothold、Camera 和 Portal 的权威状态。视觉组件只绘制。
- Actor 跨地图稳定 key，地图专属节点使用 `sceneEpoch`。
- 构建期 Content 闭包。浏览器不读 FSDB、WZ 或本地路径。
- `tiles` / `objs` 数组，以及 `canvasZ`、放置 `zM`、放置 `z`、`flip` 和源顺序。

## 3. 已拍板的契约

### 3.1 Tile / Obj 排序

客户端已确认的键，证据在 [MAP-TILE-OBJ-SORT-REVERSE.md](../../research/result/map/MAP-TILE-OBJ-SORT-REVERSE.md)：

```text
tileKey = canvasZ + 10 * (layer * 3000 - zM) - 1073721834
objKey  = layer * 30000 + z - 1073739824
```

Tile 键使用资源画布 `z` 和放置 `zM`。Obj 键使用放置 `z`，这条路径不读 `zM`，也不读资源画布 `z`。两个常数不同。比较方向和相同键次序待逆向。Henesys 层 0 的 tile 35 与 tile 34 键相同，源顺序不能写成客户端 tie-break。

产品约定的绘制顺序保持不变，并且必须标注为产品顺序：较小 layer 先画；同层 Obj 组先于 Tile 组；Obj 按 `z` 升序；Tile 按 `canvasZ` 升序；同值保持各自数组的源顺序。`clientSortKey` 只放在 MapScenePlan 的诊断字段里，不进入 `MapLayerPlanV1`，也不改变上述绘制顺序。

四张没有画布 `z` 的 Tile Canvas 是 unsupported，归一化值保持 null，禁止写成 0：

- `Tile/greenCrystalCave.img/bsc/0`
- `Tile/blueCave2.img/bsc/0`
- `Tile/blueCave2.img/bsc/1`
- `Tile/blueCave2.img/bsc/2`

`canvasZ` 仍是 Tile asset 的必需有限数。引用上述 Canvas 的记录不能进入 `MapLayerPlanV1`。

### 3.2 Bounds

客户端已确认，证据在 [MAP-CAMERA-REVERSE.md](../../research/result/map/MAP-CAMERA-REVERSE.md)。四个 VR 都存在时：

```text
left   = VRLeft   + 400
top    = VRTop    + 300
right  = VRRight  - 400
bottom = VRBottom - 300
```

某一轴调整后的宽度或高度小于等于 0 时，该轴两边改为两端之和的有符号除以 2，向零截断，对应反汇编里的 `cdq / sub / sar`。因此 `effectiveBounds` 允许某一边相等。400 和 300 是立即数，这段函数没有读取视口尺寸。

`scenePlan.bounds` 使用 `effectiveBounds`。组件和 Field Runtime 都不再做第二次内缩。没有完整 VR 时，不套用这组立即数；回退到 minimap，再回退到 foothold 外接矩形，这是产品约定。第一批里童话村和井口四个 VR 都在，走客户端内缩。井口水平跨度是 800，左右收到同一个 x。矩形地带没有 VR，走产品回退。

轴收敛后左右或上下可以相等。这是同一组 `bounds` 字段的校验放宽，字段名和类型不变，RenderNode ABI 仍是 v1。

Camera 跟随、dead zone、world-to-screen 和 DPR 待逆向。世界像素到 CSS 像素 1:1、Camera `(x, y)` 表示视口左上角，仍是产品约定。Viewport 只提供逻辑尺寸，不提供游戏时间。`loomrealm.viewport-state/1` 仍是 Frozen / Not Implemented / Not Qualified；可以按 `Viewport` 接口设计夹取，不能把尺寸传递写成已经完成资格验收。

### 3.3 背景、帧时间和绘制锚定

客户端已确认，证据在 [MAP-BACKGROUND-REVERSE.md](../../research/result/map/MAP-BACKGROUND-REVERSE.md)：

- type 0–3 走普通分支，并把 `rx/ry` 和两个 100 交给 `+0x98`。
- type 4、6 用 `rx` 做水平滚动；type 5、7 用 `ry` 做垂直滚动。
- 滚动步长为 `step = 20000 / |rate|`。
- `front` 参与 `index * 1000` 加载键。它不参与资源选择。
- 平铺辅助里，`cx` 是水平步长，`cy` 是垂直步长。mode 的 bit0、bit1 分别重复这两个轴。步长为 0 时，背景不改用画布宽高；除数改成 1 只为了避免除零，乘回去的仍是原来的步长。
- type 0–3 交给 `+0x98` 的参数是 `(origin, 100, 100, rx, ry)`。type 4 和 6 的后两个数是 `(0, ry+100)`，type 5 和 7 是 `(rx+100, 0)`。

`+0x98` 的函数体、`0x43715C` 的时间单位，以及 `front` 键的比较方向，待逆向。

P1 的 `cms-back` 只静态绘制 type 0：使用产品锚定，不解释 `rx/ry`，不滚动。type 1–7 在支持范围闭合前是 unsupported。缺 `delay` 的帧按 ABI 停留。多帧都没有 `delay` 时，产品呈现停在第一帧；`loop: true` 不补时间。`Back/grassySoil.img/ani/0` 的 10 帧属于这种情况。P1 也不推进带有 `delay` 的帧，因为产品时钟策略和客户端时间单位都还没有落地。`delay` 数值仍原样保留。

产品绘制锚定，适用于 Tile、Obj、Back 和 Portal：

```text
drawLeft = placementX - originX
drawTop  = placementY - originY
```

`flip` 为真时，围绕放置锚点的竖线做水平镜像，绘制左边缘改为 `placementX + originX - width`。v1 没有旋转。`opacity` 是 0–255 的源整数，绘制 alpha 为 `opacity / 255`。这些是产品约定，像素测试按这条契约验收，不称为客户端公式已恢复。

### 3.4 Portal 资源

客户端已确认，证据在 [MAP-PORTAL-REVERSE.md](../../research/result/map/MAP-PORTAL-REVERSE.md)：

| pt | 资源选择 |
|---|---|
| 2、4、7 | `Map/MapHelper.img/portal/game/pv` |
| 10、11 | 实例 `image`；空值使用 `default` |
| 0、1、3、5、6、8 | 不加载 pv。`pt` 3 的使用路径仍按 `tm` 跳转，`visual` 为 `none` |
| 9、12 | 不发布 |
| 13 | 使用路径读取 `Effect/BasicEff.img/VerticalJump`，不是 pv，不发布 |

`ph` 和 `psh` 的路径已确认。`0x71B6D1` 在离开和进入时用 `pt == 10` 选择 ph，否则选择 psh。`0x71BCC8` 在已有当前传送门时固定读取 ph。它们仍不写入 `frames`。`tm == 999999999` 时使用函数直接返回。同图时 `tn` 与另一个 portal 的 `pn` 比较，并把该 portal 的 `x`、`y-10` 传给后续函数，落点写入还没有还原。跨图调用收到的是 `pn`，不是 `tm`。`(tm, tn)` 仍由 Field Runtime 做产品级目标解析；客户端同图匹配不替代这次产品协议。

原始 WZ 中有 `MapHelper.img`，818 张 Canvas。`portal/game/pv/0` 的 origin 是 `(43, 173)`，没有 `z` 和 `delay`。当前缺口是 CMS FSDB 与 PWA Content 闭包还没有这份资源。资源工作依次为：从原始 Map.wz 提取、校验 pv 与 origin 和哈希、转成 Content Resource、写入显式 allowlist、再用游戏画面验收。`portal/editor` 的 `sp/pi` 不进入 `portalPlan`。

没有可用游戏帧时不创建 `cms-portal`。逻辑 Portal Record 仍留在 MapScenePlan。`portalPlan.frames` 继续要求非空，禁止用空帧或编辑器图标充数。

### 3.5 地图切换与容量

地图切换使用一次 `domain.replace(nextRenderDomainState)`。准备完整目标状态并通过引用校验之后才调用 replace；replace 成功之后才提交 Field Runtime 的新状态。这次提交保证本地权威状态一致。协议不提供 Renderer ACK，也不保证图片已经解码，也不提供视觉失败后自动恢复旧地图。

LoomRealm Render Update v1 没有通用 `RenderNode.data` 字节上限。容量按组件测量：每个 RenderNode.data 的 compact UTF-8 字节、MapScenePlan 字节、资源闭包总字节、解码并发、峰值内存、Canvas 尺寸和资源工作集。测完再冻结 MapLayerPlan、BackPlan 和 PortalPlan 的应用层边界。

`cms-map-layer` 使用视口尺寸 Canvas，按 Camera 裁剪可见放置项。射手村 `miniMap.width` 为 7174。不把八层都做成整幅世界 Canvas，也不沿用 `cms-actor` 的 262,144 字节或合成 Canvas 上限。空间分块留到视口 Canvas 实测超预算之后。

### 3.6 Clock

固定 gitlink `93648192323bf5f57996b7b54cbae641d8a53fdb` 的 `Frame` 只有 `id`、`params`、`signal` 和 `call`。`SubsystemScope` 没有帧时间、固定步长或 Tick 订阅。PWA `MainPlatform.scheduler.schedule()` 没有暴露给 Subsystem。

运动和换图留在这次完成定义里。`libs/adventure-field` 提供 `step(state, input, dt)`。相同状态、输入和 `dt` 得到相同状态。测试和浏览器都注入步长，调用同一函数。`systems/adventure-map` 不自建 `setInterval` 或 `requestAnimationFrame`。视觉组件也不拥有第二套游戏时钟；P1 背景帧不自动推进。补算上限和暂停等待上游 Clock 评审。`info.swim` 为 0 时行走、跳跃、蹲下；为 1 时四向游泳。`Physics/default` 的数值是参数，单位待逆向。

## 4. 验收分层

| 验收 | 可以声称的内容 |
|---|---|
| 产品呈现 | 产品锚定、产品绘制顺序、type 0 静态背景、有效边界、节点数量不随 Tile/Obj 增长 |
| 产品运动 | 注入固定步长后的行走、跳跃、蹲下、游泳，以及四扇门换图。相同状态、输入和 `dt` 得到相同结果 |
| 客户端像素一致 | 比较方向、背景 `+0x98`、Camera 跟随、积分单位和帧时钟恢复之后，再用动态画面对照 |

P1 通过只表示产品呈现通过。

## 5. 实施顺序

| 阶段 | 内容 | 当前版本不包含 |
|---|---|---|
| P0 | MapScenePlanV1、三张地图闭包、引用校验、缺 `z` 与缺资源 fail closed | 浏览器绘制、物理 |
| P1 | 静态场景组件；type 0 背景；有游戏 Portal 帧才画出口 | 滚动背景、帧动画、Portal 触发 |
| P2 | 产品 Camera、effectiveBounds 夹取、Viewport resize | 把 Viewport 当成 Tick；宣称 viewport-state 已资格验收 |
| P3 | 注入步长：陆地行走、跳跃、蹲下，矩形地带游泳 | 在 Subsystem 里自建动画帧循环；宣称客户端积分已恢复 |
| P4 | 四扇门一次 `replace`：村 ↔ 井 ↔ 矩形地带 | 把本地状态提交写成全像素事务 |

## 6. 本次落点

| 文件 | 修改 |
|---|---|
| [MAP-SCENE-PLAN-V1.md](../../components/MAP-SCENE-PLAN-V1.md) | 新增闭合逻辑 schema |
| [地图场景草案](../implementation/2026-11-09-adventure-field-map-scene-design-draft.md) | Bounds、排序、背景、Portal、Tick、切换原子性和容量句子 |
| [RENDER-NODE-ABI-V1.md](../../components/RENDER-NODE-ABI-V1.md) | 说明段：锚定、bounds 来源、排序键、帧停留、容量 |
| `cms-scene-view` / `cms-back` / `cms-map-layer` / `cms-portal` DESIGN | 支持范围和证据等级 |
| [ABI 修复记录](./2026-11-09-rendernode-abi-v1-remediation.md) | 追加证据更新，避免旧阻塞项覆盖本文 |
