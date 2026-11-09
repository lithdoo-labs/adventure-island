# MapScenePlanV1

> 状态：Draft / 逻辑契约。本文是构建期 Adapter、Field Runtime 和 Bundle Builder 对一张地图的共同 schema。  
> 日期：2026-11-09  
> 呈现投影：[RENDER-NODE-ABI-V1.md](./RENDER-NODE-ABI-V1.md)  
> 修订说明：[2026-11-09 Adventure Field 设计评审修订](../docs/reviews/2026-11-09-adventure-field-design-revision.md)

MapScenePlanV1 是一张地图的运行时逻辑记录。它不是 WZ，不是 CMS 表，也不是单个 RenderNode 的 `data`。Web Component 不读取本文的记录；Render Projection 按 ABI 把它投影成 `scenePlan`、`backPlan`、`mapLayerPlan` 和 `portalPlan`。

未列出的字段不属于 v1。Validator 拒绝未知字段、错误类型、非有限数和悬空引用。禁止静默丢弃后把结果称为完整地图。

## 1. 状态词

| 状态 | 在本契约中的含义 |
|---|---|
| 客户端已确认 | 反汇编已经证明的计算，Adapter 必须按此计算 |
| 产品约定 | Adventure Island 的呈现或回退，输出里要能区分来源 |
| 待逆向 | 保留源字段，不发明公式 |
| unsupported | 不生成声称完整的 Plan；构建失败并写出诊断 |

诊断格式：

```ts
interface MapPlanDiagnosticV1 {
  readonly code: string;
  readonly severity: "unsupported";
  readonly mapId: string;
  readonly sourcePath: string;
  readonly message: string;
}
```

`code` 使用本文列出的稳定字符串。诊断写入构建报告。失败的记录不进入对外发布的 Plan。允许名单地图只要有一条绘制所需记录为 unsupported，整张 Plan 不得发布。

## 2. 文档根

```ts
interface MapScenePlanV1 {
  readonly formatVersion: 1;
  readonly mapId: string;
  readonly bounds: BoundsRecordV1;
  readonly backgrounds: readonly BackgroundRecordV1[];
  readonly layers: readonly MapLayerRecordV1[];
  readonly footholds: readonly FootholdRecordV1[];
  readonly portals: readonly PortalRecordV1[];
}

interface LogicalResourceRefV1 {
  readonly namespace: string;
  readonly key: string;
  readonly contentVersion: string; // ^sha256:[0-9a-f]{64}$
}
```

- `mapId` 是地图编号字符串，与 `cms-scene-view.attrs.map` 相同。
- 每个实际绘制资源都使用 `LogicalResourceRefV1`。禁止 URL、WZ 路径、FSDB 路径和私有 locator。
- 资源必须属于本次显式闭包。缺失、版本冲突、MIME 不符或解码尺寸不符时，code 为 `resource-unresolved`。
- 数组顺序是源顺序。各记录的 `sourceOrder` 是该数组中的下标，从 0 开始，投影时不得重排这些数组。绘制顺序由投影方按产品规则另算。

## 3. Bounds

```ts
interface BoundsV1 {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

interface BoundsRecordV1 {
  readonly source: "vr" | "minimap" | "foothold";
  readonly adjustment: "client-vr-inset" | "product-fallback";
  readonly sourceBounds: BoundsV1;
  readonly effectiveBounds: BoundsV1;
}
```

四个 VR 都是有限数时，`source` 为 `"vr"`，`adjustment` 为 `"client-vr-inset"`。`sourceBounds` 是原始 VR。`effectiveBounds` 按客户端已确认的公式：

```text
left   = VRLeft   + 400
top    = VRTop    + 300
right  = VRRight  - 400
bottom = VRBottom - 300
```

若 `right - left <= 0`，左右都改为 `(left + right)` 的有符号除以 2，向零截断。上下同理，使用调整后的 top 与 bottom。400 和 300 只在这条 VR 路径使用。

VR 不完整时不调用上述公式。接下来：

