# cms-back

> 公共 RenderNode attrs/data/children ABI 以 [RENDER-NODE-ABI-V1.md](../RENDER-NODE-ABI-V1.md) 为准；本文记录 CMS 来源字段和背景绘制语义。

一张背景。地图节点 `back` 里的每一项对应一个元素，因为每张背景相对镜头的滚动不一样。

## 在树中的位置

`front=0` 的放在所有地图层之前，是远景。`front=1` 的放在传送门之后，是近景。这是 Task 023 `compose` 的两段绘制。

## 运行库交给它的数据

地图源节点 `back` 的每一项仍由 Adapter 读取，但不把 WZ/CMS 字段名直接作为浏览器 attrs。公共 attrs 映射如下：

| ABI attrs | 源字段 | 用途 |
|---|---|---|
| `back-set` | `bS` | 背景图集 |
| `index` | `no` | 背景编号 |
| `animation` | `ani` | 来源动画选择标识 |
| `x` / `y` | `x` / `y` | 锚点 |
| `parallax-x` / `parallax-y` | `rx` / `ry` | 视差或滚动速度 |
| `background-type` | `type` | 平铺与滚动类型 |
| `tile-step-x` / `tile-step-y` | `cx` / `cy` | 平铺步长 |
| `flip` | `f` | 翻转，字符串 `"true"/"false"` |
| `opacity` | `a` | 透明度，十进制字符串，缺省 255 |

缺省 attrs 由 Adapter 填充：`animation="0"`、视差和平铺步长为 `"0"`、`background-type="0"`、`flip="false"`、`opacity="255"`。源字段 `front` 不投影为 attrs；它只决定父级 children 中远景段或近景段的位置。

`data` 的唯一顶层成员是 `backPlan`：

```js
{
  backPlan: {
    formatVersion: 1,
    loop: true,
    frames: [
      {
        delay: 100,
        resource: { namespace: "resource.图", key: "Back/grassySoil/ani/0", contentVersion: "sha256:..." },
        width: 256,
        height: 128,
        origin: [0, 0]
      }
    ]
  }
}
```

静态/动画帧、帧延迟、Canvas 尺寸、origin 和逻辑资源版本由构建期 Adapter 解析后放进 `backPlan`。组件不得自行查找 `Back/{bS}.img`、WZ 或 FSDB 路径；运行时通过 LoomRealm 注入的 Presentation Resource Client 读取资源。资源引用形状和帧结构以公共 ABI 为准。

`type` 的平铺规则以合成器为准：1、3、4、6、7 横向重复，2、3、5、6、7 纵向重复。4 和 6 按 `rx` 水平滚动，5 和 7 按 `ry` 垂直滚动。

## 第一阶段

合成场景可以没有背景，也可以各放一张不滚动的远景。近景可以不出现。

## 不做什么

- 不跟随人物的游戏坐标。滚动只来自镜头和本元素的 `rx`、`ry`、`type`。
- 不承载出口或人物。
