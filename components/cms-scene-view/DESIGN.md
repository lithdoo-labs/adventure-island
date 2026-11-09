# cms-scene-view

> 公共 RenderNode attrs/data/children ABI 以 [RENDER-NODE-ABI-V1.md](../RENDER-NODE-ABI-V1.md) 为准。边界计算以 [MAP-SCENE-PLAN-V1.md](../MAP-SCENE-PLAN-V1.md) 为准。

场景根。只提供 Camera 呈现值和场景边界，不把远景、地图层、人物或出口画进自己的像素里。

## Camera 与场景边界

三件事分开记录：

| 事项 | 状态 |
|---|---|
| VR 调整后的 `effectiveBounds` | 客户端已确认。左右各收 400，上下各收 300；轴宽或轴高小于等于 0 时收到向零截断的中点 |
| Camera `(x, y)`、Y 轴向下、无 zoom、世界像素与 CSS 像素 1:1 | 产品约定 |
| 跟随、dead zone、world-to-screen、DPR | 待逆向 |

400 和 300 是函数立即数。组件不读取视口尺寸来重做这组内缩，也不把视口写成 800×600。

`scenePlan.bounds` 已经是 `effectiveBounds`。本组件只使用它做夹取，不再加一次 400 或 300。没有完整 VR 时，Plan 里的边界来自产品回退：先 minimap，再 foothold 外接矩形。第一批里，`222000000` 和 `222000001` 四个 VR 都在，走客户端内缩。井口水平跨度是 800，左右收到同一个 x。`230030200` 没有四个 VR，走产品回退。全库 3308 张地图带有四个 VR 字段；这不是“每张图都有 VR”。

地图比视口小时的客户端摆放待逆向。产品可以居中留白，并在验收里标明这是产品约定。Viewport 只提供逻辑尺寸。`loomrealm.viewport-state/1` 仍未完成资格验收，尺寸传递要单独测试。Viewport 不是游戏时钟。

`info/link` 的历史全库数量在当前工作区不可复查；本次 21 张实质地图样本中没有 `link`。在 XML/CSV 恢复前，不得依赖历史全库计数来推导链接地图行为。

## 子元素顺序

当前产品树顺序参考 Task 023 / HaCreator 合成器。客户端加载键已经恢复，比较方向待逆向，所以这段顺序仍是产品约定：

1. `front=0` 的 `cms-back`
2. `cms-map-layer`，从 0 到 7
3. `cms-avatar-layer`
4. `cms-portal`
5. `front=1` 的 `cms-back`

没有内容的层不创建元素。当前树无法表达 Actor 在同层 Obj 之间按 `zM` 穿插；该能力在客户端算法确认前保持未实现。

## 运行库交给它的数据

| 字段 | 放在 | 值 | 含义 |
|---|---|---|---|
| `map` | `attrs` | 地图编号字符串 | 当前场景 |
| `x` / `y` | `attrs` | 十进制字符串 | v1 产品 Camera 左上角世界坐标 |
| `scenePlan` | `data` | `{ formatVersion: 1, bounds, debug? }` | 场景边界和可选调试几何 |

`data` 的唯一顶层成员是 `scenePlan`。其中 `bounds` 为 `{ left, top, right, bottom }`，等于 Plan 的 `effectiveBounds`。VR 轴收敛后允许左右相等或上下相等。可选 `debug.footholds` 为 `{ x1, y1, x2, y2 }` 数组，`debug.ropes` 为 `{ x, y1, y2, l }` 数组。正式运行默认省略 `debug`，或使用空数组。`sourceBounds` 不进入本组件。完整字段和校验规则见公共 ABI。

Foothold / Rope 样本仅覆盖 21 张实质地图：2,110 段 foothold 和 118 条 ladder/rope。该样本未出现 `force`、`forbidFallDown`；它们的全库出现率尚不可复查。Foothold 的 `prev/next` 和 Rope 的 `uf/page` 留给移动系统，不因为 debug 绘制而成为组件权威状态。

`bgm`、`swim`、`fly`、`fieldLimit`、进图脚本、`cloud/rain/snow` 和 `miniMap` 画布不进入这个视觉根；它们是否改变可移动区域或其他运行时规则，由 Field Runtime 负责。

换场景时更新 `map/x/y` 和完整 `scenePlan`，并替换远景、地图层和出口。`cms-avatar-layer` 与 `cms-actor` 保留原 key；人物元素留在原容器中，只更新到目标地图落点。

## 第一阶段

两张静态场景。根元素使用各自的 `effectiveBounds` 和产品 Camera。换图、落点和跟随不在本组件的第一阶段验收里。Viewport resize 只改变夹取，不改写玩家世界坐标。

## 不做什么

- 不判断人物是否碰到出口。
- 不把 foothold 或绳梯做成正式画面子元素；可选 debug 仅供诊断。
- 不读取客户端文件。素材由本地导入后的 Content 提供。
