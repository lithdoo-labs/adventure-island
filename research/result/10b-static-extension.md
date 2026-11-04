# Task 012b — 静态延伸：resolver 字典、round-3 同族盲测、flag 写入者、VxD 载荷

> 执行日期：2026-10-10（glm-work 会话 2）
> 客户端 SHA-256：`5d280cf1c5663e925104736e73e5715a529d25420babf410cc411b37940f4d`（脚本自检通过）
> 输入：Task 011/012 产物；`.work/task-009/round-1-post.bin`、`round-2-post.bin`、`probe-window.bin`；`.work/task-006/tail-b-nonzero.bin`；探针停点宽捕获（`maple079_wide_capture.py` 重生成）；本机 SysWOW64 kernel32（SHA `bafd9e06…68f3` 与 replay 记录一致）/advapi32/user32/ntdll
> 工具：`glm-work/scripts/maple079_checksum_table.py`（地面真值法 resolver 字典）、`maple079_wide_capture.py`
> 产物：`resolver-api-dictionary.csv`（23/23 命名）
> 边界遵守：离线 Unicorn 中跑 protector 自己的 walker 代码对照真实导出表；不执行目标进程、不注入返回值、不 patch。

---

## 0. 摘要

1. **resolver 字典完成（23/23）**：直接调用形态的 imm32 **就是名字校验和本身**（助程 `0x81CEC7`=`mov edx,[esp+0x28]` 即 walker 入口）。用"真 walker + 真系统 DLL + 插桩取地面真值"法（钩 `0x81D13C` 取名字、`0x81D184` 取计算校验和），一次失败遍历即枚举模块全部导出名→校验和。
2. **注册表集群五槽全部命名**（推翻形状级猜测）：`0x859CE5=RegCreateKeyA`（**创建**而非打开！）、`0x859CE1=RegFlushKey`（非 close！）、`0x81A829=RegSetValueExA`、`0x8191E9=RegCloseKey`、`0x819C95=RegQueryValueExA`（Task 011 遗留的"未知第五槽"=**查询**）。
3. **flag 写入者定位（Q16 解决）**：槽 `0x81BAB5/0x8191F1` 的 7 个写入点全部是 `mov dword [slot],1`，且都落在**命令行开关解析器**（decoder A 输出 `0x85A5D9–0x85A9AA`）内——集群/驱动段 thunk 由命令行开关置位；自然路径（无开关）恒为零。
4. **round-3 同族盲测（Q15 部分回答）**：已知 11 个变换常数（r1/r3/decA/decB 族）对 T2 `0x862000–0x911B25` 区全部无结构涌现（熵 ~7.95、无 `55 8B EC` 群）——该区不使用任何已见常数，解码器 C 未找到。
5. **VxD 载荷结构化（Q 补充）**：`0x85B405` 内嵌镜像 = 386/VxD LE 格式、单对象、0x14 页 × 0x200 + 0x1C0 ≈ **0x27C0（~10KB）**、设备名 `XPROTVXD`（LE+0x12D）——写入 `%s\Oreans.vxd` 的驱动本体。

## 1. resolver 字典（成功核心）

调用形态（Task 011/012 观测）：

```text
mov byte [slot 0x81A361], <gate>     ; walker 首字符门
push imm32                           ; = 名字校验和（本节证明）
push dword [模块基址槽]              ; 0x81A621=kernel32 / 0x81974D
call dword [slot 0x81C245] 或 lea eax,[0x81CEC7]; call eax
```

助程 `0x81CEC7` 反汇编（round-1 输出，字节直读）：

```text
0x81CEC7 pushal / cld / …junk…
0x81CED7 mov edx, [esp+0x28]   ; = 入口 [esp+8] = imm32 → 期望校验和
0x81CEED mov esi, 0x3C
0x81CEFC add esi, [esp+0x24]   ; = 入口 [esp+4] = 模块基址 → esi = base+0x3C
0x81CF01 lodsw                 ; walker 主体（Task 009 已恢复）
```

校验和算法（walker `0x81D14C–0x81D186`）：对名字含 NUL 逐字节，状态寄存器 R（0xFFFFFFFF 起）低字节 XOR 数据字节后经 8 次右移（LSB 出位则 XOR `0x54495041`="APIT"）混回，末尾取反并 16 位半字交换。**注**：本地手工重实现校验失败（真值 `GetLocalTime=0xA817731A`），故弃用重实现、改用插桩地面真值法——结果即为定义性证据。

地面真值枚举量：kernel32 1669 / advapi32 853 / user32 1043 / ntdll 2517 个名字。

