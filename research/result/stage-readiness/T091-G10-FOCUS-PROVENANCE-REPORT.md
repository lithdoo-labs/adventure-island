# T091 — G10 Camera Focus Object — Decisive Provenance Closure — 主报告

**Round**: t091 (2026-11-16). Branch `design/adventure-field-map-scene`.
**起点**: `3d9dfd5056d5d4693fcad4508650fcdf28b5f2cd`（远程 HEAD 核验一致，工作树干净）。
**方法**: 全轮 STATIC-ONLY；EXE/Shape2D/Gr2D/PCOM 四样本 SHA-256 全部复验
（PCOM 实际哈希 `cf3807f3107152d3b305bfc84be36d58b62306c94f60133c8e80fd17f9d9e54b`
与 T090 审查记录一致；任务书内 PCOM 串含 1 个多余字符 `1`，为任务书笔误——已按 T090 归档哈希核验）。
所有新结论以 CMS079 原始字节证明，可由 `t091_*.py` 复现。

---

## 0. 核心目标裁决（先行）

**T091 OBJECTIVE: `OBJECTIVE-SUCCESS`（含 2 项诚实残项，见 §3；独立 Reviewer Phase-3 同裁
OBJECTIVE-SUCCESS——项 4 PARTIAL 非阻断：初始坐标写入源已端到端证明，
仅持续目标刷新的分发站点未定位；Reviewer 的 3 项阻断修正 D1/D2/D3 已全部落地）**

**是否证明 `[[arg3]+0x14]` 的真实对象来源和写入链？——是。**

`0x93CB27` 的 arg3 是 **W——一个 0x48 字节的"相机焦点包装器"对象**
（分配 `0x94B8F7`、ctor `0x94B92D`、最终 vtable `[W]=0xB0BC40 / [W+4]=0xB0BC64`、
初始化 ctor `0x5BFE8C`）；`[[arg3]+0x14]` = `[W+0x14]` = 对一个**新建 0x240 字节
基础移动对象 P**（工厂 `0x9C2911`、ctor `0x9C28BF`、vtable `0xB0C660/0xB0C5B0`）
做 **QI(IID 0xBA0500)** 得到的 IVector2D 视图；其 X/Y getter 返回**加密槽对的外推位置**，
初值来自**服务器包 opcode 0xCE**（X±1、Y−20、按地图边界钳制），
getter 结果经 `0x93CC9B` 写入共享相机——端到端闭合。

### 裁决明细（每项 PROVEN/PARTIAL/UNKNOWN + 证据）

