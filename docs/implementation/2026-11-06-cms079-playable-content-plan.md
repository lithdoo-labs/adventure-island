# CMS079 可玩切片：完备 FSDB 与第一批内容

> 状态：**待执行**。本文件只定数据契约和第一批内容，不代表切片已经导出，也没有可玩的地图运行库。
>
> 制定日期：2026-11-06。基线：`main` `a1992512ac62a40595c3e7ca812363d1112ae043`。LoomRealm pin 不改：`93648192323bf5f57996b7b54cbae641d8a53fdb`。
>
> 全量转换来源：仓库外 `E:\cms079-pr1-work\fsdb-all\[FSDB]cms`，由 PR #1 转换器 `scripts/wz_fsdb/convert_cms.py`（blob `c3951951aecbfe720e19c43e495043c2e2ddd293`）一次 `--scope all` 写出。验收见 `docs/validation/cms079-wz-fsdb-real-closure.md`。该报告的源到目标无损性是 **PARTIAL / NOT ESTABLISHED**；本切片只复制已选中的、结构完整的记录，不把全库重新宣称为无损。

## 1. 决策

做一份可以一直往里补数据的 CMS079 FSDB，而不是一套演示专用表。

- 表名、元数据、键和记录形状与全量转换结果相同。第一批只填两套装备和两张连通地图。技能、物品、更多地图以后是新增文件，不改已有表。
- 选中的 Look、`ZMap`、`SMap`、`Physics` 整份复制。身体 `00002000` 的 148 个动作目录都保留。第一批游戏只播「自己有画布」的姿势；技能名目录留在记录里，供以后追加 `struct.Skill`。
- `AvatarPlan` 不写入 FSDB。它是运行时从 Look 裁出来的绘制计划，上限 32 个动作、序列化后 256 KiB。`cms-actor` 只画计划，不读 WZ。
- 切片和全量库一样放在仓库外。Git 不接收 `.wz`、PNG、音频或 FSDB。
- 不改转换器、LoomRealm、PWA 入口和研究目录。不从已废弃的 PR #53 取代码。

## 2. 现状

`main` 上已有：

- PR #1 转换器和 26 项合成测试。
- `components/cms-actor`：`AvatarPlanV1`、纸娃娃绘制、`real-look-adapter.mjs`。适配器目前只接受身体、头、脸、头发、一把武器，会生成 `stand*`、`walk*`、`jump`、`brandish1`。它还不做 `vslot` / `SMap` 遮挡，也不读防具。
- 全量 FSDB 已由 ContentClient 和真实 Chromium 读过五份 Look、`ZMap/order`、`group.Tile/100000000` 和一条 BGM。
- 地图移动、立足线、传送门和换装还不存在。组件的 `x`、`y`、`locomotion`、`facing` 由外部写入。

身体图里的 148 个目录分两类：

- 自己有画布的姿势：`stand1`、`stand2`、`walk1`、`walk2`、`jump`、`sit`、`prone`、`proneStab`、`ladder`、`rope`、`fly`、`alert`、`heal`、`dead`，`swingO*`、`swingT*`、`swingP*`，`stabO*`、`stabT*`，`shoot1`、`shoot2`、`shootF`，以及 `ghost*`。`O` 是单手，`T` 是双手，`P` 是长柄，`F` 是该组收招。
- 没有新画布的目录：约 101 个技能名或变体名。`brandish1` 的 7 帧分别指向 `swingOF` 和 `stabOF`，只另带 `delay`。`sit2`–`sit6` 指向 `sit` 并带 `move`。这些目录必须留在身体记录里，否则以后加技能就不是单纯补数据。

头和头发各有 33 个基本动作，没有把技能名再抄一遍。播放技能时，身体先解析到 `swingOF/2` 这类帧，头、头发、衣服和武器再跟这个名字。某件没有同名动作就不画这件。

## 3. 完备的库结构

新目录仍叫 `[FSDB]cms`，与全量库分开，例如 `E:\cms079-pr1-work\fsdb-slice\[FSDB]cms`。建议路径可以改，但必须在仓库外。

全量库根下已有的 94 张表全部建立。每张 `[struct]`、`[group]` 复制全量库里的 `.info.meta` 和 `.desc.meta`；已有 `.extend.meta` 的一并复制。两张 `[resource]` 复制 `.desc.meta`。没有选中的数据文件就不拷。空表只有元数据，FSDB 允许零条 data candidate。

表分四组，名称保持不变：

