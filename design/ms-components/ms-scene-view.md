# ms-scene-view — Field 世界呈现根（首阶段设计草案）

> 状态：PROPOSED / NON-NORMATIVE / NOT IMPLEMENTED。首阶段必需；本文不是已批准的组件 ABI。
> 总体关系见 [首阶段组件树](./FIELD-COMPONENT-TREE-DRAFT.md)；深度和绘制原则见 [World Rendering Architecture](./WORLD-RENDERING-ARCHITECTURE-DRAFT.md)。

## 1. 产品用途和位置

承载三图移动、Camera、静态地图与玩家交错遮挡、Portal 切图等首阶段视觉画面。一个 Field World RenderDomain 建议只有一个 ms-scene-view 根；不同世界对象的 Paint Units 由 LoomRealm 投影为本节点直属 Light DOM children。此处的“一个根”不等于“一个 Canvas”。

本节点负责 viewport、可裁剪世界视图、Camera 的视觉变换、共享的 World Depth Plane 和可验证的场景视觉可见性。它不持有权威世界物理、Portal 触发或地图数据流转逻辑。

## 2. DOM / Canvas 边界

候选私有 Shadow DOM：

~~~html
<ms-scene-view>
  #shadow-root
    <div class="viewport">
      <div class="world-plane"><slot></slot></div>
    </div>
</ms-scene-view>
~~~

- viewport 负责可见裁剪；world-plane 提供统一 Camera 坐标变换和**共同** stacking context。
- slot 只展示 WebProjector 托管的直属 Light DOM children；不得自行移动、克隆、重建或维护第二份 RenderNode 身份表。
- 直属 Paint Units（ms-map-back、ms-map-batch、ms-map-object、ms-world-item、ms-portal-visual 等）使用同一深度堆叠序号空间。
- 不能使用分类包装层将全部地图节点或所有角色包成互相不可穿插的 stacking context。子元素自身的 Shadow DOM 和局部 Canvas 可以独立。
- world-plane 的绝对定位、containing block、slot flattening、DPR、Camera 取整及坐标原点为**浏览器集成验证项**，不是凭该树自动保证。

## 3. 候选数据输入（非冻结 ABI）

| 输入语义 | 权威/来源 | 呈现作用 |
| --- | --- | --- |
| sceneEpoch / 当前地图呈现身份 | Field Subsystem Render Projection | 隔离旧场景资源回调和局部缓存 |
| camera / viewport 状态 | Subsystem 提供 Camera Intent；浏览器提供视口像素信息 | 世界→屏幕变换和裁剪 |
| renderVisible / transition state | 游戏呈现策略 | 场景切换时阻止半成品画面外露 |
| 子节点列表及排序 | 同一个 World RenderDomain 的 RenderNode tree | LoomRealm 托管的 DOM 结构和 Paint Unit 身份 |

上述只是字段**语义**；具体 attrs/data 名称、Camera 插值、资源就绪协议、Scene key/epoch 更新规则均未冻结。节点须使用 LoomRealm 固定五字段 RenderNode，不新增自定义平台 Render message。

## 4. 遮挡和绘制

- 根本身不拥有世界 depth；每个直属 Paint Unit 拥有由 Subsystem 投影的确定性 stack-rank。
- world-plane 的 DOM 层叠是**最终视觉合成**：来自静态 Canvas 的像素、独立 Obj、Avatar 本地 Canvas 按宿主层叠排序。
- Camera 改变原则上只更新 world-plane transform；普通静态 Canvas 不因每个 Camera 像素位移重画。
- Back 视差/重复/滚动可能需要局部抵消或额外 Camera 输入；不得把 Back 视为普通世界坐标平移的同义词。
- HUD 不作为本阶段的世界直属子节点；后续屏幕 UI 可放独立 Domain。

## 5. 与 LoomRealm 的更新/生命周期

- WebProjector 按 RenderNode 身份创建/复用/删除 managed Light DOM；本节点只管理自己的 Shadow DOM、订阅和临时资源。
- 已有场景根的 attrs/data 变化可走 RenderDomain.update；增删/重排 children 必须 RenderDomain.replace。
- Domain retained commit 原子并不保证所有子 Canvas 已完成资源解码/像素提交；场景过渡必须有明确的可见性策略。**不得声称 LoomRealm 已支持 ProjectionBatch。**
- 断连时停止私有 visual-only 工作并使过期异步回调失效；重连需从最新 retained 状态恢复而非重放旧 Portal 事件。
- 如果提供 RenderClockProvider，仅是候选业务侧 Renderer-local service，必须与现有 [ms-avatar Clock V1](./ms-avatar.md) 契约一致；不可取代 Simulation Clock。

## 6. 禁止越界

不计算 Foothold、Movement、游泳/跳跃、相机业务跟随决策、Portal destination、资源 closure、场景切换 gameplay commit；不允许根据“子 DOM 都已出现”推断 gameplay 已完成。

