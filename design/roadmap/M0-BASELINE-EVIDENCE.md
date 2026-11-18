# M0 可复现开发基线证据

> **状态：本机实施记录 / NOT APPROVED。**
> 记录 2026-11-18 在 Windows 分支 `feat/m0-m1-runtime-rendering-spike` 上实际执行的命令和结果。本文不批准路线图、组件 ABI 或阶段范围。

## 环境

- 分支：`feat/m0-m1-runtime-rendering-spike`
- 根提交：`7b364891d4a6dd1874d2a193da3cab1f1a325583`
- Node：`v24.19.0`
- npm：`11.17.0`（PowerShell 使用 `npm.cmd`）
- 操作系统：Windows 10.0.26300

## Gitlink

```text
git rev-parse HEAD:loom-realm
93648192323bf5f57996b7b54cbae641d8a53fdb

git -C loom-realm rev-parse HEAD
93648192323bf5f57996b7b54cbae641d8a53fdb
```

两条结果一致。随后的安装、构建和测试没有修改 Gitlink。`git -C loom-realm status --short` 为空，没有向 submodule 写入游戏代码，也没有留下已跟踪文件的改动。

## 锁定依赖

```powershell
git submodule update --init
npm.cmd ci --no-audit --no-fund
npm.cmd ci --prefix loom-realm --no-audit --no-fund
```

退出码 0。根仓库 `added 63 packages in 51s`。LoomRealm `added 207 packages in 1m`。

npm 11 的 `allow-scripts` 没有覆盖 esbuild postinstall，因此打印了警告：根仓库 `esbuild@0.25.9`，LoomRealm 中五份 `esbuild@0.25.9` 和一份 `esbuild@0.21.5`。另外有 `node-domexception@1.0.0` 的 deprecated 警告。没有执行 `npm approve-scripts`。诊断后两条导入都成功：

```text
root esbuild 0.25.9
loom-realm esbuild 0.21.5
```

后续 common-controls 浏览器构建和 generic PWA staging 都使用了这些 esbuild，并成功完成。

## 构建

路线图候选命令里的 `npm.cmd --prefix loom-realm run build:packages` 对应 `npm run build --workspaces --if-present`。本次没有使用它。CI（`.github/workflows/pwa-ci.yml`）明确不使用那条宽构建：`build:game-common-controls-input` 会在 `game-package` 与 Hostra 编译前构建 desktop/PWA，干净检出上会失败。本次按 CI 的有序 workspace 构建，并补上根测试深集成所需的包。全部退出码 0。

```powershell
npm.cmd --prefix loom-realm run build -w @loomrealm/foundation
npm.cmd --prefix loom-realm run build -w @loomrealm/wire
npm.cmd --prefix loom-realm run build -w @loomrealm/shared-state
npm.cmd --prefix loom-realm run build -w @loomrealm/session-events
npm.cmd --prefix loom-realm run build -w @loomrealm/platform-ports
npm.cmd --prefix loom-realm run build -w @loomrealm/runtime-control
npm.cmd --prefix loom-realm run build -w @loomrealm/renderer-control
npm.cmd --prefix loom-realm run build -w @loomrealm/data
npm.cmd --prefix loom-realm run build -w @loomrealm/subsystem
npm.cmd --prefix loom-realm run build -w @loomrealm/renderer
npm.cmd --prefix loom-realm run build -w @loomrealm-game/common-controls
npm.cmd --prefix loom-realm run build -w @loomrealm/fsdb
npm.cmd --prefix loom-realm run build -w @loomrealm/game-package
npm.cmd --prefix loom-realm run build -w @loomrealm/main
npm.cmd --prefix loom-realm run build -w @loomrealm/game-launcher-pwa
npm.cmd --prefix loom-realm run build -w @loomrealm/game-launcher-hostra
npm.cmd --prefix loom-realm run build -w @loomrealm/desktop
```

`@loomrealm-game/common-controls` 产出 `loom-realm/game-libs/game-common-controls/dist/browser/device-input.browser.js`，esbuild 记录为 47.3kb。这些产物留在本地 `dist/` 与 submodule 工作区，没有进入根提交。

Playwright 浏览器按固定 LoomRealm workspace 安装，没有新增第二套浏览器依赖：

```powershell
npm.cmd --prefix loom-realm exec -- playwright install chromium
```

退出码 0，约 7.6s，没有打印新的浏览器下载。随后的 cms-actor、canonical PWA 与 M1 Chromium 测试都成功启动了浏览器。

## 测试

