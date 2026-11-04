# Task 046 — Social (Party/Guild/Chat/Buddy/Family) Dossier

## Evidence basis
- GENERAL_CHAT c2s 0x2D, PARTYCHAT 0x74, WHISPER 0x75, MESSENGER 0x76 (live)
- PARTY_OPERATION 0x78, DENY_PARTY_REQUEST 0x79, GUILD_OPERATION 0x7A (live)
- DENY_GUILD_REQUEST 0x7B, BUDDYLIST_MODIFY 0x7E, NOTE_ACTION 0x7F (live)
- GIVE_FAME c2s 0x5C (live)
- RING_ACTION c2s 0x85, ALLIANCE_OPERATION 0x8A, DENY_ALLIANCE_REQUEST 0x8B (live)
- BBS_OPERATION c2s 0x8C (live)
- Family ops: REQUEST_FAMILY 0x95, OPEN_FAMILY 0x96, FAMILY_OPERATION 0x97 (live)
- 34 functions classified `social` (the largest non-network subsystem)

## Classes/objects

| Class/Object | Evidence | Confidence |
| --- | --- | --- |
| Party state | PARTY_OPERATION flow | medium |
| Guild state | GUILD_OPERATION + ALLIANCE | medium |
| BuddyList | BUDDYLIST_MODIFY | medium |
| MessengerRoom | MESSENGER | low |

## Packet links

**Outbound**: 16+ c2s opcodes (all live-named)
**Inbound**: SHOW_NOTES (s2c 0x2B observed), party/guild member updates

## Representative flows

### Flow 1: General chat
```
user types chat message + Enter →
  sender (GENERAL_CHAT c2s 0x2D):
    COutPacket(0x2D)
    WriteHeader(0x2D)
    write(message)           // as string
    send_wrapper()
  server broadcasts → all clients display message bubble
```
Confidence: confirmed (live name + universal chat protocol)

### Flow 2: Party create/invite
```
party leader invites player →
  sender (PARTY_OPERATION c2s 0x78):
    WriteHeader(0x78)
    write(operation)         // create/invite/leave/kick/expel
    write(target_name_or_id)
    send_wrapper()
  server processes → all party members receive update
```
Confidence: high

### Flow 3: Whisper
```
user types /w name message →
  sender (WHISPER c2s 0x75):
    WriteHeader(0x75)
    write(target_name)
    write(message)
    send_wrapper()
```
Confidence: high

## Unresolved gaps
- Party member list UI
- Guild window/bbs implementation
- Messenger room creation
- Family tree UI
