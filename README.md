# adventure-island

MapleStory（冒险岛）CMS v079 客户端逆向研究仓库。

本仓库用于记录对 **国服 079 客户端** 的静态分析、动态调试、协议梳理、资源格式研究，以及可复现的分析脚本和笔记。

> 本仓库不保存或分发原始游戏客户端、WZ 资源、第三方保护组件或其他受版权保护的二进制文件。请仅对自己合法取得的客户端副本进行研究。

## 目标

当前研究重点：

- 梳理 `MapleStory.exe` 的 PE / x86 基础结构；
- 定位网络初始化、连接、收发与封包编解码路径；
- 建立客户端 opcode dispatcher 与 079 服务端协议之间的对应关系；
- 逐步识别并命名客户端核心模块、类和函数；
- 记录 WZ 资源加载及相关数据结构；
- 沉淀可重复执行的 Ghidra / IDA / x32dbg 辅助脚本与分析结果。

## 当前样本

当前本地研究样本约定为：

```text
.raw/怀旧岛079V5客户端.rar
```

`.raw/` 已加入 `.gitignore`，其中内容只作为本地分析输入，不应提交到 Git。

针对该样本的第一阶段任务已经定义在：

```text
task/001-cms079v5-baseline.md
```

本地 AI 或分析人员应按照任务书执行，并将最终可提交结果统一写入：

```text
result/
```

中间解压文件、临时文件和工具输出统一放入 `.work/`，不要修改 `.raw/` 中的原始样本。

## Task / Result 工作流

仓库采用任务驱动的研究方式：

```text
.raw/       原始输入，只保存在本地
   ↓
task/       可复现的分析任务书
   ↓
.work/      本地临时工作区，不提交
   ↓
result/     可提交的结构化分析结果
   ↓
docs/       经过整理后的长期研究文档
```

执行任务时：

1. 先阅读对应的 `task/*.md`；
2. 不修改 `.raw/`；
3. 中间产物放入 `.work/`；
4. 最终结论、哈希、元数据、表格等放入 `result/`；
5. 不把原始 EXE、DLL、SYS、WZ、RAR、ZIP 或 dump 放入 `result/`；
6. 任务成熟后，再把稳定结论整理进入 `docs/`、`symbols/` 或 `scripts/`。

## 本地原始文件

后续其他 079 客户端压缩包或解压后的原始文件也统一放在仓库根目录的 `.raw/` 中，例如：

```text
.raw/
├── 怀旧岛079V5客户端.rar
├── other-client.zip
└── other-client/
    ├── MapleStory.exe
    ├── Base.wz
    ├── Character.wz
    └── ...
```

建议始终保留一份未修改的客户端副本，并对关键输入记录哈希，以便后续确认分析基线，例如：

```bash
sha256sum '.raw/怀旧岛079V5客户端.rar'
sha256sum .raw/other-client/MapleStory.exe
```

## 仓库结构

```text
.
├── .raw/          # 本地原始客户端与归档，不提交
├── .work/         # 临时解压、分析工作区，不提交
├── task/          # AI/分析人员可直接执行的任务书
├── result/        # 任务产生的可提交结构化结果
├── docs/          # 整理后的逆向笔记、协议记录、结构说明
├── scripts/       # Ghidra/IDA/分析辅助脚本
├── symbols/       # 函数命名、地址、签名等可复现结果
├── tools/         # 自编写的小型研究工具
├── .gitignore
└── README.md
```

目录可以随着研究进展逐步建立，不要求一开始全部存在。

## 建议的逆向路线

### 1. 建立客户端基线

首先记录：

- 文件版本与时间戳；
- PE ImageBase、入口点、节区；
- Import Table；
- `MapleStory.exe` 和主要 DLL 的 SHA-256；
- 是否存在壳、保护或运行时自修改行为。

不要直接修改原始样本。需要 patch 时，应复制到单独的本地工作目录。

### 2. 从网络边界开始

优先定位 WinSock 相关调用：

```text
WSAStartup
socket
connect
send / WSASend
recv / WSARecv
closesocket
```

