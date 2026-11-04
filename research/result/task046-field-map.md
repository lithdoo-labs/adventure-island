# Task 046 — Field / Map / Stage Dossier

## Evidence basis
- CHANGE_MAP c2s 0x21 (live), CHANGE_CHANNEL c2s 0x22 (live)
- USE_DOOR c2s 0x81 (live), CHANGE_MAP_SPECIAL c2s 0x61, USE_INNER_PORTAL c2s 0x62
- TROCK_ADD_MAP c2s 0x63
- WARP_TO_MAP handler @ 0x37E72F (the field-transition inbound)
- Field dispatcher @ 0x14112E (owns field-related bands)
- 20 functions classified `field`

## Classes/objects

| Class/Object | Evidence | Confidence |
| --- | --- | --- |
| CField (implied) | field dispatcher singleton; handlers access via `this-8` | high (structural) |
| CMap/portal state | USE_INNER_PORTAL + USE_DOOR flows | medium |
| CWvsContext (map fields) | map_id/channel stored in context | medium |

## Key functions

| RVA | Name | Evidence |
| --- | --- | --- |
| 0x37E72F | WARP_TO_MAP_handler | confirmed |
| (multiple) | CHANGE_MAP_sender | c2s live name |
| (multiple) | CHANGE_CHANNEL_sender | c2s live name |
| 0x14112E | Field_OnPacket | confirmed (owns field bands) |

## Packet links

**Inbound**: WARP_TO_MAP (0x81), MAP_EFFECT (0x91)
**Outbound**: CHANGE_MAP (0x21), CHANGE_CHANNEL (0x22), USE_DOOR (0x81),
CHANGE_MAP_SPECIAL (0x61), USE_INNER_PORTAL (0x62), TROCK_ADD_MAP (0x63)

## Representative flows

### Flow 1: Complete map transition (CHANGE_MAP)
```
user walks into a portal →
  client detects portal collision →
  sender (CHANGE_MAP c2s 0x21):
    COutPacket(0x21)
    WriteHeader(0x21)
    write(map_id)
    write(portal_id)
    write(origin_x?)       // unknown extra
    send_wrapper()

  server responds WARP_TO_MAP (0x81) →
  handler 0x37E72F:
    CWvsContext.CharacterId update
    // read new map info
    // trigger field teardown + rebuild
```
Confidence: confirmed (both directions live-proven)

### Flow 2: Inner portal
```
user enters an inner portal →
  sender (USE_INNER_PORTAL c2s 0x62):
    write(portal_id)
    write(from_x, from_y)   // position for anti-teleport check
  server responds (map effect or position update)
```
Confidence: medium (c2s name + builder pattern)

### Flow 3: Channel change
```
user selects a channel →
  sender (CHANGE_CHANNEL c2s 0x22):
    write(channel_id)
  // server redirects to new channel port
  // client disconnects + reconnects (the login-close-then-migrate pattern)
```
Confidence: confirmed (033 live-proven the protocol side)

## Unresolved gaps
- The CField object layout and lifecycle
- Portal collision detection (client-side physics)
- Map object (mobs/NPCs/reactors) insertion/removal from field
- WZ map-data loading bridge
