# P0–P4 Stage Readiness Report (13 real maps)

**研究基线**：`design/adventure-field-map-scene` 原 HEAD `0f5ded86722393e7708ad8398ebe1a9a1997161c`，2026-11-13；**t080 轮（2026-11-13/14）在 `e676ab0abde6109f3a7bafedac1d542fbdb9a671` 上实际执行定点静态逆向并经独立复核**；**t082 轮（2026-11-14）在 `e137fc1919c32f455287627852a7785ae2c3f8e0` 上继续 G38/G40/G41/R13/Gr2D 定点静态逆向并经独立盲审+对抗审**（成果见 `forensics/T082-*` 六份报告）；**t083 轮（2026-11-14）为 t082 验收后的证据对账修复轮，不新增 Claim/Evidence/Gap**（六项一致性修复见文中 t083 备忘与 `T083-EVIDENCE-RECONCILIATION-REPORT.md`）。目标地图列表由 `docs/implementation/2026-11-09-adventure-field-map-scene-design-draft.md` §1.3 指定。本报告为阶段裁决，不取代 `research/source-of-truth/{claims,gaps,evidence}.csv`。详见同目录 **65 行** `P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv`；每行提供原版事实、精度、Claim、Evidence、Gap、样本覆盖、冲突、后续路径、验收与授权。

## 0. 结论和证据等级边界

**总体：NOT STAGE-READY。** 不是“不能开工”，而是 **5 个阶段都未满足“全部必要行为有原版证据或正式产品替代且验收边界分开”** 的逐阶段就绪规则。独立的 P0 数据装载、P1 数值键、P2 VR、P3 若干动力子函数、P4 触发和状态提交平台代码可以开工并分别验收。不得因某个阶段总状态为未就绪而阻塞这些模块。

截至本轮，权威台账分五个时点：早期 Clean-Room 基线为 47 Claim / 32 Evidence / **35 Gap**；阶段缺口登记（G36–G41）后 t080 **开始**时为 47 Claim / 32 Evidence / **41 Gap**；t080 **完成**（3b7b987c）为 **60 Claim / 41 Evidence / 41 Gap**；t081 **完成**（e137fc19，EV-42 自 EV-34 拆分登记）为 **60 Claim / 42 Evidence / 41 Gap**；t082 **完成**（db4d2261）为 **77 Claim / 63 Evidence / 41 Gap**（新增 C-061..C-077、EV-43..EV-63，全部来自实际反汇编并经独立盲审+对抗审；G38/G40/G41/G01/G24/G27 六个 Gap 的 verified/unresolved 范围重划，无 Gap 关闭——各自仍有明确静态或运行时残项）。**t083 修复轮不新增 Claim/Evidence/Gap：只修正既有记录的证据一致性问题（EV-63 FSDB 来源绑定与 fh 清点 2154→2283、EV-57/C-073 halfWidth 普查 17×1/4×动态/1×不可解码→23×1/1×2、C-055/C-056/EV-36/EV-37 的 t080 标签与 hint 语义回写）**。现 Gap 分布：CLOSED-STATIC 14 / PARTIAL-STATIC 12 / OPEN-STATIC 9 / OPEN-RUNTIME 4 / BLOCKED 1 / SUPERSEDED 1。**上一轮"没有原始 EXE/DLL、新指令证据 0 条"的阻塞在 t080 解除**——`.work` 内哈希匹配的原始输入被主 Agent 与 Reviewer 双方独立核验并使用（t082 再次双重核验）。新增 Critical 结论 C-048..C-058、C-060 经 Reviewer ACCEPT（含修正并入）后定 CLOSED-STATIC；C-059 经 REJECT→字节重验后定 CLOSED-STATIC/A；**t082 的 C-061..C-077 经盲审互证与对抗审修正（两处 ACCEPT-WITH-CORRECTIONS：0x404BA3 写者归属、虚表组结构）后定 CLOSED-STATIC**。**绝不以该统计数量代替工程完成定义**。

