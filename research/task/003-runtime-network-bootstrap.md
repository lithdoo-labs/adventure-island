# Task 003 — 客户端 Runtime Network Bootstrap

## 目标

基于 Task 001 的客户端基线和 Task 002 已恢复的真实 V5 服务端协议，对：

```text
.raw/怀旧岛079V5客户端.rar
```

进行一次**受控、可复现的运行时网络边界分析**。

本任务的目标不是完整脱壳，也不是处理 HackShield / anti-cheat，而是把客户端从：

```text
connect
  ↓
15-byte plaintext handshake
  ↓
crypto initialization
  ↓
login packet encode/send
  ↓
packet recv/decode
  ↓
opcode dispatch
  ↓
channel migration
  ↓
enter field
```

这一条主链路跑通，并恢复第一批高置信度客户端函数候选地址。

最终至少希望识别下列语义目标中的一部分：

```text
CClientSocket::Connect
CClientSocket::SendPacket
CClientSocket::OnRead
PacketHeader::Encode / Decode
PacketLength::Decode
MapleCrypto::Encrypt
MapleCrypto::Decrypt
MapleCrypto::UpdateIV
CInPacket::Decode1 / Decode2 / Decode4 / DecodeStr
COutPacket::Encode1 / Encode2 / Encode4 / EncodeStr
PacketDispatcher
Login-stage packet handler
Channel migration handler
```

这些名称是研究命名，不要求与 Nexon 原始符号一致。

---

# 已知协议真值

本任务必须优先使用仓库中 Task 002 的结果，而不是套用其他版本资料：

```text
result/server-topology.md
result/protocol-handshake.md
result/protocol-crypto.md
result/protocol-flow-login-to-field.md
result/protocol-opcodes.csv
result/client-server-correlation.md
result/client-reverse-targets.md
```

当前已确认：

```text
login:      127.0.0.1:9555
channel:    127.0.0.1:7575-7578
cash shop:  127.0.0.1:8600
```

登录/频道连接的第一条服务端数据是 15 字节明文握手：

```text
0D 00 4F 00 00 00 46 72 7A RR 52 30 78 SS 04
```

其中：

```text
46 72 7A RR = client-send IV / server-recv IV
52 30 78 SS = client-recv IV / server-send IV
```

核心协议链：

```text
LOGIN_PASSWORD       C->S 0x01
LOGIN_STATUS         S->C 0x00
SERVERLIST_REQUEST   C->S 0x02
SERVERLIST           S->C 0x09
CHARLIST_REQUEST     C->S 0x09
CHARLIST             S->C 0x0A
CHAR_SELECT          C->S 0x0A
SERVER_IP            S->C 0x0B
PLAYER_LOGGEDIN      C->S 0x0B
WARP_TO_MAP          S->C 0x81
```

握手之后的业务包在线上是：

```text
[4-byte encrypted packet header][ciphertext]
```

**注意：在 `send` / `WSASend` 或业务阶段 `recv` / `WSARecv` 边界看到的是密文，不应期待直接看到 `01 00`、`00 00` 等明文 opcode。**

---

# 执行约束

1. 只分析自己本地持有的客户端和服务端副本。
2. 使用隔离的 Windows 测试环境；优先虚拟机或专用研究环境。
3. 测试网络限制为 localhost。阻止客户端和服务端访问公网；如果发现外联尝试，只记录目标并保持阻断。
4. 使用一次性测试账号，不使用真实账号或常用密码。
5. 不把账号、密码、MAC、数据库密码、session token 等敏感值写入 Git；结果中统一写 `<redacted>`。
6. `.raw/` 保持只读。任何解压、数据库、运行时日志、中间 dump、调试器数据库放在 `.work/task-003/`。
7. 不修改原始 `MapleStory.exe`。
8. 不 patch、禁用、绕过或移除 HackShield、anti-cheat、protector、完整性检查。
9. 如果客户端因为保护组件、兼容性或运行环境无法进入游戏逻辑，记录阻塞点并保留已取得的网络/模块/内存证据，不强行绕过。
10. 不提交完整 process dump、memory dump、EXE、DLL、JAR、WZ、数据库文件或原始封包大批量内容。
11. 可以使用调试器观察正常执行流、系统 WinSock API、调用栈、内存中的已解密业务数据和自己进程的模块映射。
12. 可以将少量必要的 packet hex 写入结果，但必须脱敏，并且只保留足以证明协议阶段的短样例。

