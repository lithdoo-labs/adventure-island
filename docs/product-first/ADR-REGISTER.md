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


## ADR-011 — Scene Draw List / ms-world-layer 全局深度排序

- **状态：** PROPOSED
- **Context：** Frozen RenderNode ABI v1 的分组式树把 AvatarLayer 放在所有 MapLayer 后面，不能表达 Actor 在同层 Obj 之间的深度穿插。CMS079 当前研究台账及 T086/T086.1 已闭合跨对象排序键控插入、比较器、Avatar 键和次级键证据。
- **Decision Drivers：** 世界深度确定性、透明混合顺序、节点数量、地图工作集、Canvas/WebGL 可替换性、v1 不可修改。
- **Alternatives：** A. 保留分组式树；B. 单一 Scene Draw List / World Render Layer；C. 每个 Tile/Obj/Entity 一个 RenderNode。
- **Trade-offs：** A 不能跨组件排序；C 节点和 DOM 开销过大；B 需要统一 Draw Plan 和内部 Drawable Surface 接口。
- **建议决策：** Scene ABI v2 采用 ms-world-layer；Render Projection 产生全局 back-to-front drawOrder；Tile/Obj/普通 NPC/Mob/Reactor/Portal/Effect/Projectile 默认批量数据；只有独立呈现生命周期的 drawable 才成为子组件。ms-avatar V1 通过内部 surface provider 参与合成。
- **Consequences：** 新增 ms-scene-view / ms-world-layer / ms-entity 设计；不修改 Frozen ABI v1；具体 Draw Plan schema 和容量须以前三张地图 fixture 测量后冻结。
- **验收：** Tile/Obj/Avatar/NPC/Mob 等交叉排序 golden；小键先画；次级键确定；透明混合稳定；Viewport culling；Canvas/WebGL 后端同一输出。

## ADR-012 — Renderer 内部 RenderProjectionBatch

- **状态：** PROPOSED / BLOCKS ms-avatar V1 browser integration
- **Context：** ms-avatar V1 换装要求父级 appearance 与多个 ms-action Clip 在同一 Domain commit 后完整投影。Render Store 原子提交不等于所有 WebProjector receiver callback 成功。固定 LoomRealm WebProjector 没有 batch begin/end。
- **Decision Drivers：** 父子组合一致性、错误隔离、RenderEvent 时序、公共 ABI 不变。
- **Alternatives：** A. 延迟 microtask；B. 全 Domain 单一全局门闩；C. Renderer 内部按依赖闭包/父子子树的 ProjectionBatchCoordinator。
- **Trade-offs：** A 不能证明 callback 完成；B 会让无关子树互相阻塞；C 需要内部 Projector 扩展但隔离边界清晰。
- **建议决策：** 采用 C。begin 在受影响 managed subtree 投影前同步调用；end 在所有必要结构/Context/data delivery attempts 后调用；必要 callback 失败则 failed。Event 在目标 batch 结束后投递，failed 则丢弃。资源异步 decode 不属于 batch。
- **约束：** 不增加 RenderNode 字段、不增加 Render Update message、不扩展 WebPresentationContext、不增加公开 service locator、不修改 RenderEvent 语义。
- **Consequences：** 需要 LoomRealm 单独 ADR、维护者批准和固定 Submodule commit 升级；本仓库本轮不修改 Submodule。
- **验收：** 初次挂载、父子同时 update、replace 增删/重排、nested receiver、callback throw、Event 前置顺序、失败恢复的真实浏览器测试。

## ADR-013 — Renderer Window 级共享 decoded resource cache

- **状态：** PROPOSED
- **Context：** ms-avatar V1 已定义 Avatar 内部资源 lease/cache；Map、Back、Avatar 可能共享同一图集页。Content cache 与 decoded image cache 是不同所有权。
- **Decision Drivers：** 去重、内存预算、lease 隔离、Abort、decode concurrency、跨组件共享。
- **Alternatives：** A. 每个组件独立解码缓存；B. Renderer Window 共享 decoded cache，组件持有 lease；C. Content cache 直接暴露给组件。
- **Trade-offs：** A 重复解码；C 混淆 Content 与 decoded ownership；B 需要 lease/refcount/pin/LRU 管理。
- **建议决策：** 采用 B。按 namespace/key/contentVersion 去重读取与解码；组件只持有 lease；LRU 仅逐出 refCount/pinCount 为零的条目；底层读取仅在无消费者时 abort。
- **Consequences：** ms-avatar 保留逻辑资源所有权，Renderer cache 拥有 decoded page；Map/Back 可共享同一页。
- **验收：** 并发同资源只读取/解码一次；一个组件释放不影响其他组件；abort/decode race 不泄漏；按实际 decoded bytes 限额。

