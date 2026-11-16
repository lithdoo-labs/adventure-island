# ms-action — Avatar 动作数据子组件设计（Draft）

> **状态：Draft，未冻结字段级 ABI，未实现。**  
> 组件标签：`ms-action`，仅在 `ms-avatar` 的 RenderNode 子树中作为动作定义提供者。  
> 参考：LoomRealm `93648192323bf5f57996b7b54cbae641d8a53fdb`；OpenMS GMS083 `07994de02756356e3e025e3aca9e79433898d2c8`。OpenMS 机制并非 CMS079 已验证的字段约定。

## 1. 已确认的职责边界

**`ms-action` 是单个动作的渲染就绪数据组件，不是动画播放组件，也不是资源加载组件。**

- **Subsystem / Adapter**：根据当前外观、动作需求和 CMS079 原始资料准备每个动作的合成帧、位置信息、时长和资源引用；按需要创建/更新对应 RenderNode。
- **`ms-action`**：消费自己的 `receiveRenderData()`、验证单个动作 Clip、保存只读语义数据，并通过 Renderer 内部组件协议将当前定义暴露给所属的 `ms-avatar`。
- **`ms-avatar`**：根据 `ms-action.attrs.name` 建立动作名精确索引，持有 Animation Player / Render Clock；**统一读取、解码、缓存、版本校验及释放身体动作与表情共用的图片/图集**。表情 Clip 属于父级共享外观数据，由独立 Expression Player 推进。
- **`ms-action` 不负责**：自己的 RAF、Clock、Canvas/WebGL、图片读取/解码/缓存、资源所有权、战斗技能判定、选择下一个动作或触发播放。
- 动作 Clip 仍是渲染就绪的定义，不携带原始 WZ/FSDB 文件路径，也不让 Renderer 推断装备和技能业务规则。**已确认 D08**：父 `ms-avatar.data` 持有共享 zOrder、图集/图片资源索引与表情数据；每个子 Clip 只持有自己的帧/时序、图层变换、公共图集裁剪引用。多个 Action 可以复用同一图集页，`ms-action` 不读取/解码图像。

## 2. RenderNode 形状（候选字段，原则已确认）

```js
{
  key: "avatar:player:walk2",
  tag: "ms-action",
  attrs: {
    name: "walk2"            // 已确认动作名入口；字符/长度限制待定
  },
  data: {
    clip: {
      formatVersion: 1,       // D05 方向确认；字段闭集仍需 CMS079 夹具
      playback: { mode: "loop", repeatFrom: 0 },
      frames: [/* durationMs、逐帧变换、layer 与共享 sprite ID */]
    }
  },
  children: []
}
```

- `ms-action` 是正式注册的 Custom Element：LoomRealm WebProjector 为每个 RenderNode 创建元素，并将 `children` 机械投影成**父元素 light DOM** 的有序子元素。
- **已确认 D04**：一条 `ms-action` 对应一个 `attrs.name` Action；区分大小写的精确字符串匹配，同一个 Avatar 直接子节点范围内名称唯一。重复名称的动作索引发生冲突，不得静默按 DOM 顺序选取；精确字符集和长度限制仍需 CMS079 资料与 Validator 定稿。
- 默认子节点 `children: []`。**纸娃娃层、贴图和骨骼/锚点不因此成为 RenderNode 子节点**；它们仍属于单个动作 Clip 内部数据。
- **`key` 是 RenderNode 身份，不是动作名**。同一个 live key 不得原地更改 `attrs.name`；改名应通过 `RenderDomain.replace()` 删除旧节点，使用符合 LoomRealm one-shot key 生命周期的 **fresh key** 创建新节点。
- `attrs.name` 的语义和改名规则已确认；**已确认 D05 的 Clip 结构方向**：版本、显式播放模式（完整 loop/hold/后缀循环）、有序持续时间帧、绘制层与共享 sprite 引用。上述字段名仍为候选 JSON，CMS079 夹具与 Validator 尚未冻结。

## 3. 父子组件数据协作

```text
LoomRealm RenderNode.children
          │
          ▼
       ms-action
  receiveRenderData(clip)
          │
          ▼
   校验并保存动作定义
          │
          ▼
  Renderer 本地通知 / 获取
          │
          ▼
    ms-avatar 动作索引
          │
          ├── Animation Player：时间、one-shot、当前帧
          └── Resource Client / Image Cache：图片加载与绘制
```

