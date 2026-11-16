# ms-avatar — 纸娃娃渲染组件设计（Draft）

> **状态：Draft，未冻结 ABI，未实现。**  
> 目标标签：`ms-avatar`（新设计）；旧实现：`cms-actor`。  
> 本文聚焦 Avatar 及其动作数据子组件 [ms-action](./ms-action.md)，不提前定义 Map、Camera、World Renderer 或角色群体 Batch。  
> 参考：LoomRealm `93648192323bf5f57996b7b54cbae641d8a53fdb`；OpenMS GMS083 `07994de02756356e3e025e3aca9e79433898d2c8`。OpenMS 的行为是参考，不等于 CMS079 已验证事实。

## 1. 已确定的定位与职责

**`ms-avatar` 是纯粹的人物外观与动作绘制器（Avatar Renderer），不是管理人物表现状态的游戏角色组件。**

- **Subsystem / Field Runtime**：持有角色和装备的权威状态；决定世界位置、朝向、当前身体 Action、表情意图及动作切换时机；经游戏侧 Adapter 生成渲染就绪的外观计划。
- **Renderer 内的 `ms-avatar`**：消费父节点的共享外观数据与 `ms-action` 子节点提供的各动作 Clip；维护 Action 名索引、统一资源客户端与图片缓存、按帧进行身体/头/脸/头发/装备合成；执行锚点对齐、遮挡、镜像和表情动画；由继承或本地 Render Clock 驱动 Animation Player，推进**视觉帧**。
- **不属于 `ms-avatar`**：输入处理、角色物理、跳跃/攀爬判定、技能命中、装备合法性、Portal、地图、Camera 决策、与地图 Obj 的世界深度排序、技能粒子/受击者效果。
- 纸娃娃**内部** `zmap/smap/islot/vslot` 排序与地图**世界**深度是两套不同的规则；前者是本组件绘制能力，后者由场景呈现系统决定。

## 2. 原有设计可保留的部分

| 原有 `cms-actor` 设计 | 处理 |
| --- | --- |
| 父 Avatar 消费 Adapter 准备的共享外观信息和 ms-action 子节点，不直接访问 WZ/FSDB 私有路径 | **保留** |
| body/head/face/hair/equips 按 origin、navel/neck/hand/brow 等锚点定位 | **保留** |
| 帧内 zOrder、槽位遮挡、翻转、frame move/rotate、showFace | **保留设计基础，继续按 CMS079 夹具验证** |
| 身体动作和表情的帧时钟相互独立 | **保留** |
| `x/y` 变化不重新合成共享外观数据和各个动作 Clip | **保留性能原则** |
| LoomRealm `PresentationResourceClient`、contentVersion 检查、解码缓存和取消旧加载 | **保留** |
| 数据大小、画布分配、帧/图层数量有组件级上界且错误可诊断 | **保留原则；数值是否沿用 v1 再决定** |
| 现有 `cms-actor` 在 Shadow DOM 内持有独立 Canvas | **可保留为初始实现，不冻结为组件的长期输出 ABI** |

旧 `AvatarPlanV1` 的资源、action frames、origin/anchors、zOrder、`expression` 等仍是可复用的**源数据和实现基础**；新结构将共用外观数据与逐 Action Clip 分开，不是要求重新解析 WZ，也不是已经批准的 V2 Schema。

## 3. LoomRealm 交互边界

`ms-avatar` 和 `ms-action` 都遵守 **RenderNode 五字段**：`key / tag / attrs / data / children`。不修改 LoomRealm Render Update v1。

| 接口 | `ms-avatar` 的内容 |
| --- | --- |
| `key` | Avatar RenderNode 身份，遵守 one-shot key 生命周期 |
| `tag` | `ms-avatar` |
| `attrs` | retained 基础 `action`、`one-shot-enabled`、`expression`（已确认），朝向 `facing` 等其他输入是否属于闭集仍按 D02 决定；不包含世界 `x/y`（D10） |
| `data` | **当前角色共用**的渲染就绪外观信息（共享 zOrder、资源索引、表情帧与绘制事实；分工见已确认 D08 / §6.3），**不再携带全部 `actions` 字典**；具体顶层字段闭集尚待 Schema 冻结 |
| `children` | **已确认：独立的 `ms-action` 数据型子节点**；每个子节点保存一个动作的绘制 Clip；纸娃娃内部图层不是 RenderNode |
| `receiveRenderEvent` | 接收面向 Avatar 的瞬时 `action` Event，触发一次性覆盖动作 |

- WebProjector 将 `RenderNode.children` 机械投影为 **`ms-avatar` 的 light DOM**。每个 `ms-action` 是独立注册的 Custom Element，自己的 `data` 只投递给它自己的 `receiveRenderData()`，**不自动触发父 Avatar 的数据回调**。
- `ms-action` 消费、校验并暴露 Clip；**已确认子节点主动发出 Renderer 内部的定义变化通知，父 Avatar 在关键入口同步读取当前直接子元素与已验证 Clip**（§5.15）。通知只使缓存失效，不直接画图，也不通过 LoomRealm RenderEvent。父 Avatar 统一管理图片/图集读取、解码、缓存、contentVersion 与实际绘制，子组件没有 RAF、Canvas 和图片资源所有权。
- **已有** `ms-action` 的 `data.clip` 可以通过 `RenderDomain.update()` 独立更新；**增加、移除或改变 `children` 结构**须通过 `RenderDomain.replace()`。该设计提供独立寻址和增量更新，不等同于把初始 Snapshot 分段传输。**LoomRealm 支持 attrs 单属性及 data 顶层成员的 set/remove，嵌套对象更新需要替换对应顶层值；WebProjector `receiveRenderData()` 仍交付完整当前 data**，见 §6.5（D02）。
- LoomRealm Core 不设置通用 `data` 字节、节点数量硬限制。旧版 `cms-actor` 的 256 KiB / 32 动作是**组件应用级上限**，拆成子节点并不免除未来 `ms-action` 的大小、帧数、图层和总工作集边界验证。
- 结构提交时需要校验直接子节点索引：Action 名唯一，Clip 定义已收到且有效；不能因为元素在 DOM 中存在就认为 Clip 已就绪。**MutationObserver 只辅助发现子节点增加/移除/移动，不作为唯一的数据变化通知**；父子通知的具体 DOM 事件/方法签名和组合完成判定仍待实现细化。

详见 [ms-action 数据子组件设计](./ms-action.md)。

## 4. 动作输入 ABI：已确认原则与候选字段

**已确认原则**：Subsystem 直接选择 `walk1`、`walk2`、`jump` 等**具体** Action；`ms-avatar` 不按 `locomotion=walk` 或武器规则再选动作。基础动作通过 retained `attrs.action` 传入，单次攻击/技能通过 `render.event("action")` 临时覆盖。**不引入 `action-seq`。动作绘制定义由同一 Avatar 的 `ms-action` 子节点提供。**

节点结构示意（共用数据、具体字段名和 Clip Schema 仍为候选，不是已批准的 Validator）：

```js
{
  key: "avatar:player",
  tag: "ms-avatar",
  attrs: {
    facing: "right",       // 字段形式仍受 D02 约束；世界 x/y 交场景
    action: "walk1",
    "one-shot-enabled": "true", // 可选，默认 true
    expression: "default"      // 表情选择入口已确认（D03）；值域待定
  },
  data: {
    appearance: { /* 共享 zOrder、资源索引、表情定义等；D08 分工已定，字段形状待定 */ }
  },
  children: [
    {
      key: "avatar:player:walk1",
      tag: "ms-action",
      attrs: { name: "walk1" },
      data: { clip: { playback: "loop", frames: [/* ... */] } },
      children: []
    },
    {
      key: "avatar:player:brandish1",
      tag: "ms-action",
      attrs: { name: "brandish1" },
      data: { clip: { frames: [/* ... */] } },
      children: []
    }
  ]
}
```

```js
domain.emit({
  targetKey: "avatar:player",
  name: "action",
  data: { action: "brandish1" }
});
```

- 每次收到同名 `action` Event 都从第 0 帧重新播放。新 Event 中断旧 one-shot；但 `attrs.action` 更新只记录**最新基础动作**，不会打断正在播放的 one-shot。一次性动作自然结束后回到那时最新的基础 Action。
- `one-shot-enabled="false"` 立即停止当前单次动作并阻止新 Event；这个 retained 状态用于强制覆盖而不是一次性取消序号。
- `render.event` 是 transient、可能丢失、不重放；重建组件只恢复 retained 基础 Action，不恢复中途技能。技能命中、伤害和冷却仍由 Subsystem 权威处理。
- 仅当目标 Avatar 当前有效且所请求动作的 `ms-action` **已登记、已验证、Clip 可用**时才接纳事件；动作缺失时直接丢弃，不等待下一次 `replace()` 后补播。**Clip 有效不要求位图已经下载或解码**。
- Subsystem / Adapter 应提前提供当前外观可触发的动作子节点；**不同动作可独立更新，但创建/删除子节点要求 `replace()` 提交整棵树**。因此不能把 Event 当成缺失动作的懒加载指令。
- **已确认 D03**：`attrs.expression` 选择表情；帧/时序在父级共享外观数据中，由独立表情时间轴推进，`showFace` 仅控制是否显示。**已确认 D10**：世界 `x/y` 不属于 Avatar attrs，而由场景负责，Avatar 只处理局部原点及镜像。`skin/face/hair/equips` 是否正式从 attrs 闭集中排除，以及 `facing` 的最终输入格式、默认值和合法值，仍归 D02 后续决定。

## 5. Render Clock、继承规则与动作播放

### 5.1 已确认：组件时钟继承与本地回退

**`ms-avatar` 自带一个默认 Render Clock；若祖先组件提供可用 Render Clock，优先绑定 DOM / composed-tree 中最近祖先提供者的时钟；否则使用自己的时钟。** 不新增 RenderNode 时钟字段，也不要求修改 LoomRealm Core。

