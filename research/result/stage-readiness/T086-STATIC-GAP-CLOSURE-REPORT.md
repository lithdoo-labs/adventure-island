# T086 — CMS079 纯静态逆向缺口闭合（G08/G09/G10/G24/G17）

Round: T086 (2026-11-15). Branch: `design/adventure-field-map-scene`. Baseline
`8630b9814903378fc8a8f381008eddfff956e7d6`（开工时远程 HEAD 重新核验，与本轮工作基线一致）。

Binary identity（每轮工具运行前 sha-pinned）：
- EXE `.work/task-036/game-image-unpacked.bin` `d4a67597…a31718`（linear，VA−0x400000）
- Gr2D `.work/task-001/extracted/冒险岛online/Gr2D_DX8.dll` `ad67b9a0…f6a25d1`（PE，0x50400000）
- 服务端 `server079.jar`（recvops/sendops.properties 内含）

约束遵守：**零运行时行为**——无原版客户端启动/登录/调试/dump/采样；全部结论来自原始字节。
本轮所有报告级结论类型（STATIC-CONFIRMED 等）仅用于本报告，不进入权威 CSV status。

---

## 执行摘要

| WP | Gap | 结论类型 | 一句话结果 |
|---|---|---|---|
| WP0 | G17 | **PARTIAL-STATIC**（报告级） | 442 条数值全部溯源到 jar properties（0 冲突）；C-047 "not on disk" 描述过时；新增 92 条客户端静态指令绑定（0xA10CE3 开关）；原版权威性残项被精确界定 |
| WP1 | G24（及 G01/G07/G22/G33） | **STATIC-CONFIRMED** | slot25 产物节点类完整定身（ctor 0x504067D7、主 vtable 0x5042E3F0 76 槽、IID 6DC8C7CE）；该节点主表之 slot45 = 键控有序树插入（注意：C-012/C-013 时代"已知 22 候选 vtable 上 [eax+0xB4]=有序插入"的笼统断言**维持已撤销**——本轮结论来自当年候选集之外、本轮新定身的 0x5042E3F0 主表）；**比较器 0x50403A42 静态寻获并读取** |
| WP2 | G08 | **STATIC-CONFIRMED** | CMS079 原版 avatar 键公式从机器码恢复：`10*(layer*3000−zM) − 2^31 + 29990 + (flag≠0 ? 7 : 2)`；v83 假设结构成立但常量未照搬 |
| WP3 | G09 | **STATIC-CONFIRMED**（排序/遮挡机制） | 跨对象遮挡 = WP1 容器/比较器 + WP2 键空间（与 tile/obj 同一机制）；zmap 149 层在随包 Base.wz 精确对齐 C-043；smap 106 条部件绑定 + zmap_cn 恒等 |
| WP4 | G10 | **PARTIAL-STATIC** | slot15 调用点普查完备（28 disp8 + 0 其他编码 + 0 直接调用）；slot12 帧循环调用者 0x5658CA 新发现；相机矩形=调用方临时参数（结构性结论）；生产者身份仍运行时 |

未关闭项（诚实边界）：G10 的每帧相机矩形生产者、G24 的 PCOM 引擎类绑定运行时确认（缩为佐证性）、G17 的"从未上线观察且无客户端绑定"子集的原版权威性。项目维持 **NOT STAGE-READY**。

---

## 1. WP0 — G17 opcode 数值静态来源审计

### 1.1 溯源矩阵（EV-83 = `T086-G17-OPCODE-PROVENANCE.csv`，442 行全量）

对本仓 442 条协议记录与 jar 内 properties 的全量 join（`research/scripts/t086_wp0_opcode_provenance.py`）：

| 来源类别 | 行数 | 说明 |
|---|---|---|
| SERVER-PROPERTIES | 355 | 数值 == jar property 值（含相对形式 `SHOW_ITEM_GAIN_INCHAT 1` 按 ExternalCodeTableGetter 解析） |
| SERVER-PROPERTIES-FF | 11 | property 显式 `0xFF`（禁用占位） |
| DEFAULT-FFFE | 76 | enum 名不在 properties 中 → `ExternalCodeTableGetter.populateValues` 默认 `(short)-2` = 0xFFFE（75 个 jar enum 常量 + MARRAGE_RECV） |
| PROPERTIES-CONFLICT | 0 | 无 |
| NO-PROPERTY | 0 | 无 |

