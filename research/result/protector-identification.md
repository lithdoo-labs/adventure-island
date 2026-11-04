# Protector 判断

判断只针对当前这份 `MapleStory.exe`（SHA-256 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`）。历史帖子里的 Themida 说法不直接套到这个文件上。没有用 Detect It Easy；本机没有该工具。证据来自节区、入口字节、导入表、字符串和 `ehsvc.old` 的对照。

| 名称 | 结论 | 证据 |
| --- | --- | --- |
| 主程序有独立 protector / loader | confirmed | 导入表只有 `GetLocalTime`。七个节里有多块 RWX。入口 `0x009D8000` 是 `call/pop` stub，熵 0.2842，不是 `push ebp; mov ebp, esp`。`0x00862E76` 没有磁盘字节，调试器却在那里收到非法指令和特权指令，然后弹出“检测到调试代码”并退出。当时 `ws2_32` 和 `ehsvc.dll` 都没加载 |
| 产品名 Themida / WinLicense | unsupported | 文件里没有 `Themida`、`WinLicense` 字符串，没有 `.themida` 节。入口熵 0.2842，不像一段高熵虚拟机入口。RaGEZONE 上有人把一份来源不明的 CMS079 叫做 unpacked Themida，那份文件没有下载，也不能代表当前哈希 |
| VMProtect | unsupported | 没有 `.vmp0` / `.vmp1`，没有 `VMProtect` 字符串 |
| UPX（主程序） | unsupported | 没有 `UPX0`、`UPX1`、`UPX!`。`SkinH_EL.dll` 和 `pg.dll` 有这些标记，主程序没有 |
| MPRESS（主程序） | unsupported | `MPRESS` 只出现在 `Dapan.exe` |
| 与 `ehsvc.old` 同一类壳 | probable | 两者都是：无名高熵 RWX 节、很小的 `.idata`、一块 raw 4 KB 的大 RWX 虚拟节、8 字母随机节名、入口节熵约 0.28（主程序 0.2842，`ehsvc.old` 的 `samyrnvf` 是 0.2853）、导入函数极少。这能说明是同一类保护布局，不能由此得到商业产品名 |
| `ehsvc.dll` 的 HSBypass 版本资源 | confirmed | ProductName `HSBypass`，FileDescription `Bypass for hackshield`，PDB 路径指向 `ehsvc_5_6_28`。这是目录里的另一份 DLL，不是主程序节区的名字 |
| `SkinH_EL.dll` UPX | confirmed | 节名 `UPX0`/`UPX1`，文件内有 `UPX!`，版本资源是 SkinSharp |
| `pg.dll` UPX | probable | 节名 `upx0`/`upx1`，`.text` raw size 为 0。没有 `UPX!` 字符串，所以不写成 confirmed |
| `Dapan.exe` MPRESS | probable | 47 MB 的 AMD64 文件里有 `MPRESS` 字节。没有版本资源和签名。它是 maoxiong-vpn 的 mihomo 进程，不是游戏 protector |

没有为了确认产品名去脱壳，也没有再附着调试器。
