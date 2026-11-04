# 怀旧岛079V5客户端 — Baseline

## 1. Input

| 项 | 值 |
| --- | --- |
| 路径 | `.raw/怀旧岛079V5客户端.rar` |
| 大小 | 2,351,327,020 字节 |
| MD5 | `e46d79aaba86cfb9dfdf57d5e4deac41` |
| SHA-1 | `2e4e5fc71030730681de829b196b8bd0b4bbe3ab` |
| SHA-256 | `8439abc699fd3f20c9546a923a65593faf020a3a4b8be8b164dce37a38b6b247` |

哈希由 Python `hashlib` 对归档单次顺序读取计算（MD5、SHA-1、SHA-256 同步更新）。`.raw/` 只被读取，没有修改、覆盖、重命名或删除。

## 2. Environment

分析时间：2026-10-09（本地时区 UTC+8）。

| 项 | 值 |
| --- | --- |
| 操作系统 | Microsoft Windows NT 10.0.26200.0 |
| CPU | Intel64 Family 6 Model 151 Stepping 2, GenuineIntel |
| 进程架构 | AMD64 |
| Python | 3.14.4（MSC v.1944 64 bit） |
| 归档工具 | 7-Zip 26.00 (x64)，2026-02-12 |
| PE 解析 | pefile 2024.8.26 |
| Authenticode | PowerShell `Get-AuthenticodeSignature`（只读签名状态，不启动目标文件） |

本机原先没有 `pefile`。本次用 `python -m pip install pefile` 安装它，只用于静态解析。

未使用、本机也没有的工具：Detect It Easy / `diec`、`lief`、`rabin2`、`objdump`、`unrar`、`bsdtar`。系统自带 `tar.exe`，没有用来解 RAR。没有 DIE/PEiD 类识别结果。

没有启动任何解压出的 EXE、DLL、SYS、启动器、更新器或保护组件。

## 3. Archive Summary

7-Zip `l -slt` 与解压输出一致：

| 项 | 值 | 来源 |
| --- | --- | --- |
| 类型 | `Rar`（不是 `Rar5`） | 7-Zip archive header `Type = Rar` |
| 条目版本 | 29（7-Zip 对 RAR 2.9 / RAR4 的版本字段） | 每个文件记录 `Version = 29` |
| 压缩方法 | `m5:22` | 文件记录 `Method` |
| Host OS | Win32 | 文件记录 `Host OS` |
| Solid | 否 | `Solid = -` |
| 加密 | 否 | 全部文件 `Encrypted = -` |
| 多卷 | 否 | `Multivolume = -`，`Volumes = 1` |
| Blocks | 157 | archive header |
| 物理大小 | 2,351,327,020 | 与文件大小相同 |
| 文件数 | 142 | 解压摘要 `Files: 142`，并与磁盘遍历一致 |
| 目录数 | 15 | 解压摘要 `Folders: 15` |
| 未压缩总大小 | 3,488,154,527 | 解压摘要 `Size` |
| 解压结果 | `Everything is Ok`，退出码 0 | `.work/task-001/7z-extract.log` |

没有 CRC 错误，也没有观察到中文路径丢失。顶层只有一个目录：`冒险岛online/`。

## 4. File Layout

解压位置：`.work/task-001/extracted/`。完整清单和哈希在 `result/file-manifest.csv`。普通文件都有 SHA-256；EXE / DLL / SYS 另有 MD5 和 SHA-1。归档内没有 `.sys`。

扩展名统计（142 个文件）：

| 扩展名 | 数量 | 扩展名 | 数量 |
| --- | ---: | --- | ---: |
| `.dll` | 49 | `.dl-` | 19 |
| `.wz` | 17 | `.exe` | 10 |
| `.scd` | 6 | `.sc-` | 6 |
| `.dat` | 5 | `.flt` | 5 |
| `.log` | 4 | `.ini` | 3 |
| `.ex-` | 3 | `.asi` | 2 |
| `.ui` | 2 | `.in-` | 2 |
| `.mhe` `.old` `.env` `.jpg` `.lnk` `.da-` `.mh-` `.bat` `.txt` | 各 1 |  |  |

