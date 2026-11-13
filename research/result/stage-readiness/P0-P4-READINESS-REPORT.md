# P0–P4 Stage Readiness Report (13 real maps)

**研究基线**：`design/adventure-field-map-scene` 原 HEAD `0f5ded86722393e7708ad8398ebe1a9a1997161c`，2026-11-13。目标地图列表由 `docs/implementation/2026-11-09-adventure-field-map-scene-design-draft.md` §1.3 指定。本报告为阶段裁决，不取代 `research/source-of-truth/{claims,gaps,evidence}.csv`。详见同目录 **65 行** `P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv`；每行提供原版事实、精度、Claim、Evidence、Gap、样本覆盖、冲突、后续路径、验收与授权。

## 0. 结论和证据等级边界

**总体：NOT STAGE-READY。** 不是“不能开工”，而是 **5 个阶段都未满足“全部必要行为有原版证据或正式产品替代且验收边界分开”** 的逐阶段就绪规则。独立的 P0 数据装载、P1 数值键、P2 VR、P3 若干动力子函数、P4 触发和状态提交平台代码可以开工并分别验收。不得因某个阶段总状态为未就绪而阻塞这些模块。

截止本轮，权威台账由 47 Claim / 32 Evidence / 35 Gap 基线更新为 **47 Claim / 32 Evidence / 41 Gap**。G36–G41 是根据当前13图新补的正式缺口；新增 Gap 不等于产生原版机器指令，也不等于旧 Gap 关闭。现分布：CLOSED-STATIC 14 / PARTIAL-STATIC 8 / OPEN-STATIC 12 / OPEN-RUNTIME 5 / BLOCKED 1 / SUPERSEDED 1。本轮没有原始 unpacked EXE/Gr2D DLL，新指令证据为 0 条；原有 EV 的 A/B/R 标签不能自动被提高。**绝不以该统计数量代替工程完成定义**。

下面三种信息必须独立：
1. **原版可信事实**：例如 C-001/EV-01 计算 Tile 键、C-026/EV-21 VR±(400,300)、C-034/EV-26 Physics 字段；以及已有反汇编报告中精确到 VA 的局部函数。
2. **设计稿中的“已有取证总结”**：第 6.5、6.6、16 节包含比 `MAP-R1-R14-REVERSE.md` 更晚且更细的 R10 落点链、鞋子 owner、Foothold 换段、爬绳 y+=3×键等。它们是**明确的待核静态定位点**，不能因为缺少新的 C/EV 就当不存在，但也**不能仅因写入设计稿就自动升级为权威指令级证据**。
3. **正式的产品实现规则**：Frozen ABI 的 1:1、Obj-before-Tile、source-order stable、layer-only、Portal 首帧、world x/y 与 RenderNode；以及阶段设计稿 §4.2 提出的中心跟随、边界夹取、小图居中、无 deadzone。后者已经给出具体可编码方案，但是否视为正式获批需在设计评审中确认；绝非 CMS079 原版规则。

矩阵中 `RE-GAP-STATIC` 的含义是 **仍然有特定静态验证动作或指令级佐证不足**；`RE-GAP-RUNTIME` 与 `EXTERNAL-BLOCKED` 仅在静态确实已穷尽或交付素材缺失时选用。本轮没有证据足以把 G36/G37/G38/G40/G41 直接归为 runtime-only。仓库包含地图 PNG Resource（不能误写成所有图像缺失），但 Builder 尚未通过目标全闭包测试；缺的是反汇编所需的原始 EXE/DLL（研究工具输入，不等于最终游戏必须分发的素材）。

## 1. 逐阶段现状