---

# 阶段 A：运行环境与样本准备

建立：

```text
.work/task-003/
├── client/
├── server/
├── runtime/
├── packets/
├── debugger/
└── logs/
```

从 `.raw/` 解压工作副本，不修改原始归档。

确认主客户端 SHA-256 仍然是 Task 001 的：

```text
5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d
```

如果不一致，停止将已有地址结论套到新文件，并在结果中记录差异。

服务端优先复用 Task 002 已验证的服务端样本。若 `.raw/怀旧岛079V5服务端.rar` 不存在，而存在 Task 002 已分析的同一 SHA-256：

```text
e074714d6e0f6f3d94ca38e3aca7a10091eb19e9ba69fb2baf4ba02928f1bb1f
```

可以按哈希确认它是同一输入，但不要猜测其他归档。

记录：

- Windows 版本；
- x32dbg/x64dbg 版本或实际调试器；
- 主客户端模块基址；
- ASLR 是否实际生效；
- 已加载模块列表；
- `ws2_32.dll` 的加载时间点；
- 客户端启动命令行。

---

# 阶段 B：启动本地服务端

只有本任务允许为了协议验证启动服务端。

要求：

1. 仅绑定/通告 localhost；
2. 不修改 Task 002 已确认的协议逻辑；
3. 如果数据库必须启动，只使用服务端包自带的本地测试数据库；
4. 不开放数据库或游戏端口到局域网/公网；
5. 使用测试账号；
6. 不提交数据库文件或真实口令。

确认至少这些端口进入监听：

```text
9555
7575-7578（实际启动几个频道就记录几个）
```

如果服务端无法启动：

- 记录错误；
- 不随意修改协议代码；
- 仍继续执行能够完成的客户端模块/常量搜索和调试准备；
- 在最终报告中标明动态协议链未能跑通。

---

# 阶段 C：创建离线 packet 验证工具

创建可提交的研究脚本：

```text
scripts/maple079_packet.py
```

脚本实现必须直接来自：

```text
result/protocol-crypto.md
```

至少支持：

```text
- 解析 15-byte handshake
- 保存两个方向 IV
- 解析 4-byte packet header
- 计算 encrypted body length
- Maple custom encrypt/decrypt
- AES-based stream transform
- IV update
- decrypt one packet
- encrypt one packet（用于自测，不用于修改客户端）
```

建议 CLI：

```text
python scripts/maple079_packet.py handshake <hex>
python scripts/maple079_packet.py decrypt --direction c2s --iv <hex> --packet <hex>
python scripts/maple079_packet.py decrypt --direction s2c --iv <hex> --packet <hex>
```

脚本输出至少包含：

```text
header
body_length
opcode_hex
opcode_dec
plaintext_hex
next_iv
```

不要默认单个 TCP `recv()` 等于一个完整 MapleStory packet。脚本本身可以处理单 packet；运行时采集层需要先做 TCP stream reassembly。

为脚本加入最小自检：

- IV 更新结果长度始终为 4；
- decrypt(encrypt(x)) == x；
- header length encode/decode 互逆；
- handshake pattern 能正确提取 version=79、locale=4 和两个 IV。

把自检命令和结果写进 Task 003 报告。

---

# 阶段 D：客户端启动与模块时间线

以本地参数启动客户端工作副本：

```text
MapleStory.exe 127.0.0.1 9555
```

在调试器中记录从进程创建到第一次登录连接之间的模块时间线。

至少关注：

```text
MapleStory.exe
kernel32.dll
kernelbase.dll（如当前系统有）
ws2_32.dll
mswsock.dll
游戏目录中的 Wizet/Nexon DLL
HShield 相关模块（只记录是否加载，不逆向绕过）
```

输出：

```text
result/runtime-module-map.txt
```

字段建议：

```text
time/order
module
base
size
path
notes
```

如果 `MapleStory.exe` 的内存页在启动过程中发生明显解压/权限变化，可记录：

```text
address range
old protection
new protection
when observed
```

