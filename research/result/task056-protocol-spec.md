# CMS079 v5 完整协议规格 (Protocol Specification)

日期：2026-10-21 · 基于 Tasks 032-056 全部成果

总 opcode：207 s2c + 142 c2s = 349


## 客户端→服务器 (c2s / recvops)

| opcode | name | handler | fields (from server source) |
|---|---|---|---|

| 0x01 | LOGIN_PASSWORD | CharLoginHandler.login | login(str), pwd(str), gender(u8), username(str), server(u8), channel(u8) |
| 0x02 | SERVERLIST_REQUEST | CharLoginHandler.ServerListRequest | login(str), pwd(str), gender(u8), username(str), server(u8), channel(u8) |
| 0x03 | LICENSE_REQUEST | CharLoginHandler.ServerListRequest | login(str), pwd(str), gender(u8), username(str), server(u8), channel(u8) |
| 0x04 | SET_GENDER | CharLoginHandler.SetGenderRequest | login(str), pwd(str), gender(u8), username(str), server(u8), channel(u8) |
| 0x05 | SERVERSTATUS_REQUEST | CharLoginHandler.ServerStatusRequest | login(str), pwd(str), gender(u8), username(str), server(u8), channel(u8) |
| 0x09 | CHARLIST_REQUEST | CharLoginHandler.CharlistRequest | login(str), pwd(str), gender(u8), username(str), server(u8), channel(u8) |
| 0x0A | CHAR_SELECT | CharLoginHandler.Character_WithoutSecondPassword | login(str), pwd(str), gender(u8), username(str), server(u8), channel(u8) |
| 0x0B | PLAYER_LOGGEDIN |  | - |
| 0x0C | CHECK_CHAR_NAME | CharLoginHandler.CheckCharName | login(str), pwd(str), gender(u8), username(str), server(u8), channel(u8) |
| 0x11 | CREATE_CHAR | CharLoginHandler.CreateChar | login(str), pwd(str), gender(u8), username(str), server(u8), channel(u8) |
| 0x12 | DELETE_CHAR | CharLoginHandler.DeleteChar | login(str), pwd(str), gender(u8), username(str), server(u8), channel(u8) |
| 0x13 | PONG |  | - |
| 0x14 | ERROR_LOG |  | - |
| 0x15 | STRANGE_DATA |  | - |
| 0x19 | RELOG |  | - |
| 0x21 | CHANGE_MAP |  | - |
| 0x22 | CHANGE_CHANNEL | InterServerHandler.ChangeChannel | - |
| 0x23 | ENTER_CASH_SHOP | InterServerHandler.EnterCS | - |
| 0x24 | MOVE_PLAYER | PlayerHandler.MovePlayer | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x25 | CANCEL_CHAIR | PlayerHandler.CancelChair | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x26 | USE_CHAIR | PlayerHandler.UseChair | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x28 | CLOSE_RANGE_ATTACK | PlayerHandler.closeRangeAttack | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x29 | RANGED_ATTACK | PlayerHandler.rangedAttack | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x2A | MAGIC_ATTACK | PlayerHandler.MagicDamage | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x2B | PASSIVE_ENERGY | PlayerHandler.closeRangeAttack | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x2C | TAKE_DAMAGE | PlayerHandler.TakeDamage | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x2D | GENERAL_CHAT | ChatHandler.GeneralChat | type(u8), numRecipients(u8), chattext(str), messengerid(i32), input(str), targeted(str) |
| 0x2E | CLOSE_CHALKBOARD |  | - |
| 0x2F | FACE_EXPRESSION | PlayerHandler.ChangeEmotion | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x30 | USE_ITEMEFFECT | PlayerHandler.UseItemEffect | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x31 | WHEEL_OF_FORTUNE |  | - |
| 0x35 | MONSTER_BOOK_COVER | PlayerHandler.ChangeMonsterBookCover | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x36 | NPC_TALK | NPCHandler.NPCTalk | oid(i32), bmode(u8), itemId(i32), quantity(i16), itemId(i32), quantity(i16) |
| 0x38 | NPC_TALK_MORE | NPCHandler.NPCMoreTalk | oid(i32), bmode(u8), itemId(i32), quantity(i16), itemId(i32), quantity(i16) |
| 0x3A | NPC_SHOP | NPCHandler.NPCShop | oid(i32), bmode(u8), itemId(i32), quantity(i16), itemId(i32), quantity(i16) |
| 0x3B | STORAGE | NPCHandler.Storage | oid(i32), bmode(u8), itemId(i32), quantity(i16), itemId(i32), quantity(i16) |
| 0x3C | USE_HIRED_MERCHANT | HiredMerchantHandler.UseHiredMerchant | - |
| 0x3D | MERCH_ITEM_STORE | HiredMerchantHandler.MerchantItemStore | - |
| 0x3E | DUEY_ACTION | DueyHandler.DueyOperation | - |
| 0x42 | ITEM_SORT | InventoryHandler.ItemSort | item(i32), src(i16), dst(i16), quantity(i16), mode(u8), quest(i16) |
| 0x43 | ITEM_GATHER | InventoryHandler.ItemGather | item(i32), src(i16), dst(i16), quantity(i16), mode(u8), quest(i16) |
| 0x44 | ITEM_MOVE | InventoryHandler.ItemMove | item(i32), src(i16), dst(i16), quantity(i16), mode(u8), quest(i16) |
| 0x45 | USE_ITEM | InventoryHandler.UseItem | item(i32), src(i16), dst(i16), quantity(i16), mode(u8), quest(i16) |
| 0x46 | CANCEL_ITEM_EFFECT | PlayerHandler.CancelItemEffect | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x47 | USE_FISHING_ITEM |  | - |
| 0x48 | USE_SUMMON_BAG | InventoryHandler.UseSummonBag | item(i32), src(i16), dst(i16), quantity(i16), mode(u8), quest(i16) |
| 0x49 | PET_FOOD | PetHandler.PetFood | - |
| 0x4A | USE_MOUNT_FOOD | InventoryHandler.UseMountFood | item(i32), src(i16), dst(i16), quantity(i16), mode(u8), quest(i16) |
| 0x4B | SCRIPTED_ITEM |  | - |
| 0x4C | USE_CASH_ITEM | InventoryHandler.UseCashItem | item(i32), src(i16), dst(i16), quantity(i16), mode(u8), quest(i16) |
| 0x4E | USE_CATCH_ITEM | InventoryHandler.UseCatchItem | item(i32), src(i16), dst(i16), quantity(i16), mode(u8), quest(i16) |
| 0x4F | USE_SKILL_BOOK | InventoryHandler.UseSkillBook | item(i32), src(i16), dst(i16), quantity(i16), mode(u8), quest(i16) |
| 0x52 | USE_RETURN_SCROLL | InventoryHandler.UseReturnScroll | item(i32), src(i16), dst(i16), quantity(i16), mode(u8), quest(i16) |
| 0x53 | USE_UPGRADE_SCROLL | InventoryHandler.UseUpgradeScroll | item(i32), src(i16), dst(i16), quantity(i16), mode(u8), quest(i16) |
| 0x54 | DISTRIBUTE_AP | StatsHandling.DistributeAP | - |
| 0x55 | AUTO_ASSIGN_AP | StatsHandling.AutoAssignAP | - |
| 0x56 | HEAL_OVER_TIME | PlayerHandler.Heal | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x57 | DISTRIBUTE_SP | StatsHandling.DistributeSP | - |
| 0x58 | SPECIAL_MOVE | PlayerHandler.SpecialMove | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x59 | CANCEL_BUFF | PlayerHandler.CancelBuffHandler | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x5A | SKILL_EFFECT | PlayerHandler.SkillEffect | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x5B | MESO_DROP | PlayerHandler.DropMeso | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x5C | GIVE_FAME | PlayersHandler.GiveFame | type(u8), name(str), msg(str), fame(u8), num(u8), id(i32) |
| 0x5E | CHAR_INFO_REQUEST | PlayerHandler.CharInfoRequest | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x5F | SPAWN_PET | PetHandler.SpawnPet | - |
| 0x60 | CANCEL_DEBUFF |  | - |
| 0x61 | CHANGE_MAP_SPECIAL | PlayerHandler.ChangeMapSpecial | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x62 | USE_INNER_PORTAL | PlayerHandler.InnerPortal | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x63 | TROCK_ADD_MAP | PlayerHandler.TrockAddMap | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x68 | QUEST_ACTION | NPCHandler.QuestAction | oid(i32), bmode(u8), itemId(i32), quantity(i16), itemId(i32), quantity(i16) |
| 0x69 | EFFECT_ON_OFF |  | - |
| 0x6A | quest_KJ | InventoryHandler.QuestKJ | item(i32), src(i16), dst(i16), quantity(i16), mode(u8), quest(i16) |
| 0x6D | SKILL_MACRO | PlayerHandler.ChangeSkillMacro | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x70 | ITEM_BAOWU | InventoryHandler.UsePenguinBox | item(i32), src(i16), dst(i16), quantity(i16), mode(u8), quest(i16) |
| 0x71 | ITEM_MAKER | ItemMakerHandler.ItemMaker | - |
| 0x72 | ITEM_MZD |  | - |
| 0x74 | PARTYCHAT | ChatHandler.Others | type(u8), numRecipients(u8), chattext(str), messengerid(i32), input(str), targeted(str) |
| 0x75 | WHISPER | ChatHandler.Whisper_Find | type(u8), numRecipients(u8), chattext(str), messengerid(i32), input(str), targeted(str) |
| 0x76 | MESSENGER | ChatHandler.Messenger | type(u8), numRecipients(u8), chattext(str), messengerid(i32), input(str), targeted(str) |
| 0x77 | PLAYER_INTERACTION | PlayerInteractionHandler.PlayerInteraction | - |
| 0x78 | PARTY_OPERATION | PartyHandler.PartyOperatopn | - |
| 0x79 | DENY_PARTY_REQUEST | PartyHandler.DenyPartyRequest | - |
| 0x7A | GUILD_OPERATION | GuildHandler.Guild | - |
| 0x7B | DENY_GUILD_REQUEST | GuildHandler.DenyGuildRequest | - |
| 0x7E | BUDDYLIST_MODIFY | BuddyListHandler.BuddyOperation | - |
| 0x7F | NOTE_ACTION | PlayersHandler.Note | type(u8), name(str), msg(str), fame(u8), num(u8), id(i32) |
| 0x81 | USE_DOOR | PlayersHandler.UseDoor | type(u8), name(str), msg(str), fame(u8), num(u8), id(i32) |
| 0x83 | CHANGE_KEYMAP | PlayerHandler.ChangeKeymap | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0x84 | RPS_GAME | NPCHandler.RPSGame | oid(i32), bmode(u8), itemId(i32), quantity(i16), itemId(i32), quantity(i16) |
| 0x85 | RING_ACTION | PlayersHandler.RingAction | type(u8), name(str), msg(str), fame(u8), num(u8), id(i32) |
| 0x8A | ALLIANCE_OPERATION | AllianceHandler.HandleAlliance | - |
| 0x8B | DENY_ALLIANCE_REQUEST | AllianceHandler.HandleAlliance | - |
| 0x8C | BBS_OPERATION | BBSHandler.BBSOperatopn | - |
| 0x8D | ENTER_MTS | InterServerHandler.EnterMTS | - |
| 0x8E | ITEM_SUNZI | InventoryHandler.SunziBF | item(i32), src(i16), dst(i16), quantity(i16), mode(u8), quest(i16) |
| 0x95 | REQUEST_FAMILY | FamilyHandler.RequestFamily | - |
| 0x96 | OPEN_FAMILY | FamilyHandler.OpenFamily | - |
| 0x97 | FAMILY_OPERATION | FamilyHandler.FamilyOperation | - |
| 0x98 | DELETE_JUNIOR | FamilyHandler.DeleteJunior | - |
| 0x99 | DELETE_SENIOR | FamilyHandler.DeleteSenior | - |
| 0x9A | ACCEPT_FAMILY | FamilyHandler.AcceptFamily | - |
| 0x9B | USE_FAMILY | FamilyHandler.UseFamily | - |
| 0x9C | FAMILY_PRECEPT | FamilyHandler.FamilyPrecept | - |
| 0x9D | FAMILY_SUMMON | FamilyHandler.FamilySummon | - |
| 0x9E | CYGNUS_SUMMON | UserInterfaceHandler.CygnusSummon_NPCRequest | - |
| 0x9F | ARAN_COMBO | PlayerHandler.AranCombo | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0xA5 | MOVE_PET | PetHandler.MovePet | - |
| 0xA6 | PET_CHAT | PetHandler.PetChat | - |
| 0xA7 | PET_COMMAND | PetHandler.PetCommand | - |
| 0xA8 | PET_LOOT | InventoryHandler.Pickup_Pet | item(i32), src(i16), dst(i16), quantity(i16), mode(u8), quest(i16) |
| 0xA9 | PET_AUTO_POT | PetHandler.Pet_AutoPotion | - |
| 0xAA | PET_EXCEPTIONLIST | PetHandler.PickExceptionList | - |
| 0xAD | MOVE_SUMMON | SummonHandler.MoveSummon | - |
| 0xAE | SUMMON_ATTACK | SummonHandler.SummonAttack | - |
| 0xB0 | DAMAGE_SUMMON | SummonHandler.DamageSummon | - |
| 0xB7 | MOVE_LIFE | MobHandler.MoveMonster | - |
| 0xB8 | AUTO_AGGRO | MobHandler.AutoAggro | - |
| 0xBB | MOONRABBIT_HP | PlayerHandler.Rabbit | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0xBC | MONSTER_BOMB | MobHandler.MonsterBomb | - |
| 0xBD | FRIENDLY_DAMAGE | MobHandler.FriendlyDamage | - |
| 0xC0 | NPC_ACTION | NPCHandler.NPCAnimation | oid(i32), bmode(u8), itemId(i32), quantity(i16), itemId(i32), quantity(i16) |
| 0xC6 | ITEM_PICKUP | InventoryHandler.Pickup_Player | item(i32), src(i16), dst(i16), quantity(i16), mode(u8), quest(i16) |
| 0xC9 | DAMAGE_REACTOR | PlayersHandler.HitReactor | type(u8), name(str), msg(str), fame(u8), num(u8), id(i32) |
| 0xCA | TOUCH_REACTOR | PlayersHandler.TouchReactor | type(u8), name(str), msg(str), fame(u8), num(u8), id(i32) |
| 0xCB | NEW_SX |  | - |
| 0xCF | SNOWBALL | PlayerHandler.snowBall | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0xD0 | LEFT_KNOCK_BACK | PlayerHandler.leftKnockBack | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0xD1 | COCONUT | PlayersHandler.hitCoconut | type(u8), name(str), msg(str), fame(u8), num(u8), id(i32) |
| 0xD7 | MONSTER_CARNIVAL | MonsterCarnivalHandler.MonsterCarnival | - |
| 0xD9 | SHIP_OBJECT | UserInterfaceHandler.ShipObjectRequest | - |
| 0xDF | PARTY_SS |  | - |
| 0xE0 | PLAYER_UPDATE | PlayerHandler.UpdateHandler | oid(i32), attacker(i32), num(u8), name(str), shout(u8), skill1(i32) |
| 0xE2 | BEANS_GAME1 | BeanGame.BeanGame1 | - |
| 0xE3 | BEANS_GAME2 | BeanGame.BeanGame2 | - |
| 0xE8 | TOUCHING_CS |  | - |
| 0xE9 | BUY_CS_ITEM | CashShopOperation.BuyCashItem | - |
| 0xEA | COUPON_CODE | out.println | - |
| 0xF6 | MAPLETV |  | - |
| 0xFB | MTS_OP |  | - |
| 0xFF | PICK_ALL_CHAR |  | - |
| 0x104 | ChatRoom_SYSTEM | PlayersHandler.ChatRoomHandler | type(u8), name(str), msg(str), fame(u8), num(u8), id(i32) |
| 0x7FFE | SPOUSE_CHAT |  | - |

