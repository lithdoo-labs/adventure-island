# RenderNode 架构基线审计与冲突清单

> 审计状态：**已完成基线读取；结论未获独立 Reviewer 批准。**
> 审计基线：Adventure Island 分支 HEAD 07624ffc869f914f93f18af1467b96e32294faf8
> LoomRealm Gitlink：93648192323bf5f57996b7b54cbae641d8a53fdb
> 本文是只读审计记录，不修改 Frozen RenderNode ABI v1、LoomRealm Submodule 或 CMS079 研究台账。

## 1. 审计范围与方法

本轮先读取远程分支，而不是依赖交接 SHA。审计时远程分支 HEAD 与交接基线相同。

已读取的 Adventure Island 规范和实现资料：

- 根级 DESIGN.md。
- components/RENDER-NODE-ABI-V1.md、MAP-SCENE-PLAN-V1.md、components/README.md。
- design/ms-components/README.md、ms-avatar.md、ms-action.md。
- 所有现存 cms-* DESIGN.md：scene-view、back、map-layer、avatar-layer、actor、portal、npc、reactor、seat。
- cms-actor/IMPLEMENTATION.md。
- docs/product-first 的 README、OpenMS 适配合同、模块/需求契约、ADR Register、Roadmap、测试计划、Session Handoff、WP0 审计与 Reviewer 状态资料。
- 当前 systems/adventure-map、systems/base、cms-actor 实现、PWA/Hostra 配置。

已读取固定 LoomRealm commit 93648192323bf5f57996b7b54cbae641d8a53fdb：

- doc/15-contracts/render-update-v1.md
- doc/15-contracts/web-presentation-api-v1.md
- doc/15-contracts/web-presentation-config-v1.md
- packages/subsystem/src/render.ts
- packages/subsystem/src/internal/render-manager.ts
- packages/renderer/src/internal/web-projector.ts
- packages/renderer/src/internal/presentation-seam.ts

已读取固定 OpenMS GMS083 commit 07994de02756356e3e025e3aca9e79433898d2c8 的 Scene、Camera、资源、动画、Portal、Life、Reactor 源码和相关文档。只记录行为和算法参考，不复制 GPL-3.0 实现。

已读取 CMS079 当前研究台账及后续研究成果，包括 MAP-R13、T086/T086.1、T087、T088、Avatar Occlusion 资料。没有运行原版 CMS079 客户端，没有把 OpenMS 行为当作 CMS079 证据。

本轮没有运行项目测试，也没有修改业务代码。

## 2. 执行摘要

1. Frozen RenderNode ABI v1 的五字段结构、RenderDomainState 两字段结构和 replace/update/emit 语义仍然有效，不能就地修改。
2. ms-avatar / ms-action V1 设计基线已经收口；两者未实现。ms-components README 的 Draft 描述已经过期。
3. LoomRealm 固定版本没有 RenderProjectionBatch begin/end 能力；这是 ms-avatar V1 实现前必须解决的内部集成缺口。
4. CMS079 最新研究已经显著推进世界深度排序：节点插入、比较器、Avatar 键和跨对象遮挡得到静态闭合。旧 MAP-TILE-OBJ-SORT-REVERSE 的 UNKNOWN 结论已不是当前台账结论。
5. Frozen ABI v1 仍然不能把 Avatar 插入地图 Obj 深度带。该限制是冻结产品 ABI 的能力边界，不是 CMS079 没有跨对象排序的证据。
6. Camera 的世界/屏幕坐标关系和部分写入路径已恢复，但焦点源对象语义仍未完全闭合。Scene Root 应投影 Camera 快照，不应承担 Camera 决策。
7. 当前 cms-* 设计、ms-avatar/action 设计和未来场景组件之间没有可直接使用的兼容树。不能通过改标签名完成迁移。
8. 当前 PWA/Hostra 配置仍然选择 smoke subsystem；没有证据表明完整 Adventure Field 场景已集成到两个目标平台。
9. Product-First 的需求、ADR 和独立 Reviewer 状态仍未达到整体 READY。历史研究子任务的独立 Review 不能替代产品架构的独立 Review。

