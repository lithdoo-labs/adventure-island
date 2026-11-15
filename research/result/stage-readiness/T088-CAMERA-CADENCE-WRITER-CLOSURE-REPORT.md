# T088 — Camera Update Cadence & Direct Vector2D Writer Census (CMS079 纯静态)

Round: T088 (2026-11-15). Branch: `design/adventure-field-map-scene`.
Baseline: `5f30b7a80c4829b3a85c3fafa939402646ff1ba3`（开工核验一致；远程无新提交）。

Binary identity（每脚本运行前 sha-pinned）：
- EXE `.work/task-036/game-image-unpacked.bin` `d4a67597…a31718`（linear，VA−0x400000）
- Shape2D `.work/task-001/extracted/冒险岛online/Shape2D.dll` 全量 SHA-256
  `9802baccd787543221391b4b902ce199e99fb2cde6a4edadc2f4972490c8111b`（0x51400000）
- PCOM `.work/task-001/extracted/冒险岛online/PCOM.dll`
  `cf3807f3107152d3b305bfc84be36d58b62306c94f60133c8e80fd17f9d9e54b`（0x50C00000）
- 服务端 `.work/task-063/server079.jar` `49382081…8cf360`（本轮仅 EV-92 一致性引用）

约束遵守：**零运行时行为**；仅修改 `research/`；Frozen ABI / LoomRealm /
content / 原始二进制零改动。报告级标签（ORIGINAL-STATIC-PROVEN /
STATIC-UNDERDETERMINED 等）不进入权威 CSV status。

---

## 执行摘要

| WP | 对象 | 结论 |
|---|---|---|
| WP0 | T087 遗留台账 | **三项全部修复**：EV-92 路由与 C-105/G17/取证对齐（新增回归测试）；P2-01 readiness 恢复 PRODUCT-READY（报告级标签保留于说明列）；P4-07 移除过期任务、重写剩余项；P2-01/05/06 写入者措辞改为「7 漏斗调用点 + 直接家族」 |
| WP1 | 0x31D 解析点 + 直接写入者普查 | **单例闭包（ORIGINAL-STATIC-PROVEN）**：EXE `0x447891` 不是 AddRef 附加而是 `PcCreateObject(名称记录, IID{F28BD1ED…}, &slot, extra)`；PCOM 注册表解析名称 → 类条目 slot3；Shape2D 工厂 `0x51402FB6` 的注册表记录在 record+0x10 **惰性创建一次后永远复用**（+QI）→ **全部 80 个解析点（63 push + 17 mov）混叠同一 CWzVector2D**（主虚表 0x5140C2F0，x/y 整型 +0x1C/+0x20；t088.1 精确注记：80 个正则站点中 4 个 mov 形态为 imm32 操作数非解析点——3 个 id 区间端点 + 1 个分发链数据——别名闭包适用于实际调用 0x447891 的 76 个站点）；39 个 slot+0x90 候选逐项分类：2 CONFIRMED-CAMERA-WRITER、12 CONFIRMED-SHARED-WRITE-CONTEXT-UI、0 RECEIVER-OTHER、25 INCONCLUSIVE（39 行=38 唯一站点，0x6BE6F4 经解析与 getter 两路并入；reviewer C1 将 0x4B3BC5/0x4B3DAD 重分类为共享写） |
| WP1-C/WP3 | Shape2D Set 语义 | **立即/插值双分支定案**：V3（第3参 VARIANT）∈{VT_EMPTY,VT_ERROR} → 立即整型存储；否则 VT_I4=时长（全局 tick）+ V4&0x10000000 标志 → 插值记录入 [this+0x30] 待处理列表；**相机相关站点全部传默认参（39/39 统一默认 V{VT_ERROR,missing}；reviewer C4：两处清槽后从 0xBE7330 重模板化——如 fieldctx ctor 0x9EC5C3-0x9EC5D2）→ 相机写从不武装插值**；0x5CA91A 公式由此成为端到端无条件立即写 |
| WP2 | Field 写入者触发链 | **#6/#7 定性推翻（T087 勘误）**：#6 0x9E6D18 位于回调 0x9E6CA4（由表面呈现函数 0x9E649A 经 [0xBE1554] 注册），记录 +0x38/+0x3C 由**单例基础读取（屏幕光标）** 0x5CABE1 播种，写门=PtInRect（五重合取门）——**光标跟随模式**；#7 0x9F1ADF 位于窗口过程 0x9F1784 **鼠标消息带**（0x200..0x206/0x20A）：lParam 16:16 客户区鼠标坐标解包，门=[singleton+0xC]==0——同为光标模式；**新发现直接焦点写入者 0x93CB27**（Set@0x93CC9B）：共享对象直建 + Set(X(src),Y(src))，src=[[this+0xF28]+0x14]，**10 个 E8 调用者**（传送触发族 0x964E16、包生成族 0x98DC43、座位、输入、用户区；统一 0x769B51 脚本记录惯用法，N∈{500,800,1000}）——事件/脚本驱动的跟随候选 |
| WP3 | 节奏/deadzone | 十问矩阵：**已解码集合内无每 Tick 相机写入者**（全部事件/消息驱动）；**已解码门内无任何距离阈值常量**（有界负结论）；Shape2D 插值引擎存在但相机从不使用；Portal 到达栈内同步焦点写入（E1 边）；[F28+0x14] 目标语义为剩余半边 |
| WP4 | 边界/Scene/Portal | 相机侧地图边界 clamp：已解码写入者内**负**（边界在消费侧 slot15 裁剪窗 + 加载侧 VR fold）；[scene+0x1CC]：10 个直接写者均非 slot15 家族（有界负成立；t088.1 勘误：T088 版为 9——探针缺陷漏 0x952ECE；reviewer C7：基础表 0xB01278 实有 4 个 imm32 安装点 0x52F1BC/0x52F1CF/0xA0B39E/0xA0BB2A + 2 个寄存器装载间接安装，"无 imm32 引用"草稿说法撤回）→ 派生表与 +0x1CC 安装者仍 UNLOCATED；Portal→相机时序边类型化（E1 同步/E2E3 消息驱动） |

