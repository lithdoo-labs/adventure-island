# 自研 FSDB

> 状态：正在设计。这是我们自己的内容库，不是 CMS WZ 的直接转换结果。  
> [cms_design.md](cms_design.md) 只说明客户端数据如何落成转换库。转换库是导入来源，游戏读取的是本文里的表。  
> 现在写完的是纸娃娃和地图。技能，以及其余数据和资源，都继续记在本文，各自成章。

## 1. 库

数据库根目录是 `[FSDB]` 加库名。物理布局遵守 LoomRealm FSDB：

| 种类 | 数据文件 | 必需元数据 |
|---|---|---|
| `[struct]` | `{键}.json`，一个 JSON 对象 | `.info.meta` |
| `[group]` | `{键}.jsonl`，每行一个 JSON 对象 | `.info.meta`、`.desc.meta` |
| `[resource]` | `{路径}.{扩展名}` | 表根目录 `.desc.meta` |

键是单个 NameSegment，编号保留前导零。名字里的前缀用点号分段，点号不放在开头或结尾。声音的字节进 `[resource]音`。纸娃娃的图不进 `[resource]图`，进独立的 `[resource]Avatar`。地图的图进 `[resource]Map`。技能和其余章的资源以后再定。运行时投影不入库。

自研的表名、记录键和资源名都带章节前缀，避免和转换库的 `Look`、`Map` 或以后的其他章撞名。纸娃娃的前缀是 `avatar`。部件再接 `part`，装备再接 `equip`，例如 `avatar.part.body.00002000`、`avatar.equip.cap.01002913`。地图的前缀是 `map`，例如 `map.100000000`、`map.back.grassySoil`。技能再用自己的前缀。源数据里的姿势名、图集名和绘制层名字保持原样，不加前缀。

| 章 | 状态 |
|---|---|
| 纸娃娃 | 已写 |
| 技能 | 未写 |
| 地图 | 已写 |
| 其余数据和资源 | 未写 |

## 2. 纸娃娃

纸娃娃只含部件和装备：身体、头、脸、头发，以及帽、衣、长袍、裤、鞋、手套、披风、盾、武器、脸饰、眼饰、耳饰。

导入来源是转换库里对应的 `struct.Look`，加上 `zmap.img` 的完整键顺序和 `smap.img` 里这些层的槽位。游戏不读 `struct.Look`。

当前 `[FSDB]adventure` 的头、脸和头发只保留创建角色时能选的。客户端 `Etc.wz/MakeCharInfo.img` 的 `CharMale`、`CharFemale` 给出名单，高级职业和东方职业重复同一组。`0` 是脸：男 `00020100`、`00020401`、`00020402`，女 `00021700`、`00021201`、`00021002`。`1` 是头发：男 `00030030`、`00030027`、`00030000`，女 `00031002`、`00031047`、`00031057`。服务端 `CharLoginHandler.CreateChar` 用这份白名单，把肤色写成 0，发色偏移也写成 0，所以头只留 `avatar.part.head.00012000`。`MakeCharInfo` 没有头的列表。`CommonFaceCN` 不在这份名单里。身体仍按源记录全部保留。

不导入：

- `islot` 为 `Ss` 的技能皮肤。这次导出里，这类记录的画布都在 `skill` 下。`01603078`、`01603015` 只有 `info` 和 `skill`。
- 残影、变身、名字、音效、物品图标，以及画在受击者身上的命中画面。
- 坐骑、鞍和椅子。`islot` 为 `Tm` 的有 419 条，`Sd` 的有 58 条。`01983000` 没有 `islot`，画布 `z` 是 `tamingMobFront`、`tamingMobRear`。
- 宠物装备。`01802000` 的节点名是宠物编号，例如 `5000000`，不是人物姿势。
- 勋章、吊坠、肩膀、戒指。这次导出里，这四类带动作画布的记录数都是 0。

`avatarPlan` 由这些表在运行时投影，上限 32 个动作，不入库。

### 2.1 表

