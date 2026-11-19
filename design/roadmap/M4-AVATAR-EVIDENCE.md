# M4 正式纸娃娃与动作系统 — 验证证据

> **里程碑状态：M4 路线图验收门已在 2026-11-19 本机闭环。**
> **批准状态：`ms-avatar` / `ms-action` 仍是候选组件 ABI；本里程碑完成不等于正式 ABI 批准。**

## 1. 本阶段边界

- LoomRealm `adventure-map` Subsystem 持有角色动作、方向、帧序号与呈现时间的权威状态；输入先进入 Subsystem，再以 Render Update 投影。
- `ms-world-item` 只承载世界坐标、可见性与世界 `stack-rank`；`ms-avatar` 只按 render-ready 数据合成局部纸娃娃 Canvas；`ms-action` 只声明动作 Clip。
- Renderer 不读取 FSDB、不推导 Movement/Portal 结果，也不把人物合入地图 Canvas。动作边界由 Subsystem 定时器推进；Renderer 不以本地 RAF 改写权威帧。
- 旧 `AvatarPlanV1` 仅由 `plan-projection.mjs` 适配为候选 `appearance`、`sprites` 与 `ms-action[]`，不是新 ABI 的批准依据。
- 未修改 `loom-realm` 子模块；仍固定在 `93648192323bf5f57996b7b54cbae641d8a53fdb`。

## 2. 投影与资源链

```text
CMS079/FSDB Avatar content
  → buildAdventureAvatarPlan()              构建期内容适配
  → projectAvatarFromPlan()                 render-ready 纸娃娃数据
  → AdventureFieldPlan player slot
  → ms-world-item                           世界位置/排序
      └─ ms-avatar                          局部合成/缓存/生命周期
          └─ ms-action[]                    stand1 / walk1 / jump clips
```

Presentation 先加载独立 `ms-avatar.browser.js`，再加载 `ms-field.browser.js`。两个 classic bundle 通过全局 `Symbol.for("adventure-island.resource-read-pools.v1")` 共享每个 resource client 的 immutable Content 读取池，以 `namespace/key/contentVersion` 去重并限制为 8 路并发。

## 3. 已验证的行为

- body、head、face、hair、装备按 origin/anchor 合成；稳定 z-order、slot priority/tag 遮挡、左右翻转与 frame flip 的 XOR 规则有纯合成测试。
- 真实 CMS079/FSDB `stand1` 像素在 `ms-world-item > ms-avatar` 中完成首绘；可信键盘输入在 canonical PWA 中驱动 `walk1`、left、帧推进、释放回 `stand1` 与 `jump`。
- 动作/方向/帧更新只增加 `ms-avatar` paint rounds，静态地图 Canvas paint count 不变。
- `ms-world-item` 世界坐标更新只改变外层宿主定位，既不重绘人物 Canvas，也不重绘静态地图 Canvas。
- 延迟的旧动作资源完成后不能覆盖新动作；carrier retire/disconnect 后异步结果不能写回失效画面。
- 缺少资源进入稳定失败状态；缓存与解码队列受明确上限约束。

## 4. 预算与实测

以下上限是仓库验收预算，不是产品 SLA；没有降低 M3 的既有预算或删除断言。

| 项目 | 2026-11-19 实测 | 验收上限 |
| --- | ---: | ---: |
| 视觉 Canvas 宿主 | 298（297 地图 + 1 人物） | 310 |
| FieldPlan 资源闭包 | 171 个 Content identity | 190 |
| 首帧 Content identity / underlying reads | 150 / 150 | 170 |
| Content 读取并发 | ≤8 | 8，且必须 `<32` PWA 上限 |
| 最大局部 Canvas 边长 | width 1890 / height 573 | 2048 / 2048 |
| 最大单 Canvas 像素 | 680,208 | 4,194,304 |
| 全部局部 Canvas 像素 | 19,335,752 | 24,000,000 |
| Node 投影 | 338.4 ms | 12,000 ms |
| canonical PWA 测试总耗时 | 6,408.4 ms（ready 更早完成） | ready 240,000 ms |

canonical staging 含 191 个 Content 条目、2 个 executable；bundle id 为 `loomrealm-pwa-sha256-62425b62c7b222909808f005ff5cc6f8f2aa8ffbfe531ad9f0d41be110a347cd`。

## 5. 可复现命令与结果

```powershell
node --test --test-concurrency=1 components/ms-avatar/test/*.test.mjs components/ms-field/test/*.test.mjs
# 31/31 passed

npm.cmd test
# 67 total, 64 passed, 0 failed, 3 skipped (Windows symlink EPERM)

npm.cmd run pwa:staging
# contentCount 191; pinned framework 9364819...

Copy-Item -Recurse -Force dist/staging/adventure-island/* loom-realm/apps/pwa/dist/staging/pwa/adventure-island/
$env:LOOMREALM_PWA_BASE_PATH='/pwa/adventure-island/'
node loom-realm/apps/pwa/scripts/run-e2e.mjs staging "$PWD/test/pwa-browser.e2e.test.mjs"
# real Chromium 2/2 passed
```

真实 Chromium 结果：canonical Base → Adventure Map PWA 约 6.4 秒；canonical synthetic paper-doll Service Worker 用例约 26.7 秒；总计 2/2、0 失败。

## 6. 状态区分

- **实验验证通过**：真实 Renderer Store/WebProjector、CMS079/FSDB 像素、Service Worker、异步淘汰与失效边界均有可复现测试。
- **路线图里程碑完成**：M4 8.3 的合成、动作、翻转、世界/局部失效边界与生命周期验收门已闭环。
- **正式 ABI 未批准**：候选 attrs/data/children、one-shot 完成事件、跨组件 decoded cache 与 RenderClock 仍可在 M5 前后调整，不得把本证据解释为 ABI freeze。

## 7. 剩余风险与 M5 交接

1. `ms-field` 聚合 bundle 仍包含 avatar 定义作为组件测试/兼容 fallback；根 Presentation 由独立 `ms-avatar` artifact 先注册正式标签。后续可在不改变 ABI 的前提下去除重复字节。
2. one-shot 动作完成通知与业务结果仍未批准；Renderer 不得据此提交 Movement、Portal 或战斗状态。
3. M5 应建立固定业务 tick、position/velocity/contact 与 Camera follow；高频位置更新必须继续只触碰 `ms-world-item`，不得重发完整 Avatar plan 或重绘静态地图。
