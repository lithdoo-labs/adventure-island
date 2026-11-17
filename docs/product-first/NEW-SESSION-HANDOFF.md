> **归档状态（2026-11-17）：历史交接指令，禁止作为当前 Agent 指令或实施任务执行。** 本文仅用于追溯上一轮产品设计过程；当前设计入口：[Design Baseline Reset](../design-baseline/README.md)。

# 新会话接续指引（OpenMS-Guided Product-First）

> 这是给新的主 Agent 会话的长期交接文档。新会话先回读 GitHub 真实分支 HEAD，不把本文件的 SHA 当成永远最新。

## 1. 身份、范围与当前批准方向

你是 Adventure Island 的产品系统架构师/需求设计主 Agent。仓库 `lithdoo-labs/adventure-island`；新设计分支 `design/openms-guided-product-first`，创建自原研究 T088.1 `42e2d7fb8b7eb49f4cd3f61b48fc56cc391168ba`。**本任务是设计细化，而非运行原 CMS079、重新打开 T089 逆向或马上复制 OpenMS 源码。**

已获批准的是：产品行为与用户可玩性优先；OpenMS/GMS083 的功能可做主参考，79/83 的差异如果不影响产品则不阻塞。未获批准的是各模块的具体数值/算法、全13图门表、GPL 代码集成方式等。

## 2. 必读源文件（依序）

- `DESIGN.md` 第 0 节 + 历史正文；
- `docs/product-first/README.md`、`OPENMS-ADAPTATION-CONTRACT.md`、`PRODUCT-READINESS-MIGRATION.md`、`REQUIREMENT-ADOPTION-MATRIX.csv`；
- `components/RENDER-NODE-ABI-V1.md`（Frozen）、`components/MAP-SCENE-PLAN-V1.md`、`components/README.md`；
- `research/result/stage-readiness/P0-P4-REQUIREMENT-EVIDENCE-MATRIX.csv` 和 `research/source-of-truth/{claims,evidence,gaps}.csv`（仅作历史证据，不变更）；
- OpenMS 官方仓库 https://github.com/tensorfish/openms ，研究锚点 `07994de02756356e3e025e3aca9e79433898d2c8` 与 `LICENSE`（GPL-3.0）。

## 3. 下一轮的具体设计任务

**WP0 基线/差异审计**：确认分支 SHA、所有冻结接口与 65 行矩阵一致；建立待批 ADR 决策队列，特别是 P4-09 13 图完整连通 vs 四门白名单冲突。

**WP1 65 项需求逐条细化**：每项写入产品用户故事、输入/输出/状态、资源依赖、错误路径、确定性正常/反例/边界测试、性能与依赖、OpenMS 来源 SHA+URL、兼容处理、设计审批状态；没有证据/签字仍 PROPOSED。

**WP2 P0–P4 模块合同**：Content/Map/Back、Tile/Obj/Avatar、Camera、Movement（5陆8水）、Portal（13图完整 graph）逐模块给出的伪接口、状态机、时间模型、失败回滚和测试夹具；保持 Frozen ABI。

**WP3 ADR 与落地顺序**：Camera、dt、Portal、Back flow、旧服/许可选择，每项至少两个方案、明确 trade-off、推荐与阻断；给出 R0→R1 3 图→R2 全13图→R3/R4 的可分解任务依赖图。不得把“参考 OpenMS”当成已批准具体公式。

**WP4 独立审查**：启动一个真实的独立只读 sub-agent（盲审优先，独立脚本/文件夹）；先审旧 ABI 和需求，提交 Blind Notes，再读主 Agent 补丁进行对抗性核对，审阅 65 项全量 coverage、代码/版权引用、冲突、测试与适配；全部阻断项闭环后，复验最终推送的远程树。

## 4. 绝对禁止

- 修改 Frozen RenderNode ABI、LoomRealm pinned gitlink、原始资源/资产和 `research/source-of-truth`；未授权的原始素材分发或将 GPL 代码直接复制进产品。
- 用 OpenMS 的任意 GMS083 代码/Opcode/客户端地址伪造 CMS079 静态证明；历史 Gap 不因产品设计而被 CLOSE。
- 运行原 CMS079 客户端；但可运行**本项目自身**合成测试、PWA E2E、设计校验。
- 旧四门白名单还在时声称 P4-09 的 13 图全连通已完成。
- 没有真实 reviewer 而声称完成独立盲审；没有实际运行测试而编造 PASS。

## 5. 交付与版本管理

设计优先，提交主要在 `docs/product-first/`、`DESIGN.md`、必要的 `components/*/DESIGN.md`，若需修改已有契约必须提出 ADR 而非悄悄重写。输出 65 项产品矩阵、P0–P4 具体合同、ADR、测试夹具计划、来源追溯、Review 闭环。按仓库现行规范跑可用文档/校验/测试，真实记录未执行项；正常 fast-forward push，新 SHA/父 SHA、变更统计及远程 HEAD 逐项回读。

项目仍为“详细产品设计进行中”，不自动 STAGE-READY。成果完成后应明确下一步代码实现批次，而不继续无限制原版逆向。


## WP0–WP5 本轮执行记录（2026-11-16）

本会话在开始时重新读取了目标分支真实远程 HEAD；初始远程 SHA 为 d7ad96cb11a697c20fa48e6fd25983b9c39ce708。设计产物以该 SHA 为父提交，不修改原研究分支。

已建立文件：
- WP0-AUDIT-AND-DECISION-BACKLOG.md
- REQUIREMENT-CONTRACTS-V1.md / .csv（65/65 唯一 ID）
- MODULE-CONTRACTS-V1.md
- ADR-REGISTER.md
- MAP-COVERAGE-13.csv / PORTAL-GRAPH-13.csv
- OPENMS-SOURCE-AND-LICENSE-MATRIX.csv
- TEST-AND-GOLDEN-FIXTURE-PLAN.md
- IMPLEMENTATION-ROADMAP.md
- INDEPENDENT-REVIEWER-STATUS.md

真实数据审计：13/13 map struct 与 Portal group；Back/Foothold/Obj/Portal 各 13/13；Tile 9/13、Rope 7/13、Seat 3/13；5 land / 8 water；54 links = 46 内部唯一 + 8 外部；内部正反向可达 13/13。

所有 65 项设计状态仍为 PROPOSED / NOT-APPROVED。ADR-001..009 均待审批。独立 Reviewer 未运行（当前环境无真实 sub-agent 工具），详见 INDEPENDENT-REVIEWER-STATUS.md。未执行本地 npm/browser/E2E 测试；不能声称 PASS。基线 commit 的 GitHub status/workflow 查询为空。

下一步先完成独立 Reviewer 环境与 ADR 审批，再进入 R0 schema/fixture validators；之后 R1 三图垂直切片，R2 13 图完整场景与 Portal graph，R3 V2 动态呈现，R4 后续战斗系统。
