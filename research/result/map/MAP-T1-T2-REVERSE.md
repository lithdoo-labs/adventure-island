# T1–T2 指令级逆向

日期: 2026-11-12。映像 `.work/task-036/game-image-unpacked.bin`，ImageBase `0x400000`，文件偏移 = VA − `0x400000`。工具: Capstone。加密写 `0x6131F4`、读 `0x6A0545`。物理表 `[[0xBDD498]+8]`。

T1 初稿把按住键收成 `P ± 摩擦/B·dt`、把 `key = 0` 按 `L` 是否为 0 拆开、并把返回后的写入收成 `DEC(slot2) + DEC(slot1)·dt`。这三处和指令不符。下面是从 `0x9BD757` 入口线性扫到返回、再接 `0x9BCD6C` 立足分支后的闭合式。

---

## T1 地面一步

**要看到的写入**: 有立足时，按住左右和都没按，`+0xE0` 两槽各是什么；分发器随后改不改它们；留在本段时世界坐标用哪一槽。

`0x9BE703` 入口到 `0x9BEE0B` 之前仍然没有物理表乘法、没有键、没有 dt、没有坐标写入。地面参数在 `0x9BCD6C` 发现立足非 0 之后调用的 `0x9BD757`（`0x9BCDE1`）。函数 `ret 4`，唯一参数是调用方毫秒。`edi` 在 `0x9BD8BF xor edi, edi` 之后为 0，所以 `cmp [esi+0x150], edi` 是 `key == 0`。

### 公共量

```
dt = 毫秒 × 0.001                          ; 0x9BDB22 fild [ebp+8]; fmul 0xAFECD0
B  = DEC([move+0x198]+0x0C)                ; [ebp-0x58]
L  = DEC(立足属性+0x24) + DEC([move+0x198]+0x90)
                                           ; 0x9BD8EC / 0x9BD8F4，存 [ebp-0x60]
uvy = 立足点 +0x38
slopeSign = +1  当 uvy < 0，否则 −1         ; [ebp-0x18]，0x9BD7E8
P₀ = DEC(+0xE0 的第二槽)                    ; 0x9BD806，[ebp-0x3C]
```

立足属性是 `[立足点+0x28]`。`DEC(属性+0x18) = 1` 且 `DEC(属性+0x24) = 0` 时记为特殊立足（`0x9BD816`–`0x9BD848`，`[ebp-0x24] = 1`）。

```
速度选择量 = DEC([move+0x198]+0x18)         特殊立足
           = 1                              否则（0x9BFCF8 把传入的 1.0 加密进返回对象）
摩擦选择量 = DEC([move+0x198]+0x30)         特殊立足
           = 1                              否则
speedRaw = DEC(属性+0xC) · walkForce(+0x00) · 速度选择量 · DEC([move+0x190])
```

`step₀ = key · speedRaw`（`0x9BD8C1`）。`0x70DF65` 非 0 时再乘 `swimSpeedDec(+0x88)`（`0x9BD8E3`）。

`L = 0` 时（`0x9BD903 je 0x9BD94D`）：`key·step₀ > 0` 则 `step₁ = step₀`，否则 `step₁ = 0`。

`L ≠ 0` 且 `key = 0`（`0x9BD948`）：`step₁ = L · speedRaw`。这一支不乘 `swimSpeedDec`。

`L ≠ 0` 且 `key ≠ 0`：`key·L > 0` 时 `step₁ = step₀·(1+|L|)`；`key·L ≤ 0` 时 `step₁ = step₀·(1 − 0.8·|L|)`。`−0.8` 在 `0xB0C598`。绝对值经 `0xA70FBB`。

`uvy < 0` 时 `slopeFactor = 1 − uvy²`，否则 `1 + uvy²`（`0x9BD969`）。`step = slopeFactor · step₁`，写回 `[ebp-0x4C]`（`0x9BD991`）。`0x9BD98E setne cl` 不参加这个乘法，`cl` 作为 `key ≠ 0` 传给 `0x9BD492`。

速度上限由 `0x9BD492(立足, move+0x198, 0, key≠0)` 返回。调用方传入的第三个参数是 0，函数内 `0x9BD522` 的坡度修正不执行。

```
cap = DEC(属性+0xC) · walkSpeed(+0x08)
```

`key ≠ 0`，或特殊立足，或 `DEC([move+0x198]+0x90) = 0` 时，再乘 `DEC([move+0x198]+0x24)`。`0x70DF65` 非 0 时再乘 `swimSpeedDec`。然后用已经加过属性 `+0x24` 的 `L`：

```
endpoint = cap                          L = 0
endpoint = |L| · cap                    L ≠ 0 且 key = 0
endpoint = cap · (1 + |L|)              key·L > 0
endpoint = cap · (1 − 0.8·|L|)          key·L ≤ 0 且 key ≠ 0
```

摩擦（`0x9BDA80`–`0x9BDB1F`）：

```
fric = DEC(属性+0x18) · 摩擦选择量 · DEC([move+0x190]+0x0C)
```