`.dl-`、`.ex-`、`.in-`、`.da-`、`.sc-`、`.mh-` 位于 `HShield/Update/`，文件头不是 `MZ`，本次没有按 PE 解析。它们是更新包里的截断扩展名，不是可加载的 EXE/DLL/SYS。

顶层布局：

```text
冒险岛online/
├── MapleStory.exe
├── Patcher.exe
├── Setup.exe
├── uninst.exe
├── ASPLnchr.exe
├── 冒险岛HS修正工具.exe
├── Base.wz … UI.wz、List.wz
├── Canvas.dll、Gr2D_DX8.dll、ResMan.dll、NameSpace.dll、Shape2D.dll、Sound_DX8.dll、PCOM.dll、ZLZ.dll、WzMss.dll 等
├── HShield/          # AhnLab HackShield 组件，以及一份版本资源不同的 ehsvc.dll
├── redist/           # Miles Sound System 的 .flt / .asi
├── 单机登陆器.bat
└── 登录器使用说明.txt
```

角色判断使用了版本资源、导入表、PDB 路径或文件头，不只凭文件名。见第 5 节和第 10 节。

## 5. Main Client Identification

主客户端是 `冒险岛online/MapleStory.exe`。

| 项 | 值 |
| --- | --- |
| 大小 | 3,889,632 |
| MD5 | `a4876687ffc82b1898bdb7e4f9f08f93` |
| SHA-1 | `5852b32a4f8c029e7f830a4a76f1b9d0e5e58412` |
| SHA-256 | `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d` |

判断依据：

1. 文件名是 `MapleStory.exe`，位于客户端根目录，旁边是一套标准 WZ 文件。
2. Authenticode 状态为 `Valid`。签名主体：`CN=NEXON Corp., OU=Development Department, O=NEXON Corp., L=Gangnam-gu, S=Seoul, C=KR`。工具是 `Get-AuthenticodeSignature`。
3. 导出符号为 Wizet/Ztl 分配器：`ZtlTaskMemAllocImp`、`ZtlTaskMemFreeImp`、`ZtlTaskMemReallocImp`。
4. 资源/清单字符串包含 `MapleStory Program`、`Wizet MapleStory`、`MapleStory.exe`。
5. 同目录的 `uninst.exe` 版本资源（按 UTF-8 重新解释 pefile 的字节）为：CompanyName `盛大网络发展有限公司`，ProductName `《冒险岛online》`，FileVersion `1.0.0.0079`。清单字符串含 `Nullsoft Install System v2.27`，与其大 overlay 一致，它是卸载器，不是主程序。

同目录其他 EXE 有独立角色：`Patcher.exe`（补丁器，导入 WININET）、`Setup.exe`（安装器）、`ASPLnchr.exe`（AhnLab，ProductName `ASPLnchr`，签名 Valid）、`冒险岛HS修正工具.exe`（独立小工具，见第 10 节）。这些都不是主客户端。

## 6. PE Summary

机器可读的全部 PE 摘要在 `result/pe-summary.json`（68 个成功解析的 PE32 镜像，工具 `pefile 2024.8.26`）。68 个里包含扩展名不是 exe/dll/sys、但文件头为 `MZ` 的文件：`iloveaki.dat`、`HShield/ehsvc.old`、`redist` 下 5 个 `.flt` 和 2 个 `.asi`。没有解析失败的 PE。全部样本都是 `PE32` / `IMAGE_FILE_MACHINE_I386`，没有 PE32+。

### MapleStory.exe

