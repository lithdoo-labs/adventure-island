# World Rendering Architecture — OpenMS-guided Draft

> **状态：讨论草案（Draft for discussion）。未批准、未冻结、非规范、未实现。**
> 本文用于继续讨论新一代场景呈现架构，不替换 **ms-avatar / ms-action** 候选设计，也不授权修改旧 **cms-\*** 运行路径。
> **核心假设：组件语义树与世界绘制树必须分离。** 所有需要相互遮挡的世界对象进入同一个 World Display List，由统一的 World Depth Resolver 和 Compositor 决定最终顺序。

## 1. 问题与设计目标

冒险岛地图不是“背景层 → Tile 层 → Obj 层 → 角色层”的固定叠层。地图 Tile、地图 Obj、前景 Back、玩家、Mob、NPC、Drop 和部分 Effect 可能在同一深度空间中交错。角色还会随当前 Foothold 的 layer/group 改变深度；NPC 名称等附属元素又需要跟随所属 Actor，而不是无条件置顶。

因此，按组件类型各自绘制到独立 Canvas，再按固定顺序叠加，会丢失跨类型遮挡关系。仅按屏幕 Y 排序也不成立。

本草案的目标：

1. 组件树表达数据所有权、生命周期和业务语义，不决定世界像素绘制顺序。
2. 地图 Placement 与动态 Actor 保留可独立排序的 Renderable 身份。
3. 所有需要相互遮挡的对象进入同一个世界深度排序空间。
4. 深度计算由独立 Resolver 负责；不把 OpenMS 的 GMS083 公式直接当成 CMS079 事实。
5. 保留批量绘制优化空间，但批处理不得破坏对象之间的深度插入点。
6. 与固定版本 LoomRealm 的真实 Web Presentation 能力相容，不虚构上游 API。

非目标：本草案不定义 Movement、Foothold 物理、碰撞、Mob AI、Portal 业务规则、完整资源 ABI、最终 Canvas/WebGL 后端，也不批准任何新组件接口。

## 2. OpenMS 参考事实

