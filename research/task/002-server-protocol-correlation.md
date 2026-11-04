# Task 002 — 服务端协议建模与客户端关联

## 目标

利用本地服务端归档：

```text
.raw/怀旧岛079V5服务端.rar
```

以及已经完成基线分析的客户端归档：

```text
.raw/怀旧岛079V5客户端.rar
```

对服务端进行一次**只读、静态、可复现**的结构与协议分析，把服务端当作客户端逆向的“协议真值表”。

本任务的核心不是启动服务端，而是回答以下问题：

1. 登录服、世界服、频道服分别监听什么地址和端口；
2. 客户端与服务端连接后的第一组握手字节是什么；
3. packet framing / header / length 的计算方式是什么；
4. 收包、发包 opcode 分别有哪些；
5. opcode 对应哪个 handler / packet builder；
6. 登录 → 区服/频道 → 角色 → 进入地图的协议链路是什么；
7. 客户端封包的加密、解密、IV、版本号、locale 等参数如何初始化；
8. 哪些协议特征可以直接转化为客户端动态调试的断点和搜索锚点；
9. `MapleStory.exe 127.0.0.1 9555` 中的 `9555` 在服务端配置中的真实角色是什么；
10. 怀旧岛 V5 相比标准 CMS079 是否存在自定义 opcode、协议字段、端口或配置差异。

所有最终结果写入：

```text
result/
```

临时解压、反编译、索引、缓存统一写入：

```text
.work/task-002/
```

不要修改 `.raw/` 中的任何文件。

---

## 执行约束

1. `.raw/怀旧岛079V5服务端.rar` 只读。
2. 本任务默认**不运行服务端、数据库、启动脚本、EXE、JAR 或其他未知程序**。
3. 可以进行静态解压、反编译、反汇编、字符串提取和配置解析。
4. 如果归档中包含源码，优先分析源码，不要无谓反编译对应二进制。
5. 如果只有 Java `.jar/.class`，允许使用 `jar` / `javap` / CFR / FernFlower 等做静态反编译。
6. 如果只有 .NET 程序集，允许用 ILSpy/dnSpyEx 等静态分析。
7. 如果只有 native PE，先做 PE/import/string/静态反汇编，不执行。
8. 不尝试绕过、禁用或修改 HackShield / anti-cheat / protector。
9. 不把数据库密码、管理密码、账号、API key 等敏感信息原样提交到 Git；结果中统一写成 `<redacted>`，只保留配置键名与用途。
10. 不把服务端原始二进制、数据库 dump、RAR、JAR、DLL、EXE 等复制到 `result/`。
11. 每条协议结论尽量记录来源文件、类/函数、常量和代码位置。
12. 不要因为单个工具缺失而中止整个任务。

---

# 阶段 A：服务端归档基线

计算：

- 文件大小；
- MD5；
- SHA-1；
- SHA-256。

列出归档目录并解压到：

```text
.work/task-002/server/
```

生成完整文件清单，至少包含：

```text
path
size
extension
sha256
kind
```

其中 `kind` 尽量分类为：

```text
source
config
script
java-class
java-jar
dotnet
native-pe
sql
database
library
document
other
```

分析并记录项目技术栈，例如：

- Java / OdinMS / MINA / Netty；
- C# / .NET；
- C/C++；
- Python；
- MySQL / MariaDB / SQLite；
- Ant / Maven / Gradle；
- 是否包含完整源码。

---

# 阶段 B：启动与配置拓扑

静态检查所有：

```text
*.properties
*.ini
*.conf
*.cfg
*.xml
*.json
*.yaml
*.yml
*.bat
*.cmd
*.sh
*.sql
```

以及源码中的配置常量。

重点寻找：

```text
9555
8484
7575
7576
7577
localhost
127.0.0.1
LoginServer
WorldServer
ChannelServer
port
host
ip
serverIP
externalIP
```

不要假设这些示例端口一定存在。

输出服务端拓扑：

```text
client
  ↓
login server: host:port
  ↓
world/channel selection
  ↓
channel server: host:port
  ↓
field/game session
```

对于每个端口记录：

- 地址；
- 端口；
- server role；
- 配置来源；
- 源码中 bind/listen 的位置；
- 客户端何时应该连接它。

