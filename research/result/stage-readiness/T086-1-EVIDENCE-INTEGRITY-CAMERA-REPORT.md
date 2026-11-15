# T086.1 — 证据一致性修复与 Camera 纯静态深挖（Evidence Integrity Repair & Camera Static Deepening）

Round: T086.1 (2026-11-15). Branch: `design/adventure-field-map-scene`.
Baseline: `a86e76e1def511e6fc0bb2ea0e24814edc23b954`（开工时远程 HEAD 重新核验一致）。

Binary identity（每脚本运行前 sha-pinned）：
- EXE `.work/task-036/game-image-unpacked.bin` `d4a67597…a31718`（linear，VA−0x400000）
- Gr2D `.work/task-001/extracted/冒险岛online/Gr2D_DX8.dll` `ad67b9a0…f6a25d1`（0x50400000）
- 服务端 `.work/task-063/server079.jar` `49382081…8cf360`（本轮新增 pinned；recv 351 行 / send 422 行 properties）

约束遵守：**零运行时行为**（无启动/登录/调试/dump/采样）；仅修改 `research/`；Frozen ABI / LoomRealm / content / 原始二进制零改动。报告级标签（ORIGINAL-STATIC-PROVEN / STATIC-EQUIVALENT / PRODUCT-SUBSTITUTION / STATIC-UNDERDETERMINED / UNRESOLVED-VERSION-AUTHORITY）仅用于本文与取证文件，不进入权威 CSV status。

---

## 执行摘要

| WP | 对象 | 结论 |
|---|---|---|
| WP0 | G08 排序键基数 | **勘误完成（ORIGINAL-STATIC-PROVEN 维持）**：机器码基数为 `−0x40000000 = −2^30`；T086 文字层面的 `−2^31` 是标注错误，全部数值/字节编码不变；锚点测试通过；C-099/G08/G09/EV-85/两报告同步修正；回归测试锁定 2^30/2^31 区分 |
| WP1 | G17 属性解析 | **裁定完成（ORIGINAL-STATIC-PROVEN）**：本仓 jar 字节码**支持**相对赋值，`DOJO_WARP_UP = 0x00D1` 可静态推导，reviewer"损坏行"判断撤回；另发现 0xA10CE3 命名空间属 recvops → T086 对 5 个 send 侧冲突名的"客户端裁定"撤回（15 项全部 UNRESOLVED-VERSION-AUTHORITY，报告级） |
| WP2 | EV-82～87 哈希 | **跨平台规范确立（ORIGINAL-STATIC-PROVEN）**：根因 = T086 生成器 Windows 默认文本模式 CRLF × autocrlf=true；规范 = 文本 LF 规范化 / 二进制原始字节（≡ git blob）；6 行重基线（旧→新全量留痕）；Validator 17a 与单元测试同步；全量 87+1 行审计，其余行零变化 |
| WP3 | G10 Camera | **结构链推进（STATIC 层新增，C-102/EV-88）**：slot15 参数消费链、`[0xBDD838]` 屏幕位置单例（读/写/偏移架构 + [0,800]×[0,600] 硬夹取）、写漏斗仅两处（均为 UI 网格模板）；G10 → PARTIAL-STATIC（按证据重分类，非机械改状态）；跟随/deadzone 参数仍未恢复 |

项目维持 **NOT STAGE-READY**。

---

## 1. WP0 — G08 排序键基数纠错

### 1.1 缺陷与独立复核

T086 的 C-099/G08/G09/EV-85 注记及两份报告把机器码基数 `−0x40000000` 在文字层面写成 `−2^31`。事实上 `0x40000000 = 2^30 = 1073741824`；`2^31 = 0x80000000`。

本轮独立复核（`research/scripts/t0861_wp0_g08_audit.py` → `forensics/T0861-G08-KEY-CONSTANT-AUDIT.txt`）：

