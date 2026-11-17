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
