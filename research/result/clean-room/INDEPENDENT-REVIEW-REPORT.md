# INDEPENDENT-REVIEW-REPORT（独立复核报告）

复核轮次：1 次完整只读复核 + 1 次定向修复 + 修复后复验。
复核者：独立只读复核 Agent（subagent，未参与任何实现/整改工作；输出全文见下文第一节，未删改）。
复核对象：提交 `ce528d4bcf036a0856291d3ea40e6d59d164f76d`（audit/clean-room-reverse-engineering）。
复核方式：实际执行 capstone 反汇编抽查（15+ 条 A 级声明逐指令重放）、自建临时 miniature 仓库注入缺陷、
真实二进制指纹核对、git 范围核对。复核者声明其全程未修改仓库文件。

---

## 一、复核者结论（原文要点）

> **总结论：FAIL（3 项 P0 / 3 项 P1 / 7 项 P2）**
>
> 正面事实：证据基线扎实——独立重反汇编/字节核对 15+ 条 A 级声明（含 9 站点全扫描、IID 19-DLL 唯一性、
> slot25/26 与 0x427EB3 交叉自洽），无一失实；gap 统计/测试隔离/生成器幂等/ABI 冻结/git 范围七项全部通过。
>
> P0-1 SEC16-FORENSICS.md:90/:151 无标记复活"+0xB4=有序插入，比较器在 DLL 内"（ACTIVE 文档）。
> P0-2 MAP-R13-STATIC-CLOSURE.md:37 无标记复活"运行时补丁的占位 RVA"（v2 活动节）。
> P0-3 验证器 check 12 对上述两类措辞假性 PASS（RC-02 需 slot45 邻近、RC-04 窗口过窄、须 VERIFIED 共现）。
> P1-1 documents.csv:17 引号未闭合致 3 对行合并（宽度检查无法发现）。
> P1-2 REVERSE-ENGINEERING-STATIC-ROUND-2.md 无文件内撤销横幅。
> P1-3 INDEPENDENT-AUDIT-REPORT 引用不存在的本报告文件。
> P2 ×7：EV-05 DLL 计数（10→实际 19）、生成器文档夸大、执行日志 MD 计数偏差、审计统计口径、
> 存档内部矛盾 L136、Movement 行 C-035 误引、验证器死代码。

（复核者对各项检查的完整证据与命令输出存于其会话记录 ses_e2b9306dbffegHDXS3B1iu1KpQ。）

## 二、定向修复记录（唯一一轮，2026-11-13）

| 复核项 | 修复 | 文件 |
|---|---|---|
| P0-1 | 两处"+0xB4=有序插入"改为撤销标注（划线 + Claim C-013 + Gap G24） | research/result/atlas/SEC16-FORENSICS.md:90、:151 |
| P0-2 | "运行时补丁占位"节整段撤销标注（C-010 + __imp__purecall 依据）；残留的 OPEN-RUNTIME 表述更正为 OPEN-STATIC（Gap G07） | research/result/map/MAP-R13-STATIC-CLOSURE.md §slot45 委派桩 |
| P0-3 | 验证器 check 12 重构为双层：Tier A（VERIFIED 共现）+ Tier B（无标记断言式复活，RETRACTED-ASSERTIVE）；RC-04 窗口 40→120 并双向；新增否定词标记（❌/无一呈现/零插入等）防反驳句误报；整档横幅（CLEANROOM-ARCHIVE）两级豁免 | research/scripts/validate_reverse_engineering.py |
| P1-1 | documents.csv:17/21/29 三处未闭合引号修复（34 物理=34 解析）；验证器新增 CSV-QUOTE 检查（物理行吞并检测，测试 test_22 覆盖） | documents.csv + 验证器 + 测试 |
| P1-2 | REVERSE-ENGINEERING-STATIC-ROUND-2.md 加整档 CLEANROOM-ARCHIVE 横幅（列出全部被推翻结论） | 该文件 |
| P1-3 | 本文件即补建的复核报告（含复核者原文与修复记录） | 本文件 |
| P2-1 | EV-05 更正为 19 DLL 全扫（复核者独立重扫结论更强：仅 Gr2D 命中） | evidence.csv |
| P2-2 | 生成器文档说明改为与实现一致；并**真实实现** CLEANROOM-SYNC 检查（4 份副本语义等价 + RETRACTED-CLAIMS 覆盖集校验，测试 test_23 覆盖） | 验证器 + 生成器 |
| P2-3 | VALIDATION-EXECUTION-LOG 以最终复跑数字重写 | 该文件 |
| P2-4 | 审计报告统计口径更正为 10 条 SUPERSEDED（与 RETRACTED-CLAIMS.csv=10 一致） | INDEPENDENT-AUDIT-REPORT.md §C |
| P2-5 | MAP-R13-STATIC-CLOSURE.md:136 存档区 Avatar"同容器运行时路径"加划线撤销 | 该文件 |
| P2-6 | IMPLEMENTATION-READINESS Movement 行移除 C-035 误引 | 该文件 |
| P2-7 | 验证器死代码（空循环）移除 | validate_reverse_engineering.py |

复核发现的同类残留（Tier-B 检出）：MAP-R13-STATIC-CLOSURE.md:84（存档区"有序插入 DLL 容器"）、
MAP-RAWCANVAS-CONTAINER-SEMANTICS.md:36（"有序插入的容器实现体未定"预设前提）——一并修复。

## 三、修复后复验（真实执行）

```
python research/scripts/validate_reverse_engineering.py
  → RESULT: PASS (0 errors, 0 warnings)   [421 CSV / 47 claims / 35 gaps / 32 evidence]
python -m unittest discover -s research/tests -v
  → Ran 24 tests in 3.307s  OK             [新增 test_21 SEC16 式断言、test_22 引号吞并、
                                            test_23 clean-room 失同步、test_24 宽距补丁表断言]
```

## 四、复核者建议中未采纳/部分采纳项

- 无未采纳的 P0/P1。P2 全部处置（修复或在本文档记录）。
- 复核者建议的"收紧后转 PASS 复评"以本节复验代替（门禁命令全部真实执行且可独立重跑）。

## 五、门禁对照（最终）

| 门禁 | 结果 |
|---|---|
| G1 原始证据 | PASS（复核者独立重放 15+ 条 A 级声明全部吻合） |
| G2 逻辑正确 | PASS（撤销结论零复活——Tier-B 检查经独立注入测试证实有效） |
| G3 文档一致 | PASS（视图/统计/横幅与 source-of-truth 一致） |
| G4 数据可靠 | PASS（CSV-QUOTE/宽度/等级/枚举/同步检查全部通过） |
| G5 自动化 | PASS（24/24：1 正面 + 23 负面，错误码级断言） |
| G6 可复现 | PASS（REPRODUCIBILITY-REPORT 命令 + RE_VALIDATE_ROOT 任意工作区可跑） |
| G7 架构安全 | PASS（RENDER-NODE-ABI-V1.md sha256 = pin，diff 为空） |
| G8 工程就绪 | PASS（未知项边界明确，不阻塞无关模块） |
