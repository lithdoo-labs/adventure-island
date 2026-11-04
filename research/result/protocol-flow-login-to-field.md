# 登录到进入地图

Opcode 数值来自 JAR 内的 `recvops.properties` / `sendops.properties`。分发在 `MapleServerHandler.handlePacket`。属性里没有的枚举会被 `ExternalCodeTableGetter` 设成 `-2`，正常封包匹配不到它们。

没有单独的世界服 TCP。选服和选频道都还在登录连接上完成。

## G1. Login

客户端连上 `127.0.0.1:9555` 后，服务端先发 15 字节明文握手。见 `protocol-handshake.md`。

第一条业务请求：

| 项 | 值 |
| --- | --- |
| opcode | recv `LOGIN_PASSWORD = 0x01` |
| handler | `CharLoginHandler.login` |
| 字段 | Maple ASCII 账号；Maple ASCII 密码；随后 6 个字节被拼成 MAC（`XX-XX-XX-XX-XX-XX`） |
| 口令 | 代码会把账号和口令写到 `日志/logs/ACPW.txt`。这里不记录任何真实口令 |

`江浩.AutoRegister = true` 时，账号不存在就会 `AutoRegister.createAccount`，然后回 `LOGIN_STATUS` 失败码 `1`，并提示重新登录。口令字面量 `disconnect` 和 `fixme` 会被拒绝。这是 V5 行为，不是握手字段。

已有账号走 `MapleClient.login`。失败时：

| 响应 | opcode | 结构 |
| --- | --- | --- |
| 普通失败 | send `LOGIN_STATUS = 0x00` | `int reason`，`short 0`（`LoginPacket.getLoginFailed`） |
| 临时封禁 | `LOGIN_STATUS = 0x00` | `byte 2`，5 个 0，`byte reason`，`long timestamp` |
| 永久封禁 | `LOGIN_STATUS = 0x00` | `short 2`，`byte 0`，`byte reason`，然后 `01 01 01 01 00` |

成功时没有直接发角色列表。`LoginWorker.registerClient` 负责后续，最终由客户端再发服务器列表请求。

`HELLO_LOGIN` / `HELLO_CHANNEL` 在枚举和 `handlePacket` 里都有 case，调用 `CharLoginHandler.Welcome`（空方法）。它们不在 `recvops.properties` 里，加载后是 `-2`。本样本的登录链不依赖这两个 opcode。

`recvops.properties` 里还有 `SERVERLIST_REREQUEST`、`AFTER_LOGIN`、`REGISTER_PIN`、`PLAYER_DC`、`VIEW_ALL_CHAR`、`PICK_ALL_CHAR`，值都是 `0xFF`。这些键不是 `RecvPacketOpcode` 的枚举成员，`messageReceived` 的循环匹配不到它们。

## G2. Server list / world / channel

| 方向 | opcode | 名字 | 处理 |
| --- | --- | --- | --- |
| C->S | `0x02` | `SERVERLIST_REQUEST` | `CharLoginHandler.ServerListRequest`，无额外字段 |
| C->S | `0x03` | `LICENSE_REQUEST` | 同一个 `ServerListRequest`。`LicenseRequest` 方法存在，但这个 case 没有调用它 |
| C->S | `0x05` | `SERVERSTATUS_REQUEST` | `ServerStatusRequest` |
| S->C | `0x06` | `SERVERSTATUS` | `short status`：0 正常，1 拥挤，2 已满 |
| S->C | `0x09` | `SERVERLIST` | 见下 |
| S->C | `0x09` | `SERVERLIST` 结束 | `byte 0xFF` |

`LoginPacket.getServerList` 的字段：

```text
short opcode 0x09
byte  serverId          调用处固定为 0
string serverName       江浩.ServerName，本 ini 为空字符串
byte  flag              江浩.Flag = 3
string eventMessage     江浩.EventMessage
short 100
short 100
byte  lastChannel       已加载频道的最大编号
int   500
重复 lastChannel 次：
  string serverName + "-" + i
  int    频道人数，缺省 1200
  byte   serverId
  short  i - 1           频道下标从 0 起
short balloonCount
重复：
  short x
  short y
  string message
short 0
```

人数和频道名在登录包里。IP 和端口不在这个包里，而在选角之后的 `SERVER_IP`。

世界只有调用里的 `serverId = 0`。`CharlistRequest` 若发现 `c.getWorld() != 0` 会在稍后选角时断开。本配置是单世界。

