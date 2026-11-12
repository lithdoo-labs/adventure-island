# 商城/交易/小游戏系统全景（第二十五轮）

日期: 2026-11-13。客户端窗口 × 服务器格式 × 子操作码三方合成。

## 玩家交互家族（0x77 PLAYER_INTERACTION）

### 子操作码表（write(opcode) 首字节实证）
| 子码 | 功能 |
|---|---|
| 4 | 访客进入（商店/房间） |
| 5 | 房间创建（商店/小游戏） |
| 6 | 房间聊天 |
| 10 | 访客离开 |
| 23 | 商品更新/购买错误 |
| 35/44/45 | 雇佣商店（访客视图/黑名单） |
| 48-62 | **小游戏**（求和/拒绝/准备/开始/跳过/认输） |
| 63 | **奥妙落子**（move1/move2/move3 = x/y/board） |
| 67 | **翻牌选择**（turn/slot/firstslot/type） |

### 小游戏双件套
- **奥妙五子棋**：getMiniGameMoveOmok{move1,move2,move3}、胜负 61、跳过 62
- **MatchCard 翻牌配对**：getMatchCardSelect{turn,slot,firstslot,type}、开始 60

## 商城系统（CS_OP 子码）

| 子码 | 功能 |
|---|---|
| 18 | enableCSUse（商城可用） |
| 60 | 优惠券兑换物品 |
| 66 | 显示现金背包 |
| 70 | 心愿单 |
| 76 | 已购商品 |
| 106 | 失败码 |
| 111 | 已购任务道具 |
| 126 | 已购礼包 |
- **warpCS（进入商城）= 35 字段**（完整角色+货币+背包状态）
- BuyCashItem（c2s, 28 读）= 购买请求全格式

## 雇佣商店（0x3D MERCH）
merchItemStore/ItemData（NPC 9030000 = 雇佣商店管理员）

## 特殊
- playCashSong（CASH_ 操作码）：现金道具播放歌曲
- useChalkboard：粉笔板{charid, msg}
- confirmShopTransaction：code 确认

## 客户端窗口
CS3thEvent(15K)/CashEffect/CashEquip/CashGachapon{EffectNormal,EffectJackpot}

## 就绪度
shop_trade 86→**90%**（商店+交易+小游戏+商城+雇佣全格式）
