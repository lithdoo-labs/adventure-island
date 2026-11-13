# 逆向运行时残留清单（REVERSE-ENGINEERING-RUNTIME-REMAINING）

日期: 2026-11-13（clean-room 审计版）。仅收录**已证明静态资料不足**的未闭合项。每项附最小验证方案。
静态可解项见 REVERSE-ENGINEERING-GAP-REGISTER.md（全部闭合或定性）。
ID 与 Gap ID 的正式映射见 `research/source-of-truth/issue-crosswalk.csv`。

## 清单（7 项；R-01/R-02 已静态闭合为 0x5042D140/CWzGr2DLayer 族——见 G06，2026-11-13 移出）

| ID | 项 | 缺失证据 | 最小验证 | 预期收益 |
|---|---|---|---|---|
| R-03 | Avatar 插入键构造（=G08） | 进图运行时路径 | 进图转储 + Avatar 注册路径 | 人物/Obj 遮挡精确规则 |
| R-04 | Camera 跟随/deadzone（=G10=R4-08） | 进图输入循环 | 转储 [0xBDF54C] 族对象 | 镜头实现 |
| R-05 | +0x61 死亡位移位（=G11） | 77 disp8 候选无结构归属 | 进图 diff：user ±0x100 两转储对比 | 动作切换最后一未知位 |
| R-06 | +0x3BC 减计数机制（=G12） | 全库无 sub/dec（可能计算位移循环） | 进图采样 5000→0 轨迹 | alert 计时器实现 |
| R-07 | WINMM 实际调用序列（=G13） | 序号→函数名需同时代 DLL | 进图后解析值 + 枚举 waveOut | 音频 API 全名 |
| R-08 | DLL 运行时装载基址 | 捕获点早于 DLL 加载（时间戳证明） | 进图后第二次转储 | 虚表运行时绑定 |
| R-09 | [ebp-0x10] 对象具体虚表（tile 路径 @0x666F7D，=G24=G27=R4-01） | 变体对象运行时类 | 进图转储在 0x666F7D 前寄存器快照或 [[ebp-0x10] 链] 1 dword | slot45 终裁 + 参数序（G27）|

## 捕获前提

VM Windows 7 激活失败（C004F009）阻塞登录（ROUND8-S2C-FIX-CAPTURE-DIAG.md）。
修复路径：WinRE 离线 slmgr rearm 或更换磁盘镜像。
地址空间走查方法已就绪（RUNTIME-ADDRESS-SPACE.md：CR3=PDPT@0x3F6EC000 + 锚点验证法）。

## Round-3 增补（2026-11-13）

| ID | 项 | 最小验证 | 收窄说明 |
|---|---|---|---|
| R-09 | [ebp-0x10] 对象具体虚表（tile 路径 @0x666F7D） | 进图转储在 0x666F7D 前寄存器快照或 [[ebp-0x10] 链] 1 dword | 候选集已收窄至 R13-DISPATCH-RESOLUTION.csv 所列；slot45 在不同实现中语义不同（已证：析构/解码/属性/getter——插入语义已被 R4 全分类否定） |

（R-01/R-02 的 [0xBE2788] 虚表问题已在 Round-2/3 静态闭合为 0x5042D140/CWzGr2DLayer；容器插入语义移至 R-09。）

## Round 3.1 Task2 终版捕获方案（R-09 FINAL）

| 步骤 | 内容 |
|---|---|
| 断点 | **0x666F77**（tile 路径 smartptr GET 返回后）/ obj 路径同构点 |
| 寄存器 | ESI、EAX |
| 内存 | [ESI]（虚表指针）、[EBP-0x10]、ESI-8..ESI+0x28（48 字节对象头）|
| 长度 | 4+4+48 字节 |
| 预期 | [ESI] = 22 候选之一的虚表 VA → slot45 终裁；同时裁决 G27 参数序 |
| 判据 | 若 [ESI] ∈ Gr2D 0x2E2C4 族 → 插入假设彻底推翻（purecall/dtor）；若 Shape2D 0xC2C8 → 属性 getter；若 7 complex 之一 → 读体定论 |