## 7. 首阶段验收与未决

1. 三图进入/离开、同图传送和跨图切换时 DOM identity、sceneEpoch、旧资源回调隔离。
2. slotted 静态 Canvas、ms-world-item、独立 Obj 的 stacking context 能真实交错，前景不会被父组截断。
3. Camera 滚动时静态地图不整张重绘；resize、DPR、像素采样与裁剪正确。
4. 慢图像解码、缺文件、投影失败时不出现旧/新地图混合；具体 visible/ready gate 策略待审查。
5. PWA / Hostra 登记同一组件集合并跑 Chromium E2E。

上游依据：[WebProjector](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/packages/renderer/src/internal/web-projector.ts)、[Render Update](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/render-update-v1.md)。

## 8. RenderNode ABI V1 — 具体候选契约

> 本节为可实现/可评审的 V1 **proposal**，是第 3 节概念输入的具体化；与 [共享 ABI](./FIELD-PAINT-UNIT-ABI-V1-DRAFT.md) 一同解释。没有修改 LoomRealm 五字段格式。

### 8.1 attrs 完整闭集

| 属性 | 必需 | 语法/含义 |
| --- | --- | --- |
| `camera-x` | 是 | 有限十进制字符串；权威 Camera 左上角 world x；不可由浏览器重新计算跟随物理 |
| `camera-y` | 是 | 同上，world y |
| `visible` | 是 | `true` / `false`；仅显示门闩，不是 Portal 提交标志 |

无 `stack-rank`、`world-x`、`world-y`：场景根自己不参与 Field 世界排序。Camera 初始化/resize 更新不得偷偷修改受管理的属性，只依据 attrs 派生私有 CSS 变量。

### 8.2 data 完整闭集

~~~ts
interface SceneViewDataV1 {
  formatVersion: 1;
  sceneEpoch: string;         // 本次地图可视代际；非空、对地图切换生成新值
  mapId: string;              // 十进制地图 ID；非空，按当前 map allowlist 校验
  pixelSnap: "round";        // 本版仅一种量化策略，后续策略另行版本化
}
~~~

`sceneEpoch` 不是 LoomRealm generation，也不是资源 contentVersion；同图 Portal 移动一般保留，同一场景的 Camera/position 帧更新不产生新 epoch。新的跨图资源阶段必须变更 epoch，并保证新子节点 key 的 one-shot 生命周期约束。

### 8.3 children 闭集

首阶段只允许直属标签 `ms-map-back`、`ms-map-batch`、`ms-map-object`、`ms-world-item`、`ms-portal-visual`。数量依地图内容决定；`ms-world-item` 下面必须是当前 V1 的 `ms-avatar`（其后才能有 `ms-action[]`）。不允许直接嵌套玩家到 `ms-map-batch`，也不为所有地图组件添加一个封闭 ms-map 父层。用于额外未来组件的扩展必须版本化/复审。

~~~json
{
  "key": "scene:world",
  "tag": "ms-scene-view",
  "attrs": { "camera-x": "0", "camera-y": "0", "visible": "true" },
  "data": { "formatVersion": 1, "sceneEpoch": "field-epoch-1", "mapId": "222000000", "pixelSnap": "round" },
  "children": []
}
~~~

这里的空 children 是一个**合法空壳示例**，只用于定义节点形状；不可因此宣称地图加载成功或画面完整。实际场景由完整受管理子树构成。

### 8.4 DOM 映射、更新原子性

- 根内部 `world-plane` 维护私有 CSS 自定义属性 `--ms-scene-camera-x` / `--ms-scene-camera-y`（长度 px）；普通世界 Paint Unit 随整个 world-plane 的 `translate(-cameraX,-cameraY)` 平移。
- 特殊 Back 通过继承这些 CSS 属性抵消公共平移，使用其自己的 viewport-relative view-x/view-y；在 Chromium 中验收 computed transform、slot inheritance、包含块和 CSS stack。
- `visible=false` 仅隐藏本场景画面；不由 Element 自己发布结构变更。重新显示必须遵循资源/场景可见性策略。
- Attrs 顺序写入时组件可在一次微任务/下一绘制机会合并读取，避免独立 x/y 采样造成中间态；不会把 DOM 数据回写 Subsystem。
- 同 mapEpoch 的 Camera update 推荐仅改变 attrs；新地图同时更换 data 与 children 则使用一次权威 Domain 结构提交；**局部图片资源的 ready 仍是异步**，场景可见性 gate 需专项实现。

### 8.5 验收

- 只有根允许没有 stack-rank；新子节点均拥有唯一 stack-rank。
- 更新 Camera 不触发静态地图全量 Canvas 重画；地图像素与玩家足点一致。
- 保证 ms-map-back 在 Camera 移动时正确抵消/执行背景视差，而非 Camera 双重扣减。
- MapId/sceneEpoch 非法或未知字段均 fail closed；新旧图异步回调不得交叉。

