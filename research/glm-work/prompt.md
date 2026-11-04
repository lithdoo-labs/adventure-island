# CMS079 逆向分析执行提示词

你在 `adventure-island` 仓库中继续国服 079（CMS079）客户端的证据驱动逆向研究。用中文工作。

开始前先读完本文件，再读：
- `research/glm-work/reverse-engineering-plan.md`
- `research/glm-work/analysis/STATUS.md`

## 可以读取的资料

- 根目录 `README.md` 与 `DESIGN.md`（理解正式项目边界）
- `research/task/`：研究任务书
- `research/result/`：已提交的研究结果
- `research/scripts/`：已有分析脚本
- `research/reference/`：外部参考和符号资料
- `research/glm-work/`：研究计划、进度和本地研究产物
- `.work/`：本地中间产物，只读，用于核对证据
- `.raw/`：原始客户端输入，只读；不得复制、修改或提交

## 唯一写入范围

创建和修改文件只允许发生在 `research/glm-work/` 内。其他路径全部只读，包括：

- 正式项目：`apps/`、`components/`、`libs/`、`systems/`、`content/`
- 研究基线：`research/task/`、`research/result/`、`research/scripts/`、`research/reference/`
- CI：`task/dev/`、`scripts/agent/`、`scripts/issue_agent/`、`.github/`
- 依赖：`loom-realm/`
- 根目录文档与配置：`README.md`、`DESIGN.md`、`.gitignore`、`.gitmodules`

所有新研究产物统一写入：

```text
research/glm-work/result/       研究报告与结构化结果
research/glm-work/scripts/      新增或规范化的研究脚本
research/glm-work/analysis/     STATUS.md、进度与未决问题
research/glm-work/scratch/      临时脚本、调试输出与中间结果
```

不要把产物写回正式工程目录，也不要改写已有 Git 历史。

## 研究边界

- 只做证据驱动的协议梳理、结构恢复、函数命名和资源格式研究。
- 不制作外挂，不实现可用于封包注入或修改器的功能。
- 不 patch 客户端，不伪造 API 返回以强迫探针走某条分支。
- 设备、注册表或 API 不存在时的行为只能作为观察或假设记录，不注入模拟器。
- 不编造地址、opcode、哈希、函数名；不确定结论标为假设，并记录来源。
- 引用旧研究结论时使用当前归档路径 `research/task/`、`research/result/`、`research/scripts/` 和 `research/reference/`。
- 不提交原始客户端、WZ、完整 dump、密钥或账号。

## 推进方式

1. 以 `research/glm-work/reverse-engineering-plan.md` 为路线图，以 `research/glm-work/analysis/STATUS.md` 为当前状态。
2. 从计划中当前最高优先级且未完成的任务开始；按任务目标、输入、方法、成功标准和回退路线推进。
3. 达不到成功标准时，写清不可解析点和降级产物，不要宣称完成。
4. 每完成一项任务，更新 `research/glm-work/analysis/STATUS.md`，记录证据、产物、未决问题和下一步。
5. 不要自行扩大到正式游戏实现；逆向研究只为正式设计提供参考。

开始前先用几句话复述当前边界、准备执行的任务和产物位置，然后直接工作。
