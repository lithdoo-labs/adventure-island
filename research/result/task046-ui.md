# Task 046 — UI / Gameplay Windows Dossier

## Evidence basis
- KEYMAP handler @ 0x1B9E4F (confirmed: 89×5-byte walker)
- CHANGE_KEYMAP c2s 0x83 (live-named sender)
- FACE_EXPRESSION c2s 0x2F, USE_ITEMEFFECT c2s 0x30, WHEEL_OF_FORTUNE 0x31
- CLOSE_CHALKBOARD c2s 0x2E, MONSTER_BOOK_COVER c2s 0x35, EFFECT_ON_OFF c2s 0x69
- RPS_GAME c2s 0x84
- Vtable families at 0x816xxx (data-section, 20+ candidates)
- Strings from the recovered image
- Subsystem classification: 20 functions classified `ui`

## Classes/objects

| Class/vtable | Evidence | Confidence |
| --- | --- | --- |
| KeymapTable @ 0x1B9F47 | 89×5B walker confirmed via 0x16F handler semantics | confirmed |
| UI window family (vtables 0x816604–0x817808) | 28 vtable candidates in the UI-region data | low (provisional) |
| CWvsContext UI fields | +0x2F60 char-changed flag triggers UI refresh | high |

## Key functions

| RVA | Name | Evidence |
| --- | --- | --- |
| 0x1B9E4F | KEYMAP_handler | live protocol + handler map |
| 0x1B9F47 | KeymapTable_walker_89x5 | code semantics (89 entries × 5B) |
| 0x1B9EC8 | KEYMAP_handler_0x170 | handler map |
| 0x1B9EEE | KEYMAP_handler_0x171 | handler map |

## Packet links

- **Inbound**: KEYMAP (s2c 0x16F) → handler reads 89×5B table
- **Outbound**: CHANGE_KEYMAP (c2s 0x83), FACE_EXPRESSION (0x2F), USE_ITEMEFFECT (0x30)

## State fields
- CWvsContext+0x2F60: char-changed flag (triggers full UI refresh on warp)
- KeymapTable: 89 slots × 5 bytes (type + key + action)

## Representative flows

### Flow 1: Keymap update
```
server sends KEYMAP (0x16F) →
  handler 0x1B9E4F reads count →
  walker 0x1B9F47 iterates 89 entries × 5B →
  for each entry: if type==4 → dispatch via [0xAFE2C8](key, 0|1|2|3) →
  update keymap table
```
Confidence: confirmed (live + code)

### Flow 2: Expression
```
user clicks expression →
  UI calls sender (FACE_EXPRESSION c2s 0x2F) →
  WriteHeader(0x2F) + expression_id → send_wrapper 0x95C5C
```
Confidence: medium (c2s live name + sender census)

### Flow 3: Char-change UI refresh
```
WARP_TO_MAP handler 0x37E72F →
  reads CharacterId → CWvsContext+0x205C →
  if changed → CWvsContext+0x2F60 = 1 →
  next UI tick: full window refresh
```
Confidence: confirmed (code semantics + cross-correlation)

## Unresolved gaps
- Individual window class identification (inventory/skill/quest windows)
- Button event handler dispatch table
- UI text/resource binding functions
- The vtable families at 0x816xxx need singleton/ctor correlation to name
