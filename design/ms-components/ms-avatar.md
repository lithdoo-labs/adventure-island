# ms-avatar — 纸娃娃角色呈现组件设计 V1
> **契约维护：不做组件 ABI / Schema 版本管理。** 后续字段与行为调整直接修订本组件文档和实现，不引入 `formatVersion`、`schemaVersion`、兼容分支或迁移。文中“V1”仅用于识别当前历史设计基线，不是运行时版本字段。`ResourceRef.contentVersion` 仍是 LoomRealm Content API 要求的资源内容身份。


> **设计状态：可审查候选基线；未批准、未冻结、非现行规范。** 本文保留当前字段、状态机、数据所有权、父子协作和失败语义作为讨论基线；不宣称它们已成为产品级公共 API。  
> **实现状态：未实现。** 新组件尚无实现；CMS079 样本、真实 WebProjector 集成、像素与性能验收仍待执行。本文中的 Renderer 内部批次能力属于待核验集成提案，不是固定 LoomRealm commit 已提供的 API。  
> 组件：**ms-avatar**；动作数据子组件：[ms-action](./ms-action.md)。旧 **cms-actor** 仅作为迁移和算法参考，不是新组件 ABI。

> **首阶段集成指引（非规范）：** 在 [Field 组件树草案](./FIELD-COMPONENT-TREE-DRAFT.md) 中，本组件作为 `ms-world-item` 的直接子视觉组件，其外层世界位置和 stack-rank 不进入此处的 Avatar V1 attrs。该链接仅解释现阶段场景组合，不修改本 V1 的字段、时钟、纸娃娃算法或未解决的 ProjectionBatch 提案。
> **内容来源边界：** `avatar.Part/PartFrame/Resource/DrawOrder/LayerSlot` 见 [FSDB 内容模型](../content/FSDB-CONTENT-MODEL.md)；Adapter 解析选择、redirect、origin/anchors、zOrder 和 slot metadata，本组件根据这些 render-ready 数据执行局部布局、遮挡与绘制，不直接查询 FSDB。OpenMS Avatar composition 只作为 [开发参考](../references/OPENMS-DEVELOPMENT-REFERENCE.md)。

## 1. 目标、职责与非目标

**ms-avatar** 是 Renderer 内的局部纸娃娃呈现器。它消费已经解析、验证、可绘制的角色外观数据和动作 Clip，维护本地视觉播放状态，并将当前身体帧、表情和装备合成为完整画面。

| 所属层 | 职责 |
| --- | --- |
| Subsystem / Field Runtime | 持有角色、装备、战斗和 Simulation Clock 权威状态；决定当前基础 Action、朝向、表情及业务切换时机 |
| 游戏侧 Adapter | 解析 CMS079 源数据；解析 UOL/alias、帧时序、插槽遮挡和部件几何；生成父级共享数据及每个 Action 的 render-ready Clip；构建真实图集 |
| ms-avatar | 校验共享数据和父子组合；索引 ms-action；维护 Animation Player；统一读取、解码和缓存图集；布局、遮挡、变换并绘制 |
| ms-action | 保存并验证单个动作 Clip；向父 Avatar 通知自身定义变化；不播放、不下载、不绘制 |
| 场景 / World Renderer | 管理世界坐标、角色与地图对象的深度排序、Camera、场景批次及最终屏幕变换 |

明确不属于 ms-avatar：输入、物理、跳跃/攀爬判定、技能命中、伤害、冷却、装备合法性、Portal、地图、Camera 决策、世界深度排序、技能粒子及受击者效果。

纸娃娃内部的 zOrder / slot occlusion 与场景世界深度是两套独立规则。ms-avatar 只负责角色局部坐标系内的合成。

## 2. LoomRealm 边界与 RenderNode 形状

ms-avatar 和 ms-action 候选节点使用 LoomRealm 上游 RenderNode 五字段：**key / tag / attrs / data / children**。这是平台传输形状，不等同于旧项目级 [cms-* ABI](../../components/RENDER-NODE-ABI-V1.md)。本候选不增加 LoomRealm RenderNode、Render Update 或 RenderEvent 公共字段。

ms-avatar 节点形状：

~~~json
{
  "key": "avatar:player",
  "tag": "ms-avatar",
  "attrs": {
    "action": "walk1",
    "facing": "right",
    "expression": "default",
    "one-shot-enabled": "true"
  },
  "data": {
    "appearance": {
      "zOrder": ["weapon", "hair", "face", "head", "body"]
    },
    "sprites": {
      "pages": {},
      "items": {}
    },
    "expressions": {
      "default": {
        "frames": [
          { "durationMs": 0, "layers": [] }
        ]
      }
    }
  },
  "children": []
}
~~~

