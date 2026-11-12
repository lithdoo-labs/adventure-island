# 客户端技术栈全景（第十五轮里程碑）

日期: 2026-11-13。Ghidra 库签名匹配 + 方法精读综合。

## 技术栈（67 个库签名级证据）

| 层 | 证据 |
|---|---|
| **ATL**（COM 框架） | CMFCComObject\<T\>::QueryInterface/Release、CAccessibleProxy::_InternalQueryInterface、_ATL_INTMAP_ENTRY（接口映射表！）、InlineIsEqualUnknown |
| **MFC** | CAsyncPropExchange、CDHtmlEventSink、CArray |
| **STL** | std::_Vector_val、std::allocator、std::basic_string |
| **boost** | exception_detail::refcount_ptr |
| **Concurrency (PPL)** | Concurrency::details |
| **comutil** | _com_error、_CIP\<IBinding\>（COM 智能指针） |
| **CRT** | __allshl/__aullshr/__alldiv（64 位数学） |

## 架构定论

1. **"PCOM" = 标准 ATL COM**：
   - QueryInterface 硬编码 IID_IUnknown = ATL::InlineIsEqualUnknown 的内联
   - 接口映射表 PTR_DAT_50817518 = **_ATL_INTMAP_ENTRY 数组**（ATL 标准机制）
   - CMFCComObject = MFC 的 ATL COM 对象包装
2. **开发者可以直接参考 ATL 源码**（atlcom.h 公开）实现兼容层
3. 虚表布局 = ATL 聚合/继承的标准产物（解释了三重虚表、继承链切片）

## Shape2D 四接口（A/B/C/D）结构统一证实
slot0=QI、slot2=Release、slot3=析构——全部标准 ATL COM 对象布局；
差异在 slot4+（各形状特有操作）。

## ResMan 加载器核心再确认
slot7（10,895 字符）= variant + wide-str + math-heavy = WZ 资源头解析主体

## 资产
- ATL-LIBRARY-MATCHES.csv（67 项）
- DLL-METHOD-SEMANTICS.csv（330 方法标注）