| 表 | 键 | 内容 |
|---|---|---|
| `[struct]avatar.Part` | `avatar.part.body.00002000` | 身份、占据的槽、盖住的槽、武器姿势 |
| `[group]avatar.PartFrame` | 与部件相同 | 该部件的全部姿势帧，一行一帧 |
| `[struct]avatar.DrawOrder` | `avatar` | 人物层 `z` 从前景到背景的顺序 |
| `[struct]avatar.LayerSlot` | `avatar` | 每个人物层 `z` 对应哪些槽 |
| `[group]avatar.Resource` | 与部件相同 | 该部件每张画布在大图中的矩形 |
| `[resource]Avatar` | `part/...` 或 `equip/...` | 部件和装备的大图字节 |

`part` 下面是身体、头、脸、头发。`equip` 下面是帽、衣、长袍、裤、鞋、手套、披风、盾、武器、脸饰、眼饰、耳饰。种类按 `islot` 定，不按源目录定：

| `islot` | 种类 |
|---|---|
| `Bd`、`Hd`、`Fc`、`Hr` | `body`、`head`、`face`、`hair` |
| `Cp`、`HrCp` | `cap` |
| `Ma` | `coat` |
| `MaPn` | `longcoat` |
| `Pn`、`So`、`Gv`、`Sr`、`Si` | `pants`、`shoes`、`glove`、`cape`、`shield` |
| `Wp`、`WpSi` | `weapon` |
| `Af`、`Ay`、`Ae` | `faceAcc`、`eyeAcc`、`earAcc` |

`Coat` 目录里有 105 条 `MaPn`，键是 `avatar.equip.longcoat.*`。`01342000` 在武器目录，`islot` 是 `Si`，键是 `avatar.equip.shield.01342000`。`HrCp` 仍是帽。`0004` 开头的 416 条是头发，不是另一类部件。

`Longcoat` 里有 25 条没有 `islot`，例如 `01050323`，画布仍是 `mail` 和 `mailArm`。按长袍导入，`occupies` 和 `covers` 为空。

同一编号的第二条记录在 `struct.WzRecordAlias`。导入时读它，运行时不再查。转换结果里，`01002913`、`01003561`、`01004123` 的两条 JSON 相同，都是帽子，只留一条。`01004397` 两条都是帽子，内容不同。`01092090` 两条都是 `Si`，内容不同，来源分别是 `Shield` 和 `Weapon`。内容不同的第二条，键在编号后接别名后缀：`avatar.equip.shield.01092090` 和 `avatar.equip.shield.01092090.efaae01927a1dc61`。

共享表情是 `avatar.part.face.CommonFaceCN`，源记录没有八位编号，动作是 `nosebleed`。

身体和头按肤色各是一条部件。`avatar.part.body.00002000` 与 `avatar.part.body.00002001` 是两件部件，不在记录里套颜色公式。

### 2.2 struct.avatar.Part

```json
{
  "kind": "weapon",
  "itemId": "01422000",
  "occupies": ["Wp", "Si"],
  "covers": ["Wp", "Si"],
  "stance": { "stand": 2, "walk": 2, "attack": 5 }
}
```

`occupies` 来自 `islot`，`covers` 来自 `vslot`，都拆成两个字符一组。这次导出里的 `vslot` 长度都是偶数。`smap` 里没有的槽也保留。抽查的 `01000030`、`01000031`、`01000032` 都是 `HrCp`，`vslot` 含有 `Hx`。只有武器写 `stance`。`attack` 是武器类别，不单独变成姿势名。

### 2.3 group.avatar.PartFrame

身体是时间轴。其他可见部件跟身体解析之后的姿势名和帧号。身体没有这个姿势时，继续画它上一个有画布的姿势，不换肤色。其他部件没有这个姿势时不画，也不改去画别的姿势。

`00002000` 的 `walk1` 第 0 帧有 `body` 和 `arm`。下面只写 `body`：27×32，原点 `[19, 32]`。源字段 `face` 的值是 1，写入 `showFace`。

```json
{
  "action": "walk1",
  "frame": 0,
  "delay": 180,
  "delaySign": 1,
  "showFace": true,
  "layers": [
    {
      "name": "body",
      "z": "body",
      "resource": "avatar.part.body.00002000.walk1.0.body",
      "origin": [19, 32],
      "anchors": { "navel": [-6, -20], "neck": [-4, -32] }
    }
  ]
}
```

