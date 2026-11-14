# T084.1 — Gr2D Slot25 Candidate Completeness & Readiness Scope Reconciliation

**Round**: t084.1 (2026-11-15) — 静态逆向补充验证 / 研究台账纠正 / 需求矩阵一致性修复轮。
**Branch**: `research/t084-1-slot25-scope-reconciliation`（自 t084 基线 `cdbe55ee2a1d8bbc8ceeef3fc3d66e864b56749f` 创建）。
**Binary identity**（本轮分析前重新核验，分析后再次核验，见 §E）：
- EXE `.work/task-036/game-image-unpacked.bin` SHA-256 `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718`（flat，VA = file + 0x400000）
- Gr2D `.work/task-001/extracted/冒险岛online/Gr2D_DX8.dll` SHA-256 `ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1`（PE，ImageBase 0x50400000）
- PCOM `.work/task-001/extracted/冒险岛online/PCOM.dll` SHA-256 `cf3807f3107152d3b305bfc84be36d58b62306c94f60133c8e80fd17f9d9e54b`（PE，ImageBase 0x50C00000；本轮新引入的镜像）

**任务**: T084.1（slot25 候选完整性验证、IID→[0xBE2788] 身份链、C-082 穷尽结论纠正、P3-13 就绪范围审计、P4-06/P4-07 矩阵一致性、C-083 措辞收紧、独立 Review 与全部质量门禁）。

---

## 1. 执行摘要

t084 的 P3 包断言"slot25 静态候选集已穷尽（2 个）且均不满足生产路径约束 → 运行时绑定必为静态表外的 put-with-object-out"。**本轮证伪了该结论**：

1. EV-72 自己 dump 出的第三候选——inner vtable `0x5042D224` slot25 = `0x5040418C`——在 t084 从未被分析（报告仅一句"large body, VARIANT marshalling"带过）。本轮完整反汇编（1748 字节 / 597 条指令 / SEH / `ret 0x3C`），发现它是**唯一满足生产路径全部约束**的候选：生产调用点 `0x427EB3` 压栈恰好 15 个 dword（this + 5 标量 + 2 个按值 VARIANT + 1 个 VARIANT\*），与 `ret 0x3C`（15×4）**栈形状精确匹配**；其 arg15 出参在 `0x504045CB` 被 E_POINTER 守卫并写入**包装对象指针**——正是 t084 宣称"静态表中不存在"的 put-with-object-out。
2. **独立 Review 轮的结构复核（已并入）**：EV-72 的三个"表"是**同一连续 dword 块的重叠窗口**——t084 所列两个"候选"实为**幽灵槽**：`0x5042D204` 是 3-entry IUnknown 表（"outer slot25"不存在，`[0x5042D268]`=`0x50404E85` 实为 inner slot17）；`0x5042D140`/`0x5042D210` 是 5-entry thunk 表（"layer-table/mid slot25"不存在，`[0x5042D1A4]`=`0x50403FBE` 实为 class-2 长表 slot20、`[0x5042D274]` 实为 inner slot20）。**Gr2D 存在第二张长表 `0x5042D154`**（class-2，QI `0x504013CA` 走**共享** intmap `0x5042D1E0`），其 slot25 `@0x5042D1B8` **同为 `0x5040418C`**——生产匹配对两个类不变。EV-72 的字节本身全部准确（此前草案声称的"off-by-one 数据缺陷"经复核不成立并已撤回）。
3. IID `{E576EA33-D465-4F08-AAB1-E78DF73EE6D9}`（由 16 字节定义；任务提示中的分组写法为同一字节的非标准转写）在 EXE `0xBA0570` 与 Gr2D `0x50435120` **字节级相同且各只出现一次**（Review 轮对全部 22 个游戏目录 DLL 扫描确认仅 Gr2D 携带）；工厂全局 `[0xBE1FB0]` = **PCOM.dll!`PcCreateObject`**（GetProcAddress 按名解析）；Gr2D QI(E576EA33) 经共享 intmap `{piid, dw=0, simple}` 返回**长表接口指针**（class-1 inner `0x5042D224` 或 class-2 primary `0x5042D154`，两者 slot25/slot3/slot20 相同）；EXE 初始化器对 `[0xBE2788]` 的首批槽调用（slot3(800,600) 设备初始化、slot20(0xFF000000) 颜色 setter）**只有长表 vtable 兼容**。静态推导：`[0xBE2788]` = E576EA33 接口指针（二 vtable 预测）；最终 PCOM 注册表绑定确认为运行时缺口（G24 捕获从"三选一判定"改为"确认命名预测"）。
4. 附带纠正三处 t084 交付物缺陷：T084 报告 §4"slot45 always go through the same global"与 C-075/EV-59 原始证据不符（slot45 调在 slot25 **返回对象**上）；"[this+0x128]"不属于 0x5040418C（属 slot26/27/28 的集合族）；C-083 的"per-handler-object registration"机制断言与"binding established by runtime registration data"超出证据（碰撞只证数字复用）。

