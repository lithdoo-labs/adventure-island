# T088.1 — Camera Evidence Integrity & Reproduction Corrections (CMS079 纯静态)

Round: T088.1 (2026-11-16). Branch: `design/adventure-field-map-scene`.
Baseline: `60f1ee92e34e3de636619e595fc87d954e162407`（T088；开工核验：远程 HEAD
与本地一致，工作树干净，父提交 `5f30b7a8`）。

性质：**独立验收后的定点勘误、自动化复现修复和权威证据一致性闭环**。不开展
新的大规模 Camera 逆向（T089 范围见 §10）。T088 已接受的机器码成果
（C-106～C-109、0x31D 单例闭包、Shape2D Set 语义、#6/#7 光标模式定标、
0x93CB27 焦点写入者家族）**全部保留**；本轮只修复证据链、生成器与验收缺陷，
并按字节证据**收窄/修正**两处有界负结论的载体表述（写入者集合 9→10）。

Binary identity（每脚本运行前 sha-pinned）：
- EXE `.work/task-036/game-image-unpacked.bin` `d4a67597…a31718`（linear，VA−0x400000）
- Shape2D `9802bacc…c8111b` / PCOM `cf3807f3…9d9e54`（本轮仅既有证据引用，未改动）

约束遵守：零运行时行为；仅修改 `research/`；Frozen ABI / LoomRealm pin /
content / 原始二进制零改动。报告级标签不进入权威 CSV status。

---

## 执行摘要

| 问题 | 修复前 | 修复后 | 状态 |
|---|---|---|---|
| F1 Writer 分类统计 | T088 报告 §2.2 表格与 Readiness t088 段残留 `2/10/2/25` | 全部权威位置统一 `2/12/0/25`（含 C1 重分类注记） | ✅ |
| F2 VARIANT 语义 | EV-93 尾部悬挂 `= 35/39 immediate-class`；Readiness 残留 `33 默认 + 2 VT_EMPTY` 分桶 | `39/39 default(VT_ERROR,missing)`；四命题语义分层显式化；25 INCONCLUSIVE 不自动升级 | ✅ |
| F3 G10 Scene vtable | `33 family vtables have no imm32 code ref` 过期结论仍为现行字段；blocker 残留已完成任务 | 基础表安装链已定位（4 imm32 + 2 寄存器间接）；32 派生表零字节出现；残项=派生构造链与 [scene+0x1CC] 对象身份 | ✅ |
| F4 C-028/C-103 历史结论 | 「#6/#7=世界坐标写入者」「deadzone 只能在其上游」未标历史 | 明确 T087 HISTORICAL READING 标记 + C-107/EV-94 反证声明；已证身份/变换不撤销 | ✅ |
| F5/WP1 census 生成器 | `create_call_va` 双重加 BASE：76 行全部 +0x400000 | 生成器根源修复 + 内嵌 E8→0x447891 字节自检；80 行独立逐行核验 80/80 PASS | ✅ |
| F6/WP2 vtable 扫描器 | `.\xb0\x00\x00` 正则结构性失明；9 写者负结论未被真正执行 | 指令边界 imm32 普查 + 基础表 4 安装点阳性自检（缺失即中止）；有界负对 10 写者复验成立且边界鲁棒 | ✅ |
| F7 mov/lea 口径 | 取证 30 vs 报告/EV-97 31 并存；9 写者 | 统一口径：21 lea + 10 写 = 31（读排除）；写者=10（新增 0x952ECE） | ✅ |

**新发现（本轮超出验收问题的字节证据）**：直接 `+0x1CC` 写入者是 **10** 个而非
9 个——T088 探针存在 VA/文件偏移混比（`ins.address > off2+2` 恒真）与
`"0x1cc"` 子串误匹配，漏掉字段拷贝写入者 **0x952ECE**（`mov [ebx+0x1CC],eax`，
+0x1C8..+0x1DC 对拷环 @0x952EBC-0x952EEC）。十写者有界负结论经阳性受控扫描器
复验后仍然成立（边界鲁棒，见 §5）。

---

## 1. 七项问题逐项闭环

