# cms-actor 实施说明

> 公共 RenderNode / Web Presentation ABI 以 [RENDER-NODE-ABI-V1.md](../RENDER-NODE-ABI-V1.md) 和 pinned LoomRealm Web Presentation API v1 为准。本文只定义 AvatarPlanV1 的组件级约束、算法、资源生命周期和验收。

> 状态：算法与 LoomRealm 正式浏览器集成已通过合成素材在**当前固定 LoomRealm gitlink `93648192323bf5f57996b7b54cbae641d8a53fdb`** 上重新验证（PR-A，Issue #46）；真实 CMS 079 素材验证保持 **BLOCKED / 仅本地可选**（见文末三状态表）。
> 范围：Web Component、有界 `avatarPlan`、帧布局与锚点算法、classic script 构建产物、正式 `bootstrapWebPresentation()` 浏览器闭环、资源生命周期与缓存边界、Node 合成测试与真实 Chromium 集成测试。
> 本组件由历史 Draft PR #2（HEAD `132853b8`，基于旧 gitlink `8cf8e2d`）选择性移植；移植后在当前 pin 上原样通过全部 ABI 与像素验证，未发现需要放宽边界或改写框架的差异。

## 1. 边界

`cms-actor` 是一个只负责呈现的 Web Component。它不读取 WZ、FSDB 文件系统或私有 Content Index，也不决定角色的位置、移动、跳跃和场景切换。运行库通过 `attrs` 提供动态状态；游戏侧适配器把已解析的 WZ 外观投影为 `RenderNode.data.avatarPlan`。

本次实现覆盖：

- `stand1` / `walk1` / `jump` 等动作计划的帧选择与按非负 `delay` 推进；负值由 validator 拒绝，不做绝对值归一化；
- `receiveRenderEvent({ name: "action", data: { action } })` 单次动作播放，完成后恢复**当时的** `locomotion`；
- 以 `origin` 和 `map` 锚点合成多张画布，按 `zOrder` 从后向前绘制，左右朝向绕身体原点镜像（含帧 `flip` XOR）；
- 通过 `PresentationResourceClient.resource(namespace, key, expectedContentVersion)` 读取 PNG，校验返回版本、MIME 与像素尺寸；
- 资源缓存有明确容量边界；异步过期绘制隔离；断开时取消请求并释放 `ImageBitmap`；
- 可作为 **classic script** 被 LoomRealm `bootstrapWebPresentation()` 正式加载（无 `type="module"` 要求）；
- 真实 Chromium 集成测试与 Node 纯函数测试。

自研库的装备遮挡由 `adventure-adapter` 写入每张画布的 `priority` 和 `tag`，组件在绘制前按 `0x401C74` 跳过输掉的画布。CMS079 生产入口 `src/real-look-adapter.mjs` 现在要求调用方显式提供每个部件的 `islot/vslot`（`slotMetadata`）和完整 `smap.img`；它按 full zmap order 推导 `priority/tag`，缺失或格式错误时 fail closed，不再默默全画。

本地 `test/real-look-adapter.mjs` 是真实资源几何/渲染 smoke helper，不带 Item 的 `islot/vslot` 与 `smap`，因此它不能证明 CMS079 遮挡一致性。客户端 `this+0x38` 预置槽位的来源和求交函数仍有未闭合项；生产路径整体仍标记为 PARTIALLY VERIFIED，不能宣称完全像素等价。

## 2. 平台入口（P0）

### 2.1 classic script 产物

LoomRealm Web Presentation Config v1 只以 ordered classic `<script src>` 加载业务脚本，不评估 ES 模块。因此组件交付：

```text
components/cms-actor/src/*.mjs                  编辑用 ESM 源（Node 测试直接 import）
components/cms-actor/scripts/build.mjs          确定性打包器（无第三方依赖）
components/cms-actor/browser/cms-actor.browser.js   生成并入库的 classic script（IIFE）
```

- 产物无 `import`/`export`，通过 `customElements.define("cms-actor", ...)` 注册；
- `node scripts/build.mjs --check` 可字节级校验产物与源一致；
- 仓库 `.gitignore` 屏蔽 `dist/`、`build/`，因此产物固定放在 `browser/`。

