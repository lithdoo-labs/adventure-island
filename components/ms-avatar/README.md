# ms-avatar / ms-action（M4 候选实现）

> **状态：M4 路线图验证通过 / 候选组件实现 / NOT APPROVED / 不是冻结 ABI。**

`ms-avatar` 是人物纸娃娃的局部视觉宿主，拥有一个有限 Shadow DOM Canvas；`ms-action` 是它的 managed Light DOM 动作 Clip 声明。两者不拥有世界坐标、Movement、Camera、Portal 或战斗状态。

## 职责边界

- Subsystem 权威投影 `action`、`facing`、`frame-index`、`elapsed-ms` 与 appearance；Renderer 只消费投影。
- `ms-world-item` 负责世界位置、可见性与 `stack-rank`；位置更新不应触发人物 Canvas 重绘。
- `ms-avatar` 负责 anchor/origin 合成、z-order、slot 遮挡、左右翻转、资源解码、局部缓存与过期结果隔离。
- `ms-action` 只保存有限 Clip 数据；它不推进业务时钟，也不提交动作完成后的业务结果。
- `plan-projection.mjs` 对旧 `AvatarPlanV1` 做构建期适配；旧 plan 不是新组件 ABI。

## 候选树形

```text
ms-world-item
  └─ ms-avatar                         appearance + sprite catalog
      ├─ ms-action[name=stand1]        frame/layer/timing clip
      ├─ ms-action[name=walk1]
      └─ ms-action[name=jump]
```

Canvas 只覆盖人物局部 bounds，不与地图 Back/Tile/Obj 合并。异步资源提交前同时校验元素连接状态、resource client、epoch 与当前动作；carrier replacement 或 disconnect 后的旧结果不能写回。

资源读取通过 `resource-read-pool.mjs` 的全局共享池按 `namespace/key/contentVersion` 去重，最多 8 路并发；每个组件仍独立拥有 decode/cache 生命周期与容量上限。

## 构建与验证

```powershell
node components/ms-avatar/scripts/build.mjs
node components/ms-avatar/scripts/build.mjs --check
node --test components/ms-avatar/test/*.test.mjs
```

覆盖纯合成锚点/z-order/遮挡/翻转、动作时序与校验、真实 CMS079/FSDB Chromium 像素、旧 epoch 资源回写和 teardown。完整 Field/PWA 证据见 [`design/roadmap/M4-AVATAR-EVIDENCE.md`](../../design/roadmap/M4-AVATAR-EVIDENCE.md)。
