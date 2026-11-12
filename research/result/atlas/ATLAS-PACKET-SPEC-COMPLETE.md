# 完整包格式规格（服务器圣谕版）

来源：服务端 Java 源码全量提取。
c2s = 客户端发、服务器读的字段序（服务端 handler 的 slea.read* 顺序）
s2c = 服务器写、客户端读的字段序（MaplePacketCreator 的 mplew.write* 顺序）

c2s: 160 个 case（0 个含提取格式）
s2c: 303 个 writer


## c2s（服务器读序）

| 常量 | 名 | 处理器 | 字段序 |
|---|---|---|---|
| PONG | PONG | .PONG | (indirect) |
| STRANGE_DATA | STRANGE_DATA | .STRANGE_DATA | (indirect) |
| EFFECT_ON_OFF | EFFECT_ON_OFF | .EFFECT_ON_OFF | (indirect) |
| NEW_SX | NEW_SX | .NEW_SX | (indirect) |
| HELLO_LOGIN | HELLO_LOGIN | .HELLO_LOGIN | (indirect) |
| HELLO_CHANNEL | HELLO_CHANNEL | .HELLO_CHANNEL | (indirect) |
| LOGIN_PASSWORD | LOGIN_PASSWORD | .LOGIN_PASSWORD | (indirect) |
| SERVERLIST_REQUEST | SERVERLIST_REQUEST | .SERVERLIST_REQUEST | (indirect) |
| LICENSE_REQUEST | LICENSE_REQUEST | .LICENSE_REQUEST | (indirect) |
| CHARLIST_REQUEST | CHARLIST_REQUEST | .CHARLIST_REQUEST | (indirect) |
| SERVERSTATUS_REQUEST | SERVERSTATUS_REQUEST | .SERVERSTATUS_REQUEST | (indirect) |
| CHECK_CHAR_NAME | CHECK_CHAR_NAME | .CHECK_CHAR_NAME | (indirect) |
| CREATE_CHAR | CREATE_CHAR | .CREATE_CHAR | (indirect) |
| DELETE_CHAR | DELETE_CHAR | .DELETE_CHAR | (indirect) |
| CHAR_SELECT | CHAR_SELECT | .CHAR_SELECT | (indirect) |
| AUTH_SECOND_PASSWORD | AUTH_SECOND_PASSWORD | .AUTH_SECOND_PASSWORD | (indirect) |
| SET_GENDER | SET_GENDER | .SET_GENDER | (indirect) |
| CHANGE_CHANNEL | CHANGE_CHANNEL | .CHANGE_CHANNEL | (indirect) |
| PLAYER_LOGGEDIN | PLAYER_LOGGEDIN | .PLAYER_LOGGEDIN | (indirect) |
| ENTER_CASH_SHOP | ENTER_CASH_SHOP | .ENTER_CASH_SHOP | (indirect) |
| ENTER_MTS | ENTER_MTS | .ENTER_MTS | (indirect) |
| PLAYER_UPDATE | PLAYER_UPDATE | .PLAYER_UPDATE | (indirect) |
| MOVE_PLAYER | MOVE_PLAYER | .MOVE_PLAYER | (indirect) |
| CHAR_INFO_REQUEST | CHAR_INFO_REQUEST | .CHAR_INFO_REQUEST | (indirect) |
| CLOSE_RANGE_ATTACK | CLOSE_RANGE_ATTACK | .CLOSE_RANGE_ATTACK | (indirect) |
| RANGED_ATTACK | RANGED_ATTACK | .RANGED_ATTACK | (indirect) |
| MAGIC_ATTACK | MAGIC_ATTACK | .MAGIC_ATTACK | (indirect) |
| SPECIAL_MOVE | SPECIAL_MOVE | .SPECIAL_MOVE | (indirect) |
| PASSIVE_ENERGY | PASSIVE_ENERGY | .PASSIVE_ENERGY | (indirect) |
| FACE_EXPRESSION | FACE_EXPRESSION | .FACE_EXPRESSION | (indirect) |
| TAKE_DAMAGE | TAKE_DAMAGE | .TAKE_DAMAGE | (indirect) |
| HEAL_OVER_TIME | HEAL_OVER_TIME | .HEAL_OVER_TIME | (indirect) |
| CANCEL_BUFF | CANCEL_BUFF | .CANCEL_BUFF | (indirect) |
| CANCEL_ITEM_EFFECT | CANCEL_ITEM_EFFECT | .CANCEL_ITEM_EFFECT | (indirect) |
| USE_CHAIR | USE_CHAIR | .USE_CHAIR | (indirect) |
| CANCEL_CHAIR | CANCEL_CHAIR | .CANCEL_CHAIR | (indirect) |
| USE_ITEMEFFECT | USE_ITEMEFFECT | .USE_ITEMEFFECT | (indirect) |
| WHEEL_OF_FORTUNE | WHEEL_OF_FORTUNE | .WHEEL_OF_FORTUNE | (indirect) |
| SKILL_EFFECT | SKILL_EFFECT | .SKILL_EFFECT | (indirect) |
| MESO_DROP | MESO_DROP | .MESO_DROP | (indirect) |
| MONSTER_BOOK_COVER | MONSTER_BOOK_COVER | .MONSTER_BOOK_COVER | (indirect) |
| CHANGE_KEYMAP | CHANGE_KEYMAP | .CHANGE_KEYMAP | (indirect) |
| CHANGE_MAP | CHANGE_MAP | .CHANGE_MAP | (indirect) |
| CHANGE_MAP_SPECIAL | CHANGE_MAP_SPECIAL | .CHANGE_MAP_SPECIAL | (indirect) |
| USE_INNER_PORTAL | USE_INNER_PORTAL | .USE_INNER_PORTAL | (indirect) |
| TROCK_ADD_MAP | TROCK_ADD_MAP | .TROCK_ADD_MAP | (indirect) |
| ARAN_COMBO | ARAN_COMBO | .ARAN_COMBO | (indirect) |
| SKILL_MACRO | SKILL_MACRO | .SKILL_MACRO | (indirect) |
| ITEM_BAOWU | ITEM_BAOWU | .ITEM_BAOWU | (indirect) |
| ITEM_SUNZI | ITEM_SUNZI | .ITEM_SUNZI | (indirect) |
| GIVE_FAME | GIVE_FAME | .GIVE_FAME | (indirect) |
| TRANSFORM_PLAYER | TRANSFORM_PLAYER | .TRANSFORM_PLAYER | (indirect) |
| NOTE_ACTION | NOTE_ACTION | .NOTE_ACTION | (indirect) |
| USE_DOOR | USE_DOOR | .USE_DOOR | (indirect) |
| DAMAGE_REACTOR | DAMAGE_REACTOR | .DAMAGE_REACTOR | (indirect) |
| TOUCH_REACTOR | TOUCH_REACTOR | .TOUCH_REACTOR | (indirect) |
| CLOSE_CHALKBOARD | CLOSE_CHALKBOARD | .CLOSE_CHALKBOARD | (indirect) |
| ITEM_MAKER | ITEM_MAKER | .ITEM_MAKER | (indirect) |
| ITEM_SORT | ITEM_SORT | .ITEM_SORT | (indirect) |
| ITEM_GATHER | ITEM_GATHER | .ITEM_GATHER | (indirect) |
| ITEM_MOVE | ITEM_MOVE | .ITEM_MOVE | (indirect) |
| ITEM_PICKUP | ITEM_PICKUP | .ITEM_PICKUP | (indirect) |
| USE_CASH_ITEM | USE_CASH_ITEM | .USE_CASH_ITEM | (indirect) |
| quest_KJ | quest_KJ | .quest_KJ | (indirect) |
| USE_ITEM | USE_ITEM | .USE_ITEM | (indirect) |
| USE_MAGNIFY_GLASS | USE_MAGNIFY_GLASS | .USE_MAGNIFY_GLASS | (indirect) |
| USE_SCRIPTED_NPC_ITEM | USE_SCRIPTED_NPC_ITEM | .USE_SCRIPTED_NPC_ITEM | (indirect) |
| USE_RETURN_SCROLL | USE_RETURN_SCROLL | .USE_RETURN_SCROLL | (indirect) |
| USE_UPGRADE_SCROLL | USE_UPGRADE_SCROLL | .USE_UPGRADE_SCROLL | (indirect) |
| USE_POTENTIAL_SCROLL | USE_POTENTIAL_SCROLL | .USE_POTENTIAL_SCROLL | (indirect) |
| USE_EQUIP_SCROLL | USE_EQUIP_SCROLL | .USE_EQUIP_SCROLL | (indirect) |
| USE_SUMMON_BAG | USE_SUMMON_BAG | .USE_SUMMON_BAG | (indirect) |
| USE_TREASUER_CHEST | USE_TREASUER_CHEST | .USE_TREASUER_CHEST | (indirect) |
| USE_SKILL_BOOK | USE_SKILL_BOOK | .USE_SKILL_BOOK | (indirect) |
| USE_CATCH_ITEM | USE_CATCH_ITEM | .USE_CATCH_ITEM | (indirect) |
| USE_MOUNT_FOOD | USE_MOUNT_FOOD | .USE_MOUNT_FOOD | (indirect) |
| HYPNOTIZE_DMG | HYPNOTIZE_DMG | .HYPNOTIZE_DMG | (indirect) |
| MOB_NODE | MOB_NODE | .MOB_NODE | (indirect) |
| DISPLAY_NODE | DISPLAY_NODE | .DISPLAY_NODE | (indirect) |
| MOVE_LIFE | MOVE_LIFE | .MOVE_LIFE | (indirect) |
| AUTO_AGGRO | AUTO_AGGRO | .AUTO_AGGRO | (indirect) |
| FRIENDLY_DAMAGE | FRIENDLY_DAMAGE | .FRIENDLY_DAMAGE | (indirect) |
| MONSTER_BOMB | MONSTER_BOMB | .MONSTER_BOMB | (indirect) |
| NPC_SHOP | NPC_SHOP | .NPC_SHOP | (indirect) |
| NPC_TALK | NPC_TALK | .NPC_TALK | (indirect) |
| NPC_TALK_MORE | NPC_TALK_MORE | .NPC_TALK_MORE | (indirect) |
| MARRAGE_RECV | MARRAGE_RECV | .MARRAGE_RECV | (indirect) |
| NPC_ACTION | NPC_ACTION | .NPC_ACTION | (indirect) |
| QUEST_ACTION | QUEST_ACTION | .QUEST_ACTION | (indirect) |
| STORAGE | STORAGE | .STORAGE | (indirect) |
| GENERAL_CHAT | GENERAL_CHAT | .GENERAL_CHAT | (indirect) |
| PARTYCHAT | PARTYCHAT | .PARTYCHAT | (indirect) |
| WHISPER | WHISPER | .WHISPER | (indirect) |
| MESSENGER | MESSENGER | .MESSENGER | (indirect) |
| AUTO_ASSIGN_AP | AUTO_ASSIGN_AP | .AUTO_ASSIGN_AP | (indirect) |
| DISTRIBUTE_AP | DISTRIBUTE_AP | .DISTRIBUTE_AP | (indirect) |
| DISTRIBUTE_SP | DISTRIBUTE_SP | .DISTRIBUTE_SP | (indirect) |
| PLAYER_INTERACTION | PLAYER_INTERACTION | .PLAYER_INTERACTION | (indirect) |
| GUILD_OPERATION | GUILD_OPERATION | .GUILD_OPERATION | (indirect) |
| UPDATE_CHAR_INFO | UPDATE_CHAR_INFO | .UPDATE_CHAR_INFO | (indirect) |
| DENY_GUILD_REQUEST | DENY_GUILD_REQUEST | .DENY_GUILD_REQUEST | (indirect) |
| ALLIANCE_OPERATION | ALLIANCE_OPERATION | .ALLIANCE_OPERATION | (indirect) |
| DENY_ALLIANCE_REQUEST | DENY_ALLIANCE_REQUEST | .DENY_ALLIANCE_REQUEST | (indirect) |
| BBS_OPERATION | BBS_OPERATION | .BBS_OPERATION | (indirect) |
| PARTY_OPERATION | PARTY_OPERATION | .PARTY_OPERATION | (indirect) |
| DENY_PARTY_REQUEST | DENY_PARTY_REQUEST | .DENY_PARTY_REQUEST | (indirect) |
| BUDDYLIST_MODIFY | BUDDYLIST_MODIFY | .BUDDYLIST_MODIFY | (indirect) |
| CYGNUS_SUMMON | CYGNUS_SUMMON | .CYGNUS_SUMMON | (indirect) |
| SHIP_OBJECT | SHIP_OBJECT | .SHIP_OBJECT | (indirect) |
| BUY_CS_ITEM | BUY_CS_ITEM | .BUY_CS_ITEM | (indirect) |
| TOUCHING_CS | TOUCHING_CS | .TOUCHING_CS | (indirect) |
| COUPON_CODE | COUPON_CODE | .COUPON_CODE | (indirect) |
| CS_UPDATE | CS_UPDATE | .CS_UPDATE | (indirect) |
| TOUCHING_MTS | TOUCHING_MTS | .TOUCHING_MTS | (indirect) |
| MTS_TAB | MTS_TAB | .MTS_TAB | (indirect) |
| DAMAGE_SUMMON | DAMAGE_SUMMON | .DAMAGE_SUMMON | (indirect) |
| MOVE_SUMMON | MOVE_SUMMON | .MOVE_SUMMON | (indirect) |
| SUMMON_ATTACK | SUMMON_ATTACK | .SUMMON_ATTACK | (indirect) |
| MOVE_DRAGON | MOVE_DRAGON | .MOVE_DRAGON | (indirect) |
| PET_EXCEPTIONLIST | PET_EXCEPTIONLIST | .PET_EXCEPTIONLIST | (indirect) |
| SPAWN_PET | SPAWN_PET | .SPAWN_PET | (indirect) |
| MOVE_PET | MOVE_PET | .MOVE_PET | (indirect) |
| PET_CHAT | PET_CHAT | .PET_CHAT | (indirect) |
| PET_COMMAND | PET_COMMAND | .PET_COMMAND | (indirect) |
| PET_FOOD | PET_FOOD | .PET_FOOD | (indirect) |
| PET_LOOT | PET_LOOT | .PET_LOOT | (indirect) |
| PET_AUTO_POT | PET_AUTO_POT | .PET_AUTO_POT | (indirect) |
| MONSTER_CARNIVAL | MONSTER_CARNIVAL | .MONSTER_CARNIVAL | (indirect) |
| DUEY_ACTION | DUEY_ACTION | .DUEY_ACTION | (indirect) |
| USE_HIRED_MERCHANT | USE_HIRED_MERCHANT | .USE_HIRED_MERCHANT | (indirect) |
| MERCH_ITEM_STORE | MERCH_ITEM_STORE | .MERCH_ITEM_STORE | (indirect) |
| CANCEL_DEBUFF | CANCEL_DEBUFF | .CANCEL_DEBUFF | (indirect) |
| LEFT_KNOCK_BACK | LEFT_KNOCK_BACK | .LEFT_KNOCK_BACK | (indirect) |
| SNOWBALL | SNOWBALL | .SNOWBALL | (indirect) |
| ChatRoom_SYSTEM | ChatRoom_SYSTEM | .ChatRoom_SYSTEM | (indirect) |
| COCONUT | COCONUT | .COCONUT | (indirect) |
| REPAIR | REPAIR | .REPAIR | (indirect) |
| REPAIR_ALL | REPAIR_ALL | .REPAIR_ALL | (indirect) |
| GAME_POLL | GAME_POLL | .GAME_POLL | (indirect) |
| OWL | OWL | .OWL | (indirect) |
| OWL_WARP | OWL_WARP | .OWL_WARP | (indirect) |
| USE_OWL_MINERVA | USE_OWL_MINERVA | .USE_OWL_MINERVA | (indirect) |
| RPS_GAME | RPS_GAME | .RPS_GAME | (indirect) |
| UPDATE_QUEST | UPDATE_QUEST | .UPDATE_QUEST | (indirect) |
| USE_ITEM_QUEST | USE_ITEM_QUEST | .USE_ITEM_QUEST | (indirect) |
| FOLLOW_REQUEST | FOLLOW_REQUEST | .FOLLOW_REQUEST | (indirect) |
| FOLLOW_REPLY | FOLLOW_REPLY | .FOLLOW_REPLY | (indirect) |
| RING_ACTION | RING_ACTION | .RING_ACTION | (indirect) |
| REQUEST_FAMILY | REQUEST_FAMILY | .REQUEST_FAMILY | (indirect) |
| OPEN_FAMILY | OPEN_FAMILY | .OPEN_FAMILY | (indirect) |
| FAMILY_OPERATION | FAMILY_OPERATION | .FAMILY_OPERATION | (indirect) |
| DELETE_JUNIOR | DELETE_JUNIOR | .DELETE_JUNIOR | (indirect) |
| DELETE_SENIOR | DELETE_SENIOR | .DELETE_SENIOR | (indirect) |
| USE_FAMILY | USE_FAMILY | .USE_FAMILY | (indirect) |
| FAMILY_PRECEPT | FAMILY_PRECEPT | .FAMILY_PRECEPT | (indirect) |
| FAMILY_SUMMON | FAMILY_SUMMON | .FAMILY_SUMMON | (indirect) |
| ACCEPT_FAMILY | ACCEPT_FAMILY | .ACCEPT_FAMILY | (indirect) |
| BEANS_GAME1 | BEANS_GAME1 | .BEANS_GAME1 | (indirect) |
| BEANS_GAME2 | BEANS_GAME2 | .BEANS_GAME2 | (indirect) |
| MOONRABBIT_HP | MOONRABBIT_HP | .MOONRABBIT_HP | (indirect) |

