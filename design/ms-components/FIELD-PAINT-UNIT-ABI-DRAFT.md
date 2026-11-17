# Field Paint Unit ABI — Shared Definitions（Draft）

> 状态：首阶段 ABI 设计草案 / NOT APPROVED / NOT IMPLEMENTED。六个新组件的共享字段规则定义于此；[ms-avatar](./ms-avatar.md) 和 [ms-action](./ms-action.md) 的组件职责与播放规则仍以各自文档为准。
> **组件不做 Schema / ABI 版本管理**：RenderNode data 不设置 `formatVersion`、`schemaVersion` 或场景代际字段；不做版本协商、兼容分支或迁移。字段调整直接更新当前组件文档与投影实现。
> **平台资源身份例外**：`ResourceRef.contentVersion` 是 LoomRealm `resource(namespace, key, expectedContentVersion)` 所要求的 Content 内容身份/完整性参数，不是组件 Schema 版本，不得删除。
> 场景层级及阶段边界见 [Field Component Tree](./FIELD-COMPONENT-TREE-DRAFT.md)；OpenMS 深度证据见 [World Rendering Architecture](./WORLD-RENDERING-ARCHITECTURE-DRAFT.md)。


## 0. LoomRealm attrs / data / event 通道

| 通道 | 传输与接收方式 | 保留语义 | 适合承载 |
| --- | --- | --- | --- |
| `attrs` | string map；WebProjector 通过 `setAttribute` / `removeAttribute` 更新，组件通过 `observedAttributes` / `attributeChangedCallback` 响应 | 当前值保留在 RenderNode 中，新投影可恢复 | 简单标量、坐标、显隐、排序 |
| `data` | plain JSON object；WebProjector 调用 `receiveRenderData(fullCurrentData)` | retained state；回调收到完整当前 data，不是本次 Patch | 图片资源引用、绘制记录、Clip、布局 |
| `RenderEvent` | 独立瞬时消息；调用目标组件的 `receiveRenderEvent({ name, data })` | 不写入 retained state，不缓存、不保证重放 | 一次性视觉动作或脉冲 |
| `emitCustomEvent()` | `WebPresentationContext` 的 Renderer → Subsystem 出口，受 InputGate 约束 | 不是 RenderEvent ACK，也不是视觉完成回报 | 仅在明确需要反向业务输入时使用 |

- `RenderDomain.update()` 对 data 的顶层成员做 retained 更新；但 `receiveRenderData()` 接收更新后的完整 data 对象，不接收局部 Patch。
- attrs 没有 `receiveRenderAttrs()` 回调；属性变化通过 Custom Element 标准 attribute lifecycle 处理。多个相关 attr 依序写入时，组件应合并读取完整当前值，避免观察中间组合状态。
- RenderEvent 按精确 `targetKey` 投递，不等同于 DOM bubbling。持久状态必须通过 attrs/data 表达，不能依赖 Event 恢复。
## 1. 范围与上游传输契约

适用新增的六个标签：ms-scene-view、ms-map-back、ms-map-batch、ms-world-item、ms-map-object、ms-portal-visual。

每个节点均使用 LoomRealm 固定五字段 RenderNode：`key / tag / attrs / data / children`，其中 attrs 仅 string → string，data 为 plain JSON object。不允许传入 HTMLElement、Canvas、ImageBitmap、函数、Uint8Array、URL capability、WZ/FSDB 路径或二进制。LoomRealm 管理 Light DOM 与 key 生命周期，业务组件管理私有 Shadow DOM/Canvas/图片。

- `RenderDomain.update` 对存在节点只改变 attrs/data 的**顶层成员**，不能通过该 API 改 children、key 或 tag；组件的 `receiveRenderData` 始终接收完整当前 data。结构增删/重排通过一次新的 RenderDomain 结构提交（替换整树或合法结构操作）。
- 首次投影可能先 connected、再 attrs、最后 receiveRenderData；因此 connectedCallback 不能直接把空壳当合法视觉对象。数据交付失败不会被 WebProjector 无条件重试；必须维护明确的 pending/invalid/ready 局部状态。
- 同一 wire Domain 生命周期内已移除 key 不得复用；同一存活 key 不得改变 tag。场景切换选择 stable scene root + 新 epoch/全新子节点 key，或全新 root，需明确生命周期；绝不能删除后原位复用同一 key。
- 组件不能修改被 LoomRealm 管理的 host attrs、受管 Light DOM children 或其顺序，也不能创建/删除其他 RenderNode。可以更新**自己的 Shadow DOM/CSS style 私有呈现状态**。
- Render commit 原子 ≠ 各组件图片解码/Canvas 帧原子。跨组件场景转场的可见性门闩属于未完成的集成设计，而非 LoomRealm 现成 ProjectionBatch。

