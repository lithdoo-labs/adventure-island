# 被动协议捕获

not observed。

本地 `server.Start` 在采样时已经监听 9555、7575–7578 和 8600，监听进程是 java PID 21684。无调试器的 `MapleStory.exe 127.0.0.1 9555`（PID 23452）在大约 45 秒里没有出现到这些端口的 TCP。因此没有 15 字节握手，没有 C->S，没有 S->C，也没有频道迁移。

本机没有 Wireshark / Npcap。pktmon 和 WPR 都在，但没有游戏端口流量可抓。没有保存 pcap 或 etl。

`127.0.0.1:17890` 仍由 Dapan 监听。这次 MapleStory 的套接字表里没有这条连接，所以它不是这次失败的转发路径。