- 可以由普通父元素、跨 ShadowRoot 的 host 链提供时钟。仅在连接、重新挂载、祖先提供者失效等**生命周期时机**重新解析提供者；不在每次绘制或每帧递归查找。**已确认：祖先提供者在有效生命周期内保持返回的 RenderClock 对象身份稳定**，不在原地悄悄替换实例。
- 找到**暂停的祖先时钟**依然意味着提供者存在。暂停不得触发切换为本地时钟继续播放。
- 时钟提供者失效或元素脱离原祖先后，取消旧订阅并重新解析；无可用祖先时钟时才回退本地。
- 切换时钟**保持每个 Avatar 的 Action、身体帧相位、表情相位及单次覆盖状态**，只重置本地时间采样基准；严禁把不同 time origin 的绝对时间相减，避免首帧跳变。
- 每个 Avatar 自己维护 Animation Player。多个组件共享同一 Render Clock 时，只共享调度/时间基准，不共享动作进度；独立使用时无需场景组件。
- 初步可以通过本地 JS 接口暴露 `getRenderClock()`（或等效注入机制），而不是要求 LoomRealm 自带统一时钟服务。提供者可在**同一个** RenderClock 对象内部暂停、恢复、更改 RAF 调度或调速；不因此要求子组件重新订阅。
- 提供者销毁或**真正停止提供** Clock 时，不允许静默让子组件永久失去推进：须有明确的失效/解绑通知，后代重新寻找最近的有效祖先，否则退回自己的时钟。**失效通知形式、销毁与订阅竞态**留待实施契约确定；暂停不算失效，严禁回退以绕过暂停。
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

外部时钟可来自场景或其他宿主。组件优先采用最近祖先提供者。**同一有效提供者的 `getRenderClock()` 多次查询应返回同一对象**；暂停、恢复和调度策略的内部变化不修改对象身份。默认本地时钟和外部时钟需要一致的 delta 单位、非负有限值、停止及释放策略；不同提供者的 `deltaMs` 不代表同一个绝对时间坐标。

### 5.3 OpenMS 对照复核（参考行为，不是 ms-avatar 的平台 API）

| 核查点 | 固定 OpenMS 源码事实 | 对 ms-avatar 的影响 |
| --- | --- | --- |
| 动画实体状态 | `EntityAnimation` 保存 `action`、`actionTimeMs`、`elapsedMs`、`frame`、表情状态和资源；提供 `setAction`、`advance(ms)`、`seek(ms)` | 支持把 Animation Player 与时间源分开 |
| 时间来源 | `advance(ms)` 消费调用者传入的毫秒增量，而不是 EntityAnimation 自己建立 RAF | 支持外部供时；**不证明** DOM 祖先递归查找 |
| 同名动作重启 | `setAction(name, playback, restart=false)` 默认避免同名/同模式重启，显式 `restart` 则可重播 | 单次 `action` Event 每到达一次就显式 restart 是我们的产品映射 |
| 动作时长 | `compileAction` / `loopTime` / `timedFrame` 按 delay、repeat suffix 处理帧与循环；`seekActionClock` 可定位动作相位 | 各个 `ms-action` Clip 承载动作时长/循环规则；具体字段待定，不按 Event 到达次数推断时钟 |
| 在线状态恢复 | `RemoteAnimationClock` 以及 online scene 的 `actionStartTick`、`seek` 实现远端动作相位收敛 | OpenMS 的在线恢复依赖 retained 时间事实；**我们的 transient Event 不提供相同保证** |
| 表情 | `EntityAnimation` 独立维护 `expressionMs` / `expressionElapsedMs` 等 | 继续保留独立表情播放状态 |

源码：
- [EntityAnimation](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js)
- [Animation Timing](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation-timing.js)
- [Remote Animation Clock](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/online/remote-animation-clock.js)
- [Online Scene](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/online/scene.js)

### 5.4 第二阶段已确认：基础 Action 改变不打断一次性动作（方案 A）

- 当 `action` RenderEvent 的一次性 Action 正在播放时，`attrs.action` 改变**仅更新基础动作选择**，不直接打断当前一次性动作。**已确认 D01**：one-shot 期间基础 Action 播放时间被冻结，细则见 §5.17。
- 一次性 Action 自然完成后，切回**当时最新的** `attrs.action`；若仍为被覆盖时的同一基础动作且期间未改选，则延续冻结的原相位；若基础 Action 曾发生切换，则使用新选择的基础动作从 0ms 开始（§5.17）。
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

### 5.6 第二阶段已确认：基础 Action 的播放规则由 ms-action Clip 定义

- Subsystem 通过 `attrs.action` 选择**具体**基础 Action；`ms-avatar` 只根据当前已登记的 `ms-action` Clip 的帧与播放规则推进，不因名字包含 `stand`、`walk`、`jump`、`sit` 等字样而自行猜测循环、保持或结束。
- 基础 Action 支持**完整循环**、**先播前置段再循环后续片段**、**非循环播至末帧并保持**三种语义。非循环基础 Action 停在末帧，直到 Subsystem 改变 `attrs.action`（或者单次 Event 暂时覆盖后再回到它）。
- 基础 Action 的正常结束是组件内部的视觉状态，**不向 Subsystem 发完成事件**，不自行切换别的业务 Action。
- `render.event("action")` 是**一次性覆盖播放**：即使该 Action 的基础循环定义允许循环，单次 Event 也只执行一次完整动作，到期回到最新基础 Action。新 Event 到达时遵照既定的显式重启规则；`one-shot-enabled=false` 仍有强制终止优先权。
- 同名基础 Action 属性的重复投影不应重启动作；真正在同名情况下要求显式重播的场景使用已确认的单次 Action Event。对应 `ms-action` Clip 更新时**保留当前已累计的播放时间、按新 Clip 重新定位帧，不视为重播**（§5.12）；换装时需遵守 §5.13 的同次 Domain 原子发布规则。
- 以上是**确定的行为语义**，不是已批准的 `ms-action` Clip 字段级 Schema。

**待定 `ms-action.data.clip` 的表达示例**（字段名 `playback` 和 `repeatFrom` 暂不冻结；不同键对应不同子节点）：

```js
// 三个独立 ms-action 子节点的 data.clip（仅演示各自的数据）
walk1Clip = { playback: "loop", frames: [/* ... */] };
jumpClip = { playback: "hold", frames: [/* ... */] };
specialActionClip = {
  playback: "loop",
  repeatFrom: 1,       // 候选：零基帧索引；先播 frame 0，再循环 frame 1..N-1
  frames: [/* ... */]
};
```

如果未来使用 `repeatFrom`，必须保证位于帧边界且重复片段具有正时长，避免全零 delay 的无限循环；源数据的 `delay=0`、缺少 delay、repeat 值转换与边界行为应在 `ms-action` Clip Schema 阶段明确并测试。

**OpenMS 复核依据**：固定源码 `animation-timing.js` 中 `compileAction` 从首帧 `repeat` 计算 `repeatStartMs`，`loopTime` 在首轮播放完毕后循环指定的 suffix；`advanceActionClock` 区分 `once` 和 `loop`，`EntityAnimation.setAction` 支持播放模式覆盖。这支持“动作帧数据决定循环行为，调用入口决定 one-shot”的拆分；现在动作数据由独立 `ms-action.data.clip` 承载，但 `playback/hold/repeatFrom` 的具体表示形式仍是 Adventure Island 的候选，**不能直接称作 CMS079 已验证 ABI**。

本项未来验收至少覆盖：正常站立循环、跳跃末帧保持、首段播放一次后循环 suffix、Event 覆盖循环动作只播放一次、one-shot 结束后回到最新基础动作、同名基础 Action 更新不重启。

### 5.7 第二阶段已确认：Action 可用性与资源延迟（时间一致性优先）

**已确认策略：单次 Action Event 不等待资源全部就绪才开始计时，动作显示允许跳帧；不为了补播而把视觉技能延迟到游戏事件之后。**

| 情况 | ms-avatar 行为 |
| --- | --- |
| Event 的 `action` 名称不存在于当前 **已验证 `ms-action` 子节点索引** | **丢弃此次 Event**，生成包含动作名的诊断；不缓存名称等待下一份 Plan，也不改变基础动作或当前 one-shot |
| Event 动作定义存在，但图片/图集尚在读取、解码 | **收到 Event 时开始一次性 Action 播放时间轴**，在资源可用时绘制届时的**当前帧**；可能跳过早期帧，极端情况下整个 one-shot 不可见 |
| Event 动作自然到期但资源仍未就绪 | 按既定规则结束覆盖、回到最新 `attrs.action`；不得因为迟到的资源而补播 |
| Retained `attrs.action` 对应的 `ms-action` 暂不可用 | **保留基础 Action 请求**，按 §5.14 对本应运行的基础时间轴继续累计 `elapsedMs`；子节点/Clip 恢复后直接重新定位帧，不重播，不改选业务 Action |
| 当前 Action 定义存在但基础图像尚未就绪 | 保留基础 Action 状态与资源加载；绘制失败或暂缺时使用明确的渲染诊断，不凭空选择另一动作 |
| 新 Event / 禁用 one-shot / 子节点 Clip 替换或删除 / 外观变化 / 组件断开 | 过期异步解码或绘制结果不得覆盖新状态；读取取消、缓存 pin/unpin 与有效版本检查依然适用 |

实现边界：

1. `ms-avatar` 的 **Animation Player 时间推进不能因某张资源读取/解码/绘制 Promise 未完成而暂停**。现有 `cms-actor` 实现的 `_paintPending` / `_lastTick` 可能暂停动画直到绘制完成，这是**需要重构的已知差异**，不能将旧代码直接视为满足本规则。
2. 必须区分“动画当前应处的帧”与“某次异步绘制请求最初抓取的帧”。资源就绪时应读取当前播放状态并触发合适的新一轮绘制；旧请求按版本/绘制 epoch 检查丢弃。内部 epoch 是异步过期保护，**不是 RenderNode `action-seq`**。
3. 一次性 Event 若恰好在 `ms-action` 子节点/Clip 尚未提交并进入父组件有效索引时到达，按缺少 Action 直接丢弃；上游应尽量**先发布并确认可供父组件读取的动作定义，再触发 Event**，但 LoomRealm 的有序消息不保证位图下载或解码已完成。
4. 诊断不改变 Subsystem 技能成功与否，不应把无资源的单次动画反向判定为未释放技能。资源和错误报告的具体诊断字段在实施契约中定义。
5. 一次性动作的本地时间起点为**Renderer 接受该 Event 的时间**；不假设能够推断其在 Subsystem 中开始的精确时刻。网络传输的固有延迟仍存在，本策略只避免**额外等待解码而补播**。
6. 这是当前 Event 最佳努力的视觉产品语义；不是网络实时交付或至少一次显示的保证。

验证样例：缺失 Action 丢弃且不晚补；慢资源返回时跳到当前帧；超过完整时长后不播迟到动作；新的同名 Event 失效旧请求；强制禁用后旧图片不能覆盖基础动作；基础动作缺失仍保留请求；模拟多轮绘制交错不会泄漏位图资源。

### 5.8 第二阶段已确认：显式暂停与未绘制时间分离（方案 B）

**已确认原则：只要选定的 Render Clock 未被显式暂停，浏览器后台、掉帧或短时间未收到绘制回调均不视为动画暂停。** 下一次可绘制时应按该 Clock 在此期间实际经过的时间定位当前帧，**不逐帧补画**，一次性动画如果已经到期则立即回到最新基础 Action。此规则与 §5.7「资源未就绪仍继续计时」一致。

