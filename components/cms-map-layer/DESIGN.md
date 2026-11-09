# cms-map-layer

> 公共 RenderNode attrs/data/children ABI 以 [RENDER-NODE-ABI-V1.md](../RENDER-NODE-ABI-V1.md) 为准；本文记录 CMS 地图层、Tile/Obj 来源和排序依据。

地图八层中的一层。节点名是 `"0"` 到 `"7"`。缺层就不创建元素。

## 画什么

这一层里的物件 `obj` 和瓦片 `tile`。合成器的排序键是：

```text
物件：(层号, 0, 物件上的 z, 顺序)
瓦片：(层号, 1, 图集画布上的 z, 顺序)
```

层号在前，所以先画完较小的层，再画下一层。同一层里物件整组在瓦片之前，组内再按 `z`。

瓦片不单独做组件，也不排成矩阵。它们是这一层上的一份放置数组。

瓦片的坐标是像素，块的尺寸也不统一：`bsc` 常见 90×60，横边 90×25，竖边 25×60。一块平台由这些块按 `x`、`y` 拼出来，中间可以留空，边缘会叠在主体上。这不是等宽格子，写成矩阵会对不齐。

射手村层 1 就有 577 块瓦片。每块一个元素会把渲染树撑满。整层一个 `cms-map-layer`，瓦片放在它的 `tiles` 数组里，由这一层自己按 `z` 画。

物件同样放在这一层的 `objs` 数组里，不单独做组件。4,259 张地图里有 165,125 个物件，每一条都有 `oS`、`l0`、`l1`、`l2`、`x`、`y`、`z`、`f`、`zM`。这些是画面和遮挡，不是点击目标。

能交互的是地图上的另一类节点，不在 `obj` 里：

- [cms-portal](../cms-portal/DESIGN.md)：走进去换场景
- [cms-npc](../cms-npc/DESIGN.md)：`life` 里 `type=n` 的对话
- [cms-reactor](../cms-reactor/DESIGN.md)：箱子、开关、花，打或点的是它自己的坐标
- [cms-seat](../cms-seat/DESIGN.md)：坐下的坐标。椅子的样子仍是物件

11,817 个物件带了 `reactor` 字段，表示这张图跟着某个反应堆变换，点击落点仍是反应堆自己的坐标。3,697 个物件有 `name`，例如 `gate`，给脚本按名字找图，不是给元素接收点击。

`zM` 决定人物可以从物件前面或后面走过。第一阶段人物整层画在地图层之后，这个字段先留在数组里。

## 运行库交给它的数据

`attrs`：

| ABI attrs | 值 | 含义 |
|---|---|---|
| `layer` | `"0"` 到 `"7"` | 层号 |
| `tile-set` | 图集名，可选 | 层 `info/tS`；只有物件的层可以省略 |

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

Tile 源放置项的 `x/y/u/no/zM` 由 Adapter 解析：`u/no` 用于确定 Tile asset，放置数组只保留绘制所需的 asset 引用、像素坐标和 `zM`。Tile 的画布排序值 `canvasZ` 来自 `Tile/{tS}.img` 中的 Canvas `z`，不来自 Tile 放置记录。

Obj 源记录的 `oS/l0/l1/l2` 用于确定 Obj asset；`x/y/z/f/zM` 投影为放置记录，其中 `f` 转为布尔 `flip`。Obj 放置 `z` 与 Tile asset 的 `canvasZ` 是两个不同概念。

绘制顺序固定为：同层 Obj 先于 Tile；Obj 按放置 `z` 升序；Tile 按引用 asset 的 `canvasZ` 升序；相同排序值保持数组原顺序。父树中的 layer 顺序从 0 到 7。不要把瓦片转成矩阵，也不要为单块瓦片/物件创建 RenderNode。

`zM` 在 v1 中必须保留，但 MVP 尚不据此把人物拆成前后景绘制带。物件的 `reactor/name` 是游戏逻辑关联，不进入视觉计划；`r/flow` 的画面语义尚未确认，不能静默丢弃后声称完整复刻。MVP 地图若依赖未支持的扩展字段才能正确显示，Adapter 必须明确报告 unsupported。

资源引用、source rectangle、尺寸和校验规则以 [RENDER-NODE-ABI-V1.md](../RENDER-NODE-ABI-V1.md) 为准。组件不直接读取 WZ 路径或 FSDB。

## 第一阶段

两张合成场景各自给出实际用到的层。空层不出现。占位地面可以落在其中一层，立足线仍然只是碰撞数据。

## 不做什么

- 背景的视差属于 `cms-back`。源物件的 `flow` 字段不属于 v1 视觉 ABI；需要该动画语义的地图在实现支持前必须标为 unsupported，不能作为普通静态 Obj 静默绘制。
- 不放置人物。人物在 `cms-avatar-layer`。
- 不从 WZ 路径直接读文件。