## ADR-014 — Scene RenderClockProvider 与单一 RAF scheduler

- **状态：** PROPOSED
- **Context：** ms-avatar V1 已定义最近祖先 RenderClockProvider；后续 Back、NPC/Mob、Portal、Reactor、Effect、Projectile 需要一致视觉时间。
- **Decision Drivers：** 多组件同步、无每组件 RAF、delta 语义一致、DOM disconnect、后台 RAF stall、显式 pause。
- **Alternatives：** A. 每个组件自行 RAF；B. 每个组件独立时钟；C. Renderer Window 单一 RAF scheduler + Scene/UI Clock scopes。
- **Trade-offs：** A/B 时间不同步且资源浪费；C 需要 Provider lifecycle/invalidated 管理。
- **建议决策：** 采用 C。ms-scene-view 提供稳定 RenderClock；所有场景动画订阅它。遵循 ms-avatar V1：真实 delta、显式 pause 才暂停、后台 RAF stall 不自动 pause、DOM disconnect 冻结、切换 Clock 保留相位。
- **Consequences：** Simulation Clock 仍属于 Field Runtime；ms-action 不订阅 Clock。
- **验收：** 30/60/120Hz、后台恢复、大 delta、pause/resume、DOM reparent/disconnect、Provider invalidation、多组件同步。

## ADR-015 — Adventure Scene ABI v2 与 cms/ms 双轨迁移

- **状态：** PROPOSED
- **Context：** cms-* RenderNode ABI v1 已冻结；ms-avatar/action V1 已独立收口；cms-avatar-layer 恰好要求一个 cms-actor；新 ms-avatar 下挂 ms-action，与旧树不兼容。
- **Decision Drivers：** 不破坏 v1、可并行测试、PWA/Hostra parity、渐进迁移、避免字段改名式伪适配。
- **Alternatives：** A. 在 cms-* 内部替换实现；B. 新增 ms-* tag family + 新 scene root；C. 修改 RenderNode 公共五字段。
- **Trade-offs：** A 不能解决冻结 children schema；C 不必要地改变 LoomRealm wire ABI；B 需要双 Projection 和兼容测试。
- **建议决策：** 采用 B。新增 ms-scene-view root 和 ms-world-layer；RenderNode 五字段保持不变。Legacy / Modern Projection 都从同一 FieldRuntime snapshot + Content closure 生成各自树，不把 cms RenderNode 直接改名成 ms RenderNode。
- **Consequences：** cms-* 保留至 V2 功能、像素、资源、性能、事件和双平台 parity 通过；PWA/Hostra 必须注册相同 tag set 和脚本顺序。
- **验收：** V1/V2 隔离 fixture；相同业务快照；PWA/Hostra 相同 bundle hash、RenderNode snapshots 和 golden pixels；无生产路径依赖后才批准废弃。

## ADR-016 — World / UI / optional Overlay RenderDomain 拓扑

- **状态：** PROPOSED
- **Context：** RenderDomainState 只有 zIndex + roots；Domain 内原子提交，Domain 间没有共同事务。World 场景需要原子 replace；HUD 需要跨地图持久；全屏转场可能需要覆盖 World replace。
- **Decision Drivers：** 生命周期边界、Domain zIndex、跨 Domain 一致性、转场遮罩。
- **Alternatives：** A. 一个 Domain 放全部内容；B. World + UI 两个 Domain；C. World + UI + optional Overlay 三个 Domain。
- **Trade-offs：** A 让 UI 与场景 replace 耦合；B 满足大多数情况；C 支持独立 topmost transition/fatal overlay，但没有跨 Domain atomicity。
- **建议决策：** World Domain 必须独立；UI Domain 在其生命周期确需跨地图保留时独立；Overlay Domain 仅在转场遮罩需独立 topmost 生命周期时建立。不要按 map layer/entity 拆 Domain。
- **Consequences：** 跨 Domain 更新不得假设事务；转场期间用持续遮罩覆盖 World replace。
- **验收：** World replace 不重建 UI；Overlay 可覆盖 World；Domain close 和 generation reset 无 stale event / stale key。