直接子节点只能是 ms-action。纸娃娃内部的身体、头、脸、头发和装备层不是 RenderNode，不各自建立 DOM 节点。

### 2.1 attrs 闭集

V1 只接受以下四个 retained 字符串属性。属性值不做大小写折叠、trim 或隐式类型转换。

| 属性 | 规则 | 缺省行为 |
| --- | --- | --- |
| action | 必需的非空 Action 名；精确匹配直接子节点 attrs.name | 无缺省。投影完成后仍缺失则 ACTION_MISSING，不猜测 stand1 |
| facing | left 或 right | right |
| expression | 非空表情名，精确匹配父级 data.expressions | default；父数据必须包含 default |
| one-shot-enabled | 只能是字符串 true 或 false | true |

- Action 名和表情名均按区分大小写的精确字符串比较，不做别名猜测。
- 非法朝向、布尔字符串、空名称或未知 attrs 属于 INPUT_INVALID；不擅自转换成合法值。
- skin / face / hair / equips 等原始业务选择不进入 attrs，由 Adapter 转成共享外观和 Clip。
- 世界 x/y、世界深度不进入 Avatar attrs，由场景持有。

### 2.2 action RenderEvent

一次性攻击或技能呈现使用现有 transient RenderEvent：

~~~json
{
  "name": "action",
  "data": { "action": "brandish1" }
}
~~~

事件数据闭集为一个非空 action 字符串。事件只作用于当前精确目标 Avatar；它不是业务技能成功、命中或冷却的证明。Avatar 不调用 outgoing `emitCustomEvent()`；播放或绘制完成不向 Subsystem 回报。

- 每次有效 Event 都从第 0 帧启动一次性覆盖；同名 Event 也重启。
- 新 Event 替换当前 one-shot；one-shot-enabled=false 优先级最高，禁用期间忽略 Event。
- 目标 Clip 缺失、无效、重名或不能与当前共享外观组成有效组合时，立即丢弃 Event，不缓存、不等待后续 replace 补播；无效 Event 不得打断当前正在播放的有效 one-shot。只有通过校验的新 Event 才替换当前 one-shot。
- Clip 有效但图片未下载/解码时，Event 仍在 Renderer 接收时开始计时；图片就绪时只绘制届时的当前帧。
- Event 是 transient、可能丢失且不重放。新建组件实例只从 retained 状态恢复基础 Action，不恢复旧 one-shot。
- 不增加 action-seq、action.cancel 或 retained 技能状态。

## 3. 父级共享 data

ms-avatar.data 的顶层字段闭集为 **appearance / sprites / expressions**。未知顶层字段或缺失必需字段均拒绝该份父数据；组件 data 不携带 Schema 版本字段。

~~~ts
type Point = [number, number];

interface AvatarData {
  appearance: {
    // 前景 → 背景；必须非空、无重复
    zOrder: string[];
  };

  sprites: {
    pages: Record<string, {
      resource: {
        namespace: string;
        key: string;
        contentVersion: string;
      };
      width: number;
      height: number;
    }>;

    items: Record<string, {
      page: string;
      source: { x: number; y: number; w: number; h: number };
    }>;
  };

  expressions: Record<string, {
    frames: Array<{
      durationMs: number;
      layers: Layer[];
    }>;
  }>;
}
~~~

表达式帧复用 ms-action.md 定义的 Layer 几何与资源引用字段；表达式 Layer 使用身体帧建立的锚点表，不创建新的身体锚点。

### 3.1 appearance

V1 的 appearance 只包含共享 zOrder。它是 Adapter 从当前角色外观解析出的角色内部绘制层序，顺序为**前景到背景**；Painter 反向绘制，即背景先画、前景后画。

- zOrder 必须非空、名称唯一。
- 每个身体或表情 Layer 的 z 必须精确出现在当前父级 zOrder。
- V1 不在父级重复存放完整动作表、每帧几何或业务装备 ID。
- 影响当前 Clip 兼容性的共享外观变化必须与受影响 Clip 在同一 Domain 的同一次提交发布，见第 8 节。

### 3.2 sprites：图集页与逻辑小图索引

图片资源由父级共享目录表达，不在 Action Clip 或 Expression Clip 中重复 Content 身份。

