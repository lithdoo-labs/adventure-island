# 服务端配置索引

口令、联系方式和硬编码的非本机地址已替换为 `<redacted>`。键名和端口保留。

## `079V5/服务端配置.ini`

由 `server.ServerProperties` 读取，键前缀是 `江浩.`，不是 `net.sf.odinms`。

| 键 | 值 | 用途 |
| --- | --- | --- |
| `driver` | `com.mysql.jdbc.Driver` | JDBC 驱动 |
| `url` / `wzurl` | `jdbc:mysql://localhost:3306/079V5?...characterEncoding=GBK` | 游戏库 |
| `user` | `root` | 数据库用户 |
| `password` | `<redacted>` | 数据库口令 |
| `江浩.Count` | `4` | 频道数量 |
| `江浩.Exp` / `Meso` / `Drop` / `BDrop` | `5` | 经验、金币、掉落倍率 |
| `江浩.Cash` | `1` | 点券倍率 |
| `江浩.ServerMessage` | 欢迎来到怀旧岛079V5版… | 登录公告 |
| `江浩.Flag` | `3` | 世界列表旗帜，写入 `LoginPacket.getServerList` |
| `江浩.AutoRegister` | `true` | 登录时自动建号 |
| `江浩.UserLimit` | `500` | 人数上限 |
| `江浩.MaxCharacters` | `3` | 角色槽 |
| `江浩.Port` | `7575` | **代码不读这个键**。频道实际读 `江浩.Port1` 这类键 |
| `江浩.LPort` | `9555` | 登录服端口 |
| `江浩.SCPort` | `8600` | ini 有此键；`CashShopServer` 不读它，端口字面量也是 8600 |
| `江浩.IP` | `127.0.0.1` | 下发给客户端的服务器 IP |
| `江浩.Debug` | `false` | 调试开关 |
| `江浩.封包显示` | `false` | 是否把封包打到日志 |
| `江浩.调试输出封包` | `false` | `LoginPacket` / `MaplePacketCreator` 的调试打印 |
| `江浩.冒险家` / `骑士团` / `战神` | `true` / `false` / `true` | 职业开关 |
| `江浩.个人PVP` / `组队PVP` / `家族PVP` | `701000210` | PVP 地图 |
| `江浩.MLevel` / `QLevel` | `200` | 等级上限 |
| `江浩.Events` | `Relic,HontalePQ,...` | 事件脚本名列表 |

## `079V5/Config.ini`

| 键 | 值 | 用途 |
| --- | --- | --- |
| `name` | `root` | 另一份数据库用户名 |
| `password` | `<redacted>` | 数据库口令 |
| `ip` | `127.0.0.1` | 数据库地址 |
| `bm` | `079V5` | 库名 |
| `port` | `3306` | 数据库端口 |

## `079V5/Config2.ini`

点券表 `accounts.ACash`，抵用表 `accounts.mPoints`，`hypay.pay` 称为“余额”。`wzdir` 为空。

## 启动脚本

`启动服务端.bat` 设置 `JRE_HOME` 为捆绑的 `\Java\jre7`，然后执行：

```text
java -server -Dnet.sf.odinms.wzpath=wz gui.江浩
```

`关闭服务端.bat` 用 `taskkill` 结束 `java.exe`。本次没有运行这两个脚本。

`【必看】：启动步骤.txt` 要求先配 Java 策略文件、启动 `mysql` 目录里的数据库，再运行 `启动服务端.bat`，最后打开客户端单机登陆器。账号在游戏登录界面输入即可注册。

`环境/说明.txt` 要求把 `支持库` 里的 `local_policy.jar` 和 `US_export_policy.jar` 覆盖到本机 JRE 的 `lib/security`。这与 `MapleAESOFB` 里 AES-256 初始化失败时的报错一致。

## JAR 内常量

| 符号 | 值 | 位置 |
| --- | --- | --- |
| `ServerConstants.MAPLE_VERSION` | `79` | `constants/ServerConstants.java` |
| `ServerConstants.MAPLE_PATCH` | `"1"` | 同上。握手函数没有使用它 |
| `ServerConstants.MAPLE_TYPE` | `(byte)4` | 同上。握手写入的是字面量 `4`，不是这个字段 |
| `LoginServer.PORT` 初始值 | `8484` | 被 `江浩.LPort` 覆盖 |
| `ChannelServer.DEFAULT_PORT` | `7574` | 实际端口是 `7574 + channel` |
| `CashShopServer.PORT` | `8600` | 字面量 |
| `GameConstants.绑定IP` | `127.0.0.1` | `Loggedin` 允许该常量或字面量 `127.0.0.1`。本样本两边都是本机地址 |

`ServerConstants.getBalloons()` 有两条登录界面气球。一条含“079V5”和“怀旧单机”，另一条含联系 QQ，结果中记为 `<redacted>`。
