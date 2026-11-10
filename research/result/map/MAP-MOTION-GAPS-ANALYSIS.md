# 移动物理缺口分析 — Ghidra 反编译代码发现

日期: 2026-11-10。本文档记录 Ghidra 反编译输出中对 8 个已知缺口的搜索结果。

## 1. Swim 标志连接 (field+0x150 → global [0xBDF54C]+0x150)

**未找到直接连接**。搜索所有引用 DAT_00bdf54c 且包含 150 的函数，没有发现把 field+0x150 复制到全局 +0x150 的指令。

已确认的读取路径：
- `0x95A31E`（RVA 0x55A31E）通过 `FUN_004376F2()`（即 GetField）读全局 +0x150
- `0x9BD0DE` 读移动对象自身 +0x150（不是地图的 swim）
- 反编译显示 `this[0x54]`（int* 索引 0x54 = +0x150）在主物理函数 0x5BD0D9 中被乘入速度公式

**结论**：地图 swim → 全局的复制可能发生在地图加载函数中（一个大函数的内部），或者通过一条不直接引用 DAT_00bdf54c 的间接路径。静态搜索已穷尽。

## 2. Swim 动作选择

**已由数据侧解决（否定式）**：WZ 全量提取（`[struct]Look/00002000.json`）确认角色身体 img
共 149 个动作节点，与二进制动作表 149 项数量一致，**其中不存在 `swim` 动作**。
水相关动作仅有 `float`(1帧)、`fly`(2帧)、`ghostfly`(2帧)。

代码侧证据吻合：主物理函数 0x5BD0D9 的 swim 分支只写速度，没有动作表引用（DAT_00bddb10）。
**结论：水中角色沿用当前动作（walk/stand/jump 照常播放），无专用游泳动画。**
详见 MAP-DATA-SIDE-FINDINGS.md。

## 3. 跳跃公式字段名

反编译代码确认了速度计算的完整结构。**初版的字段名推断是错的，已按 Physics.img 存储偏移修正**（见 MAP-PHYSICS-CORRECTION.md）：

```c
// 陆跳竖直速度 (0x9BD1FD):
//   numerator   = decrypt([move+0x198]+0x48)   // 字段名未知，不是 Physics.img 字段
//   jumpSpeed   = *(double*)([0xBDD498]+8 + 0x70)   // +0x70 = jumpSpeed（不是 gravityAcc）
//   denominator = decrypt([move+0x190]+0x24)   // 字段名未知，不是 Physics.img 字段
//   verticalVel = -(numerator * jumpSpeed) / denominator
//   if (param1 != 0) verticalVel *= 0.7  // 二次跳衰减

// 无立足点分支 (0x9BD3AD):
//   乘 +0x48 = swimSpeed，结果写入竖直速度 +0x68

// 乘 +0x90 和 +0x58 的分支 (0x9BD3D4):
//   +0x90 = flyJumpDec, +0x58 = flySpeed

// 水平速度:
//   horizontalVel = -(decrypt([move+0x198]+0x6C) × global48 × speedParam × 5.0)
//   global48 = *(double*)([0xBDD498]+8 + 0x48)   // = swimSpeed（初版误标为 walkForce）
```

起跳指令 0x9BD1FD **没有读 gravityAcc**（gravityAcc 在 +0x60）。

已确认的常数（0.3/0.5/1.3 出现在移动对象 +0x150 非零分支，+0x150 是水平键 -1/0/1，不是地图 swim）：
| 地址 | 值 | 含义 |
|---|---|---|
| 0xB0C590 | -0.35355339 | -√2/4，方向系数 |
| 0xB04F40 | 5.0 | 行走力放大 |
| 0xB06458 | 0.7 | 二次跳衰减 |
| 0xB064B0 | 1.3 | 乘 +0x150（水平键）分支 |
| 0xAFEC18 | 0.8 | 速度上限因子 |
| 0xB05538 | 0.3 | 乘 +0x150（水平键）分支 |
| 0xAFEC20 | 0.5 | 乘 +0x150（水平键）分支 |

`move+0x190` 和 `move+0x198` 是 WZ Property 节点指针。写入 +0x198 的函数有 13 个（最相关的是 0x3D36D 和 0x5A133），写入 +0x190 的搜索返回 0——可能是通过虚表或 memcpy 写入的。

## 4. +0x80/+0x98 绳索矩形

反编译代码中 **Ghidra 将 +0x80 渲染为 `param + 0x20`（int* 索引 ×4 = 0x80）**，将 +0x98 渲染为 `param + 0x26`。绳索函数 0x5D7D4F 在 Ghidra 中未找到独立条目。

