# loom-realm Render ABI 冻结建议（Round 3 终版）

日期: 2026-11-13。依据三轮 R13 静态证据闭合。

## 可以冻结（A/B 级证据）

| 项 | 证据 | 冻结内容 |
|---|---|---|
| **排序键公式** | A（lea 机器码 + Round3 复核） | `tile = z + 10*(layer*3000 - zM) - 1073721834`；`obj = layer*30000 + z - 1073739824` |
| **键空间性质** | A | tile/obj 同族（-1073739xxx 基线）；层差惩罚 30000/层 |
| **层成员登记模式** | A | 层对象持成员注册槽（+0xCC put / +0xD0 get+AddRef 对偶） |
| **Tile/Obj 独立读取** | A | 各自独立 WZ 属性读取 → 独立实例对象 |
| **Background 独立键空间** | A（旧档） | index×1000，不与 tile/obj 同空间 |
| **静态注册模型** | A | 加载时登记（非每帧重排） |

## 暂不能冻结

| 项 | 原因 | 阻塞点 |
|---|---|---|
| 容器内部实现 | [ebp-0x10] 具体类 = variant 运行时值（R-09） | 1 dword 进图读取 |
| slot45 语义裁定 | 不同实现类 slot45 不同（析构/插入/解码三态） | 同上 |
| 相等键的稳定性 | 依赖容器实现体 | 同上 |
| Avatar 排序键 | 运行时注册路径 | 进图观测 |

## 推荐兼容实现（任务书 §10 对齐）

```cpp
// Render ABI v2 草案（不绑定未证实的原版容器）
interface ISceneBucket {
    void RegisterTile(RenderKey key, TileRef tile);      // 独立注册
    void RegisterObj(RenderKey key, ObjRef obj);          // 独立注册
    void RegisterAvatar(RenderKey key, AvatarRef av);     // 独立注册
    void RegisterBackground(BgIndex idx, BackRef bg);     // 独立队列能力
    RenderKey MakeTileKey(int32 z, uint8 layer, int32 zM);   // 公式内置（A 级）
    RenderKey MakeObjKey(int32 z, uint8 layer);              // 公式内置（A 级）
    // 策略可替换：统一排序 / 分批绘制（layer 批次）
};
```
- 排序方向默认**键升序**（层 0 垫底），可配置——待 R-09 后固化
- 相等键默认**保持注册序**（稳定）——与 WZ 顺序观测一致（Henesys 样本）
- 内部容器 = 实现细节（std::multimap / stable_sort vector 皆可替换）

## R-09 解锁后的预期替换

进图 1 dword（[[ebp-0x10] 对象虚表]）→ 裁定 slot45 → 若为插入实现则读 Gr2D 内比较器体 → 固化排序方向与相等策略。ABI 无需破坏性变更（仅实现替换）。
