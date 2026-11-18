# M1 synthetic field spike

> **状态：实验实现 / NOT APPROVED / 不是正式组件 ABI。**
> 本目录只验证 [M1](../../design/roadmap/IMPLEMENTATION-ROADMAP.md) 的 synthetic WebProjector + DOM/Multi-Canvas 结构。它不读取 Map FSDB，不实现 Movement、Portal、`ms-avatar` 或 `ms-action`，也不修改根 `presentation.json` 的旧 `cms-actor` 路径。

候选组件文档仍然是未批准草案。这里的校验器、synthetic marker 子节点和 Canvas 预算只服务这次隔离实验：

- `ms-world-item` 的候选文档要求直接子节点是 `ms-avatar`。本 spike 固定使用一个 `ms-synthetic-marker`，用来观察世界位置和遮挡，不把该标签写成正式 ABI。
- 场景根在本实验里只接受 `ms-map-batch` 与 `ms-world-item`。候选文档中的 back、object、portal 标签没有实现，也没有因此被删除或批准。
- 投影必须经过固定 LoomRealm 的 `RendererRenderStore` 与 `WebProjector`。`src/store-bridge.mjs` 只读取 Store 的 presentation facts 并调用真实 projector，不维护第二套场景树。

运行：

```powershell
node components/ms-field-spike/scripts/build.mjs --check
node --test components/ms-field-spike/test/validate.test.mjs components/ms-field-spike/test/snapshot.test.mjs components/ms-field-spike/test/store-bridge.test.mjs
node --test components/ms-field-spike/test/chromium.test.mjs
```

Chromium 测试使用 loom-realm 已固定的 Playwright，以及构建后的 `packages/renderer/dist`。
