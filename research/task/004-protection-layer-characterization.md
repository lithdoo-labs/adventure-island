# Task 004 — Protection Layer Characterization & Reference Diff

## 目标

基于 Task 001–003 已有结果，对当前 CMS079 V5 客户端的 **loader / protector / anti-debug / HackShield / 本地辅助进程** 做一次受控、可复现的识别与边界划分。

本任务不是“去除反作弊”，也不是“绕过反调试”。目标是回答：

1. `MapleStory.exe` 的异常节、入口和运行时异常分别属于哪一层；
2. `RVA 0x862E76` 与 `RVA 0x862FB0` 附近代码的静态性质是什么；
3. 调试器附着触发的退出发生在 loader、protector、HackShield 初始化还是其他本地包装层；
4. `HShield/`、`ASPLnchr.exe`、`aossdk.dll`、`ehsvc.*`、`pg.dll` 等组件和主程序之间有什么静态依赖关系；
5. 无调试器运行时观察到的 `127.0.0.1:17890` 与 `Dapan.exe` 是什么角色；
6. 是否存在本地 helper / launcher / proxy，把 MapleStory 和登录服 `127.0.0.1:9555` 隔开；
7. 是否能找到可信的 CMS079 / v79 reference client、localhost client、IDB、符号或相邻版本样本，用于结构差分；
8. 如果存在 reference，哪些函数、常量、代码区可以映射回当前 V5；
9. 当前样本真正的游戏代码区域大致在哪里；
10. 下一阶段应该继续静态差分、被动运行时观测，还是已经可以重新进入网络函数恢复。

所有最终可提交结果写入：

```text
result/
```

所有临时文件、反编译数据库、缓存、抓包、第三方样本、memory snapshot 等统一放在：

```text
.work/task-004/
```

`.raw/` 只读。

---

# 安全与执行边界

1. 不修改原始 `MapleStory.exe`。
2. 不 patch 保护判断、反调试判断、完整性判断或网络判断。
3. 不隐藏 debugger，不使用 anti-anti-debug 插件或调试器隐身方案。
4. 不禁用、卸载、替换或伪造 HackShield / AhnLab 组件。
5. 不制作或提交 bypass client、unpacked client、patched client。
6. 不修改 `ehsvc.dll`、`ASPLnchr.exe`、`aossdk.dll` 等保护组件来改变行为。
7. 不尝试伪造保护服务、驱动或响应协议。
8. 可以做静态反汇编、反编译、字符串、PE、签名、哈希、节区、xref、call graph 分析。
9. 可以做**被动**运行时观测：进程树、模块、TCP 连接、文件/注册表访问、ETW/Procmon/pktmon/Wireshark loopback 等；不要通过隐藏或规避保护来保持进程存活。
10. 如果调试器附着再次触发相同退出，只记录一次并停止重复实验。
11. 从互联网取得的 reference binary 只能放 `.work/task-004/reference/`，不要提交 Git；记录来源 URL、文件名、大小和 SHA-256 即可。
12. 不下载或使用明显面向作弊、盗号、恶意注入的工具或样本。

---

# 已知事实

开始前阅读：

```text
README.md
result/00-baseline.md
result/01-server-baseline.md
result/02-runtime-network-bootstrap.md
result/server-topology.md
result/protocol-handshake.md
result/protocol-crypto.md
result/client-server-correlation.md
result/client-reverse-targets.md
result/runtime-module-map.txt
result/runtime-network-events.csv
result/runtime-crypto-anchors.md
result/client-function-candidates.csv
scripts/maple079_packet.py
```

当前客户端 SHA-256：

```text
5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d
```

Task 001 已知：

```text
PE32 x86
ImageBase = 0x00400000
EntryPoint RVA = 0x009D8000
Entry section = jtrppsow
static import = kernel32!GetLocalTime only
```

异常大虚拟节：

```text
RVA 0x00819000 ... 约 0x00912000
RawSize 4 KB
VirtualSize 约 1 MB
EXECUTE + READ + WRITE
```

Task 003 中，调试环境下重复观察到：

