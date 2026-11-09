# cms-portal

> 公共 RenderNode attrs/data/children ABI 以 [RENDER-NODE-ABI-V1.md](../RENDER-NODE-ABI-V1.md) 为准；本文记录 Portal 源数据、画面来源和逻辑边界。

一个可见出口。同一层里的多个出口彼此并列，不互相嵌套。

## 在树中的位置

`cms-avatar-layer` 之后，`front=1` 的 `cms-back` 之前。来源是地图节点 `portal`。Task 023 在生命体和反应堆之后画传送门，再画近景。

## 运行库交给它的数据

视觉节点的公共 attrs：

| ABI attrs | 源字段 | 含义 |
|---|---|---|
| `portal-name` | `pn` | 出口名字，如 `out00` |
| `portal-type` | `pt` | 类型，十进制字符串 |
| `x` / `y` | `x` / `y` | 世界坐标 |
| `flip` | `f` | 翻转，字符串 `"true"/"false"` |
| `hide-tooltip` | `hideTooltip` | 可选，字符串 `"true"/"false"` |

`data` 的唯一顶层成员是 `portalPlan`，结构为 `{ formatVersion: 1, loop, frames }`。每帧包含可选毫秒 `delay`、逻辑资源引用（namespace/key/contentVersion）、Canvas 宽高、origin 和可选 source rectangle。Adapter 必须预解析画面资源；组件不按 `pt` 自行拼接 WZ 路径，也不读取 FSDB。

以下源字段属于 Portal Record / Field Runtime，不属于视觉组件：

| 源字段 | 逻辑用途 |
|---|---|
| `tm` | 目标地图；`999999999` 表示没有地图跳转 |
| `tn` | 目标落点名字 |
| `script` | 脚本路由标识 |
| `delay` | 触发冷却/延迟语义，待运行库解释 |
| `onlyOnce` | 一次性触发规则 |
| `hRange` / `vRange` | 触发范围参数；没有时的默认判定仍需还原 |

这些字段必须保留在 MapScenePlan 的逻辑 Portal Record 中，由 Field Runtime 决定是否触发和如何换图。不得放入 `cms-portal.attrs/data`，也不得让 Web Component 自己切换地图。

节点上还能出现 `image`、`horizontalImpact` 等来源字段。未确认语义的字段保留在导入/诊断数据中，不自动扩展 v1 视觉 ABI。

游戏动画来源的历史研究记录：

- 游戏动画曾定位于 `MapHelper.img/portal/game`，包含 `pv`、`ph`、`psh` 三个目录；帧的 `origin` 对准 Portal 的 `x/y`。
- 编辑器图标位于 `portal/editor`，画布顺序为 `sp`、`pi`、`pv`、`pc`、`pg`、`tp`、`ps`、`pgi`、`psi`、`pcs`、`ph`、`psh`、`pcj`。这些是编辑器标记，不是游戏画面。
- 全库类型数量：0 有 8916，1 有 3119，2 有 1962，3 有 1296，7 有 1439，8 有 628，9 有 516，6 有 219，10 有 206，其余类型不到 20。类型 0 是出生点，不创建 `cms-portal`。
- 当前设计只启用类型 2，历史合成使用 `pv` 画面；其他 `pt` 与 `ph/psh` 的映射仍需函数证据确认。

当前仓库的 `[resource]图` 没有 `MapHelper` 目录，因此上述游戏动画资源尚未进入可验证的 Content closure。PortalPlan 的实际资源引用仍是阻塞项；不得用 `portal/editor` 图标冒充游戏画面。

## 第一阶段

每张合成场景一个类型 2 的出口。场景 A 的出口指向场景 B 的落点，B 的出口指回 A。

人走到出口上之后，由地图运行库切换场景。这个元素把 `pv` 画在出口坐标上。没有 `hRange` / `vRange` 的出口，走进判定用的矩形还没从函数对上。

这是第一阶段唯一接输入的地图交互。NPC 对话、反应堆和座位见同目录下的 `cms-npc`、`cms-reactor`、`cms-seat`，第一阶段不放进树。

## 不做什么

- 不发送 `CHANGE_MAP`。旧封包不是运行时。
- 不画类型 0 的出生点，也不画 `portal/editor` 的编辑器图标。
- 第一阶段只挂类型 2。
