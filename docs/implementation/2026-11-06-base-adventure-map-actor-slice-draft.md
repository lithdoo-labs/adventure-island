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

- 开始时从 `scope.content.record("struct.AdventureAvatarPlan", "bootstrap", { signal: frame.signal })` 读取**Plan 本体**；失败返回明确的 `failed({ code: "ADVENTURE_AVATAR_CONTENT_UNAVAILABLE" })`，取消返回 `cancelled()`。不要吞掉错误后展示空 Actor。
- 初始化一次 `scope.createRenderDomain({ zIndex: 0, roots: [ { key: "adventure-player", tag: "cms-actor", attrs: {...}, data: { avatarPlan }, children: [] } ] })`，Actor 的稳定 key 不复用为新节点。初始 `locomotion=stand`、`facing=right`；外观 attrs 继续遵循 [cms-actor 既有契约](../../components/cms-actor/IMPLEMENTATION.md)。
- `cms-actor` 的 `x/y` 是身体原点（接近脚底），不是 sprite 中心或世界坐标。演示期通过 `scope.viewport.current`、`subscribe` 更新 `x=round(width/2)`、`y=round(height/2+16)`；`+16` 是仅对当前合成图有效的待验证视觉偏移，不属于领域常量。Viewport 为 `null`、无效或零尺寸时不更新。首次有效尺寸及 resize 都需要验证。
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

**最小 fail-closed 验证只针对选中闭包：** JSON/JSONL 语法合法，选中 Part/Group 存在，Resource Group 的 `name` 与 Frame 的 `(action,frame)` 没有歧义重复，atlas image logical key 唯一且对应的 PNG 存在；Adapter 自身负责动作、redirect、anchors 和 Plan schema 检查。Bundle Builder 再从**最终发布 entries** 解码 Plan 和被引用 PNG，核对每个 `resource.namespace/key/contentVersion` 与实际 SHA-256 一致。资源缺失、版本矛盾或错误直接失败，不以空 Plan/透明图片替代。不为此功能新建全库 FSDB Integrity Validator，也不重复写 Actor 已有的 PNG 解码、裁剪、缓存和逐像素测试。

#### 4.1.3 测试责任与复用

现有 `components/cms-actor/test/adventure-adapter.test.mjs` 已直接读取这个 FSDB，验证 Avatar 组合、动作、装备及资源映射；`adventure-clock.test.mjs`、`adventure-chromium.test.mjs`、`integration.chromium.test.mjs` 已验证动画与 PNG/Presentation。Adapter 测试使用的 Record/Group 假版本不能代替正式 Content API 版本证据，因此本次**只扩展现有 Bundle 测试一个 round-trip 用例**（Plan 与 PNG 版本/身份/字节限制）以及改写 canonical PWA E2E 验证实际加载；不重写这些现有测试、不再造一份 synthetic 测试套件。旧 `test/pwa-avatar-fixture.mjs` 仍可作为独立历史测试，不参与 canonical PWA，也不强制为了“清理旧 fixture”而重构。


### 4.2 双工作区安装、构建顺序和发布策略（P0）

新的 `base` / `adventure-map` 需要 `@loomrealm/subsystem` 和 `@loomrealm-game/common-controls/subsystem`；产品 Bundle Builder 需要根工作区 `esbuild`。当前 Adventure Island 根 `package.json` 尚无 Workspaces、上述依赖或根 `package-lock.json`。**依赖方案固定如下，不在实现时临时改用 registry 包或 PokeMan 的 node_modules：**

- 根 `package.json` 增加 `workspaces: ["loom-realm/packages/*", "loom-realm/game-libs/*"]`，使固定 gitlink 中的 `packages/subsystem` 和 `game-libs/common-controls` 成为产品根工作区可解析的本地 workspace。
- 产品 `dependencies` 声明 `"@loomrealm/subsystem": "file:loom-realm/packages/subsystem"` 与 `"@loomrealm-game/common-controls": "0.1.0-alpha.0"`；后者由固定子模块 workspace 满足。
- 产品 `devDependencies` 声明 `"esbuild": "0.25.9"`，供根 `scripts/pwa/build-installation-bundle.mjs` 编译两个 Subsystem。
- 生成并提交产品根 `package-lock.json`。固定 submodule 自己的 `loom-realm/package-lock.json` 原样保留，用于 LoomRealm 自有构建工具、通用 PWA Builder 与 Playwright；两份 lockfile 职责不同。

