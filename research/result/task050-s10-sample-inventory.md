# Task 050 S10 Sample #5: MODIFY_INVENTORY_ITEM (0x20) + Polymorphic Item Architecture

Handler @ 0x6286EC; op loop back-edge @ 0x628B1B; item factory @ **0xF2A47**;
type registry @ **0xF2B2F**; shared item ctor 0xF8AF6.

## Wire schema (evidence: 0x628704-0x628B1E)

```
MODIFY_INVENTORY_ITEM (0x20):
  flag     : u8      # !=0 -> reset CWvsContext+0x2088, stamp +0x208C (TimeNow)
  op_count : u8      # 0x628748; <=0 -> done
  repeat op_count times:            # loop 0x62875B..0x628B1E (dec/jne)
    mode   : u8      # 0x62875E (movsx)
    slot   : u8      # 0x628769 (movsx)
    arg16  : i16     # 0x628774 (movsx)
    mode 0 (ADD):     DecodeItem(0xF2A47) full item + insert ops
    mode 1 (UPDATE):  0x628A3C
    mode 2 (MOVE):    0x628901
    mode 3 (REMOVE):  lookup 0x4296B0 + local-avatar(0xBDD490) path
    mode 4:           ReadInt32 + table op 0x4296B0(stats, out, slot, arg16)
  if dirty([ebp-0x24]): tail UI refresh
```

## Polymorphic item architecture (0xF2A47 → 0xF2B2F)

```cpp
CItem* DecodeItem(COut& out, CInPacket& pkt) {          // 0xF2A47
    uint8 type = pkt.ReadByte();                        // 0xF2A5C
    CItem* it = CreateItemByType(type, &out);           // 0xF2B2F
    if (!it) { out.valid = 0; return; }
    it->vtbl[0x70](it, pkt);                            // per-type decode @0xF2A8B
    out.item = it;                                      // +4
    ...
}

CItem* CreateItemByType(uint8 type) {                   // 0xF2B2F
    switch (type) {
    case 1:   // EQUIP
        obj = PoolAlloc(0xBE1DE0, 0xF9);                // 249 bytes: stat-slot array
        CItemBase::ctor(obj);                           // 0xF8AF6
        obj->vt = LoadVTable(0x7008C8 data table);      // dynamic: [0xB008C8]+
        obj->[0xED] = ...;                              // extra init
    case 2:   // USE / consumable
        obj = PoolAlloc(0xBE1DE0, 0x4D);  vtable = 0x700958;
    case 3:   // SETUP
        obj = PoolAlloc(0xBE1DE0, 0x79);  vtable = 0x700A50-family;
    case 100: // ETC/CASH-merged client type
        obj = PoolAlloc(0xBE1DE0, 0x72);  vtable = 0x700A50;
    default: return NULL;
    }
}
```

Item equality (0xF2ACD) compares fields +0x18/+0x1C/+0x20/+0x24 and
vtable+0x18() == 1 — cash/uniqueness discrimination.

## Proven facts this pass

| fact | evidence | confidence |
|---|---|---|
| op loop: [mode u8][slot u8][arg16 i16] × op_count | 0x628748-0x628B1E | confirmed |
| 5 modes (0-4) + default | sub/dec chain 0x62877E-0x62879D | confirmed |
| 0xF2A47 = polymorphic item decoder (type byte → factory → vtbl+0x70) | 0xF2A5C-0xF2A8B | confirmed |
| CItemEquip: type 1, size 0xF9, vtable ~0x7008C8 | 0xF2BFD-0xF2C2B | high |
| CItemUse: type 2, size 0x4D, vtable 0x700958 | 0xF2BB8-0xF2BDB | high |
| CItemSetup: type 3, size 0x79 | 0xF2B8D | high |
| 4th client type = 100, size 0x72, vtable 0x700A50 | 0xF2B60-0xF2B83 | high |
| shared base ctor 0xF8AF6 for all item types | four call sites | confirmed |
| item fields +0x18/+0x1C/+0x20/+0x24 in equality | 0xF2AEC-0xF2B02 | high |
| 0x4296B0 = inventory slot lookup (stats, out, slot, arg) | modes 3/4 | high |

## S4 significance

The CItem family provides 4 SEMANTIC class identities (equip/use/setup/etc)
with triple evidence: factory switch + ctor + vtable + per-type decoder slot —
the strongest class naming signal found in the game body to date.
