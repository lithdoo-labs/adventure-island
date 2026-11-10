# 攻击动作选择机制 — swing/stab 缺口闭合

日期: 2026-11-10。方法：反编译分派链 + 变体表静态/运行时双转储 + 149 槽名表解码。
全部动作号已经 `MOTION-SLOT-NAMES.csv` 命名验证。

## 解析链（自上而下）

57KB 攻击分派器（VA 0x95C5B2）按状态分流：

```c
if (状态A (-0xd58 != 0))        motion = 0x4E = showdown;
else if (状态B (-0xd54 != 0))   motion = 0x57 = eorb;
else if (状态C (-0xd20 != 0))   motion = 0x61 = backstep;
else {
    motion = FUN_00773491(攻击类型1-9, 武器, 技能, 武器数据, 随机数);
    if (motion < 0) motion = -1 → 上层放弃;
}
```

showdown/eorb/backstep 是**特殊状态攻击**（0x955C96 附近的 0x2d/0x2e/0x2f/0x27/0x30/0x31
命令检查配套），不是常规武器路径。

## 主选择器 FUN_00773491（VA 0x773491）

```c
if (攻击类型 < 1 || > 9) return -1;
row = (攻击类型-1) * 2;                    // 普通行
if (技能对象 != 0) {
    if (!武器检查(武器)) return -1;         // FUN_00773381: 武器类别范围表
    if (武器自带动作表(武器数据)) {          // FUN_00773346
        if (技能[0xC] != 3)
            return 武器动作表[随机 % 数量];   // FUN_007732e0: 武器+0x18 {count, frames[]}
    }
    else if (技能[0xC] != 3) 保持普通行;
    row = (攻击类型-1)*2 + 1;               // 技能行
}
count = TABLE[row].count;
if (count < 1) return -1;
return TABLE[row].frames[随机 % count];     // 随机变体！
```

## 变体表（VA 0xBA59B8，静态=运行时已核对）

18 行 × 0x10 字节 `{count, frames[3]}`：

| 攻击类型 | 普攻 | 技能 |
|---|---|---|
| 1, 2 | 空（count=0） | 空 |
| 3（弓） | shoot1 | shootF |
| 4（弩） | shoot2 | shoot2 |
| 5, 6 | 空 | 空 |
| 7（近战） | **swingO1/O2/O3 均匀随机** | **swingO1/O2/O3 均匀随机** |
| 8 | 空 | 空 |
| 9（枪） | shot | shot |

关键结论：
1. **近战普攻 = swingO1/swingO2/swingO3 按 `随机 % 3` 播放** —— 经典 MapleStory
   随机攻击动画的机制本体。
2. 类型 1/2/5/6/8 在静态与运行时（角色选择界面、未持武器）均为空。这些行要么
   属于未用武器类别，要么在持武器时由武器数据填充——**当前转储未含持武器状态，
   无法区分**，已在缺口清单如实标注。
3. stabO1 系（槽 16-21）**不经此表**：技能动作在 WZ 层引用 stabO1 等作为基础
   动作（FSDB Look 数据里 handgun/holyshield/straight 等都引用 stabO1 帧）。
4. 特殊武器可带自己的动作列表（武器+0x18 的 {count, frames[]}），覆盖类别表。

## 对实现的直接规则

```
近战普攻:  motion = [swingO1, swingO2, swingO3][rand() % 3]
弓普攻:    shoot1
弩普攻:    shoot2
枪普攻:    shot
技能攻击:  用 WZ 技能动作定义（多数引用 stabO1/swingO3 等基础帧）
特殊状态:  showdown / eorb / backstep（对应特殊职业/变身态）
```

## 证据与校验

- 选择器反编译（本文件）+ 变体表 0xBA59B8 静态转储 + 运行时（QEMU 转储 + 页表映射）核对前 6 行一致
- 全部帧号（22/23/24/25/26/27/28/29/98）经 149 槽名表解码为可读动作名
- 调用者上下文（-0xC68 赋值链）与 FUN_00773381 武器范围表互证

## 剩余小开口

- 类型 1/2/5/6/8 空行的语义（未用 vs 持武器填充）需要**游戏内、持武器**的转储才能定论
- FUN_00773381 的武器 ID 范围表（0xa9634c、0xe4e5aa 等）未逐项解码——不影响实现
