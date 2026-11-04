# 握手

来源：`handling/MapleServerHandler.sessionOpened` 与 `tools/packet/LoginPacket.getHello`。登录服、频道服、商城服共用这个 `sessionOpened`。每条新 TCP 连接都会发一次握手，IV 里的最后一个字节每次随机。

`session.write(getHello(...))` 发生在 `session.setAttribute("CLIENT", client)` 之前。`MaplePacketEncoder` 只有在 `CLIENT` 已设置时才加密封包。因此第一条服务端数据是明文，不走 AES 头。

## 字段

写包类是 `tools.data.output.GenericLittleEndianWriter.writeShort`：先写低字节，再写高字节。

`getHello` 的参数顺序是 `(version, sendIv, recvIv)`，函数体先写 `recvIv` 再写 `sendIv`。调用点传入的是 `(79, ivSend, ivRecv)`。

| offset | size | direction | field | 本样本的值 | source |
| --- | ---: | --- | --- | --- | --- |
| 0x00 | 2 | S->C | 后续载荷长度 | `13`，字节 `0D 00` | `LoginPacket.getHello` `writeShort(13)` |
| 0x02 | 2 | S->C | MapleStory version | `79`，字节 `4F 00` | `writeShort(79)`；常量 `ServerConstants.MAPLE_VERSION` |
| 0x04 | 2 | S->C | patch 长度 | `00 00`，空字符串 | `write(new byte[]{0, 0})`。`MAPLE_PATCH = "1"` 没有写入 |
| 0x06 | 4 | S->C | server recv IV | `46 72 7A RR` | `serverRecv = {70, 114, 122, Randomizer.nextInt(255)}`，即 ASCII `Frz` 加 1 个随机字节 |
| 0x0A | 4 | S->C | server send IV | `52 30 78 SS` | `serverSend = {82, 48, 120, random}`，即 ASCII `R0x` 加 1 个随机字节 |
| 0x0E | 1 | S->C | locale | `04` | `write(4)` 字面量 |

总长度 15 字节。长度字段 13 覆盖其后的 13 字节：版本 2 + patch 2 + 两个 IV 8 + locale 1。

IV 的方向：

- 线上先出现的 4 字节是服务端的 **recv** IV。服务端用它构造 `new MapleAESOFB(ivRecv, 79)`。客户端发送时要使用这组 IV。
- 后出现的 4 字节是服务端的 **send** IV。服务端用它构造 `new MapleAESOFB(ivSend, -80)`。客户端接收时要使用这组 IV。

版本参数不对称，见 `protocol-crypto.md`：收包密码对象传入 `79`，发包密码对象传入 `-80`。

没有 V5 额外握手字段。`MAPLE_TYPE` 虽然也是 4，但握手没有读取该字段。

## 短样例

随机字节用 `RR` / `SS` 表示。固定前缀可以用来认出第一次 `recv`：

```text
0D 00 4F 00 00 00 46 72 7A RR 52 30 78 SS 04
```

搜索锚点：`0D 00 4F 00 00 00 46 72 7A`。

频道连接会再发一条同样布局的握手，`RR` 和 `SS` 重新随机。商城连接也一样。
