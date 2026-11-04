# Task 007 — Stage-2 PE Scan & Process-Layout Correlation

## 目标

基于 Task 006 已经恢复出的第一阶段 materialization 链，继续分析 runtime-generated stage-2 protector，重点解释 `RVA 0x0081CC60` 附近的 `MZ/PE` 扫描逻辑，以及它为什么在离线 Unicorn 环境中走 failure return。

本任务不以绕过反调试、强制走成功分支或制作 unpacked client 为目标。核心问题是：

1. `0x0081CC60` 扫描前的 `ESI/EAX/EBP/ESP` 分别从哪里来；
2. 扫描起点是如何构造的，是否来自返回地址、当前 EIP、SEH frame、模块地址或调用栈；
3. 为什么扫描步长是 `0x10000`，最多 `0x32` 次；
4. found path 除 `MZ` / `PE\0\0` 外还验证哪些 PE 字段；
5. found path 期望命中的究竟是主映像、某个已加载 DLL、loader 自己所在映像，还是其他 image；
6. 真实无调试器进程的模块基址/大小是否能解释该扫描；
7. 如果把**真实观测到的模块布局**原样映射进离线 emulator，扫描是否能自然命中，而无需 patch 条件分支；
8. found path 后是否进一步写入 Tail A `0x002CE000–0x007EA000`、三个 `ZtlTaskMem*` 槽位，或出现 MapleStory crypto/network anchor；
9. 下一阶段是否可以从 protector 转入 game-image materialization / function recovery。

所有最终可提交结果写入：

```text
result/
```

所有临时反汇编、生成 block、模拟内存、模块副本、ETW/VMMap/Process Explorer 临时输出等统一放在：

```text
.work/task-007/
```

`.raw/` 只读。

---

# 已知基线

开始前必须阅读 Task 001–006 的关键结果，尤其是：

```text
result/04-static-loader-dataflow.md
result/loader-entry-analysis.md
result/loader-emulation-observations.md
result/materialization-hypotheses.md
result/anti-debug-rva-materialization.md
result/materialization-map.csv
result/materialized-anchor-hits.csv
scripts/maple079_loader_map.py
scripts/maple079_loader_emulate.py
```

当前客户端 SHA-256：

```text
5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d
```

已确认：

```text
EntryPoint RVA 0x009D8000
    ↓
T1: decode tpuaozxc first 0x1000 bytes in place
    ↓
T2: aPLib-style depack
source      0x00912259–0x009D634A
destination 0x00819014–0x00911B25
    ↓
stage-2 runtime-generated protector
```

首次执行无 raw backing code：

```text
RVA 0x0081C6C5
```

Task 003 两个异常 RVA 均位于 T2 block：

```text
0x00862E76
0x00862FB0
```

Task 006 离线执行已经到达：

```text
RVA 0x0081CC60
```

观察到扫描模式：

```text
cmp eax, 0x32
cmp word ptr [esi], 0x5A4D
sub esi, 0x10000
```

并检查 `[esi + e_lfanew]` 对应的 `PE\0\0`。

当前离线环境没有命中 found path，随后在 `0x0081CC8B` 一带恢复 SEH / `popad` / `ret`，由于模拟栈缺少真实调用上下文而返回到 0。

Tail A 与三个导出槽位仍未被写入：

```text
Tail A                0x002CE000–0x007EA000
ZtlTaskMemAllocImp    0x005FC19F
ZtlTaskMemFreeImp     0x005FC1B0
ZtlTaskMemReallocImp  0x005FC1C1
```

---

# 安全与执行边界

