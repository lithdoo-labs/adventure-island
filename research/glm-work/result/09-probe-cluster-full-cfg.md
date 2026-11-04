# Task 011 — 探针窗口静态 CFG 全遍历（正常边优先）· 全集群图

> 执行日期：2026-10-10（glm-work 会话）
> 客户端 SHA-256：`5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`（脚本自检通过）
> 输入：`.work/task-009/probe-window.bin`（RVA `0x00856000`，长 `0xC000`，replay 停在 `CreateFileA("\\.\SICE")` 时的捕获）；`result/softice-branch-cfg.csv`、`result/normal-probe-path-cfg.csv`、`result/normal-probe-sequence.csv`、`result/winlicense-registry-calls.csv`、`result/winlicense-registry-cluster.md`、`result/protector-api-table-layout.md`（均为核对用既有证据）
> 工具：`glm-work/scripts/maple079_probe_cfg.py`（规范化自 `.work/task-011/cfg_follow.py`，含哈希自检与捕获校验）
> 产物：`glm-work/result/probe-window-cfg.csv`（71 行）、`glm-work/result/probe-call-sites.csv`（71 行）、`glm-work/result/probe-cfg-summary.json`
> 边界遵守：未执行样本、未 patch 任何字节/分支/标志、未伪造 `CreateFileA` 或注册表 API 返回值；普通系统预期结果只作文档性标注。

---

## 0. 摘要

1. 正常路径（`0x00859780` 起）的完整控制流已恢复：SICE miss → SIWVID 探针 → NTICE 探针 → 双 flag 分发（均跳过 `call ebx`）→ 汇合 → **五个 resolver 调用就地填充注册表集群的 API 槽** → 第一原地解码器边界。
2. **勘误（重要）**：既有四个 result 文件把 NTICE 返回测试记为 `0x0085A004/0x0085A005`、miss 边记为 `0x0085A00B`，实际为 **`0x00859A04 inc eax` / `0x00859A05 jne 0x00859A61` / miss 边 `0x00859A0B`**（整体 +0x100 错位）。`0x0085A00B` 真实身份是注册表集群 ExpInfo 单元的 open 调用（`winlicense-registry-calls.csv` 该行正确）。
3. **新发现（填补既有记录空白）**：`0x0085A36E–0x0085A3FE` 的五个 `call dword [slot 0x81C245]` 之前各有一次 `mov byte [slot 0x81A361], 'R'`（walker 首字符门），返回值 EAX 分别存入 **`0x859CE5`、`0x859CE1`、`0x81A829`、`0x8191E9`、`0x819C95`**——前四个正是注册表集群使用的 open/close/set/close2 槽。即：正常路径在跳过集群主体的同时，就地解析集群所需的四个 R 开头 API（第五个槽 `0x819C95` 用途未知）。这回答了 `protector-api-table-layout.md` 留下的"registry calls go through unresolved slots"的开放问题（解析点定位；名字仍不猜）。
4. 注册表集群 15 个单元全部解码：14×`HKCU\Software\WinLicense` + 1×**`HKLM\Software\WLkt`**（既有 CSV 把 WLkt 单元根键记为 HKCU，勘误）；值写有两代形状（unit1 REG_SZ `type=1/cb=0x19/data=槽值`，其余 REG_DWORD `type=4/cb=4/data=lea &槽`）；多数单元的 close 由 **slot `0x81BAB5`** 条件门控——与正常路径 flag 分发用同一槽。
5. `0x00859EBE` 不是注册表单元，而是 protector 状态写 thunk（把调用方 EAX=`0x40F` 写入 `[slot 0x81997D]+0x50` 指向的结构）。

---

## 1. 勘误：NTICE 返回测试 RVA（+0x100 错位）

窗口字节（`.work/task-009/probe-window.bin` 偏移 `0x8599F0` 起）：

```text
0x008599FC  FF D0                call eax            ← NTICE 调用点（返回地址 0x008599FE）
0x008599FE  31 95 C5 08 44 07    xor [ebp+0x74408C5], edx   ← 垃圾混淆（写 Tail B 槽 0x8198D9）
0x00859A04  40                   inc eax             ← 真正的返回测试
0x00859A05  0F 85 56 00 00 00    jne 0x00859A61      ← 检测边（0x00859A0B+0x56）
0x00859A0B  89 BD C1 13 44 07    mov [slot 0x81A3D5], edi  ← miss 边（普通系统）
0x00859A11  58                   pop eax
0x00859A12  8B B5 89 2A 44 07    mov esi, [slot 0x81BA9D]
0x00859A18  E9 6F 01 00 00       jmp 0x00859B8C
```