指向另一个姿势的一帧：

```json
{
  "action": "prone2",
  "frame": 0,
  "delay": 700,
  "delaySign": -1,
  "redirect": { "action": "proneStab", "frame": 0 }
}
```

导入规则：

- 同一部件里指向另一张画布的引用，导入时解开，帧上只留层。
- 指向另一个姿势的引用留下。头、头发、衣服、武器要跟被点名的姿势和帧号。
- `delay` 是毫秒绝对值，播放用它。`delaySign` 保留源数据的正负号。`prone2` 第 1 帧仍指向 `proneStab` 第 0 帧，`delay` 是 300。
- `showFace` 只写在身体帧上，来自源字段 `face`。值为 0 时是假，这一帧不画脸和跟着表情走的脸饰。没有这个字段，或值不是 0，都是真。
- 脸的 `default` 是一行，没有 `delay`，一直画到表情名改变。`00020000` 的这一行只有画布 `face`。
- 脸饰没有当前表情名时用它自己的 `default`。这条例外优先于“其他部件没有这个姿势时不画”。
- 部件有这个姿势、但帧数更少时，用它的最后一帧。
- 头发的 `hairShade` 在层上写 `variants`。层自己的 `resource`、`origin`、`anchors` 是肤色 `0`。只有和肤色 `0` 不同的肤色才写入 `variants`，值里带这份肤色自己的资源名、原点和锚点。`00030000` 的画布是 `0`、`1`、`2`、`3`、`4`、`9`、`10`、`11`，原点都是 `[13, 8]`。另外 16 件头发的原点随肤色变化，必须写进 `variants`。对不上的肤色用 `0`。
- 身体帧上可以有 `rotate`，导出里只出现 `90`、`180`、`270`。客户端的旋转方向没有还原。播放时先摆放，再绕身体原点顺时针转这个角度，然后做朝向翻转。
- `move` 只加在当前帧，不把前面的位移累加。`flip` 为真时，这一帧在朝向翻转之外再翻一次。
- 每个身体部件保留该肤色源记录里的全部姿势。`00002000` 有 148 个姿势名。`00002001` 有 42 个，`00002010` 有 104 个。姿势名可以和技能要播放的名字相同，数据仍属于身体部件。

层上的 `resource` 只是资源名，宽高不写在帧里。`origin` 和 `anchors` 相对这张小图，不是大图坐标。`stand1` 第 0 帧的 `body` 是另一张图：21×31，原点 `[16, 31]`，`navel` 是 `[-8, -21]`，`neck` 仍是 `[-4, -32]`。不能拿 `walk1` 的尺寸或 `navel` 去填。

### 2.4 struct.avatar.DrawOrder

来自 `Base.wz/zmap.img` 的完整键顺序，共 149 个名字。人物不用 `zmap_cn.img`。越靠前越盖在上面。人物常用的是 `characterStart` 到 `characterEnd` 这 111 个名字。`mobEquipFront` 在整表最前，`Wp`、`Gv`、`Cp` 在 `characterEnd` 之后，都保留原来的位置。

导入时先把画布的 `z` 收成这张表里的名字：

1. 去掉首尾空白，再忽略大小写。对上唯一的正式名字就用它。`Weapon` 收成 `weapon`，`ArmOverHair` 收成 `armOverHair`。
2. 把 `wepon`、`bleow`、`bdlow`、`acssesary`、`ovearm` 换成 `weapon`、`below`、`below`、`accessory`、`overarm`。换完之后若等于正式名字，就收成它。`weaponOveArm` 收成 `weaponOverArm`，`weaponBleowBody` 收成 `weaponBelowBody`，`backCapAcssesary` 收成 `backCapAccessory`。

还对不上的名字，看最右边的 `Over`、`Below`、`Under`。后面的词若是正式层名，`Over` 插到该层前面，`Below` 和 `Under` 插到该层后面。名字以 `back` 开头，并且存在 `back` 加这个词的正式层时，用那一层，例如 `backCapBelowHair` 放在 `backHair` 后面。同一侧有好几个名字时，按名字排序。