| 字段 | 值 |
| --- | --- |
| PE | PE32 |
| Machine | `IMAGE_FILE_MACHINE_I386`（`0x014C`） |
| TimeDateStamp | `2010-01-31 05:41:52 UTC`（字段可能被链接器或壳改写，不能单独当作构建时间） |
| ImageBase | `0x00400000` |
| AddressOfEntryPoint | `0x009D8000` |
| EntryPoint 所在节 | `jtrppsow` |
| SizeOfImage | 10,330,112（`0x009DA000`） |
| SizeOfHeaders | 4,096 |
| Subsystem | `IMAGE_SUBSYSTEM_WINDOWS_GUI`（2） |
| DLL Characteristics | `0x0000`（没有 DYNAMIC_BASE、NX_COMPAT、GUARD_CF） |
| CheckSum 字段 | `0x003B6D74`（只记录字段，没有单独重算 PE checksum） |
| 导入 | 1 个 DLL、1 个符号：`kernel32.dll!GetLocalTime` |
| 导出 | 3 个，见下表 |
| Debug / PDB | 无 |
| TLS callback | 无 |
| Version Info | pefile 没有解析出 StringFileInfo；清单字符串仍能看到 MapleStory / Wizet |
| Overlay | 59,872 字节，文件偏移 `3,829,760` |
| Security directory | 存在，偏移 `3,884,024`，大小 5,608 |
| Authenticode | `Valid`，NEXON Corp.（见第 5 节） |

Security directory 落在 overlay 内，并且 `3884024 + 5608 = 3889632`，与文件末尾对齐。证书之前还有 54,264 字节 overlay，本任务没有解释这段内容。

节区：

| Name | VA | VirtualSize | RawSize | Characteristics | Entropy |
| --- | --- | ---: | ---: | --- | ---: |
| `   `（3 个空格） | `0x00001000` | 8,294,400 | 2,936,832 | `0xE0000040` CNT_INITIALIZED_DATA, EXECUTE, READ, WRITE | 7.9814 |
| `.rsrc` | `0x007EA000` | 187,680 | 61,440 | `0xC0000040` CNT_INITIALIZED_DATA, READ, WRITE | 7.8079 |
| `.idata  `（尾随空格） | `0x00818000` | 4,096 | 4,096 | `0xC0000040` CNT_INITIALIZED_DATA, READ, WRITE | 0.1174 |
| `        `（8 个空格） | `0x00819000` | 1,019,904 | 4,096 | `0xE0000040` EXECUTE, READ, WRITE, CNT_INITIALIZED_DATA | 0.0422 |
| `tpuaozxc` | `0x00912000` | 811,008 | 811,008 | `0xE0000040` | 7.9045 |
| `jtrppsow` | `0x009D8000` | 4,096 | 4,096 | `0xE0000040` | 0.2842 |
| `uvrwsdpb` | `0x009D9000` | 4,096 | 4,096 | `0xE0000040` | 2.1550 |

导出：

| Ordinal | Name | RVA |
| ---: | --- | --- |
| 1 | `ZtlTaskMemAllocImp` | `0x005FC19F` |
| 2 | `ZtlTaskMemFreeImp` | `0x005FC1B0` |
| 3 | `ZtlTaskMemReallocImp` | `0x005FC1C1` |

这三个 RVA 落在第一节虚拟范围内（`0x1000`–`0x7EA000`）。

### 其他需要对照的 PE

游戏模块 `Canvas.dll`、`Gr2D_DX8.dll`、`NameSpace.dll`、`Shape2D.dll`、`Sound_DX8.dll`、`PCOM.dll`、`ResMan.dll` 的 TimeDateStamp 集中在 `2010-01-28`，节名是普通的 `.text/.rdata/.data/.rsrc/.reloc`，入口在 `.text`，熵大约 5.8–6.7。它们导出 `DllCanUnloadNow` 和 `DllGetClassObject`。`PCOM.dll` 另外导出 `PcCreateObject`、`PcInitModule`、`PcSerializeObject`、`PcSerializeString`、`PcRootNameSpace`、`PcTermModule`、`PcFreeUnusedLibraries`。这些模块没有主程序那种随机节名。

`ZLZ.dll` 导出 `ZLZCreateInflator`、`ZLZCreateDeflator`、`ZLZCloseFilter`。PDB：`D:\ACGAME_CN\ztl\ZLZ\Release\ZLZ.pdb`。

`WzMss.dll` 导出一组 `WzSoap_*`，并静态导入 `WS2_32.dll`。PDB：`d:\ACGame\WzLib\Soap\Release\Soap.pdb`。

