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
| G01 | Map/Sort | R13 比较器/容器语义 | PARTIAL-STATIC | 键公式 A 级独立成立（MAP-R13-STATIC-CLOSURE）；身份链 A 级（MAP-R13-ROUND3-DISPATCH）；插入语义未定（MAP-R13-DISPATCH-COMPLETE）| 见 R-09 |
| G02 | Map/Sort | Tile/Obj 键公式 | CLOSED-STATIC | tile=z+10(layer·3000−zM)−1073721834 @0x666F68；obj=layer·30000+z−1073739824 @0x6688D2（MAP-R13-FINAL-ROUND4 imul 0x7530 确认）| — |
| G03 | Map/Sort | [0xBE2788] vs Shape2D 冲突 | CLOSED-STATIC | E576EA33 唯一 Gr2D；RTTI+intmap（MAP-R13-STATIC-CLOSURE v2）| — |
| G04 | Combat | R9 变体选择 | CLOSED-STATIC | {值,键}对 + xorshift RNG + variant[rand%count]（SEC16-FORENSICS A 级）| — |
| G05 | Map/Move | R14 move+0x190 写者 | CLOSED-STATIC | [Physics+0xAC]；步长 0x1E（SEC16-FORENSICS A 级）| — |

## P1（运行时依赖项）

| ID | 模块 | 问题 | 状态 | 证据 | 最小验证 |
|---|---|---|---|---|---|
| G06 | Map/Sort | [0xBE2788] 真实虚表 | CLOSED-STATIC | =0x5042D140（40 槽 intmap 精确衔接）| — |
| G07 | Map/Sort | DLL 内比较器 | OPEN-STATIC | 上项已闭；比较器体在栈封装函数内待读 | 反汇编 0x43286E/0x44484B |
| G08 | Map/Sort | Avatar 插入键构造 | OPEN-RUNTIME | 进图运行时路径 | 进图转储 + Avatar 加载断点 |
| G09 | Avatar | 部件组合/遮挡运行时序 | OPEN-RUNTIME | 进图后渲染 | 进图捕获 |
| G10 | Camera | 镜头跟随/deadzone 实际参数 | OPEN-RUNTIME | 进图输入循环 | 进图转储 [0xBDF54C] 族 |
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
| G17 | Protocol | opcode 枚举数值 | BLOCKED | 值在服务器外部 properties（不在盘）|

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
| G22 | Gr2D | RawCanvas 具体虚表 | PARTIAL-STATIC | 起点 0x2E2C4/0x2E2CC 歧义（R13-RTTI-VTABLE-FORENSICS）；slot45={purecall,dtor}联合排除插入 |
| G23 | PCOM | 0x427EB3 身份 | CLOSED-STATIC | =属性 PUT 包装（层 slot25 setter +0xCC，R13-427EB3-FORENSICS）|
| G24 | Map/Sort | [eax+0xB4] 最终语义 | OPEN-RUNTIME | 依 [ebp-0x10] 具体类（variant 运行时值）|

## Round 3.1 Task2 更新

| ID | 模块 | 问题 | 状态 | 证据 |
|---|---|---|---|---|
| G25 | Map/Sort | "[eax+0xB4]=有序插入"假设 | SUPERSEDED | 22 候选 slot45 全表无插入语义；备择=属性注册或清理 |
| G26 | PCOM | VARIANT vt=0xD 语义 | CLOSED-STATIC | =VT_UNKNOWN（0x411FE1 A 级）|
| G27 | PCOM | 0x427EB3 出参静态矛盾 | PARTIAL-STATIC | t080 (C-053)：arg1 即 OUT；矛盾仅在静态 Gr2d trivial-setter 绑定下成立；运行时写值待 dump |
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
| G33 | Map/Sort | 相等键次序策略（稳定性） | OPEN-STATIC | 仅 WZ 静态条目序样本；无绘制顺序证据（Claim C-018 撤销后拆分）|
| G34 | Camera | 0x5A↔0x1E 换算关系 | OPEN-STATIC | 0x1E 已证（C-030）；0x5A 关系无验证站点 |
| G35 | Map/Sort | Background 键公式复验 | PARTIAL-STATIC | 单一 imul-1000 站点上下文不足（EV-20）|

## 阶段缺口新增（2026-11-13，13 图 P0–P4 范围）

| ID | 模块 | 问题 | 状态 | 证据 |
|---|---|---|---|---|
| G36 | Map/Background | 13 图 type1–4 平铺/视差/滚动布置 | PARTIAL-STATIC | 0x669397 分支、0x66A8D5 模式与零步长（历史 MAP-BACKGROUND-REVERSE）；FSDB 278/387 非 type0 |
| G37 | Map/Obj | 13 图 Obj flow=1/rx 渲染与 flow 动画 | PARTIAL-STATIC | t080: 与背景共用 0x66A8D5（mode=flow, flag=1, this+0x50 注册；flow=0 单实例）C-052；动态绘制目标仍开放 |
| G38 | Map/Portal | 同图/跨图精确到达与状态转移 | PARTIAL-STATIC | t080: 同图链端到端（C-054 含 0x78/0x258 冷却、Y−10、加密落点）；跨图（C-055 含边界夹取/速度清零）；Foothold 重绑体与 opcode 注册余留 |
| G39 | Map/Background/Portal | 背景/Portal 精灵帧时序与滚动单位 | PARTIAL-STATIC | t080: 注册链 +0x110、origin +0x6C/+0x74、0x43715C=slot+0x58、相位 VT_I4 传递（C-060）；时间单位运行时绑定 |
| G40 | Movement | 完整移动子分支与 decrypt 字段归属 | PARTIAL-STATIC | T1/EV-23/26；t080: fh 邻段 +0x4C/+0x50、0xA4F6F1 半宽为调用方参数（C-058）、dt 为调用方供给 |
| G41 | Movement | 抓绳/爬绳与座位全状态机 | PARTIAL-STATIC | t080: y+=3×键（3.0 常量）+端点夹取（C-056）；座位 user+0x2944 写链与 x±10/y±30（C-057）；抓绳体余留 |

---

## 台账统计（由 `research/scripts/generate_cleanroom_deliverables.py` 从 source-of-truth/gaps.csv 自动生成；`<!--GAP-STATS-AUTO-->
| 状态 | 数量 |
|---|---|
| CLOSED-STATIC | 14 |
| CLOSED-RUNTIME | 0 |
| PARTIAL-STATIC | 12 |
| OPEN-STATIC | 9 |
| OPEN-RUNTIME | 4 |
| BLOCKED | 1 |
| SUPERSEDED | 1 |
| **总计** | **41** |
<!--/GAP-STATS-AUTO-->
