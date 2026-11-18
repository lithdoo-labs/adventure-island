# 产品目标与阶段范围

> **状态：产品设计候选 / NOT APPROVED / NOT IMPLEMENTED。**
> 本文把当前讨论中的产品意图收敛成可审查范围，不恢复 `docs/product-first/` 中 65 项需求卡的规范地位，也不批准历史 R0–R4 路线图。

## 1. 产品愿景

在 LoomRealm 平台上建立一个可重复验证的冒险岛基础客户端切片。目标不是一次性复制完整 CMS079，而是先贯通以下闭环：

```text
进入地图
→ 地图与人物正确呈现
→ 输入驱动权威 Movement
→ Camera 跟随并保持世界对齐
→ Portal 选择目标并原子切换场景
→ 目标地图恢复人物、Camera 与画面
```

产品以 CMS079 逆向事实为行为约束，以 OpenMS 为公开开发参考，以 `[FSDB]adventure` 为只读内容来源，以 LoomRealm Subsystem / Renderer 分离为运行时边界。

## 2. 基础功能目标

### 2.1 人物纸娃娃

目标：

- 身体、头、脸、头发和装备按动作帧组合；
- 使用 CMS079 anchor、origin、zmap、smap、islot/vslot 规则；
- 支持朝向、表情、基础 locomotion 与一次性动作；
- 世界位置更新不重绘人物局部 Canvas；
- 装备或动作计划变化不重建世界实体宿主。

业务边界：外观选择和动作选择是 Subsystem/Adapter 状态；帧相位、位图缓存和局部 Canvas 是 Renderer-local presentation。

### 2.2 动作系统

候选首阶段动作集合来自现有内容与旧实现能力，包括：

- stand / walk / jump；
- prone / fly / rope / sit 等持续姿态，只有在 Movement 权威状态和素材闭包成立时启用；
- attack 等一次性动作走瞬态 Render Event，不能成为业务完成回调。

动作时间轴与 Simulation Clock 必须分离。Renderer 可以播放视觉帧，但不能根据“动画播完”提交移动、传送或战斗结果。

### 2.3 地图场景

目标场景至少表达：

- ordinary Back 与 front Back；
- Tile；
- 静态 Obj；
- Foothold；
- 可见 Portal 外观；
- Player Avatar；
- Camera 和 viewport。

世界画面使用统一深度序列与多个独立 Paint Unit，不使用整张世界大 Canvas，也不使用固定的“地图层 Canvas 在下、Avatar 在上”结构。

### 2.4 人物移动

首阶段候选范围：

- 地面行走、空中和落地；
- 跳跃与向下穿越，取决于已闭合的 Foothold 行为和产品范围；
- 水图的游泳/水中跳；
- Rope 与 Seat，只有目标地图存在对应内容记录时启用；
- position、velocity、mode、contact、Foothold layer/group 由 Subsystem 权威维护。

Renderer 只接收最终世界位置、朝向、视觉姿态和世界排序，不运行碰撞或状态转换。

### 2.5 Camera

已知 CMS079 世界到屏幕关系为 `screen = world - camera`，Camera 写入和对象身份已有静态证据。首阶段仍需产品批准：

- follow cadence；
- 是否采用 deadzone、平滑或立即跟随；
- viewport resize 行为；
- 地图边界 clamp；
- 同图重定位和跨图到达后的 Camera 行为。

OpenMS Camera 参数只能作为候选，不是 CMS079 证明。

### 2.6 Portal 与场景跳转

目标：

- 从 Portal 内容记录建立稳定查找索引；
- 区分输入触发、自动触发和纯视觉 Portal；
- 支持同图重定位和跨图切换；
- 跨图先准备目标内容，再原子提交业务状态；
- 失败时保留源地图 last-good 状态；
- 到达位置、速度清零和首次 Movement 重建遵循 CMS079 已闭合证据；
- 视觉过场不拥有业务提交权威。

## 3. 候选阶段

### 阶段 A：合同与证据收敛

目标不是可玩，而是让实现输入没有歧义：

- 更新 CMS079 Claims/Evidence/Gaps 映射；
- 固定 FSDB → Projection 的字段来源与缺失语义；
- 验证 LoomRealm WebProjector 下的真实 DOM/Shadow DOM；
- 批准世界排序、Paint Unit、资源失败和节点身份规则；
- 建立无授权素材的 synthetic/golden harness。

