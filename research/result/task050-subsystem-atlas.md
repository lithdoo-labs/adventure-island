# Task 050 Cross-Subsystem Atlas

Computed from session artifacts: task049 dispatch map, handler semantics, band-leaf decode (cmp-chain + jump-table), sender provenance ladder, writer-primitive sequences.

## Wire coverage by subsystem

| subsystem | s2c total | named | leaf handlers | band leaves |
|---|---|---|---|---|
| cash-shop | 4 | 4 | 12 | 0 |
| character | 28 | 28 | 28 | 0 |
| family | 16 | 16 | 16 | 15 |
| field-combat | 15 | 15 | 37 | 22 |
| field-objects | 18 | 18 | 38 | 22 |
| field-player | 45 | 45 | 74 | 74 |
| login | 13 | 13 | 0 | 0 |
| quest-social | 10 | 10 | 36 | 0 |
| trade-merchant | 10 | 10 | 2 | 2 |
| ui-config | 10 | 10 | 4 | 0 |
| ui-misc | 20 | 20 | 3 | 0 |
| ui-rooms | 18 | 18 | 3 | 2 |

Global: send sites classified 374/486; outbound schemas 154; flows 372.

## Transport and codec (confirmed)

- Server-first hello (15B); c2s word 0x4F00 + hello[6:10]; s2c word 0xB0FF + hello[10:14]
- Writer family: WriteByte@0x661F, WriteInt16@0x291B3, WriteInt32@0x667C, EnsureCapacity@0x663D, ctor@0x2F5E40, Send@0x95C5C
- Reader family: ReadInt32@0x66FF, ReadByte@0x66C9, ReadInt16@0x259A2, ReadString@0x71D7A

## Dispatch architecture (confirmed)

1. Range table (0x20-0x80): direct handler slots
2. Band dispatchers: spawn 0x57F64C (0xA2-0xED), mob 0x2A6AB0 (0xEE-0x103), npc 0x2CB061, family 0x63E008 (jump table)
3. Sub-band internals: cmp chains AND jump tables (e.g. table@0x57FBEF for 0xBC-0xCE, gated by CWvsContext+0x2FE8==0)

## Key findings this session

- Writer primitive family completed (WriteInt16 discovered at 0x291B3)
- Band sub-dispatch uses JUMP TABLES with base-subtract indexing
- 70 of 180 "leaf" entries were 11 shared band dispatchers — honest recount: 132 unique leaf functions
- 55 sender-site boundary errors in the function census found & corrected
- Game body has NO game-class RTTI (only 13 names, security family) — class recovery must come from ctor/singleton correlation
