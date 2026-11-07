# 根目录统一 Game Entry（PWA 迁移阶段 3A / 4B；Base → Adventure Map 切片）

> 适用范围：仓库根目录的 canonical Game Package 入口（`game.json`、`launch.pwa.json`、
> `launch.hostra.json`、`presentation.json`、`subsystems/`）。基线 LoomRealm submodule 固定在
> `93648192323bf5f57996b7b54cbae641d8a53fdb`，本入口不升级、不部署。
> 当前切片设计：[`docs/implementation/2026-11-06-base-adventure-map-actor-slice-draft.md`](./implementation/2026-11-06-base-adventure-map-actor-slice-draft.md)。

## 1. Canonical 源与过渡并存

自 Base → Adventure Map 切片（issue #62）起，canonical Game Entry 位于**仓库根目录**，
以 `base` 为初始 Subsystem，由其调用 `adventure-map`：

| 文件 | 角色 |
|---|---|
| `game.json` | 平台无关的 canonical Game Entry V1（`initial.subsystem=base`、`input=null`，无初始 Shared State；声明 `base` 与 `adventure-map`）。 |
| `launch.pwa.json` | PWA 平台 Launch manifest：`base`→`subsystems/base.mjs`、`adventure-map`→`subsystems/adventure-map.mjs`。 |
| `launch.hostra.json` | Hostra 平台 Launch manifest：与 PWA 完全相同的 key→module 绑定。 |
| `presentation.json` | Web Presentation Config V1（`styles: []`；`scripts` 依序注册两份 classic IIFE：`Presentation/controls/device-input.browser.js`（固定 gitlink 内构建的统一输入组件，先加载）与 `Presentation/cms-actor/cms-actor.browser.js`）。 |
| `subsystems/base.mjs` | 根安装根的 Base 绑定（薄 shim，见 §3）。 |
| `subsystems/adventure-map.mjs` | 根安装根的 Adventure Map 绑定（薄 shim，见 §3）。 |
| `systems/base/subsystem.mjs` | 唯一 Base 业务实现：持有单个 `game-controls-input` Controls Producer、`frame.call("adventure-map", frame.params)` 原样透传、`finally` 关闭输入域。 |
| `systems/adventure-map/subsystem.mjs` | 唯一 Adventure Map 业务实现：读取 `struct.AdventureAvatarPlan/bootstrap`、投影唯一 `cms-actor`、消费统一 Controls、居中/Resize、取消与失败清理。 |
| `scripts/pwa/` | 阶段 4A：installation-bundle v1 输入生成器（见 §5）。 |
| `test/` | Node 原生（`node:test`）验证套件（见 §6）。 |

**过渡兼容（legacy Smoke）**：`apps/pwa/**`、`apps/hostra/**` 与
`systems/loomrealm-smoke/**` 保留为**隔离的历史测试夹具**，仍由
`systems/loomrealm-smoke/test/smoke.test.mjs` 使用；它们**不再是正式应用入口**，
也不必与根入口相等（`test/game-entry.test.mjs` 已把 canonical `base` 与 legacy
Smoke 分离验证）。后续另开 Issue 清理。

## 2. 文档规则（与 pinned LoomRealm 对齐）

- `game.json` 遵循 `packages/game-package/src/validate.ts` 的 Game Entry V1 规则：
  精确的 `{ formatVersion, initial, subsystems }`（可选 `state`），`initial` 必须精确为
  `{ subsystem, input }` 且 `initial.subsystem` 必须在 `subsystems` 中声明。
- `launch.pwa.json` / `launch.hostra.json` 遵循 `parsePwaLaunchManifestV1` /
  `parseHostraLaunchManifest`：精确的 `{ formatVersion, subsystems }`，每条绑定为精确的
  `{ key, module }`；`module` 是不含 `..`、反斜杠、冒号的相对逻辑模块路径
  （如 `subsystems/base.mjs`），必须解析为安装根内的常规 `.mjs` 文件
  （`canonicalizeInstallationRoot` + `resolveInstallationModule`）。
- 两份 manifest 的 key 集合必须与 `game.json` 的 subsystem key 集合**双向一致**
  （`joinBindings`），且同一 key 在两份 manifest 中绑定同一逻辑模块。
