# M5 权威 Movement 与 Camera — 验证证据

> **里程碑状态：M5 路线图验收门在本机闭环（实验）。**
> **批准状态：20ms tick、Camera 策略和 backlog 上限已批准；简化积分模型、FieldState 扩展与 `ms-*` 组件 ABI 未批准。**

## 1. 本阶段边界

- `adventure-map` Subsystem 持有 **20ms 固定业务 tick**、position/velocity/mode/contact、Camera clamp 与最小 Render updates 的唯一权威。
- `AdventureFieldPlan` 发布 **render-independent** 的 `footholdCollisionPlan`（≤512 段）和带源 `contentVersion` 的 `movementConfig`；Foothold hash 在构建期校验，运行期由 FieldPlan Content identity 保护，Renderer 不运行碰撞。
- Camera **每业务 tick** 以权威 player feet 为中心并 clamp 到 `effectiveBounds`；**无 deadzone、无 smoothing**（`PRODUCT-DECISION`）。
- 墙钟调度与 `requestAnimationFrame` 分离；每轮 drain **最多 8 tick**，超额 backlog **丢弃** 并产出 `SIMULATION_BACKLOG_DISCARDED` 诊断（`PRODUCT-DECISION`）。
- 动画 action/facing **仅**来自权威 movement state；高频更新只命中 `player:adventure`（world-x/y）、`player:adventure:avatar`（action/facing/帧计时）、`scene:map222000000`（camera-x/y）。Foothold layer/group 改变时只原子更新受影响宿主的 `stack-rank` 和 Player provenance，不重发静态 Canvas 数据。
- **未实现**：Rope、Seat、水域、Portal、跨图、drop-through、未证明的 CMS079 梯形积分。

## 2. 来源标签

| 项目 | 标签 |
| --- | --- |
| 20ms 业务 tick | **PRODUCT-DECISION**（用户批准；非 OpenMS 30ms） |
| 每 drain ≤8 tick + 丢弃超额 | **PRODUCT-DECISION** |
| Camera 立即居中 + clamp | **PRODUCT-DECISION** |
| `walkSpeed=125`、`jumpSpeed=555`、`gravityAcc=2000`、`fallSpeed=670` | **FSDB-FACT**，来自 `struct.physics.Default/physics.default`，源字节 SHA-256 随 FieldPlan 发布 |
| 常速/常重力积分与空中水平速度语义 | **EXPERIMENTAL-MODEL**，非 CMS079 force 链、非正式手感批准 |
| Foothold 段 x1/y1/x2/y2/layer/platform/id | **FSDB-FACT** via M2 closure |
| `screen = world - camera` | **CMS079-PROVEN**（静态） |

## 3. 已验证的行为（实验）

- 纯 Node：`222000000` 闭包 foothold plan 有界、hash 稳定；spawn 吸附 foothold 163；行走/跳跃/落地回放 hash 一致。
- Subsystem 合同测试：输入回调只改 intent，不额外推进 tick；20ms simulation tick 投影 world/camera/avatar。
- 首个可见 RenderNode 快照已使用权威落地点 `y=243` 和 Foothold 深度 rank 155，不存在 bootstrap 旧坐标闪帧。
- 扫掠落地选择首个穿越平台；垂直 Foothold 不误作地面；离开边缘单 tick 不重复水平积分。
- canonical FieldPlan 构建含 376 段 `footholdCollisionPlan` 和 FSDB 派生 `movementConfig`。
- 真实 Chromium：world-x/y、Camera、stack-rank 更新都不重绘静态地图 Canvas；action/facing 只重绘 Avatar 局部 Canvas。

## 4. 预算

| 项目 | 上限 | M5 变更 |
| --- | ---: | --- |
| M4 全字段预算 | 见 M4-AVATAR-EVIDENCE | **未降低** |
| footholdCollisionPlan 段数 | 512 | 222000000 实测 376 |
| 视觉 Canvas 数 | 310 | 实测 298 |
| 单 Canvas 宽/高 | 4096 / 4096 | 实测最大 1890 × 573；最大面积 680,208 px |
| FieldPlan 资源闭包 | 190 | 实测 171，不变 |
| 首帧底层 Content 读取 | 170 | 实测 150，并发上限 8（PWA 限制 32） |
| Node 全图投影 | 8,000ms | 最终复验 124.2ms |
| Chromium canonical ready | 240,000ms | 最终复验 871ms（测试主体约 2.55s） |
| PWA Content 条目 | M4 基线 191 | 实测 191，不变 |

## 5. 可复现命令（Windows）

```powershell
node --test --test-concurrency=1 systems/adventure-map/test/*.test.mjs
node --test --test-concurrency=1 test/adventure-runtime.test.mjs test/adventure-map-movement.test.mjs test/adventure-map-field-bridge.test.mjs
npm.cmd test
```

Chromium（已有 harness，非根 `npm test` 默认集合）：

```powershell
node --test --test-concurrency=1 components/ms-field/test/map-222-chromium-canonical.test.mjs
npm.cmd run pwa:staging
Copy-Item -Recurse -Force dist/staging/adventure-island/* loom-realm/apps/pwa/dist/staging/pwa/adventure-island/
$env:LOOMREALM_PWA_BASE_PATH='/pwa/adventure-island/'
node loom-realm/apps/pwa/scripts/run-e2e.mjs staging "$PWD/test/pwa-browser.e2e.test.mjs"
```

最终结果：根测试 81 项，78 通过、0 失败、3 项因 Windows symlink EPERM 跳过；组件 Node 20/20；canonical Chromium 1/1；真实 PWA Chromium 2/2（约 2.00s + 25.00s）。最终 staging 保持 191 个 Content 条目，bundle identity 为 `loomrealm-pwa-sha256-b64b29470922d44e8ff2659869c55f06078e142309ef1f5277dc2934f4e3cfd3`。

## 6. 状态区分

- **实验验证通过**：纯 simulation、Subsystem 投影边界、FieldPlan foothold 发布、canonical invalidation 可复现。
- **路线图里程碑完成**：M5 9.3 最小闭环（陆地图行走/跳/落、Camera follow、确定性 hash、最小 Render updates）。
- **正式 ABI 未批准**：`ms-world-item`/`ms-scene-view` attrs 闭集、FieldState/MovementConfig 形状和简化积分语义仍可调整。

## 7. 剩余风险

1. 简化积分与 CMS079 梯形/受力链不等价；仅保证闭包内确定性，不宣称原版手感一致。
2. 墙钟 `setInterval(4ms)` drain 已通过真实 PWA 短跑，但与省电/后台节流交互尚未长跑取证；backlog 丢弃通过结构化 `console.warn` 诊断可观察。
3. 陡 slope、Foothold prev/next、`forbidFallDown`、`force` 尚未进入本阶段模型。
4. Rope、Seat、水域、Portal、跨图事务仍属于后续里程碑；M6 首先处理 Portal 原子场景事务。
