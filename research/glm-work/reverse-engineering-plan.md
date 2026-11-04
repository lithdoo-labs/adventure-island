# CMS079 怀旧岛 079V5 客户端逆向研究总体计划

> 版本：v1.0（2026-10-10）
> 依据：本仓库 `README.md`、`research/task/001–010` 全部任务书、`research/result/` 全部已有结果、`research/scripts/`、`research/reference/maplestory-symbols/`、`.work/` 现场遗留物。
> 本文档只做规划，不改动仓库中任何已有文件；后续执行仍按仓库既有 Task / Result 工作流落盘。

---

## 目录

- [0. 文档说明](#0-文档说明)
- [1. 研究目标与最终交付物](#1-研究目标与最终交付物)
- [2. 样本与基线事实汇总](#2-样本与基线事实汇总)
- [3. 贯穿所有任务的执行边界](#3-贯穿所有任务的执行边界)
- [4. 现状盘点与未决问题清单](#4-现状盘点与未决问题清单)
- [5. 总体路线图](#5-总体路线图)
- [6. 阶段一：Protector 正常路径静态推进（当前最高优先级）](#6-阶段一protector-正常路径静态推进)
- [7. 阶段二：游戏镜像 materialization 建模](#7-阶段二游戏镜像-materialization-建模)
- [8. 阶段三：游戏代码识别与核心函数恢复](#8-阶段三游戏代码识别与核心函数恢复)
- [9. 阶段四：协议行为关联与验证](#9-阶段四协议行为关联与验证)
- [10. 阶段五：WZ 资源系统与周边 DLL 分析](#10-阶段五wz-资源系统与周边-dll-分析)
- [11. 阶段六：符号沉淀与长期文档化](#11-阶段六符号沉淀与长期文档化)
- [12. 并行支撑轨道](#12-并行支撑轨道)
- [13. 风险登记册](#13-风险登记册)
- [14. 成功度量与验收标准](#14-成功度量与验收标准)
- [附录 A：关键常量速查表](#附录-a关键常量速查表)
- [附录 B：已知 RVA / 地址索引](#附录-b已知-rva--地址索引)
- [附录 C：research/result/ 文件索引](#附录-cresearchresult-文件索引)
- [附录 D：任务历史与结论一览](#附录-d任务历史与结论一览)

---

## 0. 文档说明

### 0.1 目的

本计划把 Task 001–010 已确认的事实收敛成一张完整路线图，回答三个问题：

1. 我们现在确切知道什么、还不知道什么；
2. 从当前边界（SoftICE 探针正常路径 `0x00859780`）到最终目标（命名客户端网络栈、封包编解码、opcode 分发器、WZ 资源链路）之间还有哪些必经阶段；
3. 每个阶段的任务书应该怎么写（目标、输入、方法、产物、成功标准、失败时的回退路线）。

### 0.2 范围

- 覆盖对象：`.raw/怀旧岛079V5客户端.rar` 解出的 `冒险岛online/`（主样本 `MapleStory.exe`，SHA-256 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`）与 `.raw/.rar` 服务端（SHA-256 `e074714d6e0f6f3d94ca38e3aca7a10091eb19e9ba69fb2baf4ba02928f1bb1f`）。
- 本计划延续仓库既定的"分析型逆向"定位：**协议梳理、结构恢复、函数命名**；不制作外挂、不绕过反作弊、不分发脱壳样本。

### 0.3 维护方式

- 每完成一个 Task，回填本计划第 4 节的"未决问题清单"与第 5 节的里程碑状态；
- 路线选择发生变化时，在第 5 节决策门处记录理由与证据文件名；
- 本文件位于 `research/glm-work/`，属于规划文档，最终稳定结论仍以 `research/result/`、`docs/` 为准。

---

## 1. 研究目标与最终交付物

### 1.1 总目标

对国服 079（CMS079）怀旧岛 V5 客户端完成一次**可复现、证据驱动**的逆向研究，恢复其网络通信、封包编解码、opcode 分发、资源加载的核心逻辑，并沉淀为可跨样本复用的符号与文档。

### 1.2 分解目标（按优先级）

| # | 目标 | 判定完成的标志 | 现状 |
| --- | --- | --- | --- |
| G1 | 恢复客户端网络栈：`CClientSocket`（Connect/SendPacket/OnRead 等研究命名） | 候选函数 RVA + 调用关系 + 行为证据三重确认 | 未开始（游戏代码未 materialize） |
| G2 | 恢复封包编解码：header 生成/校验、AES OFB、自定义 6 轮变换、IV 更新的客户端实现 | 在客户端代码中找到与服务端 `MapleAESOFB` / `MapleCustomEncryption` 同源的常量与数据流 | 服务端侧已完全恢复（Task 002/004）；客户端侧锚点未出现 |
| G3 | 恢复 opcode 分发器与登录→进图链路 handler | 用两个以上不同 S->C opcode 证明同一分发点；`WARP_TO_MAP 0x81` handler 有候选 | 未开始 |
| G4 | 建立客户端↔服务端协议行为关联表 | 登录、世界列表、角色列表、选角、频道迁移、进图的 client handler ↔ server handler ↔ opcode 三方对齐 | 服务端单向已完成（`client-server-correlation.md`） |
| G5 | 梳理 WZ 资源加载链路与关键数据结构 | `List.wz`/`PKG1` 头解析方式、ResMan/Canvas/PCOM 的入口与对象模型有文档 | 未开始（周边 DLL 未加壳，可立即启动） |
| G6 | 沉淀长期文档与符号库 | `docs/00–05` 系列 + `symbols/` 函数命名表 | 目录尚未建立 |
| G7 | （支撑）完成 protector 语义级理解 | 从入口到游戏镜像移交点的完整链路图，含每个探针的语义 | 进行中，当前卡在探针集群中段 |

### 1.3 最终交付物清单

```text
docs/            长期逆向文档（00-baseline … 05-field 等）
symbols/         函数命名表（name / RVA / signature / evidence / confidence）
research/scripts/         可复现分析脚本（现有 7 个 + 后续新增）
research/result/          每个任务的结构化结果（持续追加）
research/reference/       合规参考材料索引与相关性种子
```

---

## 2. 样本与基线事实汇总

以下事实均已由 `research/result/` 中对应文件证实，后续任务直接引用，不重复推导。

### 2.1 输入样本

| 样本 | 路径 | SHA-256 | 证据 |
| --- | --- | --- | --- |
| 客户端归档 | `.raw/怀旧岛079V5客户端.rar` | `8439abc699fd3f20c9546a923a65593faf020a3a4b8be8b164dce37a38b6b247` | `00-baseline.md` |
| 主客户端 | `冒险岛online/MapleStory.exe` | `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d` | 同上 |
| 服务端归档 | `.raw/.rar`（文件名即为 `.rar`） | `e074714d6e0f6f3d94ca38e3aca7a10091eb19e9ba69fb2baf4ba02928f1bb1f` | `01-server-baseline.md` |
| 服务端 JAR | `079V5/dist/江浩079.jar` | `49382081ff5525380bc6024f61859d2e08c2983b0faca2554061c6d1218cf360` | 同上 |

### 2.2 客户端 PE 与地址空间

- PE32 x86，ImageBase `0x00400000`（运行时未观察到位移），SizeOfImage `0x009DA000`，入口 RVA `0x009D8000`（节 `jtrppsow`）。
- 静态导入仅 `kernel32.dll!GetLocalTime`；导出 `ZtlTaskMemAllocImp / FreeImp / ReallocImp`（RVA `0x005FC19F / 0x005FC1B0 / 0x005FC1C1`，槽位无磁盘字节）。
- Nexon Authenticode `Valid`（注意：签名覆盖的是当前字节，即"加壳后"的文件）。
- 地址空间分区（`client-address-space-model.md`）：

| RVA 区间 | 节 | 分类 |
| --- | --- | --- |
| `0x00001000–0x002CE000` | 第一个空格名节 raw 部分 | packed data（熵 7.98） |
| `0x002CE000–0x007EA000` | 同节虚拟尾（**Tail A**，约 5.1 MB） | 运行时待填充区；三个导出槽位在此；至今未被写入 |
| `0x007EA000–0x00818000` | `.rsrc` | 资源（熵偏高，不完全像普通资源目录） |
| `0x00818000–0x00819000` | `.idata` | 导入目录（挂 `GetLocalTime`） |
| `0x00819000–0x00912000` | 空格名节（**Tail B**，约 1 MB RWX） | 运行时生成区 = stage-2 protector 代码 |
| `0x00912000–0x009D8000` | `tpuaozxc` | packed source（T1/T2 输入） |
| `0x009D8000–0x009D9000` | `jtrppsow` | 入口 loader |
| `0x009D9000–0x009DA000` | `uvrwsdpb` | loader 旁小块，未被入口引用 |

### 2.3 服务端协议真值（客户端逆向的"标准答案"）

- 拓扑：登录 `127.0.0.1:9555` → 频道 `7575–7578`（`7574+channel`）→ 商城 `8600`；MySQL 3306 仅本地。
- 握手（每条新 TCP 连接，明文 15 字节）：`0D 00 4F 00 00 00 46 72 7A RR 52 30 78 SS 04`（version 79、空 patch、send IV `46 72 7A RR`、recv IV `52 30 78 SS`、locale 4）。
- 帧：`[4 字节头][密文]`；头由 IV 与版本字（发送 `-80`→`0xB0FF`、接收 `79`→`0x4F00`，注意字节交换）派生。
- 加密：正文先 `MapleCustomEncryption`（6 轮，偶数轮加 `72`、奇数轮异或 `0x13`）再 AES-256-ECB 首块密钥流 XOR（分段 1456/1460，Task 004 已修正并用 JAR 交叉验证）；每包后 IV 经 256 字节 `funnyBytes` 表更新。
- 关键锚点字节（用于未来在客户端内存/代码中搜索）：

| 锚点 | 值 |
| --- | --- |
| AES key（32B） | `13 00 00 00 08 00 00 00 06 00 00 00 B4 00 00 00 1B 00 00 00 0F 00 00 00 33 00 00 00 52 00 00 00`（SHA-256 `2c92f262…72ec2`） |
| IV 表前缀（256B 表） | `EC 3F 77 A4 45 D0 71 BF B7 98 20 FC 4B E9 B3 E1`（全表 SHA-256 `6a86cd82…6565`） |
| IV seed | `F2 53 50 C6` |
| 版本/locale | `4F 00` / `04` |

- 核心 opcode（完整表见 `protocol-opcodes.csv` / `client-reverse-targets.md`）：
  - C→S：`LOGIN_PASSWORD 0x01`、`SERVERLIST_REQUEST 0x02`、`CHARLIST_REQUEST 0x09`、`CHAR_SELECT 0x0A`、`PLAYER_LOGGEDIN 0x0B`、`CHANGE_MAP 0x21`、`MOVE_PLAYER 0x24`、`NPC_TALK 0x36`、`PONG 0x13`
  - S→C：`LOGIN_STATUS 0x00`、`SERVERLIST 0x09`、`CHARLIST 0x0A`、`SERVER_IP 0x0B`、`PING 0x14`、`WARP_TO_MAP 0x81`（初次载入模式字节 1、换图模式字节 3）、`SPAWN_PLAYER 0xA2`、`MOVE_PLAYER 0xBB`
- V5 特有行为：登录端口 9555（覆盖 8484 默认值）、自动注册、`LICENSE_REQUEST 0x03` 重定向到 ServerListRequest 等（见 `01-server-baseline.md` 第 4 节）。

### 2.4 已确认的保护链（截至 Task 010）

```text
EP RVA 0x009D8000 (jtrppsow, call/pop stub)
  │  地址数学: pop eax=0x00DD800A → -0xC6000 -0x5F3571 +0x5F3566 → VA 0x00D12000
  ▼
T1 @0x009D8046   原地 dword 解码 tpuaozxc 前 0x1000 字节
  │              (xor 0x4DDE8746 → add 0x5069D49F，0x400 次)
  ▼
解码后 stub @0x00912000 → 调用 T2
T2 @0x0091210A   aPLib 风格 depack（阈值 0x500 / 0x7D00）
  │              source 0x00912259–0x009D634A → dest 0x00819014–0x00911B25
  │              (块 SHA-256 5529577eec…2330c865，熵 7.7122)
  ▼
T3 @0x0081CB10   dec byte 解码 0x7000 字节 @0x0081CB21
  ▼
stage-2 入口 @0x0081C6C5（首次执行无 raw backing 代码；SEH + call/pop）
  │  重入标志 @0x0081B1A1；EBP 基 = pop(0x0081C6CF) - 0x074436BB
  ▼
host walk @0x0081CBB3   向下按页找 MZ+PE\0\0 → MapleStory 自身基址 0x00400000
  ▼
IAT 读取 @0x0081CC01   读 kernel32!GetLocalTime FirstThunk(0x0081802B) 的函数指针
  ▼
64KB 扫描 @0x0081CC60  ESI=func&0xFFFF0000，向下 50 步 × 0x10000
  │                     (0x76250000 miss → 0x76240000 hit)
  ▼
found path @0x0081CCC6  保存 kernel32 基址 → 槽位 0x0081A621、0x0081B45D
  ▼
round#1 @0x0081CE47     xor/add/xor 原地解码 0x0081CEB5–0x00824080
  │                     (xor 0x458541F1 → add 0x2E061E72 → xor 0x27D0B2FD, 7283 dword)
  ▼                     ← 解码出 export walker
round#2 @0x0081D5D8     反向 pop dword [eax] 0x1A99 项，跨度 0x0081D633–0x00824093
  ▼
export walker @0x0081CF01 + 共享 wrapper @0x00821750
  │  名字匹配 = 首字符门控 + AX/BX 混合校验和(xor 0x5041 / xor 0x5449)
  │  解析: kernel32!LoadLibraryA / GetLocalTime, user32!MessageBoxExA
  │  LoadLibraryA: USER32(0x76980000) / ADVAPI32(0x767F0000) / NTDLL(0x77080000)
  ▼
★ 当前边界: CreateFileA("\\.\SICE") 调用点 @0x00859757（字符串 @0x00859507）
     返回测试: inc eax / jne @0x00859779
     ├─ 设备不存在(普通系统,INVALID_HANDLE_VALUE) → 0x00859780  ← 正常路径(高置信)
     │    后续: \\.\SIWVID(串@0x00859882) → \\.\NTICE(串@0x008599BF) → …
     └─ 设备存在 → 0x00859A61（保存句柄, 向 walker 首字符槽写 'C'）
  ▼
WinLicense 注册表集群 @0x00856_000 窗口（静态可见，未执行）
     HKCU\Software\WinLicense / Software\WLkt + 值名 WinLicenseVersion 等 16 个
  ▼
？？？ → 未到达: Tail A 写入、ZtlTaskMem 槽位、游戏镜像、IAT 重建、
              AES/IV/WS2_32/WZ 锚点（全部未出现）
```

- 归因：**probable Oreans WinLicense**（medium，`Software\WinLicense` + `Software\WLkt` 双键；Themida 同引擎保持 possible；详见 `protector-attribution.md`）。
- 调试器行为：从进程创建附着 → RVA `0x00862E76`（ILLEGAL_INSTRUCTION）/`0x00862FB0`（PRIVILEGED_INSTRUCTION）→ 弹"检测到调试代码"→ 退出码 `0xFFFF9108`，均发生在 `ws2_32` 加载前。两 RVA 落在 T2 块内。
- 当前宿主环境阻断：Smart App Control（`VerifiedAndReputableDesktop`）以 `0xC0E90008` 拒绝 `HSUpdate.exe → AspINet.dll` 加载（confirmed policy block）；无调试器启动时客户端停在只有一个 OK 按钮的 `#32770` 对话框，正文两种 UI 方式都读不到。

---

## 3. 贯穿所有任务的执行边界

以下约束继承自 Task 001–010 任务书，是本仓库的硬性边界，**任何后续任务不得突破**：

1. `.raw/` 只读；工作副本放 `.work/task-NNN/`。
2. 不修改 `MapleStory.exe` 及任何组件；不 patch 生成代码、条件跳转、比较结果、寄存器状态。
3. 不伪造安全相关 API 返回值（`CreateFileA`、注册表、`BeingDebugged`、PEB/TEB 等）；离线模拟中 API stub 只返回"来自真实观测或公开 ABI 语义"的值。
4. 不隐藏调试器、不使用 anti-anti-debug、不注入 DLL、不 hook 真实进程、不伪造设备对象。
5. 不关闭 Smart App Control / Code Integrity / Defender 等系统安全机制来"让样本跑起来"。
6. 不生成、保存或提交可运行的 unpacked/decrypted EXE；不提交 memory dump、pcap/etl/evtx、生成代码 blob、大型反汇编数据库。
7. 不提交账号/密码/MAC/密钥等敏感信息，一律 `<redacted>`；不连接、不扫描样本中的公网地址。
8. 从互联网获取的 reference 二进制只放 `.work/`，只记录 URL/哈希/元数据；不下载明显面向作弊的工具。
9. 每个结论标注证据（文件、RVA、字节、调用关系）与置信度（confirmed/probable/possible/unsupported 或 high/medium/low）。
10. 提交前 `git status` / `git diff` 自查；commit 后正常 push，不 force push。

---

## 4. 现状盘点与未决问题清单

### 4.1 已完成（按任务）

| 任务 | 一句话结论 | 关键产物 |
| --- | --- | --- |
| 001 基线 | 主客户端识别、PE/节区/哈希/WZ 清单、壳判断 | `00-baseline.md`、`pe-summary.json` 等 |
| 002 服务端协议 | 端口/握手/帧/加密/opcode/登录→进图全链路恢复 | `protocol-*.md`、`protocol-opcodes.csv` |
| 003 运行时网络 | **失败但有价值**：调试器检测点定位（0x862E76/0x862FB0），封包脚本完成 | `02-runtime-network-bootstrap.md`、`research/scripts/maple079_packet.py` |
| 004 保护层 | 两个异常 RVA 无 raw backing；Dapan=VPN 噪声；protector 同类于 ehsvc.old | `protection-*.md`、`client-address-space-model.md` |
| 005 兼容性实验 | 0xC0E90008=Smart App Control 拒绝；无调试器运行停在无名对话框；选 Route C | `03-compatibility-passive-capture.md` |
| 006 静态 loader | T1/T2/T3 全恢复（aPLib）；Tail B=protector 代码；Tail A 未写 | `04-static-loader-dataflow.md`、`loader-*.md/csv` |
| 007 stage-2 扫描 | 扫描目标=kernel32（confirmed）；真实布局 replay 自然命中 found path | `05-stage2-pe-scan-correlation.md`、`stage2-*` |
| 008 原地解码 | round1/2 恢复；export walker 出现；停在 SICE 探针 | `06-stage2-inplace-decode.md`、`kernel32-consumer-trace.md` |
| 009 解析器与反调试边界 | walker 全量重建；解析 API 表；SICE 分支两侧静态分类 | `07-protector-resolver-antidebug.md`、`protector-*` |
| 010 WinLicense 参考 | 归因 probable WinLicense；normal edge=0x00859780（高置信）；Route A | `08-winlicense-reference-normal-path.md`、`winlicense-*` |

### 4.2 当前边界（一句话）

> 离线自然 replay 到达 `CreateFileA("\\.\SICE")`（第 2,409,207 条指令）即停；静态分析已判定普通系统走 `0x00859780`，但该边之后全部内容（SIWVID/NTICE 探针、WinLicense 注册表集群、更多自解码轮、游戏镜像 materialization）尚未恢复。

### 4.3 未决问题清单（本计划的驱动力）

| # | 问题 | 为什么重要 | 当前证据状态 |
| --- | --- | --- | --- |
| Q1 | `0x00859780` 边之后，SIWVID/NTICE 探针的完整控制流与收敛点是什么？ | 正常路径第一段；决定后续所有分析起点 | 仅见字符串 RVA（0x00859882/0x008599BF），未遍历 |
| Q2 | WinLicense 注册表集群每个调用的语义（open/query/write/close）与两种结果分支？ | 可能是探针，也可能是 protector 协调状态读写；影响"自然环境"建模 | 调用形状已记录，API 槽未解析（`winlicense-registry-cluster.md`） |
| Q3 | 探针集群之后是否存在新的确定性自解码轮？producer/transform/span？ | 每一轮解码都可能露出下一层结构 | round3+ 未见（Task 008/009 窗口内） |
| Q4 | 游戏镜像（Tail A 5.1MB + Ztl 槽位）由哪个 materializer 写入？source 在哪（第一节 packed raw `0x1000–0x2CE000` 是最大候选）？ | G1–G5 的前提 | Tail A 首页至今为 0 |
| Q5 | 游戏代码的 import/IAT 如何重建？（继续用 0x81CF01 walker？还是独立表？） | 决定函数调用图恢复方式 | 未知 |
| Q6 | 客户端网络栈（ws2_32 加载、socket 创建、connect）在链路哪一点初始化？ | 网络逆向的时机判断 | ws2_32 在真实进程 0x758E0000 已加载（Task 007 快照），但触发点未知 |
| Q7 | 无调试器时的 `#32770`"MapleStory"对话框正文是什么？阻塞在哪一层？ | 判断自然运行到底死在哪（兼容性/保护/网络） | Win32+UIA 均读不到正文 |
| Q8 | 客户端在"历史正确环境"（Win7 x86、无 Smart App Control、HS 组件可加载）能否自然进入登录 UI？ | 决定能否获得被动协议抓包（Task 005 Route B） | 无 VM 介质，未实验 |
| Q9 | `ehsvc.dll`(HSBypass)/`AspINet.dll`(079过HS DLL)/`冒险岛HS修正工具.exe` 这组私服侧改动的行为与启动依赖？ | 还原"这套私服如何让客户端跑起来"的完整图景 | 仅版本资源/PDB/静态字段（Task 001/005） |
| Q10 | 未加壳 Wizet DLL（ResMan/Canvas/PCOM/Gr2D/NameSpace/Shape2D/Sound_DX8/ZLZ/WzMss）的内部结构与主程序的交互协议？ | G5；且完全不依赖 protector 进展，可并行 | 仅 PE 元数据级（Task 001） |
| Q11 | `List.wz`（头 `05 00 00 00`，非 PKG1）的格式与用途？ | WZ 链路第一环（Canvas/PCOM 引用它） | 未解析 |
| Q12 | 客户端 AES/自定义变换常量是否与服务端 JAR 完全一致（同源）？ | 若一致，客户端 crypto 函数可由常量直接定位命名 | 服务端侧已确认；客户端侧待锚点出现 |
| Q13 | `research/reference/maplestory-symbols` README 声称的 `upstream/`、`derived/` 内容实际未提交，bundle 不完整？ | 符号关联阶段的前置 | 目录下只有 3 个 md 文件 |
| Q14 | `.work/task-011/` 已有 `cfg_follow.py`/`cfg.json`（probe 窗口 CFG 遍历起步），Task 011 任务书尚未立项？ | 避免工作遗散 | 未提交、无任务书 |

---

## 5. 总体路线图

### 5.1 阶段划分与依赖关系

```text
[可立即并行] ──────────────────────────────────────────────────────────┐
  轨道A: 未加壳 Wizet DLL 分析 (T-101)                                  │
  轨道B: reference bundle 补全 (T-102)                                  │
  轨道C: 兼容环境建设 (T-103, 受介质 availability 限制)                  │
  轨道D: 工具链维护 (持续)                                              │
                                                                        ▼
阶段一: Protector 正常路径静态推进 (Task 011 → 012 → 013)      [主线，当前]
  T011 探针窗口 CFG 静态全遍历 ──→ T012 后续解码轮/materializer 识别
        │                                │
        │        ┌── 若静态到达自然边界 ──┤
        │        ▼                        ▼
        │  T013 兼容环境自然观测     决策门 G1
        ▼
阶段二: 游戏镜像 materialization 建模 (Task 014–015)
  T014 Tail A / Ztl 槽位写入建模 → T015 游戏区函数边界+IAT 重建
        │
        ▼ 决策门 G2（锚点是否出现）
阶段三: 游戏代码识别与核心函数恢复 (Task 016–018)
  T016 锚点扫描+初步命名 → T017 网络栈/编解码恢复 → T018 dispatcher 恢复
        │
        ▼ 决策门 G3
阶段四: 协议行为关联与验证 (Task 019–020)
  T019 离线/被动协议验证 → T020 登录→进图 handler 全关联
        │
        ▼
阶段五: WZ 资源系统深入 (Task 021–022)  ← 也可与阶段三/四并行（依赖轨道A）
  T021 List.wz/PKG1 与 ResMan 链路 → T022 对象模型与字段/地图结构
        │
        ▼
阶段六: 符号沉淀与长期文档化 (Task 023，持续)
```

### 5.2 里程碑

| 里程碑 | 内容 | 判定 | 现状 |
| --- | --- | --- | --- |
| **M1** | 探针集群静态全图：SICE/SIWVID/NTICE/注册表集群的完整 CFG、每分支分类、收敛点 | `research/result/` 有完整 probe-map + 收敛分析 | 部分（SICE 已完，其余未遍历） |
| **M2** | 正常路径到达下一个非探针阶段（新解码轮 / import 重建 / Tail A materializer 任一） | 结构性识别 + RVA | 未达 |
| **M3** | 游戏镜像 materialization 确定性复现：Tail A 写入 + Ztl 槽位 + 函数边界 | 离线 replay 自然出现（或兼容环境自然出现） | 未达 |
| **M4** | 游戏代码锚点命中：AES key / IV 表 / WS2_32 / `.wz` 字符串 / RTTI 任一 | 地址 + xref | 未达（所有窗口均未命中） |
| **M5** | `CClientSocket` / 编解码 / dispatcher 候选地址表（带置信度） | `client-function-candidates.csv` 有非空行 | 未达 |
| **M6** | 协议链路三方对齐（client handler ↔ opcode ↔ server handler） | 关联表覆盖登录→进图 | 服务端单向已备好 |
| **M7** | `docs/` + `symbols/` 建立并回填 | 长期文档 6 篇 + 符号表 | 未建 |

### 5.3 决策门

| 门 | 位置 | 判据 | 分支 |
| --- | --- | --- | --- |
| **G1** | 阶段一末 | 静态遍历能否到达非探针阶段？ | 能→阶段二；不能且原因=依赖真实运行态→走 T013 兼容环境（VM 被动观测），仍不 patch；两者都堵→停在 M1 产出，转轨道 A/B 加深周边与参考研究 |
| **G2** | 阶段二末 | Tail A / 游戏镜像是否可复现 materialize？ | 能→阶段三；只有兼容环境能→把 VM 被动观测作为主证据源（配合只读内存元数据）；都不能→重新评估 reference client 获取路线（合法来源） |
| **G3** | 阶段三末 | crypto/network 锚点是否命中？ | 命中→阶段四正常推进；未命中→检查 materialization 完整性（是否还有未跑完的解码轮），必要时回到阶段二 |
| **G4** | 阶段四末 | 是否获得过一次真实客户端字节流（被动抓包）？ | 有→用真实流校验全部离线结论；无→以服务端 JAR 交叉验证 + 离线 selftest 作为替代置信源，并在文档中标注"未经真实客户端流量验证" |

---

## 6. 阶段一：Protector 正常路径静态推进

> 定位：当前主线的最前沿。Task 010 已选 **Route A**（继续读 `0x00859780` 侧，或在无 SoftICE 设备的真实环境自然观测）。本阶段把这一条边走到底。

### Task 011 — 探针窗口静态 CFG 全遍历（正常边优先）

> 注：`.work/task-011/` 已存在 `cfg_follow.py`（Capstone 前向 CFG 遍历器，含 `formed()` 地址公式 `pop+disp-0x074436BB`）与 `cfg.json`，说明该任务已自然起步；正式立项时应把该脚本规范化进 `research/scripts/` 并补任务书。

- **目标**：在不执行任何分支的前提下，把 `0x00856000–0x00862000` 探针窗口（以及向两侧自然延伸的范围）的完整控制流、每个 `call dword [slot]` 的形状、每条边的目标与收敛关系恢复成结构化数据。
- **输入**：`.work/task-009/probe-window.bin`（已 materialize 的窗口字节）、Task 009 的 `protector-resolver-cfg.csv`、`softice-branch-cfg.csv`。
- **方法**：
  1. 以 `0x00859780` 为根做前向 CFG（gadget chain 展开：call/pop/add/ret、push imm32; jmp 0x821750 等）；
  2. 对每个 API 调用点记录：槽位 RVA、参数构造（lea/push 序列）、参数值（字符串/立即数）、返回值测试指令、两侧分支目标；
  3. 专项恢复 SIWVID（`0x00859882`）与 NTICE（`0x008599BF`）两个 `CreateFileA` 调用点的参数与测试形状，与 SICE 对比；
  4. WinLicense 注册表集群（Task 009 已记录 16 个值名 + 3 参/6 参调用形状）：逐调用判定 open/query/write/close 语义倾向；**槽位不猜名**，保持 unresolved 记录参数模式；
  5. 标注所有分支的"普通系统预期结果"（设备不存在→INVALID_HANDLE_VALUE；注册表键不存在→open 失败），只作为文档性预期，不注入模拟器；
  6. 寻找两侧边的汇聚点（或证明不汇聚，如 SICE 边即如此）。
- **产物**：`research/result/09-probe-cluster-full-cfg.md`、`research/result/probe-window-cfg.csv`、`research/result/probe-call-sites.csv`、`research/scripts/maple079_probe_cfg.py`（规范化自 cfg_follow.py）。
- **成功标准**：窗口内全部可判读调用点有结构化记录；三个设备探针的异同有结论；注册表集群每个调用有语义倾向与置信度。
- **回退**：若 gadget 混淆导致遍历不可靠（如间接跳转不可解析），记录具体不可解析点，产出降级为"已解析子图 + 盲区清单"。

### Task 012 — 正常路径后续阶段识别（下一个 materializer / 解码轮 / import 重建）

- **目标**：回答 M2：正常边深处第一个"非探针"结构是什么——新的原地解码轮、新的 decompressor、import 表构建器、relocation 逻辑、Tail A/Ztl 写入、新可执行区、或 RTTI/WZ/Winsock/crypto 锚点（任何一类）。
- **输入**：Task 011 的 CFG 与盲区清单；`.work/task-009/round-2-post.bin`（解码后基线）。
- **方法**：
  1. 在 Task 011 CFG 的"普通系统预期路径"上（文档意义上的预期边）继续深挖静态可判读部分；
  2. 扫描窗口内剩余字节中的自解码迹象：固定常数 xor/add 链（参考 round1 的 `0x458541F1/0x2E061E72/0x27D0B2FD` 模式）、计数循环、`lodsb/lodsw/stosb` 族；
  3. 检查对 Tail A（`0x002CE000–0x007EA000`）与 Ztl 槽位（`0x5FC19F/0x1B0/0x1C1`）的任何地址形成（立即数、基址算术）；
  4. 检查对第一节 packed raw（`0x001000–0x2CE000`）的读取引用——它是游戏镜像最可能的压缩源；
  5. 若识别出确定性 transform（输入不依赖未观测运行态），可离线执行该 transform 后做差分 anchor 扫描（AES/IV/WZ/WS2_32/RTTI/`55 8B EC` 密度）。
- **产物**：`research/result/10-post-probe-stage.md`、`research/result/next-transform-candidates.csv`、（若执行）`research/result/task012-anchor-scan.csv`。
- **成功标准**：M2 有明确答案（结构识别 + RVA + 证据），或给出精确 blocker（依赖哪个具体运行态值）。
- **回退**：静态不可达 → 触发 G1 评估 T013。

### Task 013 — 兼容环境自然观测（受控、被动）

- **前置**：轨道 C 的 Win7 SP1 x86 VM 就绪；或用户明确批准在某台无 SoftICE 设备、无 Smart App Control 干扰的物理机上观测。
- **目标**：让客户端在"历史正确环境"中自然跑到比离线 replay 更远的阶段，用**只读**手段记录：模块加载时间线（ws2_32 何时出现）、TCP 连接（9555/7575-7578/8600）、进程布局、（若出现网络流）被动抓包 + `maple079_packet.py` 离线解码。
- **方法**：
  1. VM 内：合法介质安装、离线/host-only、快照；服务端同 VM 或同隔离网段（记录地址变化）；
  2. 无调试器启动 `MapleStory.exe 127.0.0.1 9555`；
  3. 只读观测清单复用 Task 005 D3/F（Get-NetTCPConnection、ETW ImageLoad、pktmon/Npcap loopback）；
  4. 若连上 9555：按 Task 005 F 流程恢复握手→首 C→S(0x01)→首 S→C→（尽量到）频道迁移与 `WARP_TO_MAP 0x81`；
  5. 所有原始 pcap/日志留 `.work/task-013/`，只提交结构化事件表。
- **产物**：`research/result/11-compat-vm-natural-run.md`、`research/result/protocol-session-events.csv`（真实流）、更新 `compatibility-matrix.csv`。
- **成功标准**：最低——VM 内 AspINet 是否加载、客户端是否过对话框有明确证据；理想——捕获真实 15 字节握手与至少一条可解密业务包。
- **注意**：VM 内同样不装调试器隐身工具、不换 bypass DLL（客户端包内自带的 `ehsvc.dll`(HSBypass) 是样本原始状态，保持原样即可）。

---

## 7. 阶段二：游戏镜像 materialization 建模

### Task 014 — Tail A / ZtlTaskMem 写入链建模

- **目标**：确定写入 Tail A 的 materializer：producer RVA、source range（重点验证第一节 packed raw `0x001000–0x2CE000`）、destination 精确范围、transform（是否又是 aPLib 变体）、长度来源；Ztl 三槽位（间距 0x11）写入的字节语义（thunk? 短 wrapper?）。
- **方法**：
  1. 若 Task 012 已识别 materializer 入口：离线（或 VM 内被动内存元数据）跟踪大块写入，复用 Task 006 Phase F 的记录规范（熵、SHA、指令密度、RTTI/API 指针密度）；
  2. 差分扫描每轮稳定后的新增区（Task 008 Phase H 方法论）；
  3. 监控 `E1–E10` 事件类（写 Tail A / 写 Ztl / 执行出 Tail B / 新分配 / crypto 锚点出现…）；
  4. 产出 Tail A 内部分区草图（哪段是代码、哪段是重建 IAT、哪段是数据/relocation 表）。
- **产物**：`research/result/12-game-materialization.md`、`research/result/taila-materialization-events.csv`、`research/result/taila-region-map.csv`。
- **成功标准**：M3 判据达成（确定性复现或 VM 内自然出现 + 元数据证据链完整）。

### Task 015 — 游戏区函数边界与 import 重建恢复

- **目标**：对 materialized 游戏区建立函数级模型：函数边界（MSVC 序言密度、调用图）、import/IAT 表位置与解析方式（是否复用 `0x81CF01` walker）、relocation/fixup 表。
- **方法**：
  1. 指令密度/序言扫描 + 线性反汇编 + CFG（可引入 Ghidra headless，注意不提交工程库）；
  2. IAT 候选表识别：指向已解析 API 槽（`0x81A81D` 等）或系统模块 VA 的指针簇；
  3. 与 Task 007 真实进程布局快照交叉（`process-layout-snapshot.csv`）验证模块假设。
- **产物**：`research/result/13-game-function-boundaries.md`、`research/result/game-iat-map.csv`。
- **成功标准**：游戏区函数数量级、IAT 表、与 protector 区的分界线清晰；G2 决策门可评估。

---

## 8. 阶段三：游戏代码识别与核心函数恢复

### Task 016 — 锚点扫描与初步命名

- **目标**：在 materialized 游戏区系统搜索并交叉验证：AES key（32B）、IV 表前缀、IV seed、`WS2_32`/`WSAStartup`/`connect`/`send`/`recv`、`List.wz`/`.wz`、MSVC RTTI（`.?AV`）、Wizet/Nexon 字符串。
- **方法**：常量搜索 → 地址 → 代码 xref → 数据流/调用栈双重证据后才命名（延续 Task 003 Phase H 标准：常量命中 ≠ 函数命名）。
- **产物**：`research/result/14-game-anchors.md`、`research/result/anchor-hits.csv`、首批 `client-function-candidates.csv` 实地址行。

### Task 017 — 网络栈与封包编解码恢复（G1+G2 核心）

- **目标**：恢复客户端侧（研究命名）：`CClientSocket::Connect/SendPacket/OnRead`、`GetPacketHeader/GetPacketLength`、`MapleCrypto` 同源实现（客户端侧 AES OFB + 6 轮变换 + IV 更新）、与 Task 002 服务端算法的逐字节对拍。
- **方法**：
  1. 从 AES key xref 出发定位 crypto 状态对象与 `crypt` 循环（找 1456/1460 分段常量、`funnyBytes` 表引用）；
  2. 从 `connect`/`WSAConnect`（系统断点不可用时用静态 ws2_32 thunk xref）向上回溯；
  3. 用 `maple079_packet.py` 做"客户端实现 vs 服务端实现"一致性对拍（复用 Task 004 crosscheck 方法论与 15 个测试长度）；
  4. 记录 socket/crypto 对象生命周期（登录连接 vs 频道连接两次实例化对比，验证 Task 003 Phase K 设计）。
- **产物**：`research/result/15-client-crypto-network.md`、`research/result/client-function-candidates.csv`（crypto/network 组）。

### Task 018 — Opcode dispatcher 恢复

- **目标**：定位 opcode 读取点与分发结构（switch/jump-table/table-call），用 ≥2 个不同 S→C opcode（优先 `LOGIN_STATUS 0x00` + `SERVERLIST 0x09`，或 `SERVER_IP 0x0B`）证明同一分发点。
- **方法**：从解密后明文缓冲区（Task 017 恢复的 OnRead 下游）追踪首 2 字节读取 → 分发；恢复 handler 注册/跳转表结构。
- **产物**：`research/result/16-dispatcher.md`、候选 `candidate_PacketDispatcher`、`candidate_Handler_*`。

---

## 9. 阶段四：协议行为关联与验证

### Task 019 — 离线协议验证（无真实流量时的替代路径）

- **目标**：用服务端 JAR（本地起服或纯离线构造）生成握手→登录→列表→选角→迁移→进图的完整字节流样本，喂给对 Task 017/018 恢复的客户端路径做"纸面对拍"（字段顺序、长度、IV 演进全部对齐）。
- **产物**：`research/result/17-protocol-offline-verification.md`、扩展 selftest 用例集。

### Task 020 — 登录→进图 handler 全关联（M6）

- **目标**：完成 G4 关联表：每个协议事件的 client handler 候选 ↔ opcode ↔ server handler/builder ↔ 期望运行时字节 ↔ 置信度。覆盖：connect/handshake/login/world list/charlist/char select/channel redirect/channel handshake/PLAYER_LOGGEDIN/WARP_TO_MAP/movement。
- **产物**：`research/result/18-client-server-handler-map.csv`（升级自 `client-server-correlation.md`）。

### Task 020b —（若 G4=有真实流量）被动抓包全解码

- 复用 Task 005 F + Task 013 的捕获，按 stream 重组、逐包解密、与 Task 020 关联表互证；脱敏后只提交事件表与短样例。

---

## 10. 阶段五：WZ 资源系统与周边 DLL 分析

> 本阶段与阶段三/四无强依赖，可在轨道 A 成果上随时展开。

### Task 021 — 未加壳 Wizet DLL 结构分析（对应轨道 A 的深化）

- **对象**：`ResMan.dll`（资源管理入口）、`Canvas.dll` / `PCOM.dll`（字符串含 `List.wz`）、`NameSpace.dll`、`Shape2D.dll`、`Gr2D_DX8.dll`、`Sound_DX8.dll`、`ZLZ.dll`（ZLZCreateInflator/Deflator）、`WzMss.dll`（WzSoap_*，静态导入 WS2_32）、`ijl15.dll`/`iloveaki.dat` 双文件关系。
- **重点**：
  1. `PCOM.dll` 中 `PWS2_32.DLL` 字符串的 xref（延迟加载 or 残留）；
  2. `List.wz`（头 `05 00 00 00`）如何被 Canvas/PCOM 消费 → 直接推进 Q11；
  3. `PCOM.dll` 导出族（PcCreateObject 等）勾勒的组件对象模型；
  4. ResMan 的 WZ 打开/读取入口签名（未来与主程序侧调用对齐）。
- **产物**：`research/result/19-wizet-dlls.md`、`research/result/resman-entry-points.csv`。

### Task 022 — List.wz / PKG1 目录级解析

- **目标**：16 个 `PKG1` WZ 的目录树解析（仅目录/元数据，不提取内容物）；`List.wz` 头部格式判定；WZ 版本差异记录（2010-01 vs 2016-05 vs 2017-07 三组修改时间对应的文件集合）。
- **产物**：`research/result/20-wz-inventory.md`、`research/result/wz-directory-index.csv`。

### Task 022b —（远期）资源对象模型与进图数据结构

- 依赖游戏代码侧 `WARP_TO_MAP` handler 恢复；对齐字段/地图对象（`CField`、`CUserLocal` 等研究命名）与 WZ 数据的使用关系。

---

## 11. 阶段六：符号沉淀与长期文档化

### Task 023 — docs/ 与 symbols/ 建立（持续）

- **目标**：当 M5/M6 达成或阶段性稳定时，把 `research/result/` 结论整理进 README 规划的长期结构：

```text
docs/
├── 00-baseline.md          ← 00-baseline.md + 01-server-baseline.md
├── 01-pe-and-imports.md    ← pe-summary + address-space-model
├── 02-network-stack.md     ← Task 017/018 成果
├── 03-packet-codec.md      ← protocol-crypto + 客户端侧对拍
├── 04-opcodes.md           ← protocol-opcodes + dispatcher
└── 05-field.md             ← WARP_TO_MAP / CField（远期）
symbols/
└── functions.csv           ← name,rva,signature,callers,callees,evidence,confidence
```

- **命名规范**：沿用 README 的记录约定（Name/VA/RVA/Caller/Callee/Strings/Imports/Signature/Evidence/Notes），优先 RVA+字节签名而非绝对地址；跨版本参考名（v95/v83）必须按 `research/reference/maplestory-symbols/README.md` 的证据顺序独立验证后才可赋予。

---

## 12. 并行支撑轨道

### 轨道 A — 未加壳 Wizet DLL 分析（T-101，可立即开始）

- 零依赖于 protector 进展；产出直接服务 G5 与阶段五。建议作为主线等待期的填充任务，用 Ghidra 批处理 + 字符串/导出/导入交叉引用建立首批 DLL 内部符号。

### 轨道 B — reference bundle 补全（T-102，Q13）

- 现状：`research/reference/maplestory-symbols/` 只有 LEGAL/README/SOURCES 三个文件，README 声称的 `upstream/Bia10.Maple.Client.V95/`、`upstream/Bia10.Maple.Enums/`、`derived/*.csv|md` 均不存在。
- 行动：按 SOURCES.md 的 pinned commit 重新引入合规（MIT）材料；生成 `derived/cms079-correlation-seeds.csv`（v95/v83 中网络/crypto 类函数家族 → CMS079 待验证种子）；保持 LEGAL.md 的不镜像二进制政策。
- 这是阶段三函数命名的弹药库，应在 M3 之前完成。

### 轨道 C — 兼容环境建设（T-103，Q8）

- 需要合法 Windows 7 SP1 x86 安装介质；本机当前没有（Task 005 记录）。行动项：确认介质来源（用户自有 MSDN/零售副本）→ 建 VM → 快照基线。**不得**从不可信渠道下载 ISO。
- 该轨道阻塞 Task 013；若长期无法获得介质，G1 的回退分支自动生效（主线继续静态）。

### 轨道 D — 工具链与脚本维护（持续）

- 现有 7 个脚本（`maple079_packet/loader_map/loader_emulate/stage2_scan/stage2_continue/protector_resolver/device_probe_observer.c`）需保持：客户端哈希自检、replay 复现路径向后兼容（Task 007 立下的规矩）。
- 计划新增（对应本计划各任务）：`maple079_probe_cfg.py`（T011）、Tail A 监控扩展（T014）、Ghidra headless 批处理脚本（T015/T-101）、WZ 目录解析器（T022）。
- 环境：Python 3.14 + pefile 2024.8.26 + Capstone 5.0.7 + Unicorn 2.1.4；Ghidra 未安装，阶段二前应部署。

### 轨道 E — 私服侧改动组件行为记录（T-104，Q9，低优先级）

- `ehsvc.dll`(HSBypass)、`AspINet.dll`(079过HS DLL)、`冒险岛HS修正工具.exe`、`单机登陆器.bat`：只做静态（导入/字符串/资源）与被动行为记录，目标是解释"这套私服预期的启动方式"，不执行、不修改。与 Task 013 的 VM 观测互补。

---

## 13. 风险登记册

| # | 风险 | 影响 | 概率 | 缓解 |
| --- | --- | --- | --- | --- |
| R1 | 探针集群后仍有大量自解码轮，静态遍历成本爆炸 | M2 延迟 | 中-高 | 工具化 CFG follower + 解码轮模板识别（xor/add 常数链已两次出现，形成特征）；每轮做差分而非全量 |
| R2 | 正常路径依赖真实运行态（如注册表存在性、其他进程），静态不可达 | G1 走回退 | 中 | T013 VM 自然观测；文档化"普通系统预期值"作为 VM 内对照 |
| R3 | Smart App Control 不可关（合法约束），VM 介质不可得 | Q8 永久开放 | 中 | 主线完全静态+离线 replay 已被证明可走很远（Task 006–010）；真实流量缺失用 Task 019 离线对拍替代 |
| R4 | Tail A materializer 依赖未观测的内存状态（如完整 PEB/TEB、其他模块） | M3 卡住 | 中 | 允许把真实观测到的模块按 Task 007/008 先例映射进 emulator（"process-layout replay"，非 patch）；新的依赖按 Phase J 规范补元数据 |
| R5 | kernel32 基址/版本随系统变化，replay 不可复现 | 结论漂移 | 低 | 已有先例：记录 kernel32 磁盘 SHA-256 + 观测基址（Task 008 Phase A 规范），所有 replay 报告附带 |
| R6 | 客户端 crypto 与服务端实现存在差异（如分段长度、IV 更新细节） | G2 对拍失败 | 低-中 | Task 004 crosscheck 方法论直接复用：多长度、双向、next-IV、header 四元组对拍；差异本身即是发现 |
| R7 | 游戏代码函数命名被参考材料"污染"（v95 RVA 直套 CMS079） | 符号库错误 | 中 | 严格执行 reference bundle README 的 5 级证据顺序 + LEGAL 政策；跨版本名一律标 confidence ≤ medium 且注明来源 |
| R8 | 无意中提交敏感/受版权内容 | 仓库政策违规 | 低 | 每任务提交前 `git status`/`git diff` 自查清单（第 3 节第 6-8 条）；result 只放元数据/地址/短样例 |
| R9 | WinLicense 探针在读到"意外"注册表/环境状态时走破坏性分支（文档意义上的） | VM 观测风险 | 低 | VM 快照 + 隔离网络；观测而非交互；不主动创建探针寻找的键/设备 |
| R10 | 任务范围蔓延（如顺手动保护组件） | 边界违规 | 低 | 每个任务书保留"Hard boundaries"节（Task 009/010 格式）；执行前重读第 3 节 |

---

## 14. 成功度量与验收标准

### 14.1 计划级验收（本计划完成的定义）

1. **必须**：M1（探针全图）+ M2（下一阶段识别）——这是当前边界上的最小可交付前进；
2. **应该**：M3（游戏镜像 materialization）+ M4（锚点命中）——打开游戏代码研究;
3. **理想**：M5+M6（函数候选表 + 协议关联）+ M7（docs/symbols 建库）。

### 14.2 单任务验收通用标准（写入每个任务书）

- 样本哈希与基线一致（客户端 `5d280cf1…`），不一致即停、不套用旧 RVA；
- 每条结论有证据文件 + 置信度；`not observed` / `blocked` 也如实写；
- 未破坏第 3 节任何边界；产物进 `research/result/`、临时进 `.work/task-NNN/`；
- 提交信息沿用 `Complete Task NNN <subject>` 格式，正常 push。

### 14.3 质量红线（任何任务触发即停并记录）

- 需要伪造安全相关 API 返回值 / patch 分支才能继续 → 停，记录 blocker，转决策门；
- 需要关闭系统安全机制 → 停；
- 需要提交原始二进制/dump/大 blob → 停，改提交元数据。

---

## 附录 A：关键常量速查表

### A.1 样本哈希

| 对象 | SHA-256 |
| --- | --- |
| 客户端 RAR | `8439abc699fd3f20c9546a923a65593faf020a3a4b8be8b164dce37a38b6b247` |
| MapleStory.exe | `5d280cf1c5663e925104736e73e5715a529d25420babf410cc411b37940f4d` |
| 服务端 RAR（`.raw/.rar`） | `e074714d6e0f6f3d94ca38e3aca7a10091eb19e9ba69fb2baf4ba02928f1bb1f` |
| 江浩079.jar | `49382081ff5525380bc6024f61859d2e08c2983b0faca2554061c6d1218cf360` |
| T2 生成块（0x819014 起 0xF8B11 字节） | `5529577eec208295e36d61dc11aee42ebe45f7ffb511691f5679676b2330c865` |
| SysWOW64 kernel32.dll（replay 用） | `bafd9e061964642802d62f1eb694e7e4af60de739a8df1a492f90006dc5680f3` |

### A.2 协议常量

| 项 | 值 |
| --- | --- |
| 握手模板 | `0D 00 4F 00 00 00 46 72 7A RR 52 30 78 SS 04` |
| 版本 / locale | 79 / 4 |
| 发送版本字（swap 后） | `0xB0FF`（构造参数 -80） |
| 接收版本字（swap 后） | `0x4F00`（构造参数 79） |
| 头长度 | 4 字节 |
| AES | AES-256-ECB 首块密钥流 XOR；分段 1456→1460 |
| AES key | `13 00 00 00 08 00 00 00 06 00 00 00 B4 00 00 00 1B 00 00 00 0F 00 00 00 33 00 00 00 52 00 00 00` |
| IV 表前 16B | `EC 3F 77 A4 45 D0 71 BF B7 98 20 FC 4B E9 B3 E1` |
| IV seed | `F2 53 50 C6` |
| 自定义变换 | 6 轮；偶数轮加 `72`；奇数轮异或 `0x13` |
| 端口 | 登录 9555；频道 7575–7578；商城 8600 |

### A.3 核心 opcode（小端 short，完整表见 `research/result/protocol-opcodes.csv`）

| 方向 | hex | 名称 | | 方向 | hex | 名称 |
| --- | --- | --- | --- | --- | --- | --- |
| C→S | 0x01 | LOGIN_PASSWORD | | S→C | 0x00 | LOGIN_STATUS |
| C→S | 0x02 | SERVERLIST_REQUEST | | S→C | 0x09 | SERVERLIST |
| C→S | 0x09 | CHARLIST_REQUEST | | S→C | 0x0A | CHARLIST |
| C→S | 0x0A | CHAR_SELECT | | S→C | 0x0B | SERVER_IP |
| C→S | 0x0B | PLAYER_LOGGEDIN | | S→C | 0x81 | WARP_TO_MAP（载入=1/换图=3） |
| C→S | 0x21 | CHANGE_MAP | | S→C | 0xA2 | SPAWN_PLAYER |
| C→S | 0x24 | MOVE_PLAYER | | S→C | 0xBB | MOVE_PLAYER |
| C→S | 0x36 | NPC_TALK | | S→C | 0x14 | PING |
| C→S | 0x13 | PONG | | | | |

## 附录 B：已知 RVA / 地址索引

> ImageBase `0x00400000`；"槽位"指 protector 数据/指针存放处。全部证据见括号内文件。

### B.1 PE 区域

| RVA | 含义 |
| --- | --- |
| `0x001000–0x2CE000` | 第一节 packed raw（**Tail A 压缩源最大候选**，未验证） |
| `0x2CE000–0x7EA000` | Tail A 虚拟尾（未写入） |
| `0x5FC19F/0x5FC1B0/0x5FC1C1` | ZtlTaskMem 三槽位（未写入，间距 0x11） |
| `0x7EA000/0x818000` | `.rsrc` / `.idata` |
| `0x819000–0x912000` | Tail B（stage-2 protector 运行时区） |
| `0x912000–0x9D8000` | `tpuaozxc` packed source |
| `0x9D8000/0x9D9000` | `jtrppsow` 入口 / `uvrwsdpb` |

### B.2 保护链代码（producer）

| RVA | 角色 |
| --- | --- |
| `0x9D8000` | 入口 stub（call/pop） |
| `0x9D8046` | T1 dword 解码（xor 0x4DDE8746, add 0x5069D49F） |
| `0x912000` | 解码后 stub / T2 调用者 |
| `0x91210A` | T2 aPLib depack |
| `0x819014` | T2 目标起点（首个生成指令，jmp → 0x81C6C5） |
| `0x81CB10` | T3 dec-byte（0x7000 字节 @0x81CB21） |
| `0x81C6C5` | stage-2 入口（首个无 raw backing 执行） |
| `0x81CBB3` | host walk（找主映像 PE） |
| `0x81CC01` | 读 IAT（GetLocalTime FirstThunk 0x81802B） |
| `0x81CC60` | kernel32 64KB×50 扫描 |
| `0x81CCC6` | found path |
| `0x81CE47` | round#1 解码 producer |
| `0x81D5D8`（环 0x81D594–0x81D622） | round#2 producer |
| `0x81CF01` | export walker |
| `0x821750` | 共享 wrapper（push imm32 描述符游标） |
| `0x859757` | `CreateFileA("\\.\SICE")` 调用点 |
| `0x859779` | `inc eax / jne` 返回测试 |
| `0x859780` / `0x859A61` | 设备缺席（正常）边 / 设备在场边 |
| `0x862E76` / `0x862FB0` | 调试器附着时的两条异常 RVA |

### B.3 protector 数据槽位

| RVA | 内容 |
| --- | --- |
| `0x81A621`、`0x81B45D` | 保存的 kernel32 基址 |
| `0x81A81D`、`0x81AAA5`、`0x821478` | walker 输出 / API 指针槽 |
| `0x81A361` | walker 首字符门控槽（设备在场边写 `'C'`） |
| `0x81A331` / `0x81A7ED` / `0x819101` | AddressOfFunctions / Names / NameOrdinals 槽 |
| `0x81CEB7` | NumberOfNames 槽 |
| `0x81AD91` | 名字索引计数槽 |
| `0x81B1A1` | stage-2 重入标志 |
| `0x859507` / `0x859882` / `0x8599BF` | SICE / SIWVID / NTICE 字符串 |
| `0x859C24` | WinLicense 注册表字符串表（16 项） |
| `0x859D07` | `HKCU\Software\WinLicense` |

### B.4 观测到的模块布局（本机快照，随系统变化）

| 模块 | 基址 | 备注 |
| --- | --- | --- |
| kernel32.dll | `0x76240000` | GetLocalTime VA `0x7625D430` |
| USER32.dll | `0x76980000` | |
| ADVAPI32.dll | `0x767F0000` | |
| NTDLL.dll | `0x77080000` | |
| ws2_32.dll | `0x758E0000` | 在扫描窗口之下，扫描不会命中它 |

## 附录 C：research/result/ 文件索引

| 主题 | 文件 |
| --- | --- |
| 基线 | `00-baseline.md`、`file-manifest.csv`、`pe-summary.json`、`main-client-imports.txt`、`interesting-strings.txt` |
| 服务端 | `01-server-baseline.md`、`server-file-manifest.csv`、`server-config-index.md`、`server-topology.md` |
| 协议 | `protocol-handshake.md`、`protocol-crypto.md`、`protocol-opcodes.csv`、`protocol-flow-login-to-field.md`、`protocol-session-events.csv` |
| 客户端关联 | `client-server-correlation.md`、`client-reverse-targets.md`、`client-function-candidates.csv`（空表）、`client-address-space-model.md` |
| 运行时 | `02-runtime-network-bootstrap.md`、`runtime-module-map.txt`、`runtime-network-events.csv`、`runtime-crypto-anchors.md`、`runtime-dialog-observation.md` |
| 兼容性 | `03-compatibility-passive-capture.md`、`code-integrity-findings.md`、`hshield-load-chain.md`、`compatibility-matrix.csv`、`compatibility-runtime-events.csv` |
| 保护层 | `protection-component-map.md`、`protection-rva-analysis.md`、`local-helper-topology.md`、`passive-network-topology.csv`、`protector-identification.md` |
| loader/stage2 | `04-static-loader-dataflow.md`、`loader-entry-analysis.md`、`loader-region-map.csv`、`loader-address-references.csv`、`loader-transform-candidates.csv`、`loader-emulation-observations.md` |
| materialization | `materialization-map.csv`、`materialization-hypotheses.md`、`materialized-anchor-hits.csv`、`anti-debug-rva-materialization.md`、`ztltaskmem-materialization.md` |
| stage2 细节 | `05-stage2-pe-scan-correlation.md`、`stage2-scan-*.md/csv`、`stage2-register-provenance.md`、`stage2-pe-validation.csv`、`stage2-found-path-*.md/csv`、`stage2-offline-replay.md`、`process-layout-snapshot.csv`、`stage2-decode-rounds.csv`、`stage2-selfmod-cfg.md`、`stage2-runtime-events.csv`、`06-stage2-inplace-decode.md`、`first-cross-tailb-write.md`、`materialization-events-task008.csv`、`task008-anchor-timeline.csv`、`protector-vs-game-transition.md` |
| resolver/探针 | `07-protector-resolver-antidebug.md`、`kernel32-consumer-trace.md`、`api-resolver-candidates.csv`、`resolved-api-map.csv`、`protector-export-walker.md`、`protector-resolver-cfg.csv`、`protector-resolved-api-map.csv`、`protector-api-table-layout.md`、`protector-module-load-order.csv`、`softice-probe-boundary.md`、`softice-branch-cfg.csv`、`protector-environment-probes.csv`、`protector-probe-map.md`、`protector-probe-convergence.md`、`post-probe-next-stage.md`、`task009-anchor-scan.csv` |
| WinLicense | `08-winlicense-reference-normal-path.md`、`winlicense-reference-index.md`、`protector-reference-indicators.csv`、`protector-attribution-matrix.csv`、`protector-attribution.md`、`device-probe-normal-semantics.md`、`normal-environment-probe-observation.md`、`normal-environment-state.csv`、`probe-normal-path-correlation.csv`、`probe-normal-path-analysis.md`、`winlicense-registry-cluster.md`、`winlicense-registry-calls.csv`、`reference-cfg-correlation.md` |
| 工具验证 | `packet-codec-crosscheck.md`、`passive-protocol-capture.md` |
| reference | `cms079-reference-index.md`、`reference-diff.md`、`reference-function-map.csv` |

## 附录 D：任务历史与结论一览

| Task | 主题 | Route/结论 |
| --- | --- | --- |
| 001 | 客户端基线 | 疑似 packing/protector；未识别产品名 |
| 002 | 服务端协议 | 全部核心协议恢复；9555=登录端口 |
| 003 | 运行时网络 | 未达最低标准；调试器检测点定位（0x862E76/0x862FB0）；packet 脚本完成 |
| 004 | 保护层 | → Route C（static-loader-boundary-first）；Dapan=VPN |
| 005 | 兼容性+被动抓包 | 0xC0E90008=Smart App Control；→ Route C |
| 006 | 静态 loader 数据流 | T1/T2(aPLib)/T3；→ Route C（下一 stub 依赖运行态） |
| 007 | stage-2 PE 扫描 | kernel32 confirmed；→ Route B（后续原地轮未完） |
| 008 | 原地解码轮 | walker+首批 API；停于 SICE 探针；→ Route A（resolver 重建） |
| 009 | resolver+反调试边界 | walker 全量重建；两分支静态分类；→ Route B（依赖 CreateFileA 返回） |
| 010 | WinLicense 参考 | normal edge=0x859780（高置信）；归因 probable WinLicense；→ Route A（沿正常边静态推进） |

> 下一个任务：**Task 011 — 探针窗口静态 CFG 全遍历**（见第 6 节；`.work/task-011/` 已有起步脚本待规范化）。

---

## 附录 E：执行期修订与回填（glm-work 会话，2026-10-10 起）

> 本节由 glm-work 会话追加，原文（上文）保持不变。回填按 prompt.md 规则：不改仓库既有文件，修订写在本附录与 `research/glm-work/analysis/STATUS.md`。

### E.1 计划基线与仓库实际状态的差异（会话 1 发现）

- 第 4.3 节 Q14 所述"Task 011 任务书尚未立项"已过时：仓库已提交 `research/task/011-normal-probe-path-game-materialization.md`（范围 ≈ 计划 Task 011+012 的前半）及配套 result（`09-normal-probe-path-materialization.md`、`normal-probe-path-cfg.csv`、`first-post-probe-stage.md` 等），并已提交规范化脚本 `research/scripts/maple079_normal_path_analyze.py`。仓库该 Task 011 结论 Route B（post-probe materializer = 两个原地解码器 + Oreans 驱动安装段），与计划 Task 012 的输入预期一致。
- 计划版 Task 011 的专属产物形态（`09-probe-cluster-full-cfg.md`、`probe-window-cfg.csv`、`probe-call-sites.csv`、`research/scripts/maple079_probe_cfg.py`）仍缺失，由 glm-work 会话补齐于 `research/glm-work/` 下。

### E.2 Task 011（计划版）完成回填（会话 1，2026-10-10）

- 产物：`research/glm-work/result/09-probe-cluster-full-cfg.md`、`probe-window-cfg.csv`（71 行）、`probe-call-sites.csv`（71 行）、`probe-cfg-summary.json`、`research/glm-work/scripts/maple079_probe_cfg.py`（规范化自 `.work/task-011/cfg_follow.py`）。
- 里程碑 M1：探针集群静态全图达成（SICE/SIWVID/NTICE + 注册表集群 15 单元 + 检测边 + 汇聚分析）。
- 对既有仓库结论的勘误（仓库文件未动，登记于 09 文件 §1/§4 与 STATUS）：
  1. NTICE 返回测试实际为 `0x00859A04 inc / 0x00859A05 jne / miss 边 0x00859A0B`（既有 5 处记录 +0x100 错位）；`0x0085A00B` 实为注册表 ExpInfo 单元 open 调用。
  2. WLkt 注册表单元根键为 HKLM `0x80000002`（既有 CSV 记 HKCU）。
  3. `0x00859EBE` 为 protector 状态写 thunk，非注册表单元。
  4. 集群值写有两代形状：unit1 REG_SZ(1/0x19)，其余 14 单元 REG_DWORD(4/4)；多数单元 close 由槽 `0x81BAB5` 门控。
- 新发现：`0x0085A36E–0x0085A3FE` 五个 resolver 调用（walker 门 'R'）就地填充集群 API 槽 `0x859CE5/0x859CE1/0x81A829/0x8191E9`（+未知槽 `0x819C95`）——正常路径跳过集群主体但解析其 API。
- 未决问题清单回填：Q1 已解决；Q2 大部分解决（剩槽内容/第五槽语义/flag 写入者）；Q14 已解决。
- 下一步：Task 012（输入含本节勘误后的 CFG）。

### E.3 Task 012 完成回填（会话 1，2026-10-10）

- 产物：`research/glm-work/result/10-post-probe-stage.md`、`next-transform-candidates.csv`、`task012-scan-summary.json`、`research/scripts/maple079_post_probe_scan.py`、`research/scripts/maple079_wide_capture.py`（replay 复跑 + 探针停点全 Tail B 宽捕获，停点字节级复现通过）、`research/scripts/maple079_write_logger.py`（注入写记录的第二跑，replay 本体未改）。
- **M2 达成**：非探针结构 = 解码器 A（`0x85A464`）→ B（`0x85AA35`）→ Oreans SecureEngine 驱动安装段 `0x85FCC0`（152 块/68 调用首次遍历；`\\.\Oreans.vxd` 打开、`%s\Oreans.vxd`、SCManager/Service 引用、**HKCU\Software\Wine 探针 @`0x861113`**）。`0x862000+` ~700KB 停点仍编码态。
- **round 3 定案（Q3 超预期）**：探针前存在未编目解码轮——producer `0x008593E3`，`dst=((src+0x3DDF4CA1+0x1C39E09C)&0xFFFFFFFF)^0x61799419`，span `0x0085941A–0x0085FA3D`（6537 dword，6537/6537 验证）。解码链修正：T1→T2→T3→r1→r2→**r3**→探针→（正常路径）→A→B→驱动段。
- 负结果：Tail A/Ztl/packed-raw 地址形成 0 个；自解码字节候选 5 个全证伪；游戏锚点（AES/IV/WZ/WS2_32/RTTI/55 8B EC）零命中。
- 对既有记录的修正：span1 SHA 为解码器 A 后中间态（与 B 的 span 重叠 `0x85AA4B–0x860293`，B 会再改写）；`\\.\oreans32` 引用点已定位（lea `0x861A66` 等）。
- G1 判定：**能**（已到达非探针阶段）→ 阶段二可评估，但 Tail A materializer 未现（Q4 保持开放）。新增 Q15（`0x862000+` 解码轮）、Q16（flag 槽写入者）、Q17（resolver 描述符字典，静态可解）。
- Task 013 维持阻塞（无 VM 介质）；建议下一会话做 Task 012b 静态延伸（见 STATUS.md）。

### E.4 Task 012b 完成回填（会话 2，2026-10-10）

- 产物：`research/glm-work/result/10b-static-extension.md`、`resolver-api-dictionary.csv`（23/23）、`research/scripts/maple079_checksum_table.py`（walker 插桩地面真值法）。
- **resolver 机制定案**：直接调用形态 `push imm32; push 模块基址; call [0x81C245]|0x81CEC7` 中 **imm32 即 walker 名字校验和**（`0x81CEC7: mov edx,[esp+0x28]; esi=[esp+0x24]+0x3C`）；校验和=自定义 CRC（多项式字节 `41 50 49 54`="APIT"）。
- **集群五槽命名**（推翻形状猜测两处）：`0x859CE5=RegCreateKeyA`（创建！干净系统预期反转为成功）、`0x859CE1=RegFlushKey`、`0x81A829=RegSetValueExA`、`0x8191E9=RegCloseKey`、`0x819C95=RegQueryValueExA`。Q2 完全解决。
- **Q16 解决**：flag 槽写入者=命令行开关解析器（decoder A 明文内 `0x85A5E6–0x85A9AA` 七处 `mov [slot],1`）——集群/驱动段 thunk 仅开关激活，自然路径恒跳过。
- **Q15 盲测负结果**：11 个已见变换常数对 T2 `0x862000–0x911B25` 均无结构涌现。
- **VxD 载荷**：`0x85B405`=LE/386/VxD、~10KB、设备名 `XPROTVXD`。
- 方法论沉淀：任何未来 resolver imm 可用 `maple079_checksum_table.py` 即时命名（枚举四模块全部导出名↔校验和）。遗留：wrapper `0x821750` 的描述符游标形态（5 个已知训练对在 `0x857E4A–0x857E86`）。
- 后续路线：轨道 A（Wizet DLL）→ 轨道 B（v95 种子）；主线静态在探针停点方法论内已收口。

### E.5 轨道 A / 轨道 B 完成回填（会话 2，2026-10-10）

- **轨道 A（T-101 第一轮）**：产物 `research/glm-work/result/19-wizet-dlls.md`、`wizet-dll-inventory.json`、`resman-entry-points.csv`、`research/scripts/maple079_wizet_dlls.py`。要点：COM 工厂体系；`List.wz`=PCOM 目录拼接的资源根（Canvas `0x20BC4`/PCOM `0x6CC7` 双引用，Q11 推进）；PKG1 处理器在 NameSpace.dll；Canvas→ZLZ 解压链证实（ZLZ 导出 C++ 签名直读；PDB 路径 `D:\ACGAME_CN\ztl\` 给出官方库词根 `ztl`，与 ZtlTaskMem* 同族）；RTTI 实测可用；WzMss=官网 SOAP（网络栈反判别器）；`PWS2_32.DLL`=序列化组件表条目（全部 DLL 无延迟导入）。Task 021 的四个重点中 #1/#2/#3 已有初答，#4（ResMan 签名）留下一轮。
- **轨道 B（T-102）**：Q13 已在仓库侧解决（derived 两件齐备）；glm-work 补 `trackB-seed-readiness.md` + `research/scripts/maple079_seed_scan.py`（33 项证据族扫描器，冒烟 0/33 符合预期）+ 新判别器三条（WzMss 反判别、ztl 词根正判别、RTTI 可行性证实）。M3 达成后以 seed_scan 为第一道工序。
- 会话 2 净结论：主线静态收口于探针停点 + 驱动安装段全图；游戏侧第一批结构性知识（WZ/资源链、对象模型、官方词根）已由未加壳 DLL 路线建立。G1/G2 状态不变（G1 达成、G2 等待物化）。

### E.6 轨道 A 第二轮 + 探针前 resolver 全录（会话 2 续，2026-10-10）

- **探针前 resolver 全录**：第三次 replay（`maple079_walker_log.py`，walker 入口 `0x81CEC7` 钩子）记录全部 5 次解析：LoadLibraryA×2、GetLocalTime（wrapper `0x821750` 形态——描述符→校验和管线由此证实，wrapper 补推模块基址后调 walker）、MessageBoxExA（user32，返回 `0x8594FF`）、**CreateFileA（返回 `0x8595E7`，round-3 明文区；SICE 探针的 API 解析点，补齐 Task 009 遗留）**。resolver 字典升至 **25/25**。
- **PKG1 头定案**（文件直析 Base/TamingMob 一致）：`PKG1` + dword + 0 + `0x3C` + `Package file v1.0 Copyright 2002 Wizet, ZMS\0` = 0x3C 字节头。
- **List.wz 结构起步**：`05 00 00 00` 头 + 记录流（`ac 52`+`16 00 00 00`+16 字节固定签名，~370 条、变长间距）；对 17 个 .wz 文件名的 12 种简单变换已知明文攻击全部负——解码需反汇编读取封装（Q11 剩余部分）。
- **NameSpace 挂载机制**（函数 `0x13070` 解剖）：`PKG1` 校验走流对象虚方法 `[eax+0x18]`（thiscall 读 0x3C 字节，引用点 `0x137BA`）；`PKG%04x.tmp`=GetTickCount 防冲突暂存文件（换号重试+`./` 回退；wsprintfA IAT 实证，另 4 API 走 Wizet 自建 `0x1E7xx` 分发槽）；懒创建；COM HRESULT 纪律（E_POINTER/STG_E）。
- **List.wz 记录框架**：`ac 52`+`16 00 00 00`+16 字节固定签名 × ~370 条、变长载荷；12 种简单变换 KPA 全负——解码需读取封装反汇编（Q11 收口路径已明确：`0x13070` → 流对象类 → Read 链）。
- **List.wz 序列化链五跳到底**（NameSpace↔PCOM）：入口 Open `0x13729`（宽名散列→XOR 折叠→取反=每条目键字节）→ PCOM 晚绑定（LoadLibraryA("PCOM.DLL")+GetProcAddress ×5，解循环导入，同机制坐实 WS2_32.DLL 表项）→ PcSerializeString `0x6411`（键双字高位选路、低两字节=模式标志）→ 实体 `0x64E3` → 读路径 **`0x7575` 族=逐字节变换最终落点**。修正中途两处误判（GUID 误为主密钥、晚绑定误为密码表）。Q11 收口=反汇编 `0x7575` 族+实现解码器。
- 产物更新：`19-wizet-dlls.md`（§4 第二轮 + §4.5 序列化链）、`10b-static-extension.md`（§8 追记）、`resolver-api-dictionary.csv`（25 行）、新脚本 `maple079_walker_log.py`。

### E.7 Task 022 提前完成（会话 3，2026-10-10，采用成熟解析库）

- **工具**：wz-python/wzpy（MIT，github.com/Leonana69/wz-python @ `79344c9`，取至 `.work/tools/`，URL+commit 按政策记录）；脚本 `research/glm-work/scripts/maple079_wz_dir.py`；产物 `research/glm-work/result/wz-directory-index.csv` + `20-wz-inventory.md`。
- **私服 IV 定位**：`B9 7D 63 E9`（wzpy 区域表 EMS 值；BMS/GMS 对照乱码、EMS 干净，判据=根名可打印率）。
- **16× PKG1 全解析**：version=79（第三方复核客户端版本）；~36,000 img（Character 25,565、Map 4,614…）；Base.wz 15 个跨文件链接子目录=命名空间树投影；2010/2016/2017 三组修改时间在目录层无格式代差（私服重打包痕迹）。
- **机制辨析**：PKG1 内字符串=固定 IV AES 密钥流（成熟库全覆盖）；List.wz=按名键控序列化（独立机制，Q11 收口仍指 PCOM `0x7575`）。下一验证点：Base.wz 链接名 ↔ List.wz ~370 记录对应。
- 阶段五的 Task 022 主体目标在阶段一等待期完成；Task 022b（对象模型）与 ResMan 签名仍开放。

### E.8 Q11 收口：List.wz 完全解码（会话 3 续，2026-10-10）

- **格式定案**：无独立文件头（首 4 字节=首记录长度，名 `dummy`）；记录=`[0–2B 类型前缀][dword 名长][UTF-16LE 路径]`；路径加密=WZ AES 密钥流（私服 IV `B9 7D 63 E9`）**逐串从索引 0 连续异或**。
- **内容**：外链 img 挂载表 **1,258 条**（character 513 / map 297 / mob 184 / npc 104 / item 47 / reactor 25 / skill 22 / …14 类），零间隙覆盖 65,468/65,470 字节。
- **破题方法**：密钥流相位扫描——16 字节重复块在相位 0 解出宽串 `characte`；进而连续密钥流假设→逐串复位确认→贪婪游走全解。
- **勘误**：前记"~370 条记录"实为 1,258（计数截断）；"16 字节固定签名"实为共享明文前缀的密文；NameSpace/PCOM 的"按名键控变换"重新定性为命名空间哈希桶（`h=h*32+c+1`）机制而非字节密码。
- 产物：`research/glm-work/result/listwz-entries.csv`、`research/scripts/maple079_listwz.py`、`20-wz-inventory.md` §3.1。
- **Q11 状态：已解决**（格式+用途+解码器齐备）；G5（WZ 链路）剩余：ResMan 读取签名、Task 022b 对象模型。

### E.9 Task 012c 完成回填（会话 4，2026-10-12）

- 产物：`research/glm-work/result/10c-decoder-c-hunt.md`、`task012c-cross-boundary-refs.csv`、`task012c-transform-clusters.csv`、`task012c-summary.json`、`task012c-encoded-entry-map.csv`（策展入口表）、`beyond-wall-island-map.csv`、`beyond-wall-thunk-tables.csv`、`beyond-wall-thunk-names.csv`、`task012c-beyond-wall-summary.json`、`task012c-thunk-names-summary.json`；scripts：`maple079_decoder_hunt.py`、`maple079_beyond_wall.py`、`maple079_thunk_names.py`（第四次 replay 宽捕获重生成，全部复现门槛通过）。
- **Q15 前提修正（本会话核心）**：`0x862000–0x911B25` 在探针停点为**明文岛+编码区混合**（40 岛 / 74,496B / 10.3%）——Task 012b 的全区盲测方法论对混合区域失效（定案）。墙根岛 `0x862000–0x864000` 含 WinLicense 检查点统计/异常 UI 字符串（CheckIN/CheckOUT/ProcIN/ProcOUT/ExitIN/ExitOUT = %d 等，与 Task 011 注册表集群值名对应）。
- **canonical EBP 不变量**：全部墙外模块的 `sub ebp, imm32` 归一化到规范基 `0xF93D9014`（三例字节直算验证）→ `formed()` 全 Tail B 有效。
- **编码区入口图**：`0x862D7D`（4 jmp，门控槽 `0x81C1A5`≠0，写入者 `0x86118E`，条件 `word[formed(0x7486BC6)]==9`）、`0x862D80`（2 jmp）、`0x8620C6`（门控槽 `0x81B96D`==0，写入者 `0x8609D1`；目标岛含 7 参 CreateFileA 配方）；编码函数 `0x86B299`（walker 区 5 处 + 岛 3 处引用，岛调用者存返回值后带 4–5 参再调用）。
- **解码器 C 生产者负结果定案**（high）：匹配器地面真值 4/4（round1/round3/decA/decB）；可读面 5 新簇全证伪（真身=字符串扫描循环/slot 操作/常数构造 gadget）；岛内 593 imm-op、150 簇、循环内变换簇 0。生产者在编码区内，静态不可达（不伪造运行态的前提下）。
- **wrapper thunk 全录 383 项**（372 墙外）；静态命名 0/383——真 wrapper+真 walker+真导出表离线机制成立，但 wrapper 停点态早退（eax=0xE）；3 个捕获为错误路径内部解析 ExitProcess 的伪捕获。blocker 精确登记；`maple079_thunk_names.py` 待 VM 态全量复用。
- **勘误**：E.6 的"5 个训练对（0x857E4A–0x857E86）"提法有误——walker-log ret 地址是 slot-form 调用返回点，相邻 `push imm; jmp wrapper` 是跳转表条目（wrapper 管线证实结论本身不受影响）。
- 未决问题清单更新：Q15 部分回答（混合结构+密钥流排除+生产者定案）；Q4 全表面维持零引用；新增 Q18（岛语义/0x86B299 函数族）、Q19（wrapper 描述符算法静态逆向）、Q20（383 项 thunk 命名，VM 态）。
- 下一步建议：Task 012d（wrapper 描述符算法人工逆向 + 混合区域盲测重跑）或 Task 013（VM，阻塞不变）。