1. `miniMap` 的 `width/height/centerX/centerY` 四项齐全时，`source` 为 `"minimap"`。`sourceBounds` 与 `effectiveBounds` 相同：`left = -centerX`，`top = -centerY`，`right = width - centerX`，`bottom = height - centerY`。
2. 否则用全部 foothold 的外接矩形，左右各扩 10、上扩 360、下扩 110，`source` 为 `"foothold"`。两项 bounds 仍然相同。
3. 两条产品回退都不可用时，code 为 `bounds-unavailable`。

产品回退的 `adjustment` 为 `"product-fallback"`。`effectiveBounds` 要求 `right >= left` 且 `bottom >= top`。相等只出现在 VR 轴收敛之后，表示该轴收成一个坐标。

投影：`scenePlan.bounds` 等于 `effectiveBounds`。组件不再次内缩。`source`、`adjustment` 和 `sourceBounds` 不进入 RenderNode。

第一批里，`222000000` 和 `222000001` 四个 VR 都在，走 `client-vr-inset`。井口 VR 宽 800，左右内缩后收到同一个 x。`230030200` 没有四个 VR，走产品回退。`100000000` 与 `100000100` 同样没有 VR，它们不在这次闭包里。

Camera 跟随、dead zone 和 world-to-screen 不属于本记录。产品 Camera 使用视口左上角世界坐标，世界像素与 CSS 像素 1:1，夹取范围是 `effectiveBounds`。

## 4. 背景

```ts
interface BackgroundFrameV1 {
  readonly delay?: number;
  readonly resource: LogicalResourceRefV1;
  readonly source?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly width: number;
  readonly height: number;
  readonly origin: readonly [number, number];
}

interface BackgroundRecordV1 {
  readonly sourceOrder: number;
  readonly front: number;
  readonly backSet: string;
  readonly index: string;
  readonly animation: string;
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
  readonly type: number;
  readonly cx: number;
  readonly cy: number;
  readonly flip: boolean;
  readonly opacity: number;
  readonly frames: readonly BackgroundFrameV1[];
  readonly presentation: "static-type0";
}
```

源字段映射：`bS → backSet`，`no → index`，`ani → animation`，`f → flip`，`a → opacity`。`rx/ry/type/cx/cy/front` 原样保留为有限数。`opacity` 必须是 0 到 255 的整数。`frames` 非空，几何约束与 ABI `RasterFrameV1` 相同。缺 `delay` 就省略该字段，不补 0。

P1 只接受 `type === 0` 且 `presentation === "static-type0"`。type 1–7 的 code 为 `background-type-unsupported`。滚动步长 `20000 / |rate|` 已由客户端确认，但 `+0x98` 函数体未恢复，所以这些 type 不进入可发布 Plan。

`front` 只决定投影到远景段还是近景段：0 为远景，1 为近景。其他值的 code 为 `background-front-unsupported`。比较方向待逆向，产品树顺序仍是远景、地图层、人物、出口、近景。

多帧里只要有一帧缺少 `delay`，投影出的 `backPlan.loop` 为 false，组件停在第一帧。全部帧都有 `delay` 时，数值保留，`loop` 仍为 false，直到产品时钟策略和客户端时间单位同时落地。`loop: true` 不表示自动播放。`Back/grassySoil.img/ani/0` 的 10 帧没有 `delay`，若被引用，按第一帧静态呈现。

## 5. 地图层

```ts
interface MapAssetV1 {
  readonly id: string;
  readonly kind: "tile" | "obj";
  readonly resource: LogicalResourceRefV1;
  readonly source?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly width: number;
  readonly height: number;
  readonly origin: readonly [number, number];
  readonly canvasZ?: number;
}

interface TileRecordV1 {
  readonly sourceOrder: number;
  readonly assetId: string;
  readonly x: number;
  readonly y: number;
  readonly zM: number;
  readonly clientSortKey: number;
}

interface ObjRecordV1 {
  readonly sourceOrder: number;
  readonly assetId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly zM: number;
  readonly flip: boolean;
  readonly clientSortKey: number;
}

interface MapLayerRecordV1 {
  readonly layer: "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7";
  readonly tileSet?: string;
  readonly assets: readonly MapAssetV1[];
  readonly tiles: readonly TileRecordV1[];
  readonly objs: readonly ObjRecordV1[];
}
```