- `ms-action.receiveRenderData()` 的变化**不会自动触发父节点的 `receiveRenderData()`**。**已确认**：子节点在校验/保存最新数据后主动向父 Avatar 发送 Renderer 内部的定义变化通知；父组件在关键入口按需同步读取当前已验证的 Clip。通知只标记索引失效，不引发即时重绘，也不通过 LoomRealm RenderEvent 绕一圈（§3.4）。
- 父组件需要响应子元素增加、移除、移动以及 `attrs.name` / Clip 数据更新；初始化/重挂和 Action Event 入口需要同步检查当前直接子节点，正常绘制时可维护脏索引。`MutationObserver` 只辅助发现结构或属性变化，**不作为唯一的数据变更通知**；具体事件名和只读查询 API 尚未冻结。
- 只读取**当前有效、已接收到 Clip、通过校验**的动作定义；一个空壳 `ms-action` 元素不能被当作 Action 已就绪。
- 同名重复子节点应报告可定位错误并阻止歧义播放；不可悄悄以 DOM 顺序选一个。
- 当 Event 指定的 Action 未在**当前已注册且有效**的 `ms-action` 集中时，仍遵守 [ms-avatar](./ms-avatar.md) 的既定规则：丢弃此次一次性 Event，不等待新子节点到达后补播。
- Action 定义存在、图片还在父组件解码时，按 Renderer 接收 Event 的时间照常计时；`ms-action` **不因资源未就绪而阻塞 Clip 生效**。
- 子节点 Clip 替换或被移除、父节点切换外观、one-shot 中断时，父组件必须使对应的**异步过期绘制结果失效**。**已确认**：同名有效 Clip 更新不重播，父 Avatar 保留当前播放实例的 `elapsedMs` 并按新定义定位帧；one-shot Clip 消失或失效时取消并回到最新基础 Action（见 §3.1）。

### 3.1 已确认：Clip 热更新与动作删除语义

`ms-action` **只提供定义变更**，它不会自行调用 `setAction()`、启动或重启动作。**已确认 D01**：one-shot 覆盖期间基础 Action 的 `elapsedMs` 冻结；覆盖结束后同名未改选则续播，若基础名曾改变则从新基础动作 0ms 开始。当前播放 Clip 的更新迁移仍由 `ms-avatar` 的 Animation Player 决定：

| 子节点变化 | 父 Avatar 行为 |
| --- | --- |
| 同名有效 Clip 变化，且基础 Action 正播放该名字 | 保留当前基础播放实例已累计的 `elapsedMs`，依照新 Clip 时长/循环/hold 规则 seek 到当前帧 |
| 同名有效 Clip 变化，且当前 one-shot 使用该名字 | 保留本次 one-shot 的 `elapsedMs`，按新 Clip 的一次性时间轴 seek；**不重新触发 Event** |
| 新 one-shot 时长小于或等于已经过时间 | 立即完成，回到最新 retained 基础 Action |
| 当前 one-shot Clip 删除、变为无效或不再可用 | 取消 one-shot，回到最新基础 Action；不保留补播队列 |
| 基础 Action Clip 删除、变为无效或不再可用 | **不修改 `attrs.action`**，诊断缺失；按 §3.3 保留本应运行的时间推进，Clip 恢复后 seek 而非从头重播 |
| 其他未播放 Clip 更新 | 索引和资源引用更新，不改变活动播放进度 |

此处继承的是**经过毫秒数**，不是帧号或 `elapsed / totalDuration` 比例。更新 Clip 时必须重新计算帧；例如旧帧时长 100/100/100/100ms，新时长 150/150/150ms，`elapsedMs=250` 从旧帧 2 映射到新帧 1。

**强制中断和资源边界**：`one-shot-enabled=false` 继续具有立即清除的优先权；图片尚未下载/解码不算 Clip 无效，动画照常计时。新的 `render.event("action")` 才是新的 one-shot 播放指令。父 Avatar 必须让旧的异步绘制请求过期，不能把更早的旧画面绘出。

