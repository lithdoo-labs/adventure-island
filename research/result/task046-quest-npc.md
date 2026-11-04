# Task 046 — Quest / NPC Dossier

## Evidence basis
- NPC_TALK c2s 0x36, NPC_TALK_MORE c2s 0x38, NPC_SHOP c2s 0x3A (live)
- QUEST_ACTION c2s 0x68 (live), quest_KJ c2s 0x6A (live)
- 13 functions classified `quest`
- NPC data in WZ (Task 023 cross-validated)

## Classes/objects

| Class/Object | Evidence | Confidence |
| --- | --- | --- |
| NPCDialog state | NPC_TALK_MORE's continued dialog pattern | medium |
| QuestState | QUEST_ACTION + quest_KJ flows | medium |
| NPCShop | NPC_SHOP flow | medium |
| StorageItem | STORAGE c2s 0x3B shares infrastructure | low |

## Key functions

| RVA / Site | Name | Evidence |
| --- | --- | --- |
| (senders) | NPC_TALK_sender | c2s live name |
| (senders) | NPC_TALK_MORE_sender | c2s live name |
| (senders) | NPC_SHOP_sender | c2s live name |
| (senders) | QUEST_ACTION_sender | c2s live name |
| (senders) | quest_KJ_sender | c2s live name |
| (senders) | STORAGE_sender | c2s live name |

## Packet links

**Outbound**: NPC_TALK (0x36), NPC_TALK_MORE (0x38), NPC_SHOP (0x3A),
STORAGE (0x3B), QUEST_ACTION (0x68), quest_KJ (0x6A)
**Inbound**: NPC dialog content, shop item list, quest accept/complete
notifications (in the field dispatcher bands)

## Representative flows

### Flow 1: NPC dialog state machine
```
user clicks NPC →
  sender (NPC_TALK c2s 0x36):
    WriteHeader(0x36)
    write(npc_oid)          // object ID of the NPC
    write(action_type)      // 0=talk start
    write(selection)        // dialog selection (0 for start)
    send_wrapper()

  server responds with dialog content →
  client displays dialog

  user selects option →
  sender (NPC_TALK_MORE c2s 0x38):
    WriteHeader(0x38)
    write(action_type)      // 1=continue, 2=select, ...
    write(last_sentence)    // dialog state tracking
    write(action)           // the selected option
    send_wrapper()
```
Confidence: high (c2s names + odinms protocol semantics)

### Flow 2: Quest state update
```
player accepts/completes quest →
  sender (QUEST_ACTION c2s 0x68):
    WriteHeader(0x68)
    write(action)           // 1=start, 2=complete, ...
    write(quest_id)
    send_wrapper()

  server updates quest state →
  client receives quest update → refreshes quest window
```
Confidence: high

### Flow 3: NPC shop interaction
```
NPC dialog opens shop →
  client requests shop items (server pushes on dialog) →
  user buys item →
  sender (NPC_SHOP c2s 0x3A):
    WriteHeader(0x3A)
    write(shop_action)      // 0=buy, 1=sell, ...
    write(position)         // slot
    write(item_id)
    write(quantity)
    send_wrapper()
```
Confidence: high

## Unresolved gaps
- Quest completion condition checking (client-side progress tracking)
- NPC dialog UI implementation
- Quest reward distribution
- Storage UI and item management
