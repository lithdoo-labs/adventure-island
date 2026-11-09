# cms-actor

> 本组件的公共 RenderNode 字段与事件名以 [RENDER-NODE-ABI-V1.md](../RENDER-NODE-ABI-V1.md) 为准；AvatarPlanV1 的组件级 schema 和实现细节见本文及 IMPLEMENTATION.md。

一个人物，是 `cms-avatar-layer` 的子元素。客户端里它对应 `GetAvatarPart(+0x10)` 上的外观。元素把身体、头、脸、头发和装备合成一个人，自己按帧间隔播动画。移动、跳跃和换场景仍由地图运行库决定。

> 本文件在 PR-A（Issue #46）中做了组件专属增量修订：`data` 从空对象改为承载已解析、有界的 `avatarPlan`，并新增「实现边界」「平台接入」两节。WZ 逆向结论（锚点、z 序、动作表、表情表）保持原样。与修订前设计的差异：动态状态仍在 `attrs`；组件不再假设运行库逐帧驱动，而是自己按 `avatarPlan` 的 `delay` 推进并在 `receiveRenderData` 时整体接收新计划。实现与验证细节见 [IMPLEMENTATION.md](./IMPLEMENTATION.md)。

本地角色和远程角色用同一套画法。`SPAWN_PLAYER` 在编号等于自己时直接返回，本地角色不走那条生成。

## 运行库交给它的保留状态

组件不读包。`decodeAvatar`（`0x58CDF6`）里的装备迭代 `0xAFEB88` 仍未还原每个 int32 是物品编号还是标志；`stance`（`+0x3C0`）也还没拆成动作和朝向。运行库把已经确定的外观交下来。

动态状态写在 `attrs`，投影成宿主属性。一次更新可以只改其中一项，走路时只改 `x`，换装时只改 `equips`。静态、已解析的画布/帧描述放在 `RenderNode.data.avatarPlan`，供组件按帧绘制；组件不从这些编号直接查 WZ。`avatarPlan` 不是原始 WZ 树，也不能包含物理路径或 URL。

| 字段 | 放在 | 值 | 含义 | 依据 |
|---|---|---|---|---|
| `x` | `attrs` | 十进制字符串 | 世界横坐标。身体画布的 `origin` 放在这里 | `decodeAvatar` 在 `stance` 前读的第一个有符号 i16 |
| `y` | `attrs` | 十进制字符串 | 世界纵坐标 | 第二个有符号 i16。样本里身体 `origin.y` 等于画布高度，原点在图的底边 |
| `locomotion` | `attrs` | `stand`、`walk`、`jump` | 身体动画状态 | 第一阶段的移动只产生这三种。武器的 `walk` / `stand` 再决定后缀 |
| `facing` | `attrs` | `left`、`right` | 朝向 | 与坐标分开更新。`stance` 字节还没拆成动作和朝向 |
| `skin` | `attrs` | 十进制字符串，如 `0` | 肤色后缀 | `CCharacterStats+0x12`。`UPDATE_STATS` 的 mask `0x001` 读 u8。`UPDATE_CHAR_LOOK`（`0xC7`）在性别之后读同一个 u8 |
| `face` | `attrs` | 八位编号，如 `00020000` | 脸型 | `decodeAvatar` 在头发之后读的 int32。`UPDATE_STATS` 的脸也是 int32。`Face/` 下 3037 个 `islot=Fc` |
| `hair` | `attrs` | 八位编号，如 `00030000` | 头发 | `decodeAvatar` 里头发 int32。`Hair/` 下 6080 个 `islot=Hr` |
| `expression` | `attrs` | 表情名，默认 `default` | 脸图里的动作名 | 脸的计时和身体分开 |
| `equips` | `attrs` | 物品编号用逗号连成一条，如 `01040000,01060000` | 当前穿戴 | 每件用自己的 `info/islot` 决定槽位。逗号顺序不决定叠放。迭代器的槽位顺序仍是 Task 050 的未解项 |

