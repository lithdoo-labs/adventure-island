# World Rendering Architecture — DOM + Multi-Canvas（OpenMS-guided Draft）

> **状态：讨论草案 / 非规范 / 未批准 / 未冻结 / 未实现。** 2026-11-17 设计方向更新；替换本文件之前的“单一 World Compositor + 各 Collection 注册 Renderable”候选结构。
>
> **本次明确的方向：统一世界排序，不统一 Canvas。** 由 Field Subsystem 产生权威视觉状态及跨对象深度顺序；LoomRealm 将 RenderNode 机械投影为 DOM；同一 World Depth Plane 内交错排列可独立叠放的 Paint Units。静态地图采用多个 Canvas 批次，Avatar/NPC/Mob/独立场景物件采用独立 Custom Element 或局部 Canvas。
>
> **M1 实测结论（2026-11-18）：** [synthetic WebProjector spike](../roadmap/M1-SPIKE-EVIDENCE.md) 已确认 managed Light DOM + Shadow slot、共同 world-plane Camera、可交错 sibling Paint Units、有限 batch Canvas、identity 保留和静态 Canvas 无重绘等核心原则。
>
> **M2 实测结论（2026-11-18）：** [map adapter evidence](../roadmap/M2-ADAPTER-EVIDENCE.md) 已用真实 `222000000` FSDB 验证 CMS079 Tile/Obj key、sourceOrder tie、foothold 插入点切批与资源闭包；默认预算下得到 253 个静态 batch，25 个多帧 Obj 按更新策略独立为 `ms-map-object` candidate。这是首份切分测量，不是产品 Canvas 预算。本文仍是完整产品架构草案；M1/M2 没有批准完整标签集、生产 schema、`stack-rank` 编码或最终批次算法。
>
> 本文不修改 [ms-avatar](./ms-avatar.md)、[ms-action](./ms-action.md) 既有候选 ABI，不改变 LoomRealm Submodule，也不批准 CMS079 深度公式、标签集合或实现方案。

> 上游边界：先阅读 [设计总入口](../README.md)、[LoomRealm 架构](../architecture/LOOMREALM-RUNTIME-AND-RENDERING.md)、[Field 投影管线](../architecture/FIELD-PROJECTION-PIPELINE.md)、[FSDB 内容模型](../content/FSDB-CONTENT-MODEL.md) 与 [OpenMS 开发参考](../references/OPENMS-DEVELOPMENT-REFERENCE.md)。

## 0. 首阶段组件树及独立文档入口

当前阶段按“地图 + Back/Tile/Obj + 玩家 Avatar + Camera + Movement + Portal”三图闭环提出 **8 个 Custom Element 标签候选**，其具体树、前后遮挡关系、阶段范围及未决问题，统一参见 **[Field 首阶段组件树草案](./FIELD-COMPONENT-TREE-DRAFT.md)**。六个新组件的具体 attrs/data/children 与 ResourceRef/stack-rank 公共规则已写入 **[Field Paint Unit ABI 共享候选契约](./FIELD-PAINT-UNIT-ABI-DRAFT.md)**；各组件详情见下表。

| 基础必需标签（6 个） | 按场景需要的标签（2 个） |
| --- | --- |
| [ms-scene-view](./ms-scene-view.md)、[ms-map-back](./ms-map-back.md)、[ms-map-batch](./ms-map-batch.md)、[ms-world-item](./ms-world-item.md)、[ms-avatar](./ms-avatar.md)、[ms-action](./ms-action.md) | [ms-map-object](./ms-map-object.md)、[ms-portal-visual](./ms-portal-visual.md) |

ms-avatar 和 ms-action 已有独立组件文档；组件契约变更直接更新对应文档，不做 ABI 版本管理。其余六份为本轮新增的**未批准阶段设计草案**。Portal 业务传送不依赖 Portal 视觉标签；ms-action 的独立标签必要性仅在现有 Avatar V1 父子设计下成立。过去的 R1/R2 路线图已归档，不因本表重新批准。

## 1. 架构约束和目标

### 1.1 不变的 LoomRealm 边界