**投影一致性**：父 Avatar 的动作查询必须以当前有效、已校验的子节点 Clip 为准，不能只依赖异步 DOM 观察通知。**已确认换装必须在同一次 Domain 原子提交中发布所有父子关联变化**（§3.2）；跨多个 Render Update 分批发布关联外观变更不符合首版约定。单个微任务的批量绘制不能假装版本已经匹配。

该规则属于新组件的 LoomRealm 数据组织方案；OpenMS `EntityAnimation.seek()` 可以参考时间定位，但 OpenMS 换装通常准备整个新 Avatar 并替换，不是上游对 `ms-action` 节点热更新。

### 3.2 已确认：换装时的原子发布与父子组合校验

`ms-action` 能独立热更新，**但一次换装引发的父级共享外观信息及受影响的子 Clip 变化，必须在同一个 LoomRealm Domain 的一次原子提交中发布**。

- 仅更新已有子节点 `data.clip`，且无换装依赖时：可以单独 `RenderDomain.update()`。
- 换装后动作节点集合不变：一次 `RenderDomain.update()` **同时更新** `ms-avatar.data` 的共享外观字段和全部受影响的 `ms-action.data.clip`；未更改的 Clip 也应由 Adapter 验证对新外观仍可复用。
- 换装涉及新增、删除、移动子节点：一次 `RenderDomain.replace()` 发布完整新树；`update()` 不能修改 `children`。
- 换装需要更新 `attrs.action` 或 `one-shot-enabled` 时，也应放进同一次提交；换装前先准备、验证可供播放的全部定义，不得把换装拆成多个可观察的中间发布。

**Store 原子性 ≠ Web Component 回调原子性**：LoomRealm 对同一次 Render Update 的最终 Domain Store 状态原子提交，但 `ms-avatar` 和每个 `ms-action` 都独立接收 `receiveRenderData()`。父 Avatar 必须验证当前已投影的共享外观 + 所需有效 Clip **构成完整一致的组合**，才允许绘制或接受依赖新外观的 Action Event；不能让某个子组件率先收到数据便立即混合绘制。具体通知与投影结束检测仍待实现方案确认。

**首版不增加同步用 `appearance-version` 或 `clip-version` 字段**；图像的 `contentVersion` 是 Content 资源身份，不承担换装事务编号。**已确认 D09**：父 Avatar 统一使用 Content 的 `namespace/key/contentVersion` 资源身份加载及缓存图片，检查实际/声明尺寸、源矩形范围和跨 Clip 的资源声明一致性，并处理过期请求及缓存释放。不同提交/不同 Domain 的分阶段换装不受本方案支持；将来确有必要时再设计显式版本/激活机制。

已确定的 §3.1 热更新规则不变：同名有效 Clip 更新保留 `elapsedMs`，one-shot Clip 删除则取消；图片未就绪不会让 Clip 失效或阻塞动画时钟。

### 3.3 已确认：基础 Action 的 Clip 缺失与恢复（时间继续流逝）

- `ms-action` 的 DOM 子节点未存在、Clip 尚未交付或校验失败时，`ms-avatar` **保留 retained 基础 `attrs.action`**，报告缺失（D12），不猜测替换为其他业务动作。校验失败时不能继续把旧有效 Clip/旧装备像素误当作当前画面。
- **缺少 Clip 定义不等于暂停当前 Render Clock**。基础动作在自身既定播放策略下本应累计的 `elapsedMs` 仍应推进；待同名有效 Clip 恢复后，按照新 Clip 的完整循环、局部循环或 hold 规则**直接求当前帧**，不从第 0 帧重新启动，也不补画错过的帧。
- 例：`walk1` 播放 300ms 后 Clip 临时缺失，时钟正常前进 2s；有效 Clip 恢复后，以累计约 2300ms 在新 Clip 上 seek，而不是重新从 0ms 或 300ms 播放。
- **例外**：选定时钟显式暂停或同一 Avatar 实例 DOM 断连时照原先规则冻结；**已确认 D01**：one-shot 覆盖基础动作期间基础 `elapsedMs` 冻结，缺 Clip 不会让被覆盖的基础动作偷偷累计时间。
- Clip 定义存在但图片未解码，和 Clip 定义缺失是两个不同情形；均不能据此让本应运行的动画时间停止。缺定义时不能拿无效旧帧冒充有效图像；晚到的图像仍需防止覆盖更新后的画面。
- **仅适用于基础 Action 的 retained 播放状态**：新 `render.event("action")` 对应 Clip 若不存在，仍依既定规则直接丢弃且不补播。基础 Clip 恢复不触发新的 Event。

