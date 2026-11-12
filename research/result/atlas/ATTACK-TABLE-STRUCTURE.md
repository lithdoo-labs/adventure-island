# 攻击变体表最终结构（表级确证）

日期: 2026-11-12。基于两个读者函数（0x373491/0x3736bb）指令级解读。

## 表布局（0xBA59B8，18 项 × 0x10 字节）

```
entry[i] (16 字节):
  +0x00: u32 count       // 动作变体数（0 = 无效，返回 0xFFFFFFFF）
  +0x04: u32 variant[3]  // 动作槽位索引（最多 3 个，如 swingO1/O2/O3 槽）
```

## 索引规则

```
武器类 param_1 ∈ [1,9]（出界返回失败）
iVar1 = weaponClass * 2 - 2   // 普通攻击行
     或 weaponClass * 2 - 1   // 状态行（当 [attackState+0xc]==3 时）
```

即 9 武器类 × 2 状态 = 18 行。

## 动作选择（FUN_00403491 = 选择器）

```c
if (entry[i].count < 1) return -1;
return entry[i].variants[rand % entry[i].count];   // ← swingO1/O2/O3 随机在表级确证
```

param_5 = 随机源；`param_5 % count` = 均匀选取。

## 动作验证（FUN_007736bb = 验证器）

遍历 entry[i].variants 检查 motionId 是否合法（网络包来的动作 id 必须在表内 → 反外挂校验）。

## 前置判定链

- FUN_00773381(param_2) = 武器双手判定
- FUN_00773346(param_4) = 长枪/特殊武器判定（若真则走 FUN_007732e0 特殊路径 = PoleArm 动作集）
- [param_3+0xc]==3 = 攻击状态 3（技能/下劈类）

## 运行时状态

表内容运行时填充（无静态写者——经指针间接初始化）；
t036 捕获（选角）时为全零 ✓ 与进图后填充一致。

## 音频边界确证（本轮附带）

- 5 个游戏 DLL（Gr2D/Canvas/Shape2D/NameSpace/ResMan）字符串+API 双重扫描：**零音频**
- 结论：音频在壳保护的导入层或第 6 个动态模块中，需进图捕获
