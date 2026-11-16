# ms-avatar — 纸娃娃渲染组件设计（Draft）

> **状态：Draft，未冻结 ABI，未实现。**  
> 目标标签：`ms-avatar`（新设计）；旧实现：`cms-actor`。  
> 本文只讨论 Avatar，不提前定义 Map、Camera、World Renderer 或角色群体 Batch。  
> 参考：LoomRealm `93648192323bf5f57996b7b54cbae641d8a53fdb`；OpenMS GMS083 `07994de02756356e3e025e3aca9e79433898d2c8`。OpenMS 的行为是参考，不等于 CMS079 已验证事实。

## 1. 已确定的定位与职责

**`ms-avatar` 是纯粹的人物外观与动作绘制器（Avatar Renderer），不是管理人物表现状态的游戏角色组件。**

- **Subsystem / Field Runtime**：持有角色和装备的权威状态；决定世界位置、朝向、当前身体 Action、表情意图及动作切换时机；经游戏侧 Adapter 生成渲染就绪的外观计划。
- **Renderer 内的 `ms-avatar`**：消费外观计划和当前呈现指令；按帧进行身体、头、脸、头发、装备合成；实现锚点对齐、部件遮挡、镜像、表情及身体动画；由继承或本地的 Render Clock 驱动独立 Animation Player，推进**视觉帧**。
- **不属于 `ms-avatar`**：输入处理、角色物理、跳跃/攀爬判定、技能命中、装备合法性、Portal、地图、Camera 决策、与地图 Obj 的世界深度排序、技能粒子/受击者效果。
- 纸娃娃**内部** `zmap/smap/islot/vslot` 排序与地图**世界**深度是两套不同的规则；前者是本组件绘制能力，后者由场景呈现系统决定。

## 2. 原有设计可保留的部分

| 原有 `cms-actor` 设计 | 处理 |
| --- | --- |
| 组件消费经过 Adapter 解析的 `AvatarPlan`，不直接访问 WZ/FSDB 私有路径 | **保留** |
| body/head/face/hair/equips 按 origin、navel/neck/hand/brow 等锚点定位 | **保留** |
| 帧内 zOrder、槽位遮挡、翻转、frame move/rotate、showFace | **保留设计基础，继续按 CMS079 夹具验证** |
| 身体动作和表情的帧时钟相互独立 | **保留** |
| `x/y` 变化不重新合成整套 AvatarPlan | **保留性能原则** |
| LoomRealm `PresentationResourceClient`、contentVersion 检查、解码缓存和取消旧加载 | **保留** |
| 数据大小、画布分配、帧/图层数量有组件级上界且错误可诊断 | **保留原则；数值是否沿用 v1 再决定** |
| 现有 `cms-actor` 在 Shadow DOM 内持有独立 Canvas | **可保留为初始实现，不冻结为组件的长期输出 ABI** |

现有 `AvatarPlanV1` 的资源、action frames、origin/anchors、zOrder、`expression` 等是可复用的起点；不是要求重新解析 WZ，也不是已经批准的 V2 Schema。

## 3. LoomRealm 交互边界

`ms-avatar` 继续使用 **RenderNode 五字段**：`key / tag / attrs / data / children`。不修改 LoomRealm Render Update v1。

| 接口 | 计划承担的内容 |
| --- | --- |
| `key` | 独立 Avatar 节点身份，遵守 one-shot key 生命周期 |
| `tag` | `ms-avatar` |
| `attrs` | 小型、可独立增量更新的动态呈现输入（具体字段待决） |
| `data` | 已解析的 `avatarPlan`；不包含原始文件路径、业务权威状态 |
| `children` | 初步倾向为空；Avatar 内部部件不是 RenderNode 子节点 |
| `receiveRenderEvent` | `action` Event 可启动单次纸娃娃动作（技能/攻击）；它是可丢失、不重放的视觉指令，不是技能判定的权威依据 |