属性值只能是字符串，单条最长 4096 字节。坐标和肤色在写入前转成十进制，脸和头发转成八位编号。`equips` 的编号之间用逗号，不加空格。没有装备时是空字符串。组件按逗号拆开。

```ts
attrs: {
  x: "120",
  y: "80",
  locomotion: "walk",
  facing: "right",
  skin: "0",
  face: "00020000",
  hair: "00030000",
  expression: "default",
  equips: "01040000,01060000",
}
data: { avatarPlan: { formatVersion: 1, zOrder: [...], actions: { stand1: { loop: true, frames: [...] } } } }
```

组件在自己的帧循环里读取动态属性；`receiveRenderData` 接收完整的 `avatarPlan`。坐标和动作变化不应重建外观计划；外观、动作帧或资源版本变化时，游戏侧投影新的计划。

名字在 `+0xF30`。第一阶段不画名字，所以没有 `display-name`。以后若要在宿主上给出可读名字，再加这一条属性。人物是谁由 `RenderNode.key` 保持，换场景不换 key。

`UPDATE_CHAR_LOOK` 还有一个性别字节。这些身体图和头图的 `info` 里没有性别字段，组件不按性别分叉。

宠物在 `+0x1BB4`，增益特效在 `+0x1BBC`，残影在 `Character.wz/Afterimage`，都不进这个元素。

第一阶段没有外观包时，属性用肤色 `0`、脸 `00020000`、头发 `00030000`、表情 `default`，`equips` 为空字符串。这三张图在本地 079 提取里都有，移动需要的 `stand1` / `walk1` / `jump` 也都在。

挥砍和施法的触发不写进属性，也不把触发命令写进 `RenderNode.data`。同一次施放走 `RenderDomain.emit` → `render.event` → `receiveRenderEvent`。事件不进 Renderer Store，不进快照，重建元素时不重放。`avatarPlan` 可以预先包含动作的静态帧定义，但事件只负责触发一次播放。对话组件里的 `commit`、`choice-next` 就是这条路。

```ts
receiveRenderEvent({ name: "action", data: { action: "brandish1" } })
```

这里的 `data` 是这一次事件的参数。`action` 的取值仍是 WZ 里的动作名：`Skill.wz` 的 `action` 节点，以及 `swing*` / `stab*` / `shoot*`。组件把这次播放记在自己的私有状态里。最后一帧走完，私有状态丢掉，画面回到属性 `locomotion`。播放中途又来一条 `action` 事件，丢掉上一次，从新动作的第 0 帧开始。

## 实现边界

`cms-actor` 只接收渲染就绪的 `avatarPlan`，通过 LoomRealm 注入的 `PresentationResourceClient` 读取图片。WZ/UOL 解析、`WzRecordAlias` 候选选择、`islot/vslot` 冲突消解和 `zmap/smap` 数据接入由游戏侧适配器负责，不在 Web Component 中读取文件或私有 Content Index。实现契约、资源生命周期、合成预览与测试见 [IMPLEMENTATION.md](./IMPLEMENTATION.md)。

当前合成实现用合成 PNG 验证锚点布局、z 顺序、动画和资源版本契约。历史 Draft PR #2 曾在 Agent 本地用真实素材（纸娃娃子集：肤色 0 身体、头、脸、头发、单手剑与 zmap）通过同一正式闭环，但该报告不在本仓库，结论须由持有合法素材的使用者以 `test/real-assets.local.test.mjs` 重跑确认；装备遮挡与表情独立计时仍属后续任务。

## 平台接入

LoomRealm Web Presentation Config v1 只以 ordered classic `<script src>` 加载业务脚本。组件因此交付 `browser/cms-actor.browser.js`（由 `scripts/build.mjs` 从 `src/` 确定性生成的 IIFE，无模块语法），并以 `presentation.json` 声明 Content 逻辑标识 `resource.Presentation/cms-actor/cms-actor.browser.js`（MIME essence `text/javascript`）。平台 PREPARE 固定版本与私有 browserSource；Renderer Window 用正式 `bootstrapWebPresentation()` 评估，`window.onload` 后才开始投影。

