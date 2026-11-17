# ms-world-item — 世界实体定位与深度宿主（首阶段设计草案）
> **契约维护：不做组件 ABI / Schema 版本管理。** 字段和行为变化直接更新本文件与实现，不设置 `formatVersion` / `schemaVersion`，不做版本协商、兼容分支或迁移。ResourceRef 的 `contentVersion` 是 LoomRealm Content 资源身份，不是组件版本。


> 状态：PROPOSED / NON-NORMATIVE / NOT IMPLEMENTED。首阶段必需；具体字段/schema 和是否必须单独成标签，仍待审查。
> 本标签主要承载玩家 Avatar，未来可复用到 NPC/Mob；见 [组件树](./FIELD-COMPONENT-TREE-DRAFT.md)。

## 1. 存在原因

同一个 Avatar 的身体动作和世界移动更新频率不同。ms-world-item 将游戏实体的**世界定位和全局遮挡**从内层视觉合成分离：

- 外层 ms-world-item：世界坐标（推荐以足底/业务锚点为输入）、已决定的世界堆叠顺序、可见性；只负责定位和 CSS stacking。
- 内层 ms-avatar：纸娃娃局部纹理、Action、表情、装备与独立的局部 Canvas。
- 外层位移不要求重画内层 Canvas；Avatar 换帧不要求重新计算 Foothold 或世界排序。
- 一名 Actor 对应一个外部 Paint Unit，而不是身体、武器、名称各自与世界地图排序。

该组件不是 Simulated Entity、Physics Body 或通用场景实体注册器。LoomRealm 仍通过 RenderNode key 管理 DOM 元素。

## 2. 结构和合法子节点候选

~~~text
ms-scene-view
├── ms-map-batch
├── ms-world-item (Actor A; world placement, stack-rank)
│   └── ms-avatar
│       └── ms-action[]
├── ms-map-object
└── ms-world-item (future Actor B)
    └── ms-npc
~~~

本阶段生产范围：仅要求一个玩家 ms-avatar。将来是否允许多个子视觉节点、ms-npc / ms-mob、Actor-relative nameplate，必须按明确的深度语义限制；**不得把任意世界效果放进当前 Actor 宿主内部**。

## 3. 输入语义（候选，非冻结 ABI）

| 输入 | 责任与约束 |
| --- | --- |
| stable actor presentation id | Subsystem Render Projection 赋予；不从 DOM 顺序推断 |
| world x/y + anchor convention | Subsystem 世界状态与已解析的美术锚点；必须固定足点/原点定义 |
| stack-rank（整数） | 同一 World Domain 的全局排序结果；包含 depth 与 tie-break 语义 |
| visibility / optional visual transform | 只影响宿主呈现，不修改业务实体是否存在 |
| 内层 RenderNode child | 首阶段仅为 ms-avatar 与其现有 ms-action 子树 |

世界 depth 由 Field Subsystem 的 Render Projection 根据 Foothold layer/group 等权威事实产生；ms-world-item **不读取 Foothold、不会自行 Y-sort**。原始 worldDepth/tieOrder 可以作为诊断数据，但由 Subsystem 发布最终 stack-rank。

## 4. DOM / CSS 规则

- 宿主参与 ms-scene-view World Plane 的可比较兄弟 Paint Unit 排序，使用已验证的正整数/有符号整数 CSS z-index 排序映射；必须处理 CSS 整数范围和相等顺序。
- 宿主定位 transform 更新由 world x/y 和公共 Camera Transform 组合完成：Camera 只在共同 world-plane 中施加一次，避免双重减 Camera。
- Avatar 内部 Shadow DOM 创建局部 stacking context 属于**正确的局部隔离**；不能把 Avatar 的装备 Sprite 提升到覆盖外部前景 Obj。
- 使用原点/足点对应的局部偏移，而不是按非透明像素包围盒重新居中；镜像与 facing 归 Avatar。
- 同一个宿主外层若设置 alpha、filter 等，影响其整个局部组合；名称/任务标签是否参与同样效果要以美术层级证据决定。

