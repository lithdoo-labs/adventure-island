# 服务端拓扑

配置来源是 `079V5/服务端配置.ini`。绑定代码在 JAR 的反编译结果里。监听地址没有写死到 `127.0.0.1`：`acceptor.bind(new InetSocketAddress(port))` 只传端口，因此绑在所有本机地址上。发给客户端的 IP 来自配置键 `江浩.IP`。

```text
MapleStory.exe 127.0.0.1 9555
  ↓ TCP
login server   0.0.0.0:9555     对外通告 IP = 江浩.IP (127.0.0.1)
  ↓ SERVER_IP 包把频道地址发给客户端
channel server 0.0.0.0:7575-7578
  ↓ 同一进程内的 world 对象，没有单独的 world 端口
field / game session
```

商城是第三条 TCP 服务，不在上面这条主链的必经路径上。

## 端口

| 角色 | 地址 | 端口 | 配置 | 绑定位置 | 客户端何时连接 |
| --- | --- | --- | --- | --- | --- |
| 登录服 | 通告 `127.0.0.1`；bind 仅端口 | **9555** | `江浩.LPort = 9555`。源码字段默认值是 `8484`，启动时被 `LPort` 覆盖 | `LoginServer.run_startup_configurations`：`PORT = 江浩.LPort`，`acceptor.bind(new InetSocketAddress(PORT))`，handler 为 `MapleServerHandler(-1, false)` | 客户端第一个 TCP 连接。对应 `单机登陆器.bat` 的 `MapleStory.exe 127.0.0.1 9555` |
| 频道 1–4 | 通告 `127.0.0.1` | **7575, 7576, 7577, 7578** | `江浩.Count = 4`。`江浩.Port = 7575` 这个键不会被读取。代码读的是 `江浩.Port` + 频道号，缺省为 `7574 + channel` | `ChannelServer.run_startup_configurations` 第 130 行附近，`MapleServerHandler(channel, false)` | 选角成功后，登录服下发 `SERVER_IP`，客户端断开登录服再连该端口 |
| 商城 | 通告 `江浩.IP:8600` | **8600** | ini 里有 `江浩.SCPort = 8600`，JAR 中没有 `SCPort` 字符串。`CashShopServer` 把 `8600` 写死 | `CashShopServer.run_startup_configurations`，`MapleServerHandler(-1, true)` | 进商城时，不是登录后的第一跳 |
| MySQL | `localhost` / `127.0.0.1` | 3306 | `服务端配置.ini` 的 JDBC URL，以及 `Config.ini` 的 `port` | 数据库进程，不在游戏 JAR 里 | 客户端不连接 |
| 世界服 | 无独立套接字 | 无 | `handling.world` 是进程内对象 | 没有 `bind` | 客户端不单独连接世界服 |

频道端口计算：频道号从 1 到 `江浩.Count`。`Port1`…`Port4` 在 ini 里不存在，所以使用 `7574 + channel`。四个频道就是 7575–7578。`江浩.IP` 被拼成 `127.0.0.1:<port>`，再由 `MaplePacketCreator.getServerIP` 把 IP 的 4 个原始字节和端口发给客户端。

## 9555 的角色

**9555 是登录服端口，不是代理端口，也不是频道端口。**

证据：

1. `服务端配置.ini`：`江浩.LPort = 9555`，`江浩.IP = 127.0.0.1`。
2. `LoginServer.java` 用 `江浩.LPort` 赋值给 `PORT` 并 `bind`。日志字符串是“登录器服务器绑定端口”。
3. 同文件里的 `8484` 只是字段初始值，启动配置会覆盖它。本样本的有效登录端口是 9555。
4. 客户端 Task 001 的 `冒险岛online/单机登陆器.bat` 全文是 `MapleStory.exe 127.0.0.1 9555`。
5. `【必看】：启动步骤.txt` 第 4 步写的是启动服务端后再打开客户端单机登陆器。

频道端口从 7575 起，商城是 8600。这三组端口彼此不同。
