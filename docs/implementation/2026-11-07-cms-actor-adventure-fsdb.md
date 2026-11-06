# cms-actor 适配自研纸娃娃 FSDB

> 状态：**已落地**。适配器、绘制和验收测试都在本分支。本文件仍是那次改造的范围，不是另一份设计。
>
> 制定日期：2026-11-07。基线：`main` `261738fa53cc48fe507dab4c302ba35d2343e625`。LoomRealm pin 不改：`93648192323bf5f57996b7b54cbae641d8a53fdb`。
>
> 数据契约是 [content/adventure_design.md](../../content/adventure_design.md) 第 2 章。库是 `content/[FSDB]adventure`。转换库 `content/[FSDB]cms` 和 `struct.Look` 适配器继续留着，给已有的 CMS 切片测试用。
>
> 对照现有组件和已导出的帧之后，改正了初稿里的五处：重定向行可以自带画布；一份计划按请求装姿势，不装全部 148 个；换计划不冲掉正在播的动作；`delay: 0` 和缺 `delay` 分开；表情轨使用当前身体帧已经摆好的锚点。随后把落地前仍会分叉的约定定死：`source` 可缺省、层 `id`、姿势后缀的来源、`bodyKey`、提前到达的事件只消费一次，以及 `contentVersion` 取自读取结果。

## 1. 决策

`cms-actor` 仍然只画 `avatarPlan`，不打开 FSDB，不读 WZ。新增一个纯函数适配器，从自研纸娃娃表投影出计划。测试和以后的游戏共用这一个函数。

组件要改的是这些：

- 层上增加图集源矩形。资源指向整页大图，宽高仍是小图。
- 表情用自己的帧钟，画的时候用当前身体帧已经记下的锚点。
- 一次性姿势先记下来，等计划里有这个名字再播。换计划时，这个姿势还在就不清掉。
- 身体没有请求的姿势时，留在这具身体上一个有画布的姿势。
- 帧上没有 `delay` 表示停住。`delay` 为 0 表示不停留，立刻进入下一帧。

锚点优先级、朝向翻转、32 个动作和 256 KiB 上限保持不变。一次计划只放当前要播的姿势，不放这具身体的全部姿势。

这次不改库里的文件，不写技能章和地图章，不改 PWA 入口、LoomRealm pin 和 `research/`。

## 2. 现状

`src/real-look-adapter.mjs` 读五份 `struct.Look`、`struct.ZMap/order` 和 `resource.图`。它要求身体、头、脸、头发、一把武器，生成 `stand*`、`walk*`、`jump`、`brandish1`。姿势后缀来自武器 `info.stand` / `info.walk`。身体缺姿势就抛错。脸固定取表情的第 0 帧，和身体画在同一帧里。它不做 `vslot` 遮挡，不读防具，不转 `rotate`。

`src/cms-actor.mjs` 把资源解码后的宽高和层上的 `width` × `height` 比对，不一致就报 `CONTENT_INVALID`。绘制用整张位图。`validateAvatarPlan` 要求同一个 `namespace + key + contentVersion` 只能有一套宽高。

现有时钟还有三处接不上新数据：

- `receiveRenderEvent` 发现计划里没有这个动作名就直接返回。`receiveRenderData` 每次都把一次性动作清掉，帧号归零。事件比计划先到会丢；计划比事件后到会把已经开始的动作清掉。
- `resolveActionName` 找不到请求的姿势时回到 `stand1`。逆向要求留在这具身体上一个有画布的姿势，不换肤色。
- `frameDuration` 把「没有 delay」和 `delay: 0` 都当成停止。`eburster` 第 7 帧的 `delay` 是 0，动作会停在那里。

新库对不上旧的资源约定：

