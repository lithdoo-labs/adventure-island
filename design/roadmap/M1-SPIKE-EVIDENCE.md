# M1 synthetic WebProjector 证据

> **状态：M1 验证通过 / 核心渲染原则已按实测确认 / 组件 ABI 仍未批准。**
> 记录 2026-11-18 在 `components/ms-field-spike/` 上通过固定 LoomRealm `RendererRenderStore` 与 `WebProjector` 得到的结果。候选标签字段、`ms-synthetic-marker` 和本实验的 Canvas 预算都没有被标成正式 ABI。M2 纯数据 Adapter 见 [M2-ADAPTER-EVIDENCE.md](M2-ADAPTER-EVIDENCE.md)；Movement 和 Portal 运行时仍未开始。

## 范围

隔离 fixture 只包含：

```text
ms-scene-view
├─ ms-map-batch
├─ ms-world-item
│  └─ ms-synthetic-marker
└─ ms-map-batch
```

合成地图编号 `900000001` 只存在于 fixture，不读取 Map FSDB。根 `presentation.json` 仍只注册旧 `cms-*` 路径。spike 使用自己的 Web Presentation Config，classic script 为 `components/ms-field-spike/browser/ms-field-spike.browser.js`。`store-bridge.mjs` 只把 Store 的 presentation facts 交给真实 `WebProjector.reevaluate`，不维护第二套场景树。

`ms-world-item` 候选文档要求的直接子节点是 `ms-avatar`。本实验固定一个 `ms-synthetic-marker`，用来观察位置和遮挡。这不是对候选文档的收窄或批准。

## 命令与结果

```powershell
node components/ms-field-spike/scripts/build.mjs --check
node --test components/ms-field-spike/test/validate.test.mjs components/ms-field-spike/test/snapshot.test.mjs components/ms-field-spike/test/store-bridge.test.mjs
node --test components/ms-field-spike/test/chromium.test.mjs
```

| 命令 | 结果 |
| --- | --- |
| `build.mjs --check` | `browser/ms-field-spike.browser.js matches sources` |
| Node 三个文件 | tests 8，pass 8，fail 0，skipped 0，86ms，退出码 0 |
| Chromium | tests 4，pass 4，fail 0，skipped 0，4097ms，退出码 0 |

Node 覆盖严格 attrs/data/tree validator、有限 bounds、flip 几何、重复 rank/placement、拒绝 `ms-avatar` 子节点、合成树 hash，以及 `RendererRenderStore` 只有在 snapshot 之后才 eligible。Chromium 使用 loom-realm 的 Playwright 和已构建的 `packages/renderer/dist`。视口 96×96，`deviceScaleFactor` 1，测试断言 `devicePixelRatio === 1`。

四条 Chromium 测试：

- `real WebProjector projects finite canvases and pixel occlusion`
- `camera and position updates do not redraw static canvases`
- `replace reorder and reparent keep unchanged HTMLElement identity`
- `invalid data, missing resources, stale replies, and teardown stay local`

## 已由通过的测试证明