## 服务器→客户端 (s2c / sendops)

| opcode | name | client handler | reads (from client analysis) |
|---|---|---|---|

| 0x00 | LOGIN_STATUS |  | - |
| 0x02 | LICENSE_RESULT |  | - |
| 0x04 | CHOOSE_GENDER |  | - |
| 0x05 | GENDER_SET |  | - |
| 0x06 | SERVERSTATUS |  | - |
| 0x09 | SERVERLIST |  | - |
| 0x0A | CHARLIST |  | - |
| 0x0B | SERVER_IP |  | - |
| 0x0C | CHAR_NAME_RESPONSE |  | - |
| 0x11 | ADD_NEW_CHAR_ENTRY |  | - |
| 0x13 | CHANGE_CHANNEL |  | - |
| 0x14 | PING |  | - |
| 0x18 | CHANNEL_SELECTED |  | - |
| 0x20 | MODIFY_INVENTORY_ITEM | 0x6286ec | Byte>Byte>Byte>Byte>Int16>Int32>Int16 |
| 0x21 | UPDATE_INVENTORY_SLOT | 0x629024 | Byte>Byte>Byte |
| 0x22 | UPDATE_STATS | 0x6292f5 | Byte>Byte |
| 0x23 | GIVE_BUFF | 0x6299ff | Int16>Byte |
| 0x24 | CANCEL_BUFF | 0x629e60 | Byte>Byte>Byte |
| 0x25 | TEMP_STATS | 0x62a040 | Byte>Byte>Byte>Byte>Int32>Int16 |
| 0x26 | TEMP_STATS_RESET | 0x62a05d | Byte>Byte>Byte>Byte>Int32>Int16 |
| 0x27 | UPDATE_SKILLS | 0x6280d7 | Byte>Int16>Int32>Int32>Int32>Byte>Int32>Byte>Int32 |
| 0x28 | SKILL_USE_RESULT | 0x62a0f3 | Byte>Byte>Byte>Byte>Int32>Int16>Int32>Int32 |
| 0x29 | FAME_RESPONSE | 0x62bb3c | Byte>Byte>Byte>Int32>Int32>Int32>Int16>Int16 |
| 0x2A | SHOW_STATUS_INFO | 0x62a115 | Byte>Byte>Byte>Int32>Int16>Int32>Int32 |
| 0x2B | SHOW_NOTES | 0x62e85f | Byte>Byte>Byte>Byte>Byte>Int32 |
| 0x2C | TROCK_LOCATIONS | 0x62ea39 | Byte>Byte>Int32 |
| 0x2D | ANTI_MACRO_RESULT | 0x62ff74 | Byte>Byte>Byte |
| 0x2F | CLAIM_RESULT | 0x631374 | Byte>Byte>Int32>Byte>Byte>Byte |
| 0x30 | CLAIM_STATUS_CHANGED | 0x63161a | Byte>Byte>Byte>Byte>Int32>Byte |
| 0x31 | SET_TAMING_MOB_INFO | 0x631643 | Byte>Byte>Int32>Byte |
| 0x32 | UPDATE_MOUNT | 0x632d3b | Int32>Int32>Int32>Int32>Byte |
| 0x33 | SHOW_QUEST_COMPLETION | 0x630827 | Int16 |
| 0x34 | SEND_TITLE_BOX | 0x631881 | Byte>Int32>Byte>Int32>Byte>Int32>Int16 |
| 0x35 | USE_SKILL_BOOK | 0x6281eb | Int32>Byte>Int32>Int32>Byte>Byte |
| 0x36 | FINISH_SORT | 0x62857f | Byte>Byte>Byte>Byte>Byte>Byte>Byte>Byte>Byte>Byte> |
| 0x37 | FINISH_GATHER | 0x6285a9 | Byte>Byte>Byte>Byte>Byte>Byte>Byte>Byte>Int16>Int3 |
| 0x3A | CHAR_INFO | 0x62cde5 | Int32>Byte>Int16>Int16>Byte>Byte>Byte>Int32>Int32> |
| 0x3B | PARTY_OPERATION | 0x648120 | Byte>Int32>Byte |
| 0x3C | BUDDYLIST | 0x64915c | Byte>Int32>Byte>Int32>Int32>Byte |
| 0x3E | GUILD_OPERATION | 0x641174 | Byte>Byte>Int32 |
| 0x3F | ALLIANCE_OPERATION | 0x643bba | Byte>Int32>Int32>Byte |
| 0x40 | SPAWN_PORTAL | 0x62be06 | Int32>Int32>Int16>Int16>Byte>Byte>Byte>Byte>Byte>B |
| 0x41 | SERVERMESSAGE | 0x62bede | Byte>Byte>Byte>Byte>Byte>Byte>Byte>Byte>Byte>Int32 |
| 0x45 | ENGAGE_REQUEST | 0x632c6f | Byte>Byte>Int32>Int32>Int32>Int32>Byte |
| 0x46 | SHOW_PREDICT_CARD | 0x611325 | Int32>Int32>Int32>Byte>Int32>Int32 |
| 0x4E | YELLOW_CHAT | 0x628654 | Byte>Byte>Byte>Byte>Byte>Byte>Int16>Int32>Int16 |
| 0x56 | AVATAR_MEGA | 0x63345c | Int32>Int32>Byte |
| 0x5A | PLAYER_NPC | 0x611948 | - |
| 0x5B | MONSTERBOOK_ADD | 0x61179e | Byte>Int32>Int32>Int32>Int16>Int16>Int32>Int32>Byt |
| 0x5C | MONSTERBOOK_CHANGE_COVER | 0x6118bb | Int32>Int16>Int16>Int32>Int32>Byte |
| 0x60 | FAIRY_PEND_MSG | 0x61b999 | Byte |
| 0x64 | SEND_PEDIGREE | 0x63dff2 | Int32>Int32>Int32>Int16>Int16>Int16>Int32>Int32>In |
| 0x65 | OPEN_FAMILY | 0x63e008 | Int32>Int32>Int32>Int16>Int16>Int16>Int32>Int32>In |
| 0x66 | FAMILY_MESSAGE | 0x63e164 | Int32>Int32 |
| 0x67 | FAMILY_INVITE | 0x63e4b3 | Int32>Byte>Int32>Byte>Int32>Int32 |
| 0x68 | FAMILY_JUNIOR | 0x63e59f | Byte>Int32>Byte>Int32>Int32 |
| 0x69 | SENIOR_MESSAGE | 0x63e695 | Int32>Byte>Int32>Int32>Int32 |
| 0x6A | FAMILY | 0x63e723 | Int32>Byte>Int32>Int32>Int32>Byte |
| 0x6B | REP_INCREASE | 0x63e8df | Int32>Byte>Byte>Int32>Int32>Int32 |
| 0x6C | FAMILY_LOGGEDIN | 0x63e9e3 | Byte>Byte>Int32>Int32>Int32 |
| 0x6D | FAMILY_BUFF | 0x63eaac | Byte>Int32>Int32>Int32 |
| 0x6E | FAMILY_USE_REQUEST | 0x63ebd0 | - |
| 0x6F | LEVEL_UPDATE | 0x61c3f7 | Byte>Int32>Byte>Byte>Int32 |
| 0x70 | MARRIAGE_UPDATE | 0x61c584 | Byte>Byte>Int32>Byte |
| 0x71 | JOB_UPDATE | 0x61c6af | Byte>Int32>Byte |
| 0x72 | DATA_CRC_CHECK_FAILED | 0x61c7fb | Byte |
| 0x73 | TOP_MSG | 0x61ca98 | - |
| 0x74 | BBS_OPERATION | 0x61cb05 | - |
| 0x75 | FISHING_BOARD_UPDATE |  | - |
| 0x7D | CHAR_CASH | 0x634844 | Int32>Int32 |
| 0x80 | SKILL_MACRO | 0x632d1e | Int32>Int32>Int32>Int32>Byte |
| 0x81 | WARP_TO_MAP | 0x37e72f | Int32>Byte>Byte>Byte>Int16>Int32>Int32>Int32>Int32 |
| 0x82 | MTS_OPEN | 0x37fc9e | - |
| 0x83 | CS_OPEN | 0x37f209 | - |
| 0x87 | BLOCK_MSG |  | - |
| 0x8A | MULTICHAT |  | - |
| 0x8B | WHISPER |  | - |
| 0x8C | SPOUSE_CHAT |  | - |
| 0x8D | BOSS_ENV |  | - |
| 0x8F | FORCED_MAP_EQUIP |  | - |
| 0x91 | MAP_EFFECT |  | - |
| 0x92 | CASH_SONG |  | - |
| 0x93 | GM_EFFECT |  | - |
| 0x94 | OX_QUIZ |  | - |
| 0x95 | GMEVENT_INSTRUCTIONS |  | - |
| 0x96 | CLOCK |  | - |
| 0x98 | BOAT_EFFECT |  | - |
| 0x99 | BOAT_HIDE |  | - |
| 0x9A | ARIANT_SCOREBOARD |  | - |
| 0x9C | STOP_CLOCK |  | - |
| 0x9F | MOVE_PLATFORM |  | - |
| 0xA2 | SPAWN_PLAYER | 0x57f6c0 | Int32>Int32>Int32 |
| 0xA3 | REMOVE_PLAYER_FROM_MAP | 0x57f64c | Int32>Int32 |
| 0xA4 | CHATTEXT | 0x57f64c | Int32>Int32 |
| 0xA6 | CHALKBOARD | 0x57f64c | Int32>Int32 |
| 0xA7 | UPDATE_CHAR_BOX | 0x57f64c | Int32>Int32 |
| 0xA9 | SHOW_SCROLL_EFFECT | 0x57f64c | Int32>Int32 |
| 0xAB | FISHING_CAUGHT | 0x57f64c | Int32>Int32 |
| 0xAD | SPAWN_PET | 0x57f64c | Int32>Int32 |
| 0xAF | MOVE_PET | 0x57f64c | Int32>Int32 |
| 0xB0 | PET_CHAT | 0x57f64c | Int32>Int32 |
| 0xB1 | PET_NAMECHANGE | 0x57f64c | Int32>Int32 |
| 0xB3 | PET_COMMAND | 0x57f64c | Int32>Int32 |
| 0xB4 | SPAWN_SUMMON | 0x57f64c | Int32>Int32 |
| 0xB5 | REMOVE_SUMMON | 0x57f64c | Int32>Int32 |
| 0xB6 | MOVE_SUMMON | 0x57f64c | Int32>Int32 |
| 0xB7 | SUMMON_ATTACK | 0x57f64c | Int32>Int32 |
| 0xB9 | DAMAGE_SUMMON | 0x57f64c | Int32>Int32 |
| 0xBA | SUMMON_SKILL | 0x57f64c | Int32>Int32 |
| 0xBB | MOVE_PLAYER | 0x57f64c | Int32>Int32 |
| 0xBC | CLOSE_RANGE_ATTACK | 0x57f64c | Int32>Int32 |
| 0xBD | RANGED_ATTACK | 0x57f64c | Int32>Int32 |
| 0xBE | MAGIC_ATTACK | 0x57f64c | Int32>Int32 |
| 0xC0 | SKILL_EFFECT | 0x57f64c | Int32>Int32 |
| 0xC1 | CANCEL_SKILL_EFFECT | 0x57f64c | Int32>Int32 |
| 0xC2 | DAMAGE_PLAYER | 0x57f64c | Int32>Int32 |
| 0xC3 | FACIAL_EXPRESSION | 0x57f64c | Int32>Int32 |
| 0xC5 | SHOW_ITEM_EFFECT | 0x57f64c | Int32>Int32 |
| 0xC6 | SHOW_CHAIR | 0x57f64c | Int32>Int32 |
| 0xC7 | UPDATE_CHAR_LOOK | 0x57f64c | Int32>Int32 |
| 0xC8 | SHOW_FOREIGN_EFFECT | 0x57f64c | Int32>Int32 |
| 0xC9 | GIVE_FOREIGN_BUFF | 0x57f64c | Int32>Int32 |
| 0xCA | CANCEL_FOREIGN_BUFF | 0x57f64c | Int32>Int32 |
| 0xCB | UPDATE_PARTYMEMBER_HP | 0x57f64c | Int32>Int32 |
| 0xCE | Animation_EFFECT | 0x57f64c | Int32>Int32 |
| 0xCF | CANCEL_CHAIR | 0x57f64c | Int32>Int32 |
| 0xD0 | SHOW_ITEM_GAIN_INCHAT | 0x57f64c | Int32>Int32 |
| 0xD6 | UPDATE_QUEST_INFO | 0x57f64c | Int32>Int32 |
| 0xD8 | PET_FLAG_CHANGE | 0x57f64c | Int32>Int32 |
| 0xD9 | PLAYER_HINT | 0x57f64c | Int32>Int32 |
| 0xE3 | CYGNUS_INTRO_DISABLE_UI | 0x57f64c | Int32>Int32 |
| 0xE4 | CYGNUS_INTRO_LOCK | 0x57f64c | Int32>Int32 |
| 0xE5 | SUMMON_HINT | 0x57f64c | Int32>Int32 |
| 0xE6 | TUTORIAL_GUIDE | 0x57f64c | Int32>Int32 |
| 0xE7 | ARAN_COMBO | 0x57f64c | Int32>Int32 |
| 0xEC | COOLDOWN | 0x57f64c | Int32>Int32 |
| 0xEE | SPAWN_MONSTER | 0x2a6ab0 | Int32>Int32>Byte>Int32 |
| 0xEF | KILL_MONSTER | 0x2a6ab0 | Int32>Int32>Byte>Int32 |
| 0xF0 | SPAWN_MONSTER_CONTROL | 0x2a6ab0 | Int32>Int32>Byte>Int32 |
| 0xF1 | MOVE_MONSTER | 0x2a6ab0 | Int32>Int32>Byte>Int32 |
| 0xF2 | MOVE_MONSTER_RESPONSE | 0x2a6ab0 | Int32>Int32>Byte>Int32 |
| 0xF4 | APPLY_MONSTER_STATUS | 0x2a6ab0 | Int32>Int32>Byte>Int32 |
| 0xF5 | CANCEL_MONSTER_STATUS | 0x2a6ab0 | Int32>Int32>Byte>Int32 |
| 0xF7 | MOB_TO_MOB_DAMAGE | 0x2a6ab0 | Int32>Int32>Byte>Int32 |
| 0xF8 | DAMAGE_MONSTER | 0x2a6ab0 | Int32>Int32>Byte>Int32 |
| 0xFB | ARIANT_THING | 0x2a6ab0 | Int32>Int32>Byte>Int32 |
| 0xFC | SHOW_MONSTER_HP | 0x2a6ab0 | Int32>Int32>Byte>Int32 |
| 0xFD | SHOW_MAGNET | 0x2a6ab0 | Int32>Int32>Byte>Int32 |
| 0xFF | CYGNUS_CHAR_CREATED | 0x2a6ab0 | Int32>Int32>Byte>Int32 |
| 0x100 | CATCH_ARIANT | 0x2a6ab0 | Int32>Int32>Byte>Int32 |
| 0x103 | CATCH_MONSTER | 0x2a6ab0 | Int32>Int32>Byte>Int32 |
| 0x104 | SPAWN_NPC | 0x2cb061 | Byte>Int32>Byte>Int32>Int32>Int32>Int32>Int32 |
| 0x105 | REMOVE_NPC | 0x2cb061 | Byte>Int32>Byte>Int32>Int32>Int32>Int32>Int32 |
| 0x106 | SPAWN_NPC_REQUEST_CONTROLLER | 0x2cb061 | Byte>Int32>Byte>Int32>Int32>Int32>Int32>Int32 |
| 0x107 | NPC_ACTION | 0x2cb061 | Byte>Int32>Byte>Int32>Int32>Int32>Int32>Int32 |
| 0x10D | SPAWN_HIRED_MERCHANT | 0x11b3a3 | Int32>Int32>Int32>Int32 |
| 0x10E | DESTROY_HIRED_MERCHANT | 0x11b3a3 | Int32>Int32>Int32>Int32 |
| 0x10F | UPDATE_HIRED_MERCHANT | 0x11b3a3 | Int32>Int32>Int32>Int32 |
| 0x110 | DROP_ITEM_FROM_MAPOBJECT | 0x10e6cf | Byte>Int32>Byte>Int32>Int32>Byte>Int16>Int16>Int32 |
| 0x111 | REMOVE_ITEM_FROM_MAP | 0x10e6cf | Byte>Int32>Byte>Int32>Int32>Byte>Int16>Int16>Int32 |
| 0x113 | SPAWN_LOVE | 0x288cba | Int32>Int32>Int16>Int16 |
| 0x114 | REMOVE_LOVE | 0x288cba | Int32>Int32>Int16>Int16 |
| 0x115 | SPAWN_MIST | 0x31648 | Int32>Int32>Int32>Int32>Byte>Int16>Int32 |
| 0x116 | REMOVE_MIST | 0x31648 | Int32>Int32>Int32>Int32>Byte>Int16>Int32 |
| 0x117 | SPAWN_DOOR |  | - |
| 0x118 | REMOVE_DOOR |  | - |
| 0x11C | REACTOR_HIT | 0x341c0b | Int32>Byte>Int16>Int16>Int16>Byte>Byte>Int32>Int32 |
| 0x11E | REACTOR_SPAWN | 0x341c0b | Int32>Byte>Int16>Int16>Int16>Byte>Byte>Int32>Int32 |
| 0x11F | REACTOR_DESTROY | 0x341c0b | Int32>Byte>Int16>Int16>Int16>Byte>Byte>Int32>Int32 |
| 0x120 | ROLL_SNOWBALL |  | - |
| 0x121 | HIT_SNOWBALL |  | - |
| 0x122 | SNOWBALL_MESSAGE |  | - |
| 0x123 | LEFT_KNOCK_BACK |  | - |
| 0x124 | HIT_COCONUT |  | - |
| 0x125 | COCONUT_SCORE |  | - |
| 0x129 | MONSTER_CARNIVAL_START |  | - |
| 0x12A | MONSTER_CARNIVAL_OBTAINED_CP |  | - |
| 0x12B | MONSTER_CARNIVAL_PARTY_CP |  | - |
| 0x12C | MONSTER_CARNIVAL_SUMMON |  | - |
| 0x12E | MONSTER_CARNIVAL_DIED |  | - |
| 0x130 | ENGLISH_QUIZ |  | - |
| 0x132 | ARIANT_SCORE_UPDATE |  | - |
| 0x144 | ZAKUM_SHRINE |  | - |
| 0x145 | NPC_TALK | 0x353092 | Byte>Int32>Byte>Byte |
| 0x146 | OPEN_NPC_SHOP | 0x36400c | Byte |
| 0x147 | CONFIRM_SHOP_TRANSACTION | 0x36400c | Byte |
| 0x14A | OPEN_STORAGE |  | - |
| 0x14B | MERCH_ITEM_MSG | 0x3a1424 | Byte>Int32>Int32>Byte>Int32>Int32 |
| 0x14C | MERCH_ITEM_STORE | 0x3a1424 | Byte>Int32>Int32>Byte>Int32>Int32 |
| 0x14E | MESSENGER |  | - |
| 0x14F | PLAYER_INTERACTION |  | - |
| 0x15C | BEANS_GAME1 |  | - |
| 0x15D | BEANS_GAME2 |  | - |
| 0x15E | UPDATE_BEANS |  | - |
| 0x15F | DUEY |  | - |
| 0x161 | CS_UPDATE |  | - |
| 0x162 | CS_OPERATION |  | - |
| 0x16F | KEYMAP | 0x1b9e4f | Byte>Int32>Int32 |
| 0x170 | AUTO_HP_POT | 0x1b9f14 | - |
| 0x171 | AUTO_MP_POT | 0x1b9f14 | - |
| 0x175 | SEND_TV |  | - |
| 0x176 | REMOVE_TV |  | - |
| 0x177 | ENABLE_TV |  | - |
| 0x17B | MTS_OPERATION2 |  | - |
| 0x17C | MTS_OPERATION |  | - |
| 0x182 | VICIOUS_HAMMER | 0x148034 | - |
| 0x7FFE | DELETE_CHAR_RESPONSE |  | - |

