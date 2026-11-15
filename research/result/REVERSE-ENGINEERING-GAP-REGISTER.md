# 逆向缺口总台账（REVERSE-ENGINEERING-GAP-REGISTER）

日期: 2026-11-13（P0 整改版；2026-11-13 clean-room 审计版）。
**唯一权威数据源 = `research/source-of-truth/gaps.csv`**——本文件是其人读视图；统计表由 `research/scripts/generate_cleanroom_deliverables.py` 自动生成，验证器校验一致性。
各模块报告不得与此台账矛盾。

## 状态枚举（唯一合法值）

CLOSED-STATIC | CLOSED-RUNTIME | PARTIAL-STATIC | OPEN-STATIC | OPEN-RUNTIME | BLOCKED | SUPERSEDED

---

## P0（原最高优先级）

| ID | 模块 | 问题 | 状态 | 证据 | 最小验证 |
|---|---|---|---|---|---|
| G01 | Map/Sort | R13 比较器/容器语义 | CLOSED-STATIC | key formulas A (C-001/002); channels A (C-017); 22 candidate zero-insert census (C-012, refuted blanket reading retained); slot45 carries precomputed key as arg2 (C-075); t086: FINAL ORDERING RECEIVER RECOVERED — slot45 body 0x50409ECD forwards the key into the per-node ordered container [node+0x2C] (insert 0x50409EF4, tree search 0x5040390D, rebalance insert 0x50405476/0x5040C35E) with comparator 0x50403A42 (C-097); equal-key policy = secondary slot0-key compare |
| G02 | Map/Sort | Tile/Obj 键公式 | CLOSED-STATIC | tile=z+10(layer·3000−zM)−1073721834 @0x666F68；obj=layer·30000+z−1073739824 @0x6688D2（MAP-R13-FINAL-ROUND4 imul 0x7530 确认）| — |
| G03 | Map/Sort | [0xBE2788] vs Shape2D 冲突 | CLOSED-STATIC | E576EA33 唯一 Gr2D；RTTI+intmap（MAP-R13-STATIC-CLOSURE v2）| — |
| G04 | Combat | R9 变体选择 | CLOSED-STATIC | {值,键}对 + xorshift RNG + variant[rand%count]（SEC16-FORENSICS A 级）| — |
| G05 | Map/Move | R14 move+0x190 写者 | CLOSED-STATIC | [Physics+0xAC]；步长 0x1E（SEC16-FORENSICS A 级）| — |

## P1（运行时依赖项）

