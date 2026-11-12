# 第九轮：纯静态路径成果（回应"为什么不直接从代码着手"）

日期: 2026-11-12。用户提出方法论挑战后，验证静态路径 —— **成果证明该质疑完全正确**。

## 1. PCOM 类系统全静态解码（推翻"GUID 注册表需运行时"）

### 类标识 = UTF-16 名字（非 COM GUID）
从 5 个 DLL 的 `DllGetClassObject` 导出（标准 COM 静态机制）反汇编：

| DLL | 类名（DllGetClassObject 比较的 rclsid 内容） |
|---|---|
| Gr2D_DX8.dll | `Gr2D_DX8` |
| Canvas.dll | `Canvas`、`Font` |
| Shape2D.dll | `Vector2D`、`Convex2D`、`PolyShape` |
| NameSpace.dll | `NameSpace`、`FileSystem`、`Package`、`PackageWeb` + 4 个真接口 GUID |
| ResMan.dll | `ResMan` |

### exe 侧 PCOM API 表（0xba7588）
```
PcInitModule / PcRootNameSpace / PcSerializeString / PcSerializeObject /
PcFreeUnusedLibraries / PcCreateObject（按名创建 = CoCreateInstance 等价）/ PcTermModule
```

## 2. 音频系统答案（"音频 60%"的最大缺口）

动态加载表（0xba7514-0xba7578）发现 **WINMM.dll**：
```
WS2_32.DLL（网络）、WINMM.dll（音频=Windows 多媒体 waveOut/MCI）、IMM32.dll（输入法）、
SHELL32.dll、ADVAPI32.dll、GDI32.dll、Ole32.dll、User32.dll、Kernel32.dll
```
**音频机制 = WINMM 动态加载**（这就是全语料 0 静态音频导入的原因）。
实现路径明确：Sound.wz 数据 + WINMM API（waveOutOpen/mciSendCommand 族）。

## 3. 动态导入哈希解析机制

0xba6434 = 哈希解析表：{DLL 名指针, API 名哈希×N}（WS2_32 项含 15 个哈希）。
加载器在保护壳桩内（经典哈希混淆）。运行时 [0xafeXXX] 表 = 解析结果。
经典算法（ROR13 等）测试不匹配 → 自定义算法，需壳桩代码。

## 4. 方法论结论

用户的质疑正确：此前标记"需运行时数据"的项中，至少以下可纯静态解决：
- ✅ 类标识系统（DllGetClassObject = 标准 COM 静态机制，从未检查过）
- ✅ PCOM API 表
- ✅ 音频机制（动态加载表扫描）
- ⚠️ 哈希算法（需壳桩）、运行时对象值（需真转储）仍需动态数据

**修正**: 今后凡"需运行时"标记必须先穷尽：导出表 → 字符串表 → 结构常量 → 反汇编开关
这四层静态路径后才能成立。

## 资产
- comstatic-run.log / comstatic2-run.log（DllGetClassObject 反汇编）
- pcapi-run.log（PCOM API + DLL 表完整 dump）
- dyntable-run.log（哈希表结构）