```text
STATUS_ILLEGAL_INSTRUCTION
VA  0x00C62E76
RVA 0x00862E76

STATUS_PRIVILEGED_INSTRUCTION
VA  0x00C62FB0
RVA 0x00862FB0

process exit = 0xFFFF9108
```

32-bit 与 64-bit 调试宿主都得到相同两个主模块 RVA。

此时：

```text
ws2_32.dll 尚未加载
```

无调试器运行时观察到：

```text
MapleStory.exe -> 127.0.0.1:17890
listener / peer process: Dapan.exe
```

尚未观察到真实 `MapleStory.exe -> 127.0.0.1:9555`。

---

# 阶段 A — 修正 packet codec 的长包验证

这一步和保护层独立，但必须先把研究工具可信度补齐。

检查：

```text
scripts/maple079_packet.py
```

尤其核对 `MapleAESOFB.crypt` 的 1456 / 1460 分段行为。

不要只做 Python 自己的：

```text
encrypt -> decrypt -> compare
```

因为相同实现错误可能对称抵消。

必须和 Task 002 服务端 JAR 中实际 `MapleAESOFB` 做 cross-implementation test。

至少测试正文长度：

```text
1
2
15
16
17
1455
1456
1457
1459
1460
1461
2915
2916
2917
3000
```

固定同一 IV 和同一明文模式，比较：

```text
Java implementation ciphertext
Python implementation ciphertext
next IV
packet header
```

如果发现差异：

- 修正 `scripts/maple079_packet.py`；
- 记录 bug 原因；
- 增加测试；
- 不覆盖 Task 002 的协议结论，除非服务端实际代码证明确实需要修正。

输出：

```text
result/packet-codec-crosscheck.md
```

---

# 阶段 B — 保护组件 inventory

从客户端包重新建立 protection-oriented inventory。

重点文件：

```text
MapleStory.exe
ASPLnchr.exe
aossdk.dll
bz32ex.dll
HShield/**
HShield/ehsvc.dll
HShield/ehsvc.old
pg.dll
SkinH_EL.dll
冒险岛HS修正工具.exe
Dapan.exe    # 如果实际文件存在，先定位真实路径
```

对每个文件记录：

```text
path
size
sha256
PE machine
ImageBase
EntryPoint
sections
imports
exports
version resources
company/product
PDB path
Authenticode
strings of interest
```

重点寻找静态引用：

```text
HShield
AhnLab
ehsvc
ASPLnchr
aossdk
CreateProcess
ShellExecute
LoadLibrary
GetProcAddress
OpenProcess
CreateService
StartService
DeviceIoControl
\\.\
Dapan
17890
localhost
127.0.0.1
```

不要因为出现这些 API 就推断具体行为；必须给出 xref / 调用上下文。

输出：

```text
result/protection-component-map.md
```

---

# 阶段 C — 静态分析两个固定异常 RVA

重点分析：

```text
RVA 0x00862E76
RVA 0x00862FB0
```

对应 VA（ImageBase 0x00400000）：

```text
0x00C62E76
0x00C62FB0
```

要求：

1. 从磁盘 PE 映射关系判断这两个 RVA 是否有对应 raw bytes；
2. 如果 RVA 位于 VirtualSize > RawSize 的零填充范围，要明确指出磁盘文件里没有真实代码字节；
3. 如果有 raw bytes，保存附近小范围 hex / disassembly 到文档，不提交大量二进制；
4. 检查它们是否位于 Task 001 的异常 RWX 节；
5. 计算距离节起点、入口点的偏移；
6. 分析异常类型是否更像保护层故意触发、运行时解码失败或正常 CPU 特性探测；
7. 不尝试修改异常指令来继续执行。

如果磁盘文件中该 RVA 没有对应代码，明确结论：

```text
runtime-generated / unpacked / decrypted code required to explain this RVA
```

但不要因此制作 unpacked executable。

输出：

```text
result/protection-rva-analysis.md
```

---

# 阶段 D — Loader / game-code 边界建模

使用 PE 节区、exports、可识别普通 DLL、历史 PDB 字符串、运行时 module timeline 等信息，把主程序地址空间分成候选区域：

```text
static packed/protected data
loader/protector code
runtime scratch / generated code
possible original MapleStory code
resources
```

特别利用三个导出 RVA：

