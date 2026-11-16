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
- 子节点 Clip 替换或被移除、父节点切换外观、one-shot 中断时，父组件必须使对应的**异步过期绘制结果失效**。正在播放的相同 Action 在 Clip 被替换时如何延续相位尚待下一轮定义。

## 4. 数据规模与发布语义

**目的：让动作独立寻址和独立更新，降低小改动需要替换整份动作计划的成本。不是规避 LoomRealm Core 的通用字节硬上限。**

- LoomRealm Render Update v1 没有强制统一的 RenderNode `data` 大小、树节点个数或 JSON depth 硬限制；旧版 `cms-actor` 的 **256 KiB、32 Action** 是应用级限制。
- 已存在的 `ms-action` 可用 `RenderDomain.update({ nodes: [{ key, data: { set: { clip } } }] })` 更新；`data.set` 替换的是对应子节点 `data` 的**顶层属性**，不是修改父节点的 `children`。
- **增加、移除、重新排列子节点**需要通过 `RenderDomain.replace()` 更新 authoritative tree；`RenderDomain.update()` 无法更改 `key/tag/children`。
- 即使拆为子节点，初始 Snapshot 仍携带完整当前树；`replace()` 是全树结构提交，不自动按需传输某一子节点。未来若需真正延迟传输、共享跨角色 Clip 或独立资源发布，需要另行设计，不能声称当前子树已经具备这些能力。
- 各个 `ms-action` 的 Clip 仍需应用级帧数、图层、字节、资源引用上界及诊断。是否采用旧版具体数值需要真实 CMS079 样本测量后决定。
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
3. 当前播放的 Clip 被子节点更新或删除时，延续相位、重启还是中断。
4. 父级 `appearance` 与每个 Action Clip 的共用 zOrder/资源引用、版本一致性与缓存容量。
5. CMS079 实际外观动作范围与序列化开销，是否需要另一层共享数据压缩。

**验证状态**：仅为设计 Draft；`ms-action` 尚无实现、Validator、浏览器投影和实资源验收。不得据此声称 LumiRealm/LoomRealm Core ABI 已变更或旧版 `cms-actor` 被替换。
