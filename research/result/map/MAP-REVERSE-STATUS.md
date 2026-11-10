# 地图逆向状态

日期：2026-11-09。分支 `design/adventure-field-map-scene`。没有改前端组件。

## 已检查的位置

- `research/result/`、`research/scripts/`、`research/task/060-map-wz-extraction.md`
- `content/[FSDB]cms` 的 `[struct]Back`、`[struct]Tileset`、`[struct]Obj`、`[struct]Map`、`[struct]MapHelper`、`[group]Back`、`[group]Tile`、`[group]Obj`
- `.work/task-001/extracted/冒险岛online/Map.wz`
- `.work/task-023/tools/wz-python`
- `.work/task-036/game-image-unpacked.bin`
- 没有 `reverse-engineering/` 目录。记录放在已有的 `research/result/map/`

FSDB 是小样本，而且动画帧没有 delay。全量数据来自 Map.wz。

## 数据

| 项 | 数量 | 等级 |
|---|---:|---|
| 打开的 img | 4614 | VERIFIED |
| Back canvas | 4402 | VERIFIED |
| Tile canvas | 2348 | VERIFIED |
| Obj canvas | 22293 | VERIFIED |
| MapHelper canvas | 818 | VERIFIED |
| 地图 back / tile / obj / portal 实例 bag | 48548 / 478444 / 189981 / 21446 | VERIFIED |
| UOL | 898，全部 resolved | VERIFIED |
| 解析失败 | 0 | VERIFIED |

缺字段保持缺省：4 张 tile canvas 没有 `z`，归一化值是 null。`Back/grassySoil.img/ani/0` 的 10 帧都没有 `delay`。

## 函数

| 主题 | VA | 等级 |
|---|---|---|
| 字符串取值 | `0x7A48D0`，解码 `0x7A4DA9`，旋转 `0x7A4CBE` | VERIFIED。编号 798 = `origin` |
| VR 边界 | `0x66E59E` | VERIFIED 四边加减 400/300。唯一调用点 `0x66630D`。跟随和 world-to-screen UNKNOWN |
| Back 实例 | `0x669397` | VERIFIED 属性读取、type 4/6 与 5/7、`20000/abs(rate)`、`+0x98` 的参数顺序 |
| Back 平铺辅助 | `0x66A8D5` | VERIFIED `cx`/`cy` 是两轴步长，mode bit0/bit1，零步长不是画布尺寸。span 用的槽位方法体 UNKNOWN |
| Tile 键 | `0x666C0D` | VERIFIED `z + 10*(layer*3000 - zM) - 1073721834`。只交给虚表 `+0xB4` |
| Obj 键 | `0x66885B` | VERIFIED `layer*30000 + z - 1073739824`。不读 zM |
| 相同键 | Henesys tile 35 和 34 键相同 | 键 VERIFIED。比较器不在本映像，tie-break UNKNOWN |
| Portal 实例 | `0x71A203` | VERIFIED `pt` 在 `+8`，`pn` 在 `+4`，`tm` 在 `+0x1C`，`tn` 在 `+0x20` |
| Portal 命中 | `0x71B4FD` | VERIFIED `x±hRange/2`、`y±vRange/2`。导入名未在静态表出现 |
| Portal 同图 | `0x71B4C0`、`0x963CE1` | VERIFIED `tn` 与另一个 portal 的 `pn` 比较。`x` 和 `y-10` 传入 `0xA4F6F1`，落点写入未还原 |
| Portal 跨图 | `0x53FF69` | PARTIALLY VERIFIED。`ret 0xC`，发 `0x495C5C`，不写本地地图 id |
| Portal pv | `0x71ACAF` | VERIFIED 路径 `Map/MapHelper.img/portal/game/pv` |
| Portal ph / psh | `0x71B6D1` | VERIFIED。离开和进入都是 `pt == 10` 走 ph，否则 psh |
| portalStart / Continue / Exit | `0x71BAE3` / `0x71BDA9` / `0x71B81B` | VERIFIED 这些名字被读取 |
| 上键传送 | `0x954B58`、`0x71B44D` | VERIFIED。固定框 `x±20`、`y±50`，跳过 `pt == 0`。详见 MAP-MOTION-REVERSE |
| 下跳 | `0x95308C` | VERIFIED 查询。`0x940011` 只发效果。速度在 `0x9BCFED`：竖直写 `+0x68`/`+0x78`，水平 0 写 `+0x50`/`+0x60`。字段名 UNKNOWN |
| 坐下 | `0x95516A`、`0x54634C` | VERIFIED 座位点和人物 `x±10`、`y±30`。`sit` 动作写入 UNKNOWN |
| 绳子记录 | `0xA4FC6F` | VERIFIED 命中：x 两端各扩 10，y 对 `+0x10`/`+0x14`。`0x9D80DF` 的虚表 `+0x14` 是 `0x9BFB52`，不读 `l`。动作下标仍未写到人物上 |
| 攻击入口 | `0x954F0F` | PARTIALLY VERIFIED。`swingO1` 下标 5、`stabO1` 下标 `0x10` 是表地址算出来的，`[ebp-4]` 那些数是 SEH。选择和命中 UNKNOWN |

## 验收

数据：

