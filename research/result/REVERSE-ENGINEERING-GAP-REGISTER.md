# 逆向缺口总台账（REVERSE-ENGINEERING-GAP-REGISTER）

日期: 2026-11-13。全仓 684 文件标记扫描（UNKNOWN×419、NO-DECOMP×1319、PARTIAL×13、未证实×11 等）+ 结构性缺口分析后建立。

## P0（已闭合）

| ID | 模块 | 问题 | 状态 | 最终结论 |
|---|---|---|---|---|
| G01 | Map/Sort | R13 比较器身份 | **CLOSED** | [0xBE2788]=Gr2D 接口（IID E576EA33 唯一归属 Gr2D_DX8.dll）；0x666F7D 的 cmp=HRESULT 检查非比较；+0xB4=有序插入，比较器在 DLL 内（MAP-R13-STATIC-CLOSURE.md） |
| G02 | Map/Sort | Tile/Obj 键公式 | **CLOSED**（旧文档已 VERIFIED，本轮互证） | tile=z+10(layer·3000−zM)−1073721834；obj=layer·30000+z−1073739824 |
| G03 | Map/Sort | [0xBE2788] vs Shape2D 冲突 | **CLOSED（修正）** | Shape2D#Vector2D 判定错误；真 GUID 仅在 Gr2D |
| G04 | Combat | R9 变体选择 | **CLOSED**（SEC16 轮） | {值,键}对 + xorshift RNG + variant[rand%count] |
| G05 | Map/Move | R14 move+0x190 写者 | **CLOSED**（SEC16 轮） | [Physics+0xAC]；步长 0x1E 起源找到 |

## P1（静态已尽，RUNTIME-REQUIRED）

| ID | 模块 | 问题 | 缺失证据 | 最小验证 |
|---|---|---|---|---|
| G06 | Map/Sort | [0xBE2788] 真实虚表 dword | 进图后对象指针 | 转储读 [[0xBE2788]]（1 dword） |
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