| 阶段 | 矩阵行数 | 可独立交付 | 真正阻塞完整阶段 | 阶段裁决 |
|---|---:|---|---|---|
| **P0 Map FSDB / ScenePlan / Bundle** | 13 | 13图map/Tile/普通Obj/FH/Rope/Seat/Portal原记录、Physics表、VR与fallback、Tile/Obj key | 278条非type0 Back、7图55条Obj.flow、Builder目标资源闭包未跑完、未知字段消费表 | **未就绪** |
| **P1 Scene Render** | 15 | type0静态背景、Tile/普通Obj的产品锚点、原版整数key、首帧Portal资源/可见性、视口批绘 | type1–4完整画面及flow、时间/帧、原版排序；若验收采用冻结的产品排序则最后一项可独立放行 | **未就绪** |
| **P2 World/Camera/Viewport** | 8 | VR内缩、产品world−camera 1:1、minimap回退、resize不写world | Camera原版跟随未知；设计稿已有“中心跟随+夹取+小图居中、无deadzone”产品候选，待审批对照验收及Frozen ABI职责界定；0x1E/0x5A关系仍开放 | **待正式策略验收** |
| **P3 Movement/Physics** | 20 | Physics真实数值/字段、T1局部地面一步、默认陆/水跳初速子式、攻击表级动作选择 | 数值代入及特殊槽取证、完整Foothold/落地/下跳/抓绳/坐下/姿态/时间；见下表逐行为 | **未就绪** |
| **P4 Portal Transition** | 9 | 固定上键框/pt逻辑、tm/tn映射、原子replace+失败回滚 | 原版准确到达与同步 reset 仍缺权威 C/EV；新版设计稿提供同图和跨图回包写点地址（需核证）；全13连通与旧Plan“四门”冲突 | **未就绪** |

### P0 — 内容阶段清单

**RE-READY**：目标 13 图 ID 与基础源记录、Tile 的 `u/no/zM`、Obj 的 `oS/l0/l1/l2/z/f/zM`、Foothold 连接、Rope/Seat 坐标、19 Physics doubles。TileFrame 目标三包 `folkvillige` (27)、`greensandySeaFloor` (26)、`sandySeaFloor` (28) 均有 `z`。注意各 layer 可能引用不同 TileSet；不可把三包合成一个全局键索引。

**PRODUCT-READY**：完整 VR 源可按 C-026 原版收缩；无 VR 的 `minimap→foothold bbox` 是正式产品回退；`info/link` 本次 13 图没有，但允许的泛化解析规则需单独夹具。不是“所有 CMS 地图都无 link”。

**RE-GAP-STATIC**：Back type1–4 的可计算画法和 Objs 的 flow/rx 时间语义。必须保留所有原始影响视觉的字段，Adapter 不可静默丢弃。当前 Frozen v1 遇到这些字段直接 unsupported，符合保守契约但**13图整体不能发布为完整 Plan**。MapHelper 的游戏 pv 等资源已在 `content/[FSDB]adventure`；这不是需要另行获得 WZ 全量客户端的问题。资源 Builder 从独立读取 MapScenePlan 的架构/验证任务，与逆向证据缺失须分开跟踪。

### P1 — 场景呈现与排序

1. **原版已确认**：Tile 键 `canvasZ + 10*(layer*3000 - zM) - 1073721834`；Obj 键 `layer*30000 + z - 1073739824`；Tile 与 Obj 创建/分派不在同一条通道。背景以 index×1000 为基底的旧结论仍 C-024/B，比较方向 G35 未证。Portal 的 `pv/ph/psh` 分支能找到静态地址和已导入游戏帧。
2. **原版未证明**：最终 Tile/Obj 容器、比较器、等键稳定性、不同 layer Draw 遍历、Avatar 跨对象插入、背景 type1–4 动态呈现和动画 delay 时钟。22 张 slot45 候选无比较器 ≠ 已知道原版排序方向。R13 的局部出参矛盾必须先复核 0x427EB3 的 ESP/EBP/清栈，不能直接改成 runtime-only。
3. **产品可实施**：Frozen ABI v1 明确 Obj-before-Tile、各组升序、同键源序、layer0..7，再独立 Avatar 及 Portal；这些规则只能用于**产品级**像素验收。设计稿 `pass=behind/front` 与该树正面冲突，不能偷偷增加 frozen attrs。

背景类型逐项：type0 可依产品锚定画；type1 轴重复、type2 城镇重复、type3 双轴、type4 横向滚动都至少需要 C-024 以外的原版变换/平铺证据或正式产品等价批准。动画有完整 `delay` 的动态资源同样不能只拿旧帧注册函数冒充时间精度。

