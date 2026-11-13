# Targeted forensics result — 13-map stage-only review

**基线**：`design/adventure-field-map-scene` 原 HEAD `0f5ded86722393e7708ad8398ebe1a9a1997161c`。研究优先级由 `docs/implementation/2026-11-09-adventure-field-map-scene-design-draft.md` 的 13 图与 P0–P4 设定。**本轮真实执行的是：逐图读取 GitHub 版本化 FSDB 静态源、交叉核对原有指令级报告与权威 Claims/Gaps、排除已知错误推断**。Git tree 未包含 `.work/task-036/game-image-unpacked.bin`、`Gr2D_DX8.dll` 或本机反汇编工作区；本轮**没有新机器字节反汇编、动态断点或客户端运行捕获**。下列地址是已有报告的可复查定位点，不能充当本轮新 EV-A。

## 1. 目标图逐项静态数据验证

读取源均为：
- `content/[FSDB]adventure/[struct]map.Map/map.<id>.json`
- `content/[FSDB]adventure/[group]map.Back/map.<id>.jsonl`
- `content/[FSDB]adventure/[group]map.Obj/map.<id>.jsonl`
- `content/[FSDB]adventure/[group]map.Portal/map.<id>.jsonl`
- `content/[FSDB]adventure/[group]map.Tile/map.<id>.jsonl`（有 Tile 者）
- 对应 `[group]map.TileFrame/map.tile.<tileSet>.jsonl`，以及 `[group]map.HelperFrame/map.helper.jsonl` 和 `[struct]physics.Default/physics.default.json`。

| mapId | Back 记录 | type0 | type1 | type2 | type3 | type4 | Obj flow | 有 VR | swim |
|---|---:|---:|---:|---:|---:|---:|---:|---|---:|
| 222000000 | 16 | 0 | 6 | 0 | 1 | 9 | 0 | 是 | 0 |
| 222000001 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 是 | 0 |
| 230030200 | 31 | 10 | 12 | 0 | 1 | 8 | 11 | 否 | 1 |
| 230030100 | 31 | 10 | 12 | 0 | 1 | 8 | 7 | 否 | 1 |
| 230030000 | 31 | 10 | 12 | 0 | 1 | 8 | 4 | 否 | 1 |
| 230020300 | 45 | 14 | 21 | 0 | 1 | 9 | 13 | 否 | 1 |
| 230020200 | 45 | 14 | 21 | 0 | 1 | 9 | 10 | 否 | 1 |
| 230020100 | 47 | 14 | 23 | 0 | 1 | 9 | 5 | 否 | 1 |
| 230020000 | 45 | 12 | 23 | 0 | 1 | 9 | 5 | 否 | 1 |
| 230000000 | 36 | 1 | 25 | 0 | 1 | 9 | 0 | 否 | 1 |
| 230000001 | 16 | 8 | 0 | 8 | 0 | 0 | 0 | 是 | 0 |
| 230000002 | 22 | 8 | 0 | 14 | 0 | 0 | 0 | 是 | 0 |
| 230000003 | 21 | 7 | 0 | 14 | 0 | 0 | 0 | 是 | 0 |
| **合计** | **387** | **109** | **—** | **36** | **—** | **—** | **55** | **5 是** | **8 水** |

非 type0 总量 = 387−109 = **278**。各图 Back 均有源 `bS/no/ani/x/y/rx/ry/type/cx/cy/f/a/front`。type2 只出现在三座城镇；type4 在童话村及水下图，是很难用“只画 type0”绕过的现实资源阻塞。55 个 Obj 的 `flow` 存在于 7 张图，且实际源记录带 `rx`（例如 `230020100` 内的 `flow:1,rx:"-8"`）；既有 `cms-map-layer` 声称 21 图样本 `flow=0` 并不否定本轮具体数据。

**TileFrame 核查**：本阶段实际采用 `folkvillige`（27 个画布）、`greensandySeaFloor`（26）、`sandySeaFloor`（28）。三个帧表均没有缺 `z` 的记录；ABI 列举的四张缺 z Canvas 均属于其他 tileset，不应当做本次阻塞。跨层混用 tileset 的 `230020300` 必须按**该 layer 的 tileSet**查 `u/no`，不能用地图级全局默认值。帧表存在不等于资源 PNG/Bundle 引用闭包已被 Builder 验证。

**物理值核对**：目标 `physics.default` 中 `walkForce=140000,walkSpeed=125,walkDrag=80000,slipForce=60000,slipSpeed=120,floatDrag1=100000,floatDrag2=10000,floatCoefficient=0.01,swimForce=120000,swimSpeed=140,flyForce=120000,flySpeed=200,gravityAcc=2000,fallSpeed=670,jumpSpeed=555,maxFriction=2,minFriction=0.05,swimSpeedDec=0.9,flyJumpDec=0.3499999940395355`。这是经过导入的原始参数**数值**，不是全部直接 px/s。C-034/EV-26 只保证 19 个存储偏移映射有原版证据，不自动证明角色专用加密乘数。

