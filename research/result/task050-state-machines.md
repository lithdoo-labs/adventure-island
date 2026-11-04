# State Machines (semantic set)

## SM01 CLogin state [high]
- owner: CLogin ~0x45EB00 field +0x64
- values: 0=disconnected,1=login,2=server_select
- transitions: LOGIN_STATUS→1, SERVERLIST→2, CHARLIST→3
- packets: LOGIN_STATUS,SERVERLIST,CHARLIST,SERVER_IP
- evidence: IMG(code_switch)+PKT(handler_sequence)+FLOW(behavior_flow_15)

## SM02 CLogin substate [high]
- owner: CLogin ~0x45EB00 field +0x68
- values: 9=charlist_phase
- transitions: CHARLIST→9
- packets: CHARLIST
- evidence: IMG(code_write)+PKT(handler)

## SM03 Channel migration [confirmed]
- owner: CClientSocket field (protocol)
- values: login→redirect→close→connect→in-game
- transitions: SERVER_IP→close_socket→PLAYER_LOGGEDIN
- packets: CHAR_SELECT,SERVER_IP,PLAYER_LOGGEDIN
- evidence: LIVE(033)+PKT(burst)+FLOW(behavior_flow_22)

## SM04 Field transition [high]
- owner: CField field (implicit)
- values: in_field→transitioning→warp_received→in_field
- transitions: CHANGE_MAP→WARP_TO_MAP
- packets: CHANGE_MAP(c2s),WARP_TO_MAP(s2c)
- evidence: PKT(both_directions)+FLOW(behavior_flow_14)

## SM05 Buff lifecycle [high]
- owner: SkillSystem field (timer)
- values: ready→casting→active→expired/cancelled
- transitions: SPECIAL_MOVE→GIVE_BUFF→CANCEL_BUFF
- packets: SPECIAL_MOVE,GIVE_BUFF,CANCEL_BUFF,TEMP_STATS
- evidence: PKT(GIVE_BUFF 0x23,CANCEL_BUFF 0x24)+FLOW(behavior_flow_7)

## SM06 NPC dialog [high]
- owner: NPCDialogUI field (dialog_state)
- values: idle→talking→selecting→shop/quest/exit
- transitions: NPC_TALK→NPC_MORE→action
- packets: NPC_TALK(c2s),NPC_MORE(c2s),NPC_TALK(s2c)
- evidence: PKT(NPC_TALK 0x145 handler)+FLOW(behavior_flow_13)

## SM07 Keymap update [confirmed]
- owner: KeymapUI field KeymapTable
- values: idle→receiving_table→updated
- transitions: KEYMAP(0x16F)→walker_89x5→updated
- packets: KEYMAP(s2c),CHANGE_KEYMAP(c2s)
- evidence: IMG(89x5 walker confirmed)+PKT(KEYMAP handler)

## SM08 Inventory update [high]
- owner: InventoryUI field InventoryUI
- values: idle→receiving_ops→refreshing
- transitions: MODIFY_INVENTORY_ITEM→mode_add/update/remove/move
- packets: MODIFY_INVENTORY_ITEM(s2c),FINISH_SORT,FINISH_GATHER
- evidence: PKT(MODIFY_INVENTORY 0x20 handler reads 7 fields)

## SM09 Cash shop entry [high]
- owner: CashShopContext field (context)
- values: in_game→entering→in_shop→exiting
- transitions: ENTER_CASH_SHOP→CS_OPEN→exit
- packets: ENTER_CASH_SHOP(c2s),CHAR_CASH(s2c),CS_OPEN(s2c)
- evidence: PKT(CHAR_CASH 0x7D confirmed)+FLOW(behavior_flow_19)

## SM10 Stats update mask [high]
- owner: CWvsContext field CWvsContext
- values: 32-bit mask with per-bit conditional reads
- transitions: UPDATE_STATS(0x22)→mask→conditional field reads
- packets: UPDATE_STATS(s2c)
- evidence: IMG(handler 0x6292F5 reads mask then conditionals)

## SM11 Skill update batch [high]
- owner: SkillSystem field SkillTable
- values: idle→receiving_batch→updated
- transitions: UPDATE_SKILLS(0x27)→count→loop(skill_id,level,master,expire)
- packets: UPDATE_SKILLS(s2c)
- evidence: IMG(handler 0x6280D7 12 reads with loop)

## SM12 Party member lifecycle [medium]
- owner: PartyUI field PartyState
- values: no_party→invited→in_party→left
- transitions: PARTY_OPERATION(mode)→create/join/leave/expel
- packets: PARTY_OPERATION(s2c 0x3B, c2s 0x78)
- evidence: PKT(PARTY_OPERATION handler 0x648120)

## SM13 Character identity change [confirmed]
- owner: CWvsContext field CWvsContext+0x2F60
- values: 0=same,1=changed
- transitions: WARP_TO_MAP→id_changed→UI_refresh
- packets: WARP_TO_MAP(s2c)
- evidence: IMG(WARP handler writes flag when CharacterId differs)

## SM14 Monster lifecycle [high]
- owner: Field/MobSystem field MobObject
- values: spawned→controlled→damaged→killed
- transitions: SPAWN_MONSTER→DAMAGE_MONSTER→KILL_MONSTER
- packets: SPAWN_MONSTER,KILL_MONSTER,DAMAGE_MONSTER,SHOW_MONSTER_HP
- evidence: PKT(MOB band 0xEE-0x103 handlers)

## SM15 Inventory sort/gather [medium]
- owner: InventoryUI field InventoryUI
- values: idle→sorting→done
- transitions: ITEM_SORT(c2s)→FINISH_SORT(s2c)
- packets: ITEM_SORT,FINISH_SORT,ITEM_GATHER,FINISH_GATHER
- evidence: PKT(FINISH_SORT 0x36, FINISH_GATHER 0x37 handlers with 12+10 reads)

## SM16 Equipment appearance [medium]
- owner: CWvsContext field CharacterLook
- values: base→updated_look
- transitions: UPDATE_CHAR_LOOK(0xC7)→read appearance→update
- packets: UPDATE_CHAR_LOOK(s2c)
- evidence: PKT(UPDATE_CHAR_LOOK handler in SPAWN band)

## SM17 Guild window [medium]
- owner: GuildUI field GuildUI
- values: closed→opening→viewing→closed
- transitions: GUILD_OPERATION(0x3E)→parse→display
- packets: GUILD_OPERATION(s2c)
- evidence: PKT(GUILD_OPERATION handler 0x641174)

## SM18 Family system [medium]
- owner: FamilyUI field FamilyUI
- values: idle→viewing→interacting
- transitions: OPEN_FAMILY(0x65)→FAMILY(0x6A)→operations
- packets: OPEN_FAMILY,FAMILY,FAMILY_INVITE,FAMILY_JUNIOR
- evidence: PKT(OPEN_FAMILY handler 0x63E008 with 12 reads)

## SM19 Reactor lifecycle [medium]
- owner: Field/ReactorSystem field ReactorObject
- values: spawned→hit→destroyed
- transitions: REACTOR_SPAWN→REACTOR_HIT→REACTOR_DESTROY
- packets: REACTOR_SPAWN,REACTOR_HIT,REACTOR_DESTROY
- evidence: PKT(REACTOR band 0x11C-0x11F handler with 13 reads)

## SM20 Buddy list update [medium]
- owner: BuddyListUI field BuddyListUI
- values: idle→receiving→updated
- transitions: BUDDYLIST(0x3C)→parse_entries→refresh
- packets: BUDDYLIST(s2c)
- evidence: PKT(BUDDYLIST handler 0x64915C with 6 reads)

