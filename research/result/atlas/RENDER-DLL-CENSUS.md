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

## 下一步（L2 深挖顺序）

1. Canvas.dll 的属性序列化（ PcSerializeString 链）→ WZ 属性运行时表示
2. Shape2D 的 Convex2D 构造 → foothold 运行时记录布局（对照 move+0x198）
3. NameSpace 的 Package 加载 → PKG1 解析的原版逻辑（与 wzpy 互证加密细节）
4. Gr2D_DX8 绘制调用链 → 合成顺序（z 序执行侧）
