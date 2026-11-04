# Task 012c — 解码器 C 狩猎与墙外静态地图（Q15/Q4 静态攻坚）

> 执行日期：2026-10-12（glm-work 会话 4）
> 客户端 SHA-256：`5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`（脚本自检通过）
> 输入：`glm-work/scratch/tailb-wide-at-probe.bin`（本会话第四次 replay 宽捕获重生成；probe window 与 `.work/task-009/probe-window.bin` 逐字节一致；2,409,207 条指令、rounds/ztl/tail_a 与既有记录全部吻合）；`.work/task-006/tail-b-nonzero.bin`；`.work/task-009/*`
> 工具：`glm-work/scripts/maple079_decoder_hunt.py`、`maple079_beyond_wall.py`、`maple079_thunk_names.py`（本会话新增）
> 产物：`task012c-cross-boundary-refs.csv`、`task012c-transform-clusters.csv`、`task012c-summary.json`、`beyond-wall-island-map.csv`、`beyond-wall-thunk-tables.csv`、`beyond-wall-thunk-names.csv`、`task012c-beyond-wall-summary.json`、`task012c-thunk-names-summary.json`、`task012c-encoded-entry-map.csv`（本文件 §3 的策展表）
> 边界遵守：replay 停在未应答的 CreateFileA（第四次复跑）；所有解码/仿真离线施加于捕获副本；不 patch、不注入 API 返回值、不伪造 protector 内部状态。

---

## 0. 摘要

1. **Q15 前提修正（本任务最重要发现）**：`0x862000–0x911B25`（~700KB）在探针停点**不是整体编码**，而是**明文岛 + 编码区混合**：40 个岛共 74,496 字节（10.3%，256B 块分类，填充页已剔除）的 protector 代码/数据在停点即可读。Task 012b 的"全区盲测"方法论因此失效——把常数变换施加到全区会把明文岛打烂、熵不降，这正是当时全部负结果的成因。
2. **编码区入口图（M2 延伸）**：驱动安装段通过**槽位门控 + 无条件 jmp** 把控制交给编码区三个入口（`0x862D7D`×4、`0x862D80`×2、`0x8620C6`×1）；walker 区与墙外岛共 10 处引用编码函数 `0x86B299` 并使用其返回值。门控槽的写入者全部定位（`0x86118E`/`0x8609D1`）。
3. **canonical EBP 不变量（结构性新知）**：全部墙外模块的 `sub ebp, imm32` 基址设置都把 ebp 归一化到同一规范基 **0xF93D9014**（RVA 空间；0x87579C−0x749C788、0x87624D−0x749D239、0x86378B−0x748A777 三例字节直算验证）——`formed()` 公式对整个 Tail B（含岛）全局有效。
4. **解码器 C 生产者：确定性负结果**。生产者模板匹配器以 4 个已知轮（round1/round3/decA/decB）为地面真值全部命中，随后：可读面 5 个新簇候选经重对齐全部证伪（真身分别为字符串扫描循环、slot 操作、常数构造 gadget 链）；岛内补充扫描 593 个 imm-op / 150 簇 / **循环内变换簇 0 个**。结论：解码器 C 的生产者不在任何停点可读面内。
5. **wrapper thunk 全录（383 项）**：`push imm32(描述符); jmp 0x821750` 形态的 resolver thunk，372 项在墙外、11 项在可读区——已全部登记（`beyond-wall-thunk-tables.csv`）。静态命名尝试：真 wrapper + 真 walker + 真导出表离线仿真机制成立，但 **0/383 真实命名**（3 个捕获是 wrapper 错误路径内部解析 ExitProcess 的伪捕获）——wrapper 在停点态早退（eax=0xE），依赖正常路径建立的运行态。**精确 blocker 已登记**。
6. **Q4 维持零引用**：全可读面（含岛）对 Tail A / Ztl / packed-raw 的 formed 引用与数据指针候选全部为噪声底（Task 012 在探针窗口的结论推广到全表面）。

## 1. 复现门槛