| 位置 | 名字 |
|---|---|
| `hair` 前 | `accessoryEarOverHair`、`accessoryOverHair` |
| `hair` 后 | `capBelowHair`、`capeBelowHair` |
| `cap` 前 | `accessoryFaceOverCap` |
| `face` 后 | `accessoryEyeBelowFace` |
| `head` 前 | `weaponBelowArmOverHead` |
| `head` 后 | `capBelowHead`、`capeBelowHead`、`hairBelowHead`、`weaponBelowHead` |
| `hand` 后 | `weaponBelowHand` |
| `mailArm` 后 | `weaponOverGloveBelowMailArm` |
| `glove` 后 | `weaponBelowGlove` |
| `arm` 后 | `shieldBelowArm` |
| `body` 前 | `capeOverBody`、`weaponBelowHandOverBody` |
| `body` 后 | `capBelowBody`、`capeUnderBody`、`weaponOverArmBelowBody` |
| `weapon` 前 | `capeOverWepon` |
| `pants` 前 | `capeBelowBodyOverPants` |
| `backHair` 后 | `backCapBelowHair` |
| `backHead` 前 | `backAccessoryOverHead` |
| `backHead` 后 | `backCapBelowHead` |
| `backGlove` 后 | `backWeaponBelowGlove` |
| `backBody` 后 | `weaponBdlowBackBody`、`weaponBelowBackBody` |

`capeWeapon`、`weaponback`、`back`、`weaponOntheTop`、`weaponWrist` 没有可对上的正式层。按名字排序，紧接在 `characterEnd` 后面。这张插表是我们的补位，不是 `zmap.img` 里的原文。

### 2.5 struct.avatar.LayerSlot

来自 `Base.wz/smap.img`。键是人物层的 `z`，值是槽位数组。源字符串按两个字符切开。空值表示这层不参与遮挡。记录写全人物层，下面只是节选：

```json
{
  "hair": ["H2"],
  "hairOverHead": ["H1"],
  "pants": ["Pn", "So"],
  "mailArm": ["Ma", "Gw"],
  "cap": ["Cp", "Hd", "H1", "H2", "H3", "H4", "H5", "H6", "Hs", "Hf", "Hb", "Af", "Ay", "As", "Ae"]
}
```

`capOverHair` 和 `cap` 的槽位相同。`pantsOverShoesBelowMailChest`、`backPantsOverShoesBelowMailChest` 在 `zmap` 里有名字，`smap` 里没有，这两层的值是空数组。`Wp`、`Gv`、`Cp` 也是空数组。收成正式层的别名用那一层的槽位。插进去的名字和 `characterEnd` 后面那五个补位名字，槽位是空数组，不参与遮挡。

遮挡在绘制这一帧时计算，不写回部件。`occupies` 是 `islot`，`covers` 是 `vslot`。每张画布的 `priority` 是 `occupies` 各槽在 `DrawOrder.frontToBack` 里最靠前的那个位置（越靠前整数越大）。`tag` 是 `covers` 里也出现在 `LayerSlot[z]` 中的槽，顺序跟 `covers`。`z` 为 `face` 的画布不参加占槽。其余按从后往前的绘制顺序占槽：编号大的留下，输的整张不画；编号相同两张都留。空的 `LayerSlot` 使 `tag` 为空，这张画布不声明槽位。还原见 `research/result/63-avatar-occlusion.md`。

### 2.6 group.avatar.Resource 与 [resource]Avatar

画布不嵌在姿势帧里。`[group]avatar.Resource` 记录每张小图在大图中的位置，键与部件相同，一行一张不重复的小图。资源名是一个 NameSegment，用点号连接。数字帧是 `avatar.part.body.00002000.walk1.0.body`。没有帧号的画布是 `avatar.part.face.00020000.default.face`。`hairShade` 用肤色编号：`avatar.part.hair.00030000.default.hairShade.0`。

大图字节单独放在 `[resource]Avatar`。部件和装备分两个子目录，只包含动作帧里的画布，不含物品图标。一个部件或一件装备一张大图：

```text
[resource]Avatar/part/body/00002000/0.png     逻辑键 part/body/00002000/0
[resource]Avatar/part/body/00002000/1.png     第二页，只有一页装不下时才有
[resource]Avatar/equip/weapon/01422000/0.png  逻辑键 equip/weapon/01422000/0
```

