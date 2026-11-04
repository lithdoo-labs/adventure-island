# Task 008 — Stage-2 In-Place Decode Rounds & Resolver Emergence

## 目标

基于 Task 007 已经确认的 `kernel32.dll` 定位链，继续分析 stage-2 protector 在 found path 之后的**自修改 / 原地解码轮次**，直到出现以下任一高价值事件：

1. 第一次写出 `0x00819000–0x00912000`（Tail B）之外；
2. 第一次真实消费已保存的 `kernel32.dll` base；
3. 第一次出现 export walker / API resolver；
4. 第一次解析出新的 Win32 API 地址；
5. 第一次写入 Tail A `0x002CE000–0x007EA000`；
6. 第一次写入 `ZtlTaskMemAllocImp / FreeImp / ReallocImp` 三个导出槽位；
7. 第一次 materialize 出明显不像 protector 的 game-like code/data block；
8. 第一次命中 CMS079 已知 crypto / WZ / network anchor。

本任务不以“解壳完成”或“绕过保护”为目标。核心问题是：

```text
kernel32 base 已确认
        ↓
stage-2 self-decode round #1
        ↓
round #2
        ↓
更多 self-modifying rounds
        ↓
resolver emergence ?
        ↓
first cross-Tail-B write ?
        ↓
game image materialization ?
```

所有最终可提交结果写入：

```text
result/
```

所有临时生成代码、模拟内存、模块映射、轨迹日志、短期二进制缓冲统一放在：

```text
.work/task-008/
```

`.raw/` 只读。

---

# 已知基线

当前 `MapleStory.exe` SHA-256：

```text
5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d
```

必须重新验证。

Task 006/007 已确认：

```text
ImageBase       0x00400000
EntryPoint RVA  0x009D8000
```

第一阶段：

```text
T1:
RVA 0x009D8046
原地解码 tpuaozxc 前 0x1000
```

第二阶段：

```text
T2:
producer RVA 0x0091210A
source      0x00912259–0x009D634A
destination 0x00819014–0x00911B25
transform   aPLib-style depack
```

stage-2 首次执行无 raw backing：

```text
RVA 0x0081C6C5
```

Task 007 已确认 stage-2 通过 MapleStory 自己的 IAT：

```text
kernel32!GetLocalTime
```

反向定位：

```text
kernel32.dll base = 0x76240000
GetLocalTime      = 0x7625D430
```

观察到的扫描：

```text
0x76250000  miss
0x76240000  hit
```

found path：

```text
RVA 0x0081CCC6
```

保存 kernel32 base 到：

```text
RVA 0x0081A621
RVA 0x0081B45D
```

Task 007 已看到后续两轮原地 transform：

```text
round #1 producer 0x0081CE47
range             0x0081CEB5–0x00824080
length            0x71CC
```

以及：

```text
round #2 loop     0x0081D594–0x0081D622
count             0x1A99
span approx        0x0081D633–0x00824093
```

截至 Task 007：

- Tail A 尚未写；
- ZtlTaskMem 三槽位尚未写；
- 没有 game-like block；
- 没有 AES / IV / WZ / WS2_32 / connect / send / recv anchor；
- Route B：scan target 已确认，但后续 protector round 尚未完成。

---

# 安全与执行边界

1. 不修改 `.raw/`。
2. 不 patch `MapleStory.exe`。
3. 不 patch条件跳转、比较结果或寄存器状态以强制通过保护逻辑。
4. 不隐藏 debugger。
5. 原则上不附加 debugger。
6. 不使用 anti-anti-debug 插件。
7. 不 DLL injection。
8. 不 hook 真实进程 API。
9. 不修改真实进程内存。
10. 不伪造 `BeingDebugged`、PEB、TEB 或安全相关字段来绕过检查。
11. 可以在离线 Unicorn/Qiling 模型中构造**真实 Windows ABI 所必需的最小结构**，但必须来自已知 ABI 或真实观测；不能为了改变保护分支结果而编造字段。
12. 不生成、保存或提交可执行的 unpacked MapleStory EXE。
13. 不提交完整 decrypted/protector/game binary blob。
14. 不提交 memory dump。
15. 不关闭 Smart App Control / Code Integrity / Defender。
16. 所有生成 buffer 只能留在 `.work/task-008/`。
17. Git 只提交地址、统计、hash、CFG、事件表和极少量必要字节证据。