| 门槛 | 结果 |
| --- | --- |
| 客户端 SHA-256 | `5d280cf1…0f4d` ✓ |
| 第四次 replay probe window | 与 `.work/task-009/probe-window.bin` 逐字节一致 ✓ |
| 停点指令数 / rounds / ztl / tail_a | 2,409,207；r1 7283、r2 6809；ztl 三槽全零；tail_a=false ✓ |
| 解码器 A/B 离线重放（宽缓冲） | span1（仅 A 后）`4ddbdf0e…ff47` ✓；span2（A+B 后）`d6cfe6b9…4172` ✓ |
| round3 全 span 验证 | 6537/6537 dword ✓ |
| thunk 模式门槛 | 可读区 3 个已知 wrapper 站点被 `push imm;jmp 0x821750` 模式重新捕获 ✓（注：见 §5 勘误——"训练对"的原始提法有误，门槛仅证明模式提取器正确） |

## 2. 墙外结构：明文岛（Q15 前提修正）

### 2.1 岛图

256B 块分类（熵 < 5.5，或 call+$+5/pushal-popal/0x07-MSB disp 密度 ≥ 3，或高可打印率低熵；同字节填充页 > 98% 剔除）。产物 `beyond-wall-island-map.csv` / `task012c-beyond-wall-summary.json`（含每岛字符串、EBP 基、转移区直方图、prologue/call5 计数）。

要点：

| 岛 | 大小 | 内容判读 |
| --- | --- | --- |
| `0x862000–0x864000` | 8KB | **WinLicense 检查点统计/异常对话框**：字符串 `Exception Information`、`Please, contact the software developers with the following codes. Thank you.`、`(press CTRL+C on this window to copy to clipboard)`、**`CheckIN  = %d` / `CheckOUT = %d` / `ProcIN   = %d` / `ProcOUT  = %d` / `ExitIN   = %d` / `ExitOUT  = %d`**——与 Task 011 注册表集群的 CheckOUT 等值名直接对应；含 `0x862D7D`/`0x8620C6` 入口与 `0x86379B` 空 thunk 族 |
| `0x875600–0x878900`（4 岛） | ~12.6KB | protector 代码（局部 EBP 基链）；`0x8776DC`/`0x8785CC`/`0x87860B` 调用编码函数 `0x86B299` 并把结果存槽后带 4–5 参再调用（参数样例 `(0x1000D, esi>>12, 2, 0, 0x20040000)`） |
| `0x87F600–0x88AA00`（12 岛） | ~44KB | protector 主体代码延续（每岛 1–3 个 EBP 基） |
| `0x8E1600`/`0x8E4D00`/`0x8EE300`/`0x8F1300`/`0x8F4700` | ~2KB | **wrapper thunk 表**：`push imm32; jmp 0x821750` 每 10 字节一项 |
| `0x8C3200–0x8C3400` | 512B | `sub 0x2D0D4B3C` 近似常数重复 ~20 次——**数据表特征**（delta/键表），非代码 |
| 其余 16 个小岛 | 0.25–2KB | 零散代码/数据片段 |

### 2.2 canonical EBP 不变量

墙外每个 ~4KB "模块"以 `call $+5 / pop ebp / sub ebp, imm32` 建帧。字节直算三例：

```text
0x87579C - 0x0749C788 = 0xF93D9014
0x87624D - 0x0749D239 = 0xF93D9014
0x86378B - 0x0748A777 = 0xF93D9014
```

即所有模块把 ebp 归一化到规范基 0xF93D9014（RVA 空间；等于 stage-2 经典基 0x81C6CF−0x74436BB）。**推论**：`formed(disp) = 0xF93D9014 + disp`（RVA）对整个 Tail B 全局有效——本任务所有墙外 disp 解析因此与可读区同一公式（wrapper 自身的 edi 基是 VA 空间的 0xF97D9014，即 +0x400000，同一常量的 VA 形态）。

### 2.3 编码区密钥流排除

对最大编码拉伸（`0x8C6B00–0x8E1600` 107KB、`0x8A5500–0x8BAD00` 86KB、`0x8F4B00–0x906A00` 72KB、`0x8E4E00–0x8EE300` 37KB）做周期自相关（P=1..32）：最佳匹配分数 0.012–0.024（随机基线 0.0039），弱峰聚在 12/16/20/24/28/32（4 字节族）但无干净短周期。**结论：编码区不是短周期 XOR/密钥流**；`0x86B299` 附近的 `11 b6 5b` 周期 8 重复是局部数据现象而非全局密钥。解码器 C 更可能是新常数的（可能有状态的）dword 变换或解压，与 Task 012b 判断一致，但其"盲测"需改为只对编码子区施加并以岛为对照。

## 3. 编码区入口图（策展表 `task012c-encoded-entry-map.csv`）