1. **原始指令逐条重解码 0x9363D9–0x936417**：19 条指令与恢复模板**逐条精确匹配**（含 `imul edx,edx,0xBB8`、`lea edx,[edx+edx*4]`、`lea eax,[eax+edx*2-0x3FFF8ADA]`）。
2. **disp32 字节级读取**：`8d 84 50 26 75 00 c0` → disp = 0xC0007526（有符号 −0x3FFF8ADA）；`2^30 − 0x3FFF8ADA = 0x7526 = 29990` → 常量按 `−(2^30 − 29990)` 编码。
3. **符号执行**：与闭式公式 `K = 10×(3000L−G) − 2^30 + 29990 + 2 + 5·(flag≠0)` 在 8 组输入（含负 group、layer=149、两处 i32 回绕）逐一相等。
4. **锚点值**（任务给定，双向断言）：`L0/G0/flag0 → −1073711832`；`L0/G0/flag1 → −1073711827`。PASS。
5. **key−1 路径区分**：0x93E7F2/0x93E909/0x93EF0D 三站点在 `lea` 之后 `dec edi`（0x93E87C / 0x93E926 / 0x93EF2A）再入 0x439AAD PUT 包装器；T086 证据文件中 0x93E909/0x93EF0D 两窗口为空（生成器窗口对齐缺陷），本轮补齐。
6. **类型基族重推导**：lea disp32 窗口 `[−0x40000100, −0x3FFF0000]` 全扫 → 基偏移集合 `{0, 2000, 19990, 29983, 29985..29992, 29995, 29996, 29999, 59970, 59980}`，全部形如 `−(2^30 − B)`；tile（−1073721834 = −(2^30−19990)）与 obj（−1073739824 = −(2^30−2000)）十进制基线交叉验证通过 → **同一设计键空间建立在 2^30 基上**（C-003 互证闭合）。
7. **立即数负检查**：族常量作为普通 imm32（跟在 81 /x、B8+r 后）仍为 0 个真命中——常量只存在于 lea disp32（与 T086 一致）。

### 1.2 修正范围（仅真正错误处）

- `claims.csv` C-099（两处 `−2^31` → `−2^30`，并注明 t086.1 勘误链）
- `gaps.csv` G08/G09 verified_scope（基数描述；G09 的 "-2^31+299xx 键空间"）
- `evidence.csv` EV-85 interpretation 列（基数描述）
- `P0-P4-READINESS-REPORT.md` L100 公式（活跃报告内联勘误，符合 Validator 16d 先例）+ 追加 T086.1 节
- `T086-STATIC-GAP-CLOSURE-REPORT.md` 追加 §11 勘误附录（历史正文不重写）
- `REVERSE-ENGINEERING-GAP-REGISTER.md` 视图行（G08/G09 自 gaps.csv 再生）
- 回归测试 `test_t0861_round.G08RadixTests`（8 项：基数恒等式、锚点、disp32 编码、负 group/layer、i32 回绕、key−1、tile/obj 基、**台账防回归**——扫描权威 CSV 中无勘误语境的 `2^31`）

未改动：`0xC0041F14` 哨兵、59970/59980 族描述、C-001/C-002 的十进制基线（本就正确）。T086 的 G08 算法恢复结论**维持 CLOSED-STATIC**。

---

## 2. WP1 — G17 相对属性解析复核

### 2.1 jar 字节码裁定（DOJO_WARP_UP = 0x00D1，可静态推导）

对本仓 `server079.jar`（sha256 `49382081ff55…`）`handling/ExternalCodeTableGetter` 的 `javap -p -c` 转录（`forensics/T0861-G17-PROPERTY-RESOLUTION.txt` §2）：

