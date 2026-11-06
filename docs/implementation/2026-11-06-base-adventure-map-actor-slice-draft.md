# Adventure Island 基础运行切片：Base → Adventure Map → Actor（草案）

> 状态：**Draft / 仅供评审，尚未实施**
>
> 日期：2026-11-06
>
> 仓库：`lithdoo-labs/adventure-island`
>
> 设计基线：`main@a1992512ac62a40595c3e7ca812363d1112ae043`
>
> LoomRealm 固定 gitlink：`93648192323bf5f57996b7b54cbae641d8a53fdb`；**此任务不得顺带升级 submodule**。

## 1. 目标与范围

在现有 canonical Game Entry 的 Smoke 启动链上引入两个正式 Subsystem：

1. **`base`** 作为初始 Subsystem，创建并持有一个 `game-controls-input` 组件，将键盘、手柄统一映射为 LoomRealm Controls 输入。
2. **`adventure-map`** 由 `base` 通过 `frame.call("adventure-map", null)` 打开；持有一个 RenderDomain，向 Renderer 投影唯一的 `cms-actor`。
3. Actor 使用仓库已有的**合成纸娃娃素材**与 `AvatarPlanV1`，初始站立，并固定在当前视口的视觉中心。
4. Adventure Map 在活跃 Frame 中接收规范化方向输入，仅更新 Actor 的 `locomotion` / `facing`。不执行地图物理或世界坐标模拟。
5. 使真实 PWA / Chromium 路径可操作、可测试；Hostra 保持平台入口语义一致，并明确列出尚未打通的 Content 前置条件。

**这不是 `DESIGN.md` 中完整“人物可移动、两张场景互通”首个可玩里程碑。** 本文定义的是它之前更小的技术垂直切片，用于验证输入、Frame、Render、Content、打包之间的真实闭环。

## 2. 当前基线和可以复用的成果

| 项目 | 当前状态 | 本任务动作 |
|---|---|---|
| `game.json` | `initial.subsystem="smoke"`，仅声明 Smoke | 改为 `base`，声明 `base` / `adventure-map` |
| `launch.pwa.json` / `launch.hostra.json` | 仅绑定 `subsystems/smoke.mjs` | 双平台增加两项绑定 |
| `systems/loomrealm-smoke/subsystem.mjs` | 无依赖、单帧完成 | 保留为独立 Smoke 测试样本，不再是游戏入口 |
| `components/cms-actor/` | 已实现 classic script、`locomotion`、`facing`、`avatarPlan`、Renderer 接入 | 直接复用，不修改组件 ABI |
| `scripts/pwa/synthetic-avatar-content.mjs` | 已生成 `struct.ZMap`、`struct.Look`、合成 PNG；能在构建/测试侧推导 AvatarPlan | 将正式 Actor 所需的 AvatarPlan 固化为可读取 Content 记录 |
| `test/pwa-avatar-fixture.mjs` | **测试专用**的 Actor 投影脚本，不属于正式游戏 | 借鉴其 RenderNode 和 Content 约束，不将 fixture 提升为正式 Subsystem |
| `scripts/pwa/build-installation-bundle.mjs` | 固定白名单，只允许无依赖 Smoke executable | 支持 `base` / `adventure-map` 的自包含打包，保持图校验、安全与确定性 |
| `package.json` / 测试 | 现有 Smoke 假设写死在测试中 | 加入依赖和回归测试，明确替换正式启动预期 |

相关现有代码：

