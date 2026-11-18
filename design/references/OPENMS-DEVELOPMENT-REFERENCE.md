# OpenMS 开发参考

> **来源状态：OPENMS-REFERENCE，不是 CMS079 证明。**
> 固定提交：`07994de02756356e3e025e3aca9e79433898d2c8`。OpenMS 为 GPL-3.0；本项目只研究公开行为和工程结构，不复制、vendor 或链接其源码。

## 1. 使用目的

OpenMS 对本项目的价值有三类：

1. 展示一个可运行冒险岛客户端怎样组织场景、资源、动画和物理；
2. 为 CMS079 逆向结论提供交叉比较和假设来源；
3. 帮助发现组件边界、更新频率和性能问题。

它不能：

- 单独证明 CMS079 数值或行为；
- 替代 `research/source-of-truth`；
- 决定 LoomRealm 的进程、RenderDomain 或 Custom Element 架构；
- 让 GPL 源码直接进入 Adventure Island 实现。

## 2. 版本与差异

OpenMS 参考的是 GMS083 相关实现，本项目研究目标主要是 CMS079。二者可能在以下方面不同：

- 世界 depth 常数与特例；
- Camera cadence/deadzone；
- Movement 参数和状态分支；
- Portal 类型、冷却和触发；
- Back/Obj animation timing；
- 资源结构、字段和客户端 bug。

任何从 OpenMS 采用的值都必须标为 `PRODUCT-DECISION` 或经过 CMS079 独立证据升级。

## 3. 场景与世界排序

### 3.1 `client/src/rendering/stream-scene.js`

OpenMS 使用 Pixi `Container`，不是 DOM + Multi-Canvas。可借鉴的行为结构：

- 一个 StreamScene 收集 Region、动态 Entity 和独立 world containers；
- 显示对象被展平到统一世界序列；
- 使用 `zIndex` 和 `depthOrder` 排序；
- Entity 深度变化时移动已有显示对象；
- Region 流入/流出时维护持久显示节点；
- 不以屏幕 y 作为所有对象的通用排序规则。

对 Adventure Island 的启示：

- Tile、Obj、Actor、Back 必须能进入一个可比较的世界排序模型；
- “统一排序”不等于“统一 Canvas”；
- Paint Unit identity 应持久，不能每帧重建；
- Region/资源驻留与世界深度是两个维度。

不能照搬：

- Pixi Container 层级；
- renderer serial 的具体生成方式；
- OpenMS depth 常数；
- StreamScene 作为 LoomRealm 外的第二个全局权威。

## 4. 动画与显示对象

### 4.1 `client/src/rendering/animation.js`

关键观察：

- Entity 拥有持久 Container 与 Sprite pool；
- 换帧复用对象，而不是反复创建整棵显示树；
- 世界位置与局部 Sprite frame 分开更新；
- Avatar 内部层和表情使用局部 pose/order；
- Back 根据 Camera、repeat、parallax、flow 维护自己的呈现位置；
- 不同视觉对象可有各自局部动画时间。

映射到候选组件：

| OpenMS 行为 | Adventure Island 候选 |
| --- | --- |
| 持久 entity container | 保留同 key Custom Element |
| sprite pool | 组件私有 ImageBitmap/Canvas 缓存 |
| world transform | `ms-world-item` / world-plane transform |
| local frame update | `ms-avatar`、`ms-map-object` 局部重绘 |
| background repeat | `ms-map-back` 私有布局/Canvas |

OpenMS 的局部时钟只能帮助设计 Renderer-local presentation，不能成为 Simulation Clock。

## 5. Avatar composition

### 5.1 `client/src/rendering/avatar-composition.js`

OpenMS 的组合阶段展示了一个重要边界：把复杂内容解析放在逐帧绘制之前。

行为包括：

- 通过公共 anchors 合并 body parts；
- 按部件 z 解析局部顺序；
- 根据 slot priority 做遮挡；
- 产生按 action/frame 组织的 render-ready 结果；
- runtime 播放阶段不再遍历完整装备/WZ 目录。

这与当前 FSDB 和 CMS079 证据一致：

- `avatar.Part`、`PartFrame`、`DrawOrder`、`LayerSlot` 在 Adapter 阶段联合；
- `ms-avatar` 只消费有限、已解析的 appearance/action clip；
- 世界排序只处理 Avatar 外层 Paint Unit；
- 身体、头发、装备等局部层不成为世界 DOM 节点。

具体 anchor、slot、zmap 行为仍以 CMS079 source-of-truth 与 FSDB 为准。

## 6. Camera

### 6.1 `client/src/rendering/camera.js`

OpenMS 包含：

- 目标点；
- deadband；
- follow coefficient；
- viewport/map bounds clamp；
- world 与 screen 变换。

可借鉴的是状态拆分：Camera 是独立业务/呈现输入，不应散落在每个 Sprite 内。

不能直接采用：

- feet `y-50`；
- deadband `28`；
- coefficient `100`；
- 每帧跟随 cadence；
- clamp 细节。