---

# Phase A — 基线与 replay 复现

开始前完整阅读：

```text
result/05-stage2-pe-scan-correlation.md
result/stage2-register-provenance.md
result/stage2-found-path-analysis.md
result/stage2-offline-replay.md
result/stage3-materialization-hypotheses.md
result/process-layout-snapshot.csv
scripts/maple079_loader_emulate.py
scripts/maple079_stage2_scan.py
```

要求先复现 Task 007 的自然命中：

```text
GetLocalTime IAT
→ 0x76250000
→ 0x76240000
→ found path 0x0081CCC6
```

如果不能稳定复现，不继续后续 round。

记录：

- client hash；
- kernel32 hash；
- kernel32 base；
- GetLocalTime RVA/VA；
- found path instruction count；
- T2 block hash；
- replay environment。

输出：

```text
result/06-stage2-inplace-decode.md
```

---

# Phase B — 精确恢复 round #1 / #2

不要只依赖 Task 007 摘要。

对：

```text
0x0081CD80–0x00824100
```

在每一轮 transform **执行前** 和 **执行后** 分别做反汇编。

对 round #1：

```text
producer 0x0081CE47
```

恢复：

- loop init；
- input/output address formation；
- exact iteration count；
- XOR/ADD/XOR 常量；
- direction；
- termination condition；
- self-overwrite 边界；
- 哪些后续指令是在运行过程中才被解码出来。

对 round #2：

```text
0x0081D594–0x0081D622
```

恢复同样信息。

特别记录：

```text
old bytes hash
new bytes hash
entropy before/after
instruction density before/after
new direct calls/jumps
new absolute addresses
```

输出：

```text
result/stage2-decode-rounds.csv
result/stage2-selfmod-cfg.md
```

建议 CSV 字段：

```text
round_id,producer_rva,start_rva,end_rva,iteration_count,word_size,direction,transform,pre_sha256,post_sha256,entropy_before,entropy_after,new_control_targets,notes
```

---

# Phase C — 分段执行，不以固定 instruction budget 为主要停止条件

修改或扩展离线模拟脚本，建议：

```text
scripts/maple079_stage2_continue.py
```

要求能在自然 replay 的基础上继续执行。

使用**事件驱动停止条件**，而不是单纯“再跑 N 万条”：

优先停止并保存 metadata 的事件：

```text
E1  write outside Tail B
E2  write into Tail A
E3  write into any ZtlTaskMem slot
E4  execute outside Tail B
E5  read saved kernel32 base slots
E6  first PE export-directory read
E7  first candidate API function pointer written into MapleStory image
E8  first new allocation-like address outside current image
E9  crypto/WZ/network anchor appears after a decode round
E10 unrecoverable ABI/runtime dependency
```

Tail B 定义：

```text
0x00819000–0x00912000
```

Tail A：

```text
0x002CE000–0x007EA000
```

Ztl slots：

```text
0x005FC19F
0x005FC1B0
0x005FC1C1
```

输出：

```text
result/stage2-runtime-events.csv
```

字段建议：

```text
event_id,instruction_count,eip_rva,event_type,source_rva,destination_rva,length,value_or_hash,classification,confidence,notes
```

---

# Phase D — 追踪 kernel32 base 的第一次真实消费

Task 007 已知 kernel32 base 被保存到：

```text
0x0081A621
0x0081B45D
```

对这两个位置设置离线 read-watch。

记录第一次：

```text
read slot
→ consumer EIP
→ value propagation
→ downstream memory accesses
```

判断是否出现：

- PE export directory；
- export name table；
- export ordinal table；
- function RVA table；
- hash-based API lookup；
- string-based API lookup；
- PEB loader-list traversal；
- GetProcAddress-like resolver；
- LoadLibrary-like resolver。

