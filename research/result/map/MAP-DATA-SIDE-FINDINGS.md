# 数据侧发现 — FSDB 提取数据解答移动物理缺口

日期: 2026-11-10。来源: `E:\ai-local-wz-fsdb\full\[FSDB]cms`（WZ 全量 FSDB 提取）。
本文所有字段名与数值直接来自 WZ 数据，与二进制反编译证据互相印证。

## 1. Physics.img 实际数值（全部 19 个字段）

来源: `[struct]Physics/default.json`：

| 字段 | 值 |
|---|---|
| walkForce | 140000.0 |
| walkSpeed | 125.0 |
| walkDrag | 80000.0 |
| slipForce | 60000.0 |
| slipSpeed | 120.0 |
| floatDrag1 | 100000.0 |
| floatDrag2 | 10000.0 |
| floatCoefficient | 0.01 |
| swimForce | 120000.0 |
| swimSpeed | 140.0 |
| flyForce | 120000.0 |
| flySpeed | 200.0 |
| gravityAcc | 2000.0 |
| fallSpeed | 670.0 |
| jumpSpeed | 555.0 |
| maxFriction | 2.0 |
| minFriction | 0.05 |
| swimSpeedDec | 0.9 |
| flyJumpDec | 0.3499999940395355 |

与存储布局对应（见 MAP-PHYSICS-CORRECTION.md）：数值存于 `[0xBDD498]+8` 所指 double 数组，
偏移 = 加载顺序 × 8（walkForce=+0x00 … flyJumpDec=+0x90）。

## 2. SwimArea（游泳区域）— 矩形定义

来源: `[group]SwimArea`，.desc.meta = "游泳区域"。格式：

```json
{"x1":1920,"y1":124,"x2":3601,"y2":274}
```

全数据集仅 5 张地图有游泳区域：

| 地图 | 矩形 (x1,y1)-(x2,y2) |
|---|---|
| 108010700 | (1920,124)-(3601,274) |
| 120000000 | (-606,207)-(5318,302) |
| 120000301 | (-400,-45)-(401,375) |
| 140020300 | (1920,124)-(3601,274) |
| 970020000 | (-360,184)-(1260,336) |

**含义**：地图的"swim"状态 = 角色坐标位于任一 SwimArea 矩形内。
这与代码侧发现互补：地图加载函数 0x13602C 读取 WZ 属性名 `swimArea`（RVA 0x7A1650，ASCII）。
field+0x150 大概率就是 SwimArea 命中结果；但复制到全局 [0xBDF54C]+0x150 的指令仍未找到。

## 3. Rope（绳和梯）— l 字段在数据侧的名字确认

来源: `[group]Rope`，.desc.meta = "绳和梯"。格式：

```json
{"l":1,"uf":1,"x":975,"y1":127,"y2":363,"page":1,"id":1}
```

| 字段 | 含义 |
|---|---|
| `x` | 绳/梯的水平位置（竖直物体，单一 x） |
| `y1`, `y2` | 竖直范围 |
| `l` | **1 = 梯（ladder），0 = 绳（rope）** |
| `uf` | 附加标志（推测与顶部/底部通过行为有关） |
| `page` | 图层 |

这就是用户反汇编确认的"记录 +4 = l 字段"。命中矩形端点 +0x80/+0x98 对应 x/y1/y2。

## 4. 角色动作全表（149 个 = 二进制动作表 149 项）

来源: `[struct]Look/00002000.json`（默认身体 img）。
顶层节点数 **149**，与二进制动作表（0xBDDB10-0xBDE908，0xDF8/0x18 = 149 项）**数量完全一致**
——动作表就是按这个 img 的节点顺序加载的。

### 关键结论

1. **没有 `swim` 动作。** 149 个节点中不存在名为 swim 的节点。
   水相关动作只有：`float`(1帧)、`fly`(2帧)、`ghostfly`(2帧)。
   代码侧证据吻合：主物理函数 swim 分支只写速度、从不引用动作表（0xBDDB10）。
   **水中角色沿用当前动作（walk/stand/jump 照常播放）。**

2. **`sit` 存在**（1 帧），且 sit2-sit6 是坐垫高度变体（带 `move:[0,-45]` 等偏移）。
   [group]Seat（"可坐下的坐标"，`{index,x,y}`，89 张地图）与之配套。
   代码侧 +0x158=1 的写入对应进入坐下状态。

3. **`prone`/`prone2`/`proneStab` 存在**（趴下/蹲下动作名）。

4. **`ladder` 与 `rope` 是两个独立动作**（各 2 帧；`ladder2`/`rope2` 是别名版）。
   索引相邻（0x24/0x25）。**选择规则（实现用）：动作名 = l==1 ? "ladder" : "rope"。**
   代码侧选择路径仍是运行时计算，未找到静态痕迹。

5. 攻击动作词表齐全：swingO1/O2/O3/OF、swingP1/P2/PF（及 PoleArm 变体）、
   swingT1/T2/T3/TF、stabO1/O2/OF、stabT1/T2/TF。
   swing/stab 的选择逻辑仍封在 57KB 攻击分派函数的运行时调用里。