- [x] Back 画布和元数据
- [x] Tile 画布和元数据
- [x] Obj 画布和元数据
- [x] MapHelper 画布；地图 info/portal/foothold/ladder 的原始字段
- [x] origin、z、width、height 来自 WZ 节点。缺 z 的 4 张 tile 明确是 null
- [x] 有 delay 的帧保留 delay，没有的不补 0
- [x] UOL 链
- [x] 归档 SHA-256 和每张 img 的 SHA-256
- [x] `research/scripts/map_wz_extract.py` 与 `research/scripts/map_wz_classify.py` 可重复执行
- [x] `research/scripts/test_map_extract.py` 和 Schema

客户端：

- [ ] Camera 跟随和 world-to-screen。VR 写入、唯一调用点和“下一项是 life”已经核对，跟随函数不在其中
- [x] Background 的 type、rx/ry 选择、20000 除法和 `+0x98` 参数顺序。COM 方法体仍未知
- [x] `cx`/`cy` 与步长寄存器的对应。零值不换成画布宽高
- [x] Tile 键公式
- [x] Obj 键公式
- [ ] 相同键的 tie-break。本映像只把一个整数交给虚表 `+0xB4`
- [x] Portal 的 pv 选择函数
- [x] pt 2/4/7 → pv，pt 10/11 → `image`/`default`。ph/psh 由 `pt == 10` 决定
- [x] `0x71B4FD` 用 `hRange`/`vRange` 的一半。同图用 `tn` 匹配 `pn`。跨图调用不接收 `tm`。这不是上键换图
- [x] 上键 `0x71B44D` 用固定框 `x±20`、`y±50`，跳过 `pt == 0`。这次四扇门换图用这一条
- [x] 上表里的地址、调用点和反汇编
- [x] Henesys、101040000、702090203、105050106 的键是用公式和 WZ 字段算出来的，不是运行时画出来的

## 仍开放

- Camera 位置、dead zone、地图小于视口、world-to-screen、DPR：UNKNOWN。已排除 VR 函数自身和它的唯一调用点
- 排序方向和相同键的次序：UNKNOWN。比较不在本映像，键只进入虚表 `+0xB4`
- Background `+0x98` 的方法体：UNKNOWN。参数顺序已确认
- `0x43715C` 是 layer 虚表 `+0x58`。时间单位 UNKNOWN
- 跨图的本地地图 id：`0x53FF69` 不写它，只发报文。产品用 Plan 的 `(tm, tn)`
- `0xA4F6F1` 把选中立足段的 y 写进输出指针，返回立足对象，不写人物坐标。同图调用传 `x`、`y-10`、空输出、`0x7FFFFFFF`、半宽 1。返回非 0 且参数非 0 时，`0x963D89` 起组报文，把人物坐标和目标门坐标放进报文后调用 `0x495C5C`，这里不写人物 `+0x20`/`+0x38`。参数为 0 则跳到 `0x96422C`。人物落点写入仍 UNKNOWN
- pt 0、1、3、5、6、8、9、12 的 MapHelper 画面：加载分支不取 pv。pt 13 的使用路径读取 `Effect/BasicEff.img/VerticalJump`
- `info.swim` 收成 0 或 1 存在地图对象 `+0x150`（`0x534C86` 字符串 `0xBEF`，`0x534CBE` 写入）。`0x95A31E` 和 `0x69733B` 读的都是 `0x4376F2` 返回的全局 `[0xBDF54C]+0x150`，不是这处地图字段。全局指针只见到写成 0（`0x77E64E`、`0x77FB40`）。水中跳仍 UNKNOWN。`info.town` 存在 `field+0x14C`
- 陆地跳在立足对象非 0 时由 `0x9BD20E` 写 `+0x68`/`+0x78`。没有立足对象时，`0x70DF65` 非 0 的那支在 `0x9BD42D` 取负后也写入 `+0x68`/`+0x78`。`[move+0x190]` 和 `[move+0x198]` 在 `0x9BC378`、`0x9BC37E` 被写成 0。`+0x48`、`+0x6C`、`+0x24`、`+0x18` 的字段名 UNKNOWN
- `0x9D80DF` 调用 `0x9BFB52`。已排除它、`0x9BFD85`、`0x6B8949`、`0x9D3CCA`、`0x9D47FA`、`0xA4FC6F` 读记录 `+4`。`l` 选 `ladder`/`rope` 仍 UNKNOWN。`+0x80`、`+0x98` 没有找到 `0x6131F4` 写入，仍没有名字
- 攻击命中仍 UNKNOWN。`0xA4F93C` 在两点重合时返回 1，否则交给 `0x5114AA` 排成矩形。两个函数都没有固定半宽，输入也没有对上人物 `+0x20`/`+0x38`。`sit` 动作的本地写入仍 UNKNOWN。记录在 MAP-MOTION-REVERSE.md
- `0x9BD58F` 会在普通双精度 `+0x180`、`+0x188` 小于 0 时改水平、竖直速度。这不是行走、游泳或重力积分，写入来源也没对上。`forbidFallDown` 在 `0xA4E6F9` 收成 0 或 1 后先放进局部 `[ebp-0x18]`，还没有接到下跳函数。
- info 里其余字段（`fieldLimit`、`mobRate` 等）只有原始值，没有对应的读取函数：UNKNOWN
- 没有运行时断点。全部函数证据是静态反汇编加字符串编号
