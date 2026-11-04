# Task 053 暂停记录 — C 盘满与虚拟机文件迁盘

日期：2026-10-19

## 状态

Task 053（后登录捕获）**暂停于登录前夜**——所有捕获前置条件已就绪，
因宿主 C 盘耗尽（0 剩余）触发的连锁故障而中止：

## 已完成（Task 053 停止前）

1. 服务栈起停验证：MySQL（0.0.0.0）+ 服务端 JAR（0.0.0.0:7575）正常，
   账号库在（fl2223/fl1234/task032test，SHA-1 口令）
2. 诊断链：容器无出站网络（1.1.1.1 不可达）→ 根因为 C 盘满导致的
   Docker Desktop 网络栈瘫痪（防火墙放行无效）
3. 决策：改用 Windows 原生 QEMU（slirp 直连宿主 localhost，绕开容器层）；
   本地安装器静默装失败（同为 C 盘满）

## 迁盘（本次维护动作）

`.work\task-024\vm`(26.78GB) / `.raw`(8.15GB) / `.work\task-036\captures`(2.02GB)
→ `E:\vm-store\`，原路径留 junction + 定位文档（`.work\VM-RELOCATION.md`）。
C 盘恢复 37.09GB 可用。

## 快照资产（迁盘后仍在，勿删）

win7x86-clean（无NIC）/ win7x86-clean-nicprep / **win7x86-nic-running（带网卡，登录捕获用）**

## 恢复跑单

见 `.work\VM-RELOCATION.md` 尾节（E: 装 QEMU → start_stack.py →
nic-running 快照 → 按 task/053 规格执行）。