## 2. 共同字段规范（当前字段规则）

### 2.1 attrs 数值、显隐与 stack

通用 attr 名称：

| 字段 | 类型 | 值与语义 |
| --- | --- | --- |
| `stack-rank` | 必需 string（World Paint Unit） | 规范正整数十进制，无前导 0，范围 1..2147483646，投影已结合 worldDepth 和 tieOrder；非 scene root；css z-index |
| `visible` | 必需 string（有视觉表面的标签） | 精确 `true` 或 `false`；false 只隐藏呈现，不等于游戏对象被销毁 |
| `world-x / world-y` | 需要世界位置的节点 | 非指数有限十进制 string，坐标单位为游戏世界像素；不预减 Camera |
| `view-x / view-y` | Back 专用屏幕定位 | 非指数有限十进制 string，Viewport 内容坐标；已经由业务 Render Projection/背景布局数据计算 |
| `camera-x / camera-y` | scene root 专用 | 非指数有限十进制 string，世界 Camera 左上角；只在共同 World Plane 应用一次 |

有限十进制字面量只接受 `-?(0|[1-9][0-9]*)(\.[0-9]+)?`，必须再检验 Number.isFinite；负零不合法。实际坐标范围和速度上限由容量测试确定。`stack-rank` 是在当前 World Domain **所有直属 Paint Units 间唯一的整数**；相等 depth 的对象也必须获得不同 rank，避免依赖 DOM 加载顺序。它不是 CMS079 原始 worldDepth，不是 LoomRealm Domain zIndex，不是 CSS 32 位之外的无限精度值。超出容量必须由投影端显式处理，不能静默压缩成相等 z-index。

所有定义了 attrs 闭集的节点不接受未声明的项目 attrs；字段集合需要调整时，直接修订对应组件文档与实现；不引入 Schema 版本协商、兼容分支或迁移。CSS 用于 DOM 宿主排序时必须保证对应 element 是同一 stacking context 的**可比较兄弟 Paint Units**；局部 Shadow DOM 不得跨父级插入地图像素。

### 2.2 JSON ResourceRef

~~~ts
type ResourceRef当前 = {
  namespace: string;
  key: string;
  contentVersion: string; // sha256: + 64 lowercase hex
};

type SourceRect = { x: number; y: number; w: number; h: number };

// 一个可裁剪图片：Canvas 源页尺寸与裁剪区域均可在 decode 后复核。
type ImageRegion = {
  resource: ResourceRefV1;
  pageWidth: number;         // positive integer
  pageHeight: number;        // positive integer
  source: SourceRectV1;      // non-negative xy; positive wh; fully inside page
};

type StaticDraw = {
  origin: [number, number];  // logical image anchor measured in source pixel space
  flip: boolean;
  opacity: number;           // integer 0..255, convert to alpha /255 at paint
};
~~~

来源图片与图集页均通过 `WebPresentationContext.resources.resource(namespace,key,contentVersion,{signal})` 获取 Uint8Array bytes、mime 和 contentVersion；只允许安全类型的可解码图片，拒绝版本不一致、尺寸不符与非法裁剪矩形。资源 ID 不得替换为私有 URL/path。各组件可按完整 ResourceRef 去重，但不存在已获批的全局 decoded-image cache。

几何字段：坐标/原点为有限数；SourceRect、声明页尺寸必须是整数；opacity 仅 0..255；默认不允许静默转换或 trim。所有 optional 字段都在各自 schema 中明确；所有 JSON schema 默认**拒绝未知字段**。

### 2.3 两种坐标路径