固定 LoomRealm 在 [其根 package.json](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/package.json) 提供 `build:game-common-controls-input`，并按其既有 workspace 顺序构建 framework 与 common-controls。产品根工作区负责解析产品 Subsystem 和产品 esbuild；submodule 工作区仍负责通用 PWA Builder / Playwright。当前 [staging 预检](../../scripts/pwa/build-staging.mjs) 只在 `loom-realm/node_modules/esbuild` 或 `loom-realm/apps/pwa/node_modules/esbuild` 查找 esbuild，因此不能假设根 `node_modules/esbuild` 就满足 staging 前置条件。

**双锁安装必须在干净 checkout 中作为同一 CI Job 实测。** Node 22 / 固定 npm 10 工具链下先执行根 `npm ci --no-audit --no-fund`，再执行 `npm ci --prefix loom-realm --no-audit --no-fund`。这两次安装是否会因嵌套 workspace / hoisting 互相影响，不能只靠配置推断；必须验证根 workspace 链接、submodule 的 `node_modules/esbuild`、Controls 构建入口和 PWA Builder 都可用。若冲突，实施 PR 必须解决安装拓扑，不得删掉锁文件或改用未固定 registry 版本绕过。

**强制执行顺序：**

```text
checkout + 初始化固定 gitlink + 校验 gitlink SHA + Node 22 / npm 10
  → npm ci --no-audit --no-fund（产品根 package-lock.json）
  → npm ci --prefix loom-realm --no-audit --no-fund（固定 submodule lockfile）
  → npm run build:game-common-controls-input --prefix loom-realm
  → 校验 loom-realm/game-libs/game-common-controls/dist/browser/device-input.browser.js
  → 根 esbuild 编译 systems/base/subsystem.mjs 与 systems/adventure-map/subsystem.mjs
  → pwa:bundle：生成 2 个自包含 executable、2 个 Presentation classic scripts、synthetic Content 与 AvatarPlan Record
  → LoomRealm @loomrealm/pwa build:bundle → staging
  → Node 契约/安全测试 + cms-actor 测试 + canonical PWA Chromium / Service Worker E2E
```

**Controls 构建必须早于产品 `pwa:bundle`。** 当前 CI 只在 `npm run build:bundle --prefix loom-realm --workspace @loomrealm/pwa` 阶段间接构建 common-controls；但产品 Bundle Builder 在此之前就需要读取 `device-input.browser.js`。因此 `.github/workflows/pwa-ci.yml` 必须在 `npm run pwa:bundle` 之前显式执行 `npm run build:game-common-controls-input --prefix loom-realm` 并检查产物存在。随后 LoomRealm 自己的 `build:bundle` 仍按 pinned API 执行；它内部可能再次构建依赖，这是上游发布流程，不得用产品 esbuild 编译替代。

产品构建器从根工作区 `import { build } from "esbuild"`。`EXECUTABLE_SOURCE_BINDINGS` 只允许两个受控源文件：`systems/base/subsystem.mjs`、`systems/adventure-map/subsystem.mjs`；每个入口以绝对路径调用 `build({ absWorkingDir: game, entryPoints: [entryPoint], bundle: true, format: "esm", platform: "browser", target: "chrome140", sourcemap: false, write: false })`，检查每次仅有一个有效输出，将输出绑定到对应 logical module，再按最终输出字节计算 SHA-256 和 `contentVersion`。不接收任意用户指定入口。