```text
ZtlTaskMemAllocImp   RVA 0x005FC19F
ZtlTaskMemFreeImp    RVA 0x005FC1B0
ZtlTaskMemReallocImp RVA 0x005FC1C1
```

分析它们附近是否能看出正常 MSVC/C++ 函数形态，作为“真实原始代码可能存在的区域”锚点。

也可以比较：

```text
Canvas.dll
PCOM.dll
ResMan.dll
Gr2D_DX8.dll
```

中的编译器模式、RTTI、异常处理、调用约定，建立同年代 Wizet/Nexon C++ 代码的参考形态。

输出：

```text
result/client-address-space-model.md
```

建议表：

```text
RVA start
RVA end
section/runtime region
classification
confidence
evidence
```

---

# 阶段 E — Dapan.exe / 17890 被动拓扑

这是本任务最高优先级之一。

目标不是逆向并修改 Dapan，而是确认它在 V5 运行架构中的角色。

先回答：

1. `Dapan.exe` 的真实文件路径在哪里；
2. 是否来自客户端目录、系统目录、临时目录或其他软件；
3. 谁创建/启动它；
4. 它和 `MapleStory.exe` 的父子进程关系；
5. 谁监听 `127.0.0.1:17890`；
6. MapleStory 是 client 还是 server side；
7. Dapan 是否另外连接：
   - `127.0.0.1:9555`
   - `7575-7578`
   - `8600`
   - 其他 localhost 端口
   - 公网地址；
8. 17890 连接是在启动早期、登录前还是持续整个进程生命周期；
9. 如果只用被动抓包，17890 上数据是明文、Maple 协议握手、其他 framing，还是没有应用层数据。

允许使用非侵入式：

```text
Get-CimInstance Win32_Process
Get-NetTCPConnection
netstat -ano
Process Explorer
Process Monitor
pktmon
Wireshark/Npcap loopback
ETW/WPR
```

如工具不存在，使用可用替代方案。

不注入 DLL，不 hook，不修改 Dapan，不劫持 17890。

只提交短小的协议特征和统计，不提交大型 pcap。

输出：

```text
result/local-helper-topology.md
result/passive-network-topology.csv
```

目标最终形成类似：

```text
MapleStory.exe
  -> 127.0.0.1:17890
       -> Dapan.exe
            -> ?
```

或者证伪这条链。

---

# 阶段 F — 参考样本与历史资料搜集

允许搜索互联网公开资料，但必须记录来源与可信度。

优先关键词：

```text
CMS079 MapleStory localhost
CMS v79 localhost
China MapleStory 079 client
CMS079 unpack
CMS079 IDB
MapleStory v79 IDB
MapleStory 079 Ghidra
MapleStory 079 symbols
MapleStory HackShield 079
MapleStory Themida 079
```

优先来源：

- GitHub；
- RaGEZONE 历史逆向讨论；
- 公开 archive / forum mirror；
- 已知 MapleStory reverse-engineering repositories。

对每个 reference 记录：

```text
name
claimed version/region
source URL
published date if known
file name
size
sha256 if downloaded
PE timestamp
ImageBase
EntryPoint
imports
sections
confidence that it is actually CMS079
```

不要仅凭文件名认定版本。

如果下载 reference binary：

```text
.work/task-004/reference/
```

不要提交到 Git。

输出：

```text
result/cms079-reference-index.md
```

---

# 阶段 G — Reference Diff

只有在拿到可信 reference 后执行。

优先比较结构，不做 patch：

```text
file size
PE sections
ImageBase
SizeOfImage
imports
exports
resources
strings
RTTI
function signatures
code hashes
basic-block fingerprints
```

重点尝试映射：

```text
ZtlTaskMemAllocImp / Free / Realloc
socket/network-related code
Maple AES constants
IV shuffle table
WZ resource strings
PCOM/ResMan interactions
WinMain / application init
```

如果 reference 带 IDB / MAP / symbol list：

- 不直接相信地址相同；
- 用函数字节签名、字符串、call graph 交叉验证；
- 记录 source RVA 和 target candidate RVA；
- 给 confidence。

输出：

```text
result/reference-diff.md
result/reference-function-map.csv
```