### F1 — Writer 分类统计（2/12/0/25 统一）

- **修复前**：T088 主报告 §2.2 正文表格 `CONFIRMED-SHARED-WRITE-CONTEXT-UI=10`、
  `RECEIVER-OTHER=2`（0x4B3BC5/0x4B3DAD 标为非共享接收者）；Readiness t088 段
  `2/10/2/25`；而执行摘要、分类 CSV、EV-93、矩阵 P2-05 已是 12/0 —— 同一仓库
  内两种现行结论并存。
- **决定性证据**：0x4B3744/0x4B3813 函数内解析 → out-slot `lea ecx,[ebp-0x1C]`
  @0x4B3764 / `[ebp-0x14]` @0x4B3824 → `call 0x447891` @0x4B376D/0x4B382D；接收者
  于 0x4B3BC5/0x4B3DAD 消费（`ff 91 90 00 00 00`）→ 按 C-106 单例闭包即共享对象
  （t088-reviewer C1，本轮字节复核一致）。
- **修改文件**：T088 主报告 §2.2；P0-P4-READINESS-REPORT.md（t088 段修正 +
  新增 t088.1 段）。
- **测试**：`test_report_table_matches_csv`、`test_readiness_active_counts_corrected`、
  `test_classification_counts`（CSV 数据级复核 2/12/0/25）。

### F2 — VARIANT 参数语义（39/39 + 语义分层）

- **修复前**：EV-93 同一字段内并存 `39/39 default` 与 `= 35/39 immediate-class`；
  Readiness 保留 `35/39 立即类：33 默认构造器 + 2 清空槽 VT_EMPTY`。
- **决定性证据**：0x9EC62A 的 V3 槽在 0x9EC57B VariantClear 后于 0x9EC5C3-0x9EC5D2
  从 0xBE7330 重模板化为 V{VT_ERROR,missing}；0x4EDE7C 同型
  （0x4EDE29 清空、0x4EDE2E-30 重模板）→ 「清空槽 VT_EMPTY」分桶不存在
  （t088-reviewer C4；本轮分类 CSV 39/39 机器一致）。
- **语义分层（写入 EV-93）**：① VARIANT 调用参数已解码（39/39 默认）；
  ② Shape2D Set 立即性由被调体 0x5140828F 证明（C-108）；③ 接收者=共享对象由
  C-106 证明；④ 包含函数业务语义闭合仅 14/39 —— **25 个 INCONCLUSIVE 不因
  默认参自动升级**。
- **修改文件**：evidence.csv EV-93；Readiness；T088 报告 §2.2 注记。
- **测试**：`test_variant_uniformity`、`test_ev93_semantic_layering`。

### F3 — G10 Scene vtable 结论

- **修复前**：`unresolved_scope` 残留 `33 family vtables have no imm32 code ref`；
  `blocker` 把 `[fieldctx+0xD4] writer census`、`[0xBDD838] class identity` 列为
  待办（均已闭合）。
- **决定性证据**：指令边界 imm32 普查（阳性受控）——基础表 0xB01278 的 4 个
  imm32 安装 `c7 01/06/00 78 12 b0 00`@0x52F1BC/0x52F1CF/0xA0B39E/0xA0BB2A
  （0x52F1BC 为 thunk：安装后尾跳 0x52F37F；0x52F1CF/0xA0BB2A 安装后 call
  0x52F37F）；另有 0x52EEF1/0x8DC052 寄存器装载→`mov [ebp-0x3C],esi`→
  `call 0x52F37F` 间接安装；**其余 32 张派生表在代码带零字节出现**（不是
  「无指令解码」，是字节不存在）。
- **修改文件**：gaps.csv G10（unresolved_scope/blocker/next_action）。
- **测试**：`test_g10_no_stale_33_table_claim`、`test_g10_blocker_has_no_completed_identity_tasks`、
  `test_g10_next_action_has_t089_entry`。

### F4 — C-028 与 C-103 历史结论

- **修复前**：C-028 `reasoning` 与 C-103 `claim` 仍断言 #6/#7 是「field-family
  world-space writers」且「deadzone 只能存在于二者上游」，无历史标记。