### 2.2 注册声明

组件目录内的 `presentation.json`（**组件示范/测试配置，不是根 `presentation.json`**）声明浏览器入口：

```json
{
  "formatVersion": 1,
  "styles": [],
  "scripts": [{ "namespace": "resource.Presentation", "key": "cms-actor/cms-actor.browser.js" }]
}
```

`namespace + key` 是 Content 逻辑标识；平台 PREPARE 解析后固定 `contentVersion`、MIME（essence 必须是 `text/javascript`）与私有 `browserSource`。组件与业务代码永远拿不到 bearer、物理路径或私有 URL。根 `presentation.json` 的正式注册属于 PR-B（见 §9）。部署细节见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 3. RenderNode 契约

动态状态用字符串 `attrs`（本组件输入约定：单条 ≤ 4096 UTF-8 字节；这是 Adventure Island 组件级约束，不是 Render Update v1 的通用限制）：

| 属性 | 含义 |
|---|---|
| `x`, `y` | 身体原点在地图世界中的坐标（十进制字符串） |
| `locomotion` | `stand` / `walk` / `jump` |
| `facing` | `left` / `right` |
| `skin`, `face`, `hair`, `expression`, `equips` | 运行时外观选择状态，供游戏适配层重建 `avatarPlan`；组件不据此查 WZ |

`RenderNode.data` 承载一份**已解析、有界、渲染就绪**的外观计划：

```js
{
  avatarPlan: {
    formatVersion: 1,
    zOrder: ["weaponOverGlove", "hair", "face", "head", "body"],   // 前景 → 背景
    locomotionActions: { stand: "stand1", walk: "walk1", jump: "jump" },
    actions: {
      stand1: { loop: true, frames: [{ delay: 500, move: [0, 0], flip: false, layers: [...] }] }
    }
  }
}
```

每个 layer：

```js
{
  id: "body",
  z: "body",                                  // 必须出现在 zOrder 中
  resource: {
    namespace: "resource.图",
    key: "Look/00002000/stand1/0/body",
    contentVersion: "sha256:<64 位小写十六进制>"
  },
  width: 27, height: 32,
  origin: [19, 32],
  anchors: { navel: [-6, -20], neck: [-4, -32] }   // WZ map 向量，相对 origin
}
```

`source` 可缺省。缺省时源矩形就是整张位图，上面这种一画布一图的计划照旧整张绘制。写了 `source` 时，`resource` 指向整页图集，`source` 是页内像素矩形，并且 `source.w === width`、`source.h === height`。同一页可以有多块不同尺寸的小图，缓存键仍是 `namespace + key + contentVersion`。

表情不写进身体帧，与 `actions` 并列：

```js
expression: { name: "blink", frames: [{ delay: 60, layers: [/* 脸，以及跟着表情走的脸饰 */] }] }
```

身体帧可以带 `showFace`。缺省或为真时，用当前身体帧已经摆好的锚点画表情层；为假时跳过表情轨。`bodyKey` 是身体部件键，组件用它记住这具身体上一个有画布的姿势。

### 3.1 AvatarPlanV1 应用层边界

计划只承载**当前角色当前需要的动作**，不是全量人物/装备/动作目录。`validateAvatarPlan` 按以下边界 fail-closed（`AVATAR_PLAN_LIMITS`）：

| 项 | 上界 |
|---|---|
| 序列化 `RenderNode.data` 中 `avatarPlan` 的 compact JSON UTF-8 | **262,144 字节**（AvatarPlanV1 组件级上限） |
| 图集解码字节 | **无固定上限**；`width/height` 是小图尺寸，不能代表整页 `ImageBitmap` 的内存 |
| `zOrder` 条目 | 64 |
| `actions` 条数 | 32 |
| 每动作帧数 | 128 |
| 每帧 layer 数 | 32 |
| 每 layer 锚点数 | 8 |
| 画布边长 | ≤ 4096 像素 |
| `delay` | 0 到 600,000 ms（非负；毫秒是产品时钟单位，客户端定时器尚未确认） |
| 动作名 / id / 锚点名 / namespace / key | 64 / 64 / 32 / 64 / 256 UTF-8 字节 |

