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
| `attrs` | retained 基础 Action、朝向、单次覆盖许可及其他待定动态显示输入 |
| `data` | **当前角色共用**的渲染就绪外观信息（如 `appearance`、zOrder、资源描述；字段待定），**不再携带全部 `actions` 字典** |
| `children` | **已确认：独立的 `ms-action` 数据型子节点**；每个子节点保存一个动作的绘制 Clip；纸娃娃内部图层不是 RenderNode |
| `receiveRenderEvent` | 接收面向 Avatar 的瞬时 `action` Event，触发一次性覆盖动作 |

- WebProjector 将 `RenderNode.children` 机械投影为 **`ms-avatar` 的 light DOM**。每个 `ms-action` 是独立注册的 Custom Element，自己的 `data` 只投递给它自己的 `receiveRenderData()`，**不自动触发父 Avatar 的数据回调**。
- `ms-action` 消费、校验并暴露 Clip；**已确认子节点主动发出 Renderer 内部的定义变化通知，父 Avatar 在关键入口同步读取当前直接子元素与已验证 Clip**（§5.15）。通知只使缓存失效，不直接画图，也不通过 LoomRealm RenderEvent。父 Avatar 统一管理图片/图集读取、解码、缓存、contentVersion 与实际绘制，子组件没有 RAF、Canvas 和图片资源所有权。
- **已有** `ms-action` 的 `data.clip` 可以通过 `RenderDomain.update()` 独立更新；**增加、移除或改变 `children` 结构**须通过 `RenderDomain.replace()`。该设计提供独立寻址和增量更新，不等同于把初始 Snapshot 分段传输。
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
    x: "120",
    y: "80",
    facing: "right",
    action: "walk1",
    "one-shot-enabled": "true", // 可选，默认 true
    expression: "default"      // 待定
  },
  data: {
    appearance: { /* 共用外观、zOrder、资源描述等；待定 */ }
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
- `skin/face/hair/equips` 的原始游戏外观选择倾向由 Adapter 解析后放入共享外观数据，不重复作为当前角色 attrs；`expression` 的选择与表达轨迹、`x/y` 是否属于 Avatar 仍待单独确认。

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

### 5.6 第二阶段已确认：基础 Action 的播放规则由 ms-action Clip 定义

- Subsystem 通过 `attrs.action` 选择**具体**基础 Action；`ms-avatar` 只根据当前已登记的 `ms-action` Clip 的帧与播放规则推进，不因名字包含 `stand`、`walk`、`jump`、`sit` 等字样而自行猜测循环、保持或结束。
- 基础 Action 支持**完整循环**、**先播前置段再循环后续片段**、**非循环播至末帧并保持**三种语义。非循环基础 Action 停在末帧，直到 Subsystem 改变 `attrs.action`（或者单次 Event 暂时覆盖后再回到它）。
- 基础 Action 的正常结束是组件内部的视觉状态，**不向 Subsystem 发完成事件**，不自行切换别的业务 Action。
- `render.event("action")` 是**一次性覆盖播放**：即使该 Action 的基础循环定义允许循环，单次 Event 也只执行一次完整动作，到期回到最新基础 Action。新 Event 到达时遵照既定的显式重启规则；`one-shot-enabled=false` 仍有强制终止优先权。
- 同名基础 Action 属性的重复投影不应重启动作；真正在同名情况下要求显式重播的场景使用已确认的单次 Action Event。对应 `ms-action` Clip 更新时**保留当前已累计的播放时间、按新 Clip 重新定位帧，不视为重播**（§5.12）；跨外观版本的一致性协议仍待定。
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
2. **Clip 热更新语义已确认（§5.12）**：同名有效 Clip 替换保留已播放时间；one-shot Clip 消失则取消；基础 Clip 缺失仍保留 retained 请求。基础 Clip 缺失期间的时间累计与恢复行为已在 §5.14 确认；换装时跨父子节点同次原子发布见 §5.13。
3. **父子数据通知与首次就绪原则已确认（§5.15、§5.16）**：子组件主动通知 + 父组件关键入口同步查询；首次按当前所需动作局部就绪，不设全局 Ready。**仍待实施**：具体事件名/方法、父子回调交错的完成判据与删除时通知机制。
4. **当前外观动作覆盖率与容量**：OpenMS 的预定义 Action 集只是参考，不可将 126 动作直接等同于 CMS079 必须全量传输；测量真实 CMS079 样本后确定适当应用级限制。
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

## 6. 外观数据、动作子节点与资源所有权

**已确认**：游戏侧 Adapter 解析 CMS079 的 `islot/vslot/zmap/smap` 和原始绘制事实；Renderer 不反向解析 WZ。数据按以下职责拆分：

| 数据或资源 | 所有者 | 职责 |
| --- | --- | --- |
| 角色共用的外观绘制信息（如 `appearance`、zOrder、资源表等） | `ms-avatar.data`（字段待定） | 提供多个动作共用的渲染事实 |
| 单个动作合成帧、delay、循环规则及图片资源引用 | 对应 `ms-action.data.clip`（字段待定） | 单独更新和校验，父 Avatar 按动作名获取 |
| 图片/图集下载、解码、资源版本校验、缓存及释放 | **`ms-avatar`** | 统一共享资源，避免各 Action 独立持有同一图集 |
| 当前播放的 Action、身体/表情相位、one-shot 覆盖 | `ms-avatar` 的 Animation Player | 跟随继承或本地 Render Clock 推进；不写回 RenderNode |

OpenMS `AvatarVisuals.prepare()` 先按所选部件加载图集，`composeAvatar()` 再为当前外观合成动作集，`EntityAnimation` 从既有动作中播放；我们保留**动作在播放前就应准备好**的原则，但以 `ms-action` 子节点表达已合成动作，而不是原样复制 OpenMS 的 PixiJS 资源布局。

**容量与更新语义**：

- LoomRealm Core 没有通用的单个 RenderNode `data` 字节或节点数量硬上限。旧版 `AvatarPlanV1` 的 256 KiB / 32 Action 属于组件级约束，**不能因为拆分子节点就认为没有传输成本**。
- 现有动作的 Clip 变化可以 `RenderDomain.update()` 指定子节点 key 独立更新；添加、删除和重排动作子节点要 `RenderDomain.replace()` 提交树结构。初始 Snapshot 和 `replace()` 仍涉及整个当前树，**不是流式按需下发**。**换装引起的父子关联更改需要按 §5.13 一次原子发布**。
- 动作范围应覆盖当前角色外观能够实际触发的基础、攻击和技能姿态，并尽可能在 Event 前准备；具体集合不能直接硬编码为 OpenMS 的 126 项，也不能直接照搬旧版 32 项限制。
- `ms-action` 不负责下载/解码。图片可在父 Avatar 内按需要加载或预读；缺像素但 Clip 有效时，遵照 §5.7 时间一致性规则继续播放时钟。
- 是否将多动作共用的图层、锚点或资源引用做进一步去重、是否存在独立的动态内容发布接口，均待真实 CMS079 数据测量后决定。**不支持把一次换装分成多个可见提交逐步替换 Clip**。
- 资源缺失、Action 缺失、外观/Clip 不匹配应可诊断，不引入未确认的静默回退策略。

见 [ms-action 设计文档](./ms-action.md)。

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
| 去除 `skin/face/hair/equips` 重复 attrs | 是 | 待确认 |
| 表情选择与表情帧定义分离 | 是 | 待确认 |
| 单次技能/攻击通过 `action` RenderEvent，且不添加 `action-seq` | **是；接受 Event 不重放** | **已确认** |
| 时钟来源：最近祖先 Render Clock，否则组件本地 Clock | **确定继承与回退原则** | **已确认** |
| attrs.action 改变与一次性 Event 的覆盖关系 | **方案 A：单次动作播完后回到最新基础动作** | **已确认** |
| 强制中断接口与可靠性 | retained `one-shot-enabled`，缺省 true、false 清除并禁止单次覆盖 | **已确认** |
| 基础 Action 的循环 / hold / 局部循环、结束通知 | 从 `ms-action` Clip 读取；非循环末帧保持、不发完成事件 | **已确认行为，Schema 待定** |
| 一次性 Event 动作缺失、资源未就绪 | 缺动作丢弃；有动作先计时、资源到达绘制当前帧、不补播 | **已确认** |
| Render Clock 显式暂停与后台/掉帧 | 暂停冻结；未暂停则按实际经过时间定位当前帧，不补画 | **已确认** |
| DOM 断连、同实例重挂与新实例恢复 | 断连冻结、同实例续播；新实例仅恢复 retained 基础动作 | **已确认** |
| 父级 RenderClock 对象身份 | 有效生命周期内稳定；暂停/恢复不换实例 | **已确认** |
| Clock 提供者失效通知 API | 必须可检测并重新查找；具体形式待定 | **实施细节待定** |
| 动作定义的承载方式 | **`ms-action` RenderNode 子节点，父 Avatar 按动作名索引** | **已确认** |
| 图片资源加载/解码/缓存所有权 | **统一归 `ms-avatar`，不在 `ms-action` 独立加载** | **已确认** |
| `ms-action` Clip 内容更新与删除 | 同名有效 Clip 保留 elapsedMs 重新求帧；one-shot 删除即取消，基础请求保留 | **已确认** |
| 基础 Action Clip 暂缺后的时间连续性 | 本应推进时继续累计 elapsedMs；恢复有效 Clip 后 seek，不补播 | **已确认** |
| 换装时父级 appearance 与子 Action Clip 一致性 | **同一 Domain、同一次 update/replace 原子提交**；子组件绘制前校验组合；不新增 appearance-version | **已确认** |
| 父子 Clip 变化通知与按需索引刷新 | 子组件主动通知，父 Avatar 绘制/Event 前同步验证；MutationObserver 只辅助结构发现 | **已确认原则，接口待定** |
| 首次挂载/重挂的动作就绪门槛 | 有效共享外观 + 当前需要的有效 Clip；不等待全部动作或图片解码 | **已确认原则，调度接口待定** |
| `ms-action` Clip Schema 与容量 | 未选定 | **待讨论** |
| 世界坐标与最终 Canvas 输出边界 | 未选定 | **待讨论** |

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

**范围**：仅统计当前 `ms-avatar` + `ms-action` 新设计中**尚未定稿的产品选择、字段 ABI、实现接口与必需验证工作**。§1–§8 已确认的原则不再重投票。此清单随裁决维护；以后如发现 CMS079 新事实，可继续增加事项。下表的“待实现/验证”**不表示原则尚未确认**。

### 10.1 尚需逐项决定的产品 / ABI 问题

| ID | 议题 | 尚待裁决的准确边界 |
| --- | --- | --- |
| D01 | **基础 Action 遇到 one-shot 覆盖时的时间轴** | one-shot 期间基础动作 `elapsedMs` 继续累计还是冻结？结束后回到最新基础动作的哪个相位？当前只确定基础 attrs 变化不打断 one-shot、缺 Clip 本身不暂停本应推进的时间 |
| D02 | **`ms-avatar` 动态 attrs 的最终闭集** | `action` 与 `one-shot-enabled` 之外的 `x/y`、`facing`、`expression` 是否属于 Avatar，格式、默认值及非法值规则；`skin/face/hair/equips` 冗余 attrs 是否正式移除 |
| D03 | **表情模型** | 表情选择入口、表情帧/时长/循环的数据归属（父级 vs 独立数据轨）、表情与身体独立时间轴的精确定义、表情资源复用和 `showFace` 交互 |
| D04 | **动作名称与子节点身份** | `ms-action.attrs.name` 是否为正式字段、名称/键的语法与长度、同名重复的拒绝范围、改名如何影响当前播放与 RenderNode key 生命周期 |
| D05 | **`ms-action` Clip Schema** | `data.clip` 的格式版本、`playback`（loop/hold/suffix loop）、`repeatFrom` 单位与边界、`frames` 表示和具体 Action 播放模式如何编码 |
| D06 | **Clip 帧时序与源资料映射** | 缺失、零、负 delay 的语义；alias/UOL、非连续帧、重复帧、`repeat`、首尾边界与全零持续时间的校验；依据真实 CMS079 固定样本定稿 |
| D07 | **Clip 部件绘制 Schema** | frame 中 move/rotate/flip/showFace、origin/anchors、部件 z 层、遮挡与共享图层、装备隐藏规则、帧内绘制顺序的字段及校验规则 |
| D08 | **父级共享外观 `data` Schema** | `appearance`、zOrder、共用资源索引/外观来源和 Clip 引用关系；哪些字段属于父数据、哪些属于 Clip，如何判定“合法组合” |
| D09 | **资源引用与缓存契约的公开数据字段** | `namespace/key/contentVersion`、图集/源矩形/尺寸校验、可复用资源身份、缓存键及像素缺失/版本冲突的处理范围；不重复设计 Content API |
| D10 | **Avatar 呈现输出与场景边界** | `x/y` 是否由场景持有、坐标原点/镜像/最终 Canvas（Shadow DOM 或共享 Painter）、与世界 Display List 深度排序的边界；不在此预定义整个 Map |
| D11 | **动作工作集与应用规模约束** | 当前外观“可触发动作”的完整覆盖范围、是否/何时预载、每动作帧数/层数、每角色节点数/序列化字节及缓存预算；不能直接采用旧 32 Action / 256 KiB 或 OpenMS 126 的硬值 |
| D12 | **错误时的呈现与可观测性契约** | 父外观无效、当前 Clip 无效、重复动作名、内容版本冲突等的错误分类、诊断载荷与展示/清屏行为；保留业务 Action、不静默选择其他 Action 的原则已定 |

### 10.2 原则已定、仍须实现接口 / 竞态行为的事项

| ID | 议题 | 待落实的机制 |
| --- | --- | --- |
| I01 | **父子通知和同步查询 API** | 本地变更事件名称/载荷、只读 Clip getter、子节点 attrs/移动/删除/重挂的监听与解绑、跨父级迟到通知防护；原则已在 §5.15 确认 |
| I02 | **首次挂载与原子换装的呈现门闩** | `connectedCallback` 后如何识别所需数据已交付、父/子 `receiveRenderData` 交错时如何重建一致组合、绘制及 Action Event 入口如何避免临时混画；局部就绪与同次 Domain 原子发布已在 §5.13、§5.16 确认 |
| I03 | **Render Clock 的组件内部完整接口** | provider 获取、对象失效通知、订阅/解绑、暂停/恢复的 delta 计算与跨父级切换；稳定对象身份、继承回退、显式暂停及 DOM 断连规则已定 |
| I04 | **播放器及异步资源生命周期的具体算法** | Clip 替换时 seek、缺 Clip 继续计时、one-shot 取消、异步 epoch/Abort、图片缓存 pin/unpin、被移除资源释放；产品行为已在 §5.4–§5.16 确认 |
| I05 | **验证器、限制与诊断接口落地** | 父级/Clip 字段级闭集、结构/数量/字节上界、非法输入处理、错误上报方式，以及各类无资源状态的渲染表现 |

### 10.3 实现前必须完成的证据与迁移工作

| ID | 工作 | 交付/验收 |
| --- | --- | --- |
| V01 | **真实 CMS079 外观与动作抽样测量** | 含不同武器、服装、表情、身体动作/技能姿态的资源闭包，统计 Clip 数量、序列化体积、帧/层/锚点、图像复用和缺失情况；与固定 OpenMS GMS083 的参考行为区分 |
| V02 | **浏览器 WebProjector / DOM 时序集成测试** | 首挂空壳、父/子数据交付不同顺序、紧邻的 Action Event、结构替换、重复名称、剪裁/过期异步绘制、暂停/断连/重挂及换装同次提交不混画 |
| V03 | **性能和像素一致性验证** | 初始 Snapshot/replace 成本、子 Clip 增量更新、缓存命中与峰值内存、慢解码与后台恢复、CMS079 锚点/层序/表情/动作像素验收 |
| V04 | **旧 `cms-actor` 的迁移方案（单独阶段）** | 新标签注册、Adapter/Validator/测试与运行时接入；旧组件和冻结 `components/RENDER-NODE-ABI-V1.md` 继续不改，不能把 Draft 当成已发布 ABI |

**非当前必做事项**：transient Event 的跨新实例精确重放已明确接受为**不保证**；除非未来提出必须恢复技能途中相位的新需求，不在当前 V1 设计中额外增加 retained 起始时间/动作序号。跨多个 Domain/提交的分阶段换装也**不属于当前支持范围**，将来确需才另议版本化与显式激活机制。

**建议裁决顺序**：先解决 D01（one-shot 覆盖期间基础时间轴），然后 D02/D03 的动态输入，再依次冻结 D04–D09 的动作/外观数据 Schema；I01/I02 与字段 Schema 可配合浏览器 PoC 迭代。其余项在落地及测试阶段执行。