### 1.1 注册表集群槽位命名（修正 Task 011 §4）

| 槽 | API | 对既有记录的修正 |
| --- | --- | --- |
| `0x859CE5` | **advapi32!RegCreateKeyA** | "open-shape/RegOpenKeyA 族"→ 实为**创建**（键不存在则建立）；普通系统预期反转为"成功并创建 HKCU\Software\WinLicense" |
| `0x859CE1` | **kernel32!RegFlushKey** | "close-shape"→ 实为 flush（单 hkey 参数吻合） |
| `0x81A829` | **kernel32!RegSetValueExA** | 形状判断被证实 |
| `0x8191E9` | **kernel32!RegCloseKey** | 形状判断被证实 |
| `0x819C95` | **kernel32!RegQueryValueExA** | Task 011 的"未知第五槽"解决：集群还会**读**值 |

注：RegFlushKey/RegSetValueExA/RegCloseKey/RegQueryValueExA 在 kernel32 导出表命中（转发导出），RegCreateKeyA 在 advapi32 表命中——与"walker 按模块基址槽搜单一模块"的机制一致，命名以导出名为准。

### 1.2 驱动安装段 API 名单（全部命名）

`SetEvent`、`WaitForSingleObject`、`CreateEventA`（XprotEvent 命名事件的三件套）、`LoadLibraryA`/`FreeLibrary`/`GetProcAddress`（驱动段自持动态加载）、`GetEnvironmentVariableA`、`wsprintfA`（路径拼接 `%s\Oreans.vxd`）、`GetVersion`/`GetVersionExA`（9x/NT 分支与 Wine 判断辅助）、`CreateFileA`（通用文件：驱动文件读写）、`ExitProcess`、`DeviceIoControl`（与 `\\.\Oreans.vxd` 设备通信）、`advapi32!RegOpenKeyA`（**HKCU\Software\Wine 探针 @`0x861113`**——注意此处是真 OPEN 不是 CREATE）、`CloseHandle`、`Sleep`、`GetWindowsDirectoryA`、`GetFileSize`（Oreans.vxd 打开后查大小——现存驱动版本检查）。

完整调用点↔API 对照见 `resolver-api-dictionary.csv`（置信度：high——walker 校验和唯一性 + 字节直读调用形态）。

## 2. flag 槽写入者（Q16 解决）

解码后缓冲（解码器 A+B 应用后）中槽 `0x81BAB5/0x8191F1` 的 mov 形写入共 7 处：

```text
0x85A5E6  mov dword [slot 0x8191F1], 1     0x85A6C5  mov dword [slot 0x81BAB5], 1
0x85A6EE  mov dword [slot 0x8191F1], 1     0x85A740  mov dword [slot 0x8191F1], 1
0x85A769  mov dword [slot 0x8191F1], 1     0x85A773  mov dword [slot 0x81BAB5], 1
0x85A9AA  mov dword [slot 0x8191F1], 1
```

全部位于 decoder A 明文（`/getwlstatus /checkprotection /bugcheck …` 开关表区 `0x85A5D9–0x85A9AA`）内——**注册表集群与驱动段 thunk 只在特定命令行开关下激活**；正常启动（无开关）两槽恒零、集群整体跳过，与 replay 观测一致。解读：集群是 WinLicense 的**诊断/状态开关路径**（`/getwlstatus` 等），非常规执行路径——这解释了为什么它被设计成"跳过"而不是"执行失败"。

## 3. round-3 同族盲测（负结果，Q15 部分回答）

对 T2 块 `0x862000–0x911B25`（~700KB 编码区）逐一施加已知常数（r1 的 xor/add/xor、r3 的 add/add/xor、decA 的 key/sub、decB 的 add/xor/add，共 11 个单操作变换）：熵全部停在 ~7.95、无 `55 8B EC` 群涌现、ASCII 计数无显著变化。**结论**：该区不复用任何已见变换常数；解码器 C（若存在）用新常数或非 XOR/ADD 类变换（或为 aPLib 类解压）。盲测代价已付，此路不通。

## 4. VxD 载荷结构

`0x85B405`（解码后）：

| 字段 | 值 |
| --- | --- |
| DOS 头 | `MZ`，e_lfanew `0xB0` |
| 签名 | `LE` @`0x85B4B5`（Linear Executable / VxD） |
| CPU / OS | `0x02`（386+）/ `0x04`（Windows VxD） |
| 页 | `0x14` 页 × `0x200` + 尾页 `0x1C0` → 总大小 `0x27C0`（~10KB） |
| 对象表 | 1 个对象：size `0x27C0`、flags `0x2045`（RW+执行）、pagemap 1 |
| 设备名 | `XPROTVXD` @ LE+`0x12D`（DDB 内） |

