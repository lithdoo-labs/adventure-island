# Adventure Island 实施路线图

> **状态：候选实施计划 / NOT APPROVED；状态口径于 2026-11-28 澄清。**
> 本文把现有产品目标、LoomRealm 运行时边界、FSDB 内容事实和 `ms-*` 组件候选组织为可验收的落地顺序。它记录实验结果与里程碑门，不因代码存在、测试通过或里程碑完成而自动批准组件 ABI、FieldPlan ABI、业务算法或阶段范围。
> M0–M7.7 的历史本机记录见本目录对应 Evidence 文档；当前实现已合入 `main`。除非有单独的批准记录并同步修改对应组件规范，所有新 `ms-*` 与 Field/Movement/Portal 数据形状仍按候选处理。

## 1. 路线原则

项目不按“先把所有组件写完，再接业务”的横向方式推进，而按一条可运行、可回放、可逐步扩展的纵向链路推进：

```text
FSDB 内容事实
  → Content capability
  → Field Adapter / Projection
  → Field Subsystem 权威状态
  → RenderDomain tree
  → Renderer Store replica
  → WebProjector
  → Custom Elements
  → DOM + local Canvas pixels
```

实施过程中保持以下不变量：

1. Field、Movement、Camera、Portal 和场景提交的业务权威只在 Subsystem 一侧；
2. Renderer 不读取原始 FSDB，不从 DOM 或像素反推业务状态；
3. WebProjector 机械投影 Renderer Store，不建立第二套场景树；
4. 世界画面由可排序 Paint Unit 和局部 Canvas 组成，不创建整张世界大 Canvas；
5. Simulation Clock 与 Renderer-local visual clock 分离；
6. 高频位置变化走 `update()`，拓扑和同级顺序变化才走 `replace()`；
7. 相同内容、初始状态、输入和业务时钟必须产生相同业务状态与投影结果；
8. OpenMS 只作为公开实现参考，CMS079 逆向证据和 FSDB 事实分别保留来源标签。

### 1.1 三层状态口径

本路线图只使用以下三层状态，三者不可互相替代：

1. **实验验证通过（EXPERIMENT VALIDATED）**：限定 fixture、地图、浏览器、预算和提交上的假设已被测试证据支持。它允许继续推进，但不代表该阶段全部退出条件完成，也不产生兼容性承诺。
2. **路线图里程碑完成（MILESTONE COMPLETE）**：该里程碑声明范围内的退出条件均已取证，Evidence 文档记录提交、复现命令、测试结果、预算和剩余缺口。它冻结的是“验收结论”，不是 attrs/data/children、FieldPlan、FieldState 或算法形状。
3. **正式 ABI 批准（ABI APPROVED）**：必须有独立批准记录，明确字段闭集、所有权、更新语义、容量、失败和生命周期规则，并同步移除对应组件文档的 `NOT APPROVED` / `候选` 标记。实现存在、测试全绿、Evidence 完成或产品参数获批均不能替代这一步。

补充规则：

- `PRODUCT-DECISION` 只批准点名的产品参数或策略，不批准包含该参数的数据结构或组件 ABI；
- `FSDB-FACT`、`CMS079-PROVEN` 和 `LOOMREALM-CONTRACT` 是来源/证据标签，不是 Adventure Island ABI 批准状态；
- 旧 `cms-*` 冻结契约不自动传递给新 `ms-*`；本路线图范围内目前没有新 `ms-*`、FieldPlan 或 FieldState ABI 获得正式批准；
- 后续提交或 CI 回归不会改写历史 Evidence，但会阻止“当前 HEAD 可发布/可复现”的声明，直至重新通过当前门。

## 2. 当前实现基线

截至 2026-11-28，已推送实现基线位于 `main`，HEAD 为 `60f7d7ad4d3a03cf4cf4b60da42155dedf0d94c2`；M7.8 发布收口位于其上的本地未提交工作树。正式运行路径已经从旧 `cms-actor` 单角色兼容切片推进到：