先夹到 `[minFriction(+0x80), maxFriction(+0x78)]`。结果 `< 1` 再乘 `0.5`。`fricDrag = fric · walkDrag(+0x10)`，存在 `[ebp-0x14]`。`fric = 0` 时摩擦步长是 `walkDrag × 0.2`（`0xAFEFC0`），否则等于 `fricDrag`。摩擦步长存在 `[ebp-0x20]`。比较对象是 `fric` 和 `0.0`，不是水平键。

记 `δ = 摩擦步长 / B · dt`，`δ₀ = fricDrag / B · dt`。收到 `[lo, hi]`：大于 `hi` 就减去步长并停在 `hi`，小于 `lo` 就加上步长并停在 `lo`。

`0x9BDEA7(指针, drive, B, limit, dt)`：`limit < 0` 时不写。`drive > 0` 且当前值 `< limit` 时加上 `drive/B·dt`，超过 `limit` 就写成 `limit`。`drive ≤ 0` 且当前值 `> −limit` 时同样加上 `drive/B·dt`，低于 `−limit` 就写成 `−limit`。已经在驱动方向的界外则不动。

### P 的三条路

`uvy = 0`（`0x9BDB39` 不跳）。`endpoint ≥ 0` 时先用 `δ` 收到 `[−endpoint, endpoint]`。`endpoint < 0` 时这一段跳过。

- `key = 0` 且 `L = 0`：再用 `δ₀` 收到 `0`（`0x9BDBBA` 是减去，`0x9BDCFB` 是加上，越过 0 则 `0x9BDD10` 写成 0）。不调用 `0x9BDEA7`。
- 其余（`key ≠ 0`，或 `L ≠ 0`）：`0x9BDE39` 以 `drive = step`、`limit = endpoint` 推进 `P`。

`uvy ≠ 0` 且 `DEC([move+0x198]+0x3C) ≥ |uvy|`（`0x9BDC96` 不跳）。先用 `δ` 收到 `[−c, c]`。`slopeSign·P > 0` 时 `c = max((1+uvy²)·endpoint, 0)`，否则 `c = max(endpoint, 0)`。`fric = 0` 时先把 `step` 改成 `step − |uvy|·slipForce(+0x18)·slopeSign`（`0x9BDCBD`）。

- `key = 0` 且 `fric ≠ 0` 且 `L = 0`：`0x9BDCDF` 跳回 `0x9BDBA3`，用 `δ₀` 收到 `0`。不调用 `0x9BDEA7`。
- 其余：`drive = step`。`slopeSign·step > 0` 时 `limit = max(endpoint, 0)`，否则 `limit = max((1+uvy²)·endpoint, 0)`。

`uvy ≠ 0` 且 `DEC([move+0x198]+0x3C) < |uvy|`（`0x9BDD4C`）。先做上面的 `[−c, c]` 收束。`slopeSign·P > 0` 时再用 `δ` 收到 `0`。随后：

```
key·slopeSign > 0:
  drive = −slopeSign · |uvy| · slipForce · 0.5
  limit = |uvy| · slipSpeed(+0x20) · 0.5
key = 0 且 L = 0:
  drive = −slopeSign · |uvy| · slipForce
  limit = |uvy| · slipSpeed
其余:
  drive = −slopeSign · |uvy| · slipForce + step
  limit = |uvy| · slipSpeed + max((1+uvy²)·endpoint, 0)
```

`0.5` 在 `0xAFEC20`。这一路的 `drive` 在 `key·slopeSign > 0` 时不含 `step`。

### 两槽和世界坐标

`0x9BDE45` 之后固定两笔，`esi = move+0xE0`：

```
slot1 ← DEC(slot1) + (DEC(slot2) + P) · dt · 0.5     ; 0x9BDE7B，校验 +0x10
slot2 ← P                                             ; 0x9BDE8E，校验 +0x28
```

返回后 `0x9BCDF2` 先调虚表 `+0x0C`。上面六张移动虚表的 `+0x0C` 都是 `0x9BF1FA`，不是 `0x9BD757`。

`0x9BF371`：`slot1` 落在 `[0, 立足点+0x40]` 时调用 `0x9BC992` 并在 `0x9BF3C9` 返回 `0`。投影用的是第一槽：

```
x = slot1 · 立足点[+0x30] + 立足点[+0xC]     ; 写入 move+0x20
y = slot1 · 立足点[+0x38] + 立足点[+0x10]     ; 写入 move+0x38
move+0x50 = slot2 · 立足点[+0x30]
move+0x68 = slot2 · 立足点[+0x38]
```

返回 `0` 时，分发器 `0x9BCDF5` 不再改槽。留在本段的一步到此结束。

`0x9BF6E2` 返回 `1` 时，分发器才做（`0x9BCE44` 乘的是后解密的第二槽）：

```
slot1 ← DEC(slot1) + DEC(slot2) · dt          ; 0x9BCE5C，写回 +0xE0
```