- `getValue(String, T[], short)` 在 `args.length == 2` 分支：**基 = `valueOf(args[0], values).getValue()`（枚举当前值）**；若基仍 == def(-2)（未被 populate）则**递归从 properties 解析**；随后 `parseShort(args[1][,16]) + 基`。**两字段相对赋值受字节码直接支持。**
- `populateValues` 按**枚举声明序**逐个 `setValue(getValue(name, values, (short)-2))`。
- `SendPacketOpcode` 构造器 `code = -2`（bipush −2）；静态块声明序（javap ldc 序，稠密序号断言）：`SHOW_ITEM_GAIN_INCHAT` = 38，`DOJO_WARP_UP` = 39 —— 基先于依赖被 populate。
- properties 实况：`sendops.properties` L261 `SHOW_ITEM_GAIN_INCHAT = 0xD0`、L263 `DOJO_WARP_UP = SHOW_ITEM_GAIN_INCHAT 1`；**全 jar 相对形式行恰此 1 条**，基在册。
- 三条独立路径同值：声明序 populate（基已填 0xD0）→ 0xD1；乱序 def 递归 → 0xD1；纯 properties 解析 → 0xD1。语料行 0x00D1 与之相等。

**处置**：撤回 T086 reviewer 修正 #2 的"损坏行"判断；C-095 falsification 改写（保留撤回链）；EV-83 的 notes 本就写着"resolved by ExternalCodeTableGetter.getValue"——CSV 当时是对的，错误只在 reviewer 注记与报告措辞；T086 报告附录勘误。`t086_wp0_opcode_provenance.py` 的 `props.get(args[0], "0")` 静默吞错问题确认存在但**本轮从未触发**（唯一相对行的基在册）；T086.1 重导脚本 `t0861_wp1_g17_resolution.py` 采用字节码忠实语义（基不在枚举 → NPE 等价错误、=def 递归、16/10 进制分支），重放 442 行 join = **355 direct + 11 FF + 76 FFFE + 0 冲突**（与 T086 EV-83 完全一致）。

### 2.2 客户端派发命名空间审计（对 T086 §1.2/§1.3 的收窄）

新事实（可独立复算，取证文件 §6）：

- 0xA10CE3 开关的 task44 命名属 **recvops（C2S 数值空间）**：62 个具名 case 中 61 与 recvops 条目精确一致、1（0x6A `quest_KJ`）两空间皆无、0 与 sendops 一致。
- 0x20..0x80 内 **35 个被开关处理（非 default）的 id 在 jar sendops 中根本不存在**；5 个 default 中 4 个（0x2E/0x38/0x39/0x3D）恰是 sendops 缺失值。
- 语义锚：0x9571BF 族（0xCF..0xEC，0xCF=seat/stand，C-066/C-090）才是 sendops 空间的入站派发族；0x5658FF（0x97/0x98 + default→0x54112e）是另一族。
- 开关 handler 经 0x4066C9（游标式包字节读取器，带边界断言）消费序列化数据——它是入站处理机，但其 id 空间与 recvops 对齐的原因（本地回显/内部分发假设）**静态未定**。

**结论**：T086"92 个 S2C opcode 获得客户端指令级绑定"的解读**不成立**；对 5 个 send 侧冲突名（ENGAGE_REQUEST 0x45 / ENGAGE_RESULT 0x46 / FAIRY_PEND_MSG 0x60 / DATA_CRC_CHECK_FAILED 0x72 / BBS_OPERATION 0x74）的"客户端裁定"**撤回**；recv SKILL_MACRO(0x6D) 降为"开关旁证"。15 项公开服分歧全部回到 **UNRESOLVED-VERSION-AUTHORITY（报告级）**；BOAT_EFFECT 记录双 handler 事实（0x565935/0x56599A）但载荷形状不足以裁定；REPORT_PLAYER/SPOUSE_CHAT（0x7FFE vs 0xFF）为占位对。G17 维持 PARTIAL-STATIC，unresolved_scope 更新。task050 出站表的 `0x1999a6=0xCF` 行经查为**误归属**（其调用链 0x964319→0x7accff 是移动 setter，非包写入），已在取证文件中标注——不据此裁定 SNOWBALL。

---

## 3. WP2 — EV-82～EV-87 证据哈希跨平台一致性

