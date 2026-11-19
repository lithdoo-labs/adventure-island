# M3 static field scene (222000000 + WebProjector)

> **状态：M3 验证通过（见 `design/roadmap/M3-FIELD-EVIDENCE.md`）/ 实验实现 / NOT APPROVED / 不是正式组件 ABI。**
> 把 `components/ms-map-adapter/` 的纯投影接入真实 `RendererRenderStore` + `WebProjector`。根 `presentation.json` 注册 `ms-field`；`adventure-map` Frame 经 `field-scene-runtime.mjs` 投影静态 `222000000` 场景树。

资源读取由 Renderer resource client 作用域内的共享池负责：同一 `namespace/key/contentVersion` 只读取一次，并以 8 路并发向 LoomRealm Content 请求。每个 Paint Unit 仍独立解码和绘制自己的有限 Canvas；组件断开只取消自身等待，不会中断其他组件共享的 immutable Content 读取。

## M4 Avatar 接入路径

- 玩家宿主：`ms-world-item`（世界坐标 + `stack-rank`）。
- 当前子节点：`ms-m3-avatar-slot`（静态色块占位）。
- M4 目标：用 `ms-avatar`（见 `src/player-node.mjs` 的 `M4_AVATAR_TARGET_TAG`）替换 slot，不改变 world-item 外层排序语义。

## 命令

```powershell
node components/ms-field/scripts/build.mjs --check
node --test components/ms-field/test/field-project.test.mjs components/ms-field/test/map-222-field.test.mjs components/ms-field/test/map-222-canonical.test.mjs components/ms-field/test/validate.test.mjs components/ms-field/test/snapshot.test.mjs components/ms-field/test/store-bridge.test.mjs components/ms-field/test/performance-baseline.test.mjs components/ms-field/test/carrier-lifecycle.test.mjs
node --test components/ms-field/test/chromium.test.mjs components/ms-field/test/map-222-chromium-canonical.test.mjs
node --test test/adventure-map-field-bridge.test.mjs
```
