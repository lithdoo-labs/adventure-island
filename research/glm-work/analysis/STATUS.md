# glm-work 进度状态

> 更新：2026-10-12（会话 4）
> 路线图：`research/glm-work/reverse-engineering-plan.md`（v1.0 + 附录 E）
> 边界：只创建/修改 `research/glm-work/` 内文件；产物路径按 prompt.md 映射（`research/glm-work/result/`、`research/glm-work/scripts/`、`research/glm-work/analysis/`）
> **2026-10-11 边界变更记录**：应用户显式指示，`research/glm-work/result/` 的 16 个产物已逐字节同步（SHA-256 校验一致）到仓库 `research/result/`——这是对 prompt.md"只改 glm-work"约束的一次性放宽，仅限此次拷贝；未执行任何 git add/commit/push。脚本仍在 `research/glm-work/scripts/`（glm-work 被 .gitignore，如需入库需另行同步到 `research/scripts/`）。

## 当前状态

**Task 012c（解码器 C 狩猎 + 墙外静态地图）✅（会话 4）**。此前：Task 011/012/012b ✅、轨道 A 两轮 ✅、轨道 B ✅、Task 022 ✅、Q11 ✅。主线下一推进点不变：Task 013（VM，阻塞）或 Q15 新思路（见下）。

### 会话 4 增量（详见 `research/glm-work/result/10c-decoder-c-hunt.md`）

- **Q15 前提修正（重大）**：`0x862000+` 不是整体编码——**40 个明文岛共 74,496 字节（10.3%）**在探针停点即可读（`beyond-wall-island-map.csv`）。墙根岛 `0x862000–0x864000` 含 WinLicense 检查点统计/异常对话框字符串（`CheckIN/CheckOUT/ProcIN/ProcOUT/ExitIN/ExitOUT = %d`、`Exception Information`）。**Task 012b 全区盲测的方法论缺陷由此定案**（变换会把岛打烂）。
- **canonical EBP 不变量**：全部墙外模块 `sub ebp, imm32` 均归一化到规范基 **0xF93D9014**（三例字节直算验证）——`formed()` 对整个 Tail B 全局有效。
- **编码区入口图**：驱动段经槽位门控把控制交给 `0x862D7D`（4 处 jmp）/`0x862D80`（2 处）/`0x8620C6`（7 参 CreateFileA 配方岛）；门控槽写入者定位（`0x86118E`，条件 `word[formed(0x7486BC6)]==9`；`0x8609D1`）。walker 区+岛共 10 处引用编码函数 `0x86B299`（停点仍编码；岛调用者存其返回值后带 4–5 参再调用）。策展表 `task012c-encoded-entry-map.csv`。
- **解码器 C 生产者：确定性负结果**（high）：模板匹配器地面真值 4/4 命中后，可读面 5 新簇全证伪（字符串扫描循环/slot 操作/常数构造 gadget），岛内 593 imm-op、150 簇、**循环内变换簇 0**。生产者在编码区内（正常路径解开）。
- **wrapper thunk 全录 383 项**（372 墙外 + 11 可读，`beyond-wall-thunk-tables.csv`）；静态命名 0/383（真 wrapper+真 walker+真导出表离线机制成立；wrapper 停点态早退 eax=0xE，3 个捕获=错误路径内部解析 ExitProcess 的伪捕获）。**精确 blocker 登记**；工具 `maple079_thunk_names.py` 留待 VM 态一次全量。
- **勘误**：E.6"0x857E4A–0x857E86 五个训练对"提法有误（walker-log ret 地址是 slot-form 调用返回点；相邻 push/jmp 是跳转表条目）。
- 密钥流排除：最大编码拉伸周期自相关无干净短周期（弱 4 字节族峰）；`0x86B299` 附近周期 8 重复是局部数据现象。
- Q4：全表面（含岛）对 Tail A/Ztl/packed-raw 引用维持噪声底（0 策展）。
- 新脚本：`maple079_decoder_hunt.py`（跨界引用+生产者模板）、`maple079_beyond_wall.py`（岛图+普查+thunk 表）、`maple079_thunk_names.py`（thunk 命名器）。第四次 replay 复跑门槛全过（probe window 逐字节一致）。

