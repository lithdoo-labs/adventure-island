# Physics.img 偏移修正

日期: 2026-11-10。修正 MAP-PHYSICS-FIELDS.md 和 MAP-MOTION-GAPS-ANALYSIS.md 中的偏移错误。

## 修正后的 footholdMgr [+8] 记录布局（0xA4D393 加载顺序核实）

全局 `[0xBDD498]` 指向 Physics 对象，数值存放在 `[obj+8]` 所指的 double 数组，按加载顺序排列：

| 偏移 | 字段名 |
|---|---|
| +0x00 | walkForce |
| +0x08 | walkSpeed |
| +0x10 | walkDrag |
| +0x18 | slipForce |
| +0x20 | slipSpeed |
| +0x28 | floatDrag1 |
| +0x30 | floatDrag2 |
| +0x38 | floatCoefficient |
| +0x40 | swimForce |
| +0x48 | swimSpeed |
| +0x50 | flyForce |
| +0x58 | flySpeed |
| +0x60 | gravityAcc |
| +0x68 | fallSpeed |
| +0x70 | jumpSpeed |
| +0x78 | maxFriction |
| +0x80 | minFriction |
| +0x88 | swimSpeedDec |
| +0x90 | flyJumpDec |

## 由此修正的公式

### 陆跳竖直速度（0x9BD1FD）

之前的记录写成 `+0x70 = gravityAcc`，**错**。+0x70 是 **jumpSpeed**。

```
竖直速度 = -(decrypt([move+0x198]+0x48) × jumpSpeed) / decrypt([move+0x190]+0x24)
```

分子 `decrypt([move+0x198]+0x48)` 和分母 `decrypt([move+0x190]+0x24)` 不是 Physics.img 字段，是移动对象自身的 WZ Property 节点，字段名仍未知。

### 无立足点分支竖直速度（0x9BD3AD）

乘的 +0x48 是 **swimSpeed**（不是之前写的 walkForce）。

### 乘 +0x90 和 +0x58 的分支（0x9BD3D4）

+0x90 是 **flyJumpDec**，+0x58 是 **flySpeed**。

### 撤回的错误标注

以下三处是旧文档中的错误，全部撤回：

- ~~+0x70 = gravityAcc~~ → +0x70 = jumpSpeed
- ~~+0x48 = walkForce~~ → +0x48 = swimSpeed
- ~~+0x58 = walkSpeed~~ → +0x58 = flySpeed

gravityAcc 在 +0x60。起跳指令 0x9BD1FD **没有读 gravityAcc**。

### 0.3、0.5、1.3 常数

这些常数出现在移动对象 +0x150 非零的分支。+0x150 是水平键（-1/0/1），不是地图 swim。水中跳的速度写入和这些常数无关。

## 未解决的缺口（全部仍在）

1. 地图 field+0x150 (swim) 与全局 [0xBDF54C]+0x150 的复制关系
2. 水中跳速度写入
3. 名为 swim 的身体动作
4. decrypt([move+0x190]+0x24)、[move+0x198]+0x48、+0x6C、+0x18 的字段名
5. 行走、游泳、重力的逐步积分
6. l 选 ladder 还是 rope
7. +0x80、+0x98 的名字和写入
8. swing/stab 选择和攻击命中范围
9. 坐下、蹲下的本地动作名
10. field+0x13C bit 17 与 forbidFallDown 的关系
11. 同图传送的人物 +0x20/+0x38 写入