**C-047 的"367"来源澄清**：442 − 75（jar enum 缺失的 FFFE 行）= 367 —— 即当时记为"缺数值"的行数；其 BLOCKED 理由 "server properties file not on disk" **已经过时**：properties 就在 `server079.jar` 内（148 recv + 218 send 条目），且 task055 已将其并入语料（protocol-opcodes.csv 与 task055 c2s/s2c 365/217 行全一致）。

### 1.2 与公开 v079 服务器的关系

- **mrzhqiang/ms079**（目录 MS079-05）：148 recv + 218 send 全部同名同值（0 冲突）→ 本 jar properties 与该公开服务器同源。
- **Afauria/MapleStory-Server-079**（MS079-06）：recv 5 处、send 10 处共 **15 个名字冲突**（LEFT_KNOCK_BACK/SNOWBALL/SKILL_MACRO/ENGAGE_*/BBS_OPERATION/BOAT_EFFECT/CATCH_MONSTER/MOVE_PLATFORM/SHOW_ITEM_EFFECT/DATA_CRC_CHECK_FAILED/ARIANT_SCOREBOARD/FAIRY_PEND_MSG/REPORT_PLAYER/SPOUSE_CHAT…）→ 公开 079 生态对这些 opcode 存在真实分歧，不能默认任何一家等于原版。
- 其中 6 个（0x45/0x46/0x60/0x6D/0x72/0x74）落在客户端 0xA10CE3 派发范围内且有静态 handler（§1.3）→ 客户端指令侧已裁定采用 jar/ms079 值。

### 1.3 客户端指令侧新证据（EV-84 = `T086-G17-CLIENT-DISPATCH-0xA10CE3.txt`）

EXE `0xA10CE3`：`mov edx,[ebp+8]; lea eax,[edx-0x20]; cmp eax,0x60; ja default; jmp [eax*4+0xA111A1]`
—— **97 个 case（值 0x20..0x80）的索引跳转开关**，每个 case stub `push [ebp+0xC]; call <handler>; jmp tail`。与 task44 运行时 handler 图 **92/92 全一致**（task44 的 handler_rva 是 RVA，+0x400000 后逐 case 精确匹配；5 case 为 default）。handler 体以 `0x4066C9` 读包字节（C-062/C-090 已证该读取器）→ 该总线为入站包消费通道。

由此：**92 个 S2C opcode 数值获得客户端机器指令级绑定**（此前只有运行时观察级）。combined 证据层：task048 已证 17/18 线上观察值与 properties 一致（WARP_TO_MAP=0x81、SPAWN_PLAYER=0xA2 等在真实线上出现）。

### 1.4 G17 裁定

- "367 个数值未确认"的旧框架**过时**；改为三层： 已溯源（442 全部 → 公开 079 repack jar）； 客户端指令绑定 92 + 线上观察 ~17； 原版权威性不可静态证明的子集 = 从未上线观察、不在 0x20..0x80 客户端派发、且公开生态分歧的名字（15 冲突中 9 个未裁定 + 从未出现的长尾）。
- G17：BLOCKED → **PARTIAL-STATIC**（新 verified_scope 记录上述三层；数值绑定不再是阻断项——协议实现可按语义名+jar 值工作，分歧子集以客户端/线上证据优先）。

## 2. WP1 — G24 Gr2D 对象身份与排序链（EV-82）

### 2.1 slot25 产物节点的具体类（STATIC-CONFIRMED）

链路（全部本轮静态指令级）：

```
EXE 0x666F7D call [eax+0xB4]   ← eax = slot25 OUT 对象
Gr2D 0x5040418C (slot25):
  0x50404215  mov [ebp+8],0            ← arg1 槽复用为局部（关键：修正"[ebp+8]=this"的窗口内误读）
  0x50404220  call 0x50405846          ← 获取 punk + QI
      0x50406233: [0x5043A198]→0x504074CF→0x504067D7(0)  ← punk 来源
      0x504062AA: QI(punk, IID@0x50436540, out)           ← IID = {6DC8C7CE-8E81-4420-B4F6-4B60B7D5FCDF}
  0x50404239  call 0x50409922          ← helper 填充源 punk
  0x504045CB  mov [ecx],eax            ← *arg15 = [ebp+8] = QI 结果对象
```

