# ms-map-object — 独立地图 Obj Paint Unit（首阶段设计草案）

> 状态：PROPOSED / NON-NORMATIVE / NOT IMPLEMENTED。本阶段**按内容与遮挡需要启用**；并非每个静态 Obj 都要有独立 DOM。
> 参见 [组件树](./FIELD-COMPONENT-TREE-DRAFT.md)、[ms-map-batch](./ms-map-batch.md)。

## 1. 与 ms-map-batch 的明确区别

大量 Tile/普通静态 Obj 使用 ms-map-batch 的局部 Canvas；ms-map-object 仅表示**需要独立深度/局部更新/裁剪/视觉处理的 Obj**，让浏览器将其作为一个可独立叠放的 DOM Paint Unit。

适用实例：大型树干或牌匾需要遮挡角色、静态合批会阻断 Avatar/NPC 插入点、需要独立裁剪、滤镜、局部资源驻留等。不能因为每个 Obj 天然独立就为所有 Obj 创建 Custom Element。

## 2. OpenMS 排序与遮挡

OpenMS/GMS083 地图 Obj 参考深度：`B + 2000 + layer*30000 + obj.z`，而本地 Player 参考为 `B + 29992 + (activeController?5:0) + (layer*3000-group)*10`。同一 Obj 在不同 Foothold 深度的 Actor 前后关系可以变化。

所以：

- 同一 ms-map-object 可能遮挡某一 Avatar，也可能在另一 Avatar 背后。
- 宿主的 stack-rank 来自 Subsystem Render Projection；不根据图片透明像素或屏幕 y 决定层级。
- 图像透明区域允许看见后面的角色；外层 DOM 深度只决定绘制先后。
- 不把多个不同深度 Obj 包入一个阻断交错的分类 stacking context。
- 为避免重复绘制，**某 Obj placement 必须且只能属于一个视觉单元**：要么属于静态 ms-map-batch，要么独立为 ms-map-object。

以上参考公式未确认为 CMS079 事实，具体排序与同深度比较仍需 CMS079 审计。

## 3. 数据输入（候选，非冻结 ABI）

| 输入语义 | 含义 |
| --- | --- |
| placementId / authored index / sceneEpoch | 稳定放置身份、局部代际；不得随图片网络完成顺序变化 |
| world position、origin、mirror、alpha | 美术定位与变换；保持原始锚点 |
| resource ref / texture frame | 经 Adapter 处理的资源；允许普通 img 或局部 Canvas |
| stack-rank | 与地图批次、Avatar 等共享的世界叠放整数 |
| static/animated rendering mode（如需要） | 仅呈现实现差异；业务状态由 Subsystem 决定 |

## 4. DOM / Canvas 形态

~~~text
ms-scene-view
├── ms-map-batch           (静态 Canvas A)
├── ms-world-item
│   └── ms-avatar
├── ms-map-object          (独立 img 或局部 Canvas，遮挡 Avatar)
└── ms-map-batch           (静态 Canvas B)
~~~

默认优先选择静态图片 DOM（若一帧一图、裁剪可行）；复杂 alpha/局部动画才使用 Canvas。外层元件必须参与 world-plane 的 CSS stacking；内部 Shadow DOM 只能局部绘制，不构成跨组件排位权威。

## 5. 资源、更新、生命周期

- 静态 Obj 加载成功后可一直保持自己的 decoded image；Camera 移动通过公共 world-plane transform，不重新解码图片。
- 图片解码晚到时先核对 sceneEpoch/contentVersion，过期回调不得提交到新场景。
- 若由静态批次升级为独立对象，Render Projection 负责旧批次数据更新和新 DOM key 的结构发布；不能同一帧重复绘制同一 placement。
- 无图片、超预算、错误 origin/opacity、Renderer 断连均要有诊断与清理，不得改变地图业务 state。
- 本阶段不强制支持动画 Obj flow；出现 flow 数据时应按已审批能力选择独立的动画组件或明确 unsupported，不能静默画第一帧冒充完整实现。

## 6. 首阶段验收

