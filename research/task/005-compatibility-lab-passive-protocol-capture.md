# Task 005 — Compatibility Lab & Passive Protocol Capture

## 目标

基于 Task 001–004 已有结果，在**不附加调试器、不隐藏调试器、不 patch 客户端、不禁用系统安全策略、不修改 HackShield 组件**的前提下，完成两件事：

1. 精确区分当前 Windows 上的 `HSUpdate.exe -> AspINet.dll` 加载失败究竟属于文件损坏、依赖/ABI 不兼容，还是 Windows Code Integrity / application-control / reputation policy 阻止；
2. 在一个可重复、隔离的兼容性环境中，让客户端尽可能自然运行，并通过**被动网络观测**捕获真实的 CMS079 V5 客户端协议流，补齐 Task 003 没有得到的真实 `MapleStory.exe` 字节流。

本任务**不以绕过反调试或移除反作弊为目标**。如果保护层仍然阻止运行，只记录证据并转入后续静态 loader-boundary 研究。

所有最终可提交结果写入：

```text
result/
```

所有临时文件、抓包、事件日志导出、VM 中间产物、工具数据库、原始网络流统一放在：

```text
.work/task-005/
```

`.raw/` 只读。

---

# 已知事实

执行前以仓库已有结果为准，不要重新猜测：

- 当前 `MapleStory.exe` SHA-256：

```text
5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d
```

- 当前主程序存在独立 loader/protector，调试器附着会在 WinSock 和 `ehsvc.dll` 加载之前触发运行时异常并退出；
- `RVA 0x00862E76` / `0x00862FB0` 没有磁盘 raw backing，是运行时生成/解密区域；
- `Dapan.exe:17890` 已确认属于本机 VPN/mihomo 代理，不是游戏专用 helper，也没有证据表明它把游戏转发到 `9555`；
- 登录服真实端口为 `127.0.0.1:9555`，频道服为 `7575–7578`，商城为 `8600`；
- 握手是 15 字节明文，固定前缀：

```text
0D 00 4F 00 00 00 46 72 7A
```

- `scripts/maple079_packet.py` 已在 Task 004 修复 1456/1460 分块错误，并与服务端 Java 实现完成长包 cross-check；
- 当前 `HShield/AspINet.dll` 是后期修改文件，版本资源显示“079过HS DLL 应用组件”；
- 当前 `HShield/ehsvc.dll` 的 ProductName 为 `HSBypass`；
- `HSUpdate.exe` 运行时曾出现 `AspINet.dll` “损坏的映像”窗口，错误状态：

```text
0xC0E90008
```

---

# 执行边界

1. 不修改 `.raw/` 中的任何文件。
2. 不 patch `MapleStory.exe`、`HSUpdate.exe`、`AspINet.dll`、`ehsvc.dll` 或其他组件。
3. 不隐藏 debugger，不使用 anti-anti-debug 插件，不伪造 PEB/debug flags。
4. 本任务不需要附加 debugger；不要为了取得 caller RVA 重试 Task 003 的调试器方案。
5. 不禁用 Smart App Control、Code Integrity、Defender、AppLocker 或其他系统安全功能来“让文件通过”。
6. 不修改 Windows policy、注册表或启动策略去放行被拒绝的 DLL。
7. 不使用来源不明的 patched/bypass DLL 替换现有文件。
8. 不让旧客户端、HackShield updater 或未知工具访问公网。
9. 兼容性 VM 必须使用合法、可信的系统安装介质，并保持离线或 host-only；不要给旧系统直接公网访问。
10. 如果使用测试账号，必须是一次性账号和一次性密码；最终结果中账号、密码、MAC 等写成 `<redacted>`。
11. pcap / etl / evtx / dump / 原始二进制只放 `.work/task-005/`，禁止提交 Git。
12. 如果任何步骤需要降低系统安全性才能继续，停止该步骤并记录 blocker。

---

# 阶段 A：环境与样本确认

记录当前宿主机：

- Windows edition / build；
- x64 / ARM64；
- PowerShell 版本；
- Python 版本；
- 是否安装 Wireshark/Npcap；
- 是否安装 Windows Performance Recorder / pktmon；
- 当前是否运行 VPN / proxy / traffic redirector；
- 客户端和服务端 SHA-256。

确认：

```text
MapleStory.exe SHA-256
5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d
```

确认 Task 004 修正后的 packet codec 自检通过：

```text
python scripts/maple079_packet.py selftest
```

如果失败，先记录，不要继续拿它解真实流量。

---

# 阶段 B：`0xC0E90008` / Code Integrity 定性

本阶段只观察，不修改 Windows security policy。

## B1. 记录精确时间

自然复现一次：

```text
HSUpdate.exe -> AspINet.dll
```

的错误窗口。

记录：