**Portal 实际类型**：13 图出现 pt 0/1/2/3/6/7/8/10，未见 pt 4/5/9/11/12/13。目标 `map.helper.jsonl` 共 91 条 HelperFrame 记录，示例 `portal/game/pv/0` 真实存在。历史 `cms-portal/DESIGN.md` “MapHelper 还没有进入 Content” 结论是旧阶段描述，不可覆盖当前 FSDB 事实。**资源已有 ≠ PWA Bundle 已闭合 ≠ 动画时钟已恢复**。目标图中的 `pt=10`（童话村两个）须检查 `image/default` 的可见分支。

## 2. R13 静态矛盾的针对性复查：先审 ABI/栈，再谈动态捕获

原有链：`0x666749..0x666FC5` Tile loader → `0x666ED5 call 0x427EB3` → `0x666F68` key → `0x42944A` get → `0x666F7D call [eax+0xB4]`，随后 `cmp eax,0; jge`。具体在 `MAP-R13-DISPATCH-COMPLETE.md`、`R13-427EB3-FORENSICS.md`、`R13-SLOT45-CANDIDATES.csv`，对应 C-001/C-007/C-012/C-014/C-017 与 EV-01/03/15/16/18/19。

已核旧证据之间的逻辑关系：
- `0x427EB3` 是**通用属性 PUT 包装器**，不是 RawCanvas 创建器；它通过层 slot25 写入成员。它是否对同一调用点执行所谓“8 个 cdecl 实参按右至左配对”，必须由**调用点 push/movsd/esp 实际变化与 wrapper ret 清栈**检验，不能把静态叙述的形参列表当成独立机器证据。
- 原报告在“`[ebp-0x10] = &V48`，`V48.vt=0xD`”的推导下得到 `call [13+0xB4]`，这表明**参数映射或间接层假设发生矛盾**，而不是证明机器实际从地址 0xC1 调用，也不证明唯一解是 runtime dump。
- `[ebp-0x10]` 在 0x66677C..0x666B6D 被描述为多次 SEH frame 相关临时；必须重建该地址在 `0x666ED5` 附近的**同一 ESP/EBP 基准**、其最后支配性写入、变量/寄存器重用、栈是否额外调整；检查该局部是 **out 指针、COM smart pointer slot、VARIANT slot 或 SEH 临时**。
- 对 wrapper 要重建 `movsd ×4` 的两个 16B VARIANT 拷贝方向、`ret N`、`thiscall/cdecl/stdcall` 的实参消耗与实际输出指针。排除反证时同时检查 `0x42944A` 返回的是对象指针、指针到指针还是 VARIANT 地址，并检查 Call 前两次解引用指向合法虚表的条件。
- 当前没有与原 EXE 字节对应的本地文件，因此 **没有办法严谨地宣布以上重算已完成**。按阶段判定列 **RE-GAP-STATIC（还存在明确可做的静态核查）**；权威 G27 既有 OPEN-RUNTIME 标签在未取得新直接字节前不私自“闭合”。只有静态检查完上述调用/局部矛盾仍不可判时，才进入**最小运行时抓取**：bp 0x666F77，取 ESI、[ESI]、[EBP−0x10]、ESP/EBP及对象头+调用栈，并与 DLL 22 张 slot45 候选合法范围对照。
- 同时 G07 尚有 `0x43286E/0x44484B/0x429411/0x43E3A6` 的**可静态读函数体**；真正比较器可能在此或 Canvas Draw 遍历。22 个 slot45 候选没有插入语义不能排除其他函数存在比较器，也不能证明最终容器相同或不同。

**结果**：重确认的是反证边界及静态待办，**没有新增 A 级指令结果**。请勿将该审查写成“R13 已闭合”。

## 3. Background 与 Obj.flow 定点分析

原有背景函数入口 `0x669397`，普通 type0–3 路径在 `0x66A3AA/+0x98`；非0平铺辅助 `0x66A8D5`，mode bit0 水平/bit1 垂直；type4/6 横向滚动取 `rx`，type5/7 纵向取 `ry`，`0x66A567` 结合 `0x43715C` 和 `20000/abs(rate)`；mode转换对应 type4→1、type5→2、type6/7→3。`+0x98` 原版只证明参数组合，**无法由现有报告直接推出** `(100+rx)/100×camera` 整式。 `cx=0` 背景分支的替代取 layer slotB8/C0 和 child slot58，而非图片尺寸；强行 tile by natural width 是反证。

Obj 在 `0x667EB1` 也调用同一 `0x66A8D5`，该调用以 `flow` 为 mode，`[ebp+0x20]=1`，与背景的 `[ebp+0x20]=0` 不同。**关键静态实验**是把目标 55 条 `flow=1/rx` 代入已恢复的 `mode/step/child slot` 数据流，确定它对画布重复、流动速度或初始动画哪一项生效。未获得原始函数的新字节/Canvas 实现前不猜渲染效果，也不能因 `r=0` 就允许 Adapter 丢弃 flow。

## 4. Movement 取证细度与已知参数

