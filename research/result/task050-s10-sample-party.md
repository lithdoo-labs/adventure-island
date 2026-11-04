# Task 050 S10 Sample #8: PARTY_OPERATION (0x3B) — 33-Case Social Dispatcher

Handler @ **0x648120** (CWvsContext). Mode jump table @ RVA **0x6490B4**
(33 cases, modes 4..0x24).

## Wire schema (evidence: 0x64815A-0x6481AD)

```
PARTY_OPERATION (0x3B):
  mode : u8                       # 0x64815A; (mode-4) <= 0x20
  [jump-table dispatch, 33 cases]
  case 4 (0x648187):
    charid : i32                  # 0x648189
    name   : string               # 0x648197
    flag   : u8                   # 0x6481A2
    -> consults config singleton 0xBDD494 -> [+0x34] / [+0x38]
  ... 32 more cases
```

## Proven facts

| fact | evidence | confidence |
|---|---|---|
| party mode table: 33 cases (4..0x24) @0x6490B4 | 0x64816D-0x648180 | confirmed |
| CWvsContext +0x2E04 = party object ptr | 0x648139 | high |
| CWvsContext +0x2E08 = embedded party struct, 298 B (0x4A dwords + word) | rep movsd 0x64814E | confirmed |
| config singleton 0xBDD494 has +0x34/+0x38 party-related pointers | 0x6481AD | medium |
| case 4 shape = i32, str, u8 | read order | confirmed |

## Singleton consolidation

0xBDD494 now evidenced in: KEYMAP refresh path (0x49EE30 query), AUTO_POTION default,
PARTY case 4 (+0x34/+0x38). Role: **client configuration/state provider**
(semantic name candidate: CConfig, confidence medium — three independent uses).