- 一个部件一张大图。`00002000` 的身体页装了 236 张小图。`walk1` 第 0 帧的 `body` 是 27×32，大图矩形是 `x: 295, y: 198, w: 27, h: 32`，页是 `part/body/00002000/0`。
- 姿势在 `group.avatar.PartFrame` 的 jsonl 里。重定向行可以没有画布，也可以另带画布。`eburster` 第 4 帧既指向 `stabO1` 第 1 帧，又有画布 `006`。`fullSwingTriple` 第 0 帧的 `rotate` 和 `move` 写在重定向行上。武器姿势在 `struct.avatar.Part` 的 `stance` 上。
- 绘制顺序是 `struct.avatar.DrawOrder/avatar` 的 `frontToBack`，153 个名字。计划最多收 64 个 `z`。
- 当前库是创建角色的范围：1 个头、6 张脸、6 根头发、11 个身体、10 件装备。`00020000`、`00020002`、`00030001` 不在库里。除肤色 0 以外的头也不在库里。

## 3. 适配器读哪些表

调用方传入部件键列表，不传入 Look JSON，也不写死剑和木锤。键的形状：

| 角色上的东西 | 键 |
| --- | --- |
| 身体 | `avatar.part.body.` 加 `00002000` 和肤色后缀 |
| 头 | `avatar.part.head.` 加 `00012000` 和同一个肤色后缀 |
| 脸 | `avatar.part.face.` 加八位编号 |
| 头发 | `avatar.part.hair.` 加八位编号 |
| 装备 | `avatar.equip.` 加种类和八位编号，例如 `avatar.equip.weapon.01302000` |

身体和头必须是同一个肤色。头记录不存在就拒绝投影，不用 `00012000` 去配别的身体。种类以 `struct.avatar.Part` 里的 `kind` 为准。披风、脸饰、眼饰、耳饰用同一套读取；当前库没有这些记录，追加文件之后不用再改绘制。

姿势后缀只来自带 `stance` 的部件。有且只有一件时用它的 `stand` 和 `walk`。一件都没有时，两个后缀都是 1。多于一件就拒绝投影。`attack` 不参与选择。

验收用库里实际有的创建角色部件，再配已有的两套装备。肤色是 0：

| 部位 | 第一套 | 第二套 |
| --- | --- | --- |
| 身体、头 | `00002000`、`00012000` | 同左 |
| 脸 | `00020100` 男脸1 | `00020401` 男脸2 |
| 头发 | `00030000` 黑色短中分 | `00030027` 褐色酷型侧分 |
| 帽 | `01000000` | `01000001` |
| 上衣、裤子 | `01040002`、`01062001` | 不装备，改穿 `01050002` 长袍 |
| 鞋、手套 | `01070000`、`01082002` | 同左 |
| 盾 | `01092003` | 不装备 |
| 武器 | `01302000` 剑，`stand` 1、`walk` 1 | `01422000` 木锤，`stand` 2、`walk` 2 |

每个部件读三次：

- `content.record("struct.avatar.Part", key)`：`kind`、`occupies`、`covers`、`stance`。
- `content.group("group.avatar.PartFrame", key)`：`rows` 里一行一帧。
- `content.group("group.avatar.Resource", key)`：按 `name` 找到 `image`、`x`、`y`、`w`、`h`。

全角色再读两份结构：

- `content.record("struct.avatar.DrawOrder", "avatar")` 的 `frontToBack`。
- `content.record("struct.avatar.LayerSlot", "avatar")`。

大图用 `content.resource("resource.Avatar", image)`。`image` 是逻辑键，例如 `part/body/00002000/0`、`equip/weapon/01422000/0`。版本在返回值的 `contentVersion` 上，不是调用参数。适配器把这个版本写进层的 `resource.contentVersion`。组件之后按该版本向渲染侧要字节。同一页上的小图共用这一次读到的版本。

适配器是纯函数。输入是部件键、表情名、可选的一次性姿势名，以及 Content 读取接口。输出是一份 `avatarPlan`。地图和移动不进这个函数。

## 4. 计划里装哪些姿势

每次投影都带上按第 3 节选出的 `stand*`、`walk*` 和 `jump`。另有一次性姿势名、且这具身体有这个姿势时，再带上那一个。这具身体没有该姿势时，不把它放进计划。身体 `00002000` 的 148 个姿势不放进同一份计划。32 个动作和 256 KiB 的上限保持不变，超过就拒绝。

`zOrder` 只保留这份计划真正画到的名字，顺序跟 `frontToBack`。超过 64 个就拒绝，不截断。