**节点 ctor 0x504067D7** 安装四重 vtable：
`+0: 0x5042E3F0（主表，76 代码槽，精确邻接 intmap 0x2E520）`
`+4: 0x5042E3EC；+8: 0x5042E3E8；+0xC: 0x5042E3D0（树载荷接口，6 槽）`

QI（slot0=0x50406AB4）压入 intmap `0x5042E520`：`{piid=0x50436540(6DC8C7CE), dw=0, simple}` 为首项 → **QI(6DC8C7CE) = pThis（主表接口）**。生产路径 slot45/slot56 皆落主表：
- **slot45 (+0xB4) = 0x50409ECD**
- **slot56 (+0xE0) = 0x50409DBA**（ARGB 分解到 [obj+0x38]/[+0x3C]/[+0x34] 子对象 vt+0x24/vt+0x40——与 tile 路径 `slot56(obj,-1)` 即 0xFFFFFFFF 相容）

**G22 修正（STATIC-CONFIRMED）**：0x2E2C4/0x2E2CC "149/151 槽 RawCanvas 家族"实为 **purecall 填充的抽象接口桩表**（0x50402A30 把 0x2E2C4 装到 [owner+0x384] 的 0x10 字节小子对象；0x50402874 装 0x2E2EC/0x2E2D8 到另一子对象——0x2E2D8 起全部是 `jmp [0x5042D0A0]`（__imp__purecall，C-009））。6DC8C7CE 类的**真实主表 = 0x5042E3F0**。G22 的双起点歧义就此消解。

### 2.2 slot45 = 键控有序插入；比较器寻获（G01/G07 STATIC-CONFIRMED）

> 范围声明：C-012/C-013 曾以"22 个已知候选 vtable 的 slot45 均无插入语义"**撤销**了
> "[eax+0xB4] = 有序插入"的笼统断言——该撤销**维持有效**。本轮的新结论来自当年候选集
> **之外**的对象：节点类真实主表 0x5042E3F0（C-098）的 slot45。两者不矛盾：当年的候选
> 表是 0x2E2C4/0x2E2CC 桩表误判下的产物。

`0x50409ECD`（ret 8）：把 `(arg2=键, &node[0xC], node[0xF8])` 以 thiscall 转发给 **`[node+0x2C]` 容器**的 **0x50409EF4**：

- 空容器路径：payload vt slot1 SETKEY（键存 node+0x44）、slot5 SETTAG（node+0xF8）；
- 非空：**0x5040390D** 树搜索（+0x10 偏置的父/子导航）→ 构造迭代器 → payload slot0 GETKEY 与新键比较（setle）→ SETKEY 覆写 → 容器计数 [ebx+0x20]++ → AddRef 对 → **比较器走树定位插入点**（0x50405476 迭代器插入 / 0x5040C35E 树插入）。

**比较器 = `0x50403A42`**（自由函数，非 vtable 槽——这就是历轮"vtable 里找不到比较器"的原因）：
- 对两个 payload 各调 **slot4**（node+0xF8 的链/tag）爬链至可比层；
- 相等情形（0x50403A85）比较两者 **slot0（GETKEY，node+0x44 的键 dword）**：`cmp; jle → +1 / setge,dec → 0/-1` —— **等键 tie-break = 第二键比较（确定性次序，非稳定插入）**（G33 升级依据）；
- 全等返回 0 时对双方 slot3(1) 成对 AddRef（共享节点）。

**结论**：C-075 的"slot45 携带预计算键"解释从"倾向性推断"升级为**指令级证实**；G07 的"比较器端点运行时依赖"被推翻——端点即 Gr2D 静态函数 0x50403A42；G01 的最终排序接收者 = 节点内 `[node+0x2C]` 容器（Gr2D 侧）。

### 2.3 其余 WP1 要求项

- PCOM 注册：Gr2D **不静态导入 PCOM**——0x50401C70 以 `LoadLibraryA("PCOM.DLL")` + GetProcAddress 解析 PcCreateObject/PcFreeUnusedLibraries/PcSerializeObject/PcSerializeString/PcRootNameSpace 五指针；另 0x50402CED 动态载 `D3D8.DLL!Direct3DCreate8`。PCOM 命名空间按 **"Module#Class" 字符串**寻址（实证：helper 0x50409922 以 `L"Shape2D#Vector2D"` + IID 创建 5 个 Vector2D 子对象）。E576EA33→引擎类的绑定维持 C-087 的二选一运行时预测（本轮未获新据）。
- `[this+0x128]` 家族（slot26/27/28 → 0x50407ADE/0x50407BEC/0x50407F23）：经字符串驻留解析 **WzFlashRenderer.dll** 的 InitializeFlashbyDevice/LoadMediaFile/RenderFlash/ReleaseFlash/IsRenderFlash 五函数 → **[engine+0x128] 是 Flash 媒体接口，不是渲染节点集合**（修正 T084.1 "collection" 措辞；节点真正挂在各节点对象的 +0x2C）。