- **修复后**：两处均加 `[T087 HISTORICAL READING, superseded by C-107/EV-94]`
  标记并声明：#6/#7 为光标模式；直接焦点写入者 0x93CB27（C-109）才是玩家跟随
  候选；deadzone 负结论在有界扫描内成立。**C-103 已证的共享对象身份与
  world→screen 变换不撤销**（原句保留）。另补 T088 报告 §6 承诺但未落实的
  evidence_refs（C-103 +EV-93/94；C-028 +EV-94/95/96）；phase-2 复审发现 C-103
  的 refs 修复首遍落入不可达分支且 T088 曾把 refs 写进 binary_identity（丢失
  `unpack079+Shape2D.dll`）——已一并修复（evidence_refs=EV-89/90/93/94；
  binary_identity 还原为 5f30b7a8 值，CR-T0881-22，D1 阻塞项闭环）。
- **测试**：`test_c028_worldspace_reading_marked_historical`、
  `test_c103_field_writers_marked_historical`、`test_c103_t088_revision_still_present_in_address`。

### F5/WP1 — 0x31D Census 地址生成器

- **缺陷**：`decode_attach` 以 `resolve_off+BASE` 为反汇编基址（capstone 地址
  已是 VA），而 CSV 写出 `f"{call_off + BASE:#010x}"` 二次加 BASE → **76 个非空
  `create_call_va` 全部 +0x400000**（如真值 0x437754 记为 0x837754；0x9EC4EE 记为
  0xDEC4EE，越出镜像）。
- **修复（生成器根源）**：直接格式化 VA；生成器写 CSV 前对每个调用地址做
  字节级自检（`verify_create_call`：E8 操作码、rel32 目标 == 0x447891、VA ∈
  [0x401000,0xBEA000)），失败即抛错。80 行全部通过（76 调用 + 4 非解析）。
- **独立逐行核验**：`research/scripts/t0881_census_verifier.py`（不复用生成器
  代码路径，逐行独立反汇编重推导）→ `forensics/T0881-VA-CALLSITE-VERIFICATION.csv`
  **80/80 PASS**。任务样例三行：0x437732→0x437754、0x69213A→0x69215F、
  0x9EC4D3→0x9EC4EE ✓。
- **4 个空地址行的准确原因**（不捏造调用点）：0x73E40A/0xA197DD/0xA19D57 为
  `mov r32,0x31D; sub` 整数 id 区间端点（经 0x43FD38/0x43FD62 id-base 助手，
  作为参数送入 `call [obj+0x90]`）；0x93A0A1 为 `mov ecx,0x31D; jg/je` 分发链
  数据 —— 均非命名空间解析（census 标注 `imm32-operand (not a resolve)`）。
  连带修正 C-106 的「全部 80 个解析点」措辞为精确版：别名闭包适用于**实际调用
  0x447891 的 76 个站点**（t088.1-reviewer 盲审推论采纳）。
- **0x69213A attach**：核验为真实输出槽 `[ebp-0x10]`（`lea ecx,[ebp-0x10]`
  @0x692156；`push edi` 为 arg3）——T088 值保持，非参数寄存器。
- **连带数据修复**：alias_kind 列的括号正则缺陷（`[edi + 0xE34]` 族被误标
  `register`）→ 现机器分桶 12 persistent-field / 60 stack-slot / 4 register /
  4 imm32-operand，EV-93 的「12 处持久别名」从不可校验变为列级可校验。
- **哈希**：census CSV 新 sha256(LF) `69f18c64…e3559`；分类 CSV **字节不变**
  （`2f5c550e…be4c`，EV-93 伴随哈希核验一致）；EV-93 `source_sha256` 已更新。

### F6/WP2 — slot15 家族负结论验证器

- **缺陷**：`re.finditer(rb".\xb0\x00\x00", blob)` 要求窗口 byte2==0xB0、
  byte3==byte4==0x00，而家族地址小端编码为 `78 12 B0 00` 族（byte2 是地址第二
  字节 0x12…0x26）→ **正则结构性失明**；且 unpack 从通配字节起读 4 字节。
  T088 的 9 条 `family-vtable-installs=[]` 输出全部来自不可能命中的扫描器
  （t088.1-reviewer 独立仿真：2 次匹配、值 0xB086/0xB0BE、0 通过范围检查）。
