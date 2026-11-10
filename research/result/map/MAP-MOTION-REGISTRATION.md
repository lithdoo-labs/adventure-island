# 动作表登记序列 — 从原始数据 + 反编译提取

日期: 2026-11-10。本文回答：客户端动作表（0xBDDB10，149 项 × 0x18）的槽号顺序从哪来、
能恢复到什么程度。数据来源：原始 Character.wz（wzpy 第三方库解析）+ Ghidra 反编译登记函数。

## 方法论修正记录

1. **FSDB 不是"重排了顺序"**——用 wzpy（`.work/tools/wz-python`，region=EMS）直接解析
   原始 `Character.wz`（version 79），确认 **WZ 文件本身的节点顺序就是字母序**
   （airstrike → vampire → walk1 → …）。FSDB 忠实保留了原序。之前"FSDB 把顺序弄丢了"的判断是错的。
2. **WZ 字母序 ≠ 动作表槽序**。锚点（swingO1=5、stabO1=16、ladder=36、rope=37，来自登记
   写入地址（表项地址-基址)/0x18）与字母序（swingO1=125）不符。
   **表槽序 = 客户端登记函数的调用顺序。**

## 登记函数与序列（新发现，7/7 验证通过）

登记函数 RVA 0xA7F89（VA 0x4A7F89，50,775 字符）按固定模式调用 149 次：

```c
FUN_007a48d0(&str, <字符串号>);   // 从客户端内部字符串表按编号取动作名
FUN_00406368(...);                 // 字符串处理
FUN_004aee0b(<flag>, 0);           // 初始化表项 {entry+0=动画对象, entry+4=flag, ...}
[ebp-4] = <槽号>;                  // 槽号 = 调用序号（0..148）
FUN_004aa4ae(...);                 // 提交
```

从反编译代码按序提取全部 149 个 `(槽号, 字符串号, flag)` 三元组，结果在
`research/result/map/MOTION-REGISTRATION-SEQUENCE.csv`。

### 验证（与既有反汇编证据交叉核对，全部通过）

| 事实 | 来源 | 结果 |
|---|---|---|
| slot 5 = swingO1（ID 853） | 0xBDDB88 写入地址 | PASS |
| slot 16 = stabO1（ID 864） | 0xBDDC90 写入地址 | PASS |
| slot 36 = ladder（ID 882） | 0xBDDE70 写入地址 | PASS |
| slot 37 = rope（ID 884） | 0xBDDE88 写入地址 | PASS |
| slot 0x18/0x1C = swingO1 重复 | MAP-MOTION-REVERSE.md | PASS（都是 ID 853） |
| slot 0x1E = stabO1 重复 | MAP-MOTION-REVERSE.md | PASS（ID 864） |

序列前段（0x00-0x25）：

| 槽 | ID | 槽 | ID | 槽 | ID |
|---|---|---|---|---|---|
| 0 | 850 | 10 | 858 | 24 | 853=swingO1 |
| 1 | 851 | 11 | 859 | 25 | 854 |
| 2 | 878 (flag1) | 12 | 860 | 26 | 855 |
| 3 | 879 (flag1) | 13 | 861 | 27 | 875 |
| 4 | 5460 (flag1) | 14 | 862 | 28 | 853=swingO1 |
| 5 | **853=swingO1** | 15 | 863 | 29 | 855 |
| 6 | 854 | 16 | **864=stabO1** | 30 | 864=stabO1 |
| 7 | 855 | 17 | 865 | 31 | 5480 |
| 8 | 856 | 18 | 866 | 32 | 870 |
| 9 | 857 | 19-21 | 867-869 | 33 | 871 |
| — | — | 22-23 | 872-873 | 34 | 881 |
| — | — | — | — | 35 | 5486 |
| — | — | — | — | 36-37 | **882=ladder, 884=rope** |

## 已知动作号的解码（用序列查 ID）

| 动作号 | 上下文 | 字符串号 |
|---|---|---|
| 0x61 (97) | 攻击备选 A（0x55C5B2 的 -0xC68=0x61 分支） | 955 |
| 0x57 (87) | 攻击备选 B | 945 |
| 0x4E (78) | 攻击备选 C | 3548 |
| 2 | 0x95A31E 动作号 2 | 878 (flag1) |
| 10 (0x0A) | 0x95A31E 动作号 10 | 858 |
| 0x33 (51) | 0x955C96 坐下分支动作号 | **883**（紧邻 ladder=882/rope=884） |

注意：ID 883 紧挨 ladder(882)/rope(884)，且出现在坐下上下文（0x33）——
若字符串表局部有序，883 的候选是 "ladder2" 或 "sit"，**不能靠字母序断定**（见下节）。

## 字符串号 → 名字：已通过受控运行时读取完全解决

