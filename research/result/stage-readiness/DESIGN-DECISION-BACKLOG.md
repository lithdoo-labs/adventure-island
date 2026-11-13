# Design decision backlog — only after evidence review

> 本清单的先决文件：同目录 `TARGETED-FORENSICS-RESULT.md`、`CRITICAL-REVERSE-GAPS.md`、`P0-P4-READINESS-REPORT.md` 和 65 项证据矩阵。**本文是候选产品/协议决定，不修改 Frozen `components/RENDER-NODE-ABI-V1.md`，不覆盖权威 `research/source-of-truth/`。** 设计稿是产品范围的起点，不是把原版未知事实变为事实的证据工具。

## 决策优先级与依赖关系

```text
A. 目标13图源数据与静态证据边界
   ├─ G36/G39 背景type1–4和动画行为
   ├─ G37 Obj.flow/rx
   └─ G38 P4落点/状态, G40/G41真实Movement子行为
             ↓
B. 确认产品精度：原版精确 vs 显式等价验收
             ↓
C. 审查冻结ABI v1可表达性与是否立项v2
             ↓
D. 逐项修订阶段设计稿、MapScenePlan/实现和测试
             ↓
E. 13图全闭包与完整P0–P4验收
```

不能从已有 Plan 只能画 type0 出发，倒推原版其余 type 不重要；也不能因有比较器缺口，就先替产品选择 `pass` 或 `layer-only` 场景树。

| 优先级 | 决策ID | 真实事实与未知 | 当前 Frozen ABI 能否表达 | 方案与签署权 | 验收影响 |
|---|---|---|---|---|---|
| 1 | D-BACK | 13图387条Back中278为type1–4。EXE旧报告提供平铺mode/20000/abs(rate)和0步长特殊处理；+0x98、初offset、时钟仍未恢复（G36/G39） | **不能以合规完整13图发布**；v1 §5.3明文遇type1–7 unsupported，虽然attrs保留了type/rx/ry/cx/cy | **先逆向**；产品负责人决定需原版动态精度或明确产品等价的静态/滚动标准。若要允许非0，按正式 ABI v2 / ScenePlan v2 版本评审，不能直接改v1字句 | P0/P1 Critical |
| 2 | D-OBJ-FLOW | 7水图55个 `flow` 放置，部分有 `rx`；旧21图无flow样本不适用（G37） | **不行**：ObjPlacementV1没有flow/rx，v1 §5.4明确见flow fail-closed | 先由R13之外的 `0x667EB1→0x66A8D5` 取证。产品负责人决定动画等价门；ABI维护者评审新的Placement schema版本或经可证明等价的资源预烘焙。**不可直接丢字段** | P0/P1 Critical |
| 3 | D-PORTAL-LINKS | 13图包含远多于4个pt1/2/3的内图/同图目标，`MapScenePlanV1` §7目前只启四门，专项设计§1.4要求整条走廊 | 现 v1 的 PortalRecord 可表达链接；**不需ABI v2** | 阶段产品负责人确认以13图完整内边为验收范围；后修旧Plan四门“第一批”限制。测试每条边与A→B→A，区分pt7/8/10不按普通内图切换 | P4 Critical（纯设计） |
| 4 | D-LANDING | 旧R10发送路径无坐标写属实；最新设计§16 M12/R10指出同图0x95533D→0x9C1113、跨图0x9507F0从目标记录x/y并y-10、同图CD0x258。权威C/EV未登记此较新写链；速度/foothold/Camera状态还未全证（G38） | Field Runtime处理坐标/状态，**本身无需扩RenderNode** | 先用可复查EXE对新地址做静态交叉核验并在权威claims/evidence追加合规结论；如不可恢复全部状态，由产品负责人批准详细等价state machine，并分别验收“目标名称正确”和“落点/状态准确” | P4 Critical |
| 5 | D-ACTOR-LAYER | C-001/002键已证，两个加载通道已证；比较器与Avatar跨对象深度、tie和Draw遍历尚缺（G01/G07/G08/G09/G24/G27/G33）。草案§4.3用`pass=behind/front`；Frozen ABI §6只有每layer单节点+avatar | **v1只能layer-only**。额外`pass`不是已冻结attrs；双节点同一layer也违反树结构 | 产品负责人先定“产品顺序即可”还是“原版跨对象遮挡必须”。前者**修改草案§4.3**并采用冻结v1 Obj-before-Tile/源序/按layer绘制；后者须先补原版Comparator/Depth，再申请v2（不要假称Obj-before-Tile是原版） | P1 High |
| 6 | D-CAMERA | C-026/EV-21 VR内缩A；C-027 viewport800×600只是推断；G10原版follow未证。Frozen ABI 1:1 screen=world-camera；草案§4.2/§10明确写“身体原点中心、边界夹取、小图居中、无deadzone” | **可在v1**：Camera权威保持在Field Runtime，scene-view只呈现x/y | 由产品负责人确认该**已有明确描述的方案**是正式验收基线（不是再造一套HeavenClient参数）；测试中心、贴边、小于viewport/VR轴折叠、resize。原版follow继续单列研究，不影响按产品标准开发 | P2 High |
| 7 | D-PAUSED | 草案使用 `cms-actor.paused`，Frozen ABI v1只接受指定attrs，包含 locomotion但无paused | **不能把paused属性直接投影给actor** | 优先由Field Runtime暂停状态更新/事件投递并验证Frame生命周期；若确需组件动画冻结及续播状态，则独立提出 ABI v2 attrs 或事件设计，经版本评审。仅修草案来避免未授权属性可由实现/设计负责人办理 | P1/P3 High |
| 8 | D-MOVEMENT-ACCEPTANCE | Physics表值与T1地面一步可取；设计§6.5比旧逆向报告更详（Foothold换段、鞋子owner、陆/水/下跳、抓绳/座位），但权威新EV尚未逐项复核。G34时间单位与G40/G41子分支未闭合 | Frozen actor locomotion可表现stand/walk/jump/prone/swim/sit/climb，**世界积分在Field Runtime** | 先按矩阵逐分支复核原版静态地址；产品负责人决定测试对照哪些可用目标默认数值，哪几个保持静态待证。任何等价替代要独立标注，不能把鞋slot字段名字猜出或随意写walkForce px/s | P3 Critical |
| 9 | D-ALERT | user+0x3BC写5000 A；真实递减G12未闭合；产品倒计时候选有文字，冻结actor无alert locomotion | **不支持新增alert枚举** | 静态追计时；若只影响内部状态，Field Runtime持有，不把alert输出成未知locomotion。若要求看到alert，需另行产品批准v2动作表达或合规的v1 action映射（不能复用未定义attrs） | P3 High |
| 10 | D-PV-ANIMATION | pt2/7 pv、pt10 image存在源资源，MapHelper已导入adventure；实际Frame调度时间G39未知；旧组件文档仍写资源未入库 | 静态首帧可以在v1合法表达；动态帧有loop字段但“无delay停首帧”是产品限制 | 更新过时资源现状说明（不是改ABI）；产品负责人确认P1首帧与完整动画的分别验收。若全13图必须动画准确，先补时钟证据 | P1 High |
| 11 | D-ROOT-MILESTONE | 根`DESIGN.md`的两张**合成**场景是旧里程碑，专项设计以13张**真实**场景、P0–P4定义验收 | 与ABI无冲突 | 由设计负责人在专项验收清单中标出“2合成＝早期回归fixture”与“13真实＝当前交付门”；如修改根历史文档只做说明，不改历史验收事实 | 全阶段范围 |
| 12 | D-SEAT-DEATH | 13图三城镇座位可读。伤害/死亡（G11）与任务/技能非本阶段；但草案与长期目标存在死亡动作考量 | `cms-seat` 当前Future而非冻结MVP；玩家`sit` locomotion在actor v1可用。死亡/alert额外姿态不支持 | 继续以Field Runtime持有SeatRecord而非凭空加`cms-seat`。产品负责人确认“死亡/受击”仅长期，不纳入当前13图功能交付，避免把非目标gap误列Critical | P3 Medium |

