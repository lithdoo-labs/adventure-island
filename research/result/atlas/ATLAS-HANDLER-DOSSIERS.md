# s2c Handler 功能档案（闭包深挖）

生成：2026-11-12。102 handlers，平均闭包 46 函数。


## misc（81 handlers）

| opcode | handler(csv键) | 服务器名 | 闭包 | 读序 | 字符串锚 | 字符串ID |
|---|---|---|---|---|---|---|
| 0x10 | 0x964e0 | ? | 6 |  |  |  |
| 0x13 | 0x960e6 | CHANGE_CHANNEL | 21 |  |  |  |
| 0x14 | 0x960a5 | PING | 32 |  |  |  |
| 0x15 | 0x961c7 | STRANGE_DATA | 40 |  |  | 5416,2982,2983,2984 |
| 0x16 | 0x96347 | ? | 23 |  |  | 5416,2982,2983,2984 |
| 0x18 | 0x9639d | CHANNEL_SELECTED | 51 | rbytes×2 |  |  |
| 0x1C | 0x96477 | ? | 3 |  |  |  |
| 0x20 | 0x6286ec | MODIFY_INVENTORY_ITEM | 120 |  |  |  |
| 0x21 | 0x629024 | UPDATE_INVENTORY_SLOT | 18 |  |  |  |
| 0x22 | 0x6292f5 | UPDATE_STATS | 120 | rbytes×1 | type | 1441,2017,2086,2088 |
| 0x23 | 0x6299ff | GIVE_BUFF | 120 | rbytes×1 | Effect/ItemEff.img/2022269 |  |
| 0x24 | 0x629e60 | CANCEL_BUFF | 120 | rbytes×2 |  | 1973,1974,3541,3542,3543,3436 |
| 0x25 | 0x62a040 | TEMP_STATS | 90 |  | UI/UIWindow.img/Skill/Tab/AranButton/Bt% | 1750,1751,1752,1753,330,331 |
| 0x26 | 0x62a05d | TEMP_STATS_RESET | 87 |  | UI/UIWindow.img/Skill/Tab/AranButton/Bt% | 1750,1751,1752,1753,330,331 |
| 0x27 | 0x6280d7 | UPDATE_SKILLS | 108 |  | UI/UIWindow.img/Skill/Tab/AranButton/Bt% | 1750,1751,1752,1753,330,331 |
| 0x29 | 0x62bb3c | FAME_RESPONSE | 53 |  |  | 252,251,253,254,255,258 |
| 0x2A | 0x62a115 | SHOW_STATUS_INFO | 120 | rbytes×2 | type | 5432,5,5549,243,241,5336 |
| 0x2B | 0x62e85f | SHOW_NOTES | 40 | rbytes×2 |  |  |
| 0x2C | 0x62ea39 | TROCK_LOCATIONS | 26 |  |  |  |
| 0x2D | 0x62ff74 | ANTI_MACRO_RESULT | 113 |  | Effect/BasicEff.img/Combo/%d/%d;Effect/BasicEff.img/Combo/%d |  |
| 0x2F | 0x631374 | CLAIM_RESULT | 24 |  |  |  |
| 0x30 | 0x63161a | CLAIM_STATUS_CHANGED | 2 |  |  |  |
| 0x31 | 0x631643 | SET_TAMING_MOB_INFO | 2 |  |  |  |
| 0x32 | 0x632d3b | UPDATE_MOUNT | 78 |  |  | 1519 |
| 0x33 | 0x630827 | SHOW_QUEST_COMPLETION | 7 |  |  |  |
| 0x34 | 0x631881 | SEND_TITLE_BOX | 107 | rbytes×2 |  | 3275,382,1969,3501,3500,3620 |
| 0x35 | 0x6281eb | USE_SKILL_BOOK | 111 |  |  |  |
| 0x36 | 0x62857f | FINISH_SORT | 14 |  |  | 1670,1671 |
| 0x37 | 0x6285a9 | FINISH_GATHER | 14 |  |  | 1670,1671 |
| 0x41 | 0x62bede | SERVERMESSAGE | 23 |  |  |  |
| 0x45 | 0x632c6f | ENGAGE_REQUEST | 42 |  |  | 3481,1981,1982 |
| 0x46 | 0x611325 | SHOW_PREDICT_CARD | 12 |  |  |  |
| 0x47 | 0x633080 | USE_FISHING_ITEM | 3 |  |  |  |
| 0x48 | 0x633188 | USE_SUMMON_BAG | 24 |  |  | 3007 |
| 0x4A | 0x633329 | USE_MOUNT_FOOD | 6 |  |  |  |
| 0x4B | 0x61a8b8 | SCRIPTED_ITEM | 1 |  |  |  |
| 0x4C | 0x61a8bb | USE_CASH_ITEM | 8 |  |  |  |
| 0x4D | 0x63338a | ? | 14 |  |  |  |
| 0x4E | 0x628654 | YELLOW_CHAT | 40 |  |  |  |
| 0x4F | 0x6286d3 | USE_SKILL_BOOK | 2 |  |  |  |
| 0x50 | 0x6115f4 | ? | 50 |  |  | 3927,3928 |
| 0x51 | 0x611928 | ? | 2 |  |  |  |
| 0x52 | 0x61ad04 | USE_RETURN_SCROLL | 8 | rbytes×2 |  |  |
| 0x53 | 0x61ac68 | USE_UPGRADE_SCROLL | 20 |  |  |  |
| 0x54 | 0x61ce26 | DISTRIBUTE_AP | 13 | rbytes×2 |  |  |
| 0x55 | 0x6333f3 | AUTO_ASSIGN_AP | 14 |  |  |  |
| 0x56 | 0x63345c | AVATAR_MEGA | 43 | rbytes×2 |  |  |
| 0x57 | 0x63359e | DISTRIBUTE_SP | 13 |  |  |  |
| 0x58 | 0x63383a | SPECIAL_MOVE | 17 |  |  |  |
| 0x59 | 0x611934 | CANCEL_BUFF | 37 | rbytes×2 |  | 4452,4451,1499 |
| 0x5A | 0x611948 | PLAYER_NPC | 37 | rbytes×2 |  | 4452,4451,1499 |
| 0x5B | 0x61179e | MONSTERBOOK_ADD | 120 |  |  | 2360,2359,1441 |
| 0x5C | 0x6118bb | MONSTERBOOK_CHANGE_COVER | 84 |  |  |  |
| 0x5D | 0x6118dd | ? | 6 |  |  |  |
| 0x60 | 0x61b999 | FAIRY_PEND_MSG | 18 |  |  |  |
| 0x61 | 0x61ba28 | CHANGE_MAP_SPECIAL | 19 |  |  |  |
| 0x62 | 0x61bacf | USE_INNER_PORTAL | 74 |  |  | 2491,2490 |
| 0x63 | 0x61c1ed | TROCK_ADD_MAP | 120 |  |  | 2116,4825,4826,1441,2110,2106 |
| 0x64 | 0x63dff2 | SEND_PEDIGREE | 41 |  |  |  |
| 0x65 | 0x63e008 | OPEN_FAMILY | 42 |  |  |  |
| 0x66 | 0x63e164 | FAMILY_MESSAGE | 45 |  |  |  |
| 0x67 | 0x63e4b3 | FAMILY_INVITE | 38 |  |  |  |
| 0x68 | 0x63e59f | FAMILY_JUNIOR | 47 |  |  |  |
| 0x69 | 0x63e695 | SENIOR_MESSAGE | 44 |  |  |  |
| 0x6A | 0x63e723 | FAMILY | 10 |  |  |  |
| 0x6B | 0x63e8df | REP_INCREASE | 90 |  |  | 5432,5,5549,4861,4860 |
| 0x6C | 0x63e9e3 | FAMILY_LOGGEDIN | 18 |  |  |  |
| 0x6D | 0x63eaac | FAMILY_BUFF | 46 |  |  |  |
| 0x6E | 0x63ebd0 | FAMILY_USE_REQUEST | 54 |  |  |  |
| 0x6F | 0x61c3f7 | LEVEL_UPDATE | 49 |  |  | 4914,4913,4909,4912 |
| 0x70 | 0x61c584 | MARRIAGE_UPDATE | 45 |  |  | 4910,4914,4913 |
| 0x71 | 0x61c6af | JOB_UPDATE | 54 |  |  | 5524,5554,5517,5555,5534,5561 |
| 0x72 | 0x61c7fb | DATA_CRC_CHECK_FAILED | 2 |  |  |  |
| 0x73 | 0x61ca98 | TOP_MSG | 16 |  |  |  |
| 0x74 | 0x61cb05 | BBS_OPERATION | 11 |  |  |  |
| 0x77 | 0x6338e6 | PLAYER_INTERACTION | 6 |  |  |  |
| 0x79 | 0x633fce | DENY_PARTY_REQUEST | 46 |  |  | 4743,4744 |
| 0x7B | 0x634771 | DENY_GUILD_REQUEST | 10 |  |  |  |
| 0x7C | 0x6347b2 | ? | 6 |  |  |  |
| 0x7F | 0x634a9b | NOTE_ACTION | 58 | rbytes×2 |  | 800,5242 |
| 0x81 | 0x37e6f3 | WARP_TO_MAP | 120 | rbytes×10 |  | 2206,2207,2208,5416,2982,2983 |

