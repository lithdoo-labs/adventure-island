# M6 Portal 原子场景事务——验证证据

> **里程碑状态：2026-11-20，本机实验范围验收门完成。**
> **批准状态：组件 ABI、完整 Portal data ABI、三图 graph 与 CMS079 完整等价性仍未批准。**

## 1. 本次闭环

- 业务权威仍在 `adventure-map` Subsystem；Portal DOM/Canvas 不参与 trigger、target 或 commit。
- `controls.state` 先于 `controls.event` 到达时，Up down event 仍形成一次边沿；Up 先由 Portal 消费，未命中时才锁存 jump。
- 发布 `222000000` 与 `222000001` 两份独立 FieldPlan；PWA 包含 203 个 Content 条目，其中 `resource.Map` 去重并集为 178。
- 跨图先完成目标 Content 读取、校验、投影和全部候选值计算；`RenderDomain.replace` 成功后才安装新的 Field/Movement/Camera/Portal authority。replace 抛错时保持当前源图状态并返回 `ADVENTURE_PORTAL_SCENE_REPLACE_FAILED`。
- prepare 失败只清除当前 `portalTravel.phase`，不会把准备期间继续演进的人物状态回退到旧快照；Frame 结束会取消在途 Content read。
- scene epoch 覆盖 A→B→A，静态 RenderNode key 不复用；跨图后的深度更新只指向当前 epoch 树。
- `pt=3`、无 Portal visual 的 `out00` 仍可参与业务 target 解析；真实浏览器入口为 `222000000/in00 → 222000001/st00`。
- `222000001` 的 publishability 例外被限制为唯一已知事实：`back:map222000001:0` 的 Back `bS` 为空、无 frame/resource；M3 bootstrap 的 `closure.ok` 断言未降低。

## 2. 验证分层

- **纯逻辑 / Node：通过。** Portal trigger/target、双向解析、到达、速度清零、same-map 无 replace、A→B→A epoch、logical-index 限界与冻结。
- **Subsystem 集成：通过。** 真实 common-controls state→event 顺序、跨图 replace、replace failure、prepare failure 期间 movement 单调、Frame cancellation 中止 Content read。
- **Bundle / staging：通过。** 2 个 executable、203 个 Content、178 个 `resource.Map`，framework pin `93648192323bf5f57996b7b54cbae641d8a53fdb`。
- **真实 Chromium / Service Worker：通过。** 2/2，无跳过；canonical PWA 实际行走、跳入命中框、可信 Up 输入并切换到 map001，目标场景保持单一 `ms-scene-view`。
- **真实浏览器回程：未覆盖。** B→A 已在纯逻辑/epoch 测试覆盖，但 map001 当前 Movement 路径不足以把真实角色导航到 `out00`。

## 3. 预算与实测

| 项目 | 预算 | 实测 |
| --- | ---: | ---: |
| `resource.Map` 发布并集 | 精确 178 | 178 |
| map001 视觉 Canvas | ≤16 | 12 |
| map001 单 Canvas | ≤512×1024，≤250,000 px | Node 预估最大 290×769 / 189,943 px；Chromium 实际最大 39×64 |
| map001 总本地 Canvas 像素 | ≤1,000,000 | Node 预估 576,205 |
| map001 FieldPlan 资源闭包 | ≤32 | 25（含 Avatar；地图资源 21） |
| 双 FieldPlan 投影 | ≤2,000 ms | 最终全量测试中 644 ms |
| Chromium Portal travel-ready | ≤30,000 ms | 最终复跑 65 ms（前次 61 ms） |

预算是当前 Windows 开发基线上的回归上限，不是产品 SLA。

## 4. 可复现命令

```powershell
node --test --test-concurrency=1 test/adventure-runtime.test.mjs systems/adventure-map/test/portal-*.test.mjs systems/adventure-map/test/map-m6-publishability.test.mjs test/adventure-map-portal.test.mjs
npm.cmd test
npm.cmd run pwa:staging
$env:LOOMREALM_PWA_BASE_PATH='/pwa/adventure-island/'
node loom-realm/apps/pwa/scripts/run-e2e.mjs staging (Resolve-Path test/pwa-browser.e2e.test.mjs).Path
```

最终记录：根测试 111 项，108 通过、0 失败、3 项因 Windows symlink `EPERM` 跳过；真实 Chromium 2/2。

## 5. 状态区分与剩余风险

- **实验验证通过：** 上述 Node、Subsystem、bundle、staging 与单向真实浏览器旅行。
- **路线图里程碑完成：** M6 的两图最小事务闭环。
- **正式 ABI 未批准：** 当前 FieldPlan、Portal logical index、组件标签/字段仍不得宣称稳定 ABI。
- map001 的 unresolved Back 内容缺口仍存在；当前窄 gate 只允许发布这一已登记事实，不代表画面完整。
- 多次真实浏览器往返、长跑内存/资源释放、cooldown、完整 CMS079 到达细节留给后续里程碑。
- 下一阶段为 M7：第三张水域图、三图 Portal graph、陆水状态与动态 Obj/Portal visual phase。