- [PokeMan Base](https://github.com/lithdoo-labs/pokeman/blob/main/subsystems/base.mjs) 与 [PokeMan Map 输入消费](https://github.com/lithdoo-labs/pokeman/blob/main/subsystems/map.mjs)：设计参照，仅复用调用/输入模式，不引用其 RPG Map。
- [LoomRealm Controls Consumer](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/game-libs/game-common-controls/src/consumer.ts) 与 [Directional Tracker](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/game-libs/game-common-controls/src/directional-controls.ts)。
- [cms-actor 实施契约](../../components/cms-actor/IMPLEMENTATION.md)、[根入口约束](../game-entry.md)、[游戏阶段设计](../../DESIGN.md)。

## 3. 运行拓扑与权威边界

```text
Main / Session
  └─ Base Frame (initial)
       ├─ RenderDomain: game-controls-input    [唯一通用输入 Producer]
       └─ frame.call("adventure-map", null)
            └─ Adventure Map Frame
                 ├─ Presentation Events: controls.state / controls.event
                 ├─ Directional Controls Tracker
                 ├─ Viewport: 当前有效尺寸
                 ├─ Content: 只读 bootstrap AvatarPlan
                 └─ RenderDomain: cms-actor
                      ├─ attrs: x, y, locomotion, facing, ...
                      └─ data: { avatarPlan }
                               ↓
                      Renderer / Web Presentation
                               ↓
                      cms-actor + PNG Resource API
```

**职责划分：**

- `base` 拥有输入 Producer 的生命周期，不读取原始 DOM 按键，不判断角色动作，也不持有 Actor。
- `adventure-map` 拥有输入解释和当前 Actor 演示状态，并负责渲染数据投影；它不直接访问 `window`、`document`、`navigator.getGamepads()`。
- `cms-actor` 仅根据属性、已解析的 `avatarPlan` 和 Resource API 进行逐帧绘制；组件不决定位移、重力、碰撞、输入优先级。
- `AvatarPlan` 及其引用图片属于不可变 Content；当前输入状态属于活跃 Frame 的临时局部状态，**不进入 Shared State**。后续真正的位置/世界事实再根据权威模型确定归属。
- 不把 PokeMan 专属 Map/Battle 逻辑或 Adventure Island 的场地规则放进 LoomRealm 基础框架。

## 4. Game Entry 与目录规划

建议在现有项目的 `systems/` 组织正式实现，同时与当前 canonical 根安装入口保持一致：

```text
game.json
launch.pwa.json
launch.hostra.json
presentation.json              # 复用既有 cms-actor classic script

systems/
  base/subsystem.mjs
  adventure-map/subsystem.mjs

subsystems/                    # 根 canonical 安装入口绑定
  base.mjs
  adventure-map.mjs

apps/
  pwa/subsystems/              # 如兼容测试仍使用旧安装根，保留映射
    base.mjs
    adventure-map.mjs
  hostra/subsystems/
    base.mjs
    adventure-map.mjs

scripts/pwa/
  synthetic-avatar-content.mjs
  build-installation-bundle.mjs

test/
  ...                          # Game Entry / 输入 / 浏览器端到端验收
```

拟议 `game.json`：

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

拟议 `launch.pwa.json` 与 `launch.hostra.json`（逻辑 key 和 module 保持一致）：

```json
{
  "formatVersion": 1,
  "subsystems": [
    { "key": "base", "module": "subsystems/base.mjs" },
    { "key": "adventure-map", "module": "subsystems/adventure-map.mjs" }
  ]
}
```

根安装入口/Hostra shim 可以转发 `systems/*/subsystem.mjs`；**PWA executable 不得直接发布跨安装根的 shim**。现有 Smoke 文件是否继续保留在旧目录，由回归测试和独立开发工具的兼容需求决定；正式 Game Entry 不再引用它。

## 5. Base Subsystem

以 PokeMan 的模式实现，保持薄封装：

```js
export default defineSubsystem((scope) => ({
  async frame(frame) {
    const domain = scope.createRenderDomain({
      zIndex: 10,
      roots: [{
        key: "game-controls-input",
        tag: "game-controls-input",
        attrs: {},
        data: {},
        children: [],
      }],
    });
    try {
      return await frame.call("adventure-map", null);
    } finally {
      domain.close();
    }
  },
}));
```

上例省略 `defineSubsystem` 导入。父 Frame 必须 `await frame.call`，并在子 Frame 结束/失败/取消时执行 `finally`。不要为键盘和手柄分别注册重复 Producer，也不在 Base 中监听消费侧的 `controls.*` 事件。

## 6. Adventure Map Subsystem

### 6.1 展示节点

渲染域只放一个稳定 key 的 `cms-actor` 节点：

```js
{
  key: "adventure-player",
  tag: "cms-actor",
  attrs: {
    x: "0", y: "0",
    locomotion: "stand",
    facing: "right",
    skin: "0", face: "00020000",
    hair: "00030000", expression: "default",
    equips: ""
  },
  data: { avatarPlan },
  children: []
}
```

`avatarPlan` 必须是有效的 `AvatarPlanV1`，动作映射至少为 `stand→stand1`、`walk→walk1`、`jump→jump`。**只在初始化时设置一次 data**；后续方向改变走 `domain.update({ nodes: [{ key, attrs: { set: ... } }] })`，不要反复 `replace` 节点和 AvatarPlan。

初始位置/窗口改变时，从 `scope.viewport.current`、`scope.viewport.subscribe` 获得有效尺寸。`cms-actor` 的 `x/y` 指向**身体原点**（近脚部）而不是视觉中心，演示期可用 `x = round(width/2)`、`y = round(height/2 + 16)`。其中 16 像素是合成角色的临时视觉偏移，验收时需要以实际合成画面复核；未来改为由 sprite bounds 计算，**不得把临时展示偏移当作场地世界坐标**。Viewport 为 `null` 或无效尺寸时保持上一次位置。

### 6.2 方向状态与输入映射

在 Adventure Map 活跃 Frame 内创建：

```js
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
    },
  }
);
```

使用 LoomRealm 的 `controls.state`（含键盘/手柄归一化后的 held 集合）和 `controls.event`（down/up 变化）；不重复建立本地原始设备监听。Tracker 对多键按住和释放顺序负责；Consumer 对 stale/reset 生命周期负责。

第一版映射：

| 当前有效方向 | locomotion | facing | 世界位置 |
|---|---|---|---|
| `null` | `stand` | 保持最近朝向 | 固定 |
| `left` | `walk` | `left` | 固定 |
| `right` | `walk` | `right` | 固定 |
| `up` | `jump` | 保持最近朝向 | 固定 |
| `down` | `stand` | 保持最近朝向 | 固定 |

上下键的行为仅为演示约定：当前 `cms-actor` 没有 crouch/ladder 的 `locomotion`，**不新造无对应动画的动作值**。`jump` 仅切换现有非循环动画，不含跳跃速度、重力或落地状态；按键释放恢复 `stand`，左右方向释放也应恢复 `stand`。多键按住时尊重 Tracker 的当前有效方向，避免把每一个 keydown 当作独立状态写入。

为减少渲染更新，仅当 `locomotion` 或 `facing` 实际发生变化才发送一次 attrs delta；状态恢复不能丢失最后面向方向。

### 6.3 Frame 生命周期

- 创建顺序：读取 Content → 建立 RenderDomain → 订阅 Viewport → 注册 Controls Consumer → 保持 Frame 活跃。
- 运行期间不自行完成 Frame；直到 `frame.signal` 取消再退出，返回 `cancelled()`（具体取消/异常路径要按 pinned API 测试）。
- `finally` 依次关闭 Consumer、取消 Viewport 订阅、关闭 RenderDomain。组件的位图/异步资源由 Renderer 与 `cms-actor` 断开生命周期释放。
- Content 失败应该返回可定位的 `failed({code})`，不能默默展示空 Actor；Frame 已取消时优先走取消路径。
- 同一个 Actor key 只使用一次，不做无意义的“删除又重新插入”操作，避免 RenderManager 的 key 复用限制。

## 7. 合成 Content 与 AvatarPlan

当前项目的合成纸娃娃资源已通过 `scripts/pwa/synthetic-avatar-content.mjs` 生成；它提供 `struct.ZMap/order`、5 个 `struct.Look` 记录及所需的 PNG。`test/pwa-avatar-fixture.mjs` 用于**隔离测试**，不能当正式运行时依赖。正式方案：

1. 构建时依据仓库现有 synthetic Look、ZMap、Resource identity/`contentVersion` 推导 AvatarPlan，并通过现有 `validateAvatarPlan` 验证；不得在 Subsystem 中读取 PNG、解析 WZ 或导入 test-only fixture。
2. 在安装 Content 中新增约定记录（暂定）：`kind=record`、`namespace=struct.AdventureAvatarPlan`、`key=bootstrap`、MIME `application/json`，记录值为**Plan 本体**，不是包了一层 `avatarPlan` 的对象。
3. Adventure Map 在 Frame 开始时执行 `scope.content.record("struct.AdventureAvatarPlan", "bootstrap", { signal: frame.signal })`，然后将 `record.value` 放进 `RenderNode.data.avatarPlan`。
4. 计划仍只引用现有 Content Resource 身份和精确哈希版本；构建阶段需校验每个资源的存在性、版本、PNG MIME 和 Actor 的 `RenderNode.data` 大小上限（262,144 字节）。不得嵌入图片 base64 或本地路径到 AvatarPlan。
5. 既有根 `presentation.json` 的 `cms-actor` classic script 注册保持不变；该组件仍通过 Renderer 的 ResourceClient 读 PNG。

**待实现决策**：当前 `buildAvatarPlan` 参考适配器位于 `components/cms-actor/test/look-adapter.mjs`。首版可在构建期复用算法，但不能让游戏正式运行依赖 test 路径；宜将生产级派生逻辑抽离到 `content/` 的可测试构建模块并让原 fixture 复用，避免复制两套适配器。是否直接新增缓存 Plan Record 还是由准备阶段 materialize，需要在实现 PR 中以确定性、大小边界和 Hostra Content 接入成本比较后固定。

**Hostra 补充**：PWA 的 installation-bundle 能安装上述合成 Content，不代表 Hostra 自动获得同一 Content。Hostra 验收前要为相同逻辑身份准备可读取的 FSDB/Content 安装材料；不允许默认为存在，也不允许拷贝真实 CMS079 资产入库。

## 8. PWA 打包与依赖调整

现有 `scripts/pwa/build-installation-bundle.mjs` 的 executable 白名单和零导入规则只针对单文件 Smoke。新增的正式 Subsystem 要使用 `@loomrealm/subsystem` / `@loomrealm-game/common-controls/subsystem`，故需要同步：

1. 受控白名单从 `subsystems/smoke.mjs` 更新为 `subsystems/base.mjs` 与 `subsystems/adventure-map.mjs` 对应的 **`systems/*/subsystem.mjs` 源文件**；模块数量/顺序和 manifest 相互验证。
2. 借鉴 PokeMan 的 product-owned 构建脚本，用 `esbuild` 对每个入口生成 `bundle:true`、`format:"esm"`、`platform:"browser"`、`write:false` 的**自包含**模块；只发布构建结果，不能直接把裸依赖源码或越根 shim 提交给 PWA Builder。
3. 保留现有导入图禁令（无裸模块导入、越根导入、非字面量动态 import）、可执行源 SHA-256 与 provenance、Content 白名单与版本验证、确定性输出及安全写盘。不要为了通过打包删除安全检查。
4. 按 PokeMan 当前 `package.json` 的实际做法为根工程建立可解析 pinned LoomRealm 包与 common-controls 的 npm workspace/依赖关系；同步 lockfile、构建顺序与 CI。**不能假定在 submodule 内构建后，根源码中的裸包导入必然可解析。**
5. 更新 PWA 浏览器启动测试：之前 Smoke 会快速 `settled`，而 Adventure Map 是常驻 Frame，新的正常状态应为可交互的 `ready`；断言不得只检查自定义元素是否注册。

此任务不修改 `loom-realm` gitlink、不借用 PokeMan 本地工程的构建产物、不触碰线上部署、Docker、密钥或真实 WZ。

## 9. 测试与验收标准

### 单元与契约验证

- [ ] Base 创建单个 `game-controls-input`，调用 `frame.call("adventure-map", null)`，子 Frame 结束时关闭自己的 RenderDomain。
- [ ] Game Entry / PWA / Hostra manifest key 集合精确匹配；根 canonical 和暂存 `apps/*` 路径的角色明确。
- [ ] Directional Tracker：`left/right/up/down`、组合按住、最后有效方向、释放返回、`controls.state` 刷新和 stale-reset 均正确；手柄方向经公共输入层映射一致。
- [ ] Actor 的 `avatarPlan` 内容合法、资源版本匹配、大小不超限；资源未命中、版本冲突、Frame 取消都能明确失败或退出。
- [ ] `domain.update` 仅修改变化的 attrs，不重新发布完整 `avatarPlan`；Viewport resize 时只更新 `x/y`。
- [ ] 取消 Frame 后输入监听、Viewport 订阅和 RenderDomain 全部关闭。
- [ ] PWA 自包含打包无越根引用、无裸包导入，受控白名单、安全写盘、确定性及原有负例测试仍生效。

### 真实集成验证

- [ ] 在真实 Chromium + Service Worker 的 **canonical** PWA 启动流程，进入 `base` → `adventure-map`，产品保持可交互 `ready`，而非测试 fixture 单独通过。
- [ ] 页面上只出现一个真正投影的 `cms-actor`，已有合成 PNG 成功加载、`data-render-state=ready`，没有版本或资源错误。
- [ ] 模拟键盘按下/释放 `← → ↑ ↓`，确认动作切换为 `walk1/stand1/jump`，左右朝向正确，松开返回站立。
- [ ] 验证无持续横向位移；Viewport 缩放后角色仍居中。
- [ ] 手柄输入如 CI 缺少真实设备，应使用公共 Controls 的确定性注入/仿真测试；真实设备操作保留为人工验收，**不得把仅有键盘 E2E 宣称为手柄实机通过**。
- [ ] Hostra 在有相同 synthetic Content 的前提下完成启动/Actor 验证；缺 Content 时报告 BLOCKED，不能计为通过。

### 本切片完成定义

**至少具备真实 canonical PWA 的键盘可操作闭环、正确的组件渲染、负例与清理测试、无回归的 bundle CI。** 手柄真实设备和 Hostra 实体安装分别报告实际状态，不能借用其他环境的通过结果。

## 10. 分阶段落地建议

| 阶段 | 交付 | 关键门槛 |
|---|---|---|
| A. 入口与 Base | Game Entry、两个绑定、`base` 及其单测 | Base 能持有输入并调用 Adventure Map；构建基线明确 |
| B. Map 控制与 Render | `adventure-map`、方向映射、Viewport、Actor 节点 | 可以独立测试 attrs delta 与取消清理 |
| C. Content 正式化 | 产出 bootstrap AvatarPlan 记录，保留合成 PNG 精确版本 | 不再依赖测试 fixture 作为运行时 |
| D. PWA 集成 | 两个自包含 executable、安装包、正式 Chromium E2E | Canonical PWA 真实按键闭环通过 |
| E. Hostra 验收 | 相同 Content 的 Desktop 安装及验证 | 依据可复现结果独立标记 PASS/BLOCKED |

各阶段均不包括场地运行库、真实运动、地图层、立足线、传送门、NPC、怪物、技能或 Shared State 角色持久化。

## 11. 尚待评审的设计点

1. **源代码入口**：是否以 `systems/*/subsystem.mjs` 为唯一实现并保留根安装 shim；避免三套重复源码。
2. **AvatarPlan 生产化**：将测试适配器移到正式 `content/` 构建模块，还是独立固定生成记录。两者都必须维持哈希引用、字节上限和可复现测试。
3. **视口居中基准**：临时 `+16` 身体原点偏移只适用于当前合成图；最终用测量数据确定。
4. **Hostra 预备方式**：指定本地 synthetic FSDB / Content 安装路径，不能把 PWA 专属 payload 当成 Desktop 资源。
5. **旧 Smoke 测试**：保留独立 fixture 和测试，更新“正式产品只能立刻 settled”的旧断言，不要简单删除覆盖率。
6. **输入语义**：本切片 `up=jump`、`down=stand` 仅用于动作验证；正式 CMS079 场地输入将在 Game Library + 物理 Tick 建立后重新定义。

## 12. 进入后续可玩里程碑的条件

完成本草案切片之后，再根据 [`DESIGN.md`](../../DESIGN.md) 实施独立的横版场地 Game Library：世界坐标与可重复 Tick、foothold、走跳/重力、场景边界、双向传送门、两张合成场景与跟随摄像机。后续地图逻辑应消费**同一份公共 Controls**，把输入映射成权威移动意图；不能用本切片的假 `walk` 动画代替真实位置模拟。

---

**评审结论（待填写）：** 未评审。本文是方案草案，所有示例代码与路径均为拟议，未声称已合并、已运行或已通过 CI。
