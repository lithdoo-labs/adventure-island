# LoomRealm 运行时与渲染架构

> **来源状态：LOOMREALM-CONTRACT + Adventure Island 集成说明。**
> LoomRealm 固定 Gitlink：`93648192323bf5f57996b7b54cbae641d8a53fdb`。本文只解释该提交已经存在的权威、通信和投影边界；Adventure Island 的标签与字段仍是未批准候选。

## 1. 核心模型

LoomRealm 将业务执行、共享状态、内容访问和画面呈现拆成不同权威角色：

| 角色 | 主要职责 | 不拥有 |
| --- | --- | --- |
| Main / Session | Session、Runtime、Frame、Activation、DataAuthority、失败回收 | 冒险岛具体 Movement/Portal 规则 |
| Shared State | Session 内共享的可变记录与并发控制 | DOM、Canvas、瞬时画面事件 |
| Session Events | 跨 Subsystem 的瞬时事件 | retained 业务状态 |
| Subsystem | 领域业务执行、本地权威状态、输入兴趣、RenderDomain | Renderer DOM 和私有 Canvas 状态 |
| Renderer | Render replica、输入生产、Web presentation | 业务权威、Simulation、Render tree authority |
| Content | 安装内容的只读读取能力 | 业务状态与 Renderer decoded cache 策略 |

Adventure Island 的 Field、Movement、Camera、Portal 和 Render Projection 应属于 Subsystem 业务域；画面组件属于 Renderer presentation。

## 2. 逻辑架构与物理部署

逻辑角色不要求所有平台使用同一种物理进程拓扑。

### 2.1 PWA

典型组合：

```text
Browser Window
  Renderer、WebProjector、Custom Elements、Input source
        │
        ├─ Renderer Control / Data MessagePort
        │
Session Worker
  Main、Shared State、Session Events、Runtime hosting
        │
        ├─ Control / Data / Shared State / Session Events
        │
Dedicated Subsystem Workers
  Field 等业务 Subsystem

Service Worker
  installation content / Content capability
```

### 2.2 Desktop / Hostra

典型组合：

```text
Electron BrowserWindow
  Renderer presentation
        │ WebSocket / IPC carriers
LoomRealm desktop Node process
  Main、Broker、Content service
        │ provision / lifecycle
Runner child processes
  Subsystem Runtime
```

因此“Subsystem 独立进程”应理解为业务权威和生命周期隔离；PWA 可能是 Worker，Desktop 可能是 Runner 子进程。组件文档不得依赖 PID、端口、WebSocket URL 或 MessagePort identity。

## 3. 通信平面

### 3.1 Control

Control 管理：

- Session 与 Renderer participant；
- Subsystem Runtime 生命周期；
- Frame 调用与结果；
- 哪一个 `(session, subsystemKey, generation, dataProfile)` 有权建立 Data Connection；
- terminal、replacement 和失败回收。

Control 不承载地图 Sprite、AvatarPlan 或 Paint Unit tree。

### 3.2 Renderer ⇄ Subsystem Data Connection

Data Connection 负责把一个已经由 Main 授权的 physical carrier pair 安装为唯一 current connection。

权威 identity 至少包括：

```text
Session
+ current Renderer participant
+ subsystemKey
+ generation
+ dataProfile
```

平台 Broker 负责怎样建立和绑定 carrier；应用协议不能从 PID、端口、ticket 或 Port 本身推断权威。

同 generation 的 carrier replacement 不创建新的业务世界，只重建 carrier-local baseline。新的 generation 创建新的 wire identity universe。

### 3.3 Render Update

Render Update 方向固定为：

```text
Subsystem → Renderer
```

消息类型：

| 消息 | 语义 |
| --- | --- |
| Registry / `render.domains` | 当前 wire Domain 生命周期集合 |
| Snapshot | 完整 authoritative baseline |
| Patch | 严格 `R → R+1` 的原子 retained commit |
| Event | 瞬时 presentation impulse，不修改 Store，不 replay |

Render Update 不提供 Renderer → Subsystem Render RPC，也不让 Renderer 请求临时 resync。恢复方式是 fresh carrier + Registry + 当前 Domain Snapshots。

### 3.4 其他通道

- Input 有自己的权威和 mutation gate。
- Viewport 有独立发布合同，不是 RenderNode DOM 测量回写。
- Presentation custom event 有单独路由，不等于普通游戏输入。
- Shared State 和 Session Events 不经过 Render tree。
- Content resource 通过 capability 读取，不在 RenderNode 中携带 URL、路径或 bearer。

## 4. Subsystem RenderDomain

Subsystem 通过 `RenderDomain` 发布 presentation state：

```text
createDomain(initial tree)
replace(full tree)
update(existing node attrs/data)
emit(transient event)
close()
```

### 4.1 五字段 RenderNode

LoomRealm RenderNode 固定为：

```ts
{
  key: string;
  tag: string;
  attrs: Record<string, string>;
  data: Record<string, JsonValue>;
  children: RenderNode[];
}
```

平台不解释 `ms-scene-view`、`stack-rank`、`avatarPlan` 或其他冒险岛字段。业务 schema 由 Adventure Island 自己定义和校验。

### 4.2 Identity

- `key` 在一个 Domain generation 的 wire 生命周期内是 one-shot identity。
- live node 的 `tag` 不能改变。
- 删除后的 key 不能在同一 identity universe 中重新引入。
- 相同文本 key 在不同 Session、Subsystem、Domain 或 generation 中不是同一元素。

场景替换、batch 分裂和资源 epoch 设计必须遵守这些规则。

