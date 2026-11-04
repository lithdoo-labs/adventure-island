# CMS079 reference 索引

没有拿到可以做结构差分的客户端。下面每一条都没有下载二进制。绕过启动器、注入 DLL 和来源不明的脱壳包不拿来冒充 reference。

| 名称 | 声称版本 | URL | 日期 | 文件 | 哈希 / PE | confidence | 为什么不用 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CMSLauncher | 国服 v79–v104，另一分支写到 v125 | https://github.com/TheWoif777/CMSLauncher 和 https://github.com/zhyonc/CMSLauncher/ | 仓库仍在更新 | 源码里的 Launcher / Hook，不是 MapleStory.exe | 无客户端哈希 | low | 说明文字写的是去掉 HackShield、CRC 和改连接地址。这是注入器，不是可对照的原始客户端 |
| CMS079-ijl15 | 仓库名写 CMS079 | https://github.com/yainse/CMS079-ijl15 和 https://github.com/RestartMs/CMS079-ijl15 | 未核发布日期 | 替换用的 `ijl15.dll` | 无 | low | 它替换或转发 `ijl15.dll`，不提供主程序映像 |
| MaplestoryCms079 等 Java 仓库 | 国服 079 服务端 | https://github.com/alannotnerd/MaplestoryCms079 以及 HuiMS079、MapleStory079_Wubin、ZeroMS079 | 2019–2022 | Java 源码 | 无客户端 | low | 服务端源码不能映射客户端 RVA |
| RaGEZONE “unpacked themida” | 帖子称 CMS 79 unpacked | https://forum.ragezone.com/threads/who-has-a-localhost-client-of-cms-079.1208808/ | 2022-10-25 | 帖子给出一个 mediafire RAR 名 | 无；未下载 | unsupported | 作者同时在找去掉 HackShield 的包。链接没有大小、哈希和 PE，不能认定是当前 V5 |
| 枫叶物语 IDB 帖 | 标题写 CMS079，IDA 7.0，内含 `MapleStory_79_dump.exe` | https://www.fengyewuyu.com/thread-1719-1-1.html | 2019-03-18 | 百度盘，提取码要回复才可见 | 无 | unsupported | 楼主写明 exe 来自网上、历史不可考。没有哈希，不能和 `5d280cf1...` 比较 |
| MemorySDK / maple-clienthook | MapleStory hook；后者标题写 GMS083 改 CMS079 | https://github.com/zhyonc/MemorySDK 和 https://gitee.com/wangdiCoding/maple-clienthook | 2025 / 页面未给可靠日期 | hook 库 | 无主程序 | unsupported | 内存 hook，不是 reference image |
| 当前 V5 客户端 | 本仓库 Task 001 | 本地 `.raw`，不提交 | — | `MapleStory.exe` | `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`，I386，ImageBase `0x00400000`，EP `0x009D8000` | confirmed 为当前样本 | 它是被分析的文件，不是外部 reference |

也搜了 `ZtlTaskMemAllocImp`、`CMS079 IDB`、`MapleStory v79 IDB`、`MapleStory 079 symbols`。没有公开结果把这个导出和一份可校验的客户端哈希绑在一起。

`.work/task-004/reference/` 是空的。没有第三方二进制进入 Git。