下面三种信息必须独立：
1. **原版可信事实**：例如 C-001/EV-01 计算 Tile 键、C-026/EV-21 VR±(400,300)、C-034/EV-26 Physics 字段；以及已有反汇编报告中精确到 VA 的局部函数。
2. **设计稿中的"已有取证总结"**：第 6.5、6.6、16 节的 R10 落点链、鞋子 owner、Foothold 换段、爬绳 y+=3×键等地址级定位点，在 t080 已**大部分独立核验为权威指令级证据**（R10 落点链→C-054/C-055；爬绳→C-056；座位→C-057；fh 邻段读取→EV-39 关联）；t082 又闭合了 0x9BF1FA 完整体（C-067）与 0xA4FC6F 抓绳体（C-069）——该清单中仍未核验的余留只剩**鞋 +0x198 默认与四 DEC 槽**（G40），继续按"待核静态定位点"对待——**不能仅因写入设计稿就自动升级为权威指令级证据**的规则不变。
3. **正式的产品实现规则**：Frozen ABI 的 1:1、Obj-before-Tile、source-order stable、layer-only、Portal 首帧、world x/y 与 RenderNode；以及阶段设计稿 §4.2 提出的中心跟随、边界夹取、小图居中、无 deadzone。后者已经给出具体可编码方案，但是否视为正式获批需在设计评审中确认；绝非 CMS079 原版规则。

矩阵中 `RE-GAP-STATIC` 的含义是 **仍然有特定静态验证动作或指令级佐证不足**；`RE-GAP-RUNTIME` 与 `EXTERNAL-BLOCKED` 仅在静态确实已穷尽或交付素材缺失时选用。本轮没有证据足以把 G36/G37/G38/G40/G41 直接归为 runtime-only。仓库包含地图 PNG Resource（不能误写成所有图像缺失），但 Builder 尚未通过目标全闭包测试；反汇编所需的原始 EXE/DLL 已在 t080 于 `.work` 取得并核验（研究工具输入，不等于最终游戏必须分发的素材）。

## 1. 逐阶段现状

| 阶段 | 矩阵行数 | 可独立交付 | 真正阻塞完整阶段 | 阶段裁决 |
|---|---:|---|---|---|
| **P0 Map FSDB / ScenePlan / Bundle** | 13 | 13图map/Tile/普通Obj/FH/Rope/Seat/Portal原记录、Physics表、VR与fallback、Tile/Obj key | 278条非type0 Back、7图55条Obj.flow、Builder目标资源闭包未跑完、未知字段消费表 | **未就绪** |
| **P1 Scene Render** | 15 | type0静态背景、Tile/普通Obj的产品锚点、原版整数key、首帧Portal资源/可见性、视口批绘 | type1–4完整画面及flow、时间/帧、原版排序；若验收采用冻结的产品排序则最后一项可独立放行 | **未就绪** |
| **P2 World/Camera/Viewport** | 8 | VR内缩、产品world−camera 1:1、minimap回退、resize不写world | Camera原版跟随未知；设计稿已有“中心跟随+夹取+小图居中、无deadzone”产品候选，待审批对照验收及Frozen ABI职责界定；0x1E/0x5A关系仍开放 | **待正式策略验收** |
| **P3 Movement/Physics** | 20 | Physics真实数值/字段、T1局部地面一步、默认陆/水跳初速子式、攻击表级动作选择 | 数值代入及特殊槽取证、完整Foothold/落地/下跳/抓绳/坐下/姿态/时间；见下表逐行为 | **未就绪** |
| **P4 Portal Transition** | 9 | pt逻辑、tm/tn映射、原子replace+失败回滚、跨图坐标提交子行为（P4-04 限界 RE-READY） | 坐标写入子行为已取得新的直接静态证据（C-054/EV-35 同图、C-055/EV-36 跨图）；Foothold 重绑、完整状态重置、Camera 更新及剩余 opcode 分发表字节绑定仍未完全闭合；上键命中框数值（P4-01）与全13连通"四门"冲突另列 | **未就绪** |

### P0 — 内容阶段清单