- pages 的每个条目代表一张**真实合成的图集页**，包含完整 Content 资源身份及解码后预期的整页宽高。
- items 的每个条目代表一个逻辑小图，指向一个 page 和页内 source 裁剪矩形。小图宽高由 source.w/h 得出，不另存重复尺寸。
- page.width/height 必须是正整数。source.x/y 是非负整数；source.w/h 是正整数；矩形必须落在声明的页面尺寸内，解码后还要再次检查实际边界。
- resource.contentVersion 使用 LoomRealm Content 返回的精确内容身份，格式为 sha256: 加 64 位小写十六进制字符；这是平台资源读取要求，不是组件 Schema 版本。namespace、key 必须是合法 Content 身份。
- 同一页可以被多个动作、多个帧及表情重复引用；缓存按完整资源身份去重。
- V1 图集打包**不旋转小图、不裁掉透明边缘、不做 trim**。图集坐标只影响 source，不改变小图逻辑尺寸、origin 或 anchors。
- 要绘制整张页面时也使用完整页对应的 sprite item，例如 source={x:0,y:0,w:page.width,h:page.height}；Clip 不直接携带原始图片 URL 或 PNG 字节。

### 3.3 expressions：独立表情时间轴

每个表情由父级 expressions[name].frames 定义。帧结构使用与 Action 相同的 durationMs 和 Layer 语义；表情帧按顺序循环。单帧且 durationMs=0 表示静态表情；多帧循环总时长必须大于零。

- default 是必需表情，可用一个空 Layer 的静态帧表达无额外面部覆盖。
- 表情 Layer 通常是脸及随表情移动的脸饰；它们使用当前身体帧已经建立的锚点，不另建身体锚点表。
- 表情只从父级共享 sprites 目录解析资源。
- attrs.expression 名称改变时表情相位归零；同名重复投影不重启。
- 同名表情定义更新保留已累计的 expressionElapsedMs，按新帧表重新定位。
- 未知表情只隐藏表情层并产生 EXPRESSION_MISSING；不因此拒绝有效身体 Action，也不自动改成其他业务表情。

## 4. Action 子节点与发布规则

每个当前外观可触发的基础动作、攻击和技能动作对应一个独立 ms-action 子节点。动作定义应在 Event 到达前发布；Event 不负责创建或加载子节点。

- 同一 Avatar 下 attrs.name 必须唯一。重名时仅冲突名称不可用，不能按 DOM 顺序选第一个。
- 动作名是逻辑身份；RenderNode key 是节点身份。改名必须删除旧节点并用 fresh key 创建新节点，不能在同一个 live key 上改 attrs.name。
- 已存在子节点的 Clip 可用 RenderDomain.update() 更新该子节点的顶层 data.clip。
- 新增、删除、重排或改名子节点必须用一次 RenderDomain.replace() 提交完整新树。
- 初始 Snapshot 和 replace() 仍携带完整当前树；子节点拆分不等于流式按需传输。
- data.set 只能替换 data 顶层成员；receiveRenderData() 收到完整当前 data。不能把嵌套 clip.frames 当成 LoomRealm 原生嵌套 Patch。
- 不同 Domain 或连续多个 Domain commit 之间不提供换装事务原子性。

详细子节点契约见 [ms-action.md](./ms-action.md)。

## 5. Animation Player：播放状态机

ms-avatar 内部只有一个 Animation Player，分别维护基础身体 Action、one-shot 覆盖和表情时间轴。它只维护视觉播放状态，不向 Subsystem 写回业务状态。

### 5.1 基础 Action

- attrs.action 名称实际变化时，选择新基础 Action，并将其 elapsedMs 置零。
- 同名属性重复投影不重启。
- 没有有效 Clip 时仍保留请求；只要选定 Render Clock 正常推进且该基础 Action 未被 one-shot 覆盖，elapsedMs 继续累计。Clip 恢复后直接 seek 当前累计时间，不重播、不补画。
- Clip 为 loop 时整段循环；hold 播至末帧后保持；suffix-loop 首轮播放完整帧序列，之后只循环 repeatFrom 至末帧的后缀。
- 基础动作自然到达 hold 末帧只是本地视觉状态，不发送完成 Event，不自动改选其他 Action。

### 5.2 one-shot 覆盖

one-shot 的播放入口是 action RenderEvent。运行时覆盖模式固定为 once，不改变 Clip 保存的基础播放模式。

- once 从第 0 帧依序播放每帧一次，走完整个帧数组后结束。对 loop 和 suffix-loop Clip，one-shot 只走完整数组一遍，不进入循环；对 hold Clip 也只走一遍，不永久停留。
- one-shot 的时间起点是 Renderer 接受 Event 的时刻，不推断 Subsystem 或服务器的精确开始时刻。
- one-shot 期间基础 Action 的 elapsedMs **冻结**；表情时间轴继续推进。
- one-shot 自然结束后回到当时最新的 retained attrs.action。
- 若 one-shot 期间基础 Action 名称从 A 改为 B，one-shot 不被打断；结束后 B 从 0ms 开始。若 A→B→A，仍视为发生过改选，回到 A 时也从 0ms 开始。实现必须保留“覆盖期间基础选择曾变化”的 sticky 标记，不能只比较结束时名称。
- 若覆盖期间基础名称始终不变，结束后恢复原基础 elapsedMs。
- 新 action Event 替换当前 one-shot，并从零开始；即使名称相同也重播。
- one-shot-enabled=false 立即取消当前 one-shot，禁止后续 Event，恢复最新基础 Action。恢复为 true 只重新开放入口，不补播已取消或丢失的 Event。
- false 是持续许可状态，不是瞬时取消脉冲。若 false → true 被 retained 更新合并，Renderer 只观察到最终 true，不承诺取消发生过。

