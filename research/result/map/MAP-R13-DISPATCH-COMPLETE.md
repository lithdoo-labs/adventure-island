# R13 派发链完整解析（MAP-R13-DISPATCH-COMPLETE）

日期: 2026-11-13。Round 3.1 Task2-D（最高优先级）。全链含 A 级证据与新发现的静态自相矛盾点。

## 完整调用链（实测）

```
[TILE 函数体 0x666749..0x666FC5]

① SEH 帧: [ebp-0x10] ← esp ×8（0x66677C..0x666B6D）      ← try 块边界（A）
② EBX ← 0 @0x666C20                                       ← cmp 基准确认（A）
③ WZ 属性读链（0x403211 ×5）：
     [ebp-0x38] ← 0x411FE1(ecx=&V38, arg=[ebp-0x14], 1) @0x666EA1
④ 0x411FE1 实测（A）：
     [esi+0] = 0x000D (VT_UNKNOWN)、[esi+8] = arg1、条件 AddRef(vt+4)
   ⇒ V38 = VARIANT{vt=0xD, obj=循环变量}
⑤ 0x427EB3(ecx=[0xBE2788]层, 8 args) @0x666ED5
     args（cdecl 右→左）: arg1=&[ebp-0x10](out), arg2=[ebp-0x20](V20=canvas 对象),
     arg3=edi, arg4-6=0, arg7=&V38, arg8=&V48
     内部: 层->slot25(this=层, arg2=V20) ⇒ [层+0xCC] = V20（A，与 R31-C 一致）
     出参: *arg1 = [ebp+0x24] = arg8 = &V48
⑥ 键计算 @0x666F68: edi = z + (layer*3000 − zM)×10 − 1073721834（A，独立成立）
⑦ 0x42944A(ecx=&[ebp-0x10]) → eax = [ebp-0x10]（智能指针 GET，A）
⑧ eax' = [eax]；call [eax'+0xB4](esi=obj, edi=key) @0x666F7D
⑨ cmp eax, ebx(0); jge → 成功路径（A：EBX=0 实证，jge = hr≥0 即 SUCCEEDED）
⑩ 清理: VARIANT dtor(V68/V20) + [ebp-0x20] Release + [ebp-0x10] 判空 @0x666FBD
```

## ⚠ 静态自相矛盾（新发现，OPEN-RUNTIME 精确化）

严格 cdecl 映射下：⑤ 的出参写入使 **[ebp-0x10] = &V48**（栈地址）→ ⑦ 返回 &V48 → ⑧ 的 [eax] = V48 的 vt 字段 = 0xD = **13** → `call [13+0xB4]` = 调用地址 0xC1 = **必然崩溃**。

⇒ 三种可能（未可静态消解）：
- (a) 该构建的参数序映射与标准 MSVC 右→左相反（编译器变体）
- (b) ⑤ 出参经 [ebp+0x24] 指针的间接层写入（需逐字节仿真 movsd 对）
- (c) 反汇编窗口漏一条 push 改变 arg 编号

**微捕获方案（R-09 最终版）**：
```
断点: 0x666F77（call 0x42944A 返回后）
读取: ESI（对象）、[ESI]（虚表）、[EBP-0x10]（持有者）、[ESI-8..ESI+0x20]（36 字节对象头）
预期: [ESI] = 5 张 DLL 之一的合法虚表 VA → 终裁 22 候选 → slot45 语义随之定
```

## slot45 候选全表裁定（22 表/5 DLL，本轮 A 级分类）

| 类别 | 数量 | 代表 |
|---|---|---|
| import-thunk(purecall) | 5 | Gr2D 0x2E2C4/0x2E8B4/0x366D0、Canvas 0x285E0、NameSpace 0x173EC |
| com-check/throw | 5 | NameSpace 0x17258/0x17548/0x1775C/0x18940、Shape2D 0xC0E0 |
| dtor/dtor-like | 3 | Gr2D 0x4FB1（0x2E2CC 读法）、0x2BAB 族、0x5FC8 族 |
| getter（多字段出参） | 1 | **Shape2D 0xC2C8（[edi+0x24] 守卫 + 4 出参填充）** |
| pixel/convert | 1 | Gr2D 0x1B84D（字节→RGBA，Round2 已证） |
| complex-body（>22 指令） | 7 | Canvas 0x17517/0x85F0、Gr2D 0x3022C/0x143D8、NameSpace 0x1DC6/0xC1BF、Shape2D 0x1B36/0x4245 |

**核心裁定（B 级）**：**22 候选中无一呈现容器/列表/有序插入语义**。
⇒ 原始排序文档"tile 键推入共享容器"的 [eax+0xB4]=插入 解释在**全部已知虚表上均无实现支撑**。
⇒ 备择假设（待 R-09 终裁）：⑧ 实为**属性设置/对象注册/析构清理**之一；真正的排序可能发生在别处（如绘制遍历时的容器内比较，或完全在 Canvas.dll 内部）。

## 排序键公式独立复核（F 工作流）

维持 A 级（0x666F5D-0x666F68 指令重放）：
```
imul ecx, ecx, 0xBB8        ; layer × 3000（有符号）
sub  ecx, esi               ; − zM
lea  ecx, [ecx+ecx*4]       ; ×5
lea  edi, [eax+ecx*2-0x3FFFB1EA]  ; key = z + 10*(…) − 1073721834
```
- 溢出：layer≤7, zM≤~500, z 有符号 16 位级 → 中间值 < 2^31 ✓ 无溢出
- 符号：全部有符号运算（imul/sub/lea）✓
- 键计算时机：加载循环内（每 tile 实例一次），⑧ 调用前
- **键公式成立 ≠ 容器语义成立**（本文件核心结论）

## Tile 与 Obj 是否共用容器

- 共用证据：相同 [0xBE2788] 层引用 + 相同 0x427EB3/0x42944A 模式（obj 路径 0x6688xx 同构）
- 但共用的是**属性注册通道**；插入/排序通道未证 → **PARTIAL**（键空间同族 = 层×30000 量纲一致，B 级）