## 核心 Handler 逻辑（反编译源码摘要）


已提取 18 个核心 handler 方法


### CharLoginHandler.login()

```java
public static final void login(SeekableLittleEndianAccessor slea, MapleClient c) {
        String login = slea.readMapleAsciiString();
        String pwd = slea.readMapleAsciiString();
        c.setAccountName(login);
        int[] bytes = new int[6];
        for (int i = 0; i < bytes.length; ++i) {
            bytes[i] = slea.readByteAsInt();
        }
        StringBuilder sps = new StringBuilder();
        for (int i = 0; i < bytes.length; ++i) {
            sps.append(StringUtil.getLeftPaddedStr(Integer.toHexString(bytes[i]).toUpperCase(), '0', 2));
            sps.append("-");
        }
        String macData = sps.toString();
        macData = macData.substring(0, macData.length() - 1);
        c.setMac(macData);
        boolean ipBan = c.hasBannedIP();
        boolean macBan = c.isBannedMac(macData);
        boolean banned = ipBan || macBan;
        int loginok = 0;
        if (Boolean.parseBoolean(ServerProperties.getProperty("\u6c5f\u6d69.AutoRegister")) && AutoRegister.autoRe
```


### CharLoginHandler.Character_WithoutSecondPassword()

```java
public static void Character_WithoutSecondPassword(SeekableLittleEndianAccessor slea, MapleClient c) {
        int charId = slea.readInt();
        if (!c.isLoggedIn() || CharLoginHandler.loginFailCount(c) || !c.login_Auth(charId)) {
            c.getSession().write(MaplePacketCreator.enableActions());
            return;
        }
        if (ChannelServer.getInstance(c.getChannel()) == null || c.getWorld() != 0) {
            c.getSession().close();
            return;
        }
        if (c.getIdleTask() != null) {
            c.getIdleTask().cancel(true);
        }
        String ip = c.getSessionIPAddress();
        LoginServer.putLoginAuth(charId, ip.substring(ip.indexOf(47) + 1, ip.length()), c.getTempIP(), c.getChannel());
        c.getSession().write(MaplePacketCreator.getServerIP(Integer.parseInt(ChannelServer.getInstance(c.getChannel()).getIP().split(":")[1]), charId));
    }
```