1. 不修改原始 `MapleStory.exe`。
2. 不 patch stage-2 protector、条件跳转、anti-debug、integrity check 或 HackShield。
3. 不隐藏 debugger；本任务原则上不附加 debugger。
4. 不使用 anti-anti-debug 插件。
5. 不 DLL injection，不 API hook。
6. 不暂停线程后篡改寄存器/栈/TEB/PEB。
7. 不关闭 Smart App Control / Code Integrity / Defender。
8. 不生成或提交可运行的 unpacked / decrypted `MapleStory.exe`。
9. 不做完整进程 memory dump。
10. 允许只读收集进程/module/address-space **metadata**，例如 module base、size、path、memory protection、allocation base；不要批量转储内存内容。
11. 如果需要确认 candidate image header，优先使用该模块的磁盘文件；如确有必要读取进程内存，只允许读取最小 PE header 范围，并不得把原始内存页提交 Git。
12. 可以把真实观测到的模块基址/大小和对应磁盘模块映射到离线 emulator；这属于 process-layout replay，不得通过修改条件跳转来“制造成功”。
13. 如果 found path 仍然依赖未观测到的真实运行时状态，记录 blocker，不要转入绕过。

---

# Phase A — 样本与工具复核

记录：

- OS / build；
- Python；
- Capstone / Unicorn / pefile 等版本；
- Task 006 两个脚本版本；
- `MapleStory.exe` SHA-256；
- 执行时间。

必须重新验证主程序 SHA-256。

如果不一致，停止使用现有 RVA。

---

# Phase B — 重建 stage-2 block 并锁定 scan CFG

使用 Task 006 已验证的 T1/T2 逻辑，在 `.work/task-007/` 中重新生成 T2 block。

不要从 Git 中提交生成 block。

对以下区域做 CFG 恢复：

```text
0x0081C6C5–0x0081CD80
```

必要时向前/向后扩展，但只围绕 scan、SEH 和 found/failure path。

至少恢复：

- basic blocks；
- direct/indirect calls；
- register save/restore；
- SEH frame；
- scan loop；
- found branch；
- failure return；
- found path 的第一层后续调用。

输出：

```text
result/stage2-scan-cfg.csv
result/stage2-scan-analysis.md
```

CSV 建议字段：

```text
block_id,start_rva,end_rva,successors,predecessors,role,confidence,notes
```

---

# Phase C — 精确追踪扫描寄存器来源

这是本任务最高优先级。

从 `0x0081CC60` 向前做 register/dataflow slicing，回答：

```text
ESI = ?
EAX = ?
EBP = ?
ESP = ?
```

特别确认：

- `ESI` 的原始值来自哪里；
- 是否对齐到 64 KB boundary；
- 是否由 `call/pop`、return address、stack argument、SEH frame、当前 EIP 或 module pointer 派生；
- `EAX` 是扫描计数还是其他状态；
- `0x32` 是最大 iteration count，还是另有含义；
- `sub esi, 0x10000` 在 found-check 前还是后；
- scan window 的精确起始/终止范围。

不得仅根据某次 Unicorn 寄存器值下结论；必须用静态数据流证明。

输出：

```text
result/stage2-register-provenance.md
```

建议用表：

```text
register,scan_entry_value,producer_rva,derivation,depends_on_runtime_state,confidence
```

---

# Phase D — 完整恢复 PE validation 条件

恢复 found path 之前的所有 image validation。

至少检查是否验证：

- `MZ`；
- `e_lfanew` 范围；
- `PE\0\0`；
- Machine；
- NumberOfSections；
- OptionalHeader magic；
- ImageBase；
- SizeOfImage；
- section / data directory；
- export/import/resource 相关字段；
- 其他 magic/constant。

把每条 validation 转成结构化规则。

输出：

```text
result/stage2-pe-validation.csv
```

字段建议：

```text
check_order,instruction_rva,field,offset,comparison,failure_target,meaning,confidence
```

最终写清：

> 一个 candidate image 最少满足哪些条件，stage-2 才会进入 found path。

---

# Phase E — 静态分析 found path

found path 从 Task 006 已知的：

```text
RVA 0x0081CCC6
```

开始。

不通过 patch 执行它；先做纯静态分析。

至少恢复：

- found candidate base 存入哪里；
- 后续是否读取其 PE headers；
- 是否遍历 sections；
- 是否解析 imports/exports；
- 是否寻找特定 section / resource / signature；
- 是否调用 copy/decode/materialize primitive；
- 是否形成对 Tail A 或 `ZtlTaskMem*` 的地址；
- 是否有新的 packed source pointer。

如果 found path 很长，至少分析到第一个新的大循环/decoder/materializer 或明确 runtime dependency。

