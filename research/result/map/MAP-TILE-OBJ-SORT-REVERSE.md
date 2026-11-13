
> **2026-11-13 Round-3 修订**：
> 1. 键公式（本文档主体）维持 VERIFIED（lea 机器码复核通过）。
> 2. `[eax+0xB4]` 的"推入共享容器"表述**降级为 B 级待定**：CWzRawCanvas 具体虚表 0x5042E2CC 的 slot45 实测为删除型析构；插入语义依 [ebp-0x10] 对象具体类（variant 运行时值，R-09）。
> 3. `0x427EB3` = 通用属性 PUT 助手（240 调用点），非容器创建器。
> 详见 MAP-R13-ROUND3-DISPATCH.md / MAP-RAWCANVAS-CONTAINER-SEMANTICS.md。

# Tile / Obj 排序

地址是解包映像 VA。这份映像里没有 `qsort` 这个字符串。Tile 键算完后只作为单个整数交给虚表 `+0xB4`：`0x666F72` 调用 `0x42944A`，随后 `push edi; push esi; call [eax+0xB4]`。~~Obj 键走同一类虚调用~~ **（2026-11-13 修正：错误——Obj 走栈封装 cdecl 通道 0x43286E 族，非 `[eax+0xB4]`，见 MAP-R13-FINAL-ROUND4.md / Claim C-017）**。Tile 调用点没有第二个键，也没有相等时的次序参数。方法体不在本映像，所以比较方向和相同键次序仍然 UNKNOWN。下面是加载时算出来的整数键。

## 层循环

Tile 容器 `0x666749` 和 Obj 容器 `0x6670C7` 都是：

```
esi = 0
[ebp-0x14] 或 [ebp-0x18] = esi
...
inc
cmp ..., 8
```

层号是 0、1、2、3、4、5、6、7。这和每张地图固定 8 个层节点一致。等级 VERIFIED。

## Tile 键

| 字段 | 内容 |
|---|---|
| Function | 单个 tile 实例 |
| Address | `0x666C0D` |
| Caller | `0x666B7C`，push 的是上面的层号 |
| 读取 | 实例节点 `[ebp+0x10]` 上的 `no`、`u`、`x`、`y`、`zM`。资源拼成 `%s/%d`。`z` 从加载后的资源节点 `[ebp-0x14]` 读取，不是实例节点 |
| Evidence | `.work/map-reverse/disasm/tile-instance.txt`，`0x666F5A` 起 |
| Confidence | VERIFIED |

`esi` = 实例 `zM`，`eax` = 资源 canvas `z`，`[ebp+8]` = 层。

```
edi = z + 2 * (5 * (layer * 3000 - zM)) + 0xC0004E16
    = z + 10 * (layer * 3000 - zM) - 1073721834
```

`lea edi, [eax+ecx*2+disp]` 的 disp 字节是 `16 4e 00 c0`，即 `0xC0004E16` = -1073721834。

同一层里 `zM` 越大，键越小。资源 `z` 越大，键越大。层每加 1，键加 30000。

实例上没有 `z`。资源上没有 `zM`。四个缺 `z` 的 canvas（见数据记录）在这条指令里会怎样，要看 `0x403211` 对缺属性的返回值，还没单独证明，不把它们写成 0。

## Obj 键

| 字段 | 内容 |
|---|---|
| Function | 单个 obj 实例 `0x66735F`，键在 `0x66885B` |
| Address | 键计算 `0x6688BE` |
| Caller | `0x6672FE` push 层号。`0x66885B` 的 `ret 0x34` |
| 读取 | `oS,l0,l1,l2,x,y,z,f,rx,ry,cx,cy,flow`。全映像里 `zM` 的字符串 push 只有 tile 函数 `0x666E44` 一处 |
| Evidence | `.work/map-reverse/disasm/obj-instance.txt`、`obj-place.txt`。`lea` 字节 `d0 07 00 c0` |
| Confidence | VERIFIED（公式）。`f` 不进入这个加法 |

`[ebp+0x10]` 是层，`[ebp+0x1C]` 是实例 `z`（调用点 push 的 `[ebp-0x90]`，来自实例节点的 `z` 而不是资源 canvas `z`）。

```
key = layer * 30000 + z - 1073739824
```

`0x3FFFF830` = 1073739824，编码为 `0xC00007D0`。

Obj 的 `zM` 留在数据里。这条加载路径不读它。资源 canvas `z` 也没有加进这个键。

`f` 被读成 0/1（`neg/sbb/neg`）并作为另一个参数 push。它不在上面的加法里。相等键怎么用 `f`，UNKNOWN。

同一条 Obj 加载在 `0x667EB1` 调用平铺辅助 `0x66A8D5`。传给 mode 的是实例 `flow`，不是 `f`。`flow` 的 bit0、bit1 决定是否按 `cx`、`cy` 平铺。细节在背景笔记。

## 相同键

Henesys `100000000` 层 0，tileset `woodMarble`：

| WZ 顺序 key | 实例 | 资源 z | zM | 键 |
|---|---|---:|---:|---:|
| 35 | x=3915 y=270 u=bsc no=1 | 0 | 4 | -1073721874 |
| 34 | x=4005 y=330 u=bsc no=3 | 0 | 4 | -1073721874 |
| 2 | x=4185 y=510 u=enH1 no=1 | -3 | 4 | -1073721877 |

前两块键相同。WZ 顺序是 35 然后 34。没有指令证明相同键时保留这个顺序。

另外两张地图，只算键，不表示已经看见绘制结果：

| 地图 | 层 | 实例 | tileset | 资源 z | 键 |
|---|---:|---|---|---:|---:|
| 101040000 | 1 | u=bsc no=2 zM=0 | dryRock | 0 | -1073691834 |
| 702090203 | 3 | u=enH1 no=1 zM=9 | EnSchoolCN | -3 | -1073631927 |
| 105050106 | 4 | u=enH0 no=1 zM=0 | deepCave | -4 | -1073601838 |

Henesys 层 0 的三个 obj，键只用实例 `z`，不用 `zM`：

| 节点 | z | zM | f | 键 |
|---|---:|---:|---:|---:|
| 0/obj/9 | 1 | 21 | 0 | -1073739823 |
| 0/obj/12 | 2 | 7 | 0 | -1073739822 |
| 0/obj/10 | 3 | 20 | 0 | -1073739821 |

## 相对顺序

Tile 键和 Obj 键相差一个常数：同样的层和 z，Obj 键比 `zM=0` 的 Tile 键小 17990。谁先画取决于排序方向，方向 UNKNOWN。

Background 用另一套 `index * 1000` 键，和 Tile/Obj 的 30000 不是同一个调用点。三者谁压谁，UNKNOWN。

排序发生在加载这些函数的时候，键算完就 push 给虚调用。没有看到每帧重排。这只说明键的计算在加载函数里，不证明渲染器之后不再排序。等级 PARTIALLY VERIFIED。
