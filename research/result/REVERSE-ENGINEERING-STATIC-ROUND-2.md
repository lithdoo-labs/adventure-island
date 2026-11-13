# 静态逆向第二轮总报告（REVERSE-ENGINEERING-STATIC-ROUND-2）

日期: 2026-11-13。基线 `ab23b172`。

## 1. 素材确认

game-image-unpacked.bin ✓ / 5 DLL 原文件 ✓ / 反编译 CSV ✓ / capstone ✓。全部在场。

## 2. R13 接口身份恢复（本轮核心突破）

### RTTI 类名表（32 类，全 DLL 扫描 `.?AV` 模式）
Gr2D: **CWzGr2DLayer, CWzRawCanvas** · Canvas: CWzCanvas/CWzClipToken/CWzDIBRawCanvas/CWzFont/CWzStream · Shape2D: CVectorAux/CWzVector2D/CWzStream · NameSpace: CWzNameSpace/CWzFileSystem/CWzPackage/CWzArchive/CWzRawArchive/CWzNameSpaceProperty/CArchiveSource

### ATL 接口映射（intmap 扫描，7 张表）
| vtable | intmap | 类 |
|---|---|---|
| 0x5042D140（40 槽）| 0x5042D1E0 {E576EA33@0, IUnknown} | **CWzGr2DLayer** = [0xBE2788] |
| 0x5042E2C4（151 槽）| 0x5042E520 {6DC8C7CE > F28BD1ED > 4CFB57C7 > 01110BC6 > IUnknown} | **CWzRawCanvas** = 插入容器 |
| — | 0x5042E600 {DF0B3D60@0, 312126F0@+4, 905BE84C@+8} | 真·三重虚表对象 |

虚表-映射表精确衔接验证：0x2D140+40×4=0x2D1E0 ✓；0x2E2C4+151×4=0x2E520 ✓

### IID 家族表（exe 0xBA0500-0xBA0700 扫描）
约 20 个 GUID（含 E576EA33@0xBA0570、6DC8C7CE@0xBA0510、F28BD1ED@0xBA0500 等）= 客户端 IID 注册块。**tile 插入错误路径用 0xBA0510 ≠ [0xBE2788] 创建用 0xBA0570** → 两接口判定分离（修正 v1 合并错误）。

### 调用链终局（全指令级）
```
CWzGr2DLayer::CreateRawCanvas(0x427eb3) ← [0xBE2788](0x666ebc)
  → CWzRawCanvas 存 [ebp-0x10]（0x666ed5）
  → 智能指针 GET(0x42944a)
  → vtbl[45] Insert(key)（0x666f7d；cmp=HRESULT）
```
slot45 = 委派桩 0x5042A610 `jmp [0x5042D0A0]`（表值 0x34046-0x34116 = 运行时补丁占位）→ **身份 CLOSED-STATIC；比较器体 OPEN-RUNTIME（1-dword 读取）**

## 3. 移动对象区函数修正（SEC16 两处纠错）

| 地址 | SEC16 旧标 | 实测（本轮） |
|---|---|---|
| 0x9C0EC0 | "+0x58 写者" | **四 IID QueryInterface 分派器**（memcmp {0xb0e760,0xbd37b0,0xba0378,0xba0500} + E_NOINTERFACE + adjustor-AddRef）|
| 0x9BC401/0x9BC404 | "+0x110 写者" | **移动位置/状态解密-序列化器**：4 对解密（edi+0x20 基：+0/+0x18/+0x30/+0x48 值，+0x10/+0x28/+0x40/+0x78 键）= x/y/vx/vy；状态 [edi+0x16c]≠0→0x11 / [edi+0x118]≠0→0xF；0xa70f94 浮点→包字段 |

0x9BC404 = **移动物理↔网络包的桥接函数**（新发现）。

## 4. +0x3BC 追踪（续）

本轮在 0x9C0EC0/0x9BC404 均未发现 +0x3BC 递减。两函数与计时器无关（身份已正）。减计数维持 OPEN-RUNTIME（计算位移循环假说未排除）。

## 5. Avatar 遮挡

63-avatar-occlusion.md 第 11 节 5 项：本轮聚焦 R13/移动区，未及分析——保留 OPEN-STATIC（下轮）。已在台账更正状态（非 RUNTIME）。

## 6. PCOM/COM 映射进展

新产出（静态可复现）：
- RTTI 32 类名表（rtti-run.log）
- 7 张 ATL 接口映射 + IID 家族（intmap-run.log）
- CWzGr2DLayer/CWzRawCanvas 的 vtable↔intmap 精确绑定

## 7. 缺口台账更新

REVERSE-ENGINEERING-GAP-REGISTER.md 更新：
- G01（R13）→ CLOSED-STATIC（身份/拓扑）+ OPEN-RUNTIME（比较器体）
- G06 收窄为 "[0x5042D0A0] 委派表运行时值"
- 新增 G18（0x9C0EC0 QI 的 4 IID 对象身份）、G19（0x9BC404 序列化器的完整签名）

## 8. 已闭合/部分闭合/运行时

- **CLOSED-STATIC**：R13 身份链、RTTI 类表、接口映射、排序键、稳定插入、0x9C0EC0、0x9BC404
- **OPEN-RUNTIME**（8→6 项，G06 收窄 + Avatar 项回 OPEN-STATIC）：委派表值、Avatar 注册键、Camera 跟随、+0x61、+0x3BC 减计数、WINMM 序列、DLL 基址
- **OPEN-STATIC**：Avatar 遮挡 5 项、委派表静态替代路径

## 9. 对地图场景 ABI 影响

1. 渲染容器 = **每层一个 CWzRawCanvas**（非全局单列表）——loom-realm 应实现 per-layer ordered list
2. 插入 = 加载时一次性（稳定）——无需运行时排序器
3. 层对象经由根层工厂创建——场景图 = Layer→RawCanvas 两级

## 10. 下轮建议

1. Avatar 遮挡 5 项静态分析（63-avatar-occlusion §11）
2. 委派表 0x5042D090 的静态替代路径（导出序号表假说检验）
3. 0x427eb3 全文（CreateRawCanvas 参数结构）