### P2 — Camera 和世界坐标

- **RE-READY**：VR 算法 400/300、向零收敛中点；已接入的逻辑 bounds 不能在组件第二次内缩。
- **PRODUCT-READY**：`screen = world - camera`、1:1 CSS像素、Y向下、resize 仅改变视野；无 VR 时回退由产品定义。
- **DESIGN-DECISION（独立审批）**：设计稿 §4.2 / §10 已写了**无 deadzone、人物中心跟随再夹取、小图居中**的可执行方案，它比“可参考 HeavenClient”更明确。由于 Frozen ABI 只冻结 viewport left-top 和1:1、没有冻结完整跟随函数，必须确认该方案成为本阶段产品验收标准，并写精确中心/VR塌缩/resize测试；若要求原版真实 Camera，则 G10 仍缺跟随写链。G34 `0x1E` 与 `0x5A` 的关系不得补一个经验数。

### P3 — 必须拆分判定的移动能力

| 行为 | 当前最可信证据 | 可编码程度/主要缺口 |
|---|---|---|
| 平地行走 | `0x9BD757` 最新 T1 指令记录；`+0xE0` 梯形积分，`0x9BC992` 世界坐标投影 | **已证局部单步可编码**；不得用 `walkSpeed*dt` |
| 斜坡与换段 | 设计稿 §6.5 列 `0x9BF1FA` 边界、邻段 `+0x4C/+0x50` 的详细静态结论 | 有具体静态定位，**尚未在权威 C/EV 独立纳入及核验分支反证**，按 G40 |
| 空中 vx 与重力 | 19 Physics 字段和值；R2/T2/设计稿有数值，`0x9BDF18` | 主公式可写；技能例外/输入资格及单位不能冒称全路径 |
| 陆地跳 | `0x9BD20E`、默认目标倍率取1；`jumpSpeed=555` | **初速子式 `-jumpSpeed` 可实现**；资格和后续碰撞另列 |
| 水中跳 | `0x9BD42D`、目标 `swimSpeed=140`，倍率1 | **初速子式 `-(swimSpeed×5)` 可实现**；泳态切换资格另列 |
| 游泳四方向 | `0x70DF65` 与 T2、R2、设计稿原版路径说明 | 针对8水图有公式/数值；跨图泳态同步还需单测 |
| 落地/向上穿台/竖线 | `0xA4F6F1`、`0x9CC207`；R12旧版与设计稿最新版边界文字不完全一致 | **须先逐指令排除竖线/半宽歧义**；不把竖线当墙 |
| 下跳 | `0x95308C`、mpRecovery bit17为0、`K=-0.35355339` | 初速门有精确式，**穿台至下一fh状态**需串联验证 |
| 蹲下/站起 | `prone` 槽33，`0x93D238` 动作字条件 | 映射可做；输入释放及时序需单测 |
| 抓绳/爬绳/离绳 | 最新设计稿 §6.6：`0xA4FC6F` 抓取 x±10；`0x9D80EC` 的 `y += 3*verticalKey`；`0x9BFB52` 清挂绳 | **这不是完全空白的行为**；需将指令摘要与目标l/uf/端点场景做核证，姿态 `climb→rope` 为产品替代 |
| 坐下/站起 | `0x54634C` seat x±10/y±30；`0x9658CC` 收到0xCF后写 `user+0x2944`（设计稿新增链） | 座位数据与原版候选写链存在，需在非网络单人模型中决定如何授权替代触发 |
| 攻击动作 | C-035/C-039/EV-27：weapon variant表 `decryptedRand%count` | 表级/一次 `action` Render Event可做；PRNG逐位和命中矩形非现阶段功能 |
| Alert | C-036/EV-29 九次写5000，计时递减 G12未知 | 产品 5000ms行为等价候选存在，但 Frozen actor 无alert attrs |
| 死亡/受击 | G11 `user+0x61` owner未归属 | 无伤害/死亡结算为本期非目标；**不应阻塞**上述模块 |
| Tick | C-030/EV-23 的 0x1E；G34仍开 | 供确定性产品测试的step可写，**不能声称原版帧频已闭合** |

