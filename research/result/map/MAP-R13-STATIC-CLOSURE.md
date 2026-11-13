# R13 排序静态闭合（MAP-R13-STATIC-CLOSURE）

日期: 2026-11-13。全链路静态闭合，含对旧结论的两处修正。

## 结论一：排序键公式（VERIFIED，EXE 侧）

### Tile 键（构造点 0x666E44，函数 0x666C0D）
```
key = z_canvas + 10 * (layer * 3000 - zM) - 1073721834
```
- `lea edi, [eax+ecx*2+0xC0004E16]`（disp 字节 `16 4E 00 C0` = −1073721834）
- layer ∈ 0..7（主循环 `cmp ..., 8` VERIFIED）；zM 每加 1，键减 10；canvas z 每加 1，键加 1
- 层差惩罚 30000/层

### Obj 键（构造点 0x6688BE，函数 0x66735F / 0x66885B）
```
key = layer * 30000 + z - 1073739824
```
- `lea` disp `D0 07 00 C0` = −1073739824
- Obj 键与 Tile 键同一量纲空间（−1073739xxx 基线族）

### 键构造者与插入者分离
键在 EXE 加载时计算 → `push edi(键); push esi(条目); call [eax+0xB4]`（0x666F72 上下文、0x42944A）→ **有序插入 DLL 容器**。比较器在 DLL 内部（二分插入）——与旧文档"函数语义不在本镜像"一致。

## 结论二：[0xBE2788] 身份 = Gr2D_DX8 接口（VERIFIED，本轮闭合）

### 证据链（全部静态）
1. **初始化器 @0xa00e5E**（盲区，capstone）：
   ```
   obj = [0xBDD494]->+0x14                      ; 根上下文
   result = 0x7a48d0() 字符串表单例 → 0x40634c(this, 0x819, &out)   ; 按 ID 0x819 取对象
   0xa0449b(outer, IID=0xBA0570, &DAT_00BE2788, 0)   ; CoCreateInstance 式创建
   ```
2. **创建器 0xa0449b**（capstone）：
   - `[0xBE1FB0]` = 工厂表；空 → 返回 **0x800401F0 = REGDB_E_CLASSNOTREG**（COM 标准错误码，铁证）
   - 调用 `factory(outer, CLSID@0xBA0570, out, 0)`
3. **IID @0xBA0570** = `{E576EA33-4F08D465-8DE7B1AA-D9E63EF7}`（GUID 混合端序）
4. **IID 全库唯一归属**：字节序列 `33ea76e565d4084f...` 在 5 个 DLL 中**仅存在于 Gr2D_DX8.dll**（file+0x35120 = VA 0x50435120）
5. Gr2D 内引用：0x8bf0/0x8c17（QI 后错误报告，`push 0x50435120; call 0x5042a526`）+ **0x2d1e0 = ATL 接口映射项 `{IID_ptr, 0, 1}`**（主接口，dwOffset=0）
6. 25 处 exe 引用 0xBA0570 = 同族接口错误报告（0xa6ef0f COM 错误包装）
7. 195 个 UI 构建器函数读 [0xBE2788]（==null → E_POINTER 智能指针守卫）
8. 关机清零：FUN_00994b89（`DAT_00be2788 = 0`）

### 修正 1（推翻 SEC16 草案与 MAP-CAMERA 判定）
- **[0xBE2788] ≠ Shape2D#Vector2D**（MAP-CAMERA-REVERSE 的解释错误）
- Shape2D 的 Vector2D 是名字类（L"Vector2D"），而本接口用**真 GUID** 创建、且 GUID 仅在 Gr2D 中定义

### 修正 2（推翻"0x666F7D = 比较器回调"读法）
- 0x666F7D 的 `call [eax+0xB4]; cmp eax, ebx; jge` = **HRESULT 成败检查**（jge = SUCCEEDED），不是比较
- 随后的 `call 0x4029b7`（VARIANT 清理）+ `call [ecx+8]`（Release）+ `call [eax+0xE0]`（slot 56）= 标准 COM 属性读后清理链
- **+0xB4 = 有序插入/渲染列表操作**，比较在 DLL 内部

### slot 45 实测（Gr2D@0x2f2cc m45 = 0x5041B84D）
反汇编证明 = **字节→RGBA 浮点解码循环**（像素引擎家族）：
```
mov eax,[ecx+0x1050]; imul eax,[ebp+8]      ; stride1 * x
mov edx,[ecx+0x1054]; imul edx,[ebp+0xC]    ; stride2 * y
add eax,edx; add eax,[ecx+0x18]             ; + base
loop: fild byte[eax] * const(0x5042F1D0) → out[0..2]; out[3]=1.0; 16B 步进
```
→ 132 槽表（0x2f2cc）= 像素引擎；若 [0xBE2788] 对象虚表即此族，则 +0xB4 在此表上是解码——
故 **[0xBE2788] 的真实虚表是 Gr2D 的另一张（接口映射 dwOffset=0 的主虚表）**，
132 槽表与 IID 的精确对应留为残留项（见 RUNTIME-REMAINING）。

## 结论三：Tile/Obj/Avatar 排序关系（基于键空间分析）

| 问题 | 答案 | 证据级 |
|---|---|---|
| Tile 与 Obj 同容器？ | 是（同一 `[eax+0xB4]` 插入路径，0x666F72/0x42944A） | VERIFIED |
| 同一比较器？ | 是（DLL 内二分插入，键空间同族） | STRONG |
| 键空间 | Tile 与 Obj 同一 −1073739xxx 基线族，Obj(zM=0) 比 Tile 小 17990 → **Tile 先画（垫底）** | STRONG |
| 层惩罚 | 层差 = 30000/层（两种键一致） | VERIFIED |
| Background | 独立 `index*1000` 键空间（不与 Tile/Obj 同空间） | VERIFIED（旧文档） |
| 相同键顺序 | WZ 顺序（Henesys 实测：35→34 同键保持 WZ 序）→ **稳定插入** | VERIFIED（样本） |
| Avatar | zmap.img 149 层用于部件内排序；Avatar vs Obj 的插入 = 同容器运行时路径（进图后） | RUNTIME-REQUIRED |
| 排序时机 | 加载时插入（`即时（加载时）推入时序容器`，非每帧重排） | VERIFIED |

## 残留（RUNTIME-REQUIRED）
1. [0xBE2788] 对象的**确切虚表地址**（进图转储读 `[[0xBE2788]]` 一个 dword 即闭合）
2. DLL 内二分插入比较器（读 Gr2D 内插入函数体——需定位 0xB4 在真实虚表上的目标）
3. Avatar 条目插入键构造（进图后运行时路径）
