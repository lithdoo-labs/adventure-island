# Field 首阶段 Custom Element 组件树与遮挡关系（Design Draft）

> **状态：PROPOSED / 非规范 / 未批准 / 未冻结 / 未实现。** 本文用于确定阶段范围与组件组合关系，不代表任何标签已经注册、实现或通过测试。
>
> **当前范围假设**：以归档 R1 三图（222000000、222000001、230030200）的 Map / Back / Avatar / Movement / Camera / Portal 可玩闭环为参考，然后以同一结构扩展至 R2 的 13 图。R1/R2 历史路线图现已 NON-NORMATIVE，当前阶段需求仍需单独审批。
>
> 参见 [DOM + Multi-Canvas 世界渲染架构](./WORLD-RENDERING-ARCHITECTURE-DRAFT.md)、[设计基线](../../docs/design-baseline/README.md)。

## 0. ABI V1 文档与状态

本树现在具有可逐项审查的 **RenderNode ABI V1 候选**：共享字段在 [Field Paint Unit ABI V1](./FIELD-PAINT-UNIT-ABI-V1-DRAFT.md)，新增六个组件的 exact attrs/data/children、JSON 示例、更新语义、错误处理分别位于各自文档的 **RenderNode ABI V1** 节。此前已设计完成的 [ms-avatar](./ms-avatar.md) 和 [ms-action](./ms-action.md) V1 **不重新定义、不重写其既有接口**。

共同约定：

- 所有节点仍使用 LoomRealm 的 `key / tag / attrs / data / children` 五字段；`attrs` 仅 string map，`data` 仅 plain JSON。
- `ms-scene-view` 使用 `camera-x` / `camera-y` / `visible`，data 为 sceneEpoch/mapId/pixelSnap；它是唯一 Stage-1 World root，**不是**世界深度排序单元。
- 直属世界 Paint Units 必须拥有全域唯一 `stack-rank`；其它高频属性分别是 `world-x/world-y`（Actor、独立 Obj、Portal）或 `view-x/view-y`（Back）。
- 静态 Atlas/Page 的 ResourceRef 必须带 namespace/key/contentVersion，不能传输私有 URL 或原始 WZ 数据。`ms-map-batch` 是有序 Tile/Obj placement 的安全连续区间，内部不产生独立 DOM。
- `ms-world-item` 首阶段**必须恰好有一个 ms-avatar 直接子节点**；ms-avatar 保留它的 ms-action 数据子树；ms-map-back、ms-map-batch、ms-map-object、ms-portal-visual 的 children 为空。
- 构造时先 context/DOM/attrs 后 data，不能凭 connectedCallback 判断画面 ready；LoomRealm retained commit 不保证多个异步 Canvas 同帧完成，场景可见性门闩仍是待实现的集成问题。

本表是**可审查的接口提案，不等于已经通过 CMS079 验证或浏览器 E2E**。地图深度比较、Back type1–4、Portal phase 和完整场景切换 ready gate 等仍需单独验收。

## 1. 本阶段 8 个候选标签及独立设计文档

| 标签 | 阶段要求 | 设计文档 | 浏览器可见表现 / 最终排序单元 |
| --- | --- | --- | --- |
| `ms-scene-view` | **基础必需** | [ms-scene-view](./ms-scene-view.md) | 场景总根；不作为 World Drawable |
| `ms-map-back` | **基础必需** | [ms-map-back](./ms-map-back.md) | Back 图片/Canvas；独立 Paint Unit |
| `ms-map-batch` | **基础必需** | [ms-map-batch](./ms-map-batch.md) | Tile/Obj 的有限尺寸静态 Canvas；整体参与深度 |
| `ms-world-item` | **基础必需** | [ms-world-item](./ms-world-item.md) | Avatar 外层定位、显隐、stack-rank，独立 Paint Unit |
| `ms-avatar` | **基础必需** | [ms-avatar V1](./ms-avatar.md) | 纸娃娃局部 Canvas；外部由 ms-world-item 排序 |
| `ms-action` | **在现有 Avatar V1 ABI 下必需** | [ms-action V1](./ms-action.md) | Clip 数据子元素，无 Canvas、不参与世界深度 |
| `ms-map-object` | **按独立 Obj/遮挡需求启用** | [ms-map-object](./ms-map-object.md) | 独立图片/Canvas；可在 Avatar 前/后 |
| `ms-portal-visual` | **按可见 Portal 需求启用** | [ms-portal-visual](./ms-portal-visual.md) | Portal 图片/局部 Canvas；业务传送不依赖它 |

其中六项“基础必需”只是**满足现有 ms-avatar/ms-action 候选接口和本阶段场景实验的工作范围建议**，并非必须永远保留六个公共标签。若未来将 Action Clip 合并入 Avatar 的单节点数据，ms-action 的标签必要性应单独调整，不影响动画功能。