**RE-READY**：Tile 的 `u/no/zM`、Obj 的 `oS/l0/l1/l2/z/f/zM`（基础字段；flow 子集另列 P0-05）、Foothold 连接、19 Physics doubles（各有权威 EV 支撑）。TileFrame 目标三包 `folkvillige` (27)、`greensandySeaFloor` (26)、`sandySeaFloor` (28) 均有 `z`。注意各 layer 可能引用不同 TileSet；不可把三包合成一个全局键索引。**t081 边界修订**：13 图 map.info allowlist（P0-01）与 Rope/Seat 坐标（P0-09）的数据存在性已清点但尚无权威 EV 登记——**t082 已登记 FSDB 数据 EV（EV-63：13 图 Foothold/Rope/Seat 全量清点，fh 2283 条全带 prev/next【t083 修正：t082 原计 2154 为清点错误，机器复核 13 文件 2283 条；来源绑定改为确定性 manifest（`T083-FSDB-MANIFEST.txt`，23 文件/2311 记录，逐文件 SHA-256）】、ladder 14/rope 2/seat 12、退化段 NOT PRESENT），P0-09 据此回升 RE-READY**；P0-01 的 allowlist 数据 EV 仍待登记（保持 RE-GAP-STATIC）。

**PRODUCT-READY**：完整 VR 源可按 C-026 原版收缩；无 VR 的 `minimap→foothold bbox` 是正式产品回退；`info/link` 本次 13 图没有，但允许的泛化解析规则需单独夹具。不是“所有 CMS 地图都无 link”。

**RE-GAP-STATIC**：Back type1–4 与 Obj flow 的**静态布置语义已在 t080 指令级闭合**（mode 位、跨度公式、零步长回退、循环界、对象注册——C-048..C-052），剩余的是**动态绘制层**（+0x90/+0x98 运行时体与 view slot 取值）。必须保留所有原始影响视觉的字段，Adapter 不可静默丢弃。当前 Frozen v1 遇到这些字段直接 unsupported，符合保守契约但**13图整体不能发布为完整 Plan**（发布路径见 D-BACK/D-OBJ-FLOW 的 ABI v2/预烘焙评审）。MapHelper 的游戏 pv 等资源已在 `content/[FSDB]adventure`；这不是需要另行获得 WZ 全量客户端的问题。资源 Builder 从独立读取 MapScenePlan 的架构/验证任务，与逆向证据缺失须分开跟踪。

### P1 — 场景呈现与排序

1. **原版已确认**：Tile 键 `canvasZ + 10*(layer*3000 - zM) - 1073721834`；Obj 键 `layer*30000 + z - 1073739824`；Tile 与 Obj 创建/分派不在同一条通道。背景以 index×1000 为基底的旧结论仍 C-024/B，比较方向 G35 未证。Portal 的 `pv/ph/psh` 分支能找到静态地址和已导入游戏帧。
2. **原版未证明**：最终 Tile/Obj 容器、比较器、等键稳定性、不同 layer Draw 遍历、Avatar 跨对象插入、背景 type1–4 **动态呈现**（静态布置已证）和动画 delay 时钟。22 张 slot45 候选无比较器 ≠ 已知道原版排序方向。R13 的出参矛盾已在 t080 重构完成（C-053：arg1=OUT，参数序无错；余留为运行时 slot25 写出参绑定，单值 dump 决 G24+G27）。
3. **产品可实施**：Frozen ABI v1 明确 Obj-before-Tile、各组升序、同键源序、layer0..7，再独立 Avatar 及 Portal；这些规则只能用于**产品级**像素验收。设计稿 `pass=behind/front` 与该树正面冲突，不能偷偷增加 frozen attrs。

背景类型逐项：type0 可依产品锚定画；type1 轴重复、type2 城镇重复、type3 双轴、type4 横向滚动的**原版平铺/零步长/跨度证据已在 t080 取得**（C-048..C-051），剩余为首帧像素所需的 view slot 值与 +0x90/+0x98 动态体，或正式产品等价批准。动画有完整 `delay` 的动态资源同样不能只拿旧帧注册函数冒充时间精度（注册链已证、时钟单位未证）。

### P2 — Camera 和世界坐标