`avatarPlan` 有组件级硬边界：序列化后的 `RenderNode.data` 不超过 262,144 compact UTF-8 字节（AvatarPlanV1 应用层限制；LoomRealm Render Update v1 不规定通用 RenderNode.data 字节上限），动作 ≤ 32、每动作帧 ≤ 128、每帧画布 ≤ 32、锚点 ≤ 8，同一资源在计划内尺寸声明必须一致。计划只承载当前角色需要的动作，不携带全量人物/装备目录。最终合成画布同样有界：`devicePixelRatio` 钳制 ≤ 8，设备像素宽/高各 ≤ 8,192、面积 ≤ 3,145,728 设备像素（12 MiB RGBA），越界在给 `canvas` 赋值前以可定位错误拒绝。位图解码有并发硬上限与感知取消的等待队列，过期计划的解码工作被丢弃。部署步骤见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 图放在哪

`Character.wz` 根目录是身体和头，其余按目录归档。槽位以文件里的 `info/islot` 为准，不按文件名猜测。编号前四位和目录大体对应：`0002` 脸、`0003` 头发、`0100` 帽、`0104` 上衣、`0105` 长袍、`0106` 裤、`0107` 鞋、`0108` 手套、`0109` 盾、`0110` 披风、`0121`–`0160` 与 `0170` 武器。武器目录里仍有 362 个 `islot=Si`、23 个 `islot=Cp`，以 `islot` 为准。

肤色后缀决定身体和头：

| 后缀 | 身体 `islot=Bd` | 头 `islot=Hd` |
|---|---|---|
| 0、1、2、3、4、6、7、8、9、10、11 | `00002000` + 后缀 | `00012000` + 后缀 |
| 5 | 没有这张图 | 没有这张图 |
| 12、13 | 没有身体图 | 根目录的 `00002012`、`00002013`，以及 `00012012`、`00012013` |
| 14 | 没有身体图 | 根目录的 `00002014` |

同一后缀的身体，`walk1` 第 0 帧都是 27×32 的 `body` 和 12×17 的 `arm`，锚点同名。这些文件是同一套姿势的不同肤色，不是另一套骨架。`00002000` 有 148 个动作节点。`00002001`–`00002004` 和 `00002011` 有 42 个，`00002006`–`00002010` 约 103–106 个。缺的是技能引用动作。`stand1`、`walk1`、`walk2`、`jump`、`sit`、`prone`、`ladder`、`rope` 在抽查的 `00002001`、`00002006`、`00002011` 里都有。某个肤色没有该动作名时，身体沿用上一个画得出来的动作，不改去画 `00002000` 的肤色。

头的 `front/head` 带 `neck`、`brow`，`z=head`，`group=skin`。`back/head` 的 `z=backHead`。`00012000` 只有 `head`。`00012012` 和 `00002012` 的 `front` 里还有 `ear`，有就一起画。

带 `group=skin` 的画布是肤色块：身体、手臂、手、头，以及头发里的 `hairShade`。用对应肤色的那张图，不再套一层颜色公式。

## 装备槽

每件装备读 `info/islot` 和 `info/vslot`。`vslot` 是两个字符一组拼起来的。本地提取里的件数：

