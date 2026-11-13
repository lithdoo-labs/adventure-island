# Camera / 地图边界

模块：解包后的 `MapleStory.exe` 虚拟映像 `.work/task-036/game-image-unpacked.bin`。ImageBase `0x400000`。下面的地址是 VA。文件偏移 = VA - `0x400000`。

没有找到 Camera 跟随、dead zone、world-to-screen 或 DPR 缩放函数。下面只记录已经反汇编到的边界写入。

## 函数

| 字段 | 内容 |
|---|---|
| Function | 地图 info 的 VR 读取。没有符号名 |
| Address | VA `0x66E59E`，到 `0x66E7CA` 的 `ret` |
| Module | 解包主映像 |
| Signature | MSVC，`ecx` = 接收对象。栈上没有额外参数（`ret` 不弹参数） |
| Calling Convention | thiscall |
| Entry | `mov eax, imm32; call 0xA6FC7C`（cookie），然后读四个属性 |
| Callers | 只有 `0x66630D`。调用顺序是 tile `0x666749`、obj `0x6670C7`、back `0x669203`、`0x66BC81`，然后才是本函数 |
| Callees | 字符串 `0x7A48D0`，属性查找 `0x406368`，整数取值 `0x403AC7` / `0x415344` |
| Fields | 见下方偏移 |
| Evidence | `research` 会话中对 `0x66E59E` 的 Capstone 反汇编。字符串编号：VRLeft 1367、VRTop 1369、VRRight 1368、VRBottom 1370 |
| Confidence | VERIFIED（这四次读取和下面的加减） |

## 写入

`esi` 是接收对象。整数取出之后：

```
[esi+0xF0] = VRLeft  + 0x190    ; +400
[esi+0xF4] = VRTop   + 0x12C    ; +300
[esi+0xF8] = VRRight - 0x190    ; -400
[esi+0xFC] = VRBottom - 0x12C   ; -300
```

然后：

```
if ([esi+0xF8] - [esi+0xF0]) <= 0:
    both = ([esi+0xF0] + [esi+0xF8]) / 2    ; 有符号除以 2，用 cdq / sub / sar
    [esi+0xF0] = [esi+0xF8] = both
if ([esi+0xFC] - [esi+0xF4]) <= 0:
    both = ([esi+0xF4] + [esi+0xFC]) / 2
    [esi+0xF4] = [esi+0xFC] = both
```

400 和 300 是指令里的立即数。它们等于 800×600 的一半，但这段函数没有读取窗口宽高，所以“视口是 800×600”只是 INFERRED，不能当成这条函数已经证明的视口尺寸。

唯一调用点返回之后，调用方 `0x666312` 读取地图节点上的 `life`（字符串 1692）。下一项不是镜头更新。

全映像按指令对齐搜索 `[reg+0xF0]`、`+0xF4`、`+0xF8`、`+0xFC` 的数据读写。同时碰到这四个偏移的窗口有多处，其中 `0x66E600` 就是上面的写入和中点折叠。其余窗口看到的是别的对象上的字段拷贝，或字符串对象的长度头，没有本函数这种 `±400` / `±300`。不能把它们写成这份 VR 的读取者。

背景使用的全局 `[0xBE2788]` ~~是 `Shape2D#Vector2D`~~（**2026-11-13 修正：错误**）。实测其创建走真 GUID `{E576EA33-4F08D465-8DE7B1AA-D9E63EF7}`（常量 @0xBA0570，创建器 0xa0449b 含 REGDB_E_CLASSNOTREG 0x800401F0），该 GUID 字节序列在 5 个 DLL 中**仅存在于 Gr2D_DX8.dll**（VA 0x50435120，ATL 接口映射项 @0x2d1e0 `{IID,0,1}`）→ **[0xBE2788] = Gr2D_DX8 服务的主接口**，非 Shape2D。它的 `+0x5C` 被当作 `+0x98` 的 origin，`+0x2C` / `+0x30` 被平铺辅助拿来做 span。这些槽的方法体不在本映像里，也没有找到把角色坐标写进这个对象的函数。详见 MAP-R13-STATIC-CLOSURE.md。

## 未找到

| 问题 | 状态 |
|---|---|
| Camera 当前位置存在哪个变量 | UNKNOWN |
| 角色移动时如何跟随 | UNKNOWN。唯一调用点的下一次属性读取是 `life` |
| 有没有 dead zone | UNKNOWN |
| 地图比视口小时如何摆 | UNKNOWN。上面的除法只处理 VR 宽或高小于等于 0 |
| world-to-screen 公式 | UNKNOWN |
| DPR、窗口尺寸、缩放是否参与 | UNKNOWN。本函数不读窗口宽高 |

`MapHelper.img` 不提供这些值。VR 来自地图 `info`。3308 张地图有四个 VR 字段，不是全部 4259 张。没有 VR 时，属性读取仍会执行；缺属性时 `0x403211` 的返回值没有单独证明，不把缺省写成 0。
