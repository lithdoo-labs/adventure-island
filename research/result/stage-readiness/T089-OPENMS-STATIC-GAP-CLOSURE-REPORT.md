# T089 — OpenMS-Assisted Static Gap Closure & Camera Focus Provenance — 主报告

**Round**: t089 (2026-11-16). Branch `design/adventure-field-map-scene`.
**Baseline at start**: `42e2d7fb8b7eb49f4cd3f61b48fc56cc391168ba` (local == remote, verified).
**Method**: OpenMS GMS083 原始逆向候选（level B）仅作定向线索；所有新结论均以 CMS079 原始字节
（EXE/Shape2D/Gr2D，哈希核验）独立证明。证据分级 A/B/C/D 严格分离。

---

## 0. 执行摘要

| WP | 对象 | 结论 |
|---|---|---|
| WP0 | T088.1 交接勘误 | **Phase-3b 已归档**（T0881-PHASE3B-REMOTE-ARCHIVE.md：远程 HEAD=42e2d7fb、父 60f1ee92、tree 563f171b、26 文件全在 research/）；**T088 主报告 #6 注册者描述已修正**（独立注册函数 0x9E6BAD，0x9E649A 由回调 0x9E6E10 调用——与 C-107/取证一致；未重开逆向） |
| WP1 | **G35 背景深度键** | **完全闭合（CLOSED-STATIC，C-110/EV-98）**：back `B−128000+index·1000` / front **`B+271200+index·1000`**（0x669923/0x669930 原始字节；**GMS083 的 B+272000 被字节反证**，差 800）；front = 属性 0x54B（静态解密 'front'）布尔化；index = Back 子节点枚举序；双分支消费（0x669BD6 slot25 插入 / 0x669FE6→0x43E3A6）；61 站点普查撤回 EV-20“仅 1 站点”；13 图 387 记录/26 front；有符号边界向量 |
| WP2 | **G36 视差与平铺** | **实质收窄（C-111/EV-99/EV-103）**：`+0x98` 方法体在 CMS079 Shape2D 静态可读且与 GMS083 指令级一致——attach 0x5140847D（基线快照+比率+求值器安装）与 evaluator 0x514085B3（`local += trunc((src_now−src_attach)·num/den)`，idiv 截断）；`+0x90`（数字 Set 0x5140828F）槽位布局双表一致（0x5140C2F0/0x5140C0FC）；滚动相位 = 全局 tick（[0x51411C34]）上的插值终时 `globalTick+20000/\|rate\|`；全部属性名静态解密闭合（rx/ry/cx/cy/a/ani/type/front + delay/a0/a1）；残项：首帧绝对偏移（attach 基线依赖，OpenMS 亦未证）+ `+0x9C`（0x514086B3）变体语义 |
| WP3 | **G39 动画/传送门时序** | **核心闭合（C-112/C-113/EV-100/EV-101）**：delay id 0x155D、**默认 120（0x78）覆盖帧转换器/平铺器家族**（36 站点中 18 个；其余站点使用显式默认 150/60/180/1000 或变量默认——Phase-2 D2 修正）；a0/a1 默认 −1；Gr2D 0x5040ABE6 帧记录（delay@+0x0C/a0@+0x10/a1@+0x14，VT_I4 校验，序列号自增）；时间线累加 `delay·animationScale/1000` 入终时戳（有符号总周期/无符号逐帧），模式门 0x20/0x10；**repeat（0x8D4）三分**：≥0→0x20 循环（值=循环后缀起点）、−1→0、−2→0x10 单次（0x443717 门）；**portal 家族**：pv=0x601/Start=0xF7D/Continue=0xF7E/Exit=0xF7F，FSDB 帧数 **pv=8、Start/Continue/Exit=4/7/3**（与 GMS083 完全一致）；时钟基 = Shape2D 全局 tick；残项：每帧显式 delay 值（WZ 侧）、animationScale 默认值与非 120 站点默认表 |
| WP4 | G37 联动 | **收窄（C-112/C-113）**：flow 子对象属性即 delay/a0/a1，经同一 slot+0x104→0x5040ABE6 与 0x66F890 注册——动画时序语义随共享引擎闭合；残项：逐帧绘制体（运行时） |
| WP5 | **G10 焦点来源** | **实质推进（C-114/C-115/EV-102；Phase-2 D1 链修正后）**：CMS079 平滑相机滤波器存在且被武装——Shape2D 槽 +0xA4/+0xA8（查询/提交）、滤波器 id **0x1E0000**、死区 **28.0**（[0x5140D978]）、残差 `max(0, coef·1000·D/(dt·D+coef·1000))`、首提交快照；EXE 恰 3 个提交站点，其中 0x43787D `push 0x64`（**系数 100**）；**0x437717 运行于全局 [0xBDD460] 对象**（0x43291A 为 getter；[user+0xF28] 容器经 stash+AddRef 作为 arg1），内部经 C-106 **共享单例 Vector2D（相机对象）**链：挂载 F28 容器 → **Set(0,−0x32)=(0,−50)** → 滤波(100) → 挂渲染原点——滤波器直接武装在共享相机向量上；(0,−50) 与 GMS083 `(x,y−50)` 候选跨版本一致；焦点写入者来源措辞按盲审复核修正为 `[[arg3]+0x14]`（C-115）；G10 维持 PARTIAL-STATIC（25 站点/派生表/泵相位残项） |
| WP6 | 其他 Gap | 按调度纪律未启动长尾（G20/G40/G16/G13/G17 无新证据；G14/G18/G19/G11/G12 未深入） |

