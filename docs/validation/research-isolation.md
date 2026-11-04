# research 隔离与 LoomRealm PWA 工程验证报告（Issue #38）

> 验证类型：本地只读验证 + 既有测试执行。除本报告外未修改、未新增任何文件；未执行 git commit / push / gh 发布操作。
> 验证对象：`main` 在 PR #37（仓库重构）与 PR #36（LoomRealm 空应用脚手架）合并后的实际结果。
> 结果总计：**26 项编号检查（P1–P4、A1–A7、B1–B5、C1–C5、D1–D5）全部 PASS，0 FAIL、0 BLOCKED**。测试用例数单列、不并入上述计数：Issue Agent 单元测试 15 例、研究脚本语法检查 100 例、LoomRealm smoke 测试 9 例，全部通过（分见 §5 C4/C5、§6 D4）。

## 1. Runner 环境信息

不含密钥或个人隐私；未访问 `.env`、凭据或任何本地客户端样本。

| 项 | 值 |
|---|---|
| Runner | 组织级 Self-hosted Runner `opencode-lithdoo-labs`（`RUNNER_NAME`，与 `.github/workflows/org-runner-smoke.yml` 的固定校验值一致；`RUNNER_OS=Linux`，`GITHUB_ACTIONS=true`） |
| 系统 | Linux x86_64（内核 `6.6.87.2-microsoft-standard-WSL2`） |
| Node / npm | v22.23.4 / 10.9.9（满足 `systems/loomrealm-smoke` 的 `engines.node >= 20`） |
| Python | 3.11.2 |
| Git | 2.39.5 |
| 验证基线 | HEAD `38f28c0238eb65292176555aa3c9363705a02301`（detached，工作树干净），即 PR #36 的**普通合并提交**（非 squash：两个 parent 为 `06cfc8af0c2ac3811f9f6ad6c36b6b43be50357b`＝PR #37 的合并提交、`0de91a913c5edc04ed811df2c30eed14ebefd2a5`＝PR #36 head；committer 为 GitHub），且经 API 确认为 `origin/main` 当前 tip |
| Submodule | `loom-realm` 已初始化于 `c5217e47be5a43f974e9e6ce82230077fb639c39`，packages 已构建（各 `dist/` 存在），因此 smoke 深层用例启用 |
| 本地样本 | `.raw/`、`.work/` 在本 Runner 上不存在，全程未访问、未复制 |

GitHub 状态检查通过匿名只读 REST API（`api.github.com`）完成，未做任何写操作。

## 2. 启动前置条件

| # | 条件 | 结果 | 证据 |
|---|---|---|---|
| P1 | PR #37 已合并 | **PASS** | API：`merged=true`，`merged_at=2026-11-04T03:33:45Z`，标题 `refactor: isolate CMS079 research archive under research/`，base `main` |
| P2 | PR #36 已合并 | **PASS** | API：`merged=true`，`merged_at=2026-11-04T03:34:30Z`，`merge_commit_sha=38f28c0…` 与本地 HEAD 完全一致；`git rev-list --parents` 与 API 均确认该提交有两个 parent（PR #37 合并提交 `06cfc8a…` 与 PR #36 head `0de91a9…`），为普通 merge commit |
| P3 | 报告路径为 `research/result/loomrealm-empty-app.md`，根目录 `result/` 未重建 | **PASS** | 文件存在（17,288 字节）；根目录无 `result/`；PR #36 变更清单（13 个文件）仅含 `research/result/loomrealm-empty-app.md`，无任何根 `result/` 路径 |
| P4 | `loom-realm` gitlink 仍为 `c5217e47be5a43f974e9e6ce82230077fb639c39` | **PASS** | `git ls-tree HEAD loom-realm` → `160000 commit c5217e47…`；`git submodule status` 前缀为空格（checkout 精确一致）；PR #37/#36 变更清单均不含 `loom-realm` |

## 3. A. 目录隔离