```text
FSDB / LoomRealm database path
  → AdventureFieldPlan + Content identity
  → adventure-map Subsystem authority
  → RenderNode carrier tree
  → WebProjector
  → ms-viewport / ms-scene-view / ms-map-* / ms-world-item / ms-avatar
```

当前代码已经包含：

- 四图 FieldPlan、Portal 往返、水域、Rope/Climb、Seat/drop-through 与更完整的陆地/空中 Movement；
- `ms-viewport` 合法视口选择、Camera follow/clamp 与 viewport-local 地图呈现；
- Back type1–4、Back `ani`、Obj flow、多 Canvas Paint Unit、宽地图分批和静态/动态失效边界；
- 正式纸娃娃局部 Canvas、真实部件/装备组合以及 stand/walk/jump/rope/fly 等动作投影；
- PWA bundle、staging、Service Worker、Chromium 验证与发布工作流。

这些实现能力的状态并不相同：M0–M6 和 M7.1–M7.7 已有对应 Evidence；M7.7 之后加入的 viewport frame、扩展 Movement、第四图、装备和渲染优化现已纳入 **M7.8 有界发布验证切片**，但仍不等于 M7 总里程碑或 ABI 批准。

### 2.1 2026-11-28 当前验证观察

- 本机根测试：229 项，226 通过、0 失败、3 项因 Windows 符号链接权限跳过；另含 M7.8 `release-chromium` 1/1、本机 `integration.chromium` 20/20、canonical PWA 2/2 与 30 分钟资格 soak 1/1（import map 已由 `f3bc8116` 修复，未改 `loom-realm`）；
- 工作区除路线图/M7.8 证据与测试外，`main` 运行时代码与已推送 HEAD 一致；M7.8 切片为本地未提交收口；
- 已推送 `60f7d7ad` 的远端 Legacy PWA Compatibility CI（run `46042727882`）与 PWA Deploy（run `46043228866`）均全绿；本地 M7.8 新增门仍须在提交后由同一工作流复验。

因此已推送基线可标记为“远端 Legacy 门通过”，本地工作树可标记为“M7.8 发布验证通过”；只有本批改动提交并由新增 CI 门复绿后，才可把两者合并为同一远端发布候选结论。

## 3. 里程碑总览

```text
M0  可复现开发基线
 ↓
M1  真实 WebProjector + DOM/Multi-Canvas 架构验证
 ↓
M2  单图 FSDB 内容闭包与纯 Adapter/Projection
 ↓
M3  静态 Field 场景与统一世界排序
 ↓
M4  新纸娃娃组件接入世界
 ↓
M5  权威 Movement 与 Camera
 ↓
M6  Portal 原子场景事务
 ↓
M7  三图闭环、13 图扩展与动态呈现
```

每个里程碑都必须独立形成可审查提交，保留前一阶段的回归入口。不得用后续阶段的临时实现掩盖当前阶段的验收失败。

### 3.1 当前状态总表

| 范围 | 实验验证 | 路线图里程碑 | 正式 ABI | 说明 |
| --- | --- | --- | --- | --- |
| M0 | 通过 | 完成 | 不适用/未批准新 ABI | 建立可复现基线；不批准路线图本身 |
| M1 | 通过 | 完成 | 未批准 | 验证 DOM + Multi-Canvas 原则，不冻结标签和预算 |
| M2 | 通过 | 完成 | 未批准 | 纯 Adapter/Projection 闭环，不冻结生产 schema |
| M3 | 通过 | 完成 | 未批准 | 静态 Field 验收完成；当时 Avatar slot 仅为占位 |
| M4 | 通过 | 完成 | 未批准 | `ms-avatar` / `ms-action` 产品切片完成，组件契约仍候选 |
| M5 | 通过 | 完成 | 未批准 | 20ms tick、Camera 策略和 backlog 上限是有限 `PRODUCT-DECISION`，不是 ABI 批准 |
| M6 | 通过 | 完成 | 未批准 | 两图 Portal 原子事务闭环，Portal/FieldPlan data 仍候选 |
| M7.1–M7.7 | 各切片通过 | 各编号切片完成；M7 总里程碑未完成 | 未批准 | 水域、返程、Rope、Back/Obj/viewport/animation 的有界证据 |
| M7.8 发布验证 | 本切片声明范围内通过 | M7.8 编号实验切片完成；M7 总里程碑未完成 | 未批准 | 四图 FieldPlan、ms-viewport frame、aqua link、release soak；见 [M7.8-RELEASE-VALIDATION-EVIDENCE.md](./M7.8-RELEASE-VALIDATION-EVIDENCE.md) |
| M7 总里程碑剩余缺口 | 未取证 | 未完成 | 未批准 | `+0x98`、type5–7、flow2/3、13 图扩展、envelope 外长跑、CMS079 像素 parity |