| 场景 | 预期行为 |
| --- | --- |
| 当前父级 Render Clock 显式暂停 | 冻结身体、one-shot 与表情播放相位；不可回退至本地 Clock 绕过暂停 |
| 显式暂停后恢复 | 从暂停的相位继续，**不计算暂停区间的时间** |
| 当前 Clock 运行但页面在后台、RAF 被浏览器停调、或严重掉帧 | **时间仍经过**，下次回调定位当下帧；已到期 one-shot 结束，不补播遗漏帧 |
| 同一 Clock 下连续画面请求 / 资源加载延迟 | 不阻断动画时间推进，只更新可见的最新帧 |
| Clock 切换 | 沿用 §5.1：保留 Animation Player 播放状态和相位，重新建立新时钟采样基准；**不能用新旧 Clock 的绝对时间直接相减** |
| DOM 断连 / 组件销毁 | 按 §5.9：同实例断连冻结、重挂保留播放相位；新实例只恢复 retained 基础动作 |

**时钟提供方的最低行为要求**：若使用 §5.2 的 `subscribe(deltaMs)` 形式，`deltaMs` 必须代表上一次有效采样以来**未暂停的实际经过时间（毫秒）**，而非固定帧步长。隐藏页恢复不能简单按 16ms 或固定上限裁掉已过时间；可以限制单次计算工作量，但不得把 3 秒真实间隔变成 16ms 动画时间。显式暂停区间必须从 delta 中排除。每个 Animation Player 应以累计时间/动作持续时间**直接求当前帧**，避免高延迟后循环追赶成千上万帧。

此处的「实际时间」是 Renderer 的单调呈现时间基准，**不是** Subsystem 的物理/战斗权威时钟，也不保证服务器开始动作的精确时刻。暂停由当前选定时钟的语义决定；Simulation 暂停若要同步暂停画面，必须由 Adapter/场景显式投影到 Render Clock，不能由 Avatar 自己猜测。

**OpenMS 参照**：固定版 `animation-timing.js` 提供 `loopTime` 和 `timedFrame` 等按经过时间定位帧的机制，但并未规定我们的浏览器后台、父级 Clock 继承和暂停传播策略；这些是 Adventure Island 的产品选择。

### 5.9 第二阶段已确认：DOM 断连冻结、同实例重新挂载继续

**已确认**：DOM 断连属于组件主动挂起，区别于连接状态下浏览器后台/掉帧（§5.8）。即使元素不在 DOM 中的实际墙钟时间很长，**同一组件实例**重新挂载后也从断连前的动画相位继续，不补算断连期间的时间。

| 场景 | 处理 |
| --- | --- |
| 同一 `ms-avatar` 元素从一个父节点移动到另一个父节点 | 断开旧 Clock 订阅，重新解析最近祖先 Clock，保留基础动作、身体/表情相位和正在播放的 one-shot |
| 元素暂时断开 DOM | 停止时钟订阅与绘制，冻结 Animation Player；取消/失效在途绘制、释放无需保留的位图或读取工作，不丢弃用来恢复绘制的 Action/Plan 语义状态 |
| 同一元素重新连接 | 重新发现可用的祖先 Clock（否则本地 Clock），建立新的时间采样基准，从冻结相位继续，不重播 `attrs.action` 或既有 one-shot |
| 断连期间 retained attrs 发生变化 | 重新连接时以**最新** `attrs.action`、`one-shot-enabled` 为准；`one-shot-enabled=false` 仍须清除 one-shot，不能因为冻结而绕过强制禁用 |
| Renderer 销毁旧组件并创建新实例（含重建 / 重连 Snapshot） | 新 Animation Player 仅根据 retained `attrs.action`、许可、共享外观数据和现存 `ms-action` Clip 建立基础画面；**不恢复之前 transient Event 的 one-shot 相位** |
| 实例最终不再使用 | 解除订阅、丢弃本地播放状态并清理图像资源；`disconnectedCallback` 本身不等价于“确定永久销毁” |

具体示例：`brandish1` 总时长 800ms，播放 200ms 时元素断连；即使三秒后将**同一实例**重新挂载，仍从约 200ms 相位继续。相同场景若创建的是**新实例**，则直接显示最新基础 Action，不补播旧 Event。

**时间规则优先级**：`one-shot-enabled=false` 强制终止优先于保留 one-shot；其次 DOM 断连冻结；已连接时由当前选定 Clock 决定暂停或正常经过时间。挂载/切换时钟时只重置采样基准，不清除累计相位。异步资源任务必须有断连及新绘制版本的过期检查，防止旧请求在挂载后抢画。

**注意**：这个规则只保证**同一 JS/DOM 实例**的视觉状态保持；LoomRealm RenderNode 的 `key` 不是跨组件重建恢复 transient Event 的凭证。

### 5.10 第二阶段已确认：父级 RenderClock 对象身份稳定

- **父级时钟提供者在有效生命周期内始终返回同一个 RenderClock 对象**。暂停、恢复、改变内部 RAF/调度方案、时间策略更新均在该对象内部完成，不要求下游 Avatar 重新订阅。
- Avatar 初次连接、同实例重新挂载或 DOM 祖先变化时寻找最近有效提供者；不逐帧搜索。
- 有效但**暂停**的时钟继续被继承，不视为失效，禁止启用默认时钟绕过暂停。
- 时钟提供者退出有效生命周期或主动取消提供能力时，必须触发可检测的**失效通知/解除流程**，由仍连接的后代重新查找其他祖先时钟；找不到才使用默认时钟。不能静默停止推进。**通知 API 的最小形式尚待实施契约细化**；稳定身份不意味着无须提供失效信号。
- 切换到另一提供者或默认时钟时延续 Avatar 自己的 Animation Player 相位并重置采样基准；不得把两个时钟的绝对时间相减（§5.1、§5.9）。

这属于 Renderer 内部组件协作协议，**不要求 LoomRealm RenderNode/Render Update v1 新增字段**。

### 5.11 未决问题索引（完整清单见 §10）

1. **`ms-action` Clip Schema**：动作名、帧、循环边界、零延迟/缺失 delay、资源引用版本；父级共用外观数据（如 `appearance`）与子节点内容如何一致验证。
2. **时间轴原则已确认（§5.12、§5.14、§5.17）**：同名有效 Clip 热更新保留 `elapsedMs`；one-shot Clip 失效取消；基础 Clip 缺失时本应运行的时钟继续；one-shot 覆盖期间冻结基础时间。换装的关联数据同次原子提交（§5.13）。
3. **父子数据通知与首次就绪原则已确认（§5.15、§5.16）**：子组件主动通知 + 父组件关键入口同步查询；首次按当前所需动作局部就绪，不设全局 Ready。**仍待实施**：具体事件名/方法、父子回调交错的完成判据与删除时通知机制。
4. **当前外观动作覆盖率与容量**：OpenMS 的预定义 Action 集只是参考，不可将 126 动作直接等同于 CMS079 必须全量传输；测量真实 CMS079 样本后确定应用级限制（D11/V01）。动作名索引和 fresh key 重命名规则已在 §5.19 确认。
5. **未来精确重放**：现方案接受 transient Event 不重放；必要时另议 retained 相位/动作起始事实。Clock 失效通知 API 留待实施阶段。

以上已确定第二阶段主要行为、动作拆为子节点及首次局部就绪原则；未冻结完整 `ms-action` Clip Schema 或内部通知 API。**全部剩余设计、实施与验证事项统一列在 §10，避免把已确认原则再次当作待决方案。**

### 5.12 第二阶段已确认：ms-action Clip 更新与移除

**已确认规则**：`ms-action` 的 Clip 内容变化是**绘制定义热更新**，不是新的 Action 播放指令。只有新的 `render.event("action")` 才会触发一次性动作从头重播。父 Avatar 持有的播放时间 `elapsedMs` 是迁移依据，**不直接继承旧帧号或以新总时长归一化相位百分比**。

| 当前情况 | 父级 `ms-avatar` 的处理 |
| --- | --- |
| 正在播放的基础 Action，收到**同名且校验有效**的新 Clip | 保留基础播放实例已累计的 `elapsedMs`，基于新 Clip 的帧时长、循环/末帧规则**重新求当前帧**；不从第 0 帧重启 |
| 正在播放的 one-shot，收到**同名且校验有效**的新 Clip | 保留该次 one-shot 的 `elapsedMs`，按新 Clip 的 `once` 时间轴重新定位帧，不重新触发技能 |
| 新 one-shot Clip 总时长变短、`elapsedMs` 已达到或超过新时长 | 立即判定该 one-shot 已结束，回到最新 retained `attrs.action` |
| 当前 one-shot 对应子节点被移除、Clip 无效或不再可用 | 立即取消该 one-shot，回到最新基础 Action，**不保留待补播任务** |
| retained 基础 `attrs.action` 对应的 `ms-action` 被移除、Clip 无效或不再可用 | 保留 `attrs.action` 原值并记录可定位诊断，不擅自选择另一业务 Action；缺失与恢复时的基础动作时间按 §5.14 继续累计和重新定位 |
| 非当前动作的 Clip 更新或移除 | 更新动作索引与依赖资源引用；不得重启或扰动当前有效动作的播放相位 |

实施要求：

1. 父组件以 **Action 名 + 已验证 Clip** 建立索引。新 Clip 到达后，应替换对应播放实例引用，依据其累计时间重新 seek；帧索引必须重新计算。比如旧帧时长 `[100,100,100,100]`，新帧时长 `[150,150,150]`，累计 250ms 对应旧帧 2、新帧 1。
2. 不能因为新 Clip 帧数、帧布局、时长或绘制图层不同就**默认重播**；先用新 Clip 的既定播放规则定位。若定义无法通过校验，则视作该动作暂不可用，不对错误数据 seek。
3. `one-shot-enabled=false`、新的 action Event，以及同名 one-shot Clip 的删除/失效，继续分别触发既定的强制终止、替换或取消语义；**Clip 更新本身不产生新的 Event**。
4. Clip 更新、删除、父级共享外观变化必须使旧异步绘制结果失效；图片加载仍由 Avatar 统一负责，不阻塞动画计时。已存在有效 Clip 的图片尚未解码完成，**不等于** Clip 已被删除。
5. 父级数据与各 `ms-action` 子节点通过 LoomRealm 分别投影，任何一次 `RenderDomain.update()` 已提交的单节点 Clip 更新在父组件同步读取到最新有效定义后才能用于新一轮绘制。面向 Event 的动作查询也必须同步以当前有效索引为准，不能仅等待异步 `MutationObserver` 回调。一次换装的父子关联变化须按 §5.13 **同次原子发布**；不能用一次微任务延迟假装跨提交原子性。跨提交的阶段性换装本设计不支持。
6. 原有实例同名 Clip 更新允许继承时间；组件重建是新实例，仍只从 retained 基础 Action 初始化，不恢复 transient one-shot。该迁移规则是 **Adventure Island 新组件设计**，不能归因于 OpenMS 原生热更新：OpenMS 的 `EntityAnimation` 支持 seek，而它的换装流程可先准备新 Avatar 再整体替换。

