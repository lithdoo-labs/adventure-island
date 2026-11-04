# Repository Automation Scripts

当前唯一受保护的 AI Coding 执行器为 `issue_agent/agent.py`，由 `.github/workflows/issue-agent.yml` 的 `preflight`、`execute`、`publish` 调用。

旧 Design PR Agent（`scripts/agent/`，`agent-spec-gate.yml`，`agent-implement.yml`，`agent-revise.yml`）已停用并移除。Issue Agent 不依赖其运行。

CMS079 逆向分析脚本保存在 [研究档案](../research/README.md) 的 `research/scripts/`。正式运行时及 AI 生成代码补丁不得从 `research/` 引入可执行依赖或修改研究证据。

后续 PWA 构建和 CI 工具分别放在 `scripts/pwa/` 与 `scripts/ci/`，与 Issue Agent 分离。
