# Task 025 — Win7 post-PCA runtime localization

执行日期 2026-10-13。主环境：QEMU 7.2.22 (TCG, 2 vCPU, 2048 MB, `-nic none`,
`-cpu coreduo`) 内的 Windows 7 专业版 SP1, 6.1.7601, x86, 计算机名
`WIN7X86LAB`；每轮实验前用 QEMU 快照 `win7x86-clean`（2026-10-13 01:51:24
保存的干净桌面态）整体恢复（loadvm），VM 进程本身也每轮重建以保证设备树与
快照一致。观察由 guest 内提升权限的观察器
（`scripts/maple079_runtime_observe.ps1`）完成：普通进程 API 周期采样
CPU/工作集/线程/模块/窗口/进程表，一致地以 in-guest `BM_CLICK` 点击一次
程序兼容性助手的「运行程序」，全程无调试器、无 ReadProcessMemory、无线程
挂起、无 hook、无 patch。canonical `MapleStory.exe` SHA-256
`5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`
每轮在 guest 内 `certutil` 重新校验一致，既有静态 RVA 结论继续适用。

STARTING_HEAD `3286bac8167bc890f6700bfc3e860c22d36673d7`。

## 0. 结论速览

1. **PCA 只是警告**（系统 SDB 里的 MINORPROBLEM 条目，按 Wizet/Wizet
   MapleStory 元数据匹配）。点击「运行程序」后不写任何兼容性状态、不装
   shim、进程照常继续，appcompat 在点击之后没有再出现在因果链上。
2. **post-PCA 的真实分岔在客户端自己的 loader 内部**，由「客户端盘符」这
   一环境条件决定，而不是启动参数：
   - 客户端挂在 **F:**（6 轮：A1R2、A2R1、A3R1、A2E + Task 024 对照）：
     loader 完成 ~2.6–2.7 CPU 秒的工作（≈93% user），加载 repack 游戏侧
     运行库（`iloveaki.dat`@0x60000000、`ijl15.dll`、`MSVCR90.dll`、
     ole32/SHELL32/uxtheme 等），弹出 `#32770` 模态框「iloveaki」——正文
     **“iloveaki success.”**、一个「确定」按钮——然后整进程消息空闲，
     150 秒内 CPU 不再增长。
   - 客户端挂在 **G:**（5 轮：A1R1、A1R3、A1P、A1P2、A1E）：不加载任何
     游戏侧模块、不建任何窗口，进程初始线程以 ~0.95 CPU 秒/墙钟秒单线程
     空转（≈45% user / 55% kernel），150 秒不停。
   - `MapleStory.exe 127.0.0.1 9555`（A2）与原始 `单机登陆器.bat`（A3，
     内容确认为 `MapleStory.exe 127.0.0.1 9555`，SHA-256
     `9912f2f80e611f35649589609395f70d6a5bae80cf9f3284eb6fe11f16ea0105`）与
   裸启动（A1）**在同盘符下行为完全相同**。
   - Task 024 的两次裸启动（x64 RTM、x86 SP1）空转发生在 F: 上，是本
   矩阵之外的一个历史个例（其启动路径经非提升父进程 + 独立 UAC 提权，
   观察器也未提升）；Task 025 的受控矩阵内部盘符完全解释分岔。3. 空转阶段是**纯内存计算环**：ETW 内核跟踪（Win7 自带 NT Kernel
   Logger，文件+注册表+进程/线程+映像事件）显示游戏 PID 在 150 秒内
   **FileIo 事件为 0**，注册表事件只有进程启动时的一次性 46 Open +
   21 QueryValue 然后完全沉默。**没有任何反复的失败查找**（无 DLL 搜索
   环、无缺文件重试、无注册表轮询、无设备打开痕迹）。
4. 两类结局都**没有**到达 `ws2_32` / `PCOM` / `NameSpace` / WZ 运行时，
   没有 HackShield（HSUpdate/ASPLnchr/ehsvc/AspINet 全程未出现），没有
   任何 Oreans/SoftICE 运行态对象（服务、注册表、文件、驱动四路前后
   皆无）。网络门（socket 阶段）未达成，网络阶段按规则跳过。