## 3. 已冻结、已设计、已实现与未完成

| 范围 | 当前状态 | 审计结论 |
|---|---|---|
| LoomRealm Render Update v1 | 平台固定协议 | 使用固定 Gitlink；不升级 |
| Web Presentation API v1 | 平台固定协议 | Context 闭集为 resources + emitCustomEvent |
| Adventure Island RenderNode ABI v1 | Frozen | 精确五字段；不增加 props/state/style/events/resources |
| RenderDomainState v1 | Frozen | 精确 zIndex + roots |
| cms-scene-view / cms-back / cms-map-layer | 旧设计 | ABI v1 的组件设计，不代表完整产品场景 |
| cms-avatar-layer | 旧设计 | 冻结契约恰好一个 cms-actor |
| cms-actor | 已有实现 | 有源码、浏览器产物和历史测试记录；不等于新 ms-avatar 已实现 |
| cms-portal | 旧视觉设计 | 视觉与 Portal 逻辑分离 |
| cms-npc / cms-reactor / cms-seat | Future 草案 | 没有冻结完整 ABI |
| cms-mob | 缺少独立设计文件 | 不能从标签名推断契约 |
| ms-avatar V1 | 设计基线已收口 | 尚无实现、完整 Validator、真实浏览器验收 |
| ms-action V1 | 设计基线已收口 | 尚无实现、完整 Validator、真实浏览器验收 |
| RenderProjectionBatch | 设计要求 | 固定 LoomRealm 尚未提供 |
| 完整 Scene ABI v2 | 尚未冻结 | 本轮 WP1 提出 Proposed 方案 |

### 3.1 Frozen RenderNode 与 LoomRealm API 的准确边界

Adventure Island RenderNode v1：

~~~ts
interface RenderNodeV1 {
  readonly key: string;
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly data: JsonObject;
  readonly children: readonly RenderNodeV1[];
}

interface RenderDomainStateV1 {
  readonly zIndex: number;
  readonly roots: readonly RenderNodeV1[];
}
~~~

LoomRealm Subsystem RenderDomain API 的实际形状：

~~~ts
interface RenderDomain {
  replace(state: RenderDomainState): void;
  update(update: RenderDomainUpdate): void;
  emit(event: RenderEvent): void;
  close(): void;
}
~~~

RenderDomainUpdate 只允许 zIndex 和已有节点的 attrs/data delta。RenderNodeUpdate 只包含 key、attrs、data；没有 children、tag 或 key 更新入口。data delta 的 set 值是完整顶层成员值，不是嵌套对象 Patch。

RenderManager 会拒绝 live key 改 tag，并拒绝重新使用已删除的 key。key 的 consumed 集合属于当前 wire generation；新 DataPeer generation 会建立新的 wire Domain 身份。

### 3.2 事件边界

- Subsystem → Component：RenderEvent，经 emit() 发出；transient，不进入 retained store，不 ACK、不自动重放、不 retry。
- Component → Subsystem：WebPresentationContext.emitCustomEvent()；它是 InputEvent v1 输入意图，必须经过 InputGate 和所属 Subsystem。
- 组件不得直接修改 Shared State、Field Runtime 或 RenderDomain。
- 持续状态必须放在 retained attrs/data；RenderEvent 只表达一次性呈现脉冲。

### 3.3 WebProjector 的真实能力

固定版本 WebProjector 机械投影 retained RenderNode 树，并维护 key 对应的 DOM identity。当前实现先建立节点集合，再执行 Context/DOM/attrs/data 投影；当前 collectDomain 实现是 children-first 收集，但这不构成可以依赖的公开父子事务承诺。

当前实现没有：