| 组 | 表 | 第一批 |
| --- | --- | --- |
| 人物 | `struct.Look`、`struct.ZMap`、`struct.ZMapCn`、`struct.SMap`、`struct.Afterimage` | Look 填下面两套；`ZMap`、`ZMapCn`、`SMap` 整份复制。`Afterimage` 先空着 |
| 地图 | `struct.Map`、`struct.Back`、`struct.Obj`、`struct.Tileset`、`struct.Physics`、`struct.MapEffect`、`struct.MapHelper`、`struct.WorldMap`、`struct.AreaCode` | 两张地图的 `Map`。`Physics/default` 整份复制，保留全部 19 个字段。背景定义只复制这两张图引用到的键。其余地图表先空着 |
| 地图分组 | `group.Foothold`、`group.Portal`、`group.Back`、`group.Tile`、`group.Obj`、`group.Life`、`group.Rope`、`group.Reactor`、`group.Seat`、`group.Area`、`group.SwimArea`、`group.Weather`、`group.ToolTip`、`group.MapUser` | 两张地图都写 Foothold、Portal、Back。Tile 和 Obj 第一批不写，表先留着。其余分组先空着 |
| 以后扩展 | `struct.Skill`、`struct.SkillBook`、`struct.Item`、`struct.ItemImg`、`struct.Mob`、`struct.Npc`、`struct.Reactor`、`struct.Effect`、`struct.Morph`、`struct.Taming`、`struct.Sound`、`struct.Ui`、`struct.Quest*`、`struct.QuestCountGroup`、`struct.Text*`、`struct.Etc*`、`struct.StandardPDD`、`struct.WzRecordAlias` | 全部先空着。`WzRecordAlias` 也先空着；这两套编号没有重名 |
| 资源 | `resource.图`、`resource.音` | 只复制被选中记录点到的 PNG，以及两张地图 `info.bgm` 指向的声音 |

`resource.图` 和 `resource.音` 是全库共用的。新装备的 PNG 继续放进同一张图表，不另开表。

### 3.1 第一批装备

身体和头共用。两套各有脸、头发、帽和武器。鞋、手套、披风先共用。

| 部件 | 第一套 | 第二套 | 槽 |
| --- | --- | --- | --- |
| 身体 | `00002000` | 同左 | `Bd` |
| 头 | `00012000` | 同左 | `Hd` |
| 脸 | `00020000` | `00020001` | `Fc`。表情是脸上的 26 个动作目录，运行时用 `expression` 选择 |
| 头发 | `00030000` | `00030001` | `Hr` |
| 帽 | `01000000` | `01000001` | `Cp`，`vslot=CpH1H5` |
| 上衣 | `01040000` | 不装备 | `Ma` |
| 裤子 | `01060000` | 不装备 | `Pn` |
| 长袍 | 不装备 | `01050001` | `MaPn`，盖住上衣和裤子 |
| 鞋 | `01070000` | 同左 | `So` |
| 手套 | `01080000` | 同左 | `Gv` |
| 披风 | `01100000` | 同左 | `Sr` |
| 盾 | `01090000` | 不装备 | `Si`。没有 `stand2` / `walk2` |
| 武器 | `01302000` | `01422057` | 单手剑 `Wp`，`stand=1`、`walk=1`。双手武器 `WpSi`，`stand=2`、`walk=2`，同时占掉盾 |

Look 记录从全量库原样复制，包含 `info.islot`、`info.vslot`，武器还有 `stand`、`walk`、`attack`。不在切片里删动作，也不把 UOL 或 `{action, frame}` 预先展开成另一套格式。

遮挡用已有的 `vslot` 和 `SMap`：`cap` 对应 `CpHdH1H2H3H4H5H6HsHfHbAfAyAsAe`，`hair` 对应 `H2`，`pants` 对应 `PnSo`。当前 `real-look-adapter.mjs` 还不会做这件事，切片数据先把依据放齐。

### 3.2 第一批地图

`100000000` 射手村和 `100000100` 射手村集市。

- 村的传送门 `in00` 的 `tm` 是 `100000100`。集市的 `out00` 指回 `100000000`。
- 出生点是 `pt=0` 且 `tm=999999999` 的 `sp`。
- 立足线保留 `id`、`x1`、`y1`、`x2`、`y2`、`prev`、`next`。村 315 条，集市 210 条。这两张图的 `info` 没有 `VRLeft` / `VRRight`，镜头范围用立足线的外包矩形。
- `struct.Map` 保留完整 `info` 和 `layers`。`group.Back` 保留村 8 条、集市 4 条，并复制对应的 `struct.Back` 与 PNG。
- Tile、Obj、Life 第一批不复制。城镇原貌要等下一包再按同一地图号补 `group.Tile`、`group.Obj` 和它们引用的图集。

