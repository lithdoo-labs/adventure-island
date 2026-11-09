# cms-back

> 公共 RenderNode attrs/data/children ABI 以 [RENDER-NODE-ABI-V1.md](../RENDER-NODE-ABI-V1.md) 为准。支持范围以 [MAP-SCENE-PLAN-V1.md](../MAP-SCENE-PLAN-V1.md) 为准。

一项地图 `back` 对应一个 `cms-back`。P1 只静态绘制 type 0。

## 在树中的位置

`front=0` 作为远景段，`front=1` 作为近景段。`front` 参与客户端 `index * 1000` 加载键，比较方向待逆向。当前产品树把远景放在地图层之前、近景放在 Portal 之后，这仍是产品约定。

## 运行库交给它的数据

| ABI attrs | 源字段 | 当前解释 |
|---|---|---|
| `back-set` | `bS` | 背景资源组标识 |
| `index` | `no` | 组内背景编号 |
| `animation` | `ani` | 来源动画选择标识 |
| `x` / `y` | `x` / `y` | 源锚点整数。产品锚定为 `x - originX`、`y - originY` |
| `parallax-x` / `parallax-y` | `rx` / `ry` | 原样保留。滚动分支已确认用它们做 `20000 / abs(rate)`；`+0x98` 函数体待逆向。P1 不解释这两个值 |
| `background-type` | `type` | 原样保留。type 0–3、4/6、5/7 的分支已确认。P1 只接受 type 0 |
| `tile-step-x` / `tile-step-y` | `cx` / `cy` | 原样保留。0 不替换为图像尺寸 |
| `flip` | `f` | 产品布尔。为真时围绕锚点水平镜像 |
| `opacity` | `a` | 0–255 整数。绘制 alpha 为 `opacity / 255`，这是产品约定 |

`front` 不投影为 attrs；它只决定父级 children 中的产品分段。缺失字段的 Adapter 回退值是产品缺省，不是本次样本观察到的客户端缺省：303 条背景样本字段全部齐全。

`data` 的唯一顶层成员是 `backPlan`：

```js
{
  backPlan: {
    formatVersion: 1,
    loop: false,
    frames: [
      {
        resource: { namespace: "resource.图", key: "Back/example/back/0", contentVersion: "sha256:..." },
        width: 256,
        height: 256,
        origin: [128, 128]
      }
    ]
  }
}
```

静态/动画帧、帧延迟、Canvas 尺寸、origin 和逻辑资源版本由构建期 Adapter 解析后放进 `backPlan`。组件不得自行查找 CMS/WZ 或 FSDB 路径；运行时通过 LoomRealm 注入的 Presentation Resource Client 读取资源。画布 origin、宽高和 `z` 已从 WZ 提取；缺 `delay` 的帧不补 0。`loop: false` 是 P1 的产品呈现。`loop: true` 不补时间，也不启动组件私有时钟。

`Back/grassySoil.img/ani/0` 有 10 帧，都没有 `delay`。引用它时停在第一帧。全部帧都有 `delay` 的背景也先停在第一帧，直到产品时钟和客户端时间单位同时落地。

## 证据与未验证项

当前审计统计的是 21 张实质地图中的 303 条背景：

| type | 样本数 |
|---|---:|
| 0 | 60 |
| 1 | 101 |
| 2 | 34 |
| 3 | 35 |
| 4 | 73 |
| 5 / 6 / 7 | 0 |

`cx=0` 出现在 155/303 条记录中。客户端把 `cx` 当作水平步长、`cy` 当作垂直步长。值为 0 时不改用画布宽高，所以 0 继续保留为 0。

已确认的部分是分支和步长，不是完整绘制公式：

| 事实 | 状态 |
|---|---|
| type 0–3 的 `+0x98` 参数是 `(origin, 100, 100, rx, ry)`；type 4/6 为 `(origin, 100, 100, 0, ry+100)`；type 5/7 为 `(origin, 100, 100, rx+100, 0)` | 客户端已确认 |
| `cx` 为水平步长，`cy` 为垂直步长；0 不换成画布尺寸 | 客户端已确认 |
| `+0x98` 函数体、时间单位、`front` 比较方向 | 待逆向 |
| type 4、6 用 `rx`，type 5、7 用 `ry` | 客户端已确认 |
| `step = 20000 / abs(rate)` | 客户端已确认 |
| P1 只静态绘制 type 0，不滚动、不视差 | 产品约定 |
| type 1–7 | unsupported，code `background-type-unsupported` |

HaCreator 与 WzComparerR2 的视差公式不写入本组件。

## 第一阶段

允许无背景，或只画 type 0 的第一帧。该阶段验收产品锚定，不验收滚动、视差或客户端像素一致。透明混合按 `opacity / 255` 的产品约定执行，不称为客户端混合公式。

## 不做什么

- 不拥有 Camera 权威状态；Camera 决策由 Field Runtime 提供。
- 不承载人物、出口或地图交互。
- 不从 WZ 路径直接读取资源。
