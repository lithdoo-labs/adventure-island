# cms-map-layer

> 公共 RenderNode attrs/data/children ABI 以 [RENDER-NODE-ABI-V1.md](../RENDER-NODE-ABI-V1.md) 为准；本文区分样本字段、产品候选顺序和未验证的客户端绘制语义。

地图八层中的一层，节点名是 `"0"` 到 `"7"`。空层不创建元素。

## 样本覆盖与数据形状

当前审计只覆盖 21 张实质地图，不代表全库：

- Tile：3,607 条放置记录，字段为 `x,y,u,no,zM`；样本中没有放置级 `z` 或 flip。
- Obj：1,529 条放置记录，常见字段为 `oS,l0,l1,l2,x,y,z,f,zM`；`zM` 在样本中有 105 个不同值。
- Obj 样本另有 `r` 337 条（样本值恒为 `"0"`）和 `reactor` 221 条；`name`、`flow` 在本次样本中为 0。
- Tile 的 `u` 包含主体、边缘和斜边类别，数据形状不支持把它建模成等宽矩阵。

全库 4,259 张地图、165,125 个 Obj、11,817 个 Reactor 关联和 3,697 个 name 的历史计数，在当前工作区没有可复查的完整 XML/CSV，不作为本设计的事实依据。

## 当前产品候选绘制顺序

Task 023 的 HaCreator 移植使用如下排序键：

```text
Obj:  (layer, 0, placement.z, sourceOrder)
Tile: (layer, 1, canvas.z, sourceOrder)
```

Adventure Island v1 暂把它作为产品候选顺序：较小 layer 先画；同层 Obj 组先于 Tile；Obj 按放置 `z` 升序；Tile 按 asset 的 `canvasZ` 升序；同值保持源顺序。

**这不是客户端已确认的排序规则。** 本次没有找到游戏客户端的 Tile/Obj 排序函数；Tile 画布也未包含在当前 canvas 提取中，所以 `canvasZ` 尚未实测。WzComparerR2 是第三方渲染器，不能补足客户端证据。

`zM` 必须原样保留。它在样本中有丰富取值，但客户端是否用它把人物插入 Obj 深度带仍未验证。MVP 暂不使用 `zM` 拆分人物前后景，这是产品限制，不代表客户端忽略它。

## 运行库交给它的数据

`attrs`：

| ABI attrs | 值 | 含义 |
|---|---|---|
| `layer` | `"0"` 到 `"7"` | 地图层号 |
| `tile-set` | 图集名，可选 | 有 Tile 的层可由 `info/tS` 提供 |

`data` 的唯一顶层成员是 `mapLayerPlan`，按公共 ABI 使用资源表去重：

```js
{
  mapLayerPlan: {
    formatVersion: 1,
    assets: [
      {
        id: "tile:woodMarble:bsc",
        kind: "tile",
        resource: { namespace: "resource.图", key: "Tile/woodMarble/bsc/0", contentVersion: "sha256:..." },
        width: 90,
        height: 60,
        origin: [0, 0],
        canvasZ: 0
      }
    ],
    tiles: [
      { assetId: "tile:woodMarble:bsc", x: 0, y: 0, zM: 0 }
    ],
    objs: [
      { assetId: "obj:...", x: 0, y: 0, z: 100, zM: 0, flip: false }
    ]
  }
}
```

Tile 放置项的 `x/y/u/no/zM` 由 Adapter 解析：`u/no` 用于确定 Tile asset，放置数组保留资源引用、像素坐标和 `zM`。Tile 画布的 `canvasZ` 只能在真实画布元数据提取后填入。

Obj 的 `oS/l0/l1/l2` 用于确定 Obj asset；`x/y/z/f/zM` 投影为放置记录，其中 `f` 转为产品布尔 `flip`。Obj 的 `z` 与 Tile 的 `canvasZ` 是不同字段。

## 逻辑与 unsupported

- `reactor/name` 属于游戏逻辑/脚本关联，不进入视觉计划；当前样本只支持确认 `reactor` 有出现，不能据此声称全库频率。
- `r/flow` 的画面语义尚未确认。MVP allowlist 遇到需要这些字段才能正确呈现的记录时，Adapter MUST 明确报告 unsupported，不得静默丢弃后声称完整复刻。
- [cms-portal](../cms-portal/DESIGN.md)、[cms-npc](../cms-npc/DESIGN.md)、[cms-reactor](../cms-reactor/DESIGN.md) 和 [cms-seat](../cms-seat/DESIGN.md) 是独立逻辑实体，不从 Obj 的脚本字段推断点击目标。

## 第一阶段与不做什么

整层一个 `cms-map-layer`，不把单块 Tile/Obj 转成 RenderNode，不把瓦片转成矩阵。人物仍在 `cms-avatar-layer`；背景在 `cms-back`。地图若依赖尚未支持的 `r/flow` 或需要人物与 Obj 的深度交错，在实现支持前必须标记 unsupported。