### 3.3 以后怎样补

| 新增 | 写入 | 同一批必须齐全 |
| --- | --- | --- |
| 装备 | `struct.Look/{八位编号}.json` | 该记录点到的全部 PNG。编号保持前导零 |
| 地图 | `struct.Map/{地图号}.json` 和同号的 group 文件 | `tm` 是已有地图或 `999999999`。`bS`、`tileSet`、`oS` 指向的结构记录已经存在，或同一批写入 |
| 技能 | `struct.Skill/{技能号}.json`，职业书写入 `struct.SkillBook` | 动作名使用身体上已有的目录。图标 PNG 按原资源键补入 `resource.图` |
| 物品 | `struct.Item/{物品号}.json`，无独立编号的图集写入 `struct.ItemImg` | 名称以后写入对应的 `struct.Text*`，不改物品记录的形状 |

从全量库补文件时按原相对路径拷贝。不改键、不改字段名、不把资源挪到另一张表。

## 4. 运行时边界

FSDB 保存源记录。下面这些不进库：

- 角色状态：`mapId`、`x`、`y`、`vx`、`vy`、当前立足线、`facing`、`locomotion`、当前是哪一套装备、当前 `expression`。
- 绘制计划：按当前装备从 Look 投影出的 `AvatarPlan`。常驻动作是该武器后缀对应的 `stand*`、`walk*`、`jump`。触发其余动作时，把该动作放进计划再发 `{ action: 动作名 }`。计划超过 32 个动作或 256 KiB 时，丢掉当前没在播的一次性动作，不放宽校验。
- 武器决定后缀。第一套用 `stand1` / `walk1`，第二套用 `stand2` / `walk2`。`jump` 没有后缀。换装是换整份计划。

移动使用 `Physics/default` 的 `walkForce`、`walkSpeed`、`walkDrag`、`jumpSpeed`、`gravityAcc`、`fallSpeed`。游泳和飞行字段留在记录里，第一批地图不启用。

## 5. 实施顺序

1. 写一个仓库内的复制脚本：从全量库复制第 3 节列出的元数据和数据文件到新的仓库外目录。脚本只接受显式的源目录和目标目录，拒绝写入 Git 跟踪路径。用固定清单列出 Look 编号、地图号和要复制的 group，不靠目录扫描猜内容。
2. 用当前 pin 的 `openFsdb` 打开切片。检查两张地图的传送门互指、两套 Look 的 `islot`、身体仍含 `brandish1` 且其帧指向 `swingOF` / `stabOF`、被引用的 PNG 和 BGM 都存在。
3. 扩展人物适配，而不是另写一套绘制器。让它接受第 3.1 节的整套装备，按 `stand` / `walk` 选择后缀，并按 `vslot` 与 `SMap` 决定哪一层不画。第一批播放清单是第 2 节那些自己有画布的姿势。
4. 另做地图运行：立足线行走、跳跃、进出 `in00` / `out00`。把 `x`、`y`、`locomotion`、`facing` 写给 `cms-actor`。挥砍和表情不写入坐标属性。
5. 用真实切片跑 ContentClient 和 Chromium：两套装备都能站立、行走、跳跃、播放至少一个自己有画布的攻击姿势，并在两张地图之间传送。合成测试和 PWA 回归保持通过。

第 1、2 步不依赖第 4 步。地图运行库没写完时，不得把切片说成可玩。

## 6. 验收

- 切片根目录的表集合与全量库的 94 张表一致，缺数据的表仍有规定的元数据。
- 第一批 Look 和 `Physics`、`ZMap`、`SMap` 与全量库对应文件字节相同。
- 两张地图的 Foothold、Portal、Back 与全量库对应文件字节相同。Tile、Obj 不在第一批。
- `openFsdb` 能打开切片。ContentClient 能读两套 Look、两张地图的立足线和传送门、至少一张背景 PNG 和一条 BGM。
- 计划内的攻击姿势来自有画布的目录。`brandish1` 仍在身体记录中，但第一批不要求把它放进 32 动作上限里的计划。
- Git 差异里没有客户端、WZ、PNG、音频、FSDB 或清单式的逐资源哈希大文件。

## 7. 不在本计划内

- 重跑 16 包转换，或把全量库的无损结论改成 PASS。
- 修改 `convert_cms.py` 的业务映射、LoomRealm pin、PWA 启动入口、`research/**`。
- 把切片提交进仓库，或把它接成正式 PWA 的默认游戏内容。
- 技能效果、物品栏、怪物、NPC、绳梯和完整城镇瓦片。这些只保证表已经在，数据以后补。
