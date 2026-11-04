# 轨道 A / T-101 — 未加壳 Wizet DLL 静态分析（第一轮）

> 执行日期：2026-10-10（glm-work 会话 2）
> 样本：`.work/task-001/extracted/冒险岛online/` 下 10 个未加壳 Wizet 运行库（哈希见 `wizet-dll-inventory.json`）
> 工具：`glm-work/scripts/maple079_wizet_dlls.py`（PE 清单/导出签名/字符串/引用扫描）
> 产物：`glm-work/result/wizet-dll-inventory.json`、`glm-work/result/resman-entry-points.csv`
> 对应计划：轨道 A（T-101）→ Task 021 前置；`result/19-wizet-dlls.md` 计划名沿用

## 1. 体系结构：COM 工厂 + PCOM 对象模型

- 全部 7 个 Wizet 运行库（ResMan/Canvas/PCOM/NameSpace/Shape2D/Gr2D_DX8/Sound_DX8）仅导出 `DllCanUnloadNow`/`DllGetClassObject` —— **Wizet 组件体系是 COM 类工厂**（CLSIDs + `PcCreateObject` 实例化）。
- **PCOM.dll = 对象模型核心**，额外导出：`PcInitModule`、`PcTermModule`、`PcCreateObject`、`PcFreeUnusedLibraries`、`PcRootNameSpace`、`PcSerializeObject`、`PcSerializeString`。命名空间树由 `PcRootNameSpace` 暴露——与 NameSpace.dll 配合构成资源命名层。
- 各 DLL 数据段含自身与 `PCOM.DLL` 名字表（各有一处 `push imm32` 代码引用）——PcInitModule 引导时按名互载（与导入表并用）。

## 2. 关键机制发现

### 2.1 `List.wz` 的消费方式（Q11 推进）

- **Canvas.dll**：字符串 @RVA `0x2D6F4`，代码引用 `push imm32` @`0x20BC4`。
- **PCOM.dll**：字符串 @RVA `0x174BC`，代码引用 @`0x6CC7`；上下文已反汇编：`GetModuleFileNameA`(经 `[0x50C1301C]`) → 取 `0x800` 缓冲 → 反向找最后一个 `\`（0x5C）截出目录 → 内部 cdecl 拼接函数（`0x50C10340`）接上 `"List.wz"` → 经 `[0x50C13070]` 导入检查存在性。即 **PCOM 用可执行文件目录拼接 `List.wz` 构造数据根路径**——`List.wz` 是 WZ 命名空间的根/入口文件（与 16 个 PKG1 归档并置）。
- 结论（high）：`List.wz` 由 PCOM/Canvas 以"目录+文件名"方式打开，作为资源系统引导入口；其非 PKG1 头（`05 00 00 00`）的格式解析留给下一轮（需先恢复 PCOM 的文件读取封装）。

### 2.2 PKG1 归档处理器在 NameSpace.dll

- NameSpace 数据段存在 **`PKG1` 签名字符串 + `Package file v1`** 标识（@`0x18C87` 一带，前导 'P' 为相邻数据伪影）与 **`PKG%04x.tmp`** 模板（@`0x1E61E`）——NameSpace 负责 16 个 `PKG1` WZ 归档的挂载/解包（临时文件展开或索引缓存）。
- 主程序 `tpuaozxc` 节的 packed raw（`0x001000–0x2CE000`）与 PKG 的关系仍是 Q4 候选；NameSpace 的挂载入口（`PcRootNameSpace` 下层）是下一轮目标。

### 2.3 WZ 解压链：Canvas → ZLZ（证实）

- **Canvas.dll 直接导入 ZLZ.dll 的全部三个导出**：`ZLZCreateInflator`/`ZLZCreateDeflator`/`ZLZCloseFilter`——WZ 数据块的解压走 ZLZ 流过滤器。
- ZLZ 导出为 C++ 修饰名，**签名直接可读**：
  - `ZIStream* ZLZCreateInflator(int mode, ZIStream* next, unsigned int cb)`
  - `ZIStream* ZLZCreateDeflator(int mode, ZIStream* next, int cb)`
  - `void ZLZCloseFilter(ZIStream*)`
- **ZLZ 的 PDB 路径 `D:\ACGAME_CN\ztl\ZLZ\Release\ZLZ.pdb`**——构建树含 **`ztl`** 目录，与主程序导出 `ZtlTaskMemAlloc*` 同族：`Ztl` 是 Wizet/Nexon 内部基础库名（memory/stream 家族），这为 G6 符号命名提供了官方词根。

### 2.4 RTTI 真类名（G6 弹药）

- Canvas：`.?AVCWzCanvas@@`、`.?AVCWzDIBRawCanvas@@`；Gr2D_DX8：`.?AVCWzRawCanvas@@`。
- 证明该代码库保留完整 MSVC RTTI——阶段三用 RTTI 串匹配命名类/虚表的路线**在此代码库可行**（与种子表 `function-family-seeds.md` 的预期一致）。

### 2.5 WzMss.dll = 官网 SOAP 客户端（负结论，G1 相关）

- 18 个导出全部是 `WzSoap_*`（公告板/咨询台操作），内嵌端点 **`http://api.maplestory.nexon.com/Soap/Consult`**，PDB `d:\ACGame\WzLib\Soap\Release\Soap.pdb`。
- 其 WS2_32 引用服务的是**网站 SOAP**，与游戏服务器协议（Task 002 的 9555/7575 链路）**无关**——种子匹配时不得把 WzMss 的 socket 活动当作 CClientSocket 证据。

