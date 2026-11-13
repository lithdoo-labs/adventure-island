# INDEPENDENT-AUDIT-REPORT（clean-room 独立审计报告）

分支：`audit/clean-room-reverse-engineering`　基线：`2efdf32c21190441d0804093e6d3bdf493feb503`（= origin/design/adventure-field-map-scene HEAD）
审计日期：2026-11-13。审计者：clean-room 独立接管 Agent（不继承任何前任结论）。

> **方法**：所有关键结论回到原始二进制重新取证——解包 EXE 镜像与 5 个游戏 DLL 直接反汇编/字节读取，
> 不以前任报告为证据源。前任报告仅用于定位"哪些结论需要检验"。
> 复现脚本与命令见 REPRODUCIBILITY-REPORT.md。

---

## A. 审计范围

| 项 | 数量 |
|---|---|
| research/ 下 Markdown | 402（有效 ACTIVE 交付约 60；其余为历史战役日志 task001-062） |
| research/ 下 CSV | 411（本轮全量结构校验 421 处含新增） |
| 结构化 Claim（claims.csv） | 47 |
| 结构化 Gap（gaps.csv） | 35（继承 32 + 新增 G33-G35） |
| 证据条目（evidence.csv） | 32（其中 27 条为本轮独立重取证） |
| 独立重验证指令窗口 | 20+（EXE/DLL 直接 capstone 重放） |

## B. 独立验证成立的关键结论（要点）

以下结论由本轮从二进制重新取证确认（证据 EV-01..EV-31，全部 A 级）：

1. **Tile 键公式** `z + 10*(layer*3000 - zM) - 1073721834`（0x666F5D-68 指令重放）——EV-01
2. **Obj 键公式** `layer*30000 + z - 1073739824`（0x6688C4-D2）——EV-02
3. **[0xBE2788] = Gr2D 托管 COM 接口全局**：IID {E576EA33-…} 仅存在于 Gr2D_DX8.dll（file+0x35120）；创建器 0xa0449b 含 REGDB_E_CLASSNOTREG；初始化链 0xa00e5E 完整——EV-04..08
4. **层虚表 0x5042D140 = 40 槽 + intmap@0x2D1E0 主 IID E576EA33**——EV-09
5. **0x427EB3 = 属性 PUT 包装**（封送 2×16B VARIANT → 调 slot25；slot25 = [arg1+0xCC]=arg2 平凡 setter）——EV-03/11
6. **0x5042D0A0 = MSVCRT!_purecall 未绑定 IAT 项**（hint 0x192 名字表 + 跳转桩字节）——EV-13
7. **slot45@0x50404FB1 = 删除型析构**（vtable 换基 0x2E380 + 条件 delete）——EV-14
8. **22 张候选虚表 slot45 全分类零插入语义**（抽查 0x2E2C4 slot45=0x2A610 purecall、0x2F530 字符串数据均吻合）——EV-15
9. **RTTI COL 不存在**：全部候选虚表 [-4] 值为 0/噪声/代码指针——"RTTI 验证类身份"不可能成立——EV-10
10. **Tile/Obj 通道分离**：Obj 在键计算后走 `mov ecx,esp; mov [ebp+0x30],esp` 栈封装 cdecl（0x43286E/0x44484B/0x429411/0x43E3A6），非 [eax+0xB4]——EV-19
11. **EBX=0 @0x666C20**：0x666F83 `cmp eax,ebx; jge` = HRESULT 检查——EV-17
12. **相机 VR 折叠** ±400/±300 写入 [esi+0xF0..0xFC]（字符串 id 0x557=VRLeft）——EV-21
13. **移动**：vtable 0xB0CB70 m4=0x9BE703；0x9BCCFB 写 move+0x190=[Physics+0xAC] 且返回步进 0x1E——EV-22/23
14. **战斗 RNG 对**：0x416E36（状态 0xBDF028，滚动 xor 0xBAADF00D，写 {rand,key} 对）——EV-27
15. **+0x3BC 写侧**：全编码扫描恰 9 处 `mov [reg+0x3BC],0x1388`——EV-29
16. **WINMM 序号导入** 202/200/11/10（IAT 字节 0x800000CA/…）——EV-30
17. **0x9C0EC0 = 四 IID QI 分派器**（memcmp-16 链）——EV-24

前任 Round-3.1 取证（R31-A/B/C/D/G 日志）与本轮重放**逐字节一致**，该批材料可信。

## C. 发现的错误结论与证据链断点（P0 全部修复）