### PlayerHandler.MovePlayer()

```java
public static final void MovePlayer(SeekableLittleEndianAccessor slea, MapleClient c, MapleCharacter chr) {
        List<LifeMovementFragment> res;
        if (chr == null) {
            return;
        }
        final Point Original_Pos = chr.getPosition();
        slea.skip(33);
        try {
            res = MovementParse.parseMovement(slea, 1);
        }
        catch (ArrayIndexOutOfBoundsException e) {
            System.out.println("AIOBE Type1:\n" + slea.toString(true));
            return;
        }
        if (res != null && c.getPlayer().getMap() != null) {
            if (slea.available() < 13L || slea.available() > 26L) {
                System.out.println("slea.available != 13-26 (movement parsing error)\n" + slea.toString(true));
                return;
            }
            ArrayList<LifeMovementFragment> res2 = new ArrayList<LifeMovementFragment>(res);
            final MapleMap map = c.getPlayer().getMap();
            if (chr.isHidden()) {
                chr.se
```


### PlayerHandler.ChangeMap()

```java
public static final void ChangeMap(SeekableLittleEndianAccessor slea, MapleClient c, MapleCharacter chr) {
        long startTime = System.currentTimeMillis();
        if (chr == null || chr.getMap() == null) {
            return;
        }
        if (slea.available() == 0L) {
            String[] socket = c.getChannelServer().getIP().split(":");
            chr.saveToDB(false, false);
            c.getChannelServer().removePlayer(c.getPlayer());
            c.updateLoginState(1);
            try {
                c.getSession().write(MaplePacketCreator.getChannelChange(c, Integer.parseInt(socket[1])));
            }
            catch (Exception e) {
                throw new RuntimeException(e);
            }
            return;
        }
        if (slea.available() != 0L) {
            boolean wheel;
            slea.readByte();
            int targetid = slea.readInt();
            if (targetid == 0) {
                targetid = 1000000;
            }
            MaplePortal porta
```