**台账动作**：C-082 就地修正（穷尽结论撤回、幽灵槽归位、两个函数体事实保留）；新增 C-086（生产 slot25 定身，CLOSED-STATIC）、C-087（IID 身份链，PARTIAL-STATIC）；G27 **关闭**（CLOSED-STATIC）、G24 重定义、G10 边界有界化重述、G38 措辞收紧并补全 census；C-083 负结论限定到已检查模式并移除机制推断；矩阵 P1-09/P4-06/P4-07 修正；P3-13 经审计自洽、不修改。

---

## 2. P0 — Slot25 三候选完整分析

### 2.1 `0x5040418C` 完整函数体（EV-74）

- **边界**：`0x5040418C..0x5040485D`（1748 字节，597 条指令；SEH prologue `mov eax,0x5042AF42; call 0x5042A5F0`；epilogue `ret 0x3C`）。
- **调用约定**：stdcall COM 风格，**15 个栈参数**（`ret 0x3C` = 60 字节）。
- **参数表**（callee 视角）：

| 位置 | 内容 | 依据 |
|---|---|---|
| `[ebp+8]` | `this`（inner subobject） | `mov edi,[ebp+8]` @`0x504041B6` |
| `[ebp+0xC..0x1C]` | 5 个 dword | @`0x50404228-0x50404236` 原样转发给 thiscall helper `0x50409922`（含 `edi`=this） |
| `[ebp+0x20]` | VARIANT **按值** #1（16 字节） | @`0x5040423E`：vt 与 0（VT_EMPTY）/0xA（VT_ERROR）比较；经 `0x5040517C`（VariantChangeType 包装，BSTR 特判）先转 VT_UI4(0x13)、失败改 VT_UNKNOWN(0xD)（即拷贝） |
| `[ebp+0x30]` | VARIANT **按值** #2（16 字节） | @`0x504041D5`：vt==VT_EMPTY/VT_ERROR → `esi=-1` 快路径 |
| `[ebp+0x40]` | **VARIANT\* 出参** | @`0x504041A0`：NULL → E_POINTER；@`0x504045C1-0x504045CB`：`*arg15 = [ebp+8]`（局部包装对象指针，由 ctor `0x50405846` 初始化、helper `0x50409922` 填充） |

- **返回值**：HRESULT——成功 S_OK（`xor eax,eax` @`0x504045E4`）；`arg15==NULL` → `0x80004003`；`[this+0x90]==0` → `0x80004005`（E_FAIL）；VARIANT 双重转换失败 → `0x80070057`（E_INVALIDARG）。
- **`[this+0x90]` 语义**：设备对象。生产者 = inner slot3 `0x504030D3`（设备初始化：width/height 非零守卫、flags `test [ebp+0x15],0x40`、`[this+0x98]` 保存参数、创建 D3D 侧对象写入 `[this+0x90]`、`[this+0xA0]=1` 收尾）——正是 EXE 初始化器 `0xA00E5E` 创建后直调的 `[[0xBE2788]+0xC](0x320, 0x258)`（800×600）。slot25 的 E_FAIL 守卫与 slot3 的设备写入是**同一字段的写读闭环**：slot25 是需要已初始化设备的资源创建/注册操作。
- **`[this+0x128]` 不在本函数**（t084 报告措辞缺陷）：`+0x128` 位移只出现在 slot26/27/28（`0x50404ECA`/`0x50404EE9`/`0x50404F05`，对 `[this+0x128]` 集合的 contains/add/count thin wrapper 族）及 slot3 邻域 `0x504035DF`。语义图像：引擎类把设备放 `+0x90`、把节点集合放 `+0x128`；slot25 创建节点，slot26-28 管理集合。
- **VARIANT 行为全链**：构造（EXE 侧 `0x40318F` 从 `0xBE7330` 拷贝 VT_ERROR-missing；`0x411FE1` 构造 `{VT_UNKNOWN(0xD), punk}` 条件 AddRef）→ 按值复制（wrapper 两条 `movsd×4` 链）→ 转换（`0x5040517C`）→ punk 提取（`0x50406432`）+ QI（`0x504062AA`，容忍 E_NOINTERFACE）→ 类型分派（`0x50405002`）→ 单发或**逐项 IDispatch::Invoke 展开**（`[vtbl+0x2C]`，DISPPARAMS 构造 + 计数钳制 0x400）→ 销毁（`0x50402791` VariantClear ×N，SEH 状态机 `[ebp-4]` 索引局部表）。
- **交叉引用**：vtable 内 `0x5042D288`（inner slot25 = outer slot33 = mid slot30）；无其他静态调用者（虚调用专有）；EXE 侧唯一生产调用路径 = wrapper `0x427EB3`（及其 PUT 变体 `0x43E3A6`，C-085）。
- **callee 对象字段读写**：this 侧读 `[this+0x90]`（守卫）；wrapper 局部对象经 `0x50409922` 读 `[ebx+0x24]`、清 `[ebx+0x34..0x40]`、写 `[ebx+0x44]/[ebx+0x4C]`，并对其 `[ebx+0x40]` 子对象做 slot36(`+0x90`) / slot25(`+0x64`) 递归虚调用（`0x50409AFB`/`0x50409B7E`）与 `[vt+0xE0]`(slot56) 调用（`0x50409BDA`）。