**验收情景**：当前基础动作时序变化不重启、同名 one-shot 更新不重播、one-shot 缩短后立即完成、one-shot 子节点消失/失效立即取消、基础子节点消失不改变 `attrs.action`、非活动动作更新无副作用、异步旧画面不覆盖新 Clip。

### 5.13 第二阶段已确认：换装的父子数据原子发布

**已确认：同一角色的一次换装是一个逻辑外观事务。** Adapter 必须先在 Subsystem 侧准备、验证该外观和所有受影响的 `ms-action` Clip，再**通过同一次 LoomRealm RenderDomain 原子提交**发布；不允许先发布新 `ms-avatar.data.appearance`、之后陆续更新受影响的动作，或反向操作，以免产生新旧武器/部件和姿态混画。

| 变化类型 | 发布方法 | 边界 |
| --- | --- | --- |
| 与换装无关、只修改一个已存在的 Clip | `RenderDomain.update()`，只更新该 `ms-action` 的顶层 `data.clip` | 单动作独立热更新，沿用 §5.12 的 `elapsedMs` 语义 |
| 换装且所有需要的 `ms-action` 节点身份/集合不变 | **一次** `RenderDomain.update()`，同时设置父节点共用外观 `data` 与所有受影响的子节点 `data.clip` | 提交前确认未变 Clip 对新外观仍然有效；不能把“未修改”自动视为“兼容” |
| 换装涉及新增、删除或重排动作子节点 | **一次** `RenderDomain.replace()`，提交完整新 RenderNode 树 | `update()` 不能修改 `children`；`replace()` 不意味着逐子节点延迟传输 |
| 换装与动作选择同时发生 | 将所需 retained `attrs.action` / `one-shot-enabled` 与外观/Clip 变化纳入**同次**提交 | 先校验最终状态，再允许渲染该组合；旧 one-shot 的中断及同名热更新仍按既定规则 |

简化示例（只更新既有节点；键名仍是候选 Schema）：

```js
domain.update({
  nodes: [
    { key: "avatar:player", data: { set: { appearance: nextAppearance } } },
    { key: "avatar:player:walk1", data: { set: { clip: nextWalk1Clip } } },
    { key: "avatar:player:swingO1", data: { set: { clip: nextSwingO1Clip } } }
  ]
});
```

**需要明确的两层原子性：**

1. **Render Store 层**：LoomRealm Render Update v1 在一个 Domain commit 中对全部更新建立 isolated candidate 并一次 atomic commit；对应用而言，应在发出更新前完成整套外观数据准备，避免多次独立提交中的可观察混合状态。
2. **Web Component 呈现层**：LoomRealm WebProjector 会把父子各自的 `data` 交给对应元素的 `receiveRenderData()`，这些**不是一个合并后的父组件回调**。因此父 Avatar 必须在实际绘制和接纳依赖新外观的 Event 前，使本地共用数据及全部受影响 `ms-action` Clip 达成有效、一致的**已投影组合**；投影未完成或校验失败时，不得绘出混合帧，也不能把旧 Clip 当作新外观中的有效动作。通知与按需同步读取原则按 §5.15；**首次挂载/事务投影完成的可验证门槛**及跨回调交错细节仍需实现契约与集成测试验证。
3. **没有跨多个 Domain 或跨多个提交的原子性承诺**：若父节点及子节点不在同一个 Domain，或者外观被拆为连续多次 Update/Replace 发表，**不符合本条要求**。有跨提交分阶段准备的真实需求时，再讨论 retained 版本号与显式激活协议。

**目前不增加 `appearance-version` / `clip-version` 这一套用于换装同步的冗余 ABI 字段。** 原子提交与父组件的组合校验是首版约定；资源自身的 `contentVersion` 仍需正常验证，它不是外观事务版本号。

换装发生时，若同名 Action 的新 Clip 有效，继续沿用 §5.12 的 **保留 `elapsedMs`、按新 Clip 定位帧**；若对应 one-shot Clip 被移除/失效则取消；图像解码未完成时遵循 §5.7 时间一致性原则，不必等图片全部就绪，但不可使用新旧外观混合图层。

**验收情景**：只换已有武器相关 Clip、增减动作节点的整树替换、换装与 `attrs.action` 同时更新、未修改的 Clip 经验证可复用、父子数据回调出现先后差异、异步旧图片返回晚于新外观、跨提交错误使用被 Adapter 检测。

**OpenMS 对照**：`prepareFieldAvatar()` 先准备新外观、图集和动画；`publishFieldAvatar()` 再发布新显示对象。我们保留“先准备一致状态、再发布”的原则，但 LoomRealm 原子 RenderNode 提交与独立子组件是 Adventure Island 的设计，不是 OpenMS 原生 ABI。

### 5.14 第二阶段已确认：基础 Clip 暂缺期间的时间连续性（方案 B）

**已确认**：retained `attrs.action` 的基础动作定义（`ms-action` 子节点/已校验 `data.clip`）临时缺失或无效时，**不将该数据缺失解释为 Render Clock 暂停**。保留基础 Action 请求及 Animation Player 的本地时间事实；只要基础动作按照既定播放策略本来应推进，仍随当前有效 Render Clock 累计其 `elapsedMs`。恢复有效 Clip 时，直接根据**当前累计播放时间**和新 Clip 的时长、循环、hold 语义定位当前帧，**不从第 0 帧重播、不补画缺失时间内的帧**。

| 场景 | 处理 |
| --- | --- |
| `attrs.action="walk1"`，已播放 300ms，Clip 缺失时 Render Clock 仍运行；2s 后恢复 | 保留基础动作选择，累计时间到约 **2300ms**；恢复时在有效新 Clip 上 seek 2300ms 对应帧，不从 300ms 或 0ms 开始 |
| Clip 自首次投影开始就不存在，但 retained 基础动作已经被选择 | 可照常累计此基础动作本应经过的本地时间；待有效 Clip 出现后据此定位，而非以 Clip 到达时刻作为动作开始时间 |
| Clip 存在，但图像尚在下载、解码 | **不属于 Clip 定义缺失**；沿用 §5.7 的资源延迟规则，时钟照常经过 |
| 当前 Render Clock 显式暂停 | 仍然冻结，不因为 Clip 恢复而补算暂停时间 |
| 同一 Avatar 实例断开 DOM | 仍然冻结；重挂按 §5.9 保留已有相位，不补算断连时间 |
| 基础动作 Clip 缺失期间收到一次性 Event | Event 仍依赖**自身** Clip 是否有效（§5.7），不因为基础动作缺失而另行缓存；one-shot 与基础动作的既有覆盖关系保持不变 |

**边界**：

1. 只是在既定时间推进策略上增加“缺少 Clip 不能阻止应有的时钟推进”，**不擅自决定 one-shot 覆盖时基础 Action 是否并行计时**：若该情景此前的 Player 策略将基础时钟挂起，就不在缺失期间额外推进。这项覆盖下的基础时钟策略另行裁决。
2. 不能在 Clip 缺失时复用已失效的旧 Clip 帧假装当前动作有效；应记录缺失诊断并等待有效定义、资源和绘制上下文。Clip 恢复不导致自动选择新的业务 Action。
3. 基础 Action 名确实变化时遵循原有 retained 动作选择规则；**重复投影同名 `attrs.action` 不重启**。缺失后的恢复只是动作定义变化，不等于新动作事件。
4. 计算继续使用 Render Clock 提供的未暂停时间；不引入 Component 自己的墙钟补偿，也不借用 Subsystem 的战斗权威时间戳。

**验收场景**：无 Clip 时经过 2s 后恢复 seek；Clip 恢复于循环后缀阶段；非循环动作已过终点则保持末帧；显式暂停/断连期间不累计；同名重复 retained 投影不重启；one-shot 所需 Clip 缺失时 Event 仍丢弃、不补播。

### 5.15 第二阶段已确认：ms-action 主动通知 + Avatar 关键入口同步查询

**已确认父子协作原则**：单个 `ms-action` 的 `receiveRenderData()` 更新不自动变成 `ms-avatar.receiveRenderData()`。子组件需在本地更新和校验完成后，**主动通知所属 Avatar：“我的动作定义可能已变化”**；父组件将通知视为**索引失效信号**，而不是立即播放或绘制指令。父组件在**实际需要使用动作定义时同步读取当前直接子节点的已验证 Clip**，不依赖异步 `MutationObserver` 结果的及时性。

| 数据/结构入口 | 已确认处理原则 |
| --- | --- |
| `ms-action.receiveRenderData()` 收到新的 Clip | 子组件保存当前候选及校验结果（包括失效状态），主动向所属父 Avatar 通知定义变化；错误定义不可沿用旧有效 Clip 假装最新数据 |
| `attrs.name` 变化 / 子节点连接、断开、移动 | 父级的动作索引必须失效；`MutationObserver` 可辅助结构发现，但不是唯一的准确性来源 |
| `ms-avatar.receiveRenderEvent("action")` | **同步检查最新直接子节点 + 当前有效 Clip**，确认名称唯一、定义已验证及整体外观组合可用，再决定接纳或丢弃；禁止只信任尚未刷新的缓存索引 |
| 准备实际绘制时 | 如果索引被标记为脏，统一同步刷新受影响的定义和有效外观组合；不要求每帧递归扫描全部 DOM |
| 子节点通知先于父级 `data.appearance` 回调 | 只能标脏/延期组合，**不得凭先收到的数据就绘制新旧混合外观**；换装仍要求 §5.13 的单次 Domain 原子发布 |
| 当前动作消失、失效或被新的同名 Clip 替换 | 在读取最新有效索引后按 §5.12/§5.14 的取消、保留 `elapsedMs` 和重新 seek 规则处理 |

**实现边界和不可假设的保证**：

