# OpenMS 行为参考 → Adventure Island 产品契约（DRAFT）

> 目标：使用 OpenMS（https://github.com/tensorfish/openms @ `07994de02756356e3e025e3aca9e79433898d2c8`）提供可证伪的行为候选，而不是拷贝 GPL 代码。冻结 ABI 不变；任何冲突采用 ADR 审批。

## 1. 分层责任与数据流

```text
用户本地授权 WZ/FSDB → Bundle Builder → MapScenePlanV1 / LogicalResourceRefV1
可信输入 → game-controls-input → InputGate → Field Runtime / Subsystem
                                            ├── Map / Foothold / Movement / Clock
                                            ├── Camera / Portal / Avatar state
                                            └── Shared State（权威位置、地图、速度）
                                             ↓
                              Render Projection / RenderDomain
                                             ↓
                                 Frozen RenderNode ABI v1
                                             ↓
                                     cms-* Web Components
```

- OpenMS 的 PixiJS/客户端或服务器实现不得成为本作的 RenderNode 格式或状态所有者；移植行为必须经过本作独立纯函数、数据 Adapter、输入及渲染投影。
- Frozen ABI 的 `key,tag,attrs,data,children` 五字段、one-shot key、`sceneEpoch`、Render Event、输入反向能力保持不变。新增产品内部状态不自动变成公开 attrs/data。
- MapScenePlanV1 是逻辑模型，不是 WZ、FSDB 或 RenderNode。资源只以 `LogicalResourceRefV1` 进入组件，禁止原始路径、URL、隐藏源定位器；未知/缺资源有确定性诊断。
- 默认世界坐标 Y 向下，`screen=world-camera`、1:1 CSS px；`bounds` 已经过 VR 内缩，不再二次内缩。Camera 是否 deadzone/平滑需另定。
- 输入经 InputGate；`cms-portal` 只画、不直接决定传送；地图切换先构建/验证，再成功原子 replace，失败保留旧地图并回滚输入/状态。
- 不运行原始 CMS079 客户端；允许本作测试夹具、自己开发的产品客户端和 PWA/Hostra E2E。

## 2. 五阶段行为契约及拟议验收

| 阶段 | 产品目标 | 可复现的验收 | 仍需审批 |
|---|---|---|---|
| P0 Content | 13 图 Info、Tile/Obj/Back、Rope/Seat/Foothold、Portal、Physics 与 Bundle 闭包 | 13/13 manifest、解析 schema、缺失图/帧/链接环/资源 hash 失败案例 | 数据 fallback、link 继承、特殊字段 |
| P1 Scene | 前远后近景、8 层 Tile/Obj、type0–4 平铺/视差/滚动、Avatar anchor/zmap/smap、Portal 可见帧 | 全图快照、Golden 坐标、同键稳定排序、帧序列、窄视口裁剪 | Back 时钟/flow/缺帧对策不能破坏 ABI |
| P2 Camera | world-to-screen、VR/clamp、焦点跟随、传送首帧、resize 独立 | 固定状态轨迹/小图/边界/resize 不改角色 x/y/vx/vy | 目标点、deadzone、平滑曲线与速度 |
| P3 Movement | 地面/坡/跳/游泳/绳梯/座位/下跳状态机、固定时间推进 | 5 陆地/8 水图，逐帧重放、跨段、端点、掉帧、穿透、姿态用例 | Tick 与装备系数；死亡/战斗非当前 MVP |
| P4 Portal | 同图和跨图 tm/tn、落点/速度/姿态、输入冷却、原子场景替换 | 3 图双向门 smoke、13 图可达图、特殊 pt、失败回滚、连按 | 旧四门 vs 全13图、命中盒、冷却和首帧相位 |

**不可以**把上述表格理解为任何行为已实现。具体数值只能通过产品 ADR 选定，不能把 GMS083 结果写成 CMS079 的 A 级 Evidence。

## 3. OpenMS 输入的追溯卡

每条最终采纳行为应有：`requirement_id`、OpenMS SHA、源路径/文档链接、原始行为的**独立表述**、目标 13 图对应资源验证、版本差异、候选方案、权衡/产品批准、输入输出/边界用例、测试夹具、独立 Reviewer。

产品路线术语：`OPENMS-ADAPT`（算法候选需本地重新实现）、`LOCAL-CONTRACT`（遵守已定本作接口/行为）、`DATA-FIRST`（本地 13 图资源优先）、`PRODUCT-CHOICE`（要审批策略）、`DEFER`（不纳入此版本）。这些是设计分类，**不是**旧 Readiness 或 Gap status。

## 4. 七项先行 ADR

1. DEC-01：13 图全部有效 Portal 的 enabled 全边、闭包外、特殊 pt，与旧四门白名单的兼容迁移。
2. DEC-02：Camera 跟随焦点（脚底/中心/脚本位置）、deadzone/平滑与小图夹取。
3. DEC-03：Movement 固定 dt、Accumulator、最大子步、帧率等价和大延迟处理。
4. DEC-04：Portal 命中盒、冷却与重复输入抑制、场景切换和 Camera 同步先后。
5. DEC-05：Back/Obj flow、auto-move 与帧 delay 缺失和产品时钟，Frozen ABI 冲突的版本策略。
6. DEC-06：是否需要 CMS079 老服务端协议兼容；若需要，单独协议 Adapter 与验收，不直接采用 GMS083 opcode。
7. DEC-07：是否允许直接使用任何 GPL-3.0 代码；默认不允许，必要时专项许可证审查（同时单独核实素材分发权）。

## 5. 授权与独立实现边界

OpenMS 根 LICENSE 是 GPL-3.0；未审查直接复制或构成衍生的模块时，不得引入其 GPL 代码或发布构建产物。即使只取行为做独立实现，也应记录算法来源、专利/版权疑虑（如有）和本地代码 provenance；不得照抄反编译伪代码大段文本。原始游戏图像、WZ 等权利单列评估。不能把“OpenMS 可访问”当作“代码/素材可以任意分发”。

## 6. 核心硬门槛

- 保留 Frozen RenderNode ABI v1 和 LoomRealm `93648192323bf5f57996b7b54cbae641d8a53fdb`。
- 当前 MapScenePlan/PortalPlan schema 不得静默更改，若要改向设计 ADR + 新版本文档。
- Feature Ready 需要批准的产品契约、代码、13 图相关测试及独立复核；设计 draft 本身不等于实现。
- 未证实的 GMS083/CMS079 对应关系记录差异，不要求以另一版本替代 CMS079 原版结论。
