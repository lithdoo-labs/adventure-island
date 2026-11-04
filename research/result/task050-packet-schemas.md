# Task 050 Packet Schemas (canonical rendering)

Inbound schemas: reader sequences from hand-verified handlers.
Outbound: ordered writer-primitive sequences.

## Hand-verified (S10 samples 1-11)

- **CHATTEXT 0xA4/0xA5**: `[band id i32] type u8 name str flag u8 [self: extra str]`
- **SPAWN_PLAYER 0xA2**: `decodeAvatar: u8, str, str, i16, u8, i16, u8, buff-container, i16, i32, i32, str, str, i16, i16, i32, pos i16 x2, stance u8, ...`
- **WARP_TO_MAP**: `id i32, grade u8, u8, u8, count i16, {str x count}, [flag: i32 x3 + tail]`
- **UPDATE_STATS 0x22**: `flag u8, mask i32, {bit: u8/i32/i64/i16 conditional}`
- **TEMP_STATS 0x25**: `mask i32, {bit: i16 computed pairs stride 0x0C}`
- **MODIFY_INVENTORY 0x20**: `flag u8, op_count u8, {mode u8 slot u8 arg i16 + mode payload xN}`
- **KEYMAP 0x16F**: `mode u8, {5-byte entry x 89 if mode==0}`
- **BUDDYLIST 0x3C**: `mode u8 (JT 7-0x16); case8: pos i32 channel u8 cid i32`
- **PARTY 0x3B**: `mode u8 (JT 4-0x24); case4: charid i32 name str flag u8`
- **OPEN_NPC_SHOP 0x146**: `npcId i32, count i16, {itemId i32 price i32 tier-branch(i64|i16)} xN`
- **UPDATE_QUEST_INFO 0xD6**: `action u8, questId i16, data i32`

Full tables: task050-packet-schemas.csv, task050-band-leaf-schemas.csv, task050-outbound-schemas.csv
