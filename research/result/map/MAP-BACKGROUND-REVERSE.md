# Background

客户端地址都是解包映像 VA。字符串通过 `push id; push dest; call 0x7A48D0` 读取，编号和明文来自映像内字符串池（`origin` = 798 已复核）。

## 加载函数

| 字段 | 内容 |
|---|---|
| Function | 单个 back 实例加载。无符号名 |
| Address | VA `0x669397` 至下个函数 `0x66A8D5` 之前 |
| Module | 解包主映像 |
| Signature | `ecx` = back 容器，`[ebp+8]` = 该 back 在 `back` 节点里的序号（调用方 `0x669203` 从 edi=0 递增，直到子节点数量） |
| Calling Convention | thiscall |
| Entry | cookie `call 0xA6FC7C` |
| Callers | `0x669354`，在 `0x669203` 的循环里 `push edi; mov ecx, ebx; call 0x669397` |
| Callees | 属性读取序列；滚动辅助 `0x66A8D5`；动画属性 `0x66B544` |
| Evidence | Capstone 反汇编 `.work/map-reverse/disasm/back-instance.txt` |
| Confidence | VERIFIED（读了哪些属性、type 分支、20000 除法）。COM 方法内部公式 UNKNOWN |

读取顺序和字符串编号：

`bS` 1347，然后拼 `Map/Back/`（1348）。接着 `x` 817、`y` 818、`rx` 1349、`ry` 1350、`type` 5505、`cx` 1351、`cy` 1352、`a` 1354（默认 push `0xFF`）、`ani` 1353、`f` 1312、`front` 1355。`ani` 为真时用 `back/%d`（1357）和 `no` 去取动画；否则用 `no` 取静态帧。

`front` 非 0 时排序键：

```
index * 1000 - 0x3FFBDCA0
```

否则：

```
index * 1000 - 0x4001F400
```

`index` 是 `[ebp+8]`。这是加载时写入的键，不是每帧坐标。

## type

`type` 放在 `[ebp-0x68]`。

```
horizontal = type == 4 or type == 6
vertical   = type == 5 or type == 7
```

数据里 5、6、7 都存在（137 / 384 / 239 条），不是死分支。

`horizontal` 和 `vertical` 都为 0 时（type 0、1、2、3）：

- 虚调用 `+0x90`，参数里有实例 `x,y`。
- 虚调用 `+0x98`，能直接看见的立即数是两个 `100`，另外两个参数是 `rx` 和 `ry`。
- `type != 0` 时再调用 `0x66A8D5`，实参包含 `cx,cy,type`。

`[ebp+8]` 在比较之前被改成水平标志：type 是 4 或 6 时写成 1，否则写成 0。`[ebp-0x34]` 同时被改成垂直标志：type 是 5 或 7 时为 1。这两个标志为 0 才进普通分支。滚动分支里：

```
rate = rx if [ebp+8] != 0 else ry
step = 20000 / abs(rate)          ; 0x4E20，cdq / idiv
sum  = layer.slot_0x58 + step
```

`0x43715C` 是 thiscall。它调用对象虚表 `+0x58`，把输出 dword 当作返回值。这里的对象是该 back 的 layer（`[ebp-0x14]`），不是 `GetTickCount`。时间单位仍未知。rate 大于 0 时，加到 `x`/`y` 上再交给 `+0x90` 的 100 会被取负；rate 等于 0 时这两个偏移变成 0。`+0x98` 里的两个 100 没有这条取负。

`+0x98` 是 stdcall 虚调用。实参顺序是 `(this, origin, 100, 100, arg4, arg5)`。`origin` 来自全局 `[0xBE2788]` 的虚表 `+0x5C`（`0x4371B1` 把它写入调用方指针）。这个全局先用字符串 `Shape2D#Vector2D`（797）创建。

| 分支 | arg4 | arg5 | 地址 |
|---|---|---|---|
| type 0、1、2、3 | `rx` | `ry` | `0x66A3AA` |
| type 4、6 | 0 | `ry + 100` | `0x66A729` |
| type 5、7 | `rx + 100` | 0 | `0x66A792` |

方法体不在这份映像里。槽位是运行时绑定的 COM 指针，静态导入表没有对应函数名。`(100+rx)/100 * camera` 仍不是这条指令已经证明的公式。

## 平铺辅助

`0x66A8D5` 到 `0x66B4A2` 的 `ret 0x24`。九个栈参数。背景的两个调用点（`0x66A40E`、`0x66A80B`）在 `0x414A7E`（`ret 4`，只弹出它自己的指针参数）之后，对应关系是：

