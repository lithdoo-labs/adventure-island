# 最终逆向工程验收报告（FINAL-REVERSE-ENGINEERING-ACCEPTANCE）

日期: 2026-11-13。最终验收轮。

> **SUPERSEDED（2026-11-13 clean-room 审计）**：本报告的"验收"角色已被 `research/result/clean-room/INDEPENDENT-AUDIT-REPORT.md` 取代。
> 原因：(1) §11 校验统计为人工填写且过期（325 MD / 6 CSV / 28 Gap 与实际 402+ MD / 411 CSV / 35 Gap 不符）；(2) 本报告完成时 REVERSE-ENGINEERING-FINAL-REPORT.md 仍传播已推翻的"同容器有序插入"结论。
> 本文件保留为历史记录；权威状态见 `research/source-of-truth/`。

## 1. 项目总体结论

CMS079 客户端静态逆向已达到**可实现级文档密度**。核心系统（协议/密码学/服务器/物理公式/战斗变体/音频管线/COM 架构/排序键空间）全部达到 A 级或 B 级静态闭合。**地图场景（loom-realm）可以开始实现**，键公式和通道分离已冻结，容器内部实现允许替换。

## 2. Round 3.1 结果

- 审计复核 13 条声明：7 维持 A 级 / 5 推翻或降级 / 1 新发现（WINMM 静态导入）
- 关键修正：(1) "RTTI 验证类身份"降级为 C（无 COL）；(2) [BE2788] ≠ Shape2D#Vector2D；(3) 0x427EB3 ≠ 创建器 = 属性 PUT；(4) slot45@0x2E2CC = 析构非插入

## 3. Round 4 结果

- slot45 22/22 全分类（零插入语义）
- **Tile/Obj 通道分离**（A 级）：共用容器假设推翻
- 9 模块报告 + 3 CSV（覆盖/缺口/证据）
- 6 新静态闭合 / 5 静态开放 / 2 运行时开放 / 1 阻塞

## 4. 关键发现

| 发现 | 等级 |
|---|---|
| [0xBE2788] = CWzGr2DLayer（Gr2D 接口，IID E576EA33）| A |
| 0x427EB3 = 属性 PUT 包装（层 +0xCC 注册，240 站点）| A |
| slot45 在全部 21 真虚表中无一插入语义 | A |
| Tile/Obj 使用不同分派通道（vtable vs 栈封装）| A |
| VT_UNKNOWN(0xD) VARIANT 打包器（0x411FE1）| A |
| WINMM waveOut 静态导入（Gr2D IAT 4 序号）| A |
| 排序键公式（tile/obj 独立验证）| A |
| ATL 技术栈（MFC+ATL+STL+boost）| A |
| RTTI 32 类名（名字存在，类绑定 = 邻近推断 C）| C |

## 5. 被推翻的旧结论

| 旧结论 | 推翻轮 | 修正 |
|---|---|---|
| [0xBE2788] = Shape2D#Vector2D | R3 | = CWzGr2DLayer（Gr2D）|
| 0x427EB3 = CreateRawCanvas | R3.1 | = 属性 PUT 包装 |
| RTTI 验证 CWzRawCanvas 类身份 | R3.1 | 无 COL 链，邻近推断 C 级 |
| slot45 = 有序插入 | R3.1/R4 | 全部 22 候选无插入语义 |
| Tile/Obj 共用容器 | R4 | 不同通道（栈封装 vs vtable）|
| Gr2D vtable 0x2F530 = 120 槽虚表 | R4 | 字符串表（伪虚表）|
| SEC16 0x9C0EC0 = +0x58 写者 | R3.1 | = 四 IID QI 分派器 |
| SEC16 0x9BC401 = +0x110 写者 | R3.1 | = 位置/状态序列化器 |

## 6. 可以冻结的接口

