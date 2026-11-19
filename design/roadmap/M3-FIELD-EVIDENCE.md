# M3 静态 Field 场景与统一世界排序证据

> **状态：M3 验证通过（路线图 7.4 退出条件已取证）/ `ms-m3-avatar-slot` 仍为 M4 占位 / 组件 ABI 未批准。**
> 完整 canonical `222000000` 场景（297 地图 Paint Unit + 玩家）已在 Node 投影、真实 `RendererRenderStore` + `WebProjector` Chromium、以及 canonical PWA Service Worker 下验收。**不得**将 slot 占位或 M4 路径误报为正式 Avatar 产品能力。

## 范围

```text
FieldState (static)
  + buildMapProjection (M2)
  → insert ms-world-item / ms-m3-avatar-slot
  → cameraForViewport
  → ms-scene-view RenderNode
  → RendererRenderStore → WebProjector → ms-* Custom Elements
```

实现目录：`components/ms-field/`。公开入口 `buildFieldProjection()`。`systems/adventure-map/subsystem.mjs` 经 Content `AdventureFieldPlan/bootstrap` 与 `field-scene-runtime.mjs` 投影默认 Field Frame。

## 命令与结果（Windows / Node 24，2026-11-19 本机复验）

```powershell
node components/ms-field/scripts/build.mjs --check
node --test components/ms-field/test/field-project.test.mjs components/ms-field/test/map-222-field.test.mjs components/ms-field/test/map-222-canonical.test.mjs components/ms-field/test/validate.test.mjs components/ms-field/test/snapshot.test.mjs components/ms-field/test/store-bridge.test.mjs components/ms-field/test/performance-baseline.test.mjs components/ms-field/test/carrier-lifecycle.test.mjs
node --test components/ms-field/test/chromium.test.mjs components/ms-field/test/map-222-chromium-canonical.test.mjs components/ms-field/test/carrier-lifecycle.test.mjs
node --test test/adventure-map-field-bridge.test.mjs
npm.cmd test
node --test components/ms-map-adapter/test/map-222000000.test.mjs
node --test components/ms-field-spike/test/chromium.test.mjs components/ms-field-spike/test/validate.test.mjs components/ms-field-spike/test/snapshot.test.mjs components/ms-field-spike/test/store-bridge.test.mjs
npm.cmd run pwa:staging
# canonical E2E（与 CI 相同 staging 拷贝 + LOOMREALM_PWA_BASE_PATH）
Copy-Item -Recurse -Force dist/staging/adventure-island/* loom-realm/apps/pwa/dist/staging/pwa/adventure-island/
$env:LOOMREALM_PWA_BASE_PATH="/pwa/adventure-island/"
node loom-realm/apps/pwa/scripts/run-e2e.mjs staging "$PWD/test/pwa-browser.e2e.test.mjs"
```

| 命令 | 结果（本机最近一次） |
| --- | --- |
| `build.mjs --check` | `browser/ms-field.browser.js matches sources` |
| ms-field Node（含 canonical + carrier） | tests 10，pass 10，fail 0 |
| ms-field Chromium（含 full canonical + carrier） | tests 9，pass 9，fail 0 |
| `adventure-map-field-bridge` | pass 3 |
| 根 `npm test` | tests 56，pass 53，fail 0，skipped 3（Windows EPERM symlink 分支） |
| M1 spike / M2 adapter | pass 12 + pass 25 |
| `npm run pwa:staging` | `contentCount` 190，`bundleId` `loomrealm-pwa-sha256-5527f3a…` |
| canonical E2E | pass 2，fail 0 |

## 实测预算（222000000，viewport 800×600，DPR 1）

| 量 | 实测值 | 测试上限（慷慨，非 SLA） |
| --- | --- | --- |
| 视觉 Canvas 数（297 地图 + slot） | **298** | 310 |
| 最大局部 Canvas 宽 × 高 | **1890 × 573** | 2048 × 2048 |
| 最大单 Canvas 像素 | **680 208** | 4 194 304 |
| 局部像素总面积 | **19 336 136** | 24 000 000 |
| FieldPlan 资源闭包（发布 / PWA） | **167** | 190 |
| 静态首帧实际 underlying Content 读取（去重后） | **146** | 170 |
| 读取并发峰值（client + test server） | **≤ 8** | < 32（PWA Content 门限） |
| Node 全图投影耗时 | **< 1s** | 12 000 ms |
| Chromium 全场景 `ready`（298 host + `resourceActive=0`） | **约 5–9s** | 240 000 ms |

说明：**167** 是 FieldPlan / RenderNode 上的完整 `resource.Map` 闭包（含 batch 内未首帧绘制的 sprite page）；**146** 是静态首帧实际发起的 underlying 读取数（batch 只读 placement 引用的 page）。两者均在测试中分别断言。

## M3 退出条件对照（路线图 7.4）

| 条件 | 状态 | 证据 |
| --- | --- | --- |
| 一张真实地图在真实 **PWA/WebProjector** 中正确显示 | **通过** | `map-222-chromium-canonical.test.mjs` 298 Canvas 首帧非透明像素；canonical `test/pwa-browser.e2e.test.mjs` Field 场景 |
| RenderNode children 顺序与 Adapter 排序一致 | **通过** | `map-222-field.test.mjs`、`map-222-canonical.test.mjs` 密集 `stack-rank` |
| Player 在至少两个静态 Paint Unit 之间正确遮挡 | **通过** | Node rank 插入；Chromium DOM 序 + full canonical `playerIndex` |
| Camera transform 与 world coordinates 对齐 | **通过** | full canonical camera `update` 不重绘 batch/back |
| 内容/资源/carrier 失败语义 | **通过** | Chromium 独立 Obj/Portal 失败与 replacement last-good；`carrier-lifecycle.test.mjs`（carrier retire、stale async、disconnect、teardown）；首帧 Content 去重 + 8 路并发 |
| 静态场景 Node、Chromium、**像素和性能**基线 | **通过** | `canonical-budgets.mjs` + Node/Chromium canonical 测试 |
| **`adventure-map` 升级为 Field Subsystem（7.1）** | **通过** | `subsystem.mjs` + FieldPlan Content；bridge + PWA E2E |

## `222000000` 摘要

- M2 投影：297 Paint Units + 稳定 hash `sha256:92fa3fc0…`
- M3 静态 Field：插入 `player:adventure`（spawn `-92/294`，layer 0）后 298 子节点；Field hash（viewport 800×600）`sha256:c2639610…`
- 玩家子节点：`ms-world-item` → `ms-m3-avatar-slot`（`m4TargetTag: ms-avatar`）

## M4 交接（仍属后续里程碑）

- 保留 `ms-world-item` 外层世界坐标与 `stack-rank`。
- 将 `ms-m3-avatar-slot` 替换为正式 `ms-avatar` + `ms-action`。
- Movement tick、Portal travel、Back type1–4 布局均未实现。

## M3 结论

**M3 退出条件已满足。** 静态 Field 投影、全图 298 Canvas 首帧验收、FieldPlan 闭包与首帧读取分离、统一深度序列、Camera 更新分离、Renderer carrier 生命周期与 canonical PWA 行为均已取证。正式 Avatar、Movement 与 Portal 仍归属 M4+。
