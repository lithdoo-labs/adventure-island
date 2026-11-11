# 客户端全量逆向战役总纲（Semantic Atlas Campaign）

日期: 2026-11-11。目标：**把客户端全部游戏逻辑逆向成按功能组织的代码知识库**，
开发时按功能直接查到实现（地址 + 公式 + 数据流）。

## 现状（诚实基线）

| 项 | 数量 | 说明 |
|---|---|---|
| 函数总数 | 52,326 | decompiled_v2.csv |
| **真实语义锚定** | **~1,500** | task-050 档案 ~1,700 分类 + 本会话动作/物理族 + 102 s2c handler + 351 字符串引用函数 |
| task-059 标签 | 51,200 | **结构标签**（ctor_caller/unknown_prologue/leaf_utility），非语义——"95.3% 覆盖"指此 |
| RTTI 类名 | 13 | 仅异常类（CSecurity* 等），RTTI 基本关闭——vtable 类杠杆弱 |
| **渲染引擎** | **未反编译** | Gr2D_DX8.dll / Canvas.dll / Shape2D.dll / NameSpace.dll / ResMan.dll / PCOM.dll 在客户端目录里原封未动 |

图集基线：`atlas/FUNCTION-ATLAS-BASELINE.csv`（51,222 行，208 个语义锚——诚实数字）。

## 五大杠杆（按产量排序）

### L1. 字符串表 ID 破解（预期锚定 1,062 函数）
2,476 处 `FUN_007a48d0(&x, 常量ID)` 调用分布在 1,062 个函数里。
已知锚：853=swingO1…882=ladder（动作族 143 对）。
**破解路径**：t036 转储里字符串表已物化（[0xBE2000]=0x29A6FC），
FUN_007a48d0 经混淆访问器（DAT_00afe084→0xEC0BB4）按 ID 取——
逆向访问器的索引算法（或用已知 143 对 ID 推断表布局）→ 全量 ID→名映射。
产出：1,062 函数 × 用途字符串 = 语义。

### L2. DLL 反编译（渲染引擎本体！）
Gr2D_DX8.dll（252KB）/ Canvas.dll（200KB）/ Shape2D.dll（84KB）未碰。
瓦片合成/精灵绘制/效果全在里面。**Ghidra 无头分析这 5 个 DLL** 即可获得渲染管线源。
（HOWTO 的 Ghidra 命令模板直接可用，替换输入文件即可。）

### L3. handler 语义展开（102 → 全量 217 s2c）
task-046 已给 107 个 handler 的 reads/reads_count/globals。
**展开路径**：每个 handler 的调用闭包 = 该功能的完整逻辑簇
（call-graph 遍历 + 每簇内 u_/s_ 字符串 + 常量 ID 补充）。
服务器源（MaplePacketCreator 265 writer）做行为对照。

### L4. 构造器/虚表族（task-050 方法续）
179 个 ctor 验证的 vtable 类已知。按 ctor 复制模式继续扫描 + 类字段偏移
（服务端字段名对照：CUser/CItem/CField 的 Java 侧有完整字段表）。

### L5. 导入表分类
WS2_32 调用者=网络族；GDI/DDraw 调用者=UI 绘制族；winmm=音频族。
机械分类，一次跑完。

## 执行顺序（按边际收益）

1. **L2 DLL 反编译**——渲染引擎是零覆盖最大块，且是机械工作（Ghidra 跑批）
2. **L1 字符串表破解**——1,062 函数一次性锚定
3. **L5 导入分类**——半小时机械跑
4. **L3 handler 闭包展开**——按子系统逐个吃（login→chat→inventory→…）
5. **L4 族补充**——填缝

## 按游戏功能的交付形态（开发查询用）

每个子系统一册 dossier：
```
功能名（如"物品掉落捡取"）
├─ 入口: opcode/调用链/地址（VA+CSV键）
├─ 数据流: 读哪些包字段 → 写哪些对象字段（+偏移）
├─ 配套 WZ: 命名空间 + 字段
├─ 公式/规则（如有）
└─ 相关函数清单（atlas 行）
```

## 杠杆进展（2026-11-11 首日）

### L2 DLL 反编译 — ✅ 完成
5 个 DLL 全部反编译导出（`E:\ghidra-projects\dlls\`）：
Gr2D_DX8（1,036KB CSV）/ Canvas（740KB）/ Shape2D（299KB）/
NameSpace（653KB）/ ResMan（150KB）。**渲染引擎源码到手，零覆盖最大块已打开。**

### L1 字符串表破解 — 结构已破，索引算术待收口（第二日进展）
- **表本体定位并在转储中实读**：`[0xBE2000]=0x29A6FC`（VA），扫描 0x40000 区
  得 **1,531 条目**（STRING-TABLE-PARTIAL.csv），其中 **103 条挂上已知 ID**
  （动作族 41+ 扩展锚）——`name→条目` 方向已可查询
- 记录格式确认：`{u32 0x1d, 1, len, len, name}`（名字副本 33 字节节距于 0x2Bxxxx）
- 哈希行为观测：连续 ID 多数相邻（差 0x28=2×0x14 槽），但有大幅散布
  （stabT1→stabT2 差 0x1518）→ 开放寻址哈希表
- **访问器 0xEC0BB4 已从转储恢复字节并反汇编**：重度混淆（rdtsc+控制流平坦化+
  垃圾指令），闭式哈希拟合 41 锚失败
- **剩余路径**（按可行性）：① 混淆访问器的去平坦化（工作量大）② 进图后转储
  直接观察 ID 查询落点（受 F2 阻塞）③ 调用图上下文推断高频 ID
  （5432×75/2077×41/5549×33 站点——宿主函数为纯逻辑层，需一层调用图）

### L2 DLL 反编译 — ✅ 完成 + 普查完成（第二日）
5 DLL 全部反编译 + PE 导出 + 字符串锚点 + **架构解码**（见 RENDER-DLL-CENSUS.md）：
全栈为自研 **PCOM 组件框架**（NameSpace=WZ文件系统/Canvas=精灵画布含 origin/
Shape2D=碰撞几何 Convex2D/Gr2D=D3D8/ResMan=缓存），**+5,112 函数入语料**。

### 已跑基线
- `FUNCTION-ATLAS-BASELINE.csv`：51,222 行，208 语义锚（诚实数字）
- RTTI 仅 13 类（异常族）——vtable 杠杆弱，靠 L4 构造器族补偿

- `atlas/FUNCTION-STRING-ANCHORS.csv`（1,035 条函数×字符串）
- `atlas/FUNCTION-CLUSTERS.csv`（96 函数×WZ 命名空间簇）
- `atlas/FUNCTION-ATLAS-BASELINE.csv`（51,222 行基线）
- `atlas/RTTI-CLASS-CENSUS.csv`（13 类）
- `map/MOTION-SLOT-NAMES.csv` + `RENDER-MAP-SCENE-CONTRACT.md` + `RENDER-ZMAP-ORDER.csv`
- 协议: `protocol-opcodes.csv`(442) + task044/046 handler 图
- 移动物理全套: MAP-MOTION-REVERSE / GAPS-FINAL-CLOSURE / DATA-SIDE-FINDINGS

## 已有可查询资产

- atlas/ 全套 CSV（基线/字符串锚/簇/RTTI）
- E:/ghidra-projects/dlls/*.csv — 5 个 DLL 的反编译（渲染引擎）
- map/ 移动物理全套 + RENDER-MAP-SCENE-CONTRACT + ZMAP-ORDER
- 协议: protocol-opcodes.csv(442) + task044/046 handler 图