`RenderDomain.update()` 的 `attrs/data` 更新不改变节点 `key/tag/children`，`data.set` 按顶层成员替换；`receiveRenderData()` 收到完整 data。动态动作更新不应导致未变的 AvatarPlan 重新解析/加载。

## 4. 动作输入 ABI：已确认原则与候选字段

**已确认原则**：Subsystem 选择具体绘制 Action（如 `walk1`、`walk2`、`jump`），`ms-avatar` 不再根据 `locomotion=walk` 和武器信息决定动作；持续/基础动作采用 retained `attrs.action`，单次攻击或技能动作由 `render.event` 的 `action` 事件覆盖播放。**当前方案不引入 `action-seq` 字段。**

下面是用于后续讨论的节点示例；只有 Action / Event 的职责划分已经确认，其他 attrs、AvatarPlan V2 Schema 仍为候选：

```js
{
  key: "avatar:player",
  tag: "ms-avatar",
  attrs: {
    x: "120",
    y: "80",
    facing: "right",
    action: "walk1",       // retained 基础 Action
    "one-shot-enabled": "true", // 可选；默认 true（已确认）
    expression: "default"  // 候选：表情选择
  },
  data: {
    avatarPlan: { /* 渲染就绪的动作定义与部件画布；Schema 待定 */ }
  },
  children: []
}
```

单次动作由 Subsystem 在完成必要的业务判定后发布：

```js
domain.emit({
  targetKey: "avatar:player",
  name: "action",
  data: { action: "brandish1" }
});
```

- 同名 `action` Event 每到达一次都表示一次新的播放启动，从第 0 帧重启；因此无需用属性变化或 `action-seq` 区分连续释放。
- Event 播放时，`attrs.action` 仍保存当前基础 Action；一次性播放结束，组件回到当时最新的 `attrs.action`。它只是**本地视觉播放切换**，不得反向修改 Subsystem 状态。
- 单次动作播放中再次收到新 `action` Event，新动作中断旧动作、从第 0 帧播放；但 `attrs.action` 改变本身**不打断**当前单次动作，结束后回到最新基础 Action（已确认方案 A）。
- `render.event` 是 LoomRealm transient Event：不存入 Render Store、不进入 Snapshot、不重放，可能因目标不存在、连接替换或其他 applicability 条件丢失。**这是明确接受的视觉恢复限制**：重建后显示 `attrs.action`，不恢复先前的攻击/技能动画；技能命中、伤害和冷却仍由 Subsystem 权威处理。
- 如果游戏将来要求必定显示/断线后恢复中途技能动作，须另议 retained 播放状态；不能把现有 Event 说成可靠且可重放。
- Event 应在目标节点当前有效且对应动作计划已发布时发送。已发布不等于位图已经解码；异步资源准备与首帧时序在第二阶段处理。
- 倾向移除 `skin/face/hair/equips` 冗余 attrs；它们由 Subsystem 决定并通过 `avatarPlan` 表达，仍待独立确认。
- `expression` 的动态选择与表达帧定义分离，具体数据布局待定。
- `x/y` 沿用 V1 身体原点作为讨论起点；未来是否由场景持有坐标、组件是否保留最终 Canvas，仍待讨论。

## 5. Render Clock、继承规则与动作播放

### 5.1 已确认：组件时钟继承与本地回退

**`ms-avatar` 自带一个默认 Render Clock；若祖先组件提供可用 Render Clock，优先绑定 DOM / composed-tree 中最近祖先提供者的时钟；否则使用自己的时钟。** 不新增 RenderNode 时钟字段，也不要求修改 LoomRealm Core。

