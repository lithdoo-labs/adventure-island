# RawCanvas 容器语义（MAP-RAWCANVAS-CONTAINER-SEMANTICS）

日期: 2026-11-13（Round 3 补完）。证据等级标注 A/B/C。

## 1. 0x427EB3 = 通用属性 PUT 助手（A 级）

### 事实
- **240 个直接调用点**（E8 rel32 全扫描，RAWCANVAS-CALLSITE-ANALYSIS.csv）
- 分布：UI 构建器（KeyDownBar 等）、地图加载（0x666ed5 tile / 0x669be1 obj 区）、移动、效果、全境
- 本体：封送 2×16B VARIANT 结构 → `call [层虚表+0x64]`(slot25) → 错误报告 IID=E576EA33 → `*out = 原参数结构`
- slot25 实测（0x50403FBE）= `this->[0xCC] = value`（平凡 setter）

### 结论
0x427EB3 = **PutProperty(layer, ...)** 的 ATL 风格包装（B 级：240 点通用用法 + setter 指令级）。
"CreateRawCanvas" 叙事（Round 2）**不成立**。

## 2. Tile/Obj 路径的对象来源（A 级）

tile 函数（0x666C0D 族）在 0x666ed5 调用前：
```
0x666ea1: call 0x411fe1(&[ebp-0x38], [ebp-0x14], 1)   ← WZ 属性读取 → VARIANT
0x666ebc: ecx = [0xBE2788]                             ← CWzGr2DLayer
0x666ed5: call 0x427EB3(layer, ..., [ebp-0x38], ..., &[ebp-0x10])
```
[ebp-0x10] ← VARIANT 参数携带的对象 = **WZ 画布对象**（tile 的 canvas 资源）。
层在此仅做属性登记（+0xCC）。

## 3. 容器关系裁定（三种假说检验）

| 假说 | 判定 | 证据 |
|---|---|---|
| A. Tile/Obj 共用一个 RawCanvas 实例 | **不能成立为"实例"级**（B 级否定） | 每个实例有独立 [ebp-0x10] 局部；来自各自 WZ VARIANT |
| B. 不同实例、相同排序实现 | **部分成立**（B 级） | 同一 [eax+0xB4] 调用形态；具体类依 VARIANT 运行时内容 |
| C. 不同容器/键空间/批次 | 键空间**同族**（A 级：两公式同基线 -107373xxxx）；批次未知 | 键公式机器码 |

**最终状态**：键计算（EXE 侧）与对象登记（层 +0xCC）已闭合；**容器/排序实现体未定**（"有序插入"语义已被 22 候选分类否定，Claim C-013 SUPERSEDED；调用语义依 [ebp-0x10] 具体类 → R-09 运行时 1 dword）。

## 4. 实例生命周期（A/B 级）

```
出生: WZ 属性读取（VARIANT）→ [ebp-0x10]
登记: 层->PutProperty(+0xCC)
使用: [eax+0xB4] 调用（具体类决定语义）
销毁: 0x666f7d 后续链 = VARIANT 清理(0x4029b7) + Release([ecx+8])
      若具体类=0x2E2CC: slot45 = 删除型析构（vtable 换基 0x2E380 + 基类析构 + 条件 delete）
```

## 5. Background / Avatar

- Background：独立键空间 index×1000（A 级，旧档）；本轮 240 点中未见 tile/obj 路径与 background 共用痕迹
- Avatar：注册路径为运行时（进图后）；本轮无新静态证据