### PlayerHandler.TakeDamage()

```java
public static final void TakeDamage(SeekableLittleEndianAccessor slea, MapleClient c, MapleCharacter chr) {
        MobSkill skill;
        chr.updateTick(slea.readInt());
        byte type = slea.readByte();
        slea.skip(1);
        int damage = slea.readInt();
        int oid = 0;
        int monsteridfrom = 0;
        int reflect = 0;
        byte direction = 0;
        int pos_x = 0;
        int pos_y = 0;
        int fake = 0;
        int mpattack = 0;
        boolean is_pg = false;
        boolean isDeadlyAttack = false;
        MapleMonster attacker = null;
        if (chr == null || chr.isHidden() || chr.getMap() == null) {
            return;
        }
        if (chr.isGM() && chr.isInvincible()) {
            return;
        }
        PlayerStats stats = chr.getStat();
        if (type != -2 && type != -3 && type != -4) {
            MobAttackInfo attackInfo;
            monsteridfrom = slea.readInt();
            oid = slea.readInt();
            attacker = chr.getMap(
```


### PlayerHandler.Heal()

```java
public static final void Heal(SeekableLittleEndianAccessor slea, MapleCharacter chr) {
        if (chr == null) {
            return;
        }
        chr.updateTick(slea.readInt());
        short healHP = slea.readShort();
        short healMP = slea.readShort();
        PlayerStats stats = chr.getStat();
        int check_hp = (int)stats.getHealHP();
        int check_mp = (int)stats.getHealMP();
        if (stats.getHp() <= 0) {
            return;
        }
        if (chr.canHP() && healHP != 0) {
            if (chr.getChair() != 0) {
                check_hp += 150;
            }
            if (healHP > check_hp * 2 && healHP > 20) {
                chr.getCheatTracker().registerOffense(CheatingOffense.\u56de\u590d\u8fc7\u591aHP, String.valueOf(healHP) + " \u670d\u52a1\u5668:" + check_hp);
            }
            chr.addHP(healHP);
        }
        if (chr.canMP() && healMP != 0) {
            if (healMP > check_mp * 2 && healMP > 20) {
                chr.getCheatTracker()
```