| # | 检查 | 结果 | 说明 |
|---|---|---|---|
| A1 | 根目录无研究用 `result/`、`reference/` | **PASS** | 工作树与 `git ls-files` 顶层均无（顶层仅 `.github .gitignore .gitmodules DESIGN.md README.md apps components content docs glm-work libs loom-realm research scripts systems task tests`） |
| A2 | 根 `task/` 只保留 `task/dev/` | **PASS** | `task/` 下仅 `dev/`（内含 `README.md`） |
| A3 | 根 `scripts/` 只保留 `scripts/agent/`、`scripts/issue_agent/` 和说明文件 | **PASS** | 仅 `README.md`、`agent/`（10 个文件）、`issue_agent/`（`agent.py`）；`README.md` 明确研究脚本已迁出 |
| A4 | 根 `glm-work/` 只保留启动配置、兼容 prompt 和说明文件 | **PASS** | 仅 4 个文件：`README.md`、`opencode.json`、`prompt.md`、`start-opencode.bat` |
| A5 | `research/` 包含 `task/ result/ reference/ scripts/ glm-work/` | **PASS** | 五个子目录齐全（`task/` 51 个任务书、`result/` 500 个产物、`reference/maplestory-symbols/`、`scripts/` 20 个文件、`glm-work/` 7 项），另有 `research/README.md` |
| A6 | 研究资料不被正式运行时模块 import | **PASS** | 对 `apps/ components/ libs/ systems/ content/ tests/` 全量扫描 `import/require/import()`：零命中。出现的 `research/` 字样仅为 README 文档交叉引用（`apps/pwa/README.md`、`apps/hostra/README.md` 指向 `research/result/loomrealm-empty-app.md`），非模块依赖 |
| A7 | `.raw/`、`.work/` 未提交；不访问本地样本 | **PASS** | `git ls-files` 对两目录计数为 0；均列于 `.gitignore`；本 Runner 上两目录不存在，未访问、未复制 |

## 4. B. 路径与文档

| # | 检查 | 结果 | 说明 |
|---|---|---|---|
| B1 | 根 `README.md`、`DESIGN.md`、`components/README.md`、`content/DESIGN.md` 新路径引用 | **PASS** | 全部 `result/ reference/ task/` 引用均带 `research/` 前缀（过滤扫描零残留）；逐一验证链接目标存在：`research/task/023-…`、`research/result/23-…`、`research/task/050-…`、`research/result/50-…`、`research/result/20/23/57/60-…`、`research/result/task061-game-formulas.md`、`research/README.md`、`docs/issue-agent.md` |
| B2 | `glm-work/start-opencode.bat` 研究写入范围指向 `research/glm-work/` | **PASS** | 从仓库根启动；`--prompt` 明示 "Create or modify files only inside research/glm-work/"；`OPENCODE_CONFIG` 指向 `glm-work/opencode.json` |
| B3 | `glm-work/opencode.json` / `glm-work/prompt.md` 写入范围 | **PASS** | `opencode.json`：edit 默认 `deny`，仅放行 `research/glm-work/*`（含 `*research/glm-work/*`、反斜杠变体）；`prompt.md` 为兼容入口，转交 `research/glm-work/prompt.md` 并禁止写入正式工程、CI、Submodule |
| B4 | `research/glm-work/prompt.md` 读写边界 | **PASS** | 「唯一写入范围」= `research/glm-work/`；正式工程（`apps/ components/ libs/ systems/ content/`）、研究基线、CI（`task/dev/ scripts/agent/ scripts/issue_agent/ .github/`）、`loom-realm/`、根文档配置全部声明只读；引用规则要求使用当前 `research/` 归档路径 |
| B5 | 研究档案旧路径文本分类 | **PASS**（只报告，未改写） | 见下文「旧路径文本分类」 |

### 旧路径文本分类（仅报告）

- 132 个 `research/**/*.md` 含重构前的根相对路径文本（`result/…`、`scripts/maple…`、`glm-work/result/…` 等），集中在 `research/task/` 任务书与 `research/result/`、`research/glm-work/result/` 历史报告内，属**历史证据记录**；`research/README.md` 使用边界第 6 条已明示该策略。
- 全档案扫描 Markdown 可导航链接（`](...)` 形式）：**零条**旧路径失效链接。
- 活文档（`research/glm-work/analysis/STATUS.md`、`research/glm-work/reverse-engineering-plan.md`）旧路径命中数为 **0**，均已使用 `research/` 前缀。
- `research/result/README.md` 本身是 Task 001 时代的说明快照，其 `task/001-…` 引用位于代码块内，按上述策略视为历史记录（见 §8 跟进建议 2）。
- 4 个 Python 文件含旧路径字符串：3 个（`maple079_walker_log.py`、`maple079_wide_capture.py`、`maple079_write_logger.py`）仅在 docstring 中提及 `scripts/maple079_stage2_continue.py`（历史描述）；1 个（`research/glm-work/scratch/trackA_strings.py:3`）实际 `open("glm-work/result/wizet-dll-inventory.json")`，若将来从仓库根重跑会指向已迁移的旧路径（现位于 `research/glm-work/result/`）。属归档 scratch 产物，本次不改写（见 §8 跟进建议 1）。

## 5. C. CI 与依赖保护