**G10 维持 PARTIAL-STATIC**（身份/公式/Set 语义/触发/节奏有界闭合；焦点写入者目标语义 + 25 个 INCONCLUSIVE 站点为残项）。项目维持 **NOT STAGE-READY**。

---

## 1. WP0 — 台账修复（详见 forensics/T088-T087-LEDGER-CORRECTIONS.md）

- **F1 EV-92**：`instruction_or_data` 重写为字节级路由（0|1|6→0x564FBE / 2|5→0x564E52 / 3|4→0x56512A-或-回退 0x564E52；仅 <0 或 >6 无操作），与 C-105、G17、取证文件 §3 一致；原取证文件与哈希不变（其内容本已正确）。回归测试 `test_ev92_routing_consistent` 禁止旧路由字符串重新进入 Evidence 元数据。
- **F2 P2-01**：readiness → `PRODUCT-READY`；报告级标签 ORIGINAL-STATIC-PROVEN 保留在 `evidence_grade_and_type`；A 级变换证据（C-103/EV-89/90）与 `blocks_acceptance=否` 不变。
- **F3 P4-07**：移除 `+0xD4` 身份、`[0xBDD838]` 构造点、运行时捕获三项过期任务；剩余项集中到 [F28+0x14] 语义、跨图输入抑制、E2/E3 泵相位；保持 DESIGN-DECISION 与验收阻塞。P2-01/05/06 措辞统一为「7 个 0x5CA91A 漏斗调用点 + 直接 [vt+0x90] 写入家族」。

## 2. WP1 — 解析点普查与直接写入者分类

### 2.1 共享单例闭包（本轮最大结构成果）