这里的“完成”只覆盖对应 Evidence 声明的范围。M7 子切片完成不等于 M7 总里程碑完成；任何一行“未批准”都禁止对外承诺字段稳定性或无迁移兼容性。

## 4. M0：可复现开发基线

> **状态：实验验证通过；M0 里程碑完成；不批准任何新组件或数据 ABI。** 历史复现记录见 [M0-BASELINE-EVIDENCE.md](./M0-BASELINE-EVIDENCE.md)。

### 4.1 目标

证明固定 LoomRealm 提交、锁定依赖、旧兼容运行路径、PWA staging 和真实 Chromium 验证在当前仓库中可复现。

M0 不设计或实现新的 Field、Map 或 `ms-*` 组件。

### 4.2 工作项

1. 确认根仓库与 `loom-realm` checkout 都位于记录的 Gitlink `93648192323bf5f57996b7b54cbae641d8a53fdb`；
2. 使用 lockfile 安装根仓库和 LoomRealm 依赖；
3. 构建 LoomRealm packages 和 common-controls 浏览器产物；
4. 校验 `cms-actor` classic browser artifact 未漂移；
5. 运行根测试，禁止真实 LoomRealm 集成测试被跳过；
6. 生成并复验 installation bundle；
7. 生成真实 generic PWA staging；
8. 运行 `cms-actor` Chromium 集成测试；
9. 在真实 Service Worker scope 下运行 canonical PWA E2E；
10. 把 Windows/CI 可复现命令、前置依赖和失败诊断写回开发文档或根脚本。

### 4.3 候选命令

PowerShell 下使用 `npm.cmd`，避免本机执行策略拦截 `npm.ps1`：

```powershell
git submodule update --init
npm.cmd ci --no-audit --no-fund
npm.cmd ci --prefix loom-realm --no-audit --no-fund
npm.cmd --prefix loom-realm run build:packages
npm.cmd test
npm.cmd run pwa:bundle
npm.cmd run pwa:staging
```

浏览器验收应与 `.github/workflows/pwa-ci.yml` 使用相同测试集合：

```text
components/cms-actor/test/integration.chromium.test.mjs
components/cms-actor/test/adventure-chromium.test.mjs
test/pwa-browser.e2e.test.mjs
```

如果本地缺少 Playwright Chromium，应按固定 LoomRealm PWA workspace 的 Playwright 版本安装浏览器，而不是额外引入另一套浏览器依赖。

### 4.4 退出条件

- 根测试 `fail 0` 且集成层 `skipped 0`；
- `cms-actor` Node 与 Chromium 测试全部通过；
- `pwa:bundle` 连续生成的 bundle 内容身份稳定；
- `pwa:staging` 生成 generic builder 的完整产物；
- canonical PWA 在 `/pwa/adventure-island/` 的 Service Worker scope 进入 active/ready；
- trusted keyboard 输入可驱动 stand/walk/jump/facing，viewport resize 可重新投影 Actor；
- 没有修改 LoomRealm Gitlink，没有把游戏代码写入 Submodule；
- 工作区只保留明确属于 M0 的脚本、文档或兼容修复。

## 5. M1：DOM + Multi-Canvas 架构验证

> **状态：实验验证通过；M1 里程碑完成；组件标签、字段闭集和预算 ABI 未批准。** 证据见 [M1-SPIKE-EVIDENCE.md](./M1-SPIKE-EVIDENCE.md)。

### 5.1 目标