组件只播计划里有的姿势。游戏要播 `swingO1`、`prone` 或 `eburster` 时，先投影一份含有它的计划，再发 `action` 事件。事件仍然不写入 `avatarPlan`，重连时不重播。

## 5. 计划里的一层

`layers[0]` 必须是身体画布，`id` 是 `"body"`。身体的其余画布接在后面，`id` 用画布名，例如 `"arm"`。然后是头、头发、装备。这些部件的 `id` 是部件名；同一部件有多张画布时用 `部件名:画布名`，例如 `"hair:hairOverHead"`、`"coat:mail"`。同一帧的 `id` 必须唯一。脸和跟着表情走的脸饰不进身体帧，进第 6 节的表情轨。`z` 只决定后画的盖住先画的。

身体帧带 `showFace`。导出的行上没有这个字段时写成 `true`。为 `false` 时，这一帧不画表情轨。

`00002000` 的 `walk1` 第 0 帧，`body` 这一层：

```js
{
  id: "body",
  z: "body",
  resource: {
    namespace: "resource.Avatar",
    key: "part/body/00002000/0",
    contentVersion: "sha256:<64 位小写十六进制>"
  },
  source: { x: 295, y: 198, w: 27, h: 32 },
  width: 27,
  height: 32,
  origin: [19, 32],
  anchors: { navel: [-6, -20], neck: [-4, -32] }
}
```

约定：

- `source` 可缺省。缺省表示源矩形就是整张位图，原有不带 `source` 的计划照旧整张绘制。写出 `source` 时，它是大图里的像素矩形，含左上角，并且 `source.w === width`、`source.h === height`。
- `width` 和 `height` 是小图，给锚点和合成范围用。没有 `source` 时，它们也必须等于整张位图的解码宽高。
- 同一个大图键可以对应多块不同尺寸的小图。尺寸一致性改成「这一页只解码一次」。解码后检查 `source` 落在页面内，不再要求页面宽高等于小图宽高。
- 缓存键仍是 `namespace + key + contentVersion`。绘制用九参数 `drawImage`，源矩形取 `source`，目标矩形仍是布局后的小图位置。

`rotate` 写在帧上，不写在层上。布局完成之后，绕身体原点顺时针转，再做朝向翻转。画布坐标里正角就是顺时针。导出里只有 90、180、270。顺时针是设计选定的方向，客户端原来的旋转方向没有还原。没有 `rotate` 的帧不转。

## 6. 表情轨

表情不烘焙进每个身体帧。计划里与 `actions` 并列：

```js
expression: {
  name: "blink",
  frames: [{ delay: 60, layers: [/* 脸，以及跟着表情走的脸饰 */] }]
}
```

绘制时先布局当前身体帧，再用这次布局已经记下的锚点摆表情层。不单独对表情做一次 `layoutFrame`，否则没有头，`brow` 对不上，脸会被跳过。身体帧 `showFace` 为假时，跳过这些层。

表情帧号和经过的时间在两处归零：`expression.name` 变了，或者表情帧列表变了。只换身体帧、而表情帧列表相同，不动它。帧列表没变却越出范围时，钳到最后一帧。`default` 没有 `delay`，停在这一张，直到表情名改变。多帧播完回到第 0 帧。脸饰没有这个表情名时用它自己的 `default`，帧号仍用表情的帧号，不够就钳到最后一帧。当前库没有脸饰；规则照实现，验收数据里这一支是空的。

`hairShade` 先用当前肤色的 `variants`。没有就用层上肤色 `0` 的那张。验收的肤色是 0。

## 7. 帧怎么解析

身体是时间轴。武器 `stance.stand`、`stance.walk` 决定 `stand1` / `stand2` 和 `walk1` / `walk2`。`jump` 不加后缀。`attack` 不变成姿势名。`jump` 和一次性姿势不循环，播完回到当前移动姿势。

重定向行先取自己的 `delay`、`move`、`flip`、`rotate`、`showFace`。有 `redirect` 就跟过去，其他部件使用解析之后的姿势名和帧号。画布是跟过去的那些层，再接上这一行自己的层。`eburster` 第 4 帧因此仍有 `stabO1` 的身体，并多一张放在身体原点的 `006`。额外层不插到 `layers[0]`。跟随链出现环就拒绝，不继续跟。

