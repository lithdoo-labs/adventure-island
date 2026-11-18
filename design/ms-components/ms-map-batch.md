# ms-map-batch — 静态 Tile / Obj 深度安全 Canvas 批次（首阶段设计草案）
> **契约维护：不做组件 ABI / Schema 版本管理。** 字段和行为变化直接更新本文件与实现，不设置 `formatVersion` / `schemaVersion`，不做版本协商、兼容分支或迁移。ResourceRef 的 `contentVersion` 是 LoomRealm Content 资源身份，不是组件版本。


> 状态：PROPOSED / NON-NORMATIVE / NOT IMPLEMENTED。首阶段必需；不冻结最大 Canvas 尺寸、实际批次数量或静态 Batch Planner 算法。
> 参见 [组件树](./FIELD-COMPONENT-TREE-DRAFT.md)、[架构草案](./WORLD-RENDERING-ARCHITECTURE-DRAFT.md)。
> placement、frame 和 source order 见 [FSDB 内容模型](../content/FSDB-CONTENT-MODEL.md)；排序和 batch 切分属于 [Field 投影管线](../architecture/FIELD-PROJECTION-PIPELINE.md)，不在本组件内执行。

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
| batch id / region id | 稳定身份、资源代际和可释放范围 |
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
- 遇到 RenderNode key 变更、元素断连、window teardown，取消/失效过期绘制、释放缓存和时钟订阅（静态组件原则上不需时钟）。
- 占用内存应按 Canvas 像素总量 + 解码位图测量；不应无界地每个 placement 新建 Canvas。

## 6. 验收门

1. 真实地图中同一批次的 Tile/Obj 与 Avatar 不存在被跨越的必需深度插入点。
2. 同一 Obj 在 Avatar 之前/之后两种 Foothold 状态，静态批次不用全场重画。
3. 异步 PNG/Region 加载及稳定 tie-order；大地图滑动时峰值 Canvas 面积可控。
4. DPI/Camera/Canvas origin、alpha、flip、缩放和裁剪像素对照。
5. 新深度断点引发的 Batch 结构替换/新 key 规则真实运行通过。

来源：[OpenMS depth evidence](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/docs/client-evidence.md)、[旧 CMS079 tileKey/objKey](../../components/cms-map-layer/DESIGN.md)。

## 7. RenderNode ABI — 静态 Canvas Batch

> 本节把第 3 节候选输入落为可验证的 当前 JSON 形状；尚非获批的 ABI。通用 ResourceRef/stack-rank/状态见 [共享 ABI](./FIELD-PAINT-UNIT-ABI-DRAFT.md)。

### 7.1 attrs 完整闭集

仅 `stack-rank`（必需、唯一、正整数）和 `visible`（必需、true/false）。Batch 的 world origin、绘制列表和 atlas 内容**不**靠每 Tile DOM attrs 承载；静态批次的画面整体位于同一个 World Plane 中。

### 7.2 data 完整闭集

~~~ts
interface MapBatchData {
  batchId: string;
  bounds: { x: number; y: number; w: number; h: number }; // world rect；w/h positive integer
  sprites: {
    pages: Record<string, {
      resource: ResourceRef;
      width: number; height: number; // positive integer; decoder must match
    }>;
    items: Record<string, {
      page: string;                  // key in pages
      source: SourceRect;
      origin: [number, number];      // placement local anchor
    }>;
  };
  placements: Array<{
    placementId: string;            // unique in scene, and not duplicated as ms-map-object
    kind: "tile" | "obj";
    sprite: string;                 // key in sprites.items
    x: number; y: number;           // world anchor location
    flip: boolean;
    opacity: number;                // integer 0..255
    order: { depth: number; tieOrder: number }; // safe integers; strictly ordered tuple
  }>;
}
~~~