但本任务不要求制作可重新分发的 unpacked EXE。

---

# 阶段 E：捕获第一次 connect

优先在系统模块设置断点：

```text
ws2_32!connect
ws2_32!WSAConnect
```

必要时同时观察：

```text
ws2_32!socket
ws2_32!WSASocketA
ws2_32!WSASocketW
ws2_32!closesocket
```

目标是识别第一次连接：

```text
127.0.0.1:9555
```

第一次命中后记录：

```text
socket handle
sockaddr bytes
IP
port
return address
caller module
caller VA
caller RVA relative to MapleStory.exe
call stack
```

如果 `connect` 的直接 caller 不在 `MapleStory.exe`，继续沿调用栈向上找第一个属于主客户端或其核心游戏模块的 frame。

建立第一条函数候选：

```text
candidate_CClientSocket_Connect
```

置信度必须由证据决定，不要仅按“调用了 connect”就认定是最终类方法。

---

# 阶段 F：捕获并重组明文握手

观察登录 socket 上：

```text
recv
WSARecv
```

**不要假设单次 recv 必须返回完整 15 字节。TCP 是字节流。**

为该 socket 建立按时间顺序的 reassembly buffer，在连续接收数据中搜索：

```text
0D 00 4F 00 00 00 46 72 7A
```

找到后恢复完整 15 字节握手，记录：

```text
version
client-send IV
client-recv IV
locale
recv API return address
caller VA/RVA
```

将握手送入 `scripts/maple079_packet.py` 验证。

目标：找到“收到握手之后、第一次业务包发送之前”的客户端初始化路径。

重点观察客户端是否把：

```text
46 72 7A RR
52 30 78 SS
79
-80 / swapped version representation
```

写入长期存活的 socket/crypto 对象。

---

# 阶段 G：捕获登录包并离线解密

观察握手之后该 socket 的第一次业务：

```text
send / WSASend
```

记录：

```text
socket
raw header 4 bytes
raw ciphertext
length
return address
caller VA/RVA
call stack
```

不要提交账号和密码明文。

使用握手提取到的 client-send IV，通过 `scripts/maple079_packet.py` 解密该 packet 副本。

成功标准：

```text
decrypted opcode == 0x0001 LOGIN_PASSWORD
```

对明文 payload：

- 只确认字段布局符合 `账号 + 密码 + 6-byte MAC`；
- 账号、密码、MAC 在结果中写 `<redacted>`；
- 不提交完整凭证 hex。

然后在调试器中从 `send/WSASend` caller 向上回溯，寻找：

```text
raw encrypted buffer
↑
AES/custom transform
↑
packet header generation
↑
plaintext packet buffer
↑
COutPacket-style builder
```

记录每个高置信度候选函数的：

```text
VA
RVA
module
callers
callees
input/output buffer observation
evidence
confidence
```

---

# 阶段 H：定位发送侧 crypto 边界

使用 Task 002 已知的 crypto 锚点，在 `MapleStory.exe` 已加载/展开后的内存中搜索：

AES key：

```text
13 00 00 00 08 00 00 00 06 00 00 00 B4 00 00 00
1B 00 00 00 0F 00 00 00 33 00 00 00 52 00 00 00
```

IV table 前缀：

```text
EC 3F 77 A4 45 D0 71 BF B7 98 20 FC 4B E9 B3 E1
```

IV seed：

```text
F2 53 50 C6
```

如果找到：

1. 记录内存地址；
2. 判断属于哪个模块和 section/page；
3. 查找代码引用；
4. 将引用它的函数与发送/接收 call stack 交叉验证。

不要因为搜到常量就直接命名函数。至少需要“常量引用 + 数据流/调用栈”两类证据。

---

# 阶段 I：捕获服务端响应并定位接收侧 decrypt

登录请求之后采集服务端到客户端的数据流。

使用 client-recv IV 做 stream reassembly + packet decrypt，确认至少一个：

```text
LOGIN_STATUS 0x00
SERVERLIST   0x09
CHARLIST     0x0A
SERVER_IP    0x0B
```

网络 API 边界是 ciphertext。

目标是在客户端内存中找到某个时刻：

```text
ciphertext
→ AES transform
→ custom decrypt
→ plaintext begins with opcode
→ dispatcher
```

