# R13 Final Round 4（MAP-R13-FINAL-ROUND4）

日期: 2026-11-13。基线 61f9a1cb。本轮完成 slot45 全分类 + Obj 通道分离证据。

## 1. slot45 复杂体终裁（8 个全部闭合，A 级）

| DLL | RVA | 身份 | 关键指令 |
|---|---|---|---|
| Canvas 0x17517 | **属性 put/get 对** | `[arg1+0x8C]=arg2; ret 8` / `out=[arg1+0x90]` | 与 Layer slot25/26 同构（Canvas 版偏移 0x8C/0x90）|
| Canvas 0x85f0 | 析构族 | dtor + 条件 operator delete(0x500066e0) | |
| Gr2D 0x3022c | **非代码**（字符串数据）| 原始字节 = ASCII（"colors" 等）| vtable 0x2F530 = **伪虚表**（字符串表误判）|
| Gr2D 0x143d8 | **浮点变换体** | fld/fadd/fsub ×4 分量，读 3 指针 ×16B 结构 | 矩阵/顶点算术，非插入 |
| NameSpace 0x1DC6 | **转发 thunk** | push×5 → jmp 0x50808005 | |
| NameSpace 0xC1BF | **流读循环** | `call [eax+8]` 直至 count 字节传完 | stream read-all |
| Shape2D 0x1B36 | **经 [0x5140C004] 表调用** | 函数指针表跳转 | |
| Shape2D 0x4245 | 复杂体（同族 0x1B36 模式）| | |

**22/22 候选全分类完成。零插入语义。**（G25 维持 CONTRADICTED-WEAK）

## 2. Obj 通道分离（推翻"共用容器"，A 级）

```
OBJ 路径（0x66885B 实测）:
  0x7A48D0(&var, 0x31D)           ← 字符串表取根（ID 0x31D ≠ Tile 的 0x819）
  0x40634C → [eax] → 0x447891(out, obj, 0)  ← 另一 CoCreate 族创建
  键: imul eax, eax, 0x7530       ← layer × 30000 ✓（A 级维持）
      lea eax, [eax+ecx-0x3FFFF830] ← + z − 1073739824 ✓
  调用: 0x43286E / 0x44484B / 0x429411 / 0x43E3A6（栈封装 cdecl，
        每个调用点 mov ecx,esp; mov [ebp+0x30],esp 构造临时 this）
```

**结论**：
- Tile 用 `[0xBE2788]` 层 + `0x427EB3` 属性 PUT + `[eax+0xB4]`
- Obj 用 `[ebp-0x1C]` 根 + `0x447891` 创建 + **栈封装多调用**
- **不同 this、不同创建器、不同调用模式** ⇒ 情况 C（不同容器/通道），非 A（共用）
- 键公式族同构（层×30000 系数 + 基线 −1073739xxx）= **同一键空间设计**，但执行通道独立

## 3. Background

imul 1000 扫描仅 1 站点（0x423E6B，上下文不足）——Background 键 `index×1000` 维持旧档 B 级（来源文档），本轮无新证据。

## 4. Avatar 插入链

静态未及（Avatar 注册路径需进图运行时——维持 R-03）。

## 5. 比较器 / 相等键 / 排序方向

22 候选无比较器 ⇒ 比较器不在虚表 slot45 中。可能位置：
- DLL 内非虚表函数（栈封装调用的 0x43286E/0x44484B 族内部）——Shape2D 0x4245 模式（经函数表间接）是下一静态目标
- Canvas.dll 绘制遍历内联比较
- **维持 OPEN-STATIC**（非 RUNTIME：栈封装目标函数可静态读）

## 6. Render ABI 边界终论

| 项 | 可冻结 | 依据 |
|---|---|---|
| 键公式（tile/obj）| ✅ | A 级独立 |
| 键空间统一 | ✅ | 同构系数/基线 |
| Tile/Obj 通道分离 | ✅ | 本轮 A 级 |
| 有序插入假设 | ❌ | 22 候选零支撑 |
| 比较器语义 | ❌ | 未定位（栈封装内待读）|
| Background 键 | ⚠ B 级 | 旧档维持 |
