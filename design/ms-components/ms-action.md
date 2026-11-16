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
      playback: "loop",      // 候选字段，尚未冻结
      frames: [/* 已合成的动作帧及资源引用 */]
    }
  },
  children: []
}
```

- `ms-action` 是正式注册的 Custom Element：LoomRealm WebProjector 为每个 RenderNode 创建元素，并将 `children` 机械投影成**父元素 light DOM** 的有序子元素。
- **已确认 D04**：一条 `ms-action` 对应一个 `attrs.name` Action；区分大小写的精确字符串匹配，同一个 Avatar 直接子节点范围内名称唯一。重复名称的动作索引发生冲突，不得静默按 DOM 顺序选取；精确字符集和长度限制仍需 CMS079 资料与 Validator 定稿。
- 默认子节点 `children: []`。**纸娃娃层、贴图和骨骼/锚点不因此成为 RenderNode 子节点**；它们仍属于单个动作 Clip 内部数据。
- **`key` 是 RenderNode 身份，不是动作名**。同一个 live key 不得原地更改 `attrs.name`；改名应通过 `RenderDomain.replace()` 删除旧节点，使用符合 LoomRealm one-shot key 生命周期的 **fresh key** 创建新节点。
- `attrs.name` 的语义和改名规则已经确认；`data.clip` 内的 `playback`、`frames`、版本等字段仍是候选，完整 Schema 与 Validator 尚未冻结。

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
- 各个 `ms-action` 的 Clip 仍需应用级帧数、图层、字节、资源引用上界及诊断。是否采用旧版具体数值需要真实 CMS079 样本测量后决定。**D12 已确认无效 Action/组合 fail closed、旧画面不得冒充新状态，具体错误码和宿主输出 API 留 I05**。**换装需按 §3.2 把关联更新放入一次原子提交，不得跨提交逐步替换动作。**
- 当前外观可触发的动作应**预先发布对应子节点**，不要在施放技能的 Event 到达后才尝试创建 Clip；具体动作清单与数据体积的产品策略尚待验证。**已确认 D03 / D10**：`ms-action` 不承担表情帧，也不承载世界 `x/y` 或世界深度；表情归父 Avatar 的共享外观数据，场景负责角色位置及世界排序。**D05/D06/D07/D11 待联合复核**旧版 cms-actor 的 atlas 合并加载及 OpenMS 的 atlas manifest/共享 lease，避免每帧小图片单独请求。

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

## 6. 已确认项与剩余待决事项

新一代 Actor 组件**唯一完整台账**位于 [ms-avatar §10](./ms-avatar.md)：**已确认 D01、D03、D04、D08、D09、D10、D12**，剩余产品/ABI **5 项（D02、D05、D06、D07、D11）**、实施机制 5 项（I01–I05）、验证/迁移 4 项（V01–V04）。本文件不再把已确认的数据分工或错误处理当作待裁决方案。

| 议题 | 当前状态与需要继续做的事 |
| --- | --- |
| D08（已确认） | 父级共享外观数据负责 zOrder、资源索引及独立表情；单 Action Clip 负责帧/循环/变换和小图裁剪引用。旧 cms-actor 的 atlas 整页缓存能力必须能够复用；**仅具体 JSON 字段名/校验器未冻结** |
| D12（已确认） | Clip 缺失/无效、共享外观冲突、图片未解码、Content 版本或尺寸冲突需分类诊断；不回退到另一业务 Action，不显示已经失效的旧装备/旧动作像素。**具体错误码、诊断接口、调试占位画面交 I05** |
| D02（未决） | attrs 高频独立变更，data 顶层字段可 patch 但嵌套 appearance 更新要替换整个该对象；如何避免频繁重复投递/序列化大共用数据仍须决定 |
| D05 / D06 / D07（未决） | 动作帧时序、延迟/UOL、层布局和 atlas `source` 裁剪必须一起基于真实 CMS079、固定 OpenMS 与旧 cms-actor 验证；Clip 定义是渲染数据，**不是图集图片字节** |
| D11（未决） | 同时测动作定义数量/大小、图集页数量与尺寸、Content 请求数、解码峰值、跨动作/换装图集复用及预读策略；不要照搬旧 32 Action / 256 KiB 或 OpenMS 126 个动作的阈值 |
| I01 / I02 / I05（待实施） | 父子通知/同步查询与换装投影门闩、父级+Clip 组合验证及错误码/输出 API |
| V01 / V03（待验证） | 真实 CMS079 实例与 atlas 小图合并前后 Content 请求、首帧耗时、缓存、内存、逐帧像素一致性 |

**源码依据**：

- [旧 cms-actor 实施契约：atlas 整页读取/解码、source 裁切、缓存](../../components/cms-actor/IMPLEMENTATION.md)
- [旧 cms-actor 模型验证：atlas page 与每层 source/尺寸声明](../../components/cms-actor/src/avatar-model.mjs)
- [固定 OpenMS `AvatarVisuals.prepare()`](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/avatar-visuals.js)
- [固定 OpenMS `visual-resources.js`](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/visual-resources.js)

**实现边界**：将动作拆为 `ms-action` 子节点是为独立索引和增量更新，**不代表把图像拆成每帧单独请求，也不代表 LoomRealm 支持分段加载子树**。已确认的两层（共享外观/单动作）数据分工与完整页面复用并不冲突。

**验证状态**：仅为设计 Draft；`ms-action` 尚无实现、Validator、浏览器投影和真实 CMS079 素材验收。不得据此声称 LoomRealm Core ABI 已变更或旧版 `cms-actor` 被替换。
