# Subsystem Dossier: Field / Map

## Dispatch coverage
- FieldDispatcher (SPAWN band 0x57F64C, singleton [0x3DD4A0]): +0xC object map,
  +0x24 avatar layers, +0x54 field list (sample #2)
- Map-object families 0x104-0x11F: NPC (0x2CB061), drop, reactor, mist, love, hired-merchant
| opcode | name | leaf | reads |
|---|---|---|---|
| 0x104 | SPAWN_NPC | 0x2cb2b4 | i32 > i32 > i32 > u8 > i32 |
| 0x105 | REMOVE_NPC | 0x2cb2b4 | i32 > i32 > i32 > u8 > i32 |
| 0x106 | SPAWN_NPC_REQUEST_CONTROLLER | 0x2cb2b4 | i32 > i32 > i32 > u8 > i32 |
| 0x107 | NPC_ACTION | 0x2cb2b4 | i32 > i32 > i32 > u8 > i32 |
| 0x108 | ? | 0x2cb2b4 | i32 > i32 > i32 > u8 > i32 |
| 0x109 | ? | 0x2cb2b4 | i32 > i32 > i32 > u8 > i32 |
| 0x10A | ? | 0x2cb2b4 | i32 > i32 > i32 > u8 > i32 |
| 0x10B | ? | 0x2cb2b4 | i32 > i32 > i32 > u8 > i32 |
| 0x10C | ? | 0x2cb2b4 | i32 > i32 > i32 > u8 > i32 |
| 0x10D | SPAWN_HIRED_MERCHANT | 0x11b4d1 | i32 |
| 0x10E | DESTROY_HIRED_MERCHANT | 0x11b4d1 | i32 |
| 0x10F | UPDATE_HIRED_MERCHANT | 0x11b4d1 | i32 |
| 0x110 | DROP_ITEM_FROM_MAPOBJECT | 0x10f385 | u8 > i32 > i16 > i32 > u8 |
| 0x111 | REMOVE_ITEM_FROM_MAP | 0x10f385 | u8 > i32 > i16 > i32 > u8 |
| 0x113 | SPAWN_LOVE | 0x289303 | u8 > i32 |
| 0x114 | REMOVE_LOVE | 0x289303 | u8 > i32 |
| 0x115 | SPAWN_MIST | 0x31fab | i32 |
| 0x116 | REMOVE_MIST | 0x31fab | i32 |
| 0x117 | SPAWN_DOOR |  |  |
| 0x118 | REMOVE_DOOR |  |  |
| 0x11C | REACTOR_HIT | 0x3420ec | i32 > u8 > i16 > i16 |
| 0x11D | ? | 0x3420ec | i32 > u8 > i16 > i16 |
| 0x11E | REACTOR_SPAWN | 0x3420ec | i32 > u8 > i16 > i16 |
| 0x11F | REACTOR_DESTROY | 0x3420ec | i32 > u8 > i16 > i16 |


## Wire schemas
- SPAWN/NPC leaves with reader sequences above; CHATTEXT 0xA4/0xA5 is_self duality (sample #1)
- field+0x130 = shop-NPC discriminator (magic 0x3038D170)

## State machines
SM04 field transition, SM14 monster lifecycle (partial here)

## Resource links
2 Map refs incl. MapHelper worldMap npcPos

## Open questions
- per-map object table indices: needs post-login capture: values only observable at runtime (see blockers) — concrete: object map
  keys are runtime char/mob ids visible only in a logged-in capture
- reactor state byte meanings: deeper register-level dataflow on existing corpus