`mss32.dll` 版本资源：ProductName `Miles Sound System`，CompanyName `RAD Game Tools, Inc.`，FileVersion `7.2b`。`redist\` 下的 `.flt` / `.asi` 导入 `mss32.dll`，PDB 在 `C:\devel\projects\mss\build\win\`。

`Patcher.exe`：PE32，ImageBase `0x00400000`，入口 `0x00013FD9` 位于 `.text`，SizeOfImage 1,581,056，355 个导入符号，无 overlay、无 security directory、`Get-AuthenticodeSignature` 为 `NotSigned`。SHA-256：`58e7d075cf2d7737d831d6670cc020b5c489fe643b7460be9a5ca6f2fbdd7fa3`。

`iloveaki.dat` 是 PE32，不是纯数据文件。版本资源 OriginalFilename 为 `ijl15.dll`，CompanyName `Intel Corporation`，ProductName `Intel JPEG Library`，TimeDateStamp `2001-05-30 21:37:47 UTC`。旁边另有一个 8,192 字节的 `ijl15.dll`（TimeDateStamp `2012-02-17`，PDB `C:\Users\UFO\Documents\Visual Studio 2008\Projects\IJL15\Release\IJL15.pdb`）。二者不是同一个文件。

## 7. Imports of Interest

主客户端导入表的完整列表在 `result/main-client-imports.txt`。整个导入表只有：

```text
kernel32.dll
  GetLocalTime
```

因此任务书列出的网络、文件、进程、调试/时间、注册表 API 在 `MapleStory.exe` 的导入表里全部是 ABSENT。这只说明静态导入表里没有它们。导入表已经被收成一个符号，不能据此认为客户端没有网络或文件能力。

相关模块里能直接看到的网络导入：

| 文件 | DLL | 证据 |
| --- | --- | --- |
| `WzMss.dll` | `WS2_32.dll` | `WSAStartup`、`WSASocketA`、`WSAConnect`、`WSASend`、`WSARecv`、`WSAEventSelect`、`closesocket`、`gethostbyname`、`inet_addr` 等 |
| `Patcher.exe` | `WININET.dll` | `InternetOpenA`、`InternetOpenUrlA`、`InternetReadFile`、`InternetWriteFile`、`InternetCloseHandle`、`HttpQueryInfoA` 等 |
| `PCOM.dll` | 导入表为 `KERNEL32.dll`、`OLEAUT32.dll`、`MSVCRT.dll` | 字符串里有 `PWS2_32.DLL`，该名字不在静态导入表中 |

`WzMss.dll` 的导出是 `WzSoap_*`，它更像 SOAP/HTTP 辅助模块。游戏自己的 socket 循环没有出现在 `MapleStory.exe` 的导入表里。

## 8. Strings / Network Indicators

筛选结果在 `result/interesting-strings.txt`。只保留了匹配 URL、域名、IP 形态、`.wz` / `.dll` / `.sys` / `.pdb`、注册表、保护产品和少量关键字的字符串。没有把完整字符串表提交进 `result/`。没有连接、扫描或请求任何地址。

主客户端明文里能确认的内容很少：

- URL 只有 Thawte / Verisign 的 CRL 和 OCSP 地址，来自签名证书块，不是游戏服务器。
- DLL 名只有 `kernel32.dll`。
- 没有 `Character.wz`、`Base.wz`、`.wz`、`WSAStartup`、`socket`、`GetProcAddress`、`HackShield`、`Themida`、`WinLicense`、`VMProtect`、`UPX`、`Oreans`、`ASPack` 的 ASCII 命中（对整个文件做了字节计数）。
- 长度不少于 8 的可打印 ASCII 串约 1,143 条，其中游戏相关明文主要是清单里的 `MapleStory` / `Wizet MapleStory`。

有价值的其他字符串：

| 来源 | 字符串 | 说明 |
| --- | --- | --- |
| `Patcher.exe` | `http://mxd.sdo.com/homepage.htm` | 盛大补丁/主页 URL |
| `Patcher.exe` | `http://mxd.autopatch.sdo.com/mxd/patch/notice/` | 同上 |
| `Patcher.exe` | `http://mxd.autopatch.sdo.com/mxd/patch/patchdir/` | 同上 |
| `Patcher.exe` | `http://act.mxd.sdo.com/project/up/index.html` | 同上 |
| `单机登陆器.bat` | `MapleStory.exe 127.0.0.1 9555` | 本地启动参数，29 字节文本文件 |
| `downloadinfo.dat` | HTML `404 Not Found` / `Unable to connect to host` | 106 字节，不是服务器列表 |
| `Canvas.dll`、`PCOM.dll` | `List.wz` | 资源名字符串 |
| `Setup.exe` | `SOFTWARE\Wizet\MapleStory` | 注册表路径字符串 |
| `HShield/ehsvc.ini` | `GamePath=D:\079V2\冒险岛online\MapleStory.exe` | HackShield 配置里的旧路径 |
| `HShield/bldinfo.ini` | `BuildNumber=4.3.30.0` | HackShield 构建号 |