### 5.3 Clip 更新、删除和缺失

| 变化 | 基础 Action | 当前 one-shot |
| --- | --- | --- |
| 同名 Clip 收到新有效定义 | 保留 elapsedMs，按新 Clip 重新 seek | 保留该次 elapsedMs，按新 Clip 的 once 时间轴 seek |
| 新 Clip 总时长缩短，one-shot 已到期 | 不适用 | 立即结束，回到最新基础 Action |
| 当前 one-shot 子节点删除或 Clip 无效 | 不影响 retained 基础请求 | 立即取消，不排队补播 |
| 基础 Clip 删除或暂时无效 | 保留名称和时间；定义恢复后 seek | one-shot 覆盖期间基础时间仍冻结 |
| 非当前 Clip 更新 | 不重启、不改变当前相位 | 不改变当前播放 |
| 基础 attrs.action 名称变化 | 新名称从零开始 | 只更新待恢复基础选择，不打断 one-shot |

Clip 缺失不等于 Clock 暂停。基础动作在未被 one-shot 覆盖时继续累计本应经过的时间；同一 Avatar 实例 DOM 断连或所选 Clock 显式暂停时才冻结。

### 5.4 表情时间轴

- 身体基础动作、one-shot 和表情各自定位帧。
- one-shot 不暂停表情。
- 身体帧 showFace=false 只隐藏当前表情层，不暂停、不重启表情 Player；重新显示时使用当下表情帧。
- Render Clock 显式暂停和同实例 DOM 断连会同时冻结身体及表情时间。
- 表情定义缺失或图片未就绪不改变业务表情选择。

### 5.5 帧定位规则

所有时间均为毫秒。Animation Player 通过累计时间直接求当前帧，不逐帧追赶：

- loop：按全帧总时长取模定位。
- hold：超过全帧总时长后固定在最后一帧。
- suffix-loop：首轮按完整帧序列定位；首轮结束后以 repeatFrom 对应的累计时间为起点，只对后缀总时长取模。
- once：按完整帧序列定位；累计时间达到总时长即结束。
- 零时长帧在时间定位时跳过；loop 的全段总时长及 suffix-loop 的循环后缀总时长必须大于零。hold 可为零总时长，此时立即显示末帧；全零时长 one-shot 立即结束。
- 大 delta 只进行一次数学定位，不循环补画遗漏帧。

## 6. Render Clock 与 DOM 生命周期

Simulation Clock 归 Subsystem；Render Clock 只推进视觉时间，不参与物理、技能或服务器时间判定。

### 6.1 Provider 契约

V1 采用最近祖先 Provider 优先，没有有效祖先时使用 Avatar 自带的本地 Render Clock。祖先查找沿 composed tree 进行，支持跨 ShadowRoot host 链；只在连接、重挂、祖先变化或 Provider 失效时重新查找，不逐帧递归查找。

~~~ts
interface RenderClock {
  subscribe(listener: (deltaMs: number) => void): () => void;
}

interface RenderClockProvider {
  getRenderClock(): RenderClock;
  subscribeRenderClockInvalidated(listener: () => void): () => void;
}
~~~

- 有效 Provider 在其生命周期内每次 getRenderClock() 必须返回同一个对象身份。
- deltaMs 必须是有限、非负的毫秒数，表示上次有效 tick 以来未暂停的实际经过时间；不能用固定 16ms 代替真实间隔。
- Provider 暂停时可以停止 tick，但仍然有效；Avatar 必须继续绑定该 Provider，不能启用本地 Clock 绕过暂停。
- Provider 真正失效必须发出 invalidated 通知；Avatar 取消旧订阅，重新寻找最近 Provider，没有则回退本地 Clock。
- 切换 Clock 只重置采样基准，保留 Action、one-shot 和表情的累计相位；不得相减不同 Clock 的绝对时间。
- 未显式暂停时，后台 RAF 停调、掉帧或资源等待不构成暂停。下次 tick 按完整实际 delta 定位当前帧，不补画。
- Simulation 暂停若需要同步暂停画面，必须由 Adapter/场景显式作用于 Render Clock；Avatar 不猜测。

### 6.2 DOM 生命周期