输出：

```text
result/stage2-found-path-analysis.md
result/stage2-found-path-references.csv
```

---

# Phase F — 无 debugger 的真实 process-layout snapshot

在**不附加 debugger**的情况下，对自然运行的 `MapleStory.exe` 做一次只读 process-layout 采样。

允许使用：

- `CreateToolhelp32Snapshot` / Module32First/Next；
- PSAPI `EnumProcessModulesEx`；
- Process Explorer / VMMap 的只读视图；
- `VirtualQueryEx` 仅收集 region metadata；
- ETW ImageLoad；
- PowerShell/CIM 能提供的 module/process metadata。

记录：

- PID；
- image base；
- module name；
- module base；
- module size；
- architecture；
- normalized path；
- mapped/image/private 类型（若可得）；
- protection；
- allocation base；
- timestamp / file SHA-256（针对磁盘文件）。

不要记录用户名等不必要隐私路径；路径应标准化或脱敏。

不要读取/提交整个模块内存。

输出：

```text
result/process-layout-snapshot.csv
```

---

# Phase G — 将 scan window 与真实模块布局相关联

使用 Phase C 得到的 scan 起点公式，计算真实进程里 stage-2 会覆盖的每个 64 KB candidate address。

对于每个候选地址，判断：

- 是否落入一个 `MEM_IMAGE` / mapped image；
- 对应 module 是什么；
- candidate address 是否等于/接近 module allocation base；
- 磁盘模块是否有合法 MZ/PE；
- 是否满足 Phase D 的 validation 条件。

输出：

```text
result/stage2-scan-candidates.csv
```

字段建议：

```text
iteration,candidate_va,candidate_rva_or_module_offset,mapped,module,allocation_base,pe_valid,validation_result,confidence,notes
```

最终必须回答：

```text
scan intended target = ?
```

只允许：

- confirmed
- probable
- possible
- unknown

并说明证据。

---

# Phase H — Process-layout replay（如证据足够）

如果 Phase G 找到高置信 candidate module，则在离线 Unicorn 环境中按真实观测布局映射：

- `MapleStory.exe` 当前样本；
- candidate module 的**磁盘文件**；
- 其真实观测 base/size；
- 最小必要 TEB/SEH metadata。

原则：

1. 不 patch found branch；
2. 不手工把 `ZF/CF/EIP` 改成成功；
3. 不伪造不存在的 `MZ/PE`；
4. candidate module 必须来自真实 process-layout snapshot；
5. 磁盘文件哈希要记录；
6. 如果真实模块映射后 scan 自然命中，才继续执行。

允许给 TEB/SEH 建立 Windows ABI 所需的最小结构，但不要设置 `BeingDebugged` 等值来规避安全判断。

输出：

```text
result/stage2-offline-replay.md
```

必须记录：

- scan 是否自然命中；
- 命中的 candidate VA/module；
- found path 首次执行 RVA；
- 后续 instruction count；
- 新的内存写入区；
- 首个新 runtime dependency / stop reason。

---

# Phase I — 监测是否进入下一层 materialization

如果 replay 自然穿过 found path，重点监测：

```text
Tail A
0x002CE000–0x007EA000
```

以及：

```text
0x005FC19F
0x005FC1B0
0x005FC1C1
```

记录所有新大块写入：

- producer RVA；
- source；
- destination；
- length；
- write count；
- entropy before/after；
- block SHA-256；
- x86 instruction density；
- strings/RTTI density；
- 是否形成 import-like pointer table。

不要把生成内容提交 Git。

输出：

```text
result/stage3-materialization-events.csv
result/stage3-materialization-hypotheses.md
```

如果没有任何新写入，也要明确记录。

---

# Phase J — 再次搜索 MapleStory game/network anchors

只有在发现**新的** materialized block 时才执行。

搜索 Task 002 已知：

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

以及：

```text
List.wz
.wz
WS2_32
connect
send
recv
```

还可以统计：

- MSVC RTTI；
- 普通函数序言密度；
- import thunk / API pointer density。

输出：

```text
result/stage3-anchor-hits.csv
```

只提交地址和结构化证据，不提交完整生成代码。