其他规则：

- `delaySign` 只保留符号，播放用绝对值。负延迟的帧照画。
- 帧上没有 `delay`，停住，直到姿势改变。`delay` 是 0，这一帧不停留，立刻进入下一帧。一次性姿势的最后一帧即使时长为 0，也结束并回到 `locomotion`。
- 其他部件没有解析后的姿势名时，这一件不画。有这个姿势但帧不够时，用它的最后一帧。
- 计划带 `bodyKey`，值是身体部件键，例如 `avatar.part.body.00002000`。组件按它记住上一个有画布的姿势名。`bodyKey` 变了就忘掉，改播新计划里的 `stand*`。
- 请求的姿势这具身体没有时，适配器不把这个名字放进计划，也不换一具身体来补。若记住的姿势仍在这份计划里，组件继续播它。记住的姿势已经不在计划里，或还没有记住任何姿势，就播这份计划的 `stand*`。

遮挡在投影时算完，隐藏的层不进计划。客户端函数还没还原，按设计里的四条：

1. 另一件的 `covers` 含有这件 `occupies` 里的任一槽，则整件不画。
2. 仍要画的那件里，这个 `z` 只对应一个槽，且另一件的 `covers` 含有它，则这一层不画。
3. `z` 对应多个槽时，不因为沾到其中一个槽就藏。
4. 一件装备不隐藏自己的画布。

`LayerSlot` 里空数组的层不参与遮挡。别名用正式层的槽位。帽子 `01000000` 的 `covers` 是 `Cp`、`H1`、`H5`：藏住槽为 `H1` 的 `hairOverHead`，留下槽为 `H2` 的 `hair`。整件头发不因为这顶帽子被藏掉。

## 8. 计划和事件怎么接

`action` 事件仍然只负责触发，不进 `avatarPlan`。组件这样接：

- 事件到达时计划里还没有这个名字，就记下这一个名字，冲掉之前记下还没消费的名字。下一份计划消费它：计划里有这个姿势，就从第 0 帧开始播；没有就丢掉。之后的计划不再因为这个旧名字补播。
- 新计划仍然包含当前正在播的一次性姿势，并且该姿势的帧列表没变时，保留它和帧号。帧列表变了，才从第 0 帧重播。
- 当前 `stand*` 或 `walk*` 的帧列表没变时，不把走路帧号归零。

游戏先投影含有该姿势的计划，再发事件。事件先到也能播，但只被紧接着的那一份计划消费。换装或换表情时，只要正在播的姿势还在并且帧列表没变，就不把挥砍清掉。

### 8.1 逆向证据边界与绘制修复

- 已确认的原始数据约定是：`zmap` 控制前后绘制顺序，`smap` 描述装备槽位；**原客户端完整的 Avatar 组装/遮挡函数仍未还原**，无法把调用方 `parts` 数组顺序当成逆向出的协议。当前 `layoutFrame` 使用首个已知锚点，必须先摆身体（提供 `neck`）、再摆头（提供 `brow`），才可以放头发/帽子；Adapter 因此在内部按 `body → head → hair → 其他部件按 key` 建立稳定布局。遮挡绘制仍只由 `avatar.DrawOrder` 决定。
- `source.width/height` 是小图裁剪尺寸，实际解码的是整页图集。不再按小图面积估算并限制图集内存；取消原有的 12 MiB 单层、单帧和缓存字节预算，保留 64 项 LRU 复用策略、8 路并发解码、冻结的 256 KiB `RenderNode.data` 协议上限。最终 Canvas 的极端锚点/DPR 安全校验是**另外的保护**。
- 同一冷图集页被多个层引用时，首次资源请求不能代替全部层的裁剪合法性检查。每次绘制在解码完成后逐层检查 `source` 是否位于实际页面内，任意越界则整帧失败并给出资源标识。
- 部件乱序与冷图集双裁剪都纳入回归测试；PWA CI 现在必须执行新增 Adapter、时钟及 Adventure Chromium 用例。正式 Base → Adventure Map 接线仍不是本 PR 的功能范围。