## 5. 更新、生命周期和失败

- 高频 x/y 走已有节点的 RenderDomain.update；仅更新宿主 transform，不触发内层 Canvas 重绘。
- action/expression 等由内层 ms-avatar 单独接收；一次换装的多节点一致性问题仍受当前 Avatar 文档 的待验证边界约束，不能宣称已经有上游批次接口。
- depth 改变只更新 stack-rank 或由 Subsystem 按需要重排 Paint Unit；如果静态 batch 深度断点规划不足，**不允许世界宿主自行拆分 Canvas**。
- 结构替换通过 RenderDomain.replace，复用仍存活的稳定 key；删除过的 key 在同一 Domain 生命周期不能随意复活。
- 宿主断连/重连不应改变 Subsystem 的 Actor；本组件不接收攻击命中、死亡裁决或业务输入。
- 无效坐标、非整数 rank、不可定位的 anchor、RenderNode key 错配应有组件诊断，拒绝渲染错误定位而不捏造缺省值。

## 6. 首阶段验收

1. Avatar 原地换帧时外层坐标不跳；移动时 Avatar Canvas 不重绘。
2. 同一个 Obj 在 Player 不同 Foothold depth 时从前景变后景；不依赖 screen-Y。
3. Camera 平移、resize、DPR 下 Actor 足点与地图 Foothold 视觉对齐。
4. 同深度多个 Actor（合成 fixture）tie-order 稳定；world-item 不创建新的协作 registry。
5. map replace /断连/重连后 key 和视觉相位符合 [ms-avatar](./ms-avatar.md) 约束。

OpenMS 参考：[Actor depth 与 tie-order](https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/docs/client-evidence.md)。

## 7. RenderNode ABI — Actor World Host

> 本节明确 Stage-1 唯一玩家视觉对象的候选 ABI；共享整数排序、Resource/场景 epoch 语义见 [共享 ABI](./FIELD-PAINT-UNIT-ABI-DRAFT.md)。不修改现有 [ms-avatar](./ms-avatar.md)。

### 7.1 attrs 完整闭集

`world-x`、`world-y`、`stack-rank`、`visible`，全部**必需**，精确使用共享 ABI 中的非指数有限十进制数字、正整数排名和布尔字符串语法。

- world-x/world-y 是**Actor 的世界锚点**，本阶段 anchor 类型只允许 `feet`，不是 Sprite 左上角、NPC 图片矩形中心或 viewport 坐标。
- 外层将 world-x/y 定位到共享 World Plane；所有 Camera 偏移只在 ms-scene-view 中扣除一次。
- stack-rank 已融合深度与 tie-order，ms-world-item 不得按 y 重新排序，也不得读取 Foothold、layer/group 作模拟推断。
- visible 是视觉显隐，而不是该 Actor 的业务存在标志。

### 7.2 data 完整闭集

~~~ts
interface WorldItemData {
  actorVisualId: string;  // stable presentation identity，非 server actor id 强制透传
  anchor: "feet";         // 当前只接受 feet
}
~~~

RenderNode key 在同一 Domain 内必须唯一且符合 one-shot；`actorVisualId` 在当前场景中不得重复。actorVisualId 是 Subsystem 的角色呈现身份，RenderNode key 是节点身份；两者不是 Content 内容身份。Canvas 局部原点到 feet 的对齐由 ms-avatar 内部的 source origin/anchor 设计承担；若 Avatar 和外层 feet 对齐不确定，不允许静默做中心对齐。

### 7.3 RenderEvent 与 children 完整约束

ms-world-item 不接收 RenderEvent，也不调用 `emitCustomEvent()`。Avatar 的一次性动作事件必须直接投递给 `ms-avatar` 的 RenderNode key；RenderEvent 不通过 DOM 冒泡传递。



首阶段必须**恰有一个**直属子节点，tag 为 `ms-avatar`；该 Avatar 按既有组件文档拥有自己的零到多个 `ms-action` 直接子节点。ms-world-item **不得**改变 Avatar 既有 attrs/data/children 契约，不承诺 Avatar 的 ProjectionBatch 已由平台实现。