即：驱动安装段把这段 ~10KB 的 `XPROTVXD` VxD 写到 `%s\Oreans.vxd`（`GetWindowsDirectoryA` + `wsprintfA`），再经 `CreateFileA("\\.\Oreans.vxd")` + `DeviceIoControl` 与之通信；失败时走 SCManager/`CreateServiceA`（`oreans32.sys`/`oreansx64.sys`）的 NT 路线。`XprotEvent` 命名事件用于进程间协调。

## 5. 综合更新到保护链（探针前→驱动段全图）

```text
T1 → T2 → T3 → round1 → round2 → round3(0x8593E3 解码探针集群区)
  → SICE/SIWVID/NTICE 三探针（CreateFileA，共享检测边 0x859A61）
  → [miss] flag 分发（开关决定；无开关=全跳过）
  → 五个 'R' 门 resolver：RegCreateKeyA/RegFlushKey/RegSetValueExA/RegCloseKey/RegQueryValueExA
  → decoder A（开关表）→ decoder B（驱动安装段明文）
  → 驱动安装段 0x85FCC0：
       事件三件套 / 动态加载 / 版本与环境（GetVersionExA、HKCU\Software\Wine 探针）
       CreateFileA("\\.\Oreans.vxd") + GetFileSize → 已装检查
       失败→ 写 %s\Oreans.vxd（内嵌 XPROTVXD VxD 10KB）→ DeviceIoControl
       NT 路线 → OpenSCManagerA/CreateServiceA/StartServiceA（oreans32.sys/oreansx64.sys）
  → 0x862000+（~700KB）仍编码，无已知常数可解 —— 静态边界
```

## 6. 未决（移交后续）

- Q15（`0x862000+` 解码轮）：盲测排除已见常数族；下一步只能靠运行态推进（VM）或对 aPLib 类解压特征做窗口外分析（T2 之前区域）。
- 集群在开关激活时的完整行为（哪些开关映射哪些单元）——低优先（非常规路径）。
- `\\.\oreans32` 系列 NT 路线的具体调用序列（walker 前缀字典已就绪，后续任何 imm 都可即时命名）。

## 8. 追记（会话 2 续）：探针前 resolver 调用全录与 wrapper 管线证实

第三次 replay（`scripts/maple079_walker_log.py`，walker 入口 `0x81CEC7` 钩子）记录探针前**全部 5 次**解析调用：

| # | 模块 | imm=校验和 | 命名 | walker 返回地址 |
| --- | --- | --- | --- | --- |
| 1 | kernel32 | `0xD9DA1CE9` | LoadLibraryA | `0x857E4A`（wrapper 形态） |
| 2 | kernel32 | `0xD9DA1CE9` | LoadLibraryA | `0x857E68`（wrapper 形态） |
| 3 | kernel32 | `0xA817731A` | GetLocalTime | `0x857E7C`（wrapper 形态） |
| 4 | user32 | `0xA43576A8` | **MessageBoxExA** | `0x8594FF`（直接形态） |
| 5 | kernel32 | `0xBC8E6EFC` | **CreateFileA** | `0x8595E7`（直接形态） |

- **wrapper（`0x821750`）管线证实**：`push imm(描述符); jmp` 形态下 wrapper 链把描述符（游标 = imm+`0xF97D9014`，指向调用点内联数据）解码为校验和、补推模块基址后调 walker。§1 的"直接形态 imm=校验和"结论不变；wrapper 形态是"描述符→校验和"的间接层（此前微仿真提前 RET 的根因=未给 walker 模块基址）。
- **CreateFileA 解析点定位**：`0x8595E7`（round-3 明文区），解析后 EAX 携带至 SICE 调用 `0x859757`——补齐 Task 009"EAX 已持有 CreateFileA、无槽位写入"的来龙去脉。
- 字典升至 **25/25**（含 `0x8594FF/0x8595E7` 两新条目）；工具链：`maple079_walker_log.py`（replay+钩子）+ `maple079_checksum_table.py`（命名）。

## 9. 复现

```text
python glm-work/scripts/maple079_wide_capture.py      # 探针停点宽捕获（前置）
python glm-work/scripts/maple079_walker_log.py        # replay + walker 入口日志（探针前解析全录）
python glm-work/scripts/maple079_checksum_table.py    # walker 插桩地面真值 → resolver-api-dictionary.csv
```