**最终 Route：B（Natural protector/runtime hot loop localized）。**
启动参数不改变结果；被动观测把 post-PCA 稳定 CPU 活动阶段定位为「客户端
loader/保护层内部、无文件与注册表 IO 的单线程内存计算环」，并把成功边定
位到 repack 自己的 `iloveaki` 模态门（下一个跨不过去的可见边界是模态框
本身，其后才是 Wizet 游戏 DLL/网络边界）。

## 1. 实验矩阵与逐项数据

9 轮受控运行 + 2 轮 Task 024 基线。每轮：loadvm `win7x86-clean` → 全新
QEMU 进程 → 只读 guest gate（系统版本/防火墙/网卡/SICE…查询，见
`runs/<id>/gate-*.txt`）→ 提升观察器启动变体 → PCA 出现即点「运行程序」
→ 150 秒 2 Hz 采样 → 收尾快照 → guest 关机 → FAT 传输盘取回。
`result/task025-launch-matrix.csv`（量化矩阵）、
`result/task025-event-timeline.csv`（t0 归一化事件线）。

| run | 变体 | 客户端盘符 | 结局 | 150s 末 CPU(s) | WS(KB) | 窗口 |
| --- | --- | --- | --- | --- | --- | --- |
| A1R1 | 裸 | G: | 空转 | 73.9（线性 ~0.95/s） | 4,936 | 无 |
| A1R3 | 裸 | G: | 空转 | 96.1 | 4,944 | 无 |
| A1P/A1P2 | 裸+Procmon | G: | 空转 | 92.2/77.8 | 4,876/5,096 | 无 |
| A1E | 裸+ETW | G: | 空转 | 121.0 | 4,944 | 无 |
| A1R2 | 裸 | F: | **成功门** | 2.605（后恒定） | 7,224 | iloveaki |
| A2R1 | 127.0.0.1 9555 | F: | **成功门** | 2.652 | 7,248 | iloveaki |
| A3R1 | 原始 bat | F: | **成功门** | 2.699 | 7,224 | iloveaki |
| A2E | 9555 参数+ETW | F: | **成功门** | 2.839 | 7,248 | iloveaki |
| Task024 x86/x64 | 裸（非提升启动+独立 UAC） | F: | 空转 | ~101/~85 | 4,808/5,948 | 无 |

驱动器盘符由 USB 挂载竞态决定（FAT 传输盘先挂载则客户端成 G:），Task 025
用受控挂载顺序（`usb-attach-xferfirst`）两种布局都做了重复验证：分岔与
盘符 100% 相关（F:→成功门 6/6，G:→空转 5/5），与参数 0 相关。

## 2. 13 个必答问题

1. **`MapleStory.exe 127.0.0.1 9555` 与裸启动是否不同？** 不不同。同盘符
   下 A2≡A1（F: 两者都到成功门）；A1（G:）比 A2（F:）走得更近的反例证明
   参数不是分岔变量。
2. **原始 bat 与同命令行直启是否不同？** 不不同。A3 实测命令行
   `MapleStory.exe  127.0.0.1 9555`（相对路径，经 cmd start），行为与
   A2 逐指标一致；bat 内容执行前已确认并留档。
3. **PCA 是警告还是因果 blocker？** 只是警告。SDB 条目为 MINORPROBLEM
   （详见 `task025-appcompat-evidence.md`）；事件 ID 1 在 t0+0.1s 记录；
   点「运行程序」前后注册表逐字节相同（Compatibility Assistant Store 与
   Layers 均未写入）；`apphelp.dll` 点击后虽留在进程内但无任何进一步活
   动可观测，两种结局与是否加载观察器/ETW/Procmon 无关。
4. **谁在耗 CPU？** 进程的初始线程（首采样即存在、已积累 CPU）。空转结局
   中它占进程 CPU 的 99.6%（A1R1: 73.54/73.87 s），状态每次采样都是
   Running；其余 24 线程 0.00 s。
