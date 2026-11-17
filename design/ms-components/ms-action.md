# ms-action — Avatar 动作数据子组件设计 V1

> **设计状态：V1 设计基线已收口。** 本文是 [ms-avatar](./ms-avatar.md) 的组成契约；字段、播放规则、父子通知和更新语义均为规范性设计。  
> **实现状态：未完成。** 当前没有新 ms-action Custom Element、完整 Validator 或真实 WebProjector 集成测试。CMS079 数据与容量仍须按 ms-avatar 第 13 节验收。

## 1. 定位与职责

ms-action 是 ms-avatar 的**数据型直接子组件**。一个实例表示一个具名身体 Action，保存一份渲染就绪的 Clip。

它只负责：

- 接收自己的完整 RenderNode data；
- 验证 Clip V1 并保存当前只读快照；
- 在定义状态变化后通知当前直接父 Avatar；
- 向父 Avatar 提供同步、只读的 Clip 快照。

它不负责：

- 选择当前业务 Action 或决定技能优先级；
- 推进 Render Clock、维护帧号或 one-shot 状态；
- 读取 Content、下载/解码图片或持有图集 lease；
- 创建 Canvas、绘制或发起 RAF；
- 向 Subsystem 发业务完成/技能事件；
- 解析 WZ、UOL、alias 或 CMS079 装备规则。

**所有动作时间轴、图片资源和最终绘制权均归父 ms-avatar。**

## 2. RenderNode ABI

ms-action 必须是一个 ms-avatar 的直接子节点。V1 节点形状：

~~~json
{
  "key": "avatar:player:walk1",
  "tag": "ms-action",
  "attrs": {
    "name": "walk1"
  },
  "data": {
    "clip": {
      "formatVersion": 1,
      "playback": { "mode": "loop" },
      "frames": [
        {
          "durationMs": 100,
          "move": [0, 0],
          "rotate": 0,
          "flip": false,
          "showFace": true,
          "layers": [
            {
              "id": "body",
              "sprite": "body.walk1.0",
              "z": "body",
              "origin": [19, 32],
              "anchors": {
                "navel": [-6, -20],
                "neck": [-4, -32]
              }
            }
          ]
        }
      ]
    }
  },
  "children": []
}
~~~

### 2.1 attrs.name

- 必需、非空字符串，UTF-8 长度受组件运行配置限制。
- 区分大小写、精确匹配；不 trim、不做 Unicode 或大小写归一化、不猜测别名。
- 同一个 Avatar 下必须唯一。重名时该名称 DUPLICATE_ACTION，父级不得按 DOM 顺序任选一个；其他不冲突动作仍可用。
- name 是动作逻辑身份；RenderNode key 是节点身份。不能在同一个 live key 上改名。改名必须删除旧节点并用 fresh key 创建新节点，通过一次 RenderDomain.replace() 发布。
- V1 的 attrs 闭集只有 name；额外 attrs 属于 ACTION_INVALID。

### 2.2 data 与 children

- data 顶层闭集只有 clip，必须存在且通过 Clip Validator。
- receiveRenderData() 接收完整当前 data，不是局部嵌套 Patch。
- children 必须为空；不允许在 Action 内再嵌套 Action 或 Layer RenderNode。
- 初次投影尚未收到 data 时为 pending；投影完成后仍缺少 clip 属于 invalid，不能把空壳视为有效动作。

## 3. Clip V1 Schema

Clip 是 Adapter 已经解析、可以直接播放的绘制定义。它不携带 PNG、WZ 路径、Content 资源身份或业务动作状态。

~~~ts
type Point = [number, number];

type Playback =
  | { mode: "loop" }
  | { mode: "hold" }
  | { mode: "suffix-loop"; repeatFrom: number };

interface ClipV1 {
  formatVersion: 1;

  playback: Playback;

  frames: Array<{
    durationMs: number;

    move?: Point;                // 默认 [0, 0]
    rotate?: 0 | 90 | 180 | 270; // 默认 0，顺时针
    flip?: boolean;              // 默认 false
    showFace?: boolean;          // 默认 true

    layers: LayerV1[];
  }>;
}

interface LayerV1 {
  id: string;
  sprite: string;                // 父 ms-avatar.data.sprites.items 的逻辑 ID
  z: string;                     // 父 ms-avatar.data.appearance.zOrder 中的名称