已有的分析（MAP-MOTION-REVERSE.md）已经确认：
- +0x80 是 x 矩形一端
- +0x98 是 y 矩形一端
- 两者组成绳索/梯子的命中矩形
- 写入来源未见

## 5. 攻击 swing/stab 选择

攻击分派器 0x55C5B2 有 **57,191 字符**的反编译代码。搜索发现：
- `DAT_00bddb10`（动作表基址）出现 0 次 — Ghidra 可能把它渲染为 `&DAT_00bddb10` 或 `PTR_DAT_00bddbXX`
- 索引 `0x10` 出现 16 次（有些可能是 stabO1，有些是无关的）
- 索引 `5` 出现 0 次直接与动作表关联

在反编译输出中发现：
```c
*(undefined **)(ebp - 0x340) = &DAT_00bddb10 + localIndex * 0x18;
```
这证实动作表确实在反编译代码中，但 Ghidra 使用了不同的变量名。

**实际写入**：在 0x963448 处，代码计算 `motionTable[index].field_0x10 * speedParam / motionTable[index].field_0xC`，然后把结果写入某个速度字段。swing/stab 的选择逻辑可能在这个巨大函数的更深分支中，需要更精确的分支追踪。

## 6. 坐下/蹲下 +0x158

反编译代码揭示写入模式：
```c
*(undefined4 *)((-(uint)(param_1[0x3ca] != 0) & param_1[0x3ca] - 0xcU) + 0x158) = 1;
```

这是 Ghidra 对加密指针的典型渲染：先做 cookie 校验（param_1[0x3ca]），再解密指针（减 0xC），最后写 +0x158 = 1。

**无动作名写入**。函数体内没有出现任何字符串引用（FUN_007a48d0 调用），说明 `sit` 或 `prone` 动作名不在这个函数中。坐下的视觉效果可能在调用方（0x955C96 的动作号 0x33 分支）中设置，或者在虚表 `+0x14` 的调用中。

## 7. field+0x13C bit 17 (forbidFallDown)

反编译代码清晰显示：
```c
uVar4 = *(uint *)(iVar3 + 0x13c) >> 0x11 & 1;
```

即 `field+0x13C` 右移 17 位再取 bit 0 = **bit 17**。这个值在下跳门控函数 0x55308C 中作为第一个前置条件之一：如果 `FUN_005024C5()` 返回 0 **并且** bit 17 为 1，则阻止下跳。

0x20000 未直接出现是因为 Ghidra 把 `>> 0x11 & 1` 优化了（等价于 `(val & 0x20000) != 0`）。

**字段名**：这个位在 WZ 中可能对应 `forbidFallDown` 或 `blockFallDown`，但在函数体内没有出现字符串。

## 8. 同图传送坐标写入

在所有 52K 函数中搜索**同时写入 +0x20 和 +0x38** 且靠近传送上下文的函数，结果为 0。

在 Ghidra 的 int* 索引中，+0x20 对应 `[param + 8]`，+0x38 对应 `[param + 14]`。可能的原因：
- Ghidra 将位置写入渲染为对 `FUN_006131f4` 返回值的赋值，而不是直接 `+0x20 = value`
- 坐标写入发生在虚表方法中（如 `(*vtbl[0x10])()` 返回坐标）
- 位置可能是加密存储的（用 FUN_006131f4 写入，用 FUN_00548806 读出）

在绳索函数 0x5D7D5A 中已有记录："命中后把 +0x20 写成记录 +0xC"——这说明 +0x20 确实是 x 坐标。写入方式是通过虚表或加密调用链。

---

## 总结

| 缺口 | 状态 | 新发现 |
|---|---|---|
| 1. swim 标志连接 | **UNKNOWN** | 静态搜索穷尽；数据侧确认 SwimArea 矩形是来源（MAP-DATA-SIDE-FINDINGS.md） |
| 2. swim 动作名 | **已解决（否定式）** | WZ 149 动作中无 swim；水中沿用当前动作 |
| 3. 跳跃字段名 | **部分解决** | Physics.img 系数已核实（+0x70=jumpSpeed）；decrypt 参数名仍未知；19 个常数值已从 WZ 提取 |
| 4. +0x80/+0x98 | **名字已知** | 对应 Rope 记录的 x/y1/y2（数据侧确认字段名），写入代码未见 |
| 5. swing/stab | **PARTIAL** | 动作词表齐全（数据侧）；选择逻辑在 57KB 函数的运行时调用里 |
| 6. 坐下 +0x158 | **名字已知** | 写入 1；数据侧确认动作名 `sit`（+sit2-6 座高变体）与 [group]Seat |
| 7. bit 17 | **已确认** | `field+0x13C >> 17 & 1`，阻止下跳 |
| 8. 传送坐标 | **UNKNOWN** | 位置写入通过加密调用链，非直接赋值 |