## 下一步（按优先级）

1. **Task 012d 静态选项**：wrapper `0x821750` 描述符→校验和算法人工逆向（Q19）——wrapper 全程在可读区，若能把"停点缺失的运行态"限定为少数槽，仍可在不伪造状态的前提下判断静态可行性；同时用岛+编码子区的混合区域规则重跑变换盲测（§7.1 方法论）。
2. **Task 013（VM 自然观测）**：解除后即可 ① 验证 0x862D7D/0x8620C6 入口的真实走向，② 用 VM 停点态跑 `maple079_thunk_names.py` 全量命名 383 项 thunk（Q20），③ 追 0x86B299 函数族（Q18）。
3. 并行轨道（不阻塞）：ResMan 签名（Task 021 #4 遗留）、Base.wz ↔ List.wz 对应核对（E.7 遗留验证点）。

## 阻塞点

- 静态：解码器 C 生产者与 wrapper 完整语义都在停点不可读/不可满足的运行态之后（本会话已把边界精确化到具体入口与槽）。
- 环境：Smart App Control 拒 AspINet、无名对话框、无 VM 介质（Task 005/010 记录）不变。

## 未决问题回填（计划 §4.3）

- Q1 探针集群控制流/收敛：✅ Task 011。
- Q2 注册表集群语义：✅ Task 012b。
- Q3 探针后新解码轮：✅ round3+decA/decB（Task 012）；`0x862000+` 见 Q15。
- Q4 Tail A materializer：❌ 全表面零引用（本会话复核到岛）。
- Q11 List.wz：✅（会话 3）。
- Q14 task-011 起步脚本：✅。
- Q15 `0x862000+`：**部分回答**——混合结构（10.3% 岛）、无短周期密钥、生产者不在可读面（定案）；剩余=描述符算法逆向或 VM。
- Q16 flag 槽写入者：✅（开关解析器）。
- Q17 resolver 描述符字典：✅ 直接形态；**wrapper 形态 0/383（运行态 blocker，Q19/Q20 拆分）**。
- Q18（新）岛语义/0x86B299 函数族：❌ 待 VM 或解码器 C。
- Q19（新）wrapper 描述符算法静态逆向：❌（本会话已证停点态不满足，需人工判依赖）。
- Q20（新）383 项 thunk 命名：清单就绪，待 VM 态。

## 既有成果索引（按会话）

- 会话 4：`research/result/10c-decoder-c-hunt.md` + `task012c-*.csv/json` + `beyond-wall-*.csv/json`；scripts：`maple079_decoder_hunt.py`/`maple079_beyond_wall.py`/`maple079_thunk_names.py`。
- Task 012：`research/result/10-post-probe-stage.md`（M2=解码器 A/B+驱动段 `0x85FCC0`；round 3 定案；scripts：`maple079_post_probe_scan.py`/`maple079_wide_capture.py`/`maple079_write_logger.py`）。
- Task 011：`research/result/09-probe-cluster-full-cfg.md`（探针窗口 CFG/调用点全表 + 勘误；`probe-window-cfg.csv`/`probe-call-sites.csv`/`maple079_probe_cfg.py`）。
- 会话 2/3 增量见上文历史节（10b/19/20/trackB/listwz 等）。

### 对仓库既有结论的修正登记（仓库文件未动）

- Task 011：NTICE 测试/miss 边 RVA ×5 文件；WLkt 根键；`0x859EBE` 性质；集群值写形状。
- Task 012：span1 SHA 时点；"driver body 未走"；`\\.\oreans32` 引用点；探针前解码链缺 round3。
- Task 012b：全区盲测方法论（对混合区域失效——本会话定案）；"0x857E4A–0x857E86 训练对"提法（本会话勘误）。

## 历史会话增量（会话 3 及之前）

