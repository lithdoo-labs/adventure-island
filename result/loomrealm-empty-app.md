# LoomRealm empty application scaffold

> 任务：Issue #35，以最小可运行的空应用接入 LoomRealm 平台，为后续 CMS079 人物、地图、移动及双场景跳转打底。
> 基线：`loom-realm` submodule 固定在 `c5217e47be5a43f974e9e6ce82230077fb639c39`（与当前 `main` 的 gitlink 精确一致）。
> 本文件记录脚手架结构、对固定版本 LoomRealm API 的逐一校验、对 PokeMan 先例的取舍、实测验证结果与后续任务的扩展方式。

## 0. 与历史实现（PR #23，分支 `agent/pr-18`）的复核结论

PR #23 分支 `agent/pr-18` 已通过只读方式取回（`git fetch --no-tags origin refs/heads/agent/pr-18:refs/remotes/origin/agent/pr-18`，仅 `git show` 比较，未推送/修改/合并该分支）。其 gitlink 同样指向 `c5217e47…`，与当前 `main` 固定版本一致，因此其针对 LoomRealm API 的判断不存在「旧版本引用」问题。本次交付逐文件复核其 13 个文件并复用：

| 文件 | 本次处理 |
|---|---|
| `apps/pwa/game.json`、`apps/hostra/game.json` | 逐字节复用（两文件相同） |
| `apps/pwa/launch.pwa.json`、`apps/hostra/launch.hostra.json` | 逐字节复用 |
| `apps/pwa/subsystems/smoke.mjs`、`apps/hostra/subsystems/smoke.mjs` | 代码行逐字节复用；仅扩充注释，写明 PWA 发布契约（见 §1.1） |
| `systems/loomrealm-smoke/subsystem.mjs` | 代码逐字节复用；仅扩充注释 |
| `systems/loomrealm-smoke/package.json` | 逐字节复用 |
| `systems/loomrealm-smoke/test/smoke.test.mjs` | 复用全部 9 个用例，新增一条深层断言（负向守卫，见 §1.1） |
| `systems/loomrealm-smoke/README.md`、`apps/pwa/README.md`、`apps/hostra/README.md` | 复用并补充 PWA 发布契约说明 |
| `result/loomrealm-empty-app.md` | 即本文件，按本次实测重写 |

## 1. 创建的脚手架

```text
apps/pwa/                      PWA 平台入口（安装根目录，installation root）
  game.json                    Game Entry V1：声明唯一子系统 smoke，initial.input = null
  launch.pwa.json              PWA launch composition：smoke → subsystems/smoke.mjs
  subsystems/smoke.mjs         安装根内的绑定 shim，再导出共享实现
  README.md
apps/hostra/                   Hostra 平台入口（安装根目录，同一空应用）
  game.json                    与 apps/pwa/game.json 完全相同
  launch.hostra.json           Hostra launch composition：smoke → subsystems/smoke.mjs
  subsystems/smoke.mjs         安装根内的绑定 shim，再导出共享实现
  README.md
systems/loomrealm-smoke/       共享无操作（no-op）smoke 子系统 + 冒烟验证套件
  subsystem.mjs                依赖无关的子系统实现（default 导出 SubsystemDefinitionFactory）
  test/smoke.test.mjs          无头冒烟验证（node --test）
  package.json                 仅暴露 npm test 入口，无任何依赖
  README.md
result/loomrealm-empty-app.md  本文件
```

两个平台入口是**同一个空测试应用**：Game Entry 逐字节同构（同一 JSON 文档），绑定同一个子系统键
`smoke`，两个 shim 再导出同一份 `systems/loomrealm-smoke/subsystem.mjs`（测试用 realpath 断言两处
shim 解析到同一物理文件，且两个 shim 的 default 导出与共享模块的 default 是同一函数对象）。

### 最小拓扑的依据（逐一对当前固定版本源码校验）

最小拓扑不是从 PokeMan 抄来的，而是由固定版本 LoomRealm 的现行 API 决定的：

- `packages/game-package/src/validate.ts`：`formatVersion`、`initial`（含 `subsystem` 与任意 JSON
  `input`，`null` 合法）、`subsystems` 为必填；`initial.subsystem` 必须在 `subsystems` 中声明；
  `state` 可省略。