## 3. WP2 — G08 Avatar 排序键（STATIC-CONFIRMED，EV-85）

### 3.1 静态扫描结果

- 立即数 29991/29992/29995/29999：**0 命中**——v83 常量不作为立即数出现；
- 但 `lea disp32 ∈ [−2^31, −2^31+0x10000]` 窗口 **34 处命中**：−0x3FFF8AD1..E1 = **−2^31 + {29983..29999}** —— 常量族以 lea 位移形式编码（编译器把 B+2999x 折入 disp32）；
- `imul ..,0xBB8`（×3000）：tile 0x666F5D（已知）+ **0x93E80D / 0x93E8E0 / 0x93EEE4**（avatar 族）。

### 3.2 CMS079 原版公式（自 0x9363D9 / 0x93E7F2 窗口逐指令恢复）

```
eax = [ecx+0xF28]            ; user+0xF28 → M 持有（C-081 已证该字段族）
eax = eax-0xC（空安全）        ; 场/层对象
edx = [eax+0x130]            ; layer（与 tile 键同字段布局）
edx = edx*3000
edx = edx - [eax+0x134]      ; − zM/group
eax = [eax+0x18]             ; 标志 dword
eax = (eax≠0 ? 5 : 0) + 1 + 1   ; → 7 或 2
key = eax + 10*(layer*3000 − zM) − 2^31 + 29990
```

即 **`key = 10*(layer*3000 − zM) − 0x40000000 + 29990 + (2 + (flag≠0 ? 5 : 0))`**，有效值域 **−2³¹ + {29992, 29997} + 10*(3000L−g)** —— **与 v83 OpenMS 假设的 avatar 值逐值相同**（独立推导自 CMS079 字节，非照搬；CMS079 的分解为 29990 基 + 2 + 5·flag）。两个 avatar 站点的消费路径：**0x9363D9** 把键传给 0x452147（体内 `push key; push [[this+0x88]+0xE44]; call [eax+0xB4]`——直接的 C-097 键控槽调用）；**0x93E7F2**（imul 站 0x93E80D）在同表达式后再 `dec edi`（**键−1**）并馈入 0x427EB3 族 PUT 包装器 0x439AAD（0xBE7330 VT_ERROR-missing VARIANT 初始化，与 tile 路径同构）。

**Reviewer 扩展族（已并入 C-099）**：0x70DDD7 处存在 **+3 姊妹带**（{29993, 29998}）；存在无 flag 对的扁平基站点（29991/29992）；哨兵常量 0xC0041F14；完整类型基集合 = −2³¹ + {0, 2000, 19990, 29983, 29985..29992, 29995, 29996, 29999} ∪ {59970, 59980}——其中 **19990 与 2000 正是 tile（C-001）/obj（C-002）的基**，与 C-003"同一设计键空间"互证闭合。

对照 v83 假设 `B + 29992 + (activeController?5:0) + (layer*3000−group)*10`：**CMS079 有效值 {29992, 29997} 与其逐值相同**（分解形式不同：29990+(2+5·flag) vs 29992+5·flag）——公式由本仓机器码独立确立后与跨版本假设值级吻合。

类型基族（34 处 lea 全量）：**avatar 29990**（0x93E80D/0x6C45A4/0x70DDD7/0x741942）、**mob 29991**（0x6C3ABD/0x7A9A0E/0x693xxx 状态簇 29983-29991）、**NPC 29995**（0x5181E6/0x9889A8/0x989AED/0x6C3A2C）、**drop 29999**（0x50ED77）、**avatar-变体 29992**（0x7A99D5）、29996（0x48CE02/0x9882E4）、对象族 `30000*x − 2^31`（0x559F07）与 59970/59980 族（0x559F39/0x559F6B）。全部调用同一 `call [reg+0xB4]` 键插入。

## 4. WP3 — G09 图层与遮挡（排序机制 STATIC-CONFIRMED）