不要仅因访问 kernel32 就称为 resolver。

必须有结构证据。

输出：

```text
result/kernel32-consumer-trace.md
result/api-resolver-candidates.csv
```

建议字段：

```text
candidate_id,entry_rva,kernel32_base_source,pe_field_reads,export_walk,name_hashing,string_compare,output_location,resolved_api,confidence,evidence
```

---

# Phase E — API resolver 识别

如果出现 export walker，至少确认它是否读取：

```text
IMAGE_DIRECTORY_ENTRY_EXPORT
IMAGE_EXPORT_DIRECTORY
AddressOfFunctions
AddressOfNames
AddressOfNameOrdinals
```

如果是 hash resolver：

- 记录 hash loop；
- 记录 rotate/add/xor 算法；
- 只对当前本地 `kernel32.dll` 导出集做离线匹配；
- 输出 candidate API 名和 confidence。

如果是字符串 resolver：

- 记录比较字符串或生成方式；
- 不扩大到无关模块。

重点关注但不要预设一定存在：

```text
LoadLibraryA/W
GetProcAddress
VirtualAlloc
VirtualProtect
VirtualFree
GetModuleHandleA/W
GetProcAddress
CreateFileA/W
ReadFile
```

如果首次出现 `ws2_32` / `WSAStartup` / `socket` / `connect` / `send` / `recv`，单独记录。

输出：

```text
result/resolved-api-map.csv
```

---

# Phase F — 第一次跨 Tail B 的写入

这是本 Task 的最高价值事件之一。

一旦出现：

```text
destination ∉ 0x00819000–0x00912000
```

立即记录：

- producer EIP/RVA；
- source range；
- destination range；
- length；
- write pattern；
- target memory classification；
- raw backing；
- before/after entropy；
- block SHA-256；
- x86 instruction density；
- printable/RTTI/string density；
- API pointer density；
- 是否在 Tail A；
- 是否覆盖 Ztl slots。

不要把 block 二进制提交 Git。

输出：

```text
result/first-cross-tailb-write.md
result/materialization-events-task008.csv
```

如果整个任务都没有跨 Tail B 写入，也必须明确写：

```text
not observed
```

---

# Phase G — Tail A 与 ZtlTaskMem 监控

持续监控：

```text
Tail A 0x002CE000–0x007EA000
```

以及：

```text
0x005FC19F
0x005FC1B0
0x005FC1C1
```

如首次写入 Ztl slot：

记录：

- writer RVA；
- exact bytes length；
- resulting instruction semantic；
- jump/call target；
- target region；
- 是否三个槽位在同一阶段成组生成。

如果生成的是 thunk，只记录最小必要机器码。

输出：

```text
result/ztltaskmem-materialization.md
```

---

# Phase H — 每轮解码后做差分 anchor scan

不要只在最终状态搜索。

在每一个稳定 decode round 结束后扫描新增/变化区域。

CMS079 crypto anchors：

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

字符串/模块：

```text
List.wz
.wz
WS2_32
WSAStartup
connect
send
recv
```

结构特征：

- MSVC RTTI；
- `.?AV` / `.?AU`；
- C++ vtable-like pointer clusters；
- 大量普通函数序言；
- import thunk cluster；
- readable game strings。

输出：

```text
result/task008-anchor-timeline.csv
```

字段：

```text
round_id,region_start,region_end,anchor_type,rva,evidence,first_seen,confidence
```

---

# Phase I — 区分 protector resolver 与 game resolver

即使出现 API resolver，也不要立刻认为进入 game code。

建立分类标准：

### protector resolver 特征

- 位于 Tail B；
- 高熵、自修改；
- 少量 API；
- API 多为内存、异常、系统信息；
- 仍有 call/pop / opaque transform；
- 无 RTTI/WZ/network/game strings。

### game-like region 特征

- 大量稳定 x86 函数边界；
- RTTI/vtable；
- 普通 MSVC code density；
- WZ/resource strings；
- Winsock/imports；
- 已知 packet crypto 常量；
- Ztl exports/thunks 恢复。

