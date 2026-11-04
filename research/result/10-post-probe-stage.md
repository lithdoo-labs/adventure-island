# Task 012 — 正常路径后续阶段识别（M2）

> 执行日期：2026-10-10（glm-work 会话）
> 客户端 SHA-256：`5d280cf1c5663e925104736e73e5715a529d25420babf410cc411b37940f4d`（脚本自检通过）
> 输入：Task 011（glm-work）产物；`.work/task-009/probe-window.bin`、`.work/task-009/round-2-post.bin`、`.work/task-006/tail-b-nonzero.bin`（T2 块，去 0x14 头后 SHA `5529577e…c865`）、`scripts/maple079_stage2_continue.py`（已提交 replay 工具，只读复用）
> 工具：`glm-work/scripts/maple079_post_probe_scan.py`、`glm-work/scripts/maple079_wide_capture.py`、`glm-work/scripts/maple079_write_logger.py`
> 产物：`next-transform-candidates.csv`、`task012-scan-summary.json`
> 边界遵守：replay 复跑两次均停在**未应答**的 `CreateFileA`（不注入返回值）；未 patch 任何字节/分支；所有"普通系统预期"仅作文档性标注。

---

## 0. M2 答案（成功标准达成）

正常边（NTICE miss `0x00859A0B`）之后的第一个非探针结构链：

1. **解码器 A**（producer `0x0085A464`）：xor/xor/sub 原地 5977 dword，span `0x0085A530–0x00860293`，明文 = 命令行开关表（`/getwlstatus`、`/checkprotection`、`/bugcheck` 等）——既有结论，复核无误。
2. **解码器 B**（producer `0x0085AA35`）：add/xor/add 原地 5958 dword，span `0x0085AA4B–0x00860762`，明文 = **Oreans SecureEngine 驱动安装段**（含 `MZ`/`LE` VxD 镜像 @`0x0085B405`）。
3. **驱动安装/服务控制段** @`0x0085FCC0`（经 `0x0085B400` 自补丁 jmp → `0x0085EBD5` → `0x0085FCC0`）：静态遍历 **152 块 / 68 调用点**（首次遍历，此前只"看到下一个 gadget"）。结构见 §2。

在此之后（`0x00862000–0x00912000`，约 700KB）：探针停点时刻**仍为编码态**（唯一例外：`0x0090D000–0x00910000` 为同字节填充页）。其解码轮的生产者位于被编码区内——静态自然推进到此为止（§4 精确 blocker）。

## 1. 重大发现：此前未编目的解码轮 round 3（探针前）

对全 Tail B（`0x00819000–0x00912000`）做"T2 输出 → 探针停点"区域级差分（注意：`tail-b-nonzero.bin` 有 0x14 字节头，须剥离后对齐；本会话早期一次未剥离的比对产生过三段伪影差异，已废弃），得到**恰好两个**大改写区：

| 区间 | 字节数 | 归因 |
| --- | --- | --- |
| `0x0081CEB5–0x00824 097` | 29154 | rounds 1/2（已知，Task 008） |
| `0x0085941A–0x0085FA3E` | 26148 | **round 3（新发现，本轮定案）** |

第二次 replay 运行（注入写记录钩子，replay 本体未改）给出 round 3 的 producer：**`0x008593E3` `mov [edi+eax], ebx`，6537 次写**（与差分字节数 26148/4 精确一致）。循环体全恢复并经全语料验证（6537/6537 dword 吻合）：

```text
0x008593A1  push dword [eax+edi]        ; 读光标处源值
0x008593AA  pop  ebx
0x008593BB  add  ebx, 0x3DDF4CA1        ;（0x8593BA 对齐入口后）
0x008593C1  add  ebx, 0x1C39E09C
0x008593DD  xor  ebx, 0x61799419
0x008593E3  mov  [edi+eax], ebx         ; 写回同一光标
0x008593EF  sub  eax, 2 ; dec eax ; dec eax   ; 光标 -4
0x0085940B  cmp  eax, 0xFFFF99DC ; jne 0x8593A1  ; 共 6537 步
```

