# ms-portal-visual — Portal 可见外观（首阶段设计草案）

> 状态：PROPOSED / NON-NORMATIVE / NOT IMPLEMENTED。首阶段**仅在目标地图有可见 Portal 外观需求时启用**；Portal 触发与场景迁移功能本身**不依赖这个标签**。
> 参见 [组件树](./FIELD-COMPONENT-TREE-DRAFT.md) 与 [ms-scene-view](./ms-scene-view.md)。

## 1. 不等于 Portal Subsystem

ms-portal-visual 是普通的 Renderer-only Paint Unit：显示 Portal 静态图片或动画、面向世界定位并参与必要的遮挡排序。

它**不是**可交互的 Portal 触发区、tm/tn 解析器、地图目标索引或迁移命令发出者。玩家按 Up、Portal 命中范围、冷却和 same-map/cross-map 迁移都由 Subsystem 处理，输入仍沿 LoomRealm InputGate 流转。不可通过 DOM click、pointer hit-test、CSS visibility 决定是否触发传送。

## 2. 首阶段功能范围

- 参考归档的三图 R1 提案：Portal 业务传送需要完整实现；可见 Portal 仅要求在实际存在、资源就绪且对应外观被批准时绘制基础静态帧。
- 对完全不可见、缺少可见资源或并不需要展示的 Portal，不创建本节点；但 Subsystem 中的 Portal 记录仍可存在并参与游戏规则。
- 动态 phase（pv/ph/psh 等）和复杂循环动画是后续候选能力；不允许无证据地将所有 Portal 视为一种动画。
- Portal 的世界深度/显示前后需单独 CMS079 证据；**禁止默认始终压在 Avatar 前面**。

## 3. 候选输入数据（非 ABI）

| 语义 | 说明 |
| --- | --- |
| portal visual presentation id / sceneEpoch | 视觉身份和代际；与业务目标 map/tn 身份区分 |
| world x/y、origin、flip、visibility | 只用于显示定位及局部变换 |
| static frame/resource refs | 版本化资源/当前帧；无必要的业务 destination |
| stack-rank / validated visual-depth policy | 若画面需要与 Obj、Avatar 交错，使用 Subsystem 已确定的排序 |
| visual phase（后续） | 仅在已有证据支持时播放，不决定 Portal 业务状态 |

实际 attrs/data、phase 协议、资源 closure 错误策略未批准。若其缺少可见素材，Portal 逻辑不应因为 DOM 组件不出现而失败。

## 4. DOM、遮挡和更新

- ms-portal-visual 可作为 ms-scene-view 直属 Paint Unit，与地图 Canvas / Avatar 同级排序；如果未来采用通用 ms-world-item 包装，必须保证其**唯一**外层排序宿主，不能叠加两层互相隔离的 z-index。
- 简单静态视觉优先使用图片元素；真正有动画序列时才使用局部 Canvas 或图片帧机制。
- Portal 外观可能在 Avatar 前/后；如果证据表明某类 Portal 无需参与世界遮挡，也应在设计中明确其独立视觉层策略。
- 可见性、视觉帧更新不改变游戏 Portal 的 enabled、cooldown 或 arrival state。
- 不以 Portal 的视觉动画结束、CSS 过渡完成或图片加载结束作为 Subsystem transfer commit 的条件。

## 5. 生命周期和失败

- 场景替换时旧 Portal DOM 随 RenderNode 生命周期移除，旧动画/加载请求停止或失效。
- 非关键装饰资源缺失需明确记录并允许 Gameplay Portal 工作；关键显示要求若被产品审批则在呈现准备阶段阻止宣称完整画面，二者按产品验收政策区分。
- 同地图 Portal 迁移不应错误更换 sceneEpoch；该行为来自 Subsystem，不由视觉标签控制。
- 视觉组件不主动注册一个全局 Portal 列表，也不将事件直接发送到 Portal Subsystem。

## 6. 验收

1. 有外观与无外观 Portal 均可在同一业务传送规则下运作；画面显示不影响触发。
2. Portal 在地图/Avatar 前后关系遵循验证过的视觉深度。
3. 传送失败保留源业务状态；视觉组件不会提前清理源地图。
4. R1 三图双向 Portal、同地图跳点、图片慢加载与卸载清理。
5. 若后续 phase 动画启用，补充播放时序、帧资源及 30/60/120Hz 回放检查。

历史需求参考：[归档 R1 路线图](../../docs/product-first/IMPLEMENTATION-ROADMAP.md)（NON-NORMATIVE，不是当前批准的产品合同）。
