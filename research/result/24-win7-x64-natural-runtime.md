# Task 024 — Win7 x64 自然运行观察

结论是 **Route C**。Windows 7 专业版 x64 RTM（6.1.7600，无 Service Pack）可以启动，客户端哈希与既有记录一致，但无调试器的第一次运行没有比现代宿主走得更远。最早的可见边界是程序兼容性助手，不是 `0xC0E90008`，也不是 Oreans 驱动。

没有调试器，没有 Procmon，没有补丁，没有伪造 `\\.\SICE`、`\\.\SIWVID`、`\\.\NTICE` 或 Oreans 设备，没有打开测试签名，没有关闭驱动签名或防火墙，没有改系统日期。`.raw/` 没有写入。

## 1. 起点

| 项 | 值 |
| --- | --- |
| 分支 | `main` |
| STARTING_HEAD | `cbcee5e084763751b4f4f36c5492f84d7a2eaaba` |
| 介质 | `.raw/cn_windows_7_professional_x64_dvd_x15-65791.iso` |
| 介质 SHA-256 | `f94a0db93bc29cbd1cabb91d2f3d2ead7020c030171a0b14c22b6c879e784aba` |
| Service Pack | 不是 SP1。`BuildLabEx` 为 `7600.16385.amd64fre.win7_rtm.090713-1255` |

先前一份结果把同一任务记成 Route D，因为当时还没有客户机。本文件用这次已经启动的客户机替换那份结论。

## 2. 客户机

QEMU 7.2.22 跑在已经存在的 Docker 容器 `task024-qemu` 里，`-machine pc,accel=tcg`，2 vCPU，2048 MB，`-nic none`。没有安装新的 Hyper-V 角色，没有桥接，没有客户机代理。系统盘是 `.work/task-024/vm/win7x64.qcow2`。安装后的桌面快照名是 `win7x64-clean`。这次观察是同一系统盘的一次冷启动，并额外挂了两块 USB 磁盘：一块 FAT32 用来把文本结果拷出来，一块 NTFS 用来放客户端。

`systeminfo` 与 WMI：

| 项 | 值 |
| --- | --- |
| 计算机名 | `WIN7X64LAB` |
| 名称 | Microsoft Windows 7 专业版 |
| 版本 | 6.1.7600，Build 7600 |
| Service Pack | `ServicePackMajorVersion` 0。`systeminfo` 的修补程序栏是「暂缺」 |
| 系统类型 | x64-based PC |
| `PROCESSOR_ARCHITECTURE` | `AMD64` |
| WOW64 | `C:\Windows\SysWOW64` 存在。客户端是 PE32，由 WOW64 承载 |
| PowerShell | 2.0，CLR 2.0.50727.4927 |
| 防火墙 | 域、专用、公用三个配置文件都是打开，策略 `BlockInbound,AllowOutbound` |
| 网卡 | 无。QEMU 使用 `-nic none` |
| 时区 | UTC+08:00 |

安装前和这次运行之后，只读查询都找不到这些项：`HKCU\Software\WinLicense`、`HKCU\Software\WLkt`、`HKLM\SOFTWARE\WLkt`、`HKCU\Software\Wine`，以及服务 `SICE`、`SIWVID`、`NTICE`、`oreans32`、`oreansx64`、`ehsvc`。驱动列表里也没有这些名字。

## 3. 客户端哈希

客户端从既有解压目录复制到一块新的 NTFS 虚拟磁盘，再作为 USB 磁盘交给客户机，盘符 `F:`。没有改 `.raw/`。客户机内 `certutil -hashfile` 的 SHA-256：

| 文件 | 客户机 SHA-256 | 与既有记录 |
| --- | --- | --- |
| `MapleStory.exe` | `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d` | 一致，既有 RVA 仍可用 |
| `HShield\HSUpdate.exe` | `daf95bde2293271f59df320e5d934bd47e0e5b14da1d47536ef25596c9db1393` | 一致 |
| `HShield\AspINet.dll` | `21f8027c6be26c3957640c4c8862cb7a23b0b904af8c42f2b70961f414a5d17e` | 一致 |
| `HShield\ehsvc.dll` | `12bdbe8b2b64fbcb34913407722fc0e1d6bb1332e5b269355d77b63c42d7ff06` | 一致 |
| `HShield\ehsvc.old` | `78d47f032d493ce5fb59eecaa31aa2be047386ee0416780df19fb62db4d35272` | 一致 |

## 4. 无调试器启动

命令行是 `F:\MapleStory.exe`，没有服务器参数。客户机时钟 2026-10-12 17:34:16。父进程是观察脚本所在的 `cmd.exe`，PID 1936。游戏进程 PID 272，用户 `WIN7X64LAB\research`。

启动后先出现用户帐户控制。程序名称 `MapleStory China`，已验证的发布者 `NEXON Corp.`，文件源是本机硬盘。这是可执行文件自己的管理员清单，不是后来加的兼容性设置。同意之后，程序兼容性助手（`#32770`，PID 592）显示：