1. 推荐内部机制：`ms-action` 在校验并替换本地快照后同步触发**仅供组件之间使用**的变更通知；`ms-avatar` 同步读取子组件公开的只读 Clip 状态。**具体通知事件名称、事件详情、查询方法与错误接口尚未冻结**。
2. `MutationObserver` 可用于发现子节点的增删/移动和属性变更，但不会自动发现子节点 JS 私有的 Clip 数据变化，也不能保证在紧随而来的 `render.event` 前执行；必须在 Event 入口以当前直接子节点和 Clip 状态重新确认。
3. `connectedCallback()` 不代表 initial attrs、children、data 已到齐。动作索引只能收录**真实存在、已收到数据并通过校验**的直接 `ms-action`；空壳元素不是有效动作。**首次按当前所需 Action 局部就绪、不等待全部动作**见 §5.16；具体投影完成判据仍待实施。
4. LoomRealm 已保证 preceding retained commit 在 eligible Event 之前完成相应 WebProjector reconcile / data delivery attempt；这**不等于所有业务组件的数据校验或异步绘制已成功**。Event 仍然可能因 Clip 缺失/失效而丢弃，不缓存补播。
5. 同名重复必须诊断并阻止歧义，不能依据 DOM 顺序静默挑一个。旧元素在更换父级或删除后发来的迟到通知不得修改新的索引；过期图片绘制仍须按 epoch/有效状态失效。不得从组件内部通知回写受管理的 RenderNode attrs/data/children。

此规则只涉及 Renderer 内部父子 Custom Element 协作，**不修改 LoomRealm RenderNode、Render Update v1 或 RenderEvent ABI**；无需新增业务 `action-seq`。

**验收场景**：已存在子节点 Clip 独立更新、紧随更新的同名 Event、同步 Event 先于 `MutationObserver`、父/子 `receiveRenderData()` 交错、首次挂载空壳子节点、DOM 删除后迟到通知、重复动作名、失效 Clip 不使用旧定义、换装提交后禁止混合帧。

### 5.16 第二阶段已确认：首次挂载按当前动作就绪（方案 B）

**已确认：不设置整棵 Avatar 动作树的全局 Ready 门槛**。首次挂载及同实例重新连接时，`ms-avatar` 只要求当前待呈现内容具有**有效的父级共享外观数据 + 当前需要的已校验 `ms-action` Clip**；其他未使用动作尚不存在、尚未收到 `receiveRenderData()` 或校验失败，不能因此阻止一个可用的基础动作绘制。

| 初始/重挂状态 | 已确认处理 |
| --- | --- |
| `connectedCallback()` 刚执行，子节点/attrs/data 尚未齐备 | 只建立生命周期、时间源与监听；**不假设此时能绘制或接纳全部 Action**；在后续数据变化和真正使用动作时重新检查 |
| 父级当前共享外观定义尚未有效 | **不绘制**依赖该外观的帧，不以旧/不完整部件拼接；记录可定位诊断或尚未就绪状态 |
| 父级共享外观有效，当前基础 Action 的 Clip 已校验有效 | **允许开始或继续基础动作呈现**，不等待其他不相关动作的 Clip |
| 另一个未使用的动作（如 `swingO1`）尚未有效 | 不阻断当前 `stand1` 等有效基础动作；该动作之后准备好时只刷新索引及必要资源状态 |
| 收到 `render.event("action")` 且目标 Clip 当时有效、与父级共享外观形成有效组合、`one-shot-enabled` 许可有效 | 允许一次性覆盖，从 Event 被 Renderer 接受的时刻计时，不等待图片解码 |
| 收到 Event，但目标 Clip 当时未就绪或无效 | **立即丢弃，不排队补播**；其他已就绪动作的可绘制性不受牵连 |
| 当前所需 Clip 定义有效、图片未解码或未下载 | 时间仍照常推进，图片就绪后绘制当前帧；**Clip 已就绪不等于像素已就绪** |
| 当前基础 Clip 仍缺失 | retained `attrs.action` 保留，按 §5.14 累计本应经过的时间；定义有效后 seek，不重启 |

实现原则：

1. **动作局部就绪，不要求全部就绪**。每个 Clip 需已真实收到数据、通过校验，并可与当前父级共享外观组成合法绘制事实；一个刚插入 DOM 的空 `ms-action` 不能算有效定义。不存在整个角色的额外 `avatar-ready` retained attrs 或 `data` 字段。
2. **首挂并非构造完成**。按 §5.15，`connectedCallback()` 不能作为投影完成通知；初次接收父级 `receiveRenderData()`、子 `receiveRenderData()`、属性和 DOM 结构变化后，执行必要的同步索引与组合校验。正常绘制入口只访问当前需要的已验证 Clip。
3. **换装的事务一致性要求不放宽**。按 §5.13，外观与受影响 Clip 必须同次 Domain 原子发布；就绪判据只让**不相关的其他动作**不阻塞，不得借“局部 Ready”混用新旧装备或遗漏必要的共享外观依赖。父/子回调顺序与投影完成判据的接口细节尚待实施验证。
4. **生命周期和播放原则不变**。首次创建的新实例只恢复 retained 基础动作；同一实例重新连接保留断连冻结相位；one-shot 不重放；Clock 显式暂停、DOM 断连均遵守既定冻结规则。首次连接但 Clip 尚未有效时，仍按 §5.14 处理被选中的基础动作时间。
5. **不以全部图片解码完成作为 Ready**；允许有效动作的时间线先于像素可用继续运行，禁止迟到的异步旧帧覆盖新外观。

**验收情景**：只有 `stand1` 有效即可显示，`swingO1` 缺失不阻塞；父级外观缺失不能绘制；子节点先进入 DOM 后收到 Clip；父/子交付次序互换；Clip 有效但资源慢；未就绪技能 Event 丢弃且之后不补播；同实例重挂时间连续、fresh 实例不恢复 Event；换装未完整投影不得混画。

**实现验证重点**：LoomRealm Web Presentation API 仅保证 initial insertion 和 retained commit 相关的 `receiveRenderData` *attempt*，不提供所有业务子组件的聚合 Ready 回调。具体初始化/绘制调度机制需要浏览器集成测试确认，不因本项原则已确定而宣称 ABI 或实现完成。

### 5.17 已确认 D01：one-shot 覆盖时冻结基础 Action 时间

**方案 A：当前基础动作由 one-shot 覆盖时，基础 Action 的 `elapsedMs` 冻结；只有当前呈现中的 one-shot 时间轴继续按 Render Clock 推进。** 攻击/技能覆盖仅改变视觉播放，不反向变更 Subsystem 的 retained 业务 Action。

- 例如 `walk1` 播至 300ms，收到总长 800ms 的 `brandish1` Event：攻击期间 `walk1` 停留在 300ms。攻击自然完成后，若 `attrs.action` 仍是原 `walk1` 且从未改选，恢复 `walk1` 的 300ms 相位，再按 Render Clock 继续推进。
- one-shot 期间若 `attrs.action` **改变为另一个名称**，只更新基础动作的待恢复选择，不中断正在播放的 one-shot；返回新基础 Action 时从 0ms 开始。若中途先改成其他名字、再改回 `walk1`，也视为发生过改选，不能恢复原先冻结的 300ms。
- 新 `action` Event 到来时，立即替换/重启 one-shot 的时间轴，从该 Event 到达时刻开始，但基础 Action 仍处于冻结状态。设置 `one-shot-enabled="false"` 或因对应 Clip 删除而取消 one-shot 时，按相同的基础恢复规则处理。
- **冻结基础时间不等于暂停整个 Render Clock**：独立表情时间轴继续按照自己的有效 Clock 推进（除非 Clock 显式暂停、DOM 断连）；图片未解码不停止 one-shot 计时。仅当基础动作自身本应运行时才受 §5.14 的“缺 Clip 继续累计”规则约束；被覆盖时不会为基础 Action 偷偷补算时间。
- 同名有效基础 Clip 在覆盖期间热更新时，可重新绑定其定义，但保留冻结的 `elapsedMs`；之后恢复时按新 Clip 重新定位帧（§5.12）。组件重建不会恢复 transient one-shot（§5.9）。

**验收**：`walk1` 300ms → one-shot 800ms → 同名基础回到 300ms；one-shot 中更改基础名则新动作 0ms；改走再改回仍是新选择；连续 Event 和强制取消均保持基础冻结/恢复语义；表情不被 one-shot 停止。

### 5.18 已确认 D03：独立表情模型

**表情的动态选择入口为 retained `ms-avatar.attrs.expression`。** 表情定义、绘制帧、延迟与循环描述属于**父级 `ms-avatar.data` 的共享外观数据**，不额外建立一批身体 `ms-action` 子节点来承载表情。实际 Schema 字段路径、可用表情名字与异常值规则在 D08 / I05 中定稿。

- Avatar 持有独立于身体基础 Action、one-shot 的 **Expression Player / `expressionElapsedMs`**。仅当 `attrs.expression` 的有效名字发生变化时才从该表情第 0 帧重启；重复投影同名属性不重启。
- 表情帧的循环/停留按照表情数据定义推进；与身体动作时间轴**各自计算帧**。身体 one-shot 覆盖或结束不会重置表情播放相位；**当前有效 Render Clock 显式暂停和同实例 DOM 断连则一并冻结**。
- 身体绘制定义中的 `showFace` 仅决定当前身体帧是否显示面部表情，不改变 retained `attrs.expression`，也**不暂停或重启**表情 Player；重新允许显示时展示当前表情帧。
- 表情资源与身体层的图片共享父 Avatar 的 Content Resource Client / 解码缓存（§6.1）。表情定义缺失、位图尚未就绪时不反向更改业务表情选择，不从身体动作猜出新表情；缺失与无效呈现行为按已确认 D12（§6.4），具体诊断 API 仍属 I05。

**验收**：攻击时表情继续推进；`showFace=false → true` 不重启动画；更换表情名才重启、同名重复属性不重启；暂停与断连同时冻结身体及表情。

### 5.19 已确认 D04：动作名称和 RenderNode 身份

- 直接 `ms-action` 子节点的动作名来源正式确定为 **`attrs.name`**，使用**区分大小写的精确字符串匹配**；父 Avatar 按该属性映射至已验证 Clip，不使用 DOM 序号或 RenderNode `key` 猜测动作名称。
- 同一个 `ms-avatar` 下必须对动作名称保持唯一；出现重复时应作为**动作索引冲突**诊断，对冲突名称 fail closed，不能依 DOM 顺序挑选“第一个”。不应因为一个冲突就默认中断所有无关的有效动作。
- **不允许在同一个 live RenderNode key 上直接重命名 Action**。改名属于身份变化：Adapter 删除旧 `ms-action` 节点，并以 **fresh key** 创建新名字的子节点，使用符合 LoomRealm key one-shot 生命周期的 `RenderDomain.replace()`。旧名字失去定义按 §5.12/§5.14 处理；新名字不会自动生成一次性 Action Event。
- 当前节点 key 与动作名是两种不同身份，内部索引必须验证它确实是**当前 Avatar 的直接子节点**，并排除迁移父级后的迟到通知。动作名是否允许特殊字符、精确长度上限以及源目录别名的映射待 D05 / V01 夹具验证后写入 Validator，不改变本项的精确匹配和 fresh-key 重命名原则。