- **RE-READY**：VR 算法 400/300、向零收敛中点；已接入的逻辑 bounds 不能在组件第二次内缩。
- **PRODUCT-READY**：`screen = world - camera`、1:1 CSS像素、Y向下、resize 仅改变视野；无 VR 时回退由产品定义。
- **DESIGN-DECISION（独立审批）**：设计稿 §4.2 / §10 已写了**无 deadzone、人物中心跟随再夹取、小图居中**的可执行方案，它比“可参考 HeavenClient”更明确。由于 Frozen ABI 只冻结 viewport left-top 和1:1、没有冻结完整跟随函数，必须确认该方案成为本阶段产品验收标准，并写精确中心/VR塌缩/resize测试；若要求原版真实 Camera，则 G10 仍缺跟随写链。G34 `0x1E` 与 `0x5A` 的关系不得补一个经验数。

### P3 — 必须拆分判定的移动能力

| 行为 | 当前最可信证据 | 可编码程度/主要缺口 |
|---|---|---|
| 平地行走 | `0x9BD757` 最新 T1 指令记录；`+0xE0` 梯形积分，`0x9BC992` 世界坐标投影 | **已证局部单步可编码**；不得用 `walkSpeed*dt` |
| 斜坡与换段 | **t082：0x9BF1FA 完整链（C-067）**：双向邻接 + `[N+0x30]>0` 转移门 + 自环守卫 + 跨越插值 + 无邻接掉落（vt+0x14(M,NULL)）+ 每 tick 坡面重投影；0x9BF9D3=地图边界钳制；fh 布局统一（C-068）+ FSDB prev/next 全量 | **换段/吸附算法已闭合可编码**（P3-03 RE-READY）；余留 fh loader 写侧直证与 slot3 变体（不阻塞） |
| 空中 vx 与重力 | 19 Physics 字段和值；R2/T2/设计稿有数值，`0x9BDF18` | 主公式可写；技能例外/输入资格及单位不能冒称全路径 |
| 陆地跳 | `0x9BD20E`、默认目标倍率取1；`jumpSpeed=555` | **初速子式 `-jumpSpeed` 可实现**；资格和后续碰撞另列 |
| 水中跳 | `0x9BD42D`、目标 `swimSpeed=140`，倍率1 | **初速子式 `-(swimSpeed×5)` 可实现**；泳态切换资格另列 |
| 游泳四方向 | `0x70DF65` 与 T2、R2、设计稿原版路径说明 | 针对8水图有公式/数值；跨图泳态同步还需单测 |
| 落地/向上穿台/竖线 | `0xA4F6F1`、`0x9CC207`；**t083 全面复核：24 调用点半宽终审（C-073/EV-57）** | 半宽逐调用点常量终审（t083：23×1、1×2、0 动态、0 不可解码；t082 原表 17×1/4×动态/1×不可解码=23 系漏列与错读，已修正）；不把竖线当墙 |
| 下跳 | `0x95308C`、mpRecovery bit17为0、`K=-0.35355339` | 初速门有精确式，**穿台至下一fh状态**需串联验证 |
| 蹲下/站起 | `prone` 槽33，`0x93D238` 动作字条件 | 映射可做；输入释放及时序需单测 |
| 抓绳/爬绳/离绳 | **t082**：0xA4FC6F 全函数（C-069：x 跨度±10、y 框内含、stride 0x1C）；抓绳键位判定（C-071：DOWN 盒 [X±10]×[Y−20,Y]、UP 盒 [X±10]×[Y,Y+10]+顶可达门、命中写 X←rope.x/Y←顶或min、双速度清零、ctx 替换）；0x9BFB52 设段/设绳安装器全函数（C-070）；端点槽名修正（C-072） | **抓绳/离绳/端点已闭合可编码**（P3-14 RE-READY）；余留 ladder/rope 类型分叉与紧凑绳记录 hint 张力（运行时 dump）；姿态 `climb→rope` 仍为产品替代 |
| 坐下/站起 | `0x54634C` seat x±10/y±30；`0x9658CC` 收到0xCF后写 `user+0x2944`（设计稿新增链） | t080 已证座位状态写链（C-057）；**t082 已证 0xCF dispatch 指令级绑定（C-066：switch@0x9571BF case0→0x9658CC）**；**站起/取消链 0x6A0ADF 仍未读**，非网络单人授权另批 |
| 攻击动作 | C-035/C-039/EV-27：weapon variant表 `decryptedRand%count` | 表级/一次 `action` Render Event可做；PRNG逐位和命中矩形非现阶段功能 |
| Alert | C-036/EV-29 九次写5000，计时递减 G12未知 | 产品 5000ms行为等价候选存在，但 Frozen actor 无alert attrs |
| 死亡/受击 | G11 `user+0x61` owner未归属 | 无伤害/死亡结算为本期非目标；**不应阻塞**上述模块 |
| Tick | C-030/EV-23 的 0x1E；G34仍开 | 供确定性产品测试的step可写，**不能声称原版帧频已闭合** |