然后 `0x9BCE70` 再调一次虚表 `+0x0C`。返回 `1` 之前，`0x9BF1FA` 已经按换段分支改过这两个槽。那些换段写入不在本式展开。

`[move+0x190]`、`[move+0x198]` 上各槽的装载者不在这张映像里。式子停在这些 `DEC(...)` 上。

**等级**: A。范围是 `0x9BD757` 的 `P`、两槽，以及留在本段时的投影。换段分支未展开。

---

## T2 fstp 之后的栈顶

**要看到的写入**: `0x9BE5C1` 的 `0.3` 和 `0x9BE5DF` 的 `1.5` 乘的是哪个量，乘完之后 `vy` 怎么变。

`0.3` 在 `0xB05538`，`1.5` 在 `0xB06460`。`[ebp-0x38]` 是 Cap，`[ebp-8]` 是 `vy`，`[ebp-0x10]` 是 `vx`，`[ebp-0x30]` 是 dragTerm，`[ebp-0x18]` 是 dt，`[ebp-0x20]` 是基准 `B`，`[ebp-0x40]` 是力，`[ebp-0x48]` 是 dragK。

### 栈

`0x9BE4F8 fld [ebp-0x38]` 把 Cap 压栈，`0x9BE4FB` 再压 `0.0`。汇合点 `0x9BE54D` 的 `fld st(1)` / `fcomp st(1)` / `fstp st(0)` 弹掉 `0.0`。Cap 小于 `0` 时 `0x9BE556` 直接跳到 `0x9BE5A8`，栈顶仍是 Cap。另一路在 `0x9BE5A6 fstp st(0)` 弹掉比较用的副本，栈顶仍是 Cap。

```
009BE5A8  fld [ebp-0x40]          ; 力
009BE5AB  mov esi, [esi+0x154]    ; 垂直键。随后的 test 决定 0x9BE5BF
009BE5B3  fdiv [ebp-0x20]         ; / B
009BE5B6  fdiv [ebp-0x30]         ; / 旧 dragTerm
009BE5B9  fmul [ebp-0x48]         ; × dragK
009BE5BC  fstp [ebp-0x30]         ; 新 dragTerm。弹出的是力这一份
```

`fdiv` / `fmul` / `fstp` 不改 `test` 留下的标志。`0x9BE5BF jge` 仍是垂直键 `≥ 0`。`fstp` 之后栈顶是 Cap。

### 0.3 / 1.5 和 vy

垂直键 `< 0`：`0x9BE5C1` 把栈顶乘 `0.3`。然后和 `[ebp-8]` 比较（`0x9BE5CA`）：

- `vy > 0.3·Cap`：`vy ← vy − dragTerm·dt`（`0x9BE617`）。结果低于 `0.3·Cap` 时写成 `0.3·Cap`（`0x9BE608`）。
- `vy = 0.3·Cap`：`vy` 不变（`0x9BE65A` 只弹栈）。
- `vy < 0.3·Cap`：`vy ← vy + dragTerm·dt·0.5`（`0x9BE5EF`）。结果高于 `0.3·Cap` 时写成 `0.3·Cap`。

垂直键 `> 0`：`0x9BE5DF` 把栈顶乘 `1.5`。

- `vy > 1.5·Cap`：走 `0x9BE5EF` 的加法，越过上限就写成 `1.5·Cap`。
- `vy = 1.5·Cap`：`vy` 不变。
- `vy < 1.5·Cap`：走 `0x9BE617` 的减法，越过下限就写成 `1.5·Cap`。

垂直键 `= 0`：不乘 `0.3` 也不乘 `1.5`。`0x9BE650` 调用 `0x9BDEA7(&vy, dragTerm·B, B, Cap, dt)`，即加上 `dragTerm·dt`，并夹在 `±Cap`。

`[ebp-0x10]`（`vx`）从 `0x9BE5A8` 到这段结束不被读也不被写。`vx` 的 `(drive/B)·dt` 在更早的 `0x9BE4F3`，经 `0x9BDEA7`，不在这段。

**等级**: A。

---

## 汇总表

| 编号 | 一句话回答 | 等级 |
|---|---|---|
| T1 | 地面 `P` 由 `0x9BD757` 按平地、缓坡、陡坡三条更新。`step` 含水平键、`L`、坡度因子，`0x70DF65` 非 0 时 `step₀` 和上限乘 `swimSpeedDec`。摩擦步长在 `fric = 0` 时为 `walkDrag×0.2`。两槽先写梯形 `slot1` 和 `slot2 = P`。留在本段时 `0x9BC992` 用 `slot1` 投影世界坐标，分发器不再加 `slot2·dt` | A |
| T2 | `0.3` / `1.5` 乘的是栈上留下的 Cap。垂直键小于 0 用 `0.3·Cap`，大于 0 用 `1.5·Cap`，从上下两侧用 `dragTerm·dt` 或 `dragTerm·dt·0.5` 逼近并夹住。垂直键为 0 时不乘这两个数，改为 `vy += dragTerm·dt` 并夹在 `±Cap`。这段不改 `vx` | A |

没有 T3。
