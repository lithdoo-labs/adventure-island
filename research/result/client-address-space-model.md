# 客户端地址空间模型

样本 SHA-256：`5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`。

ImageBase `0x00400000`，SizeOfImage `0x009DA000`，入口 RVA `0x009D8000`。静态导入只有 `kernel32!GetLocalTime`。三个导出的名字在文件里，函数体没有 raw data。

| 导出 | RVA | 与下一个导出的间距 |
| --- | --- | --- |
| `ZtlTaskMemAllocImp` | `0x005FC19F` | `0x11` |
| `ZtlTaskMemFreeImp` | `0x005FC1B0` | `0x11` |
| `ZtlTaskMemReallocImp` | `0x005FC1C1` | 到第一个节虚拟末尾还有大段空隙 |

`0x11` 字节放不下 Canvas / PCOM 那种 `push ebp; mov ebp, esp; sub esp, imm` 函数。这三个 RVA 最多是短槽位。槽位本身也没有磁盘字节，不能反汇编，也不能当成已经定位的游戏分配器。

同目录里的 Wizet DLL 用来对照“正常代码长什么样”。`Canvas.dll`、`PCOM.dll`、`ResMan.dll`、`Gr2D_DX8.dll` 的时间戳都在 2010-01-28，版权字符串是 Wizet / ZMS。它们有 `.text/.rdata/.data/.rsrc/.reloc`，`.text` 只执行可读，熵大约 5.8–6.7，导入表是 KERNEL32、GDI32、OLEAUT32、MSVCRT 这一类，并且能找到 `.?AV` RTTI。`Canvas.dll` 的 `.text` 开头是 `push ebp; mov ebp, esp`。`MapleStory.exe` 的磁盘节区对不上这套形态。

## 区域

| RVA start | RVA end | 节 | 分类 | confidence | 证据 |
| --- | --- | --- | --- | --- | --- |
| `0x00001000` | `0x002CE000` | 第一个无名节的 raw 部分 | packed data | high | VirtualSize `0x7E9000`，raw 只有 `0x2CD000`，熵 7.9814，RWX |
| `0x002CE000` | `0x007EA000` | 同一节的虚拟尾 | runtime-generated area；三个导出槽位在这里 | high（没有磁盘代码） | raw 在 `0x002CE000` 结束；导出 RVA 落在空洞里 |
| `0x007EA000` | `0x00818000` | `.rsrc` | resources | medium | 节名是 `.rsrc`，但熵 7.8079，raw `0xF000` 小于 VirtualSize `0x2DD20`，不像普通资源目录 |
| `0x00818000` | `0x00819000` | `.idata` | loader 用的导入目录 | high | 熵 0.1174，只挂着 `GetLocalTime` |
| `0x00819000` | `0x00912000` | 第四个无名节 | runtime-generated area | high | raw 只有 `0x1000`，熵 0.0422，虚拟约 1 MB，RWX；`0x00862E76` 和 `0x00862FB0` 在此且无文件字节 |
| `0x00912000` | `0x009D8000` | `tpuaozxc` | packed data | high | raw 和 VirtualSize 都是 `0xC6000`，熵 7.9045，RWX；入口 stub 的立即数里有同一个 `0xC6000` |
| `0x009D8000` | `0x009D9000` | `jtrppsow` | loader/protector | high | 入口节，熵 0.2842，`call/pop` stub，不是 MSVC 序言 |
| `0x009D9000` | `0x009DA000` | `uvrwsdpb` | loader/protector 旁边的小块 | medium | 4 KB，熵 2.155，RWX，紧挨入口 |

possible original game code 在磁盘上没有一块可直接命名的 `.text`。最宽的可填充虚拟区是 `0x002CE000`–`0x007EA000`（约 5.1 MB）。这只说明解开以后代码有地方可放，不说明这段现在就是游戏函数。`0x00819000` 那段更像 protector 的运行时页：调试器看到的非法指令和特权指令发生在这里，而且当时游戏网络 DLL 还没加载。

没有制作 unpacked executable。

## 下一阶段

选 **C. Static-loader-boundary-first**。

A 缺少可信 reference，不能做签名映射。B 不成立：MapleStory 会连 `127.0.0.1:17890`，但那是本机 VPN 的监听口，Dapan 没有连到 9555。剩下能继续做的是把 loader stub 和可能在运行时填上的虚拟区分开，仍然不隐藏调试器，也不改主程序。