- 字节数用**有界测量器**（`measureCompactJsonBytes`）在超过预算时立刻中止，不会先拼出无界大字符串；
- 没有 `source` 的同一 `(namespace, key, contentVersion)` 必须声明一致的 `width/height`。带 `source` 的同一页允许不同小图尺寸，尺寸校验改成源矩形落在解码后的页面内；
- `locomotionActions` 只接受 `stand` / `walk` / `jump`，且必须指向存在的动作；这是 v1 MVP 子集，不代表客户端动作集合仅有三种（已提取的 `prone`、`fly`、`stand2`、`walk2` 尚未纳入）。
- CMS079 生产适配器的 `slotMetadata` 必须包含被绘制非 face 部件的 `islot/vslot` 字符串；`smap` 必须是以画布 z 名为 key 的字符串表；缺少任一项、奇数长度槽串、缺失 zmap 槽名或缺失 smap 项均拒绝生成计划，不回退到全画。

## 4. 锚点布局

1. 身体画布 `origin` 放在 `(x, y)`；帧 `move` 只作用于当前帧，不累计。
2. 后续画布按 `navel → neck → hand → brow → handMove` 优先级取第一个与已建立锚点表同名的锚点重合。
3. 只登记尚不存在的新锚点（头通过 `neck` 对身体，并提供 `brow` 给脸/头发）。
4. 带锚点但没有任何可匹配锚点的画布**跳过不画**，并在 `data-skipped-layers` 上给出 `layerId[needs=anchorA+anchorB]` 形式的可定位诊断。
5. 全部定位后按 `zOrder` 反向（先背景后前景）绘制。表情层用同一次布局记下的锚点摆放，再并进这张绘制顺序，不单独做一次 `layoutFrame`。
6. 帧上有 `rotate`（90/180/270）时，绕身体原点顺时针转，再做朝向翻转。画布坐标里正角就是顺时针。
7. `facing=left` 与帧 `flip` 异或后绕身体原点镜像整套合成结果（位置与像素内容同时翻转）。有 `source` 时用九参数 `drawImage` 裁切图集，没有则整张绘制。

## 5. 动画与事件

- 身体帧是时间轴；一帧中的身体 layer 一起切换。`delay` 必须是有限非负数，按 v1 产品时钟单位推进；帧上没有 `delay` 表示停住。负值在 validator 阶段拒绝，不取绝对值。`delay` 为 0 表示不停留，立刻进入下一帧；一次性姿势的最后一帧即使时长为 0，也结束并回到当前移动姿势。
- 表情用自己的帧钟。其 `delay` 同样必须非负；`expression.name` 变了，或表情帧列表变了，帧号归零。只换身体帧、帧列表相同，不动它。多帧表情播完回到第 0 帧；没有 `delay` 的表情帧停住。
- `loop: true` 的多帧动作循环；`jump` 等非循环动作停在末帧直到 `locomotion` 改变。
- `action` Render Event 只触发一次私有播放，不写 `attrs`、不进 retained data。计划里还没有这个名字时，只记下这一个名字；下一份计划消费它，有该姿势就从第 0 帧播，没有就丢掉，再往后的计划不补播。新计划仍包含正在播的一次性姿势且帧列表没变时，保留帧号。`stand*` / `walk*` 帧列表没变时，不把走路帧号归零。
- `bodyKey` 变了就忘掉上一具身体的姿势，改播新计划的 `stand*`。请求的姿势不在计划里时，记住的姿势还在就继续播它，否则播这份计划的 `stand*`。
- 播完自动回落到**当下**的 `locomotion`。播放中再次收到已在计划里的 `action` 事件则从第 0 帧重播。
- 事件不重放到新建/重连元素（由 Web Presentation API v1 的 transient 语义保证）。自研库的投影在 `src/adventure-adapter.mjs`：读 `struct.avatar.Part`、`group.avatar.PartFrame`、`group.avatar.Resource`、`struct.avatar.DrawOrder`、`struct.avatar.LayerSlot` 和 `resource.Avatar`。`content.resource` 不接收版本参数，版本取返回值。

## 6. 资源生命周期与失败策略