### 2.6 `PWS2_32.DLL`/`WS2_32.DLL` 字符串的定性（Task 021 重点 #1 收口）

- 九个 DLL **全部无 PE 延迟导入目录**（逐一解析证实）；这些字符串位于数据段的序列化名字表区（与 `PCOM.DLL` 名字条目同区），前导 `P`/`Q` 等是相邻表项字节伪影。
- 定性（medium-high）：**组件/模块描述符表的一部分**（PcInitModule 家族消费），不是 PE 导入也不是直接代码引用；个别 DLL（Canvas/ZLZ/WzMss）确有数据指针指向该区。是否真的 Late-bind `LoadLibrary("WS2_32.DLL")` 需要找表遍历代码——留下一轮。

## 3. 资源链路整合图（当前证据态）

```text
MapleStory.exe (packed) ──┐
                          ├─> PCOM.PcInitModule → 互载组件 DLL（名字表）
16× PKG1 归档 + List.wz ──┘        │
                                   ▼
                    NameSpace.dll（PKG1 挂载、PKG%04x.tmp）
                                   │ PcRootNameSpace
                                   ▼
                    Canvas.dll（CWzCanvas/CWzDIBRawCanvas）
                         └─ ZLZ.dll（Inflate/Deflate 流过滤器）
                    Gr2D_DX8.dll（CWzRawCanvas、D3D8 渲染）
                    Sound_DX8.dll（WINMM/MSACM 音频）
                    Shape2D.dll / ResMan.dll（COM 工厂；ResMan 另有
                        "[ResMan] Failed in GetCachedObject : %s" 日志串）
```

## 4. 第二轮补充（同会话续）：PKG1/List.wz 文件级结构与挂载机制

### 4.1 PKG1 归档头（文件直析，Base.wz/TamingMob.wz 一致）

```text
+0x00  "PKG1"
+0x04  dword  每文件不同（0x2279/0x0718——版本或条目数，待定）
+0x08  dword  0
+0x0C  dword  0x3C（头长度自指）
+0x10  "Package file v1.0 Copyright 2002 Wizet, ZMS\0"（44 字节）
= 0x3C 字节头，其后为编码载荷（Base.wz 头后以 c2 00 xx 04 起始）
```

### 4.2 List.wz（65,470 字节，非 PKG1）

