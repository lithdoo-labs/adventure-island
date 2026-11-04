# Repository Automation Scripts

根目录 `scripts/` 只保留 GitHub Actions Agent 所需的受保护自动化：

- `agent/`：Design PR → Implement / Revise 流程。
- `issue_agent/`：Issue 驱动的 OpenCode 2 Runner。

CMS079 逆向分析、协议、WZ、Ghidra / IDA 和设备观察脚本已经迁移到 [研究档案](../research/README.md) 的 `research/scripts/`。不要把研究脚本重新放回此目录，也不要修改上述 Agent 自动化，除非有独立的 CI 维护任务。