在矩阵中某个子式 RE-READY 不等于整项动作已经在所有状态、地图边缘与输入下精确对齐。设计稿最新的鞋子 owner 链 `0x94B9C2→0x9BFD4C`：t080 已读这对 owner 拷贝函数体（EV-37 附带的 decrypt 机器共址），但四个 `DEC([move+0x190])=1`、owner鞋 `+0x198` 默认量以及 `0xA4F36C` 立足属性构造仍未独立核验，必须在“参数已定”声明中与“字段名未命名但目标默认值可追”区分。

### P4 — Portal 状态转移

**可立即实现**：读取所有 pt/pn/tm/tn 逻辑记录、上键触发、目标在13图闭包内的边过滤、原子 replace/失败回滚/sceneEpoch、跨图 targetMap/targetName的产品解析。pt1和pt3无pv照样要换图，pt2有pv不代表只pt2可以跳。**t081 边界修订**：上键命中框（P4-01）的触发链已证（EV-35），但 x±20/y±50 框体数值尚无权威 EV——暂列 RE-GAP-STATIC，读 0x954B58/0x71B44D 后回升。

**必须核对的新旧取证范围（t080 后状态）**：
- 较早 `MAP-R1-R14-REVERSE.md` 的 R10 结论仅是 **在"上键命中/发送路径及一层"没有写玩家 +0x20/+0x38**——与接收侧落点链不矛盾，t080 已按字节澄清（发送路径确实不写；写入发生在接收/应用侧）。
- 设计稿 §16 M12/R10 的地址链**已在 t080 独立核验并登记为权威 Claim/Evidence**：同图 `0x95533D→[move-vt+0x40]→0x9C1113`（C-054/EV-35：pending `user+0x28F8/+0x28FC`、冷却门与 `0x78/0x258` 双窗、Y−10、加密落点 move+0x20/+0x38）；跨图 `0x81`→`0x9507F0`（C-055/EV-36：记录 `+0xC/+0x10`、Y−10、边界夹取、速度清零；**t082 修正：跨图调用 arg7=0，"FH 提示拷贝"分支恒不执行、hint 被清零——立即重绑只存在于 arg7≠0 的其它调用路径，见 C-062**）。opcode `0x0081=WARP_TO_MAP` 为语料库 A 级；**客户端分发表字节绑定（0x81→0x97EBC9 注册）仍未逐字节追证（t082 已闭合同型的 0xCF 绑定并刻画 0x81 的缺失环节：handler vtable 族无静态注册可见）**。
- 即便坐标链已证，也**不能自动证明**着地 Foothold snap 与状态复位——**t082 已闭合**：同图重绑 = 清段+通知、物理循环 0x9BE703 扫掠盒重建（C-061）；跨图 = 新 move 对象 + arg7=0 无立即重绑 + 0x9BC89F/0x9BC992 精确投影吸附（C-062/C-063）；0x953FA5 = 外观复位负结论、移动复位 = 新对象机制（C-065）；**opcode 0xCF dispatch 已指令级绑定（C-066），0x81→0x97EBC9 的 handler-vtable 注册机制仍 OPEN-STATIC**。Camera 刷新时机（P4-07/G10）与 0x9BE703 完整体仍未闭合，P4-06 保持 RE-GAP-STATIC（Camera 残项）、P4-05 升 RE-READY。
- 目标数据内部互反门远多于四条：旧 `MapScenePlanV1` §7 只启四门，阶段草案 §1.4 要求13图走廊所有已指定内门。是**设计选择冲突而非原版证据缺失**，需要在 P4 发布前解决。

## 2. 最小验收门与建议实施顺序

