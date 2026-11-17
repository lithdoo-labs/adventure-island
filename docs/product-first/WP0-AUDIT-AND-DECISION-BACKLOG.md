> **归档状态（2026-11-17）：历史提案 / 非现行规范。** 本文保留用于追溯；不代表当前产品批准、实现或架构要求。当前设计入口：[Design Baseline Reset](../design-baseline/README.md)。

# WP0 — 现有设计审计与决策 backlog

> 状态：主 Agent 静态审计；不是产品批准、实现证明或独立 Reviewer 结论。基线为 design/openms-guided-product-first 在执行开始时的远程 HEAD d7ad96cb11a697c20fa48e6fd25983b9c39ce708。

## 1. 审计范围

已读取 DESIGN.md、docs/product-first 的 README/适配契约/迁移规则/65 行矩阵/交接文档；components README、MapScenePlanV1、Frozen RenderNode ABI V1、六个目标组件 DESIGN、cms-actor IMPLEMENTATION/DEPLOYMENT；research README、Claims/Evidence/Gaps、历史 P0–P4 矩阵与 readiness、CMS079/GMS083 brief；13 张 Map struct 与 Portal JSONL、地图资源树；OpenMS 固定 commit 07994de02756356e3e025e3aca9e79433898d2c8 的 Camera/Physics/Portal/Arrival/Transition/Animation/Avatar 相关实现和 LICENSE。

历史账本只读：109 Claims / 97 Evidence / 41 Gaps；25 CLOSED-STATIC、9 PARTIAL-STATIC、6 OPEN-STATIC、1 SUPERSEDED。历史 P0–P4 readiness 为 14 PRODUCT-READY / 22 RE-READY / 22 RE-GAP-STATIC / 7 DESIGN-DECISION。新产品矩阵原始 65 行全部 PROPOSED。两种状态不得互相覆盖。

## 2. 主要发现

| ID | 原文件 | 当前问题 | 影响 | 建议 |
|---|---|---|---|---|
| AUD-01 | docs/product-first/REQUIREMENT-ADOPTION-MATRIX.csv | 65 行缺 I/O、状态 owner、资源字段、错误、测试、性能 | 无法直接实施验收 | 新增 65 项完整卡和机器矩阵；仍标 PROPOSED |
| AUD-02 | systems/adventure-map/subsystem.mjs、systems/base/subsystem.mjs | 当前主要建立 Avatar RenderNode、读 bootstrap AvatarPlan、接收 Controls/Viewport；没有世界移动、Foothold、Camera、地图加载或 Portal | 不能宣称三图可玩 | 先建 Field Runtime/Movement/Camera/Portal contracts，再做 R1 |
| AUD-03 | components/MAP-SCENE-PLAN-V1.md §4–7 | v1 只接纳静态 type0 Back、无 flow 普通 Obj；竖直 Foothold 不可站立；Portal 只有旧四门 enabled | 13 图 Plan 会遇 unsupported | v1 fail-closed；用 ADR 规划 Plan/Tag V2 |
| AUD-04 | components/RENDER-NODE-ABI-V1.md、MAP-SCENE-PLAN-V1.md | scene-view x/y 是 camera top-left，但 VR effectiveBounds 采用 400/300 inset | 任意 viewport 直接 clamp 会错位或二次内缩 | 用 raw sourceBounds 与 viewport extent 推导 top-left；ADR-002 |
| AUD-05 | cms-back/DESIGN.md、ABI V1 | Back attrs 保留 rx/ry/type/cx/cy，但 v1 只允许 type0；loop=true 不启动私有时钟 | 背景 type1–4 和动画不能由 v1 完整表达 | 新 BackPlanV2/tag；presentation clock 归 Field Runtime |
| AUD-06 | cms-map-layer/DESIGN.md、MapScenePlanV1 | Obj flow/r!=0 unsupported；v1 无 flow frame clock | flow 对象不能完整呈现 | V2 显式表达；v1 遇 flow 必须 unsupported |
| AUD-07 | MapScenePlanV1、cms-actor/IMPLEMENTATION.md | Foothold v1 无 per-segment drag/swimArea；Actor ABI 有 prone/swim/sit/climb，但当前 validator 只接受 stand/walk/jump | Movement 数据与 Actor validator 不一致 | V2 数据字段 ADR；R1 同步 validator 和测试 |
| AUD-08 | MapScenePlanV1 §7 | 当前仅四条 enabled，P4-09 要求完整 13 图 | 产品范围冲突 | 逐行图审计：46 内部唯一边、8 外部边；闭包验证后启用 |
| AUD-09 | Frozen ABI V1 | Actor 固定在所有地图层后，不能按 zM 插入 Obj 深度带 | Avatar 内部 zmap/smap 不等于地图深度 interleave | R1/R2 保持冻结树顺序；真正 interleave 另开 ABI V2 ADR |
| AUD-10 | cms-portal/DESIGN.md、MapScenePlanV1 | 组件只绘制 Portal frames；目标、触发、cooldown、enabled 必须由 Field Runtime 决定 | UI 不能拥有传送权威 | 严格唯一目标、token gate、原子 commit |
| AUD-11 | content/[FSDB]adventure map groups | 13 图 Back/Foothold/Obj/Portal 各 13 文件；Tile 9、Rope 7、Seat 3 | 缺文件可能是源空组或漏导入 | Manifest 区分 SOURCE-EMPTY / SOURCE-ABSENT / RESOURCE-MISSING |
| AUD-12 | CMS079-083-CROSS-VERSION-BRIEF.md | OpenMS GMS083 不能当 CMS079 原版事实 | 版本误用 | OpenMS 仅作行为候选；产品选择与历史证据分离 |
| AUD-13 | cms-actor/IMPLEMENTATION.md | 已有 AvatarPlan、anchors、zmap/smap、islot/vslot、frame clock、资源版本；姿态 validator 未完成 | 可复用现有契约，不重做 ABI | 扩展姿态和装备遮挡测试，保持 Actor key |
| AUD-14 | OpenMS LICENSE | 根 LICENSE 为 GPL-3.0 | 代码复用/分发风险 | 仅行为参考、独立实现；直接复用另开许可证 ADR |
| AUD-15 | 当前执行环境 | 无真实独立 sub-agent 工具 | 不能执行盲审/对抗审 | 归档 NOT-RUN；不得模拟 Reviewer |