5. **user 还是 kernel？** 空转 ≈45% user / 55% kernel；成功 loader 突发
   ≈93% user / 7% kernel。空转的 kernel 份额伴随零文件/注册表 IO，说明
   是非 IO 类系统调用密集（具体系统调用不可知，栈采样被禁止）。
6. **running / waiting / 交替？** 空转 = 持续 Running；成功门 = 全体线程
   进入 Wait（模态消息环 UserRequest + 定时器 ExecutionDelay）后静止。
   没有交替摆动。
7. **线程数变化？** t0 时 1 线程，PCA 点击后 3–5 s 内一次性生成至 25，
   之后两类结局都恒定 25，无退出无新增。24 个工作线程中 14 个
   Highest/UserRequest 等待、9 个 Normal/ExecutionDelay 等待。
8. **模块时间线跨到 PCOM/NameSpace/ws2_32 了吗？** 没有。空转结局固定
   16 个系统模块（winmm 最后于 t0+5s 到位，此后再无新增）；成功结局加
   `iloveaki.dat/ijl15/MSVCR90/ole32/SHELL32/SHLWAPI/OLEAUT32/uxtheme/
   dwmapi` 后同样冻结。`ws2_32`、`PCOM`、`NameSpace`、`Canvas`、
   `ResMan`、`ZLZ`、`Gr2D_DX8`、`Sound_DX8`、`ehsvc`、`AspINet` 在全部
   9 轮中从未加载（后六个文件躺在客户端目录里但从未被加载）。
9. **有没有与 CPU 环时间相关的重复失败访问？** 没有。ETW 内核跟踪（A1E
   空转侧、A2E 成功侧）中游戏 PID 的 FileIo 事件为 0；注册表事件全部在
   启动突发内（空转侧 46 Open/21 QueryValue/1 Enumerate；成功侧 63/48/67）
   之后完全沉默；netstat 全程无游戏套接字。空转不是在等任何对象——是在
   纯计算。（`task025-repeated-operations.csv`）
10. **SICE/SIWVID/NTICE/Oreans/WinLicense 运行态对象？** 未观察到。六项
    服务查询前后皆无；`HKCU\Software\WinLicense`、`WLkt`、`Wine` 前后皆
    无；客户端目录与 `system32\drivers` 无新 `oreans*`；`driverquery`
    前后相同；ETW 中无设备/文件打开事件可归因于游戏。静态证据（`\\.\SICE`
    探针簇、`Oreans.vxd`、`oreans*.sys`、`XprotEvent` 等）维持
    **static-only**。（`task025-protector-runtime-events.csv`）
11. **instrumentation 是否改变行为？** 否。空转布局下叠加 Procmon
    （A1P/A1P2）与 ETW（A1E）后结局、CPU 曲线、模块集均与无插桩基线一致。
    附注：Sysinternals Procmon v4.11（官方源下载，SHA-256 记录于
    `.work/task-025/procmon/SOURCE.txt`）在 Win7 x86 SP1 上 GUI 与驱动都
    能起来但**捕获引擎不再支持 Win7**，只产出 976 字节空 PML——已按
    observer-affected/不可用记录；被动跟踪改用 Win7 自带 ETW 内核日志
    （flags 0x06020207），产出 19.9/21.0 MB 有效事件流。
12. **post-PCA 最早可辩护的边界？** 「客户端自己的 loader/保护层的内部
    分岔」。证据链：PCA 释放后（点击 ≤1.8 s 内）进程继续自走 → 无任何
    外部对象被反复访问（ETW 零 IO）→ 无外部依赖缺失（成功边证明同机同
    盘可完整走完 unpack）→ 分岔由盘符/卷标识类环境条件触发，全部行为差
    异发生在 MapleStory.exe 映像内的代码（无第三方模块参与）。
13. **blocker 归类？** 见 §0：不是 launch contract、不是 appcompat、不是
    缺依赖/服务/驱动，也不是游戏运行时迁移本身——是**保护器/repack
    loader 阶段的内部环境检查**（G: 布局下无限空转；F: 布局下走到自己的
    成功模态门）。因此 Route B。

## 3. 网络门评估（跳过声明）