| ID | 模块 | 问题 | 状态 | 证据 | 最小验证 |
|---|---|---|---|---|---|
| G06 | Map/Sort | [0xBE2788] 真实虚表 | CLOSED-STATIC | =0x5042D140（40 槽 intmap 精确衔接）| — |
| G07 | Map/Sort | DLL 内比较器 | CLOSED-STATIC | excluded from all vtable slot45s (EV-15); stack-package callees fully read, zero comparator logic (C-085); t086: the comparator is a Gr2D FREE FUNCTION 0x50403A42 invoked inside the keyed insert 0x50409EF4 (not a vtable slot) — body fully read: payload slot4-chain climb + slot0-key compare with sign result and equal-key tie-break (C-097/EV-82) |
| G08 | Map/Sort | Avatar 插入键构造 | CLOSED-STATIC | t086 C-099/EV-85 + reviewer cross-check: CMS079 formula machine-code recovered - key = 10*(layer*3000 - zM) - 2^31 + 29990 + (2 + 5*(flag!=0)) = -2^31 + {29992, 29997} + 10*(3000L-g) — effective values VALUE-IDENTICAL to the v83 hypothesis, independently derived; layer/zM at [user+0xF28]-0xC field +0x130/+0x134; consumption: 0x9363D9 -> 0x452147 -> direct keyed [eax+0xB4] call on [[this+0x88]+0xE44]; 0x93E7F2 applies key-1 then feeds the 0x427EB3-family PUT wrapper 0x439AAD; reviewer-extended family: +3 band 0x70DDD7 ({29993,29998}), flat bases 29991/29992, sentinel 0xC0041F14, full type-base set {0, 2000, 19990, 29983, 29985..29992, 29995, 29996, 29999, 59970, 59980} (19990/2000 = the tile/obj bases — one designed key space); all feed the C-097 keyed insert |
| G09 | Avatar | 部件组合/遮挡运行时序 | CLOSED-STATIC | static model complete (zmap 149 layers, C-043); t086: (a) cross-object ordering mechanism CLOSED — avatars/mobs/NPCs/drops insert into the SAME ordered container with the SAME comparator 0x50403A42 and the shared -2^31+299xx key space (C-097/C-099); (b) data anchors verified in the shipped Base.wz — zmap.img 149 == EXE model, zmap_cn order-identical, smap.img 106 layer->component bindings (C-100/EV-86); internal part order (zmap) and world order (key space) established separately per task |
| G10 | Camera | 镜头跟随/deadzone 实际参数 | OPEN-RUNTIME | VR fold A (C-026); scene-manager skeleton (C-084); t086 (C-101/EV-87): slot15 caller census encoding-complete — 28 disp8 sites + 0 disp32 + 0 SIB + 0 direct E8, receivers all life/UI/COM families (bounded negative now enumeration-complete); slot12 0x53465B has exactly one direct E8 caller 0x5658CA (window method 0x5658BF — first static frame-loop entry); 0x953AF4 = 4-way arg dispatcher (not a camera producer); STRUCTURAL: slot15 consumes the camera rect as caller ARGS — the per-frame camera value is caller-transient, persistent scene fields are only the load-time VR bounds |
| G11 | Move | +0x61 死亡位移位 | OPEN-STATIC | 77 disp8 候选无结构归属 | 进图 diff（user±0x100）|
| G12 | Move | +0x3BC 减计数机制 | OPEN-STATIC | sub/dec 全库不存在（A-negative）| 计算位移假说检验 |
| G13 | Audio | WINMM 序号→函数名映射 | OPEN-STATIC | IAT 静态 4 序号已证（A）；名字映射待同时代 DLL | 获取 win2k/xp winmm.dll |

## P2（NO-DECOMP 长尾，结构性）

| ID | 模块 | 问题 | 状态 | 证据 |
|---|---|---|---|---|
| G14 | DLL | 1,319 个 NO-DECOMP 方法槽 | PARTIAL-STATIC | 多为 ATL 样板（67 库签名+结构证明）|
| G15 | EXE | Ghidra 间隙函数 | CLOSED-STATIC | capstone 逐个击破（COM 包装族全解，R31-C/F 证据）|

## P3（业务长尾）

| ID | 模块 | 问题 | 状态 | 证据 |
|---|---|---|---|---|
| G16 | UI | 逐窗口事件逻辑精读 | OPEN-STATIC | 26+ 窗口 WZ 结构已映射 |
| G17 | Protocol | opcode 枚举数值 | PARTIAL-STATIC | opcode semantics corpus A (C-046); t086 (C-095/EV-83/EV-84): all 442 values fully attributed — 355 jar-properties direct + 11 explicit 0xFF + 76 ExternalCodeTableGetter default 0xFFFE, ZERO corpus-vs-jar conflicts; jar properties identical to public ms079 (366/366) and conflict with Afauria on 15 names; NEW client-instruction tier: switch 0xA10CE3 statically binds 92 S2C opcodes (0x20..0x80) to handler bodies = task44 runtime map 92/92; prior wire observations (task048: 17/18 values incl. WARP_TO_MAP=0x81) match properties |

## 第二轮新增（2026-11-13 STATIC-ROUND-2）

| ID | 模块 | 问题 | 状态 | 证据 |
|---|---|---|---|---|
| G18 | PCOM | 0x9C0EC0 四 IID QI 分派器所属对象 | OPEN-STATIC | 0xba0500=F28BD1ED(CWzRawCanvas 基) |
| G19 | Move/Protocol | 0x9BC404 移动位置/状态解密-序列化器 | PARTIAL-STATIC | 4 对解密 + 状态码 0x11/0xF + 0xa70f94 |
| G20 | Avatar | 63-avatar-occlusion §11 五项 | OPEN-STATIC | this+0x38/空tag/face排除/双入口/锚点映射 |