### 3.1 根因（字节级实证）

- 仓库无 `.gitattributes`；本机 `core.autocrlf=true`。
- 六份 T086 证据文件：**工作树 CRLF**（T086 生成器以默认文本模式写出）、**git blob LF**（提交时规范化）、台账 SHA-256 = CRLF 工作树字节（因此本机 Validator 17a 原样通过）。
- T085 及更早证据文件为 LF（0 CRLF）——两套约定并存：Windows 新克隆会打破 T085 行，Linux 新克隆会打破 T086 行。
- 全量审计 87 行：58 二进制（EXE/DLL/WZ，raw==canonical）、19 LF 文本、6 CRLF 文本（即 EV-82..87）、3 离盘、1 复合哈希。**仅六行需要处理，无系统性遗漏。**

### 3.2 规范与实施

**规范**（`research/scripts/evidence_canonical.py`，文档化于模块头与审计 CSV）：
- 文本（可 UTF-8 解码且无 NUL）：**CRLF→LF 规范化后哈希**（BOM 保留为内容；孤立 CR 为内容；行尾换行有无影响哈希）。
- 二进制：原始字节。
- 该规范下，本仓全部提交文本的规范字节 ≡ git blob 字节 → 等价于"以 Git blob 为权威"，但无需在验证时依赖 git（测试 fixture 非 git 仓库）。任何非 EOL 字节改动仍改变哈希——是**规范化**，不是弱化。

**实施**：
- `evidence.csv` 六行重基线（旧 CRLF → 新规范 LF，六行新哈希均 == git blob 哈希）；旧→新全量记录持久化于 `forensics/T0861-EVIDENCE-BYTE-HASH-AUDIT.csv`（重跑不丢失，含 git 可复原说明）。
- Validator 17a 改用 `canonical_sha256`（注释说明规范与六行重基线出处）；**未触碰** 16a 格式检查。
- 单元测试 8 项（LF 不变 / CRLF→LF / BOM / 行尾换行敏感 / 孤立 CR / 二进制 0D0A 保留 / UTF-16 视作二进制 / 文件级 API）+ test_47 按新规范重写（CRLF 工作树 + LF 台账 → PASS；内容篡改 → FAIL）。
- 台账再生后 88 行全部按新规范通过（含新增 EV-88）。

**验收**：Windows 与 Linux 按同一文档化规则均可独立验证（规范字节是平台与 autocrlf 配置的纯函数）。

---

## 4. WP3 — G10 Camera 纯静态深挖（有界）

新增证据 EV-88 / 新主张 C-102（PARTIAL-STATIC/B）。全部窗口本轮自 sha-pinned 镜像重反汇编；E8/字双字普查计数见取证文件。

### 4.1 矩形/参数反向数据流（任务方向 A）

slot15（0x53471A，ret 8）完整解码：
- 参数 (arg_x, arg_y) 与**持久成员**构造的窗口比较：`[fieldctx+0xD4]`（经 0x48AEC3 成员 getter + COM slot4/5 读取器 0x404B07/0x404B2E → X0/Y0）与 `[scene+0x1CC]`（同槽位 → X1/Y1）及场景界 `[scene+0x1D0]/[scene+0x1D4]`：`X1+(3−X0) ≤ arg_x ≤ X1+(W−X0)+5`（Y 同构，+5/+5）。
- 可见路径：`0x8EE9E7(scene+0x218, X1+(W−X0)+0xA, arg_y, [scene+0x6FC])`；剔除路径 `0x8EE966(scene+0x218)`（容器 add/clear 对）。
- **尾部转发**：`0x953B3D(user=[0xBDD490], arg_x, arg_y)` —— 参数是**点**而非矩形；相机量来自 fieldctx 侧读取，不是调用方临时构造的矩形。**C-101"参数=调用方临时相机矩形"的措辞据此修正。**

### 4.2 调用语义扩展（任务方向 B）