该时间语义是 Adventure Island 产品选择，细节见 [ms-avatar §5.14](./ms-avatar.md)。

### 3.4 已确认：子组件主动通知变化，父级按需同步获取

`ms-action` 作为已注册 Custom Element，消费自己的 `receiveRenderData()`，**不向父组件自动透传数据回调**。已确认的最小内部协作机制：

1. 子组件每次接收到新的 `data.clip`（包含定义无效的情况）应校验并保存其**当前真实状态**；旧有效 Clip 不能在新定义校验失败后继续冒充当前数据。
2. 完成本地状态替换后，**主动向所属的 `ms-avatar` 发出 Renderer 内部变更通知**，只表达“动作定义/有效性已改变”；不自行启动 Animation Player、加载图片、绘制或修改 RenderNode。通知不得被转成新的 `render.event`。
3. 父 Avatar 收到通知只将动作索引、当前 Clip 引用和相关绘制状态标记为需要重新验证。正常绘制可按脏标记批量同步刷新；**收到 `render.event("action")` 时必须立即同步检查直接子元素及其当前有效 Clip**，不得依赖可能尚未运行的 `MutationObserver`。
4. 子元素的增删、移动和 `attrs.name` 变化也必须使父级索引失效；`MutationObserver` 可以作为辅助观察手段，不能单独承担私有 Clip 数据更新通知。重复的 Action 名不得凭 DOM 先后顺序静默消歧。
5. 校验组合必须在真正绘制前完成：初次连接时 `connectedCallback()` **不能假设 `attrs`、`children`、`data` 已就绪**；换装虽按同次 Domain 原子发布，父与多个子组件的 `receiveRenderData()` 仍可能先后发生。子通知只能标脏、不能导致新旧外观混合帧。
6. 子节点被删除、迁移父级或组件断开时，来自旧父子关系的迟到通知和异步图片工作不能影响新索引；属于当前索引的 Clip 变更才执行已确认的 `elapsedMs` 迁移、one-shot 取消和资源过期保护。

**不冻结**内部 DOM 事件名、事件 payload、只读 Clip getter、订阅/解绑机制和首次挂载数据完备判据。这些应通过后续最小实现接口与投影顺序测试确定，原则上不增加 RenderNode 字段。

**LoomRealm 语义边界**：WebProjector 对每个元素独立交付 `receiveRenderData()`；前一 retained commit 到 Event 的因果顺序只确保该次 reconcile / callback *attempt* 已发生，**不承诺子组件业务校验成功，也不承诺位图解码完成**。缺 Action 的 Event 仍按 [ms-avatar §5.7](./ms-avatar.md) 丢弃不补播。

### 3.5 已确认：首次挂载以当前所需 Clip 为就绪门槛

**已确认**：`ms-avatar` 初始或同实例重新连接时，不等待全部 `ms-action` 子节点就绪。只要父 Avatar 共享外观数据有效，且**当前要显示的**基础 Action Clip 已由对应 `ms-action` 收到并通过校验、与共享外观能组成合法绘制组合，就可以开始/继续绘制；其他不相关动作缺失或校验失败不得阻塞它。

- `connectedCallback()` **不是全部 attrs、children、data 已到齐的通知**；新建 `ms-action` 元素在首次 `receiveRenderData()` 之前只是空壳，不能算有效 Clip。
- 父级共享外观信息尚未有效、或当前必需 Clip 尚未有效时，不能绘制混合/不完整部件。对于缺失的 retained 基础动作，仍按 §3.3 继续累计其本应经过的动画时间；定义恢复后直接 seek。
- `swingO1` 等不相关动作还未准备好，不阻止合法的 `stand1` 绘制。后续新增有效动作仅更新父级索引，不使已有动作重启。
- `render.event("action")` 来临时，父级仍按 §3.4 **同步读取当前有效子节点与父级共享外观组合**；目标 Clip 已有效时允许 one-shot，缺失/无效时直接丢弃、不缓存等候。
- **Clip 有效与图片已解码不同**：像素未就绪不阻塞动作时间；迟到结果仍需过期检查。
- 局部就绪**不放宽换装一致性**：同一次换装按 §3.2 原子发布，不能把尚未投影完成的新父数据与旧 Clip 混合使用。
- 首版不增加全局 `avatar-ready` retained 属性或字段。具体父子交付完成检测、首次绘制调度和错误诊断格式仍是待实现契约。