`interesting-strings.txt` 里大量 `x.y.z.w` 来自版本号和程序集清单，不能当成 IPv4 端点。明文里的主机和端口只有 bat 文件中的 `127.0.0.1` 和 `9555`。

## 9. WZ Inventory

17 个 `.wz` 都在 `冒险岛online/` 根下，没有重复文件名。除 `List.wz` 外，文件头 4 字节都是 `50 4B 47 31`（`PKG1`）。本任务没有解析 WZ 目录树。

| 文件 | 大小 | SHA-256 | 文件头 |
| --- | ---: | --- | --- |
| `Base.wz` | 8,885 | `8040f3ab36d2fb02b31ae04d794f36699c0f6c58e5cd7b87cd81d361da0aad7d` | PKG1 |
| `Character.wz` | 1,238,707,905 | `d55303588b10a8a5b76f1bd065c238447c708af21c5f55cd319a3ae9db646074` | PKG1 |
| `Effect.wz` | 142,666,079 | `46702f06c45a3198c36d810aabc4241ad267ee30346f541b76d802b64078ad82` | PKG1 |
| `Etc.wz` | 19,435,393 | `5177d6ac654aeac1e3db83a1f98445df26c80472bc75fb43e3ea41337e25bc6f` | PKG1 |
| `Item.wz` | 139,053,911 | `0c58678973dbcdd12e5d936e03a060ee606f80416722dbb530797a8584a182d3` | PKG1 |
| `Map.wz` | 835,954,262 | `9e0d2a0fcecac2c99ee3cb15b03c41b5617d7d0637b55fb132f0eeed27155f69` | PKG1 |
| `Mob.wz` | 421,628,507 | `6d5503fb78ec5a94f9f714d8712ab36b47257ac0b9ad8640e016e10fe67826ec` | PKG1 |
| `Morph.wz` | 35,707,082 | `e9461b90aae1a46e1f41b527a1232974408b8bbb802a5df36868df10f24efe90` | PKG1 |
| `Npc.wz` | 53,772,873 | `19562193d7cb93213110f4a54cc62568ec536251e8b7d546bd3915b3a009df65` | PKG1 |
| `Quest.wz` | 3,726,297 | `48716b137d84b7e80dc4e6a4ef7e1cf4f908e90370d48ad4cb9aad9052fbeffe` | PKG1 |
| `Reactor.wz` | 85,233,536 | `68786bf5d7530eca7519d7bdebd0c3dbd6a13a0193c2e984c2e82d12d4a17e20` | PKG1 |
| `Skill.wz` | 74,821,220 | `c23c1409ec801c89b5bbc13308014c202efbfb3002efb4da7f33359f0430323f` | PKG1 |
| `Sound.wz` | 366,212,494 | `d1a9fd213173d531d9710d6f568eb5e4d1a7fa390ed50fa7fcbb35b98f981505` | PKG1 |
| `String.wz` | 9,608,592 | `76aa28a540296c91633f097c9429caa2f16e0f7d0a8d9d0f449192ec51abc510` | PKG1 |
| `TamingMob.wz` | 1,876 | `64756585542455417e2de696395700e430a2510bd45cc1a4c22677cb273953a4` | PKG1 |
| `UI.wz` | 33,744,089 | `f5d804c30a707c968d1d7d1f522935cd7c3fd455e3d02891e996abc7c033848d` | PKG1 |
| `List.wz` | 65,470 | `1a9bed23d87213545e2ce40765ca45e1b5464659c21bb7276d924edc2eb0cc9e` | 不是 PKG1 |