- 头 `05 00 00 00`，随后为**记录流**；本轮确认记录框架：`ac 52` + `16 00 00 00` + **固定 16 字节签名**（`c8 65 21 05 06 cd 25 0a f9 7b e4 0a 98 65 62 8b`）+ 变长载荷——该签名在全文重复 **~370 次**（间距 0x30–0x46 可变，含变长字段）；另有其他计数前缀（`0x8028` 处 `11 00 00 00`=17=文件数）。
- **已知明文攻击负结果**：对 17 个 .wz 文件名测试 XOR/ADD/SUB 常数键、位置递进键（^i/+i/-i）、链式（xor/add/sub 前字节）、半字节交换、循环移位——全部无命中；亦无字节周期性。结论：变换非平凡（每记录独立键或表驱动置换），**完整解码需反汇编 NameSpace/PCOM 读取封装**（挂在下一步，配合 §4.3 已定位的虚方法 `[eax+0x18]`）。
- ~370 条记录 ≫ 17 个文件——List.wz 远不止文件清单（疑含命名空间节点/外链映射）。

### 4.3 NameSpace.dll 挂载机制（函数级反汇编）

**挂载函数 `0x13070`（thiscall，COM HRESULT 风格）全解剖**：

1. **唯一临时工作文件**（修正早前"按归档编号展开"的误读）：`[0x5081E7F0]`(GetModuleFileNameA 形状) 取自身路径并归一化分隔符为 `/` → `[0x5081E7FC]`(**GetTickCount** 形状) 作种子 → `wsprintfA(path_end, "PKG%04x.tmp", tick & 0xFFFF)`（**IAT 实证** `USER32!wsprintfA` @ `[0x508170AC]`）→ `CreateFileA(name, 0xC0000000, 1, 0, 0, 0x4000080, 0)`；若 `INVALID_HANDLE_VALUE`：`GetLastError` ∈ {`ERROR_ALREADY_EXISTS`(0xB7), `ERROR_FILE_EXISTS`(0x50)} 则**换号重试**，否则加 `./` 前缀重试——即 PKG%04x.tmp 是**防冲突的抓取/展开暂存文件**，非固定编号。
2. **对象结构**：`this+0x10 / +0x14 / +0x18 / +0x1c` 四个子对象（构造/释放经 `0x13CC9/0xDEA9/0x13C79/0x13BD9/0x13C46` 小助手，智能指针式引用计数：`dec [obj+4]; jne skip; mov [obj], 0` 释放形）。
3. **懒创建**：调用侧（`0x131BE` 起，HRESULT `E_POINTER=0x80004003` / `STG_E_WRITEFAULT=0x80030050` 错误路径）在 `[this+0x14]==0` 时才调 `0x13070` 建暂存文件——挂载按需展开。
4. **头校验**：`PKG1` 串（RVA `0x18C88`）被 `0x137BA` 处 `push 0x50818C88` 引用；上下文：`push 0x3C` → `lea ecx,[ebp-0x6c]`（this）→ `call [eax+0x18]`（流对象虚方法读 0x3C 字节）→ `cmp eax,0x3C / je` 成功。
5. **API 绑定混合**：`wsprintfA` 走 PE IAT；`GetModuleFileNameA/GetTickCount/CreateFileA/GetLastError` 走 `0x1E7xx` 的**Wizet 自建运行时分发槽**（非 IAT；按参数形状判定，high-medium）——与主程序保护层的晚绑定风格同族，但这里是普通（未加壳）实现。

### 4.4 探针前 resolver 调用全录（第三次 replay，walker 入口钩子）

| # | 模块 | 校验和 | 命名 | 调用返回地址 |
| --- | --- | --- | --- | --- |
| 1 | kernel32 | `0xD9DA1CE9` | LoadLibraryA | `0x857E4A`（wrapper 形态） |
| 2 | kernel32 | `0xD9DA1CE9` | LoadLibraryA | `0x857E68`（wrapper 形态） |
| 3 | kernel32 | `0xA817731A` | GetLocalTime | `0x857E7C`（wrapper 形态） |
| 4 | user32 | `0xA43576A8` | **MessageBoxExA** | `0x8594FF`（直接形态，round-3 明文区） |
| 5 | kernel32 | `0xBC8E6EFC` | **CreateFileA** | `0x8595E7`（直接形态，round-3 明文区） |

