# Adventure Island Product-First ADR Register

> 所有 ADR 当前状态均为 PROPOSED。记录建议裁决，不代表已获产品批准或已经实现。批准人、日期和实施 SHA 在正式审批后填写。

## ADR-001 — 13 图 Portal Graph：四门白名单迁移

- **状态：** PROPOSED / BLOCKS R2 full-13 release
- **问题：** MapScenePlanV1 只启用旧三图闭包中的四条连接；P4-09 要求完整 13 图连通。
- **证据：** 13 个 Portal JSONL：54 条非 sentinel 连接；46 条目标地图在 13 图内且 tn 唯一；8 条目标在闭包外；46 条内部边正向/反向可达均 13/13。详见 PORTAL-GRAPH-13.csv。
- **建议决策：** 46 条内部唯一边列为启用候选，只有源/目标 MapBundle 与 Portal resource closure 全部通过后才设置 enabled=true；8 条外部边保持 false。sentinel 999999999 永不视为地图。
- **不做：** 不自动加入外部地图；不因某条边有视觉帧就推断可传送；不静默补目标 portal。
- **验收：** graph 生成器输出 46/8/0(内部 unresolved)；强连通性正反向 13/13；每条 enabled edge 目标唯一；资源闭包失败时边关闭。

## ADR-002 — Camera 坐标、焦点、VR bounds 与 viewport clamp

- **状态：** PROPOSED / BLOCKS P2 approval
- **问题：** Frozen ABI 定义 cms-scene-view x/y 为 camera top-left；MapScenePlanV1 的 effectiveBounds 对 VR 使用 400/300 inset；OpenMS followCamera 按半视口计算 camera top-left。
- **建议决策：** 保持 ABI top-left；目标候选为 Actor feet+(0,-50)，经 28px deadband / coefficient100 filter；将 filtered target 减 viewport half 得 top-left；clamp 用 raw sourceBounds 与 viewport extent；小地图居中。effectiveBounds 不得再被误当通用 top-left bounds。
- **替代：** 若继续把 effectiveBounds 当 center range，必须在 MapScenePlan V2 明确 center semantics，不改现有 ABI x/y。
- **验收：** 800×600、640×480、1280×720、viewport 大于地图、VR 收敛、无 VR fallback；相同 virtual time 输入输出完全一致；resize 不写 world state。

## ADR-003 — 固定物理步长与 InputGate tick assignment

- **状态：** PROPOSED / BLOCKS P3 implementation
- **建议决策：** 30ms fixed tick；每 render update 最多 8 个 catch-up；超额 backlog 保留并报告 overload，不丢模拟时间；InputGate edge 绑定 targetTick，replay 保存 inputSeq。
- **额外候选：** 水中 held jump repeat 300ms；alert 5000ms；两者均为产品候选值，不能标成 CMS079 原版常量。
- **验收：** 30/60/120Hz 与 250ms/1000ms stall 下同一 tick input log 得到相同 state hash；edge 只消费一次；backlog 不丢。

## ADR-004 — Portal Trigger / Target / Arrival / Atomic Transition

- **状态：** PROPOSED / BLOCKS P4 implementation
- **建议决策：** Up edge + x±20/y±50 矩形；pt 1/2/3/10 可按目标启用；pt3 采用 Up-trigger（不同于 OpenMS type3 automatic）；tm/tn 严格唯一匹配；无 portal0 fallback；arrival y-10，Foothold 吸附 32px 范围内最近段，无段时 zero-velocity air；跨图 reset velocity/transients，same-map 不替换场景。
- **Gate：** cross-map 500ms；same-map 120ms admission / 600ms recovery；active token 唯一，单调时钟。
- **原子性：** prepare destination+resources+arrival → replace → 同步 commit FieldRuntime；失败保留旧 scene/state。
- **验收：** 46 条内部边、8 条外部关闭；每个 prepare/commit 边界故障注入；旧 scene/tree/state hash 不变。

## ADR-005 — Background / Obj flow / Portal phase V2