~~~json
{
  "key": "actor-host:player:local",
  "tag": "ms-world-item",
  "attrs": {
    "world-x": "100",
    "world-y": "200",
    "stack-rank": "30",
    "visible": "true"
  },
  "data": {
    "actorVisualId": "player:local",
    "anchor": "feet"
  },
  "children": [
    {
      "key": "avatar:player:local",
      "tag": "ms-avatar",
      "attrs": {
        "action": "stand1",
        "facing": "right",
        "expression": "default",
        "one-shot-enabled": "true"
      },
      "data": {
        "appearance": {
          "zOrder": [
            "body"
          ]
        },
        "sprites": {
          "pages": {
            "p0": {
              "resource": {
                "namespace": "map",
                "key": "examples/avatar/p0.png",
                "contentVersion": "sha256:0000000000000000000000000000000000000000000000000000000000000000"
              },
              "width": 32,
              "height": 32
            }
          },
          "items": {
            "body.stand1.0": {
              "page": "p0",
              "source": {
                "x": 0,
                "y": 0,
                "w": 32,
                "h": 32
              }
            }
          }
        },
        "expressions": {
          "default": {
            "frames": [
              {
                "durationMs": 0,
                "layers": []
              }
            ]
          }
        }
      },
      "children": [
        {
          "key": "avatar:player:local:stand1",
          "tag": "ms-action",
          "attrs": {
            "name": "stand1"
          },
          "data": {
            "clip": {
              "playback": {
                "mode": "loop"
              },
              "frames": [
                {
                  "durationMs": 100,
                  "layers": [
                    {
                      "id": "body",
                      "sprite": "body.stand1.0",
                      "z": "body",
                      "origin": [
                        16,
                        32
                      ]
                    }
                  ]
                }
              ]
            }
          },
          "children": []
        }
      ]
    }
  ]
}
~~~

**注意**：该示例包含满足 当前 ms-avatar/ms-action 组件结构的合成 stand1 Clip 与示例图集引用，资源 key 和 PNG 内容均**未实际提供**，因此这不是已可绘制的地图 Avatar 验收结果。真实图片尺寸、锚点、slot occlusion、资源 closure 和 ProjectionBatch 限制仍以既有 Avatar 文档的验收门为准。

### 7.4 投影与局部 DOM

- ms-world-item 宿主是 world-plane 下的同级 Paint Unit（非唯一全局容器）；其自身负责 CSS 绝对定位和 stack-rank，内部 ms-avatar 的 Shadow DOM 不突破本宿主深度。
- 高频 world-x/y、stack-rank/visible 改变通过一个已存在节点的 attrs Update，不应重绘 Avatar Canvas。
- 玩家动作/装备改变直接更新 ms-avatar/ms-action，不能由 world-item 冒充业务动画播放者。
- 同一个 HTMLElement 的部分 attrs 被 WebProjector 依序设置，内部显示必须等待合法四字段完成并在同一绘制机会读取组合快照，避免先取 x 再取旧 y；不能向 managed attr 写回当前插值。
- children 的变化须来自 Subsystem 的 Domain 结构提交；宿主不能自行添加任意 NPC/世界数字子节点。未来 NPC/Mob 外层是否复用该标签另行扩展 children 允许集。

### 7.5 失败与生命周期

world-x/y 非法、重复 rank、错误 anchor、错误子标签、RenderNode key 失配都应产生准确诊断并隐藏**当前非法的呈现单元**，不阻塞 Subsystem Simulation。断连/重连时不迁移 Avatar 的游戏 Actor authority；Player 在同地图换深度时保持 host/Avatar stable key 和 DOM 实例。

### 7.6 最小验收

Actor x/y 改变而 Canvas 不换帧；Foothold 深度改动引发 CSS 前后变化；Avatar 单独换装不改变坐标；跨 Map replace 不重用已删 key；Camera/DPR 下 feet 锚点稳定。