`part` 目录只放身体、头、脸、头发。`equip` 目录只放装备。逻辑键属于 `resource.Avatar`，不是 `resource.图`。

```json
{
  "name": "avatar.part.body.00002000.walk1.0.body",
  "image": "part/body/00002000/0",
  "page": 0,
  "x": 0,
  "y": 0,
  "w": 27,
  "h": 32
}
```

`name` 与 `avatar.PartFrame` 层上的 `resource` 相同。`image` 是 `[resource]Avatar` 里的逻辑键。`x`、`y` 是大图左上角，`w`、`h` 是小图宽高。采样时先按资源名找到这一行，再使用层上原来的 `origin` 和锚点。

拼图用 1 像素间距，不旋转。边长取装得下的最小正方形：256、512、1024、2048、4096、8192。仍装不下就增加 `page`。已核对 `avatar.part.body.00002000` 有 236 张不重复的小图，1024 装得下。

### 2.7 运行时怎么读

肤色决定 `avatar.part.body.*` 和 `avatar.part.head.*`。脸、头发、装备按 `part` 或 `equip`、种类和编号收成部件键。读 `avatar.Part` 做遮挡，用武器 `stance` 得到 `stand1` 或 `stand2`。`jump` 不加后缀。读身体的 `avatar.PartFrame`，顺着 `redirect` 找到有画布的帧。身体没有这个姿势时，留在上一个有画布的姿势。其他可见部件取解析后的同名姿势；脸和脸饰用表情自己的帧号，脸饰没有这个表情名时用 `default`。`hairShade` 先取当前肤色的 `variants`，没有则用肤色 `0`。

摆放时先放身体。其余层按 `navel`、`neck`、`hand`、`brow`、`handMove` 取第一个已经出现的锚点。这个顺序和绘制顺序不是一回事。绘制按 `avatar.DrawOrder`：先画靠后的层。帧上有 `rotate` 时，绕身体原点顺时针旋转，再做朝向翻转。然后用层上的资源名去 `avatar.Resource` 取矩形，从 `[resource]Avatar` 的 `part` 或 `equip` 子目录读取大图。一次播放仍只把当前需要的姿势放进 `avatarPlan`。

## 3. 技能

未写。技能数据、技能皮肤和施法画面在这一章设计。

## 4. 地图

地图章存放一张地图的源数据和可复用的画布。导入来源是转换库里的 `struct.Map`、`group.Back`、`group.Tile`、`group.Obj`、`group.Portal`、`group.Foothold`、`group.Rope`，以及 `struct.Back`、`struct.Tileset`、`struct.Obj`、`struct.MapHelper` 和对应 PNG。游戏不读这些转换表。

MapScenePlan、`effectiveBounds`、`clientSortKey`、呈现用的 `visual` 和 `contentVersion` 由构建期 Adapter 投影，不写回本库。比较方向、Camera 跟随、`+0x98` 的方法体和虚表 `+0x58` 的时间单位都还没有恢复，库里不补这些公式。

地图画布不打成大图。一张画布一个 PNG。缺 `z`、缺 `delay` 就不写该字段，不补 0。

### 4.1 表

| 表 | 键 | 内容 |
|---|---|---|
| `[struct]map.Map` | `map.100000000` | 地图编号、`info` 里实际存在的标量、小地图、0–7 层的 `tileSet` |
| `[group]map.Back` | 与地图相同 | 背景放置，源顺序 |
| `[group]map.Tile` | 与地图相同 | 瓦片放置 |
| `[group]map.Obj` | 与地图相同 | 物件放置 |
| `[group]map.Portal` | 与地图相同 | 传送门放置 |
| `[group]map.Foothold` | 与地图相同 | 立足线 |
| `[group]map.Rope` | 与地图相同 | 绳子 |
| `[struct]map.Back` | `map.back.grassySoil` | 这套背景存在 |
| `[group]map.BackFrame` | 与背景定义相同 | 背景帧 |
| `[struct]map.Tileset` | `map.tile.woodMarble` | 这套瓦片存在 |
| `[group]map.TileFrame` | 与图集相同 | `u` / `no` 画布 |
| `[struct]map.Obj` | `map.obj.acc5` | 这套物件存在 |
| `[group]map.ObjFrame` | 与物件定义相同 | `l0/l1/l2` 帧 |
| `[struct]map.Helper` | `map.helper` | 共用辅助图存在 |
| `[group]map.HelperFrame` | `map.helper` | `MapHelper.img` 的画布 |
| `[resource]Map` | `back/...`、`tile/...`、`obj/...`、`helper/...`、`minimap/...` | PNG |

