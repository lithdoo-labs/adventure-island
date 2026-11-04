# Task 050 S10 Sample #7: BUDDYLIST (0x3C) — Jump-Table Social Dispatcher

Handler @ **0x64915C** (CWvsContext method). Mode jump table @ RVA **0x6494E9**
(16 cases, modes 7..0x16 — buddy ops arrive post-login with mode >= 7).

## Wire schema (evidence: 0x649173-0x649236)

```
BUDDYLIST (0x3C):
  mode : u8                        # 0x649173; (mode-7) must be <= 0xF
  [jump-table dispatch, 16 cases]
  case 7  (0x64918E): container method 0x649DB4(packet)      # full list
  case 8  (0x64919F): # channel change:
    pos     : i32                 # 0x6491A1 -> buddy slot
    channel : u8                  # 0x6491BF
    cid     : i32                 # 0x6491CA
    -> CWvsContext+0x2F38 container updates:
       channelArray[+4][pos] = channel
       entry[pos].id(+0x12)  = cid        # entry stride 0x27 (39 bytes!)
    online/offline transition logic (old < 0 vs new >= 0)
  ... 14 more cases
```

## Buddy container layout (CWvsContext +0x2F38)

```
+0x00 : entries base pointer    # entry[i] at +i*0x27; id at entry+0x12
+0x04 : channel array pointer   # dword per buddy
entry size = 0x27 = 39 bytes    # CROSS-CONFIRMS the 0x27 block readers (0xF3BC1/0xF3BD0)
```

## Proven facts this pass

| fact | evidence | confidence |
|---|---|---|
| BUDDYLIST mode = jump table (16 cases, modes 7-0x16) | 0x649187 + table 0x6494E9 | confirmed |
| buddy entry stride 0x27 (39 B), id at +0x12 | imul ecx,0x27 @0x6491E5 | confirmed |
| CWvsContext +0x2F38 = buddy container (entries@+0, channels@+4) | 0x64918E-0x64920E | confirmed |
| case 8 = friend channel/online change (pos, channel u8, cid) | read order | confirmed |
| 0x27 block readers are buddy-entry decoders (cross-check) | stride match | high |
