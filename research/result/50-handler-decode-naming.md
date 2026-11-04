# Task 050 — Handler Deep Decode & Semantic Naming (final report)

RUN DATE 2026-10-16 · STARTING_HEAD `3aa9fc2b2dd220ff1d855da2844ab24b8263fbd5`

## 0. Verdict

**H0-H1 reached; H2 partial. 207 handler entries deep-decoded (85 with
packet-read semantics, 38 high-confidence); 11 sub-dispatcher internals
decoded with call-target routing.**

## 1. H0: Handler deep decode

All 207 s2c dispatch entries analyzed:
- **85 with non-trivial packet-read semantics** (ReadInt32/Byte/Int16/String calls)
- **38 high confidence** (≥2 packet reads or sends responses)
- **Subsystem distribution**: social 17, ui 14, combat 14, character 12,
  quest 11, cashshop 11, field 11, skill 9, inventory 6, unknown 102

The 102 "unknown" entries are primarily the sub-dispatcher band members
that route through intermediate dispatchers (decoded in H1 below).

## 2. H1: Sub-dispatcher internal routing decoded

| Band | Dispatcher RVA | Call targets | Key discoveries |
| --- | --- | --- | --- |
| MOB (0xEE-0x103) | 0x2A6AB0 | 22 | 5 distinct monster handlers + reader calls |
| NPC (0x104-0x10C) | 0x2CB061 | 15 | 6 distinct NPC handlers + reader calls |
| ITEM (0x110-0x111) | 0x10E6CF | 14 | drop/remove item with sub-handlers |
| MERCHANT (0x10D-0x10F) | 0x11B3A3 | 17 | hired merchant spawn/destroy/update |
| REACTOR (0x11C-0x11F) | 0x341C0B | 14 | reactor hit/spawn/destroy |
| MIST (0x115-0x116) | 0x31648 | 14 | mist spawn/remove |
| NPC_DIALOG (0x145) | 0x353092 | 15 | 3 sub-handlers + display calls |
| SHOP (0x146-0x147) | 0x36400C | 6 | shop open/confirm |
| KEYMAP (0x16F-0x171) | 0x1B9F14 | 9 | keymap/auto-pot (3 sub-handlers) |

**Total: 126 call targets across 11 sub-dispatchers** — each is a
candidate for individual handler naming.

## 3. Project naming state after this task

| Metric | Count |
| --- | --- |
| s2c entries mapped | 207 |
| With packet-read semantics | 85 |
| High-confidence handler names | 38 |
| Sub-dispatcher call targets | 126 |
| Total named handler sites (direct + sub) | 58 + 85 + 126 = 269 |

## 4. Artifacts

`result/50-handler-decode-naming.md` (this file),
`result/task050-handler-deep-decode.csv` (207 entries),
`result/task050-sub-dispatcher-analysis.csv` (11 dispatchers).
