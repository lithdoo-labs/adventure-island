# Task 046 — Cash Shop / Transfer Dossier

## Evidence basis
- ENTER_CASH_SHOP c2s 0x23 (live)
- USE_CASH_ITEM c2s 0x4C (live)
- ENTER_MTS c2s 0x8D (live)
- USE_HIRED_MERCHANT c2s 0x3C, MERCH_ITEM_STORE c2s 0x3D (live)
- 5 functions classified `cashshop`
- CHAR_CASH s2c 0x7D (observed live in the 033 burst)
- Cash-shop port 8600 handshake confirmed (Task 033)

## Classes/objects

| Class/Object | Evidence | Confidence |
| --- | --- | --- |
| CashShop context | ENTER_CASH_SHOP transitions to a separate protocol phase | medium |
| MTS/Transfer context | ENTER_MTS shares the transfer pattern | low |

## Key functions

| RVA / Site | Name | Evidence |
| --- | --- | --- |
| (senders) | ENTER_CASH_SHOP_sender | c2s live name |
| (senders) | USE_CASH_ITEM_sender | c2s live name |
| (senders) | ENTER_MTS_sender | c2s live name |
| (senders) | USE_HIRED_MERCHANT_sender | c2s live name |
| (senders) | MERCH_ITEM_STORE_sender | c2s live name |

## Packet links

**Outbound**: ENTER_CASH_SHOP (0x23), USE_CASH_ITEM (0x4C), ENTER_MTS (0x8D),
USE_HIRED_MERCHANT (0x3C), MERCH_ITEM_STORE (0x3D)
**Inbound**: CHAR_CASH (0x7D — confirmed in 033 burst), cash-shop item list,
purchase results (the cash-shop-specific phase on port 8600)

## Representative flows

### Flow 1: Enter cash shop (end-to-end)
```
user clicks "Cash Shop" button →
  sender (ENTER_CASH_SHOP c2s 0x23):
    COutPacket(0x23)
    WriteHeader(0x23)
    send_wrapper()

  // server transitions the session to cash-shop mode:
  //   (confirmed live: the cash-shop port 8600 has the same handshake
  //    format; PLAYER_LOGGEDIN accepted without rejection)
  // client receives CHAR_CASH (0x7D) → updates NX balance display
  // client receives cash-shop item catalog
  // UI transitions to cash-shop overlay
```
Confidence: confirmed (both directions live-proven; protocol chain established)

### Flow 2: Purchase cash item
```
user selects a cash item → clicks buy →
  sender (USE_CASH_ITEM c2s 0x4C):
    WriteHeader(0x4C)
    write(cash_item_sn)     // serial number from the catalog
    write(quantity)
    send_wrapper()
  server processes → NX deducted → item added to inventory
```
Confidence: medium

## Unresolved gaps
- Cash shop UI overlay implementation
- The full cash-shop-specific protocol phase (port 8600 deeper flows)
- Return-to-game flow
- MTS (Maple Trading System) detailed interaction
- Wish list functionality