- `0xA4D393` Physics loader → C-034/EV-26；`0xB0CB70` m4 `0x9BE703` → C-029/EV-22；`0x9BCCFB` 保存 `move+0x190 = [Physics+0xAC]` 且出现 `0x1E` → C-030/EV-23。上述结论是“字段/入口已证”，不是所有分支都已证。
- `MAP-T1-T2-REVERSE.md`（日期 2026-11-12）对 `0x9BD757` 的**留在同一 Foothold 段的步长**重建：速度 P 经过平段/缓坡/陡坡驱动，`slot1 += (slot2+P)*dt*0.5`、`slot2=P`，`0x9BF1FA→0x9BC992` 把 slot1 投影回 (x,y)。只有该局部支可在给定参数后独立实现，`0x9BF1FA` 跨段状态与初值不被此式证明。旧 T1 简化式已被同文件撤回。 **补充：**该 T1 文件局部范围外的端点/换段详细条件，已在当前设计稿 §6.5 的 `0x9BF1FA` 后续总结中给出（`+0x4C/+0x50` 邻段指针、比例/截断/失去立足）；故缺口是这些较新地址级结论的独立 C/EV 交叉核验和真实图边界测试，而不是完全没有规则。
- `MAP-R1-R14-REVERSE.md` 的 `0xA4F6F1` 半宽 1、向下交线、竖线分支及 `0x9CC207` 首接触是可查起点；R12 在 `x1==x2` 的描述里含“相等继续”/“jge排除”和除 0 疑点，必须用目标范围内退化 Foothold 数据和真实比较顺序定点排除，不能继续冒称全部墙碰撞 A。
- `0x9BD1FD` + jumpSpeed 555 是陆地起跳参数；目标默认鞋槽对应的陆跳 `-jumpSpeed`、水跳 `-(swimSpeed*5)` 在设计 R4 有静态解释，作为**默认状态子式**可以编码，不应推广为所有角色/所有泳态的完整积分。
- `0x95308C` 下跳门闩、`0xA4FC6F` 抓绳、`0x95516A` 座位点测试、`0x93D238` stance selector、`0x9BFB52` 绳端点、`0x9CC207` 落地这几个链仍需要用**图与人物状态联合**验证。避免把只有动作名称/触发框的支路当成完整移动状态机。
- `+0x3BC` 9 个写入 `0x1388` 由 C-036/EV-29 证实，`FUN_6292f5` 计算位移递减仍是 G12 的静态靶点。 `+0x61` 77 个 disp8 候选没有 owner，暂不标记为死亡位；此阶段无伤害模块，不作为阻塞物理主链的 Critical。

## 5. Portal 与 Camera 定点分析

Portal：`0x71A203` 读取 `pt/pn/x/y/tm/tn`；上键 `0x954B58→0x71B44D` 硬编码 `x±20/y±50`（与动态 `hRange/vRange` 是不同函数）。早期 `MAP-PORTAL-REVERSE.md` 只在上键/发送端确认同图 `tn→pn`、目标 `(x,y−10)` Foothold 查询和跨图 `0x53FF69` 发包，**不能从“发送端不写”推断全客户端没有落点写入**。最新设计稿 §16 M12/R10 明确报告：同图先存 `+0x28F8/+0x28FC`，再由 `0x95533D→0x9C1113` 写 `move+0x20/+0x38`；跨图发 `0x21`、收到 `0x81` 后由 `0x9507F0` 按目标 PortalRecord `+0xC/+0x10` 设置坐标且 y 额外 `−0xA`；同图重复触发间隔 `0x258=600`。此处**是有函数地址但尚未在权威 C/EV 独立登记的新一层静态候选证据**，本轮缺少原 EXE 字节，不能再反汇编确认。剩余真正未知：收包后速度、绳子/座位/FH、Camera时刻及跨图cooldown是否同600；必须先验证上述函数的参数、调用者和写入，而非从 `tm/tn` 猜坐标。

Camera：`0x66E59E..0x66E7CA` VR±(400,300) 的 C-026/EV-21 是 A；`0x190/0x12C` 不是 viewport query，`0x5A↔0x1E` 仍缺。原版follow写者未知。**阶段设计稿 §4.2/§10 已明确产品等价方案为中心跟随、effectiveBounds夹取、小图居中、无deadzone**，而不是尚无任何具体方案；需正式确认其验收和Frozen ABI职责，不得冒充 CMS079 摄像机。井口与三城镇的窄VR是边界测试样本。

## 6. 新证据等级与闭合约束

这轮新观测是**目标13图源 FSDB 数据的静态核验**，不是从历史报告重复得来的抽象 Gap 统计；已列在矩阵的 `actual_13_map_coverage`，并通过相应 `content/[FSDB]adventure` 实际文件和基线 HEAD 可复核。既有 EV-01..EV-32 的 EXE 证据等级没有因这些数据观测被提高；原 Claims 未变。未取到原始二进制，故不能闭合 G01/G07/G24/G27/G33/G34/G36/G37/G38/G39/G40/G41；不得将 `OPEN-RUNTIME` 仅凭推导崩溃维持为唯一途径，也不得为了减少 OPEN 数量虚构闭合。
