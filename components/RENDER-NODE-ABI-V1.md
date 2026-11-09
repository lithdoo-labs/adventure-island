# Adventure Island RenderNode ABI v1

> **状态：Frozen / Normative（Adventure Island 产品接口）；客户端画面一致性：PARTIALLY VERIFIED。** 本文冻结本仓库的产品接口和 MVP 行为，不代表所有原始客户端绘制语义均已逆向确认。新组件可以在后续版本扩展，但不得静默改变本文已有字段的名称、类型、含义、生命周期或树顺序；未验证的产品选择必须在相应条款中明确标注。
>
> 基线：LoomRealm gitlink `93648192323bf5f57996b7b54cbae641d8a53fdb`。
>
> 上游规范：[Render Update v1](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/render-update-v1.md)、[Web Presentation API v1](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/web-presentation-api-v1.md)、[Web Presentation Config v1](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/web-presentation-config-v1.md)。

本文使用 MUST / MUST NOT / SHOULD / MAY 表达规范强度。本文是 Adventure Island 的产品级组件契约，不复制或修改 LoomRealm 的底层协议。

2026-11-09 目标修订：`locomotion` 增加 `prone` 与 `swim`。`stand`、`walk`、`jump` 的含义不变，五字段和标签集合不变，不另起主版本。`swim` 的画面映射写在 5.6。

---

## 1. 冻结范围与协议分层

必须区分三层：

| 层 | 规范所有者 | 定义什么 |
|---|---|---|
| Render Update v1 | LoomRealm | Domain、Snapshot、Patch、Event、Node identity、revision 和 wire 生命周期 |
| Web Presentation API v1 | LoomRealm | RenderNode 到 Custom Element 的投影、receiver 回调、资源能力和事件投递 |
| Adventure Island RenderNode ABI v1 | 本仓库 | `cms-*` 标签、每个标签的 attrs/data schema、子节点结构和业务事件名称 |

LoomRealm 不定义 `cms-scene-view`、`cms-actor` 等标签的业务含义，也不定义每个标签的 `attrs/data` schema。Adventure Island 不得把业务字段或资源能力塞进 LoomRealm 的协议字段。

本 ABI 冻结以下内容：

- RenderNode 五字段结构及其语义；
- 当前 MVP 六个标签的名称、attrs、data、children 和事件契约；
- 逻辑资源引用格式；
- Scene 树顺序、Actor 稳定身份和更新规则；
- 组件视觉状态与 Field Runtime 权威状态的边界。

以下内容不由本 ABI 冻结：Canvas 绘制算法、DOM/CSS 内部结构、缓存实现、帧调度实现、物理算法、碰撞判定、地图切换策略和未列入 MVP 的 NPC / Reactor / Seat / Mob 组件。

## 2. RenderDomain 与 RenderNode 公共形状

### 2.1 规范结构

Adventure Island 提交给 LoomRealm 的树必须符合 Render Update v1 的结构：

```ts
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
type JsonObject = Readonly<Record<string, JsonValue>>;

interface RenderNodeV1 {
  readonly key: string;
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly data: JsonObject;
  readonly children: readonly RenderNodeV1[];
}

interface RenderDomainStateV1 {
  readonly zIndex: number;
  readonly roots: readonly RenderNodeV1[];
}
```

RenderNode MUST 精确包含 `key`、`tag`、`attrs`、`data`、`children` 五个成员。不得增加 `props`、`state`、`style`、`events`、`resources` 或其他平级成员。业务数据放入该 tag 定义的 `attrs/data`；事件通过 Render Event，不作为树字段。

### 2.2 五个成员的含义

| 成员 | 规则 | 用途 |
|---|---|---|
| `key` | 非空 Unicode scalar string；区分大小写、不做 normalization；同一 RenderDomain 全树唯一；移除后在该 wire Domain 生命周期内不得复用 | Node 身份，不是 HTML `id` |
| `tag` | 非空 Unicode scalar Custom Element 标签名；同一个 live key 的 tag 不得改变 | 由 `document.createElement(tag)` 创建 |
| `attrs` | 非空 Unicode scalar 属性名到有效 Unicode 字符串的映射；值允许空字符串 | 投影为宿主元素属性 |
| `data` | 普通 JSON object | 通过 `receiveRenderData(fullData)` 交付 |
| `children` | 有序 RenderNode 数组 | 投影为有序 light DOM 子节点 |