读取按 `(namespace, key, expectedContentVersion)` 进行，结果必须满足：返回 `contentVersion` 与请求完全一致；MIME essence 属于 `image/*`。没有 `source` 时，解码尺寸必须等于层上的 `width` × `height`。有 `source` 时，解码的是整页，源矩形必须落在页面内，页面尺寸可以大于小图。

**最终合成 Canvas 安全界限（COMPOSITE_CANVAS_LIMITS）**：与图集解码**无关**的输出画布保护。DPR 最多 8，设备像素宽/高各最多 8,192，输出画布设备像素最多 3,145,728。它拦截极端锚点造成的巨大 Canvas，**不限制图集页面的解码字节、缓存字节或整帧图集工作集**。

**过期计划的读取取消**：每个缓存条目携带自己的 `AbortController`。新计划替换（`receiveRenderData` → prune）或断开触发逐出时，仍在解码的条目**立即取消**其 in-flight 读取——延迟响应不会为已经淘汰的计划继续堆积 loading/pinned/pending-close 资源。最新计划仍引用的资源不会被逐出（prune 保留；LRU 上界只选已完成的条目作牺牲），因此取消永远不会波及在用读取；已完成的位图没有可取消的读取，保持「pin 归零即关闭」语义。`loading` 计数以「位图尚未赋值」为一次性判据，晚到的过期解码拒绝也能正确归还计数。

**解码并发（MAX_CONCURRENT_DECODES = 8）**：`createImageBitmap` 一旦启动便无法取消，仅靠取消无法约束解码工作。因此每次解码前先过**解码前门禁**（检查 abort/条目身份/连接状态，fetch 已返回但计划已被替换的条目不再进入解码；排队等待获得槽位后再检查一次）；并发解码硬上限 8，超出部分进入**感知取消的等待队列**——逐出条目的排队解码被立即移出队列且永不启动。队列长度由计划校验限界的资源集合约束，**不**冒充字节预算：`AvatarPlanV1` 只保证冻结的 compact 数据协议上限；不设图集页字节预算，上游 ContentClient 的字节缓存策略另行跟踪（不属本组件）。

**Paint 调度**：`_requestPaint` 把同一同步任务内的连续属性/数据/事件更新合并为**一个** paint 轮次（微任务合并；调度时即失效在途旧轮次，与旧同步语义一致）。轮次内逐层获取位图条目，`finally` 是**唯一**的释放路径——同步查找失败、过期丢弃、绘制失败与成功共用同一处 unpin，杜绝漏释放与二次释放。`diagnostics().paintRequests/paintRounds` 分别计数合并前请求与实际轮次。

**合成画布复用**：设备像素尺寸与 DPR 未变化时不重新赋值 `canvas.width/height`（同值赋值也会清空位图），改为显式 `clearRect` 后按原变换重绘；尺寸或 DPR 变化时才重新分配。每帧标记色像素回归证明复用不产生残影。

**位图缓存（图集页 LRU，无解码字节预算）**：

- **整页缓存**：按 `namespace + key + contentVersion` 缓存整张 `ImageBitmap`，同一页的多张小图共用一次读取和解码。最多保留 64 个缓存条目只是 **LRU 复用策略**，不是帧能否绘制的门槛；**不设 12 MiB 或其他固定字节预算**。
- **逐层裁剪校验**：`Promise.all` 返回整页位图后，逐层核对 `source` 是否落在实际页面大小内。冷缓存同一页有两张裁剪时，也不能仅检查第一个。
- **生命周期**：在途读取保持取消和过期判定；绘制中位图被 pin，最后 unpin 时可以关闭；新计划可清理不再使用的页面，断连全部释放。
- **监控**：`diagnostics().cache.bytes` 为解码缓存的真实字节计数，不再有 `maxBytes` 字段。无固定解码字节上限是产品选择，过大的图集或同时驻留过多页面依然可能使浏览器内存不足；PNG 版本、MIME、尺寸与源矩形仍必须校验。

**跨计划尺寸一致性**：缓存条目记录解码尺寸；同一 `(namespace, key, contentVersion)` 在后续计划中声明不同尺寸时，命中缓存即同步拒绝（`CONTENT_INVALID … declares WxH but the cached decode … is W'×H'`），错误进入该次绘制的错误处理，不会产生未处理 Promise，也不会把位图拉伸绘制。