字段建议：

```text
reference_name
reference_rva
reference_symbol
v5_candidate_rva
match_method
evidence
confidence
```

---

# 阶段 H — HackShield 静态依赖关系

目标只做“谁加载谁”的静态关系，不分析如何绕过。

建立：

```text
MapleStory.exe
ASPLnchr.exe
HShield DLLs
services/helpers
config files
```

之间可能的：

```text
imports
LoadLibrary references
CreateProcess references
config references
file path references
registry references
```

特别对比：

```text
HShield/ehsvc.old
HShield/ehsvc.dll
```

Task 001 已知：

- `ehsvc.old` 有 AhnLab EHSvc PDB；
- 当前 `ehsvc.dll` 的版本资源 ProductName 为 `HSBypass`。

本任务要回答：

```text
这两个文件是否 ABI / exports / imports 相似？
当前 V5 是否只是替换了某一个保护组件？
主程序是否仍保留其他独立保护层？
```

不要执行或替换它们。

输出放入：

```text
result/protection-component-map.md
```

---

# 阶段 I — 是否存在 Themida / 其他 protector 的证据

允许使用：

```text
Detect It Easy
PE-sieve 的静态/扫描能力（不要用于绕过）
YARA identification rules
strings
section signatures
entrypoint pattern
public packer-identification references
```

最终结论只能写成：

```text
confirmed
probable
possible
unsupported
```

必须给证据。

不要因为 CMS079 历史帖子提过 Themida 就直接把当前样本标成 confirmed Themida。

输出：

```text
result/protector-identification.md
```

---

# 阶段 J — 重新评估 Task 003

根据本任务结果判断下一步。

只允许以下三种推荐之一：

## 路径 1：Reference-first

如果找到可信 CMS079 unpacked/reference：

```text
reference diff
-> symbol/signature mapping
-> recover CClientSocket / packet codec candidates
```

## 路径 2：Passive-topology-first

如果 17890 / Dapan 是关键中间层：

```text
MapleStory <-> local helper <-> 9555
```

则下一阶段优先研究这个合法本地协议边界，而不是强行附着 MapleStory。

## 路径 3：Static-loader-boundary-first

如果既没有 reference，也没有 helper 转发：

继续静态识别 loader 和可能的 game-code 区域，但仍不通过隐藏 debugger 或 patch 保护来继续运行。

不要推荐“绕过反调试后再说”作为默认下一步。

---

# 最终产物

尽可能生成：

```text
result/
├── packet-codec-crosscheck.md
├── protection-component-map.md
├── protection-rva-analysis.md
├── client-address-space-model.md
├── local-helper-topology.md
├── passive-network-topology.csv
├── cms079-reference-index.md
├── protector-identification.md
├── reference-diff.md                 # 有 reference 时
└── reference-function-map.csv        # 有 reference 时
```

可以增加必要的 Markdown / CSV / JSON / text 文件。

不要覆盖 Task 001–003 的历史结果；如果需要修正 `scripts/maple079_packet.py`，可以直接更新脚本，并在 crosscheck 文档记录原因。

---

# 最低成功标准

至少完成：

1. `maple079_packet.py` 长包算法经过 Java cross-check；
2. 两个异常 RVA 的磁盘/虚拟映射关系明确；
3. 形成 protection component map；
4. 对 `Dapan.exe:17890` 给出可证实的进程/网络关系，或明确说明无法复现；
5. 对当前样本的 protector 给出 evidence-based 分类；
6. 搜集至少一批 CMS079/v79 reference 资料并评估可信度；
7. 给出下一阶段三条路径中的明确选择。

不要求本任务恢复 `CClientSocket`。

---

# 提交前检查

确认：

- `.raw/` 未修改；
- `.work/` 未提交；
- 没有 reference binary 进入 Git；
- 没有 memory dump / pcap / debugger DB 进入 Git；
- 没有密码、账号、密钥等私人信息；
- 没有 patched / bypassed executable；
- 所有外部 reference 有 URL 和 hash/metadata（如果取得样本）；
- 所有推断标明 confidence。

完成后建议提交：

```text
Complete Task 004 protection layer characterization
```

然后正常：

```text
git push
```

不要 force push。
