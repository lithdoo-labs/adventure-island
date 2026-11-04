# Task 046 — Inventory / Item / Equipment Dossier

## Evidence basis
- ITEM_SORT c2s 0x42, ITEM_GATHER c2s 0x43, ITEM_MOVE c2s 0x44, USE_ITEM c2s 0x45 (live)
- CANCEL_ITEM_EFFECT c2s 0x46, USE_SUMMON_BAG 0x48, PET_FOOD 0x49, USE_MOUNT_FOOD 0x4A (live)
- USE_CATCH_ITEM 0x4E, USE_RETURN_SCROLL 0x52, USE_UPGRADE_SCROLL 0x53 (live)
- MESO_DROP c2s 0x5B (live)
- ITEM_BAOWU 0x70, ITEM_MAKER 0x71, ITEM_SUNZI 0x8E (live)
- STORAGE c2s 0x3B (live)
- 27 functions classified `inventory`

## Classes/objects

| Class/Object | Evidence | Confidence |
| --- | --- | --- |
| InventoryContainer | ITEM_SORT/GATHER/MOVE access slot/tab structures | medium |
| ItemSlot | item_id + quantity per slot | medium |
| Equipment state | linked to CWvsContext equipment fields | medium |
| Storage | STORAGE c2s | medium |

## Key functions (senders, all c2s live-named)

ITEM_SORT, ITEM_GATHER, ITEM_MOVE, USE_ITEM, CANCEL_ITEM_EFFECT,
USE_SUMMON_BAG, PET_FOOD, USE_MOUNT_FOOD, USE_CATCH_ITEM,
USE_RETURN_SCROLL, USE_UPGRADE_SCROLL, MESO_DROP, STORAGE,
ITEM_BAOWU, ITEM_MAKER, ITEM_SUNZI, DUEY_ACTION

## Packet links

**Outbound**: 17 c2s opcodes (all live-named)
**Inbound**: inventory update handlers (in the field dispatcher bands —
the s2c inventory update opcodes overlap with the SPAWN band)

## Representative flows

### Flow 1: Item move
```
user drags item from slot A to slot B →
  sender (ITEM_MOVE c2s 0x44):
    COutPacket(0x44)
    WriteHeader(0x44)
    write(source_tab)       // 1=equip, 2=use, 3=setup, 4=etc, 5=cash
    write(source_slot)
    write(quantity)          // 0 = move all
    write(dest_tab)
    write(dest_slot)         // 0 = drop
    send_wrapper()
  server validates + moves → client receives inventory update
```
Confidence: confirmed (c2s + odinms protocol semantics)

### Flow 2: Use item
```
user double-clicks a usable item →
  sender (USE_ITEM c2s 0x45):
    WriteHeader(0x45)
    write(slot)
    write(item_id)
    send_wrapper()
  server applies effect → client receives stat update / buff
```
Confidence: high

### Flow 3: Meso drop
```
user drops mesos →
  sender (MESO_DROP c2s 0x5B):
    WriteHeader(0x5B)
    write(amount)
    send_wrapper()
```
Confidence: high

### Flow 4: Scroll (upgrade)
```
user uses a scroll on equipment →
  sender (USE_UPGRADE_SCROLL c2s 0x53):
    WriteHeader(0x53)
    write(scroll_slot)
    write(equip_slot)
    write(white_scroll_flag)  // 1 if white scroll used
    send_wrapper()
  server determines success/fail → client displays result animation
```
Confidence: high

## Unresolved gaps
- Inventory slot-count state management
- Equipment stat calculation display
- Pet/mount item interaction details
- Cash-item opening (gift/wishlist)
- DUEY (delivery system) flows