| 目标项 | 裁决 | 决定性证据（VA） |
|---|---|---|
| `0x5C0342` arg3 对象身份 | **PROVEN = W** | `0x5C0327-0x5C0342`：W-成员方法 `0x5C0327`（W 的直接调用成员方法——全镜像独占直接调用者 `0x5C0430`（ecx=ebx=W）；W vtable 0xB0BC40 slot+8 处是空 `ret 4` 桩 0x5C0324，非 thunk〔reviewer D1 修正〕），`esi=ecx=this=W`；`0x769B51([0xBD8FEC],[W+0x44])`→record；`0x93CB27(this=[W+0x10], record, 0x320, W)` |
| `0x959493` arg3 对象身份 | **PROVEN = W（仅经 0x5C031A）** | `0x959482: push [ebp+0x20]` = 0x9573A6 的 arg7；14 个 E8 caller 中**只有 0x5C031A 传非零 arg7**（`0x5C0311 push esi`，esi=W，this of W-方法 0x5C02CB，由 `0x5C0429 mov ecx,ebx; call 0x5C02CB` 以同一 W 调入） |
| 两站点是否同一对象 | **PROVEN 同一** | `0x5C0425-0x5C0430`：同一 `ebx=W` 上按 `[user-vt+0xC]` 结果二选一调用 `0x5C02CB`/`0x5C0327`——同一实例的两条相邻分支 |
| `0x9573A6` 14 caller 分类 | **PROVEN 13 NULL + 1 OBJECT** | 每个 caller 的第 7 个栈参（最先 push）支配性证明：0x95282D(esi=0@0x95281A)、0x955126/0x955149(ebx=0@0x954F1E)、0x968705(ebx=0@0x9686F7)、0x968798(eax=0@0x968787)、0x976409(eax=0@0x9763FC；ebx 是 arg1=记录对象非 arg7)、0x9767ba/0x9768db(esi=0@0x97672F)、0x976a3a(eax=0@0x976A2F)、0x977b8e(edi=0@0x977B5E)、0x977ba7(eax=0@0x977B9C)、0x97a449(edi=0@0x97A3AE)、0x97a559(edi=0@0x97A4E9) |
| `+0x14` 成员类型 | **PROVEN** | `0x5C1A08-0x5C1A2A`：对 P+0xC 接口（vtable 0xB0C5B0）QI IID **0xBA0500**（=Shape2D Vector2D 接口 ID，C-106）；QI 体 `0x9C0EC0` 接受 {0xB0E760,0xBD37B0,0xBA0378,0xBA0500} 全部自返回 |
| 构造与安装链 | **PROVEN（初始写入）** | opcode 0xCE（分发带 0xBC..0xCE@0x97FAC9，臂 0x97FB7A→`0x99142A` 4×0x4066FF 解码）→ user-vt+0x7C `0x948DE7`（枚举 [user+0x1C24]、经 [user+0xEC8]vt+0xD4=`0x4423C0` 取共享相机）→ W ctor `0x5BFE8C`（P 工厂、`0x9BC602(P,W)` 置 owner、`0x9BC622` 写加密基槽、QI 入 W+0x14、渲染器 [0xBE2788] 挂接、`0x5C0084` 收尾）；场景侧安装 `0x5EBAB1`(vtable 0xB02FB8 slot+0x20)→`0x5D5377` 写 user+0x1C24..+0x1C30 |
| 坐标写入者（初始） | **PROVEN = 服务器包 opcode 0xCE** | X=v1、Y=v2、string-id=v4；写入为 (X±1, Y−0x14)（0x5BFEEA-0x5BFF04），地图边界钳制（[P+0x138..0x140]←[[0xBDD498]+0x24]@0x9BC60B-0x9BC61C），目标槽 ctor 镜像（rep movsd@0x9BC749） |
| 坐标写入者（持续） | **PARTIAL** | Set 入口 = vtable 0xB0C5B0 slot+0x90(0x9C16DD)→slot+0x40(0x9C1113) 写目标槽 P+0x80/P+0x98；**零直接 E8 caller**，分发站点未字节定位（残项 R-T091-2）；外推读侧闭合 |
| getter→Set 链 | **PROVEN** | `0x93CD77([ecx+0x14])`→X `0x404B07`=[P-vt+0x20]=`0x9C0FEF`、Y `0x404B2E`=[P-vt+0x28]=`0x9C105F`→均转发 slot+0x8C=`0x9C1499`→[P+0x1C] 委托仅 ctor 清零（无其他写入者）→外推路径 0x9C1529-0x9C15E6→`0x93CC9B` Set 共享相机 |
| 坐标空间/偏移语义 | **PROVEN** | 世界/地图像素坐标；安装偏移 Y−20、X±1 抖动；读出 `X = round(dec(P+0x20) + (dec(P+0x80)−dec(P+0x20))·k)`，k=elapsed·1/30（[0xB0C5A8]=0.0333…），round ±0.5（[0xAFEC20]/[0xB00D60]）；解密 `0x548806`/加密 `0x6131F4` 与移动物理同一槽对机制（x@+0x20/y@+0x38/vx@+0x50/vy@+0x68，findings §4.3） |
| 与 `[user+0xF28]` 关系 | **PROVEN = DISTINCT-DATAFLOW** | W 安装于 user+0x1C30 组（0x5D5377），F28 是不相交成员 user+0xF28；Set 路径永不读 F28；未知 tag 填充路径 `0x4B1C27` 把 arg3 替换为 [user+0xF28] 并**跳过 Set**；W 在任何已解码路径中不流入 F28（0x949B46 经 0x44484B **读** F28、0x934B9E 经 0x4063B5 **释放**——13 个 lea 站点中 2 个已分类，11 个维持 T090 边界） |
| 独立 Reviewer | 见 `forensics/T091-REVIEWER-INDEPENDENT.md` | 真实 sub-agent（会话 `ses_e1cc3e339ffeW71CEheCLATUuv`），Phase 1 盲审（固定 3d9dfd50 树）+ Phase 2 对抗（14 问全答）+ Phase 3 裁决：**TECHNICAL-PASS / OBJECTIVE-SUCCESS**（项 4 PARTIAL 非阻断）；3 项阻断修正 D1/D2/D3 已落地（D1 虚表措辞、D2 owner=0xA4F6F1 结果、D3 C-120 限定），D4+建议 2/3 已采纳；修正后门禁重跑全绿 |

