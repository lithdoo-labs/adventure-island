# Adventure Island

**Adventure Island** 是一个基于 [LoomRealm](https://github.com/lithdoo/loom-realm) 的 CMS079 风格游戏项目。仓库根目录用于正式游戏设计、运行时代码、平台入口和自动化测试；客户端逆向研究只作为开发参考，统一归档在 `research/`。

## 项目方向

项目保留并重新实现 CMS079 中有价值的玩法行为，同时基于 LoomRealm 设计新的游戏机制。正式运行时的权威逻辑由本项目的 Subsystem、Game Library 和 Shared State 持有；LoomRealm 提供运行平台，不在 Submodule 内开发本游戏的业务代码。

当前设计基线见 [DESIGN.md](./DESIGN.md)。

## PWA / Hostra 工程参考

平台入口以 LoomRealm 固定版本的 Game Package 与平台启动边界为准；新版框架使用 [通用 PWA Builder](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/apps/pwa/scripts/build-bundle.mjs)，不再依赖已迁出的 `examples/PokeMan/` 目录，也不复制 PokeMan 玩法：

- `game.json`：声明 Game Package 的初始 Subsystem 和输入。
- `launch.pwa.json` / `launch.hostra.json`：分别描述平台安装根中的模块入口。
- `subsystems/`：平台安装根可解析的 Subsystem 模块。
- `presentation.json`、`presentation/`：呈现资源入口。
- `package.json`、`test/`：依赖、构建和测试边界。

Adventure Island 的正式代码放在本仓库；`loom-realm/` 只作为固定版本的 Git Submodule 依赖。当前 Submodule gitlink 为 `93648192323bf5f57996b7b54cbae641d8a53fdb`，未经单独依赖升级任务不得修改。

## 正式工程目录

| 路径 | 职责 |
|---|---|
| `apps/pwa/` | 隔离的 legacy Smoke PWA 入口，不是 canonical 启动 |
| `apps/hostra/` | 隔离的 legacy Smoke Hostra 入口；canonical Hostra 清单在仓库根，实机验收 BLOCKED |
| `systems/base/`、`systems/adventure-map/` | canonical Base 与 Adventure Map 的唯一实现 |
| `subsystems/` | 根安装根的薄 re-export；PWA 发布的是打包后的 executable |
| `components/` | 游戏画面与交互 Web Components |
| `libs/` | 本游戏复用的领域库和运行时逻辑 |
| `systems/` | LoomRealm Subsystem 实现 |
| `content/` | 游戏内容模型、导入规范与构建边界 |
| `tests/` | 仓库级自动化测试 |
| `docs/` | 工程流程、CI 与 Agent 使用说明 |
| `DESIGN.md` | 正式游戏设计、系统取舍和阶段目标 |
| `loom-realm/` | LoomRealm 固定版本 Submodule，只读依赖 |

## 研究资料隔离

所有已提交的逆向任务、分析结果、参考材料和分析脚本统一放在 [research/](./research/README.md)：

- `research/task/`：逆向研究任务书。
- `research/result/`：结构化证据、结论和索引。
- `research/reference/`：外部参考项目、符号和来源说明。
- `research/scripts/`：Ghidra、IDA、协议和资源分析辅助脚本。
- `research/glm-work/`：历史研究计划、阶段状态、临时分析脚本与结果。

研究资料是设计参考，不是正式运行时依赖。正式代码不得从 `research/` 导入模块，也不得把原始客户端或全量 WZ / FSDB 资源提交到仓库。

根目录现行的 AI Coding 入口只有 `scripts/issue_agent/`，由 Issue 上的 `/agent start` 和 `/agent revise` 驱动。旧 Design PR Agent 三个 Actions 和 `scripts/agent/` 已停用并删除。

- `task/dev/`：旧 Design PR 任务说明（待归档至 `research/task/dev/`，不再触发 AI Coding）。
- `glm-work/`：本地研究 Runner 启动配置（待归档至 `research/glm-work/bootstrap/`）。
- `research/**`：逆向研究档案，不允许 Issue Agent 的代码补丁修改。

完整工程及 PWA 迁移阶段见 [迁移计划](./docs/migration/2026-11-04-issue-agent-and-pwa.md)。

本地原始客户端只允许放在 `.raw/`，临时解压和工作产物放在 `.work/`；两者均为本地目录，不应提交。

## GitHub Issue Agent

本仓库支持 Issue 驱动的 OpenCode 2 本地 Runner。操作方式、权限边界、Session 持久化和故障恢复见 [docs/issue-agent.md](./docs/issue-agent.md)。Agent 生成的 PR 必须人工审核，不自动合并。

## 本地 PWA Staging 与独立 CI

根目录 `npm run pwa:bundle` 从 canonical `base` → `adventure-map` 入口发布两份自包含 executable、选定 `[FSDB]adventure` Avatar 闭包、派生 `struct.AdventureAvatarPlan/bootstrap`，以及 Controls 与 cms-actor 两份 classic script。`npm run pwa:staging` 在检查精确 Gitlink、真实通用 Builder 和编译依赖后，生成 `dist/staging/adventure-island/`。该目录只是本地构建产物，**不是线上服务**。

安装顺序：

```bash
npm ci --no-audit --no-fund
npm ci --prefix loom-realm --no-audit --no-fund
npm run build:game-common-controls-input --prefix loom-realm
npm run pwa:bundle
npm test
npm run pwa:staging
```

PWA 键盘闭环由 `test/pwa-browser.e2e.test.mjs` 的 canonical 场景在真实 Service Worker 下验证。Hostra 清单与根绑定一致，但没有桌面实机验收，状态为 **BLOCKED**。没有真实 D-pad 设备验证，状态为 **DEVICE UNVERIFIED**。未运行的测试不能记为通过。

`.github/workflows/pwa-ci.yml` 在 GitHub-hosted Runner 中独立编译 LoomRealm，强制执行无跳过的根测试、真实 staging 及 canonical Chromium/Service Worker E2E。构建与部署必须分离；本阶段不启动 Docker、生产端口或 Pokeman 服务。详见 [Game Entry 与 PWA Bundle](./docs/game-entry.md)。