- `placements` 数组顺序是**从背景到前景的真实绘制顺序**，必须按 `(order.depth, order.tieOrder)` 严格递增；至少一条，禁止 duplicate placementId。`depth` 是本游戏已验证的 world ordering value，**不是 zIndex**；`tieOrder` 保留静态 authored 顺序，不受资源完成时间影响。
- 整体 Batch 是可与其他 Paint Units 比较的**一个** stack-rank。所有内部 placement 的顺序必须在全部可达动态插入深度下形成连续安全区间；跨入者必须触发 Batch Planner 拆分，不能只更改这个 Canvas 的 z-index。
- 所有 page/item 引用必须存在，SourceRect 不越界；placement world anchor 与 image origin 计算左上位置 `(x-originX,y-originY)`，镜像时以 anchor 为中心而不是凭空修改足点。
- bounds 必须覆盖各 placement 在批次中实际可能绘制的区域，且 Canvas 尺寸/总像素有业务配置限额。需要裁剪时按 world rect 做局部 Canvas 坐标偏移，不能清空画布后丢失未加载条目。
- 当前仅允许静态图像；动画 Obj flow、frame clock、Tile 材质动态替换需要新能力方案，不能静默取第一帧。

### 7.3 最小 RenderNode 示例

~~~json
{
  "key": "batch:map222000000:region0:band0",
  "tag": "ms-map-batch",
  "attrs": { "stack-rank": "20", "visible": "true" },
  "data": {
    "batchId": "region0:band0",
    "bounds": { "x": 0, "y": 0, "w": 32, "h": 32 },
    "sprites": {
      "pages": {
        "p0": { "resource": { "namespace": "map", "key": "examples/static-atlas.png", "contentVersion": "sha256:0000000000000000000000000000000000000000000000000000000000000000" }, "width": 32, "height": 32 }
      },
      "items": { "tile0": { "page": "p0", "source": { "x": 0, "y": 0, "w": 32, "h": 32 }, "origin": [0, 0] } }
    },
    "placements": [
      { "placementId": "tile:0:0", "kind": "tile", "sprite": "tile0", "x": 0, "y": 0,
        "flip": false, "opacity": 255, "order": { "depth": 19990, "tieOrder": 0 } }
    ]
  },
  "children": []
}
~~~

示例 `depth=19990` 仅演示去掉 OpenMS GMS083 共用偏移后的一个参考数量；不得拿来当作 CMS079 冻结常数。资源 key 为占位例子。真实 world depth 编码需与所有 Paint Unit 使用同一深度体系，不能部分去 B、部分保留 B。

### 7.4 更新与资源原子性

- children 必须为空；incoming RenderEvent：无；outgoing `emitCustomEvent()`：无。图片加载完成仅触发该组件自己的局部 Canvas 构建，不作为业务事件。
- unchanged static data 不重绘。Canvas DPR/尺寸、资源版本或 placements 变化时，先验证新完整 data，准备离屏临时表面，待所有**该批次**必需图像解码成功后一次切换到新 Canvas 内容；资源失败不得显示一半旧图一半新图。
- Camera x/y 更新由父级 world-plane transform 处理，Canvas 不重画；Batch bounds/placements 的世界坐标必须使其内屏幕像素与 ms-avatar 保持对齐。
- 变更 placements 但保留 Batch 身份可用 top-level data.set；若是分裂为两个 RenderNode，旧 Batch 要么继续保留并更新其内容、要么删除并用**新 key**发布新的节点；严禁同一 scene 中同时画到 batch 和 ms-map-object。
- Batch 层面的完整画面原子不等于世界全部 Canvas 同帧原子；Scene visible gate 仍需专门设计。

### 7.5 错误/验收

不允许空 pixels 静默代替缺少 PNG、非法 sourceRect、未知 kind、重复 id、非法 depth/tie、越界坐标、超预算的 Canvas。测试包含 Avatar 可插入的安全断点、Front Back、静态 Batch 内 Tile/Obj 混绘、Region 晚加载、换图、DPR/Viewport 下 alpha/flip。