特别验证客户端包中已经发现的：

```text
MapleStory.exe 127.0.0.1 9555
```

确认 `9555` 是否为登录端口、代理端口、启动器端口或其他用途。

---

# 阶段 C：定位网络入口

优先寻找服务端网络初始化代码。

常见语义关键词包括但不限于：

```text
ServerSocket
SocketChannel
IoAcceptor
NioSocketAcceptor
ChannelPipeline
ChannelInitializer
MapleServerHandler
MapleCodecFactory
PacketDecoder
PacketEncoder
MaplePacketDecoder
MaplePacketEncoder
sessionOpened
channelActive
messageReceived
channelRead
```

不要依赖这些名称必须存在，以实际代码为准。

最终明确：

1. accept 新连接的入口；
2. session 初始化函数；
3. 第一条 server → client 数据在哪里生成；
4. inbound packet decoder；
5. outbound packet encoder；
6. opcode dispatch；
7. handler registry。

---

# 阶段 D：握手协议

这是本任务最高优先级之一。

找到连接建立后服务端发给客户端的第一段数据，并精确记录其生成逻辑。

需要回答：

- 握手总长度；
- packet length 是否有独立前缀；
- MapleStory version；
- sub-version / patch string；
- locale；
- send IV；
- recv IV；
- IV 字节序；
- 所有字段顺序；
- 每个字段长度；
- 常量值；
- 是否有 V5 自定义字段。

输出一个字段级结构，例如：

```text
offset  size  direction  field        example/value  source
0x00    ...   S->C       ...          ...            ...
```

如果服务端代码能直接构造完整握手字节，再额外给出一个**短小的示例 hex**，用于之后客户端调试时识别第一次 `recv`。

不要提交大量通信内容，只保留协议结构和必要的短样例。

---

# 阶段 E：封包 framing 与加解密

定位并解释：

- TCP stream 如何切 packet；
- header 长度；
- encrypted packet length 如何计算；
- version 是否参与 header；
- encode header / decode header 的函数；
- AES 或其他 block cipher 的使用方式；
- IV 初始化；
- IV 更新；
- 是否存在 MapleStory 自定义 shuffle；
- 是否存在额外 transform / morph / Shanda 类算法；
- 加密与 opcode 编解码的先后关系。

禁止根据常见 MapleStory 实现直接下结论；必须以这个 V5 服务端中的实际代码为准。

将算法拆成足够适合客户端逆向比对的步骤，并记录：

```text
function/class
constants
tables
key material source
input
output
state fields
```

如果存在显著常量表，记录：

- 表长度；
- SHA-256；
- 前 8～16 字节短样例；
- 源码位置。

这些将用于之后在客户端运行时内存中搜索同源常量。

---

# 阶段 F：Opcode 全量映射

查找所有 receive / send opcode 定义。

可能形式包括：

```text
recvops.properties
sendops.properties
RecvPacketOpcode
SendPacketOpcode
enum
switch
Map<Integer, Handler>
properties
XML
```

以实际项目为准。

生成：

```text
result/protocol-opcodes.csv
```

建议字段：

```text
direction
opcode_hex
opcode_dec
name
handler_or_builder
source_file
source_symbol
notes
```

如果同一个 opcode 有重复定义、版本条件或 V5 特殊覆盖，必须明确标注。

---

# 阶段 G：核心协议链路

至少完整追踪以下流程：

## G1. Login

从客户端第一条登录请求开始，记录：

```text
opcode
字段顺序
账号字段
密码字段（不要记录真实值）
版本/机器信息字段
对应 handler
响应 opcode
响应结构
```

## G2. Server list / world / channel

记录：

- world list；
- channel list；
- population/status；
- endpoint 下发字段；
- IP/port 的编码方式。

## G3. Character list / selection

记录：

- character list 请求/响应；
- character ID；
- select character；
- channel endpoint 切换。

## G4. Channel login

客户端从登录服断开并连接频道服后：

- 是否重新 handshake；
- 第一条 client packet；
- player/session token；
- 角色载入响应。

## G5. Enter field

追踪进入地图前后的主要 packet：

- set field；
- player spawn；
- mob/npc/reactor 初始数据；
- movement handler 注册点。

不需要本任务把所有游戏 opcode 都逐字段逆完；重点是建立从登录到进入地图的完整主链路。

