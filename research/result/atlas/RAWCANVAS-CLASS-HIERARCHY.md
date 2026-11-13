# RawCanvas 类层次（RAWCANVAS-CLASS-HIERARCHY）

日期: 2026-11-13。Round 3.1 Task2-A。基于 R31-B RTTI 取证 + intmap 扫描 + slot45 全反汇编。

## 证据基础（等级标注）

- 类型描述符（.data，无 COL 链）：`.?AVCWzRawCanvas@@`@Gr2D 0x36520、`.?AVCWzGr2DLayer@@`@Gr2D 0x36500、`.?AVCWzCanvas@@`/`.?AVCWzDIBRawCanvas@@`/`.?AVCWzClipToken@@`/`.?AVCWzFont@@`/`.?AVCWzStream@@`@Canvas、`.?AVCWzVector2D@@`/`.?AVCVectorAux@@`@Shape2D（**名字存在，类绑定 = C 级邻近推断**）
- ATL intmap（结构证据 B 级）：Gr2D 7 张、全库唯 Gr2D 携带多张
- slot45 全表（本轮 A 级反汇编分类）：22 候选无一插入语义

## 类层次（可证部分）

```
Gr2D_DX8.dll
  CWzGr2DLayer（intmap@0x2D1E0 {E576EA33@0}）
    vtable 族 A 起点 0x2D140（40 槽；slot25=put [arg1+0xCC]；slot26=get [arg1+0xD0]+AddRef）
  CWzRawCanvas 族（intmap@0x2E520 {6DC8C7CE>F28BD1ED>4CFB57C7>01110BC6>IUnknown}）
    虚表块 0x2E2C4-0x2E520：起点歧义（0x2E2C4 151 槽 vs 0x2E2CC 149 槽，均精确衔接）
    读法 A（0x2E2C4）：slot45 = purecall（抽象槽 3-44 连续）
    读法 B（0x2E2CC）：slot45 = 0x4FB1 删除型析构（读法 A 下位于槽 43）
    0x2E380 = 析构换基目标，自身亦为 102 槽虚表起点（同族）
    0x2BAB = 族内另一 deleting-dtor 变体（换基 0x2E36C）

Canvas.dll
  CWzCanvas（104 槽虚表 0x270E8 族；slot4 = ATL 库签名 QI）
  CWzDIBRawCanvas / CWzClipToken / CWzFont / CWzStream：RTTI 名存在；
    与虚表绑定未证（无 COL）——C 级

Shape2D.dll
  CWzVector2D（名字类 L"Vector2D" @DllGetClassObject；RTTI 名在）
  0xC2C8 85 槽虚表 slot45 = 多字段 getter（[edi+0x24] 检查 + [edi+0x1C/+0x20/...] 填 4 个出参）——本轮 A 级
```

## 可实例化 vs 抽象 vs 视图

| 虚表 | 判定 | 依据 |
|---|---|---|
| Gr2D 0x2D140 | 具体可实例化（[0xBE2788] 运行时持有）| exe 创建链 + 195 读者 |
| Gr2D 0x2E2C4 族 | **混合**：读法 A 下 slot3-44 抽象（purecall）→ 若对象用此表则该类在这些槽不可调用；读法 B 下槽 3-44 同样 purecall。**该族任何对象都不能经 slot45 走"插入"(SUPERSEDED: 假设已被 R4 全分类否定)** | slot45 ∈ {purecall, dtor}（联合 A 级）|
| Canvas 0x270E8/0x27364 | 具体类虚表（ATL 库签名出现）| B 级 |
| 其余 | 无法区分具体/视图（无 COL） | — |

## this 指针偏移

仅一处可证：intmap@0x2E600 {312126F0@+4, 905BE84C@+8, DF0B3D60@+0} = **真·多重继承对象**（三接口三虚表，偏移 0/+4/+8）。其余 intmap 全部 offset=0（单接口视图）。

## 反证检查（按任务书 §四）

- 其他类满足证据？CWzDIBRawCanvas（Canvas）名字含 RawCanvas 但在 Canvas.dll——与 Gr2D 的 6DC8C7CE IID 无关（该 IID 字节唯一在 Gr2D）✓ 排除
- 继承视图偏移误判？intmap offset=0 主导；0x2E600 的 +4/+8 已单独标注 ✓
- ATL thunk / adjustor？slot25/26 为直体小函数非 thunk ✓；0x4FB1 为真析构非 adjustor（有条件 delete）✓
- deleting-dtor 误判？0x4FB1/0x2BAB 均带 vtable 换基 + 条件 operator delete = 标准 deleting dtor ✓