任务书中的标准集合都在：Base、Character、Effect、Etc、Item、Map、Mob、Morph、Npc、Quest、Reactor、Skill、Sound、String、TamingMob、UI。

异常项：

- `List.wz` 多出来。文件头前 4 字节是 `05 00 00 00`，不是 `PKG1`。`Canvas.dll` 和 `PCOM.dll` 的字符串里有这个文件名。格式本次没有继续解析。
- `TamingMob.wz` 只有 1,876 字节，但是 `PKG1`。
- RAR 内的修改时间不一致。`Base.wz`、`Mob.wz`、`Skill.wz`、`Sound.wz`、`Quest.wz`、`Etc.wz` 在 2010-01；`Character.wz`、`Map.wz`、`Item.wz`、`Effect.wz`、`Morph.wz`、`TamingMob.wz` 在 2016-05；`Npc.wz`、`String.wz` 在 2017-07-02；`UI.wz` 在 2017-07-25。这些是归档元数据里的 `Modified`，不是 PE TimeDateStamp。

## 10. Protection / Packing Indicators

结论：**疑似存在 packing/protector**。主客户端没有 UPX / Themida / VMProtect / ASPack 等产品字符串，本机也没有 DIE，所以不能把壳的产品名定下来。本任务没有脱壳、绕过、禁用或 patch。

`MapleStory.exe` 的静态证据：

1. 节名不是常规 `.text`。出现 3 空格、8 空格、带尾随空格的 `.idata`，以及 `tpuaozxc`、`jtrppsow`、`uvrwsdpb`。
2. 入口在 `jtrppsow`。该节只有 4,096 字节，熵 0.2842，特征是可执行的 initialized data，不是 `CNT_CODE`。
3. 第一节熵 7.9814，RawSize 2,936,832，VirtualSize 8,294,400，特征含 EXECUTE + WRITE。`tpuaozxc` 熵 7.9045，`.rsrc` 熵 7.8079。
4. SizeOfImage 10,330,112，文件只有 3,889,632。
5. 导入表只剩 `kernel32.dll!GetLocalTime`。
6. 全文件没有 `.wz` 和 WinSock API 的明文字符串。
7. 当前文件的 Nexon Authenticode 状态是 `Valid`。签名覆盖的是现在这份字节；本次没有做额外的在线吊销复查。

`HShield/ehsvc.old` 呈现同一类节区形态：空格节名、尾随空格的 `.idata`、两个随机 8 字母节名、高熵节约 7.9、入口节熵约 0.28、导入只有 `kernel32.dll` 和 `comctl32.dll`。它的 PDB 路径是：

```text
T:\AhnLab\Product\HackShield\Messiah\Trunk\Src\HShield\EHSvc\Release\EHSvc.pdb
```

这把它和 AhnLab HackShield 的 EHSvc 构建路径连在一起。SHA-256：`78d47f032d493ce5fb59eecaa31aa2be047386ee0416780df19fb62db4d35272`。

当前的 `HShield/ehsvc.dll` 不是这个形态。静态事实如下，行为没有分析：

| 项 | 值 |
| --- | --- |
| SHA-256 | `12bdbe8b2b64fbcb34913407722fc0e1d6bb1332e5b269355d77b63c42d7ff06` |
| Authenticode | `NotSigned` |
| 入口 | `0x000FD408`，节 `9s8a7g91`，该节熵 7.9783 |
| 多个节 | RawSize 为 0，熵 0 |
| 版本资源 | CompanyName `k8tems`，ProductName `HSBypass`，FileDescription `Bypass for hackshield`，FileVersion `5.6.28.404` |
| PDB | `C:\Users\hiro\Documents\Visual Studio 2010\Projects\ehsvc_5_6_28\Release\ehsvc.pdb` |

同目录其他文件的版本资源和 PDB 指向 AhnLab HackShield / V3，例如 `AhnUpGS.dll` ProductName `HackShield`，`bldinfo.ini` 的 `BuildNumber=4.3.30.0`，`v3hunt.dll` ProductName `Smart Update Utility`、CompanyName `AhnLab, Inc.`。`ASPLnchr.exe` 的 AhnLab 签名为 Valid。

