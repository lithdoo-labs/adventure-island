# ms-avatar — 纸娃娃渲染组件设计（Draft）

> **状态：Draft，未冻结 ABI，未实现。**  
> 目标标签：`ms-avatar`（新设计）；旧实现：`cms-actor`。  
> 本文只讨论 Avatar，不提前定义 Map、Camera、World Renderer 或角色群体 Batch。  
> 参考：LoomRealm `93648192323bf5f57996b7b54cbae641d8a53fdb`；OpenMS GMS083 `07994de02756356e3e025e3aca9e79433898d2c8`。OpenMS 的行为是参考，不等于 CMS079 已验证事实。

## 1. 已确定的定位与职责

**`ms-avatar` 是纯粹的人物外观与动作绘制器（Avatar Renderer），不是管理人物表现状态的游戏角色组件。**

- **Subsystem / Field Runtime**：持有角色和装备的权威状态；决定世界位置、朝向、当前身体 Action、表情意图及动作切换时机；经游戏侧 Adapter 生成渲染就绪的外观计划。
- **Renderer 内的 `ms-avatar`**：消费外观计划和当前呈现指令；按帧进行身体、头、脸、头发、装备合成；实现锚点对齐、部件遮挡、镜像、表情及身体动画；通过本地 Render Clock / RAF 推进**视觉帧**。
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
| `receiveRenderEvent` | 只接收允许丢失、不需快照恢复的一次性视觉效果；**不得成为关键动作的唯一依据** |

`RenderDomain.update()` 的 `attrs/data` 更新不改变节点 `key/tag/children`，`data.set` 按顶层成员替换；`receiveRenderData()` 收到完整 data。动态动作更新不应导致未变的 AvatarPlan 重新解析/加载。

## 4. 动态 ABI：候选草案（尚未批准）

以下仅用于继续讨论 **attrs 与 data 的边界**，不是正式 Validator 或完整动作同步协议：

```js
{
  key: "avatar:player",
  tag: "ms-avatar",
  attrs: {
    x: "120",
    y: "80",
    facing: "right",
    action: "walk1",
    expression: "default"
  },
  data: {
    avatarPlan: { /* 已解析的绘制定义；具体 Schema 待定 */ }
  },
  children: []
}
```

说明：

1. 倾向让 Subsystem 直接选择 `walk1`、`stand2`、`jump` 等**具体 Action 名称**，而不是 Avatar 根据 `locomotion=walk` 再决定武器后缀。
2. `skin/face/hair/equips` 是游戏侧外观选择；既然 `avatarPlan` 已经解析这些选择，倾向从新节点的 `attrs` 移除，以免产生两套来源。
3. `expression` 的当前选择与表情帧定义需要分离。现有 V1 将 `expression.name` 和帧列表放在 Plan 中，是否拆为动态输入 + 表情 Clip 定义**待定**。
4. `x/y` 沿用 V1 的身体原点输入作为讨论起点；未来是否由父级场景设置位置、组件是否自持最终 Canvas，**待定**。
5. `action-sequence`、动作开始 Tick、播放相位、暂停/恢复标记等**尚未定义**，以上示例不能保证同名动作重启或 Snapshot 恢复。

## 5. 动画时钟与动作生命周期：暂不冻结

- **Simulation Clock 属于 Subsystem 进程**。Avatar 不推进物理世界、也不读取 LoomRealm Frame 作为游戏 Tick。
- **Render Clock 属于 Renderer 进程**。Avatar 可以根据 Action Clip 的 delay 用本地 RAF 推进绘制帧；无需每一帧收到 Render Update。
- Subsystem 负责选择当前 Action 及何时切换；Avatar 不能把“动画播完”当作自行修改权威角色状态的理由。
- 旧版 `action` RenderEvent 驱动一次性攻击，事件丢失/Renderer 重建后无法恢复。对需要恢复的攻击/施法动作，倾向使用 retained Action 状态；瞬时、可丢失的附加效果仍可使用 RenderEvent。
- 需要单独讨论：同名 Action 连续触发如何区分、播放结束保持哪帧、动作时间锚点如何定义、通信延迟和快照恢复如何定位播放相位、模拟暂停时动作是否冻结。
- OpenMS 的 action frame、repeat suffix、preAction、独立 expression clock、seek 等提供候选行为；是否纳入 AvatarPlan 新版本，要逐项验证，不直接复制实现。

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
| 直接输入具体 Action 名 | 是 | 待确认 |
| 去除 `skin/face/hair/equips` 重复 attrs | 是 | 待确认 |
| 表情选择与表情帧定义分离 | 是 | 待确认 |
| 关键动作使用 retained 状态，RenderEvent 留给视觉脉冲 | 是 | 待确认 |
| Action 时钟、重启、暂停、恢复字段 | 未选定 | **待讨论** |
| AvatarPlan 动作集合/版本化策略 | 未选定 | **待讨论** |
| 世界坐标与最终 Canvas 输出边界 | 未选定 | **待讨论** |

## 9. 依据与验证状态

- [旧版 cms-actor 设计](../../components/cms-actor/DESIGN.md)
- [旧版 cms-actor 实施说明](../../components/cms-actor/IMPLEMENTATION.md)
- [Frozen RenderNode ABI v1](../../components/RENDER-NODE-ABI-V1.md)
- [Adventure Island 产品模块边界](../../docs/product-first/MODULE-CONTRACTS-V1.md)
- [OpenMS Avatar Composition](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/avatar-composition.js)
- [OpenMS Animation Timing](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation-timing.js)
- [LoomRealm Render Update v1](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/render-update-v1.md)

**验证状态**：新 `ms-avatar` 仅为设计 Draft；没有新增实现、Schema Validator、Chromium 测试或真实 CMS079 像素一致性验收。旧版历史测试不自动证明新 ABI 通过。
