# Adventure Island 地图游戏运行时 — 产品模块契约 V1

> 状态：PROPOSED，等待产品/架构审批。定义工程接口与行为，不代表功能已实现。OpenMS 参考固定为 GMS083 commit 07994de02756356e3e025e3aca9e79433898d2c8；数值/算法引用不是 CMS079 等价声明。

## 1. 系统边界与单一权威

输入/Host Viewport → LoomRealm InputGate/Viewport snapshot → Adventure Field Runtime → Content/Map Adapter、MovementSubsystem、CameraSubsystem、PortalSubsystem、Render Projection → Frozen RenderNode ABI v1 → cms-scene-view/back/map-layer/avatar-layer/actor/portal。

- Field Runtime / Subsystem / Shared State 是 mapId、世界位置、速度、Foothold、movement mode、Camera、Portal gate、sceneEpoch 的唯一权威。
- InputGate 将用户输入转换为可信输入意图。Portal、Jump、Move 不直接从 Web Component 读取 DOM 键盘。
- Render Projection 只读取不可变 snapshot，生成五字段 RenderNode。组件只绘制；组件回调不得同步写世界状态。
- Content Builder 只读取可信 Content API/逻辑资源引用；业务代码不得访问原始 WZ 路径、FSDB 私有 locator 或本地文件路径。
- RenderNode ABI v1 五字段、标签、attrs/data schema、events、key 生命周期与 sceneEpoch 规则冻结；本设计不修改它。

### 1.1 Runtime state（逻辑结构建议，不是 RenderNode schema）

- PlayerMotionState：x/y/vx/vy、facing、mode(ground/air/swim/climb/sit)、locomotion(stand/walk/jump/prone/swim/sit/climb)、footholdId、ropeId、seatIndex、ignoredFootholdId。
- FieldRuntimeSnapshot：mapId、sceneEpoch、tickIndex、simulationTimeMs、PlayerMotionState、CameraState、PortalGate state。
- 这些状态由 Subsystem 持有，不放入组件私有状态，也不新增 RenderNode 顶层字段。

### 1.2 InputGate contract

- 每个输入意图有递增 inputSeq，并分配 targetTick；held 是该 tick 的持续按键快照，jumpPressed/upPressed 是只消费一次的 edge。
- 同一 tick 左右同时按下，水平轴为 0；Up 的 Portal edge 在 Movement/ladder capture 前消费，避免同一 edge 同时传送与抓绳。
- Replay 记录 inputSeq、targetTick、held、edges，不能仅记录 render-frame 级按键快照。
- InputGate session/Subsystem/generation/target provenance 由 LoomRealm 绑定，业务组件不可自报。

## 2. P0 — Content / Map Descriptor / Bundle

### 2.1 Map allowlist 与 Info

正式发布闭包严格为：222000000、222000001、230030200、230030100、230030000、230020300、230020200、230020100、230020000、230000000、230000001、230000002、230000003。

共同字段按当前 13 个 struct 实际存在性校验：version、cloud、town、swim、returnMap、forcedReturn、mobRate、bgm、mapMark、hideMinimap、fieldLimit。保留可选字段 presence：fly、noMapCmd、onFirstUserEnter、onUserEnter、effect、decHP、protectItem。未知字段进入 audit ledger，不静默丢弃。mapId 与文件名、Portal graph node 必须一致。

### 2.2 Map group presence

Builder manifest 对每个 map、每个 group 记录状态：

- PRESENT(records>0)
- SOURCE-EMPTY（已检查源图像/源表，确认该组为空）
- SOURCE-ABSENT（源记录/文件没有导入，尚不能认定为空）
- RESOURCE-MISSING（逻辑记录存在，但所需图像/音频资源缺失）
- UNSUPPORTED（字段/资源不能由当前 Plan version 表达）

只允许 PRESENT 与已确认 SOURCE-EMPTY 进入 ready bundle。当前文件树统计：Back/Foothold/Obj/Portal 13/13；Tile 9/13；Rope 7/13；Seat 3/13。Tile/Rope/Seat 缺组需先判定 source-empty，不能直接映射成空数组。

### 2.3 MapScenePlanV1 可用范围

