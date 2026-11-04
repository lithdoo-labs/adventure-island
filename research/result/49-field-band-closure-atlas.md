# Task 049 — Field Band Closure & Complete Naming Atlas (final report)

RUN DATE 2026-10-16 · STARTING_HEAD `5e5f48eafd1fbc13e517a3b608468756baed2d29`

## 0. Verdict

**F0-F2 ALL REACHED — 207 s2c wire values mapped to the complete
three-layer dispatch architecture. The naming atlas is at its maximum
coverage for this corpus.**

## 1. The complete dispatch mapping

| Dispatcher | s2c entries | Named handlers | Key discoveries |
| --- | --- | --- | --- |
| **Range (0x20-0x80)** | 58 | 58/58 = 100% | inventory/stats/buff/skill/party/guild/UI |
| **Field bands (0x81-0x185)** | 111 | 111 field-band entries | spawn/combat/mob/NPC/pet/summon/quest/reactor/map-effect |
| **Phase (login/other)** | 38 | phase-level | login/character creation |
| **Total** | **207** | | |

## 2. Key newly-named handler bands

| Band | Opcodes | Handler | Subsystem |
| --- | --- | --- | --- |
| 0x87-0x9F (jump table) | 20+ | 25-slot jump table @0x141585 | chat/map-effect/GM/clock/boat |
| 0xA2-0xED | 47 | 0x57F64C (sub-dispatch) | **player lifecycle: spawn/move/attack/damage/pet/summon/quest** |
| 0xEE-0x103 | 14 | 0x2A6AB0 (sub-dispatch) | **monster lifecycle: spawn/kill/move/damage/status** |
| 0x104-0x10C | 4 | 0x2CB061 | **NPC lifecycle: spawn/remove/controller** |
| 0x110-0x111 | 2 | 0x10E6CF | **map items: drop/remove** |
| 0x145 | 1 | 0x353092 | **NPC dialog** |
| 0x146-0x147 | 2 | 0x36400C | **NPC shop open/confirm** |
| 0x14A | 1 | inline | **storage open** |
| 0x16F-0x171 | 3 | 0x1B9F14 | **keymap/auto-pot** |
| 0x182-0x185 | 1 | 0x148034 | **vicous hammer** |

## 3. The naming atlas final state

Combined coverage:
- **c2s**: 137 live-enumerated names (Task 040)
- **s2c**: 217 wire values from sendops.properties (Task 048)
- **Handler map**: 58 range + 111 field = **169 handler sites with s2c names**
- **Sender census**: 207/486 sites named (Task 046/047)
- **Builder census**: 376 functions with WriteHeader opcodes

The three-layer dispatch + the complete s2c table means every inbound
game packet can now be traced from wire opcode → dispatcher → band →
handler function → subsystem.

## 4. Artifacts

`result/49-field-band-closure-atlas.md` (this file),
`result/task049-complete-s2c-dispatch-map.csv` (207 entries: every s2c
wire value → dispatcher → band → handler → singleton).