可以通过数据断点/内存访问观察等正常调试方式跟踪自己的进程缓冲区。

优先恢复：

```text
candidate_Decrypt
candidate_PacketLength
candidate_InPacket_Init
candidate_Dispatcher
```

一旦发现明文 `00 00`、`09 00`、`0A 00`、`0B 00` 被读取，记录读取该 short 的函数和上层 caller。

---

# 阶段 J：验证 opcode dispatcher

最低要求不是完整恢复整个 switch，而是用**两个以上不同 S->C opcode**证明同一分发点。

优先组合：

```text
SERVERLIST 0x09
CHARLIST   0x0A
SERVER_IP  0x0B
```

或者：

```text
LOGIN_STATUS 0x00
SERVERLIST    0x09
```

证据标准：

```text
同一个函数/表分发点
+ 不同 opcode 输入
+ 跳到不同 handler
```

记录：

```text
dispatcher VA/RVA
opcode read location
switch/jump-table/table-call form
handler candidates
```

如果无法确认 C++ 类名，用：

```text
candidate_PacketDispatcher
candidate_Handler_LOGIN_STATUS
candidate_Handler_SERVERLIST
candidate_Handler_SERVER_IP
```

---

# 阶段 K：频道迁移二次验证

完成选角后，服务端会返回：

```text
SERVER_IP S->C 0x0B
```

里面包含：

```text
127.0.0.1
7575-7578
characterId
```

客户端随后应：

1. 关闭/离开登录连接；
2. 第二次 `connect` 到频道端口；
3. 接收一条新的 15-byte handshake；
4. 使用新 IV 重建 crypto state；
5. 第一条业务请求解密后为：

```text
PLAYER_LOGGEDIN C->S 0x0B
```

6. 接收：

```text
WARP_TO_MAP S->C 0x81
```

这一步是确认 `candidate_CClientSocket_Connect` 和 socket/crypto 对象生命周期最重要的验证。

比较第一次和第二次 connect 的客户端调用路径：

```text
same lower-level connect wrapper?
same socket object layout?
same handshake parser?
same crypto initializer?
```

如果两次连接最终进入同一个主客户端函数，可显著提高 `CClientSocket::Connect` 候选置信度。

---

# 阶段 L：进入地图后的最小验证

不展开完整游戏逻辑。

只确认至少一个：

```text
WARP_TO_MAP S->C 0x81
MOVE_PLAYER C->S 0x24
PING/PONG 0x14/0x13
```

其中 `0x81` 最重要。

Task 002 已知：

- 初次角色载入使用 `0x81`，内部模式字节为 `1`；
- 普通换图仍使用 `0x81`，内部模式字节为 `3`。

如果能够观察同一个客户端 handler 对 `0x81` 内部字段分支，记录为：

```text
candidate_Handler_WARP_TO_MAP
```

这是后续恢复 `CField` 相关逻辑的入口。

---

# 阶段 M：函数候选表

生成：

```text
result/client-function-candidates.csv
```

字段至少：

```text
name
module
va
rva
evidence
callers
callees
protocol_event
confidence
notes
```

`confidence` 使用：

```text
high
medium
low
```

建议第一批目标：

```text
candidate_CClientSocket_Connect
candidate_CClientSocket_SendPacket
candidate_CClientSocket_OnRead
candidate_GetPacketHeader
candidate_GetPacketLength
candidate_Encrypt
candidate_Decrypt
candidate_UpdateIV
candidate_PacketDispatcher
candidate_Handler_LOGIN_STATUS
candidate_Handler_SERVERLIST
candidate_Handler_SERVER_IP
candidate_Handler_WARP_TO_MAP
```

没有证据的项目不要硬填地址。

---

# 阶段 N：运行时事件记录

生成：

```text
result/runtime-network-events.csv
```

字段建议：

```text
seq
time
socket
direction
api
remote_ip
remote_port
raw_length
protocol_stage
opcode_hex
caller_va
caller_rva
notes
```

规则：

- `opcode_hex` 只有在离线解密验证成功后填写；
- 握手没有业务 opcode；
- 不写账号/密码/MAC；
- 不把大段 ciphertext 直接塞进 CSV。