需修正的既有文件（仓库文件不可改，此处登记；后续引用以本文件为准）：

| 文件 | 错误内容 | 正确值 |
| --- | --- | --- |
| `result/normal-probe-sequence.csv` 行 4 | `0x0085A004 inc; 0x0085A005 jne; normal_edge 0x0085A00B` | `0x00859A04 / 0x00859A05 / 0x00859A0B` |
| `result/normal-probe-path-cfg.csv` 行 6–7 | 块 `0x008599FE–0x0085A005`、`0x0085A00B–0x0085A018` | `0x008599FE–0x00859A05`、`0x00859A0B–0x00859A1D` |
| `result/probe-convergence-task011.md`、`result/09-normal-probe-path-materialization.md`、`result/first-post-probe-stage.md` | "NTICE miss at 0x0085A00B" | `0x00859A0B` |

流向结论不受影响：miss 边后的 `jmp 0x00859B8C` 与后续链条（flag 分发 → `0x00859CE9` → `0x0085A36E`）均与既有记录一致。SIWVID 测试（`0x00859BB/0x00859BC/0x00859C2`）核对无误；SICE 测试（`0x00859779/0x0085977A`）核对无误。

---

## 2. 三个设备探针的异同（成功标准 #2）

| 项 | SICE | SIWVID | NTICE |
| --- | --- | --- | --- |
| 字符串 RVA | `0x00859507` | `0x00859510` | `0x0085951B` |
| `lea ebx` | `0x00859708` | `0x00859882` | `0x008599BF` |
| 调用点 | `0x00859757` `call eax` | `0x008598B3` `call eax` | `0x008599FC` `call eax` |
| access 构造 | `0xBFB099AC + 0x004F6654 = 0xC0000000` | `0xE6E15503 ^ 0x26E15503 = 0xC0000000` | `0xDEE0C1FB ^ 0x1EE0C1FB = 0xC0000000` |
| 其余六参 | share=3, sa=0, disp=3(`OPEN_EXISTING`), flags=0x80, template=0 | 同左（`0xBE816E45+0x417E923B=0x80`） | 同左（`0xE56575C7+0x1A9A8AB9=0x80`） |
| 文件名落栈 | 调用前已构造 | `mov [esp],ebx` @`0x008598A9` | `mov [esp],ebx` @`0x008599DC` |
| 返回测试 | `0x00859779 inc / 0x0085977A jne` | `0x008598BB inc / 0x008598BC jne` | `0x00859A04 inc / 0x00859A05 jne`（勘误后） |
| miss 边 | `0x00859780` | `0x008598C2` | `0x00859A0B` |
| 检测边 | `0x00859A61`（共用） | `0x00859A61`（共用） | `0x00859A61`（共用） |

**结论**：三次调用共享同一 EAX（replay 停点证明为 `kernel32!CreateFileA 0x7625EA00`，证据 `result/protector-resolved-api-map.csv`）、同一七参数配方、同一 `inc eax/jne` 测试形状和同一检测目标 `0x00859A61`；差异仅在混淆常数与垃圾指令。三个探针为同一检查的三次实例化（SoftICE 显卡 VxD / SoftICE 本体 / Numega SoftIce NT 驱动名，命名沿用 `result/device-probe-normal-semantics.md`）。置信度：high。

**普通系统预期（文档性，未注入）**：三个名字均无设备对象 → `INVALID_HANDLE_VALUE` → `inc eax` 置 ZF → 三次都走 miss 边（本机实测 error 2，证据 `result/task011-normal-path-baseline.md`）。

---

## 3. 正常路径 CFG（miss 边之后）

