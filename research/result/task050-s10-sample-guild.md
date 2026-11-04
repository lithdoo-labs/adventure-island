# Task 050 S10 Sample #9: GUILD_OPERATION (0x3E) — Binary-Search Switch

Handler @ **0x641174** (CWvsContext). Unlike PARTY/BUDDYLIST (jump tables),
guild uses a cmp/jg binary-search switch over 50+ modes (1..0x34+).

## Structure (evidence: 0x641192-0x64123D)

```
GUILD_OPERATION (0x3E):
  mode : u8                            # 0x641192
  [binary-search dispatch: 0x32, 0x24, 0x1C boundaries + dec/je singles]
  case 0x34-ish (full update):
    reset CWvsContext+0x2F7C guild container   # 0xA0B777
    flag = ReadByte()                          # booleanized 0x641213
    if flag: Deserialize(+0x2F7C, packet)      # 0x4F3CFC
    if CWvsContext+0x2FA2 != 0: guild UI live -> sound(0x93)
```

## Proven facts

| fact | evidence | confidence |
|---|---|---|
| CWvsContext +0x2F7C = embedded guild container (packet-deserializable) | 0x6411FF+0x4F3CFC | high |
| CWvsContext +0x2FA2 = guild UI/membership gate | 0x641228 | medium |
| 50+ guild modes via binary-search switch | cmp chains | confirmed |
| 0x4F3CFC = guild-container deserializer | 0x641221 | high |

## Social-family completion

CWvsContext social block fully mapped:
+0x2E04 party object / +0x2E08 party struct (298B) / +0x2F38 buddy container
(0x27-stride entries) / +0x2F7C guild container / +0x2FA2 guild gate.