| 槽 | 目录和样本 | 件数 |
|---|---|---|
| `Cp` 帽 | `Cap/01000000`，`vslot=CpH1H5` | 2099，另有 42 个 `HrCp` |
| `Ma` 上衣 | `Coat/01040000`，`vslot=Ma` | 569，另有 103 个上衣的 `islot=MaPn` |
| `MaPn` 长袍 | `Longcoat/01050000` | 1348 |
| `Pn` 裤 | `Pants/01060000` | 564 |
| `So` 鞋 | `Shoes/01070000` | 987 |
| `Gv` 手套 | `Glove/01080000`，`vslot=GlGw` | 543 |
| `Si` 盾 | `Shield/01090000` | 133 |
| `Sr` 披风 | `Cape/01100000` | 611 |
| `Wp` 武器 | `Weapon/01302000` | 3528 |
| `WpSi` 双手武器 | `Weapon/01422057`，同时占武器和盾 | 922 |
| `Fc` 脸型 | `Face/` | 3037 |
| `Hr` 头发 | `Hair/00030000`，`vslot=H1H2H3H4H5H6HfHsHb` | 6080 |
| `Af` 脸饰 | `Accessory/01010000`，`z=accessoryFace`，锚点 `brow` | 416 |
| `Ay` 眼饰 | `Accessory/01012509` | 199 |
| `Ae` 耳饰 | `Accessory/01032000`，`z=accessoryEar`，另有 `backDefault` | 206 |

勋章 `Me`、吊坠 `Pe`、肩膀 `Sh` 的样本只有 `info` 里的图标，没有动作画布，不叠进人物。戒指目录 755 个 `islot=Ri`，同样只有在动作节点下有画布时才画。

`Base.wz/smap.img` 把画布的 `z` 映射到槽位。`cap` 这类层的值是一长串，`hair` 的值是单个 `H2`，`hairOverHead` 和 `backHair` 是 `H1`，`backHairBelowCapNarrow` 是 `H5`，`pants` 是 `PnSo`，`mailArm` 是 `MaGw`。值为空的层不声明槽位。

遮挡按客户端 `0x401C74`，在一帧里逐张画布计算，不按整件装备删除：

```text
priority = islot 各槽在 zmap 里的最大整数
tag      = vslot 与 smap[z] 的交，顺序跟 vslot
```

z 序号等于 `zmap["face"]` 的画布不参加这次占槽。其余画布按绘制顺序从后往前走。槽位归 `priority` 更大的那张；输的整张不画，但它在输掉之前占住的槽继续有效。`priority` 相同则两张都留。同一件装备共用一个 `islot`，所以自己不挡住自己。z 序只决定谁先画，以及同优先级时谁叠在前面。

帽子 `01000000` 的 `vslot` 是 `CpH1H5`。它的 `cap` 层因此声明 `H1`，`Cp` 的编号大于 `Hr`，头发的 `hairOverHead` 和 `backHair` 不画，主头发 `hair`（`H2`）留下。长袍 `MaPn` 和上衣 `Ma` 的 `priority` 都是 `Ma`，上衣留着，和袍身叠在同一 z。长袍的画布不声明 `Pn`，裤子留下，袍身靠 z 序盖在上面。双手武器 `WpSi` 的画布只声明 `Wp`，盾只声明 `Si`，盾留下。

## 动作名怎么定

身体是时间轴的主人。第一阶段运行库给 `locomotion`。没武器时后缀用 `1`：`stand1`、`walk1`。`jump` 不加后缀。

武器 `info` 里的整数改后缀。`01302000` 的 `walk=1`、`stand=1`，目录是 `walk1`、`stand1`。`01422057` 的 `walk=2`、`stand=2`，目录是 `walk2`、`stand2`，没有 `walk1`。同一套后缀用于身体、头、头发、衣服和武器。

`info/attack` 是武器类别，不单独变成动作名。`01302000` 的 `attack=1`，旁边有 `swingO1`。`01422057` 的 `attack=5`，同时有 `swingT1`、`swingT2`、`swingT3`、`swingTF` 和 `stabO1`、`stabO2`、`stabOF`。播哪一组由身体当前的动作名决定，武器跟同一个名字。`afterImage` 和 `sfx` 是挥砍残影和音效的名字，不在这个元素里画。

普攻和技能不走上面的后缀。运行库发 `action` 事件，身体按事件里的 `action` 取帧。这一帧如果引用了别的动作，头、头发、衣服、武器跟被引用的动作和帧号，因为武器图里没有 `airstrike`、`brandish1` 这种目录，只有 `swingO1`、`alert`。

