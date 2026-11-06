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
       └─ await frame.call("adventure-map", null)
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
      zIndex: 10,
      roots: [{
        key: "game-controls-input",
        tag: "game-controls-input",
        attrs: {},
        data: {},
        children: []
      }]
    });
    try {
      return await frame.call("adventure-map", null);
    } finally {
      controls.close();
    }
  }
}));
```

父 Frame 在子 Frame 活跃期间持续持有输入组件；子 Frame 结束、失败或取消时由 `finally` 关闭。**不**同时挂载 `game-keyboard-input` 与 `game-gamepad-input`，避免同一物理按键在原始频道和统一频道形成重复输入。

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

根 [PWA Bundle Builder](../../scripts/pwa/build-installation-bundle.mjs) 的 `CONTENT_SCRIPT_SOURCE_BINDINGS` 加入前者的**受控固定路径**，而非扫描任何 dist 目录或临时复制到 Git 跟踪目录。保留 classic script 语法、Content identity、MIME、哈希、白名单和引用完整性校验。**只安装 npm 包不会注册 Web Component**，不发布脚本也不会采集输入。

此版本的 [统一输入契约](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/game-libs/game-common-controls/game-controls-input.md) 将 `ArrowUp/Down/Left/Right` 与兼容手柄 **D-pad** 归一化为 `up/down/left/right`；**模拟摇杆轴不产生方向值**。设备支持以固定版本实现为准：standard mapping，以及明确定义的已验证设备例外；非受支持的手柄不能宣称通过。输入仅在窗口可用、键盘捕获允许时生效；消费者不要使用 `dispatchEvent(new KeyboardEvent(...))` 验证真实采集，因为非可信键盘事件会被忽略。

### 3.2 Adventure Map 控制契约

`adventure-map` 进入活跃 Frame 后，使用两个现成公开函数，而非自建 held-key 状态机：

```js
import { defineSubsystem, cancelled, failed } from "@loomrealm/subsystem";
import {
  createControlsConsumer,
  createDirectionalControlsTracker
} from "@loomrealm-game/common-controls/subsystem";