- 字典升至 **25/25**（`resolver-api-dictionary.csv` 已含两个新条目）。
- **wrapper 管线证实**：`push imm(描述符); jmp 0x821750` 形态中，wrapper 链把描述符（游标=imm+0xF97D9014）解码成校验和并补推模块基址后调用 walker——此前微仿真提前 RET 的根因即缺模块基址。
- **CreateFileA 的解析点定位**：`0x8595E7`（round-3 明文区内），解析后 EAX 携带至 SICE 调用点 `0x859757`——补齐 Task 009 "EAX 已持有 CreateFileA 但无槽位写入"一环。

### 4.5 List.wz 读取封装与序列化链（函数级追踪成果，含一次自我修正）

读取链（反汇编实证，`0x13729` 函数 = 入口 Open）：

```text
Open(this, wide-name, flag)
  ├─ 宽字符入口名散列：movzx ecx,cx ; lea ecx,[edx+ecx+1] 累加 → dword
  ├─ [this+0x14]==0 → 0x13070 懒建 PKG%04x.tmp 暂存
  ├─ 流包装构造 0x5080D5BB：装配 4 个 vtable（主 0x18AF0 等），内层真实流在 +0x1c（QI 式获取）
  ├─ PKG1 头校验：call [主vt+0x18]=0xC1BF（缓冲 Read 循环，内层 [eax+8]）读 0x3C 字节到 0x18C88 模板缓冲
  ├─ 键推导：散列 dword 四字节 XOR 折叠 → not → 每条目键字节（打包成 dword 参数）
  ├─ 0x5080DD44：16 字节缓冲 @0x1EC10（.bss 全零）传入内层流 vt+0x28 —— 实为
  │   QueryInterface 式 GUID 出参包装（此前误判为"16 字节主密钥"，据文件内容全零+E_NOINTERFACE 处理修正）
  ├─ 0x50809A5B：LoadLibraryA("PCOM.DLL") + GetProcAddress 绑定 PcCreateObject/
  │   PcRootNameSpace/PcSerializeObject/PcSerializeString/PcFreeUnusedLibraries → 全局 0x1EC28-38
  │   （此前误判为"密码表初始化"——实为 NameSpace↔PCOM 循环导入的晚绑定解法，
  │    同时坐实各 DLL 数据段 `WS2_32.DLL` 表项=同一晚绑定机制）
  └─ 0x5080DF90：调用 PcSerializeString(this, ?, dword(键字节对)) —— 记录串的
      按名键控变换在 PCOM!PcSerializeString（PCOM.dll 导出，RVA 0x6411）内实现
```

**结论**：List.wz 记录变换 = NameSpace（挂载/头校验/入口名散列键）+ PCOM（PcSerializeString 字节变换）两层协作的**按名键控序列化**——机制性解释了 §4.2 均匀 KPA 的全部失败。

**PCOM 侧再进两跳**（同会话）：`PcSerializeString(0x6411)` 按打包键双字高位选路，低两字节=序列化/反序列化模式标志（相等→`E_INVALIDARG 0x80070057`；NameSpace 的 `(key,~key)` 恒不等即用此选方向）；实体 `0x64E3` 取根命名空间对象（`0x6653`）、经流位置簿记（`[obj+0x1c]` 当前位/`[obj+0x20]` 基位）后调 **`0x74FC`（写路径）/`0x7575`（读路径）**，键字节存 `[ebp-0xd]` 随行。**逐字节变换的最后落点=PCOM `0x7575` 族（读）**——Q11 收口的最终一跃（反汇编它→Python 解码器→17 个 .wz 宽名试解）。

## 5. 下一轮（Track A 深化清单）

1. NameSpace 的 PKG1 挂载函数定位（`Package file v1` 串引用 + 头解析）；`List.wz`（`05 00 00 00` 头）格式判定（Q11 收口）。
2. PCOM 序列化格式（PcSerializeObject/String 的字节布局）——组件表含 `WS2_32.DLL` 之谜的最终答案。
3. ResMan 导出/内部 `GetCachedObject` 缓存层与 WZ 读取入口签名（`resman-entry-points.csv` 已备骨架）。
4. ijl15.dll（Intel JPEG）与 `iloveaki.dat` 双文件关系（私服侧改动嫌疑）。

## 6. 复现

```text
python glm-work/scripts/maple079_wizet_dlls.py
```
