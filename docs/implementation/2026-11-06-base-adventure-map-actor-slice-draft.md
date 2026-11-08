# Adventure Island 基础运行切片：Base → Adventure Map → Actor

> **状态：Draft / 设计已收敛，等待实现与实测；不是已通过的验收报告**
>
> 创建日期：2026-11-06 · 本次复核修订：2026-11-07 · 设计基线：[Adventure Island `main@6e551a9`](https://github.com/lithdoo-labs/adventure-island/commit/6e551a94f4d37e25faa405e32a2b1ea1175bc844)
>
> LoomRealm 固定 gitlink：`93648192323bf5f57996b7b54cbae641d8a53fdb`，**不得顺带升级**。
>
> 关系：[总设计](../../DESIGN.md) · [canonical Game Entry](../game-entry.md) · [cms-actor 契约](../../components/cms-actor/IMPLEMENTATION.md)

协议依据：[FSDB layout](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/20-modules/fsdb-content-service/fsdb-layout.md) · [Content API v1](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/content-api-v1.md) · [Web Presentation API v1](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/web-presentation-api-v1.md)

## 1. 目标、完成定义与非目标

**目标：** 正式 Adventure Island PWA 进入 `base`，由其调用 `adventure-map`。页面中央展示唯一的 `cms-actor`，使用仓库既有 FSDB 素材；键盘方向键与兼容手柄的**十字键（D-pad）**驱动站立、行走、跳跃动作及左右朝向，松键恢复站立，窗口变化仍居中。全过程使用固定 LoomRealm 的真实 Input → Frame → Render → Content → Web Presentation 链路，而不是独立演示页或测试专用 Subsystem。

**完成定义（PWA）：** canonical Game Entry 成功启动并保持活跃；Controls 脚本和 Actor 脚本均由已发布的 Content 注册；构建期**只读现有 `content/[FSDB]adventure`** 的单角色数据闭包，使用正式 `buildAdventureAvatarPlan()` 生成并校验 `AvatarPlanV1`，发布派生的 bootstrap Plan Record；既有 PNG 的 Content Version 与 Plan 精确绑定；真实 Chromium 键盘操作与状态释放、Viewport resize、Frame 清理经 E2E 验证；现有 PWA/组件测试及安全构建规则无回归。

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
| `Avatar Adapter`（`components/cms-actor/src/adventure-adapter.mjs`） | 构建期读取正式 Avatar Content 契约，生成经校验且绑定资源版本的 AvatarPlan | 不进入 Map Frame 热路径、不监听输入、不持有游戏世界状态 |
| `cms-actor` | 基于 attrs 和有效 AvatarPlan 绘制动画及资源 | 不接收按键、不持有游戏世界状态、不自行查询 WZ 或重建外观 |
| `Content` | 提供预先验证、只读的 AvatarPlan 和版本固定的 PNG | 不携带输入事实或用户私有 WZ |
| `LoomRealm` | Frame/Activation、Presentation Event、RenderDomain、Viewport、Content 通道 | 不接收本游戏专属玩法规则 |

Avatar Adapter 只在安装 Bundle 构建期运行；Map Frame 读取已经生成的 `struct.AdventureAvatarPlan/bootstrap`，不在每次输入或每次 Frame 激活时重新解析部件数据。当前方向/动作只是 Frame 局部临时展示状态，**不入 Shared State**。以后真正的世界坐标和场地权威由 Adventure Island 独立 Game Library/Subsystem 设计，不复用 PokeMan 的格子 Map/Battle 模型。

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

components/cms-actor/src/adventure-adapter.mjs # 复用正式 AvatarPlan 构建适配器
scripts/pwa/read-adventure-fsdb.mjs     # 最小只读 FSDB→Content 适配器（或同等内聚 helper）
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

- 开始时从 `scope.content.record("struct.AdventureAvatarPlan", "bootstrap", { signal: frame.signal })` 读取**Plan 本体**；Content 缺失/不可用（必须识别 `ContentReadError` 的类型或跨 Bundle `name` + `code`，不能仅凭任意 `CONTENT_*` code）返回 `failed({code:"ADVENTURE_AVATAR_CONTENT_UNAVAILABLE"})`，已中止或 `CONTENT_CANCELLED` 返回 `cancelled()`；其他初始化异常映射为稳定 `ADVENTURE_MAP_INIT_FAILED`，并统一进入 `finally`。不要吞掉错误后展示空 Actor。
- 初始化一次 `scope.createRenderDomain({ zIndex: 0, roots: [ { key: "adventure-player", tag: "cms-actor", attrs: {...}, data: { avatarPlan }, children: [] } ] })`，Actor 的稳定 key 不复用为新节点。初始 `locomotion=stand`、`facing=right`；外观 attrs 继续遵循 [cms-actor 既有契约](../../components/cms-actor/IMPLEMENTATION.md)。
- `cms-actor` 的 `x/y` 是身体原点（接近脚底），不是 sprite 中心或世界坐标。演示期通过 `scope.viewport.current`、`subscribe` 计算 `x=Math.round(width/2)`、`y=Math.round(height/2+16)`；**初始与后续 `attrs.x/y` 均必须转换为字符串**（LoomRealm RenderNode attrs 为 string map）；`+16` 是暂定视觉偏移，须以**现有 FSDB 实际角色**在 Chromium 中的可见中心检查调整，不属于领域常量。Viewport 为 `null`、无效或零尺寸时不更新。首次有效尺寸及 resize 都需要验证。
- `domain.update({ nodes: [{ key, attrs: { set: changedAttrs } }] })` 只包含变化项；`avatarPlan` 在创建节点时传入一次，`cms-actor` 内部管理 Canvas、帧序列和 PNG Resource cache。
- `cms-actor` 还观察 `skin`、`face`、`hair`、`expression`、`equips`，但这些只是游戏侧适配器的外观选择状态；组件不会据此自行查 Content 或重建 Plan。本切片不实现动态换装：不设置这些选择器，固定使用 bootstrap Plan。未来若增加换装，必须由游戏侧调用正式 Avatar Adapter 生成新 Plan，再显式更新 `data.avatarPlan`，不能只改选择器 attrs。

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

### 4.1 现有 [FSDB]adventure 是唯一 Avatar Content 来源（P0）

**冻结决策：canonical PWA 直接使用仓库 `content/[FSDB]adventure/`。** 不再生成 synthetic Part、Group、PNG，不引入新的 WZ 导入器、FSDB Server、完整资产转换器或第二套 Adapter。`components/cms-actor/src/adventure-adapter.mjs` 中的 `buildAdventureAvatarPlan(content,input)` 是唯一的 Plan 构建算法，`avatar-model.mjs` 中的校验与限制继续作为权威。原 `scripts/pwa/synthetic-avatar-content.mjs` 与旧 `Look/ZMap` fixture 可以保留供**隔离的历史测试**使用，但不是 canonical Bundle 数据源。

**只读并发布本次角色的最小传递闭包**，不是把 FSDB 全量内容都重新转换/验证。预设 body `avatar.part.body.00002000`、head `avatar.part.head.00012000`、face `avatar.part.face.00020100`、hair `avatar.part.hair.00030000` 和 `expression:"default"`；只额外收集这些 Part 所需的 PartFrame/Resource、共享 DrawOrder/LayerSlot 及 Resource Group 的 `image` 字段指向的 PNG。若实际 Adapter 校验要求调整这个选择集合，只改固定选择参数，不改 FSDB 源数据；不发布无关装备、研究资产或全量 atlas。

#### 4.1.1 FSDB 路径到 Content 身份的确定性映射

| FSDB 物理路径（以 `content/[FSDB]adventure/` 为根） | kind / namespace | logical key |
|---|---|---|
| `[struct]avatar.Part/{part}.json` | record / `struct.avatar.Part` | `{part}` |
| `[group]avatar.PartFrame/{part}.jsonl` | group / `group.avatar.PartFrame` | `{part}` |
| `[group]avatar.Resource/{part}.jsonl` | group / `group.avatar.Resource` | `{part}` |
| `[struct]avatar.DrawOrder/avatar.json` | record / `struct.avatar.DrawOrder` | `avatar` |
| `[struct]avatar.LayerSlot/avatar.json` | record / `struct.avatar.LayerSlot` | `avatar` |
| `[resource]Avatar/{imageKey}.png` | resource / `resource.Avatar` | `{imageKey}`，去掉末尾 `.png` |

例如 `[resource]Avatar/part/body/00002000/0.png` 映射到 `resource.Avatar / part/body/00002000/0`。FSDB 元数据 `.info.meta` / `.desc.meta` 可用于布局校验，但**不是运行时 Content**，也不能将其宽松 JSON schema 当作完整业务验证。所有资源逻辑键不含本地路径、FSDB 根、授权信息或 WZ 原始字节。

新增**一个最薄的只读 helper**（可放在 `scripts/pwa/read-adventure-fsdb.mjs`，若已有 Builder 能清楚内聚则不必单独创建文件）：只允许上述目录及固定选择的闭包，防止 `../` 越界、符号链接逃逸和非预期文件；`record()` 解码 JSON object，`group()` 解码 JSONL rows，`resource()` 返回 PNG bytes。三个 Reader API 分别返回 `{value,contentVersion}`、`{rows,contentVersion}`、`{bytes,mime,contentVersion}`。构建 Reader **不等同** Actor 运行时的 `resources.resource(namespace,key,expectedVersion,...)` 能力。

**版本必须来自真正发布的字节：** Record 为 `application/json; charset=utf-8`、Group 为 `application/x-ndjson; charset=utf-8`、PNG 为 `image/png`；默认直接发布现有 JSON/JSONL/PNG 原始字节，不为格式好看而重新序列化。若确有格式转换，同一份转换后的 body 必须既供 Reader 计算版本，又供 Bundle 发布。版本统一为 `sha256:<64 lowercase hex>`，禁止占位版本、mtime 或随机版本。

#### 4.1.2 唯一 Plan 派生与发布链

```text
现有 content/[FSDB]adventure（只读）
 → 选定 body/head/face/hair 的 Part、两类 Group，及共享顺序记录
 → 按 Resource Group 的 image 引用闭包读取必要 PNG
 → 以最终发布字节建立 Content entries 和 Reader
 → buildAdventureAvatarPlan(reader, {parts,expression:"default"})（构建期一次）
 → validateAvatarPlan() + measureAvatarPlanDataBytes() <= 262144
 → 追加 record / struct.AdventureAvatarPlan / bootstrap（Plan 本体）
 → Bundle 原有唯一身份、稳定排序、Base64、哈希与写盘防护
```

`struct.AdventureAvatarPlan/bootstrap` 是**派生产物而非第二个素材源**，不写入 FSDB 目录；Value 是 AvatarPlanV1 本体，不包一层 `{avatarPlan}`。Map Frame 只读 bootstrap Record，然后 `data:{avatarPlan:record.value}` 初始化唯一 Actor，方向变化仅更新字符串 attrs，不重新读取 FSDB 或重新编译 Plan。

**最小 fail-closed 验证只针对选中闭包：** JSON/JSONL 语法合法（JSONL 允许一处终止换行，内部空行/纯空白行必须失败），选中 Part/Group 存在，Resource Group 的 `name` 与 Frame 的 `(action,frame)` 没有歧义重复，atlas image logical key 唯一且对应的 PNG 存在；Adapter 自身负责动作、redirect、anchors 和 Plan schema 检查。Bundle Builder 再从**最终发布 entries** 解码 Plan 和被引用 PNG，核对每个 `resource.namespace/key/contentVersion` 与实际 SHA-256 一致。资源缺失、版本矛盾或错误直接失败，不以空 Plan/透明图片替代。不为此功能新建全库 FSDB Integrity Validator，也不重复写 Actor 已有的 PNG 解码、裁剪、缓存和逐像素测试。

#### 4.1.3 测试责任与复用

现有 `components/cms-actor/test/adventure-adapter.test.mjs` 已直接读取这个 FSDB，验证 Avatar 组合、动作、装备及资源映射；`adventure-clock.test.mjs`、`adventure-chromium.test.mjs`、`integration.chromium.test.mjs` 已验证动画与 PNG/Presentation。Adapter 测试使用的 Record/Group 假版本不能代替正式 Content API 版本证据，因此本次**只扩展现有 Bundle 测试一个 round-trip 用例**（Plan 与 PNG 版本/身份/字节限制）以及改写 canonical PWA E2E 验证实际加载；不重写这些现有测试、不再造一份 synthetic 测试套件。旧 `test/pwa-avatar-fixture.mjs` 仍可作为独立历史测试，不参与 canonical PWA，也不强制为了“清理旧 fixture”而重构。


### 4.2 双工作区安装、构建顺序和发布策略（P0）

新的 `base` / `adventure-map` 需要 `@loomrealm/subsystem` 和 `@loomrealm-game/common-controls/subsystem`；产品 Bundle Builder 需要根工作区 `esbuild`。当前功能 PR 已引入上述 Workspaces、依赖与根 `package-lock.json`。**依赖方案固定如下，不在实现时临时改用 registry 包或 PokeMan 的 node_modules：**

- 根 `package.json` 增加 `workspaces: ["loom-realm/packages/*", "loom-realm/game-libs/*"]`，使固定 gitlink 中的 `packages/subsystem` 和 `game-libs/common-controls` 成为产品根工作区可解析的本地 workspace。
- 产品 `dependencies` 声明 `"@loomrealm/subsystem": "file:loom-realm/packages/subsystem"` 与 `"@loomrealm-game/common-controls": "0.1.0-alpha.0"`；后者由固定子模块 workspace 满足。
- 产品 `devDependencies` 声明 `"esbuild": "0.25.9"`，供根 `scripts/pwa/build-installation-bundle.mjs` 编译两个 Subsystem。
- 生成并提交产品根 `package-lock.json`。固定 submodule 自己的 `loom-realm/package-lock.json` 原样保留，用于 LoomRealm 自有构建工具、通用 PWA Builder 与 Playwright；两份 lockfile 职责不同。

固定 LoomRealm 在 [其根 package.json](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/package.json) 提供 `build:game-common-controls-input`，但该宽泛脚本在干净检出时还会类型检查未先构建的 game-package / Hostra 依赖。产品 CI **不直接调用它**，而是按固定 workspace 顺序先构建 Controls 所需的依赖与 common-controls。产品根工作区负责解析产品 Subsystem 和产品 esbuild；submodule 工作区仍负责通用 PWA Builder / Playwright。当前 [staging 预检](../../scripts/pwa/build-staging.mjs) 只在 `loom-realm/node_modules/esbuild` 或 `loom-realm/apps/pwa/node_modules/esbuild` 查找 esbuild，因此不能假设根 `node_modules/esbuild` 就满足 staging 前置条件。

**双锁安装必须在干净 checkout 中作为同一 CI Job 实测。** Node 22 / 固定 npm 10 工具链下先执行根 `npm ci --no-audit --no-fund`，再执行 `npm ci --prefix loom-realm --no-audit --no-fund`。这两次安装是否会因嵌套 workspace / hoisting 互相影响，不能只靠配置推断；必须验证根 workspace 链接、submodule 的 `node_modules/esbuild`、Controls 构建入口和 PWA Builder 都可用。若冲突，实施 PR 必须解决安装拓扑，不得删掉锁文件或改用未固定 registry 版本绕过。

**强制执行顺序：**

```text
checkout + 初始化固定 gitlink + 校验 gitlink SHA + Node 22 / npm 10
  → npm ci --no-audit --no-fund（产品根 package-lock.json）
  → npm ci --prefix loom-realm --no-audit --no-fund（固定 submodule lockfile）
  → npm run build --prefix loom-realm -w @loomrealm/foundation -w @loomrealm/wire \
      -w @loomrealm/shared-state -w @loomrealm/session-events \
      -w @loomrealm/platform-ports -w @loomrealm/runtime-control \
      -w @loomrealm/data -w @loomrealm/subsystem -w @loomrealm-game/common-controls
  → 校验 loom-realm/game-libs/game-common-controls/dist/browser/device-input.browser.js
  → 根 esbuild 编译 systems/base/subsystem.mjs 与 systems/adventure-map/subsystem.mjs
  → pwa:bundle：从现有 FSDB 只读发布角色闭包与派生 Plan Record，另发布 2 个 executable / 2 个 classic scripts
  → LoomRealm @loomrealm/pwa build:bundle → staging
  → Node 契约/安全测试 + cms-actor 测试 + canonical PWA Chromium / Service Worker E2E
```

**Controls 构建必须早于产品 `pwa:bundle`。** 产品 Bundle Builder 在此之前就要读取 `device-input.browser.js`。当前主线 `.github/workflows/pwa-ci.yml` 已在 `pwa:bundle` 前按上述最小 workspace 顺序构建，并检查最终 IIFE 非空；它不调用可能被未构建 Hostra/game-package 声明文件阻塞的 `build:game-common-controls-input`。随后 `@loomrealm/pwa` 构建自身依赖，再独立构建 `@loomrealm/game-launcher-hostra`。这是经干净 checkout 验证通过的当前门禁；不能把旧的宽泛脚本当作必须直接执行的 CI 命令。

产品构建器从根工作区 `import { build } from "esbuild"`。`EXECUTABLE_SOURCE_BINDINGS` 只允许两个受控源文件：`systems/base/subsystem.mjs`、`systems/adventure-map/subsystem.mjs`；每个入口以绝对路径调用 `build({ absWorkingDir: game, entryPoints: [entryPoint], bundle: true, format: "esm", platform: "browser", target: "chrome140", sourcemap: false, write: false })`，检查每次仅有一个有效输出，将输出绑定到对应 logical module，再按最终输出字节计算 SHA-256 和 `contentVersion`。不接收任意用户指定入口。

保留 `assertExecutableGraph` 的零外部导入图、禁止动态/越根导入和 Node-only API 规则。`CONTENT_SCRIPT_SOURCE_BINDINGS` 只允许固定的两个 classic script：`loom-realm/game-libs/game-common-controls/dist/browser/device-input.browser.js` 与 `components/cms-actor/browser/cms-actor.browser.js`；Controls IIFE 必须是固定 gitlink 构建出来的产物，不能发布 TypeScript 源码、扫描 dist 目录或临时复制到 Git 跟踪目录。保留 Content identity、MIME、哈希、白名单、引用完整性、输出路径防护、确定性和负例测试。

根 `presentation.json` 必须声明两份脚本，顺序为 Controls 在前、Actor 在后：`controls/device-input.browser.js` 与 `cms-actor/cms-actor.browser.js`。安装 Content 同时发布这两份 `resource.Presentation`、现有 `[FSDB]adventure` 所选 Part/Group/PNG 闭包，以及派生的 `struct.AdventureAvatarPlan/bootstrap`。不再写死旧 Look fixture 的 Content 数量 `24`；已预先调整的 CI staging 校验改为依据实际 Launch/Presentation manifest 和唯一 Content identity，闭包中的 Plan/PNG 版本只需一个 Bundle round-trip 用例。两个 executable、两个 Presentation scripts 与 Plan Record 都必须通过真实 builder 发布链路。

**CI 与 Issue Agent 权限边界：** Issue Agent Publisher 的受保护路径包含整个 `.github/**`，**Agent 无法提交工作流修改**。本设计分支已由维护方预置兼容 Smoke 和新 Base/Map 的 Workflow 迁移准备；只有此分支的准备 PR 合入 `main` 后才生效。后续发现确需额外调整 Workflow 时交给维护方，不让 Agent 在受保护文件上反复尝试。

**准备好的 CI 与本次功能实施责任：**

- `.github/workflows/pwa-ci.yml`：已预置仅在产品根锁文件存在时执行根 `npm ci`，保留固定 submodule `npm ci`；仅当 Presentation 声明 Controls 时，在 `pwa:bundle` 前构建 Controls IIFE。Agent 新增根锁文件并更新 manifest 后该路径自动启用，不需要 Agent 修改 Workflow。
- Workflow `paths`：已扩展为 `systems/**` 且覆盖根 `package-lock.json`；保留现有 `content/**`、`scripts/pwa/**`、`test/**`、`package.json`、Actor 及入口文件触发路径。Staging 校验也已去掉旧 Smoke 的硬编码数量；功能 PR 必须保留这些覆盖。
- `test/game-entry.test.mjs`：将 canonical `base` 与 legacy `apps/*` Smoke 分离；新增 Base → Map 参数原样透传、输入域开闭、Frame Outcome 与异常清理契约，不再强制所有历史入口等于 Smoke。
- 仅新增 **一个** `test/adventure-runtime.test.mjs`，通过 3 个集中场景覆盖 Base Frame/Producer 生命周期、Map 方向变换、Content 缺失/取消/同步投影失败。直接复用固定 Controls Tracker，不重写框架输入状态机测试。
- `test/pwa-bundle.test.mjs`：只迁移两个 executable、两份脚本和现有 FSDB 闭包的身份/哈希断言，增补一条 Plan/PNG Bundle round-trip；保留原有输出路径、符号链接、越权源和哈希安全负例，不复制安全测试框架。
- `test/pwa-staging.test.mjs`：只更新 `makeStagingFixture()` 的入口、两个 executable / scripts 与 FSDB 闭包/Plan identities，使现有 Staging 测试继续运行；不要新增另一套 stub-builder 或安全负例。
- `scripts/pwa/synthetic-avatar-content.mjs`、`test/pwa-avatar-fixture.mjs` 和旧 Look Adapter 可以继续作为独立的历史 fixture，**不必重写**；canonical PWA Builder 改从现有 `[FSDB]adventure` 取数。
- `test/pwa-browser.e2e.test.mjs`：改写旧 canonical Smoke 场景为**唯一** Base → Map → Actor PWA E2E：真实 ready/active、唯一 Actor 可见、可信 `page.keyboard.down/up`、动作与面向、松键、Resize。不要复制历史 Actor fixture 的逐像素/资源冲突/恢复测试；旧 Smoke `settled` 仅在隔离测试保留。
- 根 `package.json`：把新的 `test/adventure-runtime.test.mjs` 纳入现有 `npm test` Node 测试清单；**不要将 Chromium E2E 也放入根 `npm test`**，它由现有 PWA CI Browser 步骤单独执行。无失败、无意外跳过和至少一条成功用例的原有 CI 门禁不得放松。
- `docs/game-entry.md` 与 `README.md`：说明新的 canonical 入口，准确标注 legacy Smoke，不再把 Smoke 描述为正式应用入口。

不更新 gitlink，不提交第三方控制器文件、CMS079 客户端、WZ、真实 FSDB 或密钥，不改生产部署。

## 5. 精简测试范围和执行节奏

### 5.1 新功能只新增或改写五个核心场景

| 场景 | 测试归属 | 最小证明 |
|---|---|---|
| T1 Base 生命周期 | **新** `test/adventure-runtime.test.mjs` | Frame 参数透传、唯一 Producer 在子 Frame 活跃期间存在、返回/取消释放 |
| T2 Map 动作 | 同一个 runtime 文件 | 左右 walk/facing、up jump、down stand、松键恢复；复用 Controls Tracker，不做按键组合矩阵 |
| T3 Map 失败/取消 | 同一个 runtime 文件 | Content 不可用失败、Abort 取消、同步投影错误进入 failed 且清理 Consumer/Viewport/Domain |
| T4 FSDB → Bundle | **扩展现有** `test/pwa-bundle.test.mjs` 一个 focused case | 从现有 FSDB 闭包生成 Plan；从最终 Bundle 重新解码 Plan/PNG，校验唯一 identity、SHA-256、Plan 字节限制 |
| T5 正式浏览器 | **改写现有** `test/pwa-browser.e2e.test.mjs` canonical 场景 | Service Worker 内 Base → Map ready/active、唯一 Actor 画出非透明像素、可信键盘 down/up、动作/面向与实际 `data-action`（`stand1` / `walk1` / `jump`）、松键及 Resize 居中 |

**其他测试是“迁移断言和保留回归”，不是本 Issue 的新测试开发：** `game-entry.test.mjs` 和 `presentation.test.mjs` 修改旧 Smoke/单脚本断言；`pwa-staging.test.mjs` 修改 fixture；`pwa-bundle.test.mjs` 保留已有安全负例。Actor 的部件、帧时钟、PNG、缓存、冲突和复原已由 `components/cms-actor/test/**` 覆盖；统一 Controls 状态机由固定 LoomRealm 负责。**不要求**在新 E2E 再测全装备组合、截图像素矩阵、断线恢复和手柄硬件矩阵。

**硬边界：** 默认只允许新增 **一个 Node 测试文件**、一个 Bundle round-trip 用例、一个改写的 canonical Chromium 场景。缺陷确实触及当前切片的独立行为时才新增直接覆盖该缺陷的最小回归；不得为“以后也许需要”开大规模参数化测试、全库 FSDB Integrity Validator 或第二套浏览器 harness。

### 5.2 开发时按层运行，最终 CI 不减验收标准

| 阶段 | 测试操作 | 频率 |
|---|---|---|
| 快速反馈 | `node --test test/adventure-runtime.test.mjs`，涉及入口再跑 `test/game-entry.test.mjs`、`test/presentation.test.mjs` | 修改 Base/Map 时；无需浏览器 |
| 构建集成 | 运行受影响的 Bundle/Staging 测试及 T4；保留原有安全负例 | FSDB Reader 与 Bundle 接口稳定后；不每次小改都重新构建整个 PWA |
| 完整交付 | 根 `npm test`、现有 Actor 测试、正式 PWA Chromium / Service Worker E2E、Bundle 确定性与 Staging | 垂直切片实现齐备后完整执行；修复失败先跑针对性测试，再复跑最终门禁 |

真实输入只使用 Playwright `page.keyboard.down/up`，不通过 `dispatchEvent(new KeyboardEvent(...))` 伪造；完整 PWA 必须进入 active `ready` 状态，不能沿用旧 Smoke `settled`。CI `# fail 0`、`# skipped 0` 和至少一项 PASS 门禁不放松；未执行的检查不得宣称 PASS。Hostra 无安装验证时写 `BLOCKED`；实机手柄未测写 `DEVICE UNVERIFIED`，均不阻断 PWA。

### 5.3 唯一的 PWA 完成定义

Root Game Entry 启动 Base → Map；两个自包含 executable 和两份 classic scripts 经真实 Bundle 发布；FSDB 闭包加派生 Plan Record 的资源版本一致；唯一 Actor 正常绘制、方向变化只更新字符串 attrs、无世界位移、Resize 居中；Frame 取消和失败能清理资源；现有 Node、Actor、Bundle/Staging 安全回归和 canonical PWA E2E 都通过。**T1–T4 分别通过不等于完整垂直闭环，必须有 T5。**


## 6. 实施与 Issue Agent 交接

| 阶段 | 交付 | 验证 |
|---|---|---|
| A | Root Game Entry、Base/Map 两个唯一 Subsystem、Controls → Actor attrs、取消与清理 | T1–T3，更新已有入口/Presentation 断言 |
| B | 只读已有 `content/[FSDB]adventure` 最小角色闭包，正式 Adapter 构建 bootstrap Plan Record | T4；不改 FSDB、不生成 synthetic 素材 |
| C | 根 lockfile + pinned LoomRealm 构建、两个自包含 ESM、两个 classic scripts、Bundle/Staging 迁移 | 受影响的 Bundle/Staging 测试及现有安全回归 |
| D | 改写 canonical PWA E2E；全套最终 CI 验收 | T5 + 最终 CI 无失败、无意外跳过 |
| E（独立） | Hostra 实体验证 | 有证据则 PASS，否则 BLOCKED；不阻断 PWA |

### 6.1 Issue 启动前必须完成的两项准备

1. **先合入设计准备 PR 到 `main`，再触发功能 Issue Agent。** `scripts/issue_agent/agent.py` 的新 Issue preflight 当前从 `refs/heads/main` 为 `agent/issue-N` 选取基础 SHA，不会自动读取设计分支。若不先合入，Agent 初始 checkout 中没有这份最新文档，容易按照旧 Smoke/旧 synthetic 方案返工。Issue 正文应明确链接已合入 `main` 的本文件。
2. **Workflow 修改由维护方提前提交，而不是交给 Agent。** Issue Agent Publisher 明确将 `.github/**` 设为受保护目录。此设计分支的 `pwa-ci.yml` 已预置新 `systems/**`、根锁文件触发、条件 Controls 构建及随 manifest 更新的 staging 预检，同时保留旧 Smoke 可用；合入 `main` 后，Agent 的功能 PR 可以仅修改允许发布的 `systems/**`、`subsystems/**`、`scripts/pwa/**`、`test/**`、`package.json`、`package-lock.json` 和 manifests。若确需额外 Workflow 调整，应报告维护方另行提交，不绕过保护规则。

### 6.2 给 Agent 的完整但有边界的实施指令

> 按本文件步骤 A–D 完成 **Base → Adventure Map → cms-actor** 的 PWA 垂直切片。Avatar 数据直接只读现有 `content/[FSDB]adventure`，以正式 `buildAdventureAvatarPlan()` 派生一个 bootstrap Plan；不创建 synthetic 数据生成器。新增测试严格以第 5 节的 T1–T5 为边界，复用现有 Actor/Bundle/Staging 测试，不重复底层测试框架。开发中分层运行针对性测试，交付前执行完整 CI。不要修改 `.github/**`、LoomRealm gitlink、研究数据、真实 WZ 或部署配置。报告执行过的命令、最终 PASS/FAIL/BLOCKED 证据及未完成事项；失败时保留最小可复现证据和现有 Draft PR。

### 6.3 不允许重新设计的边界

- LoomRealm Controls 是唯一输入 Producer；Base 持有它，Map 作为 Top Active Frame 消费，Actor 仅渲染。
- 两个 Subsystem 各一份业务源码，根 Hostra shim 只透传；旧 `apps/*` Smoke 不复制四份实现。
- FSDB 是唯一 Avatar 素材源；正式 Adapter 是唯一 Plan 算法；只选单角色闭包。Actor 不解释输入、Map 不承担 PNG/遮挡逻辑。
- `attrs.x/y/locomotion/facing` 为字符串；动作与朝向不触发世界坐标/物理位移，Viewport resize 仍居中。
- 不升级 LoomRealm、不修改 Issue Agent 权限规则、不开发新的装备/动画/手柄输入系统。
- PWA 是唯一硬验收；Hostra 与实机 D-pad 独立记录资格，不冒充通过。

**状态：Draft / 设计与 CI 准备就绪；需先将准备 PR 合入 main，再启动 Issue Agent。** 运行代码与浏览器测试尚未实施，任何 PASS 均须以实际 CI 结果为据。