```text
0x00859A0B  NTICE miss
  ├─ mov [slot 0x81A3D5], edi ; pop eax ; mov esi,[slot 0x81BA9D]
  └─ jmp 0x00859B8C
0x00859B8C  mov eax,ecx / push ecx / jmp 0x00859BA2 (pop ecx / mov [slot 0x81A191],esi)
0x00859BC0  cmp [slot 0x81BAB5],0 / jne 0x00859BD2      ← flag #1
0x00859BC9  cmp [slot 0x8191F1],0 / je 0x00859BEB      ← flag #2（两处同形，0x00859BEB 再比一次）
0x00859BD2  push eax/ebx; mov eax,0x40F; mov [slot 0x81C331],eax; lea ebx,0x0085A307; call ebx  ← flag#1≠0 或 flag#2≠0
0x00859BF4  同形，lea ebx,0x00859EBE; call ebx                                    ← flag#2≠0（第二入口）
0x00859C0B  jb 0x00859C1B / fall 0x00859C11(jns 0x00859C1B)   ← 双侧均到 0x00859C1B（汇合）
0x00859C1B  mov ecx,edi / mov eax,eax / jmp 0x00859CE9
0x00859CE9  jmp 0x0085A36E                      ← 跳过注册表集群主体（0x00859CED–0x0085A36D）
0x0085A36E–0x0085A3FE  五个 resolver 调用（见 §5）
0x0085A404  lea eax,0x00859FF1 ; mov [slot 0x81AC3D],eax        ← 登记 ExpInfo 单元入口
0x0085A410  call gadget → 0x0085A464 第一原地解码器（5977 dword， xor/xor/sub ）
             ← 里程碑 M2 边界（既有结论，`result/first-post-probe-stage.md`）
```

flag 分发语义：两个 Tail B 槽 `0x81BAB5`/`0x8191F1` 在 T2 镜像中均为 0（证据 `result/normal-probe-path-analysis.md`，medium——非本次 replay 重新读取），全零时两个 `call ebx` 块都被跳过。**`call ebx` 的两个目标**：

- `0x0085A307`（`pushal` + CheckOUT 单元 `0x0085A308`）：真实注册表单元，走 open/set/条件 close/close2 后 `popal/ret`；
- `0x00859EBE`：**非注册表单元**。`cmp [slot 0x81997D],0 / je ret ; mov ebx,[0x81997D] ; add ebx,0x50 ; mov [ebx],eax ; ret`——把调用方传入的 EAX（分发处装载 `0x40F`=1039）写入 `[0x81997D]+0x50` 的运行态结构。protector 状态写。

汇合关系（成功标准 #6）：`0x008597B6 jno` 两侧、`0x00859888 je/jno` 两侧、NTICE `jle` 侧均汇入对应调用；flag 分发四条组合路径全部汇入 `0x00859C0B→0x00859C1B`；三个探针的**检测边共用 `0x00859A61`，且检测边内部（走到 `0x00859B84 jmp ebx` 间接转移）在窗口内不与正常路径重汇**——与 Task 009 "无共享错误标签" 结论一致（证据 `result/protector-probe-convergence.md`）。

---

## 4. WinLicense 注册表集群（成功标准 #3）

结构总览（细节行见 `probe-call-sites.csv` 与 `probe-cfg-summary.json`）：

- 字符串表 `0x00859C24`：`Software\WinLicense`、`Software\WLkt` + 14 个值名（`WinLicenseVersion/WinLicenseDriverVersion/WinLicenseInstance/ExitOk/XprotExit/TpIN/HWIN/ExpInfo/ProcIN/ProcOUT/ExitIN/ExitOUT/CheckIN/CheckOUT`）。
- **15 个单元**，每个 = 保存 EAX 到数据槽 `0x859CD9` → open（3 参：root、subkey、`&hkey 槽 0x859CD5`，经槽 `0x859CE5`）→ 值写（6 参，经槽 `0x81A829`）→ close（1 参，经槽 `0x859CE1`，多数单元被 `cmp [slot 0x81BAB5],0/je` 门控）→ close2（1 参，经槽 `0x8191E9`，无条件）→ ret。
- **两代值写形状**：
  - unit1 `WinLicenseVersion`：`type=1 (REG_SZ) cb=0x19 data=槽值（字符串指针）`；
  - 其余 14 个：`type=4 (REG_DWORD) cb=4 data=lea &槽（dword 指针）`。
  （既有 `result/winlicense-registry-cluster.md` 只描述了 0x19/1 形状；`winlicense-registry-calls.csv` 的"same six-argument shape"不准确。）