普通世界 Paint Unit：
~~~text
world position + local origin → world-plane
world-plane CSS transform(-camera-x,-camera-y) → viewport
~~~

Back 视觉 Paint Unit 可能使用与普通 Map Obj 不同的视差/滚动和 viewport-relative 定位。初版选择在 attrs 中显式提供 `view-x/view-y`（已经过当前 Camera/背景布局求值的屏幕位置），其宿主在共同 World Plane 内必须**抵消** scene 的 -Camera 变换，即 world-plane local position = view position + camera offset，避免被扣两次 Camera。该值更新路径必须经真实 CSS/Canvas 测试；不是声称 OpenMS GMS083 Back 与普通 Obj 拥有相同坐标变换。

## 3. 组件状态机与错误分类

每个有视觉绘制内容的组件状态候选：

~~~text
constructed → pending input → valid input → loading resource → ready
                              └── invalid (hold/no paint; error diagnostic)
                    loading ────┴── failed (invalid image, missing, budget)
connected/disconnected → stop/rebind local clock and cancel/ignore stale work
~~~

- 新节点未完成 attrs/data 时不可绘制未授权默认图。
- 同一节点当前输入 的部分资源晚到时不得暴露不完整的静态批次；先在私有离屏目标完整绘制，再同步提交这个批次可见画面。
- 输入非法时清除/隐藏当前不兼容视觉；不能继续把旧输入图冒充为当前数据。相同 场景代际字段 的非关键图像资源失败是否允许降级，由产品场景验收策略决定。
- 引入的局部 diagnostic 名称：`INPUT_INVALID`、`UNSUPPORTED_CAPABILITY`、`RESOURCE_MISSING`、`CONTENT_IDENTITY_MISMATCH`、`IMAGE_INVALID`、`RESOURCE_LIMIT`、`DEPTH_PLAN_INVALID`、`STALE_RENDER_RESULT`。这些是业务诊断**提案**，不是 LoomRealm wire Error code 或回写游戏状态。
- LoomRealm resource client 的真实异常码仍为 Content 层定义的 `CONTENT_NOT_FOUND`、`CONTENT_CONFLICT`、`CONTENT_INVALID`、`CONTENT_UNAVAILABLE`、`CONTENT_CANCELLED`；业务组件应映射/记录，不假设平台替游戏重试。
- 限制数组长度、Canvas 总像素、PNG 解码驻留等业务预算必须有限、配置化并可追踪；**本稿不伪造固定浏览器性能上限**。

## 4. 跨组件提交和深度排序

- 只有 Field Subsystem 的 Render Projection 决定 World 深度：静态 Tile/Obj 由 Map Content/Adapter 提供排序事实，Actor 从权威 Foothold layer/group 取得必要事实；每个独立外层 Paint Unit 得到唯一 stack-rank。
- Canvas 内部多条 placement 必须构成对本阶段全部**可达独立**世界深度均安全的连续排序区间；对某个未来 Actor 的深度插入点不安全就切批或抽为独立 Obj。
- 静态 Canvas 批次中没有局部 Canvas 像素能越过其他兄弟 Paint Unit：不能给同一 Canvas 的前半图和后半图设不同 CSS z-index。
- 各 RenderNode 组件不可相互注册 Renderable，也不可自行重排 LoomRealm managed Light DOM；所有兄弟位置/排序由 Subsystem 投影并由 WebProjector 展示。
- 同一提交跨多个不同节点 attrs/data 没有提供保证可观察到原子画面的 WebProjector Canvas barrier。场景可见性/转换门闩尚须真实验证；Avatar V1 提出的 ProjectionBatch 仍是未实现的集成提案。

## 5. OpenMS 与 CMS079 来源边界

参考 pinned OpenMS GMS083 [client depth evidence](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/docs/client-evidence.md)、[StreamScene](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/stream-scene.js)、[EntityAnimation](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js)。GMS083 depth formula、renderer-serial tie-break、背景变换仅供行为参考；**CMS079 真值必须另行证据验证**，不能复制 OpenMS GPL-3.0 代码。

平台依据：[LoomRealm Render Update v1](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/render-update-v1.md)、[Web Presentation API](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/web-presentation-api-v1.md)、[WebProjector](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/packages/renderer/src/internal/web-projector.ts)。
