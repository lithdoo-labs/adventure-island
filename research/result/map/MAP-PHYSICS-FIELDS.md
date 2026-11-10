# Physics.img 完整字段表 — 从 Ghidra 反编译代码提取

日期: 2026-11-10。来源: Ghidra 反编译函数 0xA4D393（VA 0xE4D393），WZ 属性名字符串在映像地址 0xBD3F64-0xBD4110。

## 完整 Physics.img 字段名（20 个，按加载顺序）

| # | WZ 属性名 | 字符串地址 | 含义 | 对应 footholdMgr 偏移 |
|---|---|---|---|---|
| 1 | `flyJumpDec` | 0xBD3F64 | 飞行跳跃衰减 | +0x? |
| 2 | `swimSpeedDec` | 0xBD3F7C | 游泳速度衰减 | +0x? |
| 3 | `minFriction` | 0xBD3F98 | 最小摩擦力 | +0x? |
| 4 | `maxFriction` | 0xBD3FB0 | 最大摩擦力 | +0x? |
| 5 | `jumpSpeed` | 0xBD3FC8 | 跳跃初速度 | +0x? |
| 6 | `fallSpeed` | 0xBD3FDC | 落下速度 | +0x? |
| 7 | `gravityAcc` | 0xBD3FF0 | 重力加速度 | +0x70 |
| 8 | `flySpeed` | 0xBD4008 | 飞行速度 | +0x? |
| 9 | `flyForce` | 0xBD401C | 飞行力 | +0x? |
| 10 | `swimSpeed` | 0xBD4030 | 游泳速度 | +0x? |
| 11 | `swimForce` | 0xBD4044 | 游泳力 | +0x? |
| 12 | `floatCoefficient` | 0xBD4058 | 浮力系数 | +0x? |
| 13 | `floatDrag2` | 0xBD407C | 浮力阻力2 | +0x? |
| 14 | `floatDrag1` | 0xBD4094 | 浮力阻力1 | +0x? |
| 15 | `slipSpeed` | 0xBD40AC | 滑动速度 | +0x? |
| 16 | `slipForce` | 0xBD40C0 | 滑动力 | +0x? |
| 17 | `walkDrag` | 0xBD40D4 | 行走阻力 | +0x? |
| 18 | `walkSpeed` | 0xBD40E8 | 行走速度 | +0x58 |
| 19 | `walkForce` | 0xBD40FC | 行走力 | +0x48 |
| 20 | `Map/Physics.img` | 0xBD4110 | WZ 路径 | — |

## 加载函数 0xA4D393 (VA 0xE4D393)

这是 foootholdMgr 的构造函数。它：
1. 创建 footholdMgr 对象
2. 设置 `DAT_00bdd498 = 对象指针`（这就是全局 [0xBDD498]）
3. 按顺序读取 20 个 WZ double 属性（从 "Map/Physics.img"）
4. 每个属性用 `FUN_007a48d0`（字符串读取器）+ `FUN_006a0545`（解密器）加载

## 已确认的 footholdMgr 偏移映射

| footholdMgr 偏移 | Physics.img 字段 | 用途 | 证据 |
|---|---|---|---|
| `+0x70` | `gravityAcc` | 重力加速度 | 速度公式直接使用 |
| `+0x48` | `walkForce` | 行走力 | 水平速度公式 |
| `+0x58` | `walkSpeed` | 行走速度 | 水平速度公式 |
| `+0x90` | ? | 额外速度因子 | 乘入水平速度 |

## 关联发现

### swimArea
`swimArea` 字符串在 RVA 0x7A1650，被函数 0x13602C（= VA 0x53602C）引用：
```c
FUN_00426d6e(s_swimArea_00ba1650);
```
这是地图加载函数的一部分，读取 WZ 的 `swimArea` 属性来确定水域范围。

### 跳跃公式最终确认

```
竖直速度 = -(jumpSpeed × gravityAcc) / decrypt([move+0x190]+0x24)
水平速度 = -(walkForce × footholdMgr+0x48 × decrypt_param × 5.0)
```

其中 `decrypt([move+0x190]+0x24)` 是一个 WZ Property 节点解密后的 double 值，可能对应角色速度或物品速度加成。

### 已确认常数

| 地址 | 值 | 含义 |
|---|---|---|
| 0xB0C590 | -0.35355339 | -√2/4（方向系数） |
| 0xB04F40 | 5.0 | 行走力放大 |
| 0xB06458 | 0.7 | 二次跳衰减 |
| 0xB064B0 | 1.3 | 水中跳放大 |
| 0xAFEC18 | 0.8 | 速度上限因子 |
| 0xB05538 | 0.3 | 水中跳方向A |
| 0xAFEC20 | 0.5 | 水中跳方向B |

## 对缺口的解答

| 缺口 | 新状态 | 解答 |
|---|---|---|
| ~~跳跃字段名~~ | **已解决** | `walkForce`、`jumpSpeed`、`gravityAcc` 等全部 20 个名称找到 |
| ~~swim 字段~~ | **已解决** | `swimForce`、`swimSpeed`、`swimSpeedDec`、`floatCoefficient` 找到 |
| ~~fly 字段~~ | **已解决** | `flyForce`、`flySpeed`、`flyJumpDec` 找到 |
| swim 动画名 | 仍未知 | Physics.img 中的字段名与身体动作名是不同体系 |
| swim 标志连接 | 仍未知 | 加载函数确认了 footholdMgr 结构但未揭示 field→global 复制 |