- 本地时间；
- `HSUpdate.exe` PID（若可得）；
- `AspINet.dll` 完整路径；
- 错误状态；
- 窗口原文的文本转录。

不要反复触发。

## B2. CodeIntegrity 日志

检查：

```text
Applications and Services Logs
  Microsoft
    Windows
      CodeIntegrity
        Operational
```

可使用 Event Viewer 或只读 PowerShell：

```powershell
Get-WinEvent -LogName 'Microsoft-Windows-CodeIntegrity/Operational'
```

只筛选错误发生前后约 5 分钟。

重点记录：

- Event ID；
- timestamp；
- status / policy 信息；
- 被引用的 image path；
- signer / signature 信息；
- 是否明确指向 `AspINet.dll`；
- 是否有 3076 / 3077 / 3089 或其他直接相关事件。

不要假设一定存在这些 Event ID，以实际日志为准。

同时检查与同一时间点直接相关的：

```text
AppLocker
Windows Defender
Smart App Control / App Control
Application Error
```

只保存与 `HSUpdate.exe` / `AspINet.dll` 明确关联的条目。

原始 EVTX 放：

```text
.work/task-005/events/
```

最终只提交脱敏后的摘要。

## B3. 当前 policy 状态

如果系统自带：

```text
citool.exe
```

只读取当前 policy 列表/状态，不修改：

```text
citool.exe -lp
```

记录是否存在 active/enforced application-control policy。

不要调用任何用于移除、关闭或替换 policy 的参数。

输出：

```text
result/code-integrity-findings.md
```

最终判断使用：

```text
confirmed policy block
probable policy block
PE/dependency incompatibility more likely
insufficient evidence
```

---

# 阶段 C：HSUpdate / AspINet 静态加载链

对以下文件做只读静态检查：

```text
HShield/HSUpdate.exe
HShield/AspINet.dll
HShield/AhnUpCtl.dll
HShield/HSInst.dll
HShield/ehsvc.dll
HShield/ehsvc.old
```

至少记录：

- SHA-256；
- PE Machine；
- PE32/PE32+；
- Subsystem；
- ImageBase；
- EntryPoint；
- sections；
- imports；
- delay imports；
- exports；
- TLS；
- load config；
- relocations；
- Authenticode；
- version resources；
- manifest；
- obvious malformed-PE indicators。

重点回答：

1. `AspINet.dll` 是不是结构上有效的 PE32；
2. 是否有缺失依赖 DLL；
3. `HSUpdate.exe` 是否静态/动态引用 `AspINet.dll`；
4. `HSUpdate.exe` 若按函数名或 ordinal 调用 `AspINet.dll`，当前 DLL 是否提供这些 exports；
5. `AspINet.dll` 和同目录 AhnLab 原始组件是否存在 CRT/OS/API-set 时代不匹配；
6. 失败更像 Windows policy 拒绝，还是 Windows loader 的格式/依赖错误。

可使用：

- `dumpbin`；
- `llvm-readobj` / `llvm-objdump`；
- `pefile`；
- Dependencies；
- `sigcheck`；
- PowerShell Authenticode cmdlets；
- strings。

不要把 Dependencies 的自动“缺失 API-set”提示直接视为真实缺依赖，需结合 OS loader 语义判断。

输出：

```text
result/hshield-load-chain.md
```

---

# 阶段 D：干净的当前 Windows 被动运行实验

目标：不附加 debugger，仅判断客户端在去掉本机网络干扰后是否会自然连接游戏服务。

## D1. 消除本机代理干扰

Task 004 已确认 `Dapan.exe:17890` 属于 VPN/mihomo。

如果用户允许，正常退出 VPN/proxy 应用本身，不 kill 文件、不删除配置、不修改系统代理注册表。

记录实验前：

```powershell
Get-NetTCPConnection
```

确认 `17890` 是否仍有 listener。

如果 VPN 不能正常退出，则记录并继续，但必须把 17890 流量标成环境噪声。

## D2. 启动本地服务端

只运行本地测试服务：

```text
login    127.0.0.1:9555
channel  127.0.0.1:7575-7578
cashshop 127.0.0.1:8600
```

确认监听者 PID 与服务端进程一致。

数据库只绑定 localhost。

禁止服务端和客户端访问公网。

## D3. 被动观察客户端

无 debugger 启动：

```text
MapleStory.exe 127.0.0.1 9555
```

持续观察约 30–60 秒，记录：

- process tree；
- loaded image timeline（若能被动获取）；
- TCP connection timeline；
- 9555 是否连接；
- 是否连接 7575–7578；
- 是否出现 8600；
- 是否出现非 localhost 连接；
- HSUpdate / AhnLab helper 是否启动；
- 是否弹出 `AspINet.dll` 错误；
- 客户端是否显示登录 UI / 黑屏 / 退出。