附加规则：

- `key` 是 Domain-wide identity，不是 Subsystem 全局 ID。换场景时需要保留的节点必须保留原 key。
- 同一 live key 的 `tag` 不可变。需要改变 tag 时必须结束旧 Node 生命周期并使用新 key。
- 一个 key 从已发布树中移除后，不能在同一 wire Domain 生命周期中重新引入；不要用删除再创建来模拟重置。
- `children` 数组顺序是权威的同级顺序。组件不得自行重排受 LoomRealm 管理的 light DOM。
- `zIndex` 属于 RenderDomainState，不属于 RenderNode，也不得复制进根节点 attrs；它必须是 signed safe integer。
- `domainId`、Subsystem identity、Data generation、revision 和 transport 信息均不属于 RenderNode。

### 2.3 Subsystem 写入语义

业务侧使用 RenderDomain 的现有能力：

```ts
interface RenderDomainV1 {
  replace(state: RenderDomainStateV1): void;
  update(update: {
    readonly zIndex?: number;
    readonly nodes?: readonly {
      readonly key: string;
      readonly attrs?: {
        readonly set?: Readonly<Record<string, string>>;
        readonly remove?: readonly string[];
      };
      readonly data?: {
        readonly set?: Readonly<Record<string, JsonValue>>;
        readonly remove?: readonly string[];
      };
    }[];
  }): void;
  emit(event: {
    readonly targetKey: string;
    readonly name: string;
    readonly data: JsonObject;
  }): void;
  close(): void;
}
```

- `replace()` 用于完整树替换、插入/删除/移动节点或改变 children。
- `update()` 只更新已存在节点的 attrs/data 顶层成员；不能改变 key、tag 或 children。
- `update()` 中的 data delta 最终仍会通过 `receiveRenderData` 交付完整的当前 data object，而不是把 wire delta 暴露给组件。
- `emit()` 发送 transient Render Event；它不进入 retained tree、Snapshot 或 revision，不得用于保存状态。
- RenderDomain 结构变化不得由 Web Component 反向修改。
- `update()` 必须包含至少一个有效的 `zIndex`、attrs 或 data 变更；空 delta 以及空的 `set` / `remove` 操作按 Render Update v1 规则拒绝。
- one-shot key 历史属于同一 DataAuthority generation 内的 wire Domain 生命周期。新的 generation 开始新的 wire identity 生命周期，可以重新使用相同 key 字符串；同一 generation 内仍不得复用已删除 key。`sceneEpoch` 是同一 generation 内生成新场景 key 的策略，不得与 generation 混为一谈。

## 3. Web Component 接口

### 3.1 Receiver 与 Context

业务组件可按需实现以下 structural interfaces：

```ts
interface RenderContextReceiver {
  receiveRenderContext(context: WebPresentationContext): void;
}

type DeepReadonly<T> =
  T extends JsonPrimitive ? T :
  T extends readonly (infer U)[] ? readonly DeepReadonly<U>[] :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T;

interface RenderDataReceiver {
  receiveRenderData(data: DeepReadonly<JsonObject>): void;
}

interface RenderEventReceiver {
  receiveRenderEvent(event: DeepReadonly<{
    name: string;
    data: JsonObject;
  }>): void;
}

interface WebPresentationContext {
  readonly resources: PresentationResourceClient;
  emitCustomEvent(name: string, data?: InputEventV1["payload"]): void;
}

interface PresentationResourceClient {
  resource(
    namespace: string,
    key: string,
    expectedContentVersion: string,
    options?: { readonly signal?: AbortSignal }
  ): Promise<{
    readonly bytes: Uint8Array;
    readonly mime: string;
    readonly contentVersion: string;
  }>;
}
```

`WebPresentationContext` v1 的实际闭合接口是 `resources` 与 `emitCustomEvent`。组件不得假设存在全局服务定位器、文件系统、FSDB handle、WZ reader、Content Index、token、origin 或 privileged URL。

### 3.2 回调顺序和所有权

新元素的顺序：

1. 创建 Custom Element；
2. 注入 `receiveRenderContext(context)`（若实现）；
3. 元素可能连接到 DOM，触发 `connectedCallback()`；
4. Projector 管理 children / light DOM；
5. Projector 写入 attrs；
6. 调用 `receiveRenderData(currentFullData)`（若实现）。

