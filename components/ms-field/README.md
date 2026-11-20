# M3 static Field + M4 Avatar + M5 Movement/Camera integration

> **状态：M3–M6 路线图验证通过（见 `design/roadmap/M3-FIELD-EVIDENCE.md` … `M6-PORTAL-EVIDENCE.md`）/ 实验实现 / NOT APPROVED / 不是正式组件 ABI。**
> 把 `components/ms-map-adapter/` 的纯投影接入真实 `RendererRenderStore` + `WebProjector`。根 `presentation.json` 注册 `ms-field`；`adventure-map` Frame 以 FieldPlan 为 seed，在 Subsystem 内维护 Movement/Camera 权威并投影 `222000000` 场景树。

资源读取由 Renderer resource client 作用域内的共享池负责：同一 `namespace/key/contentVersion` 只读取一次，并以 8 路并发向 LoomRealm Content 请求。每个 Paint Unit 仍独立解码和绘制自己的有限 Canvas；组件断开只取消自身等待，不会中断其他组件共享的 immutable Content 读取。

## M4 Avatar 接入路径

- 玩家宿主：`ms-world-item`（世界坐标 + `stack-rank`）。
- 玩家子节点：`ms-world-item` → `ms-avatar` + `ms-action`（`avatar-field-projection.mjs` / `plan-projection.mjs`）。
- Renderer 消费 Subsystem 投影的 `action` / `facing` / `frame-index` / `elapsed-ms`；世界坐标仍在 `ms-world-item`。

## M5 Movement / Camera 接入路径

- `adventure-map` Subsystem 独占 position、velocity、mode、contact、CameraState 和 20ms 业务 tick；输入只更新 intent。
- `AdventureFieldPlan` 携带有界 Foothold collision plan，以及从 `struct.physics.Default/physics.default` 派生并带源 SHA-256 身份的 MovementConfig。
- 高频投影只更新 Player world-x/y、Avatar action/facing/视觉帧与 scene camera-x/y；Foothold 深度变化只更新受影响宿主的 stack-rank，不重发静态画面数据。
- 首个可见快照已经使用吸附后的权威坐标、Camera 和 Player 深度，避免旧 bootstrap 坐标闪帧。
- 证据、预算和未批准边界见 `design/roadmap/M5-MOVEMENT-EVIDENCE.md`。

## M6 Portal 接入说明（实验）

- `AdventureFieldPlan` 额外携带 `portalLogicalIndex` 与 `sceneEpoch`；`struct.AdventureFieldPlan/map222000001` 与 `bootstrap` 并列发布。
- Portal trigger/target/travel 仅在 `systems/adventure-map` Subsystem；`ms-portal-visual` 不参与业务提交。
- 跨图事务经 `domain.replace` + 场景 epoch 静态键后缀；同图仅 Player/Movement/Camera 更新。
- 证据见 `design/roadmap/M6-PORTAL-EVIDENCE.md`（**非 ABI 批准**）。

## 命令

```powershell
node components/ms-field/scripts/build.mjs --check
node --test components/ms-field/test/field-project.test.mjs components/ms-field/test/map-222-field.test.mjs components/ms-field/test/map-222-canonical.test.mjs components/ms-field/test/validate.test.mjs components/ms-field/test/snapshot.test.mjs components/ms-field/test/store-bridge.test.mjs components/ms-field/test/performance-baseline.test.mjs components/ms-field/test/carrier-lifecycle.test.mjs
node --test components/ms-field/test/chromium.test.mjs components/ms-field/test/map-222-chromium-canonical.test.mjs
node --test test/adventure-map-field-bridge.test.mjs
```