保留 `assertExecutableGraph` 的零外部导入图、禁止动态/越根导入和 Node-only API 规则。`CONTENT_SCRIPT_SOURCE_BINDINGS` 只允许固定的两个 classic script：`loom-realm/game-libs/game-common-controls/dist/browser/device-input.browser.js` 与 `components/cms-actor/browser/cms-actor.browser.js`；Controls IIFE 必须是固定 gitlink 构建出来的产物，不能发布 TypeScript 源码、扫描 dist 目录或临时复制到 Git 跟踪目录。保留 Content identity、MIME、哈希、白名单、引用完整性、输出路径防护、确定性和负例测试。

根 `presentation.json` 必须声明两份脚本，顺序为 Controls 在前、Actor 在后：`controls/device-input.browser.js` 与 `cms-actor/cms-actor.browser.js`。安装 Content 同时发布这两份 `resource.Presentation`、合成 Avatar Content 所需 records/groups/PNG resources，以及 `struct.AdventureAvatarPlan/bootstrap`。不再写死旧 Look fixture 的 Content 数量 `24`；测试应验证完整身份集合、无重复项和引用闭合，而不是只替换一个计数常量。两个 executable、两个 Presentation scripts 与 Plan Record 都必须通过真实 builder 发布链路。

**CI 必改文件与约定：**

- `.github/workflows/pwa-ci.yml`：增加产品根 `npm ci`，保留固定 submodule `npm ci`；在 `pwa:bundle` 前构建 Controls IIFE；保留 LoomRealm `build:bundle`、gitlink 精确校验、研究素材隔离和无 skip 测试门禁。
- Workflow `paths`：由仅覆盖 `systems/loomrealm-smoke/**` 扩展为 `systems/**`，并覆盖 `content/**`、根 `package.json`、根 `package-lock.json`、`scripts/pwa/**`、`components/cms-actor/src/**` 与新增测试。代码 PR 不得因路径过滤绕过 canonical PWA E2E。
- `test/game-entry.test.mjs`：将 canonical `base` 与 legacy `apps/*` Smoke 分离；新增 Base → Map 参数原样透传、输入域开闭、Frame Outcome 与异常清理契约，不再强制所有历史入口等于 Smoke。
- 新增 Base / Map Subsystem 契约测试：覆盖父 Frame 持有 Producer、子 Frame 作为 Top Active Frame 接收 Controls、Tracker 状态变化、RenderDomain 更新、Content 读取失败、取消优先与同步投影错误终止。
- `test/pwa-bundle.test.mjs`：更新两个 executable、两份脚本、正式 Avatar Content schema 与 Plan Record 的白名单/identity/哈希断言；隔离负例可通过明确 builder 注入接口提供测试用自包含 executable 和 Controls 哑脚本，但不得将其称为真实编译集成测试。
- `test/pwa-staging.test.mjs`：更新 `makeStagingFixture()`，使其包含新的 Game Entry、两个 logical modules、两份 Presentation scripts、正式 synthetic Avatar Content 与 Plan Record；保留 Gitlink、符号链接/受保护路径、错误回滚和失败时无写入断言。真实集成测试必须使用生产构建路径。
- `scripts/pwa/synthetic-avatar-content.mjs` 与 `test/pwa-avatar-fixture.mjs`：改用正式 `buildAdventureAvatarPlan()` 生成的 Plan 和正式 Content schema；fixture 可继续作为隔离 Renderer 测试夹具，但不得被误认为 canonical Subsystem。
- `test/pwa-browser.e2e.test.mjs`：增加 canonical `base → adventure-map` PWA E2E；真实验证 Presentation 注册、Plan Record 读取、PNG 加载、可信键盘 down/up、松键状态、Viewport resize、Frame 取消和资源回收。旧 Smoke `settled` 断言仅留在隔离 Smoke 测试。
- 根 `package.json`：当前 `test` 是显式文件清单，必须把 Base/Map 单测、Bundle/Staging 回归和 PWA Chromium E2E 纳入明确的 CI 命令；不能只新增测试文件而不执行。CI 显式检查 `# fail 0`、`# skipped 0` 和至少一个通过用例。
- `docs/game-entry.md` 与 `README.md`：说明新的 canonical 入口，准确标注 legacy Smoke，不再把 Smoke 描述为正式应用入口。

