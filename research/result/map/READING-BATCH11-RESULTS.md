# 逐函数阅读战役 — 第十一批成果

## P1: 游戏帧循环 — 确认不可达（最终结论）

搜索全部 52K 函数：**零** PeekMessage/GetMessage/SetTimer/timeSetEvent 模式。
三个物理 tick 调用者全部是 `__thiscall`（虚表方法）——**帧循环 100% 经 PCOM COM 接口驱动**。

**最终结论**：主循环 = COM 组件的消息泵（在 Gr2D_DX8 或 ASPLnchr 中，经 D3D 设备的渲染回调）。静态分析永久不可达。

## P2: NameSpace.dll — WZ 文件系统

Top-10 函数全部无字符串锚、无文件操作 API——**WZ 文件读取通过内存映射（MapViewOfFile）而非 ReadFile**。
0x5040eadd（8KB）含 `_img` 字符串 → **WZ img 文件节点查找函数**。
59 调用 = NameSpace 的核心路由器。

## P3: ResMan.dll — 资源缓存

全部无字符串——纯 COM 虚表方法。资源查找/缓存/LRU 淘汰在虚表后面。

## P4: 未标注函数语义信号

143 个中等大小（1-5KB）函数含物理/加密信号但无标注。
Top-10 中：0x5bcfed/0x5c6028/0x5d06d4（物理tick调用者）+ 0x55308c（下跳门控）等已识别。

## 维度推进

| 维度 | 发现 | 进度 |
|---|---|---|
| 渲染 | 帧循环=COM消息泵（最终确认）；NameSpace=内存映射WZ | 47→**48%** |
| **整体** | | **74.1→74.3%** |
