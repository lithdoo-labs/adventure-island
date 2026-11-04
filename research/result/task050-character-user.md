# Subsystem Dossier: Character / User / CWvsContext

## Dispatch coverage
Range-table 0x20-0x3A family. Confirmed heads:
| opcode | name | leaf | reads |
|---|---|---|---|
| 0x20 | MODIFY_INVENTORY_ITEM | 0x6286ec | Byte > Byte > Byte > Byte > Int16 >  |
| 0x21 | UPDATE_INVENTORY_SLOT | 0x629024 | Byte > Byte > Byte |
| 0x22 | UPDATE_STATS | 0x6292f5 | Byte > Byte |
| 0x23 | GIVE_BUFF | 0x6299ff | Int16 > Byte |
| 0x24 | CANCEL_BUFF | 0x629e60 | Byte > Byte > Byte |
| 0x25 | TEMP_STATS | 0x62a040 | Byte > Byte > Byte > Byte > Int32 >  |
| 0x26 | TEMP_STATS_RESET | 0x62a05d | Byte > Byte > Byte > Byte > Int32 >  |
| 0x27 | UPDATE_SKILLS | 0x6280d7 | Byte > Int16 > Int32 > Int32 > Int32 |
| 0x28 | SKILL_USE_RESULT | 0x62a0f3 | Byte > Byte > Byte > Byte > Int32 >  |
| 0x29 | FAME_RESPONSE | 0x62bb3c | Byte > Byte > Byte > Int32 > Int32 > |
| 0x2A | SHOW_STATUS_INFO | 0x62a115 | Byte > Byte > Byte > Int32 > Int16 > |
| 0x2B | SHOW_NOTES | 0x62e85f | Byte > Byte > Byte > Byte > Byte > I |
| 0x2C | TROCK_LOCATIONS | 0x62ea39 | Byte > Byte > Int32 |
| 0x2D | ANTI_MACRO_RESULT | 0x62ff74 | Byte > Byte > Byte |
| 0x2F | CLAIM_RESULT | 0x631374 | Byte > Byte > Int32 > Byte > Byte >  |
| 0x30 | CLAIM_STATUS_CHANGED | 0x63161a | Byte > Byte > Byte > Byte > Int32 >  |
| 0x31 | SET_TAMING_MOB_INFO | 0x631643 | Byte > Byte > Int32 > Byte |
| 0x32 | UPDATE_MOUNT | 0x632d3b | Int32 > Int32 > Int32 > Int32 > Byte |
| 0x33 | SHOW_QUEST_COMPLETION | 0x630827 | Int16 |
| 0x34 | SEND_TITLE_BOX | 0x631881 | Byte > Int32 > Byte > Int32 > Byte > |
| 0x35 | USE_SKILL_BOOK | 0x6281eb | Int32 > Byte > Int32 > Int32 > Byte  |
| 0x36 | FINISH_SORT | 0x62857f | Byte > Byte > Byte > Byte > Byte > B |
| 0x37 | FINISH_GATHER | 0x6285a9 | Byte > Byte > Byte > Byte > Byte > B |
| 0x3A | CHAR_INFO | 0x62cde5 | Int32 > Byte > Int16 > Int16 > Byte  |


## Object model (evidence: hand-decoded handlers)
- CWvsContext singleton [0xBD9028], vtable @0x70D3C8 (496 slots, ctor-validated)
- 53 owned field facts, the densest object map in the corpus:
  0x205c=CharacterId; 0x2080=grade_byte; 0x2084=spawn_identity; 0x2f60=char_changed_flag; 0x2fe8=spawn_check; 0x2110=CWvsContext_0x2110; 0x2dcc=CWvsContext_0x2dcc; 0x2110=CWvsContext_0x2110; 0x2110=CWvsContext_0x2110; 0x2088=CWvsContext_0x2088; 0x208c=CWvsContext_0x208c; 0x2094=CWvsContext_0x2094; 0x3468=CWvsContext_0x3468; 0x346c=CWvsContext_0x346c
- CCharacterStats via GetStats (0x26F51): 8 facts — 0x12=skin; 0x13=level; 0x17=stat4; 0x1b=val64_A; 0x23=val64_B; 0x2b=val64_C; 0x33/0x35=byte_stat_pair; 0x39..0x5d=short_stat_series
- CUserRemote (ctor 0x98CC52, size 0x3500): 17 facts — 0x1bb4=pet_array; 0x1bbc=effect_map; vtable+0x24=OnPacket_vmethod_24; vtable+0x28=OnPacket_vmethod_28; vtable+0x2C=OnPacket_vmethod_2C; 0xf30=display_name_string; 0x28b0=miniroom_membership; 0x28b8=level; 0x28bc=buff_container; 0x34fc=job_hint; 0x34dc=transformed_id; 0x3c0=stance; 0x3b8=display_tag; 0x1bd4=active_effect_list
- LocalAvatarHolder [0xBDD4A0]->[+8]: canonical avatar-resolve idiom (4 sightings)

## Key wire schemas (hand-verified)
- UPDATE_STATS 0x22: [flag u8][mask i32]{bit->field} (13+ conditional fields; sample #4)
- TEMP_STATS 0x25/0x26: buff mask, stride-0x0C pairs; codec family 0x3848B7/0x38453C/0x38FABE
- WARP_TO_MAP: [id i32][grade u8][u8][u8][count i16]{str x count}[tail if flag] (sample #3)
- SPAWN_PLAYER 0xA2: decodeAvatar 0x58CDF6 field-write sequence (sample #2)

## State machines
SM01 CLogin state, SM10 stats mask, SM13 identity change, SM16 appearance (see task050-state-machines.csv)

## Senders
CHAR_SELECT / PLAYER_LOGGEDIN family resolved via provenance ladder.

## Resource links
(auction UI refs among sender hosts)

## Open questions
- macro/equip slot semantic per-int32 (which is itemId vs flag): deeper register-level dataflow on existing corpus
- CWvsContext 0x2110 container contents at runtime: needs post-login capture: values only observable at runtime (see blockers) —
  concrete example: buff source-skill IDs land in +0x31F4/+0x32F8 only after login buffs;
  static code shows Add(v1,v2,v3) but not the runtime triple values.
- exact meaning of stats +0x17 (fame vs meso-family): no static or current-capture evidence distinguishes candidates