某个部件没有解析之后的那个动作目录时，这一件不画。盾 `01090000` 有 `walk1`，没有 `walk2`。文件里没有指回别的动作的 uol 时，不另做回退。

## 动画怎么走

一个元素里面叠所有部件。走、站、跳时，身体、头、头发、衣服、武器共用身体的帧号。技能引用帧里，这些部件改跟被引用的那一帧。脸和脸饰用表情自己的帧号。

身体动作是一串数字帧：

| 动作 | 帧 | `delay` | 第 0 帧画布 |
|---|---|---|---|
| `stand1` | 0–2 | 500 | `body`（`z=body`，锚点 `neck`/`navel`）、`arm`（`z=arm`，锚点 `navel`/`hand`）。`face=1` |
| `walk1` | 0–3 | 180 | 同上。`00002000` 的第 0 帧身体 27×32，原点 (19, 32)，`navel=(-6,-20)`，`neck=(-4,-32)` |
| `walk2` | 0–3 | 180 | 另有 `hand`，`z=handOverHair` |
| `jump` | 0 | 200 | 另有 `lHand`（`handBelowWeapon`）、`rHand`（`handOverHair`）。`arm` 的 `z=armOverHair` |
| `prone` | 0 | 无 | uol 到 `proneStab/0` 的 `body` 和 `arm`。没有 `delay`，停在这一帧，直到动作改变 |
| `sit` | 0 | 无 | 自带 `body` 和 `arm`，同样停住 |
| `ladder`、`rope` | 0–1 | 250 | `body` 的 `z=backBody`，`face=0` |

`delay` 是毫秒。组件自己累加。运行库不逐帧推画面。

持续动作和单次动作分开：

| 种类 | 动作 | 播完以后 |
|---|---|---|
| 循环 | `stand1`、`stand2`、`walk1`、`walk2`、`ladder`、`rope`，以及它们的 `ladder2`、`rope2` 引用 | 回到第 0 帧 |
| 停住 | `jump`、`prone`、`sit`、`dead` | 停在当前这一帧，直到 `locomotion` 改掉。`jump` 落地才换 |
| 单次 | `receiveRenderEvent` 的 `action` | 最后一帧的时间走完就结束，下一帧改画属性 `locomotion`。不回到第 0 帧，也不停在最后一帧 |

身体帧上的 `short name="face"` 决定这一帧画不画脸。`stand1`、`walk1`、`jump` 是 1。`ladder`、`rope` 是 0。`swingOF` 和 `swingTF` 的各帧里 0 和 1 都有，按该帧的值来。值为 0 时，脸和跟着表情名走的脸饰都不画。

有的动作节点没有画布，只有引用。`prone2` 第 0 帧是 `action=proneStab`、`frame=0`、`delay=-700`，第 1 帧引用同一帧且 `delay=300`。技能动作几乎都是这种引用，见下一节。

部件帧里的 `uol` 先解开再读画布。头发 `00030000` 的 `walk1` 第 0 帧指回 `default` 的 `hairOverHead`、`hair`、`hairShade`。`ladder` 指回 `backDefault` 的 `backHair`、`backHairBelowCap`。帽子 `01000000` 的 `walk1` 指回 `default`。头 `00012000` 的 `walk1` 指回 `front/head`，`ladder` 指回 `back/head`。

衣服帧通常没有自己的 `delay`，跟身体帧号。帧号超过该部件的帧数时，用它的最后一帧。

头发 `hairShade` 标了 `group=skin`。节点下有画布 `0`。肤色后缀能对上同名子节点时用那张，否则用 `0`。`00030000` 里其余子节点是指回 `0` 的 uol。

## 释放技能

`Skill.wz` 里 75 个职业图、269 个带 `action` 的技能。`action` 下的字符串就是身体图里的动作名。出现最多的是 `alert2`，81 个。`11111004` 有两条：`0=brandish1`、`1=brandish2`。选哪一条的函数还没还原，运行库把选中的名字放进事件的 `action`。