| 场景 | 规则 |
| --- | --- |
| 同一元素从一个父节点移动到另一个父节点 | 解绑旧 Clock，重新寻找最近 Provider；保留所有播放相位 |
| 同一元素暂时断连 | 停止 tick 和绘制、冻结相位、使在途 paint 失效；清理不再需要的资源读取/租约 |
| 同一元素重新连接 | 重新绑定 Clock，从冻结相位继续；不重播基础 Action 或旧 one-shot |
| 断连期间收到新的 retained 数据 | 重连时使用最新 attrs/data；one-shot-enabled=false 仍优先取消覆盖 |
| Renderer 销毁旧实例并创建新实例 | 只根据 retained 状态建立基础 Action；不恢复 transient one-shot |
| 实例最终释放 | 解除订阅、释放资源租约、丢弃本地 Player 状态 |

同一实例断连期间的墙钟时间不计入动画；已连接但浏览器后台或掉帧的时间，在 Clock 未显式暂停时仍计入。

## 7. 纸娃娃布局、遮挡与变换

Layer 的字段定义见 [ms-action.md](./ms-action.md)。本节固定 Painter 的解释顺序。

### 7.1 锚点布局

- Action 帧的 Layer 数组按**锚点依赖顺序**排列，通常为 body → head → face/hair → attached equipment；它不是最终 z 绘制顺序。
- 第一层作为根部件，以 Avatar 局部身体原点放置，并建立初始锚点表。
- 后续 Layer 有锚点时，按固定优先级寻找其本地锚点与已建立锚点表的第一个共同名称：navel → neck → hand → brow → handMove。将两点重合，计算该层原点。
- 只登记尚不存在的锚点，不覆盖先前建立的同名锚点。
- Layer 没有 anchors 时放在身体原点；Layer 声明了 anchors 但没有任何可匹配锚点时跳过该 Layer，并报告 LAYER_ANCHOR_MISSING，不猜测位置。
- Layer 的 origin 是小图内部与计算出的部件原点对齐的像素坐标；anchors 是相对该 origin 的局部向量。图集裁剪不改变它们。
- Expression Layer 使用当前身体帧建立的锚点表；不发布新锚点，也不另起一套身体布局。

### 7.2 zOrder 与 slot occlusion

- 先完成锚点布局，再执行 slot occlusion，最后按父级 zOrder 绘制。
- zOrder 为前景到背景；背景先画、前景后画。相同 z 的 Layer 保持输入数组顺序，较早项在后、较晚项在前。
- Layer 的 priority 与 tag 必须同时存在或同时缺省。它们是 Adapter 已解析的遮挡事实，不是 Renderer 反向解析 WZ 的入口。
- 参与遮挡的 Layer 按确定的绘制顺序逐层处理 slot token：更高 priority 可替换较低 priority 的 token 所有者；相同 priority 共存；某 Layer 在任一 token 上输掉时整层隐藏，已先占用的其他 token 不回滚。z 为 face 的 Layer 不参与该 slot 遮挡遍历。
- 需要 slot 遮挡的 CMS079 部件若缺少 islot/vslot/zmap/smap 元数据，Adapter 必须拒绝生成 Clip；不得省略遮挡字段来退化为全画。

### 7.3 变换顺序

每帧变换作用于整套身体合成：

1. 以当前身体局部原点为基准应用 frame move；只作用当前帧，不累计。
2. 完成锚点布局。
3. 按 frame rotate 绕身体原点顺时针旋转；V1 只接受 0°、90°、180°、270°。
4. facing=left 与 frame flip 做 XOR；结果为真时绕身体原点水平镜像整套合成，位置和像素内容同时镜像。
5. 表情 Layer 与身体使用同一套最终变换。

## 8. 换装一致性与 Renderer 投影完成门闩

**Render Store 原子提交不等于 Web Component 回调原子完成。** 这是 V1 的硬约束。

一次换装是一个逻辑外观事务。Adapter 必须先准备并验证最终父级共享数据和所有受影响 Clip，再通过同一 Domain 的一次原子提交发布：

| 变化 | 发布方式 |
| --- | --- |
| 单个动作定义独立修订，且不改变共享外观兼容关系 | 一次 RenderDomain.update() 更新对应子节点 data.clip |
| 换装且子节点集合不变 | 一次 RenderDomain.update() 同时更新父级相关 data 顶层成员、所有受影响子 Clip 及必要 attrs |
| 换装涉及子节点新增/删除/重排 | 一次 RenderDomain.replace() 发布完整新树 |
| 换装同时改变基础 Action 或 one-shot 许可 | 与父子外观数据放入同一次提交 |

不支持跨多个 Domain 或多次提交逐步换装。未修改的 Clip 也必须重新验证与新父级 sprites/zOrder 的兼容性。

### 8.1 必需的 Renderer 内部投影批次接口