- **重建**：33 张家族表地址的全量指令边界 imm32 普查（每个字节出现位置在
  8 个候选起点上反汇编，仅当 IMMEDIATE 操作数等于表地址才计入；INSTALL=
  `mov dword ptr [mem], imm`、LOAD=`mov reg, imm`、PUSH、DATA 无指令边界）；
  **阳性自检**：基础表必须命中 4 个已知安装点否则生成器中止。
- **写者验证**：10 写者逐一「保守窗口=三类候选起点取最早（census/SEH 锚/
  前向最近序言）」+ 全带穷举 + 硬屏障佐证（最近对 0xA029BA 窗口端 0xA02B82 与
  安装点 0xA0B39E 之间有 8 个后续真实序言（首个 0xA03F2D）、430 个窗内 E8 调用
  目标及安装点自身的包含函数——**没有任何单一函数能跨越该间隔**；reviewer
  phase-2 事实，主 Agent 独立复核）→ 负结论**边界鲁棒**。
- **0x60088A**：T088 `fn None` 系启发式扫描伪象；保守窗口回退前向最近序言
  0x5FD9B1（写者写入 `call 0x61059F` 返回对象）。t088.1-reviewer 盲审指出
  0x6006AD 为指令内部标签（单调用者 0x5FE6C0，其间无 ret）—— 已采纳并记录。
- **对象身份分别核对**：0x60088A=被调分配对象；0x952ECE=对拷环 [esi]→[ebx]；
  其余=this/参数对象 —— 同偏移字段属**不同类**，不合并为单一类证据。
- **覆盖说明**：SEH/跳板（0x52F1BC 本身即 thunk）/尾调用/间接构造（寄存器
  装载+栈别名）/别名写入的不可排除范围在取证文件与
  `T0881-SCENE-VTABLE-INSTALL-COVERAGE.md` §4 显式声明。

### F7 — mov/lea 30 vs 31 统一

统一口径 = lea + 写 mov（读排除）：**31 = 21 lea + 10 写**（另 17 读、1 其他、
总计 49 条 MEM disp32 +0x1CC 指令）。T088 报告的「31」数值正确而其取证列表
（30）漏计 0x952ECE；EV-97 地址字段与 T088 报告 §5 已按新口径重写。
- **测试**：`test_census_taxonomy_reconciled`、`test_direct_1cc_writer_census_finds_ten_incl_952ece`。

---

## 2. 修复前后关键数值差异

| 量 | T088（60f1ee92） | T088.1 |
|---|---|---|
| census `create_call_va`（76 非空行） | 全部真值+0x400000 | 全部真值；逐行 E8→0x447891 字节验证 |
| census 空 call 行 | `none-within-0x90`（无因） | 逐行字节成因（3 id 区间端点 + 1 分发链） |
| census alias_kind | 12 持久别名不可从列校验（误标 register） | 机器分桶 12/60/4/4 |
| 分类分桶（权威位置一致性） | §2.2 与 Readiness=2/10/2/25 vs 其余 2/12/0/25 | **2/12/0/25 全部一致** |
| VARIANT 表述 | `39/39` 与 `35/39 immediate-class` 并存 | **39/39** + 语义分层 |
| 直接 +0x1CC 写者 | 9 | **10**（+0x952ECE） |
| +0x1CC mov/lea（读排除） | 30（取证）vs 31（报告）并存 | **31**（21+10，口径显式） |
| 家族表 imm32 引用 | 「33 张全无」 | 基础表 4 安装+2 装载；32 派生表零字节出现 |
| 基础表安装点清单 | 0x52F1CF/0xA0B39E/0xA0BB2A（漏 0x52F1BC） | 4 处 + thunk/init 语义（尾跳/call） |
| 写者窗口 | seh 启发（0x60088A 无界） | 保守最早起点窗 + 全带距离佐证（≥0x89E4） |
| C-106 reasoning | C1 句子整段重复 | 去重 + 4 非解析站点精确注记 |