因此 `connectedCallback()` MUST NOT 假设初始 attrs、children 或 data 已经就绪。需要资源能力的组件应在 `receiveRenderContext` 后保存 context；需要绘制计划的组件应在 `receiveRenderData` 中接收。

已存在元素更新时，结构/children/root order 先更新，其次 attrs，最后在 data 的 JSON 结构值发生变化时调用 `receiveRenderData`。对象成员插入顺序不构成变化；数组顺序构成变化。

Renderer 管理的 attrs、data 和 light DOM 对组件是只读输入。组件可以拥有 Shadow DOM、Canvas/WebGL、私有字段、动画时钟和缓存，但 MUST NOT 修改或反向同步受管理的 attrs/data/children。

### 3.3 Event 语义

Subsystem → Component：

```ts
receiveRenderEvent({ name: "action", data: { action: "brandish1" } });
```

- Event 是同步、fire-and-forget 的一次性呈现脉冲。
- Event 不进入 retained Render Store，不增加 revision，不重放，不 ACK，不 retry。
- 缺少 target 或 receiver 时按上游规则 drop / ignore。
- 组件只能改变自己的呈现私有状态，不能通过 Event 改写 RenderNode 树或游戏权威状态。

Component → Subsystem：

```ts
context.emitCustomEvent("interaction", { /* User Input v1 JSON payload */ });
```

- 这是唯一反向能力；它是受 User Input v1 payload 约束的输入意图，不是直接调用游戏逻辑。
- Session、Subsystem、generation、Domain 和 target provenance 由 LoomRealm 绑定，业务组件不得自行提供或覆盖。
- 反向事件由 owning Subsystem 的正常 InputGate 处理；不得在组件回调栈内同步重入游戏逻辑。

## 4. 资源引用 ABI

组件 data 中的图像资源必须使用逻辑引用：

```ts
interface LogicalResourceRefV1 {
  readonly namespace: string;
  readonly key: string;
  readonly contentVersion: string; // sha256:<64 lowercase hex>
}
```

规则：

- `namespace` 是逻辑资源命名空间；`key` 是层级 ResourceKey。
- `contentVersion` 必须匹配 `^sha256:[0-9a-f]{64}$`，并作为预期 SHA-256 版本精确传给 `resources.resource(namespace, key, expectedContentVersion)`。
- 组件校验返回的 `contentVersion` 与请求版本一致；返回 bytes 是调用方所有；并按自身格式校验 MIME、解码尺寸和 source rect。
- 不允许 URL、物理路径、WZ 路径、FSDB 路径、FileSystemHandle、bearer、origin 或私有 Content locator。
- `resource.Presentation` 的脚本入口属于 Web Presentation Config，不是 RenderNode data；组件不在运行时动态加载脚本或其他组件。

## 5. Adventure Island MVP 标签契约

本节中的标签名、属性名、data 顶层 key 和字段语义是 v1 公共 ABI。每个组件的 data schema 使用独立 `formatVersion: 1`。未列出的 attrs/data 字段不属于 v1；Adapter validator MUST 拒绝未知字段，不能静默忽略。JSON data 内部使用 camelCase；HTML attrs 使用小写 kebab-case。既有 `cms-actor` attrs 保持原样。

### 5.1 通用视觉数据类型

```ts
type PointV1 = readonly [number, number];

interface RectV1 {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface RasterFrameV1 {
  readonly delay?: number;             // non-negative milliseconds under the v1 product clock; absent means hold
  readonly resource: LogicalResourceRefV1;
  readonly source?: RectV1;            // omitted means whole image
  readonly width: number;              // logical sprite width
  readonly height: number;             // logical sprite height
  readonly origin: PointV1;
}
```

`source` 存在时，它是解码后整页图集内的像素矩形，`source.x/y` 必须是非负整数，且 `source.w/h` 必须等于逻辑小图的 `width/height`。没有 `source` 时，整张解码图的尺寸必须等于逻辑小图尺寸。所有宽高必须是正整数，坐标和原点必须是有限数值。`RasterFrameV1.delay` 如存在必须是有限、非负毫秒数；毫秒是 Adventure Island v1 的产品时钟单位，尚未由原始客户端定时器确认。未提供 delay 表示停留在该帧，`delay: 0` 表示绘制该帧后立即推进；帧数组必须非空。

