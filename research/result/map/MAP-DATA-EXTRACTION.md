# Map.wz 数据提取

证据等级见 `MAP-REVERSE-STATUS.md`。本文件只记录从 `Map.wz` 读出来的节点，不把客户端绘制公式写进数据。

## 来源

| 项 | 值 |
|---|---|
| 文件 | `.work/task-001/extracted/冒险岛online/Map.wz` |
| 大小 | 835,954,262 |
| SHA-256 | `9e0d2a0fcecac2c99ee3cb15b03c41b5617d7d0637b55fb132f0eeed27155f69` |
| 格式 | PKG1，version 79 |
| 字符串 IV | `B9 7D 63 E9`（wzpy 区域名 EMS）。三个库的可打印率证据在 `research/result/23-wz-library-cross-validation.md` |
| 工具 | `research/scripts/map_wz_extract.py`，然后 `research/scripts/map_wz_classify.py` |
| 像素 | 不解码。Canvas 只保留 width、height、format、format2 和子属性 |

`content/[FSDB]cms` 只有少量地图、一个 Back 和两个 Tileset。它的动画帧没有 `delay`。这次提取不使用那份 FSDB 作为原始证据。

根目录：`Tile` 110、`Back` 112、`Obj` 111、`WorldMap` 18、`Map` 4260，另有根图像 `MapHelper.img`、`Effect.img`、`Physics.img`。WorldMap、Effect、Physics 没有展开。

## 记录形状

每行一个 JSON 对象。Schema 在 `MAP-DATA-SCHEMA.json`。

- `group`：一个容器的子节点顺序。`childOrder` 是 WZ 里的顺序，不是绘制顺序。
- `bag`：这个节点上的标量和 UOL。没有的字段不出现。
- `canvas`：一张画布。`raw` 是原始子节点。`canvas.z` / `canvas.origin` 只在对应子节点存在时为数字；不存在时是 `null`，并且 `zPresent` 或 `originPresent` 为 false。

UOL 记在父节点的 `raw` 里，带 `resolution.chain` 和 `resolvedPath`。898 条全部在同一张 img 内解析成功，没有未解析或环。

产物在 `.work/map-reverse/`。`extracted.jsonl` 约 1.5 GiB，不进 git。分类后的地图实例在 `.work/map-reverse/maps/`。

## Back

112 张 img，4402 张 canvas。

每张 canvas 都有 `origin`。4289 张有整数 `z`，113 张没有 `z`。1738 张有 `delay`，其余没有。还出现过的子节点包括 `a0`、`a1`、`foothold`、`moveType`、`moveR`、`moveW`、`moveH`、`moveP`、`blend`，以及原样保留的拼写 `dealy`（2 张）。这些名字只说明数据里有这个孩子，不说明客户端读了它。

`Back/grassySoil.img`：

- `back/0`：256×256，origin (128, 128)，z 0，子节点只有 `origin` 和 `z`。
- `ani/0`：10 张 canvas，顺序 `0` 到 `9`。`ani/0/0` origin (100, 529)，没有 `delay`。

地图上的背景实例是另一层数据，在 `Map/*/back/<key>`。4259 张地图里有背景实例的统计见 manifest。`type` 计数：0=10821，1=13027，2=5353，3=5546，4=9934，5=137，6=384，7=239。实例字段以每条 `raw` 为准，常见的是 `no,x,y,rx,ry,type,cx,cy,bS,a,front,ani,f`。某条里缺哪个，那条的 `raw` 里就没有哪个。

## Tile

110 张 img，2348 张 canvas。

`origin` 全部存在。`z` 缺 4 张，都只有 `origin`：`Tile/greenCrystalCave.img/bsc/0`，以及 `Tile/blueCave2.img` 的 `bsc/0`、`bsc/1`、`bsc/2`。这 4 张的归一化 `z` 是 null。

`Tile/woodMarble.img/enH0/0`：90×33，origin (0, 33)，z -3，并有 `foothold`。`bsc` 的 z 可以是 0，`enH` 可以是 -3，`enV` 可以是 -2，`ed` 可以是 -4。这是资源上的 canvas z，不是地图实例的 `zM`。

地图实例在 `层/tile/<key>`，字段是 `x,y,u,no,zM`。`100000000.img` 的 `0/tile` 子节点顺序开头是 `35,34,2,0,17`，不是按 key 排序。实例坐标是 `x,y`。Canvas origin 在 Tileset img 里。二者不是同一个坐标系。

## Obj

111 张 img，22293 张 canvas。20302 张有 `z`，8062 张有 `delay`。路径形状是 `<l0>/<l1>/<l2>/<帧>`。帧可以是 canvas，也可以是里面再挂 canvas 的子节点。UOL 指向同级帧，例如 `Obj/dungeon2.img` 的 `snowyLightrock/artificiality/1/4` 指向 `.../2`。

地图实例在 `层/obj/<key>`。165125 条 bag 含整数 `zM`。实例同时有资源上的 `z` 和实例上的 `z`，名字相同、位置不同：资源 z 在 Obj img 的 canvas 下，实例 z 在地图 obj 节点上。客户端读取哪一个见排序记录。数据本身两处都保留。

## MapHelper

`MapHelper.img` 不是地图边界，也不是 Camera。它的顶层是 `weather`、`portal`、`mark`、`worldMap`、`AvatarMegaphone`、`minimap`。818 张 canvas。737 张有 origin，464 张有 z，68 张有 delay。`portal/game/pv/0` 只有 origin (43, 173)，没有 z，没有 delay。

`portal` 下面只有两个孩子：

- `editor`：编辑器用的单张 canvas，例如 `sp`、`pi`。
- `game`：`pv`、`ph`、`psh`。`ph/default` 和 `psh/default` 下面有 `portalStart`、`portalContinue`、`portalExit`。

地图运行时的边界、出生点、传送门、立足点和绳子不在这张 img 里。它们在每张 `Map/*/*.img`：

| 节点 | 提取到的 bag 数 | 已看到的原始字段 |
|---|---:|---|
| `info` | 4438 | 每张地图都有的包括 `version,cloud,town,returnMap,forcedReturn,mobRate,bgm,mapMark`。`VRLeft,VRTop,VRRight,VRBottom` 各 3308。完整名单在 `maps/classify-summary.json` |
| `back` | 48548 | 见上 |
| `层/tile` | 478444 | `x,y,u,no,zM` |
| `层/obj` | 189981 | 含 `oS,l0,l1,l2,x,y,z,f`，多数另有 `zM` |
| `portal` | 21446 | `pn,pt,x,y,tm,tn`，部分另有 `script,delay,hideTooltip,onlyOnce,hRange,image` |
| `foothold` | 398609 | `x1,y1,x2,y2,prev,next` |
| `ladderRope` | 13719 | `x,y1,y2,l,uf,page` |
| `miniMap` | 4556 | `width,height,centerX,centerY,mag` 等，以每条 raw 为准 |

`pt` 计数：0=8916，1=3119，2=1962，7=1439，3=1296，8=628，9=516，6=219，10=206，11=15，5=12，4=10，12=1。

字段用途只有在客户端函数里读到才写入对应逆向记录。这里没有被函数引用的 info 字段保持 UNKNOWN，不按名字解释。