### 阶段 B：三图垂直切片

历史提案使用以下三图作为代表性闭环；本轮仍把它们作为**候选验证集**，不是已批准路线图：

| Map ID | 代表能力 |
| --- | --- |
| `222000000` | 陆地图、完整 VR、Tile/Back/Foothold/Obj/Portal、多个出生 Portal |
| `222000001` | 陆地图、相邻 Portal、内容存在性边界 |
| `230030200` | 水图、无 VR 时的 bounds fallback、游泳与跨环境跳转 |

候选退出条件：

- 三图资源闭包和 group presence 可审计；
- 人物能在陆地和水图使用对应 Movement；
- Camera 在多个 viewport 尺寸下保持地图/人物对齐；
- Portal 目标唯一，准备失败不离开源图；
- 同一输入和时钟重放产生相同业务状态；
- DOM/Canvas 数量、像素、CPU 与内存有真实测量。

### 阶段 C：13 图内容闭包

当前 `[FSDB]adventure` 的候选地图集合：

```text
222000000  222000001
230000000  230000001  230000002  230000003
230020000  230020100  230020200  230020300
230030000  230030100  230030200
```

该阶段关注内容闭包、Portal graph、存在性分类、资源预算和全图重放，不自动引入 NPC、Mob、Quest 或 Combat。

### 阶段 D：完整呈现能力

只有在静态场景闭环稳定后才审查：

- Back repeat/parallax/auto-scroll；
- Obj flow 与复杂动画；
- Portal `pv/ph/psh` phase；
- Renderer-local scene transition；
- Avatar 更完整的动作与视觉 polish。

这些能力目前受到 CMS079 动态方法体和时间语义缺口约束。

## 4. 明确非目标

首轮基础闭环不包含：

- 服务端权威战斗；
- damage、knockback、death；
- NPC/Mob AI、Quest、Reactor；
- 完整 UI/HUD、聊天和商城；
- 复制 OpenMS Pixi 运行时；
- 把旧 `cms-*` ABI 直接改名为 `ms-*`；
- 为了通过演示而绕过 LoomRealm 的 Subsystem/Renderer 权威边界。

## 5. 产品不变量

1. 业务状态只在 Subsystem/Shared State 等明确权威中更新。
2. Renderer 不读取原始 WZ，不直接遍历 FSDB 业务关系。
3. 场景切换失败不得半提交新 mapId、Actor、Camera 或 Portal token。
4. 同一输入、内容版本、时钟和初始状态应能重放出相同业务结果。
5. 资源缺失、来源缺失、空 group 和不支持行为必须产生可定位差异。
6. 世界排序不依赖异步资源到达顺序。
7. Renderer-local 视觉动画不反向决定业务结果。
8. 性能优化不得破坏跨 Tile/Obj/Actor 的遮挡正确性。

## 6. 从产品目标到组件

| 产品能力 | Subsystem 权威 | Renderer 候选组件 |
| --- | --- | --- |
| 场景/Camera | mapId、scene identity、Camera state | `ms-scene-view` |
| Back | 已解析布局、世界排序、视差输入 | `ms-map-back` |
| 静态 Tile/Obj | placement 排序、batch 计划 | `ms-map-batch` |
| 独立 Obj | 世界位置、深度、动画选择 | `ms-map-object` |
| Player 世界实体 | position、facing、depth、visible | `ms-world-item` |
| 纸娃娃 | appearance、pose/action selection | `ms-avatar`、`ms-action` |
| Portal | trigger、target、travel、commit | `ms-portal-visual` 仅画面 |

组件存在不等于业务能力存在。例如地图可以有不可见 Portal，Portal 业务也不能依赖 `ms-portal-visual` 是否挂载。

## 7. 产品批准清单

在把候选目标转成实施需求前，至少确认：

- 阶段地图和退出条件；
- CMS079 parity 与产品自定义行为的边界；
- Camera 与 Simulation Clock 选择；
- Portal 失败、冷却和过场策略；
- 动态 Back/Obj/Portal 是否进入首阶段；
- 内容、Canvas、资源缓存和 CPU 预算；
- OpenMS GPL-3.0 研究记录和独立实现流程；
- legacy `cms-*` 的迁移与回归覆盖。