---

# 阶段 H：识别 V5 私服修改

由于客户端归档已经显示多个后期修改迹象，本阶段必须寻找服务端侧的对应修改。

重点搜索：

```text
V5
079V5
怀旧岛
9555
localhost
127.0.0.1
HS
HackShield
bypass
custom
自定义
修正
登陆器
```

以及非标准 opcode、额外字段、特殊 GM/后台协议等。

区分：

```text
标准 CMS079/OdinMS 逻辑
怀旧岛 V5 自定义逻辑
无法确认来源的逻辑
```

不要因为类名类似 OdinMS 就自动判断代码是标准版本。

---

# 阶段 I：生成客户端逆向锚点

基于服务端结果，生成：

```text
result/client-reverse-targets.md
```

必须包含下一阶段调试客户端时最值得寻找的目标。

至少列出：

## 1. 连接目标

```text
login host
login port
channel port range
```

## 2. 第一条握手特征

给出足够识别 packet 的短 hex pattern 和字段解释。

## 3. 核心 opcode

挑选约 10～20 个最适合做客户端定位的 opcode，例如：

```text
login request
login result
server list
character list
select character
channel migration
channel login
set field
movement
NPC interaction
```

实际名称以服务端为准。

## 4. 加密锚点

记录适合在客户端代码或运行时内存搜索的：

- version 常量；
- locale 常量；
- crypto tables；
- AES key/hash；
- IV transform 常量；
- packet header 算法常量。

## 5. 推荐动态断点

只针对正常网络 API 边界提出调试目标，例如：

```text
ws2_32!connect / WSAConnect
ws2_32!recv / WSARecv
ws2_32!send / WSASend
```

并说明第一次命中时应该期望看到哪个服务端协议阶段。

不要包含反作弊规避、保护禁用或绕过步骤。

---

# 阶段 J：客户端 / 服务端关联表

生成：

```text
result/client-server-correlation.md
```

建议格式：

```text
Protocol event:
Server source:
Direction:
Opcode:
Packet fields:
Expected runtime bytes:
Expected client-side responsibility:
Client reverse target:
Confidence:
Evidence:
```

优先覆盖：

```text
TCP connect
handshake
login request
login response
world list
character list
channel redirect
channel handshake
channel login
set field
movement
```

---

# 最终产物

本任务应尽可能生成：

```text
result/
├── 01-server-baseline.md
├── server-file-manifest.csv
├── server-config-index.md
├── server-topology.md
├── protocol-handshake.md
├── protocol-crypto.md
├── protocol-opcodes.csv
├── protocol-flow-login-to-field.md
├── client-server-correlation.md
└── client-reverse-targets.md
```

可以增加必要的纯文本、CSV、JSON、Markdown 结果。

不要覆盖 Task 001 的已有结果文件。

---

# 最终质量检查

完成后检查：

1. 是否确认 `9555` 的服务端含义；
2. 是否找到服务端网络 accept/session 初始化入口；
3. 是否恢复握手格式；
4. 是否恢复 packet framing；
5. 是否确认实际 crypto 实现；
6. 是否输出 send/recv opcode 表；
7. 是否追踪登录到进入地图的主流程；
8. 是否区分 V5 修改与标准 079 逻辑；
9. 是否生成客户端动态逆向锚点；
10. 是否避免提交密码、数据库 dump 和服务端原始二进制；
11. 是否确认 `.raw/` 和 `.work/` 没有进入 Git。

完成后提交结果，建议 commit message：

```text
Complete Task 002 server protocol correlation
```

然后正常 `git push`，不要 force push。

---

# Task 003 的进入条件

只有在本任务完成后再进行客户端动态分析。

Task 003 将根据本任务的真实结果，而不是通用 MapleStory 资料，针对：

```text
MapleStory.exe 127.0.0.1 9555
```

建立客户端运行时网络边界：

```text
connect
  ↓
server handshake recv
  ↓
client handshake initialization
  ↓
login packet encode/send
  ↓
packet recv/decode
  ↓
opcode dispatcher
```

Task 003 的首要目标是恢复 `CClientSocket` / packet codec / dispatcher 的候选地址，而不是完整脱壳，也不是处理 HackShield 绕过。