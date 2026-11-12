# 第八轮：s2c 格式实证修复 + 捕获阻断链确诊

日期: 2026-11-12。

## 1. s2c 写序实证修复（重要数据修复）

**问题**：WAVE15-S2C-WRITERS.csv 中 303 个 writer 的 write_seq 全为空——
知识库"303 s2c writer 格式"的声明**没有数据支撑**（提取脚本只写了方法名）。

**修复**：从 MaplePacketCreator.java 源码（.work/task-002/decompiled/tools/）直接提取：
- **321 个方法的有序写调用序列**（WAVE16-S2C-WRITE-SEQ.csv）
- 覆盖 284 个 writer 名单中的 267 个（17 个缺失为薄委托）
- 样例：spawnNPC{opcode,objId,npcId,pos,...}、closeRangeAttack 21 调用、giveBuff{mask,statup,buffid}

## 2. 进图捕获阻断链——精确确诊

本轮实际启动了 VM 编排（Docker + QEMU 全链路复现），确诊阻断链：

```
Windows 7 激活失败（错误 C004F009，登录时弹出）
  → 登录被阻止（ESC 可关对话框但 UI 随即挂死）
  → 双 vCPU HLT 空闲（EIP=0x8ff5a5d6 内核态，非忙自旋）
  → 游戏/启动链无法触达
  → 进图捕获不可行
```

**关键修正**：当前挂死 ≠ F2 忙自旋（F2 = CPU 140-152% 忙循环）。
原始 F2 与本次激活故障是两个独立阻断；激活故障为**新确诊的首要阻断**。

### 诊断证据
- 登录界面回车 → C004F009 激活错误对话框（OCR 确认）
- ESC 可关闭对话框但后续 UI 无响应（40s 屏幕静止 + ctrl-alt-del 无效）
- CPU#0/#1 均 HLT=1（QEMU info registers，CPL=0）= 系统挂死非自旋
- system_reset 后正常启动可复现登录界面 → 系统盘完好，仅激活/登录链损坏

### 修复路径（后续）
1. WinRE 离线 `slmgr -rearm`（重置激活宽限期）
2. 或更换磁盘镜像（备份快照已无——当前 QEMU 无内部快照）
3. 或接受边界：静态分析已达 89.7%，进图层留待 VM 修复

## 3. 资产
- WAVE16-S2C-WRITE-SEQ.csv（321 真实写序）
- f2regs2-run.log（完整寄存器证据）
- capture2-run.log / login_diag 流程记录