`00002000` 的 148 个动作里，106 个是引用帧，没有自己的画布。`brandish1` 整段如下，停留时间是 `delay` 的绝对值：

| 帧 | 引用 | `delay` | 停留 |
|---|---|---|---|
| 0–2 | `swingOF` 的 0、1、2 | -120 | 各 120 毫秒 |
| 3 | `swingOF` 的 3 | 120 | 120 毫秒 |
| 4–6 | `stabOF` 的 0、1、2 | 120 | 各 120 毫秒 |

七帧一共 840 毫秒。第 6 帧结束之后，组件丢掉这次私有播放，人物回到属性里当时的 `locomotion`：站着就是 `stand1` 或 `stand2`，走着就是对应的 `walk`，人在空中就是 `jump`。画面不冻在 `stabOF` 的最后一帧上。

`vampire` 三帧全是负的 `delay`（各 -450），引用的是 `alert` 的三帧可见姿势。负号不表示这帧不画，否则这次施法没有身体。停留用绝对值。正数和负数在受击判定、武器残影上有没有差别，函数还没还原。两种 `delay` 的帧都画。残影目录 `Afterimage` 仍不进这个元素。

`swingO1` 是普攻，三帧自己带画布，`delay` 为 300、150、350，一共 800 毫秒。它走同一条单次规则：播完回到 `locomotion`，不循环。`stabO1`、`shoot1` 一样。

引用帧上的 `vector name="move"` 只加在这一帧的场景坐标上。下一帧用自己的 `move`，不把前面的位移累加。`airstrike` 的中间帧就带这种 `move`。10 个动作里有 17 帧写了 `flip=1`（例如 `bamboo`、`fist`）。这一帧在朝向翻转之外再翻转一次。

同一次施放可以带着技能图。`11111004` 的 `effect/0` 配 `brandish1`，`effect/1` 配 `brandish2`。那些画布有自己的 `origin` 和 `delay`，没有纸娃娃的 `map` 锚点，`origin` 对准身体原点。效果从施放的同一刻开始，按自己的 `delay` 播一遍，播完消失。它不跟身体帧号对齐，也不把身体动作拉长。`11111001` 的 `effect` 是 7 张画布，100 到 270 毫秒。`hit` 画在受击者身上，不画在这个元素里。

播放中途又收到一条 `action` 事件，旧的身体帧和这次技能图都丢掉，新动作从第 0 帧开始。

武器 `info/attackSpeed` 存在。攻击速度怎么缩放这些 `delay`，Task 061 里没有这条公式。组件先用文件里的毫秒。

## 表情

表情是脸图里的动作，和身体的走、跳分开计时。脸 `00020000` 的画布都叫 `face`，`z=face`，锚点 `brow`。

`default` 不是数字帧，是一张画布，一直画到表情名改变。其余名字：

| 表情 | 帧和 `delay` |
|---|---|
| `blink` | 3 帧，各 60 |
| `hit`、`smile`、`troubled`、`cry`、`angry`、`bewildered`、`stunned`、`oops`、`cheers`、`chu`、`wink`、`pain`、`shine` | 1 帧，无 `delay`，停住 |
| `vomit` | 2 帧，各 120 |
| `glitter`、`despair`、`love` | 2 帧，各 150 |
| `blaze`、`hum`、`bowing`、`hot` | 2 帧，各 110 |
| `dam` | 2 帧，各 240 |
| `bangle`、`setback`、`wickedness` | 8 帧，各 240 |

多帧表情播完回到第 0 帧。表情名一变就从第 0 帧重播，不跟着身体帧重置。

脸饰若有和表情同名的节点，用表情的帧号。`Accessory/01010000` 的 `blink`、`smile` 指回它自己的 `default`。没有这个表情名时用 `default`。

`Face/CommonFaceCN.img` 另有 `nosebleed`，4 帧、各 180，`z=face`。它不是 3037 个脸型编号之一。运行库把表情名指到这里时才画。

