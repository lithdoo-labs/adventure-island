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
| Callers | 未逐个列出 |
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

## 未找到

| 问题 | 状态 |
|---|---|
| Camera 当前位置存在哪个变量 | UNKNOWN |
| 角色移动时如何跟随 | UNKNOWN |
| 有没有 dead zone | UNKNOWN |
| 地图比视口小时如何摆 | UNKNOWN。上面的除法只处理 VR 宽或高小于等于 0 |
| world-to-screen 公式 | UNKNOWN |
| DPR、窗口尺寸、缩放是否参与 | UNKNOWN |

`MapHelper.img` 不提供这些值。VR 来自地图 `info`。3308 张地图有四个 VR 字段，不是全部 4259 张。没有 VR 时这条函数是否被调用，还没有交叉引用证明。
