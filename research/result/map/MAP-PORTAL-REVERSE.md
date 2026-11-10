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

`tm` 和 `tn` 在这条函数里被读取。存储是：`pn` → `[object+4]`（`0x4674E6` 写入字符串），`tm` → `[object+0x1C]`，`tn` → `[object+0x20]`。`hRange` → `[object+0x14]`，`vRange` → `[object+0x18]`。跳转使用点见下面的使用函数。

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

## 命中

两套范围，不要合成一个。

`0x71B4FD` 被使用函数 `0x9546DC` 调用。它从后往前走 `[this+8]` 上的 portal 列表。对每个对象：

```
left   = x - hRange / 2
right  = x + hRange / 2
top    = y - vRange / 2
bottom = y + vRange / 2
```

除以 2 是 `cdq / sub / sar`，向 0 取整。四个数和一个矩形指针按 `SetRect` 的参数顺序交给 `[0xBE16BC]`，角色的 `x,y` 再按点测试的参数顺序交给 `[0xBE1734]`。返回非 0 就返回这个 portal，否则继续。都没有命中则返回 0。静态导入表没有这两个槽的函数名，所以函数名是根据参数形态推断，矩形的加减是 VERIFIED。

`0x71B5F3` 走另一份列表 `[this+0xC]`。调用方 `0x956FD2` 把立即数 `100` 作为最后一个参数。矩形是 `x±100`、`y±50`（`0x32` 是函数内立即数），不读 `hRange`/`vRange`。点测试非 0 时留下这个 portal。这是动画函数的查找，不是跳转命中。

上键换图是第三条。`0x954B58` 调用 `0x71B44D(portalManager, x, y, 0x14)`。它走 `[this+4]`，不是上面的 `[this+8]`。`[object+8] == 0` 的项跳过，所以 `pt == 0` 不参加。矩形四边是 `x-20`、`y-50`、`x+20`、`y+50`，不读 `hRange` / `vRange`。命中且 `tm` 不是 `999999999` 才换图。完整前置条件和 `town` 分支在 [MAP-MOTION-REVERSE.md](./MAP-MOTION-REVERSE.md)。这四扇验证门用这一条，不用 `hRange` 的一半。

## 跳转

`0x9546DC` 用角色位置调用 `0x71B4FD`。`esi` 是返回的 portal。`[esi+8]` 是 `pt`。

| pt | 动作 | 等级 |
|---|---|---|
| 9 | 读 `delay`（`+0x2C`）和 `onlyOnce`（`+0x28`），不读 `tm`。随后路径和跨图函数都调用 `0x495C5C` | PARTIALLY VERIFIED。没有把整段还原成脚本协议 |
| 12 | 调用 `0x9549DF`。开头没有 MapHelper 路径 | PARTIALLY VERIFIED |
| 13 | 读取 `Effect/BasicEff.img/VerticalJump`（字符串 2489） | VERIFIED 这个名字被读取。不是 pv/ph/psh |
| 其他 | 进入下面的 `tm` 判断 | VERIFIED |

`tm == 999999999`（`0x3B9AC9FF`）时直接返回。否则取 `0x4F746F(field+0x130)`，和 `tm` 比较。这个返回值在 `0x53FF69` 里还和立即数 `100000000` 比较，所以这里把它当作当前地图 id。

- 相等：`0x963C7D` 的这条调用把第一个栈参数传成 0，因此进入 `0x963CE1`。那里用 `tn` 调用 `0x71B4C0`。`0x71B4C0` 把 `tn` 和每个 portal 的 `pn`（`+4`）交给 `[0xBE1664]`，比较结果为 0 就返回该 portal。`0x963D72` 调用 `0xA4F6F1`，压栈是半宽 `1`、上界 `0x7FFFFFFF`、输出空、`y-10`、portal 的 `x`。返回值是立足对象。输出指针是空，所以这次不写 y。函数随后组报文，不在这里写人物坐标。
- 不相等：`0x53FF69(field, -1, pn, 0)`。这条调用的参数里没有 `tm`，也没有 `tn`。函数内部读当前地图 id，不读 portal `+0x1C`。地图 id 为 `100000000` 的分支会读取字符串 4755，明文是一段封禁提示，不是传送门名字。目标地图 id 写到哪里，这段里没有。

加载时还有一个窄分支：`0x71E941` 在地图 id / 1000000 落在 780、781、782 时返回 1。同时 `tm` 不是 `999999999` 的话，`tm` 被改成另一次 `0x4F746F` 的返回值。这不是上面的使用函数。

## 动画状态

`0x71B6D1` 的唯一调用点是 `0x957030`。传入对象来自 `0x71B5F3`。对象为 0，或 `[object+8]` 是 10 或 11，才继续；其他 `pt` 直接返回。`+8`、`+0xC`、`+0x10` 与加载函数写入的 `pt`、`x`、`y` 相同。

当前指针存在 `[this+0x30]`。换掉它时：

- 离开的旧对象：`pt == 10` 调用 `0x71AF39`（ph），否则调用 `0x71B1C3`（psh）。地址 `0x71B726`。
- 进入的新对象：同样是 `pt == 10` 走 ph，否则走 psh。地址 `0x71B9F0`。

`0x71BCC8` 另有一个调用点 `0x541B90`，对象是全局 `[0xBDEB48]`。`[this+0x30]` 非 0 且前面的状态检查没有提前返回时，它无条件调用 ph，不比较 `pt`，随后读取 `portalContinue`。离开和进入时的 ph/psh 选择在 `0x71B6D1`：`pt == 10` 走 ph，否则走 psh。等级 VERIFIED。帧延迟如何推进仍然 UNKNOWN。

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