- Bounds：四个 VR 都存在时用当前已确认 inset（left/right ±400，top/bottom ±300，收敛轴向零截断中点）；否则完整 miniMap 四字段；否则 foothold bbox（left/right ±10、top -360、bottom +110）。V1 camera top-left clamp 与 viewport 尺寸语义见 ADR-002，未批准前不可将 effectiveBounds 直接当通用 top-left range。
- Back：仅 type=0 静态帧。保留 rx/ry/type/cx/cy/front/flip/opacity；type1–7 unsupported。
- Tile：canvasZ 缺失报 tile-canvas-z-absent，不补 0；asset/placement 引用闭合。
- Obj：r 缺省/0 且无 flow 可进 V1；r 非零或 flow 报 obj-visual-field-unsupported。
- Foothold：id 唯一、prev/next 必须解析；保留 force/forbidFallDown；竖直段保留但不可站立。V1 无 per-segment drag。
- Rope/Seat：原样保留 sourceOrder 与字段；缺组要由 manifest 分类。
- Portal：逻辑 PortalRecord 在 Field Runtime；frames 仅供 cms-portal；视觉缺失不允许 editor icon 代替。

### 2.4 Resource Bundle closure

每个引用用 LogicalResourceRefV1(namespace,key,contentVersion)。Builder 对每个资源检查存在、sha256 contentVersion、MIME essence、解码宽高、source rect、引用者和总闭包。所有 13 张地图的候选 bundle 一次性生成报告；任何地图 Plan 有绘制所需 unsupported 记录时，该地图不可发布。资源路径不得进入 RenderNode。

## 3. P1 — Scene / Background / Object / Avatar

### 3.1 Tile/Obj sort 与树顺序

- Layer 0..7 升序。
- 每层产品顺序：Obj 按源 z 升序、相同 z 按 sourceOrder；Tile 按 Canvas z 升序、相同 z 按 sourceOrder。
- Tile diagnostic key：canvasZ + 10 * (layer * 3000 - zM) - 1073721834。
- Obj diagnostic key：layer * 30000 + z - 1073739824。
- 诊断键不改变排序方向；不把 CMS079 的 key 计算误当成比较器闭合。
- Scene children 继续采用冻结树顺序：远景 Back → map layers → AvatarLayer/Actor → Portal → 近景 Back。Actor 不插入同层 Obj 深度带。

### 3.2 Background V1/V2

V1 仅 static type0；所有 frame resource 必须完整，缺 delay 的帧 hold。V2 候选行为（需 ADR-005 批准）：

| type | 产品行为候选 | 规则 |
|---|---|---|
| 0 | 固定单帧/静态背景 | placement-origin，1:1 world anchor |
| 1 | X 轴平铺 | 仅使用明确 tileStepX；0 表示不重复 |
| 2 | X/Y 双轴平铺 | 分别使用 tileStepX/Y；0 表示该轴不重复 |
| 3 | 双轴平铺 + rx/ry 视差 | 以 camera center 与有符号 rx/ry 计算偏移 |
| 4 | X 轴自动滚动 | monotonic presentation clock；rate 符号决定方向 |

type1–4 的上表是 Adventure Island 产品候选，不是 CMS079/GMS083 事实。动态背景不能把组件私有 wall-clock 当权威；需要新的 BackPlanV2 和新 tag（例如 cms-back-v2），不改变 cms-back v1。

### 3.3 Obj flow V2

- flow 由显式序列、帧资源、delay、循环策略与 sourceOrder 构成。
- 每个放置点固定 x/y/origin；只更新帧资源，不改变 placement。
- 所有 flow frame 资源进入同一 Content closure。
- V1 遇到 flow 仍报 unsupported。V2 使用新 MapLayerPlanV2 / 新 tag，不在冻结 mapLayerPlan 中塞未知字段。

### 3.4 Avatar

- 复用现有 AvatarPlan：body origin、anchors、zOrder、frame delay、expression 独立时钟、资源版本、source rect、islot/vslot、zmap/smap。
- Actor 的 x/y 是身体原点（近似脚底）；地图 Tile/Obj 的 origin 锚定规则不套用 Avatar。
- Actor key 在整个 RenderDomain 生命周期稳定；换图保留 HTMLElement，不由组件拥有世界位置。
- ABI locomotion 已列 stand/walk/jump/prone/swim/sit/climb，但当前 cms-actor validator 只接受前三项；R1 必须把 validator、AvatarPlan、Subsystem 映射一起补齐并测试，不能只更新 attrs。
- Avatar 内部 zmap/smap 解决装备遮挡，不代表 Avatar 可以与地图 Obj 按 world-depth interleave。

### 3.5 Portal visual

V1 只绘制静态 PortalPlan frames；Portal 目标、触发、cooldown、enabled 均在 Field Runtime。Portal pv/ph/psh 的 Start/Continue/Exit phase 动画不由当前 PortalPlan V1 完整表达，需 cms-portal-v2 / PortalPlanV2；缺资源不填 editor icon。

## 4. P2 — Camera / Viewport

### 4.1 坐标

