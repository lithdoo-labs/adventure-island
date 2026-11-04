# Win7 x64 与当前现代宿主的差异

Win7 客户机是 Windows 7 专业版 x64，6.1.7600，无 Service Pack。现代宿主是 Windows 10 Pro 版本 2009、构建 26200、64 位。现代宿主一列只引用已经写进 `result/` 的观察。

| 项 | 现代宿主 | Win7 x64 |
| --- | --- | --- |
| MapleStory 启动 | 一次 `CreateProcess` 因 WinError 740 没有建进程。另一次提升后的进程 PID 23452、父 PID 15492 出现过 | 进程建出来了。PID 272，父 PID 1936（观察用的 `cmd.exe`）。先有用户帐户控制，发布者是 NEXON Corp. |
| 进程是否继续存活 | 提升后的进程在采样窗口内仍在 | 仍在。到采样结束 CPU 时间约 1 分 25 秒，工作集约 5,948 KB，状态 Unknown |
| 窗口 / 对话框 | `#32770`，标题 `MapleStory`，可见子控件是一个 OK。正文没有读到 | 程序兼容性助手 `#32770`：Maple story 与此版本的 Windows 不兼容。没有标题为 MapleStory 的游戏窗口 |
| HSUpdate 是否运行 | 那次无调试器的启动里没有。更早的 Code Integrity 事件记录过 `HSUpdate.exe` | 六次采样都没有 |
| AspINet 加载尝试 | 有。进程是 `HSUpdate.exe` | 没有。`AspINet.dll` 不在模块列表里 |
| AspINet 加载结果 | 拒绝。`0xC0E90008`，`VerifiedAndReputableDesktop`，Smart App Control 事件 3118 | 没有发生。Code Integrity 操作日志为空 |
| Code Integrity 失败 | 有 | 没有对应事件。Win7 RTM 也没有现代宿主那套 Smart App Control |
| SoftICE 探针 | `CreateFileA` 对三个设备返回失败，错误 2 | 没有跟踪客户端的 `CreateFile`。运行前后服务和注册表里都没有 `SICE`、`SIWVID`、`NTICE` |
| Oreans 运行期活动 | 没有记录到服务创建 | 没有服务、没有驱动、没有新的 `oreans*` 文件 |
| WOW64 | 客户端是 PE32。那次运行没有模块清单 | 确认。32 位模块在 SysWOW64，64 位 `tasklist /m` 只看到 wow64 宿主 DLL |
| ws2_32 加载 | 那次没有模块枚举，不能记成已加载 | 没有加载 |
| 9555 尝试 | 采样窗口内没有到 9555 的新套接字 | 没有。网卡断开，而且 `ws2_32.dll` 没加载 |
| 9555 建立 | 没有 | 没有 |
| 频道 7575–7578 | 没有 | 没有 |
| 商城 8600 | 没有 | 没有 |
| 子进程 | 没有记录到 `HSUpdate.exe` | 没有 `HSUpdate.exe`，没有 `ASPLnchr.exe` |
| 最早的自然边界 | `HSUpdate.exe` 加载未签名 `AspINet.dll` 被策略拒绝。无调试器的游戏进程停在 `MapleStory` 对话框 | 更早，而且不是同一条策略。程序兼容性助手直接说这个程序与此版本的 Windows 不兼容 |

Win7 x64 没有比现代宿主走得更远。两边都没有连上 9555。Win7 这边甚至没有出现现代宿主那个 `MapleStory` 对话框，也没有走到 HackShield。这次没有启动 Win7 x86，所以还不能把「必须用 x86」写成已经证实的结论。
