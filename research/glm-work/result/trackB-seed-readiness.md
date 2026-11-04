# 轨道 B / T-102 — v95 符号种子与当前边界的就绪对接

> 执行日期：2026-10-10（glm-work 会话 2）
> 输入：`reference/maplestory-symbols/`（LEGAL/README/SOURCES + upstream v95/Maple.Enums + derived 两件——计划 Q13 所述缺口**已在仓库侧补齐**）
> 工具：`glm-work/scripts/maple079_seed_scan.py`（种子证据扫描器，可对任何新物化缓冲运行）
> 本文件不重复仓库 derived 内容，只做**就绪度对接**与本会话新增判别器的登记。

## 1. 种子表现状核对

`derived/cms079-correlation-seeds.csv`（19 行）与 `function-family-seeds.md` 覆盖：网络/封包核心（CClientSocket/CInPacket/COutPacket 族）、应用全局（CWvsApp/CWvsContext/CLogin/CStage/CField/CQuestMan）、登录 UI 族、游戏对象族（CUser/CMob/CNpc…）、Task 002 三个 crypto 常量。证据要求列（`cms079_local_evidence_to_require`）与仓库 README 的 5 级证据顺序一致——**结构合格，无需重建**。全部状态 `unmatched`，符合当前边界（游戏镜像未物化）。

## 2. 本会话新增的判别器与注意事项（对种子使用的修订）

| # | 新事实 | 对种子匹配的影响 |
| --- | --- | --- |
| 1 | WzMss.dll = 官网 SOAP 客户端（`api.maplestory.nexon.com/Soap/Consult`），其 WS2_32 活动与游戏服协议无关 | **反判别器**：任何 socket 证据必须排除 WzMss 进程内活动；CClientSocket 候选需要 9555/7575 端口或 Maple 头构造行为，仅有 socket 调用不够 |
| 2 | `ztl` 是官方内部库词根（ZLZ PDB 路径 `D:\ACGAME_CN\ztl\ZLZ\`；主程序导出 ZtlTaskMem*） | 正判别器：游戏代码若链接 ztl 库，内存中可能出现 `ztl`/`Ztl` 串与分配器调用形状；可作为 Tail A 物化后的辅助证据 |
| 3 | Wizet DLL 保留完整 MSVC RTTI（CWzCanvas/CWzRawCanvas 实测命中） | RTTI 路线可行性证实；种子表的 `.?AVC*@@` 匹配策略有效 |
| 4 | 保护链在游戏镜像物化前还有 ~700KB 编码区（`0x862000+`，无已知常数可解） | 种子匹配的**前置条件**仍是 M3（Tail A 物化）；当前任何缓冲扫描预期为 absent（已由 seed_scan 在探针窗口复验） |
| 5 | resolver 即时命名能力（`maple079_checksum_table.py`） | 游戏代码物化后，若其 import 重建仍走 walker，可把游戏侧 API 名单整套恢复（比 v95 种子更直接的本地证据源） |

## 3. 种子扫描器使用约定（与阶段二/三衔接）

```text
# 任何新稳定缓冲（Tail A 写入、新解码 span、VM 内存捕获）出现后：
python glm-work/scripts/maple079_seed_scan.py <buffer.bin> <base-rva> --name <label> --out glm-work/result/taskNNN-seed-hits.csv
```

判定规则（沿用仓库 README 证据顺序）：
- crypto 常量命中 = 常量证据（仍需 xref + 数据流才可命名函数）；
- RTTI `.?AVCClientSocket@@` 等命中 = 类名证据（配合 vtable 簇 + singleton 访问形状）；
- `55 8B EC` 密度 ≥12/4KB 的块 = MSVC 函数簇信号（先圈区再找锚点）；
- 全 absent 时如实记录 absent（不降阈值凑数）。

## 4. 结论

轨道 B 在本会话的合理工作量已闭环：仓库 derived 齐备（Q13 ✅），本会话补上**边界对接文档 + 可运行扫描器 + 三条新判别器**。后续 M3 达成前无进一步动作；M3 达成后种子匹配以 `maple079_seed_scan.py` 为第一道工序。