参考仓库：[tensorfish/openms](https://github.com/tensorfish/openms)，固定参考提交 [07994de02756356e3e025e3aca9e79433898d2c8](https://github.com/tensorfish/openms/tree/07994de02756356e3e025e3aca9e79433898d2c8)。OpenMS 参考路径为 GMS083 时代客户端逆向与实现，**不是 CMS079 的规范来源**。

### 2.1 StreamScene：统一场景显示列表

关键实现：

- [client/src/rendering/stream-scene.js](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/stream-scene.js)
- [client/src/rendering/animation.js](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js)
- [client/src/character/field-avatar.js](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/field-avatar.js)

OpenMS 的 StreamScene 使用统一的 PixiJS 根 Container。场景刷新时收集 actor region、已加载 region 和动态 Entity，将 Entity Container 按 **container.zIndex**、再按 **container.depthOrder** 排序，然后放入同一个根容器。地图对象与角色不是各自固定在独立的最终叠层中。

EntityAnimation 为一个 Entity 持有独立 Container；Container 的 zIndex 来自 Entity 深度，depthOrder 来自稳定顺序字段。角色内部的身体、头发、脸、武器和装备 Sprite 则留在该角色 Container 内部，由角色自己的 Painter 处理。

角色深度变化时，**setEntityDepth()** 更新 Entity 的深度和顺序序号，并同步移动逻辑 Entity 列表及实际显示列表中的 Container。它不是每帧对全部对象重新排序，也不是按 Y 坐标排序。

StreamScene 还允许注册独立 world Container，并在场景刷新时保留、重新加入和统一排序。只有诊断几何等明确的检查覆盖层才使用始终置顶的 overlay。角色替换时，field-avatar.js 保留原 Container 的深度、顺序和显示位置，并迁移附属 presentation children。

### 2.2 OpenMS 逆向得到的深度规则

OpenMS 的 [docs/client-evidence.md](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/docs/client-evidence.md) 记录了 GMS083 深度表达式。令 **B = -0x40000000**；该证据将更大的深度解释为更靠后的绘制层级（实际视觉前后关系应按其 Renderer 约定理解）。

| 对象 | GMS083 参考深度表达式 |
|---|---|
| Tile | **B + 19990 + layer*30000 - tile.zM*10 + tileCanvas.z** |
| Obj | **B + 2000 + layer*30000 + obj.z** |
| Back（front=0） | **B - 128000 + index*1000** |
| Front Back（front!=0） | **B + 272000 + index*1000** |
| 普通 Mob | **B + 29991 + (layer*3000-group)*10** |
| NPC | **B + 29995 + (layer*3000-group)*10** |
| 本地玩家 | **B + 29992 + (activeController ? 5 : 0) + (layer*3000-group)*10** |
| Drop | **B + 29999 + (layer*3000-group)*10** |
| Combat Number / MISS / LevelUp | **B + 398500** |

这些规则至少证明：Tile 的 zM 带负向乘数，且必须保留 Tile Canvas 的 z；Obj 使用自己的 placement z；前景 Back 可以位于 Actor 前方；Player、Mob、NPC、Drop 的深度存在不同偏移；世界深度不是简单的 Y。

OpenMS 的证据还记录：

- 同深度不是按世界 Y 排序。原版 Renderer 比较相关 Overlay ancestor 的深度，再比较 Renderer serial。
- 静态对象的初始顺序使用 authored extraction order；原生客户端最初创建顺序仍有未证明之处。动态插入或深度变化会获得新的递增 serial。
- 玩家 Foothold 指针位于独立字段；普通跳跃期间保留最近接触的 layer/group。初始未接触时有单独默认处理。
- 普通 Mob 公式有 controller mode、Boss 模板等特殊分支，不能把普通公式推广到所有 Mob。
- 普通 NPC name/function overlay 使用相对深度，并挂在 Actor layer 内；它不应穿透更高的地图/前景 artwork。
- Damage/MISS 等事件使用独立 world root，避免同一永久容器中的插入顺序错误。

以上均是 OpenMS/GMS083 参考事实。**本项目不得直接复制其 GPL-3.0 源码，也不得将这些常数或特殊分支未经 CMS079 验证写入新实现。** 可独立实现经过验证的行为，并记录来源与证据链。

## 3. CMS079 现有证据与边界

本仓库旧地图组件资料 [components/cms-map-layer/DESIGN.md](../../components/cms-map-layer/DESIGN.md) 记录了有限 CMS079 样本中的字段：

- Tile placement：x/y/u/no/zM；Tile 资源画布另有 z。
- Obj placement：x/y/z/f/zM，其中 Obj z 与 Tile Canvas z 不是同一字段。
- 该文档记录的旧加载键为：
  - **tileKey = canvasZ + 10 * (layer * 3000 - zM) - 1073721834**
  - **objKey = layer * 30000 + z - 1073739824**
- 旧文档明确指出：比较方向、相同键次序仍待逆向；旧 MVP 没有把人物插入 Obj 深度带。
- 该地图字段审计覆盖 21 张实质地图样本，不代表整个 CMS079 客户端。

这些记录是需要保留和复核的 CMS079 证据，不等于已经得到完整的跨对象绘制契约。尤其不能只把旧 tileKey / objKey 套入新 Renderer：还需要确认其与角色、Foothold、Front Back、NPC、Mob、Drop 的共同数值空间、比较方向和 tie-break 规则。

CMS079 的 WZ→FSDB 转换报告还记录了未解码项和已确认的转换遗漏。任何地图字段结论必须标注样本范围、来源和缺口，不得宣称全客户端无损覆盖。

## 4. 两套树：语义组件树与 World Display List

### 4.1 Semantic Component Tree

这是 LoomRealm RenderNode 表达的业务/呈现组件关系，回答“谁拥有数据、资源和生命周期”。以下只是候选组织，不是已批准的 tag ABI：

~~~text
Field World RenderDomain
└── ms-field-scene
    ├── ms-map
    ├── ms-avatar
    │   ├── ms-action
    │   └── ms-action
    ├── ms-mob-collection
    ├── ms-npc-collection
    ├── ms-reactor-collection
    ├── ms-portal-collection
    ├── ms-drop-collection
    ├── ms-projectile-collection
    ├── ms-effect-collection
    └── ms-speech-collection

HUD RenderDomain
└── ms-hud
    ├── ms-status-panel
    ├── ms-exp-bar
    ├── ms-hotbar
    ├── ms-chat
    └── ms-minimap
~~~

Collection 是数据/生命周期管理边界，不代表它的所有成员要合并成一个最终绘制对象。ms-mob-collection 可以拥有多个 MobVisual，每个 MobVisual 分别注册自己的 Renderable。

### 4.2 World Display List

这是 ms-field-scene 内部维护的绘制对象集合，不是第二套 LoomRealm RenderNode，也不要求每个 Placement 创建 DOM 元素：

~~~text
WorldDisplayList
├── BackRenderable[]
├── TilePlacementRenderable[]
├── ObjPlacementRenderable[]
├── AvatarRenderable
├── MobRenderable[]
├── NpcRenderable[]
├── ReactorRenderable[]
├── PortalRenderable[]
├── DropRenderable[]
├── ProjectileRenderable[]
├── WorldEffectRenderable[]
└── ActorAttachedRenderable[]
~~~

所有需要互相遮挡的对象进入同一排序空间。RenderNode 的父子顺序、组件注册顺序、Collection 类型和 DOM 顺序都不能代替 World Depth Resolver。

### 4.3 Renderable 的概念字段

以下是讨论模型，不是最终 TypeScript ABI：

| 字段 | 意义 |
|---|---|
| id | 稳定的显示对象身份；不能依赖数组下标或网络完成顺序 |
| kind | Back / Tile / Obj / Avatar / Mob / NPC / Drop / Effect 等类别 |
| owner | 负责该对象资源与生命周期的组件/子系统 |
| depth | Resolver 产生的、可跨类别比较的世界深度 |
| tieOrder | 同深度时确定性排序的次序 |
| transform | 世界位置、朝向、缩放等显示变换 |
| root | 该对象在 Compositor 中的绘制根或绘制批次句柄 |
| visibility | 当前可见性与生命周期状态 |

不得将角色内部的身体部件拆成世界级 Renderable。ms-avatar 先在自身局部空间完成纸娃娃布局、zOrder 和 slot occlusion，再以一个完整 Avatar Group 进入 World Display List。

## 5. 候选组件职责

| 候选组件 | 职责 | 进入 World Display List 的粒度 |
|---|---|---|
| ms-field-scene | Camera、世界坐标变换、Region 呈现驻留、Display List、Depth Resolver、Compositor | 不把整个场景压成一个不可交错的绘制层 |
| ms-map | 地图资源与 Placement 数据、地图区域和静态对象生命周期 | Back、Tile placement、Obj placement 按可遮挡粒度分别注册 |
| ms-avatar | 角色纸娃娃合成、动作、表情、装备内部遮挡 | 每个角色一个完整组合组 |
| ms-mob-collection | Mob 视觉实例的创建、更新和释放 | 每个 Mob 一个独立组 |
| ms-npc-collection | NPC 动画、附属标识和实例生命周期 | 每个 NPC 一个独立组；附属标识按 Actor 规则处理 |
| ms-reactor-collection | Reactor 状态对应的视觉呈现 | 每个 Reactor 独立组；深度规则待 CMS079 验证 |
| ms-portal-collection | Portal 可见呈现 | 每个可见 Portal 独立组；逻辑目标不等于必须绘制 |
| ms-drop-collection | Drop 图像、动画与世界位置 | 每个 Drop 独立组 |
| ms-projectile-collection | 飞行物及其轨迹视觉 | 按独立飞行物/效果身份排序 |
| ms-effect-collection | 世界位置效果、Actor 附属效果、战斗数字等 | 按效果语义选择 Actor-relative 或独立 world root |
| ms-speech-collection | NPC/Actor 对话气泡 | 独立管理生命周期与锚点；具体深度策略待验证 |

### 5.1 Map 不得以整层 Canvas 丢失深度插入点

ms-map 可以批量管理 Tile 和 Obj，也可以使用视口尺寸的 Canvas / GPU batch，但不能把所有 Tile 或所有 Obj 无条件合成一张不可拆分的世界大图，再把它作为单个 Renderable。否则 Avatar 无法插入地图 Placement 之间，前景 Obj 也无法正确遮挡角色。

允许的优化方向是：先按真实绘制顺序形成 Display List，再只合并**排序后连续、且中间不需要其他 Renderable 插入**的绘制项。批次必须保留足够的深度和身份信息，以便深度变化时拆分或重建。

### 5.2 Actor 附属对象不能一律置顶

NPC name/function、Quest Marker、Speech Bubble、Damage Number、LevelUp 和技能效果不是同一种 Overlay：

- 跟随 Actor 的标识应锚定 Actor，并按经验证的相对深度/变换处理。
- 世界位置效果应有自己的 world depth 和生命周期。
- 需要穿过地图前景的 HUD 才进入独立 UI/HUD 层。
- 不得因为方便就把所有名称、气泡、伤害数字和效果塞进永远置顶的全局 Overlay Canvas。

OpenMS 的 NPC label 与独立 Damage/MISS root 仅作为分类参考；CMS079 的具体规则仍需验证。

## 6. World Depth Resolver

WorldDepthResolver 是新架构的关键边界。它把各来源的原始事实转换成统一可比较的 depth + tieOrder，不负责物理计算，也不通过屏幕 Y 猜测遮挡。

### 6.1 输入

- 地图：map layer、Tile 的 zM、Tile Canvas z、Obj placement z、Back front 和顺序字段。
- Actor：当前位置对应的 Foothold contact layer/group、Actor 类型、必要的控制器/状态标志。
- 其他对象：各自经过 CMS079 证据确认的深度输入。
- 稳定次序：静态 authored placement 顺序、动态创建/深度变更序号及必要的局部次序。

Resolver 只消费 Field Runtime 已确定的 Foothold 接触事实；不自己实现 Foothold 求交、移动、跳跃或碰撞。

### 6.2 输出与排序要求

1. 所有参与世界遮挡的对象必须映射到同一个可比较深度空间。
2. 明确并冻结“深度增大”对应的前后关系，避免不同类别各自解释。
3. 深度相同必须有确定 tie-break；不能退化为 Y-sort、DOM 顺序或网络加载完成顺序。
4. 静态地图对象的 tie seed 应由稳定的源顺序/提取顺序产生；Region 异步加载先后不得改变画面。
5. 动态对象插入或深度改变时，是否分配新 serial、是否保留旧 tieOrder，需通过 CMS079 证据和画面验收确定。
6. Actor 在 Foothold layer/group 改变时更新深度；跳跃期间是否保留最后接触的 layer/group、初始无接触的默认值，必须以 CMS079 验证。
7. 各类对象的特殊深度偏移必须逐类证明。不得把普通 Mob 规则推广到 Boss、特殊 Controller、Reactor 或 Effect。

### 6.3 当前不冻结的内容

本草案不冻结任何 CMS079 深度常数、偏移、比较方向、tie-break、Foothold 默认值、特殊 Mob 规则或前景 Back 规则。OpenMS 表格仅作为待验证假设来源。

## 7. World Compositor 与场景生命周期

候选数据流：

~~~text
LoomRealm RenderNode Tree
        │
        ▼
Adventure Island component adapters
        │ register / update / remove
        ▼
World Display List
        │
        ▼
World Depth Resolver
        │ depth + tieOrder
        ▼
World Compositor
        │
        ├── Camera / world-to-screen transform
        ├── stable ordering
        ├── safe contiguous batching
        └── viewport clipping / presentation
~~~

ms-field-scene 持有统一世界呈现根。Map、Avatar、Mob、NPC 等子系统注册、更新和注销自己的 Renderable；Compositor 统一排序后输出。组件拥有的资源和对象生命周期仍由各自 owner 管理，场景负责协调注册与最终绘制，不应无故夺取资源所有权。

Region streaming 只改变对象驻留集合，不改变静态对象的 authored tie seed。Region 卸载时注销其 Renderable；动态 Actor 的深度更新应能增量维护排序列表与实际显示顺序。是否采用全量排序、局部插入、平衡树或其他数据结构属于性能设计，须在真实规模测量后决定。

Camera 负责世界到屏幕的变换和视口裁剪，不参与对象深度语义。超大地图不应默认生成一张全世界尺寸 Canvas；先采用视口级绘制和可验证的资源预算，再根据测量决定空间分块。

## 8. LoomRealm 固定版本的集成边界

本分支 LoomRealm 固定在 [93648192323bf5f57996b7b54cbae641d8a53fdb](https://github.com/lithdoo/loom-realm/tree/93648192323bf5f57996b7b54cbae641d8a53fdb)。

固定版本的 [WebPresentationContext](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/packages/renderer/src/internal/web-projector.ts) 提供 resources 和 emitCustomEvent()；WebProjector 还向元素交付 receiveRenderContext()、receiveRenderData() 和 receiveRenderEvent()。它没有提供可直接注入子组件的 WorldRenderer、WorldDisplayList 或 Renderable 注册 API。

WebProjector 保留 RenderNode 的 DOM 父子关系，并按当前投影拓扑放置根元素；这不等于提供跨多个 RenderDomain 的扁平游戏世界 Display List。需要相互穿插的地图与 Actor 绘制对象不能仅靠多个独立 Domain 的根顺序实现。

因此：

- 暂以一个 Field World RenderDomain 承载需要互相遮挡的世界组件作为讨论方向；HUD 等不参与世界遮挡的界面可另设 Domain。
- World Display List 是 Adventure Island 内部呈现机制，不是新增 LoomRealm 公共字段。
- 组件间注册协议、父子协作方式、绘制根挂载点尚未决定。必须基于固定版本真实能力设计并做集成测试。
- 不得声称 LoomRealm 已提供 WorldRenderer、ProjectionBatch 或全局 Renderer 单例；不得因草案需要而静默升级 Submodule。
- 若最终确需上游新增能力，应作为单独的 LoomRealm 集成提案审查，而不是在业务组件中伪造平台 API。

## 9. 与现有 ms-avatar / ms-action 的边界

现有 [ms-avatar.md](./ms-avatar.md) 的角色内部锚点布局、zOrder、slot occlusion、动作播放和资源管理仍是局部角色合成职责。ms-avatar 不负责地图 Obj 与角色之间的世界深度排序。

本草案只要求 Avatar 在合成完成后向场景提供一个完整、可定位、可参与世界排序的 Renderable Group。具体是 Canvas、纹理、DOM 内部绘制根还是其他 surface，尚未决定，必须结合 LoomRealm 投影生命周期、资源所有权和目标浏览器测试确定。

ms-action 仍只是 Action Clip 数据子组件，不进入 World Display List。

本草案不修改这两份文档的字段、状态机或父子 ABI。

## 10. 关键待验证问题

| # | 问题 | 需要的证据 / 验收 |
|---|---|---|
| 1 | CMS079 Tile / Obj / Back 的深度公式、比较方向与前后关系是什么？ | 原始 CMS079 客户端静态/动态路径、WZ 样本、可复现的遮挡场景 |
| 2 | 旧 tileKey / objKey 与跨对象深度空间如何对应？ | 复核旧加载键、排序比较器、Tile Canvas z、Obj z 与 Actor 深度 |
| 3 | Player 的 Foothold layer/group 如何决定深度？ | 平地、斜坡、跳跃、下落、初始无接触和跨 Foothold 场景 |
| 4 | Mob、NPC、Drop、Reactor、Portal、Projectile 的深度是否各异？ | 逐类源码/数据证据；普通 Mob 与 Boss/特殊 Controller 分开验证 |
| 5 | Back front、Obj、Tile 能否互相穿插？ | 前景树、屋檐、桥体、平台、遮挡角色的像素级样本 |
| 6 | 同深度时采用什么稳定 tie-break？ | 静态源顺序、动态插入、深度变化、Region 异步加载/卸载回归 |
| 7 | NPC 名称、Quest Marker、Speech Bubble、Damage Number 如何归属？ | 跟随、翻转、前景遮挡、独立事件重叠的画面测试 |
| 8 | LoomRealm 固定版本下如何安全注册与释放 Renderable？ | WebProjector 实际集成 spike；不得依赖未提供的 API |
| 9 | Canvas / WebGL batching 的安全边界和预算是什么？ | 目标地图、最大可见对象数、内存、帧时、重建成本测量 |

## 11. 最低视觉验收矩阵

新 World Renderer 在进入实现批准前，至少需要以下可复现画面测试：

- 角色在同一棵树、柱子或建筑前后移动，前景 Obj 能正确遮挡身体，而不是整层压在角色前或后。
- 角色与 Tile / Obj 交错；不能只验证角色永远位于地图上方或下方。
- 角色从不同 Foothold layer/group 经过，包含斜坡、跳跃、下落和重新接触。
- 两个 Mob 分处同一前景对象的前后，彼此深度独立。
- NPC 的名称/功能标识跟随 NPC，但不会穿透更高的地图前景。
- Front Back 确实可以遮挡 Actor；普通 Back 仍保持正确背景关系。
- Drop、Projectile、Damage Number、MISS、LevelUp 和世界 Effect 分别验证所属深度平面。
- 同深度多个对象的顺序在刷新、异步 Region 加载、卸载和动态更新后保持确定。
- Avatar 换装/替换不丢失世界深度、显示顺序和 Actor 附属 presentation。
- 视口移动、跨 Region 和资源慢加载不产生整层闪烁、错误遮挡或永久置顶对象。

测试应保留原始输入、地图/对象身份、期望前后关系和截图/像素差异。不能只以“看起来差不多”验收。

## 12. 明确不做的决定

本草案当前**没有**决定：

- 最终 RenderNode tag 名称、attrs/data schema 和 Collection ABI；
- 最终 World Display List 数据结构及排序复杂度；
- CMS079 深度常数和 tie-break 规则；
- 是否每个 Placement 使用独立 Sprite、Container、Canvas 还是 GPU instance；
- Avatar 的最终输出 surface；
- Effect、Speech、Nameplate 的全部具体深度规则；
- 组件注册协议或 LoomRealm 上游改动；
- 新 Scene 的生产入口、Camera、资源缓存和 Render Clock ABI。

这些内容必须在证据审计、架构取舍和可复现验收后分别决策。

## 13. 参考资料

### OpenMS（GMS083 参考；GPL-3.0，仅作行为证据，不复制源码）

- [StreamScene](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/stream-scene.js)
- [EntityAnimation](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js)
- [Field Avatar replacement](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/field-avatar.js)
- [Client evidence: Map draw ordering / Camera / backgrounds](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/docs/client-evidence.md)

### Adventure Island / CMS079

- [Legacy cms-map-layer design and sample limitations](../../components/cms-map-layer/DESIGN.md)
- [CMS079 client inventory](../../docs/cms079-shared-inventory.md)
- [Design Baseline Reset](../../docs/design-baseline/README.md)

### LoomRealm（本分支固定版本）

- [WebProjector implementation](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/packages/renderer/src/internal/web-projector.ts)
- [Web Presentation API v3](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/web-presentation-api-v3.md)
