# MS 组件与首阶段场景设计索引

> **状态：Design Baseline Reset；以下组件均未批准、未冻结、未实现。**
> `ms-avatar` / `ms-action` 是此前保留的详细候选；其余六个标签和组件树是 DOM + Multi-Canvas 方向下的讨论草案，不是已批准 Scene ABI。

## 1. 上游设计入口

阅读组件前先确认组件接收到的数据来自哪里：

1. [设计总入口](../README.md)
2. [产品目标与阶段范围](../product/PRODUCT-GOALS.md)
3. [LoomRealm 运行时与渲染架构](../architecture/LOOMREALM-RUNTIME-AND-RENDERING.md)
4. [Field 内容到画面的投影管线](../architecture/FIELD-PROJECTION-PIPELINE.md)
5. [FSDB 内容模型](../content/FSDB-CONTENT-MODEL.md)
6. [OpenMS 开发参考](../references/OPENMS-DEVELOPMENT-REFERENCE.md)

组件不是直接读取 FSDB 的业务对象。FSDB/WZ 解析、Movement、Camera、Portal、世界排序和 Paint Unit 切分在 Subsystem/Adapter/Projection 一侧完成；组件只消费 render-ready presentation state。

## 2. 本目录阅读顺序

1. [首阶段组件树、层级与遮挡关系](./FIELD-COMPONENT-TREE-DRAFT.md)
2. [DOM + Multi-Canvas 世界渲染架构](./WORLD-RENDERING-ARCHITECTURE-DRAFT.md)
3. [Field Paint Unit 共享 ABI 草案](./FIELD-PAINT-UNIT-ABI-DRAFT.md)
4. 下表中的单组件文档

历史 [RenderNode / Scene ABI v2 探索](./RENDERNODE-ARCHITECTURE.md) 和 [旧基线审计](./RENDERNODE-BASELINE-AUDIT.md) 只用于溯源，不应覆盖当前方向。

## 3. 首阶段候选组件

| 标签 | 候选必要性 | 文档 | 视觉职责 | 不拥有 |
| --- | --- | --- | --- | --- |
| `ms-scene-view` | 基础 | [ms-scene-view](./ms-scene-view.md) | viewport、world-plane、Camera transform、场景裁剪 | Camera follow、地图切换权威 |
| `ms-map-back` | 基础 | [ms-map-back](./ms-map-back.md) | ordinary/front Back、局部重复/视差画面 | Camera state、世界排序推导 |
| `ms-map-batch` | 基础 | [ms-map-batch](./ms-map-batch.md) | 有限尺寸静态 Tile/Obj Canvas batch | batch planning、Foothold、动态插入判断 |
| `ms-world-item` | 基础 | [ms-world-item](./ms-world-item.md) | Actor 世界位置、显隐、外部 rank | Movement、碰撞、y-sort |
| `ms-avatar` | 基础 | [ms-avatar](./ms-avatar.md) | 纸娃娃局部 Canvas、视觉帧 | FSDB 查询、外层世界位置 |
| `ms-action` | Avatar 候选结构需要 | [ms-action](./ms-action.md) | Action Clip 数据子节点 | 独立绘制、业务动作完成 |
| `ms-map-object` | 按内容需要 | [ms-map-object](./ms-map-object.md) | 需独立更新/深度的 Obj | 普通静态 Obj 批处理规划 |
| `ms-portal-visual` | 按可见内容需要 | [ms-portal-visual](./ms-portal-visual.md) | Portal 图片/动画 | trigger、target、cooldown、travel |

`ms-map-object` 和 `ms-portal-visual` 不是每条内容记录都必须创建。移动、Foothold、Camera 和 Portal travel 有业务逻辑，也不因此新增视觉 Custom Element。

首阶段暂不包含 `ms-npc`、`ms-mob`、`ms-reactor`、`ms-map-animation`、`ms-world-effect`、`ms-effect-batch` 和 `ms-hud`。

## 4. 实际树与画面树

候选 LoomRealm RenderNode tree：

```text
ms-scene-view
├─ ms-map-back
├─ ms-map-batch
├─ ms-world-item
│  └─ ms-avatar
│     └─ ms-action
├─ ms-map-object
└─ ms-portal-visual
```

`ms-scene-view` 的 Shadow DOM 候选：

```html
<div class="viewport">
  <div class="world-plane">
    <slot></slot>
  </div>
</div>
```

WebProjector 管理 Light DOM 节点、attrs、data、children 和顺序。组件只管理自己的 Shadow DOM、Canvas、图片和视觉相位。

需要跨类型遮挡的 Paint Unit 必须在同一个 world-plane 可比较。不要把所有地图节点或所有 Actor 包进不能穿透的类型 stacking context。

## 5. Canvas 原则

- 六种画面职责不等于六张固定 Canvas。
- 不按八个 Map layer 固定创建八张 Canvas。
- 不创建世界尺寸大 Canvas。
- 静态 Tile/Obj 只在最终深度序列连续且无动态插入点时合批。
- Avatar 使用局部 Canvas；世界移动只更新外层宿主。
- Camera 优先移动共同 world-plane，不逐像素重绘静态 Canvas。
- 独立动态 Obj/Portal/Actor 可以拥有自己的图片或局部 Canvas。

## 6. 组件文档统一要求

每份组件文档进入批准评审前应包含：

1. 状态、职责和非目标；
2. FSDB/Adapter/Subsystem 上游来源；
3. `FSDB-FACT`、`CMS079-PROVEN`、`OPENMS-REFERENCE`、`PRODUCT-DECISION` 边界；
4. RenderNode `key/tag/attrs/data/children` 闭集；
5. Light DOM、Shadow DOM、Canvas 真实结构；
6. 坐标、anchor、世界排序或局部排序；
7. `replace/update/emit` 语义；
8. visual clock 与 Simulation Clock 边界；
9. Content resource、取消、缓存和旧回调处理；
10. 错误、last-good、断连和 teardown；
11. 容量与性能测量项；
12. Adapter、RenderNode、Chromium、像素和故障测试。

## 7. 无组件 Schema 版本协商约定

当前候选组件 data 不设置 `formatVersion`、`schemaVersion` 或兼容分支。契约变化直接修改组件文档、Validator、投影和测试。

`ResourceRef.contentVersion` 是 LoomRealm Content 内容身份/完整性参数，不是组件 Schema 版本，必须保留。

该约定本身仍是候选设计；如果未来需要并行兼容多个产品安装版本，应单独重新审查，而不是在组件内悄悄接受未知字段。

## 8. LoomRealm 边界

固定 LoomRealm 提供：

- 五字段 RenderNode；
- `RenderDomain.replace/update/emit/close`；
- Render Update Registry/Snapshot/Patch/Event；
- Renderer Store；
- WebProjector；
- PresentationResourceClient。

固定提交不提供：

- Adventure Island World Renderer；
- 自动 Canvas batching；
- RenderProjectionBatch；
- 跨组件像素 ready transaction；
- RenderClockProvider；
- 全局 decoded image cache；
- Scene transition gate。

组件文档出现这些名称时必须标明为待批准的内部能力，不能写成平台现有 API。

## 9. 旧运行路径

当前实际 PWA 仍注册 `cms-actor`，`systems/adventure-map` 只投影一个居中的旧 Actor 并将输入映射为 stand/walk/jump。旧实现可以验证局部 Canvas、资源读取、帧播放和位置更新分离，但不能作为新 `ms-*` ABI 已实现的证据。