输出：

```text
result/protector-vs-game-transition.md
```

---

# Phase J — 如果遇到新的 runtime dependency

允许补充真实 process metadata，但仍不附加 debugger。

可使用：

```text
VirtualQueryEx
NtQueryVirtualMemory
EnumProcessModulesEx（若权限允许）
ETW ImageLoad
```

只获取：

- module base；
- size；
- path；
- protection；
- MEM_IMAGE/MEM_PRIVATE；
- 对应磁盘文件 hash。

不读取大块真实进程内存。

如果后续 stage 依赖某个系统 DLL，允许把该 DLL 的**磁盘映像**映射到离线 emulator 的真实观测基址。

不允许伪造未加载模块。

---

# Phase K — 最低成功标准

Task 008 至少应达到：

1. Task 007 replay 可复现；
2. round #1/#2 的完整 transform 已记录；
3. 至少继续完成一个新的稳定 self-decode round，或明确定位其 blocker；
4. kernel32 base 是否被真正消费已有结论；
5. API resolver 是否出现已有结论；
6. Tail B 外写入是否出现已有结论；
7. Tail A 是否写入已有结论；
8. ZtlTaskMem 是否写入已有结论；
9. crypto/WZ/network anchor 是否出现已有结论；
10. 明确下一条路线。

---

# 最终路线

只能选择以下之一：

## Route A — Resolver reached

如果出现高置信 API resolver，但还没有 game image。

下一任务：

```text
API Resolver Reconstruction & Import Emergence
```

## Route B — Game materialization reached

如果出现 Tail A / 新 game-like block / Ztl slots / RTTI/WZ/crypto/network anchor。

下一任务进入：

```text
Game Code Boundary & CClientSocket Recovery
```

## Route C — Further protector self-decode required

如果仍只是在 Tail B 内做自修改 transform，且无 resolver / 无跨区写入。

继续追下一稳定 round，但必须指出具体新入口和 transform。

## Route D — External runtime dependency

如果自然执行依赖新的真实模块布局/ABI 状态，无法单靠当前 replay 继续，则明确 dependency，不 patch。

---

# 预期输出

尽可能生成：

```text
result/06-stage2-inplace-decode.md
result/stage2-decode-rounds.csv
result/stage2-selfmod-cfg.md
result/stage2-runtime-events.csv
result/kernel32-consumer-trace.md
result/api-resolver-candidates.csv
result/resolved-api-map.csv
result/first-cross-tailb-write.md
result/materialization-events-task008.csv
result/ztltaskmem-materialization.md
result/task008-anchor-timeline.csv
result/protector-vs-game-transition.md
```

以及可选：

```text
scripts/maple079_stage2_continue.py
```

---

# 提交要求

提交前运行：

```text
git status
git diff
```

确认没有提交：

```text
.raw/
.work/
EXE/DLL/WZ
生成的 T2/T3/T4 binary
memory dump
unpacked executable
pcap/etl/evtx
IDA/Ghidra DB
账号密码或本机隐私路径
```

建议 commit：

```text
Complete Task 008 stage2 in-place decode rounds
```

然后：

```text
git push
```

不要 force push。

最终汇报必须包含：

- Task 008 是否达到最低成功标准；
- client SHA-256；
- Task 007 replay 是否稳定复现；
- round #1/#2 exact ranges/count/transform；
- 新发现的 decode round 数量；
- 每轮 producer RVA；
- kernel32 base 第一次 consumer RVA；
- 是否出现 export walker；
- 是否出现 API resolver；
- 已解析 API 列表；
- 第一次跨 Tail B 写入是否出现；
- producer/source/destination/length；
- Tail A 是否被写；
- ZtlTaskMem 是否被写；
- 是否出现 game-like block；
- RTTI/WZ 是否命中；
- AES/IV 是否命中；
- WS2_32/connect/send/recv 是否命中；
- 最终 Route A/B/C/D；
- 生成的 result/scripts；
- commit SHA；
- push 是否成功；
- 所有 blocker。