归档中没有 `.sys`。这只说明压缩包里没有驱动文件。

另外两处壳特征属于第三方 DLL，和主客户端不是同一套节名：

- `pg.dll`：节名 `upx0` / `upx1`，入口在 `upx1`，该节熵 7.8708，其余节 RawSize 为 0。SHA-256 `2774f773267a646cb236ab34a202e043261309e65b923a17beccf598fb1d4db8`。签名 NotSigned。
- `SkinH_EL.dll`：节名 `UPX0` / `UPX1`，入口在 `UPX1`，熵 7.9894。版本资源 ProductName `SkinSharp GUI Toolkit`，CompanyName `SkinSharp Inc.`，FileVersion `1, 0, 6, 6`。

`冒险岛HS修正工具.exe` 是 PE32 GUI，ImageBase `0x00400000`，SizeOfImage 45,056，文件大小 652,301，overlay 607,245。TimeDateStamp 为 `1972-12-25 05:33:23 UTC`，这个数值不像真实编译时间。导入来自 `KERNEL32.dll` 和 `USER32.dll`。它没有被执行，内部行为没有分析。旁边的 `登录器使用说明.txt` 提到了这个文件名；该文本只作为样本内容记录。

反调试 API（`IsDebuggerPresent`、`CheckRemoteDebuggerPresent` 等）不在主客户端导入表中。在只剩一个导入的前提下，这个 ABSENT 没有诊断价值。

## 11. Notable Findings