地图 Tile、Obj、Back 和 Portal 使用同一条产品锚定，客户端绘制函数尚未恢复这条减法：

```text
drawLeft = placementX - originX
drawTop  = placementY - originY
```

`flip` 为真时围绕放置锚点的竖线做水平镜像，绘制左边缘为 `placementX + originX - width`。v1 不旋转；源数据出现旋转要求时，Adapter 报告 unsupported。`opacity` 是 0–255 的整数，绘制 alpha 为 `opacity / 255`。应用顺序是先按 origin 锚定，再水平镜像。这些规则是产品约定。`cms-actor` 继续使用自己的身体原点，不套用这条地图锚定。

多帧数组里只要有一帧缺少 `delay`，Back 和 Portal 的 v1 呈现停在第一帧。`loop: true` 不补帧时间，也不启动组件私有时钟。全部帧都有 `delay` 时数值照常保留；在产品时钟策略落地前，P1 同样不自动推进。`cms-actor` 的帧推进仍只遵循其 IMPLEMENTATION，不受这段地图规则改写。

### 5.2 `cms-scene-view`

| 类别 | 冻结字段 |
|---|---|
| attrs（必需） | `map`、`x`、`y` |
| data | 唯一顶层成员 `scenePlan` |
| children | 按 §6 的场景顺序 |

```ts
interface ScenePlanV1 {
  readonly formatVersion: 1;
  readonly bounds: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  };
  readonly debug?: {
    readonly footholds: readonly {
      readonly x1: number; readonly y1: number;
      readonly x2: number; readonly y2: number;
    }[];
    readonly ropes: readonly {
      readonly x: number; readonly y1: number; readonly y2: number;
      readonly l: number;
    }[];
  };
}

data: { scenePlan: ScenePlanV1 }
```

- `map` 是当前地图编号字符串。
- `x/y` 是 Adventure Island v1 的产品坐标约定：Camera 视口左上角世界坐标，使用十进制字符串；世界 Y 轴向下，不提供 zoom，世界像素与 CSS 像素按 1:1 映射，世界点按 `screen = world - camera` 投影。该坐标变换和 1:1 约定尚未由原始客户端 Camera 函数确认，不得标注为客户端逆向事实。
- `bounds` 是场景世界边界，等于 MapScenePlan 的 `effectiveBounds`。四个 VR 齐全时，这份边界已经包含客户端已确认的内缩：左右各 400，上下各 300；某一轴小于等于 0 时两边收到向零截断的中点。因此右边可以等于左边，下边可以等于上边。组件不得再次内缩。没有完整 VR 时，边界来自产品回退，不套用 400 和 300。
- `x/y` 的 1:1 投影、Camera 跟随和这份 VR 内缩是三件不同的事。跟随算法待逆向。1:1 是产品约定。VR 内缩只在源数据有四个 VR 时已经由客户端函数确认。
- `debug` 仅是可选辅助线投影，不是物理碰撞权威数据。正式场景可省略。

### 5.3 `cms-back`

| 类别 | 冻结字段 |
|---|---|
| attrs（必需） | `back-set`、`index`、`animation`、`x`、`y`、`parallax-x`、`parallax-y`、`background-type`、`tile-step-x`、`tile-step-y`、`flip`、`opacity` |
| data | 唯一顶层成员 `backPlan` |
| children | 空 |

```ts
interface BackPlanV1 {
  readonly formatVersion: 1;
  readonly loop: boolean;
  readonly frames: readonly RasterFrameV1[];
}

data: { backPlan: BackPlanV1 }
```

