# Subsystem Dossier: Mob / Combat

## Dispatch coverage
Mob band 0xEE-0x103 via 0x2A6AB0 (16 leaf handlers)
| opcode | name | leaf | reads |
|---|---|---|---|
| 0xEE | SPAWN_MONSTER | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0xEF | KILL_MONSTER | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0xF0 | SPAWN_MONSTER_CONTROL | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0xF1 | MOVE_MONSTER | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0xF2 | MOVE_MONSTER_RESPONSE | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0xF3 | ? | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0xF4 | APPLY_MONSTER_STATUS | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0xF5 | CANCEL_MONSTER_STATUS | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0xF6 | ? | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0xF7 | MOB_TO_MOB_DAMAGE | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0xF8 | DAMAGE_MONSTER | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0xF9 | ? | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0xFA | ? | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0xFB | ARIANT_THING | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0xFC | SHOW_MONSTER_HP | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0xFD | SHOW_MAGNET | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0xFE | ? | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0xFF | CYGNUS_CHAR_CREATED | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0x100 | CATCH_ARIANT | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0x101 | ? | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0x102 | ? | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |
| 0x103 | CATCH_MONSTER | 0x2a6b0f | i32 > i32 > u8 > i32 > i32 > u8 |


## Wire schemas
Leaves with reads above; DAMAGE/SHOW_MONSTER_HP in range family.

## State machines
SM14 monster lifecycle (spawn->damage->kill)

## Open questions
- mob controller handover mode byte: deeper register-level dataflow on existing corpus
- aggro link values at runtime: needs post-login capture: values only observable at runtime (see blockers)