```
EXE resolve(0x31D) ─→ 名称记录（0x7A48D0/0x40634C 惰性按 id 缓存）
      │ 0x447891(名称记录, &slot, extra)
      ▼
PcCreateObject(记录, IID@0xBA0500, &slot, extra)      [PCOM 0x50C04CD1]
      │ 注册表按名称解析 → 类条目 slot3
      ▼
Shape2D DllGetClassObject(名称='Vector2D') ─→ 工厂 0x51402FB6
      │ 记录匹配后：record+0x10 为空 → [record+8]([record+0xC], …) 创建一次
      │             record+0x10 非空 → 直接复用缓存实例 + QI
      ▼
THE ONE CWzVector2D（主虚表 0x5140C2F0；x/y 整型 +0x1C/+0x20）
```

IID@EXE 0xBA0500 = `{F28BD1ED-3DEB-4F92-9EEC-10EF5A1C3FB4}` 字节等于 Shape2D
0x514101C0（该类 intmap 表项 dw=0 → QI 返回 pThis，绑定主虚表）。

**推论**：所谓「相机」= 一个被全场共享的全局可变向量。持久别名包括
[fieldctx+0xD4]、[singleton+0x9B0]、[edi+0xE30/+0xE34/+0xE38]、[ebx+0x18]、
[ebx+0x38]、[esi+0x44]、[esi+0x30]、[ebx+0x120]、[esi+0x28D0]——对它的任何
写入（漏斗或直接）同时改变 slot15 裁剪窗与 world→screen 所用的相机值。
这把 T087 的「同 id 同槽位」推断升级为跨模块字节级证明，并给出
T087-reviewer「≥4 直写站点」的正确解释：它们全部写同一共享寄存器。

### 2.2 39 候选分类（forensics/T088-DIRECT-SLOT90-WRITER-CLASSIFICATION.csv）

| 分类 | 数量 | 说明 |
|---|---|---|
| CONFIRMED-CAMERA-WRITER | 2 | 0x9EC62A（fieldctx ctor 初始 Set(−400,−300)；EV-89 再证）；0x93CC9B（焦点写入者，§3） |
| CONFIRMED-SHARED-WRITE-CONTEXT-UI | 12 | 共享对象上的 UI/表面偏移写：Set(0,−0x32)@0x43781F、Set(−0xFF,0)@0x692280/0x7AA848、Set(0x190,var)@0x6BE6F4、Set(0x97,0x8D)@0x6ED7CC、Set(0,−0x1E−f())@0x93C37C、清零@0x4505B0/0x450709/0x741EC8 等；含 t088-reviewer C1 重分类的 0x4B3BC5/0x4B3DAD（接收者=函数内 0x31D 解析+0x447891 直建共享对象，out-slot [ebp−0x1C]@0x4B3764 / [ebp−0x14]@0x4B3824；t088.1：本表 T088 版本误保留 10/2 旧数，已按 C1 裁定统一为 12/0） |
| RECEIVER-OTHER | 0 | 该类别经 C-106 单例闭包 + reviewer C1 字节复核后取消（原 0x4B3BC5/0x4B3DAD 两行并入上行） |
| INCONCLUSIVE | 25 | 接收者/参数已机器解码但包含函数体未全读本轮（接收者世系未逐一证明） |

39/39 站点为默认 V{VT_ERROR,missing}（扫描锚点：`push 0xBE7330`/`mov r32,0xBE7330`/`call 0x40318F`；fieldctx ctor 的 V3 在 0x9EC57B 清空后于 0x9EC5C3-0x9EC5D2 重模板化）
（VT_ERROR/missing）；两个 CONFIRMED-CAMERA-WRITER 均为默认参。**语义分层（t088.1 注记）**：
"39/39 默认 VARIANT" 只声明第 3/4 参的构造类；Shape2D Set 的立即性由 C-108 被调体证明；
接收者=共享对象由 C-106 证明；而 25 个 INCONCLUSIVE 的**包含函数业务语义未闭合**——
默认参不自动升级其分类。T088 版本 EV-93/Readiness 残留的「33 默认 + 2 清空槽 VT_EMPTY」
「35/39 立即类」分桶已被 reviewer C4 与 t088.1 全量撤销（39/39 统一默认类）。

## 3. WP2 — 触发链（细节见 forensics/T088-FIELD-9E6CA4-CFG.txt 与 T088-PACKED-COORD-WRITER-CALLGRAPH.txt）