先用 synthetic fixture 验证候选组件树能通过真实 WebProjector 正确投影，解决当前最大的架构风险：跨类型遮挡、HTMLElement identity、Shadow DOM 边界和局部 Canvas 更新策略。

### 5.2 最小树

```text
ms-scene-view
├─ ms-map-batch       background/static paint unit
├─ ms-world-item
│  └─ synthetic visual marker
└─ ms-map-batch       foreground/static paint unit
```

首轮只实现或构造：

- `ms-scene-view`；
- `ms-map-batch`；
- `ms-world-item`；
- synthetic pixels，不读取 Map FSDB。

### 5.3 必须证明

- WebProjector 管理 Light DOM 节点、属性、数据和同级顺序；
- `ms-scene-view` 只用一个共同 world-plane 承载可比较的 Paint Unit；
- Camera transform 在共同 world-plane 应用一次；
- Actor/marker 能插在两个静态 Canvas Paint Unit 之间；
- 每个 batch 使用有限 bounds 的独立 Canvas；
- Actor 位置 `update()` 不重绘静态 Canvas；
- `replace()` 的 reparent/reorder 保留未改变 identity 的 HTMLElement；
- 组件只管理自己的 Shadow DOM，不修改 LoomRealm managed Light DOM；
- 不按 Map layer 数量创建固定 Canvas，不创建世界尺寸 Canvas。

### 5.4 退出条件

- RenderNode snapshot 测试通过；
- 真实 WebProjector DOM identity/reorder 测试通过；
- Chromium 像素遮挡测试证明前后 batch 与 Actor 顺序正确；
- Camera 移动不触发静态 batch 重规划或重绘；
- DOM 数、Canvas 数、Canvas 像素面积和 paint 次数有首份测量；
- 基于实测结果批准或修订 Field 组件树与 Paint Unit 原则。

## 6. M2：单图内容闭包与投影

> **状态：实验验证通过；M2 里程碑完成；Adapter/Projection 生产 schema 与组件 ABI 未批准。** 证据见 [M2-ADAPTER-EVIDENCE.md](./M2-ADAPTER-EVIDENCE.md)。

### 6.1 目标地图

首图候选固定为 `222000000`。本阶段只建立静态内容闭包和纯数据投影，不实现完整 Movement。

### 6.2 数据流水线

```text
Content Map records/groups/resources
  → MapFacts
  → ResolvedMapScene
  → OrderedDrawable[]
  → PaintUnitPlan[]
  → RenderNode candidate
```

### 6.3 工作项

- 读取 `struct.map.Map`；
- 读取 Back、Tile、Obj、Foothold、Portal group；
- 关联 BackFrame、TileFrame、ObjFrame、HelperFrame；
- 审计 resource closure、group presence 和缺失语义；
- 在 Adapter 读取 JSONL 时捕获行号作为 `sourceOrder`；
- 为 placement、Portal 和 Paint Unit 生成稳定 identity；
- 计算 CMS079 已证明的 Tile/Obj depth key；
- 使用确定性 tie key 完成同键次序；
- 按动态插入点和资源/像素预算生成静态 batch；
- 输出 render-ready resource ref、origin、bounds、rank 和 placement，不把 WZ/FSDB 路径传给 Renderer。

首轮不因 DOM key 的便利修改 FSDB schema。只有在多图内容审计证明长期需要后，才单独评审显式 `sourceOrder` 字段。

### 6.4 退出条件

- Content validator 可区分缺失 group、空 group、缺资源和无画面 Portal；
- 相同内容输入生成稳定的 scene/projection hash；
- 所有 drawable 的来源可回溯到 mapId、group 和 source index；
- 排序、identity、resource closure 和 batch planner 具有 golden tests；
- 纯 Adapter/Projection 测试不依赖 DOM 或 Canvas。

## 7. M3：静态 Field 场景

> **状态：实验验证通过；M3 里程碑完成；Field/paint-unit/组件 ABI 未批准。** M3 的 Avatar slot 只属于当时的验收 fixture，证据见 [M3-FIELD-EVIDENCE.md](./M3-FIELD-EVIDENCE.md)。

### 7.1 目标