### PlayerHandler.ChangeEmotion()

```java
public static final void ChangeEmotion(final int emote, MapleCharacter chr) {
        int emoteid;
        MapleInventoryType type;
        if (emote > 7 && chr.getInventory(type = GameConstants.getInventoryType(emoteid = 5159992 + emote)).findById(emoteid) == null) {
            chr.getCheatTracker().registerOffense(CheatingOffense.\u4f7f\u7528\u4e0d\u5b58\u5728\u9053\u5177, Integer.toString(emoteid));
            return;
        }
        if (emote > 0 && chr != null && chr.getMap() != null) {
            chr.getMap().broadcastMessage(chr, MaplePacketCreator.facialExpression(chr, emote), false);
            WeakReference<MapleCharacter>[] clones = chr.getClones();
            for (int i = 0; i < clones.length; ++i) {
                if (clones[i].get() == null) continue;
                final MapleCharacter clone = (MapleCharacter)clones[i].get();
                Timer.CloneTimer.getInstance().schedule(new Runnable(){

                    @Override
                    public void run
```


### ChatHandler.GeneralChat()

```java
public static final void GeneralChat(String text, byte unk, MapleClient c, MapleCharacter chr) {
        if (chr != null) {
            try {
                boolean condition = CommandProcessor.processCommand(c, text, ServerConstants.CommandType.NORMAL);
                if (condition) {
                    return;
                }
            }
            catch (Throwable e) {
                System.err.println(e);
            }
            if (!chr.isGM() && text.length() >= 80) {
                return;
            }
            if (chr.isHidden()) {
                chr.getMap().broadcastGMMessage(chr, MaplePacketCreator.getChatText(chr.getId(), text, c.getPlayer().isGM(), unk), true);
            } else {
                chr.getCheatTracker().checkMsg();
                chr.getMap().broadcastMessage(MaplePacketCreator.getChatText(chr.getId(), text, c.getPlayer().isGM(), unk), c.getPlayer().getPosition());
            }
        }
    }
```