必要的小段 hex 放到 Markdown 报告。

---

# 最终报告

生成：

```text
result/02-runtime-network-bootstrap.md
```

至少包含：

## 1. Environment

调试环境、工具版本、隔离方式。

## 2. Sample Verification

客户端 SHA-256、启动命令。

## 3. Runtime Module Timeline

何时加载 ws2_32，主模块基址及重要模块。

## 4. Login Connect

9555 connect 的 caller VA/RVA 和调用栈摘要。

## 5. Handshake

重组后的 15-byte handshake、IV、握手 parser 候选。

## 6. Login Packet

第一次 encrypted send 的长度、离线解密结果 `opcode=0x01`，凭证必须脱敏。

## 7. Receive Path

至少一个 S->C packet 的 ciphertext → plaintext → opcode 证据链。

## 8. Crypto Anchors

AES key / IV table 是否在客户端运行时内存找到；地址和 xref 结果。

## 9. Dispatcher

是否找到 opcode 读取和分发候选。

## 10. Channel Migration

第二次 connect、第二次 handshake、`PLAYER_LOGGEDIN 0x0B`、`WARP_TO_MAP 0x81` 的验证情况。

## 11. Function Candidates

引用 `client-function-candidates.csv`，重点解释高置信度项。

## 12. Blockers / Uncertainties

没有跑通的部分必须明确记录原因。

## 13. Recommended Task 004

根据本次真实结果决定后续是：

```text
packet codec reconstruction
opcode dispatcher expansion
login/UI handlers
CField / WARP_TO_MAP
CInPacket / COutPacket method recovery
Ghidra/IDA runtime-image correlation
```

不要预设 Task 004 一定是什么。

---

# 预期产物

尽可能生成：

```text
scripts/
└── maple079_packet.py

result/
├── 02-runtime-network-bootstrap.md
├── runtime-module-map.txt
├── runtime-network-events.csv
├── client-function-candidates.csv
└── runtime-crypto-anchors.md
```

可以添加必要的纯文本/CSV/JSON/Markdown，但禁止提交：

```text
process dump
memory dump
unpacked executable
client/server binaries
WZ
JAR
DB files
credentials
large packet captures
```

原始调试数据库和 dump 留在 `.work/task-003/`。

---

# 最终质量检查

完成前逐项检查：

1. 客户端 SHA-256 是否与 Task 001 一致；
2. 是否确认第一次 connect 目标为 `127.0.0.1:9555`；
3. 是否按 TCP stream 重组握手，而不是假设单 recv=15 bytes；
4. 是否从握手提取并验证两个方向 IV；
5. 是否完成 `scripts/maple079_packet.py` 并通过自检；
6. 是否至少离线解密一个 C->S packet 并验证 `LOGIN_PASSWORD=0x01`；
7. 是否至少离线解密一个 S->C packet；
8. 是否记录网络 API caller 的 VA/RVA；
9. 是否尝试定位 crypto 常量及 xref；
10. 是否找到至少一个 packet decode / dispatcher 候选；
11. 如果跑到选角，是否验证第二次频道 connect 与新 handshake；
12. 是否没有把账号密码、MAC、token 等提交到 Git；
13. 是否没有提交 dump、EXE、DLL、JAR、WZ、数据库；
14. 是否没有修改 `.raw/`；
15. 是否没有实施 anti-cheat/protector 绕过。

---

# 完成后 Git 操作

先检查：

```text
git status
git diff
```

确认只包含可提交的分析脚本和结构化结果。

建议 commit message：

```text
Complete Task 003 runtime network bootstrap
```

然后正常：

```text
git push
```

不要 force push，不要改写历史。

---

# Task 003 成功标准

最低成功标准：

```text
connect :9555
+ handshake recognized
+ IV extracted
+ one C->S packet decrypted
+ one S->C packet decrypted
+ at least one client caller RVA identified
```

理想成功标准：

```text
login connect
→ handshake parser
→ send crypto
→ recv crypto
→ opcode dispatcher
→ SERVER_IP
→ channel connect
→ new handshake
→ PLAYER_LOGGEDIN
→ WARP_TO_MAP
```

只要达到最低标准，就不要为了“完整脱壳”无限扩大范围。