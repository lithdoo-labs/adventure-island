# ms-portal-visual — Portal 可见外观（首阶段设计草案）
> **契约维护：不做组件 ABI / Schema 版本管理。** 字段和行为变化直接更新本文件与实现，不设置 `formatVersion` / `schemaVersion`，不做版本协商、兼容分支或迁移。ResourceRef 的 `contentVersion` 是 LoomRealm Content 资源身份，不是组件版本。


> 状态：PROPOSED / NON-NORMATIVE / NOT IMPLEMENTED。首阶段**仅在目标地图有可见 Portal 外观需求时启用**；Portal 触发与场景迁移功能本身**不依赖这个标签**。
> 参见 [组件树](./FIELD-COMPONENT-TREE-DRAFT.md) 与 [ms-scene-view](./ms-scene-view.md)。

## 1. 不等于 Portal Subsystem

ms-portal-visual 是普通的 Renderer-only Paint Unit：显示 Portal 静态图片或动画、面向世界定位并参与必要的遮挡排序。

它**不是**可交互的 Portal 触发区、tm/tn 解析器、地图目标索引或迁移命令发出者。玩家按 Up、Portal 命中范围、冷却和 same-map/cross-map 迁移都由 Subsystem 处理，输入仍沿 LoomRealm InputGate 流转。不可通过 DOM click、pointer hit-test、CSS visibility 决定是否触发传送。

## 2. 首阶段功能范围

- 参考归档的三图 R1 提案：Portal 业务传送需要完整实现；可见 Portal 仅要求在实际存在、资源就绪且对应外观被批准时绘制基础静态帧。
- 对完全不可见、缺少可见资源或并不需要展示的 Portal，不创建本节点；但 Subsystem 中的 Portal 记录仍可存在并参与游戏规则。
- 动态 phase（pv/ph/psh 等）和复杂循环动画是后续候选能力；不允许无证据地将所有 Portal 视为一种动画。
- Portal 的世界深度/显示前后需单独 CMS079 证据；**禁止默认始终压在 Avatar 前面**。

## 3. 候选输入数据（非 ABI）

| 语义 | 说明 |
| --- | --- |
| portal visual presentation id | 视觉身份和代际；与业务目标 map/tn 身份区分 |
| world x/y、origin、flip、visibility | 只用于显示定位及局部变换 |
| static frame/resource refs | 版本化资源/当前帧；无必要的业务 destination |
| stack-rank / validated visual-depth policy | 若画面需要与 Obj、Avatar 交错，使用 Subsystem 已确定的排序 |
| visual phase（后续） | 仅在已有证据支持时播放，不决定 Portal 业务状态 |

实际 attrs/data、phase 协议、资源 closure 错误策略未批准。若其缺少可见素材，Portal 逻辑不应因为 DOM 组件不出现而失败。

## 4. DOM、遮挡和更新

- ms-portal-visual 可作为 ms-scene-view 直属 Paint Unit，与地图 Canvas / Avatar 同级排序；如果未来采用通用 ms-world-item 包装，必须保证其**唯一**外层排序宿主，不能叠加两层互相隔离的 z-index。
- 简单静态视觉优先使用图片元素；真正有动画序列时才使用局部 Canvas 或图片帧机制。
- Portal 外观可能在 Avatar 前/后；如果证据表明某类 Portal 无需参与世界遮挡，也应在设计中明确其独立视觉层策略。
- 可见性、视觉帧更新不改变游戏 Portal 的 enabled、cooldown 或 arrival state。
- 不以 Portal 的视觉动画结束、CSS 过渡完成或图片加载结束作为 Subsystem transfer commit 的条件。

## 5. 生命周期和失败

- 场景替换时旧 Portal DOM 随 RenderNode 生命周期移除，旧动画/加载请求停止或失效。
- 非关键装饰资源缺失需明确记录并允许 Gameplay Portal 工作；关键显示要求若被产品审批则在呈现准备阶段阻止宣称完整画面，二者按产品验收政策区分。
- 同地图 Portal 迁移的业务语义完全由 Subsystem 控制，不由视觉标签推断或管理场景代际。
- 视觉组件不主动注册一个全局 Portal 列表，也不将事件直接发送到 Portal Subsystem。

## 6. 验收

1. 有外观与无外观 Portal 均可在同一业务传送规则下运作；画面显示不影响触发。
2. Portal 在地图/Avatar 前后关系遵循验证过的视觉深度。
3. 传送失败保留源业务状态；视觉组件不会提前清理源地图。
4. R1 三图双向 Portal、同地图跳点、图片慢加载与卸载清理。
5. 若后续 phase 动画启用，补充播放时序、帧资源及 30/60/120Hz 回放检查。