将 `adventure-map` 从“单个 viewport-centered Actor 演示”升级为一张真实地图的 Field Subsystem，并保持旧兼容入口可回归。

### 7.2 最小权威状态

```text
FieldState
├─ scene/map identity
├─ PlayerState
├─ MovementState
├─ CameraState
└─ PortalTravelState
```

### 7.3 首阶段能力

- 加载 `222000000`；
- 输出 Back、Tile、Obj 的 Paint Units；
- Player 使用世界坐标和世界 rank，不再固定在 viewport 中心；
- Actor 与 Tile/Obj 使用同一确定性深度序列；
- Camera 值由 Subsystem 投影给 `ms-scene-view`；
- viewport resize 只改变必要的 Camera/scene presentation；
- 静态 batch 不因 Player 或 Camera 高频变化重建。

可以短暂使用 synthetic marker 验证世界位置，但 M3 退出前必须把正式 Avatar 接入路径明确交给 M4，不能把 marker 当作产品完成。

### 7.4 退出条件

- 一张真实地图在真实 PWA/WebProjector 中正确显示；
- RenderNode children 顺序与 Adapter 排序一致；
- Player 能在至少两个静态 Paint Unit 之间正确遮挡；
- Camera transform 与 world coordinates 对齐；
- 内容失败、资源失败和 carrier replacement 有明确 last-good/失败行为；
- 静态场景具备 Node、Chromium、像素和性能基线。

## 8. M4：新纸娃娃接入世界

> **状态：实验验证通过；M4 路线图里程碑于 2026-11-19 完成；`ms-avatar` / `ms-action` ABI 未批准。** 复现命令、实测预算与剩余风险见 [M4-AVATAR-EVIDENCE.md](./M4-AVATAR-EVIDENCE.md)。

### 8.1 目标

实现 `ms-avatar` 与 `ms-action`，以 render-ready appearance/action 数据驱动局部纸娃娃 Canvas，并由 `ms-world-item` 承担世界位置。

### 8.2 迁移边界

可以复用旧 `cms-actor` 已验证的纯算法、测试思想和错误场景，但不得：

- 直接把 `cms-actor` 改名成 `ms-avatar`；
- 默认继承旧 AvatarPlan 为新 ABI；
- 让组件直接遍历 FSDB；
- 让 Avatar Canvas 处理世界坐标或 Camera；
- 让“动画播放完成”提交 Movement、Portal 或其他业务结果。

### 8.3 退出条件

- body/head/face/hair/装备按 origin、anchor、zmap 和 slot 规则组合；
- 世界位置更新只改变外层宿主，不重绘 Avatar 局部 Canvas；
- appearance/action 变化只更新必要的局部数据；
- facing、stand、walk、jump 具有真实 FSDB 像素测试；
- 缺资源、旧 epoch、断连和 teardown 不留下旧像素或未释放缓存。

## 9. M5：权威 Movement 与 Camera

> **状态：实验验证通过；M5 路线图里程碑于 2026-11-19 完成；简化积分模型、FieldState/MovementConfig 形状与组件 ABI 未批准。** 20ms tick、Camera 策略和 backlog 上限仅作为点名的 `PRODUCT-DECISION` 获准，不构成 ABI 批准。复现命令、来源边界、实测预算和剩余风险见 [M5-MOVEMENT-EVIDENCE.md](./M5-MOVEMENT-EVIDENCE.md)。

### 9.1 目标

把输入从视觉动作选择升级为 Subsystem 中的确定性 Movement intent 和 Simulation。

### 9.2 工作项

- 建立与 `requestAnimationFrame` 分离的固定业务 tick；
- 输入只更新 intent，不直接写 DOM；
- 实现 position、velocity、facing、mode、contact；
- 接入 Foothold layer/group 和基本落地/行走/跳跃；
- 按目标内容启用 Rope、Seat、水域；
- Camera follow、bounds clamp 和 viewport intent 由 Subsystem 维护；
- 将 position/rank 与 facing/locomotion 分成最小 Render updates。

具体 tick 数值、Camera deadzone 和平滑策略必须由 CMS079 证据或明确 `PRODUCT-DECISION` 批准，不能从 OpenMS 参数直接复制。