- `back-set/index/animation` 是来源标识；动画帧和资源由 Adapter 预解析进 `backPlan`，组件不得自行按 CMS/WZ 路径查找。
- `x/y` 是背景锚点，按 §5.1 的产品锚定绘制。`parallax-x/y` 原样映射 `rx/ry`，`background-type` 原样映射 `type`，`tile-step-x/y` 原样映射 `cx/cy`。客户端已确认 type 0–3 走普通分支，type 4 与 6 用 `rx`、type 5 与 7 用 `ry`，滚动步长为 `20000 / |rate|`。`+0x98` 的参数顺序已确认，函数体和时间单位待逆向，所以这些参数的存在不表示视差公式已经可以绘制。P1 只静态绘制 type 0，不解释 `rx/ry`。type 1–7 由 Adapter 报告 unsupported，不进入可发布 Plan。
- `cx/cy=0` 在 v1 中保留为 0。客户端把它们当作水平、垂直步长，值为 0 时不改用画布宽高。组件也不得把 0 换成图像宽高。
- `flip` 按 §5.1 围绕锚点水平镜像。`opacity` 按 `opacity / 255` 变成绘制 alpha。二者的客户端混合函数仍待逆向，当前是产品约定。
- `front` 不作为组件属性。它参与客户端 `index * 1000` 加载键，比较方向待逆向。远景/近景由父节点的 children 顺序表达，该顺序是产品约定。
- Adapter 对缺失源字段使用产品回退值：`animation="0"`、`rx/ry/cx/cy="0"`、`flip="false"`、`opacity="255"`、`background-type="0"`。本次 303 条样本背景均包含这些字段，因此这些回退值不是样本中观察到的客户端缺省值。

### 5.4 `cms-map-layer`

| 类别 | 冻结字段 |
|---|---|
| attrs（必需） | `layer` |
| attrs（可选） | `tile-set` |
| data | 唯一顶层成员 `mapLayerPlan` |
| children | 空 |

```ts
interface MapAssetV1 {
  readonly id: string;
  readonly kind: "tile" | "obj";
  readonly resource: LogicalResourceRefV1;
  readonly source?: RectV1;
  readonly width: number;
  readonly height: number;
  readonly origin: PointV1;
  readonly canvasZ?: number; // required for kind="tile"; absent for kind="obj"
}

interface TilePlacementV1 {
  readonly assetId: string;
  readonly x: number;
  readonly y: number;
  readonly zM: number;
}

interface ObjPlacementV1 {
  readonly assetId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly zM: number;
  readonly flip: boolean;
}

interface MapLayerPlanV1 {
  readonly formatVersion: 1;
  readonly assets: readonly MapAssetV1[]; // unique ids; every placement reference resolves
  readonly tiles: readonly TilePlacementV1[];
  readonly objs: readonly ObjPlacementV1[];
}

data: { mapLayerPlan: MapLayerPlanV1 }
```

- `layer` 是 `"0"` 到 `"7"`；`tile-set` 是图集名，无 Tile 的层可以省略。
- `assets` 必须非空，`tiles` 或 `objs` 至少有一项，且每个 asset 至少被一个 placement 引用；`assets.id` 在当前 plan 内唯一。Tile placement 只能引用 `kind="tile"` 的 asset；Obj placement 只能引用 `kind="obj"` 的 asset。Tile 放置记录没有独立 flip 字段；Obj 的 `flip` 来自源 `f`。
- `kind="tile"` 必须提供有限数值 `canvasZ`；`kind="obj"` 不得提供 `canvasZ`。`canvasZ` 是 Tile 画布的 `z`，Obj placement 的 `z` 是地图放置记录的源整数，两者不可互换。WZ 提取已经测到画布 `z`。四张没有 `z` 的 Tile Canvas 不得写成 0：`Tile/greenCrystalCave.img/bsc/0`，以及 `Tile/blueCave2.img` 的 `bsc/0`、`bsc/1`、`bsc/2`。引用它们的记录由 Adapter 报告 `tile-canvas-z-absent`，不进入本 plan。
- 客户端已确认的诊断键由 Adapter 记在 MapScenePlan，不进入本 plan：`tileKey = canvasZ + 10 * (layer * 3000 - zM) - 1073721834`，`objKey = layer * 30000 + z - 1073739824`。Tile 键使用放置 `zM`。Obj 键使用放置 `z`，不使用 `zM`。比较方向和相同键次序待逆向。
- 当前 v1 产品绘制顺序为：Obj 组先于 Tile 组；Obj 按 `z` 升序，Tile 按引用 asset 的 `canvasZ` 升序；相同排序值保持各自数组中的源顺序；父树中较小的 layer 先于较大的 layer。该顺序来自 HaCreator 移植。实现必须把它标成产品约定。诊断键不改变这个顺序。
- `zM` 必须原样保留。Tile 的客户端键已经使用它。Obj 的这条加载路径不读 `zM`。v1 MVP 仍不据此把人物插进 Obj 深度带，这是产品限制。
- `reactor`、`name` 是地图逻辑/脚本关联，不属于 Obj 视觉 ABI。源 `r/flow` 的绘制语义尚未确认，不属于 v1；MVP allowlist 遇到需要这些字段才能正确呈现的记录时，Adapter MUST 明确报告 unsupported，不得静默丢弃后声称完整复刻。
- 单个 Tile/Obj 不创建 RenderNode 或 Custom Element；整层批量绘制。

