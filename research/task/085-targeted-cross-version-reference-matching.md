# T085-A：CMS079/GMS083 跨版本定向匹配（含独立 sub-agent）

## 基线与性质

本任务可直接用于**全新本地 Agent 对话**。仓库 `lithdoo-labs/adventure-island`，权威分支 `design/adventure-field-map-scene`。既有 T084.1 已接受基线为 `16e8bd5b5c70d22a32948613ac6c598ebfe09e50`；此任务本身随外部资料索引归档提交。开始工作前先读取远程 HEAD，以当前权威提交为实际工作基线，不得 reset 或覆盖其后新增的合法提交。

依次阅读：
- [079/083 跨版本索引与证据边界](../reference/maplestory-symbols/CMS079-083-CROSS-VERSION-BRIEF.md)
- [26 条带状态的来源 CSV](../reference/maplestory-symbols/CMS079-083-REFERENCE-CATALOG.csv)
- [既有符号资源与许可说明](../reference/maplestory-symbols/SOURCES.md)
- `research/source-of-truth/{claims,evidence,gaps}.csv`
- T084/T084.1 原始研究报告、Reviewer、P0–P4 矩阵
- 仓库 AGENTS.md 与 Validator 使用规范。

本轮属于**窄范围静态证据优先**，不是全量客户端重新逆向，不要求一开始就运行目标，也不得将 v83 构建的伪 C 或社区源码升为 CMS079 原版。

## 工作包和验收

| 工作包 | Gap | 静态核验目标 | 来源优先级 |
|---|---|---|---|
| WP1 | G08 / G01 / G07 / G24 | CMS079 Avatar depth Key、layer/group 来源、最终容器 tie 与比较器；对照 v83 `29991/29992/29995/29999` 而非硬套 | OpenMS v83 原版机器码研究 > IDB 名称 > 重制代码 |
| WP2 | G09 | CMS079 WZ `zmap/smap`、`map/origin/brow/navel`；姿态/装备的遮挡层与最终绘制关系 | OpenMS avatar 证据、HeavenClient、MapleUnity |
| WP3 | G10 | [0xBDF54C] 与 scene slot15 的上游 Camera 写入者、deadzone/边界及初始化 | CMS079 IDB 名称、v83 初始化地址、OpenMS Camera |
| WP4 | G24 | `[0xBE2788]` interface vptr、slot25 `0x5040418C`、输出对象 class、slot45 与 comparator 的关系 | T084.1/C-086/C-087 + OpenMS Gr2D |
| WP5（仅有余量） | G38 | Opcode 0x81 的上下文注册/handler 绑定的剩余静态引用 | SpiritIDA 方法，仅作辅助 |

每包必须输出：`MATCH / REFUTED / INCONCLUSIVE`；CMS079 原始指令字节、地址窗口、XREF、字段读写、原始文件 SHA-256、反证解释、命中的外部来源条目 ID、关联 Gap，以及下一步是否仍需 Runtime。

## 执行与独立 Review

1. 核对远程 SHA、工作区、原 EXE `d4a67597...31718` 和 Gr2D `ad67b9a0...f6a25d1` **完整哈希**；真正取证时读取完整 canonical 记录。不把其他 v83 函数地址视为 CMS079 VA。
2. 按 WP 优先次序在 CMS079 原始二进制定位候选。先盲查自身指令和数据流，再参考 OpenMS/v83 符号以避免先入为主。标注失败窗口、不同 CFG、负结论与未覆盖范围。
3. 需要外部 IDB 时先核实版本、实际文件 SHA 和来源许可；论坛“有附件”≠可用。不能下载/执行来源不明的客户端或把其文件提交进仓库。
4. 主 Agent **必须实际启动隔离的独立 sub-agent Reviewer**：独立上下文、独立目录、独立脚本，先盲审 CMS079 证据再审跨版本匹配；至少复核每 WP 1 个关键锚点和所有新 Claim，结论 ACCEPT / ACCEPT-WITH-CORRECTIONS / REJECT。
5. 主 Agent 按 Reviewer 的原始发现逐条闭环；仅证实的新 CMS079 行为才能增加权威 Claim/Evidence；未证推断只保留 HYPOTHESIS。
6. 如有实质更新，用仓库官方生成器再生 clean-room、65 条矩阵及相关报告；运行正式 Validator、完整单元测试并记录真实结果，不得删弱既有 CHECK17。
7. 只允许在 `research/` 中产生正式提交；Frozen `components/RENDER-NODE-ABI-V1.md`、LoomRealm pin、原版二进制、产品代码与资源不修改。
8. 正常 fast-forward push，回读远程 HEAD，最终报告写真实 commit、diff、Evidence/Gap、Reviewer、Validator、Tests 和任何无法复现项。

推荐成果：`research/result/stage-readiness/T085-A-CROSS-VERSION-MATCH-REPORT.md` + 原始指令/函数映射 CSV + 独立审稿记录。G08/G09/G10/G24 仍为 OPEN-RUNTIME 直至真正取得目标原始证据；整体保持 NOT STAGE-READY。