  origin: Point;                 // 小图内部的对齐原点
  anchors?: Record<string, Point>;

  priority?: number;              // 与 tag 成对出现
  tag?: string[];                 // 已解析的 slot token
}
~~~

### 3.1 Playback 语义

| mode | 基础 Action 行为 |
| --- | --- |
| loop | 从第 0 帧播放到末帧，再循环全部帧 |
| hold | 从第 0 帧播放一次，结束后保持末帧 |
| suffix-loop | 首轮播放完整帧序列；之后只循环 repeatFrom 到末帧的后缀 |

- repeatFrom 是从 0 开始的帧索引，只能用于 suffix-loop；必须满足 1 <= repeatFrom < frames.length。V1 不用 repeatFrom=0 表示普通 loop。
- loop 和 hold 不允许出现 repeatFrom。
- one-shot 不写入 Clip 的 playback 字段；父 Avatar 在收到 Event 时将任意有效 Clip 以 once 模式播放一次完整帧数组，然后结束。
- 对 suffix-loop 的 one-shot 只播放完整数组一次，不进入后缀循环；对 loop 的 one-shot 也只播放一次。

### 3.2 Frame 语义

- frames 必须是非空有序数组。
- durationMs 必需，为有限非负整数，单位毫秒。
- move 是当前帧对整套身体合成的局部平移，不累计；缺省 [0,0]。
- rotate 只允许 0/90/180/270 度，Canvas 坐标正方向为顺时针；缺省 0。
- flip 是当前帧的水平镜像许可；最终镜像结果为 attrs.facing=left 与 frame flip 的 XOR；缺省 false。
- showFace 只控制当前帧是否显示父级表达式 Layer，不改变表情选择或表情时间；缺省 true。
- layers 必须是数组，可以为空；空数组表示该帧有意不绘制身体 Layer。
- 多帧 loop 的总时长必须大于零；suffix-loop 的循环后缀总时长必须大于零。允许合法零时长帧；hold 可为零总时长，此时立即保持末帧；全零时长 one-shot 立即结束。

### 3.3 Layer 语义

- id 是该帧内唯一的诊断身份，不是 RenderNode key。
- sprite 必须精确引用父级 data.sprites.items 中存在的逻辑小图 ID。
- z 必须精确出现在父级 data.appearance.zOrder。
- origin 是小图内部与布局计算出的部件原点对齐的像素坐标；它不因图集位置变化而变化。
- anchors 中的向量相对该 Layer 的 origin；最多 8 个锚点，名称非空且 UTF-8 长度不超过 32 字节。锚点匹配优先级固定为 navel → neck → hand → brow → handMove。
- 若 anchors 缺省或为空，Layer 使用身体原点；若非空但找不到任何与已建立锚点表共同的名称，父 Painter 跳过该 Layer 并报告 LAYER_ANCHOR_MISSING。
- 同一 Layer 的 priority 和 tag 必须同时存在或同时缺省。priority 必须是安全整数；tag 必须是非空、无重复字符串数组，最多 32 项，每个 token 为 1–8 UTF-8 字节。两者均缺省表示该层不参与 slot occlusion；参与 CMS079 遮挡的部件不得由 Adapter 省略这两个字段来绕过校验。
- priority 是 Adapter 从 CMS079 槽位事实解析出的整数优先级；tag 是有序 slot token 数组。Renderer 只执行既定遮挡算法，不读取源 WZ metadata。
- z 为 face 的 Layer 不参与 slot occlusion。
- Layer 不携带 width/height、Content resource identity 或 atlas source；小图尺寸和 source 都由父级 sprite item 提供。

## 4. Clip 时间定位算法

所有时间都以毫秒累计。父 Avatar 传入 elapsed time，Clip 不创建自己的时钟。

设每帧时长为 d[i]，全帧总时长为 T：

- loop：若 T 大于零，定位时间为 elapsed modulo T。
- hold：若 elapsed 大于或等于 T，固定末帧；否则按累计区间定位。
- suffix-loop：首轮 elapsed 小于 T 时按完整数组定位；否则以 repeatFrom 帧起始累计时长为 suffix 起点，对 suffix 总时长取模定位。
- once：按完整数组定位；elapsed 大于或等于 T 时结束，不再保持末帧。
- 零时长帧不占据时间区间，定位时跳过。零总时长 hold 是末帧静态姿势；零总时长 once 立即完成；循环总时长的正值约束见第 3.2 节。

