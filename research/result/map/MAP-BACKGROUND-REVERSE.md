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

`horizontal` 或 `vertical` 为 1 时（type 4、5、6、7）：

```
rate = rx if horizontal else ry
step = 20000 / abs(rate)          ; 0x4E20 idiv abs(rate)
time = call 0x43715C() + step
```

`0x43715C` 的返回值还没还原，所以这是“某个计时值加上 20000/|rate|”，不是已经证明的毫秒公式。rate 大于 0 时，传给后续虚调用的 100 会被取负。水平滚动把 `ry+100` 传给 `+0x98`，垂直滚动把 `rx+100` 传给 `+0x98`。`+0x98` 的函数体不在这段代码里。

因此：

| 问题 | 结论 | 等级 |
|---|---|---|
| type 4/6 使用 rx 做滚动步长，5/7 使用 ry | 是，见上面的选择 | VERIFIED |
| type 0/1/2/3 也会把 rx,ry 和 100,100 交给 `+0x98` | 是 | VERIFIED |
| `(100+rx)/100 * camera` 这一整式 | 这段函数里没有 Camera 乘法 | UNKNOWN |
| cx,cy 为 0 时改用图片宽高 | 调用方把 cx,cy 传进 `0x66A8D5`。该函数对两个轴做了“步长为 0 则改用 1”的除法，但还没把寄存器对应回 cx,cy | PARTIALLY VERIFIED |
| 重复平铺 | `0x66A8D5` 用 mode 的 bit0、bit1 分别走两段 `div`。调用方在滚动分支把 mode 设成 1（type 4）、2（type 5）或 3（type 6 和 7） | PARTIALLY VERIFIED |
| 自动移动 | `0x66B544` 读取 canvas 上的 `moveType,moveR,moveW,moveH,moveP`。公式未还原 | PARTIALLY VERIFIED |
| 帧推进 | 加载时按 `ani` 和 `no` 选 `back/%d` 或静态帧。每帧 delay 如何累加未还原 | PARTIALLY VERIFIED |
| front 影响资源选择 | 否。front 只进入上面的 `index * 1000` 键 | VERIFIED |
| 绘制顺序 | 加载时算出一个整数键。比较器没找到，不能说 front=1 一定后画 | PARTIALLY VERIFIED |

`a`、`f`、`ani`、`no`、`bS`、`front` 都被这条函数读取。数据里还有 `a0`、`a1`、`dealy`。这条加载函数没有读 `a0`、`a1` 或 `dealy`。
