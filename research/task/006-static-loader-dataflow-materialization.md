# Task 006 — Static Loader Dataflow & Runtime Materialization Mapping

## 目标

基于 Task 001–005 已有结果，对当前 CMS079 V5 `MapleStory.exe` 的**入口 loader / protector 数据流**做一次受控、可复现的静态分析与离线建模。

本任务不以“脱壳”或“绕过反调试”为目标。核心问题是：

1. `EntryPoint RVA 0x009D8000` 的入口 stub 从哪里读取数据；
2. `tpuaozxc` 等高熵区是否被入口代码作为 packed source 使用；
3. loader 会向哪些无 raw backing 的虚拟区写入数据；
4. `0x002CE000–0x007EA000` 和 `0x00819000–0x00912000` 两个大虚拟区分别承担什么角色；
5. Task 003 的 `RVA 0x00862E76` / `0x00862FB0` 如何落入运行时生成代码区；
6. 能否在不生成 unpacked executable 的前提下建立：

```text
packed source RVA
    ↓
loader routine / transform
    ↓
destination RVA range
    ↓
materialized code/data classification
```

7. 哪一块更可能是 protector/runtime code，哪一块更可能是原始游戏代码 materialization 区；
8. 下一阶段是否已经具备恢复 crypto / network / packet dispatcher 的静态锚点。

同时补充一个很小的**只读运行时观察**：在不附加 debugger 的情况下读取 Task 005 中 `MapleStory` 对话框的正文、控件和出现时序，用来判断当前自然启动到底阻塞在哪一层。

所有最终可提交结果写入：

```text
result/
```

所有临时反汇编、分析数据库、离线模拟内存、生成缓冲、截图、日志、缓存统一放在：

```text
.work/task-006/
```

`.raw/` 只读。

---

# 已知基线

开始前必须以仓库现有结果为准。

当前 `MapleStory.exe` SHA-256：

```text
5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d
```

PE：

```text
ImageBase       0x00400000
EntryPoint RVA  0x009D8000
SizeOfImage     0x009DA000
```

Task 004 已建立的关键区域：

```text
RVA 0x00001000–0x002CE000  packed data candidate
RVA 0x002CE000–0x007EA000  large virtual tail / runtime-generated candidate
RVA 0x007EA000–0x00818000  .rsrc
RVA 0x00818000–0x00819000  .idata
RVA 0x00819000–0x00912000  large RWX virtual area
RVA 0x00912000–0x009D8000  tpuaozxc high-entropy packed region
RVA 0x009D8000–0x009D9000  jtrppsow entry loader/protector
RVA 0x009D9000–0x009DA000  uvrwsdpb
```

Task 003 两个运行时异常 RVA：

```text
0x00862E76
0x00862FB0
```

这两个地址没有 raw backing，必须依赖运行时 materialization 才能解释。

Task 005 已确认：

- `HSUpdate.exe -> AspINet.dll` 的 `0xC0E90008` 是 Windows Code Integrity / Smart App Control policy block；
- 当前 Windows 无 debugger 启动时没有连接 9555；
- 出现一个 `#32770`、标题为 `MapleStory` 的对话框，但正文尚未采集；
- 目前推荐路线为 Static-loader-boundary-first。

---

# 安全与执行边界

1. 不修改原始 `MapleStory.exe`。
2. 不 patch loader、anti-debug、integrity check、HackShield 或网络逻辑。
3. 不隐藏 debugger；本任务原则上不附加 debugger。
4. 不使用 anti-anti-debug 插件。
5. 不注入 DLL。
6. 不制作、保存或提交可运行的 unpacked / decrypted `MapleStory.exe`。
7. 不导出完整进程 memory dump。
8. 不提交大型 decrypted code blob。
9. 可以在 `.work/task-006/` 中做离线解析、反汇编、受控 CPU emulation 和短生命周期生成缓冲，但最终只能提交结构化元数据、地址、哈希、统计和少量必要字节片段。
10. 单段提交到 `result/` 的机器码证据应保持短小，只保留说明控制流所需的最小字节范围，不复制大段受版权保护代码。
11. 不因为分析需要而关闭 Smart App Control / Code Integrity / Defender。
12. 如果某个步骤必须依赖真实运行时内存才能继续，记录 blocker，不要转而做保护绕过。

---

# Phase A — 环境与样本复核

记录：

