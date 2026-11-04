# 客户端逆向锚点

这些锚点只覆盖正常收发包。不包含脱壳步骤，也不包含 HackShield 的禁用或绕过。Task 001 已说明 `MapleStory.exe` 疑似加壳，下面的 API 断点是在壳解开并出现真实 WinSock 调用之后才有意义；在那之前，导入表里看不到 `connect` / `recv` / `send`。

## 1. 连接目标

```text
login host:  127.0.0.1
login port:  9555
channel:     127.0.0.1:7575, 7576, 7577, 7578
cash shop:   127.0.0.1:8600
```

登录端口来自 `江浩.LPort`。频道端口来自 `7574 + channel`，`江浩.Count = 4`。商城端口是 `CashShopServer` 的字面量 8600。

## 2. 第一条握手特征

```text
0D 00 4F 00 00 00 46 72 7A RR 52 30 78 SS 04
```

| 字节 | 含义 |
| --- | --- |
| `0D 00` | 后面还有 13 字节 |
| `4F 00` | 版本 79 |
| `00 00` | 空 patch |
| `46 72 7A RR` | 客户端发送方向的 IV |
| `52 30 78 SS` | 客户端接收方向的 IV |
| `04` | locale |

`RR` 和 `SS` 每次连接不同。频道和商城的新连接会再出现同一前缀。

## 3. 核心 opcode

数值是解密后的小端 short。

| 方向 | 十六进制 | 十进制 | 名称 | 用途 |
| --- | --- | ---: | --- | --- |
| C->S | 0x01 | 1 | LOGIN_PASSWORD | 登录 |
| S->C | 0x00 | 0 | LOGIN_STATUS | 登录结果 |
| C->S | 0x02 | 2 | SERVERLIST_REQUEST | 请求服务器列表 |
| S->C | 0x09 | 9 | SERVERLIST | 世界/频道列表 |
| C->S | 0x05 | 5 | SERVERSTATUS_REQUEST | 人数状态 |
| S->C | 0x06 | 6 | SERVERSTATUS | 状态回复 |
| C->S | 0x09 | 9 | CHARLIST_REQUEST | 角色列表请求 |
| S->C | 0x0A | 10 | CHARLIST | 角色列表 |
| C->S | 0x0A | 10 | CHAR_SELECT | 选角 |
| S->C | 0x0B | 11 | SERVER_IP | 频道 IP 和端口 |
| C->S | 0x0B | 11 | PLAYER_LOGGEDIN | 频道登录 |
| S->C | 0x81 | 129 | WARP_TO_MAP | 进游戏，以及之后换图 |
| C->S | 0x21 | 33 | CHANGE_MAP | 换图请求 |
| C->S | 0x24 | 36 | MOVE_PLAYER | 移动 |
| S->C | 0xBB | 187 | MOVE_PLAYER | 移动广播 |
| S->C | 0xA2 | 162 | SPAWN_PLAYER | 其他角色出现 |
| C->S | 0x36 | 54 | NPC_TALK | NPC |
| S->C | 0x14 | 20 | PING | 空闲时 `client.sendPing` |
| C->S | 0x13 | 19 | PONG | 对应 PING |

`0x09` 在两个方向上都有，但是一个是收包名 `CHARLIST_REQUEST`，一个是发包名 `SERVERLIST`。`0x0A` 和 `0x0B` 同样按方向区分。

## 4. 加密锚点

在客户端内存或解出的代码里可以搜索：

| 锚点 | 字节 | SHA-256 |
| --- | --- | --- |
| AES-256 密钥 | `13 00 00 00 08 00 00 00 06 00 00 00 B4 00 00 00 1B 00 00 00 0F 00 00 00 33 00 00 00 52 00 00 00` | `2c92f26207d63c11434e891fcf22f57ee4f647e09ce723e158eac01491572ec2` |
| IV 变换表，256 字节 | 开头 `EC 3F 77 A4 45 D0 71 BF B7 98 20 FC 4B E9 B3 E1` | `6a86cd82f1abe956c8d4a58441e1375cd48d6b510db73d15a194de1400eb6565` |
| IV 更新种子 | `F2 53 50 C6` | |
| 发送 IV 前缀 | `46 72 7A` | 只在握手明文里，后面 1 字节随机 |
| 接收 IV 前缀 | `52 30 78` | 同上 |
| 版本 | 79，即 `4F 00`；收包校验用交换后的 `4F 00`，发包头用 `-80` 交换后的 `B0 FF` | |
| locale | 单字节 `04` | |
| 自定义变换常量 | 6 轮；偶数轮加 `72`；奇数轮异或 `0x13` | `MapleCustomEncryption` |

头长度是 4。自定义变换在 AES 之内：发送时先自定义变换再 AES，接收时先 AES 再逆变换。

## 5. 推荐动态断点

只放在 WinSock 边界。

| 断点 | 第一次有游戏数据时应当看到 |
| --- | --- |
| `ws2_32!connect` 或 `WSAConnect` | 目标端口 9555。这是登录服 |
| 该 socket 上的第一次 `recv` / `WSARecv` | 15 字节握手，前缀 `0D 00 4F 00 00 00 46 72 7A` |
| 随后第一次 `send` / `WSASend` | 带 4 字节头的 `LOGIN_PASSWORD`（明文 opcode `01 00`） |
| 再下一次 `recv` | `LOGIN_STATUS`（明文 opcode `00 00`）或后续的 `SERVERLIST` |
| 下一次 `connect` 的端口 | 7575–7578 之一，来自 `SERVER_IP` |
| 新 socket 的第一次 `recv` | 另一条同样前缀的握手 |
| 新 socket 的第一次 `send` | `PLAYER_LOGGEDIN`，明文 opcode `0B 00` |
| 紧接着的 `recv` | `WARP_TO_MAP`，明文 opcode `81 00`，进游戏标志字节为 1 |

Task 001 的主程序在静态导入表里没有这些 API。断点要下在系统模块 `ws2_32` 上，而不是假设 `MapleStory.exe` 的导入槽里能直接看到它们。
