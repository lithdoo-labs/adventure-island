# IMPLEMENTATION-READINESS（Adventure Field Map Scene 工程就绪评估）

评估基线：clean-room 审计后（2026-11-13）。证据状态引用 `research/source-of-truth/claims.csv`；缺口引用 `gaps.csv`。

## 实施就绪矩阵

| 子系统 | 证据状态 | 实现状态 | 是否阻塞开工 |
|---|---|---|---|
| Map FSDB Loader | A（WZ 提取闭包已验证：extract-summary.json，4614 images，0 解析失败） | 可按已证实行为实现 | 否 |
| Resource Resolver | A（FSDB 白名单/LogicalResourceRefV1 已冻结于 ABI v1） | 可按已证实行为实现 | 否 |
| Tile Registry | A（键公式 C-001、层注册 +0xCC/+0xD0 C-022、通道 C-017） | 可实现键计算与注册；排序策略可替换 | 否 |
| Obj Registry | A（键公式 C-002、栈封装通道 C-017） | 同上 | 否 |
| Foothold | A（物理字段表 C-034、R1-R14 逆向文档） | 可按已证实行为实现 | 否 |
| Movement | A（物理主循环/0x1E 步进/跳跃初速 C-029/030/034/035） | 可精确实现主体；alert 递减与死亡位为行为级等价（G11/G12） | 否 |
| Avatar（部件内） | A（zmap 149 层 priority/tag/zIndex C-043） | 可按已证实行为实现 | 否 |
| Avatar（跨对象排序） | R（G08/G09 OPEN-RUNTIME） | 等价实现：产品规则分层 | 否（有条件） |
| Render Ordering | 键 A（C-001/002/003）；比较器/容器 OPEN（G01/G07/G33） | 键级精确实现；容器策略可替换（RenderNode ABI v1 不绑定容器） | 否（有条件） |
| Camera | 边界 A（VR 折叠 C-026）；跟随 OPEN-RUNTIME（G10） | bounds 可精确实现；跟随策略可替换（HeavenClient 式平滑为产品决策） | 否（有条件） |
| Scene Lifecycle | A（Render Update v1/sceneEpoch 契约已冻结） | 可实现 | 否 |
| Protocol | A（语料 C-046）；367 数值 BLOCKED（G17） | 语义名先行，数值延后绑定 | 否 |
| UI | A/B（结构映射完成，长尾 G16） | MVP 可实现 | 否 |
| Audio | A（静态 IAT 导入 C-040；序号→名 G13） | 管线可实现 | 否 |

## 分类结论

**1. 可按已证实行为精确实现**：Map FSDB Loader、Resource Resolver、Foothold、Movement 主体（键/步进/初速/物理字段）、Avatar 部件内遮挡、Tile/Obj 键计算、VR bounds、Scene Lifecycle、协议语义层。

**2. 可按产品决策实现但不宣称原版复刻**：
- Tile/Obj/Avatar 的最终绘制容器与相等键次序（产品：Obj 组先于 Tile 组、同值保持源顺序——HaCreator 约定）
- Camera 跟随（产品：平滑+deadzone+bounds 夹取）
- alert 计时（产品：dt 毫秒递减 5000→0）
- 死亡动作映射（产品：isDead 状态）

**3. 必须设计可替换策略**：排序比较器（ISceneBucket 策略位）、相机跟随、tick 换算（0x5A↔0x1E 未证，G34）。

**4. 必须等待运行时证据**：G24/G27（R-09 一次 1-dword 转储同时裁定 slot45 语义与参数序）、G08/G09（Avatar 注册）、G10（相机跟随）。

**5. 必须等待外部素材**：G13（同期 winmm.dll）、G17（服务器 properties）。

## 开工判定

**Adventure Field Map Scene：可以开工。**

- 可立即开工：全部上表"否（无条件）"行。
- 有条件开工：Render Ordering / Camera / Avatar 跨对象排序——条件是不绑定未证语义（已由 RenderNode ABI v1 + ISceneBucket 策略边界满足）。
- 暂缓：无（G17 仅影响协议数值绑定，不阻塞地图场景）。
- 不应冻结的接口：容器内部实现、比较器、相机跟随参数、avatar-vs-obj 精确次序、0x5A↔0x1E 换算。

## 冻结边界

- **RenderNode ABI v1（components/RENDER-NODE-ABI-V1.md）维持冻结**：sha256 锁定于 `research/source-of-truth/frozen-abi.txt`，验证器每轮校验（ABI-MODIFIED）。本轮未修改该文件。修改须经独立 ABI 评审并更新 pin。
- 键公式（C-001/C-002/C-003）与通道分离（C-017）A 级，可安全内置。
- R13 未闭合项（G01/G07/G22/G24/G33）**不阻塞任何不依赖比较器语义的地图代码**。
