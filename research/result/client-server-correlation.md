# 客户端 / 服务端对照

客户端基线来自 Task 001：`冒险岛online/MapleStory.exe`，SHA-256 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`。该文件疑似加壳，导入表只有 `kernel32.dll!GetLocalTime`，明文里没有 `.wz` 和 WinSock API 名。下面的“客户端职责”是服务端协议对客户端的要求，不是已经在客户端里定位到的函数。

## TCP connect

```text
Protocol event: 客户端连接登录服
Server source: LoginServer.run_startup_configurations
Direction: C->S TCP
Opcode: 无
Packet fields: 目标 127.0.0.1:9555
Expected runtime bytes: 无游戏负载。随后应出现握手
Expected client-side responsibility: 把启动参数 127.0.0.1 和 9555 交给 socket
Client reverse target: ws2_32 connect / WSAConnect 的第一次成功连接
Confidence: 高
Evidence: 江浩.LPort=9555；江浩.IP=127.0.0.1；单机登陆器.bat 全文 MapleStory.exe 127.0.0.1 9555
```

## handshake

```text
Protocol event: 连接后第一条服务端数据
Server source: MapleServerHandler.sessionOpened -> LoginPacket.getHello
Direction: S->C
Opcode: 无游戏 opcode。前两字节是长度 13
Packet fields: version 79, 空 patch, recv IV, send IV, locale 4
Expected runtime bytes: 0D 00 4F 00 00 00 46 72 7A RR 52 30 78 SS 04
Expected client-side responsibility: 用前一个 IV 发送、后一个 IV 接收，并分别配上版本 79 和 -80
Client reverse target: 第一次 recv / WSARecv 的 15 字节缓冲
Confidence: 高
Evidence: getHello 与 sessionOpened 的调用顺序；CLIENT 属性在 write 之后才设置，所以编码器不加 AES 头
```

## login request

```text
Protocol event: 账号登录
Server source: CharLoginHandler.login
Direction: C->S
Opcode: 0x01 LOGIN_PASSWORD
Packet fields: maple-ascii 账号, maple-ascii 密码, 6 字节 MAC
Expected runtime bytes: 加密帧内的明文以 01 00 开头
Expected client-side responsibility: 自定义加密后再 AES，并使用握手给出的 server-recv IV
Client reverse target: 握手之后的第一次 send
Confidence: 高（服务端解析）。客户端函数地址仍未知
Evidence: recvops.properties LOGIN_PASSWORD=0x01；handlePacket case LOGIN_PASSWORD
```

## login response

```text
Protocol event: 登录结果
Server source: LoginPacket.getLoginFailed / getTempBan / getPermBan
Direction: S->C
Opcode: 0x00 LOGIN_STATUS
Packet fields: 失败为 int reason + short 0；封禁布局见 protocol-flow
Expected runtime bytes: 明文 opcode 00 00
Expected client-side responsibility: 用 server-send IV 解密后按 0x00 分发
Client reverse target: 登录 send 之后的下一次 recv
Confidence: 高
Evidence: sendops.properties LOGIN_STATUS=0x00
```

## world list

```text
Protocol event: 服务器列表
Server source: CharLoginHandler.ServerListRequest -> LoginPacket.getServerList
Direction: C->S 0x02，然后 S->C 0x09
Opcode: SERVERLIST_REQUEST 0x02；SERVERLIST 0x09
Packet fields: 请求无正文。响应含世界名、flag=3、公告、频道人数、气球
Expected runtime bytes: 响应明文以 09 00 开头，结束包是 09 00 FF
Expected client-side responsibility: 画服务器列表。此包不含频道 IP
Client reverse target: opcode 0x09 的 S->C 分支
Confidence: 高
Evidence: getServerList 调用时 serverId 固定为 0；江浩.Flag=3
```

## character list

```text
Protocol event: 角色列表
Server source: CharLoginHandler.CharlistRequest -> LoginPacket.getCharList
Direction: C->S 0x09，S->C 0x0A
Opcode: CHARLIST_REQUEST 0x09；CHARLIST 0x0A
Packet fields: 请求 byte world, byte channel, int skipped。响应 byte count 后接角色外观
Expected runtime bytes: 请求明文 09 00；响应 0A 00
Expected client-side responsibility: 频道下标按服务端约定加 1 之前的那个字节
Client reverse target: 选中世界/频道后的 send
Confidence: 高
Evidence: CharlistRequest 读取顺序
```

## channel redirect

```text
Protocol event: 选角后的频道地址
Server source: Character_WithoutSecondPassword -> MaplePacketCreator.getServerIP
Direction: C->S 0x0A，S->C 0x0B
Opcode: CHAR_SELECT 0x0A；SERVER_IP 0x0B
Packet fields: 请求 int charId。响应 7F 00 00 01、short 端口、int charId、01 00 00 00 00
Expected runtime bytes: 频道 1 的端口字段为 75 1D
Expected client-side responsibility: 断开 9555，connect 到包内 IP 和端口
Client reverse target: 0x0B 之后的下一次 connect
Confidence: 高
Evidence: getServerIP；江浩.IP；频道端口 7574+channel
```

## channel handshake

```text
Protocol event: 频道连接上的新握手
Server source: 同一个 MapleServerHandler.sessionOpened
Direction: S->C
Opcode: 无
Packet fields: 与登录握手相同，RR/SS 重新随机
Expected runtime bytes: 仍以 0D 00 4F 00 00 00 46 72 7A 开头
Expected client-side responsibility: 丢弃登录连接的 IV，用新 IV 重建两个方向的密码状态
Client reverse target: 第二次 connect 之后的第一次 recv
Confidence: 高
Evidence: 频道 acceptor 使用 MapleServerHandler(channel, false)，sessionOpened 不区分登录和频道的握手格式
```

## channel login

```text
Protocol event: 频道登录
Server source: InterServerHandler.Loggedin -> MaplePacketCreator.getCharInfo
Direction: C->S 0x0B，S->C 0x81
Opcode: PLAYER_LOGGEDIN 0x0B；WARP_TO_MAP 0x81
Packet fields: 请求 int playerId。响应 channel-1、字节 0,1,1、角色全量数据
Expected runtime bytes: 请求明文 0B 00 后接小端角色 ID
Expected client-side responsibility: 用新握手 IV 发送 0x0B；把 0x81 且标志字节为 1 的包当成进游戏
Client reverse target: 频道握手后的第一次 send，以及 opcode 0x81
Confidence: 高
Evidence: handlePacket 在调用 Loggedin 前 readInt；getCharInfo 写 0x81 且中间字节为 1
```

## set field

```text
Protocol event: 换图
Server source: PlayerHandler.ChangeMap -> MaplePacketCreator.getWarpToMap
Direction: C->S 0x21，S->C 0x81
Opcode: CHANGE_MAP 0x21；WARP_TO_MAP 0x81
Packet fields: 响应中间字节为 3，然后 mapId、spawnPoint、hp、时间
Expected runtime bytes: 明文 81 00，与进频道的 0x81 靠第 7 个正文左右的标志字节区分（进频道是 1，换图是 3）
Expected client-side responsibility: 同一 opcode 的两种布局
Client reverse target: 0x81 处理函数内部对标志字节的分支
Confidence: 中高。两条写包函数都已看到；客户端分支尚未定位
Evidence: getCharInfo 写 byte 1；getWarpToMap 写 byte 3
```

## movement

```text
Protocol event: 人物移动
Server source: PlayerHandler.MovePlayer
Direction: C->S
Opcode: 0x24 MOVE_PLAYER
Packet fields: 跳过 33 字节后是 MovementParse.parseMovement
Expected runtime bytes: 明文 24 00
Expected client-side responsibility: 组移动片段并加密发送
Client reverse target: 0x24 的组包函数。服务端广播使用 S->C 0xBB
Confidence: 高（服务端跳过长度）。33 字节的内部布局本次没有逐项命名
Evidence: MovePlayer 的 slea.skip(33)；sendops MOVE_PLAYER=0xBB
```