当前 LoomRealm WebProjector 对父子元素分别尝试投递 data；结构、attrs 和各元素 data 的处理顺序虽在一次同步 reconcile 中完成，但没有向 Avatar 暴露“本轮整个子树投影已完成且相关交付成功”的信号。receiveRenderData() 抛错会被宿主报告，但不会自动重试。仅延迟一个 microtask 不能证明事务完成。

V1 要求增加**仅 Renderer 内部使用**的投影批次通知，不增加 RenderNode 或 RenderEvent 公共字段：

~~~ts
interface RenderProjectionBatchResult {
  batchId: number;
  status: "complete" | "failed";
}

interface RenderProjectionBatchReceiver {
  beginRenderProjectionBatch(batchId: number): void;
  endRenderProjectionBatch(result: RenderProjectionBatchResult): void;
}
~~~

宿主要求：

1. 对受影响的每个 ms-avatar，在修改其 managed subtree 的结构、attrs、data 之前同步调用 begin。
2. 完成本轮该 Avatar 子树的结构/attrs/data delivery attempts 后调用 end。
3. 若该子树任何必要的结构投影、context/data callback attempt 失败，结束状态为 failed；状态按 Avatar 子树隔离，不让无关 Avatar 的错误污染本 Avatar。
4. Avatar 在批次打开期间不得绘制、提交像素或接纳依赖该批次的 Action Event。
5. 收到 complete 后，Avatar 同步读取当前父 data 与当前直接子节点 Clip 快照，运行组合 Validator；只有最终组合有效才关闭门闩并请求绘制。
6. 收到 failed 时清除当前可能过期的画面、报告 PROJECTION_FAILED，拒绝该批次内的 Action Event；后续成功批次可恢复。
7. Event 投递必须发生在前置投影批次结束之后；批次失败时 Event 丢弃，不缓存。

这是 LoomRealm WebProjector/宿主的**内部集成要求**，不是已存在的能力。实现阶段必须在 LoomRealm 中落地并用真实浏览器测试；若不实现该门闩，就不能宣称 V1 换装一致性已经实现。不得用 appearance-version 或 Content contentVersion 冒充投影完成证明。

### 8.2 首次挂载与局部就绪

- connectedCallback() 不是 attrs、children、data 全部就绪通知。
- Avatar 不等待全部 Action 子节点，只等待共享父 data 有效以及当前需要的基础 Action Clip 有效、唯一且兼容。
- 其他未使用动作缺失或无效不阻塞当前动作。
- 当前基础 Clip 暂缺时保留 retained 请求并继续累计本应经过的时间；恢复后 seek。
- Action Event 目标 Clip 必须在事件到达时已有效；缺失即丢弃。
- Clip 有效与图集像素已解码是两件事。像素未就绪不阻塞 Player 时间。

## 9. 图片资源、缓存与完整帧提交

### 9.1 资源读取和验证

ms-avatar 是身体 Action、表情和装备图片的唯一逻辑资源所有者。它通过 LoomRealm Presentation Resource Client 按 namespace / key / contentVersion 读取完整图集页。

