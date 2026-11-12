# Shape2D 形状库语义（第十七轮）

日期: 2026-11-13。四接口差异化槽位精读。

## 四接口家族（85/66/65/79 方法）

### 共同结构（ATL COM 标准布局）
slot0=QI / slot2=Release / slot3=dtor（全家族统一）

### shape-A/B/C（相似三兄弟）
- slot10（375c）= 委托式接口查询（经 +0x10/+0x40 子对象）
- slot13（~300c）= E_POINTER 检查方法
- **slot14（2,673c）= _CIP\<IBinding\> 异步绑定操作**
  （ATL URL moniker = 异步资源加载 —— 对应 PackageWeb/FileSystem 类名！）

### shape-D（79 方法，几何运算主体）
- slot6（807c）/ slot8（514c）= 位运算几何方法（+8 字段位操作）
- **slot12/slot13（599c 成对同构）= 几何运算主方法**（thiscall(this, p1, p2) + 内嵌 16 字节 COM 对象构造）

## 接口 IID 数组（修正）
0x514100f0 = {AC8DAF42-4F7833B1-...} **接口 GUID 表**（此前误读为工厂对象）
DllGetClassObject 的 Vector2D/Convex2D/PolyShape 名字 → IID 表 → 实现对象

## 架构结论

Shape2D = 几何运算 + **异步资源绑定**双职能：
- 几何：向量/凸包/多边形运算（shape-D 主体）
- 绑定：_CIP<IBinding> URL moniker 异步加载（与 PackageWeb 互证）