- **Q11 收口 ✅**：List.wz 完全解码——无独立头；记录=`[类型前缀][dword 名长][UTF-16LE 路径]`；加密=WZ AES 密钥流（私服 IV）**逐串从 0 连续异或**；**1,258 条外链 img 挂载表**（character 513/map 297/mob 184/…），零间隙覆盖全文件。产物 `listwz-entries.csv` + `research/scripts/maple079_listwz.py`。破题路径：密钥流相位扫描（16B"常量"在相位 0 解出 `characte`）。
- **成熟库接入**：wz-python（MIT，`.work/tools/`，commit `79344c9` 记录在案）——16 个 PKG1 归档全部解析、**version=79** 独立复核；内容级解析验证通过（TamingMob/0001.img 属性树）；客户端↔服务端 String.wz 条目集合一致。
- **私服 IV 定位**：`B9 7D 63 E9`（内置 EMS 值；BMS/GMS 双乱码对照）——后续 WZ 字符串/属性解码的必备参数。
- **目录树全量**：~36,000 张 img（Character 25,565 / Map 4,614 / Mob 1,617 / Npc 1,608 / Reactor 463 / Item 475 …）；Base.wz 15 个链接子目录与其余 15 个 WZ 文件**双向零差**（命名空间树投影验证）。产物 `wz-directory-index.csv`、脚本 `maple079_wz_dir.py`。
- **机制总图**：PKG1 内=固定 IV AES 密钥流（成熟库全覆盖）；List.wz=同一密钥流的逐串复位变体（已破）；NameSpace/PCOM 追的"按名键控"实为命名空间哈希桶机制（`h=h*32+c+1`），非字节密码。

### 会话 2 续增量

- **List.wz 序列化链追踪到底层**（NameSpace↔PCOM 跨 DLL 五跳）：入口 Open=`0x13729` → 宽名散列键 → PCOM 晚绑定（`LoadLibraryA("PCOM.DLL")`+GetProcAddress ×5，解循环导入；坐实 `WS2_32.DLL` 表项同类）→ `PcSerializeString(0x6411)`（键双字高位选路、低两字节=模式标志，`(key,~key)` 选方向）→ 实体 `0x64E3` → **读路径 `0x7575` 族（逐字节变换最终落点）**。修正两处中途误判（GUID≠主密钥、晚绑定≠密码表）。Q11 只剩最后一跃。
- **探针前 resolver 全录**（`research/scripts/maple079_walker_log.py`，第三次 replay+walker 钩子）：5 次解析全命名——LoadLibraryA×2 / GetLocalTime（wrapper 形态，描述符→校验和管线证实）、**MessageBoxExA（user32，`0x8594FF`）**、**CreateFileA（`0x8595E7`，round-3 明文区——SICE 探针 API 解析点定位）**。字典 **25/25**。
- **PKG1 头布局定案**（文件直析）：`"PKG1"` + dword(每文件异) + 0 + `0x3C`(头长) + 44 字节标识串 `Package file v1.0 Copyright 2002 Wizet, ZMS\0` = 0x3C 字节。
- **List.wz 结构起步**：`05 00 00 00` 头 + 记录流（`ac 52`+计数+16 字节固定签名 × ~370 条、变长载荷）；已知明文攻击（17 文件名 × 12 种简单变换）全部负——解码需反汇编读取封装（下一轮）。
- **NameSpace 挂载机制**（函数 `0x13070` 全解剖）：头校验=流对象虚方法 `[eax+0x18]`（thiscall 读 0x3C 字节，引用点 `0x137BA`）；`PKG%04x.tmp`=**GetTickCount 防冲突暂存文件**（`ERROR_ALREADY_EXISTS/FILE_EXISTS` 换号重试、`./` 回退；wsprintfA 为 IAT 实证，另 4 个 API 走 Wizet 自建 `0x1E7xx` 分发槽）；懒创建（`[this+0x14]==0` 触发）；COM HRESULT 错误纪律。~370 条 List.wz 记录=该暂存机制的输出对象之一（待读取封装反汇编后解码）。

