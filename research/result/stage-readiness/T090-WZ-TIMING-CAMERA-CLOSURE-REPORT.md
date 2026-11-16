# T090 — WZ Animation Timing Closure & Camera Focus Provenance — 主报告

**Round**: t090 (2026-11-16). Branch `design/adventure-field-map-scene`.
**起点**: `d1dcb8b4a0db55b9498bfc99a5d828d9411be463`（远程 HEAD 核验一致，工作树干净）。
**方法**: 全轮 STATIC-ONLY。原始 Map.wz（sha `9e0d2a0f…5f69`）以仓内 wz-python（region EMS）
只读解析；EXE/Shape2D/Gr2D 哈希全部核验；所有新结论以 CMS079 原始字节/WZ 节点独立证明。

---

## 0. 执行摘要

| WP | 对象 | 结论 |
|---|---|---|
| WP0 | T089 三组权威勘误 | **全部完成并独立复核**（独立提交 `e9e71ba3`）：C-109 焦点来源现行文本修正为 `[[arg3]+0x14]`（旧 `[[this+0xF28]+0x14]` 降为历史推断并标注；10 调用者/Set 地址/分支门保留；20 项回归）；OpenMS 矩阵统计对账（真实 24 行 = 16 MATCH 类/2 REFUTED/2 INCONCLUSIVE/1 内部 RESOLVED/3 NOT-RUN；外部候选 22 项执行 19——主报告已修）；Gap 审计 reviewer 状态归档（5×pending → archived-ACCEPT 引用 Phase-2/3/4）、G40 起始状态修正 PARTIAL-STATIC、n/a 终态替换；EV-96 哈希随注释迁移；归档编码验证干净（无需修复） |
| WP1 | **G39 WZ 帧时序** | **三项 T089 残项闭合（C-117/EV-104/EV-105）**：原始 Map.wz 帧普查 **4,347 帧/475 资源——2,450 帧显式 delay（44 种值 100..4000）**，225/329 多帧资源依赖消费者默认——“全部 120ms”被资源数据反证；**animationScale 默认 = 1000**（累加器 0x5040B9DE = [vt+0x110]@0x5042E3F0 主表唯一槽位；0x504027BB 空缺 VARIANT 快路径 0x5040283D 存 0x3E8）；**36 站点默认矩阵全表**（120×18 全部 imm8 `6A 78` 种子 / 150×2 / 60×2 / 180×3 字节确认 `68 B4 00 00 00` / 1000×2 / 寄存器×9）；**portal 平面记录 delay 默认 = 0**（0x71A203 xor ebx,ebx）；原始 portal 帧无 delay（pv=8、ph 4/7/3、仅 psh/1 delay=1500+a0/a1；psh/2-3=6/14/6）；数值时间线模型（32 位语义/重复三分/截断）。**G39 维持 PARTIAL-STATIC**（portal 逐帧默认值未字节定位——诚实残项） |
| WP2 | **G36 +0x9C 与首帧基线** | **+0x9C 完整解码（C-118）**：0x514086B3，ret 0x34（this+12 栈参）= **矩形范围成员附加**（双 int 0xFFFFFF 钳制→E_INVALIDARG；VARIANT 门；快路径矩形 (x1,y1,x1+e1,y1+e2) 经 [0x5141185C] 应用、clamp-vs-mod 模式处理器 rec+0x1C、提交进与 Set/视差/滤波共享的待处理列表、调用成员 [vt+8]）；EXE 8 站点（0x437xxx 滤波武装族/0x4B3xxx UI 动态矩形/0x66 平铺带）。**attach 基线文档化**：基线=注册时 [0xBE2788] 原点位置的运行时快照——**首帧绝对屏幕偏移静态不可证**（与 OpenMS 同边界，独立到达）。13 图 **387 条 back 布局表**（原始 WZ 值+C-051 跨度+C-111 视差比，视口 800×600）。G36 维持 PARTIAL-STATIC（残项=绝对基线/逐帧绘制体） |
| WP3 | G37 联动 | obj 层帧普查并入 G39 资源闭合（3,540 obj 帧、2,114 显式 delay；平铺器 0x66ABCD 120 默认覆盖 flow 子帧）；共享引擎无独立 Obj 时序逻辑。G37 维持 PARTIAL-STATIC（残项=绘制体） |
| WP4 | **G10 滤波消费链与焦点** | **滤波消费链闭合（C-116/EV-106）——T089 “滤波坐标是否进入 slot15 消费侧”残项结构性解决（是）**：滤波提交 0x51408C9A 经 0x514072CF **在共享相机上创建动画 wrapper**（[this+0x24]，ctor 0x51407340，x/y 按值@w+0x20/+0x24）；**X/Y getter（+0x20/+0x28）在 wrapper 存在时经 0x51406ADC 解析器——内联泵引擎 0x51406CF7（应用全部待处理记录）并返回滤波坐标（w+0x70/+0x74）**；武装态立即 Set=**增量存储**（0x51407A34，保持滤波位移）；scene-cull slot15 与 world→screen 经 getter **结构性消费滤波坐标**；EXE `call [reg+0xA4]` 普查=**0**（滤波系数从不被 EXE 查询）；阈值 [0x5140D8C8]=0.0/[0x5140D978]=28.0。**调用表精化（C-119）**：8/10 arg3=0（含 0x990E21/0x990E91 esi=0 勘误）、0x959493 调用者依赖（0x5C031A 传对象）、0x98DC43 与滤波武装同处 [0xBDD460] 上下文（0x98DC0C→0x43291A）。25 残余站点诚实分类：18 SHARED-WRITE-CONTEXT-POSSIBLE + 7 RECEIVER-OTHER-POSSIBLE。G10 维持 PARTIAL-STATIC（[[arg3]+0x14] 写入者/arg3↔F28/E2E3 相位/wrapper 持续性） |
| WP5 | 其他 Gap | 按调度纪律未启动长尾；G20/G40/G13/G17 无新证据未动 |
| Reviewer | 真实独立 sub-agent | Phase-1 盲审完成（首次会话耗尽预算后恢复；对其 q1–q7 脚本产出做综合）；**4 项分歧由主 Agent 字节裁定**（D-A 180×3 确认/D-B 120 全 imm8/D-C 0x959493 调用者依赖/D-D getter 快路径术语统一）；其 pinned 副本污染事件自检披露并从 d1dcb8b4 重取；Phase-2/3/4 见 T090-REVIEWER-INDEPENDENT.md |