- 可以由普通父元素、跨 ShadowRoot 的 host 链提供时钟。仅在连接、重新挂载、提供者更换等**生命周期时机**重新解析提供者；不在每次绘制或每帧递归查找。
- 找到**暂停的祖先时钟**依然意味着提供者存在。暂停不得触发切换为本地时钟继续播放。
- 时钟提供者失效或元素脱离原祖先后，取消旧订阅并重新解析；无可用祖先时钟时才回退本地。
- 切换时钟**保持每个 Avatar 的 Action、身体帧相位、表情相位及单次覆盖状态**，只重置本地时间采样基准；严禁把不同 time origin 的绝对时间相减，避免首帧跳变。
- 每个 Avatar 自己维护 Animation Player。多个组件共享同一 Render Clock 时，只共享调度/时间基准，不共享动作进度；独立使用时无需场景组件。
- 初步可以通过本地 JS 接口暴露 `getRenderClock()`（或等效注入机制），而不是要求 LoomRealm 自带统一时钟服务。接口签名、更新通知及订阅注销细节属组件内部协议，待实现前定稿。
- **Simulation Clock 始终属于 Subsystem**，决定游戏时间和业务状态；此处继承的 Render Clock 只推进画面，不参与物理判定。模拟暂停如何投影到 Renderer 时钟属于下一阶段讨论。

### 5.2 可行的最小内部接口（示例，不是 Frozen ABI）

```ts
interface RenderClock {
  subscribe(callback: (deltaMs: number) => void): () => void;
}

interface RenderClockProvider {
  getRenderClock(): RenderClock;
}
```

外部时钟可来自场景或其他宿主。组件优先采用最近祖先提供者。默认本地时钟和外部时钟需要一致的 delta 单位、非负有限值、停止及释放策略；不同提供者的 `deltaMs` 不代表同一个绝对时间坐标。

### 5.3 OpenMS 对照复核（参考行为，不是 ms-avatar 的平台 API）

| 核查点 | 固定 OpenMS 源码事实 | 对 ms-avatar 的影响 |
| --- | --- | --- |
| 动画实体状态 | `EntityAnimation` 保存 `action`、`actionTimeMs`、`elapsedMs`、`frame`、表情状态和资源；提供 `setAction`、`advance(ms)`、`seek(ms)` | 支持把 Animation Player 与时间源分开 |
| 时间来源 | `advance(ms)` 消费调用者传入的毫秒增量，而不是 EntityAnimation 自己建立 RAF | 支持外部供时；**不证明** DOM 祖先递归查找 |
| 同名动作重启 | `setAction(name, playback, restart=false)` 默认避免同名/同模式重启，显式 `restart` 则可重播 | 单次 `action` Event 每到达一次就显式 restart 是我们的产品映射 |
| 动作时长 | `compileAction` / `loopTime` / `timedFrame` 按 delay、repeat suffix 处理帧与循环；`seekActionClock` 可定位动作相位 | 第二阶段应决定哪些时间/完成规则进入 AvatarPlan，而不是按 RenderEvent 事件到达次数推断时钟 |
| 在线状态恢复 | `RemoteAnimationClock` 以及 online scene 的 `actionStartTick`、`seek` 实现远端动作相位收敛 | OpenMS 的在线恢复依赖 retained 时间事实；**我们的 transient Event 不提供相同保证** |
| 表情 | `EntityAnimation` 独立维护 `expressionMs` / `expressionElapsedMs` 等 | 继续保留独立表情播放状态 |

源码：
- [EntityAnimation](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js)
- [Animation Timing](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation-timing.js)
- [Remote Animation Clock](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/online/remote-animation-clock.js)
- [Online Scene](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/online/scene.js)

### 5.4 第二阶段已确认：基础 Action 改变不打断一次性动作（方案 A）

- 当 `action` RenderEvent 的一次性 Action 正在播放时，`attrs.action` 改变**仅更新基础动作选择**，不直接打断当前一次性动作。
- 一次性 Action 自然完成后，切回**当时最新的** `attrs.action`；中间可能已经从 `walk1` 变成 `jump` 或 `stand1`。
- 再次收到 `action` Event（包括同名 Event）则按已确定规则立即重启/替换当前一次性动作。这与“基础 attrs 的变化不打断”是两个独立入口。
- Avatar 不判断 `jump/dead/hit` 的业务优先级；**强制中断必须使用另行定义的显式呈现指令**，不能仅靠猜测基础 Action 的名称。
- 上述仅是视觉播放规则；技能中断的物理、伤害、冷却和合法性由 Subsystem 判定。完整动画 ABI 尚未冻结。

