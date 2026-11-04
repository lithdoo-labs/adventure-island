# 保护组件清单

主程序 SHA-256 与 Task 001 相同：`5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`。关键字同时搜了 ASCII 和 UTF-16。没有运行 `冒险岛HS修正工具.exe`，没有替换 `HShield` 里的文件。

`MapleStory.exe` 的导入表只有 `kernel32!GetLocalTime`。主程序里没有 `HShield`、`AhnLab`、`ehsvc`、`ASPLnchr`、`aossdk`、`Dapan`、`17890`、`127.0.0.1`、`Themida`、`VMProtect`、`UPX`。三个 `ZtlTaskMem*` 名字在文件偏移 3814305 附近。主程序不静态引用 HackShield，也不静态引用 Dapan。

## 主程序

| 项 | 值 |
| --- | --- |
| 大小 | 3889632 |
| SHA-256 | `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d` |
| 机器 | I386 |
| ImageBase / EntryPoint | `0x00400000` / `0x009D8000`，节 `jtrppsow` |
| SizeOfImage | `0x009DA000` |
| 时间戳 | 2010-01-31T05:41:52Z |
| PDB | 无 |
| Authenticode | Valid，CN=NEXON Corp. |
| 版本资源 | 空 |
| 导出 | `ZtlTaskMemAllocImp` `0x005FC19F`，`ZtlTaskMemFreeImp` `0x005FC1B0`，`ZtlTaskMemReallocImp` `0x005FC1C1` |

节区和入口 stub 见 `result/client-address-space-model.md`、`result/protection-rva-analysis.md`。导出 RVA 没有 raw data。

## 同目录里的其他 PE

| 文件 | 大小 | SHA-256 | 结构 |
| --- | --- | --- | --- |
| `pg.dll` | 155648 | `2774f773267a646cb236ab34a202e043261309e65b923a17beccf598fb1d4db8` | I386，ImageBase `0x10000000`，EP `0x2E1B8`。节名 `upx0`、`upx1`，`.text` raw size 为 0。导出 `Unbdcall`、`bdcall`。无版本资源 |
| `SkinH_EL.dll` | 88576 | `069030c59c3c0c36604f380ad563e284c356202f2adf044e4948937c51c8013b` | I386，ImageBase `0x10000000`，EP `0x3AF70`。ProductName `SkinSharp GUI Toolkit` 1.0.6.6。节名 `UPX0`、`UPX1`，文件内有 `UPX!`。导出 `SkinH_Attach` 等 GUI 函数 |
| `冒险岛HS修正工具.exe` | 652301 | `69ffefe5753f697b9e8dcdf3cb5a8f8bc36e790798dcd2e82aeeeb7849e76510` | I386，ImageBase `0x00400000`，EP `0x3861`。普通 `.text/.rdata/.data/.rsrc`，导入 KERNEL32 和 USER32。文件偏移 37123 附近有 `HShield`、`ehsvc`。时间戳 94109603，不像真实编译时间。未执行 |

这两份 UPX DLL 的节名和主程序不同。主程序不导入它们。

## AhnLab 组件

这些文件有常规 MSVC 节区。主程序 IAT 不指向它们。

| 文件 | 大小 | SHA-256 | 身份 |
| --- | --- | --- | --- |
| `ASPLnchr.exe` | 248568 | `ceb494e83c32a28958ee55e5a2334d5524184e920eb3333ea88798e1e99a54b7` | Authenticode Valid，AhnLab, Inc.。FileDescription `ASP launcher` 1.0.0.11。EP `0x1B2F6`。PDB `D:\Build\Product\ASP\...\ASPLnchr.pdb`。导入 KERNEL32、USER32、GDI32、ADVAPI32、SHELL32、MSVCRT、MSVCP60，共 127 个函数，名字里包括 `CreateProcess`、`LoadLibrary`、`GetProcAddress`、`OpenProcess`。没有把每条 call 展开成行为 |
| `aossdk.dll` | 254083 | `2a4aa5b75372c7f1aff830f5937b7953442dd3856e8d93e4349a3ef76d877d42` | CompanyName AhnLab，FileDescription `aossdk DLL` 1.0.0.14。EP `0x1F85F`。PDB `D:\Build\Product\ASP\...\aossdk.pdb`。导出 `Aossdk_Initialize`、`Aossdk_StartAosSDKA`、`Aossdk_TerminateSDKA` 等 19 个。导入含 `V3HUNT.dll`。文件内有 `ASPLnchr` |
| `bz32ex.dll` | 87536 | `67ff9952d102811c89c56198e55c31d9f79c591e316303c4241d34a0c604c7e0` | AhnLab `Bz32Ex` 1.0.0.10，Product `Smart Update i` 5.4.0.0。导出 `Bz32Ex_FileCompress`、`Bz32Ex_FileExtract`。只导入 MSVCRT |
| `HShield\Bz32Ex.dll` | 82060 | `1fdc007d96f90d675e67550569ad3c99f88ea13d7d603e36d99d43cb4de61e4f` | 同名产品 1.0.0.8，导出相同，哈希不同 |
| `HShield\AhnUpCtl.dll` | 153280 | `994cf5e8e2b810ef6456c68c5129137cc907cd8effe261818de0f31696a82a5e` | AhnLab `Smart Update Utility`。PDB `D:\Build\Common\AhnUpCtl\...\AhnUpCtl.pdb`。文件内有 `HackShield`。导出 `AhnUpCtl_GetInfo` 等 |
| `HShield\HSInst.dll` | 196704 | `97b17cc230d45521e61181744093fe685431e2db7af568adc78a16c6dda485bf` | PDB `T:\AhnLab\Product\HackShield\Messiah\Trunk\Src\Update\HSINST\Release\HSInst.pdb`。文件内有 `HackShield` 和 `AhnLab` |
| `HShield\HSUpdate.exe` | 154312 | `daf95bde2293271f59df320e5d934bd47e0e5b14da1d47536ef25596c9db1393` | PDB `T:\AhnLab\Product\HackShield\Messiah\Trunk\Src\Update\HSUpdate\Release\HSUpdate.pdb` |
| `HShield\ahnrpt.exe` | 718504 | `07255c782af277a6dc97c84f00ace80ab351e2592dc5dc2ee6d7b0c93efff5ca` | 文件内有 `AhnLab`。未执行 |
| `HShield\AspINet.dll` | 745472 | `21f8027c6be26c3957640c4c8862cb7a23b0b904af8c42f2b70961f414a5d17e` | EP `0x5AF67`。上述保护关键字没有命中 |

