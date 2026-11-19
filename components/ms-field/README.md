# M3 static Field + M4 Avatar world integration

> **状态：M3/M4 路线图验证通过（见 `design/roadmap/M3-FIELD-EVIDENCE.md` 与 `M4-AVATAR-EVIDENCE.md`）/ 实验实现 / NOT APPROVED / 不是正式组件 ABI。**
> 把 `components/ms-map-adapter/` 的纯投影接入真实 `RendererRenderStore` + `WebProjector`。根 `presentation.json` 注册 `ms-field`；`adventure-map` Frame 经 `field-scene-runtime.mjs` 投影静态 `222000000` 场景树。

资源读取由 Renderer resource client 作用域内的共享池负责：同一 `namespace/key/contentVersion` 只读取一次，并以 8 路并发向 LoomRealm Content 请求。每个 Paint Unit 仍独立解码和绘制自己的有限 Canvas；组件断开只取消自身等待，不会中断其他组件共享的 immutable Content 读取。

## M4 Avatar 接入路径

- 玩家宿主：`ms-world-item`（世界坐标 + `stack-rank`）。
- 玩家子节点：`ms-world-item` → `ms-avatar` + `ms-action`（`avatar-field-projection.mjs` / `plan-projection.mjs`）。
- Renderer 消费 Subsystem 投影的 `action` / `facing` / `frame-index` / `elapsed-ms`；世界坐标仍在 `ms-world-item`。

## 命令

```powershell
node components/ms-field/scripts/build.mjs --check
node --test components/ms-field/test/field-project.test.mjs components/ms-field/test/map-222-field.test.mjs components/ms-field/test/map-222-canonical.test.mjs components/ms-field/test/validate.test.mjs components/ms-field/test/snapshot.test.mjs components/ms-field/test/store-bridge.test.mjs components/ms-field/test/performance-baseline.test.mjs components/ms-field/test/carrier-lifecycle.test.mjs
node --test components/ms-field/test/chromium.test.mjs components/ms-field/test/map-222-chromium-canonical.test.mjs
node --test test/adventure-map-field-bridge.test.mjs
```