### 2.2 三候选对照表（EV-76；含 Review 轮幽灵槽归位）

> **结构更正（Review 轮并入）**：t084 命名的"候选 1/候选 2"的 **slot25 归属是幽灵槽**——重叠窗口把连续 dword 块切成三张"表"。函数体事实与排除理由不变（`ret 8` vs 15 压栈 dword、出参位置/写入语义），但"哪张表的第几槽"需按下表归位。

| 维度 | 候选 1：`0x50403FBE` | 候选 2：`0x50404E85` | 候选 3：`0x5040418C` |
|---|---|---|---|
| dword 位置 | `[0x5042D1A4]`（t084 标"0x5042D140 表 slot25"） | `[0x5042D268]`（t084 标"outer 0x5042D204 slot25"） | `[0x5042D288]` 与 `[0x5042D1B8]` |
| **真实归属** | T154（class-2 长表）**slot20**；0x5042D140 实为 5-entry thunk 表 | T224（class-1 inner 长表）**slot17**；0x5042D204 实为 3-entry IUnknown 表 | **两张长表（T224/T154）的真实 slot25，同为此值** |
| 边界 | `0x50403FBE-0x50403FD0` | `0x50404E85-0x50404EA6`（companion setter `0x50404EA7-0x50404EC8`） | `0x5040418C-0x5040485D` |
| 调用约定 | stdcall (this, v) `ret 8` | stdcall (this, out\*) `ret 8` | stdcall 15 dword `ret 0x3C` |
| 返回/出参 | S_OK，无出参 | `*arg2 = [this+0x78]!=0`（E_POINTER 守卫） | HRESULT；`*arg15` = 包装**对象指针** |
| 语义 | 平凡 setter `[this+0xCC]=v` | 布尔状态 getter（companion 比较期望值、变化时调 `0x50403D25`） | VARIANT marshalling + IDispatch::Invoke 展开 + 设备守卫的资源创建/注册 |
| **生产路径判定** | ✗ `ret 8` ≠ 15 压栈 dword（栈残留被 wrapper `leave` 掩盖）；**不写出参** → out 残留 vt dword 13 → `0x666FAC call [[13]+8]` 崩（EV-16 矛盾成立） | ✗ `ret 8`；callee 把 `[esp+8]`（= 压入的 x-int 属性值）当地址做 `*write` → **野写**；真实出参槽永不写 | ✓ **15 dword 精确匹配**；出参位置/类型/对象值全链吻合（见 2.3）；对 class-1/class-2 **不变** |

### 2.3 生产调用点核对（`0x427EB3`，EV-76）

wrapper（thiscall，`ret 0x20` = 8 个 wrapper 参数）在 `call [eax+0x64]` 前的压栈（自低向高）：`this`、`[ebp+0xC]`（x，属性 0x331 值）、`[ebp+0x10]`（y，0x332）、`[ebp+0x14..0x1C]`（0,0,0）、VARIANT byval（copy of `[ebp+0x20]` = V{VT_UNKNOWN, layer-obj}）、VARIANT byval（copy of `[ebp+0x24]` = V{VT_ERROR, missing}）、`&[ebp+0x24]` —— **合计 60 字节**。调用后 `0x427F01-0x50404F09`：`*arg1(OUT) = [ebp+0x24]` 首 dword = callee 写入的对象指针。tile 路径随后：`0x42944A`（null-assert getter，返回 `[ebp-0x10]` 即 slot25 OUT 对象）→ `0x666F7D call [eax+0xB4]`（slot45，键控插入，C-075）与 `0x666FD4 call [eax+0xE0]`（slot56）**均落在返回对象上**；`0x666FAC` 对重初始化的 `[ebp-0x20]` 槽做 Release（C-074 模型）。

**结论（C-086）**：生产 slot25 = `0x5040418C`（inner vtable `0x5042D224`），且这是三候选中唯一满足 (a) 栈形状 (b) 出参位置/写入 (c) VARIANT 处理 (d) 设备守卫兼容性的候选。

### 2.4 完整 vtable/subobject 映射（EV-75；含 Review 轮结构复核）

**Gr2D 装载两类 vtable 组（共享 intmap `0x5042D1E0`）：**

