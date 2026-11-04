# 根目录统一 Game Entry（PWA 迁移阶段 3A）

> 适用范围：仓库根目录的 canonical Game Package 入口（`game.json`、`launch.pwa.json`、
> `launch.hostra.json`、`presentation.json`、`subsystems/`）。基线 LoomRealm submodule 固定在
> `c5217e47be5a43f974e9e6ce82230077fb639c39`，本入口不升级、不部署。
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
| `presentation.json` | Web Presentation Config V1（`styles: []`、`scripts: []`）。空应用不声明任何样式/脚本资源，不引用 Pokeman 或 CMS079 素材。 |
| `subsystems/smoke.mjs` | 根安装根的 Smoke Subsystem 绑定（见 §3）。 |
| `test/` | Node 原生（`node:test`）无外部依赖的验证套件（见 §5）。 |

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

## 5. 测试

全部为 Node 原生测试，无外部安装依赖（仅 `node:*` 内建模块）：

```bash
npm test                                                                                # 全部三套（根入口 + 既有 smoke）
node --test test/*.test.mjs                                                             # 仅根入口测试
node --test systems/loomrealm-smoke/test/smoke.test.mjs                                 # 既有 smoke 套件（无回归）
```

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
`validateWebPresentationConfigV1` 校验，且不声明任何资源；镜像规则本身用一组
正/反例 fixture 校准。

## 6. 后续（不在本阶段）

- 阶段 3B：合成地图 + 纸娃娃与移动/跳跃/立足线/传送。
- 阶段 4：升级并精确固定 LoomRealm gitlink、Adventure 自打包 executable/Content/
  Presentation 后用 LoomRealm 通用 PWA Bundle 构建（`--app-id adventure-island
  --base-path /pwa/adventure-island/`）与 Chromium E2E；届时按 §4 选择发布产物。
- 阶段 5：独立 Compose（`loomrealm-adventure-pwa`）、端口 8788/8791 与回滚。
- 旧入口清理：根入口被阶段 4 验证后，另开 Issue 删除 `apps/pwa/**`、`apps/hostra/**`
  的重复 Game Entry 与平台 manifest（保留 `systems/loomrealm-smoke/**` 共享实现）。
