# M2 单图内容闭包与纯 Adapter/Projection 证据

> **状态：M2 验证通过 / 纯数据管线已落地 / 组件 ABI 与 Movement/Portal 运行时仍未批准。**
> 记录 2026-11-18 在 `components/ms-map-adapter/` 上对首图 `222000000` 与合成 fixture 的 Node 纯函数结果。本阶段不读取 DOM/Canvas，不启动 WebProjector，不实现 Movement。

## 范围

```text
Content Map records/groups/resources
  → MapFacts
  → ResolvedMapScene
  → OrderedDrawable[]
  → PaintUnitPlan[]
  → RenderNode candidate + projection hash
```

实现目录：`components/ms-map-adapter/`。公开入口 `buildMapProjection({ mapId })`。根 `presentation.json` 与旧 `cms-*` PWA 路径未改。

## 命令与结果

```powershell
node --test components/ms-map-adapter/test/depth.test.mjs components/ms-map-adapter/test/validate.test.mjs components/ms-map-adapter/test/order-batch.test.mjs components/ms-map-adapter/test/identity-hash.test.mjs
node --test components/ms-map-adapter/test/map-222000000.test.mjs
```

| 命令 | 结果 |
| --- | --- |
| 合成 Node 四文件 | tests 24，pass 24，fail 0，skipped 0 |
| `222000000` golden | tests 1，pass 1，fail 0，skipped 0，约 390ms |

## `222000000` 实测摘要

| 量 | 值 |
| --- | --- |
| projection hash | `sha256:92fa3fc0b3cfd1be8e033f7d0b10691f4c3d6995f854e525a09667cbd22c74bc` |
| Back / Tile / Obj / Portal / Foothold | 16 / 795 / 300 / 22 / 376 |
| Rope / Seat | PRESENT / ABSENT |
| drawables / ordered | 1114 / 1114 |
| paint units | 297（back 16 + static batch 253 + animated object 25 + portal-visual 3） |
| resources（逻辑闭包） | 167，全部 `resource.Map` + `sha256:` |
| no-visual / visual portals | 19 / 3 |
| missing resources | 0 |
| foothold insertion pairs | 15 |
| UNSUPPORTED diagnostics | 16（全部为 Back `type != 0` layout-pending） |
| 默认预算违规 | 0；单 batch 最大 resource page 数 26（上限 32） |

Bounds：`source=vr`，`adjustment=client-vr-inset`，effective `(-3110,-700)-(3200,210)`。

## 退出条件对照

| 条件 | 证据 |
| --- | --- |
| validator 区分缺失 group / 空 group / 缺资源 / 无画面 Portal | `validate.test.mjs`：seat ABSENT、tile EMPTY、tile PNG MISSING、`pt=0` NO-VISUAL vs `pt=2` VISUAL |
| 相同内容输入 → 稳定 scene/projection hash | 合成与 `222000000` 双次 `buildMapProjection` hash 一致 |
| drawable 可回溯 mapId / group / sourceOrder | `assertTraceable` + RenderNode `provenance`；稳定 id 形如 `tile:map222000000:0` |
| 排序 / identity / resource closure / batch planner golden | `depth.test.mjs`、`order-batch.test.mjs`、`identity-hash.test.mjs`、`map-222000000.test.mjs`；真实 hash 与 Paint Unit 数为精确断言 |
| 纯 Adapter/Projection，不依赖 DOM/Canvas | 包内无 DOM/Canvas/WebProjector 导入；测试仅 `node --test` |
| 更新策略不被静态合批吞并 | 25 个多帧 Obj 独立投影为 `ms-map-object` candidate，静态 batch 内 `local-animation=0`；所有帧、delay 与资源身份均保留 |

## 来源标签与本阶段 PRODUCT-DECISION

| 项 | 标签 |
| --- | --- |
| Tile/Obj sort key | `CMS079-PROVEN` C-001 / C-002 |
| Avatar 插入点 key | `CMS079-PROVEN` C-099（仅用于 batch 切分，不投影 Player） |
| Back depth 带 | `OPENMS-REFERENCE`（GMS083）；非 CMS079 证明 |
| 同键次序 | `PRODUCT-DECISION`：authored `sourceOrder` 作为 tieKey |
| Portal 有无画面 | `CMS079-PROVEN` pt∈{2,4,7}→pv，{10,11}→ph/psh，其余 NO-VISUAL |
| Portal visual 世界深度 | `PRODUCT-DECISION`：独立 band `DEPTH_BASE+300000+sourceOrder`，待 CMS079 视觉深度证据 |
| Back `type!=0` | 保留事实与资源闭包，标记 `UNSUPPORTED` / `presentation=layout-pending`；仍进入候选 Paint Unit，不假装 type0 布局已实现 |
| Batch 默认预算 | `PRODUCT-DECISION`：`maxPlacements=256`，`maxPixels=1024²`，`maxResources=32`，`regionSize=2048`；253 个 batch 是首份切分结果，不是产品 Canvas 预算；不可拆的单 placement 超限会显式标记 `budgetCompliance`，不伪装成合规 |

初版 planner 曾把 25 个多帧 Obj 放入静态 batch 并只投影首帧；独立复核后已修正为 `ms-map-object` candidate，并新增真实图断言防止回归。JSONL 的 `sourceOrder` 现在强制取物理行号，输入记录不能覆盖；malformed JSONL、未解析 frame/resource 会令 closure `ok=false`。

## 明确未做（留给 M3+）

- 真实 WebProjector / PWA 显示该图；
- Movement、Camera follow、Portal travel；
- Back type1–4 视差/重复布局实现；
- Portal ph/psh 动画 phase；
- 生产 `stack-rank` 编码冻结与 Canvas 性能预算；
- 把 map 表写入 canonical PWA content 白名单。

## M2 结论

- **M2 通过。** 路线图 6.4 的内容校验语义、稳定 hash、可回溯 identity、排序/闭包/batch golden、更新策略隔离与纯数据测试边界均已满足。
- 下一实施里程碑为 M3（静态 Field 场景接入真实 WebProjector），不得用 DOM 演示掩盖本阶段数据管线缺口。