### 5.5 第二阶段已确认：显式强制中断与一次性覆盖许可

**已确认采用 retained `attrs["one-shot-enabled"]`，不新增 `action.cancel` RenderEvent。** 它是 Subsystem 发布的**视觉覆盖许可**，不是死亡、硬直、施法资格等业务状态。

| 属性取值 | 语义 |
| --- | --- |
| 缺省或 `"true"` | 允许 `action` RenderEvent 启动单次覆盖动作 |
| `"false"` | 立即清除当前单次覆盖，显示当时最新 `attrs.action`；禁止新的单次动作 Event |

典型场景：Subsystem 决定死亡并一次发布 `action="dead"` 与 `one-shot-enabled="false"`。Avatar 显示 `dead`，不尝试根据 Action 名判断能否施法。恢复许可为 `"true"` 后允许新的单次 Event，但**不自动重播**被取消或丢失的旧事件。

```js
domain.update({
  nodes: [{
    key: "avatar:player",
    attrs: { set: { action: "dead", "one-shot-enabled": "false" } }
  }]
});
```

实施要求：

1. `"false"` 是持续禁止许可，不是一个瞬间的取消序号；**不能**用短时间 `false → true` 切换表达“取消一次然后立刻允许”。未发送的 retained 更新可能被 LoomRealm 合并，Renderer 可能只见最终 `true`。业务需要强制禁用时应维护该状态，直到后续真实解除条件出现；不能假设每次中间变化都会渲染。
2. 组件在检测到禁用时终止本地 one-shot 播放；即使原 Event 已到达并开始播放也必须清除。禁用期间收到 Event 应忽略。恢复许可仅重新开放入口，不触发自动播放。
3. `attrs.action` 与 `one-shot-enabled` 可在同一 `RenderDomain.update()` 发布。实现应将连续属性回调合并为一致的绘制状态，不依赖 `attributeChangedCallback` 的属性逐项更新顺序。
4. RenderEvent 仍是 transient 且允许丢失。Retained 许可保证的是**快照恢复时能知道是否允许覆盖**，不是保证连接中断期间画面一定即时更新、也不是保证每次中断过渡都被展示。
5. 禁用状态下不改变 Subsystem 权威动作、战斗和冷却；本组件只清除自己的视觉覆盖状态。
6. 缺省值 `true` 仅为本组件的属性默认约定；`attrs` 在 LoomRealm 中始终是字符串，非 `"true"/"false"` 的值应由组件级 validator 拒绝，不擅自当作 truthy。

### 5.5.1 需要覆盖的测试场景

- one-shot 正在播放，基础动作从 `walk1` 变成 `jump`：保持 one-shot，到期后播放 `jump`。
- one-shot 正在播放，同一更新发布 `action="dead"`、`one-shot-enabled="false"`：取消并显示 `dead`。
- 禁用期间发送同名或不同名 `action` Event：都不得重启；恢复 `true` 后只响应新收到的 Event。
- 新建 / 重连组件只收到禁用态 Snapshot：直接显示基础动作，不恢复旧 one-shot。
- 快速 `false → true` 且更新被合并：不得宣称一定观察到取消；此序列不是受支持的瞬时取消接口。

### 5.6 其余第二阶段待裁决项

1. **基础动作循环/停留**：是否完全由 AvatarPlan action clip 定义（`loop`、末帧 hold、repeat suffix），而不是把规则写死在组件中？
2. **非循环基础动作结束**：例如 `jump` 播完是否 hold 末帧，是否需要结束通知？
3. **资源未就绪/动作不存在**：Event 先到时等待、丢弃，还是绘制确定性 fallback？过期异步结果不能覆盖更新的动作。
4. **时钟与生命周期**：外部时钟暂停、隐藏页停顿、断开重连、Clock 切换、模拟暂停的具体步进规则。
5. **回放边界**：保留 Event 不恢复原则。需要精确动作恢复时另议 retained 时间/相位模型。