const directions = createDirectionalControlsTracker();
const consumer = createControlsConsumer(
  scope.presentationEvents,
  frame,
  {
    onState(state) {
      directions.acceptState(state);
      applyDirection(directions.direction);
    },
    onEvent(event) {
      directions.acceptEvent(event);
      applyDirection(directions.direction);
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

**Frame 生命周期必须封闭：**

1. `Content` 读取成功且尚未取消 → 创建 RenderDomain → 注册 Viewport 订阅和 Controls Consumer；在订阅后立即处理 `viewport.current`，避免遗漏首个尺寸。
2. 第一版无自然游戏结束条件，Frame 保持活跃直到 `frame.signal` 取消；不能在初始化之后立即返回 `completed`，否则输入和 Renderer 很快被关闭。
3. `try/finally` 统一关闭 Controls Consumer、Viewport 订阅和 RenderDomain；包含初始化中途抛错、Frame 被取消和正常退出。关闭后回调不得再调用 `domain.update`；必要时用本地 `closed` 标记抑制迟到回调。
4. Base 的 `finally` 随 `frame.call` 结束再关闭输入 Producer；资源解码与 Canvas 清理由 `cms-actor` 断开生命周期负责。

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

目前 `buildAvatarPlan` 适配器位于 `components/cms-actor/test/look-adapter.mjs`。**明确决策：只做一次小型抽取**——迁至 `content/build-avatar-plan.mjs`，原 test adapter 作为测试兼容转发/导入；`scripts/pwa/synthetic-avatar-content.mjs` 改为导入正式构建模块。**不**新增运行时 Adapter、Avatar Repository、泛用 Content 索引或真实素材流水线。现有 `test/pwa-avatar-fixture.mjs` 仍为单独测试，禁止作为正式 Subsystem。

### 4.2 构建顺序和发布策略（P0）

新的 `base` / `adventure-map` 需要 `@loomrealm/subsystem` 和 `@loomrealm-game/common-controls/subsystem`，当前 Adventure Island 根 `package.json` 不含依赖/workspaces。必须参考 [PokeMan 产品侧构建](https://github.com/lithdoo-labs/pokeman/blob/main/scripts/pwa/build-installation-bundle.mjs) 配置根 npm workspaces/本地依赖、锁定 lockfile、明确可重复的 CI 安装和构建链。

**强制执行顺序：**

```text
checkout + 精确 gitlink 校验
  → 安装根工程/固定 LoomRealm 的锁定依赖
  → 构建需用的 @loomrealm/* 依赖及 @loomrealm-game/common-controls
  → 取得 common-controls dist/browser/device-input.browser.js
  → esbuild(bundle=true, format=esm, platform=browser) 两个 Subsystem
  → 生成 installation-bundle（2 executable + 2 classic scripts + synthetic Content）
  → 通用 LoomRealm PWA Builder → staging
  → root 契约测试 + canonical Chromium/Service Worker E2E
```

实作时要按 npm workspace 依赖拓扑确定具体命令，并在全新 CI checkout 使用锁定依赖验证；不能混用两套未经验证的 `node_modules` 解析假设。`pwa:bundle` 本身不得静默读取尚未构建的 Controls 文件；缺失即明确失败并提示依赖构建。

调整 `EXECUTABLE_SOURCE_BINDINGS` 为两个受控源文件（`systems/base/subsystem.mjs`、`systems/adventure-map/subsystem.mjs`），再编译为**自包含 executable**。保留现有 `assertExecutableGraph` 的零外部导入图、禁止动态/越根导入和 Node-only API 规则，打包后才计算 `sha256` 和 `contentVersion`。`CONTENT_SCRIPT_SOURCE_BINDINGS` 的 Controls 产物路径也必须受白名单约束。保留已经有的资源引用完整性、输出路径防护、确定性和负例测试，不迁入 LoomRealm `examples`。

根 `presentation.json` 要有两项脚本；Content 要在旧合成内容基础上新增**一个 Controls 脚本 + 一个 AvatarPlan Record**。所有写死旧 Content 数量 `24`、单 executable、`subsystems/smoke.mjs` 的断言均应更新，不能只改 `game.json`。

**CI 必改的文件/约定：**

- `.github/workflows/pwa-ci.yml`：在 `npm run pwa:bundle` 前构建所需依赖和 Controls IIFE，执行根工程的确定性安装；保留准确 gitlink、研究素材隔离、无 skip 的测试门禁。
- Workflow `paths`：由 `systems/loomrealm-smoke/**` 扩展至 `systems/**`，覆盖 `content/**`、`package-lock.json` 及新建的实现/打包测试。文档 PR 可按流程手动触发；代码 PR 不得因路径过滤绕过 E2E。
- `test/game-entry.test.mjs`：将 canonical `base` 与 legacy `apps/*` Smoke 的测试分离，不再强制三份 Game Entry 等于 Smoke；新增 Base → Map 调用契约。
- `test/pwa-bundle.test.mjs`、`test/pwa-browser.e2e.test.mjs`：更新数量/身份/发布白名单与正式启动期望；过去 Smoke 单 Frame `settled` 的预期改为持久活跃的可交互状态（以 pinned Runtime 实际观测为准）。
- `docs/game-entry.md` 和 `README.md`：描述新的 canonical 入口，准确标注过渡 Smoke 文件，不保留陈旧的 Smoke 作为正式应用的说明。

不更新 gitlink，不提交第三方控制器文件、CMS079 客户端、WZ、真实 FSDB 或密钥，不改生产部署。

## 5. 验收矩阵与故障闭环

| 范围 | 必须验证 | 合格证据 |
|---|---|---|
| Game Entry | `base` 是初始 Frame；它打开 `adventure-map` 并在子 Frame 活跃时保持输入组件 | Frame/RenderDomain 单元契约 |
| 脚本/Content | 两份 classic script 均进入 Presentation 与发布 Content；组件已注册且非 `data-input-disabled=duplicate` | staging Bundle 引用 + 真浏览器断言 |
| Input | `ArrowLeft/Right/Up/Down` 真实 down/up；组合按键、释放、blur/stale reset；D-pad 统一方向 | Controls 单测 + Chromium `page.keyboard.down/up` + 手柄仿真 |
| Actor | `stand1 / walk1 / jump` 与 facing 正确，松开恢复；无世界位移；Viewport resize 仍居中 | Chromium 实际 `data-action`/`data-render-state` 与像素/位置验证 |
| Render/Content | AvatarPlan 正确，资源哈希一致，PNG 真加载；方向变化不重发 Plan | 根 Content 合法性、DOM 观察、RenderDomain update 断言 |
| 生命周期 | Frame 中止后 Consumer、Viewport 订阅、Map Domain 及 Base Domain 关闭；无迟到修改 | 主动取消/异常分支单测与 PWA E2E |
| 构建回归 | 两个 self-contained executable、哈希/白名单正确、确定性/安全路径测试通过，原 Actor fixture 可运行 | CI 中重新构建 + 完整 `npm test` + 无跳过 Chromium |

**特别约定：** 新 `game-controls-input` 检查 `isTrusted`，自动化集成必须使用 Playwright 的真实键盘操作，而不是 `page.evaluate(() => dispatchEvent(...))` 伪造事件。测试先验证页面已可交互再发输入；非激活 Frame 的早到事件不能要求重放。

**验收报告必须区分：**

- **PWA：** `PASS` 仅当 canonical PWA 的真实端到端输入、Content、Actor、取消清理通过；旧 `test/pwa-avatar-fixture.mjs` 单独通过不足以认定达标。
- **手柄：** 可通过 deterministic Controls/D-pad 注入证明映射；实机控制器测试未做时写 `DEVICE UNVERIFIED`，不得写“实机已通过”。模拟摇杆属于明确的非目标。
- **Hostra：** `launch.hostra.json` 配置同构不等于正式运行成功。若没有相同逻辑身份的 synthetic FSDB/Content 及其可重放安装/启动过程，验收写 `BLOCKED`；可另开任务建立 Desktop Content 安装，不阻断本次 PWA 切片。

## 6. 实施边界与交付顺序

| 步骤 | 唯一交付 | 退出条件 |
|---|---|---|
| A | 根 Game Entry、两个唯一 Subsystem、根绑定与测试迁移 | Base → Map Frame 与输入域生命周期可测 |
| B | Controls 浏览器脚本注册、受控发布、输入 Tracker → Actor attrs、Viewport | 键盘/方向状态单测，唯一 Actor 正确投影 |
| C | 将现有构建期 AvatarPlan 正式发布为 Record；清理 test adapter 依赖 | 合成资源经 Content 可读取、哈希与大小合格 |
| D | 根依赖/锁文件、两个自包含 Bundle、CI 顺序和真实 canonical PWA E2E | 完成第 5 节 PWA 全部 PASS |
| E（独立） | Hostra synthetic Content 准备与实体运行验证 | 有证据则 PASS，否则清楚标 BLOCKED |

**不要把步骤 A–D 拆成分别“宣布功能完成”的里程碑；只有 D 通过才形成真正的 PWA 垂直闭环。** 后续可玩场地要另行实现独立的横版物理 Game Library；当前 `adventure-map` 的动作状态仅是未来领域移动意图到 RenderNode 的最简替身。

### 设计决策已固定

- 用 LoomRealm **统一 Controls**，不再自建键盘/手柄监听器。
- `base` 管理唯一 Producer，`adventure-map` 作为 Top Active Frame 管理 Consumer；`cms-actor` 不变。
- 两个业务 Subsystem 各一份源码；根入口为 shim；`apps/*` Smoke 保持 legacy，不复制四份新源码。
- 仅合成素材、构建期一次 AvatarPlan 派生、Content Record；不进行 WZ/FSDB 重导入。
- PWA 为本次硬验收；Hostra 作为独立平台资格，不以静态 manifest 假冒完成。
- 仅在 Adventure Island 仓库实现，不升级 `loom-realm`，不开发 PokeMan 专属 Map/Battle。

**状态：待编码与资格验证。** 文档明确了最低工作集与验收条件；任何 `PASS` 都必须附实际 CI/浏览器执行证据，不能从草案推断。