不更新 gitlink，不提交第三方控制器文件、CMS079 客户端、WZ、真实 FSDB 或密钥，不改生产部署。

## 5. 验收矩阵与故障闭环

| 范围 | 必须验证 | 合格证据 |
|---|---|---|
| Game Entry | `base` 是初始 Frame；它打开 `adventure-map` 并在子 Frame 活跃时保持唯一输入 Producer | Frame / RenderDomain 单元契约，父子 Frame 参数与 Outcome 测试 |
| Controls 脚本 | Controls IIFE 在 Actor script 前注册；只有一个 `game-controls-input` 活动实例，非重复注册 | Presentation manifest、staging Bundle 引用、真实浏览器 `customElements` 与 duplicate 状态断言 |
| Input | `ArrowLeft/Right/Up/Down` 真实 down/up；组合按键、释放、blur/stale reset；D-pad 映射；Consumer 首次同步空 State | 固定 Controls 单测 + Chromium `page.keyboard.down/up`；实机手柄未测不得宣称通过 |
| FSDB / Content identity | FSDB 表路径映射到固定 `record/group/resource` namespace/key；不向业务暴露物理路径；宽松 `.info.meta` 不得冒充 Integrity-valid | namespace/key 对照、严格 schema、重复 row/key、引用闭合与 atlas crop bounds 负例 |
| Avatar Content | 合成 fixture 遵循正式 `avatar.Part/PartFrame/Resource/DrawOrder/LayerSlot` 契约；正式 Adapter 生成 Plan；Plan Record value 为本体 | Adapter 单测、Reader 形状、Plan Record round-trip、Bundle identity / SHA-256 / 字节上限断言 |
| Resource version | Plan 每个 layer 的 resource key/version 与 Bundle PNG 精确一致；运行时按 expectedContentVersion 读取 | PNG bytes hash、MIME/解码/裁剪边界、Content version mismatch 必须拒绝 |
| Actor | `stand1 / walk1 / jump` 与 facing 正确，松开恢复；无世界位移；Viewport resize 仍居中 | Chromium 实际 `data-action` / `data-render-state` 与像素/位置验证 |
| Render / Resource | Plan 每个 layer 的 resource identity 和 `contentVersion` 精确匹配已发布 PNG；方向变化不重发 Plan | 根 Content 合法性、PNG 真加载、DOM 观察、RenderDomain update 断言 |
| 生命周期 / 故障 | Frame 中止后 Consumer、Viewport 订阅、Map Domain 及 Base Domain 关闭；Callback 中 RenderDomain 失败不会被 Consumer 静默吞掉；取消优先 `cancelled`；Renderer 资源失败不冒充 Worker `failed` | 同步空 State、Viewport 异常、主动取消/致命投影失败单测与 canonical PWA E2E |
| 构建 / CI | 双 lockfile 安装、Controls 先构建、两个自包含 executable、两个 classic scripts、正式 synthetic Content、确定性/安全路径与 Staging fixture 通过 | 干净 CI checkout；根与 submodule 两次 `npm ci`；完整测试命令无 skip；canonical Chromium / Service Worker E2E |

**特别约定：** 新 `game-controls-input` 检查 `isTrusted`，自动化集成必须使用 Playwright 的真实键盘操作，而不是 `page.evaluate(() => dispatchEvent(new KeyboardEvent(...)))` 伪造事件。测试先验证页面已可交互再发输入；非激活 Frame 的早到事件不能要求重放。

**验收报告必须区分：**

- **PWA：** `PASS` 仅当 canonical PWA 的真实端到端输入、正式 Avatar Adapter 生成的 synthetic Plan、Content、Actor、取消清理全部通过；旧 `test/pwa-avatar-fixture.mjs` 或 cms-actor 单测单独通过不足以认定达标。
- **手柄：** 可通过 deterministic Controls / D-pad 注入证明映射；实机控制器测试未做时写 `DEVICE UNVERIFIED`，不得写“实机已通过”。模拟摇杆属于明确的非目标。
- **Hostra：** `launch.hostra.json` 配置同构不等于正式运行成功。若没有相同逻辑身份的 synthetic Content 及其可重放安装/启动过程，验收写 `BLOCKED`；可另开任务建立 Desktop Content 安装，不阻断本次 PWA 切片。