已经存在的 [ms-avatar V1](./ms-avatar.md) 和 [ms-action V1](./ms-action.md) 两份候选文档**保持原有字段、状态机与父子关系**；本轮仅为另外六个标签建新文档，不悄悄改动旧 ABI。

## 2. 逻辑树 vs 实际浏览器视觉树

### 2.1 LoomRealm RenderNode 组件树

~~~text
Field Subsystem（Simulation / Foothold / Movement / Camera Intent / Portal）
  └─ World Render Projection（深度及稳定排序、静态批次规划）
       └─ Field World RenderDomain
            └─ ms-scene-view               [必需；单一世界 root]
                 │
                 ├─ ms-map-back             [必需；出现 0..N]
                 ├─ ms-map-batch            [必需；出现 0..N；每个一批静态画面]
                 ├─ ms-world-item           [必需；当前玩家]
                 │   └─ ms-avatar           [必需；一名玩家可独立合成]
                 │       ├─ ms-action       [当前 V1：所需 Action 名]
                 │       ├─ ms-action
                 │       └─ ...
                 ├─ ms-map-object           [可选；只为特殊独立 Obj]
                 ├─ ms-map-batch            [另一 Canvas 区间]
                 ├─ ms-portal-visual        [可选；只有可见 Portal 才创建]
                 └─ ms-map-back             [Front Back/其他 Back]

(可选未来) Screen-space UI RenderDomain
  └─ ms-hud                      [当前阶段不实现]
~~~

**重要**：上图仅表示合法的父子层级和出现条件，兄弟出现顺序不是固定 Z 规则，不意味着所有 Back 在最下、所有 Portal 在最上。可以有多个 ms-world-item、多个 ms-map-batch；当地图没有某类资源时，实例数可以是 0。核心能力来自统一排序，而非固定张数 Canvas。

### 2.2 浏览器 Shadow DOM（概念）

~~~html
<ms-scene-view>
  #shadow-root
    <div class="viewport">
      <div class="world-plane">
        <slot></slot>
      </div>
    </div>
  <!-- 下方 Light DOM 直属子节点由 LoomRealm WebProjector 管理 -->
</ms-scene-view>
~~~

- WebProjector 管理 Light DOM 的真实节点、顺序、attrs、data 与生命周期；slot 只是将直属 Paint Units 呈现进共同的 world-plane。
- ms-world-item 自己的宿主是 World Paint Unit；内部 ms-avatar 的 Shadow DOM + Canvas 只是这个单元的局部内容；ms-action 不绘制。
- 同级的 ms-map-back / ms-map-batch / ms-map-object / ms-portal-visual 只有**宿主层级**参与 world-plane 的 CSS stacking；内部图片或 Canvas 不可跨越其宿主独立穿插别的 World Unit。
- ms-scene-view 的共同 world-plane 可以是 stacking context；不能把“所有地图元素”或“所有 Avatar”包入彼此隔离的父 stacking context。
- `slot` 扁平树、`::slotted`、绝对定位的 containing block、World Plane Camera transform 和 Chromium 层叠行为必须真实集成验证。

## 3. 真实绘制先后：不是固定 Canvas 分类层

OpenMS fixed reference 的场景把 Region、Entity 和 world containers 汇总到统一显示根，按 world depth 和同深度 serial 排序，而不是先画完整 Tile Canvas 再画 Avatar。参考 [StreamScene](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/stream-scene.js)、[深度证据](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/docs/client-evidence.md)。

- 真正参与排序的是**一个 Paint Unit 的外层宿主**（ms-world-item / ms-map-batch / ms-map-object / ms-map-back / ms-portal-visual）。
- World Render Projection 用权威 Foothold layer/group、已经解析的静态 placement 深度、稳定 tie-order 形成全局排序结果；向 DOM 提供可比较的安全整数 stack-rank。
- Avatar 内部装备/身体/头发依据 Avatar 自身 zOrder 和 Slot Occlusion 局部绘制，不能与地图 Obj 在身体部件层级交错。
- 深度更靠前不等于一定遮挡：还必须存在像素重合，且前方像素具有相应不透明度。

### 3.1 示例：一个 Avatar 被部分地图物件遮挡

以下**仅为 OpenMS GMS083 的参考公式演示**，以 `B=-0x40000000` 为共同偏移，表中去掉 B。CMS079 的深度常数、比较方向和同深度初始次序尚未批准。

