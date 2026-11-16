# ms-action — Avatar 动作数据子组件设计（Draft）

> **状态：Draft，未冻结字段级 ABI，未实现。**  
> 组件标签：`ms-action`，仅在 `ms-avatar` 的 RenderNode 子树中作为动作定义提供者。  
> 参考：LoomRealm `93648192323bf5f57996b7b54cbae641d8a53fdb`；OpenMS GMS083 `07994de02756356e3e025e3aca9e79433898d2c8`。OpenMS 机制并非 CMS079 已验证的字段约定。

## 1. 已确认的职责边界

**`ms-action` 是单个动作的渲染就绪数据组件，不是动画播放组件，也不是资源加载组件。**

- **Subsystem / Adapter**：根据当前外观、动作需求和 CMS079 原始资料准备每个动作的合成帧、位置信息、时长和资源引用；按需要创建/更新对应 RenderNode。
- **`ms-action`**：消费自己的 `receiveRenderData()`、验证单个动作 Clip、保存只读语义数据，并通过 Renderer 内部组件协议将当前定义暴露给所属的 `ms-avatar`。
- **`ms-avatar`**：建立动作名索引、持有 Animation Player / Render Clock；**统一读取、解码、缓存、版本校验及释放动作帧使用的图片/图集**，统一执行纸娃娃合成与绘制。
- **`ms-action` 不负责**：自己的 RAF、Clock、Canvas/WebGL、图片读取/解码/缓存、资源所有权、战斗技能判定、选择下一个动作或触发播放。
- 动作 Clip 仍是渲染就绪的定义，不携带原始 WZ/FSDB 文件路径，也不让 Renderer 推断装备和技能业务规则。

## 2. RenderNode 形状（候选字段，原则已确认）