本项仅确定就绪语义，**未批准具体 Clip Schema 或 `receiveRenderData()` 完成通知机制**。详见 [ms-avatar §5.16](./ms-avatar.md)。

## 4. 数据规模与发布语义

**目的：让动作独立寻址和独立更新，降低小改动需要替换整份动作计划的成本。不是规避 LoomRealm Core 的通用字节硬上限。**

- LoomRealm Render Update v1 没有强制统一的 RenderNode `data` 大小、树节点个数或 JSON depth 硬限制；旧版 `cms-actor` 的 **256 KiB、32 Action** 是应用级限制。
- 已存在的 `ms-action` 可用 `RenderDomain.update({ nodes: [{ key, data: { set: { clip } } }] })` 更新；`data.set` 替换的是对应子节点 `data` 的**顶层属性**，不是修改父节点的 `children`。
- **增加、移除、重新排列子节点**需要通过 `RenderDomain.replace()` 更新 authoritative tree；`RenderDomain.update()` 无法更改 `key/tag/children`。已有 Clip 可以只更新对应子节点 `data.clip`；`data.set` 仅支持替换 data 的顶层成员，WebProjector 的 `receiveRenderData()` 总是收到当前完整 data。
- 即使拆为子节点，初始 Snapshot 仍携带完整当前树；`replace()` 是全树结构提交，不自动按需传输某一子节点。未来若需真正延迟传输、共享跨角色 Clip 或独立资源发布，需要另行设计，不能声称当前子树已经具备这些能力。
- 各个 `ms-action` 的 Clip 仍需应用级帧数、图层、字节、资源引用上界及诊断。是否采用旧版具体数值需要真实 CMS079 样本测量后决定。**已确认 D12：无效 Action/组合 fail closed，旧画面不得冒充新状态；具体错误码和宿主输出 API 留 I05**。**换装需按 §3.2 把关联更新放入一次原子提交，不得跨提交逐步替换动作。**
- 当前外观可触发的动作应**预先发布对应子节点**，不得等 Event 到达才创建 Clip。**已确认 D03/D10**：表情归父 Avatar，世界位置/世界深度归场景。**已确认 D05/D06/D07/D11 的架构方向**：Clip 只携带渲染就绪时序/逐帧部件与共享 sprite ID；源 WZ delay/UOL 由 Adapter 解析；小图片离线合并图集；运行时父 Avatar 按需加载整页。具体 CMS079 时序、图集分组和容量须 V01/V03 实测。

## 5. 与 OpenMS 的对应关系

在固定版本 OpenMS：

- `client/src/character/avatar-visuals.js`：按当前人物的身体、头发、装备等选择准备视觉部件与图集。
- `client/src/character/avatar-composition.js`：`composeAvatar()` 为选中外观合成预定义 Action 的帧数据。
- `client/src/rendering/animation.js`：`EntityAnimation` 持有编译好的 Action 与时间播放状态；`setAction()` 切换已准备的 Action。
- `client/src/rendering/visual-resources.js`：资源集合统一管理图集使用权，避免将资源所有权散落到每帧播放逻辑。

这支持**动作准备、时间推进、资源所有权分开**的原则；但 OpenMS **没有** `ms-action` Web Component、LoomRealm RenderNode 子节点或父子数据通知协议。该部分是 Adventure Island 自己的组织方式。

参考：
- [OpenMS Avatar Visuals](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/avatar-visuals.js)
- [OpenMS Avatar Composition](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/avatar-composition.js)
- [OpenMS EntityAnimation](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js)
- [LoomRealm Render Update v1](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/render-update-v1.md)
- [LoomRealm Web Presentation API v1](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/web-presentation-api-v1.md)

## 6. D02 / D05 / D06 / D07 / D11 已确认的方向与待验证细节