定位必须直接根据累计时间计算，不通过逐帧推进追赶长时间 delta。Clip 更新时父 Avatar 依据当前 elapsed 对新 Clip 重新 seek，不继承旧帧号或按百分比缩放相位。

## 5. 父子协作与内部快照 API

LoomRealm WebProjector 不会把子节点的 receiveRenderData() 自动透传给父 Avatar。ms-action 必须主动通知，父 Avatar 必须同步读取当前直接子节点。

### 5.1 本地快照状态

V1 内部只读快照：

~~~ts
type ClipSnapshot =
  | {
      status: "pending";
      name: string | null;
      localRevision: number;
    }
  | {
      status: "invalid";
      name: string | null;
      localRevision: number;
      diagnostic: ActionDiagnostic;
    }
  | {
      status: "valid";
      name: string;
      localRevision: number;
      clip: Readonly<ClipV1>;
    };

interface MsActionElement extends HTMLElement {
  getClipSnapshot(): ClipSnapshot;
}
~~~

- localRevision 只在当前 HTMLElement 生命周期内单调递增，用于父级缓存失效；不是 RenderNode 字段、不是 clip-version，不用于换装事务。
- 快照必须深只读；父 Avatar 不得原地修改 Clip。
- receiveRenderData(fullData) 必须先解析并验证，再原子替换本地快照状态。
- 新 data 无效、缺少 clip 或版本不支持时，状态变为 invalid；不得继续暴露上一份有效 Clip 冒充当前定义。
- 首次尚未收到 data 时为 pending；不能把空壳或未收到 data 的子元素登记成有效动作。

### 5.2 变化通知

V1 使用 Renderer 私有、非冒泡 DOM 通知：

- 事件名：ms-action-change。
- bubbles=false、composed=false，不携带业务 payload。
- 在子组件完成本地快照替换后同步派发；只表示“当前定义状态已变化”，不表示可绘制，也不触发播放。
- 父 Avatar 对当前直接子节点注册/解绑监听。收到通知只标记动作索引和组合快照 dirty；不得在通知回调中直接下载、解码或绘制。
- MutationObserver 仅辅助发现子节点增删、移动和 attrs 变化；不能替代 Clip 私有数据通知。
- 父 Avatar 在 Action Event 入口同步枚举当前直接子节点、读取目标快照并检查唯一性；不得依赖尚未执行的 MutationObserver。
- 迟到通知只有在事件来源仍是当前直接子节点时才有效。迁移父级、删除或断连后的旧节点通知必须忽略。
- 同一 live key 上 attrs.name 从一个已建立名称改为另一个名称属于非法改名，子组件将当前状态标记为 invalid 并通知父级；调用方必须使用 fresh key 重建节点。

### 5.3 投影批次门闩

子组件通知不能单独证明一次换装完成。父 Avatar 的 Renderer 内部投影批次门闩、开始/结束回调和失败隔离由 [ms-avatar 第 8 节](./ms-avatar.md) 定义。ms-action 不自行判断批次完成，也不把本地 revision 当事务版本。

## 6. 更新、删除与时间迁移

| 输入变化 | ms-action 行为 | 父 ms-avatar 行为 |
| --- | --- | --- |
| 收到同名有效新 Clip | 替换只读快照，revision 增加并通知 | 保留当前播放实例 elapsed，按新 Clip 重新 seek |
| 收到无效新 Clip | 状态变 invalid，不保留旧有效 Clip | 当前基础请求保留但不使用旧帧；one-shot 立即取消 |
| Clip data 尚未首次交付 | pending | 不将该子节点视为有效 Action |
| 子节点被删除 | 不再属于父级索引 | 基础请求保留并报告缺失；当前 one-shot 立即取消 |
| 非当前动作 Clip 更新 | 更新快照并通知 | 只更新索引，不扰动当前播放 |
| attrs.name 原位改名 | invalid 并通知 | 旧名失效；要求 fresh key 的新节点 |
| 子节点移动到另一个父级 | 仍只暴露自己的本地快照 | 旧父级忽略迟到通知；新父级重新验证直接子节点 |

Clip 内容更新是绘制定义热更新，不是新的播放指令。同名有效 Clip 更新保留 elapsed；新 Action Event 才会重启 one-shot。

## 7. Render Update 发布语义