1. **跨对象遮挡**（G09 的"runtime ordering"残项）：avatar/mob/NPC/drop 与 tile/obj 走**同一** slot25→节点→slot45 键控插入→同一比较器 0x50403A42 的同一键空间（基 −2^31 + 2998x/2999x/1999x 层级），跨对象遮挡 = 该有序树的遍历序 —— 与 WP1/WP2 合并后**静态闭合**（无需运行时观测即可实现正确次序）。
2. **随包 WZ 实证**（EV-86 = `T086-G09-ZMAP-SMAP.txt`）：zmap/smap/**zmap_cn**/StandardPDD 位于 **Base.wz**（非 Character.wz）。zmap.img **149 层**（与 C-043 的 EXE 消费模型 149 精确一致）；zmap_cn.img 与 zmap.img **逐位同序**（中国变体恒等）；smap.img 147 条、其中 **106 条层名→部件码绑定**（如 `cap = CpHdH1H2H3H4H5H6HsHfHbAfAyAsAe`、`mailArmOverHair = MaGw`、`handOverHair = Bd`）——**帽藏发/装备部件参与规则以数据形式编码在 smap**，与 EXE 消费链（C-043 0x77D236 家族）互补。
3. 内部件次序（zmap 149 序）与跨对象次序（WP1/WP2 键空间）按任务要求分别成文、不混谈。运行时渲染 corroboration 降级为可选（同 G38 处理先例）。

## 5. WP4 — G10 Camera 全静态数据流（PARTIAL-STATIC）

1. **slot15 调用点完备普查**：`call [reg+0x3C]` disp8 形式全代码带 **28 处**；disp32（FF 9x 3C 000000）**0 处**；SIB disp32 **0 处**；0x53471A 直接 E8 调用 **0 处**（33 个 vtable 槽位之外无静态调用者）→ 枚举完备（EV-87 窗口全量）。逐窗口接收者溯源：均属生命体/UI/COM/字符串层家族（[edi-0x588] 等），**无一可证为 scene 族接收者**——T084 "caller not statically identifiable" 的有界负结论在完备枚举下维持。
2. **帧循环新事实**：slot12 0x53465B 存在**唯一直接 E8 调用者 0x5658CA**（位于 0x5658BF 起的窗口级方法：调 per-tick 后做 [esi+0x770]==1 的 0x28 计数周期逻辑）——T084 "frame-loop caller unidentified" 被部分推进（至少一个非虚调用入口静态定位）。
3. 0x953AF4（per-draw）实测为**小分发器**（arg−0x201 四路 → 0x9563E7/0x956411/0x9564EE/0x956AC3，ret 0x10；各路做 fieldctx 查询/UI 字符串）——**不是**相机生产者。
4. **持久 vs 临时（结构性结论）**：slot15 0x53471A 以 `[ebp+8]/[ebp+0xC]` 参数消费相机矩形且与 scene+0x1D0/+0x1D4 世界界比较；scene 持久字段仅 VR 折叠边界（载入时一次写入，C-026）→ **相机位置在静态可见的调用契约中是调用方临时量**（或调用方侧局部状态），不存在 Scene 持久相机字段。生产者身份 = 28 站点中接收者运行时才可判定的一方，或 Census 外的寄存器间接构造——维持 G10 OPEN-RUNTIME（有界：普查编码完备，接收者数据静态不可判定）。

## 6. 与 0x9BE703 首帧链的合并（WP4 补充）

T085 已闭 first-tick（C-088）。本轮补充：跨图/同图传送后的相机处理顺序仍为 —— VR 再折叠（载入期，C-083 顺序）→ 到点写 → 后续 slot12 tick（0x5658CA 入口）→ slot14 per-draw → slot15 cull（相机参数由调用方构造）。相机刷新无独立静态路径：它内含于 slot12/14 的常规分发序列。

## 7. 台账动作

新增 Claims（详见 claims.csv）：C-095（G17 溯源矩阵 + 客户端派发，CLOSED-STATIC/A）、C-096（节点类定身，CLOSED-STATIC/A）、C-097（slot45 键控插入 + 比较器，CLOSED-STATIC/A）、C-098（G22 桩表修正，CLOSED-STATIC/A）、C-099（G08 公式，CLOSED-STATIC/A）、C-100（Base.wz zmap/smap 数据面，CLOSED-STATIC/A）、C-101（G10 普查 + 0x5658CA + 相机临时性，PARTIAL-STATIC/B）。