### 4.3 replace / update / emit

`replace()`：

- 发布新的完整树；
- 用于 children、parent、order、create/delete 等 topology 变化；
- Renderer 可以保留相同 identity 的 HTMLElement，不等于全部重建。

`update()`：

- 只修改已有节点的 top-level attrs/data；
- 不能改 key、tag、children；
- nested JSON 变化通过替换对应 top-level value 表达。

`emit()`：

- 只针对当前 live target；
- transient、不可 replay；
- 不能承载需要 Snapshot 恢复的持久状态。

## 5. Renderer Store

Renderer 为每个当前 Subsystem/generation 保存只读 replica：

1. fresh carrier 先接收 Registry；
2. 每个 Domain 用 Snapshot 建立 baseline；
3. Patch 必须连续；
4. structural Patch 在隔离 candidate 上完整验证后一次提交；
5. 失败 mutation 不暴露 partial tree；
6. Event 只在 Domain 已 baseline 且 target live 时投递。

carrier 丢失后，Renderer 可以保留最后合法画面用于视觉连续性，但它只是 stale presentation cache，不是 current authority，也不能成为下一条 Patch 的 base。

## 6. WebProjector

WebProjector 是 Store 到 DOM 的机械投影器，不是第二个场景系统。

其主要顺序为：

1. 读取 current Renderer presentation view；
2. 收集每个 Domain 的目标节点；
3. 校验 Custom Element 已注册、live tag 未改变；
4. 为新节点 `document.createElement(tag)`；
5. 注入 `receiveRenderContext()`；
6. 插入、移动、重排 existing element；
7. `setAttribute()` / `removeAttribute()`；
8. 仅在 retained JSON 变化时调用 `receiveRenderData()`；
9. Render Event 调用目标元素的 `receiveRenderEvent()`。

关键约束：

- DOM 不是 Store source。
- Custom Element 不能移除、重排或 adopt LoomRealm managed Light DOM。
- Move/reparent/reorder 应移动 existing HTMLElement。
- 组件对 managed attrs/data/children/order 只读。
- DOM mutation、Canvas 像素或私有缓存永远不会反向同步进 Store。

## 7. Adventure Island 的树与视觉边界

候选逻辑树：

```text
ms-scene-view
├─ ms-map-back
├─ ms-map-batch
├─ ms-world-item
│  └─ ms-avatar
│     └─ ms-action
├─ ms-map-object
└─ ms-portal-visual
```

WebProjector 管理这些 Light DOM 节点。每个 Custom Element 自己管理 Shadow DOM、Canvas、图片和非权威视觉状态。

候选 `ms-scene-view` Shadow DOM：

```html
<div class="viewport">
  <div class="world-plane">
    <slot></slot>
  </div>
</div>
```

`slot` 只展示 managed children，不能建立另一份节点 registry。需要跨类型遮挡的 Paint Unit 应作为同一 world-plane 中可比较的同级叠放项。

## 8. 权威与更新频率

| 变化 | 权威位置 | Renderer 动作 |
| --- | --- | --- |
| Movement position | Field Subsystem | 更新 world host transform |
| Actor depth | Field Subsystem projection | 更新 `stack-rank` / sibling order |
| Camera | Field Subsystem Camera state | 更新 world-plane transform |
| locomotion / facing | Field Subsystem | 更新 Avatar 呈现选择 |
| Sprite frame phase | Renderer-local | 重绘局部 Canvas |
| equipment selection | Field/Avatar state | 发布新 render-ready appearance |
| decoded bitmap cache | Renderer-local | 读取 Content、复用、释放 |
| Portal travel | Portal/Field Subsystem | 原子替换业务场景投影 |

视觉时钟与 Simulation Clock 必须分离。Renderer 可以插值或播放帧，但不能推进权威 Movement。

## 9. 失败边界

### 协议/权威失败

- 非法 Snapshot/Patch；
- revision 不连续；
- live tag 改变；
- consumed key 重用；
- currentness/authority 不匹配。

这些问题影响 Data connection 或 Store continuity。

### Presentation-local 失败

- unknown component；
- Canvas/WebGL allocation；
- 图片解码；
- `receiveRenderData()` 异常；
- 浏览器布局或绘制失败。

这些问题不得 rollback Subsystem，也不得伪装成 Frame/Runtime 失败。产品可以选择保留 last-good、显示错误或结束 Renderer participant，但必须保持权威边界。

## 10. 当前不存在的能力

固定 LoomRealm 提交没有因为 Adventure Island 文档提到它们就自动提供：

- RenderProjectionBatch begin/end；
- 跨 Custom Element 像素 ready transaction；
- 冒险岛专用 World Renderer service；
- 全局 decoded bitmap cache；
- RenderClockProvider；
- 自动 Canvas batching；
- Scene transition gate。

这些若仍有必要，必须作为 Adventure Island 内部设计或 LoomRealm 上游提案单独审查，不能在组件文档中当作既有前提。

## 11. 固定来源

- `loom-realm/doc/10-architecture/system-overview.md`
- `loom-realm/doc/10-architecture/rendering-system.md`
- `loom-realm/doc/10-architecture/renderer-subsystem-protocol-layers.md`
- `loom-realm/doc/15-contracts/render-update-v1.md`
- `loom-realm/doc/15-contracts/renderer-subsystem-data-connection-v1.md`
- `loom-realm/packages/subsystem/src/internal/render-manager.ts`
- `loom-realm/packages/renderer/src/internal/render-store.ts`
- `loom-realm/packages/renderer/src/internal/web-projector.ts`