- **公式**：`dst = ((src + 0x3DDF4CA1 + 0x1C39E09C) & 0xFFFFFFFF) ^ 0x61799419`
- **span**：`0x0085941A–0x0085FA3D`（6537 dword，0x6624 字节），EDI=0x0085FA3E、EAX 从 -4 递减至 -0x6624；基址 dword `0x0085FA3E` 本身不改写
- **时序**：round 2 之后、SICE 探针之前（把探针集群代码/字符串表解码成可读态）
- 输出（探针停点态）该 span SHA-256：`b66a6d79b90c220085c30222f2bbd80ea5c33060e8fa1afd66a4cd748fc5d315`
- 其余写入者全部对上已知结构：`0x0081CB1B`(28672)=T3、`0x0081CE47`=round1、`0x0081D5D2/D5D8/D5EE/D5F9`=round2 循环、`0x0081D106/0x0081D18C`(~3570)=walker 槽填充、`0x00821778/0x0081C7E0/0x00834871`=共享 wrapper/指针提交

**修正既有记录**：`result/normal-probe-path-analysis.md` 所记 span1 SHA `4ddbdf0e…` 是**解码器 A 之后、B 改写重叠区之前**的中间态（A、B 两个 span 在 `0x0085AA4B–0x00860293` 重叠，最终态该区间与中间态不同）。本会话两个 SHA 均已按正确时点复现吻合。

## 2. 驱动安装段解剖（0x0085FCC0，152 块静态遍历）

- **同一对 flag 槽反复门控**：`cmp [slot 0x81BAB5],0 / jne` 与 `cmp [slot 0x8191F1],0 / je` 的组合出现约 10 次，每次决定一个 `call ebx` 进入注册表集群区的小入口（`0x00859EA5/0x00859ED7/0x00859EF0/0x00859F09/0x00859F23/0x0085A03F/0x0085A0A6/0x0085A10D/0x0085A2A0`——集群 15 个锚定单元之间的"间隙入口"，即 Task 011 盲区里那些单元的实际调用者）。
- **约 17 次 resolver 调用**：形状 `push imm32(描述符) ; push [模块基址槽] ; lea eax,[0x0081CEC7 助程] ; call eax`，前置 walker 门字符写入（分布：`G`×6、`C`×3、`S`×2、`D`×2、`W`/`L`/`F`/`w`/`E` 各 1，写于 `0x0085FFA4–0x008619B2`）。模块基址槽：`0x0081A621`（kernel32）与 `0x0081974D`（按用途推断为 ADVAPI32，probable）。描述符立即数中 `0x98781034`、`0xC005DBD4` 与 Task 011 发现的注册表 API 解析序列重合（重复解析）。
- **`\\.\Oreans.vxd` 设备打开**：`0x00860C96 call [slot 0x00819A79]`，七参配方 = CreateFileA 形状（name=`\\.\Oreans.vxd` @`0x0085F76E`、access=`0x80000000` GENERIC_READ、share 0、`OPEN_EXISTING`、flags `0x80`、template 0），句柄存槽 `0x0085F76A`。
- **驱动文件路径**：格式串 `%s\Oreans.vxd` @`0x0085F787`（目录拼接后写驱动文件——"Cannot write oreans.vxd" 字符串同段）。
- **服务控制**：`OpenSCManagerA`(lea @`0x00861347`)、`CreateServiceA`(@`0x0086154C`)、`StartServiceA`(@`0x008615BA`)、`oreans32.sys`(@`0x00861774/0x008619D7`)、`oreansx64.sys`(@`0x0086173E`)、`\\.\oreans32`(@`0x00861A66`)、`\\.\Global\oreans32`(@`0x00861B2D`)、`\\.\Global\oreansx64`(@`0x00861AD1`)、`XprotEvent`(@`0x00861208`)——**`\\.\oreans32` 的引用点从"未解析"推进为已定位**（Task 011 遗留问题）。
- **新环境探针：Wine 检测**。`0x008610F7 cmp byte [slot 0x0085FC97],0 / jne` 门控下，`0x00861113 call [slot 0x0081B125]` 以三参注册表 open 形状打开 **`HKCU\Software\Wine`**（子键串 @`0x0085FC98`，另一参数 @`0x0085F9DA`），`or eax,eax / jne` 测试返回，成功(0)则 `mov [slot 0x00819D39],1`——Wine/兼容层检测标志。普通系统预期：键不存在 → 返回非 0 → 标志不置位（文档性预期，未注入）。
- **内嵌载荷**：LE/VxD 镜像 @`0x0085B405`（`MZ`，e_lfanew 0xB0，`LE` 签名 @`0x0085B4B5`，`XPROTVXD` 名）。