## s2c（服务器写序）

| 方法 | 写序 |
|---|---|
| getChannelChange | - |
| blockedPortal | - |
| weirdStatUpdate | - |
| removeDoor | - |
| spawnSummon | - |
| removeSummon | - |
| getRelogResponse | - |
| serverBlocked | - |
| serverMessage | - |
| serverNotice | - |
| serverNotice | - |
| serverNotice | - |
| getGachaponMega | - |
| tripleSmega | - |
| getAvatarMega | - |
| itemMegaphone | - |
| spawnNPC | - |
| removeNPC | - |
| spawnNPCRequestController | - |
| spawnPlayerNPC | - |
| getChatText | - |
| GameMaster_Func | - |
| testCombo | - |
| getPacketFromHexString | - |
| getShowItemGain | - |
| getShowItemGain | - |
| showRewardItemAnimation | - |
| showRewardItemAnimation | - |
| dropItemFromMapObject | - |
| spawnPlayerMapobject | - |
| removePlayerFromMap | - |
| facialExpression | - |
| movePlayer | - |
| moveSummon | - |
| summonAttack | - |
| closeRangeAttack | - |
| rangedAttack | - |
| magicAttack | - |
| getNPCShop | - |
| confirmShopTransaction | - |
| addInventorySlot | - |
| addInventorySlot | - |
| pet_updateInventorySlot | - |
| updateInventorySlot | - |
| moveInventoryItem | - |
| loveEffect | - |
| moveInventoryItem | - |
| moveAndMergeInventoryItem | - |
| moveAndMergeWithRestInventoryItem | - |
| clearInventoryItem | - |
| updateSpecialItemUse | - |
| updateSpecialItemUse | - |
| updateSpecialItemUse_ | - |
| updateSpecialItemUse_ | - |
| scrolledItem | - |
| getScrollEffect | - |
| getPotentialEffect | - |
| getPotentialReset | - |
| explodeDrop | - |
| removeItemFromMap | - |
| removeItemFromMap | - |
| updateCharLook | - |
| dropInventoryItem | - |
| dropInventoryItemUpdate | - |
| damagePlayer | - |
| updateQuestInfo | - |
| updateQuestFinish | - |
| giveMount | - |
| givePirate | - |
| giveForeignPirate | - |
| giveHoming | - |
| giveEnergyChargeTest | - |
| givePirateBuff | - |
| giveEnergyChargeTest | - |
| giveBuff | - |
| giveDebuff | - |
| giveForeignDebuff | - |
| cancelForeignDebuff | - |
| showMonsterRiding | - |
| giveForeignBuff | - |
| cancelForeignBuff | - |
| cancelForeignBuffMONSTER | - |
| cancelBuffMONSTER | - |
| cancelBuffMONSTERS | - |
| cancelForeignBuffMONSTERS | - |
| cancelBuff | - |
| cancelHoming | - |
| cancelDebuff | - |
| updateMount | - |
| mountInfo | - |
| getPlayerShopNewVisitor | - |
| getPlayerShopRemoveVisitor | - |
| getTradePartnerAdd | - |
| getTradeInvite | - |
| getTradeMesoSet | - |
| getTradeItemAdd | - |
| getTradeStart | - |
| getTradeConfirmation | - |
| TradeMessage | - |
| getTradeCancel | - |
| getNPCTalk | - |
| getNPCTalkStyle | - |
| getNPCTalkNum | - |
| getNPCTalkText | - |
| showForeignEffect | - |
| showBuffeffect | - |
| showBuffeffect | - |
| showOwnBuffEffect | - |
| showOwnBuffEffect | - |
| showItemLevelupEffect | - |
| showMonsterBookPickup | - |
| showEquipmentLevelUp | - |
| showItemLevelup | - |
| showForeignItemLevelupEffect | - |
| showSpecialEffect | - |
| showSpecialEffect | - |
| updateSkill | - |
| getShowQuestCompletion | - |
| getKeymap | - |
| getWhisper | - |
| getWhisperReply | - |
| getFindReplyWithMap | - |
| getFindReply | - |
| getInventoryFull | - |
| getShowInventoryFull | - |
| showItemUnavailable | - |
| getShowInventoryStatus | - |
| getStorage | - |
| getStorageFull | - |
| mesoStorage | - |
| storeStorage | - |
| takeOutStorage | - |
| fairyPendantMessage | - |
| giveFameResponse | - |
| giveFameErrorResponse | - |
| receiveFame | - |
| partyCreated | - |
| partyInvite | - |
| partyStatusMessage | - |
| partyStatusMessage | - |
| updateParty | - |
| partyPortal | - |
| updatePartyMemberHP | - |
| multiChat | - |
| getClock | - |
| getClockTime | - |
| spawnMist | - |
| removeMist | - |
| damageSummon | - |
| buddylistMessage | - |
| updateBuddylist | - |
| requestBuddylistAdd | - |
| updateBuddyChannel | - |
| itemEffect | - |
| itemEffects | - |
| updateBuddyCapacity | - |
| showChair | - |
| cancelChair | - |
| spawnReactor | - |
| triggerReactor | - |
| destroyReactor | - |
| musicChange | - |
| showEffect | - |
| playSound | - |
| environmentChange | - |
| environmentMove | - |
| startMapEffect | - |
| removeMapEffect | - |
| showMapEffect | - |
| playWZSound | - |
| fuckGuildInfo | - |
| showGuildInfo | - |
| guildMemberOnline | - |
| guildInvite | - |
| denyGuildInvitation | - |
| genericGuildMessage | - |
| newGuildMember | - |
| memberLeft | - |
| changeRank | - |
| guildNotice | - |
| guildMemberLevelJobUpdate | - |
| rankTitleChange | - |
| guildDisband | - |
| guildEmblemChange | - |
| guildCapacityChange | - |
| removeGuildFromAlliance | - |
| changeAlliance | - |
| changeAllianceLeader | - |
| updateAllianceLeader | - |
| sendAllianceInvite | - |
| changeGuildInAlliance | - |
| changeAllianceRank | - |
| createGuildAlliance | - |
| getAllianceInfo | - |
| getAllianceUpdate | - |
| getGuildAlliance | - |
| addGuildToAlliance | - |
| allianceMemberOnline | - |
| updateAlliance | - |
| updateAllianceRank | - |
| disbandAlliance | - |
| BBSThreadList | - |
| showThread | - |
| showGuildRanks | - |
| showmesoRanks | - |
| showlevelRanks | - |
| updateGP | - |
| skillEffect | - |
| skillCancel | - |
| showMagnet | - |
| sendHint | - |
| messengerInvite | - |
| addMessengerPlayer | - |
| removeMessengerPlayer | - |
| updateMessengerPlayer | - |
| joinMessenger | - |
| messengerChat | - |
| messengerNote | - |
| getFindReplyWithCS | - |
| getFindReplyWithMTS | - |
| showEquipEffect | - |
| showEquipEffect | - |
| summonSkill | - |
| skillCooldown | - |
| useSkillBook | - |
| getMacros | - |
| updateAriantPQRanking | - |
| catchMonster | - |
| showAriantScoreBoard | - |
| boatPacket | - |
| boatPacket | - |
| boatEffect | - |
| removeItemFromDuey | - |
| sendDuey | - |
| Mulung_DojoUp2 | - |
| dojoWarpUp | - |
| showQuestMsg | - |
| HSText | - |
| Mulung_Pts | - |
| showOXQuiz | - |
| leftKnockBack | - |
| rollSnowball | - |
| enterSnowBall | - |
| hitSnowBall | - |
| snowballMessage | - |
| finishedSort | - |
| coconutScore | - |
| hitCoconut | - |
| finishedGather | - |
| yellowChat | - |
| getPeanutResult | - |
| sendLevelup | - |
| sendMarriage | - |
| sendJobup | - |
| showZakumShrine | - |
| showHorntailShrine | - |
| showChaosZakumShrine | - |
| showChaosHorntailShrine | - |
| stopClock | - |
| spawnDragon | - |
| removeDragon | - |
| moveDragon | - |
| addTutorialStats | - |
| MulungEnergy | - |
| getPollQuestion | - |
| getPollReply | - |
| getEvanTutorial | - |
| showEventInstructions | - |
| getOwlOpen | - |
| getOwlSearched | - |
| getRPSMode | - |
| followRequest | - |
| followEffect | - |
| getFollowMsg | - |
| moveFollow | - |
| sendEngagementRequest | - |
| trembleEffect | - |
| sendEngagement | - |
| englishQuizMsg | - |
| openBeans | - |
| updateBeans | - |
| showBeans | - |
| showCharCash | - |
| spawnLove | - |
| removeLove | - |
| licenseRequest | - |
| licenseResult | - |
| showForcedEquip | - |
| removeTutorialStats | - |
| spawnTutorialSummon | - |
| requestBuddylistAdd | - |
| sendAutoHpPot | - |
| sendAutoMpPot | - |
| testPacket | - |
| updateAriantScore | - |
| updateAriantScore | - |
| modifyInventory | - |
| modifyInventory | - |
| petAutoHP | - |
| petAutoMP | - |
| catchMob | - |
| updateEquipSlot | - |
| PVPdamagePlayer | - |