## 第三轮更新（2026-11-13 ROUND-3）

| ID | 模块 | 问题 | 状态 | 证据 |
|---|---|---|---|---|
| G21 | Gr2D | [0x5042D0A0] 身份 | CLOSED-STATIC | =__imp__purecall（导入名表 A 级，R13-PE-IAT-FORENSICS）|
| G22 | Gr2D | RawCanvas 具体虚表 | CLOSED-STATIC | ambiguity proven (EV-09/10/15); t086 RESOLVED (C-098/EV-82): 0x2E2C4/0x2E2CC are purecall-padded abstract stub tables (installed on small subobjects by 0x50402A30/0x50402874); the real 6DC8C7CE-class primary vtable = 0x5042E3F0 (76 slots, adjoins intmap 0x2E520), ctor 0x504067D7; slot45 of the real primary = 0x50409ECD (keyed insert, C-097) |
| G23 | PCOM | 0x427EB3 身份 | CLOSED-STATIC | =属性 PUT 包装（层 slot25 setter +0xCC，R13-427EB3-FORENSICS）|
| G24 | Map/Sort | [eax+0xB4] 最终语义 | CLOSED-STATIC | t084.1 (C-086/C-087): production slot25 = 0x5040418C; t086 (C-096/C-097/EV-82): the slot25-created node class FULLY identified — ctor 0x504067D7, vtable stack {0x5042E3F0 primary(76), 0x5042E3EC, 0x5042E3E8, 0x5042E3D0}, QI intmap 0x2E520 entry0 IID 6DC8C7CE dw=0; the [eax+0xB4] slot45 receiver = that node, body 0x50409ECD = keyed ordered-tree insert (C-097); slot56 = 0x50409DBA ARGB setter; the t082 bp-0x666F77 capture downgrades to confirming the already-statically-proven identity (predicted [EBP-0x10] vtable = 0x5042E3F0) |

## Round 3.1 Task2 更新

| ID | 模块 | 问题 | 状态 | 证据 |
|---|---|---|---|---|
| G25 | Map/Sort | "[eax+0xB4]=有序插入"假设 | SUPERSEDED | 22 候选 slot45 全表无插入语义；备择=属性注册或清理 |
| G26 | PCOM | VARIANT vt=0xD 语义 | CLOSED-STATIC | =VT_UNKNOWN（0x411FE1 A 级）|
| G27 | PCOM | 0x427EB3 出参静态矛盾 | CLOSED-STATIC | t084.1 (C-086)：第三候选 0x5040418C（inner slot25, ret 0x3C）与 0x427EB3 栈布局精确匹配并在 0x504045CB 写出参对象指针——矛盾仅在假设不写出参的候选下成立，已消解；运行时佐证并入 G24 |
| G28 | Gr2D | slot45 全表分类 | CLOSED-STATIC | R13-SLOT45-CANDIDATES.csv 22 表 |

## Round 4 更新

| ID | 模块 | 问题 | 状态 | 证据 |
|---|---|---|---|---|
| G29 | Map/Sort | Tile/Obj 不同分派通道 | CLOSED-STATIC | Obj 用栈封装 cdecl 非 [eax+0xB4]（MAP-R13-FINAL-ROUND4）|
| G30 | Map/Sort | Gr2D 0x143d8 = 4分量浮点变换 | CLOSED-STATIC | fld/fadd/fsub ×4（AVATAR-OCCLUSION-EVIDENCE AV-R4-2）|
| G31 | Map/Sort | Canvas 0x17517 = 属性 put/get(+0x8C/+0x90) | CLOSED-STATIC | 跨 DLL 同构族（AV-R4-3）|
| G32 | Map/Sort | Gr2D 0x2F530 = 伪虚表 | CLOSED-STATIC | slot45 指向字符串数据（AV-R4-4）|

## Clean-room 审计新增（2026-11-13）