### 9.3 退出条件

- 相同初始状态、内容版本、输入序列和 tick 序列产生相同 FieldState hash；
- 相同业务结果产生相同 RenderNode snapshot；
- Renderer 暂停、丢帧或动画帧率变化不改变 Movement 结果；
- Actor、Camera、地图在多个 viewport 尺寸下保持对齐；
- 高频更新不重发完整 Avatar plan 或重绘静态地图 batch。

## 10. M6：Portal 原子场景事务

> **状态：实验验证通过；M6 两图事务里程碑于 2026-11-20 完成；组件、Portal data 与 FieldPlan ABI 未批准。** Node、Subsystem、bundle、staging、真实 Chromium 单向旅行与预算证据见 [M6-PORTAL-EVIDENCE.md](./M6-PORTAL-EVIDENCE.md)。

### 10.1 首个闭环

先支持候选相邻图：

```text
222000000 ↔ 222000001
```

### 10.2 业务顺序

```text
validate trigger
  → resolve unique target
  → prepare target content/resource closure
  → build target projection candidate
  → precompute complete FieldState + Player + Camera candidate
  → replace authoritative Render tree（失败则不提交 authority）
  → synchronously install the prepared authority snapshot
  → renderer prepares local pixels asynchronously
```

### 10.3 退出条件

- 同图 Portal 只更新 Player/Movement/Camera 必要状态；
- 跨图准备失败保留源地图 last-good state；
- 不出现新 mapId 配旧 Player、Camera 或 Portal token 的半提交状态；
- 无画面 Portal 可以正常触发业务；
- `ms-portal-visual` 只负责画面，不拥有 target、cooldown 或 travel；
- Renderer-local transition 不决定业务是否已经换图；
- Portal 选择、到达位置、速度清零和首帧 Movement 可回放。

## 11. M7：三图闭环与内容扩展

> **状态：M7.1–M7.7 的限定实验分别验证通过，七个编号子切片分别完成；M7 总里程碑未完成；组件、FieldPlan、Movement 与动画时序 ABI 均未批准。** M7.7：13 图 scope 内 200 条 `ani=1` + `230030200` 21 宿主 → 全帧资源闭包 + renderer-local `delay` 循环；详见 [M7.7-BACK-ANIMATION-EVIDENCE.md](./M7.7-BACK-ANIMATION-EVIDENCE.md)。M7.6：`800×600`↔`1000×700` envelope → 12 Back + 11 flow Obj layout-only 失效；详见 [M7.6-VIEWPORT-RELAYOUT-EVIDENCE.md](./M7.6-VIEWPORT-RELAYOUT-EVIDENCE.md)。M7.5：`230030200` 11 条 `flow:1` 鱼 Obj → `ms-map-object` 多帧 `delay` + `rx` 滚动 + 有界水平平铺；详见 [M7.5-OBJ-FLOW-EVIDENCE.md](./M7.5-OBJ-FLOW-EVIDENCE.md)。M7.1–M7.4 证据链见同目录前述文档。

### 11.1 三图候选集

```text
222000000  陆地图、完整 VR、多出生日志
222000001  相邻陆地图和 Portal 边界
230030200  水图、无 VR fallback、跨环境跳转
```

### 11.2 工作项

- 水域 Movement、游泳和水中跳跃；
- RopePlan、抓绳、攀爬、离绳与真实 B→A 返回（M7.3 实验切片已完成）；
- 无完整 VR 时的 effective bounds fallback；
- 三图 Portal graph、资源闭包和存在性审计；
- Back repeat/parallax/auto-scroll/动画（M7.4：type1–4 有界产品切片已在 230030200 取证；M7.6：envelope 内 `800×600`↔`1000×700` relayout 已取证；M7.7：type0–4 `ani` 全帧 + `delay` 循环已在 13 图 scope 取证；`+0x98` 视差、envelope 外 relayout 与 type5–7 仍缺口）；
- 独立动态 Obj 与 Portal visual phase（M7.5：`flow=1` 有界切片已在 230030200 取证；`flow=2/3`、完整 0x66A8D5 子实例与 Portal phase 仍缺口）；
- Renderer-local transition；
- Canvas、DOM、decode、CPU、内存和 composite 性能预算；
- 三图稳定后扩展现有 13 图。

