# Task 046 — Subsystem Overview

## Distribution (from task046-subsystem-classification.csv)

| Subsystem | Functions | Confidence Notes |
| --- | --- | --- |
| network-packet-core | 202 | Mostly confirmed/high (direct seeds + handler chain) |
| unknown | 136 | Global-cluster functions + vtable methods (low confidence) |
| social | 34 | Sender-derived (c2s live names) |
| inventory | 27 | Sender-derived |
| ui | 20 | KEYMAP handler + sender-derived |
| field | 20 | CHANGE_MAP/CHANNEL/PORTAL senders + WARP handler |
| character | 15 | CWvsContext family + AP/CHARINFO senders |
| quest | 13 | NPC/QUEST senders |
| skill | 12 | SP/SPECIAL_MOVE/BUFF senders |
| combat | 11 | ATTACK/DAMAGE senders |
| security | 8 | RTTI + throw-site cluster |
| cashshop | 5 | ENTER_CASH_SHOP/MTS senders |
| login | 1 | CLogin state machine |
| **Total** | **504** | |

## Subsystem quality assessment

- **network**: highest confidence (confirmed anchors from 037-040)
- **social/inventory/quest/skill/combat/cashshop**: medium (c2s live names
  classify the SENDER functions; handler-side naming depends on the
  s2c enumeration which is partial)
- **character/field**: high (WARP/SPAWN handlers confirmed with code semantics)
- **ui/security/login**: mixed (KEYMAP confirmed; security mapped; login
  structural only)
- **unknown**: the 136 unknown functions are primarily vtable methods and
  global-cluster members that need additional evidence for classification

## Coverage notes

The 504 classified functions represent the seed-expansion + handler +
sender classification pass. The remaining ~50,000 function candidates
(from the census) are overwhelmingly small utility/thunk/wrapper
functions that would require manual analysis for classification.

The 504 figure should be understood as "functions with enough evidence
to assign to a subsystem with at least low confidence" — a meaningful
milestone for automated pipeline output.