新增 Evidence：EV-82（节点类/插入/比较器链）、EV-83（G17 溯源矩阵 CSV）、EV-84（0xA10CE3 客户端派发证明）、EV-85（G08 键位点反汇编）、EV-86（zmap/smap dump）、EV-87（slot15 调用者窗口）。

Gap 更新：G17 BLOCKED→PARTIAL-STATIC；G08 OPEN-RUNTIME→CLOSED-STATIC；G09 OPEN-RUNTIME→CLOSED-STATIC（运行时 corroboration 可选）；G10 OPEN-RUNTIME（范围推进）；G24 OPEN-RUNTIME→CLOSED-STATIC（残项=PCOM 绑定佐证性捕获）；G01/G07 OPEN→CLOSED-STATIC；G22 PARTIAL-STATIC→CLOSED-STATIC；G33 OPEN-STATIC→CLOSED-STATIC（tie-break 次键比较）。

## 8. 独立 Review（Sub-Agent）

独立子代理（`ses_e21dff8c0ffeZHLo80ujuJ7ccC`）以自有脚本（temp 目录）、双镜像前后哈希核验、盲审模式完成五项对抗检查，原始报告全文存 `forensics/T086-REVIEWER-INDEPENDENT.md`。**最终裁定：ACCEPT-WITH-CORRECTIONS**。

**五项裁定**：Check1 G24（AGREE + 独立候选穷尽扫描：dword 0x5040418C 在 DLL 中恰出现两次——0x5042D1B8/0x5042D288，无 thunk 别名，候选集 {0x5042D154, 0x5042D224} 穷尽）；Check2 G08（PARTIAL→值级 AGREE：独立恢复出同一公式并指出有效值 {29992,29997} 与 v83 逐值相同）；Check3 G09（AGREE：zmap=149 空属性序、zmap_cn 恒等、smap 106 绑定）；Check4 G10（AGREE：28/0/0、0x5658CA、0x953AF4 及其被调对 scene+0xF0..0xFC 零访问）；Check5 G17（AGREE：365/11/76 join、92/92 开关匹配、enum 161/241）。

**四项修正全部闭环**（`research/scripts/t086_review_corrections.py` 落档）：

| # | Reviewer 修正 | 处置 |
|---|---|---|
| 1 | G08 常量分解应为 29990+(2+5·flag)={29992,29997}（与 v83 值同）；补 +3 姊妹带 0x70DDD7({29993,29998})、扁平基站点、哨兵 0xC0041F14、完整类型基集（含 19990/2000=tile/obj 基） | C-099/G08/报告 §3.2 已改写并入 |
| 2 | jar 行 `DOJO_WARP_UP = SHOW_ITEM_GAIN_INCHAT 1` 依标准规则不可解——语料行 0x00D1 非 properties 可推导 | C-095 falsification 字段加注（该行降为观察级） |
| 3 | 0x5658BF 包装器本身即 33 族 vtable slot12（dword @0xB01338），含 40-tick 周期动作 | C-101 已并入 |
| 4 | slot45 语义由"倾向键控插入"升级为指令证有序插入（比较器 0x50403A42 + cmp/setle 定位；C-012 的笼统断言维持已撤销，本结论限定节点主表） | 与主 Agent 结论一致，C-097 维持 |

无分歧项导致任何 Gap 状态回退；Reviewer 的候选穷尽扫描与 +3 姊妹带为本轮新增强度。

## 9. 质量门禁

| 门禁 | 结果 | 日志 |
|---|---|---|
| Validator | 见提交日志 | forensics/T086-VALIDATOR-LOG.txt |
| Unit tests | 见提交日志 | forensics/T086-UNITTEST-LOG.txt |
| Clean-room 再生 | 与 canonical 一致 | forensics/T086-CLEANROOM-LOG.txt |

## 10. 边界声明

- 仅修改 `research/`；Frozen ABI、LoomRealm、content、原始二进制未动。
- 未重复 T085 已闭合的 G34/G38/G41 工作。
- 结论类型四值（STATIC-CONFIRMED/STATIC-EQUIVALENT/PARTIAL-STATIC/STATIC-UNDERDETERMINED）仅在本报告使用；权威 CSV 状态仍为七值枚举。
- 项目维持 **NOT STAGE-READY**。