NPC、Mob、Quest、Combat 和完整 UI/HUD 不因 13 图扩展自动进入范围。

### 11.3 退出条件

- 三图从启动、移动、Camera、Portal 到返回形成可重复闭环；
- 陆地和水域状态切换可回放；
- 每张图的内容缺口和不支持行为显式诊断；
- 13 图扩展只增加内容覆盖或已批准能力，不改变既有权威边界；
- 性能优化不破坏跨 Tile/Obj/Actor 的遮挡正确性。

### 11.4 M7.7 之后的候选实现清单

下列能力已经进入当前 `main`，并在 M7.8 Evidence 中形成有界发布验证；它们仍是 **候选接口 / 已验证实现**，不是 M7 总里程碑完成或 ABI 批准：

- `ms-viewport` 的 640×480…1280×720 合法 frame 选择、范围内 1:1 呈现与极端宽高比 cover；
- Camera 以 player feet、hold zone、VR/foothold bounds 为输入的扩展跟随策略；
- 更完整的地面/空中加速、摩擦、落地、drop-through、prone、Seat、地图边界与未连接竖直边处理；
- 扩展游泳力、idle sink/rise、游泳 foothold、南边跳跃和第四图 `230030100` 往返；
- 单手装备闭包、宽地图 Canvas 分批、重复背景视口 Canvas、静态砖块一次绘制以及高频属性/宿主更新抑制；
- Content 通过 LoomRealm database path 装载及对应 PWA/CI 工程化。

M7.8 只升级了本清单的验收状态，没有升级接口批准状态。不得从提交标题或局部测试反推 ABI 稳定性；后续正式 ABI 仍需独立评审。

### 11.5 M7.8：发布验证切片（2026-11-28）

> **状态：M7.8 限定实验验证通过；M7.8 路线图编号切片完成；M7 总里程碑未完成；组件与数据 ABI 未批准。**
> 证据见 [M7.8-RELEASE-VALIDATION-EVIDENCE.md](./M7.8-RELEASE-VALIDATION-EVIDENCE.md)。

#### 范围

- 四份已发布 FieldPlan 与 PWA `resource.Map` 并集（397，不得低于 M7.7 门）；
- `ms-viewport` / `ms-viewport-frame` 合法尺寸选择与 relayout 稳定性；
- 四图 Portal graph 含 `230030100` aqua link 的 Node 事务闭包；
- 扩展 Movement（陆地/水域/Rope/Seat/drop-through/prone）沿用既有回归，不降低 M5–M7.3 断言；
- 单手装备与静态地图批次/砖块在高位移属性更新下的失效边界；
- 真实 Chromium：`230030100` ready 与静态 paint 不重读；
- Canonical PWA：默认 6 周期 release soak；发布前 30 分钟资格命令（`scripts/release/run-release-soak.mjs`）已于 2026-11-28 实测通过。

#### 退出条件

- `systems/adventure-map/test/map-m78-release-validation.test.mjs` 全绿且 M7.8 预算 ≥ 对应 M7.1–M7.7 Immutable 行；
- `components/ms-field/test/release-chromium.test.mjs` 全绿；
- Linux Chromium import-map 修复（`f3bc8116`）在 CI 复绿；本切片不修改 `loom-realm`；
- bounded PWA release soak 在 staging URL 下全绿；30 分钟发布资格门实测全绿，不替代 M7 总里程碑；
- 显式记录 M7 总里程碑剩余缺口，不得宣称 CMS079 像素 parity 或 ABI 批准。

## 12. 组件实施顺序

组件按风险和依赖排序，而不是按画面从后到前排序：

1. `ms-scene-view`：确认 viewport、world-plane 和 Camera transform；
2. `ms-map-batch`：确认静态局部 Canvas 与 Paint Unit；
3. `ms-world-item`：确认世界位置与跨类型插入；
4. `ms-map-back`：接入 Back 特有布局和 Camera-relative 呈现；
5. `ms-avatar` / `ms-action`：接入局部纸娃娃；
6. `ms-map-object`：只服务需要独立更新或深度身份的 Obj；
7. `ms-portal-visual`：只服务确有画面资源的 Portal。