| 背景 → 前景绘制序列 | 参考值（去 B） | Paint Unit / 遮挡意义 |
| --- | ---: | --- |
| 普通 Back index0 | -128000 | `ms-map-back`，在 Avatar 后 |
| Layer2 Obj z12 | 62012 | `ms-map-batch:A`，在 Avatar 后 |
| Layer2 Tile zM0 / Canvas.z2 | 79992 | 同一静态批次 A，尚无动态插入时可合批 |
| Layer2 active Player group0 | 89997 | `ms-world-item → ms-avatar` |
| Layer3 Obj z14 | 92014 | `ms-map-object` 或 `ms-map-batch:B`，在 Avatar 前 |
| Front Back index0 | 272000 | `ms-map-back`，可遮挡 Avatar |

上表中，同一类 Obj 被分到了玩家前后两个不同的视觉绘制单元。真正的 DOM 层序是：

~~~text
背后（先绘制）
  ms-map-back          ordinary Back
  ms-map-batch:A       Tile + Obj (behind Player)
  ms-world-item        Avatar
  ms-map-object        special front Obj
  ms-map-batch:B       other front static records
  ms-map-back          Front Back
前面（后绘制）
~~~

**同一种 ms-map-batch 可出现多次，而且前后顺序不同。**

### 3.2 同一 Obj 对 Avatar 的前后关系也可能变化

OpenMS GMS083 参考例子（省略 B）：

- Actor 当前 active Player 在 layer2/group0：`29997 + 2*30000 = 89997`。
- Layer3 Obj、z14：`2000 + 3*30000 + 14 = 92014`。
- 因为示例 Obj depth 更前，Obj 的非透明像素能遮挡 Player。
- 如果 Player 随合法的 Foothold 状态切换到 layer3/group0，则 depth 变为 `119997`，Player 会排在同一 Obj 前面。

Renderer 不做 Foothold 碰撞，也不按屏幕 y 自己重算；改变的是 Subsystem 投影出的 Player depth/stack-rank，静态 Obj 不一定需要重绘。

### 3.3 本阶段各标签与 Avatar 的遮挡关系

| 标签 / 内容 | Avatar 前后关系 | 固定吗？ |
| --- | --- | --- |
| 普通 Back（ms-map-back, front=0） | GMS083 参考中通常在 Actor 后 | CMS079 待验证 |
| Front Back（ms-map-back, front!=0） | GMS083 参考中可遮挡 Actor | CMS079 待验证 |
| 静态 Tile/Obj（ms-map-batch） | 可以在 Avatar 前或后；**一个批次整体**排序 | 不能按“地图永远在下”固定 |
| 特殊 Obj（ms-map-object） | 可以在 Avatar 前或后 | 随 Obj / Avatar depth |
| Avatar（ms-world-item） | 相对其他 World Paint Units 参与统一排序 | Foothold depth 可变化 |
| Portal 外观（ms-portal-visual） | 不预设前后，待 CMS079 Portal 视觉证据 | 未冻结；不要默认顶层 |
| ms-avatar 内部 parts、ms-action | **不独立参与**世界排序 | 内部合成 |
| Screen HUD（非本阶段） | 不属于同一世界排序；屏幕空间 UI 另定 | 不应混入 world depth |

## 4. 静态 Canvas 分批的核心约束

一个 ms-map-batch 的所有静态记录必须构成在本阶段**所有可达独立 Paint Unit 深度下都安全的连续绘制区间**；不仅仅在“玩家当前站在这里”的这一帧成立。

例如：

~~~text
静态 Obj depth 62012 ──┐
                       ├─ 可合成 Batch A（若不会插入 depth 70000 的 Actor）
静态 Tile depth 79992 ─┘
            ▲
            └─ 如果 Actor 可能取 depth 70000，则必须拆分区间
~~~

可通过提前分析可达 Actor Foothold depth、静态 placement 深度、独立效果插入点，并按 Region/空间区块再做有界缓存。少量特殊 Obj 可提升为 ms-map-object。

最重要的三点：

1. 一个静态 placement 只能归一个 Paint Unit，禁止同时画在 Batch 和独立 Obj 里。
2. 一个 Canvas 的 CSS z-index 不可能把 Canvas 内部的多个像素层拆给 Avatar 插入。
3. 不按八个地图 layer 固定建立八张 Canvas，也不把整个世界强制放入一张 Canvas。

## 5. 发布、时钟与职责闭环