- **class-1**（ctor `0x504013E3`，thiscall ret 4）：`[obj+0]=0x5042D204`（**3-entry** IUnknown 表：QI `0x504014A5`/AddRef `0x50410720`/Release `0x50401472`）、`[obj+0x10]=0x5042D224`（**36-entry** 长表 `0x5042D224..0x5042D2B3`：QI `0x50401522`…slot3=`0x504030D3`…slot25=`0x5040418C`@`0x5042D288`）、`[obj+0x14]=0x5042D210`（**5-entry** thunk 表：QI/AddRef/Release 以 `sub [esp+4],4` 调整后跳 inner 三件套，再 slot3=`0x50404860`、slot4=`0x50404CB2`）、`[obj+0x18]=owner`；`[obj+4]=0`；另有 **3-entry 拆卸表** `0x5042D2B4`（析构 `0x504018CD` 执行 `mov [esi],0x5042D2B4`）。**3+5+36+3=47** 个连续代码 dword（`0x5042D204..0x5042D2BC`），NULL 终止于 `0x5042D2C0` —— 与 C-077 的"47 连续代码指针"一致。
- **class-2**（ctor 片段 `0x50401295`）：`[obj+0]=0x5042D154`（**35-entry** 长表：QI `0x504013CA`——push 共享 intmap `0x5042D1E0`、pThis=this…slot3=`0x504030D3`…slot25=**`0x5040418C`**@`0x5042D1B8`）、`[obj+4]=0x5042D140`（**5-entry** thunk 表，`0x5040186C/76/80` 以 −4 调整跳 T154 三件套）。
- **intmap `0x5042D1E0`**：`{piid=0x50435120(E576EA33), dw=0, simple}`、`{piid=0x50435110(IUnknown), dw=0, simple}`、终止项——**两个类的 QI 都走这张图**（0x50401522 与 0x504013CA 均引用）。
- QI 几何：class-1 outer QI `0x504014A5`（IUnknown 特判 + 委托 `pThis=this+0x10`）；class-1 inner QI `0x50401522`（先委托 owner `[esi+8]`，失败以 `pThis=esi` 走图）；class-2 QI `0x504013CA`（直接 `pThis=this`）；ATL `_InternalQueryInterface 0x50401945`（IUnknown→首项偏移；简单项→`pThis+dw`）。
- **幽灵槽归位**：t084/t081 的"0x5042D140 40-slot 表 slot25=0x50403FBE"与"outer slot25=0x50404E85"均为重叠窗口误切片——真实归属见 §2.2。EV-72 的 dword 值本身**全部字节准确**（Reviewer 逐行核对；本报告早前草案声称的 mid 表 off-by-one 数据缺陷系误读，已撤回）。
- 哪个 vtable 与生产路径有关：**两张长表**（slot25=0x5040418C 见 §2.3；slot3/slot20 初始化调用见 §3）。生产路径确实调用 slot25（`0x427EB3`→`[eax+0x64]`），并最终解析到候选 3（类不变）。
- **候选集穷尽边界（按任务 §2.4 维度）**：搜索范围 = Gr2D 镜像内全部静态 vtable 的 +0x64 槽。两张长表（T224/T154）与两张 thunk 表（T210/T140）+两张 mini 表（outer 3-entry + class-1 结构）已全量重 dump（EV-75）。未验证的接口绑定 = PCOM 运行时注册表把 E576EA33 路由到哪个类的类对象（§3）；**候选集穷尽限定于"Gr2D 静态 vtable 的 slot25"**，不外推到运行时构造表。

---

## 3. P1 — IID 与 COM Interface 身份追踪（Interface Identity Matrix）

| 证据环节 | 地址 | 已确认 | 未确认 |
|---|---|---|---|
| IID | EXE `0xBA0570` ↔ Gr2D `0x50435120` | 16 字节完全相同 `{E576EA33-D465-4F08-AAB1-E78DF73EE6D9}`；EXE/DLL 各单次出现；PCOM.dll 内 **0 次**。（任务提示串 `E576EA33-4F08-D465-8DE7-B1AA-D9E63EF7` 为同字节非标准分组；规范串以字节为准） | — |
| Factory `[0xBE1FB0]` | 解析点 EXE `0x79C549` | = `PCOM.dll!PcCreateObject`（GetProcAddress 按名；五指针表 `0xBE1FB0..0xBE1FC0` = PcCreateObject/PcFreeUnusedLibraries/PcSerializeObject/PcSerializeString/PcRootNameSpace；另有 `PcInitModule`@`0x79C501` 直调、默认模块名 L"PCOM"@`0xBA7598`） | — |
| PcCreateObject | PCOM `0x50C04CD1` | 以 riid 在**运行时命名空间注册表**查找 class entry → 调其 vtable slot3 `(this, arg4, riid, ppv)` 创建+QI；注册表内容为运行时数据（PCOM 无静态 IID 表） | **IID→类对象的路由绑定本身**（运行时注册数据，静态不可枚举） |
| Creator | EXE `0xA0449B` | cdecl `(ctx, riid=0xBA0570, out, 0)` → `call [0xBE1FB0]`；先 Release 旧值；工厂空 → `0x800401F0`；失败走错误报告 | — |
| Initializer | EXE `0xA00E5E` | creator 写 `[0xBE2788]`（全 EXE 写者=此处 + 关机清理 `0x9FF8FF`，读引用 616 处均 E_POINTER 守卫）；随后对 `[0xBE2788]` 直调 slot3`(0x320,0x258)`、slot20`(0xFF000000)` | — |
| Gr2D vtable | `0x5042D204`/`0x5042D224`/`0x5042D210`（class-1）+ `0x5042D154`/`0x5042D140`（class-2） | 两类 ctor 安装 + 47/35 dword 连续块 + QI 链 + 共享 intmap（§2.4）；真实 slot25（两张长表）= `0x5040418C` | — |
| Global `[0xBE2788]` | — | 静态推导 = **E576EA33 接口指针，vtable 0x5042D224（class-1 inner）或 0x5042D154（class-2 primary）**：共享 QI intmap dw=0 + 初始化槽兼容性（见下）；slot25/slot3/slot20 两表相同 → 结论类不变 | 运行时值（G24 捕获确认为预测验证：二选一 vtable） |