| 入口 | 来源 | 门控/用法 | 备注 |
| --- | --- | --- | --- |
| `0x862D7D` | jmp ×4（`0x8611F0/0x8616C9/0x86174A/0x861BDD`，全在驱动段） | 0x861B95 臂：`cmp [slot 0x81C1A5],0 / jne 0x861BDD`；槽由 `0x86118E mov [slot],1` 写入，条件是 `word [formed(0x7486BC6)] == 9`（一次跳过条件 `eax==0xC00B0744` 的调用之后） | 目标字节 `c3`（ret，返回式入口）；slot 0x81C1A5 在驱动段内另有 11 处 cmp（其中 4 处在墙外岛，如 `0x86230F/0x8624E2/0x862909/0x863BCF`——正是这些 disp 命中暴露了岛的存在） |
| `0x862D80` | jmp ×2（`0x860FF8/0x861146`） | 无条件 | 目标 = `lea eax,[ebp+0x7489F05]` 岛代码 |
| `0x8620C6` | jmp ×1（`0x861C0B`） | `cmp [slot 0x81B96D],0 / je`（0x861BA8）；槽由 `0x8609D1 mov [slot],1` 写入 | 目标岛内是 **7 参 CreateFileA 形状配方**（`push 0xC0000000` 等可见）——又一个设备/文件打开点 |
| `0x86B299` | 可读区 5 处 `lea eax,[ebp+0x7492285]`（0x81E962/0x81EFDB/0x81FE58/0x81FED5 直接 `call eax`；0x81EA58/0x81EE94/0x81F364 作参数）；墙外岛 3 处 `call eax`（0x8776DC/0x8785CC/0x87860B） | 岛调用者把返回值存槽 `formed(0x74411E1)`/`formed(0x7440195)` 后带 4–5 参再调用 | 目标字节停点仍编码（`11 b6 5b` 重复区）——**墙外核心函数，解码后调用**；disp 0x7492285 共 10 次出现（全部在 canonical 基下解析到同一地址） |
| `0x86379B/0x8637A5/0x8637AF` | 可读区 6 处 lea | `pushal; popal; ret 8` 空 stdcall thunk（明文岛内） | 不是编码目标；thunk 表机制的一部分 |

噪声模型：全表面链扫描共产出 1,438 个引用行 + 6,850 个对齐数据指针候选，其中编码区直接转移 23 个、Tail A 23 个、tpuaozxc 3 个——除上表策展项外全部为单次出现 + 乱指令上下文（`fstp`/`comiss`/`int 0x86`/`loope` 等）的错位噪声（同目标 ≥2 次重复是真实信号的判别式，随机噪声打中同一 700KB 内目标的概率可忽略）。

## 4. 解码器 C 生产者搜索：负结果定案

1. **匹配器地面真值**：模板（≥2 个 `add/sub/xor reg32,imm32(≥0x1000)` 于 0x40 字节窗口 + 回边循环）在停点可读面重找全部 4 个已知生产者（round1 `0x81CE47`、round3 `0x8593A1`、decA `0x85A464`、decB `0x85AA35`）✓。
2. **可读面新簇 5 个全部证伪**：
   - `0x81EB43`/`0x8203AB`：重对齐后真代码是字符串扫描循环（`cmp byte [eax],0 / jne`）与 slot 操作序列，imm 命中来自错位字节；
   - `0x857916`/`0x858219`/`0x8589DA`/`0x85AB6D`：真身是**常数构造 gadget 链**（`mov edx,imm; jmp; or edx,imm; push 0; sub [esp],edx; pop edx` 等）或不可对齐残片，非数组变换。
3. **岛内补充扫描**：593 个 imm-op、150 个簇、**循环内变换簇 0**。
4. **结论（high 置信）**：解码器 C 的生产者不在停点可读面（可读区 + 全部岛）内；它自身位于编码区（鸡生蛋链的一环由正常路径在探针之后解开）。静态推进在此边界上的剩余路径只有 §5 的描述符算法逆向或 VM 自然观测。

## 5. wrapper thunk 表全录与静态命名尝试（012d 预研）