## 1. 对象图（压缩版）

```
opcode 0xCE 包 → 0x99142A(4×0x4066FF) → 0x948DE7(user-vt+0x7C)
  → W ctor 0x5BFE8C(string-id, user, cameraV2D, X, Y)
      ├ [W+0x44]=string-id  [W+0x10]=user  [W+0x24/+0x28]=X/Y
      ├ P=0x9C2911(0x240B)  0x9BC602(P,W):[P+0x14]=W, 地图边界→P+0x138
      ├ 0x9BC622(P,1,X±1,Y−20,0,0,3,owner=0xA4F6F1 结果): 加密槽 x@P+0x20/y@P+0x38/vx@P+0x50/vy@P+0x68 + 镜像→P+0x80
      └ 0x5C1A08: QI(P+0xC, 0xBA0500) → [W+0x14]
场景安装 0x5EBAB1 → 0x5D5377 → [user+0x1C30]=X(智能指针包装), [X+4]=W
消费 0x93839F → 0x5C0349(W): 刷新 [W+0x24/0x28]←[[W+0x14]+0x8C];
  门 [P+0x238]≠0; 按 user-vt+0xC 分支 → 0x5C02CB/0x5C0327（W 的两个直接调用成员方法，非 vtable 派发〔reviewer D1〕）
  → 0x93CB27(user, record, 0x320, W)
  → tag∈{0x4F5C6A,0xD7511E} → 0x93CD77:[W+0x14] → 外推 X/Y → 0x93CC9B 相机 Set
```

完整版 + 逐指令字节列：`forensics/T091-FOCUS-CHAIN-DISASM.txt`（30 段窗口）；
写入者矩阵：`forensics/T091-ARG3-MEMBER14-WRITERS.csv`（每条含接收者验证）。

## 2. WP0 勘误（独立小节，非本轮主成果）

- **WP0-A (C-106)**：主句改为 80 候选 = 76 真实创建（共享单例）+ 4 非创建调用；
  t088.1 reviewer 的 76/4 字节证明升为规范表述，历史与验证证据保留。
- **WP0-B (C-108)**：补入 C-116 限定——默认 VARIANT 永不武装 VT_I4 插值（原证明保留）；
  wrapper 未武装时立即写原始 X/Y；已武装时同一立即 Set 路径经 `0x51407A34` 增量存储；
  getter 在 wrapper 存在时返回滤波坐标。`END-TO-END` 措辞限定于 UNARMED 态。
- **WP0-C (G10 next_action)**：移除已完成的 `trace filtered-coordinate consumers`
  （C-116 已闭），替换为真实残项（Set 分发站点 / [P+0x238] 武装 / wrapper 生命周期 /
  E2E3 相位 / 18 个 receiver / slot15 链）。
- **WP0-D (T090 归档核验)**：`3d9dfd50` 下 R1a（timeline "44 distinct [t090 phase-4 R1a]"）与
  R1b（EV-104 timeline sha `9290a45f69af1f85` = 归档文件重算哈希，逐一验证通过）均已落地；
  reviewer Phase-2..4 已归档于 T090-REVIEWER-INDEPENDENT.md（161 行）。无需补充复验。

## 3. 诚实残项（不阻断目标验收的边界）

1. **R-T091-1**：`[P+0x238]` 是 `0x5C0349` 的门（≠0 才执行焦点调用）；基类 ctor 清零；
   +0x238 写入者族（0x9C3DAD：owner 安装 + 双写；派生表 forwarder）已解码，
   但**基类实例上的武装分发站点未字节定位**。
2. **R-T091-2**：P 目标槽（P+0x80 族）的持续 Set 驱动——初始写入已证（W ctor→0x9BC622），
   Set 入口（slot+0x90→slot+0x40=0x9C1113）与其数学已解码，但带内零直接 E8 caller，
   `call [reg+0x90]` 全局普查按任务书自身的"同偏移不同类"警告不可接收者过滤——分发站点未定位。
   **初始坐标→相机 Set 的端到端链不受此残项影响**（ctor 镜像使 base==target，
   相机在首个 Set 落地前保持包坐标点）。