- 家族**备用 cull 入口 0x5348C5**（正文旁，ret 8）：`0x9535F1(user, x, y)`，**有且仅有一个直接 E8 调用者 0x9EDA8B**（函数头 0x9EDA1D：[this+0x80] 门 + IID 0xBE2890 槽检查 + 0x4376F2() 记录解析后转发坐标）。T086"0 直接调用者"仅对 0x53471A 主体成立。
- 0x953B3D 的**第二直接调用者 0x45B2C4**：经 `0x9EC924(fieldctx, &pair, 0)` 读取点对后转发。

### 4.3 `[0xBDD838]` 屏幕位置单例（读/写/偏移架构）

- **读** 0x5CABE1：`[+0xC]≠0` → 返回 `([+0x938],[+0x93C])`；否则动态函数指针对 `[0xBE1768]/[0xBE1764]` 回退。
- **写** 0x5CB0E0：`x'=clamp(x,0,800)`、`y'=clamp(y,0,600)`；`[+0xC]≠0` → 存 `+0x938/+0x93C` 再 0x5CA91A(this,x',y')；否则 0x5CA91A 后经 `[0xBE1754]/[0xBE1750]` 回退。**C-027 的 800×600 相关性自此为指令级**（在写者内）。
- **fieldctx 包装**：0x9EC924(get, flag=1 加 `[fieldctx+0xD4]` slot4/5 偏移；24 个消费点，含 0x953B3D 与 0x953AF4 的四个 per-draw 体内)；0x9EC989(set, flag≠0 减同一偏移)。
- **普查**：0x5CB0E0 恰 1 个 E8 调用者（在 0x9EC989 内）；**0x9EC989 恰 2 个生产者：0x4BEDE7 与 0x5F1C7D**；**t086.1 reviewer 反证（已复核并入）**：+0x938/+0x93C 另有**第二个直接写者 0x5CB573**（输入轴驱动逐拍更新：speed=[this+0x970]+5、pos+=speed×axis/10、同一 [0,800]×[0,600] 夹取、变更检测后直接存 0x5CB713/0x5CB71F、0x5CA91A 通知、0x200 命令经 0x5CC30A(this+0x9BC)；经单例方法分发器 0x5CAB38 case 1 自 0x9FEE24 进入）——它绕过 0x5CB0E0 包装器，故 E8 普查不可见；这是 C-028 更新机制族的**具体静态候选**（速度字段 +0x970、+5 偏置、/10 缩放为已证参数形状，目标表面待类身份确认），二者同模板：`helper(网格坐标) + [this+4]成员 vt+0x2C/0x30 + 0x22 边距 → camera_set(flag=0)`；helper（0x4BEE19：%10 网格 206/81/200/80；0x5F1C88：÷16 网格，基 (2,502)）是 **UI 网格摆放**。
- **有界结论（诚实边界，reviewer 修正后）**：`[0xBDD838]` 的角色**不确定**——两条 UI 网格摆放生产者与一个输入驱动逐拍更新器（0x5CB573）同时指向它，不能仅凭生产者定为 UI 层；世界相机候选仍为 `[fieldctx+0xD4]`（slot15 直接读取的偏移对象），其类、写者与更新环是下一步静态目标。0x9535F1 另写**用户持久字段 +0x2ED4/+0x2ED8**。

### 4.4 G10 状态与边界