**验收**：`walk1` 与 `Walk1` 不混淆；重复 `walk1` 被拒绝但其他动作仍可用；旧 key 上改名字被 Adapter/Validator 拒绝；新 key 重命名遵守删除后不可复用 key 的规则。


## 6. 外观数据、动作子节点与资源所有权

**已确认**：游戏侧 Adapter 解析 CMS079 的 `islot/vslot/zmap/smap` 和原始绘制事实；Renderer 不反向解析 WZ。数据按以下职责拆分：

| 数据或资源 | 所有者 | 职责 |
| --- | --- | --- |
| 角色共用的外观绘制信息（zOrder、资源索引、表情帧和跨动作绘制事实） | **`ms-avatar.data`（D08 已确认归属，字段待定）** | 提供多个动作共用的渲染事实，不重复存放完整动作帧 |
| 单个动作合成帧、delay、循环规则、层变换及共享图集裁剪引用 | **对应 `ms-action.data.clip`（D08 已确认归属，字段待定）** | 单独更新和校验，父 Avatar 按动作名获取；引用父级共享图集/资源身份 |
| 图片/图集下载、解码、资源版本校验、缓存及释放 | **`ms-avatar`** | 统一共享资源，避免各 Action 独立持有同一图集 |
| 当前播放的 Action、身体/表情相位、one-shot 覆盖 | `ms-avatar` 的 Animation Player | 跟随继承或本地 Render Clock 推进；不写回 RenderNode |

OpenMS `AvatarVisuals.prepare()` 先按所选部件加载图集，`composeAvatar()` 再为当前外观合成动作集，`EntityAnimation` 从既有动作中播放；我们保留**动作在播放前就应准备好**的原则，但以 `ms-action` 子节点表达已合成动作，而不是原样复制 OpenMS 的 PixiJS 资源布局。

**容量与更新语义**：

- LoomRealm Core 没有通用的单个 RenderNode `data` 字节或节点数量硬上限。旧版 `AvatarPlanV1` 的 256 KiB / 32 Action 属于组件级约束，**不能因为拆分子节点就认为没有传输成本**。
- 现有动作的 Clip 变化可以 `RenderDomain.update()` 指定子节点 key 独立更新；添加、删除和重排动作子节点要 `RenderDomain.replace()` 提交树结构。初始 Snapshot 和 `replace()` 仍涉及整个当前树，**不是流式按需下发**。**换装引起的父子关联更改需要按 §5.13 一次原子发布**。
- 动作范围应覆盖当前角色外观能够实际触发的基础、攻击和技能姿态，并尽可能在 Event 前准备；具体集合不能直接硬编码为 OpenMS 的 126 项，也不能直接照搬旧版 32 项限制。
- `ms-action` 不负责下载/解码。图片可在父 Avatar 内按需要加载或预读；缺像素但 Clip 有效时，遵照 §5.7 时间一致性规则继续播放时钟。
- 是否将多动作共用的图层、锚点或资源引用做进一步去重、是否存在独立的动态内容发布接口，均待真实 CMS079 数据测量后决定。**不支持把一次换装分成多个可见提交逐步替换 Clip**。
- **已确认 D12（§6.4）**：资源缺失、Action 缺失及父子外观不匹配须分类诊断、fail closed、不得显示失效旧像素或静默改选业务 Action；具体错误码和宿主暴露接口由 I05 落地。

见 [ms-action 设计文档](./ms-action.md)。

### 6.1 已确认 D09：资源引用与统一图片缓存契约

**数据格式遵守现有 LoomRealm Content 资源身份**：以 `namespace`、`key`、`contentVersion` 识别图片/图集版本，由父 `ms-avatar` 的 `PresentationResourceClient` 读取。Clip 只声明渲染所需的资源引用、图集源矩形和预期尺寸等事实，不把原始 WZ/FSDB 路径交给 Renderer，也不新增动态 Content 发布接口。

- 父级 `ms-avatar` 统一管理所有身体动作及表情共用的**请求、解码、缓存与释放**，相同 Content 资源身份应复用解码成果；`ms-action` 不单独加载或持有图片。**保留旧 `cms-actor` 的多小图合并为图集页 + `source` 源矩形裁切、整页仅加载/解码一次的能力**，不因为拆分动作子节点而退化为逐小图请求。图集如何生成、分组和发布由 Adapter/构建流程完成。
- 加载与缓存键不得忽略 `contentVersion`；返回的版本必须匹配预期，实际图集页尺寸与声明尺寸须一致，单个小图的 `source` 源矩形必须位于解码图集的合法范围。相同资源身份跨 Clip 的**图集页**尺寸声明冲突应拒绝；一页内不同小图可有不同裁剪尺寸，不得把其误判为冲突。旧缓存不得用于强行拉伸或跨版本绘制。
- 缓存管理需有在途请求取消/过期保护、活动资源 pin/unpin、受控并发及有界 LRU/逐出策略；图片资源不再被任何可见或在途绘制引用时允许释放。**具体最大缓存量、并发值和数据字段格式**仍按 V01/V03 实测和 D08/I05 定稿，不继承旧组件硬值。
- 资源读取/解码未就绪不阻止有效 Clip 的 Animation Player 按 Render Clock 计时；旧异步结果不得在 Clip、外观或播放实例变化后绘制。内容版本冲突、图片尺寸不符等**fail closed** 并产生可定位诊断，不自动回退其他版本或业务 Action。
- `contentVersion` 是 Content 字节身份，不是换装事务代号；关联外观与 Clip 的发布仍使用 §5.13 同次 Domain 原子提交，**不增加 `appearance-version`**。

### 6.2 已确认 D10：世界坐标、镜像与呈现后端边界

- **世界坐标 `x/y`、角色与地图 Obj 的深度排序属于场景/上层呈现系统**，不放入新 `ms-avatar.attrs` 的公共闭集。场景负责将 Avatar 放到世界位置；如何包装父容器或使用共享 Display List 属于场景设计，不能据此新增 LoomRealm Core 的位置字段。
- `ms-avatar` 绘制当前角色的**局部坐标系**，负责身体原点、origin/anchors、角色内部 zOrder、衣物遮挡和朝向镜像；`facing` 属性是否最终作为独立字段以及字符串值域仍在 D02 统一校验时定稿。
- **初版允许独立 Shadow DOM Canvas** 实现局部纸娃娃渲染；Painter 应与 World/Map 决策隔离，以便未来按需要抽取为可由场景调用的内部绘制能力。本项**不冻结**将来的共享 Canvas / PixiJS / WebGL 或 World Renderer ABI。
- 因此旧 `cms-actor` 接受 `x/y` 的方式不能直接复制为新组件公共契约；本文的节点示例和 Adapter 需将世界位置交给场景，而非在 `ms-avatar` 内保存两份坐标权威。



### 6.3 已确认 D08：父级共享外观与子动作 Clip 的数据分工

**已确认的是信息归属和引用关系，而不是具体 JSON 字段名。** Adapter 将当前外观所需数据准备为**父级共用绘制事实 + 各个动作自己的 Clip**：

| 数据 | 归属 | 不应承担的职责 |
| --- | --- | --- |
| 当前角色的公共绘制层序（如 zOrder）、共享纹理/图集资源索引、外观组合后的共同事实、表情帧和表情所用引用 | `ms-avatar.data`，如候选 `appearance` | 不保存一整份 `actions` 字典；不持有技能合法性或世界坐标 |
| 单个身体 Action 的帧序列、时长/循环规则，以及本动作每帧的部件布局、裁剪源矩形和共享资源引用 | 对应 `ms-action.data.clip` | 不重复缓存图集二进制；不重复写全套公共资源目录；不持有表情独立时间轴 |
| 图片字节与解码后的完整图集页 | LoomRealm Content 资源 + `ms-avatar` 的统一资源客户端/缓存 | 不以每个动作子节点为单位反复下载/解码同一页 |

- **合法组合校验**：绘制某一 Action 前，父组件必须确认该 Clip 的所有资源引用能解析到当前共享外观所发布的合法资源身份，所需 zOrder / 层依赖存在，裁剪矩形和尺寸有效，且父子数据属于同一次已经呈现完成的外观组合。不能因为同名 Clip 有帧就假设它一定适用于新装备。
- **仍支持合并小图片**：父级资源索引应容纳**图集页 + 页内小图裁剪引用**，让多个不同动作/装备部件引用同一张图集。Clip 可引用多个小图但无需携带 PNG 字节，也无需为每帧开一个 Content 请求。资源的 `namespace/key/contentVersion` 身份及完整页解码归 D09 已确认契约。
- **不重复存放跨动作信息**：共享 zOrder、资源表、表达轨数据放父级；具体动作帧在子节点。是否将 `appearance` 拆成多个父级 data 顶层成员以降低无关变更的序列化成本，属于 D02 / D05–D07 的后续 Schema 取舍，不在本轮冻结字段名。
- **换装原子性**：一次换装影响的父级信息及子 Clip 必须由同一个 Domain 的**一次 `update()` 或 `replace()`** 发布（§5.13）；即使未修改的 Clip 仍应验证与新外观兼容。首版不引入用于分批换装的 `appearance-version`。
- **可独立更新动作**：未改变共享外观身份/资源契约的单 Clip 修订可只更新相应子节点 `data.clip`；`ms-avatar` 重新校验引用后按原 `elapsedMs` 继续播放，Clip 更新本身不生成 Event。

**验收**：两个动作共用同一图集页但只读/解码一次；子 Clip 变更不重复发布共享资源字节；换装后拒绝旧装备 Clip；共享 zOrder / 表情数据由父级提供；未修改的 Clip 经兼容验证可继续绘制。

### 6.4 已确认 D12：无效数据、缺资源和诊断的呈现行为

**坚持已有原则：业务动作由 Subsystem 决定，Renderer 不凭视觉错误擅自选择另一动作，也不把渲染失败反向当作技能判定失败。**