| 命令 | 结果 |
| --- | --- |
| `node components/cms-actor/scripts/build.mjs --check` | `browser/cms-actor.browser.js matches sources` |
| `node --test` cms-actor 四个 Node 文件 | tests 39，pass 39，fail 0，skipped 0，542ms，退出码 0 |
| `npm.cmd test` | tests 54，pass 51，fail 0，skipped 3，7687ms，退出码 0 |
| `node --test` cms-actor 两个 Chromium 文件 | tests 21，pass 21，fail 0，skipped 0，30263ms，退出码 0 |
| `npm.cmd run pwa:bundle` 连续两次 | SHA-256 都是 `88e016e3bb2814e87ab781ec772ace7cb81bde7db65bf68c4bd53eb0a1681754` |
| `npm.cmd run pwa:staging` | 退出码 0 |
| canonical Service Worker E2E | tests 2，pass 2，fail 0，skipped 0，26525ms，退出码 0 |

cms-actor Node 文件与 CI 相同：

```text
components/cms-actor/test/avatar-model.test.mjs
components/cms-actor/test/browser-artifact.test.mjs
components/cms-actor/test/adventure-adapter.test.mjs
components/cms-actor/test/adventure-clock.test.mjs
```

cms-actor Chromium 文件与 CI 相同：

```text
components/cms-actor/test/integration.chromium.test.mjs
components/cms-actor/test/adventure-chromium.test.mjs
```

根测试的 3 个 skip 都是既有 symlink 拒绝用例，原因字符串为 `symlink creation unavailable on this platform (EPERM)`：

- `output path safety: a symlink destination (including dangling) is rejected without following it`
- `output path safety: parent-directory symlinks are rejected before any directory is created`
- `staging refuses a symlinked staging target or ancestor without deleting anything`

诊断：`cmd /c mklink` 返回 `You do not have sufficient privilege to perform this operation.` `whoami /priv` 没有列出 `SeCreateSymbolicLinkPrivilege`。测试代码没有被放宽，也没有改成跳过；Linux CI 仍会执行这三项。路线图 4.4 的原文是“根测试 `fail 0` 且集成层 `skipped 0`”，不是要求根测试整体 `skipped 0`。本次根测试 `fail 0`；Game Entry、Hostra、renderer presentation、installation bundle、real generic-builder staging、cms-actor Chromium 和 canonical PWA Service Worker E2E 都实际执行，集成层 `skipped 0`。因此这 3 个本机权限相关 skip 是跨平台覆盖限制，不阻止 M0 通过。

`pwa:staging` 输出：

```text
appId adventure-island
basePath /pwa/adventure-island/
bundleId loomrealm-pwa-sha256-4380f938a0cbf28491df44790d9220e49c29d414c4b31ba89770e19e36fa63cb
generation pwa-v1-37fcaa650194b6c60d512a3cd8513172
frameworkSha 93648192323bf5f57996b7b54cbae641d8a53fdb
executableCount 2
contentCount 21
```

staging 后用与 CI 相同的断言复核了 `generation.json`、`installation-bundle.json`、presentation/content identity，以及 `index.html`、`window.js`、`session-worker.js`、`worker-runner.js`、`service-worker.js`。payload SHA-256 仍是 `88e016e3bb2814e87ab781ec772ace7cb81bde7db65bf68c4bd53eb0a1681754`。

canonical E2E：

```powershell
$target = "loom-realm\apps\pwa\dist\staging\pwa\adventure-island"
Copy-Item dist\staging\adventure-island\* $target -Recurse -Force
$env:LOOMREALM_PWA_BASE_PATH = "/pwa/adventure-island/"
node loom-realm/apps/pwa/scripts/run-e2e.mjs staging "$PWD\test\pwa-browser.e2e.test.mjs"
```

两条测试都通过：

- `Adventure Island Base → Adventure Map PWA runs active under its isolated Service Worker scope`（1109ms）。断言包括 pathname `/pwa/adventure-island/`、product 与 presentation `ready`、Service Worker controller、单个 `cms-actor` 与 `game-controls-input`、FSDB 非透明像素、`page.keyboard` 的 left/right/up（walk/stand/jump/facing）以及 viewport resize 后重新居中。
- `the canonical synthetic Content projects a paper-doll actor in the real PWA Service Worker`（25114ms）。

## M0 结论与本机限制

- **M0 通过。** 路线图 4.4 的退出条件均已有本机证据：根测试 `fail 0`，所有真实集成测试 `skipped 0`，bundle 身份稳定，generic staging 与 canonical Service Worker PWA 均通过，Gitlink 与 Submodule 边界未改变。
- 本机仍有 3 个 symlink 安全分支因 Windows `EPERM` 未覆盖。没有通过放宽断言、删除用例或伪造符号链接来消除 skip；这些分支继续由具备 symlink 能力的 Linux CI 覆盖。