网络门判据要求自然出现 `ws2_32` 加载、socket/connect 事件或
PCOM/NameSpace/游戏运行时模块。实际观测：9 轮中 `ws2_32` 从未加载、
netstat 无任何游戏套接字；「游戏运行时模块」仅以 repack 侧
（iloveaki.dat/ijl15/MSVCR90）形式出现，且进程随即停在自身模态框上——
在 Task 025 禁止游戏 UI 干预的约束下，socket 阶段不可达。**网络阶段跳过**
，原因：客户端止步于自身模态门且未初始化 Winsock；强行搭 9555 服务端不
会产生任何 SYN 可观察（也违反“不为完成任务强行搭 server”的门规则）。
`task025-network-observations.csv` 因此不生成。

## 4. 最早可辩护边界与最大不确定性

- **最早可辩护 post-PCA 边界**（confirmed-runtime）：点击「运行程序」后
  ~1.8 s 内进程恢复自由执行；此后的一切差异都产生于 MapleStory.exe 自身
  映像内的代码，分岔条件是客户端所在盘符/卷标识（F: 成功、G: 空转），
  分岔点在任何文件 IO 之前（ETW 零 FileIo）。
- **最大不确定性**：
  1. 空转环与静态保护链（SICE 探针簇 / `0x862000+` 解码区）的精确对应关
     系无法用允许的手段建立（线程起始地址只有 ntdll trampoline，栈与内
     存读取被禁止）。
  2. 盘符检查的机制未解：注册表事件的关键名无法从 tracerpt CSV 解出
     （ETW 里有事件但无符号解码），候选包括卷/挂载枚举类查询（成功侧
     EnumerateValueKey=67 vs 空转侧=1 是唯一显著差量）。
  3. Task 024 的一次 F: 空转（非提升父进程 + 独立 UAC 提权启动）暗示盘符
     之外可能还有第二个开关（提权路径/父进程环境），受控矩阵未覆盖该维
     度。
  4. 「iloveaki success.」模态框之后的路径（点击确定 → 是否进入 WZ/
     PCOM/ws2_32 → 是否连 9555）在 Task 025 的无 UI 干预约束下不可观测。

## 5. 建议的下一个任务

1. **静态分析 `iloveaki` repack 层**：`iloveaki.dat` 是被当模块映射的 PE
   （基址 0x60000000，与 exe 同目录），可完全离线解析；目标是找出 F:/G:
   盘符/卷标识检查与「success.」模态门的来源，把 Task 025 的分岔机制钉死。
2. 在**明确授权 UI 干预**（仅点击游戏自己的「确定」按钮一次）的前提下重
   复 F: 布局运行，观察模态框之后是否进入 WZ/PCOM/ws2_32 与 9555 —— 那是
   Route E 的判据实验。
3. 覆盖 Task 024 的历史例外维度（非提升父进程 + 独立 UAC 启动 × 盘符），
   判定提权路径是否为第二开关。

## 6. 产物清单

- `result/25-win7-post-pca-runtime-localization.md`（本文件）
- `result/task025-launch-matrix.csv`
- `result/task025-appcompat-evidence.md`
- `result/task025-thread-activity.csv`（9 轮全部逐采样线程数据）
- `result/task025-thread-summary.md`
- `result/task025-module-timeline.csv`
- `result/task025-process-window-timeline.csv`
- `result/task025-repeated-operations.csv`
- `result/task025-protector-runtime-events.csv`
- `result/task025-static-runtime-correlation.md`
- `result/task025-event-timeline.csv`
- `scripts/maple079_runtime_observe.ps1`（可复用 guest 观察器，PS 2.0 兼容）

原始证据（PML/EVT 截图/ETL/每轮完整输出）保留在 `.work/task-025/`
（不入库）：`runs/<RUNID>/`（观察器全部输出与 ETW 的 kernel.etl、
tracerpt CSV）、`logs/`（宿主侧屏幕转储与 OCR 文本）、`procmon/`
（官方下载记录与不可用证明）、`appcompat/sysmain-sdb-maple.txt`（SDB 解析）。