## 9. 不在这次做

- 不改 `content/[FSDB]adventure` 的数据，不重跑 `build_adventure_fsdb.py`。披风和饰品以后追加记录，不在这次补齐。
- 不把 `real-look-adapter.mjs` 删掉，也不改它的 CMS 切片测试。
- 不读 `resource.图`、`struct.Look`、`struct.ZMap`、`struct.ZMapCn`。
- 不缩放 `attackSpeed`。延迟用文件里的毫秒。
- 不画残影、技能效果、受击者身上的命中画面、`CommonFaceCN`。
- 不接地图、立足线和移动。`x`、`y`、`locomotion`、`facing` 仍由外部写入。

## 10. 改哪些文件

| 文件 | 改动 |
| --- | --- |
| `components/cms-actor/src/adventure-adapter.mjs` | 纯函数。读第 3 节的表，投影第 4 到第 7 节的计划 |
| `components/cms-actor/src/avatar-model.mjs` | 校验可缺省的 `source`、表情轨和 `bodyKey`。同一大图允许不同小图尺寸。区分缺 `delay` 和 `delay: 0` |
| `components/cms-actor/src/cms-actor.mjs` | 缺省 `source` 时整张绘制，有则裁切；表情轨用身体帧的锚点；提前到达的姿势名只被下一份计划消费一次；按 `bodyKey` 记住上一个有画布的姿势；帧旋转 |
| `components/cms-actor/scripts/build.mjs` 的浏览器产物 | 由构建脚本重新生成，不手改 `browser/cms-actor.browser.js` |
| `components/cms-actor/IMPLEMENTATION.md` | 记下 `source`、表情轨、`resource.Avatar`，以及计划和事件的到达顺序 |
| `components/cms-actor/test/` | 适配器单测，加上用库里两套装备投影出来的 Chromium 绘制 |

## 11. 验收

- 现有 `cms-actor` 合成测试和 CMS Look 适配器测试仍然通过。
- 第一套投影出 `stand1`、`walk1`。第二套投影出 `stand2`、`walk2`。两套都有 `jump`。同一份计划再带一个请求的姿势时，可以是 `brandish1`、`swingO1` 或 `eburster`。`zOrder` 是 `frontToBack` 的子序列，且不超过 64。
- `walk1` 第 0 帧的 `body` 使用 `source: { x: 295, y: 198, w: 27, h: 32 }`，原点 `[19, 32]`。解码后的页面尺寸大于 27×32。同一页只请求一次 `resource.Avatar`。
- `eburster` 第 4 帧既有 `stabO1` 的身体画布，也有 `006`。`fullSwingTriple` 第 0 帧带上这一行自己的 `rotate: 90` 和 `move`。
- 事件先于计划到达时，只有下一份计划消费这个名字：里面有该姿势就从第 0 帧播，没有就丢掉，不留给再往后的计划。计划更新但该姿势的帧列表没变时，不把帧号清掉。
- 没有 `source` 的旧计划仍整张绘制。两件都带 `stance` 时拒绝投影。没有带 `stance` 的部件时使用 `stand1` 和 `walk1`。
- 换脸但表情名仍是 `blink`、帧列表变了时，表情从第 0 帧重播。`bodyKey` 从 `avatar.part.body.00002000` 换成另一具身体时，不沿用上一具的姿势。
- 脸的 `blink` 按自己的 `delay` 前进，身体停在 `stand1` 时它仍会动。换身体帧不把表情帧号归零。`showFace` 为假的身体帧不画脸。
- 长袍的 `covers` 含有上衣和裤子的槽时，上衣和裤子不进计划。木锤占盾槽时，同时穿上的木盾不进计划。帽子 `01000000` 藏住 `hairOverHead`，留下 `hair`。
- 请求一具身体没有的姿势时，不把该名字放进计划。记住的姿势仍在这份计划里就继续播它；否则播这份计划的 `stand*`。头和身体肤色后缀不一致时拒绝投影。
- 序列化后的 `RenderNode.data` 不超过 262,144 字节。
