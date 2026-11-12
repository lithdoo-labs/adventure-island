# 逐函数阅读战役 — 第一批成果

日期: 2026-11-12。方法：直接阅读反编译源码 + String.wz 交叉验证。

## T1: FUN_009495c0 — 圆形命中判定（超能力/闪光技能）

```c
// 中心 = 技能释放者或目标中点
// dist² = dx² + dy²
// 超能力(5121002): radius = (int)√dist² + 中心偏移
// 闪光(15111006): radius = (int)√dist² (更大取整)
// 两者都写回 entry+0x10
```

## T3: FUN_009bd455 — 跳跃前置条件

```c
jump_allowed(move):
    if (状态vtable调用() != 0) return TRUE   // 骑乘/攀爬等
    if (swim_check(move) != 0) return TRUE   // 游泳恒可跳
    if (move[+0x198] != 0 && DEC(move[+0x198]) > 1.0)
        return TRUE                           // 立足点弹性>1.0
    return FALSE
```

## 新发现: FUN_009bf6ec — 速度钳制（跳跃前置调用）

```c
speed_clamp(move):
    if (move[+0x110] == 0) return   // 无立足点跳过
    // X: clamp(vx, 0, foothold[+0x40])     ← 立足点 maxSpeed 明文
    // Y: clamp(vy, foothold[+0x0C], foothold[+0x14]) ← 明文 minY/maxY
    // param(+0x48对): abs(DEC - 常数0xafecb8)
    vtable_notify()                   // 通知位置更新
```

**关键**：立足点对象 +0x0C/+0x14/+0x40 是明文速度限制参数（不经加密）。

## 陆跳公式精读（0x5BD0D9 行62-66）

```
vy = -(DEC([move+0x198]+0x48) × jumpSpeed) / DEC([move+0x190]+0x24)
```
两个 DEC 在 speed_clamp 之后执行——clamp 后的 vx/vy 参与。

## 命中范围默认分支（行901-906）

```
range = (int)(double)(otherBase)  // 武器基础范围取整（不加边距）
```

## 技能→命中范围表（String.wz 验证）

| 技能ID | 技能名 | 公式 |
|---|---|---|
| 3101005 | 爆炸剑 | base + 200 |
| 3211003/3111003 | 寒冰剑/烈火剑 | base + 120 + hitIdx×30 |
| 3111004/3211004 | 箭雨/升龙剑 | otherBase + 400 |
| 5121002 | 超能力 | 圆形: √(dx²+dy²) + offset |
| 15111006 | 闪光 | 圆形: √(dx²+dy²) |
| 3111003(后) | 烈火剑(显示) | 500, x-50, y-170 |
| 默认 | — | (int)(double)otherBase |

## move 对象加密槽对终版（本轮更新）

| 槽对起点 | 内容 | 发现 |
|---|---|---|
| +0x08 | vy 对 | speed_clamp 钳制对象 |
| +0x20 | x 对 | |
| +0x38 | vx 对 | speed_clamp 钳制对象 |
| +0x48 | param 对 | abs(DEC - 常数) ← 新发现 |
| +0x68 | vy(空中) 对 | |
| +0x110 | 立足点指针 | +0x0C/+0x14/+0x40 明文限速 ← 新发现 |
| +0x150 | 水平键 | |
| +0x158 | 坐下标志 | |
| +0x190 | 跳分母来源 | speed_clamp 后取值 |
| +0x198 | 跳分子来源 + 弹性检查 | DEC()>1.0 允许跳 |