### ChatHandler.Others()

```java
public static final void Others(SeekableLittleEndianAccessor slea, MapleClient c, MapleCharacter chr) {
        byte type = slea.readByte();
        byte numRecipients = slea.readByte();
        int[] recipients = new int[numRecipients];
        for (byte i = 0; i < numRecipients; i = (byte)(i + 1)) {
            recipients[i] = slea.readInt();
        }
        String chattext = slea.readMapleAsciiString();
        if (chr == null || !chr.getCanTalk()) {
            c.getSession().write(MaplePacketCreator.serverNotice(6, "\u4f60\u5df2\u7ecf\u88ab\u7981\u8a00\uff0c\u56e0\u6b64\u65e0\u6cd5\u8bf4\u8bdd."));
            return;
        }
        if (CommandProcessor.processCommand(c, chattext, ServerConstants.CommandType.NORMAL)) {
            return;
        }
        chr.getCheatTracker().checkMsg();
        switch (type) {
            case 0: {
                World.Buddy.buddyChat(recipients, chr.getId(), chr.getName(), chattext);
                break;
            }
            case 
```


### InventoryHandler.ItemSort()

```java
public static final void ItemSort(SeekableLittleEndianAccessor slea, MapleClient c) {
        c.getPlayer().updateTick(slea.readInt());
        MapleInventoryType pInvType = MapleInventoryType.getByType(slea.readByte());
        if (pInvType == MapleInventoryType.UNDEFINED) {
            c.getSession().write(MaplePacketCreator.enableActions());
            return;
        }
        MapleInventory pInv = c.getPlayer().getInventory(pInvType);
        boolean sorted = false;
        while (!sorted) {
            byte freeSlot = (byte)pInv.getNextFreeSlot();
            if (freeSlot != -1) {
                int itemSlot = -1;
                for (byte i = (byte)(freeSlot + 1); i <= pInv.getSlotLimit(); i = (byte)(i + 1)) {
                    if (pInv.getItem(i) == null) continue;
                    itemSlot = i;
                    break;
                }
                if (itemSlot > 0) {
                    MapleInventoryManipulator.move(c, pInvType, (short)itemSlot, freeSlot);
     
```


### InventoryHandler.ItemMove()

```java
public static final void ItemMove(SeekableLittleEndianAccessor slea, MapleClient c) {
        if (c.getPlayer().getPlayerShop() != null || c.getPlayer().getConversation() > 0 || c.getPlayer().getTrade() != null) {
            return;
        }
        MapleCharacter player = c.getPlayer();
        player.setCurrenttime(System.currentTimeMillis());
        if (player.getCurrenttime() - player.getLasttime() < player.get\u9632\u6b62\u590d\u5236\u65f6\u95f4()) {
            c.getPlayer().dropMessage(5, "\u8bf7\u6162\u70b9\u4f7f\u7528.\u4e0d\u7136\u4f1a\u6389\u7ebf\u54df\uff01");
            c.getSession().write(MaplePacketCreator.enableActions());
            return;
        }
        player.setLasttime(System.currentTimeMillis());
        c.getPlayer().updateTick(slea.readInt());
        MapleInventoryType type = MapleInventoryType.getByType(slea.readByte());
        short src = slea.readShort();
        short dst = slea.readShort();
        short quantity = slea.readShort();
        if (
```


### InventoryHandler.UseItem()