**过期绘制隔离**：每次绘制轮次有单调 `_paintEpoch`；动作/数据/断开产生的更新使旧轮次的异步结果作废，慢响应永远不会覆盖新动作的画面。`_paintFrame` 的取条目、等待与绘制全部在自身错误处理之内（含缓存命中的同步异常），`_requestPaint` 另有兜底 catch，任何拒绝都不会逃逸为未处理 Promise。

**可定位诊断**（宿主属性）：

| 属性 | 值 |
|---|---|
| `data-render-state` | `ready` / `error` / `invalid` |
| `data-render-error` | 失败原因；资源类失败带错误码 + 完整逻辑标识，如 `CONTENT_CONFLICT resource.图/Look/00030000/default/0/hair (expected sha256:…)` |
| `data-skipped-layers` | 锚点不可解析的画布，如 `detached[needs=foo+bar]` |
| `data-action` / `data-frame` | 当前动作与帧 |

Canvas 2D 上下文不可用、`createImageBitmap` 缺失等技术错误同样写入 `data-render-error`。单帧任一资源失败时整帧不做部分合成：画布清空并进入 `error`，纠正后的计划可恢复 `ready`。`diagnostics()`（非 ABI）暴露状态、帧号与缓存占用供测试与调优。

## 7. 测试与验证

| 套件 | 位置 | 可复现性 | 内容 |
|---|---|---|---|
| 算法（Node） | `node --test components/cms-actor/test/avatar-model.test.mjs components/cms-actor/test/browser-artifact.test.mjs components/cms-actor/test/adventure-adapter.test.mjs components/cms-actor/test/adventure-clock.test.mjs` | **可复现** | 计划校验、可缺省 `source`、表情锚点、`delay: 0` 与缺 `delay`、字节预算、锚点布局、镜像、打包一致性、presentation.json 正式校验、自研库两套装备的投影与遮挡、计划和事件的到达顺序 |
| 自研库绘制（真实 Chromium，`content/[FSDB]adventure`） | `node --test components/cms-actor/test/adventure-chromium.test.mjs` | **可复现**（需 Chromium 与已构建的 pinned renderer dist） | 两套装备经 `adventure-adapter` 投影后，由正式 bootstrap 绘制；身体图集只请求一次，合成尺寸小于整页 |
| 浏览器集成（真实 Chromium，合成 FSDB，20 例） | `node --test components/cms-actor/test/integration.chromium.test.mjs` | **可复现**（需 Chromium 与已构建的 pinned renderer dist） | 正式 `bootstrapWebPresentation()` 加载 classic 入口；`customElements.get("cms-actor")`；Projector 注入 Context/attrs/avatarPlan；`resource()` 收到正确 namespace/key/版本；Canvas 像素（锚点对齐、z 序、透明合成、镜像，DPR 1 与 2、含 `move` 轴）；`stand1`/`walk1`/`jump` 帧推进；一次性 `action` 播完恢复当前移动；快速切换动作；慢速资源不覆盖新动作；版本冲突与资源缺失的可定位诊断与恢复；断开取消 in-flight 并释放缓存、重连恢复；缓存容量上界；超大单图与同帧多图在计划校验拒绝；32 资源并发突发期间可缓存层逐次采样不超限；跨计划尺寸冲突可定位拒绝且无未处理 Promise；极远锚点在给画布赋值前以 `COMPOSITE_TOO_LARGE` 拒绝（DPR 1 与 64），异常 DPR 钳制到 8；延迟响应下连续替换计划时旧计划专属读取被取消且有界；门控解码下排队过期任务被丢弃、并发 ≤ 8；**帧中同步查找失败释放全部已获取 pin（pendingClose 归零）；绘制失败叠加重叠轮次后干净收敛并恢复；同一任务内多次更新合并为单一 paint 轮次；合成画布跨帧复用（无重赋值/重分配）且标记色逐帧更替、DPR 变化恰好一次重分配** |
| 性能测量（非测试套件） | `node components/cms-actor/test/perf.chromium.mjs` | **可复现**（真实 Chromium） | 首帧就绪（DPR 1/2/3、5/9/32 层）、稳态动画的帧绘制数与单次绘制 p50/p95、画布 width 赋值/有效重分配次数、32 资源解码并发/排队峰值、30 次连续计划替换的收敛时间与请求/轮次计数、近似堆占用 |
| 真实素材（真实 FSDB，3 例） | `node --test components/cms-actor/test/real-assets.local.test.mjs` | **仅本地**（无真实 FSDB 的 checkout 显式 skip 并给出原因） | 用本地合法取得的 079 WZ 转出的真实 FSDB（纸娃娃子集）重复同一闭环，并把转换结果与 Task 050/DESIGN 的逆向几何逐项对照。激活方式：`CMS_ACTOR_REAL_FSDB` 指向含 `[struct]Look/{00002000,00012000,00020000,00030000,01302000}.json`、`[struct]ZMap/order.json` 与 `[resource]图/` 的 FSDB 根 |

