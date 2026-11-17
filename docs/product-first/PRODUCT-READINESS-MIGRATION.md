> **归档状态（2026-11-17）：历史提案 / 非现行规范。** 本文保留用于追溯；不代表当前产品批准、实现或架构要求。当前设计入口：[Design Baseline Reset](../design-baseline/README.md)。

# 产品验收与研究 Readiness 双轨迁移规则

> 本文件只约束新分支 `docs/product-first/` 的**产品设计管理**，不修改 `research/source-of-truth` 或旧 Stage Readiness 枚举。

## 1. 真实基线与两种“进度”

- 旧 P0–P4 Matrix：65 项 = P0 13、P1 15、P2 8、P3 20、P4 9。状态：14 `PRODUCT-READY`、22 `RE-READY`、22 `RE-GAP-STATIC`、7 `DESIGN-DECISION`。
- 逆向 Gap：41 总计，25 CLOSED-STATIC、9 PARTIAL-STATIC、6 OPEN-STATIC、1 SUPERSEDED，有效 40 之静态闭合率 25/40=62.5%。**它不是产品的实现百分比。**
- 新 `REQUIREMENT-ADOPTION-MATRIX.csv` 从原版需求矩阵按 ID 自动迁移了 65 行，初始全部 `PROPOSED`，不是突然“全可开发/全 Ready”。

## 2. 新状态只用于产品设计

`PROPOSED` → `REVIEWED` → `APPROVED` → `IMPLEMENTED` → `VERIFIED`。延期写 `DEFERRED`。

`APPROVED` 需要：输入输出、状态机、来源、约束、反例、确定性验收测试和冲突裁决；`IMPLEMENTED` 需要代码与质量门禁；`VERIFIED` 需要本作实际测试和 13 图相应覆盖。历史 Claim/Evidence/Gaps 和旧 readiness 不随其改变。

每项要求设计卡：`ID/用户故事/地图覆盖/输入输出/状态权威/数据与资源字段/产品行为/边缘和错误/性能/参考 URL+SHA/版本差异/算法自研证明/ABI 兼容/测试/依赖/ADR/Reviewer/签字状态`。

## 3. 遗留 15 个 Gap 的产品 triage（不修改研究 status）

- **先以 OpenMS 为参考开展产品契约**：G10 Camera、G20 Avatar、G35 Background 排序、G36 Back 布置、G37 Obj flow、G39 帧时钟、G40 Movement。
- **按实际依赖研究**：G16 UI、G19 运动序列化、G11 死亡/击退、G12 Alert。
- **不阻塞当前地图 MVP**：G13 WINMM、G14 长尾 DLL 方法槽、G18 PCOM 所有者。
- **保留可选旧服兼容门**：G17 Opcode 原版权威仍需专项协议适配；若自研协议不依赖它，允许产品进度绕开，但不得把 G17 标 Closed。

## 4. 验收批次

| 批次 | 设计/测试范围 | 出口门 |
|---|---|---|
| R0 | 清理 DEC-01～07、65 条需求卡、职责/ABI 冲突、许可 | ADR 批准与可执行测试计划；不得因写了文档说已实现 |
| R1 | 3 图切片（222000000、222000001、230030200）Map+Back+Avatar+Move+Camera+Portal | 合成夹具、双向 Portal、状态录制回放、失败恢复 |
| R2 | 全 13 图/5 陆+8 水、type1–4、绳、动态背景与完整 Portal graph | 13/13 manifest，地图连通性、帧定时、交互 golden |
| R3 | Obj flow/Avatar 复杂遮挡/座位/必要 UI 与性能 | 每模块明确边界和失败策略，单独验收 |
| R4 | 服务端兼容及战斗/死亡/怪物等非 MVP 项 | 另立版本与完整协议/法律评审 |

## 5. 每次设计完成的守门检查

1. 65 个 requirement_id 一一对应，旧 `behavior/readiness/gap` 未被误改。
2. 13 图/Portal 全边数据与现行 MapScenePlan 四门冲突在 ADR 中明确解决；只列四门不得谎称全图通达。
3. 未审批行为仍 `PROPOSED`；产品 Ready 不是 CMS079 原版静态闭合。
4. OpenMS 提案有版本化 URL、差异和独立实现计划；未评估 GPL 许可不得直接复制源码。
5. Frozen ABI、不动资源与历史研究；所有设计修改在新产品分支上产生，Reviewer 只读盲审先行并复核远程提交。
