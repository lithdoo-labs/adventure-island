# 封包帧与加解密

全部来自 `江浩079.jar` 的反编译，不是按通用 079 资料填写。相关类：

| 类 | 作用 |
| --- | --- |
| `handling.mina.MapleCodecFactory` | MINA encoder/decoder 工厂 |
| `handling.mina.MaplePacketDecoder` | 入站切包、校验头、解密 |
| `handling.mina.MaplePacketEncoder` | 出站加密并加头 |
| `tools.MapleAESOFB` | AES 密钥流、4 字节头、IV 更新 |
| `tools.MapleCustomEncryption` | 6 轮自定义变换 |
| `tools.data.output.GenericLittleEndianWriter` | 小端整数 |

## 帧

握手之后，每条游戏包是：

```text
[4 字节头][N 字节密文]
```

解码（`MaplePacketDecoder.doDecode`）：

1. 缓冲不足 4 字节则等待。
2. `in.getInt()` 取头。MINA 的 `getInt()` 是大端，因此网上的 4 字节按出现顺序组成这个 int。
3. `client.getReceiveCrypto().checkPacket(header)` 失败则关闭连接。
4. `MapleAESOFB.getPacketLength(header)` 得到 N。
5. 再读满 N 字节。
6. `receiveCrypto.crypt(bytes)`，然后 `MapleCustomEncryption.decryptData(bytes)`。
7. 解密后的前 2 字节是小端 opcode。`readFirstShort` 使用 `GenericLittleEndianAccessor`。

编码（`MaplePacketEncoder.encode`），仅当 session 已有 `CLIENT`：

1. 明文长度是 `N`。opcode 已经在明文前 2 字节。
2. `header = sendCrypto.getPacketHeader(N)`。此时还没加密，IV 仍是本包开始时的值。
3. `MapleCustomEncryption.encryptData(plain)`。
4. `sendCrypto.crypt(plain)`。`crypt` 结束时更新 IV。
5. 输出 `header || 密文`。密文长度等于明文长度。

先后关系：**出站是自定义变换，然后 AES；入站是 AES，然后自定义逆变换。** 头只和长度、IV、版本有关，不包含被 AES 处理过的字节。

## 头

`MapleAESOFB` 构造函数把传入的 short 做字节交换后存起来：

```text
stored = (version >> 8 & 0xFF) | (version << 8 & 0xFF00)
```

`sessionOpened` 的两个对象：

| 对象 | 构造参数 | 交换后的 stored version |
| --- | --- | --- |
| send，`MapleAESOFB(ivSend, -80)` | `-80`（`0xFFB0`） | `0xB0FF` |
| recv，`MapleAESOFB(ivRecv, 79)` | `79`（`0x004F`） | `0x4F00` |

发包头（`getPacketHeader`）：

```text
iiv     = (iv[3] | (iv[2] << 8)) XOR storedVersion
mlength = byteswap16(length) XOR iiv
header  = [iiv >> 8, iiv & 0xFF, mlength >> 8, mlength & 0xFF]
```

收包校验（`checkPacket`）只看头的前两字节：

```text
(header[0] XOR iv[2]) == (storedVersion >> 8)
(header[1] XOR iv[3]) == (storedVersion & 0xFF)
```

对 recv 对象，stored version 是 `0x4F00`，所以：

```text
header[0] XOR iv[2] == 0x4F
header[1] XOR iv[3] == 0x00
```

长度（`getPacketLength`）：

```text
mixed = (header >>> 16) XOR (header & 0xFFFF)
N     = byteswap16(mixed)
```

客户端比对时要记住：服务端 **发送** 用 `-80` 交换后的 `0xB0FF`，服务端 **接收** 用 `79` 交换后的 `0x4F00`。两边不是同一个版本字。

## AES

| 项 | 值 |
| --- | --- |
| 函数 | `MapleAESOFB.crypt` |
| 算法 | `Cipher.getInstance("AES")`，即 `AES/ECB/PKCS5Padding`，模式 `ENCRYPT_MODE` |
| 密钥 | 32 字节，AES-256。`SecretKeySpec(..., "AES")` |
| 密钥来源 | 类里的静态数组，与 `MAPLE_AES_KEY` 相同 |
| 输入 | 整段封包正文 |
| 输出 | 原地 XOR 后的同样长度；随后 `updateIv()` |
| 状态 | `iv`（4 字节）、`mapleVersion`、`cipher` |

密钥字节：

```text
13 00 00 00 08 00 00 00 06 00 00 00 B4 00 00 00
1B 00 00 00 0F 00 00 00 33 00 00 00 52 00 00 00
```

SHA-256：`2c92f26207d63c11434e891fcf22f57ee4f647e09ce723e158eac01491572ec2`。

`crypt` 把 4 字节 IV 重复 4 次得到 16 字节，对这 16 字节做 `doFinal`，只用返回值的前 16 字节当作密钥流，按字节 XOR 正文。块长先按 1456，跨过第一段之后改为 1460。每 16 字节重新加密当前密钥流块。

`doFinal` 在 PKCS5Padding 下对满 16 字节会多出一个填充块。代码只复制前 16 字节，因此实际 XOR 用的是首块密文。

初始化失败时的报错原文要求使用 Unlimited Strength cryptography jar。`环境/说明.txt` 要求覆盖 `local_policy.jar` 和 `US_export_policy.jar`。

## IV 更新

`getNewIv` 的初始 4 字节是 `{-14, 83, 80, -58}`，即 `F2 53 50 C6`。然后对旧 IV 的每个字节调用 `funnyShit`。

`funnyBytes` 长度 256。SHA-256：`6a86cd82f1abe956c8d4a58441e1375cd48d6b510db73d15a194de1400eb6565`。前 16 字节：`EC 3F 77 A4 45 D0 71 BF B7 98 20 FC 4B E9 B3 E1`。

`rammyByte` 是同一张表的另一份拷贝。`funnyShit` 用这张表做加减、异或，再把 4 字节左旋 3 位。源码位置：`tools/MapleAESOFB.java` 的 `funnyBytes`、`getNewIv`、`funnyShit`。

握手里的 IV 种子：

| 方向 | 前 3 字节 | 第 4 字节 |
| --- | --- | --- |
| server recv / client send | `46 72 7A` | `Randomizer.nextInt(255)` |
| server send / client recv | `52 30 78` | `Randomizer.nextInt(255)` |

## 自定义变换

类名 `MapleCustomEncryption`。没有名为 Shanda 的类或字符串。

`encryptData` 做 6 轮。偶数轮从下标 0 走到末尾：左旋 3、加长度低字节、与 `remember` 异或、按长度右旋、按位取反、加 `72`。奇数轮从末尾走到 0：左旋 4、加长度、与 `remember` 异或、异或 `0x13`、右旋 3。每处理一字节，长度计数减 1。`decryptData` 是对应的逆操作，轮次从 1 到 6。

输入和输出都是整段 opcode 正文，长度不变。它不碰 4 字节头。

## 和 opcode 的关系

opcode 是解密之后正文的小端 short。加密不单独编码 opcode。`RecvPacketOpcode.reloadValues()` 从 classpath 里的 `recvops.properties` 加载数值；找不到的枚举名被设为 `-2`。