**初始化槽兼容性判别**（静态链中最强的身份证据）：
- slot3`(800,600)`：两张长表 → `0x504030D3` 设备初始化（`ret 0x3C`，width/height 非零守卫、首个 VARIANT vt=VT_BYREF\|VT_I4 与 `test byte [ebp+0x15],0x40` 吻合——Review 轮补充确认）；3-entry outer 表**无 slot3**；5-entry thunk 表 slot3=`0x50404860`（`ret 0x10` 的 switch，与该参数形状不兼容）。
- slot20`(0xFF000000)`：长表 slot20 = `0x50403FBE` `[this+0xCC]=color`，`ret 8` 与单参数压栈精确平衡。

**运行时缺口（明确保留）**：PCOM 注册表把 E576EA33 绑定到 Gr2D 类对象的一环为运行时数据。静态证据（Gr2D 为游戏目录内唯一携带该 IID 且具备可 QI 类 + 初始化槽兼容 + 生产调用栈形状匹配的模块）支持上述推导，但按任务原则 §4/§13 不把静态定位包装成运行时身份确认——G24 的 bp `0x666F77` 单值捕获现在是**确认命名预测**（预期 `[ESI]` vtable = `0x5042D224`，DLL 基址相对 `0x2D224`），而非开放性判定。

---

## 4. P2 — C-082 及关联 Gap 的结论纠正（情况 A）

任务 §4 定义的三种情况中，本轮命中**情况 A**（发现第三候选满足生产路径约束）。已执行：

- **C-082 就地修正**（沿用 C-068→C-080 先例，保留历史行、附修正链注）：撤回"候选集穷尽=2 且均排除""运行时绑定必为静态表外"两个推断；保留两条函数体事实（平凡 setter 不写出参；布尔 getter 出参位置错误/野写）；`supersedes` 字段注明 "superseded-in-part by C-086"。
- **EV-72 保留不动**（历史证据）；其 mid 表 slot3/slot4 off-by-one 缺陷由 **EV-75 的 raw 重 dump** 纠正并登记（不回改历史文件）。
- **G24 重定义**：接收者身份修正（slot45 调用落在 slot25 返回对象上，非 `[0xBE2788]`）；残项 = 返回对象的具体类/vtable + PCOM 绑定的运行时确认；捕获动作改为确认预测 + 取返回对象 `[0]` vtable。
- **G27 关闭（CLOSED-STATIC）**：EV-16 的"out 残留 vt=13 → `call [13+0xB4]` 崩"矛盾仅在"slot25 不写出参"的候选下成立；第三候选写出对象指针，静态矛盾消解；运行时佐证并入 G24。
- G01/G07 等其余引用 C-082 的记录经核对不需要逐条改写（其表述引用的是"运行时 slot25 端点"这一仍然成立的外壳；矩阵 P1-09 行已更新为修正后结论）。

---

## 5. P3 — P3-13 Readiness 范围审计

**审计方法**：先读 Validator（`validate_reverse_engineering.py` check 16c 矩阵完整性规则：RE-READY 行必须有 evidence 引用、非 D 级、且 `blocks_acceptance=是` 时必须在 required_original_fact/unproven/blocks_acceptance 之一披露"限界"）、矩阵 schema（无子需求拆分机制——单一 `requirement_id` 列）与 readiness 定义（readiness 报告 §0/§3：RE-READY = 已证子行为可开工编码，不等于完整产品验收）。

