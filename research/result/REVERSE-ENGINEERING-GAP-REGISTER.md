# 逆向缺口总台账（REVERSE-ENGINEERING-GAP-REGISTER）

日期: 2026-11-13。全仓 684 文件标记扫描（UNKNOWN×419、NO-DECOMP×1319、PARTIAL×13、未证实×11 等）+ 结构性缺口分析后建立。

## P0（已闭合）

| ID | 模块 | 问题 | 状态 | 最终结论 |
|---|---|---|---|---|
| G01 | Map/Sort | R13 比较器/容器语义 | **PARTIAL-STATIC**（R3：身份链闭合，插入语义未定） | 已证：0x5042D0A0=__imp__purecall(IAT)；0x2E2CC=RawCanvas 具体虚表(149槽)；其 slot45=删除型析构；0x427EB3=属性PUT(slot25 平凡setter +0xCC)非创建器；键公式 A 级独立成立。未定：[ebp-0x10] 具体类（variant 内容决定）→ [eax+0xB4] 插入解释对其他实现未裁定 |
| G02 | Map/Sort | Tile/Obj 键公式 | **CLOSED**（旧文档已 VERIFIED，本轮互证） | tile=z+10(layer·3000−zM)−1073721834；obj=layer·30000+z−1073739824 |
| G03 | Map/Sort | [0xBE2788] vs Shape2D 冲突 | **CLOSED（修正）** | Shape2D#Vector2D 判定错误；真 GUID 仅在 Gr2D |
| G04 | Combat | R9 变体选择 | **CLOSED**（SEC16 轮） | {值,键}对 + xorshift RNG + variant[rand%count] |
| G05 | Map/Move | R14 move+0x190 写者 | **CLOSED**（SEC16 轮） | [Physics+0xAC]；步长 0x1E 起源找到 |

## P1（静态已尽，RUNTIME-REQUIRED）

| ID | 模块 | 问题 | 缺失证据 | 最小验证 |
|---|---|---|---|---|
| G06 | Map/Sort | [0xBE2788] 真实虚表 | **CLOSED-STATIC**（v2） | =0x5042D140（40 槽，intmap 精确衔接）；残留=委派表 [0x5042D0A0] 运行时值 |
| G07 | Map/Sort | DLL 内二分插入比较器 | 上项定位后 | 反汇编插入函数体 |
| G08 | Map/Sort | Avatar 插入键构造 | 进图运行时路径 | 进图转储 + Avatar 加载断点 |
| G09 | Avatar | 部件组合/遮挡运行时序 | 进图后渲染 | 进图捕获 |
| G10 | Camera | 镜头跟随/deadzone 实际参数 | 进图输入循环 | 进图转储 [0xBDF54C] 族 |
| G11 | Move | +0x61 死亡位移位 | 77 disp8 候选无结构归属 | 进图 diff（user±0x100） |
| G12 | Move | +0x3BC 减计数机制 | sub/dec 全库不存在 | 进图采样 5000→0 轨迹 |
| G13 | Audio | WINMM 实际调用序列 | 哈希导入运行时表 | 进图后 [0xafeXXX] 解析值 |

## P2（NO-DECOMP 长尾，结构性）

| ID | 模块 | 问题 | 状态 |
|---|---|---|---|
| G14 | DLL | 1,319 个 NO-DECOMP 方法槽 | 已知：多为 ATL 样板（QI/AddRef/Release/dtor 已由 67 库签名+结构证明）；其余属像素管线族（掩码级已证） |
| G15 | EXE | Ghidra 间隙函数（0x4026x 等） | 已由 capstone 逐个击破（COM 包装族全解）；残留为纯 thunk |

## P3（业务长尾）

| ID | 模块 | 问题 | 状态 |
|---|---|---|---|
| G16 | UI | 逐窗口事件逻辑精读 | 26+ 窗口 WZ 结构已映射；逐窗口为人工阅读量问题 |
| G17 | Protocol | opcode 枚举数值（467 名字无号） | 值在服务器外部 properties（不在盘）；客户端表覆盖 100 个 |

## 统计
- 扫描 684 文件；标记命中：NO-DECOMP 1319 / UNKNOWN 419 / PARTIAL 13 / 未证实 11 / BLOCKED 5
- P0：5 项全闭合
- RUNTIME-REQUIRED：8 项（全部附最小验证方案）
- 结构性长尾：2 类（已定性）

## 第二轮新增/更新（2026-11-13 STATIC-ROUND-2）

| ID | 模块 | 问题 | 状态 | 说明 |
|---|---|---|---|---|
| G18 | PCOM | 0x9C0EC0 = 四 IID QI 分派器（{0xb0e760,0xbd37b0,0xba0378,0xba0500}）所属对象 | OPEN-STATIC | 0xba0500=F28BD1ED(CWzRawCanvas 基)——疑似 RawCanvas 家族聚合对象 |
| G19 | Move/Protocol | 0x9BC404 = 移动位置/状态解密-序列化器（x/y/vx/vy 4 对 + 状态 0x11/0xF + 0xa70f94） | PARTIAL-STATIC | 完整签名与包目标待续 |
| G20 | Avatar | 63-avatar-occlusion §11 五项 | OPEN-STATIC（从误标 RUNTIME 纠正） | this+0x38 槽位串源/空 tag 构造/face 排除插入/双绘制入口目标/画布锚点映射 |

## 第三轮更新（2026-11-13 ROUND-3）

| ID | 模块 | 问题 | 状态 | 说明 |
|---|---|---|---|---|
| G21 | Gr2D | [0x5042D0A0] 身份 | **CLOSED-STATIC** | =__imp__purecall（导入名表 ASCII + 无重定位，A 级）；见 MAP-R13-ROUND3-DISPATCH.md |
| G22 | Gr2D | RawCanvas 具体虚表 | **CLOSED-STATIC** | =0x5042E2CC（149 槽，衔接 intmap 0x2E520）；slot45=删除型析构（0x50404FB1） |
| G23 | PCOM | 0x427EB3 身份 | **CLOSED-STATIC** | =属性 PUT 包装（层 slot25 setter +0xCC / getter +0xD0）；推翻"CreateRawCanvas" |
| G24 | Map/Sort | [eax+0xB4] 最终语义 | **OPEN-RUNTIME**（收窄） | 依 [ebp-0x10] 具体类（variant 运行时值）；候选已列 R13-DISPATCH-RESOLUTION.csv |
