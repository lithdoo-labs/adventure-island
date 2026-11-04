# Win7 x86 SP1 自然运行观察

用 `.raw/cn_windows_7_professional_with_sp1_x86_dvd_622569.iso` 做了和 Task 024 相同的无调试器启动。32 位 SP1 没有比 x64 RTM 走得更远。两边都停在同一条程序兼容性助手提示。

没有调试器，没有 Procmon，没有补丁，没有伪造 SoftICE 或 Oreans 设备，没有关防火墙，没有改系统日期。网卡保持断开。`.raw/` 没有写入。

## 介质和客户机

| 项 | 值 |
| --- | --- |
| 文件 | `cn_windows_7_professional_with_sp1_x86_dvd_622569.iso` |
| 大小 | 2,651,877,376 字节 |
| SHA-256 | `453b03fd82caffbee087b856f28841fdde21060ccbf44757e897470513051b28` |
| 卷标 | `GRMCPRFRER_CN_DVD` |
| `ei.cfg` | Professional，Retail，VL 0 |
| `idwbinfo.txt` | `BuildArch=x86`，`BuildBranch=win7sp1_rtm`，`OfficialBuild=TRUE` |
| 安装的映像 | `install.wim` index 4，Windows 7 专业版，6.1.7601，SPLEVEL 1，x86，zh-CN |

客户机 `WIN7X86LAB`。`systeminfo` 写的是 Microsoft Windows 7 专业版，6.1.7601 Service Pack 1 Build 7601，系统类型 X86-based PC。`BuildLabEx` 是 `7601.17514.x86fre.win7sp1_rtm.101119-1850`。WMI 的 `OSArchitecture` 是 32-bit，`ServicePackMajorVersion` 是 1。防火墙三个配置文件都开着，策略 `BlockInbound,AllowOutbound`。没有网卡。QEMU 是 `qemu-system-i386`，`-cpu coreduo`，`-accel tcg`，2048 MB，`-nic none`。

`F:\MapleStory.exe` 在客户机里的 SHA-256 仍是 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`。

## 启动

命令行是 `F:\MapleStory.exe`。客户机时间 2026-10-13 01:55:43。进程 PID 2312，父进程是观察脚本的 `cmd.exe`。

先出现用户帐户控制：程序名称 MapleStory China，已验证的发布者 NEXON Corp.。同意之后，程序兼容性助手显示：

> 程序 Maple story，发布者 Wizet，位置 `F:\MapleStory.exe`。Maple story 与此版本的 Windows 不兼容。

应用程序日志事件 ID 1，来源 `Microsoft-Windows-ApplicationExperienceInfrastructure`，时间 2026-10-13 01:56:04，正文相同。

选择「运行程序」之后，PID 2312 仍在。到采样结束，工作集约 4,808 KB，CPU 时间约 1 分 41 秒，没有窗口标题。`HSUpdate.exe` 和 `ASPLnchr.exe` 没有出现。

提升后的 `tasklist /m` 列出的模块是：`ntdll.dll`、`kernel32.dll`、`KERNELBASE.dll`、`apphelp.dll`、`USER32.dll`、`GDI32.dll`、`LPK.dll`、`USP10.dll`、`msvcrt.dll`、`IMM32.DLL`、`MSCTF.dll`、`ADVAPI32.dll`、`sechost.dll`、`RPCRT4.dll`、`winmm.dll`。

没有 `ws2_32.dll`，没有 `ehsvc.dll`、`AspINet.dll`、`PCOM.dll`、`NameSpace.dll`、`Canvas.dll`、`ZLZ.dll`。`apphelp.dll` 在列表里。运行前后都没有 `SICE`、`NTICE`、`SIWVID`、`oreans32`、`oreansx64`、`ehsvc` 服务，也没有新的 `oreans*` 文件。Code Integrity 操作日志是空的。`netstat` 没有 9555。

## 和 x64 那次的差别

x64 RTM 上是同一句兼容性提示、同一种没有游戏窗口的存活进程、同一组加载器加 `apphelp.dll` 的模块，同样没有 HackShield，也没有 `ws2_32.dll`。换成 32 位 SP1 没有越过这条边界。所以「还需要 Win7 x86 才能往下走」没有被这次运行证实。这条兼容性条目看的是程序和 Windows 版本，不是 x64。