- 世界坐标 X 向右、Y 向下；screen = world - cameraTopLeft。
- cms-scene-view.attrs.x/y 是 camera top-left world pixel，字符串十进制；世界像素与 CSS px 1:1；DPR 仅影响设备像素绘制。
- Camera target 候选：Actor feet + (0,-50)，来自 OpenMS camera.js。
- 目标先经 filter，再减去 viewport half-size 得到 top-left。
- clamp 使用 raw sourceBounds 和 viewport extent：left/top = source left/top；right/bottom = source right/bottom 减 viewport width/height；地图小于视口时该轴居中。不得把 800×600 的 ±400/300 inset 再用在任意 viewport 的 top-left 上。

### 4.2 Filter

OpenMS 参考候选：28px deadband、coefficient 100、首帧 snap、以单调时间差更新。采用前必须通过 virtual-clock golden tests；不得以 render FPS 或 Date.now 决定物理状态。CameraSubsystem 是唯一写者；resize 不改 PlayerMotionState。

### 4.3 Fallback / resize

- Bounds 依序 VR→miniMap→Foothold。
- miniMap 在本设计中只作为 bounds fallback；不自动新增 minimap UI。
- resize 只重算 camera 与 viewport canvas；旧异步绘制由 paintEpoch/sceneEpoch 隔离。
- map change：新 bounds、arrival、camera filter reset+snap；same-map teleport：保留当前 scene，camera filter retarget。

## 5. P3 — Movement / Physics

### 5.1 时间模型

- 固定 quantum：30ms（OpenMS simulation.js 参考候选）。
- 每次 render update 最多 8 个 catch-up step；剩余 accumulator 保留并记录 overload，不丢模拟时间。
- InputGate edge 按 targetTick 消费；同一 input edge 不得在多个 catch-up tick 重复。
- 单 tick 最多 32 个 Foothold transitions，超过触发 deterministic fault 并保留 last-good state。
- 30ms/8/32 是产品运行时策略候选；必须由 R0/R1 golden replay 批准，不能标成 CMS079 常量。

### 5.2 Tick 顺序

1. 消费该 tick 的 InputFrame（held + one-shot edges）。
2. 更新 environment mode（V1 13 图按 info.swim 整图 water/land；V2 可引入 swimArea）。
3. 若 sit 则保持 seat state；若 climb 则执行 rope 轴向移动。
4. 计算 ground/air/swim velocity。
5. 积分 position；ground 使用 velocity trapezoid 候选。
6. swept Foothold contacts、端点连接和 landing。
7. 更新 locomotion/alert/action intent。
8. 生成不可变 snapshot，供 Camera 与 Render Projection 读取。

### 5.3 Ground / slope / air

- Physics 的 19 个数值字段作为唯一参数来源；不得把 OpenMS 某个构建的数字常量直接写入游戏代码。
- Ground velocity 沿 Foothold tangent；速度上限、加速度、摩擦从 typed Physics config 读取。
- V1 Foothold 没有 drag 字段；按全局 Physics friction 运行。需要 per-Foothold drag 时进入 MapScenePlanV2。
- Air vx 受 air-control 与 drag；vy 加 gravity 并 clamp terminal velocity。所有积分固定 30ms。
- Collision 使用确定性 swept segment；斜线可作为地面，竖线只作墙/边界，不作 standable surface；相同命中按 sourceOrder/id tie-break。

### 5.4 Jump / drop / water

- 陆地跳只消费 jumpPressed edge；空中按下不重复起跳。
- Down+Jump 是单次 drop intent；若 forbidFallDown 为 true 则拒绝；成功后 ignore 当前 foothold，离开后清除。
- 13 图中 8 张 info.swim=1 的水图 V1 按整图 water mode；四方向均可控。局部 swimArea 未进入 V1，若后续导入需 V2。
- Water jump 使用独立 water impulse；300ms held repeat 是 OpenMS 候选，不作为既定事实，需 ADR-003 批准。
- 当前不采用未证实的 fieldLimit bit17 解释。

### 5.5 Rope / Seat / pose

- RopeRecord 保留 l/uf/page；10px capture width 与 3px/30ms climb step 是 OpenMS 候选，待 R1 golden fixture 批准。
- 由于 CMS079 的 l→ladder/rope 分叉不能从字段名推断，未确认前统一以 climb 状态处理，视觉姿态按 AvatarPlan 已有 rope 动作回退。
- Seat 命中只在含 Seat 的 3 张地图有效；sit 锁定移动，stand 需重新判定 Foothold。
- crouch/prone 只在地面 Down 且无水平输入时触发。
- Alert 5000ms 是产品候选，按 simulationTimeMs 推进。
- 攻击仅触发 action transient Render Event；命中/伤害/死亡/击退不属于本轮可玩垂直切片。