**项目状态：NOT STAGE-READY（不变）**。Claim/Evidence/Gap = **119 / 107 / 41**。
CLOSED-STATIC 26 / PARTIAL-STATIC 8 / OPEN-STATIC 6 / SUPERSEDED 1——**本轮零强行关闭**；
G10/G36/G37/G39 全部按证据边界收窄（各残项见 §2）。有效闭合率维持 26/40 = 65.0%。

## 1. Git 与基线

- 起点 `d1dcb8b4`（远程一致）；WP0 独立勘误提交 `e9e71ba3`（26 文件，全在 research/）。
- 五份二进制 + Map.wz/Base.wz SHA-256 全部核验（见 EV-104/EV-105/EV-106 与 §H）。
- 提交范围：仅 `research/`（见 §A 清单）。

## 2. Gap 变化（无状态迁移，全部实质收窄）

| Gap | 起=终 | 新证明 | 剩余条件 |
|---|---|---|---|
| G10 | PARTIAL-STATIC | C-116（滤波消费链闭合——消费侧结构性解决）；C-119（调用表精化）；25 站点分类 | [[arg3]+0x14] 写入者普查；arg3↔F28（F28 直接写者仅 ctor-zero 0x934443）；E2/E3 泵相位；wrapper 持续性；18 个 POSSIBLE 站点接收者链路 |
| G36 | PARTIAL-STATIC | C-118（+0x9C 完整解码）；attach 基线机制文档化；387 条布局表 | 首帧绝对偏移（静态不可证——边界与 OpenMS 一致）；逐帧绘制体 |
| G37 | PARTIAL-STATIC | 资源帧普查并入（obj 帧 2,114 显式 delay） | 逐帧绘制体（运行时） |
| G39 | PARTIAL-STATIC | C-117（显式 delay 存在/44 种值；scale 默认 1000；36 站点默认全表；portal 平面默认 0） | portal 逐帧默认值；8 个寄存器默认变量 |

## 3. 关键新技术事实（全部 CMS079 原始字节/WZ）

1. **原版 WZ 帧时序数据面**：显式 delay 值域 100–4000ms（44 种），190/200/170/180/165/205ms
   为最高频；456 帧 a0/a1 渐变；z0/z1 全语料缺失。5 个 frameset 内混合显式/缺省。
2. **animationScale=1000 默认**：注册（[vt+0x110]）与时间线累加为同一引擎槽位；V3 空缺
   VARIANT → 0x3E8。
