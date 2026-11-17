# ms-world-item — 世界实体定位与深度宿主（首阶段设计草案）

> 状态：PROPOSED / NON-NORMATIVE / NOT IMPLEMENTED。首阶段必需；具体字段/schema 和是否必须单独成标签，仍待审查。
> 本标签主要承载玩家 Avatar，未来可复用到 NPC/Mob；见 [组件树](./FIELD-COMPONENT-TREE-DRAFT.md)。

## 1. 存在原因

同一个 Avatar 的身体动作和世界移动更新频率不同。ms-world-item 将游戏实体的**世界定位和全局遮挡**从内层视觉合成分离：

- 外层 ms-world-item：世界坐标（推荐以足底/业务锚点为输入）、已决定的世界堆叠顺序、可见性；只负责定位和 CSS stacking。
- 内层 ms-avatar：纸娃娃局部纹理、Action、表情、装备与独立的局部 Canvas。
- 外层位移不要求重画内层 Canvas；Avatar 换帧不要求重新计算 Foothold 或世界排序。
- 一名 Actor 对应一个外部 Paint Unit，而不是身体、武器、名称各自与世界地图排序。

该组件不是 Simulated Entity、Physics Body 或通用场景实体注册器。LoomRealm 仍通过 RenderNode key 管理 DOM 元素。

## 2. 结构和合法子节点候选

~~~text
ms-scene-view
├── ms-map-batch
├── ms-world-item (Actor A; world placement, stack-rank)
│   └── ms-avatar
│       └── ms-action[]
├── ms-map-object
└── ms-world-item (future Actor B)
    └── ms-npc
~~~

本阶段生产范围：仅要求一个玩家 ms-avatar。将来是否允许多个子视觉节点、ms-npc / ms-mob、Actor-relative nameplate，必须按明确的深度语义限制；**不得把任意世界效果放进当前 Actor 宿主内部**。

## 3. 输入语义（候选，非冻结 ABI）

| 输入 | 责任与约束 |
| --- | --- |
| stable actor presentation id / sceneEpoch | Subsystem Render Projection 赋予；不从 DOM 顺序推断 |
| world x/y + anchor convention | Subsystem 世界状态与已解析的美术锚点；必须固定足点/原点定义 |
| stack-rank（整数） | 同一 World Domain 的全局排序结果；包含 depth 与 tie-break 语义 |
| visibility / optional visual transform | 只影响宿主呈现，不修改业务实体是否存在 |
| 内层 RenderNode child | 首阶段仅为 ms-avatar 与其现有 ms-action 子树 |

世界 depth 由 Field Subsystem 的 Render Projection 根据 Foothold layer/group 等权威事实产生；ms-world-item **不读取 Foothold、不会自行 Y-sort**。原始 worldDepth/tieOrder 可以作为诊断数据，但由 Subsystem 发布最终 stack-rank。

## 4. DOM / CSS 规则

- 宿主参与 ms-scene-view World Plane 的可比较兄弟 Paint Unit 排序，使用已验证的正整数/有符号整数 CSS z-index 排序映射；必须处理 CSS 整数范围和相等顺序。
- 宿主定位 transform 更新由 world x/y 和公共 Camera Transform 组合完成：Camera 只在共同 world-plane 中施加一次，避免双重减 Camera。
- Avatar 内部 Shadow DOM 创建局部 stacking context 属于**正确的局部隔离**；不能把 Avatar 的装备 Sprite 提升到覆盖外部前景 Obj。
- 使用原点/足点对应的局部偏移，而不是按非透明像素包围盒重新居中；镜像与 facing 归 Avatar。
- 同一个宿主外层若设置 alpha、filter 等，影响其整个局部组合；名称/任务标签是否参与同样效果要以美术层级证据决定。

## 5. 更新、生命周期和失败

- 高频 x/y 走已有节点的 RenderDomain.update；仅更新宿主 transform，不触发内层 Canvas 重绘。
- action/expression 等由内层 ms-avatar 单独接收；一次换装的多节点一致性问题仍受当前 Avatar V1 的待验证边界约束，不能宣称已经有上游批次接口。
- depth 改变只更新 stack-rank 或由 Subsystem 按需要重排 Paint Unit；如果静态 batch 深度断点规划不足，**不允许世界宿主自行拆分 Canvas**。
- 结构替换通过 RenderDomain.replace，复用仍存活的稳定 key；删除过的 key 在同一 Domain 生命周期不能随意复活。
- 宿主断连/重连不应改变 Subsystem 的 Actor；本组件不接收攻击命中、死亡裁决或业务输入。
- 无效坐标、非整数 rank、不可定位的 anchor、sceneEpoch 错配应有组件诊断，拒绝渲染错误定位而不捏造缺省值。

## 6. 首阶段验收

1. Avatar 原地换帧时外层坐标不跳；移动时 Avatar Canvas 不重绘。
2. 同一个 Obj 在 Player 不同 Foothold depth 时从前景变后景；不依赖 screen-Y。
3. Camera 平移、resize、DPR 下 Actor 足点与地图 Foothold 视觉对齐。
4. 同深度多个 Actor（合成 fixture）tie-order 稳定；world-item 不创建新的协作 registry。
5. map replace /断连/重连后 key 和视觉相位符合 [Avatar V1](./ms-avatar.md) 约束。

OpenMS 参考：[Actor depth 与 tie-order](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/docs/client-evidence.md)。