## 6. P4 — Portal / Field Transition

### 6.1 Portal record 与 graph

PortalRecord 是 Field Runtime 逻辑数据；视觉节点不拥有目标。目标解析键是 (targetMap,targetName)，必须唯一。sentinel 999999999、空 tn、未知类型或闭包外目标不触发传送。

13 图实测：54 条非 sentinel links；46 条内部唯一目标；8 条外部目标。46 条内部边的正向/反向可达均为 13/13。旧四门只覆盖旧三图闭包，不再是完整 13 图产品策略。

### 6.2 Trigger

- Up key edge；矩形候选为 portal x±20、y±50，右/下边界 exclusive。
- 只允许 pt 1/2/3/10 的明确目标；pt0 spawn、pt6 special 不由 Up 激活；9/12/13 unsupported。
- 本产品候选选择：pt3 仍走 Up edge，而不是 OpenMS 自动进入；这是显式 079/083 产品差异。
- 多门重叠按最近中心，距离相同按 sourceOrder 降序（需 golden test）。

### 6.3 Arrival / state reset

- cross-map 目标 portal x/y 后使用 y-10 arrival offset 候选。
- 在 x 投影有效且垂直距离 ≤32px 的 Foothold 中选最近者；相同距离按 layer/platform/id 升序。无合格 foothold 时以零速度 air state 出生，不静默选择 portal0。
- 成功 commit：vx/vy=0；清除 jump/drop latch、ignoredFoothold、ladder、seat、attack transient、alert timer；按目标 map info.swim 初始化 environment；保留 facing。
- same-map teleport 只更新 Actor/MovementState，不替换 map tree、不增加 sceneEpoch。
- cross-map transition 使用新 sceneEpoch；Actor key 保持稳定。

### 6.4 Gate / atomic commit

- 状态机：IDLE → PREPARING(token) → COMMITTING → COOLDOWN → IDLE；失败路径 PREPARING/COMMITTING → ROLLBACK → IDLE。
- active token 唯一；重复 Up、旧 token、迟到 promise 不得释放 successor。
- 先加载目标 MapBundle、验证唯一 portal、Foothold arrival、所有资源；全部成功后才调用 RenderDomain.replace 与同步 FieldRuntime commit。
- 任意 prepare/replace 失败：保留旧 mapId/scene tree/Actor/Camera/PlayerMotionState；释放临时资源与 token；显示可定位错误。
- cooldown 候选：cross-map 500ms；same-map admission 120ms、成功后 recovery 600ms；使用单调时钟，不用 scene delta。
- Camera cross-map reset+snap；same-map retarget。

## 7. V2 interface boundary

| 能力 | v1 当前限制 | 建议 V2 方式 |
|---|---|---|
| Background type1–4 与帧钟 | cms-back V1 loop 不启动私有时钟 | 新 BackPlanV2 + cms-back-v2 |
| Obj flow | MapLayerPlanV1 无 flow frame clock | MapLayerPlanV2 + cms-map-layer-v2 |
| Portal Start/Continue/Exit | PortalPlanV1 仅 frames，无 phase state | PortalPlanV2 + cms-portal-v2 |
| Foothold drag / swimArea / fieldLimit | MapScenePlanV1 未定义 | MapScenePlanV2 typed movement metadata |
| Actor 与 Obj 同层深度穿插 | v1 树固定 Actor 在 MapLayer 后 | 独立 Render ABI V2 ADR；不得改现有 tag |

新 tag/plan 的实现前置：ADR 批准、schema、validator、资源闭包、兼容矩阵、合成 golden fixture、真实浏览器集成和旧 v1 regression。

## 8. OpenMS 来源锚点

- Camera：client/src/rendering/camera.js（feet target -50、deadband 28、filter coefficient 100、viewport clamp）。
- Fixed step：client/src/physics/simulation.js（30ms quantum、max 8 catch-up、ground trapezoid、jump/drop）。
- Ground/air contacts：client/src/physics/geometry.js、contacts.js、dynamics.js。
- Rope/water：client/src/physics/ladders.js、environment.js。
- Portal gate/arrival：client/src/world/portal-system.js、field-arrival.js、portal-presentation.js。
- Atomic field transition presentation：client/src/rendering/field-transition.js。
- Animation/background/avatar：client/src/rendering/animation.js、animation-timing.js、client/src/character/avatar-composition.js。

所有实现必须独立编写；OpenMS 根 LICENSE 为 GPL-3.0。本项目本轮不复制其源代码。