- `presentation.json` 遵循 `packages/renderer/src/internal/web-presentation-config.ts`
  的 `validateWebPresentationConfigV1`：精确的 `{ formatVersion, scripts, styles }`，
  每个条目是精确的 `{ namespace, key }` Content 资源引用（namespace 不含层级、key 允许
  层级，均禁止遍历/协议/盘符），列表内不得重复。**脚本顺序即加载顺序**：Controls
  在前（Base 投影的 `game-controls-input` 需要它先注册），cms-actor 在后。

## 3. Base 与 Adventure Map：单一实现 + 根绑定

两份业务实现各只有一份，位于 `systems/`：

- **`systems/base/subsystem.mjs`（Base）**：创建**唯一** `game-controls-input`
  RenderDomain（`zIndex: 0`），`await frame.call("adventure-map", frame.params)`
  原样透传参数，子 Frame 结束/取消/失败时在 `finally` 中关闭输入域。Base 不监听
  DOM、不管理角色、不解释输入，也不同时挂载原始 `game-keyboard-input` /
  `game-gamepad-input`（避免同一次物理按键进入两套频道）。
- **`systems/adventure-map/subsystem.mjs`（Adventure Map）**：进入活跃 Frame 后
  （1）经真实 Content API 读取 `struct.AdventureAvatarPlan/bootstrap`（缺失/不可用
  → `ADVENTURE_AVATAR_CONTENT_UNAVAILABLE`，取消 → `cancelled()`，其他初始化异常
  → `ADVENTURE_MAP_INIT_FAILED`）；（2）创建唯一 `cms-actor` RenderDomain
  （初始 `locomotion=stand`、`facing=right`，`x/y` 为字符串并按 Viewport 居中，
  `y = round(height/2)+16` 为身体原点的暂定视觉偏移）；（3）用固定 LoomRealm 的
  `createControlsConsumer` + `createDirectionalControlsTracker` 消费统一 Controls，
  方向映射为演示策略：`null→stand`（保留朝向）、`left/right→walk`（并改朝向）、
  `up→jump`（保留朝向）、`down→stand`（保留朝向），松键恢复 `stand`，仅更新改变的
  字符串 attrs、不重发 AvatarPlan、不做任何世界位移；（4）投影错误经 Frame 内
  `applySafely` 故障门转为 `ADVENTURE_INPUT_PROJECTION_FAILED` /
  `ADVENTURE_VIEWPORT_PROJECTION_FAILED`（固定 Consumer 会吞掉回调异常，因此
  不能依赖 Consumer 上报）；（5）`Promise.race` 只竞争取消与首次致命错误，
  `finally` 无条件释放 Consumer、Viewport 订阅与 RenderDomain。

根目录 `subsystems/base.mjs`、`subsystems/adventure-map.mjs` 是安装根绑定（shim）：
re-export 对应 `systems/*` 实现。因此：

- **Hostra / Node 消费者**（含 pinned `prepareHostraGame`）直接 import shim，
  相对说明符在仓库 checkout 内解析成功（深层测试用仓库根作为真实安装根验证
  `prepareHostraGame` 的双 runtime 解析）。
- **PWA 消费者**见 §4：shim 与未打包的 `systems/*` 源码都**不得直接发布**为
  executable；发布的是 esbuild 自包含 bundle。

## 4. PWA 打包责任划分（阶段 4 前置约束）

pinned `buildPwaExecutableIndexV1`（`packages/game-launcher-pwa/src/index.ts`）对已发布
executable 的导入图有硬性约束：只接受相对导入，且整张导入图必须由发布集合本身满足——

- 边目标越出安装逻辑根 → `SUBSYSTEM_MODULE_OUTSIDE_INSTALLATION`
  （`apps/*` shim 的 `../../../…` 越界即属此类，既有 smoke 测试已钉死）；
- 边目标不在发布的 executable 集合内 → `SUBSYSTEM_MODULE_NOT_FOUND`；
- bare 包说明符（如 `@loomrealm/subsystem`）→ `SUBSYSTEM_MODULE_GRAPH_INVALID`。

