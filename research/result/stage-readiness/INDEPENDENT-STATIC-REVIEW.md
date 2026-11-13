# INDEPENDENT-STATIC-REVIEW — t080 轮独立复核记录

**Reviewer**: CMS079 Independent Static Forensics Reviewer（独立 subagent，独立上下文；自有 capstone+pefile 工具链 `harness.py`+step1–34 脚本，位于会话临时目录；全文归档于本目录 `forensics/REVIEW-CP1-BLIND.md` 与 `forensics/REVIEW-CP2-ADVERSARIAL.md`）。

## 独立性声明（实际执行情况）

- Reviewer 真实启动为独立 subagent 会话；**独立重新哈希**两个原始二进制（EXE `d4a67597…31718` / Gr2D `ad67b9a0…6a25d1`），与权威 Evidence 一致。
- **第一轮（Blind）**：Reviewer 仅凭问题清单 + 二进制 + 权威 CSV + 历史报告独立推导 `0x66A8D5` 全部问题（34 个分步脚本，约 1.5 小时），完成后才接触主 Agent 记录。主 Agent 的盲期推导早已固定于 `forensics/G36-G37-TILING-0x66A8D5.md` 初版。
- **第二轮（Adversarial）**：Reviewer 逐项比对主 Agent 五份记录，对 WP2–WP5 的每个主要主张**先预测再从原始字节重推**（含 FSDB 计数独立复跑、dword 重扫、函数真实范围判定）。

## 双盲一致项（盲审对盲审收敛，零指令级分歧）

3 调用点全集；`ret 0x24` 9 参 thiscall；三调用点参数表；mode bit0/bit1 及各调用点的 mode==0 排除守卫；零步长两族公式；跨度公式（无符号除、divisor=step?step:1、回退后仍乘原 step 故 span=0）；+0x98 三组实参；20000/|rate|（cdq+idiv）与 slot58 相加；0x43715C=vt+0x58 槽读取。

## Reviewer 新增贡献（已并入权威记录）

1. **arg8 在三个调用点均未初始化**（0x548460 只写 +4）——纠正主 Agent 初版"Obj arg8=0"。
2. **`idiv` 零除隐患**（0x66A574，rate==0 的滚动背景）——主 Agent 复核 FSDB：13 图 78 条 type4 无 rx==0，不可达；已转为数据校验规则。
3. a9 的来源链（0x671B59 出参结构 +4 成员）。
4. **D1（REJECT，阻断生效）**：0x66B544 真实范围 0x66B544–0x66BC80，属性读取为 **5** 个（0x54F..0x553）——主 Agent 初版"仅 2 个"系窗口截断；C-059/EV-40/G39 记录已按字节事实重写，历史五属性主张获确认。
5. 0x9C1113 第二副本/清零槽偏移修正（inner+0x80/+0x98；+0x50/0x68/0xB0/0xC8；cookie 和在 inner+0x12C）。
6. 爬绳退出实参 (move,0,0,0)；+0x90 实参序 (x−x0, y−y0)；tile 路径 arg2/arg3=0x331('x')/0x332('y')。
7. **0x9D34FA 构造时安装虚表 0xB0CB70**——逐状态换表的具体证明（该状态 slot16=E_FAIL ⇒ 同图传送按状态被拒绝）。
8. portal 触发点向 0xA4F6F1 传 **halfWidth=1**（R12 首个调用点数据）。
9. `[ebp-0x10]` 在 tile 路径的**唯一**写者是 0x427EB3 出参（字节穷尽 disp 扫描）。
10. 备查：`[ebp-0x20]` 在 0x666DC9（int 读）与 0x666FAC（Release 用）的双重身份——下轮追查项。

## 裁决汇总

| 工作包 | 裁决 | 处置 |
|---|---|---|
| WP1 G36/G37 平铺 | **ACCEPT** | C-048..C-052 维持；arg8 修正并入 |
| WP2 G38 Portal | **ACCEPT-WITH-CORRECTIONS** | 偏移修正已并入 C-054/EV-35/记录；落点链结论成立 |
| WP3 G40/G41 移动 | **ACCEPT-WITH-CORRECTIONS** | 退出实参等修正已并入；3.0 常量等结论成立 |
| WP4 G39 时钟 | §1/§3 **ACCEPT**；0x66B544 主张 **REJECT**（D1） | C-059/EV-40 已重写为五属性版本（复核后定 CLOSED-STATIC/A） |
| WP5 R13/G27 | **ACCEPT** | 出参语义重构结论成立 |

**无未解决重大异议。** 争议处理方式：D1 按字节裁决（函数范围 0x66BC81 前的三个读取站点），双方复核原始字节后一致；其余 D2–D10 均为主 Agent 记录的精确性修正，已全部应用。

## 状态升级有效性

按门禁规则，本轮新 Critical 结论在 Reviewer ACCEPT（含 corrections 已应用）后，C-059 定 CLOSED-STATIC/A；C-048..C-058、C-060 的 CLOSED-STATIC 升级条件已满足（WP1/WP2/WP3/WP5 ACCEPT + 修正并入），升级动作见提交内容；G36..G41/G24/G27 的 Gap 状态按 PARTIAL-STATIC 如实反映（动态子层未证，不整体关闭）。

## Reviewer 一致性审计结论

- 权威 CSV 与五份取证记录一致；无撤回主张复活（C-006/C-008/C-012/C-013/C-015/C-016/C-018/C-021/C-042 均被尊重；C-052 的差异化注册目标反而强化 C-016）。
- 无单图样本外推；FSDB 13 图边界被双方独立复核。
- 等级膨胀仅 D1 一处（已纠正）；无 INSUFFICIENT-EVIDENCE 遗留。