经授权，使用 task-036 的现有 QEMU 内存转储（`E:\vm-store\task-036-captures\t036-mem.elf`，
物理转储）+ `proc-vamap.csv`（task-036 留下的进程 VA→物理页映射）完成受控读取：

1. 通过页表映射读全局 `DAT_00be2000` = 0x29A6FC（运行时字符串表，已初始化）
2. 动作表 0xBDDB10 每项 +0x00 = 动画对象指针（0x29D2EC..0x29F14C，低地址堆）
3. **单元 +0x00 的目标 = 该槽位自己名字的字符串单元**（短名内联 UTF-16，长名 ASCII 指针）
4. 全部 149 个槽名提取成功，7 个已知锚点全部命中，143 个字符串号交叉验证零矛盾

完整结果：`research/result/map/MOTION-SLOT-NAMES.csv`。

### 最终槽位表（149 项）

前 46 槽（核心动作）：

| 槽 | 名字 | 槽 | 名字 | 槽 | 名字 | 槽 | 名字 |
|---|---|---|---|---|---|---|---|
| 0 | walk1 | 12 | swingTF | 24 | swingO1※ | 36 | **ladder** |
| 1 | walk2 | 13 | swingP1 | 25 | swingO2 | 37 | **rope** |
| 2 | stand1 | 14 | swingP2 | 26 | swingO3 | 38 | dead |
| 3 | stand2 | 15 | swingPF | 27 | shootF | 39 | **sit** |
| 4 | alert | 16 | **stabO1** | 28 | swingO1※ | 40-44 | sit2-sit6 |
| 5 | **swingO1** | 17 | stabO2 | 29 | swingO3 | 45 | tired |
| 6 | swingO2 | 18 | stabOF | 30 | stabO1※ | 46-50 | alert2-6 |
| 7 | swingO3 | 19 | stabT1 | 31 | heal | 51 | ladder2 |
| 8 | swingOF | 20 | stabT2 | 32 | proneStab | 52 | rope2 |
| 9 | swingT1 | 21 | stabTF | 33 | prone | 53 | shoot6 |
| 10 | swingT2 | 22 | shoot1 | 34 | fly | 54-57 | magic1/2/3/5 |
| 11 | swingT3 | 23 | shoot2 | 35 | jump | | |

※ = 重复登记（攻击位 2/3）。58-148 为技能动作（savage、brandish、ghost 系列、
combo 系列……到 148 windshot），完整清单见 CSV。**注意：magic4 不在表内**
（WZ 有 magic4，客户端未登记）。

### 反汇编硬编码动作号的最终解码

| 动作号 | 上下文 | 名字 |
|---|---|---|
| 0x61 (97) | 攻击分派备选 A（-0xC68=0x61 分支） | **backstep** |
| 0x57 (87) | 攻击分派备选 B | **eorb** |
| 0x4E (78) | 攻击分派备选 C | **showdown** |
| 0x02 | 0x95A31E 动作号 2 | **stand1** |
| 0x0A | 0x95A31E 动作号 10 | **swingT2** |
| 0x33 (51) | 0x955C96 的 0x33 分支 | **ladder2**（不是 sit！sit=0x27） |

## 受控运行时读取的完整方法链（可复现）

1. 物理转储：`E:\vm-store\task-036-captures\t036-mem.elf`（2GB，QEMU）
2. VA→物理：`.work/task-036/proc-vamap.csv`（task-036 页表遍历产物）
3. 读 `0xBDDB10 + slot*0x18 + 0x00` → 动画对象指针
4. 读对象 `+0x00` → 名字字符串单元（UTF-16 内联或 ASCII 指针）
5. 脚本：`.work/task-063/final_names.py`（校验：7 锚点 + 143 ID 零矛盾）

### 隐含的字符串号→名字映射（143 个，完整可查）

由（槽→字符串号）×（槽→名字）联立得出：850=walk1, 851=walk2, 878=stand1,
879=stand2, 5460=alert, 853=swingO1, 854=swingO2 … 864=stabO1 … 882=ladder,
883=ladder2, 884=rope, 885=rope2 …（字母序邻域规则在字符串表内成立）。

## 对实现的含义（更新）

- 任何反汇编里的动作号现在都能查名字（`MOTION-SLOT-NAMES.csv`）。
- 坐下动作 = 0x27 (sit)；**0x955C96 的 0x33 分支是 ladder2（爬梯姿态）**，
  修正此前"sit 上下文"的猜测。
- 之前"149 槽 vs 149 节点是数量巧合"的判断部分成立：表内确有重复登记
  （swingO1×3、stabO1×2 等），且缺 magic4——它不是 WZ 节点的镜像。
- 游戏实现直接用名字（WZ 149 动作词表）即可，索引体系只用于读反汇编。
