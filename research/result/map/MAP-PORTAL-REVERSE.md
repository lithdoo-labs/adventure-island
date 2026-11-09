# Portal 资源选择

地址是解包映像 VA。`pt`、资源和跳转目标是三件不同的事。

## 实例加载

| 字段 | 内容 |
|---|---|
| Function | 单个 portal 实例 |
| Address | `0x71A203` |
| Caller | `0x534A00` |
| 读取 | `pn`、`pt`、`x`、`y`、`tm`、`tn`，以及 `hRange`（默认 push 100）。后续还有更多属性读取 |
| 存储 | `pt` → `[object+8]`，`x` → `[object+0xC]`，`y` → `[object+0x10]`。指令：`mov [esi+8], eax` 紧跟在 `pt` 的 `0x403211` 之后 |
| Evidence | `.work/map-reverse/disasm/portal-instance.txt` |
| Confidence | VERIFIED |

`tm` 和 `tn` 在这条函数里被读取。它们是目标地图和目标名称的数据字段。跳转时如何匹配，还没有跟到使用点，等级 PARTIALLY VERIFIED。

## pt 分支

`0x71A93F` 读取 `[object+8]`，也就是刚写入的 `pt`：

```
pt > 7  -> 0x71AAD2
pt == 7 -> 0x71A961    ; 加载 pv
pt == 2 -> 0x71A961
pt == 3 -> 0x71ABE5
pt == 4 -> 0x71A961
其他 0、1、5、6 -> 0x71AC09
```

`pt > 7` 之后：

```
pt == 9        -> 0x71ABE5
pt == 8        -> 0x71AC09
pt == 10 or 11 -> 0x71AAF4
pt == 12 or 13 -> 0x71ABE5
pt > 13        -> 0x71AC09
```

| 落点 | 做什么 | 等级 |
|---|---|---|
| `0x71A961` 调用 `0x71ACAF` | 从 `Map/MapHelper.img` / `portal` / `game` / `pv` 取节点 | VERIFIED |
| `0x71AAF4` | 读实例上的 `image`。字符串空则写成 `default` | VERIFIED |
| `0x71ABE5` | 只把对象挂到另一个槽，这段没有 pv/ph/psh 路径 | PARTIALLY VERIFIED |
| `0x71AC09` | 这个分支的清理代码，不加载 pv | VERIFIED |

`0x71ACAF`、`0x71AF39`、`0x71B1C3` 三个函数结构相同，最后一段名字分别是字符串 `pv`（1537）、`ph`（3963）、`psh`（3964）。路径前缀是 `Map/MapHelper.img`（1538）、`portal`（1319）、`game`（1539）。

字符串池里有 `Map/MapHelper.img/portal/game/pg`（1622），push 次数是 0。WZ 里也没有 `pg` 节点。客户端实际点名的是 `pv`、`ph`、`psh`。

## 动画状态

`0x71B6D1` 在比较 `[esi+8]` 与 10 之后调用 `0x71AF39`（ph）或 `0x71B1C3`（psh）。portal 对象的 `pt` 存在 `+8`，但还没证明这里的 `esi` 就是那个对象。等级 INFERRED。

同一函数和 `0x71BCC8` 按名字取子节点：

| 地址 | 字符串 | 编号 |
|---|---|---|
| `0x71B81B` | portalExit | 3967 |
| `0x71BAE3` | portalStart | 3965 |
| `0x71BDA9` | portalContinue | 3966 |

这和 `MapHelper.img/portal/game/ph/default`、`psh/default` 下的三个子节点同名。帧延迟如何推进，UNKNOWN。没有看到单独的“闪烁”资源名。

`editor` 下的 `sp`、`pi` 没有出现在这几条游戏路径里。`sp` 字符串另有 3 处引用（`0x6AE118`、`0x76BC9B`、`0x7B3A4F`），还没反汇编，不能说它们选择传送门画布。

## 和数据的对应

| pt | 条数 | 这条函数的资源分支 |
|---:|---:|---|
| 0 | 8916 | 不进 pv |
| 1 | 3119 | 不进 pv |
| 2 | 1962 | pv |
| 3 | 1296 | `0x71ABE5`，资源名未在该块出现 |
| 4 | 10 | pv |
| 5 | 12 | 不进 pv |
| 6 | 219 | 不进 pv |
| 7 | 1439 | pv |
| 8 | 628 | 不进 pv |
| 9 | 516 | 同 pt 3 |
| 10 | 206 | 读 `image`，空则 `default` |
| 11 | 15 | 同 pt 10 |
| 12 | 1 | 同 pt 3 |

`pn` 被读进对象，但这几条资源函数用的是固定名字 `pv`/`ph`/`psh` 或实例的 `image`，不是 `pn`。`tm`/`tn` 是跳转目标，不是资源路径。
