# 产品验收、Golden Fixture 与确定性回放计划

> 状态：TEST DESIGN / NOT EXECUTED。这里定义可执行验收，不声称本轮已运行游戏测试或浏览器 E2E。

## 1. Golden Fixture 集合

| Fixture ID | 内容 | 用途 | 资源策略 |
|---|---|---|---|
| GF-00 | 13 个 MapDescriptor + group presence manifest | P0 schema、allowlist、SOURCE-EMPTY 分类 | 合成数据，不含原始 WZ |
| GF-01 | 222000000 ↔ 222000001 ↔ 230030200 三图 | R1 完整最小循环、2 陆地+1 水域 | 合成图块/占位资源；逻辑 ID 与真实地图数据分离 |
| GF-02 | 13 map PortalGraph | 46 内部唯一边、8 外部关闭、强连通 | 使用已审计 portal records；不复制新增素材 |
| GF-03 | Foothold flat/slope/vertical/chain/one-way | P3 碰撞与确定性 | 合成端点、prev/next 与 force |
| GF-04 | Rope/Seat/Swim | P3 rope capture、climb、sit、water | 合成 Rope/Seat/Water regions |
| GF-05 | Back type0..4 + delay sequences | P1 背景/动画 | 合成 Canvas 与 virtual clock |
| GF-06 | Obj flow + Portal pv/ph/psh | P1 V2 动画 | 合成帧资源与缺帧用例 |
| GF-07 | Camera bounds/viewport | P2 VR/minimap/foothold、小地图、resize | 合成 sourceBounds |
| GF-08 | Portal failure injection | P4 atomic rollback | 可控 ContentClient/RenderDomain failure hooks |
| GF-09 | Avatar zmap/smap/anchors/equipment | P1 Avatar occlusion | 合成 AvatarPlan，验证 stable key |

Golden Fixture 不提交未授权客户端/WZ/完整素材。真实地图资源只从已批准 Content API 按 LogicalResourceRef 读取。

## 2. 确定性回放格式

每次回放记录：

- fixtureId、contentVersion、physicsConfigVersion、planVersion；
- tickQuantumMs=30、tickIndex、simulationTimeMs；
- InputGate 事件：inputSeq、targetTick、held keys、one-shot edges；
- 初始 PlayerMotionState、CameraState、sceneEpoch；
- 每 tick 的 position、velocity、mode、footholdId、ropeId、seatIndex、camera、portal outcome；
- 每阶段 stateHash 与 diagnostic list。

Replay 不记录浏览器 render frame 作为物理输入；同一 tick log 在 30/60/120Hz 下必须得到相同 state hash。

## 3. 确定性单元测试矩阵

### P0 Content / Map

1. 13 mapId allowlist 完整、重复、未知、文件名不匹配。
2. Info required/optional presence：0、false、缺失、null、非有限值分离。
3. info.link：无 link、单跳、多跳、环、悬空目标、局部覆盖冲突。
4. Tile canvasZ 缺失、asset id 重复、TileSet 缺失、资源版本冲突。
5. Obj r=0 / r!=0 / flow present；v1 fail-closed。
6. Back type0/1..7、空帧、delay missing/zero/negative、front 非法。
7. Foothold duplicate ID、prev/next unresolved、degenerate/vertical、force 正负、forbidFallDown。
8. Rope/Seat absent 与 source-empty 分类；index number/string 保留。
9. Portal tm sentinel、tn empty、unknown pt、duplicate destination name。
10. ContentVersion mismatch、MIME 非 image、尺寸不符、source rect 越界、缺资源。

### P1 Render / Avatar

1. Layer 0..7 稳定顺序；Obj z 与 Tile canvasZ 升序；同键 sourceOrder tie-break。
2. clientSortKey 改变不得改变产品 draw list。
3. type0 Back 静态；V1 遇 type1–7 unsupported。
4. V2 背景 type1–4 视口平铺、视差、自动滚动和虚拟时钟边界。
5. Obj flow 缺帧/零周期/循环边界；V1 不得吞掉 flow。
6. Avatar anchor priority、zmap/smap、islot/vslot、flip XOR、缺 anchor diagnostic。
7. Actor locomotion stand/walk/jump/prone/swim/sit/climb validator 与 AvatarPlan 一致。
8. Portal v1 static frame；V2 phase change 与 resource failure。
9. viewport canvas pixel budget、DPR、disconnect、旧 paint epoch 慢响应不覆盖新帧。

### P2 Camera