- beginRenderProjectionBatch / endRenderProjectionBatch；
- “整个父子依赖子树投影完成且所有必要回调成功”的结果；
- 组件级投影事务失败后的自动 retry；
- 公开 AssetManager 或全局 service locator。

receiveRenderContext / receiveRenderData 的异常会被报告，但不会自动重试。Render Store 原子性不能推导出所有 Web Component 回调成功。

## 4. 当前 CMS079 研究台账的更新

当前 source-of-truth 文件行数核验结果：

| 台账 | 记录数 |
|---|---:|
| claims.csv | 109 |
| evidence.csv | 97 |
| gaps.csv | 41 |

### 4.1 世界深度排序

当前台账和 T086/T086.1 的重要结论：

- C-097：Gr2D 节点主表 slot45 的键控有序插入路径已经找到；容器位于 node + 0x2C。
- 比较器 0x50403A42 已找到；它沿 slot4 链寻找可比层，再比较 slot0 的键。
- 相同主键会比较第二键；不能把相等键解释为稳定插入顺序。
- G01、G07、G08、G09、G33 已更新为 CLOSED-STATIC。
- C-099 恢复 Avatar 排序键族；T086.1 修正常量基数表述，正确的常量基准为 0x40000000。
- C-100 验证 Base.wz 的 zmap/smap 数据面：zmap 149 层，smap 147 项，其中 106 条层名到部件码绑定。
- T086 报告的 G09 结论为 Avatar/Mob/NPC/Drop 与 Tile/Obj 共享同一排序键空间及比较器路径，跨对象遮挡可按有序树遍历序实现。

MAP-R13-STATIC-CLOSURE 对键升序、小键先绘制、Layer 0 垫底给出 STRONGLY SUPPORTED；T086 随后补齐比较器和次级键证据。实现时必须保留比较方向、层级路径和次级键，不可退化为只按单一 y 坐标排序。

旧 MAP-TILE-OBJ-SORT-REVERSE.md、旧 MAP-R13-FINAL-ROUND4.md 中的 UNKNOWN / OPEN-RUNTIME 描述应视为历史阶段记录。不要删除或伪装历史结论；当前结论以 source-of-truth 台账和 T086/T086.1 为准。

### 4.2 Camera

T087/T088 推进了 Camera 数据流：

- screen = world - camera。
- 地图载入路径有 camera = (-400,-300) 的初始化写入。
- 解码的普通 Shape2D Set 路径为立即写入；没有证据表明 Camera 写入启用 Vector2D 插值。
- 解码路径没有找到每个 Simulation tick 的 Camera writer。
- 解码 gate 中没有发现水平/垂直 deadzone。
- 存在由 Portal、Spawn、Seat 和输入区域调用的 focus-writer 候选链。
- focus writer 使用的 [F28obj+0x14] 源对象写入者没有完成普查；不能宣称该对象必然是 Avatar feet 或屏幕中心。
- G10 仍是 PARTIAL-STATIC，25 个 census sites 仍属 INCONCLUSIVE。

因此，Camera 算法必须留在 Camera Subsystem。Scene Root 只投影当前 Camera snapshot、Viewport 和 transform。

### 4.3 OpenMS 的证据等级

OpenMS 固定 commit 是 GMS083 参考，不是 CMS079 原版证据。它可支持产品候选和独立算法设计，例如：

- StreamScene 的 sortable world container、zIndex / depthOrder；
- Camera 的 viewport 与世界坐标分离；
- Scene transition 的 candidate prepare / commit；
- Portal presentation 与 PortalSystem / travel gate 分离；
- LifeSystem、NPC presentation、ReactorSystem 的职责分离；
- VisualTextures 与 ResourceCache 的不同生命周期。

不得用 OpenMS 的 PixiJS Container、camera follow 参数或业务规则覆盖 CMS079 未闭合项。

## 5. 文档与实现冲突清单

