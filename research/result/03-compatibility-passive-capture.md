# Task 005 — Compatibility Lab & Passive Protocol Capture

最低成功标准里，哈希、封包自检、`0xC0E90008` 定性、静态加载链、当前 Windows 无调试器运行，以及对 9555 的否定证据都有了。隔离的 Windows 7 虚拟机没有做：这台机器上没有现成 VM，也没有可信的安装介质，没有下载 ISO。真实客户端字节流没有捕获到。

## 1. Environment

| 项 | 值 |
| --- | --- |
| 系统 | Windows 10 Pro，版本 2009，构建 26200，64 位 |
| PowerShell | 5.1.26100.9444 |
| Python | 3.14.4，64-bit |
| Wireshark / Npcap | 未安装 |
| pktmon / WPR | 系统自带 |
| `citool.exe` | 存在；`-lp` 返回 `0x80070005` |
| VPN | `Dapan.exe` 仍监听 `127.0.0.1:17890`。没有退出 VPN，没有改系统代理 |
| 客户端 SHA-256 | `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d` |
| 封包自检 | `python scripts/maple079_packet.py selftest` → `selftest ok` |

## 2. Sample Verification

主程序哈希与 Task 001 / Task 004 一致，现有 RVA 结论可以继续用。没有修改 `.raw/`，没有 patch `MapleStory.exe`、`HSUpdate.exe`、`AspINet.dll` 或 `ehsvc.dll`。

## 3. Code Integrity Findings

**confirmed policy block。** 详见 `result/code-integrity-findings.md`。

2026-10-09 16:34:46，事件 3077 的 `Status` 是 `0xC0E90008`。策略名 `VerifiedAndReputableDesktop`，GUID `{0283ac0f-fff1-49ae-ada1-8a933130cad6}`。请求的签名级别是 2，验证结果是 1。事件 3089 显示签名数量为 0。事件 3118 的标题是 Smart App Control Block Details。`AspINet.dll` 的 flat hash 与文件 SHA-256 相同。

注册表 `VerifiedAndReputablePolicyState` 为 1。没有改策略。

## 4. HSUpdate / AspINet Load Chain

详见 `result/hshield-load-chain.md`。

`AspINet.dll` 是结构有效的 PE32，未签名，ProductName 为 `079过HS DLL 应用组件`。导出 `AIN_*` 在磁盘上有指令。`HSUpdate.exe` 有 AhnLab 签名，静态导入里没有 `AspINet.dll`，但导入了 `LoadLibraryA`。Code Integrity 记录的是 `HSUpdate.exe` 进程加载这个 DLL 时被策略拒绝。这不是损坏的 PE，也不是缺系统 DLL。

这次没有再次启动 `HSUpdate.exe`。

## 5. Current Windows Passive Run

17:08 启动了只绑本机的 MySQL（PID 17936，`127.0.0.1:3306`）和 `server.Start`（java PID 21684）。java 监听 `:::9555`、`:::7575`–`:::7578`、`:::8600`。捆绑服务端按端口绑在所有接口上；采样期间没有非本机客户端连入。采样结束后这两个进程已结束。

无调试器启动 `MapleStory.exe 127.0.0.1 9555`。提升后的进程是 PID 23452，父 PID 15492。大约 45 秒内 `Get-NetTCPConnection` 没有返回任何套接字，没有 9555，没有频道端口，没有 8600，也没有 17890。没有 `HSUpdate.exe`。可见窗口是对话框 `#32770`，标题 `MapleStory`，子控件只有一个 OK 按钮。非提升的 `taskkill` 拒绝结束这个进程。

17890 仍是 VPN 噪声。这次游戏进程没有连它。

事件表：`result/compatibility-runtime-events.csv`。

## 6. Compatibility VM

没有运行。`C:\ProgramData\Microsoft\Windows\Hyper-V` 下没有可用的虚拟机磁盘，用户目录里也没有现成的 Windows 7 介质。没有从互联网下载 ISO。矩阵里这一行是 `not run`：`result/compatibility-matrix.csv`。

## 7. Login TCP Session

not observed。

## 8. Handshake

not observed。没有客户端发出的 `0D 00 4F 00 00 00 46 72 7A`。

## 9. C->S Decode

not observed。没有 `LOGIN_PASSWORD 0x0001`。

## 10. S->C Decode

not observed。没有 `LOGIN_STATUS`、`SERVERLIST`、`CHARLIST` 或 `SERVER_IP`。

## 11. Channel Migration

not observed。没有 `PLAYER_LOGGEDIN 0x000B`，没有 `WARP_TO_MAP 0x0081`。

## 12. Uncertainties

对话框正文没有读到，只有标题和 OK 按钮。父 PID 15492 的映像名当时已经不在。`HSUpdate.exe` 内部哪一次 `LoadLibraryA` 指向 `AspINet.dll` 没有静态调用点；依据是 Code Integrity 的进程名和映像路径。`HSUpdate.env` 不是明文，没有解密。

## 13. Security / Isolation Notes

没有隐藏调试器，没有附加调试器，没有关 Smart App Control、Code Integrity、Defender 或 AppLocker，没有换 bypass DLL。VPN 保持原样。测试服和 MySQL 只在本机采样窗口内运行。结果里没有账号、口令或 MAC。`AspINet.dll` 版本资源里的数字标识写成 `<redacted>`。

## 14. Recommended Task 006

**Route C — Static loader-boundary analysis。**

当前 Windows 上，`HSUpdate -> AspINet` 被 `VerifiedAndReputableDesktop` 拒绝；无调试器的 `MapleStory.exe` 也没有连上 9555。没有一个能自然进入游戏网络的兼容环境，所以不能选 Route A 或 Route B。下一步继续静态看入口 stub 怎样把数据填进虚拟区，不把关闭 Smart App Control 或隐藏调试器当作办法。

## 15. Reproduction Commands

```text
python scripts/maple079_packet.py selftest
Get-WinEvent -LogName Microsoft-Windows-CodeIntegrity/Operational
```

`citool.exe -lp` 在当前令牌下会被拒绝。不要为了复现再启动 `HSUpdate.exe`。