CMS079 最新静态证据已经证明共享 Camera vector、立即写入和 `screen = world - camera`；但 follow cadence/deadzone 仍是受约束的产品决定。不能用 OpenMS 值填补该缺口后宣称原版一致。

## 7. Simulation 与 Movement

### 7.1 `client/src/physics/simulation.js`

OpenMS 将 Simulation 与 render frame 分开，并采用固定量子和 catch-up 上限。它展示了：

- 权威 Movement 应由固定或明确的业务时间推进；
- render frame 不等于 simulation tick；
- Foothold 查询和状态转换不应放在 Renderer；
- 低帧率下需要明确 backlog/catch-up 策略。

OpenMS 的 `30ms` 量子和最多 `8` 次 catch-up 是产品候选，不是 CMS079 事实。Adventure Island 必须结合 CMS079 物理证据和 LoomRealm Frame 模型单独批准。

## 8. Portal

### 8.1 `client/src/world/portal-system.js`

可借鉴的结构：

- PortalTravelGate 独立维护 travel admission；
- 输入 edge 与自动触发分开；
- same-map 与 cross-map 有不同业务路径；
- 目标准备为异步过程；
- Portal visual 与 travel state 分离；
- active token 防止旧异步结果释放或覆盖新 travel。

不能直接采用：

- Portal 类型含义和所有触发矩形；
- 冷却时间；
- type 3 是否自动触发；
- OpenMS 到达/Camera 策略。

这些必须与 CMS079 Portal 逆向、FSDB `pt/tm/tn` 和产品范围交叉确认。

### 8.2 `client/src/world/field-arrival.js`

用于和 CMS079 到达点、Y 偏移、速度清零和目标 Portal 选择交叉比较。CMS079 已闭合结论优先于 OpenMS。

### 8.3 `client/src/rendering/field-transition.js`

主要提供 presentation-only fade/transition 参考。它支持“业务场景提交”和“Renderer 过场效果”分离的设计，但不能证明 LoomRealm 已经提供跨组件像素事务。

## 9. 深度资料

### 9.1 `docs/client-evidence.md`

OpenMS 固定提交记录了 GMS083 的 Tile、Obj、Back、Player、Mob、NPC、Drop 和 effect depth family。

本项目使用方式：

- 发现不同类别进入同一世界 key 空间的结构；
- 和 CMS079 Tile/Obj/Avatar key 做数值交叉比较；
- 设计动态 Actor 插入点和静态 batch 安全条件；
- 不把 GMS083 类别常数当作 CMS079 Frozen ABI。

CMS079 最新证据已经独立恢复 Tile、Obj、Avatar key family 和 comparator；这些结论应从 `research/source-of-truth` 引用，而不是继续标为“仅 OpenMS 假设”。

## 10. 从 OpenMS 到 LoomRealm 的转换原则

| OpenMS 概念 | 不直接复制 | LoomRealm/Adventure Island 对应思路 |
| --- | --- | --- |
| Pixi StreamScene | 全局 Renderer authority | Subsystem Render Projection + ordered Paint Units |
| Pixi Container | 组件树模板 | WebProjector-managed Custom Element |
| Sprite pool | Pixi 对象实现 | 组件私有 Canvas/ImageBitmap/cache |
| entity zIndex | OpenMS 常数 | CMS079 normalized order → candidate stack-rank |
| render ticker | 业务时钟 | Renderer-local visual clock only |
| simulation loop | 浏览器 RAF 业务权威 | Subsystem Simulation/Frame |
| portal gate | 原样冷却/类型 | Portal Subsystem state/token model |
| asset loader | URL/文件路径 | LoomRealm Content logical ResourceRef |

## 11. 引用要求

设计文档引用 OpenMS 时至少记录：

- 固定 commit；
- 文件路径和相关函数/行为；
- 它是 GMS083/OpenMS 参考；
- 对应的 CMS079 claim/gap；
- 最终采用的是 proven fact 还是 product decision；
- 是否存在许可证或独立实现风险。

建议写法：

```text
OPENMS-REFERENCE：stream-scene.js 展示统一世界显示序列与持久 Entity。
CMS079-PROVEN：C-001/C-002/C-097/C-099 证明目标版本的 key family 与 comparator。
PRODUCT-DECISION：用同级 DOM Paint Units + bounded Canvas batches 表达该顺序。
```

## 12. 固定链接

- [OpenMS commit](https://github.com/tensorfish/openms/tree/07994de02756356e3e025e3aca9e79433898d2c8)
- [StreamScene](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/stream-scene.js)
- [Animation](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js)
- [Avatar composition](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/avatar-composition.js)
- [Camera](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js)
- [Simulation](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js)
- [Portal system](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-system.js)
- [Field arrival](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/field-arrival.js)
- [Field transition](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/field-transition.js)
- [Client evidence](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/docs/client-evidence.md)
- [GPL-3.0 license](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/LICENSE)