**项目状态：NOT STAGE-READY（不变）**。静态闭合率 25/40 → **26/40（65.0%）**。

---

## 1. Git 与基线

- 起始：local HEAD = remote HEAD = `42e2d7fb8b…`，工作树干净。
- 五份原始样本 SHA-256 全部核验通过（PCOM.dll 以仓库权威值 `cf3807f3…b62306c94f…` 为准；
  任务书文本中该哈希存在一处笔误——任务书写 `b623061c94`，仓库与实测均为 `b62306c94…`，已在
  Phase-2 交 Reviewer 复核）。
- 提交范围：仅 `research/`（见 §7 提交清单）。

## 2. Gap 变化

| Gap | 起 | 终 | 说明 |
|---|---|---|---|
| G35 | PARTIAL-STATIC | **CLOSED-STATIC** | 唯一新闭合：全部必需条件（公式/分支/索引/消费/边界/资源）满足 |
| G36 | PARTIAL-STATIC | PARTIAL-STATIC | +0x90/+0x98 体与属性名闭合；残 attach 基线与 +0x9C |
| G37 | PARTIAL-STATIC | PARTIAL-STATIC | 动画时序语义随引擎闭合；残绘制体 |
| G39 | PARTIAL-STATIC | PARTIAL-STATIC | delay 默认/单位/累加/repeat/portal 结构闭合；残 WZ 帧值/scale 默认 |
| G10 | PARTIAL-STATIC | PARTIAL-STATIC | 滤波器+目标链证明；残 +0x14 普查/25 站点/派生表/泵相位 |

**计数**：CLOSED 25→**26**；PARTIAL 9→**8**；OPEN 6→6；SUPERSEDED 1→1。
不可关闭原因：G36/G37/G39 残项属 WZ 资源值或运行时绘制体；G10 残项见 §4。

## 3. OpenMS 匹配统计（口径：本轮实际检查的候选函数/常量）

**[t090 WP0-B 勘误——真实矩阵重新对账]** 本节 T089 版统计（“26 行 / 22 执行 / 4 NOT-RUN”）与
T089-OPENMS-CMS079-MATCH-MATRIX.csv 的真实内容不符，已按 CSV 逐行重数修正：
- 矩阵总计 **24 数据行**：MATCH 类 **16**（MATCH/MATCH-STRUCTURE/MATCH-COUNTS/“MATCH (shared
  engine)”）、REFUTED 类 **2**、INCONCLUSIVE 类 **2**、内部研究项 **2**（EV-20 旧证据反证；
  namespace 名称 RESOLVED——均非 OpenMS 外部候选）、NOT-RUN **3**（G40/G20/G16）。
- 严格排除 2 条内部研究行后，**外部 OpenMS 候选 = 22 项：已执行 19，未执行 3**；
  已执行项分布：16 MATCH 类、1 REFUTED（GMS083 front 常量 B+272000，CMS079=B+271200）、
  2 INCONCLUSIVE（GMS083 0x00641EF1 clamp 未追踪；GMS083 portal id 空间不同——0x1122/0x1123
  在 CMS079 为 GBK 字符串，语义按 CMS079 自身 id 证明）。
- EV-20“仅 1 个 imul-1000 站点”的反证（实为 61）为内部证据勘误行，不计入外部候选执行数。
- 真实匹配结果未作任何改动（见回归测试 test_t090_round.py 的矩阵分类汇总断言）。
- CMS079 新确认函数/方法体：**14**（0x669923/0x669930 键、0x66F890、0x66885B+0x66891C、0x43EC69、
  0x5040ABE6、0x5040B9xx 累加体、0x50403ECA、0x5140847D、0x514085B3、0x51408BED、0x51408C9A、
  0x51408D23、0x51408E33、0x437717）。

