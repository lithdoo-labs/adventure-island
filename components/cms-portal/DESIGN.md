# cms-portal

> 公共 RenderNode attrs/data/children ABI 以 [RENDER-NODE-ABI-V1.md](../RENDER-NODE-ABI-V1.md) 为准。逻辑记录和资源分支以 [MAP-SCENE-PLAN-V1.md](../MAP-SCENE-PLAN-V1.md) 为准。

一个可见出口。同一层里的多个出口彼此并列，不互相嵌套。

## 在树中的位置

当前产品树把 Portal 放在 `cms-avatar-layer` 之后、近景 `cms-back` 之前。这是产品约定。客户端 Portal 与地图层的比较方向待逆向。

## 运行库交给它的数据

| ABI attrs | 源字段 | 含义 |
|---|---|---|
| `portal-name` | `pn` | 出口名字，如 `out00` |
| `portal-type` | `pt` | 类型，十进制字符串 |
| `x` / `y` | `x` / `y` | 世界坐标 |
| `flip` | 无 | 可选产品属性，缺省 "false"；99 个样本均没有源 `f` |
| `hide-tooltip` | `hideTooltip` | 可选，字符串 "true"/"false" |

`data` 的唯一顶层成员是 `portalPlan`，结构为 `{ formatVersion: 1, loop, frames }`。每帧包含可选非负毫秒 `delay`、逻辑资源引用、Canvas 宽高、origin 和可选 source rectangle。缺 `delay` 就停留，不补 0。P1 的 `loop` 为 false，组件不自建时钟。Adapter 预解析画面资源；组件不按 `pt` 拼接路径，也不读取 FSDB。没有游戏帧时不创建本节点。

## 样本与类型判断

当前审计覆盖 21 张实质地图中的 99 个 Portal：

| pt | 样本数 | 有真实目标 `tm` |
|---|---:|---:|
| 0 | 56 | 0 |
| 1 | 20 | 15 |
| 2 | 16 | 16 |
| 7 | 7 | 0 |

类型 2 的 16/16 样本都有真实目标图；类型 1 的 20 个样本中也有 15 个携带真实目标图，包括跨图和同图目标。因此「只有类型 2 可跳转」是错误的排他结论。类型 2 只是当前有 pv 画面的试验子集。Field Runtime 仍保存类型 1 的逻辑记录；类型 1 不加载 pv。

客户端资源分支已经确认：

| pt | 资源 |
|---|---|
| 2、4、7 | `Map/MapHelper.img/portal/game/pv` |
| 10、11 | 实例 `image`；空值使用 `default` |
| 3、9、12、13 | 其他分支，不能写成 pv。当前是 unsupported |
| 0、1、5、6、8 | 不加载 pv，不创建视觉节点 |

`ph` 和 `psh` 的路径已确认，它们与 `pt` 的对应仍待逆向，不写入 `frames`。`pv/0` 的 origin 是 `(43, 173)`，没有 `z` 和 `delay`。原始 WZ 有 `MapHelper.img` 的 818 张 Canvas。当前 CMS FSDB 和 PWA Content 闭包还没有这份资源。提取、校验、转成 Content Resource 并进入 allowlist 之前，不创建 `cms-portal`。`portal/editor` 的 `sp/pi` 不进入 `frames`。

`tm` 和 `tn` 在实例加载函数里被读取。跳转匹配函数待逆向，所以 `(tm, tn)` 是产品级目标解析，由 Field Runtime 持有。

以下源字段属于 Portal Record / Field Runtime，不属于视觉组件：

| 源字段 | 逻辑用途 |
|---|---|
| `tm` | 目标地图；样本中的 `999999999` 是无地图跳转哨兵 |
| `tn` | 目标落点名字 |
| `script` | 脚本路由标识 |
| `delay` | 触发冷却/延迟语义，待运行库解释 |
| `onlyOnce` | 一次性触发规则 |
| `hRange` / `vRange` | 触发范围参数；默认判定仍需还原 |

这些字段必须保留在 MapScenePlan 的逻辑 Portal Record 中，由 Field Runtime 决定是否触发和如何换图。不得放入 `cms-portal.attrs/data`，也不得让 Web Component 自己切换地图。

## 第一阶段

逻辑出口保留在 MapScenePlan。`100000000/in00` 与 `100000100/out00` 可以互相作为产品级目标。游戏帧进入 Content 闭包之后，才为 `visual: "pv"` 且帧非空的记录创建本组件。画面验收使用真实 pv，停在缺 `delay` 的第一帧。编辑器图标和无贴图标记都不算通过。

## 不做什么

- 不发送 `CHANGE_MAP`；地图切换由 Field Runtime 用一次 `replace` 提交本地状态。
- 不按 `pt` 自行选择资源，不画类型 0 的出生点，也不画 `portal/editor`。
- 不把类型 2 写成唯一可跳转类型。类型 1 有逻辑目标，没有 pv 画面。