沿交叉引用向上寻找客户端自己的 socket wrapper，再继续识别：

```text
CClientSocket
CInPacket
COutPacket
Decode1 / Decode2 / Decode4 / DecodeStr
Encode1 / Encode2 / Encode4 / EncodeStr
Packet Dispatcher
```

这里的名称可以先作为研究命名，不要求与原始源码符号完全一致。

### 3. 用协议行为辅助定位

建议从容易观察的状态变化开始：

```text
Login
  ↓
World / Channel
  ↓
Character Select
  ↓
Enter Field
  ↓
Movement
  ↓
NPC / Mob / Skill
```

将客户端 handler、opcode、字段顺序和服务端实现相互对照，逐步形成稳定的协议映射。

### 4. 分离 WZ 与 EXE 分析

地图、技能、物品、NPC、UI 等静态资源优先通过已有 WZ 格式资料和工具解析，不必从客户端汇编重新推导所有内容。

EXE 逆向重点放在：

- 资源访问入口；
- 对象模型；
- 网络协议；
- 游戏状态机；
- 客户端特有逻辑。

## 分析记录约定

为了让地址变化后仍能复用结果，记录一个函数时尽量同时保存：

```text
Name:       CClientSocket::OnRead
VA/RVA:     ...
Caller:     ...
Callee:     ...
Strings:    ...
Imports:    ...
Signature:  ...
Evidence:   ...
Notes:      ...
```

优先记录 **RVA、调用关系、字符串引用和字节签名**，不要只保存一次运行中的绝对地址。

## 工具

常用工具可以包括：

- Ghidra
- IDA
- x32dbg / x64dbg
- PE-bear / CFF Explorer
- Wireshark（在自己控制的测试环境中）
- Python

后续仓库中的自动化脚本应尽量说明所针对的客户端哈希或版本基线。

## 提交原则

适合提交：

- Markdown 分析文档；
- 自己编写的分析脚本；
- 函数名、RVA、结构体定义；
- opcode 表；
- 哈希、PE 元数据、imports 和经过筛选的字符串结果；
- 不包含原始客户端内容的签名或元数据；
- 可公开分享的实验结果。

不要提交：

- 原始或修改后的客户端程序；
- WZ 资源文件；
- 客户端 ZIP / RAR / 7z；
- crash dump、完整内存 dump；
- Ghidra / IDA 的大型本地数据库，除非之后明确决定版本化；
- 密钥、账号或其他敏感信息。

## Research Log

阶段性稳定结果可以进一步整理到 `docs/`，例如：

```text
docs/
├── 00-baseline.md
├── 01-pe-and-imports.md
├── 02-network-stack.md
├── 03-packet-codec.md
├── 04-opcodes.md
└── 05-field.md
```

这样可以把任务、原始分析结果、发现过程和最终长期文档分开管理，也方便以后对不同 079 客户端样本做差异比较。

## GitHub Issue 驱动的 OpenCode 2 开发（新增）

仓库新增独立的 Issue Agent，与已有的 Design PR → Agent Implement / Revise 流程**并行运行**，不替代旧流程。

1. 使用 `lithdoo` 账号创建一个普通 Issue，描述需求、验收标准和限制。
2. 在该 Issue 评论 `/agent start`，组织级 Runner `opencode-lithdoo-labs` 将调用 OpenCode 2，在 `agent/issue-N` 分支实现需求，自动创建 **Draft PR** 并回复 Issue。
3. 在同一 Issue 或关联 PR 留下反馈后，回到 Issue 评论 `/agent revise`，继续 **同一个 OpenCode Session、同一个 PR**，直到人工审核和合并。
4. 每轮发布权限和执行权限隔离；不会自动合并 PR。

这套流程的持久化数据放在组织 Runner 的 `agent-projects/adventure-island/issue-agent/` 中，不复用现有 Design PR Agent 的历史 Session。

详细权限配置、公开仓库 Runner 安全约束、故障恢复与两轮验收步骤见 [docs/issue-agent.md](docs/issue-agent.md)。