| # | 检查 | 结果 | 说明 |
|---|---|---|---|
| C1 | `.gitmodules` 未变化，gitlink 与 checkout SHA 一致 | **PASS** | 内容仍为 `loom-realm → https://github.com/lithdoo/loom-realm.git`；PR #37 全量 712 个变更文件（699 rename + 13 非 rename）与 PR #36 全量 13 个文件均不含 `.gitmodules`、`loom-realm` gitlink、`.github/`、`.gitignore`、`task/dev/`、`scripts/agent/`、`scripts/issue_agent/`、`docs/issue-agent.md`；gitlink == checkout SHA == `c5217e47…` |
| C2 | `task/dev/`、`scripts/agent/`、`scripts/issue_agent/`、`docs/issue-agent.md` 保留原路径 | **PASS** | 四者均在原路径且内容未被上述两 PR 触碰（PR #37 非 rename 变更仅 4 个根文档、4 个 `glm-work/` 兼容文件、5 个 README） |
| C3 | `git diff --check` | **PASS**（exit 0） | 无空白错误、无冲突标记 |
| C4 | Python Issue Agent 单元测试 | **PASS**（exit 0） | `python3 -m py_compile scripts/issue_agent/agent.py tests/test_issue_agent.py` → 0；`python3 -m unittest discover -s tests -p 'test_issue_agent.py' -v` → **15/15 OK**（与 `issue-agent-validation.yml` 使用完全相同的命令） |
| C5 | 迁移后研究 Python 脚本语法检查 | **PASS**（exit 0） | 对 `research/` 全部 **100** 个 `.py`（`research/scripts` 17、`research/glm-work/scripts` 13、`research/glm-work/scratch` 70）做内存内 `compile()`，**0 失败**，不产生 `__pycache__`；未运行任何依赖真实客户端、WZ、Windows 或 `.raw/` 样本的分析任务 |

## 6. D. LoomRealm PWA / Hostra 空应用

| # | 检查 | 结果 | 说明 |
|---|---|---|---|
| D1 | PWA 与 Hostra `game.json` 逻辑拓扑一致 | **PASS** | 两文件**逐字节相同**；拓扑 `{formatVersion:1, initial:{subsystem:"smoke", input:null}, subsystems:[{key:"smoke"}]}` |
| D2 | `launch.pwa.json` / `launch.hostra.json` 模块路径在各自安装根解析 | **PASS** | 两 manifest 逐字节相同，`subsystems/smoke.mjs` 在 `apps/pwa/`、`apps/hostra/` 安装根内均存在且可解析；smoke 套件结构校验 + 固定版本真实 launcher API（`validateLogicalModule` 等）双重验证通过 |
| D3 | 共享 smoke Subsystem 可导入并完成单次 Frame | **PASS** | 手动 Node 检查：经 `apps/pwa/subsystems/smoke.mjs`、`apps/hostra/subsystems/smoke.mjs` 两个安装根 shim 及共享模块三路导入，`frame()` 均返回冻结的 `{type:"completed", value:{status:"ok", subsystem:"smoke"}}` |
| D4 | `npm test --prefix systems/loomrealm-smoke` | **PASS**（exit 0） | **9/9 通过，0 跳过**，含深层用例（submodule 已构建）：内置 API 校验 Game Entry 与两份 launch composition；SDK 与无依赖 ABI 一致；空应用经真实 Main + Hostra 宿主启动至首帧 completed。该套件即 CI 校验器（`scripts/agent/verify.sh`）对 `apps/`、`systems/loomrealm-smoke/` 路径触发的同一测试 |
| D5 | 其他仓库定义的无网络测试 | **PASS**（exit 0） | `issue-agent-validation.yml` 的两条命令已在 C4 执行通过；`org-runner-smoke.yml` 仅做 Runner 调度自检（手工 dispatch），本会话的 `RUNNER_NAME=opencode-lithdoo-labs` 已直接证明同一调度目标；未执行任何部署、发布或依赖真实素材的构建 |

## 7. 验收标准对照

| 验收项 | 结果 |
|---|---|
| 所有前置条件已满足 | ✅ P1–P4 全部 PASS |
| 目录隔离检查通过 | ✅ A1–A7 全部 PASS |
| 正式文档和本地研究 Runner 路径检查通过 | ✅ B1–B5 全部 PASS |
| Issue Agent CI 测试通过 | ✅ 15/15（exit 0） |
| 迁移后研究 Python 脚本语法检查通过 | ✅ 100/100（exit 0），无失败项 |
| LoomRealm smoke 测试通过 | ✅ 9/9（exit 0），深层用例启用，无环境阻塞 |
| Submodule SHA 与 `.gitmodules` 保持不变 | ✅ `c5217e47be5a43f974e9e6ce82230077fb639c39`，两 PR 均未触碰 |
| 只新增 `docs/validation/research-isolation.md` | ✅ 工作树此前干净，本次仅新增本文件 |
| 由组织级 Self-hosted Runner 执行并供 Draft PR 人工审核 | ✅ 在 `opencode-lithdoo-labs` Runner 上执行；发布为 Draft PR 由人工审核，不自动合并 |