- 返回的 contentVersion 必须与请求完全一致。
- MIME essence 必须属于 image/*。
- 解码后的整页宽高必须等于父 data 声明的 page 宽高。
- 每个 sprite source 都要针对实际解码页面重新验证边界。
- 同一资源身份跨父 data/Clip 的页面尺寸声明必须一致；冲突拒绝，不拉伸、不跨版本复用。
- 多个动作/表情引用同一页只读取、解码一次；Clip 不持有 PNG 或独立图片缓存。

### 9.2 缓存生命周期

内部模块分工固定为：

| 模块 | 职责 |
| --- | --- |
| AnimationPlayer | Action/one-shot/Expression 时间轴与状态转换；不依赖网络或 Canvas |
| AvatarPainter | 消费已验证的组合和当前帧；布局、遮挡、变换、Canvas 完整帧提交 |
| AvatarResourceCache | 按完整 Content 身份共享整页读取/解码；并发、取消、pin/unpin、LRU 和释放 |

- 资源缓存至少在一个 Avatar 的全部 Action/Expression 间共享；实现可进一步使用 Renderer 级共享缓存，但不能削弱租约隔离。
- 在途读取可用 AbortController 取消；已经启动的 createImageBitmap() 不假定可以立即取消。
- 进入解码队列前、取得解码槽位后、解码完成后均检查条目身份、abort 状态和当前引用状态；已过期的排队任务不得启动。
- 解码并发必须有界；等待队列必须可取消。并发值由运行配置给出。
- 绘制期间 pin 资源；唯一释放路径使用 try/finally unpin。缓存只逐出未 pin 条目。
- 同一绘制轮次中的异常、取消、过期和成功共用释放路径，不漏释放、不重复释放。
- 缓存按整页记录实际解码尺寸和估算字节；容量上限是有限配置，不能把“LRU 条目数”误称为字节预算。

### 9.3 异步绘制和完整帧提交

- Player 时间推进不能等待网络、图片解码或 Canvas 绘制 Promise。
- 每次父 data、活动 Clip、表情或实例生命周期变化都会使旧 paint epoch 失效。
- 资源返回时重新读取当前 Player 状态，绘制当下帧；旧异步请求不得提交它最初捕获的过期帧。
- 一帧的全部可见 Layer 资源就绪后才提交完整合成；不得先画身体、再迟到补画武器/头发造成半套外观。
- 同一有效组合内的新帧像素尚未就绪时，可保留上一张完整提交帧，直到当前帧完整可画；若父子组合无效或外观/Clip 身份已变化，必须清除旧画面，不能把旧装备显示成新状态。
- 同一同步任务内的多次属性、data、Event 更新可合并为一次 paint request；合并不改变 Player 时间。
- Canvas 尺寸/DPR 未变化时复用画布并显式清理；避免重复赋相同 width/height 导致清空状态。设备像素尺寸变化时才重新分配。
- 初版使用 Shadow DOM 内部 Canvas；Canvas 不属于 RenderNode 公共输出 ABI。将来是否接入共享 Canvas、PixiJS 或 WebGL 由场景实现决定。

## 10. Validator、诊断与失败策略

验证分为三个层次：

1. **Avatar Data Validator**：验证父级字段闭集、版本、zOrder 唯一性、page/item 引用、资源身份、source 矩形及表达式结构。
2. **Action Clip Validator**：由 ms-action 验证 Clip 字段闭集、版本、播放模式、帧/Layer、时间值和局部容量。
3. **Composition Validator**：绘制或接纳 Event 前验证当前父数据、目标 Clip、sprite 引用、zOrder、DOM 直接父子关系及投影批次结果；资源解码后再验证实际 MIME/尺寸/source 边界。

V1 诊断码：

| 诊断码 | 含义 | 行为 |
| --- | --- | --- |
| NOT_READY | 当前父数据或所需 Clip 尚未完成投影 | 不绘制；保留基础请求和时间规则 |
| PROJECTION_FAILED | Renderer 投影批次内必要操作失败 | 清除旧画面，拒绝该批次 Event |
| INPUT_INVALID | attrs 非法或未知 | 不猜测默认业务输入 |
| ACTION_MISSING | 基础 Action 或 Event 目标不存在 | 基础保留请求；Event 丢弃 |
| ACTION_INVALID | Clip Schema 无效 | 该 Action 不可用，不沿用旧 Clip |
| DUPLICATE_ACTION | 同名直接子节点冲突 | 仅冲突名称不可用 |
| EXPRESSION_MISSING | 表情名不存在 | 隐藏表情层，身体 Action 仍可用 |
| APPEARANCE_INVALID | 父子组合、sprite/zOrder 引用或几何依赖不一致 | fail closed，清除失效组合像素 |
| PIXELS_PENDING | Clip 有效，图片尚未就绪 | 时间继续；不画半帧 |
| CONTENT_INVALID | MIME、尺寸、source 或资源内容无效 | 拒绝资源 |
| CONTENT_CONFLICT | 同一资源身份版本/尺寸声明冲突 | 拒绝冲突资源，不回退旧版本 |
| RESOURCE_LIMIT | 数据、解码或 Canvas 超出配置预算 | 拒绝超限工作并报告预算项 |
| LAYER_ANCHOR_MISSING | 声明锚点但无法匹配 | 跳过该 Layer，报告 layer id 和所需锚点 |

诊断至少包含 Avatar key、阶段、Action/Expression 名（如适用）、字段路径或 Layer id；资源错误还包含 namespace/key/contentVersion 及预期/实际摘要。相同持续错误应去重，不按每帧刷屏。

无效组合不能继续显示旧像素冒充新状态；渲染错误不得改变 Subsystem 的业务动作、技能或冷却。

## 11. CMS079 Adapter 责任

Renderer 不读取 WZ、不解析 UOL、不推导装备规则。Adapter 是唯一源格式边界。

- Adapter 解析 islot / vslot / zmap / smap，生成 Layer 的 priority/tag 和父级 zOrder。
- 参与遮挡的部件必须提供完整 slot metadata。缺少元数据、奇数长度 slot 字符串、缺失 zmap 槽位、非整数 zmap 值或缺失对应 smap 项时拒绝生成 Clip，不回退为全画。
- priority 由部件 islot 槽位在 zmap 中的最大整数顺序导出；tag 是部件 vslot 与当前 z 层 smap 槽位的有序交集，保持 vslot 原顺序。
- Adapter 负责解析 UOL/alias、源帧引用、repeat 和动作帧顺序，输出确定的 frames 和 durationMs。
- 负 delay、缺失 delay 或未知 repeat 的语义必须以真实 CMS079 样本为依据。不得对所有负 delay 直接取绝对值，不得把缺失值猜成固定时长；不能可靠转换就拒绝该动作并给出源路径诊断。
- 图集构建必须真正合并 PNG 像素并生成 page/item manifest。PWA installation bundle 把多个文件装进同一包不等于图集。
- Adapter 的输出不携带 WZ 私有路径、原始 slot metadata 字符串或 PNG 字节。

## 12. 容量与运行配置

设计要求所有可增长工作都有有限预算，但不把未经 CMS079 测量的数字伪装成 ABI 常量。

实施配置必须分别约束：

- 单个 Avatar data 与单个 Clip 的 compact JSON UTF-8 字节；
- 每 Avatar Action 数、每 Clip 帧数、每帧 Layer 数、每 Layer 锚点数；
- page 宽高、单页解码字节、全缓存解码预算、并发解码数和可取消等待队列；
- 合成 Canvas 的 DPR、设备像素边长和总像素；
- 字符串 UTF-8 长度、坐标绝对值及 source 矩形范围。

JSON 字节测量使用有界计数器，超过预算即停止，不先构造无界序列化字符串。缓存字节按解码页面估算，不把小图 source 尺寸误当整页内存。活动 pin 资源不可逐出；超出活动资源预算时明确报告 RESOURCE_LIMIT。

上述配置数值由 V01/V03 的真实 CMS079 数据、目标浏览器内存和首帧成本确定。不得直接继承旧 cms-actor 的 32 Action / 256 KiB，也不得照搬 OpenMS GMS083 的动作数量。

## 13. 实施验收与迁移门槛

设计已收口；以下是实现验收，不是尚未决定的产品行为。

| ID | 验收范围 | 必须通过的内容 |
| --- | --- | --- |
| V01 | CMS079 数据与 Adapter | 代表性外观/动作/装备/表情；UOL/alias；正、零、负、缺失 delay；repeat 边界；islot/vslot/zmap/smap；真实 atlas 生成与 source 映射 |
| V02 | WebProjector / 浏览器集成 | 投影批次门闩；父子 data 回调交错；首挂空壳；紧邻 Action Event；换装同次提交；replace 增删/迁移；投影失败；慢资源与过期 paint |
| V03 | 像素、性能和资源生命周期 | 锚点、zOrder、slot occlusion、rotate/flip、表情、atlas 裁剪像素等价；请求数、解码峰值、缓存命中、首帧时间、Canvas 上限及清理 |
| V04 | 旧组件迁移 | 新标签和 Adapter 并行接入；V01–V03 通过后迁移调用方；旧 cms-actor 与旧 ABI 不就地改写 |

验收通过前，不得宣称 CMS079 全面兼容、像素等价、容量达标或迁移完成。

## 14. 明确不做的 V1 扩展

- 不添加 action-seq、Action completion Event 或跨新实例 one-shot 恢复。
- 不支持跨 Domain/跨多个提交的分阶段换装事务。
- 不让 ms-action 持有 Clock、Canvas、网络请求或图片缓存。
- 不让 Renderer 解析 WZ 或决定业务动作优先级。
- 不在 V1 冻结 World Renderer、共享 Canvas、PixiJS/WebGL 或场景深度 ABI。
- 不把旧 AvatarPlanV1 直接当作新父子 RenderNode ABI。

## 15. 参考依据

- [旧 cms-actor 实施说明](../../components/cms-actor/IMPLEMENTATION.md)
- [旧 cms-actor Avatar Model](../../components/cms-actor/src/avatar-model.mjs)
- [旧 cms-* RenderNode ABI v1（仅历史比较）](../../components/RENDER-NODE-ABI-V1.md)
- [LoomRealm Render Update v1](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/render-update-v1.md)
- [LoomRealm Web Presentation API v1](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/web-presentation-api-v1.md)
- [LoomRealm WebProjector implementation](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/packages/renderer/src/internal/web-projector.ts)
- [OpenMS Avatar Visuals](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/avatar-visuals.js)
- [OpenMS Avatar Composition](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/avatar-composition.js)
- [OpenMS Animation Timing](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation-timing.js)
- [OpenMS EntityAnimation](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js)

**当前状态声明：** 本文是 ms-avatar 的可审查设计候选，不是已批准或冻结的规范。本文描述的字段与行为在本次清理中未被重定义；实现、Renderer 内部投影批次、CMS079 事实验证和性能验收仍未完成，必须按 V01–V04 留痕，不得把设计审查状态写成实现通过。
