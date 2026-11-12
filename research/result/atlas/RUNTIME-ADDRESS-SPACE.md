# 运行时地址空间重建（CR3 突破）

日期: 2026-11-12。**t036 转储的完整地址空间重建成功**——此后无需新捕获即可读取任意游戏运行时状态。

## 地址空间结构（PAE 模式，XP 单 PD 复用）

| 层 | 物理地址 | 说明 |
|---|---|---|
| **PDPT (=CR3)** | **0x3f6ec000** | 4 项全指向同一 PD（32 位 PAE 惯例）|
| PD | 0x3f7e9000 | 512 项 × 2MB |
| PT (镜像区 0x400000-0x800000) | 0x3fc7f000 | VA 0x400000 = MZ ✓ |
| PT (0x600000-0x800000) | 0x3e96c000 | 锚点验证 ✓ |
| PT (0x800000-0xA00000) | 0x3e74a000 | |
| PT (0xA00000-0xC00000) | 0x33940000 | 锚点验证 ✓ |

验证：VA 0x600000 → PA 0x3ec89000 内容匹配 ✓；VA 0xA00000 → PA 0x3f00c000 ✓

## 关键运行时事实

### 游戏DLL 加载状态（时间戳修正）
- ❌ **修正**：此前"Canvas 在 0x50000000"判断错误——该模块 ts=49B9F6AE/4 区段，而 Canvas 是 ts=4B61A347/5 区段
- 全地址空间 PE 扫描：仅 5 个系统模块（游戏 exe 映射视图 @0x400000 + 4 个 2008-2009 系统模块如 iedkcs32）
- **结论：捕获点（自旋锁 4.9MB 预模态）在 DLL 加载之前——原"DLL 不在转储中"结论恢复成立**

### 运行时全局（角色选择画面快照）
| 全局 | 运行时值 | 解读 |
|---|---|---|
| 0xBDD498 Physics | **NULL** | 无地图 → 物理对象未建 ✓ 一致 |
| 0xBA59B8 攻击表 | NULL | 同上 |
| 0xBDDB10 动作表 | **0x29d2ec**（低地址堆） | 动作表在低堆，非镜像内 |
| 0xBE2000 字符串表 | **0x29a6fc** | 同上 |
| 0xBDF54C field | [0, 0xbdef20, 0x3376aa, 0x3376dc] | 部分初始化 |

### 动作表运行时内容（149 槽）
ASCII + UTF-16 成对存储。确认名称序列：
```
stand, stand0, stand1, jump, fly, walk1, walk2, stand2, alert,
swingO1/O2/O3/OF, swingT1/T2/T3/TF, swingP1/P2/PF,
stabO1/O2/OF, stabT1/T2/TF, shoot1/2/F, heal, proneStab, prone,
ladder, rope, dead, sit2-6, tired, alert2/3
```
**新发现武器专属变体**: `swingT2PoleArm`, `swingP1PoleArm`, `swingP2PoleArm`（长枪动作集）

### 字符串表运行时内容
含 `zmap.img`, `smap.img`, `brow` —— WZ 命名空间名直接可读

## 此前"不可达项"状态更新

| 项 | 之前 | 现在 |
|---|---|---|
| 字符串表 ID→名 | 需进图转储 | ✅ **转储中直接可读**（0x29a6fc） |
### DLL 不在转储
| 项 | 之前 | 现在 |
|---|---|---|
| DLL 不在转储 | 不可达 | ✅ **确认**（时间戳验证：捕获点在 DLL 加载前；转储内仅系统模块）|
| 运行时对象状态 | 不可知 | ✅ 全地址空间可走查 |

## 方法论（已可复用）

```
1. 锚点: 镜像唯一代码字节 → 找物理页
2. PTE 搜索: dword = PA|flags, present 位, 8 对齐（PAE!）
3. PT → PD（entry idx = VA>>21）→ PDPT → CR3
4. 陷阱: 转储含孤儿页（待机页 PTE 已清），必须用活动 PT 链验证
```

## 资产
- CR3-FOUND.txt：地址空间参数
- MOTION-TABLE-RUNTIME.csv：149 槽运行时动作表
- STRING-HEAP-RUNTIME.csv：810 条堆字符串