- OS / build；
- Python；
- Ghidra / IDA / Cutter / radare2 / Binary Ninja（如有）；
- `pefile` / `lief` / `capstone` / `unicorn` / `iced-x86` 等版本；
- 执行时间；
- 客户端 SHA-256。

必须确认客户端 SHA-256 与基线一致。

如果不一致，停止套用现有 RVA 结论。

---

# Phase B — 入口 stub 精细反汇编

从磁盘 raw-backed 的：

```text
RVA 0x009D8000
```

开始，对 `jtrppsow` 整个 4 KB 节做线性反汇编 + 控制流恢复。

至少记录：

- basic block start/end；
- direct call / jmp target；
- indirect branch；
- stack adjustment；
- `call/pop` 取 EIP 技巧；
- 立即数；
- 对 ImageBase-relative 地址的引用；
- 对 `tpuaozxc` 的引用；
- 对 `.idata` / `GetLocalTime` 的引用；
- 对两个大虚拟区的目标地址引用；
- 任何明显循环；
- 任何 copy / xor / add / rotate / table lookup 风格的 transform。

特别检查 Task 004 已看到的入口字节：

```text
83 ec 04 50 53 e8 01 00 00 00 cc 58 8b d8 40
2d 00 60 0c 00 2d 71 35 5f 00 05 66 35 5f 00
```

不要把跳过的 `int3` 误判成执行路径。

输出：

```text
result/loader-entry-analysis.md
```

---

# Phase C — 建立完整 PE RVA / raw / virtual 映射

写一个小型只读辅助脚本，建议：

```text
scripts/maple079_loader_map.py
```

功能至少包括：

- 读取 PE section table；
- RVA -> file offset；
- file offset -> RVA；
- 判断一个 RVA 是否有 raw backing；
- 输出每个 section 的 raw / virtual 区间；
- 判断地址是否属于 zero-filled virtual tail；
- 输出给定 RVA 周围的 section metadata。

脚本不得修改输入文件。

至少锁定：

```text
0x002CE000
0x005FC19F
0x005FC1B0
0x005FC1C1
0x00819000
0x00862E76
0x00862FB0
0x00912000
0x009D8000
```

输出：

```text
result/loader-region-map.csv
```

建议字段：

```text
region,start_rva,end_rva,section,raw_backing,raw_start,raw_end,permissions,entropy,classification,evidence,confidence
```

---

# Phase D — 静态 source / destination 地址引用扫描

对 raw-backed executable/loader 区域扫描所有：

- absolute VA immediate；
- ImageBase-relative arithmetic；
- LEA / MOV / PUSH 中的可疑地址；
- 间接表地址；
- 长度常量。

重点把引用按目标区域分类：

```text
packed-source
virtual-tail-A  0x002CE000–0x007EA000
virtual-tail-B  0x00819000–0x00912000
tpuaozxc        0x00912000–0x009D8000
entry           0x009D8000–0x009D9000
```

不要只扫裸 32-bit literal；同时识别类似：

```text
base + delta
sub/add immediate
call/pop EIP + offset
```

的地址形成方式。

输出：

```text
result/loader-address-references.csv
```

建议字段：

```text
instruction_rva,mnemonic,operand,resolved_target_rva,target_region,access_kind,confidence,notes
```

---

# Phase E — 找 copy / decode / transform primitive

从入口控制流向下寻找以下语义候选：

- memcpy-like loop；
- byte/word/dword XOR loop；
- rotate / shift transform；
- add/sub key stream；
- table lookup；
- block copy；
- block clear；
- import resolver；
- relocation fixer；
- section materializer。

这里只做**语义分类**，不要急着命名成具体 packer 产品。

对每个候选记录：

```text
candidate_id
entry_rva
input/source range
output/destination range
length source
transform summary
callers
callees
confidence
```

输出：

```text
result/loader-transform-candidates.csv
```

---

# Phase F — 受控离线 emulation（如可行）

如果入口 stub 足够独立，可以使用 Unicorn / Qiling / 自定义轻量模拟器做**离线 CPU emulation**。

允许：

- 按 PE 映像布局映射当前 `MapleStory.exe`；
- zero-fill VirtualSize > RawSize 区域；
- 设置 32-bit x86 寄存器和栈；
- 从 `ImageBase + EntryPoint` 开始；
- 对外部 API 做最小 stub；
- 对内存 read/write/execute 做日志；
- 运行有限 instruction budget；
- 在 `.work/task-006/` 中保存短生命周期的模拟内存状态。

不允许：