| ID | 位置 | 问题 | 处理原则 |
|---|---|---|---|
| B-01 | design/ms-components/README.md | 仍标 ms-avatar/ms-action 为 Draft，Clip Schema 待定 | 同步索引为 V1 design baseline closed；保留未实现状态 |
| B-02 | components/RENDER-NODE-ABI-V1.md §6 | 仍以比较方向待逆向解释 v1 分组树 | 不改 Frozen v1；在新 Scene ABI 中采用全局 draw list |
| B-03 | components/MAP-SCENE-PLAN-V1.md | V1 map layer 仍按旧分组绘制 | 保留 V1；新方案另建 World Draw Plan |
| B-04 | components/README.md 示意树 | 包含 NPC/Reactor/Seat Future 节点 | 不视为 Frozen ABI v1 契约 |
| B-05 | cms-avatar-layer | 恰好一个 cms-actor | 不能直接把 ms-avatar 放入旧容器 |
| B-06 | cms-npc 草案 | rx0/rx1 交互范围靠近视觉组件 | 交互范围归 Field Runtime / InputGate |
| B-07 | cms-seat 草案 | Seat 位置/占用属于玩法对象 | Seat 默认不产生 RenderNode |
| B-08 | cms-reactor 草案 | Reactor 状态和时间容易与视觉状态混淆 | 权威状态归 Reactor Subsystem，组件只接收视觉投影 |
| B-09 | cms-mob | 没有独立设计文件 | 不自动建立一个 mob Web Component |
| B-10 | cms-actor IMPLEMENTATION | 实现 Validator 的 locomotion 范围小于设计层列出的完整候选状态 | 作为旧实现差异单独测试，不把未实现值标记为 PASS |
| B-11 | ADR-007 | 基于旧阶段证据建议 v1 分组树延续 | 保留 v1 兼容决定；V2 深度排序改由新 ADR 讨论 |
| B-12 | PWA / Hostra | 当前 game.json 仍选择 smoke subsystem | 不能宣称完整场景已完成双平台集成 |
| B-13 | ms-avatar V1 / LoomRealm | Avatar 要求子树投影批次，平台未提供 | 需要 LoomRealm 内部集成设计和独立批准 |

### 5.1 cms-actor 的实现状态

cms-actor 是现有旧实现，不是 ms-avatar 的实现。IMPLEMENTATION 文档记录了历史算法/浏览器测试结果和本地素材条件；这不等于在本次 HEAD 上重新执行过测试。

当前实现的 locomotion validator 只接受 stand / walk / jump。若更上层设计或产品需求使用 prone / swim / sit / climb，必须先有明确映射或扩展，不得把设计枚举当成实现事实。

当前 PWA/Hostra game.json 仍选用 smoke subsystem；systems/adventure-map 的原型不能替代完整 Field Runtime / Map / Camera / Movement / Portal 集成。

### 5.2 Product-First readiness

- 65 项需求仍为 PROPOSED / NOT-APPROVED。
- ADR-001 至 ADR-009 仍为 PROPOSED。
- ADR-010 独立 Reviewer 门禁为 BLOCKED / NOT-RUN。
- 当前 commit 没有返回 GitHub combined status checks，也没有关联的 PR workflow runs。
- 本轮没有运行测试。
- T086 有其研究子任务的独立 Reviewer ACCEPT-WITH-CORRECTIONS 记录；这不能替代产品架构独立 Reviewer。

不得宣称项目整体 READY、实现完成或独立审查通过。

## 6. WP1 的基线裁决