- 已存在子节点的 Clip 可独立通过 RenderDomain.update({ nodes: [{ key, data: { set: { clip } } }] }) 更新。
- data.set.clip 替换子节点 data 的顶层成员 clip；宿主随后向子组件交付完整 data。
- RenderDomain.update() 不能更改 children、key 或 tag。
- 新增、删除、重排或改名子节点必须通过一次 RenderDomain.replace() 发布完整新树。
- 换装若改变父级 sprites/zOrder/appearance 或影响任何 Clip 兼容性，必须将父 data、所有受影响 Clip 和必要 attrs 放入同一 Domain 的同一次原子提交；不能跨多次提交分阶段换装。
- 初始 Snapshot 和 replace 仍携带完整当前树；子节点独立更新减少后续单 Clip 修订的更新范围，不提供自动流式加载。
- 当前外观可触发的 Action Clip 应在 Event 前发布。Event 到达时缺失或无效即丢弃，不等待下一次 replace。

## 8. Validator 与容量策略

ms-action 执行单 Clip Validator，父 Avatar 执行父子组合 Validator。

Clip Validator 至少拒绝：

- 未知或缺失字段、非 V1 formatVersion；
- 非对象 clip、空 frames、非数组 layers；
- 非整数或负 durationMs、非法 rotate/flip/showFace/move；
- 未知 playback mode、repeatFrom 越界、循环区间总时长为零；
- 空/重复 layer id、缺失 sprite/z、z 不在父级 zOrder；
- 非有限或超出运行配置坐标范围的 move/origin/anchor 坐标、非法 priority/tag 配对、空/重复/超长 slot token；
- 超出当前组件运行配置的字节、帧、Layer、锚点或字符串预算。

Clip 只验证 sprite ID 的语法；sprite 是否存在、source 是否落在当前父级图集页、contentVersion 和实际解码尺寸由父级组合/资源 Validator 验证。

所有容量限制必须有限且可配置；真实数值由 CMS079 V01/V03 样本和目标浏览器预算确定。旧 cms-actor 的 32 Action / 256 KiB 不是新 ABI 上限。字节计数必须有界，超限即停止验证，不先生成无界序列化字符串。

## 9. 验收矩阵

实现阶段至少覆盖：

| 用例 | 预期 |
| --- | --- |
| loop / hold / suffix-loop | 帧边界、循环后缀、末帧保持正确 |
| 零时长帧 | 定位跳过零区间；零总时长 hold/once 按规则处理 |
| 同名有效 Clip 热更新 | 保留 elapsed，按新帧时长 seek，不重启 |
| 新数据无效 | 快照变 invalid，不暴露旧 Clip |
| 首次空壳子节点 | pending，不被索引为有效动作 |
| 同名重复子节点 | 冲突名称 fail closed，其他动作可用 |
| 同 key 原位改名 | invalid；fresh key 新节点才可生效 |
| 子节点移动/删除后迟到通知 | 旧父级忽略 |
| Clip 缺失后恢复 | 父级基础时间继续累计并 seek；one-shot 缺失则不补播 |
| 换装父子同次提交 | 由 Avatar 投影门闩证明无混合帧 |
| 资源慢解码 | 子组件不参与资源生命周期；父 Player 不暂停 |

## 10. 最终边界

- ms-action 是数据与验证单元，不是动画播放器。
- ms-avatar 是播放、资源与绘制权威。
- RenderNode key、Action name、Clip localRevision 和 Content contentVersion 是四种不同身份，不互相替代。
- Clip 的 playback 描述基础播放；Event 的 once 是父 Player 的运行时覆盖模式。
- 新组件设计已收口；Renderer 内部投影批次门闩、CMS079 转换正确性、容量数值和像素/性能结论仍须工程验收。

参考：  
- [ms-avatar V1](./ms-avatar.md)  
- [旧 cms-actor Avatar Model](../../components/cms-actor/src/avatar-model.mjs)  
- [旧 cms-actor 实施说明](../../components/cms-actor/IMPLEMENTATION.md)  
- [LoomRealm Web Presentation API v1](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/doc/15-contracts/web-presentation-api-v1.md)  
- [LoomRealm WebProjector](https://github.com/lithdoo/loom-realm/blob/93648192323bf5f57996b7b54cbae641d8a53fdb/packages/renderer/src/internal/web-projector.ts)  
- [OpenMS Animation Timing](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation-timing.js)