空层不写入 `layers`。有 Tile 的层必须带 `tileSet`。`assets.id` 在本层唯一，每个 asset 至少被引用一次。Tile 只引用 `kind: "tile"`，Obj 只引用 `kind: "obj"`。

Tile asset 的 `canvasZ` 是画布 `z`，必须是有限数。Obj asset 不得带 `canvasZ`。下面四张 Canvas 没有 `z`，引用它们的 code 为 `tile-canvas-z-absent`，不得把 `canvasZ` 写成 0：

- `Tile/greenCrystalCave.img/bsc/0`
- `Tile/blueCave2.img/bsc/0`
- `Tile/blueCave2.img/bsc/1`
- `Tile/blueCave2.img/bsc/2`

诊断键按客户端已确认的公式计算，使用该层的层号整数：

```text
tileKey = canvasZ + 10 * (layer * 3000 - zM) - 1073721834
objKey  = layer * 30000 + z - 1073739824
```

`clientSortKey` 不参与产品绘制，也不投影进 `MapLayerPlanV1`。产品绘制顺序是：Obj 按 `z` 升序，同值按 `sourceOrder`；然后 Tile 按 `canvasZ` 升序，同值按 `sourceOrder`。层在场景树里按 0 到 7 排列。比较方向和相同键次序待逆向。

源 `r` 缺省或为 0 时不进入视觉记录。`r` 为其他值，或存在 `flow` 时，code 为 `obj-visual-field-unsupported`。`reactor` 和 `name` 不进入本层；它们留给以后的逻辑记录，不从 Obj 推断点击目标。

## 6. Foothold

```ts
interface FootholdRecordV1 {
  readonly sourceOrder: number;
  readonly layer: number;
  readonly platform: number;
  readonly id: number;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly prev?: number;
  readonly next?: number;
  readonly force?: number;
  readonly forbidFallDown?: number;
}
```

`id` 在本 Plan 内唯一。`x1/y1/x2/y2` 是有限数。`prev` 或 `next` 缺省表示该方向没有连接。字段存在时必须是有限整数，并且指向本 Plan 内的 `id`。无法解析的引用，code 为 `foothold-link-unresolved`。不把未知哨兵改写成 0。

`force` 和 `forbidFallDown` 原样保留。客户端语义待逆向，第一版运动不得按字段名猜测。垂直段 `x1 === x2` 保留在记录中；把它当成可站立地面是 unsupported，code 为 `foothold-vertical-unsupported`，只有运动阶段启用该段时才触发。静态 Plan 可以收录垂直段。

调试投影只带 `x1/y1/x2/y2`。`prev/next/force/forbidFallDown` 留在 Field Runtime。

## 7. Portal

```ts
interface PortalFrameV1 {
  readonly delay?: number;
  readonly resource: LogicalResourceRefV1;
  readonly source?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly width: number;
  readonly height: number;
  readonly origin: readonly [number, number];
}

interface PortalRecordV1 {
  readonly sourceOrder: number;
  readonly name: string;
  readonly type: number;
  readonly x: number;
  readonly y: number;
  readonly targetMap: number;
  readonly targetName: string;
  readonly script?: string;
  readonly triggerDelay?: number;
  readonly onlyOnce?: boolean;
  readonly hideTooltip?: boolean;
  readonly hRange?: number;
  readonly vRange?: number;
  readonly image?: string;
  readonly visual: "pv" | "image" | "none";
  readonly frames?: readonly PortalFrameV1[];
  readonly enabled: boolean;
}
```

源字段映射：`pn → name`，`pt → type`，`tm → targetMap`，`tn → targetName`，源 `delay → triggerDelay`。`triggerDelay` 是出口触发参数，不是帧 `delay`。`onlyOnce` 和 `hideTooltip` 只接受源 0/1，并编成布尔；其他值的 code 为 `portal-flag-unsupported`。

`visual` 按客户端已确认的资源分支：

