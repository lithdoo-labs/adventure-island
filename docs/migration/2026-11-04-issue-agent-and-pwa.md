# Adventure Island 迁移计划（Issue Agent 单一入口 + PWA）

基线 commit：`b61eec1897ae47db1eeaf0c7645d90f041e1090c`；提出日期：2026-11-04。

## 已确认的决策

1. 只保留 GitHub Issue `/agent start`、`/agent revise` → OpenCode → Draft PR 工作流。
2. 删除旧三个 Design PR workflows 和全部 `scripts/agent/` 文件；`issue-agent.yml` 完全独立运行。
3. 完整保留现有逆向研究资料的内容和 Git Blob SHA；`research/**` 禁止被 Issue Agent 生成补丁修改。
4. 将根目录 `glm-work/` 归档到 `research/glm-work/bootstrap/`，将 `task/dev/` 归档到 `research/task/dev/`。保持 `research/glm-work/prompt.md` 与已有 `research/task/` 证据不变。
5. 以 PokeMan 的仓库与 PWA Bundle 分工为参考，不复制其业务玩法，保持 LoomRealm 固定 Submodule。
6. Adventure Island 独立发布到 `/pwa/adventure-island/`，不得覆盖 Pokeman。

## 分期提交

**阶段一（本 PR）：清理旧 Agent。** 删除：
```text
.github/workflows/agent-spec-gate.yml
.github/workflows/agent-implement.yml
.github/workflows/agent-revise.yml
scripts/agent/（全部 10 个已跟踪文件）
```

保留 `issue-agent.yml`、`issue-agent-validation.yml`、`org-runner-smoke.yml`、`scripts/issue_agent/agent.py` 和 `tests/test_issue_agent.py`。更新使用文档及拒绝 `research/**` 写入的安全回归测试。不得删除自托管 Runner 的历史 Session 数据。旧 Design PR #4、#18（及与旧流程相关的 #21）单独审核处理，不自动关闭。

**阶段二：研究入口归档。** 从根目录移动 `glm-work/` 4 个文件和 `task/dev/README.md`，避免覆盖已经存在的 `research/glm-work/README.md`、`prompt.md`。保留原文件 Blob SHA；原 `start-opencode.bat` 保存一份原样副本，另修正新位置的工作目录、配置和 Prompt 路径。历史报告中的旧路径保留作为证据。

**阶段三：游戏结构。** 将重复的 PWA/Hostra Game Entry 统一为根目录 `game.json`，添加 `launch.pwa.json`、`launch.hostra.json`、`presentation.json`、`subsystems/`、`game-libs/`；已有 `apps/` 和 `systems/` 脚手架在新方案被验证之前不删除。自制合成场景验证角色移动、跳跃、立足线、地图 A/B 双向传送。

**阶段四：PWA Build/CI。** 验证并精确固定新 LoomRealm gitlink（Pokeman 已用 `93648192323bf5f57996b7b54cbae641d8a53fdb`，Adventure 当前为 `c5217e47be5a43f974e9e6ce82230077fb639c39`）；同步修改 `issue-agent-validation.yml` 旧 SHA/示例检查。Adventure 自己打包可执行 Subsystem、Content、Presentation，再使用 LoomRealm 通用 `build-bundle.mjs` 以 `--app-id adventure-island --base-path /pwa/adventure-island/` 输出。GitHub-hosted Runner 完成 Chromium E2E，发布内容不包含研究证据、原始 WZ、未授权素材和凭据。

**阶段五：隔离部署。** 采用独立 Compose 项目 `loomrealm-adventure-pwa`、端口 8788（正式）/8791（候选）、独立发布状态和数据根。LoomRealm 当前 Nginx 与部署探针有 Pokeman 专用路径，必须先参数化/实现独立适配器，不能复用 Pokeman 正式 8787 端口或部署状态。候选成功后提升正式服务，失败只回滚 Adventure Island；在公网环境验证 HTTPS/Service Worker Scope。

## 验收

- 本次 PR：`python3 -m py_compile scripts/issue_agent/agent.py tests/test_issue_agent.py`、`python3 -m unittest discover -s tests -p 'test_issue_agent.py' -v` 通过；旧 3 个 workflows 和旧 Agent 文件不存在；`research/**` SHA 全不变。
- 归档 PR：保留原根目录 5 个文件的字节级证据，新 Windows 启动入口真实可用。
- 游戏/PWA PR：真实双地图闭环、PWA Chromium 验收通过，精确来源 SHA 可追溯。
- 部署 PR：两个产品容器/端口/状态隔离，Pokeman 不停服，Adventure 回滚验证通过。

全程经 PR 审核合并，不直接推送 main 或自动执行线上部署。