定义表只表示这套资源存在。帧在对应的 group 里。放置行用 `bS`、层上的 `tileSet`、`oS` 指回定义，不把像素嵌进行里。JSONL 的行序就是源顺序。

### 4.2 struct.map.Map

下面是 `map.100000000` 的节选。源里还有的标量同样留下。

```json
{
  "mapId": "100000000",
  "info": {
    "version": 10,
    "cloud": 0,
    "town": 1,
    "returnMap": 100000000,
    "forcedReturn": 999999999,
    "bgm": "Bgm00/FloralLife",
    "mapMark": "Henesys"
  },
  "miniMap": {
    "width": 7174,
    "height": 1391,
    "centerX": 798,
    "centerY": 661,
    "mag": 4,
    "resource": "minimap/100000000"
  },
  "layers": {
    "0": { "tileSet": "woodMarble" },
    "1": { "tileSet": "woodMarble" },
    "2": {},
    "3": {},
    "4": {},
    "5": {},
    "6": {},
    "7": {}
  }
}
```

`info` 只写源里有的标量。`VRLeft`、`VRTop`、`VRRight`、`VRBottom` 四个都在才写 `vr`，值是源整数。上面的射手村节选没有这四项，记录里就没有 `vr`。`+400`、`-300` 和中点折叠不入库。`swim` 留在 `info` 里，库不另做运动表。第一批里童话村和井口是 0，矩形地带是 1。Field Runtime 读取这个标量。客户端读取函数仍待逆向。

`layers` 只收 `"0"` 到 `"7"`。某一层没有 `info/tS` 时，该层是空对象，不写 `tileSet`。没有放置的层不写放置行。

没有小地图画布时不写 `miniMap.resource`。宽高和中心点缺任何一项时，不在库里拼边界。

### 4.3 放置

背景一行对应源里的一条 `back`：

```json
{"bS":"grassySoil","no":0,"ani":0,"x":0,"y":0,"rx":0,"ry":0,"type":0,"cx":0,"cy":0,"f":0,"a":255,"front":0}
```

`type`、`rx`、`ry`、`cx`、`cy`、`front` 原样保留。`cx` 或 `cy` 为 0 就写 0，不换成画布宽高。`bS` 对应 `map.back.{bS}`。

瓦片一行：`layer`、`x`、`y`、`u`、`no`、`zM`。`layer` 是 `"0"` 到 `"7"`。图集取该层的 `tileSet`，定义键是 `map.tile.{tileSet}`。

物件一行：`layer`、`oS`、`l0`、`l1`、`l2`、`x`、`y`、`z`、`f`。源里有的 `zM`、`flow`、`cx`、`cy`、`r`、`reactor`、`name` 才写。`flow` 是平铺 mode，不是排序键。定义键是 `map.obj.{oS}`。

传送门一行使用源字段名。`100000000` 的 `in00`：

```json
{"pn":"in00","pt":2,"x":3026,"y":335,"tm":100000100,"tn":"out00"}
```

`pn`、`pt`、`x`、`y`、`tm`、`tn` 都留下。`script`、`delay`、`onlyOnce`、`hideTooltip`、`image`、`hRange`、`vRange`、`horizontalImpact`、`verticalImpact` 源里有才写。客户端在 `hRange` 或 `vRange` 缺失时用 100 做命中范围，那是读取时的默认值，不写进缺字段的行。`tm` 为 `999999999` 保持原值。`ph` 和 `psh` 的选择不写在放置行上。

立足线一行：`layer`、`platform`、`id`、`x1`、`y1`、`x2`、`y2`。有连接才写 `prev`、`next`。`force`、`forbidFallDown` 原样保留，不解释成运动规则。垂直段 `x1 === x2` 照样留下。