- `packages/game-launcher-hostra/src/manifest.ts` 与 `packages/game-launcher-pwa/src/index.ts`：
  launch composition 为 `{ formatVersion: 1, subsystems: [{ key, module }] }`；module 必须是位于
  安装根内的 `.mjs` 相对路径（段满足 `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`，无 `\`、无 `:`、无
  `..`/`.`/空段）。
- `packages/game-launcher-hostra/src/launch-plan.ts`（`joinBindings`）：Game Entry 与 launch
  manifest 的子系统键集合必须双向一致。
- `packages/game-launcher-hostra/src/module-resolver.ts`（`resolveInstallationModule`）：绑定的
  模块文件本身（realpath 后）必须位于安装根内且以 `.mjs` 结尾；对文件内容不设额外检查。
- `packages/game-launcher-hostra/test/e2e.test.mjs`：固定版本自己的端到端测试以
  `initial: { subsystem: "root", input: null }` + 单子系统 + 无 `state` 的安装根跑通真实
  Main + Hostra 启动，子系统模块是**不含任何 import 的普通 .mjs**（default 导出工厂，frame 返回
  `{ type: "completed", value }`）。本脚手架照此采用「一个子系统 + null 输入 + 无 state」的最小拓扑。
- `packages/game-launcher-pwa/src/index.ts`（`buildPwaExecutableIndexV1` / `resolveRelativeModule`）：
  PWA 可执行模块的 ESM 图只允许**留在安装逻辑根内**的相对导入（从逻辑根向上逃逸的 `../..` 会被
  `SUBSYSTEM_MODULE_OUTSIDE_INSTALLATION` 拒绝），更不允许裸 `@loomrealm/*` 导入。

### 1.1 安装根 shim 与 PWA executable 约束

`apps/pwa/subsystems/smoke.mjs` 与 `apps/hostra/subsystems/smoke.mjs` 都以
`export * from "../../../systems/loomrealm-smoke/subsystem.mjs"` 指向同一份共享实现：

- **Hostra / 仓库内 Node 链路**：shim 文件本身位于安装根内，满足 `resolveInstallationModule`；
  运行时由 Node 按物理路径解析 `../../../`，落到仓库根的 `systems/loomrealm-smoke/subsystem.mjs`。
  本次实测（§4 深层第 3 项）真实 Main + Hostra 启动走通的正是这条链。
- **PWA 发布链路**：PWA executable 图按**逻辑模块**解析导入，`subsystems/smoke.mjs` 的任何
  `../..` 逃逸都会被固定版本拒绝——因此 shim 自己的源码**不是**被发布的 executable。发布给逻辑模块
  `subsystems/smoke.mjs` 的可执行文件是依赖无关的共享实现本身（导入图为空，`imports: []`），这与
  PokeMan 的做法同构：`examples/PokeMan` 的 PWA 发布（`apps/pwa/scripts/build.mjs` +
  `scripts/prepare-pwa-content.mjs`）用 esbuild 打包出的无依赖产物替代仓库源文件，而非直接发布
  `examples/PokeMan/subsystems/*.mjs`。
- **守卫测试**：深层用例在真实 SDK 下双向 pin 住该契约——正向断言共享实现源码通过
  `buildPwaExecutableIndexV1` 且 `imports: []`；负向断言把 shim 源码直接作为 executable 发布会以
  `SUBSYSTEM_MODULE_OUTSIDE_INSTALLATION` 失败。这样未来接 PWA 发布链的人不会误把 shim 当
  executable 发布而只在运行期才暴露。

### 子系统为何依赖无关

`systems/loomrealm-smoke/subsystem.mjs` 不 import `@loomrealm/subsystem`，而是内联保持同一 ABI：
default 导出 `(scope) => ({ frame() })` 工厂，`frame` 返回与 `completed()` 同形的冻结
`{ type: "completed", value }`。理由：

1. 仓库根目录没有 npm workspace，裸 `@loomrealm/*` 只能在 submodule 构建并安装后解析；
2. 冒烟验证必须在裸 checkout 上确定性地通过（不联网、不构建 submodule、不改动 submodule）；
3. 固定版本的 Hostra e2e 与 PWA executable 规则都以上述「无依赖 .mjs」为合法形态。

当 submodule 已构建时，测试用真实 SDK 交叉验证：`defineSubsystem` 接受该工厂并原样返回，
`completed()` 与本模块的 Frame 输出深度相等（本次已实测通过，见 §4）。

## 2. 有意复用的 PokeMan 约定

| 约定 | 来源 | 复用方式 |
|---|---|---|
| 安装根内三件套 `game.json` + launch manifest + `subsystems/*.mjs` 目录 | `examples/PokeMan/` 目录布局 | `apps/pwa`、`apps/hostra` 各自成为自包含安装根 |
| Game Entry V1 文档形状（`formatVersion: 1`、`initial`、`subsystems: [{ key }]`） | `examples/PokeMan/game.json` | 同 schema，仅一个子系统 |
| launch composition 形状（`{ formatVersion: 1, subsystems: [{ key, module }] }`，module 为安装根内相对路径） | `examples/PokeMan/launch.pwa.json` / `launch.hostra.json` | 同 schema，仅一个绑定 |
| 逻辑模块路径命名 `subsystems/<key>.mjs` | PokeMan 的 `subsystems/base.mjs` 等 | `subsystems/smoke.mjs` |
| 「PWA 与 Hostra 描述同一逻辑拓扑」的双平台一致性 | PokeMan 两个 launch manifest 同子系统集合 | 两入口共享同一 Game Entry 与同一实现 |
| 无操作子系统的 `frame → completed({ status, subsystem })` 模式 | `examples/PokeMan/subsystems/_empty.mjs` | `SMOKE_FRAME_VALUE = { status: "ok", subsystem: "smoke" }` |
| 无头冒烟测试写法（node:test + 读取安装根 JSON + 校验 manifest 绑定一致性） | `examples/PokeMan/test/map-smoke.test.mjs`、`test/pwa-content.test.mjs` | `test/smoke.test.mjs` 的基础层 |
| PWA 发布以无依赖产物替代仓库源文件 | `apps/pwa/scripts/build.mjs`（esbuild 打包） | 共享实现本身即无依赖 executable，无需打包（§1.1） |

## 3. 有意省略的 PokeMan / 游戏专用内容

- 不复制 `base + map + dialogue` 拓扑：那是 PokeMan 的产品私有拓扑。空应用只需要一个子系统。
- 不复制任何地图/对话/战斗逻辑：无 `@loomrealm-game/map`、`rpg-dialogue`、`common-controls` 依赖。
- 不含 FSDB Content：没有 `[FSDB]PokeMan/` 类目录、没有 `presentation.json`/`presentation.css`、
  没有 Presentation styles/scripts 引用。
- 不含 PokeMan 的初始输入语义（`mapId/x/y/characterName`）：`initial.input` 为 `null`。
- 不含 `initial.state`（Shared State 初始记录）：空应用不持有任何持久产品状态。
- 不含 `play.bat`、Windows 启动器、presentation 同步脚本、esbuild 打包流水：均服务于 PokeMan 的
  真实内容，空应用用无头验证代替。
- 不含任何 CMS 079 客户端数据：本任务与 `F:\CMS079` 完全无关，验证不读取任何本地专有数据。
- 不含任何非目标玩法（DESIGN.md §6 之外）：无人物移动/跳跃、无立足线、无传送门、无纸娃娃渲染、
  无怪物/技能/任务、无登录协议、无多人；双场景跳转留给下一项开发任务。

## 4. 冒烟验证命令与实测结果

首选单一命令（在仓库根目录执行）：

```bash
git -C loom-realm rev-parse HEAD
npm test --prefix systems/loomrealm-smoke
```

（`npm test --prefix` 与 `node --test systems/loomrealm-smoke/test/smoke.test.mjs` 完全等价。）

### 实测一：裸 checkout（submodule 未构建）

```text
$ git -C loom-realm rev-parse HEAD
c5217e47be5a43f974e9e6ce82230077fb639c39
$ npm test --prefix systems/loomrealm-smoke
# tests 9  pass 6  fail 0  skipped 3
```

3 个 skip 均为深层用例，skip 原因在输出中明示
`loom-realm packages are not built; run npm install && npm run build:packages inside loom-realm/ to enable deep validation`。
**skip 不是 pass**：裸 checkout 只验证基础层 6 项，深层 API 校验与真实启动在该状态下属于未执行。

### 实测二：submodule 就地构建后（本次实际执行）

为完成「具备构建后的 LoomRealm SDK 时执行真实 API 校验和 Hostra 启动验证」，本次在 `loom-realm/`
内执行了 `npm ci` + `npm run build:packages`（产物均为 submodule 内 gitignore 的 `node_modules/`、
`dist/`，构建前后 `git -C loom-realm status --porcelain` 均为空，未改动任何被跟踪文件、未升级
submodule 指针），随后重跑同一命令：

```text
$ npm test --prefix systems/loomrealm-smoke
# tests 9  pass 9  fail 0  skipped 0
```

### 用例清单与覆盖

基础层（始终运行，确定性、无网络、无浏览器、无 CMS 数据、不构建/不改动 submodule）：

1. 两个平台入口的 `game.json` 按 Game Entry V1 结构校验，且为同一最小文档（唯一子系统 `smoke`、
   `input: null`、无 `state`）；
2. `launch.pwa.json` / `launch.hostra.json` 按 launch composition 规则解析，绑定与 Game Entry
   双向一致（`joinBindings` 语义），逻辑模块按 `resolveInstallationModule` 语义解析到安装根内
   真实 `.mjs` 文件，shim 再导出链 realpath 解析到共享实现；
3. no-op 子系统可导入、可构造、`frame` 返回冻结的 completed 结果且逐帧确定，不触碰任何 scope
   能力（state/events/content/viewport/presentationEvents/createRenderDomain 全部设为抛错探针）、
   不调用其它子系统；两个 shim 的 default 导出与共享模块是同一函数；
4. 固定版本 PokeMan 参考文件仍满足同一套结构规则（校验器对参考实现的回验）；
5. 脚手架依赖的固定版本 loom-realm API 源文件都在 checkout 的 submodule 中存在；
6. （结构校验器本身随用例 1–4 间接验证。）

深层增强（同一命令自动启用，条件是 submodule 已就地构建）：

7. 真实 `parseGameEntryV1` / `parsePwaLaunchManifestV1` / `parseHostraLaunchManifest` 校验全部文档；
   真实 `prepareHostraGame` 解析 `apps/hostra` 安装根（含物理模块解析与运行时预检）；
   `buildPwaExecutableIndexV1` 正向证明共享实现源码是合法 PWA executable（`imports: []`）、
   负向证明 shim 源码直接发布会被 `SUBSYSTEM_MODULE_OUTSIDE_INSTALLATION` 拒绝（§1.1 守卫）；
8. 真实 `@loomrealm/subsystem` SDK 与无依赖 ABI 交叉验证（`defineSubsystem` 恒等、`completed()`
   深度相等）；
9. 真实 Main + Hostra 托管启动空应用直到初始 Frame 完成（`prepareHostraGame` + `runMain`，结果
   `root-outcome: completed { status: "ok", subsystem: "smoke" }`）。

### 关于 submodule 自带的测试

固定版本的 PokeMan 测试（如 `node --test examples/PokeMan/test/map-smoke.test.mjs`）需要 workspace
内解析 `@loomrealm/*` 与 `@loomrealm-game/*`；即使本次已 `npm ci`，`@loomrealm-game/*` 仍需额外
构建步骤，且这些测试验证的是 PokeMan 自身而非本脚手架，故未纳入本次验证范围（上表基础层即为
替代的无头验证）。

## 5. 后续 CMS 任务如何扩展

1. **新增真实子系统**：在 `systems/` 下新建目录（如 `systems/cms-map/`），实现
   `SubsystemDefinitionFactory`；后续需要 SDK 时可直接 import `@loomrealm/subsystem`（代价是该
   子系统的验证需要已构建的 submodule；发布为 PWA executable 时需打包为无依赖产物，参照 PokeMan
   的 esbuild 产物约束）。
2. **接入拓扑**：向 `apps/pwa/game.json` 与 `apps/hostra/game.json` 的 `subsystems` 增加键、
   `initial` 改指向新入口子系统并在 `launch.pwa.json` / `launch.hostra.json` 增加对应绑定与
   安装根 shim；两入口继续保持同一 Game Entry。
3. **引入状态**：需要会话事实时给 Game Entry 增加 `state.records`（Shared State 初始记录），并让
   子系统通过 `scope.state` 访问——权威模型按 DESIGN.md 归 Shared State。
4. **引入内容**：需要地图/怪物/物品定义时按 `content/DESIGN.md` 的 FSDB 方案接入 Content，子系统
   经 `scope.content` 读取；合成夹具进仓库，真实 079 客户端内容只在使用者本地打包时进入。
5. **冒烟套件保持有效**：`test/smoke.test.mjs` 的结构校验器已兼容多子系统与 `state` 段；扩展后
   只需更新 `EXPECTED_*` 常量或为其增加独立用例。`systems/loomrealm-smoke` 本身可长期保留，
   作为「空拓扑」回归基线与后续子系统的冒烟模板。
6. **平台差异**：PWA 侧将来接 `loom-realm/apps/pwa` 的安装发布链（executable index + Content），
   发布产物按 §1.1 使用共享实现（或其打包产物）；Hostra 侧保持 `prepareHostraGame` 直接可启动。
   `apps/*/subsystems/*.mjs` shim 是两条链共同的安装根锚点。

## 6. 边界确认

- 仅修改允许路径：`apps/pwa/**`、`apps/hostra/**`、`systems/loomrealm-smoke/**`、
  `result/loomrealm-empty-app.md`；未触碰 `loom-realm/**` 被跟踪文件、Git Submodule 指针、
  `.github/**`、`scripts/**`、`task/**`、`components/**`、`libs/**`、其余 `systems/**`。
- submodule 内的 `npm ci` + `npm run build:packages` 只产生 gitignore 的构建产物，用于本次深层
  验证；`git -C loom-realm status --porcelain` 构建前后均为空。
- 未新增 WZ、客户端二进制、档案、凭据或任何专有输入；未读取 `F:\CMS079`；验证全程无浏览器、
  无外部网络服务（构建期的 npm registry 访问除外）。
- 历史分支 `agent/pr-18` 仅作只读比较，未推送、未修改、未重开 PR #23。
