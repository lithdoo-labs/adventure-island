# cms-actor 适配自研纸娃娃 FSDB

> 状态：**待执行**。本文件只定改造范围。还没有新的适配器，也没有改绘制。
>
> 制定日期：2026-11-07。基线：`main` `261738fa53cc48fe507dab4c302ba35d2343e625`。LoomRealm pin 不改：`93648192323bf5f57996b7b54cbae641d8a53fdb`。
>
> 数据契约是 [content/adventure_design.md](../../content/adventure_design.md) 第 2 章。库是 `content/[FSDB]adventure`。转换库 `content/[FSDB]cms` 和 `struct.Look` 适配器继续留着，给已有的 CMS 切片测试用。

## 1. 决策

`cms-actor` 仍然只画 `avatarPlan`，不打开 FSDB，不读 WZ。游戏侧新增一个适配器，从自研纸娃娃表投影出计划。

要改组件的只有两件事，都是因为新库的画法和旧的「一张小图一个 PNG」对不上，以及脸的计时和身体不是同一条：

- 层上增加图集源矩形。资源指向整页大图，宽高仍是小图。
- 表情用自己的帧钟，不跟身体帧号走。

锚点优先级、朝向翻转、`AvatarPlanV1` 的 32 个动作和 256 KiB 上限保持不变。一次计划只放当前要播的姿势。

这次不改库里的文件，不写技能章和地图章，不改 PWA 入口、LoomRealm pin 和 `research/`。

## 2. 现状

`src/real-look-adapter.mjs` 读五份 `struct.Look`、`struct.ZMap/order` 和 `resource.图`。它要求身体、头、脸、头发、一把武器，生成 `stand*`、`walk*`、`jump`、`brandish1`。姿势后缀来自武器 `info.stand` / `info.walk`。身体缺姿势就抛错。脸固定取表情的第 0 帧，和身体画在同一帧里。它不做 `vslot` 遮挡，不读防具，不转 `rotate`。

`src/cms-actor.mjs` 把资源解码后的宽高和层上的 `width` × `height` 比对，不一致就报 `CONTENT_INVALID`。绘制用整张位图。`validateAvatarPlan` 要求同一个 `namespace + key + contentVersion` 只能有一套宽高。

新库对不上这三条约定：

- 一个部件一张大图。`00002000` 的身体页装了 236 张小图，`walk1` 第 0 帧的 `body` 只是其中一块。整页解码尺寸不是小图尺寸。
- 姿势在 `group.avatar.PartFrame` 的 jsonl 里。重定向是单独一行 `redirect`，没有 `layers`。武器姿势在 `struct.avatar.Part` 的 `stance` 上，不在 `info` 里。
- 绘制顺序是 `struct.avatar.DrawOrder/avatar` 的 `frontToBack`，153 个名字。计划最多收 64 个 `z`。
- 当前库的脸是创建角色那 6 张。`00020000`、`00020002` 不在库里。头发是那 6 根，没有 `00030001`。

## 3. 适配器读哪些表

调用方传入部件键，不传入 Look JSON。肤色 0 的键是固定的：

| 角色上的东西 | 键 |
| --- | --- |
| 身体 | `avatar.part.body.00002000` |
| 头 | `avatar.part.head.00012000` |
| 脸 | `avatar.part.face.` 加八位编号 |
| 头发 | `avatar.part.hair.` 加八位编号 |
| 装备 | `avatar.equip.` 加种类和八位编号，例如 `avatar.equip.weapon.01302000` |

种类以 `struct.avatar.Part` 里的 `kind` 为准。第一批验收用库里实际有的创建角色部件，再配已有的两套装备：

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

大图用 `content.resource("resource.Avatar", image, contentVersion)`。`image` 是逻辑键，例如 `part/body/00002000/0`、`equip/weapon/01422000/0`。`contentVersion` 是这一页的版本，同一页上的小图共用它。

## 4. 计划里的一层

层仍要能通过现有的锚点布局。`layers[0]` 必须是身体画布。其余层按锚点依赖排在后面：头、脸、头发、装备。`z` 只决定后画的盖住先画的，不决定这个数组的顺序。

```js
{
  id: "body",
  z: "body",
  resource: {
    namespace: "resource.Avatar",
    key: "part/body/00002000/0",
    contentVersion: "sha256:<64 位小写十六进制>"
  },
  source: { x: 628, y: 234, w: 24, h: 29 },
  width: 24,
  height: 29,
  origin: [16, 31],
  anchors: { navel: [-8, -21], neck: [-4, -32] }
}
```

约定：

- `source` 是大图里的像素矩形，含左上角。`source.w === width` 且 `source.h === height`。
- `width` 和 `height` 是小图，给锚点和合成范围用。
- 同一个大图键可以对应多块不同尺寸的小图。尺寸一致性改成「这一页只解码一次」。解码后检查 `source` 落在页面内，不再要求页面宽高等于小图宽高。
- 缓存键仍是 `namespace + key + contentVersion`。绘制用九参数 `drawImage`，源矩形取 `source`，目标矩形仍是布局后的小图位置。
- `zOrder` 只保留本计划真正画到的名字，顺序跟 `frontToBack`。超过 64 个就拒绝，不截断。