| 栈 | 普通分支 `0x66A40E` | 滚动分支 `0x66A80B` |
|---|---|---|
| `[ebp+8]` | layer COM | layer COM |
| `[ebp+0xC]` | `type` | mode：type 4 → 1，type 5 → 2，type 6 和 7 → 3 |
| `[ebp+0x10]` | `cx` | `cx` |
| `[ebp+0x14]` | `cy` | `cy` |
| `[ebp+0x18]` | `a` | `a` |
| `[ebp+0x1C]` | `ani` 的 0/1 | `ani` 的 0/1 |
| `[ebp+0x20]` | 0 | 0 |

type 0 在 `0x66A3CE` 直接跳过这次调用。上表是前七个参数。`ret 0x24` 还弹出更早压入的两个指针槽，它们不是 `cx`/`cy`。Obj 加载 `0x667EB1` 也调用它：mode 传的是实例 `flow`，水平步长是 `cx`，垂直步长是 `cy`，`[ebp+0x20]` 传 1。

步长为 0 时的替换：

- `[ebp+0x20] == 0`（两条背景调用都是这条）：水平步长改成 `layer.slot_0xB8 + 1 - (1 << child.slot_0x58)`。`child` 是 layer 虚表 `+0x100` 取出的第 0 项。垂直步长用 `slot_0xC0`，移位来源仍是 `child.slot_0x58`。
- `[ebp+0x20] != 0`（Obj 调用）：水平步长改成 `[this+0x38]` 上的 `[+0x2C] - [+0x24]`，垂直步长改成 `[+0x30] - [+0x28]`。

这两条都不是“改用画布宽高”。槽位和字段差的名字没有在映像里出现。

mode 的 bit0 走水平，bit1 走垂直。被选中的轴：

```
view = [0xBE2788].slot_0x2C    ; 垂直轴是 slot 0x30，分别经 0x66B4F6、0x66B51D
divisor = step == 0 ? 1 : step
span = ((view + step * 2 - 2) / divisor) * step
```

除法是 `xor edx, edx; div`，无符号。除数改成 1 只避免除零。后面仍乘原来的 step，所以替换后仍为 0 的步长得到 span 0，不是步长 1。`slot_0x2C` / `slot_0x30` 的取值函数体同样不在这份映像里，不能把它们写成已经证明的视口宽高。

因此：

| 问题 | 结论 | 等级 |
|---|---|---|
| type 4/6 使用 rx 做滚动步长，5/7 使用 ry | 是。`[ebp+8]` 就是这个水平标志 | VERIFIED |
| type 0/1/2/3 把 `(origin, 100, 100, rx, ry)` 交给 `+0x98` | 是 | VERIFIED |
| type 4/6 交给 `+0x98` 的后两个数是 `(0, ry+100)`，type 5/7 是 `(rx+100, 0)` | 是 | VERIFIED |
| `(100+rx)/100 * camera` 这一整式 | 方法体不在映像内 | UNKNOWN |
| `0x43715C` 是 layer 虚表 `+0x58` 的取值 | 是。单位未知 | PARTIALLY VERIFIED |
| `cx` 是水平步长，`cy` 是垂直步长 | 是，三个调用点的栈都对得上 | VERIFIED |
| `cx`/`cy` 为 0 时改用画布宽高 | 否。背景走上面的槽位公式，Obj 走字段差 | VERIFIED（否定这条替换） |
| 重复平铺的 mode bit | bit0 水平，bit1 垂直。滚动分支的 mode 是 1、2 或 3 | VERIFIED |
| 自动移动 | `0x66B544` 读取 canvas 上的 `moveType,moveR,moveW,moveH,moveP`。公式未还原 | PARTIALLY VERIFIED |
| 帧推进 | 加载时按 `ani` 和 `no` 选 `back/%d` 或静态帧。每帧 delay 如何累加未还原 | PARTIALLY VERIFIED |
| front 影响资源选择 | 否。front 只进入上面的 `index * 1000` 键 | VERIFIED |
| 绘制顺序 | 加载时算出一个整数键。比较器没找到，不能说 front=1 一定后画 | PARTIALLY VERIFIED |

`a`、`f`、`ani`、`no`、`bS`、`front` 都被这条函数读取。数据里还有 `a0`、`a1`、`dealy`。这条加载函数没有读 `a0`、`a1` 或 `dealy`。