| type | visual | 帧来源 |
|---|---|---|
| 2、4、7 | `pv` | `Map/MapHelper.img/portal/game/pv` |
| 10、11 | `image` | 实例 `image`；空字符串使用 `default` |
| 0、1、3、5、6、8 | `none` | 不加载 pv，省略 `frames`。`pt` 3 的使用路径仍按 `tm` 跳转 |
| 9、12、13 | 不发布 | code `portal-visual-unsupported`。`pt` 13 的使用路径另读 `Effect/BasicEff.img/VerticalJump` |

离开和进入时 `pt == 10` 选择 `ph`，否则选择 `psh`。已有当前传送门的更新路径固定读取 `ph`。二者都不写入 `frames`。`frames` 缺 `delay` 时省略该字段。`pv/0` 只有 origin `(43, 173)`，没有 `z` 和 `delay`，因此有帧时也停在第一帧。

`visual` 不是 `"none"` 但 Content 闭包没有对应游戏帧时，code 为 `portal-resource-absent`。禁止用 `portal/editor` 的 `sp/pi` 填充。`visual: "none"` 的记录保留逻辑字段，不投影 `cms-portal`。有非空 `frames` 时才投影，`portalPlan.loop` 为 false。

`enabled` 是产品开关。本次闭包启用四条连接：`222000000/in00 → 222000001/st00`，`222000001/out00 → 222000000/in00`，`222000001/sea00 → 230030200/east00`，`230030200/east00 → 222000001/sea00`。这四条都没有源 `hRange` / `vRange`。Field Runtime 按客户端缺省 100 做命中，半幅是 50，不把 100 写回本记录。`222000001/st00` 的 `tm` 是 `999999999`，`230030200/west00` 指向闭包外，二者 `enabled` 为 false。目标不在闭包内或目标名不存在时同样为 false。客户端同图匹配是 `tn` 对上另一个 portal 的 `pn`；跨图调用收到 `pn`，目标地图写入仍待逆向。`(tm, tn)` 继续由 Field Runtime 做产品级目标解析。跳转命中的客户端范围是 `x±hRange/2`、`y±vRange/2`，由 Field Runtime 使用，不放进视觉组件。

## 8. 投影边界

| MapScenePlan 字段 | RenderNode | 不投影的内容 |
|---|---|---|
| `bounds.effectiveBounds` | `scenePlan.bounds` | `sourceBounds`、`source`、`adjustment` |
| `backgrounds` | 每个记录一个 `cms-back` | `front` 只决定 children 分段；P1 `loop` 为 false |
| `layers` | 每个非空层一个 `cms-map-layer` | `clientSortKey`、`sourceOrder` |
| `footholds` | 可选 `scenePlan.debug.footholds` | 链接、force、forbidFallDown |
| `portals` 中有帧的记录 | `cms-portal` | `targetMap`、`targetName`、脚本、触发和 `enabled` |

产品锚定由组件执行：`drawLeft = x - originX`，`drawTop = y - originY`。水平镜像围绕放置锚点。绘制 alpha 为 `opacity / 255`。v1 不旋转。

地图切换准备下一份完整 Plan 和投影树，校验通过后一次 `replace`。replace 成功后 Field Runtime 才提交新状态。

## 9. 版本

- 当前只有 `formatVersion: 1`。
- 改变字段含义、Bounds 公式、诊断键公式或 `visual` 分支，必须增加主版本并另写契约。
- 2026-11-09 目标修订把 `type` 3 从 `portal-visual-unsupported` 改到 `visual: "none"`。存储联合类型不变，不升主版本。9、12、13 仍不发布。
- 新增可选诊断字段而绘制结果不变时，仍须先改本文，再改 Adapter。Validator 在文档更新前拒绝未知字段。
- RenderNode ABI 的数据结构不随本文的诊断字段一起扩展。

## 10. 容量

本记录单独测量 compact UTF-8 字节和闭包总字节。测量结果不写成 LoomRealm 协议上限。`cms-map-layer` 的画布策略在该组件 DESIGN 中规定，不把整幅世界位图放进 Plan。