## 3. 13 图数据实测

地图顺序：222000000、222000001、230030200、230030100、230030000、230020300、230020200、230020100、230020000、230000000、230000001、230000002、230000003。

- Map struct：13/13；Portal JSONL：13/13。
- info.swim=0 陆地图 5 张；info.swim=1 水图 8 张。
- 完整 VR 四字段：5 张；另 8 张走 miniMap / Foothold fallback。
- Back/Foothold/Obj/Portal group 文件各 13/13；Tile 9/13；Rope 7/13；Seat 3/13。
- Map resource tree：904 PNG（Back 152 / Helper 91 / MiniMap 13 / Obj 567 / Tile 81）。这是仓库树统计，不代表授权、ContentVersion 闭包或浏览器解码已经验收。
- MapHelper portal pv 目录含 0..7 共 8 个 PNG；存在性不代表每张地图的全部 PortalPlan 闭包已验收。

Portal 逐行解析：54 条非 sentinel 目标记录；46 条目标地图在 13 图内且 tn 唯一；8 条指向闭包外；内部目标没有 0 或多重匹配。以 46 条内部边构图，从首图分别计算正向与反向可达均为 13/13。逐条证据见 PORTAL-GRAPH-13.csv；enabled 仍以资源闭包通过为前提。

## 4. OpenMS 版本与许可证

OpenMS commit 07994de02756356e3e025e3aca9e79433898d2c8 的远程 commit 元数据日期为 2026-10-10，verified signature 字段存在。根 LICENSE 是 GNU GPL Version 3。源文件和行锚点见 OPENMS-SOURCE-AND-LICENSE-MATRIX.csv。本轮没有复制 OpenMS 代码、GPL 模块、原始客户端或新增 WZ 素材。

## 5. 决策 backlog

见 ADR-REGISTER.md。优先审批 ADR-001 Portal graph、ADR-002 Camera bounds、ADR-003 fixed step/InputGate、ADR-004 Portal transaction、ADR-005 visual Plan/Tag V2、ADR-006 Movement resource fields、ADR-007 Avatar depth、ADR-008 info/link、ADR-009 GPL/assets。

## 6. 执行限制

- GitHub 远程读取、数据静态解析和 Portal reachability 脚本已执行。
- 当前连接没有仓库本地 shell/runner，也没有 GitHub Actions dispatch 工具；没有声称运行 npm test、Chromium、PWA staging 或 E2E。基线 commit 的 GitHub status/workflow 查询为空，不代表测试通过。
- 当前没有真实独立 Reviewer sub-agent；blind review、adversarial review、final re-review 均 NOT-RUN。见 INDEPENDENT-REVIEWER-STATUS.md。
- 未修改历史 Claims/Evidence/Gaps、Frozen ABI、LoomRealm gitlink、原始 WZ/FSDB、客户端或 DLL。