以上尚未批准完整第二阶段 ABI。

## 6. 外观计划与资源：暂不冻结的取舍

**原则已确定**：业务侧解析 `islot/vslot/zmap/smap` 等原始事实并提供渲染就绪数据；Renderer 不自行反解 WZ 路径。组件负责依据计划执行逐帧的绘制顺序与遮挡。

**仍需讨论**：

- `AvatarPlan` 是包含全部动作，还是当前动作加有限预加载动作？现行 V1 明确只允许有界的当前所需动作集（最多 32 个 Action）。
- 装备变化时由 Adapter 发布新 Plan，还是采用更细粒度的局部替换？没有证据时先沿用**整体有界 Plan 更新**，但不因普通移动/动作切换重建 Plan。
- 不强制把新生成的外观计划转成 `PresentationResourceClient` 可读取的动态 Content JSON；该能力在当前 LoomRealm 中不是现成的发布接口。
- 资源缺失、Action 缺失与计划版本不匹配应产生可定位错误；静默回退策略尚未批准。

## 7. 和旧组件的关系

- 现有 `components/cms-actor/`、`components/RENDER-NODE-ABI-V1.md` **保持不变**。
- 新设计使用独立标签 `ms-avatar`，避免新旧 Schema 在同一标签内混用。
- 可以复用现有 `avatar-model.mjs` 的几何、排序、校验逻辑与图像缓存方案，但不宣称新组件已经实现。
- 新实现如果需要与场景统一 Display List 交错，可以抽取纯 Avatar Painter；不在本文件中提前决定整个 World Renderer 的节点树。

## 8. 下一轮需要逐项决定的事项

| 议题 | 当前倾向 | 状态 |
| --- | --- | --- |
| Avatar 是否只负责纸娃娃呈现 | **是** | **已确认** |
| 直接输入具体 Action 名作为基础动作 | **是** | **已确认** |
| 去除 `skin/face/hair/equips` 重复 attrs | 是 | 待确认 |
| 表情选择与表情帧定义分离 | 是 | 待确认 |
| 单次技能/攻击通过 `action` RenderEvent，且不添加 `action-seq` | **是；接受 Event 不重放** | **已确认** |
| 时钟来源：最近祖先 Render Clock，否则组件本地 Clock | **确定继承与回退原则** | **已确认** |
| attrs.action 改变与一次性 Event 的覆盖关系 | **方案 A：单次动作播完后回到最新基础动作** | **已确认** |
| 强制中断接口与可靠性 | retained `one-shot-enabled`，缺省 true、false 清除并禁止单次覆盖 | **已确认** |
| Animation Player 的结束、时间步进、暂停语义 | 未选定 | **第二阶段待讨论** |
| AvatarPlan 动作集合/版本化策略 | 未选定 | **待讨论** |
| 世界坐标与最终 Canvas 输出边界 | 未选定 | **待讨论** |

## 9. 依据与验证状态

- [旧版 cms-actor 设计](../../components/cms-actor/DESIGN.md)
- [旧版 cms-actor 实施说明](../../components/cms-actor/IMPLEMENTATION.md)
- [Frozen RenderNode ABI v1](../../components/RENDER-NODE-ABI-V1.md)
- [Adventure Island 产品模块边界](../../docs/product-first/MODULE-CONTRACTS-V1.md)
- [OpenMS Avatar Composition](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/avatar-composition.js)
- [OpenMS Animation Timing](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation-timing.js)
- [OpenMS EntityAnimation](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js)
- [OpenMS Online Scene](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/online/scene.js)
- [LoomRealm Render Update v1](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/render-update-v1.md)

**验证状态**：新 `ms-avatar` 仅为设计 Draft；没有新增实现、Schema Validator、Chromium 测试或真实 CMS079 像素一致性验收。旧版历史测试不自动证明新 ABI 通过。
