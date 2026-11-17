# ms-map-back — 背景与前景 Back Paint Unit（首阶段设计草案）

> 状态：PROPOSED / NON-NORMATIVE / NOT IMPLEMENTED。首阶段必需：先覆盖目标地图中实际使用的静态/基础 Back；动态和复杂视差功能按单独能力门推进。
> 参见 [组件树](./FIELD-COMPONENT-TREE-DRAFT.md) 与 [World Rendering Architecture](./WORLD-RENDERING-ARCHITECTURE-DRAFT.md)。

## 1. 组件职责

ms-map-back 表示一个**可参与世界排序的 Back 绘制单元**，既可能是普通背景（front=0），也可能是 Front Back（front 非 0）。内部根据已解析的 Back 呈现数据绘制图片、重复图像或局部 Canvas。

同类 Back 不强制共享一张最终 Canvas；若内部元素的深度或视差规则不同，不得无条件合成一组。此标签并不意味着所有 Back 都在 Avatar 下方。

## 2. OpenMS 依据与遮挡边界

[OpenMS Map draw ordering](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/docs/client-evidence.md) 的 GMS083 参考深度：

- 普通 Back：`B - 128000 + index*1000`（`front=0`）。
- Front Back：`B + 272000 + index*1000`（`front!=0`）。
- 增大 depth 对应更靠前的原版层级顺序，但同深度还要比较 renderer serial。

因此 Front Back 可以遮挡 Avatar，普通 Back 通常在 Avatar 后面；**这是 GMS083 行为参考，不是 CMS079 已验收的通用公式**。不能只按组件标签/资源名称为 Back 固定 CSS z-index。Back 仍由同一 World Depth Projection 给出 stack-rank。

## 3. 输入语义和布局（非 ABI）

| 候选输入 | 用途 |
| --- | --- |
| authored placement id / index / front | 静态身份、深度和稳定次序 |
| resource reference / animation frames | 获取已解析的图片资源；不得在 Renderer 再解析 WZ |
| origin、位置、flip、alpha | 像素对齐和画面合成 |
| type、rx、ry、cx、cy、repeat | 视差、平铺、滚动与间距规则（按来源验证后启用） |
| stack-rank、sceneEpoch | 外层 DOM 排序及旧异步回调隔离 |
| Camera 视觉状态 | 根据 Back 类型求可见重复区域 |

业务字段的具体 attrs/data 形状未冻结。Back 可以是 Canvas，也可以是独立图片宿主；不得使 Shadow DOM 内部元素突破宿主的外部 stack-rank。

## 4. 本阶段实现范围

- R1 参考目标：在三图上正确读取/显示已支持的普通 Back 和 Front Back，保持静态原点、前后遮挡、资源缺失诊断和 Camera 变化下的合理布局。
- 复杂重复/视差/auto-scroll 与有帧时序的背景，只有在覆盖目标内容并通过证据验证后才纳入；不能以不正确的简化默认值悄悄替代原数据。
- R2 参考目标：13 图的每张 Back presence、资源 closure 和可见画面都需独立验证；不意味着 R1 自动实现所有 type。

## 5. 更新、资源和性能

- 静态 Back 完成资源准备后优先保留位图/局部 Canvas；Camera 变更一般更新变换/重复区间，不重复解码。
- 需要滚动帧的 Back 由 Renderer-local visual clock 推进，不向 Field Subsystem 写回游戏时间。
- 对超大平铺背景按当前 viewport 限制重复份数，不申请地图总尺寸的无限 Canvas。
- 图像晚到、场景 epoch 失效、DOM 断连时拒绝过期绘制并释放租约；不改变游戏业务状态。

## 6. 禁止越界

不修改地图 Camera Intent、不决定 World depth、不决定 Map loading 成功、Portal 传送、不创建别的场景节点或控制 Avatar；本节点只绘制收到的背景。

## 7. 必需验证

1. 同图普通 Back / Front Back 和 Avatar 前后关系；Front Back 的不透明像素正确遮挡。
2. 源 Back 为空/缺失/图片错误时有稳定错误语义，不用透明像素伪装资源完备。
3. viewport resize、Camera、repeat type 的代表性截图与资源预算。
4. 与 ms-map-batch 同 depth 时的稳定 tie-order；异步加载不能影响结果。

来源：[OpenMS Background/Camera evidence](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/docs/client-evidence.md)、[旧 Map 背景研究](../../components/cms-map-layer/DESIGN.md)。

## 8. RenderNode ABI V1 — Back / Front Back

