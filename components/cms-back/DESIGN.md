# cms-back

> 公共 RenderNode attrs/data/children ABI 以 [RENDER-NODE-ABI-V1.md](../RENDER-NODE-ABI-V1.md) 为准；本文区分源字段事实、产品约定和未验证的客户端绘制语义。

一项地图 `back` 对应一个 `cms-back`。每张背景的参数独立，但参数名称不等于已确认的客户端公式。

## 在树中的位置

`front=0` 作为远景段，`front=1` 作为近景段。当前产品树把远景放在地图层之前、近景放在 Portal 之后；这来自 Task 023 / HaCreator 合成顺序，不是已复核的游戏客户端绘制顺序。

## 运行库交给它的数据

| ABI attrs | 源字段 | 当前解释 |
|---|---|---|
| `back-set` | `bS` | 背景资源组标识 |
| `index` | `no` | 组内背景编号 |
| `animation` | `ani` | 来源动画选择标识 |
| `x` / `y` | `x` / `y` | 源锚点整数 |
| `parallax-x` / `parallax-y` | `rx` / `ry` | 原样保留的源参数；视差/滚动公式未验证 |
| `background-type` | `type` | 原样保留的类型整数；客户端分支未验证 |
| `tile-step-x` / `tile-step-y` | `cx` / `cy` | 原样保留的步长参数 |
| `flip` | `f` | 产品布尔编码；客户端翻转方向未由函数确认 |
| `opacity` | `a` | 原始 0..255 整数的产品编码；客户端混合公式未确认 |

`front` 不投影为 attrs；它只决定父级 children 中的产品分段。缺失字段的 Adapter 回退值是产品缺省，不是本次样本观察到的客户端缺省：303 条背景样本字段全部齐全。

`data` 的唯一顶层成员是 `backPlan`：

```js
{
  backPlan: {
    formatVersion: 1,
    loop: true,
    frames: [
      {
        delay: 100,
        resource: { namespace: "resource.图", key: "Back/grassySoil/ani/0/0", contentVersion: "sha256:..." },
        width: 256,
        height: 128,
        origin: [0, 0]
      }
    ]
  }
}
```

静态/动画帧、帧延迟、Canvas 尺寸、origin 和逻辑资源版本由构建期 Adapter 解析后放进 `backPlan`。组件不得自行查找 CMS/WZ 或 FSDB 路径；运行时通过 LoomRealm 注入的 Presentation Resource Client 读取资源。背景画布本身尚未从当前逆向提取中恢复，因此这些几何值不能标为已测量。

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

`cx=0` 出现在 155/303 条记录中。HaCreator 移植和 WzComparerR2 都在某些平铺路径把 0 替换为图像宽/高，但没有客户端函数证明这就是游戏行为。两套参考实现对非滚动视差和滚动时间分母也不一致（200 与 20000）；它们只能作为参考实现，不能择一冒充客户端证据。

在取得客户端 Background/Camera 函数或动态像素对照前：

- Adapter 只保留 `rx/ry/type/cx/cy` 源值；
- 不宣称 `rx/ry` 是单一、固定的视差系数；
- 不把 `cx/cy=0` 隐式改成图像尺寸；
- 不把 HaCreator 或 WzComparerR2 的公式写成已验收的客户端算法；
- 需要公式一致性的地图必须标记为未支持/未验收，而不是静默套用一种工具公式。

## 第一阶段

允许使用无背景场景，或仅用静态背景做布局试验。该阶段不构成滚动、视差、透明混合或游戏客户端像素一致性验收。

## 不做什么

- 不拥有 Camera 权威状态；Camera 决策由 Field Runtime 提供。
- 不承载人物、出口或地图交互。
- 不从 WZ 路径直接读取资源。
