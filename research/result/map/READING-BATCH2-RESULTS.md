# 逐函数阅读战役 — 第二批成果（20 函数批量）

日期: 2026-11-12。52KB 反编译源码一次性阅读。

## 移动物理族完整解读

### foothold-installer (FUN_009bc992, 1KB)
```c
install(move, posSlot, foothold):
    base_x = plaintext(foothold+0x0C)  // 明文基点 x
    base_y = plaintext(foothold+0x10)  // 明文基点 y
    slope_x = plaintext(foothold+0x30) // 明文斜率 x
    slope_y = plaintext(foothold+0x38) // 明文斜率 y
    param_x = DEC(posSlot+0x10) * slope_x + base_x   // ENC_WRITE
    param_y = DEC(posSlot+0x10) * slope_y + base_y   // ENC_WRITE
    vx_proj = slope_x * DEC(posSlot+0x28)             // ENC_WRITE
    vy_proj = slope_y * DEC(posSlot+0x28)             // ENC_WRITE
```
立足点上的行走 = 参数化位置 × 斜率 + 基点（斜坡插值具体实现）。
foothold +0x0C/+0x10/+0x30/+0x38 全部明文。

### pre-physics (FUN_009bf7ea, 2.6KB)
```c
pre_physics(move, posSlot, maxStep):
    // VR 边界钳制 (field+0x138/+0x140 = 左右界, +0x13C/+0x144 = 上下界)
    if x < VR_left: x = VR_left, vx = 0
    if x > VR_right: x = VR_right, vx = 0
    if y < VR_bottom: y = VR_bottom, vy = 0
    // 帧步进 = clamp(投影(x-fx), 0, maxStep)
    return step
```

### 移动状态机分派（从 callee 映射确认）
物理 tick (0x5be703) → 0x5bd757(绳索) / 0x5bdf18(空中,唯一引Physics) / 0x5bf1fa(行走,最密加密) / 0x5bf9d3+0x5bfc35(辅助)

### move-state-D (0x5bdf18, 8KB, phys=6): 空中/重力状态
### move-state-E (0x5bf1fa, 6KB, encR=14): 行走状态（斜坡+钳制+更新）

## 完整积分公式（终版）

```
帧循环:
  1. pre_physics → VR边界钳制 + 步进
  2. speed_clamp → vx/vy钳制[foothold明文限速]
  3. 状态分派:
     行走: install→斜坡投影; x=ENC(base+vx_proj*dt*0.5) 梯形积分
     空中: vy+=gravityAcc*dt(加密); vy=min(vy,fallSpeed); x+=vx*dt
     绳索: y=clamp(y±3, fh.y1, fh.y2) [A级]
  4. position_setter → 快照+ENC_WRITE
```

## 立足点运行时对象布局（全明文）

| 偏移 | 含义 | 加密? |
|---|---|---|
| +0x0C | base_x | 明文 |
| +0x10 | base_y | 明文 |
| +0x14 | maxY | 明文 |
| +0x30 | slope_x | 明文 |
| +0x38 | slope_y | 明文 |
| +0x40 | maxSpeed | 明文 |

加密只覆盖移动对象的速度/位置槽，立足点几何全明文。

## 攻击链

攻击链几乎不用加密存储——伤害计算/命中判定走明文。