| # | 错误/缺陷 | 位置 | 处置 |
|---|---|---|---|
| F-01 | "[eax+0xB4]=有序插入，比较器在 DLL 内"仍作为活动结论传播 | REVERSE-ENGINEERING-FINAL-REPORT.md L23 | 撤销并标注（Claim C-013 SUPERSEDED） |
| F-02 | "Tile/Obj 同容器有序插入（稳定）——可直接实现有序列表" | 同上 L38 | 撤销（C-016 SUPERSEDED；通道分离 C-017 成立） |
| F-03 | 身份表"RTTI + ATL 双 VERIFIED" | MAP-R13-STATIC-CLOSURE.md L5-11 | RTTI 半撤销（C-006，无 COL）；结构半维持 A |
| F-04 | "相等键 WZ 顺序保持（稳定插入）VERIFIED（样本）" | 同上 L58/L135 | 撤销（C-018）：仅静态 WZ 条目序，源文档 L85 明言无证明 |
| F-05 | "Obj 键走同一类虚调用" | MAP-TILE-OBJ-SORT-REVERSE.md L10 | 修正（Obj 走栈封装 cdecl） |
| F-06 | "比较器 call [eax+0xB4] 已定位为 COM 回调"（5 处） | 设计稿 §4.3/4.4/4.5/16.2-R13/16.3 | 修正：比较器语义未证，22 候选无比较语义 |
| F-07 | "候选 19 张虚表"过期计数（2 处） | 设计稿 16.2/16.3 | 修正为 22 |
| F-08 | Gap 台账统计 13/4/6/5/1/1=30 与实际 32 项不符且声称"验证器自动核算" | REVERSE-ENGINEERING-GAP-REGISTER.md | 统计改为生成器从 gaps.csv 自动生成（GAP-STATS-AUTO 块） |
| F-09 | R-01/R-02 已静态闭合仍留在"运行时残留 8 项"活动表 | REVERSE-ENGINEERING-RUNTIME-REMAINING.md | 移出（表 7 项，附 G-ID 映射） |
| F-10 | 验收统计过期（325 MD/6 CSV/28 Gap） | FINAL-REVERSE-ENGINEERING-ACCEPTANCE.md §11 | 标记 SUPERSEDED，指向本报告 |
| F-11 | 非法证据等级 `A(joint)` | R13-COM-INTERFACE-RESOLUTION.csv | 改为 A + 文字说明 |
| F-12 | 严格 Schema 声明 PROTOCOL-OPCODE-EVIDENCE.csv 但文件不存在（fail-open） | 旧验证器 | 新验证器：声明即必须存在（CSV-STRICT-MISSING） |
| F-13 | 负面测试直接改写真实仓库文件（非隔离） | 旧 test_validate_reverse_engineering.py | 全部重写为临时目录 fixture + 20 项断言错误码 |
| F-14 | REFUTED 模式漏检中文措辞（"同容器""有序插入"未命中） | 旧验证器 check_refuted_claims | 新模式含中文变体 + RC-18 |
| F-15 | G/R/R4 三套 ID 无正式映射 | 全仓 | issue-crosswalk.csv（35 行全映射） |
| F-16 | M13"跟随/dead zone 均不在本映像"与 §16.2"+0x58/+0x110 在镜像内未精读"自相矛盾 | 设计稿 M13 | 修正表述（0x9C0EC0 已裁定为 QI 分派器非跟随函数） |

**统计**：撤销/降级结论（claims.csv 状态 SUPERSEDED）共 10 条：C-006、C-008、C-010、C-012、C-013、C-015、C-016、C-018、C-021、C-042；
降级 2 条（C-020 起点歧义维持 PARTIAL；C-006 RTTI→C 级邻近）、状态冲突 5 处、数据结构错误 4 处（CSV 宽度/引号）、
验证器缺陷 4 类、测试隔离缺陷 1 类。

## D. 真实缺口（最终状态）

由 gaps.csv 生成：**CLOSED-STATIC 14 / PARTIAL-STATIC 5 / OPEN-STATIC 9 / OPEN-RUNTIME 5 / BLOCKED 1 / SUPERSEDED 1，总 35**。

关键 OPEN 项（全部有边界与下一步）：

| Gap | 问题 | 下一步 | 阻塞实现？ |
|---|---|---|---|
| G01/G07/G33 | 比较器体/相等键策略 | 读 0x43E3A6 族栈封装被调 + Canvas 绘制遍历 | 否（键与通道可实现；排序策略保持可替换） |
| G24/G27 (R-09) | [eax+0xB4] 变体对象具体类 + 参数序 | bp 0x666F77 进图 1-dword 转储 | 否（tile 注册按不透明 COM 调用处理） |
| G08/G09 (R-03) | Avatar 插入键/跨对象排序 | 进图 Avatar 注册捕获 | 否（avatar-vs-obj 用产品规则） |
| G10 (R-04/R4-08) | 相机跟随/deadzone | 进图 [0xBDF54C] 族转储 | 否（相机策略可替换，VR 边界已证） |
| G11/G12 | +0x61 归属；+0x3BC 递减 | 结构归属/运行时采样 | 否（死亡位与 alert 均为行为级实现） |
| G13 (R4-06) | WINMM 序号→名 | 取同期 winmm.dll | 否 |
| G17 (R4-07) | 367 opcode 数值 | 服务器 properties（不在盘） | 否（语义名先行） |
| G22 | 0x2E2C4/0x2E2CC 起点 | 运行时 vptr（可由 R-09 附带） | 否（勿硬编码该族槽号） |
| G34 | 0x5A↔0x1E 关系 | 定点扫描 | 否 |
| G35 | Background 键复验 | 更宽窗口扫描/运行时 | 否（index×1000 B 级维持） |

## E. 结论

1. 前任"Round-3.1 取证"材料与二进制一致，**可信**；但其结论未被当时的主线文档完全吸收，本轮已完成吸收与标注。
2. 证据链现在**单向收敛**：二进制 → evidence.csv → claims.csv → gaps.csv → 各报告视图，统计由生成器产出、验证器校验。
3. 无任何 CLOSED 项依赖被撤销的结论（G06 的"类名"部分已降级为 C 级邻近推断，工程所需的结构/接口证据维持 A）。
4. 本报告状态：**READY_FOR_INDEPENDENT_REVIEW** → 已由只读复核 Agent 复核（见 INDEPENDENT-REVIEW-REPORT.md）。