1. 主客户端是 `冒险岛online/MapleStory.exe`，SHA-256 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`。PE32 x86，ImageBase `0x00400000`，Nexon Authenticode 为 Valid。导出 `ZtlTaskMemAllocImp` / `Free` / `Realloc`，清单字符串含 `Wizet MapleStory`。
2. 主客户端疑似加壳：随机/空格节名、入口节熵 0.2842、第一节熵 7.9814 且虚拟大小远大于原始大小、导入表只剩 `GetLocalTime`、没有明文 `.wz` 字符串。壳产品名未能识别。
3. `HShield/ehsvc.old` 与主客户端节区形态同类，PDB 指向 AhnLab `EHSvc`。当前 `ehsvc.dll` 未签名，版本资源 ProductName 为 `HSBypass`。这里只记录版本资源和 PE 字段。
4. `pg.dll` 与 `SkinH_EL.dll` 的节名是 UPX 形态。`SkinH_EL.dll` 的版本资源同时标明 SkinSharp。
5. 游戏 DLL（ResMan、Canvas、Gr2D_DX8、PCOM 等）是 2010-01-28 的普通 PE，入口在 `.text`。`PCOM.dll` 有 `PcSerializeObject` 一类导出；`ZLZ.dll` 有 inflate/deflate 导出。
6. `WzMss.dll` 静态导入 WinSock，但导出是 `WzSoap_*`。`Patcher.exe` 导入 WinINet，并含 `mxd.sdo.com` / `mxd.autopatch.sdo.com` URL。
7. 16 个 WZ 以 `PKG1` 开头。`List.wz` 不是 `PKG1`。多个大型 WZ 的归档修改时间在 2016–2017，而主程序 TimeDateStamp 是 2010-01-31。
8. `单机登陆器.bat` 的全部内容是 `MapleStory.exe 127.0.0.1 9555`。`downloadinfo.dat` 是一段 404 HTML。
9. 归档内没有 `.sys`。`iloveaki.dat` 实际是一份 Intel JPEG Library PE，OriginalFilename 为 `ijl15.dll`。
10. 卸载器版本字符串是 `1.0.0.0079`，公司名是盛大网络。HackShield 配置里的 GamePath 却写成 `D:\079V2\...`。

## 12. Uncertainties

- 主客户端壳的产品名称没有产品字符串，也没有 DIE 扫描，只能停在“疑似 packing/protector”。
- `TimeDateStamp` 可以伪造。主程序 2010-01-31 与游戏 DLL 的 2010-01-28 接近，但不能当成发行日期。WZ 的 2016–2017 时间来自 RAR 的 Modified 字段。
- Authenticode `Valid` 来自 `Get-AuthenticodeSignature`。没有另外做 CRL 在线复查。
- 导入表缺失不等于运行时没有对应 API。
- `List.wz` 的 `05 00 00 00` 头未被识别成某种已知 WZ/PKG 变体。
- 压缩包里没有 `.sys`，不能说明 HackShield 相关组件在运行时不会释放驱动。本任务没有执行它们。
- 归档名叫 079V5，卸载器 FileVersion 是 `1.0.0.0079`，`ehsvc.ini` 的 GamePath 含 `079V2`。三处版本标记并不相同。
- `interesting-strings.txt` 的 IPv4 正则命中了大量版本号。除 bat 文件外，没有把这些数字当成服务器地址。

## 13. Recommended Next Steps

1. 先把未加壳的游戏 DLL 放进 Ghidra：`ResMan.dll`、`PCOM.dll`、`Canvas.dll`、`Gr2D_DX8.dll`、`NameSpace.dll`、`Shape2D.dll`、`Sound_DX8.dll`。`ResMan.dll` 和 `Canvas.dll` / `PCOM.dll` 适合作为资源加载入口；后两者的字符串里有 `List.wz`。
2. 在 `PCOM.dll` 里查看字符串 `PWS2_32.DLL` 的交叉引用。它不在静态导入表中，先确认这是延迟加载名称还是残留字符串。
3. 把 `WzMss.dll` 的 `WS2_32` 导入和 `WzSoap_*` 导出当作 SOAP/HTTP 模块来标，不要直接当成游戏封包循环。
4. `Patcher.exe` 未加壳，且有 WinINet 和 `mxd.sdo.com` URL。补丁协议可以单独做，和游戏 socket 分开。
5. 对 16 个 `PKG1` WZ 做目录级解析即可。`List.wz` 和只有 1,876 字节的 `TamingMob.wz` 分开记录。
6. `MapleStory.exe` 在壳被单独鉴定之前，不要把 `jtrppsow` 的入口当成游戏逻辑入口。本任务不脱壳。后续若要命名壳，只用签名/节区特征，不要改文件。
7. 协议分析不要执行 `HShield\`、`ehsvc.dll`、`冒险岛HS修正工具.exe` 或 `单机登陆器.bat`。这些文件里的保护/版本资源差异留在基线里，不在本阶段展开行为。

## 14. Reproduction Commands

工作目录是仓库根目录。`.raw/` 只读。中间文件在 `.work/task-001/`。

```text
python -X utf8 -c "<hashlib streaming md5/sha1/sha256 of .raw/*.rar>"
7z l -slt -sccUTF-8 ".raw/怀旧岛079V5客户端.rar"
7z x -y -sccUTF-8 -bb1 -o.work/task-001/extracted ".raw/怀旧岛079V5客户端.rar"
python -m pip install pefile==2024.8.26
python -X utf8 .work/task-001/analyze.py
```

`analyze.py` 只读解压目录：用 `hashlib` 计算清单哈希，用 `pefile` 读取 PE 字段、节区熵、导入、导出、调试目录、TLS 和 security directory，并用正则筛选字符串。它没有启动任何客户端二进制。

Authenticode 只对关键文件调用了：

```text
Get-AuthenticodeSignature -FilePath .work/task-001/extracted/冒险岛online/MapleStory.exe
Get-AuthenticodeSignature -FilePath .work/task-001/extracted/冒险岛online/Patcher.exe
Get-AuthenticodeSignature -FilePath .work/task-001/extracted/冒险岛online/HShield/ehsvc.dll
Get-AuthenticodeSignature -FilePath .work/task-001/extracted/冒险岛online/ASPLnchr.exe
Get-AuthenticodeSignature -FilePath .work/task-001/extracted/冒险岛online/pg.dll
```

7-Zip 解压退出码为 0，日志在 `.work/task-001/7z-extract.log`。归档哈希的原始 JSON 在 `.work/task-001/rar-hashes.json`。这两个路径被 `.gitignore` 忽略，不进入 Git。
