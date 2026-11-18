# FSDB 内容模型

> **来源状态：FSDB-FACT + 设计边界。**
> 本文描述当前 `content/[FSDB]adventure` 已有结构以及它怎样服务设计。详细字段仍以 `content/adventure_design.md` 和实际内容为准；本文件不把内容库提升为 Renderer ABI。

## 1. 两层 FSDB

仓库中应区分：

- `content/[FSDB]cms`：WZ 转换和逆向研究使用的原始/通用内容层；
- `content/[FSDB]adventure`：Adventure Island 自研、规范化、按产品选择收敛的游戏内容层。

运行时新设计应读取 `adventure` 逻辑内容，不直接依赖 `cms` 转换树或 WZ 路径。

## 2. 当前内容范围

`[FSDB]adventure` 当前包含 13 张地图：

```text
222000000  222000001
230000000  230000001  230000002  230000003
230020000  230020100  230020200  230020300
230030000  230030100  230030200
```

按 metadata 文件之外的内容文件计：

- Map：13；
- Back / Obj / Foothold / Portal：13 图都有 group 文件；
- Tile：9 图有 group 文件；
- Rope：7 图有 group 文件；
- Seat：3 图有 group 文件；
- Avatar Part：34 条 struct；
- Avatar、Map 资源分别位于独立 namespace；
- 当前 `resource.Map` 目录包含 905 个资源文件。

缺少 Tile/Rope/Seat 文件是来源存在性事实，不能不经 manifest 解释为“空数组”。

## 3. 命名与资源规则

自研记录使用带章节前缀的逻辑 key：

```text
map.222000000
map.back.grassySoil
avatar.part.body.00002000
avatar.equip.cap.01002913
```

资源与结构记录分离：

```text
[resource]Avatar/part/body/00002000/0.png
[resource]Avatar/equip/weapon/01422000/0.png
[resource]Map/back/grassySoil/back/0.png
[resource]Map/tile/woodMarble/bsc/0.png
[resource]Map/obj/acc5/aquaRoad/fish/0/0.png
[resource]Map/helper/portal/game/pv/0.png
```

组件通过 LoomRealm Content capability 使用逻辑 namespace/key/contentVersion 读取，不能接收物理路径、URL 或 bearer。

## 4. Avatar 内容模型

### 4.1 `struct.avatar.Part`

描述身体、头、脸、头发和装备的内容身份与选择元数据，包括来源分类、slot/遮挡相关字段和 weapon stance 等。

同编号但来源/内容不同的 alias 使用稳定后缀保留，Adapter 不能只按数字编号假设全局唯一。

### 4.2 `group.avatar.PartFrame`

一行一个动作帧，保留：

- `action` / `frame`；
- `delay` 与源 delay 符号；
- redirect；
- 局部 layer；
- resource；
- origin；
- anchors；
- 需要时的变体信息。

这些是局部纸娃娃组合事实，不是最终 AvatarPlan。

### 4.3 `struct.avatar.DrawOrder`

保存 149 层 zmap 顺序，方向为人物层从前景到背景。实际 Canvas 绘制通常按相反方向进行。

### 4.4 `struct.avatar.LayerSlot`

保存每个人物 z layer 对应的槽位，用于和 Part 的 `islot/vslot` 一起执行遮挡：

- `priority` 来自占用槽在 DrawOrder 中的优先级；
- `tag` 来自 `vslot ∩ LayerSlot[z]`；
- 输掉任一占用槽时整张局部画布不画；
- 相同 priority 可以共存；
- face 不参加普通槽位占用。

Adapter 从 FSDB 导出 priority/tag/zOrder 等 render-ready metadata；`ms-avatar` 根据这些数据执行当前帧的局部遮挡，不重新遍历 FSDB 或解析原始 slot 字符串。

### 4.5 `group.avatar.Resource` 与 `resource.Avatar`

`group.avatar.Resource` 把逻辑小图名映射到 atlas 页和矩形：

```text
name → image page + x/y/w/h
```

PartFrame 保留 origin/anchors，Resource 负责 atlas rectangle。Adapter 联合两者产生 render-ready layer。

## 5. Map 内容模型

### 5.1 `struct.map.Map`

保存：

- `mapId`；
- 实际存在的 `info` 标量；
- VR；
- miniMap width/height/center/mag/resource；
- 0–7 layer 的 `tileSet` / `tSMag` 等内容事实。

没有完整 VR 或 miniMap 字段时，库不自行合成 bounds。`effectiveBounds` 属于 Adapter/Product projection。

### 5.2 `group.map.Back`

保留 source order 和源字段，例如：

- `bS` / frame branch；
- `x/y`；
- `type`；
- `rx/ry`；
- `cx/cy`；
- `front`；
- opacity / flip 等实际存在字段。