### 完整动作名清单（按字母序）

airstrike, alert, alert2-6, assassination, assassinationS, assaulter, avenger,
backspin, backstep, bamboo, blade, blast, blizzard, brandish1/2, burster1/2,
cannon, chainlightning, combatStep, comboFenrir, comboSmash, comboTempest,
coolingeffect, darksight, dash, dead, demolition, doublefire, doubleSwing,
doubleupper, dragonstrike, eburster, edrain, eorb, fake, finalBlow,
finalCharge, finalToss, fireburner, firecurtain, firestrike, fist, flamegear,
**float**, **fly**, fullSwingDouble, fullSwingTriple, genesis, ghostfly,
ghostjump, ghostladder, ghostproneStab, ghostrope, ghostsit, ghoststand,
ghostwalk, handgun, heal, holyshield, homing, info, **jump**, **ladder**,
ladder2, magic1-5, magnumshot, meteor, ninjastorm, octopus, overSwingDouble,
overSwingTriple, paralyze, **prone**, prone2, proneStab, pyramid, rapidfire,
recovery, resurrection, rollingSpin, **rope**, rope2, rush, rush2, sanctuary,
savage, screw, shockwave, shoot1/2/6, shootF, shot, showdown, **sit**, sit2-6,
smokeshell, snatch, somersault, soulblow, souldriver, **stabO1**, stabO2,
stabOF, stabT1, stabT2, stabTF, stand1, stand2, stormbreak, stormbreath,
straight, **swingO1**, swingO2, swingO3, swingOF, swingP1, swingP1PoleArm,
swingP2, swingP2PoleArm, swingPF, swingT1, swingT2, swingT2PoleArm, swingT3,
swingTF, timeleap, torpedo, triplefire, tripleSwing, vampire, **walk1**,
**walk2**, wave, windshot, windspear

（有独立画布资源的仅 42 个：alert, dead, eburster, fly, ghost×8, heal, jump,
ladder, proneStab, rope, shoot1/2/F, sit, stabO1/O2/OF, stabT1/T2/F, stand1/2,
swingO1/O2/O3/OF, swingP1/P2/PF, swingT1/T2/T3/TF, walk1/2 —— 其余是动作别名。）

## 5. 动作表的代码侧结构（补充）

- 表基址 0xBDDB10（文件偏移 0x7DDB10），每项 0x18 字节，149 项，至 0xBDE908。
- `FUN_004acf31`：动作名→索引解析器。逐项比较名字，命中返回索引，未找到返回 -1。
- `FUN_004acf03`：索引→表项。读 entry+0（动画对象指针），对 entry+0x8 调用
  `(*DAT_00afe1bc)`（推测 AddRef）。
- 静态映像中表项指针（0x0029xxxx）为**加密值**，运行时由
  0xBAADF00D 初始密钥的滚动 XOR 族函数（FUN_00548806 / FUN_006131F4）解密。
- **无任何函数硬编码 ladder(0x24)/rope(0x25) 索引**——索引全部运行时计算。
- 解析器的调用者只有 6 个，其中 0x36C83B 呈现
  `WZ读取(FUN_007a48d0) → 字符串操作 → 解析(FUN_004acf31)` 管道：
  **动作名本身也是 WZ 数据驱动**。

## 6. 对缺口的最终状态

| 缺口 | 状态 | 结论 |
|---|---|---|
| ~~Physics 常数值~~ | **已解决** | 19 个字段全部有实际数值 |
| ~~swim 动画名~~ | **已解决（否定式）** | 不存在 swim 动作；水中沿用当前动作 |
| ~~sit 动作名~~ | **已解决（数据侧）** | `sit`（+sit2-6 座高变体），配套 [group]Seat |
| ~~prone（蹲下）动作名~~ | **已解决（数据侧）** | `prone`/`prone2`/`proneStab` |
| ~~l → ladder/rope 选择~~ | **实现已可行** | l=1→"ladder"，l=0→"rope"；代码路径未溯源 |
| ~~Rope 记录字段名~~ | **已解决** | x, y1, y2, l, uf, page |
| ~~动作索引体系~~ | **已解决** | 149 槽全命名（运行时转储验证，见 MAP-MOTION-REGISTRATION.md） |
| ~~swing/stab 选择~~ | **已解决** | 近战=swingO1/2/3 随机等（变体表 0xBA59B8），见 MAP-ATTACK-SELECTION.md |
| swim 标志连接 | 未解决 | SwimArea 矩形命中是数据来源；复制指令未找到。游戏内转储被自旋锁死阻塞（MAP-CAPTURE-CAMPAIGN-063.md F2） |
| 水中跳速度写入 | 未解决 | 同上（F2 阻塞） |
| decrypt 参数名 | 未解决 | 同上（F2 阻塞）；分析链已就绪 |
| 逐步积分 | 未解决 | 常数已齐，游戏内验证被阻塞 |
| +0x80/+0x98 写入 | 未解决 | 名字对应 x/y1/y2，写入代码未见 |
| bit 17 ↔ forbidFallDown | 未解决 | 仅知是下跳门闩 |
| 同图传送坐标写入 | 未解决 | 走加密调用链 |