## 3. 76 个调用地址的验证方法与结果

方法：`t0881_census_verifier.py` 对每行独立反汇编（0x90 窗口），重推导第一个
`call 0x447891`，与 CSV 记录比对；并对记录地址做字节核验（E8、rel32 目标、
带范围、form 字节）。
结果：**80/80 PASS**（76 行「E8→0x447891 + 窗内首个 + 带内」全对；4 行
「窗内确无创建调用」）。无例外站点。

## 4. 九（实为十）写入者 vtable 安装负结论的可复现范围

见 `forensics/T0881-SCENE-VTABLE-INSTALL-COVERAGE.md`（§2 扫描器、§3 结果、
§4 审计边界、§5 形式化陈述）。要点：全带 imm32 普查 + 阳性自检 + 保守窗口 +
距离佐证；不覆盖间接安装/被调构造/SEH/跳板与派生表非 imm32 构造链（T089 WP3）。

## 5. 台账与哈希动作

- **EV-93**：`source_sha256` → `69f18c64aece419ead6246faf688ce91ecb3c651cfff7273b0039d38010e3559`；
  interpretation 重写（VA 修复溯源、验证工件引用、35/39 撤销、语义分层、
  alias_kind 机器化）。
- **EV-97**：`source_sha256` → `d4a9cdcf9795f83b3eae0ddc357207fc58ba009318445a245d5122d708bc86cf`；
  address（31=21+10、10 写者、0x952ECE）与 interpretation（阳性受控、边界鲁棒
  （含硬屏障事实）、
  4+2 安装链、派生表零出现）重写。
- **C-028/C-103**：历史标记 + evidence_refs 补齐；**C-106**：去重 + 精确注记。
- **G10**：unresolved_scope/blocker/next_action 重写。
- **Claim/Evidence/Gap 数量不变：109 / 97 / 41**（不新增 ID，优先修正既有证据）。
- 逐项清单：`forensics/T0881-CORRECTION-REGISTER.csv`（24 条，含 reviewer
  盲审采纳 4 条与 phase-2 复审处置 3 条）。

## 6. Claim/Gap/Requirement 状态变化

**无状态翻转**。G10=`PARTIAL-STATIC`、P2-01=`PRODUCT-READY`、P2-05/P2-06/P4-07=
`DESIGN-DECISION`、项目=`NOT STAGE-READY` 全部维持（真实证据不要求变化）。

## 7. 独立 Reviewer

