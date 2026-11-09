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
| VR 边界 | `0x66E59E` | VERIFIED 四边加减 400/300。跟随和 world-to-screen UNKNOWN |
| Back 实例 | `0x669397` | VERIFIED 属性读取、type 4/6 与 5/7、`20000/abs(rate)` |
| Back 平铺辅助 | `0x66A8D5` | PARTIALLY VERIFIED。mode bit 和 0 步长改 1 已看见，cx 与寄存器的对应还没走完 |
| Tile 键 | `0x666C0D` | VERIFIED `z + 10*(layer*3000 - zM) - 1073721834` |
| Obj 键 | `0x66885B` | VERIFIED `layer*30000 + z - 1073739824`。不读 zM |
| 相同键 | Henesys tile 35 和 34 键相同 | 键 VERIFIED。tie-break UNKNOWN |
| Portal 实例 | `0x71A203` | VERIFIED `pt` 在 `+8` |
| Portal pv | `0x71ACAF` | VERIFIED 路径 `Map/MapHelper.img/portal/game/pv` |
| Portal ph / psh | `0x71AF39` / `0x71B1C3` | VERIFIED 路径。哪个 pt 调用它们：INFERRED |
| portalStart / Continue / Exit | `0x71BAE3` / `0x71BDA9` / `0x71B81B` | VERIFIED 这些名字被读取 |

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

- [ ] Camera 跟随和 world-to-screen。只完成了 VR 边界写入
- [x] Background 的 type、rx/ry 选择和 20000 除法。COM `+0x98` 内部仍未知
- [x] Tile 键公式
- [x] Obj 键公式
- [ ] 相同键的 tie-break
- [x] Portal 的 pv 选择函数
- [x] pt 2/4/7 → pv，pt 10/11 → `image`/`default`。ph/psh 与 pt 的对应还是 INFERRED
- [x] 上表里的地址、调用点和反汇编
- [x] Henesys、101040000、702090203、105050106 的键是用公式和 WZ 字段算出来的，不是运行时画出来的

## 仍开放

- Camera 位置、dead zone、地图小于视口、world-to-screen、DPR：UNKNOWN
- 排序方向和相同键的次序：UNKNOWN
- Background `+0x98` 里的实际位移：UNKNOWN
- `0x43715C` 返回的时间单位：UNKNOWN
- pt 0、1、3、5、6、8、9、12 的可见资源：PARTIALLY VERIFIED 或 UNKNOWN
- info 里大量字段（`fieldLimit`、`mobRate`、`swim` 等）只有原始值，没有对应的读取函数：UNKNOWN
- 没有运行时断点。全部函数证据是静态反汇编加字符串编号