## 4. 关键技术成果边界（CMS079 原始证据 vs 跨版本参考）

- **A 级（CMS079 原始）**：§0 表中全部公式的字节、id 解密、槽位、消费链、FSDB 资源核验。
- **B 级（GMS083 候选，仅定向）**：OpenMS 各地址/常量作为搜索线索；本轮未将任何 GMS083 地址写入
  CMS079 Claim。
- **关键反例**：GMS083 front 常量不可移植（差 800）；GMS083 的 delay id（0x15F8）在 CMS079 不存在
  （CMS079=0x155D）；portal id 空间整体不同。两版本 Shape2D 在 0x5140828F/0x5140847D/0x514085B3/
  0x51408D23/0x51408E33 处布局重合，属跨版本结构稳定性，已被 CMS079 字节独立证实。

## 5. 独立 Reviewer

- 真实独立 sub-agent（独立上下文/临时目录/脚本；只读仓库；未提交未推送）。
- **Phase 1 盲审先行**（T089-REVIEWER-BLIND-NOTES.md，评审者私有目录产出后归档）：在未见 OpenMS
  结论与本轮匹配表前独立复核并**预先发现**：61 站点普查、0x669923/0x669930 双常量键、
  EV-20/0x423E6B 归属错误、+0x98 视差体与共享 Vector2D 接收者、slot +0x58/+0x5C 全局 tick、
  **0x769B51 为 ret 4 导致的调用者参数修正（[[arg3]+0x14]）**——全部与本轮主 Agent 结论独立吻合
  或构成修正。
- Phase 2/3/4：见 T089-REVIEWER-INDEPENDENT.md（对抗复审、修复闭环、远程树复验、最终裁决）。

## 6. 质量门禁

- `validate_reverse_engineering.py`：**PASS，0 errors / 0 warnings**。
- `python -m unittest discover -s research/tests -q`：**174/174 OK**（基线 146 + 本轮新增 28；
  迁移理由：+C-110..C-115/+EV-98..EV-103 台账计数与 C-115 措辞修正，逐处带注释）。
- Clean-room 三寄存器与 source-of-truth 字节一致（生成器重跑）。
- 原始二进制哈希：五份全对；Frozen ABI pin 未动；LoomRealm pin 未动；改动仅 research/。

## 7. 交付物清单

- 主报告（本文件）；forensics：T089-G35-BACKGROUND-KEY.md、T089-SHAPE2D-GR2D-ENGINE.md、
  T089-NAMESPACE-ID-NAMES.txt、T089-NAMESPACE-BULK.txt、T089-G35-KEY-SEARCH.txt、
  T089-G35-FUNCTION-CHAIN.txt、T089-G35-KEY-CONSUMPTION*.txt、T089-G35-FSDB-CENSUS.txt、
  T089-DLL-CROSSVERSION-PROBES.txt、T089-SHAPE2D-CONST-VTABLES.txt、T089-G39-DELAY-SITES.txt、
  T089-G39-DELAY-DEFAULT.txt、T089-G39-FRAME-CONVERTER.txt、T089-G39-REPEAT-SITES.txt、
  T089-G39-PORTAL-IDS.txt、T089-GR2D-SLOT104-INSERT.txt、T089-GR2D-FRAME-REGION.txt、
  T089-GR2D-ACCUM.txt、T089-G10-FILTER-CALLSITES/FUNCTIONS/CALLERS/CALLERS2.txt、
  T0881-PHASE3B-REMOTE-ARCHIVE.md。
- 跨版本匹配总表：T089-OPENMS-CMS079-MATCH-MATRIX.csv；闭合核验表：T089-GAP-CLOSURE-AUDIT.csv。
- 脚本：research/scripts/t089_*.py（12 个，全部 sha 固定输入、可复现）。
- 测试：research/tests/test_t089_round.py（28 项）。

## 8. 下一轮（T090）交接建议

1. **G10 收尾最划算**：[[arg3]+0x14] 写入者普查 + 滤波坐标消费者定位 + 25 个 INCONCLUSIVE 站点解码
   （滤波器机制已证，剩余是对象链与消费侧）。
2. G36/G39 的 WZ 侧帧 delay 值提取（资源侧工作，非 EXE 静态）。
3. G36 `+0x9C`（0x514086B3）变体语义解码（可选）。
4. G35 已闭合：产品侧应使用 **front=B+271200**（非 v83 常量）。
5. 基线：本报告提交后的远程 HEAD（见 Git 节录）。
