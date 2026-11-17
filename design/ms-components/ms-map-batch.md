# ms-map-batch — 静态 Tile / Obj 深度安全 Canvas 批次（首阶段设计草案）

> 状态：PROPOSED / NON-NORMATIVE / NOT IMPLEMENTED。首阶段必需；不冻结最大 Canvas 尺寸、实际批次数量或静态 Batch Planner 算法。
> 参见 [组件树](./FIELD-COMPONENT-TREE-DRAFT.md)、[架构草案](./WORLD-RENDERING-ARCHITECTURE-DRAFT.md)。

## 1. 组件定义

ms-map-batch 代表**一个可独立叠放的静态地图绘制批次**，内部默认用一张有限尺寸 Canvas 2D 绘制多条 Tile/Obj placement。多个批次作为 ms-scene-view 的同级 Paint Units，与 ms-world-item、ms-map-object、ms-map-back 等交错。

这不是“第 N Map Layer Canvas”，也不是“全部 Tile Canvas”或“全部 Obj Canvas”。一个批次可以混合 Tile、Obj；一张地图可以有多个相同标签的节点。

## 2. 遮挡正确性是合批前提

全局排序键来自 Field Subsystem 的 World Render Projection 以及已验证的 CMS079 Map placement 事实，而非 DOM 类别。

- Tile 需区分 layer、zM、Canvas z；Obj 需使用 placement z。OpenMS/GMS083 参考表达式分别为 `B+19990+layer*30000-zM*10+tileCanvas.z` 和 `B+2000+layer*30000+obj.z`；CMS079 值和比较规则仍待证明。
- **基础安全条件**：在所有本阶段允许出现的独立 Paint Unit 深度下，一个静态 Canvas 内的绘制记录保持连续、没有必需的外部插入点。Canvas 内部必须按照真实完整顺序绘制。
- Actor 可以处于一个 Batch 后面，也可以处于另一个 Batch 前面；如果可能进入同一 Batch 中间，则应预先拆分深度区间、提升 Obj 为独立 ms-map-object，或进行受控结构替换。
- 同深度的静态 authored tie-order 不得因 Region / PNG 完成时间改变；跨 Canvas 批次的 tie 边界也应稳定。
- 复杂的空间不相交优化可以作为后续证明后的特例，不是首版正确性的依据。

## 3. 数据和布局候选（非冻结 ABI）

| 输入语义 | 说明 |
| --- | --- |
| batch id / sceneEpoch / region id | 稳定身份、资源代际和可释放范围 |
| world bounds / pixel bounds / origin | Canvas 有限尺寸、像素放置和局部裁剪 |
| ordered placement records | Tile、Obj 的已解析图像引用、几何、alpha/flip、排序结果 |
| depth interval / stack-rank | 将 Canvas 作为一个 Paint Unit 与 Actor 相互排序 |
| contentVersion/resource refs | 图片读取、版本验证和缓存失效 |

不得把原始 WZ 对象、不稳定 URL、业务角色状态或实时 Foothold 碰撞输入传给 Canvas 绘制组件。静态批次的确切 RenderNode data 格式、重复纹理与尺寸限制需另行冻结。

## 4. DOM 和更新

~~~text
ms-scene-view
├── ms-map-batch (depth interval A, Canvas)
├── ms-world-item → ms-avatar
├── ms-map-batch (depth interval B, Canvas)
└── ms-map-object (special Obj, separate Paint Unit)
~~~

- ms-map-batch 宿主参与 world-plane 的 CSS stack-rank；Canvas 的子像素无法单独在 DOM 中越过别的元素。
- 静态内容、Viewport/DPR 不变时复用缓存，不因为 Camera 每个像素平移而重画。
- Region 加载可创建新 Batch；增删 RenderNode children 需要一次 RenderDomain.replace，已有 Batch 的绘制数据可通过合法 update 更新。
- 不允许渲染器偷偷拆分为新的**受 LoomRealm 管理**的兄弟 RenderNode；结构改变应来自 Subsystem Render Projection。
- 资源完成后只重画受影响批次；单个 Canvas 必须在有效的完整资源集合就绪后再发布当前版本的像素，不出现半棵树后补前景。

## 5. 资源、错误和关闭

- 借助 Presentation Resource Client 加载版本化数据，组件内解码缓存和租约为 Renderer-local。
- 一个资源缺失、数据不合法或超预算时记录准确的 batch / placement / resource diagnostic，不默默跳过必需的实体并宣称整图成功。
- 遇到 sceneEpoch 变更、元素断连、window teardown，取消/失效过期绘制、释放缓存和时钟订阅（静态组件原则上不需时钟）。
- 占用内存应按 Canvas 像素总量 + 解码位图测量；不应无界地每个 placement 新建 Canvas。

## 6. 验收门

1. 真实地图中同一批次的 Tile/Obj 与 Avatar 不存在被跨越的必需深度插入点。
2. 同一 Obj 在 Avatar 之前/之后两种 Foothold 状态，静态批次不用全场重画。
3. 异步 PNG/Region 加载及稳定 tie-order；大地图滑动时峰值 Canvas 面积可控。
4. DPI/Camera/Canvas origin、alpha、flip、缩放和裁剪像素对照。
5. 新深度断点引发的 Batch 结构替换/新 key 规则真实运行通过。

来源：[OpenMS depth evidence](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/docs/client-evidence.md)、[旧 CMS079 tileKey/objKey](../../components/cms-map-layer/DESIGN.md)。