`FACE_EXPRESSION` 的包布局在 Task 056 里不可靠。组件只认运行库给的表情名。

## 锚点

先放身体。身体画布的 `origin` 放在运行库的 `(x, y)` 上，技能引用帧再加 `move`。样本里 `origin.y` 等于高度，底边落在场景坐标上。纸娃娃内部的对齐点是 `map` 里的向量，向量相对 `origin`。

身体放下之后，同名锚点已经有了场景位置。后放的画布选出一个自己带有、且已经存在的锚点，重合到那个位置。一张画布带多个点时，按 `navel`、`neck`、`hand`、`brow`、`handMove` 的顺序取第一个已经存在的。

这样串起来的样本：

- 头的 `neck` 对身体的 `neck`，再记下头的 `brow`。
- 脸、头发、帽子、眼饰、耳饰的 `brow` 对头的 `brow`。
- 上衣 `mail` / `mailArm`、裤子、鞋、披风、盾的 `navel` 对身体的 `navel`。`Coat/01040000` 的 `walk1` 第 0 帧是 `mail`（`z=mailChest`）和 `mailArm`（`z=mailArm`）。
- 武器的 `hand` 对当前帧手臂的 `hand`。`01302000` 的 `walk1` 第 0 帧是 `weapon`，`z=weapon`。
- 手套 `01080000` 的 `walk1` 第 0 帧是 `lGlove`（`z=gloveOverBody`）和 `rGlove`（`z=glove`），锚点都是 `navel`。

朝向向左时，整个合成结果绕身体 `origin` 的 x 翻转，不为左右各备一套图。锚点的 x 一起翻转，部件仍然重合。

## 叠放顺序

每张画布有字符串 `z`。顺序在 `Base.wz/zmap.img`。子节点从前到后：靠前的名字盖住靠后的名字。`characterStart` 是人物层最前，`characterEnd` 是人物层最后。表尾的 `Bd`、`Hd`、`Hr`、`Fc` 等两个字母是槽位代号，不是画布的 `z`。

同一文件里靠前的层包括 `weaponOverGlove`、`handOverHair`、`capOverHair`、`hairOverHead`、`cap`、`hair`、`face`、`head`。靠后的层包括 `body`、`backHair`、`backHead`、`backBody`。同一次绘制里，先画靠近 `characterEnd` 的画布，再画靠近 `characterStart` 的画布。

`zmap_cn.img` 是同目录的另一张表。人物用 `zmap.img`。

本地合成工具 `wzpy/character.py` 读到这张表后会反转，让序号小的画在后面。组件直接按文件顺序理解：文件里越靠前，越盖在上面。爬绳子时工具里另有一套把 `backHair` 抬到身体之前的覆盖表，那是工具自己的修正，不是 `zmap.img` 里的顺序，组件不用。

## 第一阶段画出来的人

肤色 `0` 的身体和头、脸 `00020000`、头发 `00030000`、表情 `default`。移动时播 `stand1`、`walk1`、`jump`。游戏侧把这些动作解析成 `avatarPlan` 后交给组件；装备层也使用相同的画布描述、锚点和 z 顺序。第一阶段的运行库不施放技能。运行库要播一次性动作时，对这个元素的 key 发 `action` 事件。

`key` 在换场景时不变。只更新 `x`、`y`，落地时把 `locomotion` 设回 `stand`。

## 还不从字节里猜的部分

- `stance` 这一个字节如何分成动作和朝向。保留状态里，`locomotion` 和 `facing` 是属性。挥砍和施法是 `action` 事件。
- 装备迭代里每个 int32 的槽位含义。组件认 `equips` 里的物品编号。
- 技能 `action` 有 `0` 和 `1` 两条时，选哪一条。组件认运行库给的动作名。
- 负 `delay` 和正 `delay` 在判定、残影上的差别。画面上都按绝对值停留。
- `attackSpeed` 对帧间隔的缩放。
- 性别字节。现有身体和头的 `info` 里没有这个字段。