> 此程序存在已知的兼容性问题。程序 Maple story，发布者 Wizet，位置 `F:\MapleStory.exe`。Maple story 与此版本的 Windows 不兼容。有关详细信息，请联系 Wizet。

按钮是「联机检查解决方案」「运行程序」「取消」。应用程序日志同一时刻有对应事件：来源 `Microsoft-Windows-ApplicationExperienceInfrastructure`，事件 ID 1，级别警告，正文与上面这句话相同。

选择「运行程序」之后，PID 272 仍在。到 17:36 的 `tasklist`，工作集约 5,948 KB，CPU 时间约 1 分 25 秒，状态是 Unknown，窗口标题是「暂缺」。`EnumWindows` 没有看到标题为 `MapleStory` 的游戏窗口。`HSUpdate.exe` 和 `ASPLnchr.exe` 六次采样都不在。没有子进程。

## 5. 模块

64 位 `tasklist /m` 对 PID 272 只列出 WOW64 宿主侧：`ntdll.dll`、`wow64.dll`、`wow64win.dll`、`wow64cpu.dll`。32 位 PowerShell `Get-Process.Modules` 看到的是进程内的 32 位模块：

`MapleStory.exe`、`ntdll.dll`、`kernel32.dll`、`KERNELBASE.dll`、`apphelp.dll`、`USER32.dll`、`GDI32.dll`、`LPK.dll`、`USP10.dll`、`msvcrt.dll`、`ADVAPI32.dll`、`sechost.dll`、`RPCRT4.dll`、`SspiCli.dll`、`CRYPTBASE.dll`、`IMM32.DLL`、`MSCTF.dll`、`winmm.dll`。

`MapleStory.exe` 模块大小约 10,088 KB，与映像 `SizeOfImage` 同量级，说明主映像已经映射。`apphelp.dll` 说明兼容性引擎已经进入这个进程。

下面这些在这次采样里没有出现：`ws2_32.dll`、`wininet.dll`、`ehsvc.dll`、`AspINet.dll`、`PCOM.dll`、`NameSpace.dll`、`Canvas.dll`、`ZLZ.dll`。

## 6. HackShield、SoftICE、Oreans

`HSUpdate.exe` 没有运行，`AspINet.dll` 没有进入 `MapleStory.exe` 的模块列表。`wevtutil` 查询 `Microsoft-Windows-CodeIntegrity/Operational` 得到空结果。这次没有 `0xC0E90008`，也没有 Smart App Control。Win7 RTM 本来就没有现代宿主那套 `VerifiedAndReputableDesktop` 策略；这里的事实是客户端还没走到 `HSUpdate.exe` 加载 `AspINet.dll` 那一步。

SoftICE 与 Oreans 的设备名没有被调试器跟踪。运行前后的服务、驱动和注册表查询都没有 `SICE`、`SIWVID`、`NTICE`、`oreans32`、`oreansx64` 或 `ehsvc`。游戏目录和 `system32\drivers` 下也没有新的 `oreans*` 或 `.sys`。因此没有进入驱动或服务阶段。静态字符串里的 `oreansx64.sys` 仍然只是静态证据。

## 7. 网络

第一阶段网卡保持断开。`netstat -ano` 只有系统 RPC 监听，没有到 9555、7575–7578 或 8600 的连接，也没有 `ESTABLISHED`。`ws2_32.dll` 没有加载，所以客户端还没有走到套接字阶段。因此没有再做私网 9555 测试。

## 8. 对八个问题的回答

1. Win7 x64 没有比现代宿主走得更远。现代宿主上至少出现过标题为 `MapleStory` 的对话框；这里停在兼容性助手，没有游戏窗口。
2. SoftICE 设备在运行前后都不存在。客户端自己的 `CreateFile` 没有跟踪。可以确认的是没有设备、没有驱动、没有服务被创建。
3. Oreans / WinLicense 没有进入驱动或服务阶段。
4. `HSUpdate.exe` / `AspINet.dll` 没有撞上 `0xC0E90008`，因为它们没有运行到加载那一步。
5. `ws2_32.dll` 没有加载。
6. 客户端没有连接 9555。
7. 最早的自然边界是程序兼容性助手：「Maple story 与此版本的 Windows 不兼容」。其后进程仍在，但没有游戏窗口、没有 HackShield、没有 `ws2_32.dll`。
8. 这次没有启动 Win7 x86，不能证明 x86 一定能过这个兼容性条目。能证明的是：这块 x64 RTM 客户机还不是可用的兼容性基线。

## 9. 里程碑

| 里程碑 | 状态 |
| --- | --- |
| M0 介质识别 | 完成 |
| M1 客户机版本 | 完成。专业版 x64，6.1.7600，无 SP |
| M2 客户机内哈希 | 完成，与规范哈希一致 |
| M3 无调试器启动 | 完成 |
| M4 设备探测后果 | 完成。服务、驱动、注册表在运行后仍为空 |
| M5 Oreans 驱动阶段 | 未到达 |
| M6 `ws2_32.dll` | 未加载 |
| M7–M9 9555 / 频道 / 商城 | 未到达 |

Route C。下一步应回到静态与参照对照，而不是绕过保护。