BackFrame 提供 frame、delay、origin、尺寸和 resource。FSDB 不在库内运行视差或 auto-scroll。

### 5.3 `group.map.Tile`

placement 典型字段：

```json
{"layer":"1","x":2880,"y":-240,"u":"enH1","no":0,"zM":42}
```

`group.map.TileFrame` 使用 tileSet、`u/no` 关联到：

- source resource；
- origin；
- Canvas z；
- width/height。

Tile 世界排序需要 placement 和 frame 两侧信息，不能让 Renderer 只看 placement 自行猜测。

### 5.4 `group.map.Obj`

placement 典型字段：

```json
{"layer":"0","oS":"acc6","l0":"folkvillige","l1":"nature","l2":"4","x":-2601,"y":-208,"z":9,"f":0,"zM":39}
```

`group.map.ObjFrame` 通过 `oS/l0/l1/l2` 关联 frame、delay、origin、resource 和尺寸。

静态 Obj 可进入 `ms-map-batch`；需要独立动画、更新或深度身份的 Obj 才投影为 `ms-map-object`。

### 5.5 `group.map.Foothold`

保存：

- layer/platform/id；
- x1/y1/x2/y2；
- prev/next。

Foothold 属于 Movement 和世界深度权威输入，不是可视组件自己的碰撞数据。

### 5.6 `group.map.Portal`

placement 典型字段：

```json
{"pn":"sp","pt":0,"x":-92,"y":294,"tm":999999999,"tn":""}
```

注意：

- 同一图可以有多个相同 `pn`，例如多个 `sp`；
- 记录本身没有额外全局 id；
- source order 因而是稳定身份和诊断的重要输入；
- `tm/tn` 属于 Portal target 内容，不属于 `ms-portal-visual`；
- `pt=3` 等无画面 Portal 仍可能有业务意义。

Adapter 应产生稳定 portal identity 和目标索引，不能只用 `pn` 作为唯一 key。

### 5.7 Rope 与 Seat

Rope 保存端点和来源身份；Seat 保存 index/x/y。CMS079 的命中范围、爬行步进和状态转换属于 Movement 逻辑，不写入 FSDB 记录。

## 6. JSONL 顺序

Map placement group 的行顺序保留源子节点顺序。当前记录未普遍增加显式 `sourceOrder` 字段，因此使用方必须保证：

1. Content API 对 group 的迭代顺序明确且可复现；
2. Adapter 在读取时捕获行号/source index；
3. 投影生成稳定 identity 和 tie key；
4. batch、region、异步加载不得丢失该顺序；
5. diagnostic 能映射回 mapId、group、source index 和资源。

未来是否把 source index 显式写入 FSDB 应由内容 schema 评审决定，不能只为 DOM key 临时增加字段。

## 7. FSDB 中明确不保存的内容

- RenderNode tree；
- DOM tag、attribute 和 child order；
- Canvas batch；
- `stack-rank`；
- 当前 Actor position/velocity；
- Camera state；
- Portal travel token；
- scene generation/epoch；
- decoded ImageBitmap；
- Renderer-local frame phase；
- product-specific transition mask。

这些都是运行时 projection 或 presentation 状态。

## 8. 内容到组件映射

| FSDB 内容 | Adapter/Subsystem 产物 | Renderer 候选 |
| --- | --- | --- |
| map.Map + Back/BackFrame | resolved Back plan、rank、Camera inputs | `ms-map-back` |
| Tile + TileFrame | sorted placement、resource rectangle、batch | `ms-map-batch` |
| Obj + ObjFrame | static batch 或 independent object | `ms-map-batch` / `ms-map-object` |
| Foothold/Rope/Seat | Movement contacts、Actor depth | `ms-world-item` 最终位置/rank |
| Portal + HelperFrame | Portal index、travel state、visual plan | `ms-portal-visual` 仅画面 |
| avatar Part/Frame/Resource | resolved appearance/actions | `ms-avatar` / `ms-action` |

## 9. 已知内容闭包边界

CMS079 WZ → FSDB 验证不是“全客户端无损转换”证明。现有报告记录：

- dangling UOL；
- cycle；
- 未解析 Canvas decode；
- converter omission；
- 少量 Avatar look 闭环不能推广为所有装备和动作均完整。

组件和 Adapter 的错误语义必须能区分这些内容问题，不能为了画出画面而静默补默认值。

## 10. 设计检查清单

新增或修改 FSDB 字段前确认：

1. 它是否是来源内容事实，而不是当前运行时状态；
2. 是否有 CMS079/WZ/导入来源可追溯；
3. 缺失与空值是否可区分；
4. 是否保持逻辑资源 namespace，而不是物理路径；
5. 是否会把组件 ABI 反向固化进内容库；
6. 是否有 validator、fixture 和真实内容审计；
7. 是否需要更新 `content/adventure_design.md` 作为 FSDB 规范。
