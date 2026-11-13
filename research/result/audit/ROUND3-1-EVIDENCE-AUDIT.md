# Round 3.1 证据审计总报告（ROUND3-1-EVIDENCE-AUDIT）

日期: 2026-11-13。审计基线 `dccabf43`（本地=远程，工作区含 4 个上轮未提交文件——已纳入审计项 ME-6）。

## 审计范围与方法

对 Round-3 的四组关键结论独立复核：PE/IAT（规范描述符遍历）、RTTI/虚表（COL 规范解析 + TD 交叉引用扫描）、0x427EB3（E8 全量普查 + 同族槽位约定比对）、slot45 候选（5 DLL 全扫描 22 表）。原始证据 = 仓库内 DLL/EXE 二进制 + capstone/PE 结构解析（脚本与日志在 .work/task-063/ 与 research/result/audit/）。

## 一、已确认事实（维持）

| ID | 事实 | 等级 |
|---|---|---|
| A-1 | 0x5042D0A0 = MSVCRT!_purecall IAT 项（hint 0x192 全链吻合） | A |
| A-3 | 0x2A610 = 导入跳转桩 | A |
| A-4 | **Gr2D 静态导入 WINMM waveOut 族（新发现，音频证据升 A）** | A |
| B-3 | 0x2E2C4 族 slot45 ∈ {purecall, dtor}，**共同排除插入** | A |
| C-1 | 0x427EB3 恰好 240 个调用点 | A |
| C-2 | slot25 = [arg1+0xCC]=arg2 属性 setter（同族 18-28 约定一致） | A |
| C-3 | 0x427EB3 = 属性 PUT 包装（非创建器） | B |
| — | tile/obj 排序键公式（lea 指令，独立于容器争议） | A |

## 二、被推翻/降级事实

| 原结论 | 裁定 |
|---|---|
| Round-3 论证".reloc 无覆盖 ⇒ 表静态" | **论证无效**（IAT 由加载器 FirstThunk 处理覆写，与 .reloc 无关）；结论本身另行由 A-1 成立 |
| Round-2/3 "RTTI 验证 CWzRawCanvas/CWzGr2DLayer 类身份" | **降级 C**：无 COL、TD 零交叉引用；名字-类绑定仅为 .data 邻近推断 |
| Round-3 "具体虚表 = 0x5042E2CC（断言）" | **歧义暴露**：0x2E2C4（151 槽，最大游程+COM 惯例）与 0x2E2CC（149 槽）均与 intmap 精确衔接；slot45 相应为 purecall 或 dtor（槽 43） |
| Round-3 措辞"[this+0xCC]" | 修正为"[arg1+0xCC]，arg1=层对象（cdecl 显式首参）" |
| Round-2 "音频经哈希动态导入"（部分） | 修正：Gr2D **静态**导入 waveOut 族；哈希导入表仍存在（其余 API） |

## 三、尚未确认事实

- [ebp-0x10] 具体虚表（R-09 运行时 1-dword）——22 候选全表已录 R13-SLOT45-CANDIDATES.csv；14 个 'other' 类函数体未读（ME-4，纯静态可做）
- WINMM 序号→函数名映射（ME-2，需同时代 winmm.dll，纯静态）
- Avatar 遮挡 §11 五项（ME-5，纯静态未做）

## 四、必须运行时验证

仅 **R-09 一项**（[ebp-0x10] vptr）；ME-3（虚表起点消歧）可由 R-09 同一转储附带解决。

## 五、第二次任务执行清单（Round 3.1 深度逆向建议序）

1. **ME-4**（纯静态，最高性价比）：读 14 个 'other' slot45 函数体，寻找插入语义候选（Gr2D 0x2F530/0x367B8、NameSpace 0x170F8 族、Shape2D 0xC0E0 族）
2. **ME-2**：定位/获取同时代 winmm.dll 解析序号 202/200/11/10
3. **ME-5**：Avatar 遮挡五项静态批读
4. **ME-6**：处置 4 个未提交文件（本轮已验证其 240-sites 声明；建议加注审计标记后提交）
5. R-09 运行时捕获（依赖 VM 激活修复，另行授权）

## 审计限制声明

本审计使用了仓库内的原始 DLL（.work/task-001/extracted）与解包 EXE（.work/task-036），全部结论可由 `research/result/audit/*.log` 与附带脚本复现。未使用 Ghidra 交互验证（仅 CSV 反编译语料）；slot45 'other' 分类的函数体未逐一人工复核（标记 C，未假装 A）。