1. Tree/Obj 可在前景遮挡 Avatar，并在 Avatar 另一 Foothold 层时位于其后。
2. 与 ms-map-batch 不重复绘制、不漏图；边界切换后深度稳定。
3. opacity、flip、origin、Camera、DPR 的像素对齐与局部资源缓存正确。
4. 大量 Obj 不无条件 DOM 化；对比批次和独立节点的成本并记录预算。

来源：[OpenMS Map depth](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/docs/client-evidence.md)。

## 7. RenderNode ABI V1 — Independent Static Obj

> 本阶段仅静态 Obj 的独立 Paint Unit；其他复杂 flow 动画尚不在本 ABI。共享 ResourceRef、坐标、rank、错误与生命周期见 [共享 ABI](./FIELD-PAINT-UNIT-ABI-V1-DRAFT.md)。

### 7.1 attrs 完整闭集

`world-x`、`world-y`、`stack-rank`、`visible`，均为必需。world-x/y 是 Obj authored world anchor，不是左上角；z-index 使用投影完成的独立 Paint Unit stack-rank。不能使用 y-sort，也不能直接从 Obj.z 设置 CSS rank。

### 7.2 data 完整闭集

~~~ts
interface MapObjectDataV1 {
  formatVersion: 1;
  sceneEpoch: string;
  placementId: string;          // 场景内唯一；不得同时在 ms-map-batch 中出现
  image: ImageRegionV1;        // 完整 Content 资源及裁剪矩形
  draw: StaticDrawV1;          // origin/flip/opacity
}
~~~

`image.pageWidth/pageHeight` 必须与真实解码图像尺寸相符；`image.source` 必须完整落在页内。`draw.origin` 的值相对 source 小图，不得自动去透明边或让浏览器重新锚点居中。`flip` 为围绕 origin 的水平镜像，`opacity` 为整数 0..255。

~~~json
{
  "key": "obj:field-epoch-1:layer3:14",
  "tag": "ms-map-object",
  "attrs": { "world-x": "512", "world-y": "192", "stack-rank": "40", "visible": "true" },
  "data": {
    "formatVersion": 1, "sceneEpoch": "field-epoch-1", "placementId": "obj:layer3:14",
    "image": {
      "resource": { "namespace": "map", "key": "examples/object/tree.png", "contentVersion": "sha256:0000000000000000000000000000000000000000000000000000000000000000" },
      "pageWidth": 64, "pageHeight": 96,
      "source": { "x": 0, "y": 0, "w": 64, "h": 96 }
    },
    "draw": { "origin": [32, 96], "flip": false, "opacity": 255 }
  },
  "children": []
}
~~~

示例中的图片 key、绘制尺寸、layer 都是**演示性占位数据**；不是当前 CMS079 地图的真实 placement/PNG。

### 7.3 结构、绘制、更新

- children 必须为空，不能再嵌套地图 Canvas 或 Avatar；不处理业务 RenderEvent，也不调用 emitCustomEvent。
- 宿主可以在 Shadow DOM 中呈现一个 image/Canvas，但外部始终是一个可与 ms-world-item 交错的 Paint Unit；opacity 与 flip 只作用于这个局部 Obj。
- world-x/y、stack-rank 和 visible 的改变走 attrs Update；与同一 Obj 的图像/SourceRect/alpha 变更走 top-level data Update，并在 receiveRenderData 完整验证后处理。
- 静态内容下载解码完成后原则上无需跟随 Camera 重新画；公共 world-plane CSS transform 统一移动本 Obj。
- 同一 placementId **恰属一个可见提供方**，由 Map Render Projection 在 ms-map-batch 与 ms-map-object 之间择一；若切换策略涉及新节点，发布新 key 而不是复用删除过的 key。局部 DOM 不能自行解除另一静态 Batch 的内容。
- 如果单张 Obj 在不同 Actor layer 之间必须改变遮挡关系，只更新 Actor/Obj 的 stack-rank；大多数静态 Obj 不需要重新 rasterize。

### 7.4 错误与首阶段测试

拒绝未知 data 字段、非法资源版本/裁剪、异常原点、无效坐标、重复 placementId 和与 Batch 的重复输出；资源失败仅影响呈现和场景 ready 策略，不触发 Portal 或模拟回滚。测试覆盖前景树/后景树、透明像素、图片加载顺序无关的 tie-order、Camera/DPR、节点断连和地图 epoch 切换。