**四层区分**（P3-13 抓绳/ladder 判定）：
1. **已静态闭合子行为**：分叉 = 记录 id 符号约定（C-078）；绳 loader 七字段写侧（C-079/EV-66）；`l` 无静态消费者的限定性负结论（C-079）；抓绳键位/命中框（C-069/C-071）。
2. **可进入重建**：按 C-069/C-071/C-078 编码（绳 id 取负索引，1 基）。
3. **尚未验证的完整行为**：抓绳时刻的运行时 corroboration（`l` 的运行时消费）、上下键同按仲裁。
4. **阻塞产品验收的剩余行为**：第 3 层所列项（矩阵 `blocks_acceptance=是`）。

**审计结论**：P3-13 现有字段组合（`readiness=RE-READY` + `blocks_acceptance=是` + `unproven="「未解」限界：……不阻塞按已证子行为编码"` + `implementation_feasibility="只能部分编码，未满足完整验收"`）**在 schema 与 readiness 定义下自洽**，完整表达了"部分闭合 + 验收阻塞"的范围，无需修改、无需拆分、无需创造新状态。本轮对 T084 已取得的四项成果（负 ID 分叉、七字段映射、`l` 限定性负结论、hint 张力静态消解）全部保留。t084 报告 §7 中 RE-READY 16→17 的计数不变。

---

## 6. P4 — 矩阵字段一致性审计（P4-06 / P4-07）

- **P4-06（传送后速度动作状态重置，RE-GAP-STATIC）**：`can_static_continue_or_runtime` 仍列"STATIC 枚举 0x9BC622 包装者之上的上层调用与进入场景初始化分支"，而该枚举已由 t084 闭合（C-084/EV-73，`minimum_next_work` 已声明"上层与场景初始化链已闭合"）——**字段间 stale 不一致，已修正**：改为"STATIC 无残项（t084 已闭合，t084.1 复核维持）；残项=Camera 刷新时机（G10 运行时，含触发条件与预期证据）"。readiness 维持 RE-GAP-STATIC（Camera 时机仍是该行 required fact"更新顺序"的未证组成，不因静态成果增加而拔高）。
- **P4-07（Camera 转移/冷却防重复，DESIGN-DECISION）**：`minimum_next_work` 残留"先查 0x963C7D/0x954B58 时间门"——其中 0x963C7D 族时间门**t080 已闭合**（C-054/EV-35，unproven 字段自己也写"冷却已证"），0x954B58/0x71B44D 命中框是 **P4-01 的残项**（归属错置）——**已修正**：冷却已闭合、Camera 写点在已检查的 EXE 镜像普查中未发现（C-028/C-084 有界负结论）→ 下一步 G10 运行时捕获（触发=in-map `[0xBDF54C]` 族 dump + slot15 caller 捕获；预期=scene+0xF0..0xFC 每帧写入者）或产品方案批准；跨图门输入抑制仍为静态待核项（`can_static` 字段原本正确，保留）。
- **G10 边界重述**（任务 §6 要求的四分法；t084.1 有界措辞——非全镜像断言）：已检查的 EXE 镜像普查中未发现 Camera 写点（C-028/C-084 有界负结论，t084.1 复核维持）；已检查的外部模块范围——Gr2D 侧相机矩形仅作为 slot15 **消费者**参数进入（C-084），已检查的 Gr2D 路径中未见 scene 字段生产者；尚未检查 = 上述普查之外的运行时写入者（如存在）与 slot15 caller 链；实际运行时捕获任务 = in-map dump。**G10 保持 OPEN-RUNTIME**（未取得任何运行时写入证据）。
- 其余 T084 相关行（P1-09/P1-10/P3-03/P3-13/P3-14/P3-15/P4-04/P4-05）逐行核对：仅 P1-09 需要并入本轮结论（claim/evidence 引用与 unproven/minimum_next_work 更新为"确认预测"型捕获），已执行。

---

## 7. P5 — C-083 Opcode 0x81 结论措辞收窄

**保留**（不受影响）：`0x97EBC9` 的 load→attach→landing-position write 执行链（alloc `0x3048` → `0x94FDB4` 新图全载 → `0x980A8C` 挂接 → `0x9507F0` 落点写；唯一 E8 调用者 `0x533FF1` 位于 handler 族 slot0）。

**收窄**（C-083 行与 `T084-OPCODE-0081-REGISTRATION.md` §6 追加章节）：
1. 负结论限定为"**在已检查的静态模式内**未发现 0x81 的字节级绑定"（imm sub/cmp 普查——**t084.1 按 Review 轮补全**：`sub eax,0x81`@`0x77E6F3`（通道上下文 0x81/0x82/0x83）；`cmp` 站点 `0x5414A1` 与 `0x62B75D` 为喂给 `0x77E6F3` 的范围守卫（同一通道分发器的另外两个 feeder），`0x75A0AB`/`0x9355A9` 为无关范围检查；33 表 handler 族 dword dump 无注册引用），不再作全镜像否定式。
2. 碰撞的解释力限定为："数字 0x81 在互不相交的分发上下文间**被复用**——数字本身不能脱离上下文标识 handler"；删除"per-handler-object registration"机制断言与"binding is established by runtime registration data"的肯定式机制结论。
3. 绑定/注册**机制本身未验证**（可能是动态注册、装载期表构造、或未检出的静态结构）；C-066 开放条款与 **G38 OPEN 状态不变**。