## social（8 handlers）

| opcode | handler(csv键) | 服务器名 | 闭包 | 读序 | 字符串锚 | 字符串ID |
|---|---|---|---|---|---|---|
| 0x3B | 0x648120 | PARTY_OPERATION | 120 | rbytes×1 |  | 5432,5,5549,795,2473,2474 |
| 0x3C | 0x64915c | BUDDYLIST | 117 | rbytes×3 |  | 5524,5554,5517,5555,5534,5561 |
| 0x3E | 0x641174 | GUILD_OPERATION | 120 | rbytes×3 |  | 697 |
| 0x3F | 0x643bba | ALLIANCE_OPERATION | 120 | rbytes×3 |  | 5524,5554,5517,5555,5534,5561 |
| 0x76 | 0x61b633 | MESSENGER | 26 |  |  | 1965,1967,1964,1966 |
| 0x78 | 0x6339b9 | PARTY_OPERATION | 83 | rbytes×2 |  |  |
| 0x7A | 0x6340ce | GUILD_OPERATION | 22 |  |  | 5072,5073 |
| 0x7E | 0x634c3b | BUDDYLIST_MODIFY | 14 |  |  |  |

## character（3 handlers）

| opcode | handler(csv键) | 服务器名 | 闭包 | 读序 | 字符串锚 | 字符串ID |
|---|---|---|---|---|---|---|
| 0x3A | 0x62cde5 | CHAR_INFO | 120 | rbytes×2 |  | 797,2116,1857,1858,1861,1863 |
| 0x5E | 0x61b691 | CHAR_INFO_REQUEST | 37 |  |  | 1685,1688,1692,5505 |
| 0x7D | 0x634844 | CHAR_CASH | 48 |  |  |  |