3. **portal 家族双数据流**：平面记录 delay（默认 0）≠ 逐帧 delay（站点未定位）；原始帧无
   delay → 960/480/840/360ms 保持默认基估计（已按 0/60/120/150/180/1000 全景列表）。
4. **相机滤波的完整消费闭环**：wrapper 创建→getter 泵引擎→滤波坐标→slot15/world→screen；
   立即 Set=增量。C-108 的“立即存储”措辞限定于未武装态（refines，不推翻）。
5. **焦点写入者调用 ABI 终表**：ret 0xC/ret 4 惯用法、8+2 分布、0x959493 调用者依赖。

## 4. 与盲审 Reviewer 的分歧裁定

| # | Reviewer（盲） | 主 Agent（裁定） | 依据 |
|---|---|---|---|
| D-A | “180 默认未观察到” | **180×3 成立** | 0x40EE4B/0x40F595/0x410832 字节 `68 B4 00 00 00`（T090-ADJUDICATION-DADBDC.txt） |
| D-B | 120×11 | **120×18（全部 imm8 `6A 78`）** | 逐点编码形式核查（reviewer 扫描器疑漏 imm8） |
| D-C | 9/10 arg3=0 | **8+2**（0x959493=[ebp+0x20] 调用者依赖：0x5C031A 传 esi 对象/0x95282D 传 0） | 0x9573A6 调用者窗口 |
| D-D | getter 快路径读 “[rec+0x1C]” | **[this+0x1C]（wrapper==NULL 时）；术语统一**（rec=Vector2D this） | 0x5140724A 主体 |

## 5. 质量门禁（真实命令与退出码见 §H）

- `validate_reverse_engineering.py`：**PASS 0/0**（Claims 119 | Gaps 41 | Evidence 107）。
- `python -m unittest discover -s research/tests -q`：**215/215 OK**（基线 174 + T090 新增 41；
  4 处历史计数 pin 按先例注释迁移 115→119/103→107）。
- Clean-room 三寄存器字节一致（生成器重跑）。

## 6. 交付物清单

主报告（本文件）；forensics：T090-WP0A-FOCUS-ARGS-VERIFY.txt、T090-WP0A-CALLERS-ANCHORED.txt、
T090-G39-WZ-FRAME-CENSUS.csv、T090-G39-ANIMATION-TIMELINE.md、T090-G39-DEFAULT-CONSUMER-MATRIX.csv、
T090-G39-PORTAL-DURATIONS.csv、T090-G39-PORTAL-DEFAULT-SCALE.txt、T090-G39-PORTAL-SCALE-HEADS.txt、
T090-G39-PORTAL-SCALE-FULLHEADS.txt、T090-G39-IDIOM-DECODE.txt、T090-G39-SCALE-SOURCE.txt、
T090-G39-ACCUM-VTSLOT.txt、T090-G39-PORTAL-START-LOADER.txt、T090-G39-PORTAL-RECORD.txt、
T090-G39-TICK-SETTER*.txt、T090-G36-SLOT9C-DISASM.txt、T090-G36-ATTACH-BASELINE.md、
T090-G36-13MAP-LAYOUT.csv、T090-G10-FILTER-CONSUMERS.md、T090-G10-ARG3-POSITION-WRITERS.csv、
T090-G10-RESIDUAL-SLOT90-CLASSIFICATION.csv、T090-G10-FILTER-QUERY/WALKER/ENGINE/WRAPPER/WRAPPER2/
GETTERS/RESOLVER/AUX-STORE/COMMIT.txt、T090-ADJUDICATION-DADBDC.txt、T090-REVIEWER-INDEPENDENT.md。
脚本：research/scripts/t090_*.py（60 个，sha 固定输入；WZ 源路径按仓库约定书写为
`冒险岛online` 目录——宿主目录名实际带 GBK 乱码字节，脚本以编程方式解析目录，两边均可复现）。测试：test_t090_round.py（41 项）。

## 7. 下一轮（T091）建议

1. **G10 收尾**：[[arg3]+0x14] 写入者普查（0x5C0342 的 esi 对象类定身 → +0x14 存储站点）；
   wrapper 生命周期（记录退役/场景切换）——消费链已闭，剩对象链与相位。
2. **G39**：portal 逐帧默认值（若 portal 绘制路径静态缺位则记录边界收案）；
   8 个寄存器默认站点数据流。
3. **G36/G37**：产品侧可直接用本轮布局表+时间线模型实施（文档已给锚定边界）。
4. 基线：本报告提交后的远程 HEAD。