## 3. 负结果（全部有数据支撑）

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| Tail A（`0x002CE000–0x007EA000`）/ Ztl 槽 / packed raw（`0x001000–0x002CE000`）地址形成 | **0 个** `[ebp+disp]` formed 引用落入游戏镜像区 | `formed_hits=0`（raw+decoded 缓冲全扫） |
| 立即数扫描 | 2746 个 dword 原始命中，全部处于字节噪声底（代码字节被误读为数值），无可信代码上下文命中 | `imm_hits`（CSV 截 2000 行，标注 low） |
| 新自解码轮（可读区内） | 5 个字节模式候选**全部证伪**（call/jmp 跳过的死字节，或解码器 B 的输入伪影；0x0085934B 等经解码上下文核查） | `next-transform-candidates.csv` disproved 行 |
| 游戏锚点（AES key/IV 表/IV seed/`List.wz`/`.wz`/`WS2_32`/`WSAStartup`/`.?AV`/`.?AU`） | 解码后缓冲与宽捕获均**无命中**；`55 8B EC` 密度无任何 4KB 块 ≥12 | `task012-scan-summary.json` anchors |
| `0x00862000–0x00912000` | 探针停点仍全部编码态（除 `0x0090D000–0x00910000` 填充页）；无字符串、无低熵代码页 | 宽捕获熵扫描 |

## 4. 精确 blocker 与 G1 评估

- **M2 已回答**（结构识别 + RVA + 证据 + 置信度）：非探针阶段 = 解码器 A/B + Oreans 驱动安装段。
- **下一静态边界**：驱动安装段之后的一切都在 `0x00862000+` 编码区内；该区的解码轮生产者自身在被编码区内（鸡生蛋）。越过探针本身需要 `CreateFileA` 的运行态返回值（不可注入）；驱动安装段的完整执行需要服务控制 API 的运行态交互。**静态路线在"探针停点捕获 + 离线确定性解码"方法论内已推进到方法论极限。**
- **G1 判据**（静态能否到达非探针阶段）：**能，已达成** → 按计划进入阶段二评估。但阶段二的入口（Tail A materializer）未出现在任何可读区域；其最大候选位置 = `0x00862000+` 编码区（~700KB）或 packed raw `0x001000–0x002CE000` 的消费者。G2 相关：Ztl 槽/Tail A 在两次 replay 运行中均保持全零（re-run `ztl` 字段 + `tail_a=false` 复核）。
- 遗留给下一任务的三个具体问题：① `0x00862000+` 的解码轮在哪里（可对 T2 块该区段做 round-3 同族常数盲测，低概率但零成本）；② flag 槽 `0x0081BAB5`/`0x008191F1` 的写入者（决定注册表集群与驱动段内大量条件分支的真实走向）；③ `0x0081C5D7`/`0x0081CEC7` 助程簇与五个注册表槽的完整 API 名解析（需 walker 描述符常量的逆向字典，静态可做）。

## 5. 对既有仓库记录的修正登记

1. `result/normal-probe-path-analysis.md`：span1 SHA 为中间态（B 改写重叠区前）；应注明时点。
2. `result/first-post-probe-stage.md` / `result/09-normal-probe-path-materialization.md`："0x0085FCC0 driver body 未走"→ 本轮已走（152 块/68 调用）；"`\\.\oreans32` callsite unresolved" → 引用点已定位（lea @`0x00861A66` 等；CreateFile 调用形状同 `0x00860C96` 配方）。
3. 编年补遗：探针前解码链应为 T1→T2→T3→round1→round2→**round3(0x008593E3)**→探针（round3 此前完全未编目）。

## 6. 复现

```text
python glm-work/scripts/maple079_wide_capture.py      # replay 复跑（停点字节级复现）+ 宽捕获
python glm-work/scripts/maple079_write_logger.py      # replay 二跑 + 写记录（round3 producer 定位）
python glm-work/scripts/maple079_post_probe_scan.py   # 解码复现/SHA 校验/驱动段遍历/扫描/round3 验证 → CSV+JSON
```

环境：Python 3.14.4 / Capstone 5.0.7 / Unicorn（committed replay 依赖）；kernel32 = 本机 SysWOW64（SHA `bafd9e06…68f3` 与记录一致）；block = `.work/task-006/tail-b-nonzero.bin`（去头 SHA `5529577e…c865` 一致）。
