> **归档状态（2026-11-17）：历史提案 / 非现行规范。** 本文保留用于追溯；不代表当前产品批准、实现或架构要求。当前设计入口：[Design Baseline Reset](../design-baseline/README.md)。

# R0–R4 实施路线图与退出条件

> 本文是下一轮工程任务拆分，不表示代码已经实现。依赖关系和退出条件必须作为 PR checklist。

## 总览

| 阶段 | 目标 | 主要范围 | 不包含 | Exit |
|---|---|---|---|---|
| R0 | 可执行设计基线 | ADR、schema、validator、fixtures、CI gate | 可玩游戏 | 65 卡审批；Plan/ABI 边界清楚；Golden harness 可运行 |
| R1 | 三图可玩垂直切片 | 222000000 / 222000001 / 230030200；Map/Back/Avatar/Movement/Camera/Portal | 全部背景/flow 动画、战斗 | 从首图移动、游泳、镜头跟随、Portal 到第三图并可返回；故障原子回滚 |
| R2 | 13 图完整场景 | 全部地图资源闭包、层、Foothold、Portal graph、陆水环境 | 未批准的外部地图、V2 深度 interleave | 13/13 bundle ready；46 内部边启用候选、8 外部关闭；正反向可达 13/13 |
| R3 | 完整呈现扩展 | Back type1–4、Back clock、Obj flow、Portal phase、Avatar polish | Combat damage/server authoritative battle | V2 tags/plan schema、旧 v1 regression、golden visual replay、性能预算通过 |
| R4 | 后续玩法能力 | attack hit, knockback, death, NPC/mob/quest integration | 未批准协议与素材 | 独立范围/协议/安全/许可证批准和专项验收 |

## R0 — Design freeze preparation

### Tasks
1. 批准或修订 ADR-001..ADR-009；ADR-010 Reviewer availability remains a separate release gate.
2. 将 65 项需求卡映射到实现 package/owner/issue。
3. 实现 MapBundle manifest validator：group presence state、resource closure、map allowlist。
4. 实现 PortalGraph validator：unique target, scope, SCC/reachability.
5. 实现 fixed-step virtual clock/InputGate replay harness。
6. 实现 RenderNode ABI snapshot/invariant tests（只验证，不修改冻结文件）。
7. 生成 GF-00..GF-09 synthetic fixtures；不引入未授权原始素材。
8. 建立可复现的 CI 命令、浏览器版本、DPR 和性能 baseline。

### Exit
- 65/65 requirement IDs exactly once；字段完整。
- 所有阻塞 ADR 有批准或明确拒绝与替代方案。
- Schema validators 对正常/边界/错误 fixture 给稳定 diagnostic。
- Frozen ABI/LoomRealm/history ledger diff 为空。
- Reviewer 盲审与对抗审安排具备独立执行环境。

## R1 — Three-map playable vertical slice

### Maps
- 222000000：land，VR 四字段，Tile/Back/Foothold/Obj/Portal。
- 222000001：land，VR 四字段，无 Tile group file（先确认 SOURCE-EMPTY）。
- 230030200：water，无 VR，使用 miniMap/Foothold fallback，info.swim=1。

### Workstreams
1. P0 MapDescriptor + bundle closure + Bounds fallback + Physics config。
2. P1 type0 Back、Tile/Obj non-flow、layer order、AvatarPlan validator locomotion 扩展、Portal static frames。
3. P2 CameraSubsystem、world→screen、virtual clock smoothing、viewport resize。
4. P3 30ms movement tick、ground/air/swim、Foothold contacts、jump/drop、rope/seat（目标图资源有记录时）、姿态。
5. P4 Up portal、strict tm/tn、arrival、cooldown、same/cross-map、atomic replace、rollback。
6. E2E：222000000→222000001→230030200；从 230030200 回到前图；跨图 camera snap；same-map portal 不替换 sceneEpoch。

### Exit
- 所有适用 Requirement ID 的正常/边界/错误/重放通过。
- 玩家可走、跳、落地；进入水图可四向游泳/水跳；Camera 在 3 viewport sizes 下稳定。
- 目标 Portal 目标唯一，加载失败不离开源图。
- Actor key/identity 保持；RenderNode ABI snapshot 完全不变。
- 真实浏览器 E2E 和 30/60/120Hz replay 通过。

## R2 — 13-map scene + portal graph

### Workstreams
1. 13/13 MapDescriptor 和各组 presence 分类。
2. 13/13 Back/Foothold/Obj/Portal data closure；Tile/Rope/Seat 的缺文件逐图判定。
3. 13/13 resource closure、minimap/VR bounds、Foothold fallback。
4. 46 条内部唯一 Portal link 启用前检查；8 条外部 link disabled。
5. 全图环境策略：5 land / 8 water；info.swim V1 whole-map mode。
6. 每图 Golden projection；全图 portal graph replay；cross-map atomic transition stress。

### Exit
- 13/13 bundle ready，所有 source group state 可审计。
- 46 internal / 8 external / 0 unresolved internal target。
- 正向与反向可达 13/13。
- 每图场景无 unsupported visual record；任何不支持记录必须阻止该图发布。
- 低帧率、长 dt、resize、资源缺失、目标缺失、重复触发均通过。

## R3 — V2 scene presentation

### Workstreams
1. BackPlanV2 + cms-back-v2：type1–4 repeat/parallax/scroll 与 deterministic clock。
2. MapLayerPlanV2 + cms-map-layer-v2：Obj flow 序列与 viewport culling。
3. PortalPlanV2 + cms-portal-v2：pv/ph/psh Start/Continue/Exit phase。
4. Avatar zmap/smap/anchors/locomotion golden suite；评估是否需要 world-depth interleave V2。
5. Visual regression snapshots 与 Canvas budget/CPU baseline。

### Exit
- 新 tag/Plan schema 独立版本化，v1 validators 不改变。
- 每个 V2 feature 有正常/边界/资源失败/replay tests。
- 所有旧 v1 fixtures 不回归。
- Performance target 由固定参考环境实测达标。

## R4 — Deferred gameplay

- Attack hit/damage、knockback、death、NPC/mob、quest、server-authoritative combat 不属于 R1/R2 acceptance。
- 先定义网络/权限/状态权威、protocol compatibility、resource/license scope。
- 任何新协议或 Frozen ABI 变更必须单独 ADR、兼容测试和安全审查。

## Recommended engineering ticket order

1. R0-01 65-card/ADR approval and reviewer setup.
2. R0-02 MapBundle/MapScenePlan validators + source-group manifest.
3. R0-03 Portal graph validator and GF-02.
4. R0-04 InputGate replay + fixed-step harness.
5. R1-01 FieldRuntime snapshot and MovementSubsystem.
6. R1-02 CameraSubsystem and viewport integration.
7. R1-03 Render Projection + cms-scene-view/back/map-layer/avatar/portal integration.
8. R1-04 atomic PortalSubsystem + three-map E2E.
9. R2-01 13-map resource closure and group classification.
10. R2-02 full Portal graph enablement after closure.
11. R2-03 13-map replay/visual regression.
12. R3 V2 presentation workstreams.
13. R4 only after separate scope approval.