---

## 8. 独立 Review（Sub-Agent）

**Review 第一轮结果：ACCEPT-WITH-CORRECTIONS**（独立子代理，基线 `cdbe55ee`、三镜像独立哈希核验、自有 capstone/pefile 脚本约 16 个、不读本轮新产出；原文全文存 `forensics/T0841-REVIEWER-REPORT.md`）。八项指定检查（D1 完整性 / D2 三候选区分与生产栈 / D3 身份链 / D4 C-082 裁定 / D5 EV-72 vs raw / D6 矩阵行 / D7 opcode 0x81 / D8 复现性）中，主结论全部独立复核成立：`0x5040418C` 为唯一生产匹配（ret 0x3C = 60 字节压栈）、slot45 接收者=slot25 返回对象、QI(E576EA33)→长表接口、t084 C-082 结论" unjustified and overdue"（应被纠正）、P3-13 自洽、C-083 原措辞 overclaim。

**四项差异及处置**（全部已修复并复核）：

| # | 级别 | Reviewer 发现 | 处置 |
|---|---|---|---|
| 1 | MED | C-082/C-086 仍带幽灵槽标签（"outer 0x5042D204 slot25"/"layer-table 0x5042D140 slot25"——两表实为 3-entry/5-entry；真实第二长表 0x5042D154 的 slot25 同为 0x5040418C） | 已并入：C-082/C-086/EV-75/EV-76/矩阵/报告全部改为"幽灵槽归位+双长表 slot25 同值"表述；C-086 结论升级为类不变 |
| 2 | LOW | EV-75 草稿声称"EV-72 mid 表 off-by-one 数据缺陷"——Reviewer 逐行证明 EV-72 全部 dword 字节准确，缺陷是重叠窗口解释而非数值 | 已撤回错误断言（含本报告草案、T084-GR2D-SLOT25-ANALYSIS §6、readiness 备忘中的对应文字）；EV-75 头注改为 reviewer 结论 |
| 3 | LOW | C-083 census 只列 0x5414A1/0x75A0AB；完整 census 还有 0x62B75D（喂 0x77E6F3 的范围守卫）与 0x9355A9（无关范围检查） | 已补全（C-083/G38/EV 与本报告 §7）；有界负结论不变 |
| 4 | LOW-MED | G10/P4-07 "EXE-image static territory is EXHAUSTED"为无界否定；底层 C-028/C-084 是有界普查 | 已改为有界措辞（"在已检查的 EXE 镜像普查中未发现，非全镜像断言"）——G10 仍 OPEN-RUNTIME |

Reviewer 最终裁定（原文）："No difference affects the stage verdict. **NOT STAGE-READY stands** — my independent analysis, if anything, moves one formerly 'open discrimination' to a 'named-prediction confirmation' without closing any runtime dependency."

**修正复核闭环（共四轮，全文见 `forensics/T0841-REVIEWER-REPORT.md` 附录 A/B/C）**：
- **第 1 轮**：ACCEPT-WITH-CORRECTIONS（上表四项差异）。
- **第 2 轮**（修正后复核）：Diff 1-3 RESOLVED；残留 = Diff-4 有界措辞在相邻字段存活（P4-07 can_static/G10 blocker/报告 §6 散文）+ EV-75 "39-entry" 计数（T224 实为 36 项 + 3 项拆卸表 0x5042D2B4，3+5+36+3=47）+ clean-room 待重生成。
- **第 3 轮**（再修正后复核）：上述各项 PASS；唯一残留 = 报告 §6 G10 句的一个文本变体未被替换（LOW）。
- **第 4 轮（最终）**：**ACCEPT — close-out complete**。§6 句已为有界形式；全文件扫描无其他活性无界断言；G10=OPEN-RUNTIME、Validator PASS、EV-74/75/76 哈希绑定、矩阵有界字段全部复核完好；"stage verdict NOT STAGE-READY is unaffected"。

---

## 9. 质量门禁（真实执行日志）

| 门禁 | 命令 | 结果 | 日志 |
|---|---|---|---|
| Validator | `python research/scripts/validate_reverse_engineering.py` | **PASS（0 errors, 0 warnings）**；87 Claims / 41 Gaps / 76 Evidence | `forensics/T0841-VALIDATOR-LOG.txt` |
| Unit Tests | `python -m unittest research.tests.test_validate_reverse_engineering` | **44/44 OK** | `forensics/T0841-UNITTEST-LOG.txt` |
| Clean-room | `python research/scripts/generate_cleanroom_deliverables.py` | Claims/Gaps/Evidence/Crosswalk 副本 + RETRACTED + gap-stats 再生成，与 canonical source 逐文件一致（validator CHECK 15 同步通过） | `forensics/T0841-CLEANROOM-LOG.txt` |
| Binary Identity | sha256 重算 | EXE/DLL/PCOM 与台账一致，本轮未修改任何原始二进制 | 日志内嵌 |

