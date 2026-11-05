# 根目录统一 Game Entry（PWA 迁移阶段 3A / 4B）

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
| `game.json` | 平台无关的 canonical Game Entry V1（`initial.subsystem=smoke`、`input=null`，无初始 Shared State）。 |
| `launch.pwa.json` | PWA 平台 Launch manifest：把 Game Entry 声明的每个 Subsystem key 绑定到安装根内的逻辑模块。 |
| `launch.hostra.json` | Hostra 平台 Launch manifest：与 PWA 完全相同的 key→module 绑定。 |
| `presentation.json` | Web Presentation Config V1（`styles: []`；`scripts` 精确注册 `Presentation/cms-actor/cms-actor.browser.js`）。只加载 PR-A 生成的 classic IIFE，不加载真实 CMS079 素材。 |
| `subsystems/smoke.mjs` | 根安装根的 Smoke Subsystem 绑定（见 §3）。 |
| `scripts/pwa/` | 阶段 4A：installation-bundle v1 输入生成器（见 §5）。 |
| `test/` | Node 原生（`node:test`）无外部依赖的验证套件（见 §6）。 |

**过渡兼容**：`apps/pwa/**`、`apps/hostra/**` 与 `systems/loomrealm-smoke/**` 在本阶段
**全部保留不动**，仍由既有流程（含 `systems/loomrealm-smoke/test/smoke.test.mjs`）使用。
根目录入口与两份平台入口必须保持等价——这一约束由 `test/game-entry.test.mjs` 钉死
（三份 Game Entry 结构等价、两个根 manifest 与 Game Entry 的 key 集合精确一致）。
待根入口经后续 PWA Bundle 构建（阶段 4）验证后，将另开 Issue 删除 `apps/*` 旧入口。

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

## 3. Smoke Subsystem：单一实现 + 根绑定

Smoke 业务实现**只有一份**：`systems/loomrealm-smoke/subsystem.mjs`
（dependency-free、default 导出 `SubsystemDefinitionFactory`、每帧返回冻结的
`{ type: "completed", value: { status: "ok", subsystem: "smoke" } }`）。

根目录 `subsystems/smoke.mjs` 是安装根绑定（shim）：re-export
`../systems/loomrealm-smoke/subsystem.mjs`。因此：

- **Hostra / Node 消费者**（含 pinned `prepareHostraGame`，其
  `resolveInstallationModule` 只校验绑定文件本身位于安装根内）直接 import 该 shim，
  相对说明符在仓库 checkout 内解析成功。深层测试用仓库根作为真实安装根跑通
  `runMain` 至 completed Frame。
- **PWA 消费者**见 §4：该 shim 的**源码不得直接发布**为 PWA executable。

不复制、不重写 Smoke 业务实现；`apps/pwa/subsystems/smoke.mjs` 与
`apps/hostra/subsystems/smoke.mjs` 继续作为各自安装根的过渡绑定存在。

## 4. PWA 打包责任划分（阶段 4 前置约束）

pinned `buildPwaExecutableIndexV1`（`packages/game-launcher-pwa/src/index.ts`）对已发布
executable 的导入图有硬性约束：只接受相对导入，且整张导入图必须由发布集合本身满足——

- 边目标越出安装逻辑根 → `SUBSYSTEM_MODULE_OUTSIDE_INSTALLATION`
  （`apps/*` shim 的 `../../../…` 越界即属此类，既有 smoke 测试已钉死）；
- 边目标不在发布的 executable 集合内 → `SUBSYSTEM_MODULE_NOT_FOUND`
  （根 shim re-export 的 `systems/loomrealm-smoke/subsystem.mjs` 不属于 launch manifest
  声明的逻辑模块集合，因此**根 shim 单独发布必然被拒绝**，`test/game-entry.test.mjs`
  基础层镜像 + 深层真实 API 双重钉死）。

因此未来 Adventure Island 的 PWA Bundle（阶段 4，参照 Pokeman 的
`loomrealm/apps/pwa/src/installer.ts` 发布流程）为逻辑模块 `subsystems/smoke.mjs`
发布的 executable 必须是二者之一：