`rotate` 写在帧上，不写在层上。布局完成之后，绕身体原点顺时针转，再做朝向翻转。导出里只有 90、180、270。顺时针是设计选定的方向，客户端原来的旋转方向没有还原。没有 `rotate` 的帧不转。

## 5. 播放

身体是时间轴。武器 `stance.stand`、`stance.walk` 决定 `stand1` / `stand2` 和 `walk1` / `walk2`。`jump` 不加后缀。第一批计划包含这些姿势，再加上身体上有画布或能重定向过去的 `brandish1`。`jump` 和 `brandish1` 不循环，播完回到当前移动姿势。

帧行的处理：

- 有 `redirect` 就跟过去，直到那一帧有 `layers`。延迟用当前行的 `delay`。`delaySign` 只保留符号，播放用绝对值。负延迟的帧照画。
- 身体没有这个姿势时，留在这具身体上一个有画布的姿势，不换肤色。
- 其他部件没有解析后的姿势名时，这一件不画。有这个姿势但帧不够时，用它的最后一帧。
- 身体帧 `showFace` 为假时，不画脸，也不画跟着表情走的脸饰。
- 脸和脸饰用表情自己的帧钟。`default` 没有帧号，一直画到表情名改变。多帧表情播完回到第 0 帧。表情名一变就从第 0 帧重播，不跟身体帧重置。脸饰没有这个表情名时用它自己的 `default`。当前库没有脸饰；规则照实现，验收数据里这一支是空的。
- `hairShade` 先用当前肤色的 `variants`。没有就用层上肤色 `0` 的那张。当前库的肤色是 0，验收时走肤色 `0`。

遮挡在投影时算完，隐藏的层不进计划。客户端函数还没还原，按设计里的四条：

1. 另一件的 `covers` 含有这件 `occupies` 里的任一槽，则整件不画。
2. 仍要画的那件里，这个 `z` 只对应一个槽，且另一件的 `covers` 含有它，则这一层不画。
3. `z` 对应多个槽时，不因为沾到其中一个槽就藏。
4. 一件装备不隐藏自己的画布。

`LayerSlot` 里空数组的层不参与遮挡。别名用正式层的槽位。

## 6. 不在这次做

- 不改 `content/[FSDB]adventure` 的数据，不重跑 `build_adventure_fsdb.py`。
- 不把 `real-look-adapter.mjs` 删掉，也不改它的 CMS 切片测试。
- 不读 `resource.图`、`struct.Look`、`struct.ZMap`、`struct.ZMapCn`。
- 不缩放 `attackSpeed`。延迟用文件里的毫秒。
- 不画残影、技能效果、受击者身上的命中画面、`CommonFaceCN`。
- 不接地图、立足线和移动。`x`、`y`、`locomotion`、`facing` 仍由外部写入。

## 7. 改哪些文件

| 文件 | 改动 |
| --- | --- |
| `components/cms-actor/src/adventure-adapter.mjs` | 新适配器。读第 3 节的表，投影第 4、5 节的计划 |
| `components/cms-actor/src/avatar-model.mjs` | 校验 `source`。同一大图允许不同小图尺寸 |
| `components/cms-actor/src/cms-actor.mjs` | 按 `source` 裁切；页面解码和源矩形分开核对；表情帧钟；帧旋转 |
| `components/cms-actor/scripts/build.mjs` 的浏览器产物 | 由构建脚本重新生成，不手改 `browser/cms-actor.browser.js` |
| `components/cms-actor/IMPLEMENTATION.md` | 记下 `source`、表情帧钟和 `resource.Avatar` |
| `components/cms-actor/test/` | 适配器单测，加上用库里两套装备投影出来的 Chromium 绘制 |

## 8. 验收

- 现有 `cms-actor` 合成测试和 CMS Look 适配器测试仍然通过。
- 第一套投影出 `stand1`、`walk1`。第二套投影出 `stand2`、`walk2`。两套都有 `jump`。计划里的 `zOrder` 是 `frontToBack` 的子序列，且不超过 64。
- 身体 `walk1` 第 0 帧的 `body` 用大图上的源矩形，解码后的页面尺寸可以大于 27×32。同一页只请求一次 `resource.Avatar`。
- 脸的 `blink` 按自己的 `delay` 前进，身体停在 `stand1` 时它仍会动。`showFace` 为假的身体帧不画脸。
- 长袍的 `covers` 含有上衣和裤子的槽时，上衣和裤子不进计划。木锤占盾槽时，同时穿上的木盾不进计划。
- 序列化后的 `RenderNode.data` 不超过 262,144 字节。