---

# Phase K — 可选辅助脚本

建议新增：

```text
scripts/maple079_stage2_scan.py
```

功能可以包括：

- 从 Task 006 T2 block 中提取 scan CFG；
- 打印 register provenance 辅助信息；
- 根据给定起点列出 50 个 64 KB scan candidate；
- 读取 `process-layout-snapshot.csv` 做 module correlation；
- 对磁盘 PE 执行同样的 validation rule；
- 输出 JSON/CSV。

脚本必须是只读分析工具，不能 attach debugger、patch 进程或修改模块。

如修改 `scripts/maple079_loader_emulate.py`，必须保持 Task 006 原有 reproduction path 可复现。

---

# 最低成功标准

Task 007 至少必须完成：

1. 精确恢复 `0x0081CC60` scan 的起点来源和 register provenance；
2. 列出完整 PE validation 条件；
3. 静态分析 found path 至少到下一个主要阶段；
4. 无 debugger 获取一次真实 MapleStory process/module layout；
5. 将 50 × 64 KB scan window 与真实模块布局做 correlation；
6. 判断 intended scan target 是 confirmed/probable/possible/unknown；
7. 如果有高置信 target，则做不 patch 的 offline process-layout replay；
8. 明确 Tail A / ZtlTaskMem 是否出现新 materialization；
9. 明确是否出现新的 crypto/network/game-code anchor；
10. 给出下一任务路线。

---

# 最终路线选择

只能选择最符合证据的一条：

## Route A — Game-image materialization reached

如果 found path 自然进入新的大块 game-like materialization，并出现 MSVC/RTTI/WZ/crypto/network anchor：

下一任务进入：

```text
Game Function Boundary & Network Anchor Recovery
```

## Route B — Scan target identified, later runtime dependency remains

如果 intended image 已确认，但 found path 后仍依赖其他真实运行时状态：

下一任务针对新的 stage-3 dependency 做精细静态/布局建模。

## Route C — Scan target still unresolved

如果无法确定扫描目标，或真实 process layout 中没有满足条件的 candidate：

回到 compatibility VM / reference client 路线，不通过 patch 制造 found path。

---

# 建议输出

至少生成：

```text
result/05-stage2-pe-scan-correlation.md
result/stage2-scan-analysis.md
result/stage2-scan-cfg.csv
result/stage2-register-provenance.md
result/stage2-pe-validation.csv
result/stage2-found-path-analysis.md
result/stage2-found-path-references.csv
result/process-layout-snapshot.csv
result/stage2-scan-candidates.csv
result/stage2-offline-replay.md
```

如成功进入下一层，再生成：

```text
result/stage3-materialization-events.csv
result/stage3-materialization-hypotheses.md
result/stage3-anchor-hits.csv
```

建议脚本：

```text
scripts/maple079_stage2_scan.py
```

---

# 提交前检查

执行：

```text
git status
git diff
```

确认没有提交：

- `.raw/`；
- `.work/`；
- EXE/DLL/WZ；
- memory dump；
- 生成的 T2/T3 binary block；
- unpacked executable；
- pcap/etl/evtx；
- IDA/Ghidra database；
- 用户名、账号、密码等隐私信息。

建议 commit message：

```text
Complete Task 007 stage2 PE scan correlation
```

然后：

```text
git push
```

不要 force push。

---

# 最终汇报

最终报告必须明确给出：

- Task 007 是否达到最低成功标准；
- 客户端 SHA-256；
- scan loop 起点 RVA；
- scan 起始 ESI 如何产生；
- 64 KB × 0x32 window 的精确范围；
- PE validation 条件；
- intended target module/image；
- confidence；
- 真实进程中的 candidate VA/base；
- found path 静态作用；
- offline replay 是否自然命中；
- 是否写入 Tail A；
- 是否写入三个 ZtlTaskMem 槽位；
- 是否出现新的 game-code/RTTI/WZ/crypto/network anchor；
- 首个新的 materializer RVA（如有）；
- 最终 Route A/B/C；
- 生成了哪些 result/scripts；
- commit SHA；
- push 是否成功；
- blocker 和未完成项。