- **清单**：`push imm32; jmp 0x821750` 全 Tail B 共 **383 项**（可读 11 + 墙外 372），`beyond-wall-thunk-tables.csv`。描述符游标 = imm + 0xF97D9014（VA）指向 thunk 附近内联数据（例：imm 0x0747EF76 → RVA 0x857E8A，落回 thunk 表自身区域）。
- **机制验证**：离线 Unicorn 映射宽捕获 + 四个真实系统 DLL，以真 walker（0x81CEC7）失败搜索法重建 6,017 项校验和字典（kernel32 1669 / advapi32 853 / user32 1043 / ntdll 2517，与 Task 012b 一致）；对每个 thunk 以 `[esp]=imm` 进入真 wrapper（0x821750）。
- **结果**：0/383 真实命名。全部 383 次运行要么早退（wrapper 走到墙外岛 `0x879xx` 后返回 eax=0xE，不调用 walker），要么 FAULT；仅有的 3 次 walker 捕获是**同一校验和 0x8E726969（kernel32!ExitProcess）**——wrapper 自身错误路径的内部解析，非 thunk 目标。
- **blocker（精确）**：wrapper 的描述符→校验和管线依赖正常路径（探针之后）建立的运行态（内部槽/缓存），停点态不满足。伪造该状态属于"逼探针走某一边"的同类操作，按边界不做。
- **勘误（对 E.6 / STATUS 会话 2 续）**："`0x857E4A–0x857E86` 五个训练对"的说法不准确——walker-log 的 ret 地址 0x857E4A/0x857E68/0x857E7C 是 **slot-form 调用的返回点**，紧随其后的 `push imm; jmp wrapper` 是跳转表条目（真实执行经计算跳转进入，不走顺序流）。wrapper 管线的证实结论本身不受影响（E.6 的第三次 replay 观测仍有效），但"训练对"不能用于静态仿真的正确性门槛。

## 6. Q4（Tail A materializer）状态

全可读面（含岛）formed 引用与数据指针候选对 Tail A / Ztl / packed-raw 维持噪声底（策展 0 项）。Q4 不变：materializer 未在任何停点可读面出现；最大候选位置仍是编码区深处或 packed raw 的消费者（其触发点在解码之后）。

## 7. 方法论沉淀

1. **混合区域分析规则**：对"疑似整体编码"区域先做 256B 块可读性分类（熵 + gadget 密度 + 0x07-MSB disp 密度），变换盲测只施加于编码子区并以岛为对照——避免 Task 012b 式假阴性。
2. **同目标重复判别式**：混淆代码的错位反汇编产生大量假引用；"同一目标 ≥2 个独立来源"是廉价可靠的信号过滤器（本任务 0x862D7D/0x86B299 均由此浮出）。
3. **canonical EBP 不变量**：跨模块 formed() 解析只需一个公式；未来任何墙外 disp 批量解析直接可用。
4. **wrapper thunk 静态命名路线**：机制与工具链已就绪（本会话 `maple079_thunk_names.py`），差一个运行态前提——VM 自然观测跑过正常路径后，同一工具换用 VM 停点态即可全量命名 372 项。

## 8. 未决问题回填与新增

- Q15：**部分回答**——编码区=混合结构（10.3% 岛）；无短周期密钥；生产者不在可读面（定案）；下一步=描述符算法逆向（静态）或 VM（运行态）。
- Q4：维持开放（零引用，全表面复核）。
- 新增 **Q18**：岛的精确语义（哪些是 WinLicense 检查点/异常 UI、哪些是 resolver/协调逻辑；`0x86B299` 函数族的用途）。
- 新增 **Q19**：wrapper 描述符→校验和算法的纯静态逆向（wrapper 0x821750 全程在可读区，理论上可人工恢复其状态依赖并判断哪些依赖是正常路径产物）。
- 新增 **Q20**：383 项 thunk 的命名（VM 态一次全量）。

## 9. 复现

```text
python glm-work/scripts/maple079_wide_capture.py       # 第四次 replay + 宽捕获（门槛：probe window 逐字节一致）
python glm-work/scripts/maple079_decoder_hunt.py       # 跨界引用/生产者模板/门槛校验 → task012c-*.csv/json
python glm-work/scripts/maple079_beyond_wall.py        # 岛图 + 普查 + thunk 表 → beyond-wall-*.csv/json
python glm-work/scripts/maple079_thunk_names.py        # thunk 静态命名尝试（0/383，blocker 见 §5）
```

环境：Python 3.14.4 / Capstone 5.0.7 / Unicorn 2.1.4 / pefile 2024.8.26；kernel32 = 本机 SysWOW64（SHA `bafd9e06…68f3` 与 replay 记录一致）。