`aossdk.dll` 在自己的导入表里引用 `V3HUNT.dll`，`V3HUNT.dll` 位于 `HShield\`。这是 AhnLab SDK 自己的依赖，不是 `MapleStory.exe` 的 IAT 项。

## ehsvc.dll 和 ehsvc.old

| 项 | `HShield\ehsvc.dll` | `HShield\ehsvc.old` |
| --- | --- | --- |
| 大小 | 524288 | 2341664 |
| SHA-256 | `12bdbe8b2b64fbcb34913407722fc0e1d6bb1332e5b269355d77b63c42d7ff06` | `78d47f032d493ce5fb59eecaa31aa2be047386ee0416780df19fb62db4d35272` |
| Authenticode | NotSigned | Valid，AhnLab, Inc. |
| 版本资源 | Company `k8tems`，FileDescription `Bypass for hackshield`，ProductName `HSBypass`，FileVersion `5.6.28.404`，Copyright 2013 | 空 |
| PDB | `C:\Users\hiro\Documents\Visual Studio 2010\Projects\ehsvc_5_6_28\Release\ehsvc.pdb` | 调试目录没有 PDB 项；文件偏移 2334805 的 NB10 字符串是 `T:\AhnLab\Product\HackShield\Messiah\Trunk\Src\HShield\EHSvc\Release\EHSvc.pdb` |
| 时间戳 | 2013-11-09T13:12:05Z | 2009-10-22T10:22:56Z |
| ImageBase / EP | `0x10000000` / `0x00FD408` | `0x10000000` / `0x00494000` |
| 节区 | `.text` raw size 0；高熵节名 `9s8a7g90`、`9s8a7g91` | 和主程序同一类：无名高熵节、`.rsrc`、很小的 `.idata`、大块 RWX 虚拟节、随机节名 `alfadcme` 和入口节 `samyrnvf`。入口节熵 0.2853 |
| 导入 | KERNEL32 六个函数、`USER32!wsprintfW`、`MSVCR100!_lock`、`imagehlp!ImageEnumerateCertificates` | `kernel32!lstrcpy`、`comctl32!InitCommonControls` |
| 导出序号 | 10、26、27、28、29、30 | 1–26 |

两边都有序号 10 和 26。替换文件多了 27–30，少了 1–9 和 12–25。导出 RVA 也对不上：新文件的六个 RVA 在 `0x2A00` 一带，而它的 `.text` raw size 是 0；旧文件的导出 RVA 散落在 `0xEE80`–`0x14E30`。这不是同一份 ABI 的原样替换。

旧文件的节区布局和 `MapleStory.exe` 同类：入口熵约 0.28、导入表只有一两个函数、随机 8 字母节名、一块 raw 只有 4 KB 的大 RWX 节。新文件是另一套壳，版本资源写明 ProductName `HSBypass`。

## 关系

当前 V5 目录同时留着 AhnLab 的 `ASPLnchr.exe`、`aossdk.dll`、更新器和 `ehsvc.old`，又把现用的 `ehsvc.dll` 换成了带 `HSBypass` 版本资源的另一份 DLL。主程序自己的导入表、节名和入口 stub 都还在，而且和 `ehsvc.old` 的壳同类，和 `ehsvc.dll` 的壳不同。

所以不是“只换了一个 HackShield DLL、主程序就没有保护层”。主程序仍有独立的 loader / protector。调试器附着时的退出发生在 `HShield\ehsvc.dll` 加载之前，也说明那次退出不是这个 DLL 的运行结果。没有执行或替换这些文件。
