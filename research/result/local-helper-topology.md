# 本地 17890 拓扑

`MapleStory.exe -> Dapan.exe:17890 -> 127.0.0.1:9555` 不成立。

前半段在这次无调试器采样里再次出现：MapleStory 是连接方，Dapan 是监听方。后半段没有出现。Dapan 不是游戏目录里的组件，也不是 MapleStory 拉起来的子进程。

## Dapan.exe

| 项 | 值 |
| --- | --- |
| 路径 | `C:\Users\lithd\AppData\Roaming\maoxiong-vpn\core\Dapan.exe` |
| 大小 | 47169024 |
| SHA-256 | `77f8dee03001916c2b7c28c3094690bc5f78f0e8c2187f1488073214417dc44d` |
| PE | AMD64，ImageBase `0x140000000`，EntryPoint RVA `0x8FAE0` |
| 版本资源 | 空 |
| Authenticode | NotSigned |
| 静态标记 | 文件里有 `MPRESS` |
| 命令行 | `Dapan.exe -d C:\Users\lithd\AppData\Roaming\maoxiong-vpn\mihomo` |

进程树：

```text
PID 21792（采样时进程已不在，映像名没有解析到）
  -> flwebsite.exe  PID 15876
       C:\Program Files\maoxiong-vpn\flwebsite.exe
       -> Dapan.exe  PID 17716
```

Dapan 在 MapleStory 启动之前就已经在监听。它不是这次游戏进程的子进程。没有附加调试器，没有注入，没有改它的文件，也没有读 mihomo 配置。

监听：

- `127.0.0.1:17890`
- `127.0.0.1:19090`，对端是 `flwebsite.exe`

同一时刻连到 `17890` 的还有 Cursor、OneDrive、GitHub Desktop 和 msedge。所以这个端口是本机 VPN / mihomo 的本地口，不是 MapleStory 私有协议口。

Dapan 另有到非本机地址的已建立连接。具体地址不写入结果。这些流的端口不是 9555、7575、7576、7577、7578 或 8600。

## MapleStory 这一次

无调试器启动 `MapleStory.exe 127.0.0.1 9555`，进程 PID 23452，父 PID 15492。父进程在采样结束后已经不在，映像名没有留下。18 秒时的 TCP 是：

| 本地 | 远端 | 状态 |
| --- | --- | --- |
| `127.0.0.1:5756` | `127.0.0.1:17890` | Established |
| `127.0.0.1:5761` | `127.0.0.1:17890` | Established |
| `127.0.0.1:5764` | `127.0.0.1:17890` | Established |

MapleStory 使用临时端口，远端端口固定是 17890，所以它是 client。没有到 9555、频道端口或 8600 的连接，也没有公网远端。采样后结束的是这次启动的进程。

17890 上的应用层字节这次没有抓到。pktmon 需要单独的提升抓包，而连接角色已经能从 TCP 表看出来：同一个监听口同时服务浏览器和编辑器。没有把 17890 换成代理，也没有保存 pcap。

## 结论

```text
flwebsite.exe
  -> Dapan.exe
       listen 127.0.0.1:17890
       listen 127.0.0.1:19090

MapleStory.exe
  -> connect 127.0.0.1:17890
       与 Cursor / Edge / OneDrive / GitHub Desktop 相同
  -> 没有连接到 9555
```

17890 不是登录服前面的游戏协议中间层。Task 003 里那条 `127.0.0.1:17890` 记录对得上这次的监听进程，但不能再把它解释成 `Dapan -> 9555`。
