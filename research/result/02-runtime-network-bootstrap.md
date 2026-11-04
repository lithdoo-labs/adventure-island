# Runtime Network Bootstrap

最低成功标准没有达到。客户端没有在可观察的状态下连上 `127.0.0.1:9555`，因此没有客户端握手、没有从客户端收发缓冲解出的业务包，也没有 connect caller 的 RVA。

调试器从进程创建开始附着时，操作者看到错误弹窗，内容是检测到调试代码，随后客户端直接退出。64 位调试宿主和 32 位调试宿主都停在同一退出码 `0xFFFF9108`，当时 `ws2_32.dll` 还没加载。异常地址见第 12 节。按任务约束，这里只记录阻断点，不再附着调试器，也不隐藏调试器、不改 exe。

离线封包脚本已经按 Task 002 的算法写好，并且和本机登录服、以及 JAR 里的 `MapleAESOFB` 对上了。

## 1. Environment

| 项 | 值 |
| --- | --- |
| 系统 | Microsoft Windows NT 10.0.26200 |
| Python | 3.14.4，64-bit。另一次用 3.12.10 embeddable 32-bit，只作为调试宿主 |
| 调试器 | 没有安装 x32dbg / WinDbg。两次宿主都只准备在 `ws2_32` 导出上放硬件执行断点，没有改 `ws2_32` 或客户端代码。进程在 `ws2_32` 加载前退出，断点没有装上 |
| 客户端清单 | `requestedExecutionLevel level="requireAdministrator"`。未改 `MapleStory.exe` |
| 隔离 | `netsh advfirewall` 添加出站阻断需要管理员。当前代理令牌不是提升后的，规则没有加上 |
| 公网 | 调试器里准备了“非 127.0.0.1 的 connect 只记目标并改写到本机未监听端口”的逻辑。进程在第一次 connect 之前就退出了，所以这条逻辑没有命中 |
| 服务端 | 捆绑的 MySQL 5.5.53 只绑 `127.0.0.1:3306`。`server.Start` 打出登录端口 9555、频道 7575–7578、商城 8600 |
| 账号 | 没有完成登录。没有把账号、口令或 MAC 写入结果 |

启动调试器时，客户端会自己退出。没有对 HackShield、壳或完整性检查做 patch、禁用或绕过。

## 2. Sample Verification

工作副本：`.work/task-001/extracted/冒险岛online/MapleStory.exe`。

SHA-256：`5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`。

和 Task 001 一致。启动参数是 `MapleStory.exe 127.0.0.1 9555`。

## 3. Runtime Module Timeline

调试器从进程创建开始跟踪。主模块基址是 `0x400000`，和 Task 001 的 ImageBase 相同，这次运行没有被 ASLR 挪走。`SizeOfImage` 是 10330112。

`ws2_32.dll` 还没加载，进程的退出码已经变成 `0xFFFF9108`。64 位宿主看到的模块记在 `result/runtime-module-map.txt`。列表里没有 HShield / ehsvc。

32 位宿主看到的加载顺序更短，因为没有 64 位 wow64 模块，但最后两个模块同样是 `winmm.dll`、`WinTypes.dll`，然后同样是退出码 `0xFFFF9108`。

没有调试器时，同一个 exe 可以保持运行，窗口标题是 `MapleStory`。`PrintWindow` 得到全黑画面，符合 DirectX 窗口。那次运行在采样时只连了 `127.0.0.1:17890`，没有连 9555。

## 4. Login Connect

没有记录到客户端对 `127.0.0.1:9555` 的 `connect` / `WSAConnect`。

caller VA、caller RVA、调用栈都空着。`candidate_CClientSocket_Connect` 没有地址。

调试器从启动就附着时，进程死在 WinSock 加载之前。对已经跑起来的进程再 `DebugActiveProcess`，只看到一次 64-bit `ntdll` 断点 `0x80000003`，地址 `0x7ffd72343ab0`，随后进程以退出码 0 结束。这不是一个可用的游戏调用栈。这次附着同样触发了退出，没有留下 9555 的 caller。

## 5. Handshake

客户端这条连接上的 15 字节握手没有重组到。

登录服本身会发这条握手。用脚本对 `127.0.0.1:9555` 做了一次独立 TCP 连接（不是 MapleStory.exe），一次 `recv` 得到 15 字节：

```text
0D 00 4F 00 00 00 46 72 7A F0 52 30 78 19 04
```

`scripts/maple079_packet.py handshake` 解析为 version 79、locale 4、client-send IV `46727af0`、client-recv IV `52307819`。这次连接随即关闭，没有发登录包。

## 6. Login Packet

没有客户端 `send` / `WSASend` 样本，所以没有解出 `LOGIN_PASSWORD 0x0001`。

## 7. Receive Path