3. **R-T091-3**：F28 的 13 个 lea 站点维持 T090 边界（本轮新分类 2 个：读/释放）。
4. **R-T091-4**：Eye 链——[obj9C+0x68]（=W 包装 X）的写入者未定位（Eye 本体经
   0x472D53/0x4D6268 安装到 handler+0x9C，该对象自身未完全解码）。

以上均为**已定义边界的收尾项**，不是对象身份或数据流断链；
第 9 项验收（F28 裁定）以 DISTINCT-DATAFLOW-PROVEN + 残项注记完成。

## 4. Gap 状态

| 项 | 值 |
|---|---|
| 研究前 CLOSED | 26 |
| 研究后 CLOSED | **26**（G10 维持 PARTIAL-STATIC——本轮闭合其核心对象链残项，但 G10 整体仍含 E2E3 相位/wrapper 生命周期/18 receiver/slot15 链） |
| G10 状态 | PARTIAL-STATIC（verified_scope 增补 C-120；next_action 重写） |
| 剩余 Gap | 41（无状态迁移，零强行关闭） |
| 真正新增关闭 | 0 个 Gap；1 条新 Claim（C-120）+1 条新 Evidence（EV-108） |
| 仍阻碍产品实施 | G10：E2/E3 泵相位（静态不可证）+ wrapper 持续性；G36/G37/G39 各自残项不变 |

**本轮唯一目标 vs G10 整体**：唯一目标（arg3 对象来源与写入链）**完成**；
G10 整体**不关闭**——两者按任务书分别报告，不混淆。

## 5. 质量门禁（真实命令输出见 §H 日志）

- `python research/scripts/generate_cleanroom_deliverables.py` → clean-room 三表同步（120/41/108）。
- `python research/scripts/validate_reverse_engineering.py` → **PASS 0 errors / 0 warnings**。
- `python -m unittest discover -s research/tests -q` → 215 基线 + **T091 新增 41** = **256/256 OK**。
- 原始样本四件哈希核验一致；仅 `research/` 变更；Frozen ABI / content / LoomRealm 未动。

## 6. 交付物清单

主报告（本文件）；`T091-OBJECTIVE-GATE.csv`（目标验收表）；
forensics：`T091-FOCUS-CHAIN-DISASM.txt`（30 段字节锚定窗口）、
`T091-ARG3-CALLER-IDENTITY.csv`（10+14 caller 全表）、
`T091-ARG3-MEMBER14-WRITERS.csv`（20 行写入者矩阵）、
`T091-FOCUS-OBJECT-PROVENANCE.md`（对象链）、
`T091-REVIEWER-INDEPENDENT.md`（独立审查）。
脚本：`t091_lib.py`、`t091_dump_chain.py`、`t091_wp1b_9573a6_callers.py`、
`t091_wp1b_reg_origin.py`、`t091_update_ledgers.py`、`t091_member_census.py`、
`t091_write_census.py`、`t091_ghidra.py`（辅助）。测试：`test_t091_round.py`（41 项）。

## 7. 下一轮（T092）建议

1. **G10 收尾（有决定性静态入口）**：定位 P 的 Set 分发站点（`call [reg+0x90]/[reg+0x40]`
   且接收者可证 = [W+0x14]——入口：0x9573A6 状态机的 0x95749E 后续分支、或
   [P+0x238] 武装点 0x9C3DAD 的 vtable 归属表）；Eye 写入者（0x4D6268 家族）。
   这是焦点位置写入路径的最后两条未闭合边。
2. wrapper 生命周期（记录退役/场景切换）与 E2/E3 相位——若无新静态入口，
   按设计边界移交产品侧。
3. 其余 Gap 不动。

## H. 质量日志（真实输出摘要）

```
$ python research/scripts/generate_cleanroom_deliverables.py
gap stats block regenerated: {'CLOSED-STATIC': 26, 'PARTIAL-STATIC': 8, 'OPEN-STATIC': 6, 'SUPERSEDED': 1} total=41
clean-room deliverables written to research/result/clean-room/ (claims=120 gaps=41 evidence=108 retracted=11)

$ python research/scripts/validate_reverse_engineering.py
Claims: 120 | Gaps: 41 | Evidence: 108
ERRORS: 0 / WARNINGS: 0 / RESULT: PASS

$ python -m unittest discover -s research/tests -q
Ran 256 tests in ...s / OK
```

（提交前由 `t091_quality_gates.py` 落盘完整输出至
`forensics/T091-QUALITY-GATES.txt`。）