绳子一行：`x`、`y1`、`y2`、`l`、`uf`、`page`。源里有的编号才写 `id`。

### 4.4 帧

背景帧的键是 `map.back.grassySoil`。静态帧：

```json
{"kind":"back","no":0,"origin":[128,128],"z":0,"width":256,"height":256,"resource":"back/grassySoil/back/0"}
```

动画帧的 `kind` 是 `ani`，并带 `frame`。`Back/grassySoil.img/ani/0` 的 10 帧没有 `delay`，行里就没有这个字段。

瓦片帧的键是 `map.tile.woodMarble`，用 `u` 和 `no`。下面四张没有 `z`，行里不写 `z`：

- `tile/greenCrystalCave/bsc/0`
- `tile/blueCave2/bsc/0`
- `tile/blueCave2/bsc/1`
- `tile/blueCave2/bsc/2`

物件帧的键是 `map.obj.{oS}`，带 `l0`、`l1`、`l2`、`frame`。画布上的 `z` 写在帧上，放置上的 `z` 写在放置行上。有 `delay` 才写 `delay`。

UOL 在导入时解开。帧只指向已经解开的画布。悬空或成环就让这条定义导入失败。

### 4.5 MapHelper

`struct.map.Helper` 只有一条，键是 `map.helper`：

```json
{"gamePortal":["pv","ph","psh"]}
```

`gamePortal` 标明游戏出口画面的名字。帧在 `group.map.HelperFrame`，用路径段区分，不把 818 张画布塞进 struct。

```json
{"branch":"portal","use":"game","name":"pv","frame":"0","origin":[43,173],"resource":"helper/portal/game/pv/0"}
```

`width` 和 `height` 取画布尺寸，一并写入。`pv/0` 没有 `z` 和 `delay`。`ph`、`psh` 的 `use` 仍是 `game`，`name` 是 `ph` 或 `psh`；`portalStart`、`portalContinue`、`portalExit` 写在 `clip`。编辑器的 `sp`、`pi` 用 `use: "editor"` 留下。Adapter 只从 `use: "game"` 取出口画面。

`weather`、`mark`、`worldMap`、`AvatarMegaphone`、`minimap` 同样落在这张 group 里，`branch` 用这些顶层名字。

### 4.6 [resource]Map

逻辑键属于 `resource.Map`。扩展名不属于 ResourceKey。

```text
[resource]Map/back/grassySoil/back/0.png
[resource]Map/tile/woodMarble/bsc/0.png
[resource]Map/obj/acc5/aquaRoad/fish/0/0.png
[resource]Map/helper/portal/game/pv/0.png
[resource]Map/minimap/100000000.png
```

帧上的 `resource` 就是这个逻辑键。宽高写在帧行上。

### 4.7 发布和读取

库可以装全部地图。第一批发布读 `map.222000000`（童话村）、`map.222000001`（井口）和 `map.230030200`（矩形地带），加上它们引用到的 `map.back.*`、`map.tile.*`、`map.obj.*`，以及 `map.helper` 里 `portal/game` 的 `pv`、`ph`、`psh`。上面的 `map.100000000` 只示范记录形状。

构建器从这些表投影 MapScenePlan，不把 Plan 写回 FSDB。四个 VR 齐全才按客户端公式做内缩，否则用小地图或立足线外接矩形，规则在 MapScenePlanV1。童话村和井口四个 VR 都在。井口水平跨度是 800，内缩后左右收到同一个 x，这个结果只出现在 Plan。矩形地带没有 `vr`。`type` 不是 0 的背景、缺 `z` 的瓦片、没有游戏帧的传送门，按该契约失败，不在库里填默认画面。`pt` 3 不加载画面，放置行仍保留，切换由 Field Runtime 做。

`read-adventure-fsdb.mjs` 在地图表进入发布闭包之前，仍只发布纸娃娃。要让 PWA 读到地图，须先把本章的表加进它的白名单。

## 5. 其余数据和资源

未写。物品、字符串、怪物、NPC，以及上面各章没有覆盖的资源和数据，在这一章设计。