Base / Adventure Map 源码合法地依赖 pinned 框架包（`@loomrealm/subsystem`、
`@loomrealm-game/common-controls/subsystem`），因此**发布产物必须是自包含 bundle**：
`scripts/pwa/build-installation-bundle.mjs` 为每个逻辑模块用根工作区 esbuild
（`absWorkingDir` = 游戏根、`bundle`、ESM、browser、`chrome140`、`write:false`）
从冻结绑定的 `systems/{base,adventure-map}/subsystem.mjs` 编译出**零外部导入**的
executable，再按最终输出字节计算 SHA-256 与 `contentVersion`。安装根 shim
（`subsystems/*.mjs`）与 `apps/*` shim 作为输入被直接拒绝（相对路径必须位于
`systems/` 下）。

发布内容不得包含研究证据、原始 WZ、未授权素材与凭据。

## 5. 产品 Bundle（阶段 4A + issue #62：通用 PWA Bundle 输入生成）

`scripts/pwa/build-installation-bundle.mjs` 从 §1–§2 的 canonical 根目录输入生成
**installation-bundle v1 payload**——即 LoomRealm 通用 PWA 构建器（固定版本
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
      "source": "<systems/base/subsystem.mjs 的 esbuild 自包含 bundle>",
      "contentVersion": "sha256:<bundle 输出的 SHA-256>" }
    // ... subsystems/adventure-map.mjs 同理
  ],
  "content": [
    // 只读 FSDB 闭包 + 派生 Plan Record + 两份 classic script（见下）
  ]
}
```

- **输入白名单（冻结）**：canonical 文档 `game.json`、`launch.pwa.json`、`presentation.json`；
  executable 仅来自 `EXECUTABLE_SOURCE_BINDINGS` 指定的
  `systems/base/subsystem.mjs` 与 `systems/adventure-map/subsystem.mjs`（esbuild
  bundle）；Content script 仅来自 `CONTENT_SCRIPT_SOURCE_BINDINGS` 指定的两份
  classic IIFE（Controls 来自固定 gitlink 内构建的
  `loom-realm/game-libs/game-common-controls/dist/browser/device-input.browser.js`，
  Actor 来自 `components/cms-actor/browser/cms-actor.browser.js`）；Avatar 素材仅来自
  `scripts/pwa/read-adventure-fsdb.mjs` 读取的 `content/[FSDB]adventure` 固定单角色
  闭包。无目录递归扫描；`research/**`、`.raw/**`、`.work/**`、`glm-work/**`、
  `task/**`、WZ/客户端、凭据均不在输入集合中。
- **executable 发布策略**：按 §4 为两个逻辑模块发布自包含 esbuild bundle（零导入
  边、Chrome 可直接加载）；生成器强制校验零 import/re-export 边、无 bare specifier、
  无非字面量动态 import、无 `process.*`/`require()`/`node:` 引用，并按最终输出字节
  重算 SHA-256 与 `contentVersion`。根目录与 `apps/*` shim、以及任何不在 `systems/`
  下的相对输入都被直接拒绝。
- **Content 发布策略（issue #62）**：只读发布现有 `content/[FSDB]adventure` 的单角色
  闭包（body `00002000`、head `00012000`、face `00020100`、hair `00030000`、
  `expression:"default"`）——4 条 `struct.avatar.Part` 记录、8 个
  `group.avatar.PartFrame/Resource` 组、共享 DrawOrder/LayerSlot 记录、被引用的 PNG
  atlas 页，外加由正式 `buildAdventureAvatarPlan()` 派生的
  `record/struct.AdventureAvatarPlan/bootstrap`（Plan 本体，≤262144 字节）与两份
  classic script。所有字节原样发布（JSON/JSONL/PNG 不重排序、不重序列化），
  `contentVersion` 统一为发布字节的 `sha256:<64 hex>`。构建器再从**最终发布 entries**
  重新解码 Plan 与被引用 PNG，核对每个 `resource.namespace/key/contentVersion` 与实际
  SHA-256 一致；资源缺失、版本矛盾或格式错误直接失败。当前产物规模：2 个
  executable、2 份 script、19 项 FSDB/Plan Content（共 21 项）。
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
  检出的 submodule HEAD 与之完全相等（须为真正的 submodule checkout）；脚本内不
  硬编码 SHA——维护者经 PR 更新 Gitlink 后无需改脚本，当日 main 上仍等效校验
  `93648192323bf5f57996b7b54cbae641d8a53fdb`（可用 `verifyGitlink: false` 关闭，
  仅供测试注入；非匹配/未检出 submodule 的负例测试见 `test/pwa-bundle.test.mjs`）。
- **双工作区安装**：根 `package.json` 以 `workspaces: ["loom-realm/packages/*",
  "loom-realm/game-libs/*"]` 使固定 gitlink 内的 `@loomrealm/subsystem` 与
  `@loomrealm-game/common-controls` 成为产品根工作区可解析的本地依赖（根
  `package-lock.json` 提交）；固定 submodule 自己的 `loom-realm/package-lock.json`
  原样保留，两份 lockfile 职责不同。CI 顺序：根 `npm ci` → submodule
  `npm ci --prefix loom-realm` → `npm run build:game-common-controls-input --prefix
  loom-realm`（产出 Controls IIFE）→ `npm run pwa:bundle` → 通用构建器 → staging。

用法：

```bash
npm ci --no-audit --no-fund                       # 根工作区（esbuild + 框架 workspace 链接）
npm ci --prefix loom-realm --no-audit --no-fund   # 固定 submodule 工具链
npm run build:game-common-controls-input --prefix loom-realm
npm run pwa:bundle
# 等价于
node scripts/pwa/build-installation-bundle.mjs --output dist/adventure-island-installation-bundle.json
```

当前产物：`executables` 2 项（`subsystems/base.mjs`、`subsystems/adventure-map.mjs`
← 对应 `systems/*` 的 esbuild 自包含 bundle），`content` 21 项（2 个 classic IIFE、
4 条 Part 记录、2 条 DrawOrder/LayerSlot 记录、8 个 PartFrame/Resource 组、4 张 PNG
atlas、1 条派生 bootstrap Plan 记录）；Bundle 由相同输入重复构建时字节一致。

### 阶段 4B：staging 与真实 PWA 闭环

`scripts/pwa/build-staging.mjs`（`npm run pwa:staging`）使用当前 Gitlink 固定的 LoomRealm
通用 PWA builder，生成 appId `adventure-island`、basePath `/pwa/adventure-island/`
的真实 staging 目录。构建前验证 Gitlink 与 checkout 一致、框架构建产物存在、输出路径
不越界；产物验证 generation、bundleId、payload 回显和运行时文件。

issue #62 起 canonical PWA 即为正式 Base → Map → Actor 闭环：真实 Chromium E2E
（`test/pwa-browser.e2e.test.mjs` canonical 场景）经真实 Service Worker 验证：

- 产品进入**active `ready`**（Map Frame 保持活跃，不沿用 Smoke 时代的 `settled`）；
- 唯一 `game-controls-input` 与唯一 `cms-actor` 被投影，Actor 由现有 FSDB 闭包加载并
  画出非透明像素；
- 可信键盘输入（Playwright `page.keyboard.down/up`，非合成 DOM KeyboardEvent）驱动
  左右 walk/朝向、up jump、down stand、松键恢复 stand（保留朝向）；
- Viewport resize 后 Actor 仍唯一并按 `x=round(w/2)`、`y=round(h/2)+16` 居中。

`.github/workflows/pwa-ci.yml` 已预置：根锁文件存在时根 `npm ci`、Presentation 声明
Controls 时预构建 Controls IIFE、`base` 初始 Subsystem 时的 bootstrap Plan staging
断言、以及 canonical PWA E2E 的 `# fail 0` / `# skipped 0` 门禁。

**边界**：这证明的是现有 FSDB 单角色经正式链路运行与操控，不代表世界移动/物理、
真实地图、Hostra 实机安装或生产部署已完成。Hostra 逻辑绑定（`launch.hostra.json`）
保持一致，其实机验收单独报告 PASS/BLOCKED；实机手柄 D-pad 未实测时标记
DEVICE UNVERIFIED，不阻塞 PWA 验收。

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

- (a) 根 `game.json` 为 canonical `base` → `adventure-map` 入口；
  `apps/pwa/game.json`、`apps/hostra/game.json` 保持 legacy smoke 夹具（二者分离验证）；
- (b) 根 PWA/Hostra manifest 与 Game Entry 的 subsystem key 集合精确一致，同一 key
  绑定同一逻辑模块；
- (c) 根 `subsystems/base.mjs` / `subsystems/adventure-map.mjs` 的 default 与共享实现是
  **同一个** factory；Base 绑定执行"唯一 Producer → 参数原样透传 → finally 关闭"
  契约，且不触碰其他 scope 能力；
- (d) 根 manifest 的物理模块位于仓库安装根内（canonical 校验），且 re-export 目标
  realpaths 等于对应 `systems/*` 实现文件（无双份业务实现）；
- (e) "PWA 不允许直接发布越界 shim / 未打包源码" 回归守卫：本地镜像 pinned
  `resolveRelativeModule` 规则 + 静态导入边分析，证明根 shim 的依赖不在发布集合内、
  `systems/*` 源码只依赖固定框架 bare specifier（不可直接发布，发布物是 esbuild
  bundle）；深层用真实 `buildPwaExecutableIndexV1` 验证裸源与 shim 均被拒绝；
- 深层：真实 pinned API 校验三份文档、`prepareHostraGame` 以仓库根为安装根解析出
  双 runtime 的根 shim 物理模块。（Smoke 时代的 `runMain` boot-to-completed 用例已
  移除：Map Frame 设计上保持活跃至取消，其生命周期由 `test/adventure-runtime.test.mjs`
  与真实 PWA E2E 钉死。）

`test/presentation.test.mjs`：(f) 根 `presentation.json` 通过镜像规则与（深层）真实
`validateWebPresentationConfigV1` 校验，依序精确注册 Controls 与 cms-actor 两份
classic 脚本；镜像规则本身用一组正/反例 fixture 校准。

`test/adventure-runtime.test.mjs`（issue #62 新增，T1–T3）：T1 Base 生命周期（参数
透传、唯一 Producer、结束/取消/失败释放）；T2 Map 动作映射（真实固定 Controls
Consumer + Tracker 驱动左右 walk/朝向、up jump、down stand、松键恢复、同值不重投影、
held-order 语义、Viewport 居中与无效视口不更新）；T3 失败与取消（Content 不可用、
取消、同步投影故障、初始化异常映射为稳定失败码，且 Consumer/Viewport/RenderDomain
全部释放）。

`test/pwa-bundle.test.mjs`（阶段 4A / issue #62）：CLI 字节确定性（两次运行 + 自覆盖
一致）；payload schema 与精确来源（文本逐字节等于根文档、executable 为 esbuild
bundle 且不是任何 shim/裸源、SHA-256 重算一致、Content 身份与顺序精确）；上游
`validatePwaBundlePayload`（自 `9364819` 逐字 vendored，正/反例校准）接受产物；
manifest/Game Entry 键集合往返一致；shim、bare import、非字面量动态 import、
Node-only 全局作为 executable 被拒绝；**T4 FSDB → Bundle round-trip**（从最终 Bundle
重新解码 Plan 与被引用 PNG，校验唯一身份、SHA-256、引用与 Plan 字节上限）；篡改
Content（版本矛盾、缺失 PNG、移除 Plan 记录、损坏 JSONL）被拒绝；非法 CLI 参数、
受保护/追踪路径、目录目标、坏输入文档在写出前被拒绝且零写出；产物不含任何
research/敏感标识（并对生成器输入白名单做结构校验）；**输出路径安全**（隔离的模拟
项目根 + `research/keep.txt` sentinel，不触碰真实 `research/**`）：无 `dist/` 的干净根
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

`test/pwa-browser.e2e.test.mjs`：canonical 场景为 Base → Map → Actor 的 T5 E2E（见
§5 阶段 4B）；同文件保留隔离的历史 synthetic Actor fixture 场景（版本冲突、缺失资源、
断开重连等，不参与 canonical 链路）。

## 7. 后续阶段

- 阶段 3B：合成地图 + 纸娃娃与移动/跳跃/立足线/传送（世界权威归属未来的独立
  Game Library/Subsystem，不复用本切片的演示映射）。
- 阶段 4A（已完成）：`scripts/pwa/build-installation-bundle.mjs` 生成
  installation-bundle v1 输入（见 §5）。
- 阶段 4B：canonical PWA 闭环；issue #62 起接入现有 FSDB 单角色与真实输入链路。
- Hostra 实机验收：`launch.hostra.json` 逻辑绑定一致，实机安装证据单独报告。
- 阶段 5：独立 Compose（`loomrealm-adventure-pwa`）、端口 8788/8791 与回滚。
- 旧入口清理：另开 Issue 删除 `apps/pwa/**`、`apps/hostra/**` 的重复 Game Entry
  与平台 manifest（保留 `systems/loomrealm-smoke/**` 共享实现作为隔离夹具）。