## 6. 实施边界与交付顺序

| 步骤 | 唯一交付 | 退出条件 |
|---|---|---|
| A | 根 Game Entry、两个唯一 Subsystem、根绑定；Base 参数透传/投影故障/取消单测迁移 | Base → Map Frame 与输入域生命周期、错误终止可测 |
| B | Controls 浏览器脚本注册、受控发布、输入 Tracker → Actor attrs、Viewport | 可信键盘输入、方向状态、唯一 Actor 与居中单测可测 |
| C | 将 PWA synthetic Content 迁移到正式 `avatar.Part` schema；补齐 FSDB → Content identity / Reader 契约；构建期调用正式 `buildAdventureAvatarPlan()` 一次并发布 `struct.AdventureAvatarPlan/bootstrap` | 严格 preflight 规则、Reader 版本形状、Plan/PNG 引用与 SHA-256、262,144 字节限制通过；生产构建不导入 `components/cms-actor/test/**`；明确不包含真实 WZ 导入 |
| D | 根 / 固定 submodule 双 lockfile 安装、Controls 先构建、两个自包含 executable、两份 Presentation scripts、更新 Staging/Actor fixture 与 CI、canonical PWA E2E | 完成第 5 节 PWA 全部 PASS |
| E（独立） | Hostra synthetic Content 准备与实体运行验证 | 有证据则 PASS，否则清楚标 BLOCKED |

**不要把步骤 A–D 拆成分别“宣布功能完成”的里程碑；只有 D 通过才形成真正的 PWA 垂直闭环。** 后续可玩场地要另行实现独立的横版物理 Game Library；当前 `adventure-map` 的动作状态仅是未来领域移动意图到 RenderNode 的最简替身。

### 设计决策已固定

- 用 LoomRealm **统一 Controls**，不再自建键盘/手柄监听器。
- `base` 管理唯一 Producer，`adventure-map` 作为 Top Active Frame 管理 Consumer；`cms-actor` 负责渲染，不接收输入。
- 两个业务 Subsystem 各一份源码；根入口为 shim；`apps/*` Smoke 保持 legacy，不复制四份新源码；Base 原样透传 `frame.params`，输入域沿用 `zIndex: 0`。
- AvatarPlan 只使用 `components/cms-actor/src/adventure-adapter.mjs` 的正式 `buildAdventureAvatarPlan()` 与 `avatar-model.mjs` 校验；不新增 `content/build-avatar-plan.mjs`，不从旧 `test/look-adapter.mjs` 派生第二套算法。
- PWA 合成数据采用正式 `avatar.Part/PartFrame/Resource/DrawOrder/LayerSlot` schema，构建期生成 PNG 与 Plan Record；生产构建路径不导入 `components/cms-actor/test/**`，不进行 WZ/真实 FSDB 重导入。
- 产品根 package-lock 与固定 LoomRealm 原有 lockfile 分别执行 `npm ci`；Root Workspaces + 本地 pinned 包解析；Controls IIFE 必须先于产品 `pwa:bundle` 构建；双安装和构建顺序须由干净 CI 证明。
- PWA 为本次硬验收；Hostra 作为独立平台资格，不以静态 manifest 假冒完成。
- 仅在 Adventure Island 仓库实现，不升级 `loom-realm`，不开发 PokeMan 专属 Map/Battle。

**状态：Draft / 待编码与资格验证。** 本次文档修订已将设计基线更新到 `main@6e551a9`，并按现有 Actor 正式实现收敛 AvatarPlan 管线；文档不代表实现已完成。任何 `PASS` 都必须附实际 CI/浏览器执行证据，不能从草案推断。
