# 怀旧岛079V5服务端 — Baseline

## 1. Input

任务书中的路径是 `.raw/怀旧岛079V5服务端.rar`。磁盘上没有这个文件名。同目录里除客户端归档外，只有一个文件名恰好为 `.rar` 的归档。7-Zip 列出的顶层目录是 `079V5/`，其中包含 `启动服务端.bat`、`dist/江浩079.jar`、`服务端配置.ini`。本次把它当作服务端样本分析，没有重命名或改写 `.raw/`。

| 项 | 值 |
| --- | --- |
| 磁盘路径 | `.raw/.rar` |
| 任务书期望名 | `.raw/怀旧岛079V5服务端.rar`（不存在） |
| 大小 | 403,341,265 字节 |
| MD5 | `38e3bdc52e25dfa759fe6a66a18f8dd6` |
| SHA-1 | `6ed99b2af972a70a2a7918590eb66e146c76ccd3` |
| SHA-256 | `e074714d6e0f6f3d94ca38e3aca7a10091eb19e9ba69fb2baf4ba02928f1bb1f` |

解压到 `.work/task-002/server/`。7-Zip 26.00，退出码 0，`Everything is Ok`。

| 项 | 值 |
| --- | --- |
| 类型 | `Rar`（不是 `Rar5`） |
| 条目版本 | 29 |
| Solid / 加密 / 多卷 | 否 / 否 / 否（`Volumes = 1`） |
| Blocks | 40961 |
| 文件 / 目录 | 40672 / 289 |
| 未压缩大小 | 2,113,004,234 |

完整清单在 `result/server-file-manifest.csv`。

## 2. Environment

分析时间：2026-10-09（UTC+8）。

| 项 | 值 |
| --- | --- |
| 操作系统 | Microsoft Windows NT 10.0.26200.0 |
| Python | 3.14.4 |
| 归档工具 | 7-Zip 26.00 (x64) |
| 反编译 | CFR 0.152，由归档内的 JRE `java.exe` 启动 |
| 该 JRE | Java 1.7.0_80，64-bit，路径 `079V5/Java/jre7` |

系统 PATH 上没有独立的 `java` / `javap`。没有启动 `启动服务端.bat`、MySQL、`江浩079.jar` 的 `main`，也没有执行客户端。JRE 只用来跑 CFR。

## 3. Stack

这是一个 Java + Apache MINA 的私服，没有随包 Java 源码。逻辑在 `079V5/dist/江浩079.jar`（3,859,102 字节，SHA-256 `49382081ff5525380bc6024f61859d2e08c2983b0faca2554061c6d1218cf360`）。`dist/README.TXT` 是 NetBeans 构建说明，命令行示例仍写着 `java -jar "MinaMS_079.jar"`。实际启动脚本 `启动服务端.bat` 的主类是 `gui.江浩`，classpath 为 `dist\*` 和 `支持库\*`。

| 组件 | 证据 |
| --- | --- |
| Java 7 | 捆绑 `Java/jre7`，`java version "1.7.0_80"` |
| Apache MINA 2.0.9 | `dist/lib/mina-core-2.0.9.jar`；`NioSocketAcceptor`、`ProtocolCodecFilter` |
| MySQL | `dist/lib/mysql-connector-java-bin.jar`；配置 URL `jdbc:mysql://localhost:3306/079V5` |
| SLF4J | `slf4j-api.jar`、`slf4j-jdk14.jar` |
| 脚本 | `079V5/脚本/` 下大量 `.js` |
| 资源 | `079V5/wz/` 下约 3.4 万个 XML，不是原始 `.wz` |
| 数据库文件 | `079V5/mysql/` 下 `.frm` / `.myd` / `.myi` |
| 没有 | Netty、C# 程序集、独立世界服进程、游戏 Java 源码 |

`Java/` 目录是 JRE，不是服务端源码。

## 4. 相对常见 079/OdinMS 形态的差异

下面只记录本 JAR 和 ini 里能直接看到的差异。类名像 OdinMS 不能当成“这就是上游原版”。

| 归类 | 内容 | 依据 |
| --- | --- | --- |
| 本样本配置 | 登录端口 9555，而 `LoginServer.PORT` 的字段初值是 8484 | `江浩.LPort` 在启动时覆盖 `PORT` |
| 本样本配置 | 对外 IP 固定写 `127.0.0.1` | `江浩.IP` |
| 本样本配置 | 自动注册开启 | `江浩.AutoRegister=true`，`CharLoginHandler.login` |
| 本样本文案 | 公告和气球写“怀旧岛079V5” | `江浩.ServerMessage`，`ServerConstants.getBalloons` |
| 代码里的版本 | 握手版本 79、locale 字节 4、patch 为空。`MAPLE_PATCH="1"` 没有进握手 | `LoginPacket.getHello` |
| 代码里的职业开关 | 骑士团关闭，冒险家和战神开启 | ini |
| 代码里的收包重定向 | `LICENSE_REQUEST (0x03)` 的 case 调用的是 `ServerListRequest`，不是 `LicenseRequest` | `MapleServerHandler.handlePacket` |
| 代码里的未接线 opcode | `HELLO_LOGIN`、`HELLO_CHANNEL`、`AUTH_SECOND_PASSWORD` 不在 `recvops.properties`，加载后为 -2 | `ExternalCodeTableGetter` 默认值 |
| 与客户端 Task 001 的关系 | 服务端 JAR 中没有 HackShield、HSBypass、ehsvc 字符串。登录包只读账号、密码和 6 字节 MAC | 对 JAR 的字节搜索；`CharLoginHandler.login` |
| 无法单独归类 | AES 头对发送使用 `-80`、对接收使用 `79` | `sessionOpened` 的两个 `MapleAESOFB` 构造参数。这是本 JAR 的实际参数，没有再和另一份 079 源码做 diff |

客户端归档里的 `HShield/` 和版本资源中的 HSBypass 名称没有在服务端协议字段里出现。本次没有分析那些客户端文件的行为。

## 5. What was not run

没有启动服务端、数据库或登录器。数据库密码、配置里的口令、源码中的联系 QQ、硬编码的非本机 IP，在结果里写成 `<redacted>`。`日志/logs/ACPW.txt` 按代码会记录账号口令，本次没有读取该日志。