- 输出可运行 unpacked EXE；
- 重建完整 import table 并生成新客户端；
- 把完整解密代码写入 `result/`；
- 为了穿过 anti-debug 分支而强制 patch 条件跳转。

API stub 原则：

- 只返回足以继续静态/离线建模的确定性值；
- 每个 stub 必须记录为什么这样返回；
- 如果某 API 返回值直接决定安全/anti-debug 分支，不要伪造“未检测到调试器”来绕过；应停止该路径并记录。

重点记录：

- 第一次写入 `0x002CE000–0x007EA000`；
- 第一次写入 `0x00819000–0x00912000`；
- 每次大块写入的 source/destination/length；
- 写入后页面熵变化；
- 写入后短字节前缀 SHA-256 / 整块 SHA-256；
- 首次执行进入无 raw backing 页面的位置；
- 首次出现典型 MSVC function prologue 的区域；
- 是否生成 import-like function pointer table。

输出：

```text
result/loader-emulation-observations.md
```

如果无法可靠 emulation，也必须生成该文件并说明具体 blocker。

---

# Phase G — Materialization 区域分类

根据静态引用和离线 emulation，建立地址区分类。

目标至少区分：

```text
loader/protector control code
packed source data
runtime-generated protector code
possible original game code
possible import/IAT reconstruction
possible relocation/fixup table
unknown
```

对每个候选 materialized block 记录：

- RVA range；
- 写入来源；
- 写入长度；
- 最终权限（如果能推断）；
- entropy；
- x86 instruction density；
- strings density；
- RTTI / MSVC 特征；
- API pointer density；
- crypto anchor 命中情况；
- 是否覆盖 `0x862E76 / 0x862FB0`；
- confidence。

输出：

```text
result/materialization-map.csv
result/materialization-hypotheses.md
```

---

# Phase H — 搜索已知 MapleStory 协议/crypto 锚点

如果离线生成了候选 materialized 区，只允许在 `.work/task-006/` 中搜索 Task 002 已知常量。

重点：

AES key：

```text
13 00 00 00 08 00 00 00 06 00 00 00 B4 00 00 00
1B 00 00 00 0F 00 00 00 33 00 00 00 52 00 00 00
```

IV table prefix：

```text
EC 3F 77 A4 45 D0 71 BF B7 98 20 FC 4B E9 B3 E1
```

IV seed：

```text
F2 53 50 C6
```

还可以搜索：

- `List.wz`
- `.wz`
- `WS2_32`
- `connect`
- `send`
- `recv`

但注意：没有命中不代表没有对应功能。

如果命中，只提交：

```text
RVA
region
anchor type
xref / nearby function candidate
confidence
```

不要提交完整生成代码。

输出：

```text
result/materialized-anchor-hits.csv
```

---

# Phase I — 三个 ZtlTaskMem 导出槽位

Task 004 已知：

```text
ZtlTaskMemAllocImp    RVA 0x005FC19F
ZtlTaskMemFreeImp     RVA 0x005FC1B0
ZtlTaskMemReallocImp  RVA 0x005FC1C1
```

这些地址没有 raw backing。

检查：

- 是否有 loader 写入覆盖这些 RVA；
- 写入长度是否至少覆盖三个槽位；
- 写入后是否成为 jump thunk / forwarding stub；
- 三个地址之间固定 `0x11` 间距是否与某种 runtime stub layout 一致。

如果离线 emulation 无法到达，不要猜。

输出到：

```text
result/materialization-hypotheses.md
```

---

# Phase J — 只读采集 MapleStory 对话框正文

不附加 debugger。

在本地服务端是否启动都可以，但要记录条件。

无 debugger 启动：

```text
MapleStory.exe 127.0.0.1 9555
```

使用普通 Win32 UI 只读 API 或 UI Automation：

- `EnumWindows`
- `EnumChildWindows`
- `GetWindowTextW`
- `GetClassNameW`
- UI Automation Text / Name property

读取：

- top-level hwnd；
- title；
- class；
- child controls；
- static text；
- button text；
- 出现时间；
- 进程 PID；
- 窗口出现前后的模块/网络状态（只做普通系统查询）。

不要自动点击 OK，除非为了确认窗口关闭行为且不会扩大任务；默认人工关闭。

如果 Win32 `Static` 文本为空，可以尝试 UI Automation；不要 OCR，除非完全没有其他方式。

禁止 hook `MessageBox`、禁止注入、禁止 debugger。