## 8. 未解决问题与后续 Issue 建议

本次验证无 FAIL / BLOCKED 项。以下为低风险观察，均未在本次修改：

1. **`research/glm-work/scratch/trackA_strings.py` 的相对输入路径已失效**（`glm-work/result/wizet-dll-inventory.json` → 现位于 `research/glm-work/result/`）。属归档 scratch 脚本，若未来复用会找不到输入。建议另开 Issue 决定是加路径兼容、加注记还是保持原样；不应在验证任务中改写。
2. **`research/result/README.md` 是 Task 001 时代的目录说明快照**，保留旧目录口径（`task/001-…`、`result/` 树）。已被 `research/README.md` 使用边界第 6 条覆盖为历史记录；如需更清晰，可另开 Issue 仅追加一行来源说明头，不动正文。
3. **smoke 深层用例依赖 Runner 缓存中已构建的 `loom-realm/packages/*/dist`**。冷 Runner 上按设计降级为基础层并自报跳过（不计为通过）；本次环境已构建故 9/9 全跑。无需行动，供后续环境排查参考。
4. PR 合并状态经匿名只读 GitHub API 验证（未鉴权，受速率限制但响应完整）。后续如需在 CI 内做同样前置检查，可考虑用 `GITHUB_TOKEN` 鉴权，属独立 CI 维护任务。

## 附录：实际执行的命令与退出码

| 命令（在仓库根执行） | 退出码 |
|---|---|
| `git status` / `git log --oneline --all` / `git log --graph` | 0 |
| `git ls-tree HEAD loom-realm` | 0（输出 gitlink `c5217e47…`） |
| `git submodule status` | 0（前缀空格，SHA 精确一致） |
| `git diff --check` | **0** |
| `git ls-files`（顶层目录统计；`.raw/`、`.work/` 计数 = 0） | 0 |
| `curl -s https://api.github.com/repos/lithdoo-labs/adventure-island/pulls/37`、`/pulls/36`、`/pulls/37/files?per_page=100&page=1..4`、`/pulls/36/files`、`/commits/main`（只读） | 0 |
| `ls` / `find` / `grep -r` 目录、导入与旧路径扫描 | 0 |
| `diff apps/pwa/game.json apps/hostra/game.json`；`diff apps/pwa/launch.pwa.json apps/hostra/launch.hostra.json` | 0（逐字节相同） |
| `python3 -m py_compile scripts/issue_agent/agent.py tests/test_issue_agent.py` | **0** |
| `python3 -m unittest discover -s tests -p 'test_issue_agent.py' -v` | **0**（15 tests OK） |
| `python3`（内存内 `compile()` 语法检查 `research/` 全部 100 个 `.py`，不写 `__pycache__`） | **0**（failed=0） |
| `npm test --prefix systems/loomrealm-smoke` | **0**（9 pass / 0 fail / 0 skipped） |
| `node --input-type=module -e "…"`（smoke Subsystem 三路导入 + 单帧完成检查） | **0**（ONE_FRAME_CHECK=PASS） |
| `git rev-list --parents -n 1 38f28c0…` / `curl …/commits/38f28c0…` / `curl …/pulls/36` / `curl …/pulls/37`（Turn 2 复核合并方式：确认两个 parent，普通 merge commit） | 0 |
| `uname -a` / `node --version` / `npm --version` / `python3 --version` / `git --version` | 0 |

> 未执行：任何研究分析脚本、部署/发布命令、依赖真实素材的构建、`git push` / `git commit` / `gh`。`scripts/issue_agent/__pycache__` 为 CI 同款命令产生的未跟踪且被 `.gitignore` 忽略的缓存，不会进入提交。

## 修订记录

| 轮次 | 修订内容 |
|---|---|
| Turn 1（2026-11-04） | 初版报告：前置条件、A–D 四组验证、验收标准对照、后续建议、命令附录。 |
| Turn 2（2026-11-04，Issue 反馈） | 仅修订本报告两处澄清，未改动其他文件、未重跑任何访问本地样本的任务：① §1「验证基线」与 §2 P2 更正合并方式描述——`38f28c0…` 为普通 merge commit（两个 parent：PR #37 合并提交 `06cfc8a…`、PR #36 head `0de91a9…`），此前误写为 squash 合并提交；已全文复查，无其他合并方式误述。② 明确检查计数：编号检查项共 26 项（P1–P4、A1–A7、B1–B5、C1–C5、D1–D5），此前回帖中的「30 项」系将 26 项检查与 15/100/9 三组测试用例数混算所致；现于报告首部单独列示，避免重复计数。复核用的只读命令已补入附录。 |