> **t080 备忘（历史注记，正文已就地同步）**：静态输入在 t080 取得并核验；G36/G37 静态布置层、G38 落点链、G40/G41 爬绳与座位、G39 注册链闭合的细节见 TARGETED-STATIC-FORENSICS-V2.md / INDEPENDENT-STATIC-REVIEW.md；矩阵 P4-04 以限界子行为升 RE-READY（边界见该行）。G36/G37/G39 的动态子层仍需一次最小运行时捕获或产品等价授权。

> **t082 备忘**：G38 重绑三体/状态复位/0xCF 绑定、G40 换段完整体、G41 抓绳/设段安装器、R13 [ebp-0x20]/slot45、Gr2D 虚表组的取证细节见 `forensics/T082-*` 六份报告（含盲审与对抗审）。矩阵 P0-09/P3-03/P3-06/P3-14/P4-05 升 RE-READY；P4-04 的 RE-READY（跨图坐标提交限界子行为）不受本轮影响、维持原判。G38/G40/G41 整体仍为 PARTIAL-STATIC（Camera、fh loader、ladder/rope 分叉、绳 hint 张力等残项明确登记）；阶段整体维持 NOT STAGE-READY。

> **t083 备忘（证据对账轮，不新增 Claim/Evidence/Gap）**：六项一致性修复——F1 EV-63 来源绑定改为确定性 FSDB manifest（fh 清点 2154→2283 机器复核修正）；F2 C-056/EV-37 绳端点标签统一为 C-072 权威语义（rope+0x10=top−5 端、rope+0x14=bottom+1 端）；F3 0xA4F6F1 半宽普查修正为 23×1/1×2/0 动态/0 不可解码（`T083-A4F6F1-CALLSITE-AUDIT.txt`）；F4 矩阵五项 RE-READY 行与 P3-15 的过期 minimum_next_work 清理；F5 本报告时间线修正（t080 完成=41 EV，42 EV 属 t081）；F6 C-055/EV-36 跨图 hint 语义按 C-062 回写（arg7=0 无 hint 拷贝/无立即吸附）。矩阵 RE-READY 集合不变（P0-04/P0-08/P0-09/P0-13/P1-07/P1-08/P2-02/P3-01/P3-03/P3-06/P3-07/P3-09/P3-14/P3-16/P4-04/P4-05）；阶段整体维持 NOT STAGE-READY。

1. **先交付 P0 中已闭合源表/Physics/Tile与Obj键的 Reader 和 Builder诊断测试**；同一次构建必须让13图 type/flow unsupported 报确切地图和路径，不能静默“成功”。（静态语义已证但 v1 ABI 无字段——产品发布路径见 DESIGN-DECISION-BACKLOG D-BACK/D-OBJ-FLOW。）
2. **对 G36/G37/G39 做动态层补证**：静态布置/注册链已闭合，剩余一次最小运行时捕获（slot25 出参 + view slot 值 + slot58 双采样）或产品等价批准；不得拿临时画面称13图完成。
3. **P1 可以先做 type0、Tile/Obj产品顺序与首帧Portal**，并单独验收；人物精确插层别混入该子任务。
4. **P2 先实现 Frozen world/world−camera、VR/fallback/resize，再批准具体中心跟随产品规则**；不等 G10 全部原版 Camera 才能开工。
5. **P3 按完整独立行为用例逐个收口**，优先平地一步、端点换段、地/水两种初速、落地/下跳、抓绳/座位，然后输入状态、计时。不可修改 Physics 原始数值或偷偷取常数替代 decrypt。
6. **P4 从13图真实 PortalRecord 构建全内图边表**；同/跨图落点链已静态核证（C-054/C-055），下一步验 Foothold 重绑/状态复位/Camera（P4-05..07）；发生错误保持旧世界。

## 3. 交付验收规则

阶段为 Ready 当且仅当其所有必需子项处于 `RE-READY` 或 `PRODUCT-READY` 且可复现的原版基线与产品等价验收分开。设计待批、静态待查、运行时待采和外部资料阻塞都不能靠“以后再查”宣布完成。当前只有上表明列的**独立子模块**满足交付条件。设计冲突只在本证据裁决之后按 `DESIGN-DECISION-BACKLOG.md` 收口。