### 5.5 `cms-avatar-layer`

| 类别 | 冻结字段 |
|---|---|
| attrs | 空对象 `{}` |
| data | 空对象 `{}` |
| children | MVP 恰好一个 `cms-actor` |

这是纯容器，不保存人物状态，不接收游戏输入，不承载 NPC 或怪物。

### 5.6 `cms-actor`

| 类别 | 冻结字段 |
|---|---|
| attrs（必需） | `x`、`y`、`locomotion`、`facing`、`skin`、`face`、`hair`、`expression`、`equips` |
| data | 唯一顶层成员 `avatarPlan` |
| children | 空 |
| Render Event | `action`，payload `{ action: string }` |

```ts
type LocomotionV1 = "stand" | "walk" | "jump" | "prone" | "swim";
type FacingV1 = "left" | "right";

data: { avatarPlan: AvatarPlanV1 }
```

- `x/y` 是身体原点（近似脚底）的世界坐标，使用十进制字符串；Camera 由祖先 `cms-scene-view` 处理。
- `locomotion` 接受 `stand`、`walk`、`jump`、`prone`、`swim`。`prone` 对应身体动作 `prone`。`avatar.part.body.00002000` 没有名为 `swim` 的动作，有 `fly`（第 0、1 帧，`delay` 300）。姿态字节还原前，`swim` 画 `fly`，这是产品约定。这些持续姿态不由一次性 `action` Event 代替。`facing` 只接受 `left/right`，其客户端状态映射仍未验证。
- `skin` 是十进制字符串；`face/hair` 是八位编号字符串；`expression` 是非空表情名；`equips` 是逗号分隔的装备编号，无装备为空字符串。Adapter 对每个 Actor attrs value 执行 ≤ 4096 UTF-8 字节的组件级输入约束。
- `AvatarPlanV1` 的帧、锚点、遮挡、资源引用和 validator 以 [cms-actor/IMPLEMENTATION.md](./cms-actor/IMPLEMENTATION.md) 为唯一组件级规范；本 ABI 不复制第二份 AvatarPlan schema。
- 一次性普攻/技能通过 `action` Render Event 触发，不得写入 attrs 或 avatarPlan 的动态播放状态。Actor 的 key 在换地图时保持不变。

### 5.7 `cms-portal`

| 类别 | 冻结字段 |
|---|---|
| attrs（必需） | `portal-name`、`portal-type`、`x`、`y` |
| attrs（可选） | `flip`、`hide-tooltip` |
| data | 唯一顶层成员 `portalPlan` |
| children | 空 |
| Render Event | MVP 无 |

```ts
interface PortalPlanV1 {
  readonly formatVersion: 1;
  readonly loop: boolean;
  readonly frames: readonly RasterFrameV1[];
}

data: { portalPlan: PortalPlanV1 }
```

- `portal-name` 来自源 `pn`；`portal-type` 来自源 `pt`，使用十进制字符串。客户端已确认 `pt` 2、4、7 使用 `Map/MapHelper.img/portal/game/pv`，10、11 使用实例 `image` 或 `default`，0、1、3、5、6、8 不加载 pv。9、12 不发布。`pt` 13 的使用路径另读 `Effect/BasicEff.img/VerticalJump`，也不发布成 pv。`pt` 3 的使用路径仍按 `tm` 跳转。没有游戏帧时不创建本节点。`portal/editor` 的图标不得进入 `frames`。样本中类型 1、类型 2 和类型 3 都可以带真实 `tm`；类型 2 只是当前有 pv 画面的子集。
- `x/y` 是世界坐标；`flip` 可选，缺省按产品规则为 `"false"`（99 个样本均没有源 `f`）；`hide-tooltip` 可选，均使用 `"true"/"false"`。缺省 false 不是从客户端 `f` 字段反推的事实。
- `targetMap`、`targetName`、`script`、触发范围、冷却和 `onlyOnce` 规则不属于组件 attrs/data；它们由 MapScenePlan / Field Runtime 的 Portal Record 持有。
- Portal 组件只绘制 `portalPlan`，不得自行决定是否传送或改变当前地图。

