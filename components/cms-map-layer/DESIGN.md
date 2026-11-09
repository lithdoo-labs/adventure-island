# cms-map-layer

> 公共 RenderNode attrs/data/children ABI 以 [RENDER-NODE-ABI-V1.md](../RENDER-NODE-ABI-V1.md) 为准。逻辑记录和诊断键以 [MAP-SCENE-PLAN-V1.md](../MAP-SCENE-PLAN-V1.md) 为准。

地图八层中的一层，节点名是 `"0"` 到 `"7"`。空层不创建元素。

## 样本覆盖与数据形状

当前审计只覆盖 21 张实质地图，不代表全库：

- Tile：3,607 条放置记录，字段为 `x,y,u,no,zM`；样本中没有放置级 `z` 或 flip。
- Obj：1,529 条放置记录，常见字段为 `oS,l0,l1,l2,x,y,z,f,zM`；`zM` 在样本中有 105 个不同值。
- Obj 样本另有 `r` 337 条（样本值恒为 `"0"`）和 `reactor` 221 条；`name`、`flow` 在本次样本中为 0。
- Tile 的 `u` 包含主体、边缘和斜边类别，数据形状不支持把它建模成等宽矩阵。

全库 4,259 张地图、165,125 个 Obj、11,817 个 Reactor 关联和 3,697 个 name 的历史计数，在当前工作区没有可复查的完整 XML/CSV，不作为本设计的事实依据。

## 排序

客户端已确认加载时的整数键。比较方向和相同键次序待逆向。

```text
tileKey = canvasZ + 10 * (layer * 3000 - zM) - 1073721834
objKey  = layer * 30000 + z - 1073739824
```

Tile 键使用画布 `z` 和放置 `zM`。Obj 键使用放置 `z`，不使用 `zM`，也不使用资源画布 `z`。两个常数不同。Henesys 层 0 的 tile 35 与 tile 34 键相同，源顺序还不是已确认的 tie-break。

`clientSortKey` 写在 MapScenePlan 里，不进入 `mapLayerPlan`。本组件不按这个键排序。

产品绘制顺序保持为：较小 layer 先画；同层 Obj 组先于 Tile；Obj 按放置 `z` 升序；Tile 按 asset 的 `canvasZ` 升序；同值保持源顺序。这来自 HaCreator，验收时标成产品约定。

`zM` 必须原样保留。Tile 键已经使用它。Obj 的这条路径不读它。MVP 仍不把人物插进 Obj 深度带。

画布 `z` 已从 WZ 提取。下面四张没有 `z`，引用它们时 Adapter 报告 `tile-canvas-z-absent`，禁止把 `canvasZ` 写成 0：

- `Tile/greenCrystalCave.img/bsc/0`
- `Tile/blueCave2.img/bsc/0`
- `Tile/blueCave2.img/bsc/1`
- `Tile/blueCave2.img/bsc/2`

## 画布

整层一个组件，不等于整层一张世界尺寸 Canvas。射手村 `miniMap.width` 为 7174。本组件使用视口尺寸 Canvas，按 Camera 裁剪可见放置项。不沿用 `cms-actor` 的合成 Canvas 上限。空间分块留到视口 Canvas 的内存测量超预算之后。

绘制使用产品锚定：`drawLeft = x - originX`，`drawTop = y - originY`。`flip` 围绕放置锚点水平镜像。v1 不旋转。

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

Tile 放置项的 `x/y/u/no/zM` 由 Adapter 解析：`u/no` 用于确定 Tile asset，放置数组保留资源引用、像素坐标和 `zM`。`canvasZ` 使用画布上的整数 `z`。

Obj 的 `oS/l0/l1/l2` 用于确定 Obj asset；`x/y/z/f/zM` 投影为放置记录，其中 `f` 转为产品布尔 `flip`。Obj 的 `z` 与 Tile 的 `canvasZ` 是不同字段。

## 逻辑与 unsupported

- `reactor/name` 属于游戏逻辑/脚本关联，不进入视觉计划；当前样本只支持确认 `reactor` 有出现，不能据此声称全库频率。
- `r` 缺省或为 0 时不进入视觉记录。`r` 为其他值，或源记录带有 `flow` 时，Adapter 报告 `obj-visual-field-unsupported`。
- [cms-portal](../cms-portal/DESIGN.md)、[cms-npc](../cms-npc/DESIGN.md)、[cms-reactor](../cms-reactor/DESIGN.md) 和 [cms-seat](../cms-seat/DESIGN.md) 是独立逻辑实体，不从 Obj 的脚本字段推断点击目标。

## 第一阶段与不做什么

整层一个 `cms-map-layer`，不把单块 Tile/Obj 转成 RenderNode，不把瓦片转成矩阵。人物仍在 `cms-avatar-layer`；背景在 `cms-back`。地图若依赖尚未支持的 `r/flow` 或需要人物与 Obj 的深度交错，在实现支持前必须标记 unsupported。