### 3.1 写入者 #6（0x9E6D18）— 窗口枚举回调（光标模式）

回调 0x9E6CA4 由独立的注册函数 0x9E6BAD 注册（`[0xBE1554](0x9E6CA4, ctx)`；reviewer C5：0x9E649A 止于 0x9E6BAA，由回调在 0x9E6E10 调用）。路径谓词（五重合取）：
hwnd ≠ [[0xBDD89C]+4]（键盘焦点）∧ IsWindow ∧ GetClientRect 型取矩形成功 ∧
矩形非空（IsRectEmpty 型）∧ **PtInRect(矩形, 记录点)** →
`0x5CA91A(单例, [ebx+0x38], [ebx+0x3C])`。记录点由
`0x5CABE1([0xBDD838], &记录)` ——**屏幕光标衍生的客户区坐标基础读取**（reviewer C6）——在注册时播种。
呈现路径另有等值重绘门（两坐标都未变才跳过）——是相等门而非 deadzone。

### 3.2 写入者 #7（0x9F1ADF）— 窗口过程鼠标带（光标模式）

窗口过程 0x9F1784（内部消息再分发族）：键盘带 0x100/101/104/105、
WM_CHAR 0x102、0x10D/0x10E、鼠标带 **0x200..0x206 与 0x20A** →
0x9F1AC8：门 `[singleton+0xC]==0`（活动输入设备槽为空）→
`y=lParam>>16; x=(word)lParam`（Win32 打包客户区鼠标点，无符号字，无额外
符号扩展）→ `0x5CA91A(单例, x, y)`。**每个鼠标消息**触发一次。

### 3.3 焦点写入者 0x93CB27（直接家族；跟随候选）

门：记录存在 ∧ [this+0x3B8]==0 ∧ 载荷计数≠0 ∧ 记录标签∈{0x4F5C6A,0xD7511E}
（未知标签走 0x4B1C27(this,&arg3) 填充并跳过写入）。已知标签路径：
0x31D 解析 + 0x447891 直建共享对象 → Set(X(src), Y(src))，默认 VARIANT；
src=[[this+0xF28]+0x14]（AddRef getter 0x93CD77；X=[vt+0x20]、Y=[vt+0x28]）。
**本站点不经过漏斗，无 −(400,300) 偏移**。10 个 E8 调用者统一惯用法
`0x769B51([0xBD8FEC], 字符串id, N∈{500,800,1000}, 0)`——脚本记录驱动的
事件焦点（传送触发族/包生成族在到达处理栈内同步调用）。
src 是化身容器类的**私有**位置对象（80 个解析点中不存在 +0x14 附加 →
非共享别名）；其写入者普查是焦点几何语义的剩余半边。

## 4. WP3 — 节奏与 deadzone（forensics/T088-CAMERA-CADENCE-DEADZONE.md）

十问矩阵摘要：无每 Tick 写入者（已解码集合）；无水平/垂直 deadzone、无朝向
相关门、无速度平滑（已解码门）；Shape2D 插值引擎存在但相机从不武装
（默认参=立即，被调体证明）；无一帧延迟结构；Portal 到达栈内同步焦点写
（候选）；无相机锁（最近的是设备槽模式门）；相机侧地图 clamp 无
（消费侧等价成立）。

**错误避免**（按任务书）：`camera := point−(400,300)` 是几何公式；
本轮回到底证明了它是立即写；deadzone 负结论覆盖「漏斗+回调+窗口过程+
焦点写入者+Shape2D Set 本体」全部已解码体，且明确不外推到 25 个
INCONCLUSIVE 站点与 [F28+0x14] 写入者。

## 5. WP4 — 边界、Scene、Portal（forensics/T088-CAMERA-BOUNDS-SCENE-PORTAL.md）

- **相机侧 clamp 负结论**（有界）：已解码写入者无地图边界比较；[0,800]×[0,600]
  夹取仅存在于光标包装 0x5CB0E0（屏幕界）。世界界经 slot15 裁剪窗（消费侧）
  与 VR fold（加载侧）进入渲染。等价性：裁剪窗随相机 X0/Y0 平移与
  screen=world−camera 的平移一致——超界相机裁掉的同为屏外 tile（已解码
  路径上的静态证明）。
