# cms-npc

> **状态：Future / ABI 未冻结。** 本文是来源与职责草案；`cms-npc` 不属于 [RENDER-NODE-ABI-V1.md](../RENDER-NODE-ABI-V1.md) 的 MVP 标签契约。实现前必须单独冻结 attrs/data/events schema。

一个可对话的 NPC。数据来自地图节点 `life` 里 `type=n` 的条目。`type=m` 是怪物，不是这个元素。

## 在树中的位置

八层 `cms-map-layer` 之后、`cms-reactor` 之前。Task 023 先画完全部地图层，再画怪物，然后画 NPC。第一阶段不放进树。

## 运行库交给它的数据

`life` 里 `type=n` 的字段都是单个值，写成属性。`data` 是空对象。全库 3174 个 NPC。

| 字段 | 放在 | 含义 |
|---|---|---|
| `id` | `attrs` | `Npc.wz` 里的形象编号，如 `1012000` |
| `x` / `y` | `attrs` | 位置 |
| `cy` | `attrs` | 脚底对齐的 y。有则用它，没有则用 `y` |
| `fh` | `attrs` | 脚下立足线编号 |
| `f` | `attrs` | 朝向 |
| `rx0` / `rx1` | `attrs` | 可对话的水平范围 |
| `hide` | `attrs` | 是否先隐藏。322 个非 0 |
| `limitedname` | `attrs` | 脚本用的别名，如射手村的 `dealerA`。86 个有值。形象仍按 `id` 取 |

`life` 项上没有动作名。形象在 `Npc.wz`。`1012000` 只有 `stand`，原点在脚底。有 `move` 或 `fly` 的 NPC 仍先播 `stand`。对话或移动要换动作时，再改一条 `action` 属性。3 个 NPC 带了 `mobTime`，1 个带了 `info`，这两项不参与画面。

## 交互

人进入 `rx0` 到 `rx1` 后，由地图运行库接受对话。这个元素显示 NPC，并标出可对话范围。对话内容属于自己开发的任务系统，不移植 079 的任务脚本。

## 不做什么

- 不画怪物。怪物同在 `life`，但是 `type=m`。
- 不把房子或摊子当成 NPC。那些在 `cms-map-layer` 的 `objs` 里。
- 第一阶段不创建这个元素。