| 类型 | 如何识别 | 呈现/时间语义 |
| --- | --- | --- |
| `NOT_READY`（候选诊断码） | 首挂时当前需要的父数据/Clip 尚未完成交付；或数据存在但暂无法构成有效的完整组合 | 未满足组合门槛前不绘制依赖该组合的帧；基础 retained 请求保留，其本应经过的时间照 §5.14 继续 |
| `ACTION_MISSING` | 当前基础 `attrs.action` 的子 Clip 不存在或失效；Event 目标 Clip 不存在 | 基础保留请求、当前无效画面不使用旧 Clip 假装成功；Event 立即丢弃且不补播 |
| `ACTION_INVALID` / `DUPLICATE_ACTION` | Clip Schema 校验失败；同父出现重复 `attrs.name` | 对受影响 Action fail closed、报告精确名称/原因；不因单个错误阻塞其他无关的有效 Action |
| `PIXELS_PENDING` | Clip 和外观组合有效，但图集尚未下载/解码完 | **不是 Action 无效**；继续时间轴，资源到达时按当前帧显示，不补画过期帧 |
| `CONTENT_CONFLICT` / `CONTENT_INVALID` | Content 版本不符、MIME/尺寸/源矩形错误、共享资源引用冲突 | 拒绝使用冲突资源、报告资源身份和预期/实际值；不得静默降级到旧图集或其他版本 |
| `APPEARANCE_INVALID` | 父数据与子 Clip 的 zOrder、资源引用或换装关联不一致 | 拒绝该无效组合，避免混用旧衣服/新姿势；保持原 retained 选择及正常的时间规则 |

- **清除过期画面**：当正在显示的动作或外观变为无效，下一次呈现不得保留上一套已失效的像素误作当前角色。可以绘制明确空状态/透明画布并上报诊断，但**不允许继续把旧装备、旧 Action 画成新状态**；具体 DOM 属性/诊断 API、是否展示调试占位图仍由 I05 定稿。
- **错误不等于等待**：对尚未就绪或图片缓慢加载可根据当前时钟等待像素；确认为无效的内容应 fail closed。one-shot 的 Event 缺定义即丢弃，图片未解码则不延迟其计时（§5.7）。
- **诊断最小上下文**：应能够关联 Avatar RenderNode key、Action 名、错误类别、受影响的 Clip/资源 `namespace/key/contentVersion`、冲突时的预期/实际摘要，以及出错阶段。避免每帧重复产生相同诊断，具体字段、错误码最终名称及宿主暴露接口由 I05 决定。
- **恢复**：收到新的有效父数据/Clip 或资源后，在关键入口重新进行组合校验；基础动作按现有 `elapsedMs` 重新 seek，不补播丢失的 Event。错误状态不能污染无关 Action、表情或 Subsystem 技能结果。

**验收**：首挂缺父数据不绘制混合帧；坏 `walk1` 不能继续画旧 `walk1`；重复 `brandish1` 只使冲突动作不可用；慢图集到达时定位当下帧；资源版本冲突不使用旧缓存；问题修复后基础动作可按相位恢复。

### 6.5 D02 / D05 / D06 / D07 / D11 的共同复核约束（尚未裁决）

**更新粒度与正确的 LoomRealm 语义**：

- `RenderDomain.update()` 的 `attrs.set/remove` 可修改少量独立属性；`data.set/remove` **也可以只修改 `data` 的顶层成员**，不是必须整体替换所有 `data`。例如 `{data:{set:{appearance: nextAppearance}}}` 只替换 `appearance` 这个顶层属性，不直接原地改 `appearance.zOrder`。WebProjector 随后交付的是**完整当前 data**，且只在结构性数据值发生变化时尝试回调。
- **D02 尚待裁决**：频繁独立变化且类型简单的显示选择应优先使用 retained attrs；不常变化的重资源目录与合成帧留在 data / 动作子节点。不要因为资源放父级就迫使每一次动作、朝向或表情变化重发整个共享外观对象。是否把共享父数据拆成独立顶层成员，待 D02/D08 字段级 Schema 定稿。
- 已确认 D10：世界 `x/y` 属于场景而非 Avatar；即使坐标变化频繁，也不能把世界坐标重新放进 `ms-avatar.attrs`。

**OpenMS 与旧 `cms-actor` 的小文件聚合事实**：

- 旧版 `cms-actor` [实施契约](../../components/cms-actor/IMPLEMENTATION.md) 已支持**图集页 `resource` + `source={x,y,w,h}` 裁剪**，同一图集多个小图共享一次 `PresentationResourceClient.resource()` 读取及整页 `ImageBitmap` 解码，缓存键是 `namespace + key + contentVersion`。这是需要保留的现有能力，不能让新 `ms-action` 变成大量逐帧小 PNG 请求。
- 固定版本 OpenMS 的 [`AvatarVisuals.prepare()`](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/avatar-visuals.js) 只准备当前外观/装备部件；[`visual-resources.js`](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/visual-resources.js) 先从当前有效动作的部件引用计算所需 atlas，再取得共享图集 lease、按裁剪矩形建立子纹理；**这是一种图集共享和有界请求管理思路，不是 CMS079 可直接照搬的打包标准**。
- **D05 / D06 / D07** 要同时检查：每一帧的纹理引用与 `source` 区域、动作帧时间与资源布局、父级共用资源索引能否表达“多个动作共用一页”而不重复图片标识；适配器是否能从 CMS079 的 alias/UOL/延迟特殊值导出稳定 Clip。
- **D11** 不只测 RenderNode JSON 体积，还必须测**小图数量、打包图集页数、Content 请求次数、图集页字节、解码后像素内存、缓存复用与换装时重载数量**。预载范围与合并图集页面大小之间存在取舍，不能仅依动作节点数决定最佳方案。
- **不要混淆两种合并**：现有 [PWA 安装包生成器](../../scripts/pwa/build-installation-bundle.mjs) 可以把 Content 项装进一次安装 payload，但这**不自动意味着运行时每张小 PNG 已合成为 atlas**。要减少浏览器的逐小图 Content 读取/解码，仍需真实的图集图片 + manifest/source rect 映射；当前 [合成 Avatar Content](../../scripts/pwa/synthetic-avatar-content.mjs) 甚至注明按 part/action/frame 生成独立 PNG，因此必须用实际 CMS079 生成链验证是否确有打图集，而不能只看安装包文件数。
- 图集生成/发布属于 Adapter/构建与 Content 层，**不是** `ms-action` 的副作用；并不意味着需要修改 LoomRealm Core，也不意味着 RenderNode 子节点数据由 Content API 单独分段传输。具体图集如何划分、是否配合共享元数据块与前端预取策略，属于**待 V01/V03 实测后决定**。

**本节记录必须考虑的复核约束，并未批准 D02、D05、D06、D07、D11 的字段级 ABI、打包粒度或容量数值。**


## 7. 和旧组件的关系

- 现有 `components/cms-actor/`、`components/RENDER-NODE-ABI-V1.md` **保持不变**。
- 新设计使用独立标签 `ms-avatar` 与数据型子组件 `ms-action`，避免新旧 Schema 在同一标签内混用。
- 可以复用现有 `avatar-model.mjs` 的几何、排序、校验逻辑与图像缓存方案，需将集中式 Plan 的校验/数据读取改为父 Avatar + 子 Action 分工；不宣称新组件已经实现。
- 新实现如果需要与场景统一 Display List 交错，可以抽取纯 Avatar Painter；不在本文件中提前决定整个 World Renderer 的节点树。

## 8. 下一轮需要逐项决定的事项

| 议题 | 当前倾向 | 状态 |
| --- | --- | --- |
| Avatar 是否只负责纸娃娃呈现 | **是** | **已确认** |
| 直接输入具体 Action 名作为基础动作 | **是** | **已确认** |
| 去除 `skin/face/hair/equips` 重复 attrs | 倾向由 Adapter 解析到父级 appearance；具体闭集仍归 D02 | **待确认** |
| 表情选择与表情帧定义分离 | **`attrs.expression` 选择 + 父级外观保存表情数据，独立时间轴**（§5.18） | **已确认 D03** |
| 单次技能/攻击通过 `action` RenderEvent，且不添加 `action-seq` | **是；接受 Event 不重放** | **已确认** |
| 时钟来源：最近祖先 Render Clock，否则组件本地 Clock | **确定继承与回退原则** | **已确认** |
| attrs.action 改变与一次性 Event 的覆盖关系 | **单次动作播完后回到最新基础动作；覆盖期间冻结基础时间，改选新基础从 0 开始**（§5.17） | **已确认 D01** |
| 强制中断接口与可靠性 | retained `one-shot-enabled`，缺省 true、false 清除并禁止单次覆盖 | **已确认** |
| 基础 Action 的循环 / hold / 局部循环、结束通知 | 从 `ms-action` Clip 读取；非循环末帧保持、不发完成事件 | **已确认行为，Schema 待定** |
| 一次性 Event 动作缺失、资源未就绪 | 缺动作丢弃；有动作先计时、资源到达绘制当前帧、不补播 | **已确认** |
| Render Clock 显式暂停与后台/掉帧 | 暂停冻结；未暂停则按实际经过时间定位当前帧，不补画 | **已确认** |
| DOM 断连、同实例重挂与新实例恢复 | 断连冻结、同实例续播；新实例仅恢复 retained 基础动作 | **已确认** |
| 父级 RenderClock 对象身份 | 有效生命周期内稳定；暂停/恢复不换实例 | **已确认** |
| Clock 提供者失效通知 API | 必须可检测并重新查找；具体形式待定 | **实施细节待定** |
| 动作定义的承载方式 | **`ms-action` RenderNode 子节点，父 Avatar 按动作名索引** | **已确认** |
| 图片资源加载/解码/缓存所有权 | **统一归 `ms-avatar`，不在 `ms-action` 独立加载；使用 Content 身份和版本/尺寸校验**（§6.1） | **已确认 D09** |
| `ms-action` Clip 内容更新与删除 | 同名有效 Clip 保留 elapsedMs 重新求帧；one-shot 删除即取消，基础请求保留 | **已确认** |
| 基础 Action Clip 暂缺后的时间连续性 | 本应推进时继续累计 elapsedMs；恢复有效 Clip 后 seek，不补播 | **已确认** |
| 换装时父级 appearance 与子 Action Clip 一致性 | **同一 Domain、同一次 update/replace 原子提交**；子组件绘制前校验组合；不新增 appearance-version | **已确认** |
| 父子 Clip 变化通知与按需索引刷新 | 子组件主动通知，父 Avatar 绘制/Event 前同步验证；MutationObserver 只辅助结构发现 | **已确认原则，接口待定** |
| 首次挂载/重挂的动作就绪门槛 | 有效共享外观 + 当前需要的有效 Clip；不等待全部动作或图片解码 | **已确认原则，调度接口待定** |
| `ms-action` 动作名称与改名语义 | **attrs.name 精确匹配，重复名冲突拒绝，改名使用 fresh key**（§5.19） | **已确认 D04** |
| 父级共享外观与 Clip 数据分工 | 公共 zOrder、资源索引、表情归父；单动作帧/时序/资源引用归子（§6.3） | **已确认 D08，字段级 Schema 待定** |
| 无效数据和错误呈现 | 区分未就绪、缺 Clip、无效 Clip、图像延迟与 Content 冲突，拒绝失效旧帧（§6.4） | **已确认 D12，接口待定** |
| `ms-action` Clip Schema 与容量 | 定义受 CMS079/OpenMS 及旧图集打包机制复核约束（§6.5），具体字段和体量未选定 | **待讨论 D05 / D06 / D07 / D11** |
| 世界坐标与最终 Canvas 输出边界 | **世界 x/y 与深度归场景，Avatar 负责局部绘制；初版可用 Shadow DOM Canvas**（§6.2） | **已确认 D10，长期后端未冻结** |