没有客户端 `recv` / `WSARecv` 的业务密文，所以没有解出 `LOGIN_STATUS`、`SERVERLIST`、`CHARLIST` 或 `SERVER_IP`。

## 8. Crypto Anchors

见 `result/runtime-crypto-anchors.md`。客户端内存里没有命中 AES key、IV 表或 IV 种子。

脚本自检：

```text
python scripts/maple079_packet.py selftest
selftest ok
handshake version 79 locale 4
client_send_iv 46727a11
client_recv_iv 5230787a
```

自检覆盖了：IV 更新结果为 4 字节、两个方向的 `decrypt(encrypt(x)) == x`（含 1500 和 3000 字节）、头长度互逆、握手前缀能抽出 version 79 和 locale 4。

另外用捆绑 JRE 跑了 JAR 里的 `MapleCustomEncryption` 和 `MapleAESOFB`，短包结果和脚本逐字节相同。见 crypto anchors 文档。

## 9. Dispatcher

没有。客户端没有跑到读取明文 opcode 的地方。

## 10. Channel Migration

没有。没有 `SERVER_IP`，没有第二次 connect，没有新的握手，没有 `PLAYER_LOGGEDIN 0x0B`，没有 `WARP_TO_MAP 0x81`。

## 11. Function Candidates

`result/client-function-candidates.csv` 只保留了任务里的候选名字。地址列是空的。

## 12. Blockers

操作者在调试器附着的运行里看到错误弹窗，弹窗说明检测到调试代码，然后客户端直接退出。下面是同一次退出前调试器记下的异常。主模块基址 `0x400000`，两条落在 `MapleStory.exe` 里的异常都按这个基址算了 RVA。

| 宿主 | 顺序 | 异常码 | 含义 | 地址 | 模块 | RVA | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 64-bit Python 3.14.4 | 1 | `0x4000001F` | `STATUS_WX86_BREAKPOINT` | `0x77738B88` | 32-bit `ntdll.dll`（基址 `0x77620000`） | `0x118B88` | 出现在 `user32.dll` 加载之前 |
| 64-bit Python 3.14.4 | 2 | `0xC000001D` | `STATUS_ILLEGAL_INSTRUCTION` | `0x00C62E76` | `MapleStory.exe` | `0x862E76` | `rpcrt4.dll` 之后、`winmm.dll` 之前 |
| 64-bit Python 3.14.4 | 3 | `0xC0000096` | `STATUS_PRIVILEGED_INSTRUCTION` | `0x00C62FB0` | `MapleStory.exe` | `0x862FB0` | 紧挨上一条，相距 `0x13A` 字节 |
| 32-bit Python 3.12.10 | 1 | `0xC000001D` | `STATUS_ILLEGAL_INSTRUCTION` | `0x00C62E76` | `MapleStory.exe` | `0x862E76` | first chance |
| 32-bit Python 3.12.10 | 2 | `0xC0000096` | `STATUS_PRIVILEGED_INSTRUCTION` | `0x00C62FB0` | `MapleStory.exe` | `0x862FB0` | first chance |

两次的进程退出码都是 `0xFFFF9108`。退出前最后加载的模块是 `WinTypes.dll`。`ws2_32.dll` 没有出现，硬件断点没有装上，`connect` / `send` / `recv` 都没有命中。32 位宿主事先用 `C:\Windows\SysWOW64\notepad.exe` 对过调试事件布局：`CONTEXT` 大小 716，记事本主模块读到 `MZ`。因此这次退出不是 64 位调试结构把事件解析错了。

其余阻断：

1. 客户端清单要求管理员。未提升的代理加不上防火墙规则。提升后的调试器可以创建进程，游戏进程随即退出。
2. 对已经跑起来、当时没有调试器的进程做 `DebugActiveProcess`：先看到 64-bit `ntdll` 断点 `0x80000003`，地址 `0x7ffd72343ab0`，然后进程退出码 0。没有 32-bit 游戏调用栈。
3. 不附着调试器时进程可以留下。采样窗口里的 TCP 只有 `127.0.0.1:17890`，对端进程名 `Dapan.exe`。没有 9555，所以没有客户端握手和解密。没有再分析 `Dapan.exe`。
4. 有一次无调试器的管理员启动，UAC 被取消，那次没有新进程。

没有隐藏调试器，没有改 manifest，没有改 `MapleStory.exe`，没有动 HackShield。检测到调试代码之后就停止继续附着。

## 13. Recommended Task 004

调试器附着会弹出“检测到调试代码”并退出，重复附着得到的是同一组异常和同一个退出码。在这个阻断被接受之前，扩大 dispatcher 或 `CField` 没有新的运行时证据。

封包脚本可以复用。还缺的是一次真正由 `MapleStory.exe` 发起的 `127.0.0.1:9555` 连接、握手、一条 C->S、一条 S->C，以及 connect caller 的 RVA。这些项这次都没有。