> 本节为可审查的 V1 候选形状。共享坐标、资源、rank 和错误语义见 [Field Paint Unit ABI](./FIELD-PAINT-UNIT-ABI-V1-DRAFT.md)。GMS083 深度公式只是来源证据，Renderer 消费已经算出的 rank。

### 8.1 attrs 完整闭集

`stack-rank`（必需，1..2147483646）、`visible`（必需）、`view-x` 和 `view-y`（必需，有限十进制字符串）。Back 的外部位置是**Viewport 内的呈现坐标**，不是普通 Obj 的 world-x/world-y；归属 World Depth Plane 仅为与 Actor 同域排序。

- 真实 DOM 中，world-plane 施加负 Camera 平移。ms-map-back 的私有 CSS 宿主位置应将 `view-x` 与根继承的 `--ms-scene-camera-x` 相加，将 `view-y` 与 `--ms-scene-camera-y` 相加，确保屏幕最终位置是 view-x/view-y。
- 初版由 Subsystem 侧的 Render Projection/背景布局适配产出这些 view 坐标，不要求 Back Custom Element 自己寻址其他组件的 Camera 或重跑 Subsystem 逻辑；未来可评估纯本地 viewport background layout，但必须另行明确输入和性能成本。
- 无 `world-x` 等普通世界坐标属性，以免 Camera 平移在两个地方计算。

### 8.2 data 完整闭集

~~~ts
interface MapBackDataV1 {
  formatVersion: 1;
  sceneEpoch: string;
  placementId: string;
  front: boolean;           // authored front，决定投影侧 depth 规则；不由组件设 rank
  source: {
    type: 0;                // 首阶段只收敛原版 type0；其他 type = SCHEMA_UNSUPPORTED
    rx: number; ry: number;
    cx: number; cy: number;
  };
  image: ImageRegionV1;     // 完整 Content ResourceRef + 页宽高 + source
  draw: StaticDrawV1;       // origin/flip/opacity；全帧透明边缘不得被任意 trim
}
~~~

`source.rx/ry/cx/cy` 均为有限数值，保留用于审计或后续背景布局；不代表 type1..4 已实现。Source Canvas 页的真实解码尺寸必须等于声明宽高；图像尺寸与裁剪区域按共享 ABI 校验。`front` 与实际 stack-rank 在投影侧必须一致，Renderer 不借前景布尔值擅自提升到顶层。

~~~json
{
  "key": "back:field-epoch-1:0",
  "tag": "ms-map-back",
  "attrs": { "stack-rank": "10", "visible": "true", "view-x": "0", "view-y": "0" },
  "data": {
    "formatVersion": 1, "sceneEpoch": "field-epoch-1", "placementId": "back:0", "front": false,
    "source": { "type": 0, "rx": 0, "ry": 0, "cx": 0, "cy": 0 },
    "image": {
      "resource": { "namespace": "map", "key": "examples/back/0.png", "contentVersion": "sha256:0000000000000000000000000000000000000000000000000000000000000000" },
      "pageWidth": 32, "pageHeight": 32, "source": { "x": 0, "y": 0, "w": 32, "h": 32 }
    },
    "draw": { "origin": [0, 0], "flip": false, "opacity": 255 }
  },
  "children": []
}
~~~

示例图片资源身份为**占位结构演示**，不宣称该 Content key 实际存在，也不说明 OpenMS 图片存储格式。

### 8.3 更新、状态与错误

- children 必须为空；任何业务 Render Event 均不属于本 V1；自身不触发逆向 InputGate 事件。
- view-x/view-y/visible/stack-rank 走已有节点 attrs Update，不重复下载、解码静态图片。
- source/image/draw 改变时使用 top-level data.set 更换完整成员；`receiveRenderData` 收到完整 data，先验证、再用缓存或异步重画。
- 新 Content 解码未完成时保持 hidden/pending，旧 epoch 回调丢弃；必须有 SOURCE-EMPTY / SOURCE-ABSENT / RESOURCE-MISSING 外层业务分类，Element 不应凭缺文件猜测“透明背景”。
- 若存在 type1..4、无关原版 Back 属性或要求动态滚动的素材，不能默默把它当作 type0；需提交扩展 ABI 后单独验收。

### 8.4 专项测试

普通 Back / Front Back 深度、同深度序号、alpha/flip/origin、Camera 与 viewport 修正、不同 DPR、未知 type、contentVersion mismatch、资源取消、跨图相同 placementId 新 epoch。

