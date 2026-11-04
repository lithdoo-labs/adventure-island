# 两个异常 RVA 的磁盘映射

客户端 SHA-256 仍然是 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`。ImageBase 是 `0x00400000`，所以下面的 VA 就是 `0x00400000 + RVA`。这次没有再附着调试器。

两个地址都落在第四个节，这个节没有名称：

| 项 | 值 |
| --- | --- |
| 节 RVA | `0x00819000` |
| VirtualSize | `0x000F9000` |
| SizeOfRawData | `0x1000` |
| 属性 | EXECUTE + READ + WRITE |
| 磁盘熵 | 0.0422 |

磁盘只给这个节的前 `0x1000` 字节提供了 raw data，对应 RVA `0x00819000`–`0x00819FFF`。后面约 1 MB 的虚拟范围在文件里没有字节。

| RVA | VA | 距节起点 | 超出 raw 末尾 | 距入口 `0x009D8000` | 文件偏移 | raw 字节 |
| --- | --- | --- | --- | --- | --- | --- |
| `0x00862E76` | `0x00C62E76` | `0x49E76` | `0x48E76` | `0x17518A` 之前 | 无 | 无 |
| `0x00862FB0` | `0x00C62FB0` | `0x49FB0` | `0x48E76 + 0x13A` | `0x175050` 之前 | 无 | 无 |

两条 RVA 相距 `0x13A`。它们不在入口节 `jtrppsow` 里。入口节从 `0x009D8000` 开始，只有 `0x1000` 字节。

结论：

```text
runtime-generated / unpacked / decrypted code required to explain this RVA
```

没有对零填充做反汇编，也没有做内存转储。加载器对这种虚拟尾部的初始内容是 0。`00` 是 `add [eax], al`，不会自己变成 `STATUS_ILLEGAL_INSTRUCTION`（`0xC000001D`）或 `STATUS_PRIVILEGED_INSTRUCTION`（`0xC0000096`）。Task 003 在这两个 RVA 上看到的就是这两种异常，因此运行到这里时，页面里已经不是磁盘上的空页。那些字节只存在于当时的进程内存里。

同一次运行里，操作者看到“检测到调试代码”的弹窗，随后进程以 `0xFFFF9108` 退出。当时模块列表停在 `WinTypes.dll`，`ws2_32.dll` 和 `HShield\ehsvc.dll` 都还没出现。异常点在主模块自己的 RWX 虚拟节里，时间上早于 WinSock，也早于 HackShield 组件被加载。这把退出放在主程序的 loader / protector 阶段，而不是登录服连接阶段。

入口节本身有磁盘字节。文件偏移 `3821568` 的开头是：

```text
83 ec 04 50 53 e8 01 00 00 00 cc 58 8b d8 40
2d 00 60 0c 00 2d 71 35 5f 00 05 66 35 5f 00
```

对应的指令是 `sub esp, 4` / `push eax` / `push ebx` / `call $+6` / 被跳过的 `int3` / `pop eax`。`call` 的落点是 `pop eax`，所以这个 `int3` 不在执行路径上。后面的立即数里有 `0xC6000`，和 `tpuaozxc` 节的 VirtualSize 相同。这是入口 stub，不是 MSVC 的 `push ebp; mov ebp, esp`。没有改这些字节。