- **[scene+0x1CC]**：+0x1CC 全带探针普查（mov/lea 31 处、直接写 **10** 处——t088.1 勘误：T088
  版探针存在 VA/文件偏移混比与 "0x1cc" 子串误匹配缺陷，漏掉字段拷贝写入者 0x952ECE
  （`mov [ebx+0x1CC],eax`，+0x1C8..+0x1DC 对拷环）；指令边界核验口径：21 lea + 10 写 mov
  （读排除）=31，T088 版取证文件的 30 为漏计）；10 个写者所在 census 函数窗内均无
  slot15 家族虚表 imm32 安装（**有界负成立**，t088.1 扫描器以基础表 4 个安装点
  0x52F1BC/0x52F1CF/0xA0B39E/0xA0BB2A 为阳性对照后复验）；reviewer C7：基础家族表
  0xB01278 实有安装点（含 thunk 0x52F1BC 安装后尾跳 0x52F37F、0x52F1CF/0xA0BB2A 安装后
  call 0x52F37F、另有 0x52EEF1/0x8DC052 寄存器装载+栈别名间接安装）——
  T088 草稿"33 张家族表无 imm32 代码引用"撤回（t088.1 核验：其余 32 张派生表在代码带
  **零字节出现**）；派生表与场景 +0x1CC 成员安装者保持 UNLOCATED
  （0x52429B/0xB002C0 属另一类族的既有结论不变）。
- **Portal→相机时序**：E1 同步（到达处理栈内的焦点写，位置写之后、
  程序序在前）；E2/E3 消息驱动（与 Tick 相位交错静态不可判定，
  产品契约范围）；slot12/14 只读相机（相位分离保证 E1 的写先于绘）。

## 6. 台账动作

- 新增 Claim：C-106（共享单例闭包，CLOSED-STATIC A）、C-107（#6/#7 触发
  定标，CLOSED-STATIC A）、C-108（Set 语义，CLOSED-STATIC A）、C-109
  （焦点写入者家族，PARTIAL-STATIC B）。
- 修订：C-103（写入者集合读法勘误注记 + EV-93/94 引用）、C-028（节奏
  有界结论 + EV-94/95/96 引用）。
- 新增 Evidence：EV-93..EV-97（T086.1 规范 LF 哈希；伴随文件哈希在
  interpretation 内）。
- Gaps：G10 verified/unresolved/next_action 重写；状态维持 PARTIAL-STATIC。
- 矩阵：P2-01→PRODUCT-READY；P2-05/P2-06/P4-07 按 §WP0 重写。
- 数量：Claim/Evidence/Gap = **109 / 97 / 41**。

## 7. 独立 Review（Sub-Agent）

见 forensics/T088-REVIEWER-INDEPENDENT.md（独立只读子代理、独立临时目录、
盲审优先；二进制哈希独立核验；R0–R6）。裁决与差异闭环记录于该文件尾部。

## 8. 质量门禁

| 门禁 | 结果 | 日志 |
|---|---|---|
| Validator | PASS（0 errors / 0 warnings） | forensics/T088-VALIDATOR-LOG.txt |
| Unit tests | 全部通过（85 既有 + 本轮新增，总数见日志） | forensics/T088-UNITTEST-LOG.txt |
| Clean-room 再生 | 与 canonical 一致（claims=109 gaps=41 evidence=97） | forensics/T088-CLEANROOM-LOG.txt |

## 9. 边界声明

- 仅修改 `research/`；Frozen ABI pin 校验通过；LoomRealm、content/、原始
  二进制零改动。
- 全程 STATIC-ONLY：未启动客户端、无调试/内存采样/网络捕获。
- 负结论（deadzone/每 Tick/clamp/0x1CC 安装者）均标注扫描边界；不因取证
  数量外推。焦点写入者语义、25 个 INCONCLUSIVE 站点、跨图输入抑制为
  G10/P4-07 剩余项。
- 项目维持 **NOT STAGE-READY**。