```js
{
  key: "avatar:player:walk2",
  tag: "ms-action",
  attrs: {
    name: "walk2"            // 候选属性名；用于父节点索引
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
- 建议一条 `ms-action` 对应一个 Action 名；其定义应在同一 `ms-avatar` 的直接子节点范围内唯一。动作名的字符集、绑定字段、重命名/身份生命周期规则尚待 ABI 细化。
- 默认子节点 `children: []`。**纸娃娃层、贴图和骨骼/锚点不因此成为 RenderNode 子节点**；它们仍属于单个动作 Clip 内部数据。
- `key` 是 RenderNode 身份；不把 `key` 或 DOM 顺序当作动作名本身。父组件以明确定义的动作名建立索引。
- **动作字段**（`attrs.name`、`data.clip`、`playback`、`frames`）示例只是候选表达。先确定拆分与资源所有权，后续再冻结 Schema。

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

- `ms-action.receiveRenderData()` 的变化**不会自动触发父节点的 `receiveRenderData()`**。应设计局部通知（如冒泡的内部 DOM CustomEvent）和/或父组件同步读取子组件 API；不通过 LoomRealm RenderEvent 绕一圈。
- 父组件需要响应子元素增加、移除、移动以及 `attrs.name` / Clip 数据更新；建议初始/重挂时全量扫描直接子元素，增量时在本地维护索引。具体通知机制（如 MutationObserver + 内部事件）是实现选择，尚未冻结。
- 只读取**当前有效、已接收到 Clip、通过校验**的动作定义；一个空壳 `ms-action` 元素不能被当作 Action 已就绪。
- 同名重复子节点应报告可定位错误并阻止歧义播放；不可悄悄以 DOM 顺序选一个。
- 当 Event 指定的 Action 未在**当前已注册且有效**的 `ms-action` 集中时，仍遵守 [ms-avatar](./ms-avatar.md) 的既定规则：丢弃此次一次性 Event，不等待新子节点到达后补播。
- Action 定义存在、图片还在父组件解码时，按 Renderer 接收 Event 的时间照常计时；`ms-action` **不因资源未就绪而阻塞 Clip 生效**。
- 子节点 Clip 替换或被移除、父节点切换外观、one-shot 中断时，父组件必须使对应的**异步过期绘制结果失效**。**已确认**：同名有效 Clip 更新不重播，父 Avatar 保留当前播放实例的 `elapsedMs` 并按新定义定位帧；one-shot Clip 消失或失效时取消并回到最新基础 Action（见 §3.1）。

### 3.1 已确认：Clip 热更新与动作删除语义

`ms-action` **只提供定义变更**，它不会自行调用 `setAction()`、启动或重启动作。处于当前播放状态的迁移由 `ms-avatar` 的 Animation Player 决定：

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

**首版不增加同步用 `appearance-version` 或 `clip-version` 字段**；图像的 `contentVersion` 是 Content 资源身份，不承担换装事务编号。不同提交/不同 Domain 的分阶段换装不受本方案支持；将来确有必要时再设计显式版本/激活机制。

已确定的 §3.1 热更新规则不变：同名有效 Clip 更新保留 `elapsedMs`，one-shot Clip 删除则取消；图片未就绪不会让 Clip 失效或阻塞动画时钟。

### 3.3 已确认：基础 Action 的 Clip 缺失与恢复（时间继续流逝）

- `ms-action` 的 DOM 子节点未存在、Clip 尚未交付或校验失败时，`ms-avatar` **保留 retained 基础 `attrs.action`**，报告缺失，不猜测替换为其他业务动作。
- **缺少 Clip 定义不等于暂停当前 Render Clock**。基础动作在自身既定播放策略下本应累计的 `elapsedMs` 仍应推进；待同名有效 Clip 恢复后，按照新 Clip 的完整循环、局部循环或 hold 规则**直接求当前帧**，不从第 0 帧重新启动，也不补画错过的帧。
- 例：`walk1` 播放 300ms 后 Clip 临时缺失，时钟正常前进 2s；有效 Clip 恢复后，以累计约 2300ms 在新 Clip 上 seek，而不是重新从 0ms 或 300ms 播放。
- **例外**：选定时钟显式暂停或同一 Avatar 实例 DOM 断连时照原先规则冻结；如果 one-shot 覆盖时基础动作的既定时钟策略本来挂起，则不能借“Clip 缺失”擅自改变覆盖期间的基础动作计时策略（该覆盖计时细节仍待决定）。
- Clip 定义存在但图片未解码，和 Clip 定义缺失是两个不同情形；均不能据此让本应运行的动画时间停止。缺定义时不能拿无效旧帧冒充有效图像；晚到的图像仍需防止覆盖更新后的画面。
- **仅适用于基础 Action 的 retained 播放状态**：新 `render.event("action")` 对应 Clip 若不存在，仍依既定规则直接丢弃且不补播。基础 Clip 恢复不触发新的 Event。

该时间语义是 Adventure Island 产品选择，细节见 [ms-avatar §5.14](./ms-avatar.md)。

## 4. 数据规模与发布语义

**目的：让动作独立寻址和独立更新，降低小改动需要替换整份动作计划的成本。不是规避 LoomRealm Core 的通用字节硬上限。**

- LoomRealm Render Update v1 没有强制统一的 RenderNode `data` 大小、树节点个数或 JSON depth 硬限制；旧版 `cms-actor` 的 **256 KiB、32 Action** 是应用级限制。
- 已存在的 `ms-action` 可用 `RenderDomain.update({ nodes: [{ key, data: { set: { clip } } }] })` 更新；`data.set` 替换的是对应子节点 `data` 的**顶层属性**，不是修改父节点的 `children`。
- **增加、移除、重新排列子节点**需要通过 `RenderDomain.replace()` 更新 authoritative tree；`RenderDomain.update()` 无法更改 `key/tag/children`。
- 即使拆为子节点，初始 Snapshot 仍携带完整当前树；`replace()` 是全树结构提交，不自动按需传输某一子节点。未来若需真正延迟传输、共享跨角色 Clip 或独立资源发布，需要另行设计，不能声称当前子树已经具备这些能力。
- 各个 `ms-action` 的 Clip 仍需应用级帧数、图层、字节、资源引用上界及诊断。是否采用旧版具体数值需要真实 CMS079 样本测量后决定。**换装需按 §3.2 把关联更新放入一次原子提交，不得跨提交逐步替换动作。**
- 当前外观可触发的动作应**预先发布对应子节点**，不要在施放技能的 Event 到达后才尝试创建 Clip；具体动作清单与数据体积的产品策略尚待验证。

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

## 6. 后续待逐项确定

1. `ms-action` 的具体字段 ABI：动作名、Clip 版本、循环区间和帧列表。
2. 父子通知与快照投影顺序、重挂/移除时清理逻辑；包括不同 Action 重名的错误处理。
3. **已确认 (§3.1–§3.3)** 同名 Clip 热更新保留 `elapsedMs`，失效 one-shot 取消；换装同次原子发布；基础 Clip 缺失不冻结其本应经过的时间，恢复后 seek。
4. 父级共享外观与各 Clip 的具体 zOrder/资源引用组合校验算法、投影结束信号、缓存容量；**不新增**用于换装同步的 `appearance-version`。
5. CMS079 实际外观动作范围与序列化开销，是否需要另一层共享数据压缩。

**验证状态**：仅为设计 Draft；`ms-action` 尚无实现、Validator、浏览器投影和实资源验收。不得据此声称 LoomRealm Core ABI 已变更或旧版 `cms-actor` 被替换。