1. 一个 Field Runtime 使用一个 World RenderDomain，整个当前场景由一个 ms-scene-view root 管理。
2. HUD / 菜单使用独立 UI Domain，前提是其生命周期需要跨地图切换保留。
3. 全屏转场/致命错误遮罩可使用可选 Overlay Domain；只有独立生命周期和更高 zIndex 有真实收益时才创建。
4. 不按 MapLayer、Actor、NPC 或每张地图创建独立 Domain；跨 Domain 没有事务性提交。
5. 新 Scene ABI 应使用 ms-scene-view + ms-world-layer 的全局绘制计划；不再把 MapLayer 全部绘制后才画 Avatar 当作 V2 目标。
6. Tile / Obj / 普通 NPC / Mob / Reactor / Portal / Effect / Projectile 默认是批量绘制数据，不是每个对象一个 Web Component。
7. ms-avatar / ms-action V1 公开 ABI 保持不变；ms-entity 负责世界坐标/深度位置，并通过内部 drawable surface 接口参与 World Renderer。
8. RenderClock 由 Scene 根提供最近祖先 Provider；Simulation Clock 仍归 Subsystem。
9. Renderer 内部 Projection Batch 按依赖子树组织；不增加 RenderNode 公共字段。
10. cms-* v1 与 ms-* Scene ABI v2 并行迁移；不得在旧 RenderNode 树上直接改 tag。

## 7. 推荐的后续工作顺序

1. 审批或明确拒绝本轮 Proposed 架构 ADR。
2. 完成 RenderDomain 拓扑、Scene Root、World Draw Plan、Node identity 和更新模型。
3. 与 LoomRealm 维护者单独讨论 RenderProjectionBatch 内部接口；未批准前不升级 Submodule。
4. 定义统一 Resource Cache / RenderClock 内部契约。
5. 依赖关系顺序设计 ms-scene-view、ms-back、ms-world-layer、ms-entity 的独立 ABI。
6. 再设计 NPC/Mob/Portal/Reactor 等视觉数据记录和必要的独立组件。
7. 用合成夹具完成排序、Camera、资源、Clock、生命周期测试。
8. 最后做 PWA/Hostra parity 和独立 Reviewer。

## 8. 本次读取的固定来源

### Adventure Island

- Frozen RenderNode ABI：components/RENDER-NODE-ABI-V1.md
- Map Scene Plan：components/MAP-SCENE-PLAN-V1.md
- 新组件基线：design/ms-components/ms-avatar.md、ms-action.md
- Product-First：docs/product-first/README.md、ADR-REGISTER.md、MODULE-CONTRACTS-V1.md、REQUIREMENT-CONTRACTS-V1.md、IMPLEMENTATION-ROADMAP.md、TEST-AND-GOLDEN-FIXTURE-PLAN.md
- CMS079 最新台账：research/source-of-truth/claims.csv、evidence.csv、gaps.csv
- CMS079 后续研究：research/result/stage-readiness/T086-STATIC-GAP-CLOSURE-REPORT.md、T087-CAMERA-STATIC-IDENTITY-REPORT.md、T088-CAMERA-CADENCE-WRITER-CLOSURE-REPORT.md

### LoomRealm

固定 commit：93648192323bf5f57996b7b54cbae641d8a53fdb。

- doc/15-contracts/render-update-v1.md
- doc/15-contracts/web-presentation-api-v1.md
- doc/15-contracts/web-presentation-config-v1.md
- packages/subsystem/src/render.ts
- packages/subsystem/src/internal/render-manager.ts
- packages/renderer/src/internal/web-projector.ts
- packages/renderer/src/internal/presentation-seam.ts

### OpenMS

固定 commit：07994de02756356e3e025e3aca9e79433898d2c8。

- client/src/rendering/camera.js
- client/src/rendering/field-transition.js
- client/src/rendering/stream-scene.js
- client/src/rendering/visual-resources.js
- client/src/rendering/resource-cache.js
- client/src/rendering/animation-timing.js
- client/src/rendering/animation.js
- client/src/world/portal-presentation.js
- client/src/world/portal-system.js
- client/src/world/life-system.js
- client/src/world/reactor-system.js
- client/src/npc/npc-world-presentation.js
- docs/scene-contract.md
- docs/ingame-portals.md
- docs/ingame-life.md

---

审计结论：**基线已经足以开始 WP1；不代表全产品 READY。**