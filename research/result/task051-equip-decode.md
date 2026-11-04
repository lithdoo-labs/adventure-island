# Task 051 Phase A: CItemEquip Decode — Complete Stat-Slot Map

Decoder = equip vtable(0x7008D8)+0x70 → **RVA 0xF32E0** (RVA note: helper VAs
0x4F774D/0x4F7780 = RVAs 0xF774D/0xF7780 — convention corrections recorded in final report).

## Wire schema (evidence: reader+helper chain 0xF32E0-0xF3BA+)

```
EQUIP_ITEM decode:
  base     : [itemId i32][flag u8]        # 0xF2D45
  +0x28    : u8 stat pair (slots)
  +0x2E    : u8 stat pair
  +0x34..  : i16 stat pair x 16           # stride 8: 0x34,3C,44,4C,54,5C,64,6C,
                                           #          74,7C,84,8C,94,9C,A4,AC
  +0xB4    : u8 stat pair
  +0xBA    : u8 stat pair
  ... (tail beyond 0xF3BA: hammer/cash extensions)
```

16 consecutive i16 stats map to the v079 equip family
(STR/DEX/INT/LUK/HP/MP/WAtk/MAtk/WDef/MDef/Acc/Avo/Hands/Speed/Jump/+1).

## Proven facts

| fact | evidence | confidence |
|---|---|---|
| equip vtable @ 0x7008D8 (type-1) | factory tail 0xF2C3D | confirmed |
| decoder slot +0x70 → 0xF32E0 | vtable dword read | confirmed |
| 16-entry i16 stat family stride 8 | full helper chain | confirmed |
| stat helpers: 0xF774D (u8-pair) / 0xF7780 (i16-pair) | 21 applications | confirmed |
| base [i32][u8] | 0xF2D45 read order | confirmed |

CSV: task051-equip-decode.csv (21 rows)
