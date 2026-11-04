# Task 050 S10 Sample #6: KEYMAP (0x16F) — 89×5 Table + Shadow Copy

Handler @ **0x1B9E4F** (KeymapUI object, singleton [0x3D95C]).
AUTO_HP_POT/AUTO_MP_POT (0x170/0x171) share handler @ 0x1B9F14 (tail 0x1B9EC8).

## Wire schema (evidence: 0x1B9E57-0x1B9E9C)

```
KEYMAP (0x16F):
  mode : u8                    # 0x1B9E57
  if mode == 0:                # full table follows
    repeat 89 times (0x59):    # loop 0x1B9E8D-0x1B9E9C
      entry : raw 5 bytes      # 0xF3BB2 = ReadBytes(dst,5): [type u8][action i32]
  else:                        # no payload; refresh from singleton [0xBDD494]
    refresh current table

AUTO_HP_POT (0x170) / AUTO_MP_POT (0x171):
  itemid : i32                 # 0x1B9ECF -> KeymapUI+0x380
  (+ fallback default logic when 0)
```

## Reconstructed source

```cpp
void CKeymapUI::OnKeymap(CInPacket& pkt) {                 // 0x1B9E4F
    uint8 mode = pkt.ReadByte();                           // 0x1B9E57
    if (mode != 0) {
        if (QueryCurrent([0xBDD494], &this->[+4]) == 0)    // 0x49EE30
            this->InitDefaults();                          // 0x5BA1AF
        this->RefreshUI();                                 // 0x5B9FCA
        return;
    }
    for (int i = 0; i < 0x59; i++)                         // 89 keys
        pkt.ReadBytes(&this->table[+4 + i*5], 5);          // 0xF3BB2
    this->PostProcess();                                   // 0x5B9F47
    memcpy(&this->[+0x1C1], &this->[+4], 0x1BD);          // 0xA6FCE0 shadow copy (445=89*5)
    this->RefreshUI();                                     // 0x5B9FCA
}

void CKeymapUI::OnAutoPotion(CInPacket& pkt) {             // 0x1B9EC8
    this->[0x380] = pkt.ReadInt32();                       // potion item id
    if (this->[0x380] == 0) { /* default from [0xBDD494] */ }
}
```

## Proven facts this pass

| fact | evidence | confidence |
|---|---|---|
| KEYMAP entry = raw 5 bytes ([type u8][action i32] in-memory layout) | 0xF3BB2 ReadBytes(5) | confirmed |
| 89-entry loop (0x59) with stride 5 | 0x1B9E88-0x1B9E9C | confirmed |
| CKeymapUI +4 = live table (445 B), +0x1C1 = committed shadow copy | memcpy len 0x1BD | confirmed |
| CKeymapUI +0x380 = auto-potion item id | 0x1B9EDC | high |
| **0x431E77 = ReadBytes(dst, N) generic raw reader** (corrects earlier "i64-only") | push 5 here, push 8 in UPDATE_STATS | confirmed |
| 0x46B7F8 = second block reader (sizes 0x27/0x25 seen) | adjacent thunks 0xF3BC1+ | high |
| mode byte gates full-table vs refresh | 0x1B9E5E | confirmed |
| singleton 0xBDD494 = keymap/config provider | both paths | medium |