```java
public static final void UseItem(SeekableLittleEndianAccessor slea, MapleClient c, MapleCharacter chr) {
        if (chr == null || !chr.isAlive() || chr.getMapId() == 749040100 || chr.getMap() == null) {
            c.getSession().write(MaplePacketCreator.enableActions());
            return;
        }
        long time = System.currentTimeMillis();
        if (chr.getNextConsume() > time) {
            chr.dropMessage(5, "You may not use this item yet.");
            c.getSession().write(MaplePacketCreator.enableActions());
            return;
        }
        c.getPlayer().updateTick(slea.readInt());
        byte slot = (byte)slea.readShort();
        int itemId = slea.readInt();
        IItem toUse = chr.getInventory(MapleInventoryType.USE).getItem(slot);
        if (toUse == null || toUse.getQuantity() < 1 || toUse.getItemId() != itemId) {
            c.getSession().write(MaplePacketCreator.enableActions());
            return;
        }
        if (!FieldLimitType.PotionUse.chec
```


### NPCHandler.NPCShop()

```java
public static void NPCShop(SeekableLittleEndianAccessor slea, MapleClient c, MapleCharacter chr) {
        byte bmode = slea.readByte();
        if (chr == null) {
            return;
        }
        switch (bmode) {
            case 0: {
                MapleShop shop = chr.getShop();
                if (shop == null) {
                    return;
                }
                slea.skip(2);
                int itemId = slea.readInt();
                short quantity = slea.readShort();
                shop.buy(c, itemId, quantity);
                break;
            }
            case 1: {
                MapleShop shop = chr.getShop();
                if (shop == null) {
                    return;
                }
                byte slot = (byte)slea.readShort();
                int itemId = slea.readInt();
                short quantity = slea.readShort();
                shop.sell(c, GameConstants.getInventoryType(itemId), slot, quantity);
                break;
          
```


### NPCHandler.NPCTalk()

```java
public static void NPCTalk(SeekableLittleEndianAccessor slea, MapleClient c, MapleCharacter chr) {
        if (chr == null || chr.getMap() == null) {
            return;
        }
        MapleNPC npc = chr.getMap().getNPCByOid(slea.readInt());
        slea.readInt();
        if (npc == null) {
            return;
        }
        if (chr.getConversation() != 0) {
            NPCScriptManager.getInstance().dispose(c);
            c.getSession().write(MaplePacketCreator.enableActions());
            return;
        }
        if (npc.hasShop()) {
            c.getSession().write(MaplePacketCreator.confirmShopTransaction((byte)20));
            chr.setConversation(1);
            npc.sendShop(c);
        } else {
            NPCScriptManager.getInstance().start(c, npc.getId());
        }
    }
```


### NPCHandler.QuestAction()

```java
public static final void QuestAction(SeekableLittleEndianAccessor slea, MapleClient c, MapleCharacter chr) {
        byte action = slea.readByte();
        short quest = slea.readShort();
        if (quest < 0) {
            quest = (short)(quest + 65536);
        }
        if (chr == null) {
            return;
        }
        if (!chr.canQuestAction()) {
            chr.dropMessage(1, "\u63d0\u4ea4\u64cd\u4f5c\u8fc7\u5feb\u8bf7\u7a0d\u540e\uff01");
            c.sendPacket(MaplePacketCreator.enableActions());
            return;
        }
        MapleQuest q = MapleQuest.getInstance(quest);
        switch (action) {
            case 0: {
                chr.updateTick(slea.readInt());
                int itemid = slea.readInt();
                MapleQuest.getInstance(quest).RestoreLostItem(chr, itemid);
                if (!c.getPlayer().isAdmin()) break;
                c.getPlayer().dropMessage(5, "\u4ece\u65b0\u83b7\u5f97\u4efb\u52a1\u7269\u54c1,\u4efb\u52a1ID\uff1a[" + quest +
```


### MobHandler.MoveMonster()

```java
public static final void MoveMonster(SeekableLittleEndianAccessor slea, MapleClient c, MapleCharacter chr) {
        if (chr == null || chr.getMap() == null) {
            return;
        }
        int oid = slea.readInt();
        MapleMonster monster = chr.getMap().getMonsterByOid(oid);
        if (monster == null) {
            chr.addMoveMob(oid);
            return;
        }
        short moveid = slea.readShort();
        boolean useSkill = slea.readByte() > 0;
        byte skill = slea.readByte();
        int skill1 = slea.readByte() & 0xFF;
        byte skill2 = slea.readByte();
        byte skill3 = slea.readByte();
        byte skill4 = slea.readByte();
        int realskill = 0;
        int level = 0;
        if (useSkill) {
            Pair<Integer, Integer> skillToUse;
            MobSkill mobSkill;
            byte size = monster.getNoSkills();
            boolean used = false;
            if (size > 0 && (mobSkill = MobSkillFactory.getMobSkill(realskill = (skillToUse = 
```


### PlayersHandler.GiveFame()

```java
public static void GiveFame(SeekableLittleEndianAccessor slea, MapleClient c, MapleCharacter chr) {
        int who = slea.readInt();
        byte mode = slea.readByte();
        int famechange = mode == 0 ? -1 : 1;
        MapleCharacter target = (MapleCharacter)chr.getMap().getMapObject(who, MapleMapObjectType.PLAYER);
        if (target == chr) {
            chr.getCheatTracker().registerOffense(CheatingOffense.\u6dfb\u52a0\u81ea\u5df1\u58f0\u671b);
            return;
        }
        if (chr.getLevel() < 15) {
            chr.getCheatTracker().registerOffense(CheatingOffense.\u58f0\u671b\u5341\u4e94\u7ea7\u4ee5\u4e0b\u6dfb\u52a0);
            return;
        }
        switch (chr.canGiveFame(target)) {
            case OK: {
                if (Math.abs(target.getFame() + famechange) <= 30000) {
                    target.addFame(famechange);
                    target.updateSingleStat(MapleStat.FAME, target.getFame());
                }
                if (!chr.isGM()) {
       
```


### PartyHandler.DenyPartyRequest()

```java
public static final void DenyPartyRequest(SeekableLittleEndianAccessor slea, MapleClient c) {
        byte action = slea.readByte();
        int partyid = slea.readInt();
        if (c.getPlayer().getParty() == null) {
            MapleParty party = World.Party.getParty(partyid);
            if (party != null) {
                MapleCharacter cfrom;
                if (action == 27) {
                    if (party.getMembers().size() < 6) {
                        World.Party.updateParty(partyid, PartyOperation.JOIN, new MaplePartyCharacter(c.getPlayer()));
                        c.getPlayer().receivePartyMemberHP();
                        c.getPlayer().updatePartyMemberHP();
                    } else {
                        c.getSession().write(MaplePacketCreator.partyStatusMessage(17));
                    }
                } else if (action != 22 && (cfrom = c.getChannelServer().getPlayerStorage().getCharacterById(party.getLeader().getId())) != null) {
                    cfrom
```
