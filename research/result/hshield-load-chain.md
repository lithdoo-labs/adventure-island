# HSUpdate / AspINet 静态加载链

样本目录是客户端里的 `HShield\`。只读解析，没有执行替换，也没有再启动 `HSUpdate.exe`。

## 文件

| 文件 | 大小 | SHA-256 | PE | ImageBase | EntryPoint | Authenticode |
| --- | --- | --- | --- | --- | --- | --- |
| `HSUpdate.exe` | 154312 | `daf95bde2293271f59df320e5d934bd47e0e5b14da1d47536ef25596c9db1393` | PE32 / I386，Subsystem GUI | `0x00400000` | `0xB10F` | Valid，AhnLab |
| `AspINet.dll` | 745472 | `21f8027c6be26c3957640c4c8862cb7a23b0b904af8c42f2b70961f414a5d17e` | PE32 / I386，Subsystem GUI | `0x10000000` | `0x5AF67` | NotSigned |
| `AhnUpCtl.dll` | 153280 | `994cf5e8e2b810ef6456c68c5129137cc907cd8effe261818de0f31696a82a5e` | PE32 / I386 | `0x10000000` | `0x98A5` | AhnLab 版本资源 |
| `HSInst.dll` | 196704 | `97b17cc230d45521e61181744093fe685431e2db7af568adc78a16c6dda485bf` | PE32 / I386 | `0x10000000` | `0x5E30` | AhnLab PDB |
| `ehsvc.dll` | 524288 | `12bdbe8b2b64fbcb34913407722fc0e1d6bb1332e5b269355d77b63c42d7ff06` | PE32，ProductName `HSBypass` | `0x10000000` | `0xFD408` | NotSigned |
| `ehsvc.old` | 2341664 | `78d47f032d493ce5fb59eecaa31aa2be047386ee0416780df19fb62db4d35272` | PE32，AhnLab `EHSvc.pdb` | `0x10000000` | `0x494000` | Valid，AhnLab |

`HSUpdate.exe` 和 `AspINet.dll` 的 DllCharacteristics 都是 0：没有 DYNAMIC_BASE、NX、GUARD_CF。两者都没有 TLS，也没有 load config。`HSUpdate.exe` 没有重定位表。`AspINet.dll` 有重定位表。节名是普通的 `.text/.rdata/.data/.rsrc`，`AspINet.dll` 另有 `.reloc`。没有看到截断的可选头或非法节表。

`HSUpdate.exe` 版本资源：Company `AhnLab, Inc.`，FileDescription `HSUpdate`，FileVersion `2, 0, 0, 20`，ProductName `HackShield`。清单要求 Common-Controls 6.0。

`AspINet.dll` 版本资源：FileVersion `1.1.0.9`，ProductName 解码后是 `079过HS DLL 应用组件`。FileDescription / CompanyName 里有一串数字标识，这里写成 `<redacted>`。这不是 AhnLab 的版本资源。

## 谁引用谁

`HSUpdate.exe` 的静态导入是 `VERSION.dll`、`KERNEL32.dll`、`USER32.dll`、`GDI32.dll`、`ADVAPI32.dll`、`WINMM.dll`。KERNEL32 里有 `LoadLibraryA`、`GetProcAddress`、`CreateProcessA`、`FreeLibrary`。没有 `AspINet.dll` 这个导入项，文件里也没有 `AspINet` 这个 ASCII/UTF-16 字符串。延迟导入是空的。

`AspINet.dll` 自己导出 11 个函数，序号 1 到 11：

```text
AIN_Cancel, AIN_CloseObject, AIN_CloseSession,
AIN_DownloadFile, AIN_DownloadFiles, AIN_GetLastError,
AIN_GetUserParam, AIN_OpenObject, AIN_OpenSession,
AIN_OpenSessionIndirect, AIN_SetUserParam
```

`AIN_Cancel` 在文件里的指令是 `push esi / push edi / push ebx / call / pop / ret`。后面的导出也是同样长度的短函数，间距 `0x0C`。`.text` 有 `0x79000` 字节 raw data，不是空壳。

它的导入是 KERNEL32、USER32、GDI32、WINMM、WINSPOOL、ADVAPI32、SHELL32、ole32、OLEAUT32、COMCTL32、WS2_32、comdlg32。这些都是系统 DLL，没有指向同目录 AhnLab DLL 的静态导入。`COMCTL32` 有一个序号导入 `ord_17`。按当前系统的 API set 语义，这组导入不会在映射阶段就因为缺少 `api-ms-win-*` 而失败；Code Integrity 已经给这个映像算出了哈希和签名级别，说明加载器承认它是 PE。

字面量 `AspINet` 出现在 `AspINet.dll` 自己、`AhnUpGS.dll`，以及 `HShield\Update\patch\39\ahn.ui`。`HSUpdate.env` 是二进制内容，没有明文 DLL 名，没有对它做解密。

因此静态链是：

```text
HSUpdate.exe
  静态导入：系统 DLL，含 LoadLibraryA
  文件内没有 AspINet 字符串
运行时（Code Integrity 事件）：
  HSUpdate.exe 的进程尝试加载同目录 AspINet.dll
  状态 0xC0E90008，策略 VerifiedAndReputableDesktop
```

不能从静态导入表指出是哪一条 `call LoadLibraryA`。能确定的是调用发生在 `HSUpdate.exe` 进程里，而且被拒的原因是签名级别，不是缺少导出。`AspINet.dll` 提供了 `AIN_*` 导出；`HSUpdate.exe` 没有按名字静态引用它们。

## 和 AhnLab 原件的时代差

`HSUpdate.exe`、`AhnUpCtl.dll`、`HSInst.dll`、`ehsvc.old` 带 AhnLab 版本资源或 PDB，导入表是 2000 年代后期的普通 Win32 DLL。`AspINet.dll` 的节区和 `AIN_*` 导出看起来也是同一代 Win32 DLL，但它未签名，版本资源写成“079过HS DLL 应用组件”。`ehsvc.dll` 则是另一份 2013 年的 `HSBypass`，和这条 `HSUpdate -> AspINet` 事件不是同一个文件。

失败更像 Windows 策略拒绝一份未签名映像。PE 结构和系统依赖不足以解释 `0xC0E90008`。
