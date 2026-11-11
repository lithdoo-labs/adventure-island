# 渲染引擎 DLL 普查（L2 交付）

日期: 2026-11-11。方法：Ghidra 无头反编译 5 DLL + PE 导出表 + 字符串锚点。
反编译位置：`E:\ghidra-projects\dlls\<名>-decompiled.csv`。

## 架构总览（一级发现）

客户端渲染栈基于自研 **PCOM 组件框架**（COM 风格：全部导出
DllCanUnloadNow/DllGetClassObject，共享 Pc* API）：

```
NameSpace.dll ── WZ 包文件系统（Package/File System/PackageWriter 类）
      │ 提供 WZ 节点树
ResMan.dll ──── 资源缓存（GetCachedObject；"_ResMan__Failed_in_GetCachedObje" 诊断串）
      │ 缓存
Canvas.dll ──── 精灵画布系统（Canvas/Property/Font 类；含 "origin" 属性字串
      │           = WZ 画布 origin 字段的运行时对应物！）
Shape2D.dll ─── 碰撞几何（Convex2D/Vector2D/PolyShape2D 类
      │           = foothold/ladderRope 的运行时形状体系！）
Gr2D_DX8.dll ── Direct3D 8 渲染器（Direct3DCreate8；1264 函数）
```

## 函数库存（新增 5,112 函数入语义图集语料）

| DLL | 函数数 | 字符串引用函数 | 关键锚 |
|---|---|---|---|
| Gr2D_DX8 | 1,264 | 16 | Direct3DCreate8, D3D8_DLL, PCOM_DLL, PcCreateObject |
| Canvas | 1,629 | 10 | Canvas/Property/Font 类名, **origin** |
| Shape2D | 649 | 10 | Convex2D/Vector2D/PolyShape2D 类名 |
| NameSpace | 1,292 | 7 | Package/FileSystem/PackageWriter 类名 |
| ResMan | 278 | 5 | GetCachedObject 诊断串 |

每 DLL 的字符串锚点已存 `atlas/<DLL>-STRING-ANCHORS.csv`。

## 对实现的意义

1. **Shape2D 的 Convex2D/Vector2D** 就是 foothold 碰撞的运行时类型——
   与 MapleStory.exe 侧的 FUN_00548806 解密几何遥相呼应
2. **Canvas 的 origin 属性** = WZ 画布数据里 origin 字段的运行时名字
   （RENDER-MAP-SCENE-CONTRACT 的坐标锚点）
3. **NameSpace 的 Package/FileSystem** = wzpy 所解 PKG1 格式的客户端原实现——
   两种实现对读可互证
4. Gr2D_DX8 是纯 D3D8 管线（现代实现可直接换 WebGPU/Canvas 等价物，
   只需保留语义层契约）

## RTTI 类名收获（DLL 保留了 RTTI，主 exe 没有）

字符串全量转储（RENDER-DLL-STRINGS.csv，2,014 条）中的 `.?AVCWz*` 类名：

| 类名 | DLL | 语义 |
|---|---|---|
| CWzGr2DLayer | Gr2D_DX8 | **渲染层**（Gr2D_DX8#Gr2DLayer） |
| CWzRawCanvas / CWzCanvas / CWzDIBRawCanvas | Canvas | 画布体系 |
| CWzClipToken | Canvas | 裁剪令牌 |
| CWzFont | Canvas | 字体 |
| CWzVector2D / CVectorAux | Shape2D | 向量 + 辅助 |
| （Gr2D 引用）WzFlashRenderer.dll / RenderFlash | Gr2D_DX8 | Flash 渲染模块（未随包） |

PCOM 组件命名法：`<DLL>#<Class>`（如 Shape2D#Convex2D）。
工厂机制：DllGetClassObject → GUID 注册链表（FUN_51402fb6 通用查找）→ 创建分派。
Canvas 的 `origin`（UTF-16 @0x2d6b4）= WZ 画布 origin 属性运行时名 ✓。

**注**：DLL 反编译 CSV 的 'rva' 列实为 VA−0x400000（导出脚本沿用主 exe 习惯）；
DLL 真实 VA = CSV 值 + 0x400000，节表 raw==vaddr，文件偏移 = VA − PE 基址。

## 下一步（L2 深挖顺序）

**已试**：标准 MSVC RTTI COL 链在 DLL 中**不成立**（TD 被代码区直接引用，
无 COL 结构——RENDER-DLL-VTABLES.csv 为空是预期结果，非 bug）。
正确路径 = PCOM 注册链：`DllGetClassObject(Gr2D)=FUN_50401a98+DAT_50439b28`，
经 PCOM 名（如 "Gr2D_DX8#Gr2DLayer"）分派创建；FUN_50405aff 是 CWzGr2DLayer
静态初始化守卫（type_info::raw_name 引用其 TD）。

**已试（第五日）**：注册表静态走查——5 个 DLL 的注册表 DAT 在文件态**全零**
（运行时由 DllMain/静态初始化器构建，如 Gr2D 的 FUN_50405aff 守卫模式）。
静态正路 = 找**注册调用**（调用注册 API 传类名字符串+创建函数的静态初始化函数），
或运行时转储后走查。RENDER-DLL-PCOM-REGISTRY.csv 空为预期结果。

1. 搜各 DLL 中引用 u_<类名> 字符串的静态初始化函数 → 注册调用点 → 创建函数清单
2. Canvas 属性序列化（PcSerializeString 链）→ WZ 属性运行时表示
3. Shape2D CWzVector2D 布局 → foothold 记录互证
4. NameSpace Package 加载 → 与 wzpy 互证 PKG1 细节
