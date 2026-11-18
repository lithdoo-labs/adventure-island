# Adventure Island 设计文档

> **当前状态：Design Baseline Reset / 非规范 / 未批准 / 未实现。**
> 本目录是 Adventure Island 新一轮产品与架构设计的统一入口。除非单独文档明确标记为已批准，否则这里的标签、字段、阶段范围、算法和验收计划都只是候选设计，不是实现指令。

## 1. 设计目标

本项目参考 CMS079 逆向证据与 OpenMS 的公开开发资料，在 LoomRealm 的 Subsystem / Renderer 架构上复刻冒险岛基础客户端能力：

1. 人物纸娃娃、装备遮挡和动作播放；
2. Back、Tile、Obj 组成的地图场景；
3. 人物移动、Foothold、Rope、Seat 与水陆状态；
4. Camera 与世界到屏幕坐标转换；
5. Portal 同图移动、跨图准备、提交和场景跳转；
6. 从候选三图垂直切片扩展到现有 13 图内容闭包。

这些是**产品设计目标**，不是“已经实现”或“已批准 ABI”的声明。当前正式运行路径仍是旧 `cms-*` 垂直切片，新 `ms-*` 组件均未实现。

## 2. 阅读路径

### 2.1 先理解产品范围

- [产品目标与阶段范围](./product/PRODUCT-GOALS.md)：基础功能、阶段切片、非目标和批准门。

### 2.2 再理解平台约束

- [LoomRealm 运行时与渲染架构](./architecture/LOOMREALM-RUNTIME-AND-RENDERING.md)：Subsystem 权威、Renderer 副本、进程/Worker 组合和通信协议。
- [Field 内容到画面的投影管线](./architecture/FIELD-PROJECTION-PIPELINE.md)：FSDB 如何经过 Adapter 与 Subsystem 变成 RenderNode、DOM 和局部 Canvas。

### 2.3 再理解输入资料

- [FSDB 内容模型](./content/FSDB-CONTENT-MODEL.md)：当前 `[FSDB]adventure` 的表、资源、存在性语义和投影边界。
- [OpenMS 开发参考](./references/OPENMS-DEVELOPMENT-REFERENCE.md)：固定提交中的场景、动画、Avatar、Camera、Movement、Portal 资料，以及可借鉴与不可提升为 CMS079 事实的边界。

### 2.4 最后阅读组件候选

- [MS 组件索引](./ms-components/README.md)
- [Field 组件树](./ms-components/FIELD-COMPONENT-TREE-DRAFT.md)
- [DOM + Multi-Canvas 世界渲染](./ms-components/WORLD-RENDERING-ARCHITECTURE-DRAFT.md)
- [共享 Paint Unit ABI 草案](./ms-components/FIELD-PAINT-UNIT-ABI-DRAFT.md)

## 3. 文档结构

```text
design/
├─ README.md
├─ product/
│  └─ PRODUCT-GOALS.md
├─ architecture/
│  ├─ LOOMREALM-RUNTIME-AND-RENDERING.md
│  └─ FIELD-PROJECTION-PIPELINE.md
├─ content/
│  └─ FSDB-CONTENT-MODEL.md
├─ references/
│  └─ OPENMS-DEVELOPMENT-REFERENCE.md
└─ ms-components/
   ├─ README.md
   ├─ FIELD-COMPONENT-TREE-DRAFT.md
   ├─ FIELD-PAINT-UNIT-ABI-DRAFT.md
   ├─ WORLD-RENDERING-ARCHITECTURE-DRAFT.md
   └─ ms-*.md
```

`product` 描述“要做什么”；`architecture` 描述“权威和数据怎样流动”；`content` 描述“已有内容事实”；`references` 描述“外部实现资料怎样使用”；`ms-components` 才描述“Renderer 中的候选视觉组件”。

## 4. 证据与决策标签

设计结论必须区分以下来源，不允许互相替代：

| 标签 | 含义 | 当前权威来源 |
| --- | --- | --- |
| `FSDB-FACT` | 自研内容库中实际存在的字段、记录和资源 | `content/adventure_design.md`、`content/[FSDB]adventure` |
| `CMS079-PROVEN` | 经过逆向台账验收的原版行为 | `research/source-of-truth/claims.csv`、`evidence.csv`、`gaps.csv` |
| `OPENMS-REFERENCE` | OpenMS/GMS083 的公开实现参考 | 固定提交 `07994de02756356e3e025e3aca9e79433898d2c8` |
| `LOOMREALM-CONTRACT` | 固定 LoomRealm 提交已经提供的平台合同 | Gitlink `93648192323bf5f57996b7b54cbae641d8a53fdb` |
| `PRODUCT-DECISION` | Adventure Island 自己需要批准的设计选择 | 本目录中的候选设计与后续 ADR |