- **状态：** PROPOSED / BLOCKS complete P1 scene feature set
- **问题：** v1 cms-back 不自动播放；MapLayerPlanV1 不表达 Obj flow；PortalPlanV1 不表达 Start/Continue/Exit phase。
- **建议决策：** 冻结 v1 不变；新增 BackPlanV2/cms-back-v2、MapLayerPlanV2/cms-map-layer-v2、PortalPlanV2/cms-portal-v2。新 tag 具有闭合 schema 与 presentation clock 输入；时间权威仍归 Field Runtime。
- **验收：** v1 遇到 type1–4/flow/phase 未支持时仍 fail-closed；V2 golden frame replay 与 v1 regression。

## ADR-006 — Movement Plan V2 data：Foothold drag / swimArea / fieldLimit

- **状态：** PROPOSED / BLOCKS full movement parity
- **问题：** MapScenePlanV1 Foothold 无 drag；没有 swimAreas；Map Info fieldLimit 不等于已证明的某个 bit flag。
- **建议决策：** R1/R2 对 13 图使用 info.swim=1 整图 water、0 整图 land 的产品策略；force/forbidFallDown 只按批准规则使用；不猜 fieldLimit bit。若需要局部水域/per-segment friction，MapScenePlanV2 加 typed swimAreas/drag/fieldLimit snapshot。
- **验收：** 8 张水图四方向和水跳；5 张陆地图无 water mode；V2 区域边界和缺字段测试。

## ADR-007 — Avatar / Obj 深度与 RenderNode frozen tree

- **状态：** PROPOSED
- **问题：** ABI v1 将 AvatarLayer 固定在所有 map layers 后；不能按同一 layer 的 zM 把 Actor 插入 Obj 之间。
- **建议决策：** R1/R2 保持现有树顺序；AvatarPlan 内 zmap/smap/islot/vslot 只负责纸娃娃内部遮挡。World-depth interleave 不得通过 children 运行时重排实现。
- **未来：** 若产品必须支持同层 interleave，另开 Render ABI V2 tag/scene tree 设计与 LoomRealm 兼容审查。
- **验收：** actor key 稳定；managed children 不重排；AvatarPlan 缺遮挡 metadata fail-closed。

## ADR-008 — Map.info/link inheritance

- **状态：** PROPOSED
- **问题：** 13 张目标图当前未发现 link，但通用 Map Adapter 仍需确定继承策略。
- **建议决策：** link 作为显式 alias chain；链路必须唯一且无环；终点资源作为 canonical source；本地图显式 Info 覆盖只允许按字段白名单 overlay；数组组不做隐式深合并；未定义的局部覆盖报 unsupported。
- **验收：** no-link、A→B、A→B→C、环、悬空目标、局部覆盖冲突夹具。

## ADR-009 — OpenMS GPL-3.0 与游戏资源边界

- **状态：** PROPOSED / ongoing compliance gate
- **建议决策：** 本项目只采用 OpenMS 可观察行为/算法思路并独立实现；不复制源码、片段、测试或 vendored GPL module；确需复用时先做法律/分发评估并由项目维护者批准。
- **素材：** 不提交原始客户端/WZ/FSDB 全量导出或未授权图片/音频；现有仓库资源不因本轮读取而自动获得再分发批准。
- **验收：** source matrix 有 commit/path/license；新增代码版权扫描与人工 review；无新原始资产文件。

## ADR-010 — 独立 Reviewer 能力缺失时的发布门禁

- **状态：** BLOCKED / NOT-RUN
- **事实：** 当前执行环境没有真实独立 sub-agent 启动能力；不能由主 Agent 自己扮演盲审者。
- **建议决策：** 本轮只归档能力限制报告，不伪造 BLIND-NOTES/对抗发现/ACCEPT。要求在支持独立 sub-agent 的环境执行三阶段 Reviewer 后，才可把设计阶段标为最终 ACCEPT。
- **验收：** 独立 Reviewer 真正产生盲审、对抗审、最终复验文件；push 后 reviewer 自己回读远程 tree；否则状态保持 NOT-RUN。