---

## 10. A. Git 状态

| | |
|---|---|
| Starting SHA | `cdbe55ee2a1d8bbc8ceeef3fc3d66e864b56749f`（t084，已验证存在且为 T083 `5cec6572` 的后代；工作区起步时干净） |
| Final SHA | 见本轮提交（单提交交付；本报告提交前写就） |
| Branch | `research/t084-1-slot25-scope-reconciliation`（未推送：本轮无推送授权，留待用户决定） |
| Diff scope | `research/` only：source-of-truth 4 CSV、stage-readiness 报告/矩阵/forensics、scripts/t0841_\*。**无** components/、Frozen ABI pin、LoomRealm、content/、.work/ 改动（git status 复核见日志） |
| 非 research 修改检查 | 无（`git status --porcelain` 全部路径以 research/ 开头，另含本分支文件） |

## 11. B–C. 结论与台账修正摘要

**Slot25 结论**：三候选全部完成指令级分析；**唯一满足生产路径约束的是 `0x5040418C`——两张 Gr2D 长表（T224 `0x5042D224` / T154 `0x5042D154`）共同的真实 slot25**（C-086，类不变）。`[0xBE2788]` 身份 = 静态推导为 E576EA33 接口指针（vtable 0x5042D224 或 0x5042D154 二选一，C-087）；PCOM 注册表绑定（含哪个类被实例化）与返回对象具体类仍需运行时证据（G24 确认性捕获）。

**台账修正前后对照**：

| 条目 | 修正前 | 修正后 |
|---|---|---|
| C-082 | "候选集穷尽（2）且均排除 → 运行时绑定必为静态表外" | 穷尽结论**撤回**；两函数体事实保留（但两个"slot25"归位为幽灵槽：T154 slot20 / T224 slot17）；指向 C-086 |
| G24 | OPEN-RUNTIME，"三选一判定" | OPEN-RUNTIME，重定义：slot45 接收者=slot25 返回对象；捕获=确认预测（vtable 0x5042D224 或 0x5042D154）+取返回对象 vtable |
| G27 | PARTIAL-STATIC（出参静态矛盾） | **CLOSED-STATIC**（矛盾在 0x5040418C 下消解；运行时佐证并入 G24） |
| G10 | （t084 范围） | OPEN-RUNTIME 维持；边界四分法重述并**有界化**（已检普查未发现/Gr2D 已检路径仅消费者/普查外未检/捕获任务） |
| P3-13 | RE-READY + blocks=是 + 限界披露 | **不变**（审计结论：自洽） |
| P4-06 | can_static 字段含已完成枚举（stale） | 修正为"静态无残项 + Camera 运行时残项（含触发/预期）"；readiness 维持 |
| P4-07 | minimum_next_work 含已闭合 0x963C7D 时间门与 P4-01 的 0x954B58 | 修正为冷却已闭合 + G10 运行时捕获（有界措辞）+ 跨图输入抑制待核 + 归属澄清 |
| C-083/G38 | "上下文相关注册（碰撞证明）" | 限定到已检模式（census 补全 0x62B75D/0x9355A9）；碰撞只证数字复用；**机制未验证**；G38 OPEN 维持 |
| EV-72 | （t084 数据） | **字节全部准确**（Reviewer 逐行+主 Agent 独立复核确认）；缺陷为重叠窗口的幽灵槽编号，由 EV-75 双组 raw 重 dump 归位纠正；历史文件保留不动 |

新增：C-086（CLOSED-STATIC/A）、C-087（PARTIAL-STATIC/A）、EV-74/75/76（绑定文件 sha）、`research/scripts/t0841_dump_evidence.py`（EV 复现方法）、`t0841_update_ledgers.py`/`t0841_update_matrix.py`/`t0841_round2_fixes.py`（台账变更留档）。

## 12. F. 阶段判断

**项目状态保持：NOT STAGE-READY。**（独立 Reviewer 同裁定："No difference affects the stage verdict. NOT STAGE-READY stands."）

G10（相机每帧生产者，运行时）、G24（slot25 返回对象类 + PCOM 绑定确认性 dump）、G38（0x81 注册数据、0x9BE703 完整体、相机时机）等验收阻塞项仍未关闭。本轮静态成果（生产 slot25 定身、出参矛盾消解、IID 链闭合）**缩小**了运行时捕获的问题空间（从开放判定变为预测确认），但不改变阶段状态判定规则。下一轮最高价值目标维持 t084 建议：G10 运行时捕获 + G24 确认性 dump + `0x9BE703` 完整体。