| 变化 | 权威发起方 | 更新的 RenderNode / 画面 |
| --- | --- | --- |
| Camera 跟随、视口业务意图 | Field Subsystem | ms-scene-view；world-plane 的 Camera transform |
| Player x/y、Foothold depth | Field Subsystem | ms-world-item 的位置及 stack-rank |
| Player action / facing / 表情 | Field Subsystem | ms-avatar 的保留状态及视觉播放器 |
| ms-avatar 局部帧变化 | Renderer-local Render Clock | 只重绘 ms-avatar Canvas；不修改 Simulation |
| 静态 Tile/Obj/Back 内容 | Map Content / Render Projection | ms-map-batch / ms-map-back / ms-map-object |
| Portal 可见状态 | Field Subsystem visual projection | 有需求时 ms-portal-visual；不决定传送 |
| Up 触发、tm/tn、到达、cooldown | InputGate → Field Subsystem | 不需要任何 Portal DOM 触发处理 |
| 结构增删/批次拆分 | Field Subsystem Render Projection | RenderDomain.replace；LoomRealm 托管 DOM |
| 已存在节点局部 attrs/data | Field Subsystem Render Projection | RenderDomain.update |
| 场景加载资源、解码和 Canvas paint | Renderer-local Custom Element | 不回写游戏 state；过期异步结果失效 |

Simulation Clock **仅属于 Subsystem**。Renderer-local Render Clock 只负责视觉。现有 [ms-avatar](./ms-avatar.md) 的时钟和 [ms-action](./ms-action.md) 的 Clip 合约不在本次修订中修改。

**事务边界**：LoomRealm 同一 Domain 的 retained 状态提交，不等于多个 Custom Element 的图像已解码或已同帧完成绘制；必须验证场景可见性门闩、换图失败行为及旧 epoch 资源回调。不得假设已有跨组件 ProjectionBatch。

## 6. 本阶段需求、非目标和验证计划

### 6.1 三图切片的功能边界（参考旧 R1，非批准）

- 三图：222000000（陆地）、222000001（陆地，Tile group 状态要审计）、230030200（水图）。
- 必须展示 Map、Back、Tile/Obj、Avatar；可移动、跳跃/落地、水下游泳、Camera 跟随、经 InputGate 的 Portal 双向传送、失败回滚。
- 这些功能中 Foothold、Movement、Camera 决策、Portal trigger 均在 Subsystem；不因其有业务功能就新增视觉 Custom Element。
- 基础 Portal 功能不强制 ms-portal-visual：**仅可见资源确有要求时**才需要显示节点；静态帧优先。
- R2 13 图优先复用相同组件结构，另做资源/深度/背景类型覆盖，不能自动宣称所有 Back type/Obj flow 都支持。

### 6.2 明确不在本阶段实施

- `ms-npc`、`ms-mob`、`ms-reactor`、`ms-map-animation`、`ms-world-effect`、`ms-effect-batch`、`ms-hud` 暂时不在首阶段实现范围。
- 当前也不批准独立 `ms-drop`、`ms-projectile` 等标签。后续根据真正的深度与更新规模选择 DOM 或批次。
- 不建立 `ms-map`/`ms-npc-collection`/`ms-mob-collection` 为整类世界绘制对象的 stacking 容器。
- 不使用旧 `ms-world-layer`/`ms-entity` 注册机制，不在业务侧伪造 LoomRealm 上游 API。

### 6.3 进入实现前的检查

1. **真实 DOM 层级**：用 LoomRealm pinned WebProjector 投影 ms-scene-view + slot + 多个 sibling Paint Units，验证 stacking、absolute positioning、Shadow DOM、Canvas。
2. **核心遮挡**：同一地图中 Avatar 在前/后 Obj 间切换，Front Back 与普通 Back 的真实前后层级；不依赖 Y-sort。
3. **Canvas 不重复重绘**：Camera / Avatar x/y 改变时静态 Batch 不全场重画；Avatar 自身动作帧只改其局部 Canvas。
4. **静态批次规划**：使用 CMS079 目标地图检验可达深度断点、批次数量/Canvas 总像素和动态插入策略；CMS079 depth/tie 未验证不得冻结。
5. **资源及失败**：异步 Map/Avatar decode、资源缺失、Portal 切图失败、同图跳点、sceneEpoch、组件重连、Window teardown。
6. **浏览器验证**：PWA 与 Hostra 两端相同注册、浏览器截图/像素对照、布局/合成/内存预算与可复现 E2E。

## 7. 设计状态和资料来源

本阶段由 8 个**候选标签**组成：6 个基础必需（其中 ms-action 的必要性依赖当前 Avatar V1 结构）+ 2 个按内容需求启用。只有 ms-avatar / ms-action 已有详细、可审查的 V1 单组件草案；本次新建的六份组件文件与本树均是**未批准的首阶段提案**，不是正式 RenderNode ABI。

- [现行设计基线](../../docs/design-baseline/README.md)
- [旧 R1/R2 需求路线图（已归档）](../../docs/product-first/IMPLEMENTATION-ROADMAP.md)
- [OpenMS GMS083 depth evidence](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/docs/client-evidence.md)
- [LoomRealm pinned WebProjector](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/packages/renderer/src/internal/web-projector.ts)
