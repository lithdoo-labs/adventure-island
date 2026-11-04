# Task 046 — Character / User / Context Dossier

## Evidence basis
- CWvsContext singleton at [0xBD9028] (confirmed via 037/040)
- Static in-image object @ RVA 0x7E2E90, vtable @ 0x70D3C8 (24 methods)
- WARP_TO_MAP handler @ 0x37E72F (confirmed)
- SPAWN_PLAYER handler @ 0x57F6C0 (confirmed)
- CHAR_INFO_REQUEST c2s 0x5E, DISTRIBUTE_AP c2s 0x54, AUTO_ASSIGN_AP c2s 0x55
- 15 functions classified `character` in the subsystem classification

## Classes/objects

| Class/Object | Singleton | Vtable | Confidence |
| --- | --- | --- | --- |
| CWvsContext | [0xBD9028] → static @ 0x7E2E90 | @0x70D3C8 (24 methods) | confirmed |
| CUser (implied) | accessed via CWvsContext fields | candidate | high (structural) |

## CWvsContext field map

| Offset | Semantics | Evidence |
| --- | --- | --- |
| +0x205C | CharacterId | WARP handler writes; compare-on-warp |
| +0x2080 | byte (gradecode-like) | WARP handler reads from packet |
| +0x2084 | Spawn-identity compare | SPAWN handler "is-it-me" check |
| +0x2F60 | char-changed flag | set to 1 when CharacterId differs |
| +0x2FE8 | spawn check | 0xA2 handler checks |
| +0x2030 | AccountId (reference-correlated) | v95 offset +0x2030 matches |
| +0x205C | WorldId (reference overlap) | v95 +0x205C; CMS079 differs |

## Key functions

| RVA | Name | Evidence |
| --- | --- | --- |
| 0x37E72F | WARP_TO_MAP_handler | live + handler map + code semantics |
| 0x57F6C0 | SPAWN_PLAYER_handler | live + handler map |
| 0x37FC9E | CHARINFO_handler_0x82 | handler map |
| 0x37F209 | CHARINFO_handler_0x83 | handler map |
| (multiple) | DISTRIBUTE_AP_sender | c2s live name |
| (multiple) | CHAR_INFO_REQUEST_sender | c2s live name |

## Packet links

**Inbound**: WARP_TO_MAP (0x81), SPAWN_PLAYER (0xA2), UPDATE_STATS (0x22),
CHARINFO (0x82/0x83), CHAR_CASH (0x7D)
**Outbound**: DISTRIBUTE_AP (0x54), AUTO_ASSIGN_AP (0x55), CHAR_INFO_REQUEST (0x5E),
GIVE_FAME (0x5C), SPAWN_PET (0x5F)

## Representative flows

### Flow 1: Map warp → identity update
```
server sends WARP_TO_MAP (0x81) →
  handler 0x37E72F:
    old_id = CWvsContext.CharacterId    // [+0x205C]
    new_id = ReadInt32()
    CWvsContext.CharacterId = new_id
    if old_id != new_id:
        CWvsContext.char_changed = 1   // [+0x2F60]
    grade = ReadByte()                  // [+0x2080]
    // ... additional fields
```
Confidence: confirmed

### Flow 2: Spawn → local-vs-remote
```
server sends SPAWN_PLAYER (0xA2) →
  handler 0x57F6C0:
    spawn_id = ReadInt32()
    if spawn_id == CWvsContext.field_2084:
        // this IS the local player — update own state
    else:
        // remote player — create/update remote character object
```
Confidence: confirmed

### Flow 3: AP distribution
```
user clicks "+" on a stat →
  sender (DISTRIBUTE_AP c2s 0x54):
    COutPacket(0x54)
    WriteHeader(0x54)
    write(stat_type)    // STR/DEX/INT/LUK
    write(amount)
    send_wrapper()
```
Confidence: medium (c2s name + builder pattern)

### Flow 4: Character info request
```
user right-clicks a character →
  sender (CHAR_INFO_REQUEST c2s 0x5E):
    COutPacket(0x5E)
    WriteHeader(0x5E)
    write(target_cid)
    send_wrapper()
```
Confidence: medium

## Unresolved gaps
- Full CUser object layout (only accessible from CWvsContext fields)
- HP/MP/EXP/level update handler internals
- Equipment state management
- Remote character object lifecycle
