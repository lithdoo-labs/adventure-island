# 地图场景渲染数据契约（Phase 1 交付）

日期: 2026-11-11。方法：wzpy 直读 Map.wz/Base.wz（region='EMS'），样本地图 100000000（射手村）。
目标：给 loom-realm `game-libs/map` + `tile-presentation` 的完整数据侧规格。

## 1. 绘制顺序表（RENDER-ZMAP-ORDER.csv）

- `Base.wz/zmap.img`：**149 层**，角色/物件部件的绘制顺序（数据即顺序，先=最底）
  头部：mobEquipFront → tamingMobFront → mobEquipMid → saddleFront → …
  **`characterStart` 在第 6 位**——角色本体绘制起点，之前的层（骑乘装备等）画在角色后
  尾部：… → At(武器挂点) → Fc(脸) → Hr(发) → Hd(头) → Bd(身体)
- `Base.wz/smap.img`：147 层（次级映射，覆盖同名层的替代顺序）
- 角色 Look 数据里每个部件的 `"z"` 字段（如 `"z":"backBody"`、`"z":"armOverHair"`）
  = 在此表中查序号 → 排序绘制（指令级未验证，属数据契约推断，B 级）

## 2. 地图 img 结构（`Map.wz/Map<区号>/<地图ID>.img`，区号=ID/100000000）

18 个顶节点：

| 节点 | 内容 | 字段（实测射手村） |
|---|---|---|
| `info` | 地图属性 15 项 | version,cloud,town,mobRate,bgm,returnMap,forcedReturn,hideMinimap,moveLimit,**mapMark**,**swim**,fieldLimit,**fly**,noMapCmd,onUserEnter |
| `back` | 背景层 0..7 | 每层：`bS`(集名) `no` `x,y` `rx,ry`(视差速率) `type`(0-4 滚动模式) `cx,cy`(平铺尺寸) `a`(透明度255) `front`(0=背景/1=前景) `ani` `f`(翻转) |
| `0..7` | **瓦片层 ×8** | 每层 `{info:{tS:瓦片集名}, tile:{…}, obj:{…}}` |
| — tile 条目 | | `x,y`(放置) `u`(部件名) `no`(编号) `zM`(层内 z) |
| — obj 条目 | | `oS`(物件集) `l0,l1,l2`(三级路径) `x,y` `z`(层内 z) `f`(翻转) |
| `life` | NPC/怪 | id/type/x/y/… |
| `foothold` | `<层>/<平台>/<段>` | 段：`x1,y1,x2,y2,prev,next`（prev/next=邻段下标，构成斜坡链） |
| `ladderRope` | 绳/梯 | `l,uf,x,y1,y2,page`（已逆向，见 MAP-DATA-SIDE-FINDINGS） |
| `portal` | 传送门 | `pn`(名) `pt`(类型,0=sp) `x,y` `tm`(目标图,999999999=无) `tn`(目标门名) |
| `seat` | 可坐点 | index,x,y（多张图，配套 sit 动作 0x27-0x2C） |
| `miniMap` | 小地图 | **width,height(=地图 VR 尺寸!)** centerX,centerY,mag,canvas |
| `reactor`/`ToolTip` | | 反应堆/提示 |

## 3. 关键交叉引用（已逆向机制）

| 契约字段 | 已逆向的对应机制 | 证据级 |
|---|---|---|
| `info.swim` | 全图水域标志 → `field+0x150`（move+0x150 是水平键，勿混） | A |
| `info.fly` | 飞行图（swim 判定器飞行分支恒真） | B |
| foothold x1/x2/y | 陆跳分母 decrypt 参数的来源候选（立足点几何） | C |
| foothold prev/next | 斜坡链（行走积分的斜坡投影用） | C |
| miniMap width/height | 地图 VR（相机/移动钳制 field+0x138..0x144 的来源） | B |
| ladderRope.y1/y2 | 攀爬 y 钳制界 | A |
| `Map/Physics.img` | 19 常数（walkForce=140000 等） | B |
| swimArea 子节点（局部水域） | 4 坐标加密矩形（装载器 0x53602C） | B |

## 4. 渲染装配顺序（实现建议，B 级契约 + C 级推断）

```
1. back 层（front=0）：按 type 滚动模式 + rx/ry 视差 + bS 集合取图
2. 瓦片层 0..7 依次：tile 按 (tS,u,no) 取图、按 zM 层内排序
   同层 obj 按 (oS,l0,l1,l2) 取图、按 z 排序
3. 角色/怪/NPC 按 zmap 查层序（characterStart 位置相对插入）
4. front=1 的 back 层（前景）
5. 相机：跟随角色，钳制在 miniMap width/height 内（=VR）
```

## 5. 仍缺（渲染管线的代码侧）

- canvas 位图解码规格（wzpy 可读 canvas 元数据，像素格式需对接 tile-presentation）
- type 0-4 滚动模式的精确公式（视差代码未逆向）
- smap 与 zmap 的切换条件（何时用哪张序表）
- z 序代码侧（t036 转储停在 zmap 子节点枚举前，层名未物化——需进图后转储或纯静态续挖）

## 提取配方（复现本契约）

```python
import sys; sys.path.insert(0, r'.work\tools\wz-python')
from wzpy import WzFile
wz = WzFile.open(r'.work\task-001\extracted\冒险岛online\Map.wz', region='EMS')
img = wz.root.get('Map').get('Map1').get('100000000.img')
img.parse()
ch = img.children(); ch = ch() if callable(ch) else ch
# 子节点类型: WzIntProperty/WzStringProperty/WzFloatProperty → .value 取值
#             WzSubProperty → .children() 递归
```
