# Task 050 S10 Sample #11: NPC Shop (0x146/0x147)

Band @ 0x36400C; shop session decode @ **0x36026F**; dialog creation @ 0x59FCC2.

## Wire schemas (evidence: 0x36028C-0x36031A, 0x364091)

```
OPEN_NPC_SHOP (0x146):
  npcId  : i32      # -> session+0xB4
  count  : i16      # item count
  repeat count times:
    itemId : i32
    price  : i32
    tier = price / 10000 (idiv 0x2710)         # 0x3602E9
    if tier == 207 or 233:                     # extended-price items
      priceExt : 8 bytes raw                   # ReadBytes(double/64-bit)
    else:
      price2   : i16 (signed)                  # 0x36030F

CONFIRM_SHOP_TRANSACTION (0x147):
  mode : u8         # 6-way switch (0x364099): buy/sell result family
  (mode 3 path issues 4 bulk-update notifications)
```

## Architecture (proven)

```
0x146: close old session ([0xBD9020]) -> GetField(0x4376F2) ->
       field+0x130 check (0x4F746F, magic 0x3038D170) ->
       alloc 0x5F4 shop session (pool 0xBE1DE0) ->
       ctor/parse 0x364257 -> decode 0x36026F
0x147: session singleton 0xBD9020 -> vtbl+0x4C query(0xBDF48C) ->
       [esi+0xEC] state gate -> mode switch
dialog: 0x59FCC2 allocs 0xD0 dialog, singleton 0xBE2798 = shop UI manager
```

## Proven facts

| fact | evidence | confidence |
|---|---|---|
| shop item schema: i32,i32, tier-branched i64/i16 | loop 0x3602B1-0x36031A | confirmed |
| price tier = price/10000 vs {207, 233} | idiv 0x2710 + cmp | confirmed |
| extended price = 8-byte raw (double-family) | ReadBytes 0x431E77 x8 | high |
| singleton 0xBD9020 = shop session | both opcodes | high |
| singleton 0xBE2798 = shop UI manager | 0x59FD42 | medium |
| field+0x130 = shop-NPC discriminator (magic 0x3038D170) | 0x3641EE | medium |
| shop session size 0x5F4, npcId at +0xB4 | alloc + store | confirmed |
