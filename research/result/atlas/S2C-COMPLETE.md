# s2c 协议 100% 闭合 + 音频协议路径（第二十一轮）

日期: 2026-11-13。

## 17 个缺失 writer 委托解析（s2c 覆盖 284/284 = 100%）

| 缺失 writer | 委托目标 |
|---|---|
| showItemLevelup / showEquipmentLevelUp / showItemLevelupEffect | showSpecialEffect(**17**) |
| showMonsterBookPickup | showSpecialEffect(**14**) |
| showForeignItemLevelupEffect | showSpecialEffect(cid, 17) |
| **showEffect / playSound / musicChange** | **environmentChange(x, 3/4/6)** |
| serverNotice | serverMessage(type, 0, msg, false) |
| enterSnowBall | rollSnowball(0,...) |
| showItemUnavailable / getShowInventoryFull | getShowInventoryStatus(**254/255**) |
| Mulung_Pts / HSText | showQuestMsg |
| MulungEnergy | sendPyramidEnergy("energy",...) |
| summonAttack | **空包桩**（禁用功能） |
| getPacketFromHexString | HexTool 工具 |

## 🎵 音频协议路径（最终闭环）

**environmentChange 类型码 = 3/4/6**：
```
type 3 = 视觉效果（showEffect）
type 4 = 音效（playSound）
type 6 = 背景音乐（musicChange）
```
服务器→客户端音频触发全链路：
```
server.playSound(name) → environmentChange(name, 4)
  → 客户端 → Sound/field.img/<map>/<event> → WINMM 播放
```
**音频三段（命名/协议/播放机制）全部闭合。**

## showSpecialEffect 特效码表（新增）
```
14 = MonsterBook 拾取    17 = 装备/物品升级
```

## Radio / UtilDlgEx 窗口
- Radio：On/0-4 + Off/0 = 5 频道开关按钮组
- UtilDlgEx：ic/is/it 前缀族（图标/状态/文本三件套）
