# Maple.Enums — Original Client Typos

Upstream: https://github.com/Bia10/Maple.Enums
License: MIT (see LICENSE in this directory)

Known typos in the MapleStory **V95** client PDB (`game_types.h`). Labels at index 0 preserve the original spelling verbatim; C# member names use corrected English.

| Enum | Member / Scope | PDB spelling | Correct spelling |
|------|----------------|-------------|-----------------|
| `AttackActionType` | *(enum-level)* | `AttactActionType` | `AttackActionType` |
| `AttackActionType` | `TwoHand` | `AAT_TowHand` | `AAT_TwoHand` |
| `AuraType` | `BlueYellow` | `AURA_BLUE_YELOW` | `AURA_BLUE_YELLOW` |
| `AuthOptionCode` | `DifferentIpNotAllowed` | `AuthOption_DiffrentIPNotAllowed` | `AuthOption_DifferentIPNotAllowed` |
| `CashItemFailReason` | `GenderMismatch` | `CashItemFailReason_GenderMisMatch` | `CashItemFailReason_GenderMismatch` |
| `CharacterBodyType` | `Mechanic` | `MECANIC_TYPE` | `MECHANIC_TYPE` |
| `CursorState` | `OnGameBalloon` | `CURSOR_STATE_ONGAMEBALOON` | `CURSOR_STATE_ONGAMEBALLOON` |
| `CursorState` | `OnMiniRoomBalloon` | `CURSOR_STATE_ONMINIROOMBALOON` | `CURSOR_STATE_ONMINIROOMBALLOON` |
| `FieldEffectType` | `RewardRoulette` | `FieldEffect_RewordRullet` | `FieldEffect_RewardRoulette` |
| `ItemMakerResult` | `ErrEmptySlotConsume` | `ITEM_MAKER_ERR_EMPTYSLOT_COMSUME` | `ITEM_MAKER_ERR_EMPTYSLOT_CONSUME` |
| `ItemTransformType` | *(enum-level)* | `ITEM_TRANSFROM_TYPE` | `ITEM_TRANSFORM_TYPE` |
| `ItemUpgradeLimitType` | `LimitByOtherItem` | `ITEM_UPGRADE_LIMIT_TYPE_LIMITBYOHTERITEM` | `ITEM_UPGRADE_LIMIT_TYPE_LIMITBYOTHERITEM` |
| `ItemVariationOption` | `Perfect` | `ITEMVARIATION_PERPECT` | `ITEMVARIATION_PERFECT` |
| `MacroTargetType` | `NearestMob` | `TAEGETTYPE_NEAREASTMOB` | `TARGETTYPE_NEARESTMOB` |
| `SkillTargetType` | `NearestMob` | `TAEGETTYPE_NEAREASTMOB` | `TARGETTYPE_NEARESTMOB` |
| `MiniRoomLeaveType` | `EntrustedShopDestroyByAdmin` | `ESLeave_DestoryByAdmin` | `ESLeave_DestroyByAdmin` |
| `MonsterCarnivalOperation` | `ResFailCpLacking` | `MCarnivalRes_Fail_CPLaking` | `MCarnivalRes_Fail_CPLacking` |
| `NpcShopResult` | `SellUnknown` | `ShopRes_SellUnkonwn` | `ShopRes_SellUnknown` |
| `PartyOperation` | `PartyResCreateNewPartyAlreadyJoined` | `PartyRes_CreateNewParty_AlreayJoined` | `PartyRes_CreateNewParty_AlreadyJoined` |
| `RockPaperScissorsOperation` | `ResContinue` | `RPSRes_Coninue` | `RPSRes_Continue` |
| `SummonedLeaveType` | `EnterForbiddenMap` | `LEAVE_TYPE_ENTER_FORBIDEN_MAP` | `LEAVE_TYPE_ENTER_FORBIDDEN_MAP` |
| `TrunkOperation` | `ResGetHavingOnlyItem` | `TruncRes_GetHavingOnlyItem` | `TrunkRes_GetHavingOnlyItem` |
| `NmUrlPage` | `MyRoomForWebGame` | `kURL_MyRoomForWegGame` | `kURL_MyRoomForWebGame` |
| `ServerPacketOpcode` | `FindFriend` | `LP_FindFirend` | `LP_FindFriend` |
| `ServerPacketOpcode` | `GoldHammer_s` | `LP_GoldHammere_s` | `LP_GoldHammer_s` |
| `ServerPacketOpcode` | `GoldHammer_e` | `LP_GoldHammere_e` | `LP_GoldHammer_e` |
| `DragonActionType` | `MagicResistance` | `DRAGONACT_MAGIC_REGISTANCE` | `DRAGONACT_MAGIC_RESISTANCE` |
| `WeaponType` | `NotCheckSubWeapon` | `WT_NOTCHECK_SUBWEPPON` | `WT_NOTCHECK_SUBWEAPON` |
| `BossMobId` | `Hontail*` / `Hontale*` | `HONTAIL*_MOB_ID` / `HONTALE*` | `HORNTAIL*_MOB_ID` / `HORNTALE*` |
| `MapFieldType` | `Hontail` | `Hontail` (WZ value) | `Horntail` |
| `MapPortalType` | `Changeable` | `PORTALTYPE_CHANGABLE` | `PORTALTYPE_CHANGEABLE` |
| `MapPortalType` | `ChangeableInvisible` | `PORTALTYPE_CHANGABLE_INVISIBLE` | `PORTALTYPE_CHANGEABLE_INVISIBLE` |
| `TemporaryStatType` | `HolyShield` | `CTS_Holyshield` | `CTS_HolyShield` |
| `TemporaryStatType` | `StopPotion` | `CTS_StopPortion` | `CTS_StopPotion` |
| `MobSkillType` | `StopPotion` | `MOBSKILL_STOPPORTION` | `MOBSKILL_STOPPOTION` |
| `SkillId` | `*SoulOfCraftsman` (all job groups) | `*_SOUL_OF_CRAFTMAN` | `*_SOUL_OF_CRAFTSMAN` |
| `SkillId` | `BowmasterMarkmanShip` / `CrossbowmasterMarkmanShip` | `BOWMASTER_MARKMAN_SHIP` / `CROSSBOWMASTER_MARKMAN_SHIP` | `BOWMASTER_MARKSMANSHIP` / `CROSSBOWMASTER_MARKSMANSHIP` |