## 9. 依据与验证状态

- [旧版 cms-actor 设计](../../components/cms-actor/DESIGN.md)
- [旧版 cms-actor 实施说明](../../components/cms-actor/IMPLEMENTATION.md)
- [Frozen RenderNode ABI v1](../../components/RENDER-NODE-ABI-V1.md)
- [Adventure Island 产品模块边界](../../docs/product-first/MODULE-CONTRACTS-V1.md)
- [ms-action 数据子组件设计](./ms-action.md)
- [OpenMS Avatar Visuals](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/avatar-visuals.js)
- [OpenMS Avatar Composition](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/avatar-composition.js)
- [OpenMS Animation Timing](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation-timing.js)
- [OpenMS EntityAnimation](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js)
- [OpenMS Online Scene](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/online/scene.js)
- [LoomRealm Render Update v1](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/render-update-v1.md)
- [LoomRealm Web Presentation API v1](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/web-presentation-api-v1.md)

**验证状态**：新 `ms-avatar` / `ms-action` 仅为设计 Draft；没有新增实现、Schema Validator、Chromium 测试或真实 CMS079 像素一致性验收。旧版历史测试不自动证明新 ABI 通过。


## 10. 剩余事项总清单（ms-avatar / ms-action）

**范围**：仅统计当前 `ms-avatar` + `ms-action` 新设计中尚未定稿的 **5 项产品/ABI 决策、5 项实施接口机制和 4 项验证/迁移工作**。**D01 / D03 / D04 / D08 / D09 / D10 / D12 已确认**，见 §5.17–§5.19、§6.1–§6.4，不再占用待决表；已确定分工不等于完整 JSON Schema 或实现完成。余下的“推荐取舍”**尚未获批准**；P0＝优先裁决/取得证据，P1＝实施/ABI 冻结前落实，P2＝验收与迁移阶段。“待实施/验证”不表示原则尚未确认。

**已确认项索引**：D01 基础时间冻结（§5.17）；D03 表情轨（§5.18）；D04 动作名/身份（§5.19）；D09 Content 身份与图集缓存（§6.1）；D10 场景坐标与局部画布（§6.2）；**D08 父共用外观/子动作 Clip 数据分工（§6.3）；D12 错误分类/无效组合 fail closed（§6.4）**。详见 §6.5：OpenMS/旧 cms-actor 图集、小文件聚合和 attrs/data 更新粒度是其余事项的复核条件。

### 10.1 剩余 5 项产品 / ABI 待决问题

| ID | 议题 | 尚待裁决的准确边界 | 推荐取舍 | 优先级 |
| --- | --- | --- | --- | --- |
| D02 | **`ms-avatar` 动态 attrs 的最终闭集与更新粒度** | 已确认 `action`、`one-shot-enabled`、`expression` 属于 Avatar，世界 `x/y` 不属于 Avatar；仍需决定 `facing` 等属性及格式、默认值、外观 ID 输入去留；attrs 可单字段 update、data 可顶层字段 update，但嵌套对象需整体替换（§6.5） | 建议高频、独立的简单显示状态用 attrs，重型共享外观用 data、动作按独立子节点；最终闭集仍倾向 `action/one-shot-enabled/facing/expression`，避免频繁重复发送大 appearance。 | P0 |
| D05 | **`ms-action` Clip Schema** | 帧/循环/播放规则如何编码，Clip 能否用对父级资源索引及图集页的引用避免重复资源目录，怎样使单 Action 更新真正较小 | 建议显式格式版本、有序帧、循环/hold/后缀循环；帧层只引用共享资源及 atlas 裁剪，不将小图片字节放入 Clip。字段与冗余程度须结合 OpenMS 和旧 atlas 夹具复核。 | P1 |
| D06 | **Clip 帧时序与源资料映射** | CMS079 alias/UOL、零/负/缺失 delay、repeat/后缀循环与不同帧复用图像；不得因为打包图集改变帧的时间身份 | 建议 Adapter 先正规化时序与图像引用，参考 OpenMS 的动作时间编译但用真实 CMS079 验证；零时长合法场景允许、总循环段不得零时长；负值不能无证据一律 abs()。 | P1 |
| D07 | **Clip 部件绘制 Schema** | move/rotate/flip/showFace、origin/anchors、层序/遮挡与 atlas `source` 裁剪如何同时表达；共享图集页不能改变单个部件的锚点 | 建议 Adapter 输出已解析的部件层、变换与裁剪来源，父级统一 zOrder；参考旧 `avatar-model.mjs` 与 OpenMS 子纹理思路，测图集裁剪下坐标/镜像一致性。 | P1 |
| D11 | **动作工作集、图集分组与规模约束** | 当前可触发动作集合、预先发布范围、帧/层/节点/JSON 字节，和图集页面大小、Content 请求次数、解码内存/复用率如何一起权衡 | 建议 Event 前准备可触发动作定义、按需预读图集页；用 CMS079 V01/V03 测单 Clip/全 Avatar 预算及图集分组大小，不直接套旧 32/256KiB 或 OpenMS 126 数值。 | P1 |

### 10.2 原则已定、仍须实现接口 / 竞态行为的事项

| ID | 议题 | 待落实的机制 | 推荐实施方式 | 优先级 |
| --- | --- | --- | --- | --- |
| I01 | **父子通知和同步查询 API** | 本地变更事件名称/载荷、只读 Clip getter、子节点 attrs/移动/删除/重挂的监听与解绑、跨父级迟到通知防护；原则已在 §5.15 确认  | 用组件内部同步变更通知 + 只读 Clip 快照 getter；父级只接纳当前直接子节点，标脏不立即画图，Event 入口同步刷新；MutationObserver 辅助结构变化。 | P1 |
| I02 | **首次挂载与原子换装的呈现门闩** | `connectedCallback` 后如何识别所需数据已交付、父/子 `receiveRenderData` 交错时如何重建一致组合、绘制及 Action Event 入口如何避免临时混画；局部就绪与同次 Domain 原子发布已在 §5.13、§5.16 确认  | 绘制/Event 前构建与验证当前父数据 + 子 Clip 的一致性快照；未就绪时不绘制混合帧，数据回调只标脏。以真实 WebProjector 浏览器测试定下投影结束/调度细节。 | P0 |
| I03 | **Render Clock 的组件内部完整接口** | provider 获取、对象失效通知、订阅/解绑、暂停/恢复的 delta 计算与跨父级切换；稳定对象身份、继承回退、显式暂停及 DOM 断连规则已定  | 稳定 `getRenderClock()` 返回对象 + 可取消订阅 + 明确 provider 失效通知；pause 不能回退本地，切换仅重设采样基准，不丢失相位。 | P1 |
| I04 | **播放器及异步资源生命周期的具体算法** | Clip 替换时 seek、缺 Clip 继续计时、one-shot 取消、异步 epoch/Abort、图片缓存 pin/unpin、被移除资源释放；产品行为已在 §5.4–§5.16 确认  | 分离纯时间定位器与资源 Painter；Clip、Action、外观/实例变化提升内部 epoch，拒绝过期图片；共享图片缓存 pin/unpin 与可取消读入。 | P1 |
| I05 | **验证器、限制与诊断接口落地** | 父级/Clip 字段闭集、合法组合、字节与图集页容量边界及 D12 错误码/输出接口的具体形式 | 父级/Clip 独立 Validator + 组合 Validator，D12 确认的分类/清除过期画面变成稳定诊断 API；像素未就绪继续计时，限制由 V01/V03 实测决定。 | P1 |

### 10.3 实现前必须完成的证据与迁移工作

| ID | 工作 | 交付/验收 | 建议验收路径 | 优先级 |
| --- | --- | --- | --- | --- |
| V01 | **真实 CMS079 外观与动作抽样测量** | 多武器、换装、表情与动作样本：Clip 数/字节/帧层、图片数量、alias、特殊 delay 与图集复用；须区分 OpenMS GMS083 参考行为 | 先取合法 CMS079 代表素材闭包，测试多个小图合并为 atlas 后 Content 请求次数、图集数/体积、解码峰值、换装复用率和帧布局正确性；与 OpenMS 机制对照。 | P0 |
| V02 | **浏览器 WebProjector / DOM 时序集成测试** | 首挂空壳、父/子数据交付不同顺序、紧邻的 Action Event、结构替换、重复名称、剪裁/过期异步绘制、暂停/断连/重挂及换装同次提交不混画  | 用真实 WebProjector + 浏览器测试首挂空壳、父子回调交错、紧接 Event、同次换装、重名/删除、慢解码、暂停、断连重挂、Clip 更新及清理。 | P1 |
| V03 | **性能、图集缓存与像素一致性验证** | Snapshot/replace/Clip update 成本、Content 请求与图集页解码/内存、缓存命中、慢资源及 CMS079 锚点/帧时序 | 对比逐小图 vs atlas 合并：请求数、图集页字节、解码峰值、换装缓存复用与首帧延迟；同时验收裁剪区域的 origin/anchors、层序、表情、动作像素正确性，再定预算。 | P2 |
| V04 | **旧 `cms-actor` 的迁移方案（单独阶段）** | 新标签注册、Adapter/Validator/测试与运行时接入；旧组件和冻结 `components/RENDER-NODE-ABI-V1.md` 继续不改，不能把 Draft 当成已发布 ABI  | 新 `ms-avatar` / `ms-action` 并行注册、构造独立 Adapter/Validator 和验收，达标后单独迁移调用方；不就地改旧 `cms-actor` 或冻结 ABI。 | P2 |

**非当前必做事项**：transient Event 的跨新实例精确重放已明确接受为**不保证**；除非未来提出必须恢复技能途中相位的新需求，不在当前 V1 设计中额外增加 retained 起始时间/动作序号。跨多个 Domain/提交的分阶段换装也**不属于当前支持范围**，将来确需才另议版本化与显式激活机制。

**更新后的建议裁决顺序**：**D02（更新粒度与最终 attrs）→ V01（CMS079 + atlas 加载分布）→ D05/D06/D07/D11（联合考虑 OpenMS 与旧 cms-actor 图集）→ I02 最小 WebProjector PoC → I01/I03–I05 → V02/V03 → V04**。D08 与 D12 已确认其原则，不再重复投票；I02 是动作子节点架构最重要的投影竞态风险，建议在完整 ABI 冻结前进行浏览器验证。