在矩阵中某个子式 RE-READY 不等于整项动作已经在所有状态、地图边缘与输入下精确对齐。设计稿最新的鞋子 owner 链 `0x94B9C2→0x9BFD4C`、四个 `DEC([move+0x190])=1`、owner鞋 `+0x198` 默认量以及 `0xA4F36C` 立足属性构造，必须在“参数已定”声明中与“字段名未命名但目标默认值可追”区分；本轮没有新原始二进制佐证它们。

### P4 — Portal 状态转移

**可立即实现**：读取所有 pt/pn/tm/tn 逻辑记录、上键触发、固定 x±20/y±50、立足资格、目标在13图闭包内的边过滤、原子 replace/失败回滚/sceneEpoch、跨图 targetMap/targetName的产品解析。pt1和pt3无pv照样要换图，pt2有pv不代表只pt2可以跳。

**必须核对的新旧取证范围**：
- 较早 `MAP-R1-R14-REVERSE.md` 的 R10 结论仅是 **在“上键命中/发送路径及一层”没有写玩家 +0x20/+0x38**，不等于新场景进入永远不写。
- 当前设计稿 §16 M12/R10 另外写到**同图 `0x95533D→0x9C1113` 将 `+0x28F8/+0x28FC` 写进位置槽；跨图收到 `0x81` 后 `0x9507F0` 从目标记录 `+0xC/+0x10` 初始化坐标，Y 再减10；同图间隔为 `0x258`**。这些是明确的静态地址级取证总结，优先核对，不应重复写成“压根不存在接收链”。当前权威 Claims/Evidence 尚未为这段收包/坐标写入独立建条，且状态复位/Camera/失败处理仍未形成完整证据链。因此 G38 作为**尚待静态交叉核验**，而不是“落点只能运行时猜”。
- 即便核证 X、Y 与600ms，也**不能自动证明**着地 Foothold snap、vx/vy/rope/seat清理、Camera刷新和跨图冷却与同图一致。P4 精确验收这些子规则另列在矩阵。
- 目标数据内部互反门远多于四条：旧 `MapScenePlanV1` §7 只启四门，阶段草案 §1.4 要求13图走廊所有已指定内门。是**设计选择冲突而非原版证据缺失**，需要在 P4 发布前解决。

## 2. 最小验收门与建议实施顺序

1. **先交付 P0 中已闭合源表/Physics/Tile与Obj键的 Reader 和 Builder诊断测试**；同一次构建必须让13图 type/flow unsupported 报确切地图和路径，不能静默“成功”。
2. **对 G36/G37/G39 做定点原版流图补证**。若 DLL/EXE 静态输入不可取得，明确按“待外部合法研究输入”记录；不得拿临时画面称13图完成。产品批准替代绘制规则后才可发布。
3. **P1 可以先做 type0、Tile/Obj产品顺序与首帧Portal**，并单独验收；人物精确插层别混入该子任务。
4. **P2 先实现 Frozen world/world−camera、VR/fallback/resize，再批准具体中心跟随产品规则**；不等 G10 全部原版 Camera 才能开工。
5. **P3 按完整独立行为用例逐个收口**，优先平地一步、端点换段、地/水两种初速、落地/下跳、抓绳/座位，然后输入状态、计时。不可修改 Physics 原始数值或偷偷取常数替代 decrypt。
6. **P4 从13图真实 PortalRecord 构建全内图边表**；先以已有设计稿 M12/R10 地址静态核证同/跨图落点，再验状态复位/Camera/冷却；发生错误保持旧世界。

## 3. 交付验收规则

阶段为 Ready 当且仅当其所有必需子项处于 `RE-READY` 或 `PRODUCT-READY` 且可复现的原版基线与产品等价验收分开。设计待批、静态待查、运行时待采和外部资料阻塞都不能靠“以后再查”宣布完成。当前只有上表明列的**独立子模块**满足交付条件。设计冲突只在本证据裁决之后按 `DESIGN-DECISION-BACKLOG.md` 收口。
