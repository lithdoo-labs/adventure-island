# PR #2（cms-actor 纸娃娃渲染器）改造、验收与合并执行计划

> 状态：**待执行**。本文件是维护者批准的实施基线，不代表任何改造 PR 已完成。
>
> 制定日期：2026-11-05；主线基线：`main` 上已合并的 Game Entry / PWA Bundle / LoomRealm CI；依赖 gitlink `93648192323bf5f57996b7b54cbae641d8a53fdb`。
>
> 遗留实现来源：[Draft PR #2](https://github.com/lithdoo-labs/adventure-island/pull/2)，HEAD `132853b892be6314ca6e298b9316d84812f99ca8`。相关但**非前置依赖**：[Draft PR #1](https://github.com/lithdoo-labs/adventure-island/pull/1)，WZ→FSDB 转换器。

## 1. 决策与交付边界

**不直接合并历史 PR #2。** 从当前 `main` 选择性移植经过验证的 `cms-actor` 代码与合成测试，分两个可独立审查/合并的改造 PR：

1. **PR-A（优先，单独 Issue Agent 任务）**：`cms-actor` 组件核心、独立 classic-script 构建、AvatarPlan 及合成测试，在固定 LoomRealm 上重新验证。**不更改根目录游戏入口、Presentation、PWA payload 或正式 CI 工作流。**
2. **PR-B（PR-A 合并后，由新 Issue/新 PR 执行）**：根目录 PWA 的 `presentation.json` 资源注册、确定性合成 Content 发布、真实 PWA staging 以及 Chromium/Service Worker 中的正式组件投影。需要维护者参与 `.github/**` 的独立 CI 更新。

现行 `scripts/issue_agent/**` 是**一个 Issue → 一个 `agent/issue-N` 分支 → 一个 Draft PR → 持续 Session**。不得指示同一个 Issue Agent 为 A、B 各开 PR；本计划对应的首个 Issue **只执行 PR-A**，PR-B 在 A 合并后另建 Issue/PR。所有合并都必须由维护者审查决定，Agent 不得自行合并。

完成 PR-B ≠ 完成真实 CMS079 角色内容接入，更不等于有可玩的地图与角色控制。原始 WZ 适配、PR #1 子集导出、Stage 3B 游戏玩法及生产部署均为后续独立工作。

## 2. 现状与技术差距

当前 `main`：
- Canonical `game.json` 初始 Subsystem 是 `smoke`；`launch.pwa.json` 绑定 `subsystems/smoke.mjs`。
- `presentation.json` 是 `{ "formatVersion": 1, "styles": [], "scripts": [] }`。
- `scripts/pwa/build-installation-bundle.mjs` 的输入白名单只发布 Smoke Executable，`content = []`；`npm run pwa:bundle` / `npm run pwa:staging` 及独立 Chromium Smoke CI 已通过。
- `.github/workflows/pwa-ci.yml` 和 `test/*` 多处断言 `scripts=[]`、`content.length===0`、恰好一个 Smoke Executable；未来引入 Content 时必须**更新为新的精确白名单断言**，不能简单删掉安全检查。
- LoomRealm Submodule 固定在 `93648192323bf5f57996b7b54cbae641d8a53fdb`，不得由 Agent 升级或修改。

PR #2 中已有：
- `components/cms-actor/src/avatar-model.mjs`：`AvatarPlanV1` 校验、动作名映射、WZ 锚点与 z-order、边界。
- `components/cms-actor/src/cms-actor.mjs`：Custom Element、Canvas 动画、镜像、单次 `action` Render Event、版本精确的 `PresentationResourceClient`、异步取消和容量受限 Bitmap 缓存。
- `components/cms-actor/scripts/build.mjs` / `browser/cms-actor.browser.js`：确定性的 classic IIFE 构建与 `--check`。
- 合成 FSDB/PNG、Node 测试、Chromium harness、测试用 `look-adapter.mjs`；可选本地真实素材测试。
- 历史 GitHub CI 的合成算法和 Chromium 测试成功，但**尚未以当前 `main` 的框架 pin 重新运行**；PR #2 本地真实素材报告只能作为历史证据。

新版 LoomRealm `packages/renderer/src/internal/presentation-resource-client.ts` 仍提供 `resource(namespace, key, expectedContentVersion, options)`；可先按当前 ABI 验证，而不是重写 Renderer。不过合成 harness 可能引用冻结版内部路径，应测试并修正。

## 3. PR-A：组件核心迁移（当前执行任务）

建议维护者新 Issue 标题：`feat(cms-actor): migrate PR #2 core to pinned LoomRealm (PR-A)`。

### 3.1 文件与实施步骤

以 `main` 为唯一合并基线，**选择性读取** PR #2 源文件内容；不得直接 `git merge`、`cherry-pick` 旧 PR 或覆盖已合并文件。

可新增/修改的文件仅为 `components/cms-actor/**`；本轮优先使用：
- `src/avatar-model.mjs`、`src/cms-actor.mjs`；
- `scripts/build.mjs`、`browser/cms-actor.browser.js`（从真实源码重新生成）；
- `test/avatar-model.test.mjs`、`test/browser-artifact.test.mjs`、`test/integration.chromium.test.mjs`、`test/harness.mjs`、`test/synthetic-fsdb.mjs`、`test/png.mjs`、`test/look-adapter.mjs`；
- 如需要，组件专属 `DESIGN.md`、`IMPLEMENTATION.md`、`DEPLOYMENT.md` 和 `presentation.json`（组件示范/测试配置，不是根 `presentation.json`）；
- `test/real-assets.local.test.mjs` / `test/real-look-adapter.mjs` **仅当能保持默认不需要真实 WZ、无秘密且显式独立执行时**才迁入；否则说明理由，留 PR-B 后的独立验证工作。

实施任务：
1. 逐项确认 `receiveRenderContext`、`receiveRenderData({avatarPlan})`、`receiveRenderEvent({name:"action",...})` 与 pinned Renderer Projector ABI 相符；正式资源通过 `context.resources.resource(namespace,key,contentVersion,{signal})` 获取，不能偷用 FSDB 私有路径或 URL。
2. 维持 `AvatarPlanV1` 上限、WZ 锚点、zmap 层序、像素镜像、`stand1/walk1/jump` 与一次性攻击动作的模型。维持缓存 LRU / 12MiB 预算、断开释放、取消过期绘制、不同计划尺寸冲突保护；发现兼容问题时用可定位回归修复，不放宽限制。
3. 使用 **Node 22** 与当前 gitlink 的真正 `@loomrealm/renderer` 依赖；必要的测试依赖通过标准工具链安装/构建。不得修改 LoomRealm 源码、gitlink、全局端口或生产服务来让测试通过。
4. 构建器应输出完整 classic script、注册 `customElements.define("cms-actor", ...)`；`--check` 必须字节等价验证。不能将 ESM 源码直接当 classic script 发布。
5. 合成测试必须通过真实资源读取、Web Presentation bootstrap / Projector / Canvas 绘制闭环；如果 Chromium 或框架依赖在 Runner 缺失，明确报告 **BLOCKED**，禁止伪称 PASS、禁止删除测试。
6. 组件文档统一保留“Renderer 只画已解析计划，业务适配器负责 WZ/UOL/别名/装备遮挡”的边界。测试 `look-adapter.mjs` **不是**正式游戏运行时代码。

### 3.2 PR-A 独立验收

在干净 checkout 上验证并报告实际 PASS/FAIL/SKIP/BLOCKED：
```bash
node components/cms-actor/scripts/build.mjs --check
node --test components/cms-actor/test/avatar-model.test.mjs components/cms-actor/test/browser-artifact.test.mjs
node --test components/cms-actor/test/integration.chromium.test.mjs
npm test
npm run pwa:bundle
npm run pwa:staging
```
构建前根据实际依赖先编译必要的 `loom-realm` workspace 并准备 Chromium。合成测试的失败、skip 或未运行均需单独说明；不允许把默认 `real-assets.local.test.mjs` 的预期 skip 混入“CI 全绿”的数字。PR-A 不触碰根入口，所以原有 `npm test` 与 PWA Bundle 必须保持现状且通过。发布由 Issue Agent 的 Publish 作业完成，保留 Draft，人工合并。

PR-A 完成门槛：
- 组件源码、IIFE、合成夹具进入当前 Draft PR，所有变更属于允许范围；
- 真实 pinned LoomRealm Chromium 合成闭环通过，或明确阻塞不请求合并；
- 无 WZ、客户端、提取 PNG、音频、FSDB 导出字节；无研究资料变更；
- 维护者独立复测并审核后才可合并，不能仅凭 Agent 自报合并。

## 4. PR-B：canonical PWA 资源与组件闭环（A 合并后新 Issue）

另开 Issue/PR，不在 PR-A Issue 中悄悄实施。建议：
1. 根 `presentation.json` 正式声明 `resource.Presentation` / `cms-actor/cms-actor.browser.js` 的 `scripts`，从预期目录按严格白名单发布 **classic IIFE**。
2. 扩展 `scripts/pwa/build-installation-bundle.mjs` 的固定 `content` 输入集合，最小包含组件脚本与**仓库内生成的确定性合成 PNG**，必要时带最小合成记录。对每条 `{kind,namespace,key,mime,encoding:"base64",body}` 检查 canonical Base64、身份唯一、Content Version 与 manifest 引用的一致性；不添加目录递归扫包，也不从 `research/**`、`/shared`、`.raw/**`、`.work/**`、`glm-work/**` 或 `task/**` 复制真实资源。
3. 保留固定 app-id `adventure-island` 和 base-path `/pwa/adventure-island/`；保持 `npm run pwa:bundle` 字节确定性、staging 输出路径防 symlink 越界与失败不破坏受保护树。
4. 保留根 Smoke Subsystem 与既有启动契约。通过**隔离的组件投影 E2E 夹具或测试专用 Subsystem**在真实 PWA/Service Worker/Renderer 正式 bootstrap 中发布合成 `avatarPlan`，确认页面实际出现并绘制一个角色、站/走/跳三动作、资源版本拒绝与取消行为。单纯 `customElements.get` 或手工注入脚本不能替代 Renderer Projector 闭环。
5. 精确更新 `test/presentation.test.mjs`、`test/pwa-bundle.test.mjs`、`test/pwa-staging.test.mjs`、`test/pwa-browser.e2e.test.mjs` 的旧空 Content 断言；必须继续验证不相关资源无法混入及 Smoke E2E 不退化。
6. **维护者**单独审核/更新 `.github/workflows/pwa-ci.yml` 与路径触发器，把 components 测试、真实 staging 和 Chromium E2E 纳入独立 GitHub-hosted CI；Issue Agent 不具备修改 `.github/**` 的发布权限。PR-B 最终必须有独立 CI 证明，无跳过的必需测试才算过门。

PR-B 成功意味着“在正式 PWA 中用合成资源显示/播放纸娃娃”，**不包括**游戏物理、双地图传送、生产部署或真实客户端素材。

## 5. 真实 CMS079 内容接入：独立后续任务

PR #1 当前只证明合成转换回归。PR #2 历史报告记录了使用 PR #1 转换器**子集**导入 Character 的身体/头/脸/头发/单手剑与 Base 的 zmap/smap 后，在 Agent 本地完成 Chromium 实测；此结果不能代表 16 包全量 Integrity-valid，且必须在新确认的私服重包样本上重新核对 IV/版本。

后续独立任务按 `WZ（只读） → FSDB（未跟踪） → Content API → AvatarPlan → cms-actor → Chromium` 验证：
- 只读检查合法提供的客户端身份；不运行可执行客户端，不上传资产；
- 从 PR #1 选择性取得最小 Character / Base 转换功能，不要求全量 Quest/Map 等先完成；
- 比对 SVG/PNG 之外的实际 Canvas RGBA 尺寸/像素哈希、UOL 解析、zmap、contentVersion；真实生成物只在本机未跟踪路径。
- `ContentClient.group()` 在新的 pinned 子模块**接口类型已声明**，但实际业务路径可用性需独立 E2E 验证，不沿用旧报告的“缺失”结论或以合成 mock 冒充。

## 6. 安全、保护范围与操作纪律

- **绝对禁止修改 `research/**`**：历史 704 个 Git Blob SHA 必须完全一致；不得把已有研究搬迁当成这轮任务。
- 不允许改 `loom-realm` gitlink、`.gitmodules`、`.github/**`、`scripts/issue_agent/**`、`scripts/agent/**`、`.gitignore`、`.raw/**`、`glm-work/**`、`task/**`。
- PR-A 还不允许改 root `game.json`、`launch.pwa.json`、`launch.hostra.json`、`presentation.json`、`package.json`、`scripts/pwa/**`、`subsystems/**`、`systems/**`、`test/**`；这些需要 PR-B 的新授权。
- 不得覆盖/破坏 PR #1；不能合并或覆盖历史 PR #2 分支；不能自动合并 Draft PR、不能部署、不能操作 Pokeman 服务与 8787/8790 端口。
- 单轮 patch 不超过 Issue Agent 约束（不超过 40 个文件、900 KB），不足以完成就保留相同 Issue 的持续 Session，用 owner review + `/agent revise` 补完**PR-A**。
- 真实资产和用户凭据绝不进入 GitHub PR/Issue/Action log；`/shared` 不能作为 PR-A 的隐式素材输入。

## 7. 最终归档与状态门槛

1. PR-A Draft 经完整独立验证、维护者批准后合并；
2. PR-B 另开 Issue/PR，完成 root PWA/Content/Chromium 接线，独立 CI 全绿并合并；合并后的 `main` push CI 再成功；
3. Git Tree 检查 `research/**` blob 不变，LoomRealm gitlink 不变；
4. 在旧 PR #2 留下新 PR/测试链接和迁移文件表，再将它关闭为 **Superseded / Not merged**；
5. PR #1 保持单独的内容导入任务；Stage 3B 可玩原型再单独立项。

**拒收条件**：自动合并历史 PR #2；仅通过合成 Node 测试就宣称真实 PWA 闭环；真实资产入库；更新框架 gitlink；删掉失败测试或放宽资源/内存/路径边界；把需要维护者修改的工作流放进 Agent patch。
