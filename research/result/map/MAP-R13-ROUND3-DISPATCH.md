# R13 第三轮：委派解析与 RawCanvas 容器语义（MAP-R13-ROUND3-DISPATCH）

日期: 2026-11-13。基线 88130b60。本轮全部结论附 A/B 级证据；推翻两处 Round2 结论。

## 1. 0x5042D0A0 最终解析（A 级，CLOSED）

### 1.1 机制鉴定
```
Claim: [0x5042D0A0] = __imp__purecall（CRT 导入地址表项），非"运行时补丁表"
Binary: Gr2D_DX8.dll
ImageBase: 0x50400000; RVA 0x2D0A0; FileOffset 0x2D0A0（.rdata raw==vaddr）
Evidence:
  - 表值 0x34064 = RVA → 0x50434064；0x50434046-0x50434116 原始字节 = ASCII：
    "M.dll\0" {hint 0x02E1}"wcscmp\0" {hint}"__CxxFrameHandler\0" {hint 0x0192}"_purecall\0"
    = PE 导入按名表（hint/name table）
  - [0x2D0A0]=0x34064 → 名字项 "_purecall"；[0x2D0A8]=0x34046 → "wcscmp"
  - .reloc 覆盖检查：0x2D080-0x2D0B0 无重定位项（加载器不改写）
  - 引用桩 0x5042A5EC-0x5042A85C = jmp/call [0x5042D0XX] = 标准 __imp_ 跳转桩
Confidence: A（字节级直接证明）
```

### 1.2 推论
- 虚表 0x5042E2C4 槽 3-44 全指向 0x5042A610 = `jmp [__imp__purecall]` = **抽象槽位**
- 该表属于抽象基类；其邻接 intmap@0x2E520 亦属抽象类

## 2. 真实 CWzRawCanvas 虚表与 slot45（A 级）

### 2.1 虚表起点修正
```
vtable = 0x5042E2CC（非 0x5042E2C4——前 8 字节为 RTTI COL 头）
0x2E2CC + 149×4 = 0x2E520 = intmap 起点 ✓（精确衔接）
槽 0/1/2 = 0x2AA3/0x2AA7/0x2ACC（QI/AddRef/Release 实体）
槽 3-44 = purecall（抽象）；槽 45/46/47 = 实体；槽 56 = 实体
```

### 2.2 slot45（+0xB4）实测 = 删除型析构函数
```
50404FB1: push esi; mov esi,ecx          ; thiscall
50404FB4: mov [esi], 0x5042E380          ; vtable 换基（销毁协议）
50404FBA: call 0x5040C8AB                ; 基类析构
50404FBF: test byte [esp+8],1            ; flags bit0
50404FC6: push esi; mov ecx,0x5043A088; call 0x50401700   ; 条件 operator delete（全局分配器）
50404FD1: ret 4
```
**= MSVC scalar deleting destructor 标准模式（A 级）**

## 3. 0x427EB3 = 属性 PUT 包装（A 级，推翻 Round2 "CreateRawCanvas"）

```
0x427EB3( ecx=layer, out=arg8, 8 args ):
  封送两个 16 字节 VARIANT 结构到栈
  call [layer_vt+0x64]                    ; slot25
  失败 → 错误(IID 0xBA0570=E576EA33=层 IID)
  *out = [ebp+0x24]（原参数结构回传）
```
**CWzGr2DLayer 虚表 0x2D140 slot25（0x50403FBE）实测：**
```
50403FBE: mov eax,[esp+4]; mov ecx,[esp+8]
50403FC6: mov [eax+0xCC], ecx            ; this->field[0xCC] = value
50403FCE: xor eax,eax; ret 8             ; 平凡属性 setter
```
slot26（0x50403FD1）= 配对 getter（[this+0xD0] + AddRef）。

**结论**：0x427EB3 = ATL 风格属性 PUT（层成员 +0xCC 注册）。
[ebp-0x10] 的对象来自调用方 VARIANT 参数（WZ 画布对象），**不是层创建的**。

## 4. 0x666F7D 语义重审（B 级）

已知（A 级部分）：edi = 排序键（lea 计算）；调用 = `push edi; push esi; call [eax+0xB4]`。
冲突：若 [esi] 虚表 = 0x2E2CC，slot45 = 析构——键作 flags 无语义。

**裁定**：0x666F7D 的 [eax+0xB4] 目标取决于 [ebp-0x10] 对象的**具体类**（多实现）：
- 若 = 0x2E2CC 类 → 析构（则该块为清理路径，键为无关残留）
- 若 = 其他 6DC8C7CE 实现（虚表候选：0x2E380/0x2F2CC 等 slot45 各异）→ 语义待该类虚表裁定

**残留未知（1 项）**：[ebp-0x10] 对象的具体虚表 = 运行时值（variant 内容决定）。
最小验证：进图转储读 [[ebp-0x10] 所在路径的对象] 1 dword。

## 5. 排序键公式复核（A 级维持）

tile: `lea edi,[eax+ecx*2-0x3FFFB1EA]` @0x666F68 —— 直接机器码（本轮重放确认指令流）
obj: `lea` disp 0xC00007D0 @0x6688xx（Round1 已录，未变）
两公式不依赖上述争议：键计算与后续调用独立存在（A 级）。

## 6. 修正记录

| Round2 结论 | Round3 修正 | 依据 |
|---|---|---|
| [0x5042D0A0] = 运行时补丁表 | **__imp__purecall（IAT）** | 导入名表 ASCII + 无重定位 |
| 0x2E2C4 = RawCanvas 虚表 | **0x2E2CC**（前 8 字节 = COL 头）；0x2E2C4 视图含抽象段 | 槽 0-2 实体 + 衔接计算 |
| 0x427EB3 = CreateRawCanvas | **属性 PUT 包装**（slot25 平凡 setter +0xCC） | 0x50403FBE 反汇编 |
| slot45 = 有序插入（假设） | **slot45@0x2E2CC = 删除型析构**；插入解释对其他实现未定 | 0x50404FB1 反汇编 |

## 7. 对 loom-realm 的影响

- 排序键公式可安全实现（A 级独立证据）
- "有序插入容器"语义降级为 B→C 级（具体类未定）：**Render ABI 不应绑定具体容器实现**，保持"Tile/Obj 独立注册 + 可替换排序策略"（与任务书 §10 建议一致）
- 层属性注册（+0xCC put / +0xD0 get）= 层成员管理模式可复刻