使用规则：

- OpenMS 可以证明一种实现结构可行，不能单独证明 CMS079 的数值或行为。
- CMS079 逆向事实可以约束产品，但不会自动决定 DOM、Canvas 或 LoomRealm 投影形状。
- FSDB 保存内容事实，不保存 `stack-rank`、DOM key、Canvas batch、Camera 状态或场景事务。
- LoomRealm 只定义传输、权威和投影机制，不定义冒险岛业务字段。
- 产品选择必须明确标为候选，不能伪装成逆向结论。

## 5. 架构总览

```text
Content / FSDB
  只读内容事实、资源与来源顺序
        │
        ▼
Field Subsystem / Adapter
  Simulation、Movement、Portal、Camera Intent
  解析内容、计算世界排序、构造权威 RenderDomain tree
        │
        │ Render Update v1
        ▼
Renderer Store
  每个 Subsystem 的只读 Render replica
        │
        ▼
WebProjector
  机械创建、移动、更新 Custom Elements
        │
        ▼
Business Custom Elements
  Shadow DOM、局部 Canvas、资源解码、视觉帧、非权威缓存
```

最重要的边界：

- Subsystem 是业务和 Render Projection 的权威。
- Renderer 不从 DOM、FSDB 或邻接节点反推业务状态。
- WebProjector 不创建第二套 desired tree，只投影 Renderer Store 中的副本。
- Custom Element 可以拥有 Renderer-local 动画相位，但不能用动画完成决定移动、战斗或传送结果。
- DOM + Multi-Canvas 的“多”来自独立 Paint Unit 和安全批次，不是固定六张或八张 Canvas。

## 6. 当前设计状态

### 已有可信基础

- LoomRealm RenderDomain、Render Update、Renderer Store、WebProjector 和 Content capability 已存在于固定提交。
- CMS079 已闭合 Tile/Obj key、ordered-tree comparator、Avatar 世界插入 key、纸娃娃遮挡、Portal 到达、部分完整物理循环和世界到屏幕 Camera 公式。
- `[FSDB]adventure` 已包含 13 张地图、地图放置记录、Avatar 结构、Avatar/Map 资源及物理配置。
- 旧 `cms-actor` 已验证局部 Canvas、资源解码、动画帧和“位置更新不重绘 Avatar”这一更新分离策略。

### 尚未批准或仍有证据缺口

- 完整 Scene ABI、最终标签集合和字段闭集；
- `stack-rank` 的最终编码与静态 Batch Planner；
- Camera follow cadence/deadzone 的产品选择；
- Movement 剩余状态分支和最终模拟时钟；
- 动态 Back/Obj/Portal 的精确运行时时间语义；
- Renderer-local scene ready/transition gate；
- RenderClock、共享 decoded cache 和 ProjectionBatch 等跨组件能力。

## 7. 历史文档

以下文件保留推演和审计价值，但不是当前入口：

- [Scene / RenderNode 探索性架构](./ms-components/RENDERNODE-ARCHITECTURE.md)
- [历史 RenderNode 基线审计](./ms-components/RENDERNODE-BASELINE-AUDIT.md)
- `docs/product-first/` 下的 2026-11-16 需求、ADR 和路线图档案
- `components/` 下旧 `cms-*` ABI 与 MapScenePlanV1

历史文件中的 `Frozen`、`V1/V2`、`PRODUCT-READY` 或路线图状态不能覆盖本目录当前的未批准状态。

## 8. 进入实现前的批准门

1. 产品阶段范围和目标地图获批；
2. FSDB → Projection 字段映射和存在性语义获批；
3. 世界排序、稳定 tie identity 和 Paint Unit 切分获批；
4. Scene root、DOM/Shadow DOM、Camera transform 和组件 children 规则通过真实 WebProjector spike；
5. Movement/Portal/Camera 权威状态不泄漏到 Renderer；
6. 资源失败、旧 epoch 回调、场景切换与 last-good 行为可验证；
7. 所需能力在固定 LoomRealm 中真实存在，或明确作为上游集成提案处理；
8. Node、浏览器、像素、回放与性能验收命令可复现。

## 9. 许可证与素材边界

- 不运行原始 CMS079 客户端。
- 不提交客户端二进制、WZ、完整 FSDB 导出或未授权素材。
- OpenMS 为 GPL-3.0；可用于研究公开行为和独立实现，不复制、vendor 或链接其源码。
- 新实现应保留来源、固定提交、差异说明和独立实现记录。