1. **无依赖共享实现**：`systems/loomrealm-smoke/subsystem.mjs` 源码本身（导入图为空，
   现阶段即满足，深层测试验证 `imports: []`）；或
2. **构建后的 self-contained bundle**：未来引入真实玩法/依赖时，先产出自包含、无 bare
   specifier、导入图完全落在安装逻辑根内的构建产物再发布（Pokeman 即以打包后的
   dependency-free 产物替代其含 `@loomrealm/*` 依赖的源码 `subsystems/*.mjs`）。

发布内容不得包含研究证据、原始 WZ、未授权素材与凭据。

## 5. Smoke Bundle（阶段 4A：通用 PWA Bundle 输入生成）

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
  "presentation": { "formatVersion": 1, "styles": [], "scripts": [{ "namespace": "Presentation", "key": "cms-actor/cms-actor.browser.js" }] },
  "executables": [
    { "logicalModule": "subsystems/smoke.mjs", "mime": "text/javascript",
      "source": "<systems/loomrealm-smoke/subsystem.mjs 原文>",
      "contentVersion": "sha256:<source 的 SHA-256>" }
  ],
  "content": [
    { "kind": "record", "namespace": "struct.ZMap", "key": "order",
      "mime": "application/json; charset=utf-8", "encoding": "base64", "body": "<canonical Base64>" }
    // ... 固定白名单共 24 项：1 个 classic IIFE、6 条 struct 记录、17 张合成 PNG
  ]
}
```

- **输入白名单（冻结）**：canonical 文档 `game.json`、`launch.pwa.json`、`presentation.json`；
  executable 仅来自 `EXECUTABLE_SOURCE_BINDINGS` 指定的 `systems/loomrealm-smoke/subsystem.mjs`；
  Content 仅来自 `CONTENT_SCRIPT_SOURCE_BINDINGS` 指定的 PR-A classic IIFE，以及
  `synthetic-avatar-content.mjs` 生成的合成记录和 PNG。无目录递归扫描；`research/**`、
  `.raw/**`、`.work/**`、`glm-work/**`、`task/**`、WZ/客户端、凭据均不在输入集合中。
- **executable 发布策略**：按 §4 为逻辑模块 `subsystems/smoke.mjs` 发布无依赖共享
  实现（导入图为空，Chrome 可直接加载）；生成器强制校验零 import/re-export 边、
  无 bare specifier、无非字面量动态 import、无 `process.*`/`require()`/`node:`
  引用，并重算 SHA-256 与 `contentVersion` 一致。根目录与 `apps/*` shim 作为
  executable 输入时被直接拒绝。
- **Content 发布策略（PR-B）**：固定发布 24 项，包含 `resource.Presentation/cms-actor/cms-actor.browser.js`、
  `struct.ZMap/order`、5 条 `struct.Look` 记录和 17 张确定性生成的 PNG。逐项校验 kind、namespace、key、MIME、
  canonical Base64 与身份唯一；Look canvas 的 `contentVersion` 必须等于对应 PNG 的 SHA-256，
  派生出的 `AvatarPlanV1` 必须通过组件模型校验，且 Presentation 引用必须解析到已发布的 resource。
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

当前产物：`executables` 1 项（`subsystems/smoke.mjs` ← `systems/loomrealm-smoke/subsystem.mjs`），
`content` 24 项（1 个 classic IIFE、6 条 struct 记录、17 张合成 PNG）；Bundle 由相同输入重复构建时字节一致。

### 阶段 4B：cms-actor 合成 Content 与 canonical PWA 闭环（PR-B）

`scripts/pwa/build-staging.mjs`（`npm run pwa:staging`）使用当前 Gitlink 固定的 LoomRealm
通用 PWA builder，生成 appId `adventure-island`、basePath `/pwa/adventure-island/`
的真实 staging 目录。构建前验证 Gitlink 与 checkout 一致、框架构建产物存在、输出路径
不越界；产物验证 generation、bundleId、payload 回显和运行时文件。

PR-B（[#49](https://github.com/lithdoo-labs/adventure-island/pull/49)）把 PR-A 的
`cms-actor` classic IIFE 注册到根 `presentation.json`，并将固定白名单中的 24 项
合成 Content 发布到安装 Bundle。正式 Game Entry 仍以 `smoke` 为初始 Subsystem；
测试专用 `avatar-fixture` 仅用于 E2E，不进入 canonical payload，也不改变
`game.json`、`launch.*.json` 或正式游戏启动路径。

真实 Chromium E2E 使用 canonical Bundle 的同一 Presentation 和 Content，仅将
Subsystem 替换为测试 fixture；再调用 pinned generic PWA builder、loopback staging
server、真实 Service Worker 和 Renderer Projector。测试覆盖：

- 通过真实 Content API 重新读取 `struct.ZMap` / `struct.Look` 记录；
- 像素级验证角色锚点、层序、透明区域，以及 `stand1`、`walk1`、`jump`；
- 错误 ContentVersion 与缺失资源均被拒绝、清空画布并报告可定位错误，随后可恢复；
- 元素断开时释放 Bitmap cache，重新投影后再次绘制；
- canonical Smoke PWA 仍能 settle，Service Worker scope 和 presentation bootstrap 正常。

`.github/workflows/pwa-ci.yml` 在本阶段加入组件构建产物检查、Node/Chromium 组件测试、
24 项 Content staging 断言，以及 Smoke + actor PWA E2E。必需的 Chromium / PWA E2E
不允许以 skip 作为成功；CI 检查 TAP 中 `# skipped 0`。

**边界**：这证明的是 synthetic Content 经正式 PWA / Service Worker / Renderer Projector
绘制角色，不代表真实 CMS079 资源导入、可玩地图、角色控制或生产部署已完成。

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

- (a) 根 `game.json` 与 `apps/pwa/game.json`、`apps/hostra/game.json` 三份 Game Entry
  结构等价，且均为最小 smoke 拓扑；
- (b) 根 PWA/Hostra manifest 与 Game Entry 的 subsystem key 集合精确一致，同一 key
  绑定同一逻辑模块；
- (c) 根 `subsystems/smoke.mjs` 的 default 与共享实现是**同一个** factory，且能执行
  completed Smoke Frame（不触碰任何 scope 能力）；
- (d) 根 manifest 的物理模块位于仓库安装根内（canonical 校验），且 re-export 目标
  realpaths 等于共享实现文件（无双份业务实现）；
- (e) “PWA 不允许直接发布越界 shim” 回归守卫：本地镜像 pinned
  `resolveRelativeModule` 规则 + 静态导入边分析，证明根 shim 的依赖不在发布集合内、
  共享实现导入图为空；深层用真实 `buildPwaExecutableIndexV1` 验证共享源可发布
  （`imports: []`）而根 shim 源被拒绝（`SUBSYSTEM_MODULE_NOT_FOUND`）；
- 深层：真实 pinned API 校验三份文档、`prepareHostraGame` 以仓库根为安装根解析出
  根绑定物理模块、`runMain` 启动至 completed Frame。

`test/presentation.test.mjs`：(f) 根 `presentation.json` 通过镜像规则与（深层）真实
`validateWebPresentationConfigV1` 校验，精确注册 cms-actor classic IIFE；镜像规则本身用一组
正/反例 fixture 校准。

`test/pwa-bundle.test.mjs`（阶段 4A / PR-B）：CLI 字节确定性（两次运行 + 自覆盖一致）；
payload schema 与精确来源（文本逐字节等于根文档、executable source 逐字节等于
共享实现且不是任何 shim、SHA-256 重算一致、24 项 Content 身份与顺序精确）；上游
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
- 阶段 4B（PR-B）：canonical PWA 的 cms-actor classic script、24 项 synthetic Content、
  真实 generic staging、Service Worker / Renderer Projector Chromium E2E 与独立 CI 已纳入
  本阶段交付；不包括真实 CMS079 素材接入。
- 阶段 5：独立 Compose（`loomrealm-adventure-pwa`）、端口 8788/8791 与回滚。
- 旧入口清理：根入口被阶段 4 验证后，另开 Issue 删除 `apps/pwa/**`、`apps/hostra/**`
  的重复 Game Entry 与平台 manifest（保留 `systems/loomrealm-smoke/**` 共享实现）。