Foothold、Rope、Seat、Camera 和 Portal travel 是业务能力，不因存在逻辑记录就新增视觉组件。

## 13. 文档冻结顺序

组件文档不应脱离上游合同独立冻结。建议先评审：

1. `FieldState` 权威状态模型；
2. `ResolvedMapScene` / `PaintUnitPlan` 投影模型；
3. world order、stable identity 和 batch planner；
4. RenderNode tree 与真实 WebProjector 行为；
5. 各 `ms-*` 组件的 attrs/data/children 闭集。

每份组件文档进入批准前，至少要绑定：

- 上游字段来源；
- Light DOM/Shadow DOM/Canvas 结构；
- 坐标空间和排序语义；
- `replace/update/emit` 更新分类；
- Content resource 与取消语义；
- last-good、旧 epoch、断连和 teardown；
- Node、WebProjector、Chromium、像素、故障和性能测试。

## 14. 每个里程碑的交付纪律

每个实施提交或 PR 都应说明：

1. 本次只完成哪个里程碑的哪些退出条件；
2. 使用了哪些 `FSDB-FACT`、`CMS079-PROVEN`、`OPENMS-REFERENCE` 和 `LOOMREALM-CONTRACT`；
3. 新增了哪些 `PRODUCT-DECISION`；
4. 哪些缺口仍未解决；
5. 如何复现 Node、浏览器和像素验证；
6. 是否修改 Content schema、RenderNode schema 或 LoomRealm 集成；
7. 是否影响旧 `cms-*` 兼容路径。

禁止以演示可见为由跳过：确定性、失败原子性、资源取消、旧回调隔离、真实 WebProjector 和 Service Worker 验证。

## 15. 立即下一步

当前实施基线已完成 **M0–M6 路线图里程碑**，分别完成 **M7.1–M7.7** 编号实验切片（见 [M7.1](./M7.1-WATER-THREE-MAP-EVIDENCE.md)–[M7.7](./M7.7-BACK-ANIMATION-EVIDENCE.md)），并完成 **M7.8 发布验证切片**（见 [M7.8](./M7.8-RELEASE-VALIDATION-EVIDENCE.md)）。**M7 总里程碑未完成；新 `ms-*`、FieldPlan、FieldState、Movement 和动画 data ABI 均未批准。**

下一轮按以下顺序收口：

1. `main` 的当前已推送基线 `60f7d7ad` 上，Legacy PWA Compatibility CI 与 PWA Deploy 均全绿；本地 M7.8 新增门提交后仍需远端复验；
2. M7.8 发布验证切片已取证（见 [M7.8-RELEASE-VALIDATION-EVIDENCE.md](./M7.8-RELEASE-VALIDATION-EVIDENCE.md)）；继续将 `+0x98`、type5–7、flow2/3、13 图扩展与 envelope 外长跑列为 M7 总里程碑缺口；
3. 30 分钟 release soak 发布资格门已于 2026-11-28 实测通过（1,805.3 秒、53,747 周期、heap proxy 21,763.3、event-loop lag 4.3ms）；ordinary CI 保持 bounded 6 周期与现有 M0–M7.7 门；
4. 只有在单独 ABI 评审记录批准后，才同步更新 `design/ms-components/` 的候选状态；路线图或 Evidence 不单独承担 ABI 批准。

2026-11-18–21 的历史本机记录见 [M0-BASELINE-EVIDENCE.md](M0-BASELINE-EVIDENCE.md) 至 [M7.7-BACK-ANIMATION-EVIDENCE.md](./M7.7-BACK-ANIMATION-EVIDENCE.md)。M7.8 记录见 [M7.8-RELEASE-VALIDATION-EVIDENCE.md](./M7.8-RELEASE-VALIDATION-EVIDENCE.md)。既有 M3–M7.7 验收门保持不变；后续实现不得降低其预算断言，也不得宣称未取证的 CMS079 像素 parity。