- Light DOM 由 WebProjector 管理。scene、batch、world-item、marker 的 host 没有 `style` 属性。scene 的属性闭集是 `camera-x`、`camera-y`、`visible`。marker 没有宿主属性。
- scene Shadow DOM 含 `.viewport`、`.world-plane`，slot 是 world-plane 的直接子节点。slot 分配到的节点与 Light DOM 子节点同为 `ms-map-batch`、`ms-world-item`、`ms-map-batch`。
- 两个 batch Canvas 为 32×32，marker Canvas 为 16×16。Light DOM 中 `canvas` 数量为 0。没有世界尺寸 Canvas，也没有按层数创建固定八层 Canvas。世界尺寸 bounds 在 validator 中返回 `RESOURCE_LIMIT`。
- 像素遮挡：屏幕 (4,4) 红、 (10,10) 绿、 (20,20) 蓝、 (40,40) 蓝。`elementFromPoint` 分别命中后景 batch、marker、前景 batch。
- Camera `(6,6)` 只体现在 `.world-plane` 的 transform，矩阵 `e = -6`、`f = -6`。batch 自身 transform 仍是 identity。移动后屏幕 (4,4) 变为绿色。
- position `update` 把 world-item 的 `world-x` 改为 `0`。两个静态 Canvas 的 `paintCommits` 与像素 hash 保持不变，marker 的 `paintCommits` 也保持不变，batch 与 marker 的 HTMLElement identity 保持不变。
- `replace` 把 Light DOM 顺序改为 stack-rank `30`、`20`、`10`，四个既有 HTMLElement identity 保持不变，静态 `paintCommits` 仍是 `[1, 1]`。identity fixture 的 reparent 同样保留未变元素。
- 非法 opacity、缺失资源、延迟后被替换的资源，以及 teardown，都留在组件自身：静态前景保持 ready，过期读取被 abort，teardown 移除 `ms-scene-view`。

## 首份测量基线

测量条件：`deviceScaleFactor` 1，初始树一次投影完成之后、Camera 与 position 更新之前。

| 量 | 值 |
| --- | --- |
| 从 `ms-scene-view` 走查的元素数（含 shadow） | 17 |
| shadow Canvas 数 | 3 |
| Light DOM Canvas 数 | 0 |
| Canvas 尺寸 | 32×32、16×16、32×32 |
| Canvas 像素面积 | 2304 |
| back / front / marker `paintCommits` | 1 / 1 / 1 |
| Camera 与 position 更新后的 `paintCommits` | 仍为 1 / 1 / 1 |
| reorder 后两个 batch 的 `paintCommits` | 仍为 1 / 1 |

2304 = 32×32 + 16×16 + 32×32。这是这次合成树的测量，不是产品 Canvas 预算。

## M1 实测决策

根据上述真实 WebProjector、DOM identity、像素遮挡和 paint 次数结果，批准以下 **Field 组件树与 Paint Unit 原则** 进入后续里程碑：

1. LoomRealm WebProjector 独占管理 RenderNode Light DOM；业务 Custom Element 只管理自身 Shadow DOM，并通过普通 `slot` 展示 managed children。
2. `ms-scene-view` 的 Shadow DOM 使用单一 viewport 与共同 world-plane；Camera transform 只应用在共同 world-plane，不下沉到各静态 batch。
3. 静态 batch、Actor/world item 等独立 Paint Unit 必须作为同一 world-plane 下可交错排序的 sibling host；不能用单一世界 Canvas 表达跨类型遮挡。
4. `ms-map-batch` 使用有限 bounds 的局部 Canvas。Canvas 数量来自安全 Paint Unit 切分和实测预算，不固定映射 Map layer，也不创建世界尺寸 Canvas。
5. position、Camera 和 sibling reorder/reparent 必须保留未变 RenderNode identity；静态输入未变时不得重绘对应 batch Canvas。
6. 组件必须 fail-closed 校验 attrs/data，隔离资源失败与过期异步结果，并在断连/teardown 时释放本地表面和读取生命周期。

本决策只批准 M1 已实测的架构原则，不批准完整标签集合、生产 `stack-rank` 编码、正式 attrs/data schema、`ms-synthetic-marker`、Canvas 尺寸上限或两张静态 Canvas 的产品预算。`FIELD-COMPONENT-TREE-DRAFT.md` 与各 `ms-*` 契约继续保持候选状态，等待 M2 的真实 Map FSDB 与深度规划证据。

## M1 结论

- **M1 通过。** 路线图 5.4 的 snapshot、真实 WebProjector identity/reorder、Chromium 像素遮挡、Camera/position 无静态重绘、首份 DOM/Canvas/paint 测量和实测原则决策均已完成。
- Movement、Portal 运行时、生产 ABI 与性能预算均不属于本结论。真实 Map FSDB Adapter 已在 M2 单独完成。