浏览器集成测试使用**运行时生成的合成 PNG 和合成 FSDB**（`.work/cms-actor/[FSDB]cms/`，遵循 `content/cms_design.md` 布局；`.work/` 已被根 `.gitignore` 忽略；身体几何取自逆向的 079 walk1 画布 27×32 / origin (19,32) / navel (-6,-20) / neck (-4,-32)），不包含任何原版游戏素材。测试把 `test/look-adapter.mjs` 当作游戏侧适配器参考实现：解析 UOL、按武器 `info` 决定移动后缀、部件缺动作不画、帧号钳制到身体时间轴。

前置条件：

- `loom-realm/` 子模块已 `npm install` 并构建 `@loomrealm/renderer`（dist）；如 staging 相关包过期，按其标准脚本重建（例如 `npm run build -w @loomrealm/session-events`）。
- Chromium：`LOOMREALM_CHROMIUM_PATH` 指定可执行文件，或存在系统 Chrome/Chromium；否则 playwright 使用其下载的 Chromium（Linux 无 root 环境需自备系统库后通过 `LD_LIBRARY_PATH` 提供）。
- PR-A 不修改根 `package.json` 与 CI 工作流；把组件套件纳入 GitHub CI 属于 PR-B 的维护者工作。

本地快速预览（合成素材，非验收）：`python -m http.server 8000` 后打开 `components/cms-actor/preview/`。

## 8. 三状态

| # | 状态 | 结论 | 证据与可复现性 |
|---|---|---|---|
| 1 | 合成算法测试 | **通过**（22 例） | `avatar-model.test.mjs` + `browser-artifact.test.mjs`；PR-A 在 pin `9364819` 上复跑通过 |
| 2 | LoomRealm 正式浏览器集成 | **通过**（20 例真实 Chromium，合成素材） | `integration.chromium.test.mjs`；PR-A 在 pin `9364819` 与真实 Chromium 上复跑通过；历史 PR #2 的旧 pin 证据仅作参考，不作为验收依据 |
| 3 | 真实 CMS 079 素材验证 | **BLOCKED（本仓库无真实素材，显式 skip）** | `real-assets.local.test.mjs`；需持有合法 WZ 的使用者本地执行（`CMS_ACTOR_REAL_FSDB`）；历史 PR #2 曾在 Agent 本机通过（纸娃娃子集），该结论**不可**在本仓库复现，须在新的确认样本上重跑；装备遮挡、表情独立计时、全量 16 包转换仍属后续任务 |

## 9. 后续集成顺序

0. **PR-B（本 Issue 之后的新 Issue/新 PR）**：根 `presentation.json` 注册、严格白名单合成 Content 发布、真实 PWA/Service Worker/Renderer 投影与根 CI 更新（`.github/**` 仅由维护者处理）。
1. 经典 `struct.SMap` 路径的装备遮挡。自研库已经按 `LayerSlot` 和 `DrawOrder` 对齐 `0x401C74`。
2. 表情独立计时（`blink` 等与身体分开的帧钟）与更多肤色后缀、ladder/rope 的 backHead 路径。
3. 扩大真实白名单动作（更多 `swing*`/`stab*`/技能引用动作）与多件装备组合验证。
4. 全量 16 包转换与 FSDB Integrity-valid（属 WZ→FSDB 转换器的未竟事项）。
5. 技能 `effect` 层、残影与声音（按 DESIGN 不在本组件内）。
