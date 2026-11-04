# Task 050 S10 Sample #10: TEMP_STATS (0x25/0x26) — Buff Mask Decode

Wrappers: 0x25 @ 0x62A040 (apply), 0x26 @ 0x62A05D (reset 0x38453C).
Decoder @ **RVA 0x3848B7** (NOTE: call target printed as VA 0x7848B7 — the
recurring VA/RVA trap, corrected). Buff codec family = 0x3848B7/0x38453C/0x38FABE.

## Wire schema (evidence: 0x3848C2-0x384975)

```
TEMP_STATS (0x25):
  mask : i32                       # 0x3848C2
  if mask & 0x001: entry(+0x00) = f16(ReadInt16())  -> stored +0x08
  if mask & 0x002: entry(+0x0C) = f16(ReadInt16())  -> stored +0x14
  if mask & 0x004: entry(+0x18) ...                  -> +0x20
  if mask & 0x008: (+0x24) -> +0x2C
  if mask & 0x010: (+0x30) -> +0x38
  if mask & 0x020: (+0x3C) -> +0x44
  ... (bit chain continues)
Entry layout: stride 0x0C pairs (raw@+X, computed@+X+8); 0x416E16/0x416E36 = pair codec.

TEMP_STATS_RESET (0x26): 0x38453C clears the same entries (mask-driven).
```

## Proven facts

| fact | evidence | confidence |
|---|---|---|
| CWvsContext +0x2D30 = temp-stats (buff) container | wrapper lea 0x62A047 | confirmed |
| buff entries: stride-0x0C (raw, computed) pairs | 0x3848C9-0x38496D | confirmed |
| 0x416E36 = buff-value combiner (i16 + entry) | six call sites | high |
| buff codec family 0x38xxxx: 0x3848B7 apply / 0x38453C reset / 0x38FABE spawn-deserialize | three uses | high |
| bonus: 0x62A076 = time-gated auto-sender (dt > 0xC8 vs +0x32F4, sends via SocketSingleton) | 0x62A0AE-0x62A0D4 | medium |
| CWvsContext +0x32F4 = last-response timestamp | 0x62A0AE | medium |
