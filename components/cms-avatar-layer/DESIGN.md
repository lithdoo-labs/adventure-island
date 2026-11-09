# cms-avatar-layer

> 公共 RenderNode attrs/data/children ABI 以 [RENDER-NODE-ABI-V1.md](../RENDER-NODE-ABI-V1.md) 为准；本文记录人物容器的历史依据和职责边界。

人物所在的层。对应客户端 `FieldDispatcher+0x24`。`SPAWN_PLAYER` 里，角色通过 `GetAvatarLayer(+0x24).Add` 放进这个容器，而不是画在整张地图的最上面。

## 在树中的位置

八层 `cms-map-layer` 之后，`cms-portal` 之前。这样人物盖在地图层上，又处在近景和出口的关系里：出口在人物之后绘制，近景 `cms-back` 再盖在出口上。

## 运行库交给它的数据

这一层没有属性和 `data`。它只占树里的这一格。每个可见人物是一个子元素 `cms-actor`。

## 第一阶段

始终有一个 `cms-avatar-layer`，里面只有一个 `cms-actor`。换场景时这个层和人物的 key 都保留，不随远景和出口一起拆掉。

## 不做什么

- 不解码外观包。头发、脸和装备迭代在 `decodeAvatar` 里，槽位字节还没还原。这一层只放子元素，纸娃娃的画法在 `cms-actor`。
- 不放怪物和 NPC。它们在 Task 023 里画在八层之后，但是另一类生命体，第一阶段不进这层。