- **Subsystem 进程**：Simulation Clock、移动和 Foothold 接触、业务实体、状态生命周期、业务 Camera Intent；游戏 Render Projection 将这些权威事实与经验证的静态地图呈现事实转换为 RenderDomain/RenderNode。
- **LoomRealm**：Render Update v1、Renderer Store、WebProjector、RenderNode identity、managed Light DOM 的创建/移动/删除，以及 Presentation Resource Client、Render Event/InputGate。
- **Adventure Island 的业务 Custom Elements**：只消费呈现状态；负责局部图片/Canvas/Shadow DOM、视觉动画、资源解码和非权威缓存。不得自行模拟移动/碰撞/传送、决定业务状态，或向 LoomRealm Store 反向同步 DOM。
- **视觉时钟**可以在 Renderer 内驱动 Sprite 帧和表现性插值，但不是 Simulation Clock，也不能以动画完成决定战斗/传送结果。
- 不建立第二个全局 Renderable Registry、跨组件运行时协调协议、World Renderer 服务定位器、LoomRealm 尚不存在的 ProjectionBatch API。**OpenMS 的 PixiJS Container 组织是绘制排序的行为参考，不是 LoomRealm 的运行时模板。**

LoomRealm 固定提交为 [93648192323bf5f57996b7b54cbae641d8a53fdb](https://github.com/lithdoo/loom-realm/tree/93648192323bf5f57996b7b54cbae641d8a53fdb)。上游 RenderNode 仍是五字段 `key / tag / attrs / data / children`。Domain zIndex 不等于游戏对象世界深度，也不保证跨 Subsystem 可任意交错叠放。

### 1.2 组件契约维护与 LoomRealm 通道

- 组件 ABI / Schema 不做版本管理：不设置 `formatVersion`、`schemaVersion` 或场景代际字段；不做版本协商、兼容分支或迁移。字段调整直接更新组件对应文档与投影实现。
- `ResourceRef.contentVersion` 仅用于 LoomRealm Content 资源完整性读取，满足 `resource(namespace, key, expectedContentVersion)`；它不是组件版本字段，必须保留。
- `attrs` 是 retained string map，经 Custom Element attribute lifecycle 更新；`data` 是 retained JSON object，`receiveRenderData()` 收到完整当前对象；RenderEvent 是不保证重放的瞬时消息；`emitCustomEvent()` 是受 InputGate 约束的反向输入出口。
- 六个新场景视觉组件当前均无 incoming RenderEvent、无 outgoing `emitCustomEvent()`；Avatar 的 `action` RenderEvent 直接投递给 Avatar key，不通过 DOM 冒泡。

### 1.3 设计目标

1. **遮挡正确性第一**：Tile、Obj、前景 Back、玩家、Mob、NPC、Drop、效果使用可比较的世界排序结果；禁止固定“整张地图在 Avatar 下方”或只做 Y-sort。
2. **DOM 负责独立组合**：Avatar、NPC、Mob、大型/特殊 Obj 可以拥有独立节点、Shadow DOM 与局部 Canvas；不强制所有画面落在单一 Canvas。
3. **静态地图批量 Canvas**：只在不破坏其他 Paint Unit 深度插入点的范围内合批，且可以按 Region/资源驻留进一步拆分。
4. **更新局部化**：Camera、位置、动画帧、深度变化、静态块加载分别更新其必要的节点/表面，避免每帧重绘整张地图。
5. **语义稳定**：RenderNode 的 key/生命周期归 LoomRealm；Canvas 是组件内部实现，绘制批次不是新的平台 authority。
6. **证据边界**：OpenMS 提供 GMS083 的已恢复行为参考，CMS079 事实仍需按来源和样本逐项验证。

## 2. OpenMS 参考与 CMS079 已闭合事实

参考 OpenMS 固定提交 [07994de02756356e3e025e3aca9e79433898d2c8](https://github.com/tensorfish/openms/tree/07994de02756356e3e025e3aca9e79433898d2c8)：

- [StreamScene](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/stream-scene.js) 收集 Region、动态 Entity 和独立 world Container，并以 `zIndex`、`depthOrder` 对统一显示列表排序。深度变化时 `setEntityDepth()` 调整已有显示位置；不是每帧重建 Sprite，也不是按 Y 排序。
- [EntityAnimation](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js) 一个 Entity 持有持久 Container / Sprite pool；角色身体、装备、表情在 **Actor 自己的局部组**内合成，整个 Actor 组才参与世界排序。
- [原版深度逆向证据](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/docs/client-evidence.md) 明确 Tile、Obj、Back、玩家、Mob、NPC、Drop 有各自表达式；同深度比较 Renderer serial；Actor 名称/功能标记属于 Actor-relative 显示关系，不是永远置顶的独立 UI。

GMS083 参考深度（令 `B = -0x40000000`）：

| 对象 | GMS083 证据表达式 |
| --- | --- |
| Tile | `B + 19990 + layer*30000 - tile.zM*10 + tileCanvas.z` |
| Obj | `B + 2000 + layer*30000 + obj.z` |
| Back（front=0） | `B - 128000 + index*1000` |
| Front Back（front!=0） | `B + 272000 + index*1000` |
| 普通 Mob | `B + 29991 + (layer*3000-group)*10` |
| NPC | `B + 29995 + (layer*3000-group)*10` |
| 本地 Player | `B + 29992 + (activeController?5:0) + (layer*3000-group)*10` |
| Drop | `B + 29999 + (layer*3000-group)*10` |
| Combat Number / MISS / LevelUp | `B + 398500` |

这些表中数值首先是 **OpenMS/GMS083 行为参考**。但 CMS079 最新 source-of-truth 已经独立恢复并闭合以下关键链条：

- C-001：`tileKey = canvasZ + 10*(layer*3000-zM)-1073721834`；
- C-002：`objKey = layer*30000+z-1073739824`；
- C-097：slot45 keyed ordered-tree insert、comparator 和 equal-key 确定性二级比较；
- C-099：Avatar 插入 key，和 Tile/Obj 属于同一个 `-2^30` key family；
- C-100：Avatar 内部 149 层 zmap/smap 顺序与世界顺序相互独立且静态。

因此“Tile/Obj/Avatar 进入同一确定性世界顺序”不再只是 OpenMS 假设。仍未批准的是 Adventure Island 怎样规范化该 key、怎样编码 `stack-rank`、怎样处理尚未覆盖的实体类别与所有视觉特例。独立实现不得复制 OpenMS GPL-3.0 源码。

## 3. 三层结构：权威投影、DOM Paint Units、局部绘制

~~~text
Field Subsystem（权威 Simulation / World / Camera Intent）
  └─ World Render Projection
       ├─ RenderNode identities（scene root key + fresh child keys）
       ├─ world placement + action/expression + resource refs
       ├─ normalized depth + deterministic tie order
       └─ planned static batches / independent paint units
                   │ RenderDomain.replace / update / emit
                   ▼
LoomRealm Renderer Store → WebProjector（机械 Light DOM 投影）
                   │
                   ▼
ms-scene-view（Viewport / World Depth Plane / slot）
  ├─ ms-map-back            （图片或背景 Canvas）
  ├─ ms-map-batch           （静态 Tile+Obj Canvas）
  ├─ ms-world-item          （外层 transform + stack-rank）
  │   └─ ms-avatar         （独立局部 Canvas）
  │       └─ ms-action[]   （当前候选：Clip 数据节点）
  ├─ ms-map-object          （独立 Obj <img> / Canvas）
  ├─ ms-map-batch           （另一静态区间 Canvas）
  ├─ ms-world-item
  │   └─ ms-npc            （独立图片或 Canvas；Actor 附属标记）
  ├─ ms-world-item
  │   └─ ms-mob            （独立图片或 Canvas）
  ├─ ms-map-animation       （动画 Obj / Back 的独立 Paint Unit）
  ├─ ms-world-effect        （独立世界深度的效果）
  └─ ms-map-back            （Front Back；具体顺序来自真实 depth）

HUD RenderDomain（独立的屏幕空间、非世界遮挡）
  └─ ms-hud
~~~

**上图列举的是代表性节点类别，并不是固定垂直图层或真实地图顺序。** 同一个 `ms-scene-view` 的直属 Paint Unit 节点必须能够按已验证的 `(depth, tieOrder)` 任意穿插。

### 3.1 Paint Unit 是什么

Paint Unit = **参与外部世界遮挡排序的最小可独立叠放表面**，可以是：

- 一个 DOM Custom Element（NPC、Avatar、大型静态 Obj）；
- 一个内部 Canvas 的宿主元素（某个静态地图深度批次）；
- 一个 Actor-relative 组合组（Avatar + 符合该组深度语义的附属标记）。

Paint Unit **不是**等价于单张图片、单帧 Sprite 或 LoomRealm 的公共 RenderNode 新类型。每个 Avatar 的内部 zOrder/slot occlusion 在局部 Canvas 完成；世界排序只处理其外层 Paint Unit。

### 3.2 候选 Custom Element 结构

| Tag 候选 | 外部职责 | 内部实现候选 | 默认独立世界排序 |
| --- | --- | --- | --- |
| `ms-scene-view` | 一个 World Domain 的根；视口、世界坐标平面与裁剪 | Shadow DOM，内部 `world-plane` 与 `slot` | 根本身不参与地图内部排序 |
| `ms-map-back` | Back / Front Back 的独立深度及视差数据 | 图片或受限背景 Canvas，重复/滚动可局部实现 | 是 |
| `ms-map-batch` | 一个深度安全区间/空间区块的静态绘制数据 | 缓存 Canvas，Tile 与 Obj 可混合 | 是 |
| `ms-map-object` | 需要独立深度、更新或特殊合成的 Obj | `img` 或局部 Canvas | 是 |
| `ms-map-animation` | 独立时间轴的 Obj/Back 动画 | 图片帧或局部 Canvas | 是 |
| `ms-world-item` | Actor 等的世界位置、Depth Rank、显隐 | 只管理宿主 positioning/transform/stack | 是 |
| `ms-avatar` | 纸娃娃动作、表情、装备的局部合成 | Shadow DOM + Canvas | 由外层 `ms-world-item` 排序 |
| `ms-action` | 现有候选 Action Clip 定义和验证 | 无独立绘制 | 否 |
| `ms-npc` | NPC 的动作及局部附属标记 | 图片 / Canvas + 必要局部 DOM | 由外层 `ms-world-item` 排序 |
| `ms-mob` | Mob 动作、受击、死亡等视觉状态 | 图片或 Canvas | 由外层 `ms-world-item` 排序 |
| `ms-reactor` / `ms-portal-visual` | 有独立可见外观的 Reactor/Portal | 图片或 Canvas；无视觉 Portal 不建节点 | 通常是 |
| `ms-world-effect` | 需要独立 world depth 的特效/数字等 | DOM / Canvas，按真实效果类别细分 | 是 |
| `ms-effect-batch` | 大量可安全共排的短时图元 | 局部 Canvas | 是 |
| `ms-hud` | Screen-space UI | 普通 DOM/Canvas | 不进入 World Depth Plane |

- **不默认建立 `ms-map` 作为包住全部地图绘制节点的 stacking context。** Map 是内容/逻辑模型；视觉上的 Tile、Obj、Back 与 Actor 必须可以互相穿插。
- **不默认建立 `ms-mob-collection` / `ms-npc-collection` 作为最终画面父容器。** 同类 Actor 可能被不同静态 Obj 分隔；集合属于 Subsystem 投影/数据侧，不是总 Canvas 或不可穿透的外层 DOM。
- 稠密 projectile/drop/effect 是否从单实例 DOM 升级为有限的 `ms-effect-batch`，由可见数量、深度交错和测量决定，不因实体类型自动成批。
- NPC name/function 等需保留 Actor-relative 层级；具有独立世界根深度的伤害数字等不能不加区分地塞进 NPC DOM 或一个永远置顶的全局 Overlay。

## 4. 具体 Canvas 划分与批次策略

### 4.1 不采用固定六层叠图

绘制单元分成**六种更新/绘制类别**：Back、静态地图批次、独立场景 Obj、Actor 局部画面、效果单元、HUD。它们并非“六张按固定顺序叠放的 Canvas”。真实 World 平面里可同时有多个 `ms-map-batch`、`ms-map-object` 和 Actor 宿主。

### 4.2 Static Batch Planner（投影/内容准备阶段）

将 Back/Tile/Obj placement 按 CMS079 证据规范化为静态绘制记录 `(placementId, depth, tieOrder, bounds, resourceRef, geometry)`；根据可达的 Actor Depth Plane、独立 Obj / effect 插入点以及 Region 空间范围，形成**可以正确独立叠放的静态批次**。运行时 Canvas 仅消费已经确定的批次及其资源。

合批顺序：

1. **先排序**：所有需要相互遮挡的对象共用一套经 CMS079 验证的世界顺序；不得按“Tile 全部一组、Obj 全部一组”预先打包。
2. **再检查插入点**：若某动态 Actor 可能需要插入静态绘制序列中间，必须在该深度断点拆分静态绘制批次，或者将少数相关 Obj 独立化。
3. **再按空间区块拆分**：避免全地图尺寸 Canvas，Region/区块需要保留静态 authored tieOrder，异步加载先后不得决定排序。
4. **再考虑更新频率和资源**：静态内容预栅格化；动画 Back/Obj 独立局部刷新；相同深度且不破坏插入关系时允许混合 Tile/Obj。
5. **最后以实测优化**：Canvas 数量、Canvas 总像素、显存/内存、重绘面积、Layer 合成成本、DOM 节点与排序更新成本都需要预算。

**基础安全条件**：同 Canvas 的记录在最终绘制序列中连续，并且运行中不会有需要插入其内部的独立 Paint Unit。更激进的基于像素不重叠/活动范围的合批需要独立证明。不能把多个不同深度 Obj 画在一张整体 Canvas，再试图只改它的 CSS z-index 表达内部穿插。

**示例（GMS083 值去掉共同 B，仅示意）**：

| 单元 | 示例 depth | 可能的 Paint Unit |
| --- | ---: | --- |
| Back index0 | -128000 | 背景 Canvas |
| Layer2 Obj z12 | 62012 | 静态 Batch A |
| Layer2 Tile zM0/canvas.z2 | 79992 | 静态 Batch A |
| Layer2 NPC group1 | 89985 | NPC DOM |
| Layer2 active Player group0 | 89997 | Avatar DOM |
| Layer3 Obj z14 | 92014 | 静态 Batch B |
| Front Back index0 | 272000 | 前景 Back Canvas |

若运行时出现 depth=70000 的独立 Actor，原 Batch A 的两个项目不再满足连续性：**须提前按可插入深度设计安全边界，或作一次受控的批次结构替换**。不能仅靠修改 Batch A 的 z-index 修正。该表非 CMS079 事实，不据此承诺真实地图只需要两张静态 Canvas。

### 4.3 Canvas 大小与内容生命周期

- `ms-map-batch` 持有有限尺寸的像素缓存，与世界区块关联，优先避免全地图画布；Canvas DPR、缩放、裁剪、origin 都是呈现局部问题。
- Camera 移动优先通过公共 World Plane 的 transform 移动静态内容，不应强制每像素移动都重绘所有静态 Canvas。
- 背景视差/重复/auto-scroll 需要本地变换与 Camera 输入，**不能假设所有 Back 共享普通世界对象的平移函数**；即使变换特殊，Back 的最终宿主仍需占有正确的世界堆叠位置。
- `ms-avatar` 内部只在身体/表情/装备帧变化时重绘局部 Canvas；世界位移由 `ms-world-item` 承担，避免重复合成纸娃娃。
- 资源读取走 LoomRealm Presentation Resource Client；已解码缓存、租约、过期回调和 Window teardown 的释放必须有明确 Owner，不新造平台 AssetManager。
- 小规模 NPC / 静态独立 Obj 不必强制创建 Canvas；能用图片和局部 DOM 完成的场景可直接利用浏览器合成。

## 5. DOM、Shadow DOM、Slot 与堆叠语义

### 5.1 场景根的候选内部结构

~~~html
<ms-scene-view>
  #shadow-root
    <div class="viewport">
      <div class="world-plane"><slot></slot></div>
    </div>
</ms-scene-view>
~~~

LoomRealm WebProjector 独占管理的是 **RenderNode Light DOM 的节点、attrs、data 与 children**。场景根的 Shadow DOM 中的普通 `slot` 只是展示这些直属 Light DOM Paint Units；不可自行拆卸/重排 LoomRealm managed children，或借由 MutationObserver 构建另一份权威拓扑。

候选投影：

~~~html
<ms-scene-view>
  <ms-map-back></ms-map-back>
  <ms-map-batch></ms-map-batch>
  <ms-world-item><ms-avatar><ms-action></ms-action></ms-avatar></ms-world-item>
  <ms-map-object></ms-map-object>
  <ms-map-batch></ms-map-batch>
  <ms-world-item><ms-npc></ms-npc></ms-world-item>
  <ms-world-item><ms-mob></ms-mob></ms-world-item>
  <ms-map-back></ms-map-back>
</ms-scene-view>
~~~

这只是候选静态形状；实际数量、排序和可见性由 Subsystem 的 Render Projection 负责。**必须在真实 Chromium/WebProjector 下验证 slotted 直接子元素、绝对定位 containing block、z-index 和 Shadow DOM 的扁平树叠放效果。**

### 5.2 单一 World Depth Plane，Paint Unit 为可排序同级

- `ms-scene-view` 内部 `viewport` 裁剪，`world-plane` 负责统一 Camera transform。场景平面可以形成**共同** stacking context。
- 所有需要跨类型穿插的 Paint Unit 必须在这个世界深度平面中作为可比较的**同级叠放项**参与排序；不要在其上方新增按实体类型分组且带 `transform / opacity / isolation / contain / z-index` 的封闭 stacking context。
- Avatar 的 `ms-world-item` 是一个整体叠放项；它的 `ms-avatar` Shadow DOM / Canvas 内部可以独立管理装备、身体和局部特效，但这些局部子层不会跨越外层与前景地图 Obj 穿插。
- `ms-npc` 的名称与任务标识如果必须随 Actor 被前景 Obj 遮挡，默认留在 NPC 外层组之内；确有独立深度语义的效果须提升为**另一个同级 Paint Unit**，并由 Subsystem 投影身份和关系。
- `ms-map` 可以存在于非视觉数据模型中，但**不得作为所有地图绘制节点的封闭 z-index 视觉容器**，以免其子节点无法跨父级与 Avatar 交错。

### 5.3 z-index 如何表达 (depth, tieOrder)

不能把原始 `depth` 和 `tieOrder` 直接拼成浮点数、使用 CSS 小数 z-index 或仅依赖 DOM Y 顺序。

建议由 Subsystem Render Projection 给当前 World Paint Units 生成**经确定性排序后的安全整数堆叠序号**（候选 `stack-rank`），同时保留必要的规范化 depth/tie 信息用于审计：

~~~text
CMS079 绘制事实 + 游戏权威 Actor/Foothold state
  → normalize world depth
  → deterministic tie-break
  → ordered Paint Units
  → stack-rank (integer)
  → Custom Element host CSS z-index
~~~

`stack-rank` 是 Adventure Island 的候选业务字段，**不是新增 LoomRealm RenderNode / RenderDomain 字段**。可能使用稀疏序号以减少深度变化时的重编号，但必须保证整数可表示范围与同深度顺序正确；不能承诺单 Actor 变层永远只有一次属性更新。

必须区分：**Subsystem 决定业务呈现顺序；Custom Element 只执行已收到的排序值**。元素不得自己通过查找旁边的 DOM 节点推断 Foothold 或决定谁在前面。

## 6. RenderNode 发布与局部更新

### 6.1 不同更新频率的边界

| 状态变化 | Render 投影候选 | 只需更新的浏览器表面 |
| --- | --- | --- |
| Camera 位置 | `ms-scene-view` existing attrs/data | World Plane transform；静态 Canvas 不必重绘 |
| Player/NPC/Mob x/y | 对应 `ms-world-item` existing attrs/data | 外层 transform；内部 Canvas 保持 |
| Player action/expression | 对应 `ms-avatar` existing attrs / RenderEvent | Avatar AnimationPlayer/局部 Canvas |
| Avatar 换装 | 现有 ms-avatar/action 的受约束更新事务 | 局部组合资源与完整帧提交 |
| NPC 自身换帧 | Renderer-local 视觉播放 | NPC 自己的图片/Canvas |
| Actor world depth 改变 | `ms-world-item` stack-rank | CSS stacking；必要时更新相关批次结构 |
| 普通 Tile/Obj 不变 | 不必发布每 Tile RenderNode | 已缓存 `ms-map-batch` Canvas |
| Region 可见集合变化 | 一次结构 replace 或现有批次数据更新 | 只增删/更新相关静态批次 |
| 短时大量效果 | 表现事件或稳定的批次 retained 状态（需防重放规则） | 相关 effect DOM/Canvas，不全场刷新 |

初版不得用每 Tile/每 Sprite 的 RenderNode 来增加高频 DOM/JSON 成本，也不得假设 LoomRealm WebProjector 对所有无变化节点的宿主属性都完全零写入；需要在真实负载中测量一次 Domain patch 引发的 reconcile 成本。

### 6.2 LoomRealm API 的约束

- `RenderDomain.update()` 用于已有节点的 attrs 和 data 顶层成员，不是任意 children patch。
- 插入/删除/重排 RenderNode children 需 `RenderDomain.replace()` 发布新树；这不等于必须重建所有同身份的 HTMLElement。
- 同一 Domain 的 retained commit 原子，**不等于多个 Custom Element 的 Canvas 解码/绘制在同一帧原子可见**。
- RenderNode key 是同一 Domain 生命周期内的 one-shot 身份。批次拆分后不得删除旧 key 又复用旧 key；新批次有新的 identity，更新已有批次内容则在允许的同一节点 key 下更新 data。
- Presentation Resource 使用 Content 的版本化引用，资源返回时应重新检查当前实例/场景 epoch，不能把旧地图异步图像绘制进新地图。
- RenderEvent 是瞬态的、不保证 replay；持久可见状态必须从 retained RenderNode 恢复。组件的私有播放相位不是游戏业务权威。

## 7. 性能边界：不只追求更少 Canvas

性能指标至少包括：

1. 可见 Paint Unit/Custom Element 数量和更新频率。
2. 可见 Canvas 数、最大单张尺寸、总像素、解码后的图集驻留内存。
3. Camera 滚动时静态 Canvas 重绘次数与 transform/合成成本。
4. 高频 Actor 移动和深度变化时 Render patch、WebProjector reconcile、style/layout/paint/composite 耗时。
5. 场景进入/换图的首个完整画面时间、资源加载/取消、Region 滚动驻留与内存峰值。
6. 多 NPC、多个 Mob、密集 Drop/Effect 的最差情况；不能假设每个独立 Canvas 或每个 DOM 都免费。
7. DPR、像素舍入、图片采样与 CSS transform 的一致性，避免角色与地图相对抖动。

优化的次序：**先保证正确深度插入与可理解的组件边界，后基于真实 profiling 合并/拆分 Canvas**。不要预先把 8 个 Map Layer 固定映射为 8 张 Canvas，也不要把世界强迫合成为 1 张 Canvas。

## 8. 闭环：场景进入、切换、失败和资源清理

- **Subsystem authority**：进入地图时准备确定性的世界呈现投影、scene identity / RenderNode key lifecycle、资源引用和关键 Paint Unit 结构，然后通过同一 World Domain 的更新/替换发布；Simulation 不等待 Canvas 绘制确认来决定 gameplay 结果。
- **LoomRealm**：机械创建/更新/删除当前节点，保证同 live identity 的节点复用与重连语义；不承诺 Canvas 资源已经到达。
- **Business presentation**：各 Paint Unit 验证输入、按需读取 Content、解码、局部缓存和重绘；旧异步回调不得更新当前 epoch 以外的节点。
- **地图转场**：必须定义场景级可见性门闩，避免旧图/新图/部分 Canvas 半成品共同可见。但这只是 Renderer-local presentation gate；不另造全局协议或声称 LoomRealm 提供 ProjectionBatch。其具体 ready 判定、遮罩与失败显示尚待验证。
- **关闭/替换**：Custom Element 解除视觉时钟订阅，取消/忽略未完成资源、释放本地 Canvas/纹理引用；Renderer Window teardown 的资源能力按 LoomRealm 生命周期失效。
- **多 RenderNode 更新**：父子订阅存在混合可观察状态的可能；现有 ms-avatar 使用的 ProjectionBatch 仅是未批准提案，不能在本草案里作为已存在的上游保障。先通过最小真实 WebProjector spike 验证是否需要调整 ms-avatar 的数据组合边界。

## 9. CMS079 剩余证据边界与最小浏览器验证

### 9.1 已闭合与仍需核实的事实

已闭合：

- Tile/Obj key、Avatar 插入 key family；
- keyed ordered-tree comparator 与 equal-key 确定性 secondary key；
- Avatar 149 层局部顺序和 slot occlusion；
- `screen = world - camera` 与 Camera 共享向量；
- Portal 同图/跨图到达位置、速度清零和首次 Movement 重建的主要链条。

仍需核实或由产品决定：

- Back 各类型、Obj flow 和 Portal sprite 的动态方法体及精确时间语义；
- Camera follow cadence/deadzone 和地图边界行为；
- Movement 仍未闭合的状态分支与最终 Simulation Clock；
- Mob/NPC、任务标记、名称、Speech Bubble、Damage Number、LevelUp 和技能效果的完整世界相对层级；
- 一张目标地图所有可达 Actor depth 断点与最终静态 Canvas 数量；不能仅凭 OpenMS 公式推断 Canvas 预算。

### 9.2 必须可复现的 DOM + Multi-Canvas spike

1. 两块静态 Canvas 中间插入独立 Avatar DOM；Avatar 可以从 Obj 前方移到后方而静态 Canvas 无需整张重画。
2. 同一大 Obj 使用独立 DOM 遮挡 NPC；NPC 名称随 NPC 被正确遮挡，不穿透前景。
3. Tile + Obj 混合静态批次，跨可达深度断点正确拆分；检验插入新的深度值时无错误叠放。
4. 不同 worldDepth、相同 depth/tie 的多个实体在增删、深度更新、Region 资源慢加载时保持确定性。
5. Camera 移动只更新公共 World Plane；背景视差/重复仍正确，静态 Canvas 命中缓存。
6. `ms-world-item` 与 `ms-avatar` 的 nested RenderNode 实际在 WebProjector 中更新；Slot、Shadow DOM、CSS stacking context 不隔离所需穿插关系。
7. Map replace、Avatar 换装、Canvas 资源晚到、节点断连/重新连接、Window teardown、unknown tag fail-closed 的正确表现与清理。
8. 同一场景记录 DOM/Canvas 数量、Canvas 总像素、内存峰值、render patch 频次、主线程耗时和每帧绘制成本。

通过这些实验之前，不冻结 `stack-rank` 具体 schema、静态切分算法、Canvas 最大尺寸、paint unit 数量预算或组件注册形态。

## 10. 尚未批准的决定（明确禁止暗中固化）

- 完整 tag 集合、`ms-world-item` 是否单独作为 Custom Element、`attrs/data` exact schema、Dom slot / CSS 具体机制；
- Canvas 2D、图片/CSS 还是 WebGL，静态 Batch Planner 的最终优化算法；
- 按 depth 赋予 z-index 还是发布绝对 stack-rank 的最终编码；
- `ms-avatar` 与 `ms-action` 的现有候选接口是否需要修订，ProjectionBatch 替代方案；
- Renderer-local 时钟、decoded cache 共享边界、场景 ready/转场策略；
- CMS079 尚未覆盖实体类别的深度特例、动态画面时间语义与 Pixel parity；
- 任何 LoomRealm API 扩展、Submodule 升级或旧 `cms-*` 运行时变更。

## 11. 参考资料

### OpenMS（GMS083 行为参考；GPL-3.0，不能复制源码）

- [StreamScene](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/stream-scene.js)
- [EntityAnimation](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js)
- [Field Avatar replacement](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/field-avatar.js)
- [Client depth/camera evidence](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/docs/client-evidence.md)

### LoomRealm（固定版本）

- [Subsystem / Render architecture](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/10-architecture/rendering-system.md)
- [WebProjector implementation](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/packages/renderer/src/internal/web-projector.ts)
- [Web Presentation API v3](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/web-presentation-api-v3.md)
- [Render Update v1](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/render-update-v1.md)

### Adventure Island / CMS079

- [设计总入口与证据标签](../README.md)
- [产品目标与阶段范围](../product/PRODUCT-GOALS.md)
- [Field 内容到画面的投影管线](../architecture/FIELD-PROJECTION-PIPELINE.md)
- [FSDB 内容模型](../content/FSDB-CONTENT-MODEL.md)
- [OpenMS 开发参考与许可证边界](../references/OPENMS-DEVELOPMENT-REFERENCE.md)
- [ms-avatar candidate](./ms-avatar.md)、[ms-action candidate](./ms-action.md)
- [旧 cms-map-layer 设计与样本限制](../../components/cms-map-layer/DESIGN.md)
- [当前设计基线](../../docs/design-baseline/README.md)
- `research/source-of-truth/claims.csv`、`evidence.csv`、`gaps.csv`
