# Field 内容到画面的投影管线

> **状态：架构候选 / NOT APPROVED。**
> 本文定义职责和数据流，不冻结最终 TypeScript schema、Canvas 数量、`stack-rank` 编码或产品时钟参数。
>
> **M2 实测（2026-11-18）：** [`components/ms-map-adapter/`](../../components/ms-map-adapter/) 已对 `222000000` 实现纯数据管线 `MapFacts → ResolvedMapScene → OrderedDrawable[] → PaintUnitPlan[] → RenderNode candidate`，证据见 [M2-ADAPTER-EVIDENCE.md](../roadmap/M2-ADAPTER-EVIDENCE.md)。该实现不批准生产 ABI、Back type1–4 布局、Portal 视觉深度或 Canvas 预算。

## 1. 为什么需要独立投影层

FSDB、Subsystem state 和 Renderer component 解决的是不同问题：

- FSDB 保存“源内容是什么”；
- Subsystem 保存“当前游戏世界是什么状态”；
- Render Projection 决定“当前权威状态应呈现为什么树”；
- Component 决定“收到已解析呈现状态后怎样画”。

如果组件直接读取 FSDB，它就必须理解 WZ 路径、UOL、Foothold、Portal target、世界排序和缺失语义，Renderer 会变成第二个业务系统。投影层用于阻止这种泄漏。

## 2. 总体数据流

```text
[FSDB]adventure
  map records / avatar records / resources / physics
        │ Content API
        ▼
Content Loader
  验证存在性、记录形状、资源闭包
        │
        ▼
Adapter / Resolvers
  关联 placement 与 frame
  解析 Avatar action / origin/anchors / occlusion metadata
  计算 CMS079 source sort key 与稳定 source identity
        │
        ▼
Field Runtime State
  mapId / player / movement / contacts / camera / portal travel
        │
        ▼
Render Projection
  Paint Unit order / static batches / RenderNode identities
        │ RenderDomain replace/update/emit
        ▼
Renderer Store → WebProjector → Custom Elements
        │
        ▼
Shadow DOM / local Canvas / resource decode / visual animation
```

## 3. 内容加载阶段

内容加载只从 Content capability 读取逻辑 namespace/key，不把文件路径或 URL 暴露给业务和组件。

加载结果至少应区分：

| 状态 | 含义 | 处理方向 |
| --- | --- | --- |
| `SOURCE-PRESENT` | 源 group/record 存在并可解析 | 继续验证 |
| `SOURCE-EMPTY` | 源节点存在但无记录 | 合法空集合或按产品规则处理 |
| `SOURCE-ABSENT` | 源节点本来不存在 | 不自动补空记录 |
| `RESOURCE-MISSING` | 记录引用的逻辑资源不存在 | 内容闭包失败 |
| `UNSUPPORTED` | 内容真实存在但当前产品未实现 | 阻止发布或显式降级 |

缺文件不能在没有 manifest/导入证据时自动解释为空集合。

## 4. Adapter 输出原则

Adapter 可以解释 FSDB 关系和 CMS079 数据，但不拥有当前游戏状态。

### 4.1 地图 Drawable

候选中间记录：

```ts
interface ResolvedMapDrawable {
  stableId: string;
  sourceKind: "back" | "tile" | "obj" | "portal-visual";
  sourceOrder: number;
  worldX: number;
  worldY: number;
  sortKey: number;
  tieKey: string | number;
  bounds: { x: number; y: number; width: number; height: number };
  frames: readonly ResolvedFrame[];
  updateClass: "static" | "local-animation" | "camera-relative";
}
```

这只是说明所需信息，不是冻结 ABI。关键要求：

- placement 必须保留稳定 source identity 和 source order；
- placement 与 TileFrame/ObjFrame/BackFrame/HelperFrame 的关联在 Renderer 之前完成；
- sortKey 和 tieKey 由投影侧计算并可审计；
- component 不接收原始 WZ/UOL 路径；
- resource 使用 `{namespace,key,contentVersion}` 逻辑引用。

### 4.2 Avatar appearance

Avatar Adapter 负责：

- 从选中 Part 解析 action/frame；
- 处理 redirect 和 weapon stance；
- 输出已解析的 origin/anchors 和锚点依赖顺序；
- 计算并输出 zmap 绘制顺序；
- 根据 islot/vslot/smap 导出 priority/tag 等遮挡 metadata；
- 输出当前角色实际需要的有限动作和逻辑资源矩形。

`ms-avatar` 不读取 `avatar.Part`、`avatar.PartFrame` 或 `avatar.Resource` 表，也不根据装备编号自行查内容；它根据 render-ready origin/anchors、zOrder、priority/tag 在局部 Canvas 中执行布局、遮挡和绘制。

## 5. 世界排序

### 5.1 CMS079 已闭合事实

当前 source-of-truth 已提供：

- Tile key：`z + 10*(layer*3000-zM)-1073721834`；
- Obj key：`layer*30000+z-1073739824`；
- ordered-tree comparator 与 equal-key 确定性二级比较；
- Avatar 插入 key 与 Tile/Obj 使用同一 `-2^30` key family；
- Avatar 局部 zmap/smap 顺序与世界顺序相互独立。

这足以支持“所有世界 Paint Unit 进入同一确定性序列”的架构结论，但不自动决定 CSS `z-index` 的具体编码。

### 5.2 投影步骤

候选流程：

```text
FSDB source facts
  → CMS079 normalized depth key
  → deterministic tie key
  → ordered drawable records
  → Paint Unit partition
  → ordered Paint Units
  → safe integer stack-rank / authoritative sibling order
```

Renderer 只消费最终排序结果，不能读取 Foothold 或 sibling DOM 再做 y-sort。