## 逐项授权门槛与版本边界

- **可以只修改专项设计稿或实现，而无需改Frozen ABI**：更正四门旧范围、Camera产品follow的完整测试、改掉 `cms-actor.paused` 非法属性（如通过Runtime内控合法实现）、区分两张合成图与13图范围、修复过期MapHelper描述、对v1产品排序诚实标注。
- **必须正式 ABI 版本评审**：让 type1–4 在“原v1 MUST unsupported”约束下被允许发布；让Obj.flow/rx成为v1 ObjPlacement没有的字段；改变 `cms-scene-view` 的冻结children顺序/每层唯一节点/引入`pass`；新增 `paused`、`alert`、`dead` 等未冻attrs/locomotion。评审应同时检查 MapScenePlan 版本/Adapter诊断/Content Version。
- **不能直接修改设计来伪造的原版事实**：Tile/Obj相同容器、比较器方向、同键稳定性、跨对象Avatar zmap、Camera原版平滑、type1–4原版滚动相位、Portal精确进入坐标与状态清理、Movement时间单位。它们要么有可追溯指令与源数据，要么明确是产品选择。

## 可执行收口顺序（不要颠倒）

1. 评审本轮新 G36–G41 的实际源地图覆盖和既有逆向材料；优先补 type1–4、Obj.flow 及较新设计稿中 Portal 写链的独立静态证据；R13 的异常 out/栈布局也先静态校验。
2. 明确13图**视觉精确度**与**物理原版精确度**分别要到什么程度。对未证事项签发带测试标准的产品等价授权；不能仅写“暂时随便实现”。
3. 决定是否立项 `MapScenePlanV2/RenderNode ABI v2`。需要版本评审时保留v1不动；签署适配策略、解析诊断与兼容测试。
4. 对不需要v2的冲突，修专项草案 §1.4/§4.2/§4.3/§7及状态流转章节（避免修改两图旧里程碑的历史事实）。
5. 完成真实13图Builder闭包、P1完整资源帧、P2 Camera产品验收、P3逐动作数值+状态、P4每门落点/失败回滚和返回旧图sceneEpoch测试。

**审批请求包需携带**：对应矩阵需求ID、原版Claim/EV/Gap、静态反证和目标图实例、候选实现的可观察差异、产品验收测试及ABI影响。不获得批准不得把替代行为作为CMS079原版行为发布。
