# cms-scene-view

> 公共 RenderNode attrs/data/children ABI 以 [RENDER-NODE-ABI-V1.md](../RENDER-NODE-ABI-V1.md) 为准；本文区分产品 Camera 约定、样本字段和客户端未验证项。

场景根。只提供 Camera 呈现值和场景边界，不把远景、地图层、人物或出口画进自己的像素里。

## Camera 与场景边界

Camera 的权威决策、跟随、缩放和边界夹取由 Field Runtime 持有。v1 产品约定使用左上角世界坐标、Y 轴向下、不提供 zoom，并按 1:1 世界像素到 CSS 像素映射；原始客户端 Camera 变换尚未找到对应函数，因此这些是产品约定，不是逆向确认。

边界优先采用地图 `info` 中完整且有效的 `VRLeft/VRTop/VRRight/VRBottom`。没有 VR 时，当前产品回退算法参考 Task 023 合成器：先尝试 `miniMap` 中心/尺寸，再尝试 foothold 外接矩形。该回退算法没有客户端函数证据，不得写成游戏客户端行为。当前审计 21 张实质地图中，14 张有完整 VR；这不是全库统计。

`info/link` 的历史全库数量在当前工作区不可复查；本次 21 张实质地图样本中没有 `link`。在 XML/CSV 恢复前，不得依赖历史全库计数来推导链接地图行为。

## 子元素顺序

当前产品树顺序参考 Task 023 / HaCreator 合成器，客户端顺序未验证：

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

`data` 的唯一顶层成员是 `scenePlan`。其中 `bounds` 为 `{ left, top, right, bottom }`；可选 `debug.footholds` 为 `{ x1, y1, x2, y2 }` 数组，`debug.ropes` 为 `{ x, y1, y2, l }` 数组。正式运行默认省略 `debug`，或使用空数组。完整字段和校验规则见公共 ABI。

Foothold / Rope 样本仅覆盖 21 张实质地图：2,110 段 foothold 和 118 条 ladder/rope。该样本未出现 `force`、`forbidFallDown`；它们的全库出现率尚不可复查。Foothold 的 `prev/next` 和 Rope 的 `uf/page` 留给移动系统，不因为 debug 绘制而成为组件权威状态。

`bgm`、`swim`、`fly`、`fieldLimit`、进图脚本、`cloud/rain/snow` 和 `miniMap` 画布不进入这个视觉根；它们是否改变可移动区域或其他运行时规则，由 Field Runtime 负责。

换场景时更新 `map/x/y` 和完整 `scenePlan`，并替换远景、地图层和出口。`cms-avatar-layer` 与 `cms-actor` 保留原 key；人物元素留在原容器中，只更新到目标地图落点。

## 第一阶段

两张合成场景。从场景 A 的出口进入场景 B 后，根元素换成 B 的边界、Camera 呈现值和子元素，人物出现在 B 的落点。这是产品流程测试，不是原始客户端 Camera/地图切换验收。

## 不做什么

- 不判断人物是否碰到出口。
- 不把 foothold 或绳梯做成正式画面子元素；可选 debug 仅供诊断。
- 不读取客户端文件。素材由本地导入后的 Content 提供。