不附加 debugger，不注入，不 hook。

输出事件表：

```text
result/compatibility-runtime-events.csv
```

字段建议：

```text
time
process
pid
event
local_endpoint
remote_endpoint
image_path
status
notes
```

---

# 阶段 E：兼容性 VM 实验

只有在当前 Windows 无法自然进入游戏网络阶段时执行。

目标不是“寻找更弱的安全系统”，而是判断这套 2009–2017 混合组件在其历史时期环境中是否能**自然运行**。

## E1. VM 原则

建议优先：

```text
Windows 7 SP1 x86
```

如已有合法 Windows 10 早期/32-bit 测试 VM，也可作为第二个环境，但不是必需项。

要求：

- 使用可信安装介质；
- 建立 VM snapshot；
- 不接公网；
- 使用 host-only / internal network；
- 最好把 CMS079 服务端和客户端都运行在同一 VM 内，使 `127.0.0.1` 语义保持不变；
- 不安装 debugger 隐身工具；
- 不关闭系统自身已有安全机制；
- 不使用第三方 bypass patch。

如果旧系统无法支持当前服务端 Java/MySQL，可将它们放在同一个隔离网络中的另一台 VM，但必须明确记录地址变化；不要修改客户端二进制。

## E2. 对比测试

在 VM 中重复：

1. 样本哈希确认；
2. 启动本地服务端；
3. 无 debugger 启动客户端；
4. 观察 `HSUpdate.exe / AspINet.dll`；
5. 观察是否连接 9555；
6. 观察是否能看到登录界面；
7. 只使用一次性测试账号。

至少比较：

```text
Current Windows
vs
Windows 7 SP1 x86 VM
```

生成：

```text
result/compatibility-matrix.csv
```

建议字段：

```text
environment
os_build
arch
aspinet_load
code_integrity_event
client_window
login_9555
channel_connect
result
notes
```

如果 VM 也出现同类失败，不要继续尝试替换 HS DLL。

---

# 阶段 F：被动 TCP 捕获

只有客户端自然连接 `9555` 时执行。

允许：

- Wireshark + Npcap loopback；
- pktmon；
- ETW/WPR TCP/IP provider；
- 其他只读/被动捕获方式。

优先过滤：

```text
tcp.port == 9555
or tcp.port in 7575-7578
or tcp.port == 8600
```

不要捕获整个机器的长期流量。

原始抓包：

```text
.work/task-005/capture/
```

禁止提交 pcap/etl。

## F1. 登录连接

按 TCP stream 重组，不按单个 packet 假定协议边界。

寻找：

```text
0D 00 4F 00 00 00 46 72 7A
```

如果找到完整 15-byte handshake：

- 记录 TCP stream id；
- version；
- locale；
- client-send IV；
- client-recv IV；
- timestamp；
- server endpoint。

只提交握手这类不含凭据的短样例。

## F2. 解第一条 C->S

使用当前修正后的：

```text
scripts/maple079_packet.py
```

从握手 IV 开始，按包顺序维护 state。

第一条 C->S 业务包应验证为：

```text
LOGIN_PASSWORD = 0x0001
```

不要把解密后的账号、密码、MAC 写入结果。

结果中只记录：

- opcode；
- packet length；
- 字段长度/类型；
- 账号/密码/MAC = `<redacted>`；
- next IV。

## F3. 解第一条 S->C

至少确认一个：

```text
LOGIN_STATUS 0x0000
SERVERLIST   0x0009
CHARLIST     0x000A
SERVER_IP    0x000B
```

记录：

- direction；
- opcode；
- length；
- server-side expected handler/builder；
- 与 Task 002 是否一致。

## F4. Channel migration

如果能完成选角：

验证：

```text
SERVER_IP 0x000B
  ↓
disconnect :9555
  ↓
connect :7575-7578
  ↓
new 15-byte handshake
  ↓
PLAYER_LOGGEDIN 0x000B
  ↓
WARP_TO_MAP 0x0081
```

频道连接必须使用新 handshake 的 IV，不复用登录连接 IV。

输出：

```text
result/protocol-session-events.csv
result/passive-protocol-capture.md
```

`protocol-session-events.csv` 建议字段：

```text
session
seq
time
direction
endpoint
raw_length
stage
opcode_hex
opcode_name
iv_before
iv_after
verified_against_server
notes
```

不提交原始 packet payload。

---

# 阶段 G：可选 stream 辅助脚本

如有需要，可以新增：

```text
scripts/maple079_stream.py
```

用途限定为：

- 从已经导出的单条 TCP payload stream 读取 bytes；
- 找 15-byte handshake；
- 按 4-byte header + length 切包；
- 调用 `maple079_packet.py` 解包；
- 维护两个方向 IV；
- 输出 opcode/length/state；
- 支持 `--redact-login`，默认不输出登录字段明文。