1. world→screen：负坐标、整数边界、DPR 1/2/3。
2. VR 完整、单边缺失、轴收敛、反向边界。
3. miniMap 四字段完整/缺失；Foothold fallback；bounds-unavailable。
4. viewport 640×480、800×600、1280×720、超大于地图、1×1/0×0。
5. first commit snap、deadband 内静止、28px 边界、virtual time、time regression。
6. resize 不改变 PlayerMotionState；same-map retarget；cross-map reset+snap。

### P3 Movement

1. 平地走/停/反向/同时左右。
2. 正负坡、陡坡、force、全局 friction、缺 per-Foothold drag。
3. Foothold 链接前进/后退/单向/环/断链；同 tick 多次 transition 上限。
4. 空中 vx 加速、释键 drag、重力、terminal velocity。
5. 高速 sweep 不穿台；斜线落地；竖线不站立；墙滑。
6. 陆地 jump edge、held key 不重复、落地后重跳。
7. 水图四方向、水跳 299/300/301ms、切换 environment。
8. Down+Jump、forbidFallDown、ignore foothold latch 清除。
9. crouch/prone 进入/退出；落地 stand/walk/alert。
10. Rope x±10 边界、y1/y2、uf 端点、重叠绳 tie-break。
11. Seat 命中/站起/被遮挡；10 张无 Seat 图无副作用。
12. 非有限输入、physics config 缺字段、状态 fault 后 last-good。

### P4 Portal / Scene transition

1. Up edge 命中框 x±20/y±50，右/下 exclusive；四边和四角 ±1px。
2. pt 0/1/2/3/6/10/9/12/13 分支；pt3 产品 Up-trigger 与 OpenMS automatic 的差异测试。
3. tm/tn 同图/跨图/空值/sentinel/目标缺失/重名/闭包外。
4. arrival y-10、Foothold ≤32px 吸附、等距 tie-break、无 foothold air spawn。
5. state reset 字段逐项 diff；facing 保留。
6. cooldown 499/500/501ms、119/120/121ms、600ms recovery、重复 edge。
7. 46 条内部唯一边均可路由；8 条外部边均禁用；forward/reverse reachability 13/13。
8. 资源读取、Plan validation、arrival、RenderDomain.replace 各阶段注入失败；源 map/state/tree/Camera 不变。
9. same-map 不换 sceneEpoch；cross-map sceneEpoch 单调递增；Actor key 稳定。

## 4. ABI 不变量

每个 R1–R4 PR 必须运行：

- RenderNode 恰好五字段；不得添加第六字段。
- Frozen tags、attrs/data/event schema 不变；未知字段按 schema 拒绝。
- Node key 稳定；同一逻辑节点跨帧 key 不变。
- sceneEpoch 只按已批准 map replacement policy 变化；新 epoch key 不复用。
- RenderDomain replace 的 old tree/new tree 原子性。
- 组件绘制回调不写 FieldRuntime/SharedState。
- InputGate 是全部游戏输入的唯一可信入口。
- LoomRealm submodule gitlink SHA 不变。

## 5. 性能与稳定性门槛（目标值，需在 R0 固定参考环境）

| 项目 | 目标 | 失败处理 |
|---|---|---|
| Physics tick | 30ms quantum；单 tick p95 ≤2ms（参考 host 基准后确认） | overload diagnostic；不丢 tick |
| Catch-up | 每 render update ≤8 ticks | 保留 backlog；不重入 |
| Foothold traversal | ≤32 segment transitions/tick | movement fault + last-good |
| Render Projection | R1 三图完整 Plan p95 ≤16ms（参考 host 基准后确认） | 不发布半树 |
| Resource decode | 并发 ≤8（沿用当前 Actor 组件已定义的组件级策略，跨组件需统一审查） | 感知取消队列；不启动过期 decode |
| Portal | 13 node / 54 edge graph build bounded；触发 lookup indexed | 目标缺失 fail-closed |
| Canvas | 仅 viewport-sized；DPR 和 pixel count 有界 | error state；不分配 world-sized canvas |

所有性能值为拟议目标，不是本轮已测量结果。R0 必须固定浏览器、设备、DPR、地图 fixture 与测量脚本，才可转为硬验收。

## 6. 质量门禁

- R0：schema/manifest/fixture validators、ADR 批准、ABI invariants。
- R1：三图每项正常/边界/错误/replay/resize/transition rollback 全通过。
- R2：13 图资源闭包、46/8 graph、13/13 reachability、5 land/8 water、每图 scene projection 通过。
- R3：V2 background/flow/portal phase、Avatar depth boundary 和性能基准通过。
- R4：Combat/Death/Knockback 等非 MVP 范围另有独立授权与测试。