| ID | 模块 | 问题 | 状态 | 证据 |
|---|---|---|---|---|
| G33 | Map/Sort | 相等键次序策略（稳定性） | CLOSED-STATIC | WZ-order sample observed only (EV-28); t086 (C-097): equal-key policy = comparator 0x50403A42 tie-break comparing payload slot0 keys (deterministic secondary order); product stable-sort remains a safe superset |
| G34 | Camera | 0x5A↔0x1E 换算关系 | CLOSED-STATIC | 0x1E 已证（C-030）；t085: H1 换算假说被两轮独立立即数普查否决——90/30 仅有两个相遇点且均非换算（T3 slot9 0x9C3D1D 覆盖返回 90；T4 slot9 0x9C9CF7 步长累加器阈值 90），其余域完全分离（C-094/EV-81） |
| G35 | Map/Sort | Background 键公式复验 | PARTIAL-STATIC | 单一 imul-1000 站点上下文不足（EV-20）|

## 阶段缺口新增（2026-11-13，13 图 P0–P4 范围）

| ID | 模块 | 问题 | 状态 | 证据 |
|---|---|---|---|---|
| G36 | Map/Background | 13 图 type1–4 平铺/视差/滚动布置 | PARTIAL-STATIC | 0x669397 分支、0x66A8D5 模式与零步长（历史 MAP-BACKGROUND-REVERSE）；FSDB 278/387 非 type0 |
| G37 | Map/Obj | 13 图 Obj flow=1/rx 渲染与 flow 动画 | PARTIAL-STATIC | t080: 与背景共用 0x66A8D5（mode=flow, flag=1, this+0x50 注册；flow=0 单实例）C-052；动态绘制目标仍开放 |
| G38 | Map/Portal | 同图/跨图精确到达与状态转移 | CLOSED-STATIC | t080/t082/t084 链（C-054/055/061..066/083）；t085: 首帧重建闭合——0x9BE703 全函数体+首 tick 链（同图 T1 无 ctx 路径 mode=1、跨图新鲜 T7 委托 T1）、[M+0x120] 仅清零域→钉扎分支死、FSDB x1>x2=0→m1>0 落地路径覆盖全部非垂直段（C-088/C-089/EV-77/78）；Camera 时机归 G10、0x81 注册归 C-066 条款 |
| G39 | Map/Background/Portal | 背景/Portal 精灵帧时序与滚动单位 | PARTIAL-STATIC | t080: 注册链 +0x110、origin +0x6C/+0x74、0x43715C=slot+0x58、相位 VT_I4 传递（C-060）；时间单位运行时绑定 |
| G40 | Movement | 完整移动子分支与 decrypt 字段归属 | PARTIAL-STATIC | T1/EV-23/26；C-058/067/068/076/078/080；t085: 8 表槽位变体全图（slot4 变体 T3/T6、slot9 变体 T3/T4、T7 slot5/6 覆盖 C-089）、slot3 变体全差分（T3 游泳预处理器/T5 平台边界 rand%2 跳过，均委托 0x9BF1FA C-092）、[M+0x190] 步长表安装已证、[M+0x198] 鞋对象有界无置位普查（C-093）；余留=T3/T6 slot4 体、walk/swim/land 全序、鞋安装者 |
| G41 | Movement | 抓绳/爬绳与座位全状态机 | CLOSED-STATIC | t080..t084 全链（C-056/057/069..073/078/079/080/081）；t085: slot14 调用点枚举闭合——flag=0 恰两处（0x965937=opcode 0xCF STAND 子命令 RNG 门控；0x948AB4=到达/包生成 0x948AA2 RNG 门控）、SIT 子命令含座位盒 x±0xA/y±0x1E 与 0x9D35F2 座位传送、上下键轴仲裁=DOWN−UP 同按抵消为零（C-090/C-091/EV-79）；运行时佐证可选 |

---

## 台账统计（由 `research/scripts/generate_cleanroom_deliverables.py` 从 source-of-truth/gaps.csv 自动生成；`<!--GAP-STATS-AUTO-->
| 状态 | 数量 |
|---|---|
| CLOSED-STATIC | 25 |
| CLOSED-RUNTIME | 0 |
| PARTIAL-STATIC | 8 |
| OPEN-STATIC | 6 |
| OPEN-RUNTIME | 1 |
| BLOCKED | 0 |
| SUPERSEDED | 1 |
| **总计** | **41** |
<!--/GAP-STATS-AUTO-->
