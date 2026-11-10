# Physics.img 完整字段表 — 从 Ghidra 反编译代码提取

日期: 2026-11-10。来源: Ghidra 反编译函数 0xA4D393（VA 0xE4D393），WZ 属性名字符串在映像地址 0xBD3F64-0xBD4110。

> **修正记录**：初版把 +0x70 标成 gravityAcc、+0x48 标成 walkForce、+0x58 标成 walkSpeed，均为错误推断。
> 本版按 0xA4D393 加载指令逐条核实，正确偏移见下表。详见 MAP-PHYSICS-CORRECTION.md。

## 存储布局（[0xBDD498]+8 所指 double 数组，按加载顺序）

全局 `[0xBDD498]` 指向 Physics 对象，数值存放在 `[obj+8]` 所指记录上，每个字段占 8 字节（double）：

| 偏移 | WZ 属性名 | 字符串地址 | 含义 |
|---|---|---|---|
| +0x00 | `walkForce` | 0xBD40FC | 行走力 |
| +0x08 | `walkSpeed` | 0xBD40E8 | 行走速度 |
| +0x10 | `walkDrag` | 0xBD40D4 | 行走阻力 |
| +0x18 | `slipForce` | 0xBD40C0 | 滑动力 |
| +0x20 | `slipSpeed` | 0xBD40AC | 滑动速度 |
| +0x28 | `floatDrag1` | 0xBD4094 | 浮力阻力1 |
| +0x30 | `floatDrag2` | 0xBD407C | 浮力阻力2 |
| +0x38 | `floatCoefficient` | 0xBD4058 | 浮力系数 |
| +0x40 | `swimForce` | 0xBD4044 | 游泳力 |
| +0x48 | `swimSpeed` | 0xBD4030 | 游泳速度 |
| +0x50 | `flyForce` | 0xBD401C | 飞行力 |
| +0x58 | `flySpeed` | 0xBD4008 | 飞行速度 |
| +0x60 | `gravityAcc` | 0xBD3FF0 | 重力加速度 |
| +0x68 | `fallSpeed` | 0xBD3FDC | 落下速度 |
| +0x70 | `jumpSpeed` | 0xBD3FC8 | 跳跃速度 |
| +0x78 | `maxFriction` | 0xBD3FB0 | 最大摩擦 |
| +0x80 | `minFriction` | 0xBD3F98 | 最小摩擦 |
| +0x88 | `swimSpeedDec` | 0xBD3F7C | 游泳速度衰减 |
| +0x90 | `flyJumpDec` | 0xBD3F64 | 飞行跳跃衰减 |

WZ 路径字符串 `Map/Physics.img` 在 0xBD4110。

## 加载函数 0xA4D393 (VA 0xE4D393)

这是 Physics 对象的构造/加载函数。它：
1. 创建对象并设置 `DAT_00bdd498 = 对象指针`（这就是全局 [0xBDD498]）
2. 按顺序读取 20 个 WZ double 属性（从 "Map/Physics.img"）写入 `[obj+8]` 所指记录
3. 每个属性用 `FUN_007a48d0`（字符串读取器）+ `FUN_006a0545`（解密器）加载

## 用这些偏移核实的公式

### 陆地跳竖直速度（0x9BD1FD）

乘的 +0x70 是 **jumpSpeed**（不是 gravityAcc）：

```
竖直速度 = -(decrypt([move+0x198]+0x48) × jumpSpeed) / decrypt([move+0x190]+0x24)
```

分子 `decrypt([move+0x198]+0x48)` 和分母 `decrypt([move+0x190]+0x24)` **不是 Physics.img 字段**，
是移动对象自身的 WZ Property 节点，字段名未知。起跳指令没有读 gravityAcc（+0x60）。

### 无立足点分支竖直速度（0x9BD3AD）

乘的 +0x48 是 **swimSpeed**（不是 walkForce），结果写入竖直速度 +0x68。

### 乘 +0x90 和 +0x58 的分支（0x9BD3D4）

+0x90 是 **flyJumpDec**，+0x58 是 **flySpeed**。

### 常数 0.3 / 0.5 / 1.3

这些常数出现在移动对象 +0x150 非零的分支。+0x150 是**水平键**（-1/0/1），不是地图 swim。
它们与水中跳的速度写入无关。

## 已确认常数

| 地址 | 值 | 含义 |
|---|---|---|
| 0xB0C590 | -0.35355339 | -√2/4（方向系数） |
| 0xB04F40 | 5.0 | 行走力放大 |
| 0xB06458 | 0.7 | 二次跳衰减 |
| 0xB064B0 | 1.3 | 乘 +0x150（水平键）分支 |
| 0xAFEC18 | 0.8 | 速度上限因子 |
| 0xB05538 | 0.3 | 乘 +0x150（水平键）分支 |
| 0xAFEC20 | 0.5 | 乘 +0x150（水平键）分支 |

## 对缺口的解答（修正后）

| 缺口 | 状态 | 说明 |
|---|---|---|
| Physics.img 字段名 | **已解决** | 全部 20 个名称 + 存储偏移核实 |
| 陆跳公式的 Physics 系数 | **已解决** | +0x70 = jumpSpeed |
| decrypt([move+0x190]+0x24) 等参数名 | **未解决** | 不是 Physics.img 字段，是移动对象自身节点 |
| swim 动画名 | **未解决** | Physics.img 字段名与身体动作名是不同体系 |
| 地图 swim → 全局复制 | **未解决** | 加载函数未揭示 field→global 复制 |
