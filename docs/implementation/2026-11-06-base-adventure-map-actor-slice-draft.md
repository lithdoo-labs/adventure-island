# Adventure Island 基础运行切片：Base → Adventure Map → Actor

> **状态：Draft / 设计已收敛，等待实现与实测；不是已通过的验收报告**
>
> 日期：2026-11-06 · 设计基线：[Adventure Island `main@a1992512`](https://github.com/lithdoo-labs/adventure-island/commit/a1992512ac62a40595c3e7ca812363d1112ae043)
>
> LoomRealm 固定 gitlink：`93648192323bf5f57996b7b54cbae641d8a53fdb`，**不得顺带升级**。
>
> 关系：[总设计](../../DESIGN.md) · [canonical Game Entry](../game-entry.md) · [cms-actor 契约](../../components/cms-actor/IMPLEMENTATION.md)

## 1. 目标、完成定义与非目标

**目标：** 正式 Adventure Island PWA 进入 `base`，由其调用 `adventure-map`。页面中央展示唯一的合成 `cms-actor`；键盘方向键与兼容手柄的**十字键（D-pad）**驱动站立、行走、跳跃动作及左右朝向，松键恢复站立，窗口变化仍居中。全过程使用固定 LoomRealm 的真实 Input → Frame → Render → Content → Web Presentation 链路，而不是独立演示页或测试专用 Subsystem。

**完成定义（PWA）：** canonical Game Entry 成功启动并保持活跃；Controls 脚本和 Actor 脚本均由已发布的 Content 注册；合成 AvatarPlan/PNG 成功呈现；真实 Chromium 键盘操作与状态释放、Viewport resize、Frame 清理经 E2E 验证；现有 PWA/组件测试及安全构建规则无回归。

**非目标：** 真实地图、世界位置、移动物理 Tick、重力、立足线、传送门、镜头跟随、NPC、技能、Shared State 持久化、CMS079 WZ 导入和线上部署。此切片不等于 [首个可玩里程碑](../../DESIGN.md)；Actor 动画可以“走”和“跳”，但**绝不声称已经具备物理移动**。

**平台验收边界：** 本次交付以 PWA 完整闭环为硬门槛；`launch.hostra.json` 保持相同逻辑绑定，但 Hostra 实机/Content 安装单独报告 `PASS / BLOCKED`。没有 Hostra 的同名 Content 就不能写“Desktop 已通过”。

## 2. 最小拓扑及源码组织

```text
Main / Session
  └─ base Frame
       ├─ RenderDomain: game-controls-input
       │    └─ Keyboard + compatible gamepad D-pad
       │         → controls.state / controls.event (top active Frame)
       └─ await frame.call("adventure-map", frame.params)
            └─ adventure-map Frame
                 ├─ createControlsConsumer + createDirectionalControlsTracker
                 ├─ scope.viewport (展示坐标)
                 ├─ scope.content.record (只读 AvatarPlan)
                 └─ RenderDomain: cms-actor
                      ├─ attrs: x, y, locomotion, facing
                      └─ data: { avatarPlan }
                           ↓ Renderer / WebProjector
                      cms-actor classic script + Content PNG
```

**唯一职责：**

| 所有者 | 只做什么 | 明确不做什么 |
|---|---|---|
| `base` | 创建并持有单个 `game-controls-input`，`await frame.call`，退出时关闭输入 RenderDomain | 不监听 DOM、不管理角色、不解释输入 |
| `adventure-map` | 接收统一 Controls，维护本次 Frame 的方向/朝向/动作，投影一个 Actor | 不直接碰 DOM、不处理真实地图物理 |
| `cms-actor` | 基于 attrs 和有效 AvatarPlan 绘制动画及资源 | 不接收按键、不持有游戏世界状态 |
| `Content` | 提供预先验证、只读的 AvatarPlan 和版本固定的 PNG | 不携带输入事实或用户私有 WZ |
| `LoomRealm` | Frame/Activation、Presentation Event、RenderDomain、Viewport、Content 通道 | 不接收本游戏专属玩法规则 |

当前方向/动作只是 Frame 局部临时展示状态，**不入 Shared State**。以后真正的世界坐标和场地权威由 Adventure Island 独立 Game Library/Subsystem 设计，不复用 PokeMan 的格子 Map/Battle 模型。

**单一源码原则：**

```text
game.json
launch.pwa.json
launch.hostra.json
presentation.json

systems/base/subsystem.mjs           # 唯一 Base 实现
systems/adventure-map/subsystem.mjs  # 唯一 Adventure Map 实现
subsystems/base.mjs                  # 根 Hostra 安装入口薄绑定
subsystems/adventure-map.mjs         # 根 Hostra 安装入口薄绑定

content/build-avatar-plan.mjs        # 现有参考适配算法抽为正式构建模块
scripts/pwa/synthetic-avatar-content.mjs
scripts/pwa/build-installation-bundle.mjs
test/...
```

**决策：只迁移根 canonical Game Entry。** 现有 `apps/pwa/*`、`apps/hostra/*` 的 Smoke 文件视为历史兼容/隔离测试入口，**本切片不为它们新建四份同名 shim**。同步修改 [docs/game-entry.md](../game-entry.md) 与旧测试的“三份 Game Entry 必须等同 Smoke”假设，明确哪些验证属于新的 canonical 入口、哪些仍属于 legacy Smoke。旧 Smoke Subsystem 可以保留作为隔离测试夹具，正式入口不再引用。最终根 Hostra 安装入口仅为对 `systems/*` 的 re-export；PWA 发布的是编译后的自包含 executable，**不是 shim 源码**。

根 `game.json` 的目标内容：

```json
{
  "formatVersion": 1,
  "initial": { "subsystem": "base", "input": null },
  "subsystems": [
    { "key": "base" },
    { "key": "adventure-map" }
  ]
}
```

根 `launch.pwa.json` 和 `launch.hostra.json` 的目标逻辑映射一致：

```json
{
  "formatVersion": 1,
  "subsystems": [
    { "key": "base", "module": "subsystems/base.mjs" },
    { "key": "adventure-map", "module": "subsystems/adventure-map.mjs" }
  ]
}
```

### Base 的约定

依照 [PokeMan Base](https://github.com/lithdoo-labs/pokeman/blob/main/subsystems/base.mjs)：

```js
import { defineSubsystem } from "@loomrealm/subsystem";

export default defineSubsystem((scope) => ({
  async frame(frame) {
    const controls = scope.createRenderDomain({
      zIndex: 0,
      roots: [{
        key: "game-controls-input",
        tag: "game-controls-input",
        attrs: {},
        data: {},
        children: []
      }]
    });
    try {
      return await frame.call("adventure-map", frame.params);
    } finally {
      controls.close();
    }
  }
}));
```

父 Frame 在子 Frame 活跃期间持续持有输入组件；子 Frame 结束、失败或取消时由 `finally` 关闭。Base **原样透传 `frame.params`**，不预先假定游戏永远只有 `null` 启动参数。输入域 `zIndex: 0` 与 [PokeMan Base](https://github.com/lithdoo-labs/pokeman/blob/main/subsystems/base.mjs) 保持一致，不为无可见 UI 的采集组件发明额外叠放层级。**不**同时挂载 `game-keyboard-input` 与 `game-gamepad-input`，避免同一物理按键在原始频道和统一频道形成重复输入。

## 3. 输入、动作、居中和生命周期

### 3.1 Controls 的真实注册与输入边界

**P0：注册脚本必须进入正式 Presentation。** `game-controls-input` **不是** Renderer 内置元素，它由固定 LoomRealm `@loomrealm-game/common-controls` 的 **classic IIFE** `game-libs/game-common-controls/dist/browser/device-input.browser.js` 注册（也会定义原始设备组件）。目前根 `presentation.json` 只有 `cms-actor`，必须改为：

```json
{
  "formatVersion": 1,
  "styles": [],
  "scripts": [
    { "namespace": "Presentation", "key": "controls/device-input.browser.js" },
    { "namespace": "Presentation", "key": "cms-actor/cms-actor.browser.js" }
  ]
}
```

对应的安装 Content 必须存在两个 resource（顺序与上表一致）：

- `resource.Presentation / controls/device-input.browser.js`：来源为**先构建**的、固定 gitlink 对应的 common-controls 浏览器产物。
- `resource.Presentation / cms-actor/cms-actor.browser.js`：复用仓库现有已验证 classic script。

根 [PWA Bundle Builder](../../scripts/pwa/build-installation-bundle.mjs) 的 `CONTENT_SCRIPT_SOURCE_BINDINGS` 加入前者的**受控固定路径**：`loom-realm/game-libs/game-common-controls/dist/browser/device-input.browser.js`（**相对于 Adventure Island 的 `gameRoot`**，构建器当前按 `resolve(game, physicalPath)` 读取），而非误写成 `game-libs/...`、扫描 dist 目录或临时复制到 Git 跟踪目录。保留 classic script 语法、Content identity、MIME、哈希、白名单和引用完整性校验。**只安装 npm 包不会注册 Web Component**，不发布脚本也不会采集输入。

此版本的 [统一输入契约](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/game-libs/game-common-controls/game-controls-input.md) 将 `ArrowUp/Down/Left/Right` 与兼容手柄 **D-pad** 归一化为 `up/down/left/right`；**模拟摇杆轴不产生方向值**。设备支持以固定版本实现为准：standard mapping，以及明确定义的已验证设备例外；非受支持的手柄不能宣称通过。输入仅在窗口可用、键盘捕获允许时生效；消费者不要使用 `dispatchEvent(new KeyboardEvent(...))` 验证真实采集，因为非可信键盘事件会被忽略。

### 3.2 Adventure Map 控制契约

`adventure-map` 进入活跃 Frame 后，使用两个现成公开函数，而非自建 held-key 状态机：

```js
import { defineSubsystem, cancelled, failed } from "@loomrealm/subsystem";
import {
  createControlsConsumer,
  createDirectionalControlsTracker
} from "@loomrealm-game/common-controls/subsystem";

// applySafely 在 Frame 内定义：同步捕获投影错误、记录一次 fatal，
// 唤醒 Frame 主等待；不得将异常交给 Consumer 静默隔离。
const directions = createDirectionalControlsTracker();
const consumer = createControlsConsumer(
  scope.presentationEvents,
  frame,
  {
    onState(state) {
      applySafely(() => {
        directions.acceptState(state);
        applyDirection(directions.direction);
      });
    },
    onEvent(event) {
      applySafely(() => {
        directions.acceptEvent(event);
        applyDirection(directions.direction);
      });
    }
  }
);
```

每个新 Frame/Activation 使用全新的方向 Tracker，从 `null` 开始；Consumer 自动处理 `controls.state` 的 freshness/stale-reset，并按 `controls.event` 处理有效 down/up。输入 Producer 使用 `broadcast:"top-frame"`，所以 Base 可以持有组件，Adventure Map 作为当前 Top Active Frame 接收事件。新 Frame 不继承旧输入事件；持续按住的事实可由之后新到达的 State 刷新恢复，**不保证刚刚激活后的第一下按键在 Interest 建立前必达**。测试必须等到订阅/界面可交互之后再发可信键盘输入。

动作映射固定为以下**演示策略**，不扩展 `cms-actor` 的公开动作值：

| 有效方向 | `locomotion` | `facing` | 实际位移 |
|---|---|---|---|
| `null` | `stand` | 保留最后朝向 | 无 |
| `left` | `walk` | `left` | 无 |
| `right` | `walk` | `right` | 无 |
| `up` | `jump` | 保留最后朝向 | 无 |
| `down` | `stand` | 保留最后朝向 | 无 |

现有 AvatarPlan 对应 `stand→stand1`、`walk→walk1`、`jump→jump`。`jump` 为非循环动作，进入后播放一次并保持末帧，直到动作状态改变；不意味着角色离地、落地或有跳跃物理。多个方向同时按住时使用 Tracker 当前有效方向，释放后恢复剩余有效方向或 `stand`；重复/同值状态不产生额外渲染更新。仅更新改变的 `locomotion` / `facing` attrs，不重新发送 AvatarPlan。

### 3.3 Actor、Viewport 与资源读取

- 开始时从 `scope.content.record("struct.AdventureAvatarPlan", "bootstrap", { signal: frame.signal })` 读取**Plan 本体**；失败返回明确的 `failed({ code: "ADVENTURE_AVATAR_CONTENT_UNAVAILABLE" })`，取消返回 `cancelled()`。不要吞掉错误后展示空 Actor。
- 初始化一次 `scope.createRenderDomain({ zIndex: 0, roots: [ { key: "adventure-player", tag: "cms-actor", attrs: {...}, data: { avatarPlan }, children: [] } ] })`，Actor 的稳定 key 不复用为新节点。初始 `locomotion=stand`、`facing=right`；外观 attrs 继续遵循 [cms-actor 既有契约](../../components/cms-actor/IMPLEMENTATION.md)。
- `cms-actor` 的 `x/y` 是身体原点（接近脚底），不是 sprite 中心或世界坐标。演示期通过 `scope.viewport.current`、`subscribe` 更新 `x=round(width/2)`、`y=round(height/2+16)`；`+16` 是仅对当前合成图有效的待验证视觉偏移，不属于领域常量。Viewport 为 `null`、无效或零尺寸时不更新。首次有效尺寸及 resize 都需要验证。
- `domain.update({ nodes: [{ key, attrs: { set: changedAttrs } }] })` 只包含变化项；`avatarPlan` 在创建节点时传入一次，`cms-actor` 内部管理 Canvas、帧序列和 PNG Resource cache。

### 3.4 控制回调故障、取消和资源回收

**必须显式处理 Consumer 吞错语义。** 固定版本 [`createControlsConsumer`](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/game-libs/game-common-controls/src/consumer.ts) 的 `deliver()` 会隔离 `onState/onEvent` 的**同步异常**，也会吞掉回调返回 Promise 的 rejection；它**不会**将回调失败转成 Frame 的 `failed`。因此 Map 不允许把裸 `domain.update()` 异常直接抛给 Consumer，也不允许把异步投影工作放进回调而不管理 Promise。

**最简实现契约：** `applyDirection`、Viewport 的坐标更新和 `domain.update` 均为同步调用。Frame 内在注册监听前初始化唯一的 `fatalCode = null`、一个一次性 `fatalPromise`（由内部 `resolveFatal` 唤醒）及 `closed = false`；`applySafely(fn)` 在 `closed || fatalCode !== null` 时忽略迟到事件，否则 `try { fn(); } catch { fatalCode = "ADVENTURE_INPUT_PROJECTION_FAILED"; resolveFatal(); }`。Viewport 更新使用同一故障门，但错误码可设为 `ADVENTURE_VIEWPORT_PROJECTION_FAILED`。**不要**在回调内部直接返回 `failed()`——Consumer 不消费这个结果。

```js
// 示意：放在 adventure-map 的活跃 frame() 作用域。
let closed = false;
let fatalCode = null;
let resolveFatal;
const fatalPromise = new Promise((resolve) => { resolveFatal = resolve; });

function applySafely(work, code = "ADVENTURE_INPUT_PROJECTION_FAILED") {
  if (closed || fatalCode !== null) return;
  try {
    work(); // 仅同步状态投影，不返回 Promise
  } catch {
    fatalCode = code;
    resolveFatal();
  }
}

// 在初始化完成后，注册一个能正确移除 abort listener 的 waitForAbort。
// 不使用无期限挂起、无法取消的 Promise。
try {
  await Promise.race([waitForAbort(frame.signal), fatalPromise]);
  if (frame.signal.aborted) return cancelled();
  return failed({ code: fatalCode ?? "ADVENTURE_MAP_UNEXPECTED_EXIT" });
} finally {
  closed = true;
  consumer?.close();
  unsubscribeViewport?.();
  directions.reset();
  domain?.close();
}
```

上述示意**不是完整可复制的 Subsystem 源文件**：`waitForAbort` 必须处理“监听前已 aborted”、`abort` 监听器只订阅一次且在 race 完成后卸载；`consumer`、`unsubscribeViewport`、`domain` 用外层可空变量保存，以便构造/订阅中途抛错时仍能清理。创建 RenderDomain、注册 Viewport 和 Consumer、处理首个 `viewport.current` 应放在同一 `try/finally` 资源作用域内；**尤其是 `createControlsConsumer` 会在返回对象前立即同步投递一次空 `onState`**，所以 `fatalPromise` 和 `applySafely` 必须在创建 Consumer 之前就绪。失效后停止投影，不依赖后续输入来唤醒终止。

**Frame 生命周期必须封闭：**

1. `Content` 读取成功且尚未取消 → 在资源保护 `try` 内创建 RenderDomain → 注册 Viewport 订阅和 Controls Consumer；在订阅后立即处理 `viewport.current`，避免遗漏首个尺寸。
2. 第一版无自然游戏结束条件，Frame 在无致命错误时保持活跃直到 `frame.signal` 取消；不可初始化后立刻返回 `completed`。
3. `Promise.race` 只竞争**取消与首次致命错误**，取消优先返回 `cancelled()`，故障返回带稳定 code 的 `failed()`；读取 Content 时的 `ContentReadError` 应单独映射为可定位故障（已经中止则返回取消）。任何异步初始化抛错也必须进入受控失败路径，不留下悬挂 Frame。
4. `finally` 无论取消、故障还是中途初始化失败，关闭 Consumer、Viewport 订阅和 Map RenderDomain；卸载 `abort` 监听，关闭后不再发 `domain.update`。Base 的 `finally` 随 `frame.call` 结束再关闭输入 Producer。
5. 资源解码与 Canvas 清理由 `cms-actor` 断开生命周期负责；如果 **Web Presentation** 侧发生 PNG 解码或资源错误（`data-render-state=error`），不能假设它会自动变成 Worker Frame 的 `failed()`。本切片通过浏览器 E2E 明确失败该场景；未来若需要把 Renderer 失败上报到业务运行时，应另立事件契约，不在这里虚构自动错误桥接。

## 4. Content、构建依赖与 CI

### 4.1 不引入第二套 Avatar 管线

复用 [`synthetic-avatar-content.mjs`](../../scripts/pwa/synthetic-avatar-content.mjs) 已生成的 `struct.ZMap/order`、5 条 `struct.Look` 记录、合成 PNG，以及现有 `deriveCanonicalAvatarPlan()` 资源图校验。**构建期**派生一次 `AvatarPlanV1` 并新增只读记录：

| 属性 | 固定值 |
|---|---|
| `kind` | `record` |
| `namespace` | `struct.AdventureAvatarPlan` |
| `key` | `bootstrap` |
| MIME | `application/json; charset=utf-8` |
| Value | 经校验的 AvatarPlan 本体；不是外包一层 `{ avatarPlan }` |

推荐在现有 `assembleSyntheticContent` 的派生/版本检查完成后将该 Plan 序列化加入 Content，重新应用现有 identity、排序、base64 和字节验证；确保重新读取的记录与被验证的 Plan 完全一致。RenderNode 仍按 `data: { avatarPlan: record.value }` 投影。严格保留 `262,144` 字节 RenderNode data 上限和每个 PNG 的精确 `contentVersion`、MIME、身份引用。绝不把 PNG base64、文件路径、真实 WZ 放进 Plan。

目前 `buildAvatarPlan` 位于 `components/cms-actor/test/look-adapter.mjs`，且其 `layerFor()` **暗中导入** `./synthetic-fsdb.mjs` 中的 `IMAGE_NAMESPACE`。**明确决策：抽取为纯构建函数**：`content/build-avatar-plan.mjs` 由调用者显式传入 `looks`、`zOrder`、资源 `index` 以及 `{ imageNamespace, expression }`，内部仅负责 UOL/锚点/帧映射和资源版本的 `AvatarPlanV1` 派生，**零 `components/cms-actor/test/**` 导入**。资源键 `imageNamespace + "\0" + canvas.resource` 使用调用者提供的身份；运行时 Map 不调用它。

**迁移兼容：** `components/cms-actor/test/look-adapter.mjs` 继续导出旧函数签名的薄 wrapper，自己从 `./synthetic-fsdb.mjs` 提供 `IMAGE_NAMESPACE`，再转调正式构建函数；现有测试和 `withResourceVersion` 继续运行。`scripts/pwa/synthetic-avatar-content.mjs` 改为直接导入纯构建函数，并传入已声明的 `IMAGE_NAMESPACE`；保持原 `deriveCanonicalAvatarPlan()` 的哈希验证与 Snapshot 行为。现有 synthetic PNG/Look 生成器的测试夹具来源依然允许**作为构建期合成数据**，但不能反向污染**纯 AvatarPlan 适配器**，更不得进入正式 Worker 运行代码；这不等于把全部测试素材提升为领域模型。

**不**新增运行时 Adapter、Avatar Repository、泛用 Content 索引或真实素材流水线。现有 `test/pwa-avatar-fixture.mjs` 仍是独立测试，不得作为正式 Subsystem。

### 4.2 构建顺序和发布策略（P0）

新的 `base` / `adventure-map` 需要 `@loomrealm/subsystem` 和 `@loomrealm-game/common-controls/subsystem`，当前 Adventure Island 根 `package.json` 不含依赖/workspaces。**确定依赖方案（不留到实现时任意二选一）**：参照 [PokeMan 根工作区](https://github.com/lithdoo-labs/pokeman/blob/main/package.json)，为产品根 `package.json` 增加 `"workspaces": ["loom-realm/packages/*", "loom-realm/game-libs/*"]`；声明 `"@loomrealm/subsystem": "file:loom-realm/packages/subsystem"`、`"@loomrealm-game/common-controls": "0.1.0-alpha.0"`（由上述本地 workspace 满足），产品侧 `devDependencies` 声明 `"esbuild": "0.25.9"`。安装和锁文件均由固定 gitlink 的源代码生成，**不得从 registry 取得另一版本的 LoomRealm 包，也不允许依赖 PokeMan 的 `node_modules`**。

产品仓库新增并提交**根 `package-lock.json`**（锁定产品侧 Workspace 和 esbuild）；固定 submodule 自己的 `loom-realm/package-lock.json` **原样保留**，用于 LoomRealm 自有构建工具、PWA Builder、Playwright。两份锁文件**职责不同**，不是相互替代：CI 在 Node 22/固定 npm 10 工具链下先执行根 `npm ci --no-audit --no-fund`，再执行 `npm ci --prefix loom-realm --no-audit --no-fund`，随后按 LoomRealm 固定仓库的 workspace build 拓扑构建 framework、common-controls 和 PWA 所需产物。产品 Subsystem / esbuild 从**根工作区**解析；LoomRealm 通用 PWA Builder / Playwright 从**submodule 工作区**解析。当前 [staging 预检](../../scripts/pwa/build-staging.mjs) 仅在 `loom-realm/node_modules/esbuild` 或 `loom-realm/apps/pwa/node_modules/esbuild` 查找 esbuild，故**不能只安装根工作区**。两个 `npm ci` 在全新 checkout 上作为同一 CI 任务执行以证实互不破坏；若 npm 解析冲突必须在实施 PR 修复，而非在文档中默认成功。

**强制执行顺序：**

```text
checkout + 精确 gitlink 校验 + Node 22 / npm 10
  → npm ci（产品根 package-lock.json）
  → npm ci --prefix loom-realm（固定子模块 package-lock.json）
  → 按固定 LoomRealm workspace 拓扑构建所需 @loomrealm/* 与 common-controls
  → 校验 loom-realm/game-libs/game-common-controls/dist/browser/device-input.browser.js
  → 根 esbuild(bundle=true, format=esm, platform=browser, write=false) 两个 Subsystem
  → 生成 installation-bundle（2 executable + 2 classic scripts + synthetic Content）
  → 通用 LoomRealm PWA Builder → staging
  → root 契约测试 + canonical Chromium/Service Worker E2E
```

构建命令应沿用固定 [LoomRealm workspace](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/package.json) 既有包顺序（例如其 `build:game-common-controls-input` / `@loomrealm/pwa` 的 `build:bundle` 依赖链），不得臆造依赖排序；在**干净 checkout**验证完整过程。产品构建器从根工作区 `import { build } from "esbuild"`，每个白名单源分别以绝对入口调用 `build({ absWorkingDir: game, entryPoints: [entryPoint], bundle: true, format: "esm", platform: "browser", target: "chrome140", sourcemap: false, write: false })`，检查每次仅有一个有效输出，将输出文本绑定到对应 logical module，再按输出字节计算 SHA-256；不接收任意用户指定入口。`pwa:bundle` 缺少 Controls 产物或 esbuild 时应明确失败，不能把未构建的源码当作 browser bundle。

调整 `EXECUTABLE_SOURCE_BINDINGS` 为两个受控源文件（`systems/base/subsystem.mjs`、`systems/adventure-map/subsystem.mjs`），再编译为**自包含 executable**。保留现有 `assertExecutableGraph` 的零外部导入图、禁止动态/越根导入和 Node-only API 规则，打包后才计算 `sha256` 和 `contentVersion`。`CONTENT_SCRIPT_SOURCE_BINDINGS` 的 Controls 产物路径也必须受白名单约束。保留已经有的资源引用完整性、输出路径防护、确定性和负例测试，不迁入 LoomRealm `examples`。

根 `presentation.json` 要有两项脚本；Content 要在旧合成内容基础上新增**一个 Controls 脚本 + 一个 AvatarPlan Record**。所有写死旧 Content 数量 `24`、单 executable、`subsystems/smoke.mjs` 的断言均应更新，不能只改 `game.json`。

**CI 必改的文件/约定：**

- `.github/workflows/pwa-ci.yml`：执行上述**两个锁文件的 `npm ci` 顺序**，在 `npm run pwa:bundle` 前构建所需依赖和 Controls IIFE；保留准确 gitlink、研究素材隔离、无 skip 的测试门禁。现有框架 `build:bundle` 编译步骤仍需按 pinned API 执行，不被产品 esbuild 步骤替代。
- Workflow `paths`：由 `systems/loomrealm-smoke/**` 扩展至 `systems/**`，覆盖 `content/**`、`package-lock.json` 及新建的实现/打包测试。文档 PR 可按流程手动触发；代码 PR 不得因路径过滤绕过 E2E。
- `test/game-entry.test.mjs`：将 canonical `base` 与 legacy `apps/*` Smoke 的测试分离，不再强制三份 Game Entry 等于 Smoke；新增 Base → Map 参数**透传**、输入域开闭和 Map Frame Outcome 契约。
- `test/pwa-bundle.test.mjs`：更新固定输入/Content 白名单和“只有 Smoke executable”的断言；隔离仓库夹具应通过明确的 builder 注入接口提供两个**测试用自包含 executable** 和 Controls classic script 哑资源，仅用于**安全/确定性负例**，不得假装测试过真实编译。新增编译产物的独立 import-graph 检查和根 Content 中 `struct.AdventureAvatarPlan/bootstrap` 的字节/哈希断言。
- `test/pwa-staging.test.mjs`（**原清单遗漏**）：其 `makeStagingFixture()` 只复制 Smoke 源码与 Actor script，必须改为与新的 Game Entry、两个 logical module、两份 Presentation classic script、一个新增 Plan Record 一致。可在 stub-builder 负例中注入固定合法的已打包 executable、合成 Controls 测试脚本，但需保持真实集成测试使用**生产构建路径**；保留 Gitlink、符号链接/受保护路径、错误回滚和失败时无写入的断言。
- `test/pwa-avatar-fixture.mjs`、`test/pwa-browser.e2e.test.mjs`：独立 Actor fixture 复用新的 canonical Content + Presentation，检查新增脚本/记录不会造成重复 Custom Element 注册和数据不一致；canonical PWA 则验证真实 `base → adventure-map` 的 `ready` 常驻状态、可信 `page.keyboard.down/up`、尺寸与取消回收。旧 Smoke `settled` 只能在**隔离 Smoke 测试**继续断言，不能用于新的 canonical 应用。
- `package.json`（**原清单遗漏**）：当前 `test` 显式列出测试文件，必须把 Base/Map 单测和新增的 bundle/回归用例确实纳入该脚本或受控 glob；CI 显式检查 `# fail 0`、`# skipped 0`，防止写了测试但根本没运行。
- `docs/game-entry.md` 和 `README.md`：描述新的 canonical 入口，准确标注过渡 Smoke 文件，不保留陈旧的 Smoke 作为正式应用的说明。

不更新 gitlink，不提交第三方控制器文件、CMS079 客户端、WZ、真实 FSDB 或密钥，不改生产部署。

## 5. 验收矩阵与故障闭环

| 范围 | 必须验证 | 合格证据 |
|---|---|---|
| Game Entry | `base` 是初始 Frame；它打开 `adventure-map` 并在子 Frame 活跃时保持输入组件 | Frame/RenderDomain 单元契约 |
| 脚本/Content | 两份 classic script 均进入 Presentation 与发布 Content；组件已注册且非 `data-input-disabled=duplicate` | staging Bundle 引用 + 真浏览器断言 |
| Input | `ArrowLeft/Right/Up/Down` 真实 down/up；组合按键、释放、blur/stale reset；D-pad 统一方向；Consumer 首次同步空 State | Controls 单测 + Chromium `page.keyboard.down/up` + 手柄仿真 |
| Actor | `stand1 / walk1 / jump` 与 facing 正确，松开恢复；无世界位移；Viewport resize 仍居中 | Chromium 实际 `data-action`/`data-render-state` 与像素/位置验证 |
| Render/Content | AvatarPlan 正确，资源哈希一致，PNG 真加载；方向变化不重发 Plan | 根 Content 合法性、DOM 观察、RenderDomain update 断言 |
| 生命周期/故障 | Frame 中止后 Consumer、Viewport 订阅、Map Domain 及 Base Domain 关闭；Callback 中 RenderDomain 失败不会被 Consumer 静默吞掉，Frame 返回 `failed`；取消优先 `cancelled`；Renderer 资源失败不冒充 Worker `failed` | 同步空 State、Viewport 异常、主动取消/致命投影失败单测与 PWA E2E |
| 构建回归 | 产品根与固定 LoomRealm 双锁安装、两个 self-contained executable、哈希/白名单正确、确定性/安全路径及更新后的 Staging fixture 通过，原 Actor fixture 可运行 | 干净 CI 中两个 `npm ci` + 完整 `npm test` + 无跳过 Chromium |

**特别约定：** 新 `game-controls-input` 检查 `isTrusted`，自动化集成必须使用 Playwright 的真实键盘操作，而不是 `page.evaluate(() => dispatchEvent(...))` 伪造事件。测试先验证页面已可交互再发输入；非激活 Frame 的早到事件不能要求重放。

**验收报告必须区分：**

- **PWA：** `PASS` 仅当 canonical PWA 的真实端到端输入、Content、Actor、取消清理通过；旧 `test/pwa-avatar-fixture.mjs` 单独通过不足以认定达标。
- **手柄：** 可通过 deterministic Controls/D-pad 注入证明映射；实机控制器测试未做时写 `DEVICE UNVERIFIED`，不得写“实机已通过”。模拟摇杆属于明确的非目标。
- **Hostra：** `launch.hostra.json` 配置同构不等于正式运行成功。若没有相同逻辑身份的 synthetic FSDB/Content 及其可重放安装/启动过程，验收写 `BLOCKED`；可另开任务建立 Desktop Content 安装，不阻断本次 PWA 切片。

## 6. 实施边界与交付顺序

| 步骤 | 唯一交付 | 退出条件 |
|---|---|---|
| A | 根 Game Entry、两个唯一 Subsystem、根绑定；Base 参数透传/投影故障/取消单测迁移 | Base → Map Frame 与输入域生命周期、错误终止可测 |
| B | Controls 浏览器脚本注册、受控发布、输入 Tracker → Actor attrs、Viewport | 键盘/方向状态单测，唯一 Actor 正确投影 |
| C | 抽取零测试目录导入的纯 AvatarPlan 编译器；将现有合成 Plan 正式发布为 Record | 测试 wrapper 兼容、生产编译器无反向依赖；Content 哈希/大小合格 |
| D | 根/固定 submodule 两套可复现锁文件安装、两个自包含 Bundle、更新 Staging/Actor 夹具与 CI/测试入口、canonical PWA E2E | 完成第 5 节 PWA 全部 PASS |
| E（独立） | Hostra synthetic Content 准备与实体运行验证 | 有证据则 PASS，否则清楚标 BLOCKED |

**不要把步骤 A–D 拆成分别“宣布功能完成”的里程碑；只有 D 通过才形成真正的 PWA 垂直闭环。** 后续可玩场地要另行实现独立的横版物理 Game Library；当前 `adventure-map` 的动作状态仅是未来领域移动意图到 RenderNode 的最简替身。

### 设计决策已固定

- 用 LoomRealm **统一 Controls**，不再自建键盘/手柄监听器。
- `base` 管理唯一 Producer，`adventure-map` 作为 Top Active Frame 管理 Consumer；`cms-actor` 不变。
- 两个业务 Subsystem 各一份源码；根入口为 shim；`apps/*` Smoke 保持 legacy，不复制四份新源码；Base 原样透传 `frame.params`，输入域沿用 `zIndex: 0`。
- 仅合成素材、无测试模块反向依赖的纯 AvatarPlan 构建函数、构建期一次派生及 Content Record；不进行 WZ/FSDB 重导入。
- 产品根 package-lock 与固定 LoomRealm 原有 lockfile 分别执行 `npm ci`；Root Workspaces + 本地 pinned 包解析，拒绝依赖外部 PokeMan/未固定版本。
- PWA 为本次硬验收；Hostra 作为独立平台资格，不以静态 manifest 假冒完成。
- 仅在 Adventure Island 仓库实现，不升级 `loom-realm`，不开发 PokeMan 专属 Map/Battle。

**状态：待编码与资格验证。** 文档明确了最低工作集与验收条件；任何 `PASS` 都必须附实际 CI/浏览器执行证据，不能从草案推断。
