# 根目录统一 Game Entry（canonical：base → adventure-map）

> 适用范围：仓库根目录的 canonical Game Package 入口（`game.json`、`launch.pwa.json`、
> `launch.hostra.json`、`presentation.json`、`subsystems/`）。基线 LoomRealm submodule 固定在
> `93648192323bf5f57996b7b54cbae641d8a53fdb`，本入口不升级、不部署。
> 总体迁移计划见 `docs/migration/2026-11-04-issue-agent-and-pwa.md`（PR #40）。

## 1. Canonical 源与过渡并存

参照 [Pokeman](https://github.com/lithdoo-labs/pokeman)（ pinned 参考
`loom-realm/examples/PokeMan/`）的仓库分工，Adventure Island 的 canonical Game Entry
自本阶段起位于**仓库根目录**：

| 文件 | 角色 |
|---|---|
| `game.json` | canonical Game Entry V1。`initial.subsystem=base`、`input=null`，声明 `base` 与 `adventure-map`，无初始 Shared State。 |
| `launch.pwa.json` | PWA Launch manifest：`base` → `subsystems/base.mjs`，`adventure-map` → `subsystems/adventure-map.mjs`。 |
| `launch.hostra.json` | Hostra Launch manifest：与 PWA 相同的 key→module 绑定。清单对齐不等于 Hostra 实机验收。 |
| `presentation.json` | Web Presentation Config V1。`styles: []`。脚本顺序固定为 `controls/device-input.browser.js`，然后 `cms-actor/cms-actor.browser.js`。 |
| `systems/base/subsystem.mjs` | 唯一 Base 实现。持有一个 `game-controls-input`，并调用 `adventure-map`。 |
| `systems/adventure-map/subsystem.mjs` | 唯一 Adventure Map 实现。消费方向输入，投影唯一 `cms-actor`。 |
| `subsystems/base.mjs`、`subsystems/adventure-map.mjs` | 根安装根的 Hostra 薄 re-export。PWA 不发布这两份源码。 |
| `scripts/pwa/` | installation-bundle v1 生成器与选定 FSDB 闭包读取器（见 §5）。 |

**验收边界**：

- **PWA**：canonical Chromium + Service Worker E2E 覆盖 Base → Map 保持 `ready`、唯一 Actor、可信键盘方向键、松键和 Resize 居中。通过与否以该次运行的真实结果为准，未运行不能记为通过。
- **Hostra**：launch manifest 与根绑定可被 `prepareHostraGame` 解析。没有 Hostra Content 安装和桌面实机运行，状态为 **BLOCKED**。
- **手柄 D-pad**：兼容手柄由固定 Controls classic IIFE 接入，本切片没有真实 D-pad 设备矩阵，状态为 **DEVICE UNVERIFIED**。

**隔离的旧入口**：`apps/pwa/**`、`apps/hostra/**` 与 `systems/loomrealm-smoke/**` 仍是独立的 legacy Smoke，不要求与 canonical 根入口等价。`subsystems/smoke.mjs` 只服务这条旧路径。

## 2. 文档规则（与 pinned LoomRealm 对齐）

- `game.json` 遵循 `packages/game-package/src/validate.ts` 的 Game Entry V1 规则：
  精确的 `{ formatVersion, initial, subsystems }`（可选 `state`），`initial` 必须精确为
  `{ subsystem, input }` 且 `initial.subsystem` 必须在 `subsystems` 中声明。
- `launch.pwa.json` / `launch.hostra.json` 遵循 `parsePwaLaunchManifestV1` /
  `parseHostraLaunchManifest`：精确的 `{ formatVersion, subsystems }`，每条绑定为精确的
  `{ key, module }`；`module` 是不含 `..`、反斜杠、冒号的相对逻辑模块路径
  （如 `subsystems/smoke.mjs`），必须解析为安装根内的常规 `.mjs` 文件
  （`canonicalizeInstallationRoot` + `resolveInstallationModule`）。
- 两份 manifest 的 key 集合必须与 `game.json` 的 subsystem key 集合**双向一致**
  （`joinBindings`），且同一 key 在两份 manifest 中绑定同一逻辑模块。
- `presentation.json` 遵循 `packages/renderer/src/internal/web-presentation-config.ts`
  的 `validateWebPresentationConfigV1`：精确的 `{ formatVersion, scripts, styles }`，
  每个条目是精确的 `{ namespace, key }` Content 资源引用（namespace 不含层级、key 允许
  层级，均禁止遍历/协议/盘符），列表内不得重复。

## 3. Base 与 Adventure Map：各一份实现

业务实现只有两份：

- `systems/base/subsystem.mjs` 创建并持有唯一的 `game-controls-input` RenderDomain，`await frame.call("adventure-map", frame.params)` 原样透传参数，并在 `finally` 关闭输入域。Frame 在 Map 返回、取消或失败前保持活跃。
- `systems/adventure-map/subsystem.mjs` 复用固定 LoomRealm 的 `createControlsConsumer` 与 `createDirectionalControlsTracker`。left/right 为 walk 并更新朝向，up 为 jump，down 为 stand，无方向时 stand 并保留朝向。只更新变化的字符串 attrs，不产生世界坐标位移。Actor key 为 `adventure-player`。

根目录 `subsystems/base.mjs` 与 `subsystems/adventure-map.mjs` 只 re-export 上述实现。Hostra / Node 直接 import shim。PWA 发布的是 esbuild 产出的自包含 executable，逻辑模块名仍是这两条 shim 路径，源码不是 shim。

`systems/loomrealm-smoke/subsystem.mjs` 与 `apps/*/subsystems/smoke.mjs` 保留给隔离的旧 Smoke，不参与 canonical 启动。

## 4. PWA 打包责任划分（阶段 4 前置约束）

pinned `buildPwaExecutableIndexV1`（`packages/game-launcher-pwa/src/index.ts`）对已发布
executable 的导入图有硬性约束：只接受相对导入，且整张导入图必须由发布集合本身满足——

- 边目标越出安装逻辑根 → `SUBSYSTEM_MODULE_OUTSIDE_INSTALLATION`
  （`apps/*` shim 的 `../../../…` 越界即属此类，既有 smoke 测试已钉死）；
- 边目标不在发布的 executable 集合内 → `SUBSYSTEM_MODULE_NOT_FOUND`
  （根 shim re-export 的 `systems/base/subsystem.mjs` 与
  `systems/adventure-map/subsystem.mjs` 不属于 launch manifest 声明的逻辑模块集合，
  因此**根 shim 单独发布必然被拒绝**）。

canonical PWA 用 esbuild 把 `@loomrealm/subsystem` 与
`@loomrealm-game/common-controls/subsystem` 内联进自包含 ESM，再按逻辑模块名
`subsystems/base.mjs` 与 `subsystems/adventure-map.mjs` 发布。发布后的导入图必须为空。

发布内容不得包含研究证据、原始 WZ、未授权素材与凭据。

## 5. Canonical Bundle

`scripts/pwa/build-installation-bundle.mjs` 从 §1–§2 的 canonical 根目录输入生成
**installation-bundle v1 payload**——即 LoomRealm 通用 PWA 构建器（较新版本
`93648192323bf5f57996b7b54cbae641d8a53fdb` 的 `apps/pwa/scripts/build-bundle.mjs`
`--bundle` 入参）所消费的产品侧 JSON，schema 与上游 `validatePwaBundlePayload`
及 Pokeman 的 product-owned generator 完全相容：

```jsonc
{
  "formatVersion": 1,
  "gameEntryText": "<根 game.json 原文>",
  "launchManifestText": "<根 launch.pwa.json 原文>",
  "presentation": { "formatVersion": 1, "styles": [], "scripts": [
    { "namespace": "Presentation", "key": "controls/device-input.browser.js" },
    { "namespace": "Presentation", "key": "cms-actor/cms-actor.browser.js" }
  ] },
  "executables": [
    { "logicalModule": "subsystems/base.mjs", "mime": "text/javascript",
      "source": "<esbuild bundle of systems/base/subsystem.mjs>",
      "contentVersion": "sha256:<bundle bytes>" },
    { "logicalModule": "subsystems/adventure-map.mjs", "mime": "text/javascript",
      "source": "<esbuild bundle of systems/adventure-map/subsystem.mjs>",
      "contentVersion": "sha256:<bundle bytes>" }
  ],
  "content": [
    { "kind": "record", "namespace": "struct.AdventureAvatarPlan", "key": "bootstrap",
      "mime": "application/json; charset=utf-8", "encoding": "base64", "body": "<AvatarPlanV1>" }
  ]
}
```

- **输入白名单**：canonical 文档 `game.json`、`launch.pwa.json`、`presentation.json`；
  executable 仅来自 `EXECUTABLE_SOURCE_BINDINGS` 的 `systems/base/subsystem.mjs` 与
  `systems/adventure-map/subsystem.mjs`；Content 来自 `content/[FSDB]adventure` 的选定闭包、
  派生记录 `struct.AdventureAvatarPlan/bootstrap`，以及 `CONTENT_SCRIPT_SOURCE_BINDINGS`
  的两份 classic script。无目录递归扫描；`research/**`、`.raw/**`、`.work/**`、
  `glm-work/**`、`task/**`、WZ/客户端、凭据均不在输入集合中。历史合成生成器
  `scripts/pwa/synthetic-avatar-content.mjs` 只留给隔离的纸娃娃回归，不是 canonical 来源。
- **executable 发布策略**：两份源码经 esbuild（`format: esm`、`platform: browser`、
  `target: chrome140`、`bundle: true`）内联依赖后发布。发布字节的导入图必须为空，
  且不得含动态 import、`process`、`require()` 或 `node:`。根 shim 与 `apps/*` shim
  含相对 re-export，在打包前就被拒绝。
- **Content 发布策略**：只发布选定 Part/Group/PNG 闭包和一份派生 AvatarPlan。
  Plan 引用的每个 PNG identity、SHA-256 与 Content Version 必须和最终 Bundle entry 一致，
  Plan 数据字节不超过 262144。不改 FSDB 源文件，也不把全量 FSDB 放进运行时 Content。
- **确定性**：紧凑 JSON + 换行，无时间戳/路径字段；同输入重复运行字节一致。
- **写出约束与路径安全**：`--output` 必填，目标必须位于 `<repo>/dist/` 或系统临时
  目录；目标自身不得是 symlink（含悬空）或目录；**父目录链逐段验证**——任何已存在
  的中间目录（含 `dist/` 根自身）都不得是 symlink，缺失的父目录只沿已验证的可信链
  **逐级非递归 `mkdir`** 创建（绝不先 `mkdir({recursive:true})` 再判断），因此所有
  拒绝都发生在任何越界目录创建之前，被拒绝的构建对文件系统零副作用（测试用
  隔离 fixture 的完整目录树快照 + sentinel 字节 + 临时文件残留扫描证明）。解析后
  的最终位置必须仍落在词法选定的允许根内（dist 目标必须解析回字面 `dist/` 子树、
  临时目录目标必须解析回系统临时目录），且不落入保护树
  （`research/**`、`glm-work/**`、`task/**`、`loom-realm/**`、`.github/**` 等）、
  不覆盖 Git 追踪文件。产物通过**同目录独占临时文件（`wx`＝`O_CREAT|O_EXCL`）+
  `rename` 原子替换**写出：`rename(2)` 只替换目标目录项、不跟随 symlink，因此不会
  写穿任何预置或中途置换的 symlink；重复构建已存在的普通产物合法且字节确定
  （两次生成 SHA-256 一致）。
  **威胁模型与边界（如实界定）**：防护对象是"构建开始前已存在的恶意 symlink /
  越界父目录 / 追踪文件"与"构建期间可观测的重定向"（每级 mkdir 前重验父段、
  rename 前整链 verify-only 复查 + realpath 身份一致性，发现即 fail closed；
  `dist/` 缺失时按需创建，不影响临时目录目标）。对并发攻击者在验证与 rename 之间
  置换已验证目录的 TOCTOU 竞态，Node 无 `renameat`/dirfd 原语，只能收窄窗口而
  无法严格消除——本工具不宣称防御拥有同级文件权限且主动竞态的攻击者（与上游
  PokeMan/LoomRealm 构建器的保证层级一致）。
- **gitlink 校验**：仓库 Gitlink（`HEAD:loom-realm`）是唯一受信任 pin，运行时验证
  检出的 submodule HEAD 与之完全相等（须为真正的 submodule checkout）；脚本内不再
  硬编码 SHA——维护者经 PR 更新 Gitlink 后无需改脚本，当日 main 上仍等效校验
  `93648192323bf5f57996b7b54cbae641d8a53fdb`（可用 `verifyGitlink: false` 关闭，
  仅供测试注入；非匹配/未检出 submodule 的负例测试见 `test/pwa-bundle.test.mjs`）。

用法：

```bash
npm run pwa:bundle
# 等价于
node scripts/pwa/build-installation-bundle.mjs --output dist/adventure-island-installation-bundle.json
```

当前 canonical 产物：`executables` 2 项（`subsystems/base.mjs`、`subsystems/adventure-map.mjs`），
Content 为选定 `[FSDB]adventure` 闭包、`struct.AdventureAvatarPlan/bootstrap`，以及 Controls 与 cms-actor 两份 classic script。相同输入重复构建时字节一致。

### 阶段 4B：cms-actor 合成 Content 与 canonical PWA 闭环（PR-B）

`scripts/pwa/build-staging.mjs`（`npm run pwa:staging`）使用当前 Gitlink 固定的 LoomRealm
通用 PWA builder，生成 appId `adventure-island`、basePath `/pwa/adventure-island/`
的真实 staging 目录。构建前验证 Gitlink 与 checkout 一致、框架构建产物存在、输出路径
不越界；产物验证 generation、bundleId、payload 回显和运行时文件。

历史 PR-B 使用合成 Look/ZMap 和 Smoke 入口。那个合成闭环保留为隔离回归：
`test/pwa-browser.e2e.test.mjs` 的纸娃娃场景自行组装 synthetic payload，不读取
canonical FSDB Bundle。canonical 场景改为真实 Service Worker 下的 Base → Map。

隔离纸娃娃回归仍覆盖：

- 通过真实 Content API 重新读取 `struct.ZMap` / `struct.Look` 记录；
- 像素级验证角色锚点、层序、透明区域，以及 `stand1`、`walk1`、`jump`；
- 错误 ContentVersion 与缺失资源均被拒绝、清空画布并报告可定位错误，随后可恢复；
- 元素断开时释放 Bitmap cache，重新投影后再次绘制；
- 该场景不是 canonical 启动证明。canonical 证明是同一文件中的 Base → Map 场景：产品保持 `ready`，唯一 `cms-actor` 有不透明像素，`page.keyboard` 改变 locomotion/facing/`data-action`，松键恢复 stand 并保留朝向，Resize 后仍居中。

`.github/workflows/pwa-ci.yml` 继续要求组件测试、根 Node 测试、staging 和 canonical PWA E2E 的 `# fail 0` 与 `# skipped 0`。必需测试未运行或被跳过时不能记为通过。

**边界**：canonical 切片证明选定 FSDB Avatar 在 PWA 中响应键盘方向并保持居中。它不包含真实地图、世界坐标、物理、Hostra 实机或真实手柄。Hostra 为 **BLOCKED**，D-pad 为 **DEVICE UNVERIFIED**。

## 6. 测试

产品侧 Node 测试由 `npm test` 执行；CI 先安装并构建 pinned LoomRealm，再执行组件测试与真实浏览器测试：

```bash
npm test
node components/cms-actor/scripts/build.mjs --check
node --test components/cms-actor/test/avatar-model.test.mjs components/cms-actor/test/browser-artifact.test.mjs
node --test components/cms-actor/test/integration.chromium.test.mjs
LOOMREALM_PWA_BASE_PATH=/pwa/adventure-island/ \
  node loom-realm/apps/pwa/scripts/run-e2e.mjs staging test/pwa-browser.e2e.test.mjs
```

CI 对根测试、组件 Node 测试、组件 Chromium 测试和 PWA E2E 均检查 `# fail 0` 与
`# skipped 0`；缺少 pinned framework artifacts、Playwright 或可启动 Chromium 时
不能把必需 E2E 计为通过。

`test/game-entry.test.mjs`（基础层确定性生效；深层用例在 loom-realm submodule 已
`npm install && npm run build:packages` 时自动启用，未构建时以 skip 明确报告原因）：

- (a) 根 `game.json` 初始 Subsystem 为 `base` 并声明 `adventure-map`；`apps/pwa` 与 `apps/hostra` 保持隔离的 legacy Smoke；
- (b) 根 PWA/Hostra manifest 与 canonical Game Entry 的 subsystem key 集合精确一致；
- (c) 根 `subsystems/base.mjs` 与 `subsystems/adventure-map.mjs` re-export 唯一实现；legacy `subsystems/smoke.mjs` 仍转发旧 Smoke 并完成 Frame；
- (d) 根绑定位于安装根内，re-export 目标 realpath 等于 `systems/*` 实现；
- (e) 直接发布根 shim 会被拒绝。深层 `prepareHostraGame` 只解析 `base` 与 `adventure-map`，不把该解析当成 Hostra 实机通过。
- `test/adventure-runtime.test.mjs` 覆盖 Base 生命周期、Map 动作，以及 Content 不可用、取消和同步投影失败后的清理。

`test/presentation.test.mjs`：根 `presentation.json` 先注册 Controls classic IIFE，再注册 cms-actor classic IIFE。

`test/pwa-bundle.test.mjs`（阶段 4A / PR-B）：CLI 字节确定性（两次运行 + 自覆盖一致）；
payload schema 与精确来源（文本逐字节等于根文档、两份 executable 为自包含 bundle 且不是 shim、SHA-256 重算一致、FSDB 闭包 + bootstrap Plan + 两份脚本的身份与顺序精确，含一次 Plan/PNG SHA-256 与字节上限往返）；上游
`validatePwaBundlePayload`（自 `9364819` 逐字 vendored，正/反例校准）接受产物；
manifest/Game Entry 键集合往返一致；shim、bare import、非字面量动态 import、
Node-only 全局作为 executable 被拒绝；非法 CLI 参数、受保护/追踪路径、目录目标、
七类坏输入文档在写出前被拒绝且零写出；产物不含任何 research/敏感标识（并对
生成器输入白名单做结构校验）；**输出路径安全**（隔离的模拟项目根 +
`research/keep.txt` sentinel，不触碰真实 `research/**`）：无 `dist/` 的干净根
同时支持 dist 与临时目录目标（含多级缺失父目录逐级创建）、symlink 目标（含悬空）
被拒且 sentinel 字节不变、父目录 symlink（含 `dist/` 根自身为 symlink、
symlink 后还需创建新子目录、tmpdir 内祖先 symlink 指向保护目录）在**任何越界
目录创建之前**被拒——以完整目录树前后快照 + sentinel 字节 + 临时文件残留扫描
证明零副作用、已存在普通产物可安全重建且字节确定（symlink 用例在平台不允许
创建 symlink 时显式 skip 并给出原因）；深层用真实
pinned `buildPwaExecutableIndexV1` 接受产物 executable 图（`imports: []`）并以
shim 输入复验被拒（`SUBSYSTEM_MODULE_NOT_FOUND`）。

`test/pwa-staging.test.mjs`：隔离 git fixture 与忠实模拟 builder 验证固定参数、payload→builder→
产物校验链、重复 staging、Gitlink 不匹配/未检出、缺 builder/缺构建产物、symlink 与
Git-tracked 输出拒绝，以及错误 builder 产物检测；当前 Gitlink 的真实 generic-builder
正向集成测试由 CI 在安装/构建 pinned LoomRealm 后执行，不允许 skip。

## 7. 后续阶段

- 阶段 3B：合成地图 + 纸娃娃与移动/跳跃/立足线/传送。
- 阶段 4A（已完成）：`scripts/pwa/build-installation-bundle.mjs` 生成
  installation-bundle v1 输入（见 §5）。
- 阶段 4B（历史 PR-B）：当时的 canonical 入口仍是 Smoke，Content 为 24 项合成记录和 PNG。该合成纸娃娃回归仍保留，但不再是 canonical 来源。
- 当前切片：根入口为 `base` → `adventure-map`，Content 来自现有 `[FSDB]adventure` 的选定闭包和派生 AvatarPlan。PWA 键盘闭环由 canonical E2E 验收；Hostra 实机 **BLOCKED**；真实 D-pad **DEVICE UNVERIFIED**。
- 阶段 5：独立 Compose（`loomrealm-adventure-pwa`）、端口 8788/8791 与回滚。
- 旧入口清理：另开 Issue 再删除 `apps/pwa/**`、`apps/hostra/**` 的 legacy Smoke 入口。本切片不删除它们。