不要让脚本主动连接第三方服务器，不做 MITM，不做 packet injection。

如果新增脚本，必须增加最小离线测试。

---

# 阶段 H：结论与下一阶段决策

最终根据证据选择一条：

## Route A — Passive network succeeded

如果已经自然捕获并解码真实客户端流：

```text
Task 006 = Runtime-independent protocol/state reconstruction
```

优先继续建立客户端行为 ↔ opcode ↔ 服务端 handler 的完整关联，不急着处理 debugger。

## Route B — Compatibility VM works, current Windows does not

如果旧兼容环境可自然工作：

```text
Task 006 = Compatibility-VM passive protocol mapping
```

在 VM 中继续被动协议研究；不要为了让现代宿主兼容而降低安全策略。

## Route C — Neither environment reaches 9555

如果两个环境都不能进入游戏网络，而 blocker 仍在 loader/protection 阶段：

```text
Task 006 = Static loader-boundary analysis
```

继续静态研究入口 stub 如何把 packed data materialize 到虚拟区，不做 anti-debug bypass。

---

# 最终产物

本任务尽可能生成：

```text
result/
├── 03-compatibility-passive-capture.md
├── code-integrity-findings.md
├── hshield-load-chain.md
├── compatibility-runtime-events.csv
├── compatibility-matrix.csv
├── passive-protocol-capture.md
└── protocol-session-events.csv
```

可选：

```text
scripts/maple079_stream.py
```

如果某一步未发生，对应文件仍可生成并明确写：

```text
not observed
blocked
not applicable
```

不要制造虚假成功结果。

---

# `03-compatibility-passive-capture.md` 建议结构

```markdown
# Task 005 — Compatibility Lab & Passive Protocol Capture

## 1. Environment
## 2. Sample Verification
## 3. Code Integrity Findings
## 4. HSUpdate / AspINet Load Chain
## 5. Current Windows Passive Run
## 6. Compatibility VM
## 7. Login TCP Session
## 8. Handshake
## 9. C->S Decode
## 10. S->C Decode
## 11. Channel Migration
## 12. Uncertainties
## 13. Security / Isolation Notes
## 14. Recommended Task 006
## 15. Reproduction Commands
```

---

# 最低成功标准

Task 005 至少应完成：

- 确认 `MapleStory.exe` 哈希；
- packet codec selftest 通过；
- 对 `0xC0E90008` 给出 evidence-based 定性；
- 完成 `HSUpdate.exe -> AspINet.dll` 静态加载链检查；
- 在当前 Windows 做一次无 debugger 被动运行；
- 如果当前 Windows 被阻断，完成至少一个隔离兼容性 VM 对比；
- 对 `9555` 是否真实连接给出明确证据；
- 若有 9555 流量，至少恢复 handshake，并解码一条 C->S 和一条 S->C；
- 明确选择下一阶段 Route A / B / C。

“没有网络连接”仍可以算任务完成，只要 blocker 被清楚定位并有可复现证据。

---

# 最终质量检查

提交前检查：

1. `.raw/` 未修改；
2. `.work/` 未进入 Git；
3. 没有 EVTX / ETL / PCAP；
4. 没有 EXE / DLL / JAR / WZ；
5. 没有 Windows VM 文件；
6. 没有第三方 binary；
7. 没有用户名、密码、MAC、token；
8. 没有公网 IP 等不必要隐私信息；
9. 没有关闭安全策略的操作记录作为“解决方案”；
10. 没有 anti-debug bypass / HackShield patch；
11. CSV / Markdown 可读；
12. 新增脚本通过离线自测。

然后执行：

```text
git status
git diff
```

提交：

```text
Complete Task 005 compatibility lab and passive protocol capture
```

然后正常：

```text
git push
```

不要 force push，不要改写历史。

---

# 最终汇报

执行完成后汇报：

- Task 005 是否达到最低成功标准；
- 当前宿主 Windows build；
- `0xC0E90008` 最终判断；
- CodeIntegrity 是否有明确关联事件；
- `AspINet.dll` PE/依赖是否正常；
- 当前 Windows 无 debugger 运行结果；
- VPN/proxy 干扰是否已排除；
- 兼容性 VM OS/arch；
- VM 中 `AspINet.dll` 是否加载；
- VM 中是否连到 9555；
- 是否捕获真实 15-byte handshake；
- 两个 IV；
- 第一条 C->S opcode；
- 第一条 S->C opcode；
- 是否完成 channel migration；
- 是否验证 `PLAYER_LOGGEDIN 0x0B`；
- 是否验证 `WARP_TO_MAP 0x81`；
- 是否新增 `maple079_stream.py`；
- 最终选择 Route A / B / C；
- 生成了哪些结果文件；
- commit SHA；
- push 是否成功；
- 所有 blocker 与未完成项。
