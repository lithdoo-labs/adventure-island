# CMS 079 WZ 到 LoomRealm FSDB：规范化转换设计

> 状态：设计文档；不代表转换器已实现或全量校验已通过。  
> 输入：使用者本地自行合法取得的 CMS v079 客户端 16 个标准 WZ。服务端 XML 只辅助核对节点和字段，不能代替客户端 WZ 中的 Canvas 和 Sound 字节。  
> 约束：仓库不提交 WZ、客户端、提取出的全量 FSDB、图片和音频。公开测试只使用最小合成素材。

规范依据：

- [FSDB layout](https://github.com/lithdoo/loom-realm/blob/main/doc/20-modules/fsdb-content-service/fsdb-layout.md)：目录命名、四类表、metadata、Well-formed/Integrity-valid。
- [Content API v1](https://github.com/lithdoo/loom-realm/blob/main/doc/15-contracts/content-api-v1.md)：Content 逻辑标识、Group/Record/Resource 及版本。
- [Web Presentation API v1](https://github.com/lithdoo/loom-realm/blob/main/doc/15-contracts/web-presentation-api-v1.md)：资源读取必须提供 expectedContentVersion。
- 仓库内逆向证据：`research/result/20-wz-inventory.md`、`research/result/23-wz-library-cross-validation.md`、`research/result/57-wz-data-layer.md`、`research/result/60-map-extraction-complete.md`。

## 1. 转换过程与责任边界

```text
本地 16 个 PKG1 WZ
→ 样本身份 / 版本 / IV / IMG 清单核验
→ Typed WZ 属性树解码：标量、子树、Vector、Canvas、Sound、UOL
→ 规范化 IR：源路径、类型、顺序、引用关系
→ 按业务映射为 struct、group、resource
→ 写入 FSDB 数据与必需 metadata
→ 对 FSDB 做结构、schema 与引用完整性校验
→ 平台 PREPARE 建立可信 Content Index / contentVersion
→ Subsystem 与 Renderer 通过 Content API 读取
```

转换器写 **`[FSDB]cms/` 下的表及元数据**，不得手写或擅自修改平台 Content Index。平台如生成 `fsdb.index.json`，其属于 prepared installation 的索引产物，不是转换器维护的 FSDB 业务记录，也不要求它必须放在数据库目录下。所有文件只生成于使用者本机。

原始 WZ 数字保留为 JSON number，字符串仍为 string；可选字段缺失不虚构默认值。纸娃娃 `origin`、`z`、`map` 锚点，帧 `delay` 与图片宽高留在对应结构记录中；像素独立解码为 PNG。音频写出经确定格式的有效载荷，后缀必须匹配实际内容；若格式仍不确定，应作为 opaque binary 保真并标识不能直接播放，不能把封装未知的字节假称为 MP3。

UOL 在落盘前解析，同一 Canvas 可被多个帧指向；必须对相对路径、悬空引用、循环、跨节点目标建立显式规则。Task 023 的 60 条 UOL 样本仅 54 条三方解析目标完全一致，不能直接照搬某一解析库的默认语义；无法确定的引用让导入失败并报告原始 WZ 路径。

## 2. FSDB 的强制物理协议

数据库根名固定 `[FSDB]cms`。FSDB 数据库下只识别四种表目录：`[struct]T`、`[extend]T`、`[group]T`、`[resource]T`；同名不同 kind 的表可以同时存在。**WZ 包名目录不自动变成 FSDB 嵌套表目录。**

| 表目录 | 数据文件 | 必须生成的元数据 | 可选元数据 |
|---|---|---|---|
| `[struct]T` | `{key}.json`，JSON object | `.info.meta` | `.desc.meta` |
| `[extend]T` | `{key}.json`，JSON object | `.info.meta`、`.extend.meta` | `.desc.meta` |
| `[group]T` | `{key}.jsonl`，每个非空行是 JSON object | `.info.meta`、`.desc.meta` | `.extend.meta` |
| `[resource]T` | `{路径}.{扩展名}`，opaque bytes | 资源表根目录 `.desc.meta` | — |

- `.info.meta` 必须是 JSON Schema；**group schema 描述每一行 object，不是数组或整个文件**。Schema 建议声明明确的 `$schema` 方言，缺失属性按实际 WZ 数据建模。
- `.extend.meta` 是 JSONL，每行结构为 `{"field":"bS","struct":"Back","desc":"背景定义"}`。它仅用于 `extend` 或 `group` 记录的**直接字符串字段**引用某张 `[struct]` 表，不能描述任意嵌套路径、声音路径、资源 key。
- `.desc.meta` 是 Markdown；group 说明键的分组依据、行顺序与业务含义；resource 说明资源命名与格式。资源子目录不创建 metadata scope，描述文件位于资源表根目录。
- JSON、JSONL、所有 metadata 文本一律 UTF-8 without BOM。JSONL 的每个非空行须为 JSON object，不能将图像/声音字节 Base64 嵌入记录。
- `struct`、`extend`、`group` 的 key **只能是一个 NameSegment**；只有 `resource` 的 key 可由多个 NameSegment 通过 `/` 连接。所有 data candidate 和 metadata 必须是常规文件/目录，不可使用 symlink、junction 等文件系统间接引用。
- NameSegment 必须是 NFC Unicode，NFC 后 UTF-8 1..200 bytes，不以 Unicode 空白开头/结尾、不以 `.` 或 `$` 开头、不以 `.` 结尾，排除 `/ \ < > : " | ? *`、NUL、控制字符和 Windows 设备保留名（CON、NUL、COM1 等）。归一化后同名必须报错；不做静默 trim/大小写变换/非法名替换。
- 资源文件扩展名应匹配 `[a-z0-9][a-z0-9_-]{0,31}`；逻辑 ResourceKey 去掉**最后一个**扩展名。相同资源表内 `body.png` 与 `body.webp` 的逻辑 key 相同，属于冲突，不能共存。所有资源路径段同样做 NameSegment 检查。

本转换不创建 `[extend]` 表：WZ 节点本身没有被证明需要一套独立的 extend 实体模型。以后确有需求再增加，不能用 extend 代替 struct 中的嵌套子树。

## 3. 规范化的输出目录

这是**目标输出示意**而非本仓库实际生成的全量 FSDB。每张 struct 表都必须带 `.info.meta`；每张 group 表都必须带 `.info.meta` 和 `.desc.meta`；所有图/音 resource 表根都必须带 `.desc.meta`。未展示的同类文件按真实 WZ 节点生成，目录中不放装饰性空表。

```text
[FSDB]cms/
├── [struct]Map/
│   ├── .info.meta
│   ├── 100000000.json
│   └── 105090321.json
├── [struct]Tileset/
│   ├── .info.meta
│   └── woodMarble.json
├── [struct]Back/
│   ├── .info.meta
│   └── grassySoil.json
├── [struct]Obj/               # .info.meta + 每种物件图集 JSON
├── [struct]Physics/
│   ├── .info.meta
│   └── default.json
├── [struct]WorldMap/          # .info.meta + 世界地图
├── [struct]MapEffect/         # .info.meta + 地图效果
├── [struct]MapHelper/         # .info.meta + 门/天气/UI 辅助资源索引
├── [struct]Look/
│   ├── .info.meta
│   ├── 00002000.json
│   ├── 00012000.json
│   └── 01302000.json
├── [struct]Afterimage/        # .info.meta + 残影定义
├── [struct]Item/              # .info.meta + 物品定义
├── [struct]TextMap/           # .info.meta + Map 字符串
├── [struct]TextMob/           # .info.meta + Mob 字符串
├── [struct]TextNpc/           # .info.meta + Npc 字符串
├── [struct]TextSkill/         # .info.meta + Skill 字符串
├── [struct]Text.../           # 其余 String.wz 的分类表
├── [struct]Mob/               # .info.meta + 怪物定义
├── [struct]QuestCountGroup/   # .info.meta + 怪物关联分组
├── [struct]Npc/               # .info.meta + NPC 定义
├── [struct]Reactor/           # .info.meta + Reactor 定义
├── [struct]Skill/             # .info.meta + 技能定义
├── [struct]Sound/             # .info.meta + 声音索引
├── [struct]Effect/            # .info.meta + 效果
├── [struct]Morph/             # .info.meta + 变身
├── [struct]Taming/            # .info.meta + 骑宠
├── [struct]Ui/                # .info.meta + UI
├── [struct]ZMap/              # .info.meta + order.json
├── [struct]ZMapCn/            # .info.meta + order.json
├── [struct]SMap/              # .info.meta + smap.json
├── [struct]StandardPDD/       # .info.meta + 0..5.json
├── [struct]Etc/               # .info.meta + 各 Etc img
├── [struct]QuestAct/          # .info.meta + Quest.wz/Act.img
├── [struct]QuestCheck/        # .info.meta + Check.img
├── [struct]QuestQuestInfo/    # .info.meta + QuestInfo.img
├── [struct]QuestSay/          # .info.meta + Say.img
├── [struct]QuestExclusive/    # .info.meta + Exclusive.img
├── [struct]QuestPQuest/       # .info.meta + PQuest.img
│
├── [group]Back/
│   ├── .info.meta
│   ├── .desc.meta
│   ├── .extend.meta            # 可选：bS → struct.Back
│   └── 100000000.jsonl
├── [group]Tile/
│   ├── .info.meta
│   ├── .desc.meta
│   └── 100000000.jsonl
├── [group]Obj/                # .info.meta + .desc.meta + 地图.jsonl
├── [group]Portal/
│   ├── .info.meta
│   ├── .desc.meta
│   └── 100000000.jsonl
├── [group]Foothold/
│   ├── .info.meta
│   ├── .desc.meta
│   └── 100000000.jsonl
├── [group]Life/
├── [group]Reactor/
├── [group]Seat/
├── [group]Rope/
├── [group]Area/
├── [group]SwimArea/
├── [group]Weather/
├── [group]ToolTip/
├── [group]MapUser/
│
├── [resource]图/
│   ├── .desc.meta
│   ├── Tile/woodMarble/bsc/1.png
│   ├── Back/grassySoil/back/0.png
│   ├── MiniMap/100000000.png
│   ├── Look/00002000/walk1/0/body.png
│   ├── Obj/...
│   ├── Mob/...
│   ├── Npc/...
│   ├── Skill/...
│   ├── Effect/...
│   └── Ui/...
└── [resource]音/
    ├── .desc.meta
    └── Sound/Bgm00/FloralLife.mp3  # 仅在实际音频载荷确认为 MP3 时
```

这里明确将图和声音分表：`[resource]图` 收 Canvas PNG，`[resource]音` 收 Sound 载荷。旧稿在 `[resource]图/Sound/...` 混放二者的设计不再使用。任一 group 表若生成具体数据文件，都必须同时满足元数据约束，即使上面的树只省略列出。

### 3.1 Content 逻辑标识

| FSDB 文件 | kind | namespace | key |
|---|---|---|---|
| `[struct]Map/100000000.json` | record | `struct.Map` | `100000000` |
| `[group]Tile/100000000.jsonl` | group | `group.Tile` | `100000000` |
| `[struct]Look/00002000.json` | record | `struct.Look` | `00002000` |
| `[resource]图/Look/00002000/walk1/0/body.png` | resource | `resource.图` | `Look/00002000/walk1/0/body` |
| `[resource]音/Sound/Bgm00/FloralLife.mp3` | resource | `resource.音` | `Sound/Bgm00/FloralLife` |

普通 JSON/JSONL 文件的最后后缀不进入 key；资源也不将最后扩展名放进 key。必须保留 8 位/9 位编号的前导零。物理目录路径不是对业务公开的 Content 能力；业务只使用 logical identity。

## 4. 缩样数据和必需元数据

下面以射手村 `100000000` 和身体 `00002000` 为例，仅展示某些节点，**不宣称是完整导出**。为演示瓦片放置能够解析到下方的示例图集，JSONL 的 `no` 使用 1；原研究抽样中实际也出现了 `no=3`，真实转换器必须保留原编号并输出对应图集项。

`[struct]Map/100000000.json`：

```json
{
  "info": {
    "version": 10,
    "cloud": 0,
    "town": 1,
    "mobRate": 0.4999999,
    "bgm": "Bgm00/FloralLife",
    "returnMap": 100000000,
    "forcedReturn": 999999999,
    "hideMinimap": 0,
    "moveLimit": 0,
    "mapMark": "Henesys",
    "swim": 0,
    "fieldLimit": 0,
    "fly": 0,
    "noMapCmd": 0,
    "onUserEnter": "explorationPoint"
  },
  "miniMap": {
    "width": 7174,
    "height": 1391,
    "centerX": 798,
    "centerY": 661,
    "mag": 4,
    "canvas": "MiniMap/100000000"
  },
  "layers": [
    { "layer": "0", "tileSet": "woodMarble" }
  ]
}
```

各分组的 JSONL 文件分别保存对象行，下面是三个独立文件的缩样：

`[group]Back/100000000.jsonl`：

```jsonl
{"bS":"grassySoil","no":0,"x":0,"y":0,"rx":0,"ry":0,"type":3,"cx":0,"cy":0,"a":255,"front":0,"ani":0,"f":0}
```

`[group]Tile/100000000.jsonl`：

```jsonl
{"layer":"0","x":4005,"y":330,"u":"bsc","no":1,"zM":4}
```

`[group]Portal/100000000.jsonl`：

```jsonl
{"pn":"sp","pt":0,"x":112,"y":197,"tm":999999999,"tn":""}
```

`[struct]Tileset/woodMarble.json`：

```json
{"bsc":[{"no":1,"resource":"Tile/woodMarble/bsc/1","origin":[0,0],"z":0,"width":90,"height":60}]}
```

`[struct]Look/00002000.json` 的 `walk1/0/body` 子树中应包含：

```json
{"resource":"Look/00002000/walk1/0/body","origin":[19,32],"z":"body","map":{"navel":[-6,-20],"neck":[-4,-32]}}
```

`[struct]Physics/default.json` 是单独一条记录，保存 `Physics.img` 的 19 个原始常量，例如 `walkForce=140000`、`walkSpeed=125`、`gravityAcc=2000`、`fallSpeed=670`、`jumpSpeed=555`、`floatCoefficient=0.01`；静态常量不代表连续运动/碰撞积分算法已经被验证。

**每张表的 metadata 需要实际生成**。例如 `[group]Tile/.info.meta` 是对每条瓦片对象的 schema：

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "layer": { "type": "string" },
    "x": { "type": "number" },
    "y": { "type": "number" },
    "u": { "type": "string" },
    "no": { "type": "integer" },
    "zM": { "type": "number" }
  },
  "required": ["layer", "x", "y", "u", "no"],
  "additionalProperties": true
}
```

`[group]Tile/.desc.meta` 是 Markdown，写明：分组 key 为九位地图编号，每行是一条按原 WZ 顺序排列的瓦片放置；`layer` 在 `struct.Map.layers[]` 查 `tileSet`，瓦片 `zM` 不同于 Canvas 自身的 `z`。

若 `[group]Back/.info.meta` 把 `bS` 声明为 string，才可写 `[group]Back/.extend.meta`：

```jsonl
{"field":"bS","struct":"Back","desc":"引用 struct.Back 中的背景定义"}
```

`[group]Obj` 同理允许直接字符串字段 `oS → struct.Obj`。**不能**为 `struct.Map.layers[].tileSet`、`struct.Map.info.bgm` 伪造 group-level `.extend.meta`。以上只是元数据样例，其余 struct/group schema 和描述文件同样属于构建必需产物。

## 5. Map.wz

### 地图信息

`struct.Map/{九位编号}` 的 `info` 收下该图 `info` 上的全部标量。这批图里出现过：

`version`、`cloud`、`town`、`mobRate`、`bgm`、`returnMap`、`forcedReturn`、`hideMinimap`、`moveLimit`、`mapMark`、`swim`、`fieldLimit`、`fly`、`noMapCmd`、`onUserEnter`、`onFirstUserEnter`、`fs`、`recovery`、`VRLeft`、`VRTop`、`VRRight`、`VRBottom`、`VRLimit`、`link`、`mapDesc`、`mapName`、`streetName`、`help`、`effect`、`fieldType`、`timeLimit`、`decHP`、`decInterval`、`rain`、`snow`、`miniMapOnOff`、`createMobInterval`、`fixedMobCapacity`、`noRegenMap`、`everlast`、`scrollDisable`、`protectItem`、`personalShop`、`entrustedShop`、`lvLimit`、`lvForceMove`、`allMoveCheck`、`damageCheckFree`、`blockPBossChange`、`reactorShuffle`、`reactorShuffleName`、`zakum2Hack`、`PvPWaitingRoom`。

样本 `105090321` 的顶层只有 `info`，`link` 指向 `105090320`。这种图只写 `link`，不复制目标图的放置。运行库要画面时去读被指的那张，场景编号仍用当前键。

`miniMap` 写在同一条记录里：`width`、`height`、`centerX`、`centerY`、`mag`，画布资源键 `MiniMap/{地图编号}`。边界仍由运行库按 VR、小地图、立足线这三条现成规则计算，不把扩边后的矩形写进内容。

`layers` 列出文件里真有的 `"0"` 到 `"7"`，每层带 `tileSet`（`info/tS`）。`tSMag` 有则留下。它不是绘制倍率：`snowyLightrock2` 的 `bsc` 画布已经是 180×120。

一张图上只出现一次的节点，嵌进 `struct.Map`：

| 节点 | 见过的字段 |
|---|---|
| `clock` | `x` `y` `width` `height` |
| `coconut` | `countFalling` `countBombing` `countStopped` `countHit`，四段 `time*`，`effectWin` `effectLose` `soundWin` `soundLose` `eventName` `eventObjectName` |
| `healer` | `x` `yMin` `yMax` `fall` `rise` `healMin` `healMax` `healer` |
| `pulley` | `x` `y` `pulley` |
| `pvp` | `timeDefault` `effectWin` `effectLose` `effectDraw` `soundWin` `soundLose` |
| `snowBall` | 两侧子节点 `0` `1`，以及 `x` `x0` `xMin` `xMax` `dx` `damageSnowBall` `damageSnowMan0` `damageSnowMan1` `recoveryAmount` `snowManHP` `snowManWait` `speed` `section1` `section2` `section3` |
| `snowMan` | `path` |
| `shipObj` | `shipObj` `shipKind` `x` `x0` `y` `z` `tMove` `f` |
| `mobMassacre` | `mapDistance`，以及 `gauge`、`countEffect` 子树 |
| `monsterCarnival` | `mobGenPos`、`mob` 子树，时间四段，胜负效果和音效，`rewardMapWin` `rewardMapLose` `mobGenMax` `mapDivided` `deathCP` `guardianGenMax` `reactorRed` `reactorBlue` |
| `noSkill` | `class` 子树 |
| `BuffZone` | 子树，样本里有 `hill` |

### 地图上的重复节点

分组键是地图编号，一行一个，顺序跟 WZ 子节点一致。

| 分组 | 一行里的字段 |
|---|---|
| `group.Back` | `bS` `no` `ani` `x` `y` `rx` `ry` `type` `cx` `cy` `f` `a` `front` |
| `group.Tile` | `layer` `x` `y` `u` `no` `zM` |
| `group.Obj` | `layer` `oS` `l0` `l1` `l2` `x` `y` `z` `f` `zM`，有则带 `r` `reactor` `name` `flow` `rx` `ry` `cx` `cy` `force` `forbidFallDown` `tags` `maep` |
| `group.Portal` | `pn` `pt` `x` `y` `tm` `tn` `script`，有则带 `delay` `onlyOnce` `image` `hRange` `vRange` `f` `hideTooltip` `horizontalImpact` |
| `group.Life` | `type` `id` `x` `y` `cy` `fh` `f` `rx0` `rx1` `hide`，有则带 `limitedname` `mobTime` `info` `team` |
| `group.Reactor` | `id` `x` `y` `reactorTime` `f` `name` |
| `group.Seat` | `index` `x` `y` |
| `group.Foothold` | `id` `layer` `platform` `x1` `y1` `x2` `y2` `prev` `next` `force` `forbidFallDown` |
| `group.Rope` | `id` `x` `y1` `y2` `l` `uf` `page` |
| `group.Area` | `x1` `y1` `x2` `y2` |
| `group.SwimArea` | 子节点名（样本是 `sea`）以及 `x1` `y1` `x2` `y2` |
| `group.Weather` | `time` `item` `msg` `option` |
| `group.ToolTip` | 子节点名（样本有 `0` 和 `0char`）以及它下面的标量，矩形样本是 `x1` `y1` `x2` `y2` |
| `group.MapUser` | `user` 下的编号子节点，子树原样 |

立足线以地图节点 `foothold` 为准。瓦片画布上的 `extended/foothold` 记在图集记录里，不另写一套碰撞。类型 `m` 和类型 0 的出口都留下。

### 地图用的图

`struct.Tileset/{图集名}`：每个 `u` / `no` 的资源键、`origin`、`z`、宽高，以及画布上若有的 `extended/foothold`。资源键 `Tile/woodMarble/bsc/0`。

`struct.Back/{bS}`：`back` 与 `ani` 两个目录的帧，资源键、`origin`、`delay`。资源键 `Back/grassySoil/back/0`。

`struct.Obj/{oS}`：`l0/l1/l2` 下的帧。资源键 `Obj/acc5/aquaRoad/fish/0/0`。

`struct.Physics` 一条键 `default`，来自 `Physics.img` 的 19 个小数：`walkForce`、`walkSpeed`、`walkDrag`、`slipForce`、`slipSpeed`、`floatDrag1`、`floatDrag2`、`floatCoefficient`、`swimForce`、`swimSpeed`、`flyForce`、`flySpeed`、`gravityAcc`、`fallSpeed`、`jumpSpeed`、`maxFriction`、`minFriction`、`swimSpeedDec`、`flyJumpDec`。

`struct.WorldMap/{img 名}`：`WorldMap` 目录下 18 个 img 各一条，子树保留，画布进资源。

`struct.MapEffect`：`Map.wz/Effect.img` 的每个分类（`quest`、`aran`、`directionArrow` 等）一条，帧进资源。

`struct.MapHelper`：`portal/game` 的 `pv`、`ph`、`psh`，`portal/editor` 的 13 张图标（`sp` 到 `pcj`），以及 `weather`、`mark`、`worldMap`、`AvatarMegaphone`、`minimap`。游戏出口画 `portal/game`。编辑器图标留下，运行库不把它画成出口。

只有 JSONL 每行**直接存在且类型为 string 的字段**才可在该 group 的 `.extend.meta` 声明对 struct 的引用，例如 `group.Back.bS → struct.Back` 和 `group.Obj.oS → struct.Obj`。`tileSet` 位于 `struct.Map.layers[]`、`bgm` 位于 `struct.Map.info`，不属于 group 的直接字段；这两类嵌套引用由转换器进行应用级完整性检查，不能误用 `.extend.meta`。


## 6. Character.wz

根目录的身体 `00002000`–`00002014` 和头 `00012000` 起，以及这些目录里的每张 img，都是 `struct.Look/{八位编号}`：

`Accessory`、`Bits`、`Cap`、`Cape`、`Coat`、`Face`、`Glove`、`Hair`、`Longcoat`、`Pants`、`PetEquip`、`Ring`、`Shield`、`Shoes`、`SkillSkin`、`TamingMob`、`Weapon`、`MonsterBattle`。

`info` 上的标量都留下。武器 `01302000` 见过 `islot`、`vslot`、`walk`、`stand`、`attack`、`afterImage`、`sfx`、`reqJob`、`reqLevel`、`reqSTR`、`reqDEX`、`reqINT`、`reqLUK`、`incPAD`、`tuc`、`price`、`attackSpeed`、`cash`，以及 `icon`、`iconRaw`。

每个动作一串帧。有画布的帧记 `delay` 和每张画布的名字、资源键、`origin`、`z`、`group`、`map` 锚点。引用帧记 `action`、`frame`、`delay`，有则带 `move`、`flip`。资源键 `Look/00002000/walk1/0/body`。

`struct.Afterimage/{名字}` 来自 `Afterimage` 目录，帧同样进资源。纸娃娃元素不画残影，数据仍留下。


## 7. 其余 WZ 包与辅助表的映射

表中 `struct.T/{key}` 是 namespace 与 key 的写法，物理上是 `[struct]T/{key}.json`。图片总是进入 `[resource]图`，声音总是进入 `[resource]音`；JSON 保存资源逻辑 key 与锚点，不携二进制。

| WZ | FSDB 目标 | 内容 |
|---|---|---|
| `Item.wz` | `struct.Item/{八位编号}` | `Cash`、`Consume`、`Etc`、`Install`、`Pet`、`Special` 的节点与图标；装备属性也见于 `struct.Look.info` |
| `String.wz` | `struct.TextMap/{id}`、`struct.TextMob/{id}`、`struct.TextNpc/{id}`、`struct.TextSkill/{id}` 等 `Text{分类}` 表 | 各分类 IMG 的本地化字符串；不再把所有分类按末级编号混在 `struct.Text` |
| `Mob.wz` | `struct.Mob/{七位编号}`、`struct.QuestCountGroup/{key}` | `info` 与 `move`、`stand`、`hit1`、`die1` 等帧；包含 `level`、`maxHP`、`speed`、伤害和经验字段 |
| `Npc.wz` | `struct.Npc/{编号}` | `info`、已有动作目录和帧；`1012000` 的样本只有 `stand` |
| `Reactor.wz` | `struct.Reactor/{编号}` | `0`、`1`、`2` 等状态、`event`、`hit`；地图放置用 `group.Reactor` |
| `Skill.wz` | `struct.Skill/{技能编号}` | 三类图标、`level` 下逐级值、`action`、`effect`、`hit`、`finalAttack` 和 Canvas |
| `Sound.wz` | `struct.Sound/{img 名}`，`resource.音/Sound/{img 名}/{声音名}` | `Bgm00` 的 `FloralLife` 等，元数据与声音字节分别保存 |
| `Effect.wz` | `struct.Effect/{img 名}` | `BasicEff` 的 `LevelUp`、`QuestClear` 等及其动画 |
| `Morph.wz` | `struct.Morph/{编号}` | `speed`、`jump`、`fs`、`swim` 与动作目录 |
| `TamingMob.wz` | `struct.Taming/{编号}` | `speed`、`jump`、`fs`、`swim`、`fatigue` 与动作 |
| `UI.wz` | `struct.Ui/{img 名}` | `StatusBar`、`Login`、`UIWindow`、`NameTag` 等 |
| `Base.wz` | `struct.ZMap/order`、`ZMapCn/order`、`SMap/smap`、`StandardPDD/{0…5}` | 绘制顺序、槽位映射、职业基础表；包链接空目录不独立建表 |
| `Etc.wz` | `struct.Etc/{img 名}` | `MakeCharInfo`、`ForbiddenName`、`ItemMake`、`NpcLocation`、`RecommendSkill`、`Commodity`、`CashPackage`、`QuestCategory` 等各 IMG 的原始子树 |
| `Quest.wz` | `struct.QuestAct`、`QuestCheck`、`QuestQuestInfo`、`QuestSay`、`QuestExclusive`、`QuestPQuest` | 六个实际 IMG：`Act`、`Check`、`QuestInfo`、`Say`、`Exclusive`、`PQuest`；按真实实体编号拆分为合法单段 key，无法拆分的子树要明确保存策略与记录大小上限 |

上述表覆盖全部标准 16 包，`Map.wz` 和 `Character.wz` 的映射单列在前文。String 的其他分类：`Eqp`、`Etc`、`Consume`、`Ins`、`Cash`、`Pet`、`Item`、`MonsterBook`、`PetDialog`、`ToolTipHelp`、`EULA`；一类对应一张 `Text{分类}` 表。在**同类内部**出现同末级 ID 不同原始路径时，必须定义明确、稳定且可追溯的单段 key 规则并记录映射；不能覆盖、截断或跳过。Quest 也必须有真实目标表，不能只在文字中声明“已导入”。

旧任务脚本、原成长经验、现金商城商品规则即使作为原始数据保留，是否执行仍由游戏的 `DESIGN.md` 决定：游戏可以自制任务、升级与现金商城机制。

## 8. Content API 与运行时接入

Content HTTP v1 已定义：

```text
GET /_lr/v1/games/{installationId}/records/{namespace}/{key}
GET /_lr/v1/games/{installationId}/groups/{namespace}/{key}
GET /_lr/v1/games/{installationId}/resources/{namespace}/{key...}
```

`namespace/key` 是逻辑 identity，不是文件路径。平台可信 Content Index 映射真实 FSDB 文件。`contentVersion` 必须由成功返回的完整 body bytes 的 SHA-256 得到，精确格式为 `sha256:<64 lowercase hex>`；Record/Group/Resource 各自独立计算，不得使用 mtime 或 WZ 版本冒充。平台 PREPARE 阶段生成索引、版本和安装事实；不在转换器里手写它们。

**资源版本必须进入 Renderer 投影**：转换后的 JSON 中 `resource` 字段是 logical key，但 Web Component 的 `resources.resource(namespace, key, expectedContentVersion)` 第三个参数必填。运行时必须先从可信 Content API 获得对应 `contentVersion`，再把 `{resourceKey,contentVersion}` 投影到 Renderer 可读数据。第一阶段可通过 Subsystem `content.resource()` 读取字节并获取版本（需避免重复加载大量素材）；若要单独提供轻量版本查询，须正式扩展允许的 API，不能从业务模块直接偷读私有 Index/URL/物理路径。否则只有 `resource` 字符串并不能在 Web Presentation v1 里完成取图。

**Group 的当前阻塞**：LoomRealm `packages/subsystem/src/content.ts` 的 `ContentClient` 当前只有 `record()`、`resource()`，**没有 `group()`**；尽管 FSDB Core 和 Content HTTP 有 Group，Subsystem 不能直接按本目录目标读取 `group.Foothold`、`group.Tile` 等。实现前必须选择并复核其一：

1. 正式在 LoomRealm 的 `ContentClient` 增加 `group(namespace,key)`，对齐 Content HTTP Group 规范与测试。该方案涉及 LoomRealm 平台 API，不能绕过仓库“游戏不私改框架”的边界。
2. 若 LoomRealm 不扩充公开接口，则把本设计的地图放置**改为**可用 `record()` 读取的 `struct` 分片，更新目录、schema 与测试；不允许同时维持两套互不一致的地图放置权威事实。

本文件选择 `group` 为 FSDB 的**目标物理布局**。上述接口未解决之前，不得把第一阶段合成 fixture 成功等同于真实 WZ Group 的 ContentClient 读写闭环。

## 9. 校验与完成标准

1. **样本核对**：记录 16 个 WZ 的哈希、版本、IV、IMG 数量、节点类型统计。研究样本中 WZ 使用 IV `B9 7D 63 E9`，不能将第三方库的区域枚举名等同于客户端发行地区。服务端 XML 只做交叉验证。
2. **WZ 保真**：检查原始标量类型/数值、前导零 key、缺失字段、空子树、动作帧顺序、地图 JSONL 顺序、UOL 引用。Canvas 使用 RGBA 像素哈希/尺寸对照，Sound 使用真实载荷与格式校验。
3. **NameSegment**：验证所有数据库名、表名、key 和 ResourceKey 分段；NFC 同名、非法扩展名、同一资源 key 的多格式文件必须失败；不静默改名。
4. **Well-formed**：所有必需 metadata 都存在；JSON/JSONL/metadata 是 UTF-8 无 BOM；数据是符合类型的 JSON object；无非法文件系统间接引用。**Integrity-valid** 再检查 Schema、直接引用的 `.extend.meta` 关系及所有声明的目标实体。
5. **业务引用**：地图 `link` 无悬空/循环；`tileSet`、`(tileSet,u,no)`、`bS`、`oS`、`bgm`、所有 Canvas/声音 logical key 均能找到目标；否则保留源位置的错误报告并拒绝发布。
6. **版本与集成**：PREPARE 生成可信索引后，核对 Content 响应字节/版本；测试 Map → 放置 → 图集 → Canvas、Look → 动画帧 → Canvas、Map → Portal → 目标 Map 的链路。Group API 和资源版本投影未完成时，明确将对应集成测试标为 blocked，不能声称已经打通。

先通过最小合成 FSDB 验证移动、立足线、传送和纸娃娃，再用用户本地 WZ 做导入校验；仓库只提交转换逻辑、schema/validator、合成夹具和可公开的逆向摘要。