## 6. 场景树结构与顺序

MVP 的唯一 RenderDomain root 是一个 `cms-scene-view`。以下 children 顺序是 Adventure Island v1 的产品树顺序，参考 HaCreator 合成器。Tile、Obj 和背景的客户端加载键已经恢复，比较方向待逆向，所以这条 children 顺序仍是产品约定。该树也无法表达 Actor 在同一 layer 的 Obj 之间按 `zM` 穿插，这是当前 MVP 的已知限制。

其 children 顺序为：

1. 零个或多个远景 `cms-back`；
2. 零个或多个 `cms-map-layer`，按 `layer=0..7` 升序；
3. 恰好一个 `cms-avatar-layer`，其中恰好一个稳定 key 的 `cms-actor`；
4. 零个或多个 `cms-portal`，保持地图源顺序；
5. 零个或多个近景 `cms-back`。

第一段和最后一段的 `cms-back` 位置本身区分远景/近景，不使用 `front` attr。相同组内按源数组顺序保持稳定。空地图层不创建节点。

### 6.1 Node key 生命周期策略

Render Update v1 的 Node key 在同一 wire Domain 生命周期内是 one-shot：节点一旦从已发布树中移除，该 key 永远不能重新使用。地图 A → B → A 时，不能只用 mapId/layer/portal 名称生成可重复的 key。

Adventure Field Runtime MUST 使用以下身份策略：

- `cms-scene-view` 使用稳定 key（例如 `scene-view`），地图切换时只更新该节点。
- `cms-avatar-layer` 与唯一玩家 `cms-actor` 使用稳定 key（例如 `avatar-layer`、`actor:player`），整个 RenderDomain 生命周期内不删除、不重建。
- 每次场景实例创建时递增一个 RenderDomain-local 的 `sceneEpoch`。所有场景专属节点 key 必须包含该 epoch，例如 `scene:<epoch>:back:<ordinal>`、`scene:<epoch>:layer:<layer>`、`scene:<epoch>:portal:<ordinal>`。
- `sceneEpoch` 不放入 attrs/data；它只用于生成不重复的 Node key。地图切换、返回旧地图或重新显示已删除的场景节点时，必须使用新的 epoch/key。
- 除稳定根节点、avatar-layer 和 actor 外，若任何节点在同一场景实例中被移除后又需要出现，也必须追加新的实例序号生成 fresh key；不得复用已消费的 key。

换场景时：

- 更新 `cms-scene-view` 的 map、Camera attrs 和 scenePlan；
- 替换背景、地图层和 Portal 子节点；
- 保留 `cms-avatar-layer` 与 `cms-actor` 的 key，使仍 live 的 actor HTMLElement 不被重建；
- 把 actor 的世界坐标更新为目标地图落点；
- 不把旧地图的 Portal、碰撞或场景数据留在新场景树中。

## 7. 视觉组件与游戏权威状态的分界

| 数据 | RenderNode ABI | Adventure Field Runtime |
|---|---|---|
| Camera 当前偏移 | `cms-scene-view.attrs.x/y` 的呈现值 | Camera 决策和 viewport 夹取 |
| Scene bounds | `scenePlan.bounds`，等于 `effectiveBounds` | `sourceBounds`、VR 内缩或产品回退的计算 |
| Foothold / Rope | 可选 `scenePlan.debug` 辅助线 | 完整碰撞、平台连接、攀爬和移动语义 |
| Actor 位置/朝向/动作 | `cms-actor.attrs` 的当前呈现值 | 世界坐标、速度、状态、移动和跳跃 |
| AvatarPlan | `cms-actor.data.avatarPlan` | 从 FSDB 解析并投影的外观计划 |
| Portal 图像 | `cms-portal.data.portalPlan` | 无 |
| Portal 目标/触发 | 不放进视觉组件 | Portal Record、触发范围、冷却、一次性规则、地图切换 |
| Tile / Obj 放置 | `cms-map-layer.data.mapLayerPlan` | 原始地图记录和 Adapter 投影 |
| Obj 的 `reactor/name` | 不放进视觉 ABI | Reactor/脚本关联元数据 |

