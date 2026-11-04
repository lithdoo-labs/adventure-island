# Subsystem Dossier: Cash Shop / MTS

## Dispatch coverage
0x74-0x80 family
| opcode | name | leaf | reads |
|---|---|---|---|
| 0x74 | BBS_OPERATION | 0x61cb05 |  |
| 0x75 | FISHING_BOARD_UPDATE |  |  |
| 0x76 | ? | 0x61b633 | Byte |
| 0x77 | ? | 0x6338e6 | Byte > Byte > Int32 |
| 0x78 | ? | 0x6339b9 | Byte > Int32 > Byte |
| 0x79 | ? | 0x633fce | Byte > Byte > Byte > Int32 |
| 0x7A | ? | 0x6340ce | Byte > Int32 |
| 0x7B | ? | 0x634771 | Int32 > Int32 > Int32 |
| 0x7C | ? | 0x6347b2 | Int32 > Int32 > Int32 |
| 0x7D | CHAR_CASH | 0x634844 | Int32 > Int32 |
| 0x7E | ? | 0x634c3b |  |
| 0x7F | ? | 0x634a9b |  |
| 0x80 | SKILL_MACRO | 0x632d1e | Int32 > Int32 > Int32 > Int32 > Byte |


## Object model
- CShopSession [0xBD9020] (0x5F4, npcId@+0xB4, state@+0xEC) — sample #11
- shop UI manager [0xBE2798]

## Wire schemas
- OPEN_NPC_SHOP: [npcId i32][count i16] x [itemId i32][price i32][tier-branched ext]
  tier = price/10000 vs 207/233 -> 8-byte extended price else i16
- MERCHANT 0x14C: modes 0x22-0x26; 0x25=[i32][i32][u8...]; 0x26 complete+sound

## Resource links
Sound/CashEffect.img referenced

## Open questions
- wish-list/MTS entries: deeper register-level dataflow on existing corpus
- NX balance update at runtime: needs post-login capture: values only observable at runtime (see blockers)