- **WLkt 变体**（单元头 `0x0085A1ED`，open @`0x0085A1F9`）：root=**`0x80000002` HKLM**（既有 CSV 记为 HKCU，勘误）；`or eax,eax / je` 测试 open 与 set 的返回值（成功=0 时才写，失败则数据槽清零并跳走）；REG_DWORD；内部还含 close2 @`0x0085A25D` 与**一个 resolver 调用 @`0x0085A282`（经槽 `0x81C245`）**——集群内部也会补解析 API。
- `ExpInfo` 单元（open @`0x0085A00B`）缺 `0x859CE1` close（只有 close2）——既有 CSV 未记录该差异。
- 单元内条件 close 的门槽 `0x81BAB5` 与正常路径 flag #1 同槽——集群行为与分发 flag 联动。

**逐调用语义倾向与置信度**（槽名不猜，保持 unresolved）：

> **2026-10-10 会话 2 更新（Task 012b）**：下表的"形状级"判断已被**地面真值字典全面取代**（`resolver-api-dictionary.csv`，walker 插桩法，23/23 命名，置信度 high）：
> - `0x00859CE5` = **advapi32!RegCreateKeyA**（非 open——**创建**键；干净系统上对 HKCU 会**成功**而非失败）
> - `0x00859CE1` = **kernel32!RegFlushKey**（非 close）
> - `0x0081A829` = **kernel32!RegSetValueExA**（证实）
> - `0x008191E9` = **kernel32!RegCloseKey**（证实）
> - `0x00819C95` = **kernel32!RegQueryValueExA`（第五槽=查询）
>
> §4 末"普通系统预期"相应修正：HKCU 单元（若被开关激活）会**创建并写入** `HKCU\Software\WinLicense`；WLkt 单元（HKLM）在非管理员下创建失败走清零分支。集群整体仅由命令行开关激活（写入者=开关表解析器 `0x85A5E6–0x85A9AA`，见 `10b-static-extension.md` §2），自然路径不执行。

| 槽 | 参数形状 | 语义倾向 | 置信度 |
| --- | --- | --- | --- |
| `0x00859CE5` | (root, subkey, &hkey) | open 形（RegOpenKeyA 族） | high |
| `0x0081A829` | (hkey, name, 0, type, data, cb) | 值写形（RegSetValueExA 族；WLkt 单元返回测试证实按 Win32 LONG=0 成功语义使用） | high（升自 medium：+返回测试证据） |
| `0x00859CE1` | (hkey) | close 形（RegCloseKey 族），条件执行 | medium |
| `0x008191E9` | (hkey) | 第二个单 hkey 调用，无条件；close/flush 族 | low-medium |

**集群入口**（正常路径全零时不执行任何一个单元）：
1. `call ebx @0x00859BE7 → 0x0085A307`（CheckOUT 单元，flag#1≠0 或 flag#2≠0 时）；
2. `slot 0x81AC3D ← 0x00859FF1`（ExpInfo 单元 pushal 入口，@`0x0085A40A` 登记，调用者在窗口外）；
3. 其余单元头在窗口内**无静态前驱**（盲区，见 §7）。

**普通系统预期（文档性）**：`HKCU\Software\WinLicense` 与 `HKLM\Software\WLkt` 在干净系统均不存在（本机核对，`result/task011-normal-path-baseline.md`）→ open 返回非 0 → WLkt 单元走失败分支；HKCU 单元未测试返回值，随后对 0 句柄的 set/close 均会失败。不注入这些值。

**集群定性**（沿 `result/winlicense-registry-cluster.md` 并强化）：这是 protector 协调状态读写（版本戳、实例号、进出标记、HWIN 窗口句柄类数据），不是反调试设备检查；设备检查是它前面的三个 `CreateFileA`。集群整体落在被跳过的块内，属于"条件性执行路径"。

---

## 5. 五个 resolver 调用：注册表 API 槽的就地解析（新发现）

```text
0x0085A36E  mov byte [slot 0x81A361], 'R'   ← walker 首字符门 = 'R'
0x0085A375  push 0xADE47B07                 ← 名字描述符游标（立即数）
0x0085A37A  push dword [slot 0x81974D]      ← 模块基址槽（内容为运行态；ADVAPI32 已在探针前 LoadLibrary，0x767F0000，证据 protector-module-load-order.csv——推断，非静态证明）
0x0085A380  call dword [slot 0x81C245]      ← resolver 槽
0x0085A386  mov [slot 0x859CE5], eax        ← 填 open 槽
（同样四处：0x0085A39E→0x859CE1、0x0085A3BC→0x81A829、0x0085A3DA→0x8191E9、0x0085A3F8→0x819C95）
```

描述符立即数序列：`0xADE47B07, 0x902E00E5, 0xB9BF1235, 0x98781034, 0xC005DBD4`。五个槽中四个 = 集群 API 槽，第五个 `0x819C95` 用途未知（盲区）。槽 `0x81C245` 内容不在窗口内（Tail B 0x81xxxx 区），但调用形状（基址+描述符）与 Task 008/009 恢复的 export-walker 家族一致（`result/protector-resolver-cfg.csv`）。置信度：映射本身 high（字节直读）；"解析的是 ADVAPI32 导出"为 probable（模块已加载 + 门字符 'R' + 目标槽全部为注册表语义，未直接观测解析结果）。

---

## 6. 检测边（`0x00859A61`）静态跟进

`mov ebx,eax / … / dec ebx`（句柄回 EBX）→ `0x00859A8A mov byte [slot 0x81A361],'C'`（walker 门改 'C'，Task 009 已记）→ 两个 `call eax` 内部分派（`0x00859B03`、`0x00859B4E`；跟踪目标落到窗口外的 Tail B 槽地址，不可判读）→ `0x00859B84 jmp ebx` 间接转移，目标为运行态句柄相关值 → **窗口内不可继续**。检测边在窗口内不汇回正常路径（不汇聚证明，成功标准 #6 的另一半）。维持 Task 009 结论：检测边之后分类 unknown，不执行、不推进。

## 7. 盲区清单（成功标准 #1 的边界）

1. 集群 15 个单元中 13 个的调用者不在窗口内（无静态前驱）；`0x81AC3D` 槽的 ExpInfo 单元登记调用者同样在窗口外。
2. 槽 `0x81C245`（resolver 入口）、`0x81974D`（模块基址）、`0x819C95`（第五解析目标）的内容/语义：静态不可见，保持 unresolved。
3. 检测边 `0x00859B84 jmp ebx` 之后：依赖运行态句柄，静态不可达（这正是 G1 决策门要评估的点）。
4. 第一解码器内部与之后（`0x0085A464` 起 5977-dword 循环、开关表、第二解码器、`0x0085B405` LE/VxD、`0x0085FCC0` 驱动安装体）：本任务边界止于识别（既有结论 `result/first-post-probe-stage.md`），遍历归 Task 012。
5. flag 槽 `0x81BAB5`/`0x8191F1` 的写入者：窗口内未见（谁在什么条件下置非零决定集群是否执行——值得 Task 012 顺带留意）。

## 8. 锚点扫描（沿用）

窗口与两个已解码 span 内无 AES key / IV 表 / IV seed / `List.wz` / `.wz` / `WS2_32` / RTTI（证据 `result/normal-probe-path-analysis.md` 末段、`result/task011-game-anchor-hits.csv`）。本任务未产生新 materialized 区，未新增扫描对象。

## 9. 成功标准自评

| 计划标准 | 状态 |
| --- | --- |
| 窗口内全部可判读调用点有结构化记录 | 达成（71 行 `probe-call-sites.csv`：3 设备 + 2 thunk 调用 + 5 resolver + 60 集群调用 + 1 SICE 静态行；检测边 2 个不可判读点已入盲区） |
| 三个设备探针异同有结论 | 达成（§2，high） |
| 注册表集群每个调用有语义倾向与置信度 | 达成并超出（15 单元全解码、两代形状、HKLM 勘误、条件 close、WLkt 返回测试；§4） |
| 分支普通系统预期标注 | 达成（§2/§4，文档性） |
| 两侧边汇聚点 | 达成（正常侧全链汇合点已列；检测边证明不汇聚） |

**对既有仓库结论的净修正**：NTICE 测试 RVA +0x100 错位（5 处）、WLkt 根键 HKCU→HKLM（1 处）、"call ebx into 0x00859EBE" 的性质（注册表单元→状态 thunk）、集群值写形状单一的说法。其余既有结论（探针序列、跳过集群、解码器边界、无游戏锚点）复核无误。

## 10. 下一步

Task 011（glm-work 形态）完成 → 进入 **Task 012：正常路径后续阶段识别**。输入：本文件 §3 的 CFG 与 §7 盲区、`.work/task-009/round-2-post.bin`。重点沿既有 Route B 结论深化：`0x0085FCC0` 驱动安装体与 `0x0085B405` 嵌入 LE 镜像的静态遍历、Tail A / Ztl / packed-raw（`0x001000–0x2CE000`）地址形成扫描。
