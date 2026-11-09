# cms-avatar-layer

> 公共 RenderNode attrs/data/children ABI 以 [RENDER-NODE-ABI-V1.md](../RENDER-NODE-ABI-V1.md) 为准；本文记录人物容器的产品职责和证据边界。

人物所在的纯容器。历史笔记 `research/result/task050-field-map.md` 只记录 `FieldDispatcher+0x24` 是 avatar layers；本次没有在客户端映像中复核该偏移的绘制时机，也没有证明它对应「八层地图之后、Portal 之前」的画面顺序。

## 在树中的位置

当前产品树把 `cms-avatar-layer` 放在八层 `cms-map-layer` 之后、`cms-portal` 之前。这是参考 HaCreator 合成器的 MVP 产品顺序，不是已确认的客户端绘制顺序。若后续客户端排序/深度函数证明人物应插入 Obj 的 `zM` 带，需要重新设计树表达。

## 运行库交给它的数据

这一层没有 attrs 和 data。它只占树中的一格。每个可见人物是一个子元素 `cms-actor`。

## 第一阶段

始终有一个 `cms-avatar-layer`，里面只有一个 `cms-actor`。换场景时保留这一层和人物的 key，不随远景和出口一起拆掉。这是单玩家 MVP 限制，不代表客户端只有一个 avatar layer。

## 不做什么

- 不解码外观包。头发、脸和装备迭代由 `cms-actor` 的 AvatarPlan 负责。
- 不放怪物和 NPC。它们在 Task 023 合成器中位于地图层之后，但客户端相对顺序尚未复核；第一阶段不纳入此容器。