真实独立只读 sub-agent（`ses_e1fee5980ffeKvycp0mbkPx0Gi`，独立临时目录
`%TEMP%\opencode\t0881-reviewer\`，独立 capstone 脚本，仓库文件一律经
`git show 60f1ee92:<path>` 固定版本读取，与主 Agent 修复完全隔离）。三阶段：
盲审（先于修复完成，`T0881-BLIND-NOTES.md`）→ 对抗性复审（读取修复后的最终
工作树并逐项差异核对）→ 推送后最终远程树复验。完整记录：
`forensics/T0881-REVIEWER-INDEPENDENT.md`。

盲审独立确认（与主 Agent 结论交叉）：B1 76 行 +0x400000 系统性偏移；B4 63/17；
B5 4 安装点地址（并纠正 t088-reviewer 的 imm 偏移误标）；B6/B7 31 mov/lea +
10 写者（独立发现 0x952ECE 与探针 VA/偏移混比机制）；B8 六处过期现行文本；
B9 C-028/C-103 未标历史 + C-106 重复句 + 承诺 refs 缺失；B10 T088 工件哈希链
完好（缺陷均为内容缺陷）。盲审新贡献并被本轮采纳：0x79240D/0x7C8BEB 假起点、
0x6006AD 指令内部标签、4 非解析站点的 id-base 助手消费链（0x43FD38/0x43FD62）、
C-106「80 站点」措辞过宽、§6 承诺 refs 未落实。

对抗复审（phase 2，修复完成后读取最终工作树）裁决 **ACCEPT-WITH-CORRECTIONS**：
十问全部 PASS（Q1 80/80 独立复核；Q2 生成器在临时脚手架实际重跑、产物字节一致；
Q3 无 VA/偏移残留；Q4 阳性自检经篡改脚手架双向验证（缺失期望→exit 1）；
Q5 边界闭合并补强硬屏障证明；Q6 无遗漏编码/间接安装；Q7-Q9 语义/台账一致；
Q10 三门禁独立重跑一致）。差异 7 项（D1-D7）：
- **D1（阻塞）** C-103 evidence_refs 修复落入不可达 elif 分支 + T088 曾把 refs
  写错列（binary_identity 丢失身份串）→ 已修（CR-T0881-22）：refs 入
  evidence_refs，binary_identity 还原 `unpack079+Shape2D.dll`；
- D2 register CR-09 引用中间态哈希 → 已更正为最终哈希；
- D3 「ALL 80 resolve sites」四处现行文本 → 已加 76 创建站点精确注记
  （CR-T0881-23）；
- D4 CR-12 窗口描述 → 标注被 CR-19 保守窗口取代；
- D5 「数量级超出」措辞 → 以硬屏障事实替换（bounds 再生，EV-97 哈希更新，
  CR-T0881-24）；
- D6/D7 覆盖文档措辞 → 已按复审意见修正。
全部 D1-D7 已处置；最终远程树复验（phase 3）记录于
`forensics/T0881-REVIEWER-INDEPENDENT.md` 尾部。

## 8. 质量门禁（真实命令与退出码）

| 门禁 | 命令 | 结果 |
|---|---|---|
| Clean-room | `python research/scripts/generate_cleanroom_deliverables.py` | exit 0；claims=109 gaps=41 evidence=97 retracted=10 |
| Validator | `python research/scripts/validate_reverse_engineering.py` | exit 0；**PASS（0 errors / 0 warnings）** |
| Unit tests | `python -m unittest discover -s research/tests -q` | exit 0；**146/146 OK**（107 既有 + 39 本轮新增） |

日志：`forensics/T0881-CLEANROOM-LOG.txt`、`T0881-VALIDATOR-LOG.txt`、
`T0881-UNITTEST-LOG.txt`（真实输出，ResourceWarning 如实保留）。
测试要点覆盖任务书 12 项回归（见 §1 各 F 项「测试」行与 test_t0881_round.py）。

## 9. 生成器复现

```
python research/scripts/t088_wp1_id31d_census.py      # 76 调用字节自检通过后写 CSV
python research/scripts/t0881_census_verifier.py      # 80/80 PASS（独立重推导）
python research/scripts/t088_wp4_scene_portal.py      # 阳性自检缺失即中止
python research/scripts/t0881_ledger_fixes.py         # 台账勘误（fail-closed 锚点）
```

## 10. 残余问题与 T089 接续入口

- **维持成立**：C-106 单例闭包（76 个真实创建站点）；C-108 Set 立即/插值双分支；
  C-107 #6/#7 光标模式；C-109 焦点写入者家族；deadzone/每 Tick/clamp 有界负结论
  （本轮以更强扫描器复验了 0x1CC 写者负结论）。
- **本轮收窄/修正**：+0x1CC 写者集合 9→10（0x952ECE 并入）；家族表 imm32 结论
  从「全无」收窄为「基础表已定位 + 32 派生表零 imm32 出现（构造链未追）」。
- **仍属 T089**：WP1 `[[user+0xF28]+0x14]` 焦点位置对象写入者普查（禁止未证
  命名 Avatar 中心）；WP2 25 个 INCONCLUSIVE 站点包含函数解码；WP3 派生表
  构造/安装链（自 0x52F1BC/0x52F1CF/0xA0B39E/0xA0BB2A + init 0x52F37F 追踪；
  [scene+0x1CC] 成员身份）；WP4 跨图输入抑制与 E2/E3 泵相位。
- **T089 起点**：本轮最终提交 SHA（见 git log / 主回复 §A）。

## 11. 边界声明

仅修改 `research/`；Frozen ABI pin 校验通过；LoomRealm（9364819…）、content/、
原始二进制零改动；全程 STATIC-ONLY。项目维持 **NOT STAGE-READY**。