Web Component 是只读呈现端。它不得拥有第二份玩家坐标、速度、碰撞、地图跳转或交互状态。

## 8. 版本、校验和容量

### 8.1 Schema 冻结

- 每个 data 顶层 plan 必须有 `formatVersion: 1`。
- 每个 tag 的 attrs/data 是闭合 schema；缺少必需字段、未知字段、错误类型、非法枚举或无效资源引用都必须由 Adapter/plan validator 明确拒绝。
- 不得把数字/布尔值混入 attrs；所有 attrs value 必须是字符串。
- 不得在 v1 下静默改变字段含义、坐标系、排序、事件语义或资源 key 解释。2026-11-09 已写明的 `locomotion` 扩值保持原三个值的含义，不另起主版本。
- 新增不兼容字段或改变既有字段语义，必须发布新的 ABI/plan major version；不能靠组件内部猜测旧/新格式。

### 8.2 不混淆协议容量与产品容量

LoomRealm Render Update v1 不定义通用的 RenderNode.data 字节数、成员数、数组长度或 JSON 深度上限。Adventure Island 可以为具体组件设置应用层边界，但必须明确归属该组件并有对应 validator/test。

当前已冻结的组件级边界：

- `cms-actor` 每个 attrs value ≤ 4096 UTF-8 字节，是该组件的 Adapter 输入策略，不是 LoomRealm 通用限制。
- `AvatarPlanV1` 的 compact UTF-8 JSON 上限为 262,144 字节；这是 `cms-actor` 的应用层策略，不是 Render Update v1 的协议上限。
- `cms-actor` 的帧数、层数、锚点数、画布尺寸、delay、合成 Canvas 和解码并发边界，继续由其 IMPLEMENTATION 文档和 validator 管理。
- MapLayerPlanV1 / BackPlanV1 / PortalPlanV1 的最终 payload 与资源工作集上限必须在选定地图上测量后另行冻结；在此之前不得声称已具备容量验收。不得擅自套用 AvatarPlan 的 262,144 字节限制，也不得将整张地图无界塞进一个 RenderNode。`cms-map-layer` 的画布是视口尺寸加可见区域裁剪，不把射手村 7174 像素宽的地图做成整层世界 Canvas。空间分块留到实测超预算之后。

### 8.3 资源版本

每个 plan 中引用的资源都必须属于本次发布的 Content closure；Builder 必须验证引用存在、版本一致、MIME 与图片尺寸正确。浏览器端只能经 `PresentationResourceClient` 读取。缺失资源、版本冲突、MIME 不符或 source 越界均是明确的呈现失败，不得回退到 URL、WZ 或本地文件路径。

## 9. v1 不包含的组件与能力

以下不属于本次冻结的 MVP 标签 schema：

- `cms-npc`：NPC 立绘和对话；
- `cms-reactor`：箱子、开关、花等反应堆；
- `cms-seat`：可坐位置；
- `cms-mob`：怪物。

这些组件未来可沿用同一 RenderNode / Web Presentation ABI，但各自的 attrs/data/event schema 必须单独设计、验证并发布；不能仅凭标签名出现在树里就认为接口已冻结。

## 10. 验收要求

实现一个 v1 组件前，至少必须具备：

1. 对应 tag 的注册脚本，按 Web Presentation Config v1 的 ordered classic scripts 加载；
2. attrs/data 的运行时 schema validator，包含未知字段拒绝；
3. 正确实现其需要的 `receiveRenderContext`、`receiveRenderData`、`receiveRenderEvent`；
4. 资源引用版本、MIME、解码尺寸和 source rect 校验；
5. 浏览器集成测试证明 Projector 实际投影 attrs、children、完整 data 和 transient event；
6. 测试证明组件不修改受管理 attrs/data/children，不自行读取 WZ/FSDB/私有 Content Index；
7. 场景树测试证明 children 顺序正确、Actor key 跨换图稳定；
8. 对该组件的数据规模、资源并发、Canvas 尺寸和释放行为有明确的产品级容量测试。

ABI v1 冻结不等于所有组件已经实现，也不等于地图资源已齐备。实现状态必须按组件和验收证据单独报告。
