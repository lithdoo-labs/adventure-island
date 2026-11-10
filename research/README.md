# Research Archive

本目录保存 Adventure Island 对 CMS079 的逆向研究档案，供正式游戏设计、内容导入器和运行时实现时查阅。它不是运行时包，也不是正式游戏代码目录。

## 新 Agent 快速入门

从一个空白上下文继续逆向工作时，按顺序阅读：

| 顺序 | 文档 | 内容 |
|---|---|---|
| 1 | [RESEARCH-HOWTO.md](RESEARCH-HOWTO.md) | 操作手册：从零开始的逐步指南 |
| 2 | [RESEARCH-FINDINGS.md](RESEARCH-FINDINGS.md) | 核心发现：已经知道了什么 |
| 3 | [RESEARCH-GAPS.md](RESEARCH-GAPS.md) | 当前缺口：还缺什么、怎么突破 |
| 4 | [RESEARCH-METHODOLOGY.md](RESEARCH-METHODOLOGY.md) | 方法论：每类问题怎么做 |
| 5 | [RESEARCH-TOOLS.md](RESEARCH-TOOLS.md) | 工具：Ghidra/VM/服务端的用法 |
| 6 | [RESEARCH-DATABASE.md](RESEARCH-DATABASE.md) | 数据资产：所有语料的路径 |

## 一句话总结

> CMS079 (MapleStory v079 中文私服) 客户端的完整逆向：协议栈（365 opcodes 全解、合成客户端已验证）、密码学（AES-256-OFB 密钥已知 + 自定义滚动密码）、函数语义（52K 函数 95.3% 覆盖）、游戏数据（25K 装备 / 22K 字符串 / 4K 地图）、移动物理（20 个 Physics.img 字段名全部提取 + 跳跃公式 + 加密速度读写链）。

## 目录

| 路径 | 内容 |
|---|---|
| `task/` | 逆向研究任务书及其方法、输入和验收标准 |
| `result/` | 分析报告、结构化结果、索引、CSV / JSON 证据 |
| `result/map/` | 地图/移动物理专题报告（含 Physics.img 字段表） |
| `reference/` | 外部参考资料、符号映射、来源与许可说明 |
| `scripts/` | MapleStory 079 静态分析、动态观察、协议与 WZ 辅助脚本 |
| `glm-work/` | 历史研究计划、进度、会话产物、scratch 与研究脚本 |

## 核心数字

| 维度 | 数值 |
|---|---|
| 函数总数 | 51,200（Ghidra 导出 52,326） |
| 函数语义覆盖 | 95.3% |
| 协议 opcodes | 365 (148 c2s + 217 s2c) |
| 高置信函数 | 489 |
| 语义类 | 24 + 179 结构类 |
| 装备数据 | 25,491 |
| 字符串数据 | 22,438 |
| 地图数据 | 4,259 maps / 18,339 portals / 359,124 footholds |
| Physics.img 字段 | 20（全部命名） |

## 语料位置（不在 Git 内，但在本机）

| 资产 | 路径 | 说明 |
|---|---|---|
| 客户端样本 | `.work/task-001/extracted/冒险岛online/` | SHA-256 `5d280cf1…` |
| 游戏体镜像 | `.work/task-036/game-image-unpacked.bin` | 10.3MB, RVA==offset, base 0x400000 |
| Ghidra 反编译 | `E:\ghidra-projects\decompiled_v2.csv` | 52,326 函数, 35.5MB 伪代码 |
| Ghidra 项目 | `E:\ghidra-projects\` | Ghidra 项目文件, 可重新打开 |
| 服务端 JAR | `.work/task-002/server/079V5/dist/江浩079.jar` | 861 类 |
| 服务端反编译 | `E:\t055-decompiled\` | 364 Java 源文件 |
| 服务端 WZ XML | `.work/task-002/server/079V5/wz/` | XML 格式 WZ 数据 |
| 物化捕获 | `.work/task-053/captures/t053-mat.elf` | 1.74GB 内存 ELF |
| VM 存储 | `E:\vm-store\` | QEMU 虚拟机 (junction 回链到 .work) |

## 使用边界

1. 正式游戏代码位于仓库根目录的 `apps/`、`components/`、`libs/`、`systems/`、`content/` 等目录。
2. 正式运行时不得从 `research/` 导入模块；需要复用的知识应先整理成正式设计、接口和经过验证的实现。
3. 研究资料中的地址、函数名、opcode 和推断必须按原证据等级使用，不把假设当作事实。
4. 不提交原始客户端、WZ、第三方保护组件、完整内存 dump、未经许可的资源包或由它们直接导出的全量素材。
5. 原始本地样本仍放在仓库根目录的 `.raw/`，临时文件放在 `.work/`；这两个目录不属于 Git 迁移范围。
6. 历史报告可能保留其生成时的旧路径文本，用于证据追溯。当前仓库路径以本 README 的目录表为准。

## 根目录保留项

- `task/dev/` 是 Design PR Agent 的 CI 任务规格目录，不是逆向研究任务。
- `scripts/agent/` 和 `scripts/issue_agent/` 是受保护的 CI 自动化代码，不迁入研究档案。
- `glm-work/` 仅保留本仓 Runner 的启动配置与兼容入口；长期研究内容统一在本目录下的 `glm-work/`。