| 接口 | 依据 |
|---|---|
| **排序键公式**（tile + obj）| A 级独立指令证明 |
| **键空间设计**（层×30000 系数 + −1073739xxx 基线）| A 级同构证明 |
| **Tile/Obj 独立注册** | R4 A 级通道分离 |
| **Background 独立队列** | B 级旧档 + R4 无反驳证据 |
| **Avatar 部件层序（zmap.img 149 层）** | A 级 |
| **协议格式/加密/触发** | A 级全谱 |
| **COM 属性绑定层**（put/get 同构族）| A 级 |
| **移动加密对** + RNG + 物理 | A 级三重证明 |
| **战斗变体选择** | A 级全链 |
| **音频管线三段** | A 级 |

## 7. 不应冻结的接口

| 接口 | 原因 |
|---|---|
| 容器内部实现 | 比较器未定位；通道分离但内部未读 |
| Avatar 跨对象排序 | 需运行时注册路径 |
| Camera 跟随参数 | 需运行时观察 |
| +0x3BC 递减机制 | 静态未定位 |
| 服务器 opcode 数值 | properties 文件不在盘 |

## 8. 运行时残留（2 项）

| ID | 内容 | 最小捕获 |
|---|---|---|
| R-09 | [eax+0xB4] 对象虚表 + 参数序 | bp 0x666F77; dump ESI/[ESI]/[EBP-0x10]/48B |
| R-04 | Camera 跟随参数 | in-map [0xBDF54C] dump |

前置条件：VM Win7 激活修复（C004F009 → WinRE rearm）。

## 9. 阻塞事项（1 项）

| ID | 内容 | 解锁条件 |
|---|---|---|
| R4-07 | 367 opcode 数值 | 服务器 properties 文件（不在磁盘）|

## 10. 交付文件清单

| 类别 | 文件 |
|---|---|
| 最终验收 | 本文件 + COVERAGE.csv + OPEN-ISSUES.csv |
| 校验脚本 | research/scripts/validate_reverse_engineering.py |
| R13 终版 | MAP-R13-STATIC-CLOSURE(v2) + ROUND3-DISPATCH + DISPATCH-COMPLETE + FINAL-ROUND4 |
| R3.1 审计 | audit/(EVIDENCE-AUDIT + CONTRADICTION-REGISTER + MISSING-EVIDENCE) + atlas/R13-*-FORENSICS×3 |
| R4 模块 | map/ + avatar/ + camera/ + movement/ + combat/ + audio/ + protocol/ + ui/ + DLL-COM-ROUND4 |
| 核心数据 | PROTOCOL-BY-OPCODE(637行) + R13-SLOT45-CANDIDATES(22表) + R13-COM-INTERFACE-RESOLUTION + MOVEMENT-FIELD-WRITERS |
| 旧档 | SEC16-FORENSICS(v3修正) + GAP-REGISTER(v3, G01-G28) + RUNTIME-REMAINING(R-09 FINAL) |

## 11. 测试结果

| 测试 | 结果 |
|---|---|
| validate_reverse_engineering.py | **PASS**（0 错误；4 信息级警告=合法复合 RVA 格式）|
| 校验覆盖 | 325 MD / 6 CSV / 28 Gap ID / 0 重复 / 0 已推翻标 VERIFIED / 0 Runtime 过期 |
| git diff --check | PASS |

## 12. Git 提交记录

| 轮 | SHA | 摘要 |
|---|---|---|
| R2 | ab23b172 | R13 排序缺口闭合 + 全仓缺口台账 |
| R2 补 | 88130b60 | 静态渲染与相机缺口闭合 |
| R3 | dccabf43 | R13 派发解析 + RawCanvas 容器语义 |
| R3.1-A | bd3bd09c | 审计：R13 结论独立复核 |
| R3.1-B | 61f9a1cb | R13 静态完成：派发链 + 类层次 + slot45 全表 |
| R4 | d01e7edd | 大规模模块扫掠：9 模块报告 |
| **最终** | **本提交** | 一致性审计 + 验收 |