## G3. Character list / selection

| 方向 | opcode | 名字 | 字段 |
| --- | --- | --- | --- |
| C->S | `0x09` | `CHARLIST_REQUEST` | `byte server`，`byte channel`（服务端加 1），`int` 被读掉 |
| S->C | `0x0A` | `CHARLIST` | `byte 0`，`int 0`，`byte count`，然后每个角色 `PacketHelper.addCharStats` + `addCharLook` |
| C->S | `0x0A` | `CHAR_SELECT` | `int characterId`。handler 是 `Character_WithoutSecondPassword` |
| S->C | `0x0B` | `SERVER_IP` | 见下 |

`AUTH_SECOND_PASSWORD` 不在 `recvops.properties` 中，值是 `-2`。当前选角 case 不走二级密码。`Character_WithSecondPassword` 因此不会从正常 opcode 进入。

`getServerIP(port, charId)`：

```text
short opcode 0x0B
short 0
4 bytes  江浩.IP 的 InetAddress 原始地址。127.0.0.1 即 7F 00 00 01
short port     频道端口，小端。频道 1 为 75 1D（7575）
int   characterId
bytes 01 00 00 00 00
```

同时 `LoginServer.putLoginAuth(charId, ip, tempIp, channel)` 记下这次迁移。

## G4. Channel login

客户端应断开 9555，连接 `127.0.0.1` 和 `SERVER_IP` 里的端口。频道 `sessionOpened` 会再发一条新的 15 字节握手，IV 重新随机。加密状态不从登录连接继承。

第一条频道包：

| 项 | 值 |
| --- | --- |
| opcode | recv `PLAYER_LOGGEDIN = 0x0B` |
| 字段 | `int playerId`（`handlePacket` 在调用前读掉） |
| handler | `InterServerHandler.Loggedin`。商城连接（`cs == true`）则改为 `CashShopOperation.EnterCS` |

`Loggedin` 的门槛：`江浩.IP` 必须等于 `GameConstants.绑定IP`，或者等于字面量 `127.0.0.1`。本 JAR 里 `绑定IP` 的初值就是 `127.0.0.1`，ini 里的 `江浩.IP` 也是 `127.0.0.1`，所以这条检查通过。两边都不相等时会断开连接；断开前的控制台提示含有联系号码，这里不抄录。

通过后：从数据库或待迁移对象装入角色，`updateLoginState(2, sessionIp)`，`channelServer.addPlayer`，然后写 `MaplePacketCreator.getCharInfo`。

`getCharInfo` 使用 send opcode `WARP_TO_MAP = 0x81`：

```text
short 0x81
int   channel - 1
byte  0
byte  1
byte  1
short 0
CRand.connectData
PacketHelper.addCharacterInfo
long  当前时间
```

这是进频道后的角色载入包，不是换图包。换图用同一个 opcode，但 `getWarpToMap` 的中间字节是 `3`，并带地图 ID 和出生点。

## G5. Enter field

`Loggedin` 写完 `getCharInfo` 后调用 `player.getMap().addPlayer(player)`。

`MapleMap.addPlayer` 随后做的主要广播：

- 对其他玩家：`MaplePacketCreator.spawnPlayerMapobject`，send opcode `SPAWN_PLAYER = 0xA2`
- 宠物：`PetPacket.showPet` / `updatePet`
- 平台、环境、天气、活动时钟等按地图条件追加

本次没有把每只怪物、NPC、反应堆的生成函数逐字段展开。移动的注册点是明确的：

| 方向 | opcode | handler / builder |
| --- | --- | --- |
| C->S | `MOVE_PLAYER = 0x24` | `PlayerHandler.MovePlayer`：先 `skip(33)`，再 `MovementParse.parseMovement(slea, 1)` |
| S->C | `MOVE_PLAYER = 0xBB` | `MaplePacketCreator.movePlayer` |
| C->S | `NPC_TALK = 0x36` | `NPCHandler.NPCTalk` |
| C->S | `CHANGE_MAP = 0x21` | `PlayerHandler.ChangeMap`；若当前在商城则是 `CashShopOperation.LeaveCS` |

换图响应是 `getWarpToMap`，opcode 仍是 `0x81`：

```text
short 0x81
int   channel - 1
byte  0
byte  3
short 0
byte  0
int   mapId
byte  spawnPoint
short hp
long  time
```