- **可静态解决（剩余）**：`[fieldctx+0xD4]` 的写者 census（field-create 家族 0x94FDB4 一带的 disp 写扫描）；`[0xBDD838]` 创建点/vtable 追踪定类；两生产者的上游语义（谁触发 UI 摆放）。
- **静态不可判定（现输入下）**：`[0xBDD838]` 与 `[fieldctx+0xD4]` 的运行时具体类（COM 式运行时解析，与 Gr2D [0xBE2788] 同类阻断）；非 E8 编码（函数指针存储后调用）的生产者全集未穷尽；跟随/deadzone/平滑参数（C-028）若存在于 +0xD4 更新环中，需其写者恢复后才可判。
- **产品边界**（PRODUCT-SUBSTITUTION 界定不变）：bounds（VR 折叠）ORIGINAL-STATIC-PROVEN；world→screen 与跟随策略维持产品替代（设计 §4.2），其中"屏幕半宽 400/300"现已与原版写者的 800/600 夹取指令互证。
- G10 **OPEN-RUNTIME → PARTIAL-STATIC**（依据：消费链/单例/漏斗/夹取均已静态证明；参数语义与对象身份仍运行时受限）；C-028 本身维持 OPEN-RUNTIME（未恢复公式）。

---

## 5. 与 0x9BE703 首帧链的合并（补充）

T085/T086 结论不变：跨图/同图传送后顺序 = VR 再折叠（载入期）→ 到点写 → slot12 tick（0x5658CA 入口）→ per-draw → slot15 cull。本轮细化：slot15 读取的 `[fieldctx+0xD4]` 偏移对象在新 field 创建（0x94FDB4）时的安装是相机语境的下一个静态检查点。

## 6. 台账动作

- 修正：C-099（基数）、C-095（DOJO 撤回 + 命名空间警示）、C-101（追加 T086.1 修正注记）、G08/G09/G17/G10（scope/状态）、EV-85（注记）、issue-crosswalk G17（行内更新）、P0-P4 矩阵 P2-05/P2-06/P4-07、GAP-REGISTER 视图 4 行、两份报告（活跃报告内联勘误 + T086 报告勘误附录）。
- 新增：C-102（PARTIAL-STATIC/B）、EV-88（规范 LF 哈希）、forensics 4 份（G08 审计 / G17 解析 / 证据哈希审计 / G10 切片）。
- 数量：Claim/Evidence/Gap = **102 / 88 / 41**（G10 → PARTIAL-STATIC；CLOSED-STATIC 25 不变）。

## 7. 独立 Review（Sub-Agent）

独立子代理以自有脚本与临时目录、双镜像前后哈希核验、盲审优先协议完成 R1–R5。原始报告全文：`forensics/T0861-REVIEWER-INDEPENDENT.md`。**最终裁决：ACCEPT-WITH-CORRECTIONS**。1 项 BLOCKING（0x5CB573 第二写者——反证成立，主 Agent 已独立复核并并入 G10/C-102/C-101/EV-88/取证文件 §8，据此撤回"单一写漏斗"与"UI 放置锚倾向"措辞）+ 3 项 NON-BLOCKING（61/62→62 精确三分计数已统一；公开服 ms079/Afauria 外部对照未由 reviewer 复核——按其建议保留原状并标注；EV-15 占位哈希系 T086 之前历史遗留，Validator 按 hex64 规则跳过，非本轮引入）。处置后复核：Validator/测试/clean-room 全过（见 §8 与日志）。

## 8. 质量门禁

| 门禁 | 结果 | 日志 |
|---|---|---|
| Validator | PASS（0 errors / 0 warnings） | forensics/T0861-VALIDATOR-LOG.txt |
| Unit tests | 69/69 OK（原 48 + 本轮 21，test_47 按新规范重写） | forensics/T0861-UNITTEST-LOG.txt |
| Clean-room 再生 | 与 canonical 一致（claims=102 gaps=41 evidence=88） | forensics/T0861-CLEANROOM-LOG.txt |

## 9. 边界声明

- 仅修改 `research/`；Frozen ABI pin 校验通过；LoomRealm submodule、content/、原始二进制零改动（提交前复核）。
- 未重复 T084～T086 已闭合工作；保留 C-082/C-086/C-087 纠错链；未重开已撤销的 Gr2D 幽灵 slot25 候选。
- 结论四值标签仅在报告层使用；G10 重分类依据证据（结构链静态证明），非政策性机械改状态。
- 项目维持 **NOT STAGE-READY**。