## field（3 handlers）

| opcode | handler(csv键) | 服务器名 | 闭包 | 读序 | 字符串锚 | 字符串ID |
|---|---|---|---|---|---|---|
| 0x40 | 0x62be06 | SPAWN_PORTAL | 79 |  |  | 5432,5,5549,2473,2474 |
| 0x5F | 0x61b6b5 | SPAWN_PET | 18 |  |  |  |
| 0xA2 | 0x37fc9e | SPAWN_PLAYER | 120 | rbytes×9 |  |  |

## inventory（3 handlers）

| opcode | handler(csv键) | 服务器名 | 闭包 | 读序 | 字符串锚 | 字符串ID |
|---|---|---|---|---|---|---|
| 0x42 | 0x631d41 | ITEM_SORT | 61 |  |  | 3177,1441 |
| 0x43 | 0x63284f | ITEM_GATHER | 120 |  | imitate;condition;MapleTV;MapleTVmsgX;MapleTVmsgY;MapleTVadX | 1499 |
| 0x44 | 0x632c39 | ITEM_MOVE | 28 |  |  | 3373 |

## skill（2 handlers）

| opcode | handler(csv键) | 服务器名 | 闭包 | 读序 | 字符串锚 | 字符串ID |
|---|---|---|---|---|---|---|
| 0x28 | 0x62a0f3 | SKILL_USE_RESULT | 3 |  |  |  |
| 0x80 | 0x632d1e | SKILL_MACRO | 12 |  |  |  |

## keymap（1 handlers）

| opcode | handler(csv键) | 服务器名 | 闭包 | 读序 | 字符串锚 | 字符串ID |
|---|---|---|---|---|---|---|
| 0x16F | 0x1b9f14 | KEYMAP | 23 | rbytes×2 |  | 5565,5510,5531,5525 |

## pet（1 handlers）

| opcode | handler(csv键) | 服务器名 | 闭包 | 读序 | 字符串锚 | 字符串ID |
|---|---|---|---|---|---|---|
| 0x49 | 0x633250 | PET_FOOD | 43 |  |  | 3008 |