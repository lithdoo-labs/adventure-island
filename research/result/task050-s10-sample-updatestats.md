# Task 050 S10 Sample #4: UPDATE_STATS (0x22) Mask-Conditional Decode

Handler wrapper @ 0x6292F5; mask decoder @ **RVA 0xF2674** (`DecodeStatsMask`).
Demonstrates the bit-conditional read pattern that generalizes to TEMP_STATS and
all stat-family packets.

## Wire schema (evidence: 0xF2681-0xF2782)

```
UPDATE_STATS (0x22):
  flag  : u8       # wrapper 0x629311: !=0 -> reset +0x2088, stamp +0x208C (time 0x594C7A)
  mask  : i32      # 0xF2681
  if mask & 0x001: skin        : u8     -> stats+0x12
  if mask & 0x002: level       : i32    -> stats+0x13   (level-up check reads this)
  if mask & 0x004: stat4       : i32    -> stats+0x17
  if mask & 0x008: val64_A     : i64    -> stats+0x1B   (0x431E77 64-bit read)
  if mask & 0x010: val64_B     : i64    -> stats+0x23
  if mask & 0x020: val64_C     : i64    -> stats+0x2B
  if mask & 0x040: byteUpdate  : u8  -> f(+0x33) -> +0x35   (0x4F774D)
  if mask & 0x080: shortUpdate : i16 -> f(+0x39) -> +0x3D   (0x4F7780)
  if mask & 0x100: shortUpdate : i16 -> f(+0x41) -> +0x45
  if mask & 0x200: shortUpdate : i16 -> f(+0x49) -> +0x4D
  if mask & 0x400: shortUpdate : i16 -> f(+0x51) -> +0x55
  if mask & 0x800: shortUpdate : i16 -> f(+0x59) -> +0x5D
  ... (continues for higher bits)
```

## Wrapper semantics (0x6292F5)

```cpp
void CWvsContext::OnUpdateStats(CInPacket& pkt) {          // 0x6292F5
    uint8 flag = pkt.ReadByte();                           // 0x629311
    if (flag) {
        this->[0x2088] = 0;
        this->[0x208C] = TimeNow();                        // 0x594C7A
    }
    Stats* st = this->GetStats(&local);                    // 0x26F51
    ... name snapshot (esi+0x33, len 0x35) ...             // 0x4F7707
    mask = DecodeStatsMask(st, pkt);                       // 0xF2674 -> [ebp-0x14]
    if (mask & 0x38) {                                     // HP/MP/EXP family
        LocalAvatar([0xBDD490])->UpdateHPBar(pkt.ReadByte());  // 0x56795F
    }
    if (nameLen_new > nameLen_old) {                       // 0x6293AD jle
        // LEVEL-UP presentation (singleton [0xBDD490] gate):
        PlayLvlUpEffect(0xC00614A4, ...);                  // 0x14828B + 0x4B1C27
        PlaySound(0x826);                                  // 0x3A48D0
        ...
    }
}
```

## Proven facts this pass

| fact | evidence | confidence |
|---|---|---|
| DecodeStatsMask @ 0xF2674: 13+ bit-conditional fields | full test-chain 0xF2688-0xF2782 | confirmed |
| 0x431E77 = 64-bit reader primitive (NEW primitive) | three 8-byte reads | high |
| 0x4F774D / 0x4F7780 = byte/i16 stat update helpers | paired calls | high |
| stats+0x13 = level (i32) | wrapper reads it for lvl-up check 0x62935A | confirmed |
| stats+0x1B/+0x23/+0x2B = three 64-bit fields (exp/meso family) | 0x431E77 writes | high |
| CWvsContext+0x208C = timestamp (TimeNow 0x594C7A) | wrapper 0x629329 | high |
| singleton 0xBDD490 = local avatar (HP-bar update, lvl-up fx) | 0x629380, 0x6293B9 | high |
| mask & 0x38 = HP/MP/EXP subset triggers immediate HP-bar refresh | 0x629379 | medium |
| 0x3A48D0 = PlaySound(res) | res 0x826 at level-up | medium |

## Generalization

The `mask & bit -> read-type -> field-offset` chain is the canonical schema
pattern for all stat-family packets. TEMP_STATS (0x25/0x26) uses the same
0x431E77/0x4F7780 helper family with a different (buff) field table.
