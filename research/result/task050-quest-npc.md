# Subsystem Dossier: Quest / NPC

## Dispatch coverage
- NPC band 0x104-0x10C (0x2CB061); quest ops 0xD5/0xD6/0xD7 in avatar band
| opcode | name | leaf | reads |
|---|---|---|---|
| 0xD4 | ? | 0x565b55 | i32 > u8 > i16 > i32 |
| 0xD5 | ? | 0x565be1 | u8 > i16 > i32 |
| 0xD6 | UPDATE_QUEST_INFO | 0x565c0d | u8 > i16 > i32 |
| 0xD7 | ? | 0x567b85 | i32 > u8 > i16 |


## Wire schemas
- UPDATE_QUEST_INFO 0xD6: [action u8][questId i16][data i32] — JT-authoritative
- 0xD5 same shape (record set); 0xD7 [i32][u8][i16] timer family

## State machines
SM06 NPC dialog

## Open questions
- quest-record block readers 0x27/0x25 strides have no reachable static host:
  no static or current-capture evidence distinguishes candidates (thunks unreferenced — likely UI-callback table)
- NPC script continuation ids: needs post-login capture: values only observable at runtime (see blockers)
