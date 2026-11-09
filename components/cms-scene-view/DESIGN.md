# cms-scene-view

> 公共 RenderNode attrs/data/children ABI 以 [RENDER-NODE-ABI-V1.md](../RENDER-NODE-ABI-V1.md) 为准；本文记录地图来源语义和组件职责。

场景根。对应 LoomRealm 渲染树里的根节点，职责接近 `lr-map-view`，几何是像素场景，不是格子地图。

## 画什么

只提供镜头和场景范围，不把远景、地图层、人物、出口画进自己的像素里。那些是子元素。

镜头跟着人物，并限制在场景边界内。边界来自地图的 VR；没有 VR 时，Task 023 的合成器用小地图或立足线外接矩形推导。

## 子元素顺序

顺序就是绘制顺序，不能打乱：

1. `front=0` 的 `cms-back`
2. `cms-map-layer`，从 0 到 7
3. `cms-avatar-layer`
4. `cms-portal`
5. `front=1` 的 `cms-back`

没有内容的层不创建元素。

## 运行库交给它的数据

公共 ABI：

| 字段 | 放在 | 值 | 含义 |
|---|---|---|---|
| `map` | `attrs` | 地图编号字符串 | 当前场景 |
| `x` / `y` | `attrs` | 十进制字符串 | Camera 视口左上角的世界坐标 |
| `scenePlan` | `data` | `{ formatVersion: 1, bounds, debug? }` | 场景边界和可选调试几何 |

`data` 的唯一顶层成员是 `scenePlan`。其中 `bounds` 为 `{ left, top, right, bottom }`；可选 `debug.footholds` 为 `{ x1, y1, x2, y2 }` 数组，`debug.ropes` 为 `{ x, y1, y2, l }` 数组。正式运行默认省略 `debug`，或使用空数组。完整字段和校验规则见公共 ABI。

边界由运行库算好再交，算法来自 Task 023 的合成器：

1. `info` 里 `VRLeft`、`VRTop`、`VRRight`、`VRBottom` 四项都在，并且右边大于左边、下边大于上边。这四项各出现在 3308 张图上。
2. 否则用 `miniMap` 的 `width`、`height`、`centerX`、`centerY`。左和上取中心的相反数，右是宽减中心横坐标，下是高减中心纵坐标。
3. 再没有，用立足线的外接矩形，左右各扩 10，上扩 360，下扩 110。

`info/link` 有值时，远景、地图层和出口来自被指的那张图，`map` 仍是当前编号。这样的图有 1152 张。

立足线段上的 `prev`、`next`、`force`、`forbidFallDown` 留给移动。359,124 段里 363 段 `force` 非 0，383 段 `forbidFallDown` 非 0。绳子上的 `uf`、`page` 同样留给移动。全库 10,612 条绳子或梯子。

`bgm`、`swim`、`fly`、`fieldLimit`、进图脚本、`cloud` / `rain` / `snow` 和 `miniMap` 的画布不进这个元素。

换场景时更新 `map/x/y` 和完整 `scenePlan`，并替换远景、地图层和出口。`cms-avatar-layer` 与 `cms-actor` 保留原 key；人物元素留在原容器中，只更新到目标地图落点。

## 第一阶段

两张合成场景。从场景 A 的出口进入场景 B 后，根元素换成 B 的边界、镜头和子元素，人物出现在 B 的落点。

## 不做什么

- 不判断人物是否碰到出口。
- 不把立足线或绳梯做成子元素。合成器把它们标成编辑辅助线。
- 不读取客户端文件。素材由本地导入后的 Content 提供。