**所有 D01–D12 的架构方向已确认，不等于完整 Clip JSON Schema、资源上限或实现冻结。** 唯一完整状态台账见 [ms-avatar §10](./ms-avatar.md)，详细候选 Schema 见 [ms-avatar §6.6–§6.10](./ms-avatar.md)。

| 决策 | 已确认的 ms-action 相关原则 | 仍需实测和 Validator 定稿 |
| --- | --- | --- |
| D02 | 动态 action/facing/expression/one-shot-enabled 放父 attrs；父共享 appearance/sprites/expressions 可各自顶层更新；各动作 Clip 分开 | 具体属性默认值、枚举与错误行为；跨父子组合校验 |
| D05 | 每 Action Clip 含格式版本、loop/hold/后缀循环、按序帧、毫秒时长、layer、共享 sprite 引用，不携带 PNG | 版本格式、repeatFrom 边界、字段闭集与帧层容量 |
| D06 | Adapter 将 CMS079 UOL/alias、零/负/缺失 delay、repeat 解释为规范化非负 ms 时序；图集不改变帧时间 | CMS079 真样本语义，OpenMS GMS083 只提供实现参考 |
| D07 | 每帧保存 move/rotate/flip/showFace，layer 保存 origin/anchors、遮挡、逻辑尺寸和 atlas 裁剪引用，父级统一 zOrder | 裁剪图集后的像素等价、异常锚点/遮挡/画布界限 |
| D11 | Event 前发布当前可触发动作定义；多小图离线合 atlas，父级按需整页加载与缓存 | 图集页分组、网络请求与解码内存、单 Clip 和全 Avatar 预算 |

**LoomRealm 更新语义**：attrs.set/remove 可以只修改一个属性；data.set/remove 可以只替换某顶层成员（例如 data.clip），不可对 clip.frames 的嵌套成员做原生 Patch。WebProjector receiveRenderData() 接收完整当前 data。每个 ms-action 子节点可独立更新 Clip，但初始 Snapshot / replace() 仍携带整棵树，不具备天然流式加载能力。

**图集必须真实合并**：旧 [cms-actor 实施说明](../../components/cms-actor/IMPLEMENTATION.md) 已支持图集整页读取/解码与多张小图 source 裁剪；固定 OpenMS [visual-resources.js](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/visual-resources.js) 通过 atlas manifest 和共享 lease 复用页面。**PWA installation-bundle 合并 Content 项不等于 PNG 已合成图集**；新实现必须实际构建 atlas 页及 sprite → 页内裁剪映射并用 CMS079 实测。

**已确认 I01–I05 的实施方向（§7）**：I01 子快照与通知、I02 快照门闩和浏览器 PoC、I03 父级 Clock、I04 Player/Painter/图集缓存分层、I05 严格验证和诊断；仍待实际编码及 V01–V04 真实素材、浏览器/像素性能和迁移验收。

**验证状态**：本设计已批准 I01–I05 的实现方向，但仍是 Draft；没有新 ms-action 实现、完整 Validator、Chromium PoC 或真实 CMS079 验收，不能称作 Frozen ABI。

## 7. 已确认 I01–I05 在 ms-action 中的实现分工（待编码/验证）

