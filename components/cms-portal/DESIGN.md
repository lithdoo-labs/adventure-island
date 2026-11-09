# cms-portal

> 公共 RenderNode attrs/data/children ABI 以 [RENDER-NODE-ABI-V1.md](../RENDER-NODE-ABI-V1.md) 为准；本文记录 Portal 样本、资源缺口和逻辑边界。

一个可见出口。同一层里的多个出口彼此并列，不互相嵌套。

## 在树中的位置

当前产品树把 Portal 放在 `cms-avatar-layer` 之后、近景 `cms-back` 之前。该相对绘制顺序来自 Task 023 / HaCreator 合成器，尚无客户端 Portal/Field 绘制函数证明。

## 运行库交给它的数据

| ABI attrs | 源字段 | 含义 |
|---|---|---|
| `portal-name` | `pn` | 出口名字，如 `out00` |
| `portal-type` | `pt` | 类型，十进制字符串 |
| `x` / `y` | `x` / `y` | 世界坐标 |
| `flip` | 无 | 可选产品属性，缺省 "false"；99 个样本均没有源 `f` |
| `hide-tooltip` | `hideTooltip` | 可选，字符串 "true"/"false" |

`data` 的唯一顶层成员是 `portalPlan`，结构为 `{ formatVersion: 1, loop, frames }`。每帧包含可选非负毫秒 `delay`、逻辑资源引用（namespace/key/contentVersion）、Canvas 宽高、origin 和可选 source rectangle。Adapter 必须预解析画面资源；组件不按 `pt` 自行拼接 WZ 路径，也不读取 FSDB。

## 样本与类型判断

当前审计覆盖 21 张实质地图中的 99 个 Portal：

| pt | 样本数 | 有真实目标 `tm` |
|---|---:|---:|
| 0 | 56 | 0 |
| 1 | 20 | 15 |
| 2 | 16 | 16 |
| 7 | 7 | 0 |

类型 2 的 16/16 样本都有真实目标图；类型 1 的 20 个样本中也有 15 个携带真实目标图，包括跨图和同图目标。因此「只有类型 2 可跳转」是错误的排他结论。v1 第一阶段暂时只把类型 2 作为视觉试验子集，不限制 Field Runtime 保存和处理类型 1 的 Portal Record。

历史研究笔记曾把游戏动画定位到 `MapHelper.img/portal/game`，并提到 `pv/ph/psh`；当前提取结果和 FSDB 中没有 MapHelper，故目录、帧、origin 以及 `pt` 到资源的映射均为 UNVERIFIED。WzComparerR2 的类型表是第三方实现，不是这套客户端的证据。Task 023 合成器使用 `portal/editor` 图标；它们是编辑器标记，绝不能冒充游戏画面。

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

每张合成场景可以放一个类型 2 的 Portal 作为视觉试验。场景 A 的逻辑出口可指向场景 B 的落点，B 的逻辑出口可指回 A；真实游戏画面尚未提取前，不得把 editor 图标当成通过验收的 PortalPlan。

## 不做什么

- 不发送 `CHANGE_MAP`；地图切换由 Field Runtime 决定。
- 不画类型 0 的出生点，也不画 `portal/editor` 编辑器图标。
- 第一阶段只验证类型 2 的数据和视觉资源路径；不宣称它是唯一可跳转类型。