### 轨道 A 成果（详见 `research/glm-work/result/19-wizet-dlls.md`，含第二轮 §4）

- 全 10 个未加壳 DLL 清单（`wizet-dll-inventory.json` + `resman-entry-points.csv`，工具 `research/scripts/maple079_wizet_dlls.py`）。
- 体系=COM 工厂 + PCOM 对象模型（`PcInitModule/PcCreateObject/PcRootNameSpace/PcSerialize*`）。
- **`List.wz` 消费方式定位**（Q11 推进）：PCOM `0x6CC7` 用 exe 目录拼接 `List.wz` 作为资源根；Canvas `0x20BC4` 同引。
- **PKG1 处理器在 NameSpace.dll**（`PKG1`+`Package file v1`+`PKG%04x.tmp`）。
- **WZ 解压链 Canvas→ZLZ 证实**；ZLZ 导出 C++ 签名直读（`ZIStream* ZLZCreateInflator(int,ZIStream*,uint)`）；PDB 路径含 **`ztl`**（官方库词根，连上 ZtlTaskMem*）。
- RTTI 真类名实测（CWzCanvas/CWzRawCanvas）→ RTTI 命名路线可行。
- **WzMss=官网 SOAP 客户端**（负结论：与游戏服协议无关，作种子反判别器）；`PWS2_32.DLL` 定性=序列化组件表条目（九 DLL 全无延迟导入）。

### 轨道 B 成果（详见 `research/glm-work/result/trackB-seed-readiness.md`）

- 仓库 derived 种子表核对合格（Q13 ✅）；本会话补：就绪度对接文档 + 种子扫描器 `research/scripts/maple079_seed_scan.py`（冒烟通过：探针窗口 0/33 命中，符合预期）+ 三条新判别器（WzMss 反判别、ztl 词根、RTTI 可行性）。

### Task 012b 成果（详见 `research/glm-work/result/10b-static-extension.md`）

- **resolver 字典 23/23**（`resolver-api-dictionary.csv`）：直接调用形态的 imm32 即名字校验和（助程 `0x81CEC7` = walker 入口，`edx=[esp+0x28]`）；地面真值法=真 walker 插桩（钩 `0x81D13C/0x81D184`）枚举 kernel32 1669/advapi32 853/user32 1043/ntdll 2517 名。工具：`research/scripts/maple079_checksum_table.py`。
- **注册表集群五槽命名**：`0x859CE5=RegCreateKeyA`（创建！）、`0x859CE1=RegFlushKey`、`0x81A829=RegSetValueExA`、`0x8191E9=RegCloseKey`、`0x819C95=RegQueryValueExA`——Task 011 形状级判断两处被推翻，干净系统预期反转（创建成功）。
- **Q16 解决**：flag 槽 `0x81BAB5/0x8191F1` 的 7 个写入点全在**命令行开关解析器**（`0x85A5E6–0x85A9AA`，`mov dword [slot],1`）——集群/驱动段 thunk 仅由开关激活，自然路径恒跳过。
- **驱动段 API 名单全解**：事件三件套（XprotEvent）、DeviceIoControl、`HKCU\Software\Wine` 探针=真 RegOpenKeyA、GetWindowsDirectoryA/GetFileSize（Oreans.vxd 已装检查）等。
- **Q15 盲测负结果**：11 个已见变换常数对 `0x862000+`（~700KB）全部无结构涌现；解码器 C 不复用已知常数。
- **VxD 载荷**：`0x85B405` = 386/VxD LE、~10KB（0x27C0）、单对象、设备名 `XPROTVXD`——写入 `%s\Oreans.vxd` 的本体。

- Task 012：span1 SHA 时点（解码器 A 后中间态，B 会改写重叠区 `0x85AA4B–0x860293`）；"driver body 未走"；"`\\.\oreans32` callsite unresolved"；探针前解码链缺 round3。

## 历史会话增量（会话 3 及之前）

### 会话 3 增量（详见 `research/glm-work/result/20-wz-inventory.md`）