本节与 [ms-avatar `11](./ms-avatar.md) **共同定义已批准的实现方向**，不代表现有 `ms-action` Custom Element、内部接口或 WebProjector PoC 已完成。

### 7.1 I01：只读 Clip 快照与私有变更通知

- `ms-action.receiveRenderData(fullData)` 在本地**先解析、校验并替换**当前状态。建议候选状态枚举 `pending / valid / invalid`；收到新无效数据不能继续将旧有效 Clip 暴露为当前快照。新的有效状态包括当前动作名、只读 Clip、局部 revision（仅用于元素内/父级缓存失效，**不成为 RenderNode version 属性**）。
- 提供仅供父组件同步使用的候选 `getClipSnapshot()` 只读接口；Clip 不允许父组件原地修改。数据状态切换后同步向当前 `ms-avatar` 父组件发出**内部失效通知**，仅标记索引/画面 dirty，不执行业务 Event、不触发 RAF/Canvas/下载，也不写回由 WebProjector 管理的 DOM 内容。
- 父组件必须在使用前确认当前 `parentElement` 就是自己、动作名唯一且快照有效；`MutationObserver` 只辅助发现节点增删/移动和 attrs 变化，不能作为 Clip 私有数据唯一通知。Event 到达时父级同步扫描目标子元素，忽略旧父级迟到通知。
- 通知名称、payload、getter 签名和 revision 的具体类型尚待 PoC 固定，不新增 LoomRealm Core ABI。

### 7.2 I02：原子换装及首次挂载的父子校验门闩

- 子组件**只发布自己的 Clip 状态**，不自行推测全局换装是否已完成；子通知不能要求父组件立即绘制。初始化时元素可能已经连接 DOM 但 `attrs.name` 或 `data.clip` 尚未交付；空壳不是有效动作。
- 当前 LoomRealm WebProjector 先更新 DOM 结构与 attrs，再同步逐元素尝试 `receiveRenderData()`。**不是**所有子元素共用一个回调，也没有专供 Avatar 的投影事务成功标记。子组件必须保证新的解析失败不会意外保留旧 valid 状态；父组件须按当前需要的有效 Clip 和共享外观构建组合快照，失败则 fail closed。
- 同次 Domain 换装由 Adapter 整体发布；已发布且目标有效的 Clip 可在图集尚未解码时触发一次性 Event 并开始计时。未知/无效 Clip 的 Event 立即丢弃、不补播。
- **优先做真实 WebProjector 浏览器 PoC**：首挂空壳、父子数据回调交错、更新后紧接 action Event、无效数据/抛错、`replace()` 删除迁移、慢图集解码且旧绘制晚到。具体验收矩阵见 [ms-avatar `11.2](./ms-avatar.md)；如果只靠局部快照不足以辨识换装完整性，须增加 Renderer **内部的可验证完成信号**，不宣称延迟一个 microtask 就保证原子。

### 7.3 I03 / I04：父级 Clock、Player、Painter 与共享图集缓存

- `ms-action` **不持有 Render Clock**；选最近祖先 Provider、暂停/重挂、one-shot 覆盖基础时间冻结与表情独立时间轴都由父 `ms-avatar` 执行。子组件不因数据更新自行重启播放实例。
- 父级 `AnimationPlayer` 接受当前 Clip 快照，保留同名动作 `elapsedMs` 并依新定义 seek；one-shot Clip 失效立即取消，基础 Clip 缺失时本应运行的时钟继续。`AvatarPainter` 只消费通过父子校验的 frame/layers。
- `AvatarResourceCache` 根据 `namespace/key/contentVersion` 统一按 atlas 页读取、解码及复用。子 Clip 中的 sprite ID 解析到父 `data.sprites` 的图集页/`source`；`ms-action` 不持有 PNG、图集 lease、缓存 pin，也不单独取消其他动作仍在使用的共享页面。
- 父级用 epoch、在途读取 Abort、解码前后失效门禁、受控并发和 pin/unpin 的 `try/finally` 阻止晚到旧画面；已开始的 `createImageBitmap()` 不假设可立即取消。

### 7.4 I05：子 Clip 自校验 + 父级组合校验与诊断

- 子节点验证 Clip 字段类型、格式版本、帧有序/非负有限持续时间、循环与后缀起点、frame/layer 结构、sprite 引用形式及应用级容量；**数据错误立即标记 invalid**，不绘制/恢复旧有效定义。
- 父 `ms-avatar` 负责校验共享 `appearance/sprites/expressions`、重名、sprite/zOrder 引用完整性、图集 `source` 与实际尺寸，并将 D12 的 `ACTION_MISSING / ACTION_INVALID / DUPLICATE_ACTION / CONTENT_CONFLICT / APPEARANCE_INVALID / PIXELS_PENDING` 等候选诊断区分展示；无效当前组合清理过期像素，缺图片不阻塞有效动画时钟。
- 单 Clip / 全 Avatar 的帧、层、JSON 字节和 atlas 页缓存预算需真实 CMS079 V01/V03 测量，不能直接继承旧 32 Action / 256KiB 阈值。

**当前状态**：I01–I05 已确认实施架构，私有接口名和 Validator 字段仍为候选；**没有新增源码、没有跑过 PoC，也没有通过真实 CMS079 像素/性能验收**。