## 6. Static Batch Planner

Static Batch Planner 属于内容准备或 Render Projection，不属于 `ms-map-batch` Custom Element。

### 6.1 安全条件

一个静态 Canvas batch 中的记录必须在最终绘制序列中连续，并且所有首阶段可达的独立 Paint Unit 都不需要插入其内部。

```text
drawable A
drawable B
dynamic actor insertion point
drawable C
```

不能把 A/B/C 画进同一个 Canvas 后只修改 Canvas 的 CSS z-index；至少需要在 Actor 插入点拆分。

### 6.2 切分维度

候选切分顺序：

1. 先按完整世界顺序排列；
2. 在可达动态深度插入点切开；
3. 再按 region、资源驻留和 Canvas 像素预算切分；
4. 为每个 batch 产生独立 identity、world bounds 和 placement list；
5. 通过真实 profiling 调整，而不是预设固定 Canvas 数量。

### 6.3 不变量

- 一个 placement 只能属于一个 Paint Unit；
- batch 内绘制顺序必须完整确定；
- 异步资源到达不能改变排序；
- batch 分裂后新节点使用 fresh key；
- Camera 移动不重新规划 batch；
- Canvas 大小与数量是性能选择，不是地图 layer 数量的直接映射。

## 7. Field Runtime 权威状态

候选最小状态域：

```text
FieldState
├─ mapId / scene identity
├─ PlayerState
│  ├─ position / velocity
│  ├─ facing / pose intent
│  └─ appearance selection
├─ MovementState
│  ├─ mode
│  ├─ foothold / rope / seat contacts
│  └─ layer / group / environment
├─ CameraState
│  ├─ camera position
│  └─ viewport-derived intent
└─ PortalTravelState
   ├─ selected portal / target
   ├─ prepare token
   └─ phase / failure
```

实际 schema 尚待批准，但这些状态必须在 Subsystem 一侧，而不是 DOM attribute 或 Canvas 私有字段。

## 8. Render Projection 输出

### 8.1 Scene root

`ms-scene-view` 候选输出：

- scene identity；
- viewport / Camera 呈现值；
- ordered direct children；
- 可恢复的 retained 可见状态。

### 8.2 世界 Paint Units

| Paint Unit | 投影侧输入 | 高频更新 |
| --- | --- | --- |
| `ms-map-back` | Back layout、resolved frames、world rank | Camera-relative view / visual phase |
| `ms-map-batch` | static placements、bounds、rank | 通常无；内容/资源版本变化才重画 |
| `ms-map-object` | 独立 Obj、rank、frame selection | world transform / visual frame |
| `ms-world-item` | Actor position、rank、visible | position / rank |
| `ms-avatar` | render-ready appearance、pose/action | pose、facing、appearance |
| `ms-portal-visual` | portal visual placement、rank、frames | visual phase / visible |

### 8.3 update 与 replace

- position、Camera、visible、rank 等已有节点标量优先走 `update()`；
- Avatar appearance 等 retained data 可替换对应 top-level value；
- batch split、child create/delete/reorder、map topology 使用 `replace()`；
- one-shot visual impulse 使用 `emit()`，但持久视觉结果仍需 retained state。

## 9. Camera 投影

Camera 世界状态在 Subsystem，视觉变换在 `ms-scene-view`：

```text
screenX = worldX - cameraX
screenY = worldY - cameraY
```

候选 DOM 只在共同 `world-plane` 应用一次 Camera transform。普通 world item 不应再次减 Camera。

Back 可以有特殊视差、重复或 auto-scroll 变换，但它的宿主仍属于共同世界排序。Back component 不拥有 Camera follow 业务算法。

## 10. Movement 到 Avatar 的投影

Movement 每个业务 tick 可改变：

- position；
- velocity；
- mode/contact；
- Foothold layer/group；
- facing / locomotion presentation；
- Actor world sort rank。

投影应把变化拆成必要的 Renderer 更新：

```text
position / rank → ms-world-item attrs
facing / locomotion → ms-avatar attrs/data
world Camera → ms-scene-view attrs/data
```

不能因为 position 高频更新而重新发布完整 AvatarPlan 或重绘 Avatar Canvas。

## 11. Portal 与场景事务

### 11.1 同图

业务侧更新 Player/Movement/Camera 相关状态；场景静态 Paint Units 通常保持。CMS079 到达位置和速度处理由 Portal/Movement 权威实现。

### 11.2 跨图

候选顺序：

```text
validate trigger
→ resolve unique target
→ prepare target content / resource closure / projection candidate
→ commit FieldState + scene identity + Player + Camera
→ replace authoritative Render tree
→ Renderer asynchronously prepares local pixels
```

目标内容准备失败时不得提交新业务场景。

Render tree commit 与多个 Canvas 的像素 ready 不是同一个事务。若产品需要遮罩或过场，应设计 Renderer-local presentation gate，但不得让它决定业务是否已经换图。

## 12. 验收层次

1. **内容测试**：group presence、schema、resource closure、stable identity。
2. **Adapter 测试**：关联、排序、Avatar 遮挡、Portal target、bounds。
3. **Subsystem 回放**：相同输入/时钟产生相同 FieldState 和 projection hash。
4. **RenderNode snapshot**：树、key、attrs/data、children order。
5. **真实 WebProjector**：DOM identity、slot、Shadow DOM、attrs/data 到达顺序。
6. **像素测试**：锚点、翻转、遮挡、Camera 对齐、DPR。
7. **故障测试**：缺资源、慢资源、旧 epoch、map prepare 失败、carrier replacement。
8. **性能测试**：DOM 数、Canvas 数/像素、decode 并发、patch/reconcile、paint/composite。