输出：

```text
result/runtime-dialog-observation.md
```

这一步的核心问题是判断正文属于哪一类：

```text
compatibility / OS error
HackShield initialization
network/server connection
client argument/launcher requirement
protector/self-check
unknown
```

---

# Phase K — 与 Task 003 anti-debug RVA 建立关系

根据 materialization map 判断：

```text
0x00862E76
0x00862FB0
```

最终位于：

- 同一 materialized block？
- 哪个 source packed range 生成？
- 生成它的 transform candidate 是哪个？
- 它属于 protector runtime code 还是 possible game code？

如果无法得到字节，不要猜具体指令。

至少给出：

```text
producer candidate
source range
destination block
classification
confidence
```

输出到：

```text
result/anti-debug-rva-materialization.md
```

---

# Phase L — 下一阶段决策

根据 Task 006 结果只选择一个主路线：

## Route A — Game-code region identified

如果已经高置信识别出一块 materialized original game code，并出现 Maple crypto/network anchor，则下一任务进入：

```text
CClientSocket / crypto / packet dispatcher static recovery
```

## Route B — Materialization understood, no game anchor yet

如果已经知道 loader 如何写各区域，但尚未找到网络锚点，则下一任务继续：

```text
materialized code classification / function boundary recovery
```

## Route C — Loader emulation blocked

如果静态数据流无法越过某个依赖真实运行环境的阶段，则明确记录 blocker，并选择：

```text
reference-client research
or
compatibility VM passive observation
```

不要把 debugger stealth / anti-debug bypass 设为默认下一步。

---

# 预期输出

尽可能生成：

```text
result/
├── 04-static-loader-dataflow.md
├── loader-entry-analysis.md
├── loader-region-map.csv
├── loader-address-references.csv
├── loader-transform-candidates.csv
├── loader-emulation-observations.md
├── materialization-map.csv
├── materialization-hypotheses.md
├── materialized-anchor-hits.csv
├── anti-debug-rva-materialization.md
└── runtime-dialog-observation.md
```

辅助脚本：

```text
scripts/maple079_loader_map.py
```

如另写离线 emulator helper，也可以提交纯源码，例如：

```text
scripts/maple079_loader_emulate.py
```

但不得依赖或携带客户端二进制。

---

# `result/04-static-loader-dataflow.md` 建议结构

```markdown
# Task 006 — Static Loader Dataflow

## 1. Environment
## 2. Sample Verification
## 3. Entry Stub
## 4. PE Region Map
## 5. Address References
## 6. Transform Candidates
## 7. Offline Emulation
## 8. Materialization Map
## 9. Known Anchor Search
## 10. ZtlTaskMem Slots
## 11. Anti-debug RVA Mapping
## 12. Runtime Dialog Observation
## 13. High-confidence Findings
## 14. Uncertainties
## 15. Recommended Next Route
## 16. Reproduction Commands
```

---

# 最低成功标准

Task 006 至少必须做到：

- [ ] 客户端 SHA-256 与基线一致；
- [ ] 完成 entry stub 控制流分析；
- [ ] 完成 RVA/raw/virtual map；
- [ ] 对 loader 的 source/destination 地址引用做结构化记录；
- [ ] 至少识别一个 copy/decode/transform candidate，或明确证明为什么不能；
- [ ] 对两个大虚拟区给出 evidence-based classification；
- [ ] 明确 `0x862E76 / 0x862FB0` 属于哪个 materialization block，或明确仍无法判定；
- [ ] 对离线 emulation 给出成功结果或具体 blocker；
- [ ] 采集 Task 005 `MapleStory` 对话框正文，或明确说明 Win32/UIA 都无法读取；
- [ ] 不生成或提交 unpacked executable；
- [ ] 不附加 debugger；
- [ ] 下一阶段 Route A/B/C 明确。

---

# 提交前检查

确认：

- `.raw/` 未修改；
- `.work/` 未提交；
- 无 EXE/DLL/WZ；
- 无 memory dump；
- 无完整 decrypted code blob；
- 无 Ghidra/IDA 大型数据库；
- 无 patched executable；
- 无 anti-debug bypass；
- 所有 CSV / JSON / Markdown 可读；
- 辅助脚本不包含原始客户端大段字节。

执行：

```text
git status
git diff
```

建议 commit message：

```text
Complete Task 006 static loader dataflow mapping
```

然后：

```text
git push
```

不要 force push。