历史需求参考：[归档 R1 路线图](../../docs/product-first/IMPLEMENTATION-ROADMAP.md)（NON-NORMATIVE，不是当前批准的产品合同）。

## 7. RenderNode ABI — Static Portal Artwork

> 首阶段仅定义**静态可见 Portal 外观**；Portal 命中、tm/tn、cooldown、same/cross-map 传送都由 Field Subsystem 负责，与本 Visual Element 是否存在完全分离。通用类型见 [共享 ABI](./FIELD-PAINT-UNIT-ABI-DRAFT.md)。

### 7.1 attrs 完整闭集

`world-x`、`world-y`、`stack-rank`、`visible` 均为必需。世界位置是 Portal 视觉自身的逻辑锚点；深度排名由 Subsystem Render Projection 给出，不能因为 Portal 是触发器就始终强制前景。

对于 **CMS079 Portal 视觉深度尚没有可信统一证据** 的资源，不能通过猜测 CSS rank 声称严格等价；可以使用合成测试证明组件能力，而实际地图必须在深度证据/产品策略批准之后发布可见内容。无外观 Portal 不需要此节点。

### 7.2 data 完整闭集

~~~ts
interface PortalVisualData {
  visualId: string;           // presentation identity；不是 tm/tn/目的地图标识
  phase: "static";           // 当前仅支持静态外观
  image: ImageRegion;
  draw: StaticDraw;
}
~~~

示例：

~~~json
{
  "key": "portal-visual:map222000000:entrance",
  "tag": "ms-portal-visual",
  "attrs": { "world-x": "240", "world-y": "180", "stack-rank": "50", "visible": "true" },
  "data": {
    "visualId": "portal-art:entrance", "phase": "static",
    "image": {
      "resource": { "namespace": "map", "key": "examples/portal/static.png", "contentVersion": "sha256:0000000000000000000000000000000000000000000000000000000000000000" },
      "pageWidth": 32, "pageHeight": 64,
      "source": { "x": 0, "y": 0, "w": 32, "h": 64 }
    },
    "draw": { "origin": [16, 64], "flip": false, "opacity": 255 }
  },
  "children": []
}
~~~

资源 ID、尺寸、位置和 rank 都是合成示例，不宣称存在此实际 Portal 资源。真实图片必须有来源、资源闭包和可见性验收。

### 7.3 RenderEvent、层级、更新和生命周期

- children 必须为空；incoming RenderEvent：无；outgoing `emitCustomEvent()`：无。根层级是 ms-scene-view 直属的独立 Paint Unit。无需 ms-world-item 再包一层，避免双重外部深度宿主。
- 静态图片可以用 img 或局部 Canvas，按照 sourceRect 裁剪、origin 对齐、flip/opacity 绘制；在 Canvas/Shadow DOM 内部不包含碰撞区域或交互传送逻辑。
- 位置、显隐与 rank 更新走 attrs Update；更换图像/phase 等需要有效 当前 data 完整更新，不能接收未知非静态 phase。
- 视觉渲染事件的进入/离开动画、闪烁提示、扩展 phase 状态机 尚不属于当前设计；该组件不得发送业务逆向事件，也不得在 DOM pointer/up 时决定传送。
- 当 Portal 没有视觉显示要求时，Subsystem 仍保留真实 Portal 数据并可正常传送；删除视觉节点不代表 Portal 业务生命周期结束。场景关闭时停止图像读取，旧节点异步回调取消或忽略。

### 7.4 OpenMS Portal 参考和能力差异

固定 OpenMS 的 [portal-presentation.js](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-presentation.js) 明确将可见 Portal 的 Artwork 与 Portal Travel Gate 解耦：type 10/11 的可见性变化使用 portalStart → portalContinue → portalExit → hidden，分别涉及单次与循环动作；Portal 选择区域由独立业务侧条件判断。[docs/ingame-portals.md](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/docs/ingame-portals.md) 记录 type 2/4/7 的 pv 循环及 type 10/11 的 ph/psh 特例。

**当前设计 仅支持 phase=static，是本阶段的有意缩小范围，不等于已复现上述原版 Portal 视觉。** 如果三图目标出现需要 pv/ph/psh 动作的可见 Portal，不能用一帧图像宣称完整呈现：应先补充 Portal Visual 扩展 Clip/phase 状态机、Clock 以及 CMS079 兼容证据，或明确将该地图视觉项目标记为尚未完成。Portal **Gameplay 功能**仍不应等待视觉动画完成。

### 7.5 专项验证

同一地图可见/不可见 Portal 的 Gameplay 等价；视觉在 Actor 前后的真实深度验证；合成图片错误与旧节点 资源晚到；无 Portal Visual 时完整传送；动画 phase 数据被明确拒绝而不是假装实现。

